#!/usr/bin/env python3

import argparse
import datetime
import html
import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.request
from difflib import SequenceMatcher
from email.utils import parsedate_to_datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "site" / "data" / "catalog.json"
GENERATED_PATH = ROOT / "catalog" / "bricklink.generated.json"
REPORT_PATH = ROOT / ".cache" / "brickset" / "bricklink-report.json"
SET_CACHE_DIR = ROOT / ".cache" / "brickset" / "minifigs-in-set"
MINIFIG_CACHE_DIR = ROOT / ".cache" / "brickset" / "minifigs"

DEFAULT_DELAY = float(os.getenv("BRICKSET_SCRAPE_DELAY", "0.7"))
DEFAULT_MAX_DELAY = float(os.getenv("BRICKSET_SCRAPE_MAX_DELAY", "30"))
MAX_SAMPLE_SETS = 3
MAX_DETAIL_LOOKUPS = 3

GENERIC_SUBTHEMES = {
    "",
    "Book Parts",
    "Miscellaneous",
    "Product Collection",
    "Promotional",
    "Seasonal",
    "{None}",
}

LOW_SIGNAL_SOURCE_KINDS = {
    "book",
    "magazine",
    "seasonal",
}

STOPWORDS = {
    "a",
    "an",
    "and",
    "arm",
    "arms",
    "black",
    "blue",
    "bluish",
    "brown",
    "cape",
    "classic",
    "dark",
    "gray",
    "green",
    "hair",
    "hand",
    "hands",
    "head",
    "helmet",
    "hips",
    "hood",
    "leg",
    "legs",
    "light",
    "medium",
    "nougat",
    "orange",
    "plain",
    "printed",
    "print",
    "red",
    "reddish",
    "skin",
    "tan",
    "the",
    "torso",
    "trans",
    "vest",
    "white",
    "with",
    "without",
    "yellow",
}


def load_json(path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text())


def normalize_text(value):
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    ascii_value = ascii_value.replace("&", " and ")
    ascii_value = ascii_value.replace("/", " ")
    ascii_value = re.sub(r"[,:;()\\[\\].'\"-]+", " ", ascii_value)
    ascii_value = ascii_value.replace("grey", "gray")
    ascii_value = re.sub(r"\\bskin\\b", "head", ascii_value)
    ascii_value = re.sub(r"\\s+", " ", ascii_value)
    return ascii_value.strip()


def core_tokens(value):
    return [token for token in normalize_text(value).split() if len(token) > 1 and token not in STOPWORDS]


def jaccard_similarity(left, right):
    left_set = set(core_tokens(left))
    right_set = set(core_tokens(right))
    if not left_set or not right_set:
        return 0.0
    return len(left_set & right_set) / len(left_set | right_set)


def composite_similarity(left, right):
    left_norm = normalize_text(left)
    right_norm = normalize_text(right)
    ratio = SequenceMatcher(None, left_norm, right_norm).ratio()
    token_score = jaccard_similarity(left, right)
    return (ratio * 0.65) + (token_score * 0.35)


def slugify(value):
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")


def unique_by_set(appearances):
    seen = set()
    ordered = []
    for appearance in appearances:
        set_num = appearance.get("set_num")
        if set_num and set_num not in seen:
            seen.add(set_num)
            ordered.append(appearance)
    return ordered


def is_standard_set_number(set_num):
    return bool(re.match(r"^\d", str(set_num or "")))


def choose_sample_sets(figure, max_sample_sets):
    appearances = unique_by_set(figure.get("setAppearances", []))
    strongly_preferred = [
        appearance
        for appearance in appearances
        if is_standard_set_number(appearance.get("set_num"))
        and appearance.get("source_kind") not in LOW_SIGNAL_SOURCE_KINDS
        and appearance.get("bricksetSubtheme") not in GENERIC_SUBTHEMES
    ]
    preferred = [
        appearance
        for appearance in appearances
        if appearance.get("source_kind") not in LOW_SIGNAL_SOURCE_KINDS
        and appearance.get("bricksetSubtheme") not in GENERIC_SUBTHEMES
    ]

    if strongly_preferred:
        return strongly_preferred[:max_sample_sets]

    if preferred:
        return preferred[:max_sample_sets]

    return appearances[:max_sample_sets]


