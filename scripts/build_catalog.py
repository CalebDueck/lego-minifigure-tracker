#!/usr/bin/env python3

import csv
import datetime
import gzip
import io
import json
import os
import re
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path


BASE_URL = "https://cdn.rebrickable.com/media/downloads/"
BRICKSET_API_URL = "https://brickset.com/api/v3.asmx/getSets"
ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / ".cache" / "rebrickable"
BRICKSET_CACHE_PATH = ROOT / ".cache" / "brickset" / "star-wars-sets.json"
OUTPUT_DIR = ROOT / "site" / "data"
OVERRIDES_PATH = ROOT / "catalog" / "overrides.json"
GENERATED_BRICKLINK_PATH = ROOT / "catalog" / "bricklink.generated.json"

FILES = {
    "themes": "themes.csv.gz",
    "sets": "sets.csv.gz",
    "inventories": "inventories.csv.gz",
    "inventory_minifigs": "inventory_minifigs.csv.gz",
    "inventory_sets": "inventory_sets.csv.gz",
    "minifigs": "minifigs.csv.gz",
}

SERIES_ORDER = [
    "Young Jedi Adventures",
    "Episode I - The Phantom Menace",
    "Episode II - Attack of the Clones",
    "Episode III - Revenge of the Sith",
    "The Clone Wars",
    "The Bad Batch",
    "Rebels",
    "Obi-Wan Kenobi",
    "Andor",
    "Rogue One",
    "Solo",
    "Episode IV - A New Hope",
    "Episode V - The Empire Strikes Back",
    "Episode VI - Return of the Jedi",
    "The Mandalorian",
    "The Book of Boba Fett",
    "Ahsoka",
    "Skeleton Crew",
    "The Mandalorian and Grogu",
    "The Acolyte",
    "Resistance",
    "Episode VII - The Force Awakens",
    "Episode VIII - The Last Jedi",
    "Episode IX - The Rise of Skywalker",
    "Battlefront",
    "Jedi: Fallen Order",
    "The Force Unleashed",
    "The Old Republic",
    "The Freemaker Adventures",
    "The Yoda Chronicles",
    "Legends",
    "Galaxy's Edge",
    "Rebuild the Galaxy",
    "Holiday / Special",
    "Expanded Universe / Other",
]

BRICKSET_SUBTHEME_TO_SERIES = {
    "Ahsoka": "Ahsoka",
    "Andor": "Andor",
    "Battlefront": "Battlefront",
    "Episode I": "Episode I - The Phantom Menace",
    "Episode II": "Episode II - Attack of the Clones",
    "Episode III": "Episode III - Revenge of the Sith",
    "Episode IV": "Episode IV - A New Hope",
    "Episode IX": "Episode IX - The Rise of Skywalker",
    "Episode V": "Episode V - The Empire Strikes Back",
    "Episode VI": "Episode VI - Return of the Jedi",
    "Episode VII": "Episode VII - The Force Awakens",
    "Episode VIII": "Episode VIII - The Last Jedi",
    "Galaxy's Edge": "Galaxy's Edge",
    "Jedi: Fallen Order": "Jedi: Fallen Order",
    "Legends": "Legends",
    "Obi-Wan Kenobi": "Obi-Wan Kenobi",
    "Rebels": "Rebels",
    "Rebuild the Galaxy": "Rebuild the Galaxy",
    "Resistance": "Resistance",
    "Rogue One": "Rogue One",
    "Seasonal": "Holiday / Special",
    "Skeleton Crew": "Skeleton Crew",
    "Solo": "Solo",
    "The Acolyte": "The Acolyte",
    "The Bad Batch": "The Bad Batch",
    "The Book of Boba Fett": "The Book of Boba Fett",
    "The Clone Wars": "The Clone Wars",
    "The Force Unleashed": "The Force Unleashed",
    "The Freemaker Adventures": "The Freemaker Adventures",
    "The Mandalorian": "The Mandalorian",
    "The Mandalorian and Grogu": "The Mandalorian and Grogu",
    "The Old Republic": "The Old Republic",
    "The Yoda Chronicles": "The Yoda Chronicles",
    "Young Jedi Adventures": "Young Jedi Adventures",
}

