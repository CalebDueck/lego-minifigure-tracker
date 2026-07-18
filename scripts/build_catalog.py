#!/usr/bin/env python3

import csv
import datetime
import gzip
import io
import json
import re
import unicodedata
import urllib.request
from collections import defaultdict
from pathlib import Path


BASE_URL = "https://cdn.rebrickable.com/media/downloads/"
ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / ".cache" / "rebrickable"
OUTPUT_DIR = ROOT / "site" / "data"
OVERRIDES_PATH = ROOT / "catalog" / "overrides.json"

FILES = {
    "themes": "themes.csv.gz",
    "sets": "sets.csv.gz",
    "inventories": "inventories.csv.gz",
    "inventory_minifigs": "inventory_minifigs.csv.gz",
    "inventory_sets": "inventory_sets.csv.gz",
    "minifigs": "minifigs.csv.gz",
}

SERIES_ORDER = [
    "Episode I - The Phantom Menace",
    "Episode II - Attack of the Clones",
    "Episode III - Revenge of the Sith",
    "The Clone Wars",
    "Rebels",
    "Rogue One",
    "Solo",
    "Episode IV - A New Hope",
    "Episode V - The Empire Strikes Back",
    "Episode VI - Return of the Jedi",
    "The Mandalorian",
    "The Book of Boba Fett",
    "Obi-Wan Kenobi",
    "Andor",
    "Ahsoka",
    "The Acolyte",
    "Episode VII - The Force Awakens",
    "Episode VIII - The Last Jedi",
    "Episode IX - The Rise of Skywalker",
    "Holiday / Special",
    "Expanded Universe / Other",
]

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
            r"reva|third sister|fifth brother|tala durith|kenobi series|inquisitor transport scythe|obi-wan's jedi starfighter.*2022",
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
        re.compile(r"the acolyte|mae aniseya|osha aniseya|qimir|sol", re.I),
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
    if not OVERRIDES_PATH.exists():
        return {"figures": {}}
    return json.loads(OVERRIDES_PATH.read_text())


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


def guess_series(name, appearance_sets, override=None):
    if override:
        return override

    haystack = " ".join([name, *[item["name"] for item in appearance_sets], *[item["theme_path"] for item in appearance_sets]])
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
                candidate_sets.append(
                    {
                        "set_num": set_row["set_num"],
                        "name": set_row["name"],
                        "year": int(set_row["year"] or 0),
                        "theme_path": theme_path_str,
                        "source_kind": source_kind(theme_path_str),
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

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "catalog.json").write_text(json.dumps(catalog, indent=2))
    (OUTPUT_DIR / "catalog-meta.json").write_text(
        json.dumps(
            {
                "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "figureCount": len(catalog),
                "setCount": len(candidate_sets),
                "source": "Rebrickable bulk downloads",
                "notes": [
                    "bricklinkNumber is override-driven and may be null until enriched.",
                    "sortFallback uses first Star Wars appearance order.",
                ],
            },
            indent=2,
        )
    )
    print(f"Wrote {len(catalog)} figures to {OUTPUT_DIR / 'catalog.json'}")


if __name__ == "__main__":
    main()