class BricksetClient:
    def __init__(self, delay, refresh=False, max_delay=DEFAULT_MAX_DELAY):
        self.min_delay = max(0.1, delay)
        self.current_delay = self.min_delay
        self.max_delay = max(self.min_delay, max_delay)
        self.refresh = refresh
        self.last_request_at = 0.0
        self.success_streak = 0
        self.total_requests = 0
        self.total_network_fetches = 0
        self.throttle_events = 0

    def _throttle(self):
        elapsed = time.monotonic() - self.last_request_at
        wait_for = self.current_delay - elapsed
        if wait_for > 0:
            time.sleep(wait_for)

    def _parse_retry_after(self, value):
        if not value:
            return None

        try:
            return max(0.0, float(value))
        except ValueError:
            try:
                retry_at = parsedate_to_datetime(value)
            except (TypeError, ValueError, IndexError):
                return None
            now = datetime.datetime.now(datetime.timezone.utc)
            return max(0.0, (retry_at - now).total_seconds())

    def _record_success(self):
        self.success_streak += 1
        if self.current_delay <= self.min_delay:
            return

        if self.success_streak >= 3:
            self.current_delay = max(self.min_delay, round(self.current_delay * 0.9, 3))
            self.success_streak = 0

    def _record_throttle(self, retry_after, attempt_number):
        self.throttle_events += 1
        self.success_streak = 0

        base_wait = max(1.0, self.current_delay * (1.75 ** max(0, attempt_number - 1)))
        wait_for = retry_after if retry_after is not None else base_wait
        wait_for = min(self.max_delay, max(base_wait, wait_for))

        next_delay = max(self.current_delay * 1.5, min(self.max_delay, wait_for * 0.75))
        self.current_delay = min(self.max_delay, max(self.min_delay, round(next_delay, 3)))
        return wait_for

    def stats(self):
        return {
            "requestDelayFloorSeconds": self.min_delay,
            "finalAdaptiveDelaySeconds": round(self.current_delay, 3),
            "maxAdaptiveDelaySeconds": self.max_delay,
            "totalRequests": self.total_requests,
            "networkFetches": self.total_network_fetches,
            "throttleEvents": self.throttle_events,
        }

    def _fetch(self, url, cache_path):
        if not self.refresh and cache_path.exists():
            return cache_path.read_text()

        for attempt in range(5):
            self._throttle()
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    body = response.read().decode("utf-8", "replace")
                self.total_requests += 1
                self.total_network_fetches += 1
                self.last_request_at = time.monotonic()
                self._record_success()
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(body)
                return body
            except urllib.error.HTTPError as error:
                self.total_requests += 1
                self.last_request_at = time.monotonic()
                if error.code == 429 and attempt < 4:
                    retry_after = self._parse_retry_after(error.headers.get("Retry-After"))
                    wait_for = self._record_throttle(retry_after, attempt + 1)
                    print(
                        f"Brickset throttled request for {url}; sleeping {wait_for:.1f}s "
                        f"and raising adaptive delay to {self.current_delay:.1f}s before retry {attempt + 1}/4."
                    )
                    time.sleep(wait_for)
                    continue
                raise

        raise RuntimeError(f"Failed to fetch {url}")

    def get_set_minifigs(self, set_num):
        cache_path = SET_CACHE_DIR / f"{set_num}.html"
        url = f"https://brickset.com/minifigs/in-{set_num}"
        return parse_set_minifigs(self._fetch(url, cache_path))

    def get_minifig_detail_sets(self, bricklink_number, slug_hint):
        slug = slug_hint or slugify(bricklink_number)
        cache_path = MINIFIG_CACHE_DIR / f"{bricklink_number}.html"
        url = f"https://brickset.com/minifigs/{bricklink_number}/{slug}"
        return parse_minifig_detail_sets(self._fetch(url, cache_path))