SERIES_RULES = [
    (
        "Holiday / Special",
        re.compile(r"santa|holiday|christmas|snowman|reindeer|sweater", re.I),
    ),
    (
        "The Clone Wars",
        re.compile(
            r"clone wars|captain rex|commander fox|asajj|cad bane|hondo|savage opress|pre vizsla|bo-katan.*tcw|arc trooper|wolffe",
            re.I,
        ),
    ),
    (
        "Rebels",
        re.compile(
            r"rebels|ezra bridger|kanan jarrus|hera syndulla|sabine wren|garazeb|chopper|agent kallus|grand inquisitor|thrawn",
            re.I,
        ),
    ),
    (
        "Rogue One",
        re.compile(
            r"rogue one|jyn erso|cassian andor|k-2so|chirrut|baze malbus|krennic|bodhi rook|death trooper|shoretrooper",
            re.I,
        ),
    ),
    (
        "Solo",
        re.compile(
            r"solo|qi'ra|qi-ra|tobias beckett|rio durant|l3-37|enfys nest|dryden vos|young han|young lando",
            re.I,
        ),
    ),
    (
        "The Mandalorian",
        re.compile(
            r"mandalorian|din djarin|grogu|cara dune|greef karga|moff gideon|the armorer|paz vizsla|dark trooper|koska reeves",
            re.I,
        ),
    ),
    (
        "The Book of Boba Fett",
        re.compile(r"book of boba|black krrsantan|boba fett.*series", re.I),
    ),
    (
        "Obi-Wan Kenobi",
        re.compile(
            r"\breva\b|\bthird sister\b|\bfifth brother\b|\btala durith\b|kenobi series|inquisitor transport scythe|obi-wan's jedi starfighter.*2022",
            re.I,
        ),
    ),
    (
        "Andor",
        re.compile(r"andor|dedra meero|luthen rael|syril karn", re.I),
    ),
    (
        "Ahsoka",
        re.compile(r"ahsoka series|baylan skoll|shin hati|morgan elsbeth|huyang", re.I),
    ),
    (
        "The Acolyte",
        re.compile(
            r"\bthe acolyte\b|\bmae aniseya\b|\bosha aniseya\b|\bqimir\b|\bmaster sol\b|\bsol\b",
            re.I,
        ),
    ),
    (
        "Episode I - The Phantom Menace",
        re.compile(
            r"phantom menace|qui-gon|qui gon|jar jar|watto|boss nass|sebulba|tarpals|nute gunray|naboo swamp|gungan|anakin.?s podracer|maul's sith infiltrator|lightsaber duel|darth maul",
            re.I,
        ),
    ),
    (
        "Episode II - Attack of the Clones",
        re.compile(
            r"attack of the clones|jango fett|zam wesell|dexter jettster|arena|count dooku|kamino|geonosis",
            re.I,
        ),
    ),
    (
        "Episode III - Revenge of the Sith",
        re.compile(
            r"revenge of the sith|mustafar|general grievous|commander cody|utapau|palpatine's arrest",
            re.I,
        ),
    ),
    (
        "Episode IV - A New Hope",
        re.compile(
            r"a new hope|death star|greedo|jawa|sandcrawler|mos eisley|grand moff tarkin|tie fighter|stormtrooper|luke skywalker.*tatooine|landspeeder|old obi-wan|ben kenobi",
            re.I,
        ),
    ),
    (
        "Episode V - The Empire Strikes Back",
        re.compile(
            r"empire strikes back|hoth|echo base|snowtrooper|at-at|dagobah|bacta",
            re.I,
        ),
    ),
    (
        "Episode VI - Return of the Jedi",
        re.compile(
            r"return of the jedi|endor|ewok|wicket|boushh|jabba|sarlacc|final duel|gamorrean",
            re.I,
        ),
    ),
    (
        "Episode VII - The Force Awakens",
        re.compile(
            r"force awakens|finn|poe dameron|bb-8|captain phasma|kylo ren|maz kanata",
            re.I,
        ),
    ),
    (
        "Episode VIII - The Last Jedi",
        re.compile(r"last jedi|rose tico|holdo|crait", re.I),
    ),
    (
        "Episode IX - The Rise of Skywalker",
        re.compile(r"rise of skywalker|zorii bliss|jannah|sith trooper", re.I),
    ),
]

