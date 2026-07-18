const CATALOG_URL = new URL("../data/catalog.json", import.meta.url);
const META_URL = new URL("../data/catalog-meta.json", import.meta.url);

export async function loadCatalogBundle() {
  const [catalogResponse, metaResponse] = await Promise.all([
    fetch(CATALOG_URL),
    fetch(META_URL),
  ]);

  if (!catalogResponse.ok) {
    throw new Error("Catalog data could not be loaded.");
  }

  const catalog = await catalogResponse.json();
  const meta = metaResponse.ok ? await metaResponse.json() : {};
  const byId = new Map(catalog.map((figure) => [figure.id, figure]));

  return {
    catalog,
    meta,
    byId,
    seriesOptions: buildSeriesOptions(catalog),
  };
}

export function buildSeriesOptions(catalog) {
  return [...new Map(
    catalog
      .slice()
      .sort((left, right) => {
        if (left.movieSeriesOrder !== right.movieSeriesOrder) {
          return left.movieSeriesOrder - right.movieSeriesOrder;
        }
        return left.movieSeries.localeCompare(right.movieSeries);
      })
      .map((figure) => [figure.movieSeries, figure.movieSeries]),
  ).values()];
}

export function getWishlistIds(records) {
  return Object.entries(records)
    .filter(([, record]) => Number.isInteger(record.wishlistRank))
    .sort((left, right) => {
      if (left[1].wishlistRank !== right[1].wishlistRank) {
        return left[1].wishlistRank - right[1].wishlistRank;
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([id]) => id);
}

export function normalizeWishlistRanks(records) {
  const ordered = getWishlistIds(records);
  const next = { ...records };
  ordered.forEach((id, index) => {
    next[id] = {
      ...next[id],
      wishlistRank: index + 1,
    };
  });
  return next;
}

export function cleanRecord(record) {
  if (!record) {
    return null;
  }

  const cleaned = {
    owned: Boolean(record.owned),
    quantity: Boolean(record.owned) ? Math.max(1, Number(record.quantity) || 1) : null,
    condition: Boolean(record.owned) ? (record.condition || "").trim() : "",
    acquiredFrom: Boolean(record.owned) ? (record.acquiredFrom || "").trim() : "",
    notes: Boolean(record.owned) ? (record.notes || "").trim() : "",
    needsUpgrade: Boolean(record.owned && record.needsUpgrade),
    wishlistRank: Number.isInteger(record.wishlistRank) ? record.wishlistRank : null,
    wishlistNotes: Number.isInteger(record.wishlistRank) ? (record.wishlistNotes || "").trim() : "",
  };

  if (!cleaned.owned && cleaned.wishlistRank === null) {
    return null;
  }

  return cleaned;
}

export function deriveStats(catalog, records) {
  const ownedCount = Object.values(records).filter((record) => record.owned).length;
  const wishlistCount = Object.values(records).filter((record) => Number.isInteger(record.wishlistRank)).length;
  const needsUpgradeCount = Object.values(records).filter((record) => record.owned && record.needsUpgrade).length;
  const completion = catalog.length ? Math.round((ownedCount / catalog.length) * 1000) / 10 : 0;

  return {
    total: catalog.length,
    ownedCount,
    wishlistCount,
    needsUpgradeCount,
    completion,
  };
}

export function filterAndSortFigures(catalog, records, view, filters) {
  const query = filters.search.trim().toLowerCase();
  const figures = catalog.filter((figure) => {
    const record = records[figure.id];

    if (view === "collection" && !record?.owned) {
      return false;
    }

    if (view === "wishlist" && !Number.isInteger(record?.wishlistRank)) {
      return false;
    }

    if (filters.series !== "all" && figure.movieSeries !== filters.series) {
      return false;
    }

    if (!query) {
      return true;
    }

    return figure.searchText.includes(query);
  });

  if (view === "wishlist") {
    return figures.sort((left, right) => {
      const leftRank = records[left.id]?.wishlistRank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = records[right.id]?.wishlistRank ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return left.catalogOrder - right.catalogOrder;
    });
  }

  const sorters = {
    bricklink: (left, right) => compareBricklinkFallback(left, right),
    character: (left, right) => compareTuple(
      [left.character, left.name, left.catalogOrder],
      [right.character, right.name, right.catalogOrder],
    ),
    name: (left, right) => compareTuple(
      [left.name, left.catalogOrder],
      [right.name, right.catalogOrder],
    ),
    series: (left, right) => compareTuple(
      [left.movieSeriesOrder, left.movieSeries, left.character, left.catalogOrder],
      [right.movieSeriesOrder, right.movieSeries, right.character, right.catalogOrder],
    ),
  };

  const sorter = sorters[filters.sort] || sorters.bricklink;
  return figures.sort(sorter);
}

function compareBricklinkFallback(left, right) {
  const leftValue = left.bricklinkNumber || left.sortFallback;
  const rightValue = right.bricklinkNumber || right.sortFallback;
  return compareTuple([leftValue, left.catalogOrder], [rightValue, right.catalogOrder]);
}

function compareTuple(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];

    if (leftValue === rightValue) {
      continue;
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return leftValue - rightValue;
    }

    return String(leftValue).localeCompare(String(rightValue));
  }

  return 0;
}