def parse_set_minifigs(markup):
    articles = re.findall(r"<article class=['\"]set['\"]>(.*?)</article>", markup, re.S)
    results = []

    for article in articles:
        code_match = re.search(r"<h1><a href=['\"]/minifigs/([^/'\"]+)/(.*?)['\"]>(.*?)</a></h1>", article, re.S)
        if not code_match:
            continue

        qty_match = re.search(r"class=['\"]qty['\"]>(\\d+)x</div>", article)
        name = html.unescape(re.sub(r"<.*?>", "", code_match.group(3))).strip()

        results.append(
            {
                "bricklinkNumber": code_match.group(1),
                "slug": code_match.group(2),
                "name": name,
                "quantity": int(qty_match.group(1)) if qty_match else 1,
            }
        )

    return results


def parse_minifig_detail_sets(markup):
    matches = re.findall(r"<dt>Appears in</dt>\\s*<dd>(.*?)</dd>", markup, re.S)
    for match in matches:
        if "/sets/" in match:
            return re.findall(r"/sets/([A-Za-z0-9-]+)", match)
    return []


def build_candidates(figure, sample_sets, client):
    candidates = {}

    for appearance in sample_sets:
        for row in client.get_set_minifigs(appearance["set_num"]):
            candidate = candidates.setdefault(
                row["bricklinkNumber"],
                {
                    "bricklinkNumber": row["bricklinkNumber"],
                    "bricklinkName": row["name"],
                    "slug": row["slug"],
                    "setHits": set(),
                },
            )
            candidate["setHits"].add(appearance["set_num"])

    return candidates


def score_candidates(figure, candidates, sample_set_nums):
    scored = []
    for candidate in candidates.values():
        name_score = max(
            composite_similarity(figure["name"], candidate["bricklinkName"]),
            composite_similarity(figure["character"], candidate["bricklinkName"]),
        )
        coverage = len(candidate["setHits"]) / len(sample_set_nums)
        score = (coverage * 6.0) + (name_score * 4.0)
        scored.append(
            {
                **candidate,
                "coverage": coverage,
                "nameScore": name_score,
                "setOverlap": 0.0,
                "score": score,
                "candidateSetCount": 0,
            }
        )

    scored.sort(key=lambda item: (item["score"], item["coverage"], item["nameScore"]), reverse=True)
    return scored


def classify_match(top, second):
    margin = top["score"] - second["score"] if second else top["score"]

    if top["coverage"] >= 1.0 and top["score"] >= 7.8 and margin >= 1.0:
        return "high"
    if top["coverage"] >= 1.0 and top["nameScore"] >= 0.72 and margin >= 0.7:
        return "high"
    if top["coverage"] >= 1.0 and top["nameScore"] >= 0.68 and top["setOverlap"] >= 0.66 and margin >= 0.6:
        return "high"
    if top["score"] >= 7.1 and top["coverage"] >= 0.66 and top["nameScore"] >= 0.6 and margin >= 0.55:
        return "high"
    if top["score"] >= 6.2 and top["coverage"] >= 0.66 and top["nameScore"] >= 0.52 and margin >= 0.35:
        return "medium"
    return None