SET_EXCLUDE_TERMS = [
    "notebook",
    "poster",
    "book light",
    "watch bundle",
    "stationery",
]

GENERIC_CHARACTER_FIXES = {
    "R2-D2": "R2-D2",
    "C-3PO": "C-3PO",
    "C1-10P": "C1-10P",
    "Bb-8": "BB-8",
    "Bb-9e": "BB-9E",
}


def slugify(value):
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")


def choose_set_series(set_row, figure_catalog_by_id):
    if set_row.get("series_candidate"):
        return set_row["series_candidate"]

    series_counts = defaultdict(int)
    series_best_order = {}
    for figure_id in set_row["figure_ids"]:
        figure = figure_catalog_by_id.get(figure_id)
        if not figure:
            continue

        series = figure["movieSeries"]
        series_counts[series] += 1
        current_best = series_best_order.get(series, figure["catalogOrder"])
        series_best_order[series] = min(current_best, figure["catalogOrder"])

    if not series_counts:
        return "Expanded Universe / Other"

    return sorted(
        series_counts.keys(),
        key=lambda series: (
            -series_counts[series],
            SERIES_ORDER.index(series) if series in SERIES_ORDER else len(SERIES_ORDER),
            series_best_order.get(series, 10**9),
            series,
        ),
    )[0]


def download_to_cache(file_name):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = CACHE_DIR / file_name
    if not target.exists():
        request = urllib.request.Request(BASE_URL + file_name, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request) as response:
            target.write_bytes(response.read())
    return target


def load_csv(name):
    cache_path = download_to_cache(FILES[name])
    with gzip.GzipFile(fileobj=io.BytesIO(cache_path.read_bytes())) as gz_file:
        text = gz_file.read().decode("utf-8", "replace").splitlines()
    return list(csv.DictReader(text))


def load_overrides():
    generated = {"figures": {}}
    manual = {"figures": {}}

    if GENERATED_BRICKLINK_PATH.exists():
        generated = json.loads(GENERATED_BRICKLINK_PATH.read_text())

    if OVERRIDES_PATH.exists():
        manual = json.loads(OVERRIDES_PATH.read_text())

    merged = dict(generated.get("figures", {}))
    merged.update(manual.get("figures", {}))
    return {"figures": merged}


def load_brickset_cache():
    if not BRICKSET_CACHE_PATH.exists():
        return None
    return json.loads(BRICKSET_CACHE_PATH.read_text())


def write_brickset_cache(payload):
    BRICKSET_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    BRICKSET_CACHE_PATH.write_text(json.dumps(payload, indent=2))


def fetch_brickset_star_wars_sets(api_key):
    page_number = 1
    page_size = 500
    matches = None
    collected = {}

    while matches is None or len(collected) < matches:
        params = f"{{'theme':'Star Wars','pageSize':'{page_size}','pageNumber':'{page_number}'}}"
        payload = {
            "apiKey": api_key,
            "userHash": "",
            "params": params,
        }
        url = BRICKSET_API_URL + "?" + urllib.parse.urlencode(payload)
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request) as response:
            data = json.load(response)

        if data.get("status") != "success":
            raise RuntimeError(f"Brickset getSets failed: {data.get('message', 'unknown error')}")

        matches = int(data.get("matches") or 0)
        set_rows = data.get("sets") or []
        if not set_rows:
            break

        for row in set_rows:
            set_num = f"{row['number']}-{row['numberVariant']}"
            collected[set_num] = {
                "set_num": set_num,
                "name": row.get("name", ""),
                "year": row.get("year"),
                "subtheme": row.get("subtheme") or "",
                "bricksetUrl": row.get("bricksetURL") or "",
            }

        page_number += 1

    return {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": "Brickset API v3",
        "matches": matches or len(collected),
        "sets": collected,
    }


def load_brickset_sets():
    api_key = os.getenv("BRICKSET_API_KEY", "").strip()
    cached = load_brickset_cache()

    if api_key:
        try:
            payload = fetch_brickset_star_wars_sets(api_key)
            write_brickset_cache(payload)
            return payload["sets"], {
                "enabled": True,
                "source": "Brickset API v3",
                "fetchedAt": payload["generatedAt"],
            }
        except Exception as error:
            if cached:
                return cached.get("sets", {}), {
                    "enabled": True,
                    "source": "Brickset cache",
                    "fetchedAt": cached.get("generatedAt"),
                    "warning": str(error),
                }
            print(f"Warning: Brickset enrichment failed ({error}); falling back to legacy series inference.")
            return {}, {
                "enabled": False,
                "source": "unavailable",
                "warning": str(error),
            }

    if cached:
        return cached.get("sets", {}), {
            "enabled": True,
            "source": "Brickset cache",
            "fetchedAt": cached.get("generatedAt"),
        }

    return {}, {
        "enabled": False,
        "source": "disabled",
    }


def build_theme_chain(theme_id, themes_by_id):
    chain = []
    seen = set()
    while theme_id and theme_id in themes_by_id and theme_id not in seen:
        seen.add(theme_id)
        row = themes_by_id[theme_id]
        chain.append(row["name"])
        theme_id = row["parent_id"]
    return list(reversed(chain))


def pick_latest_inventories(inventories):
    latest = {}
    for row in inventories:
        set_num = row["set_num"]
        version = int(row["version"] or 0)
        current = latest.get(set_num)
        if current is None or version > current[0]:
            latest[set_num] = (version, row["id"])
    return latest


def extract_character(name):
    head = name.split(",", 1)[0].strip()
    head = re.sub(r"\s+", " ", head)
    if head.lower().startswith("astromech droid"):
        return "Astromech Droid"
    if head.lower().startswith("battle droid"):
        return "Battle Droid"
    if head.lower().startswith("clone trooper"):
        return head
    if head.lower().startswith("stormtrooper"):
        return head
    if head.lower().startswith("imperial officer"):
        return "Imperial Officer"
    if head.lower().startswith("rebel pilot"):
        return "Rebel Pilot"
    return GENERIC_CHARACTER_FIXES.get(head.title(), head)


def extract_variant(name):
    parts = name.split(",", 1)
    return parts[1].strip() if len(parts) > 1 else ""


def normalize_brickset_series(subtheme):
    return BRICKSET_SUBTHEME_TO_SERIES.get(subtheme or "")


def guess_series(name, appearance_sets, override=None):
    if override:
        return override

    for appearance in appearance_sets:
        if appearance.get("seriesCandidate"):
            return appearance["seriesCandidate"]

    haystack = " ".join(
        [
            name,
            *[item["name"] for item in appearance_sets],
            *[item["theme_path"] for item in appearance_sets],
            *[item.get("bricksetSubtheme", "") for item in appearance_sets],
        ]
    )
    for label, pattern in SERIES_RULES:
        if pattern.search(haystack):
            return label

    first_theme = appearance_sets[0]["theme_path"] if appearance_sets else ""
    if "Original Trilogy Collection" in first_theme:
        return "Episode IV - A New Hope"
    if "Ultimate Collector Series" in first_theme and appearance_sets:
        year = appearance_sets[0]["year"]
        if year <= 2002:
            return "Episode I - The Phantom Menace"

    return "Expanded Universe / Other"


def source_kind(theme_path):
    lowered = theme_path.lower()
    if lowered.startswith("books >"):
        return "book"
    if "advent" in lowered:
        return "seasonal"
    if "magazine" in lowered:
        return "magazine"
    if "polybag" in lowered:
        return "polybags"
    return "set"