def match_figure(figure, client, max_sample_sets, detail_lookups):
    sample_sets = choose_sample_sets(figure, max_sample_sets)
    if not sample_sets:
        return None

    sample_set_nums = [appearance["set_num"] for appearance in sample_sets]
    candidates = build_candidates(figure, sample_sets, client)
    if not candidates:
        return None

    scored = score_candidates(figure, candidates, sample_set_nums)
    if detail_lookups > 0:
        for candidate in scored[:detail_lookups]:
            candidate_sets = client.get_minifig_detail_sets(candidate["bricklinkNumber"], candidate["slug"])
            candidate["candidateSetCount"] = len(candidate_sets)
            candidate["setOverlap"] = len(set(candidate_sets) & set(sample_set_nums)) / len(sample_set_nums) if candidate_sets else 0.0
            candidate["score"] += candidate["setOverlap"] * 2.0

        scored.sort(key=lambda item: (item["score"], item["coverage"], item["nameScore"]), reverse=True)

    scored = scored[: max(detail_lookups, 0) + 2]
    top = scored[0]
    second = scored[1] if len(scored) > 1 else None
    confidence = classify_match(top, second)

    if not confidence:
        return {
            "status": "unresolved",
            "figureId": figure["id"],
            "figureName": figure["name"],
            "sampleSets": sample_set_nums,
            "candidates": [
                {
                    **candidate,
                    "setHits": sorted(candidate["setHits"]),
                }
                for candidate in scored[:5]
            ],
        }

    return {
        "status": "matched",
        "bricklinkNumber": top["bricklinkNumber"],
        "bricklinkUrl": f"https://www.bricklink.com/v2/catalog/catalogitem.page?M={top['bricklinkNumber']}",
        "bricklinkName": top["bricklinkName"],
        "bricklinkConfidence": confidence,
        "bricklinkScore": round(top["score"], 4),
        "bricklinkMatchSampleSets": sample_set_nums,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Generate BrickLink minifig number mappings from Brickset pages.")
    parser.add_argument("--catalog", type=Path, default=CATALOG_PATH, help="Catalog JSON to enrich.")
    parser.add_argument("--output", type=Path, default=GENERATED_PATH, help="Generated BrickLink mapping file.")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY, help="Minimum starting delay between Brickset requests.")
    parser.add_argument("--max-delay", type=float, default=DEFAULT_MAX_DELAY, help="Upper bound for the adaptive delay after throttling.")
    parser.add_argument("--limit", type=int, default=0, help="Only process the first N figures.")
    parser.add_argument("--refresh", action="store_true", help="Ignore cached Brickset HTML and fetch fresh pages.")
    parser.add_argument("--max-sample-sets", type=int, default=MAX_SAMPLE_SETS, help="How many set pages to sample per figure.")
    parser.add_argument("--detail-lookups", type=int, default=0, help="How many top candidates should fetch Brickset minifig detail pages for set-overlap tiebreaking.")
    return parser.parse_args()


def main():
    args = parse_args()
    catalog = load_json(args.catalog, [])
    existing = load_json(args.output, {"figures": {}})
    existing_figures = existing.get("figures", {})
    client = BricksetClient(delay=args.delay, refresh=args.refresh, max_delay=args.max_delay)

    matched = {}
    unresolved = []

    figures = catalog[: args.limit] if args.limit else catalog
    for index, figure in enumerate(figures, start=1):
        # Preserve previous high-confidence mappings on incremental reruns.
        prior = existing_figures.get(figure["id"])
        if prior and prior.get("bricklinkNumber"):
            matched[figure["id"]] = prior
            continue

        try:
            result = match_figure(figure, client, args.max_sample_sets, args.detail_lookups)
        except Exception as error:
            unresolved.append(
                {
                    "status": "error",
                    "figureId": figure["id"],
                    "figureName": figure["name"],
                    "error": str(error),
                }
            )
            continue

        if result and result.get("status") == "matched":
            matched[figure["id"]] = result
        elif result:
            unresolved.append(result)

        if index % 100 == 0 or index == len(figures):
            print(f"Processed {index}/{len(figures)} figures; matched {len(matched)} so far.")

    payload = {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": "Brickset public minifig pages",
        "figures": matched,
        "stats": {
            "catalogFigures": len(catalog),
            "processedFigures": len(figures),
            "matchedFigures": len(matched),
            "unresolvedFigures": len(unresolved),
            **client.stats(),
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2))

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps({"generatedAt": payload["generatedAt"], "unresolved": unresolved[:500]}, indent=2))

    print(f"Wrote {len(matched)} BrickLink mappings to {args.output}")
    print(f"Wrote unresolved report to {REPORT_PATH}")


if __name__ == "__main__":
    main()