def main():
    overrides = load_overrides()
    figures_override = overrides.get("figures", {})
    brickset_sets, brickset_meta = load_brickset_sets()

    themes = load_csv("themes")
    sets = load_csv("sets")
    inventories = load_csv("inventories")
    inventory_minifigs = load_csv("inventory_minifigs")
    inventory_sets = load_csv("inventory_sets")
    minifigs = load_csv("minifigs")

    themes_by_id = {row["id"]: row for row in themes}
    sets_by_num = {row["set_num"]: row for row in sets}
    minifigs_by_num = {row["fig_num"]: row for row in minifigs}
    latest_inventories = pick_latest_inventories(inventories)

    direct_figs = defaultdict(set)
    for row in inventory_minifigs:
        direct_figs[row["inventory_id"]].add(row["fig_num"])

    child_sets = defaultdict(list)
    for row in inventory_sets:
        child_sets[row["inventory_id"]].append(row["set_num"])

    resolved_cache = {}

    def resolve_figures_for_set(set_num, stack=None):
        if set_num in resolved_cache:
            return resolved_cache[set_num]
        if stack is None:
            stack = set()
        if set_num in stack:
            return set()

        inventory = latest_inventories.get(set_num)
        if not inventory:
            resolved_cache[set_num] = set()
            return resolved_cache[set_num]

        _, inventory_id = inventory
        stack = stack | {set_num}
        figures_here = set(direct_figs.get(inventory_id, set()))
        for child_set in child_sets.get(inventory_id, []):
            figures_here |= resolve_figures_for_set(child_set, stack)
        resolved_cache[set_num] = figures_here
        return figures_here

    candidate_sets = []
    for set_row in sets:
        theme_path = build_theme_chain(set_row["theme_id"], themes_by_id)
        theme_path_str = " > ".join(theme_path)
        lower_name = set_row["name"].lower()
        has_star_wars_theme = "Star Wars" in theme_path
        is_star_wars_book = "star wars" in lower_name and theme_path[:1] == ["Books"]
        excluded = any(term in lower_name for term in SET_EXCLUDE_TERMS)
        if not excluded and (has_star_wars_theme or is_star_wars_book):
            figures_here = resolve_figures_for_set(set_row["set_num"])
            if figures_here:
                brickset_row = brickset_sets.get(set_row["set_num"], {})
                candidate_sets.append(
                    {
                        "set_num": set_row["set_num"],
                        "name": set_row["name"],
                        "year": int(set_row["year"] or 0),
                        "theme_path": theme_path_str,
                        "source_kind": source_kind(theme_path_str),
                        "brickset_subtheme": brickset_row.get("subtheme", ""),
                        "series_candidate": normalize_brickset_series(brickset_row.get("subtheme", "")),
                        "figure_ids": figures_here,
                    }
                )

    figure_appearances = defaultdict(list)
    for set_row in candidate_sets:
        appearance = {
            "set_num": set_row["set_num"],
            "name": set_row["name"],
            "year": set_row["year"],
            "theme_path": set_row["theme_path"],
            "source_kind": set_row["source_kind"],
            "bricksetSubtheme": set_row["brickset_subtheme"],
            "seriesCandidate": set_row["series_candidate"],
        }
        for fig_num in set_row["figure_ids"]:
            figure_appearances[fig_num].append(appearance)

    catalog = []
    for fig_num, appearances in figure_appearances.items():
        base = minifigs_by_num.get(fig_num)
        if not base:
            continue

        ordered_appearances = sorted(appearances, key=lambda item: (item["year"], item["set_num"], item["name"]))
        override = figures_override.get(fig_num, {})
        name = override.get("name", base["name"])
        character = override.get("character", extract_character(name))
        series = guess_series(name, ordered_appearances, override=override.get("movieSeries"))
        variant = override.get("variant", extract_variant(name))
        first = ordered_appearances[0]
        kinds = sorted({item["source_kind"] for item in ordered_appearances})

        catalog.append(
            {
                "id": fig_num,
                "slug": override.get("slug", slugify(name or fig_num)),
                "name": name,
                "character": character,
                "variant": variant,
                "movieSeries": series,
                "movieSeriesOrder": SERIES_ORDER.index(series) if series in SERIES_ORDER else len(SERIES_ORDER),
                "releaseYear": first["year"],
                "firstAppearanceSet": first["set_num"],
                "firstAppearanceSetName": first["name"],
                "appearanceCount": len(ordered_appearances),
                "sourceKinds": kinds,
                "imageUrl": override.get("imageUrl", base["img_url"]),
                "rebrickableId": fig_num,
                "rebrickableUrl": f"https://rebrickable.com/minifigs/{fig_num}/",
                "bricklinkNumber": override.get("bricklinkNumber"),
                "bricklinkUrl": override.get("bricklinkUrl"),
                "sortFallback": f"{first['year']:04d}:{first['set_num']}:{fig_num}",
                "setAppearances": ordered_appearances[:8],
                "searchText": " ".join(
                    [
                        name.lower(),
                        character.lower(),
                        series.lower(),
                        fig_num.lower(),
                        first["set_num"].lower(),
                    ]
                ),
            }
        )

    catalog.sort(key=lambda item: (item["releaseYear"], item["firstAppearanceSet"], item["name"], item["id"]))
    for index, item in enumerate(catalog, start=1):
        item["catalogOrder"] = index

    figure_catalog_by_id = {item["id"]: item for item in catalog}
    set_catalog = []
    for set_row in sorted(candidate_sets, key=lambda item: (item["year"], item["set_num"], item["name"])):
        set_base = sets_by_num.get(set_row["set_num"], {})
        figure_ids = sorted(
            set_row["figure_ids"],
            key=lambda figure_id: (
                figure_catalog_by_id.get(figure_id, {}).get("catalogOrder", 10**9),
                figure_id,
            ),
        )
        series = choose_set_series(set_row, figure_catalog_by_id)
        set_catalog.append(
            {
                "id": set_row["set_num"],
                "set_num": set_row["set_num"],
                "name": set_row["name"],
                "year": set_row["year"],
                "themePath": set_row["theme_path"],
                "sourceKind": set_row["source_kind"],
                "movieSeries": series,
                "movieSeriesOrder": SERIES_ORDER.index(series) if series in SERIES_ORDER else len(SERIES_ORDER),
                "imageUrl": set_base.get("img_url", ""),
                "rebrickableUrl": f"https://rebrickable.com/sets/{set_row['set_num']}/",
                "bricklinkUrl": f"https://www.bricklink.com/v2/catalog/catalogitem.page?S={set_row['set_num']}",
                "figureIds": figure_ids,
                "figureCount": len(figure_ids),
                "searchText": " ".join(
                    [
                        set_row["set_num"].lower(),
                        set_row["name"].lower(),
                        str(set_row["year"]),
                        series.lower(),
                    ]
                ),
            }
        )

    bricklink_mapped_count = sum(1 for item in catalog if item.get("bricklinkNumber"))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "catalog.json").write_text(json.dumps(catalog, indent=2))
    (OUTPUT_DIR / "sets.json").write_text(json.dumps(set_catalog, indent=2))
    (OUTPUT_DIR / "catalog-meta.json").write_text(
        json.dumps(
            {
                "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "figureCount": len(catalog),
                "setCount": len(set_catalog),
                "bricklinkMappedCount": bricklink_mapped_count,
                "bricklinkCoveragePercent": round((bricklink_mapped_count / len(catalog)) * 100, 1) if catalog else 0,
                "source": "Rebrickable bulk downloads + Brickset subtheme enrichment"
                if brickset_meta.get("enabled")
                else "Rebrickable bulk downloads",
                "bricksetSeries": brickset_meta,
                "notes": [
                    "bricklinkNumber merges generated Brickset-based matches with any manual overrides.",
                    "sortFallback uses first Star Wars appearance order.",
                    "movieSeries prefers Brickset subtheme mappings and falls back to legacy inference only when needed.",
                ],
            },
            indent=2,
        )
    )
    print(f"Wrote {len(catalog)} figures to {OUTPUT_DIR / 'catalog.json'}")
    print(f"Wrote {len(set_catalog)} sets to {OUTPUT_DIR / 'sets.json'}")


if __name__ == "__main__":
    main()
