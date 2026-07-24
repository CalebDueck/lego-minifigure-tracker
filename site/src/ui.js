function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function badge(label, tone = "neutral") {
  return `<span class="pill pill-${tone}">${escapeHtml(label)}</span>`;
}

function brickLinkUrl(figure) {
  if (figure.bricklinkUrl) {
    return figure.bricklinkUrl;
  }

  if (figure.bricklinkNumber) {
    return `https://www.bricklink.com/v2/catalog/catalogitem.page?M=${encodeURIComponent(figure.bricklinkNumber)}`;
  }

  return `https://www.bricklink.com/v2/search.page?q=${encodeURIComponent(figure.name)}`;
}

function brickLinkSetUrl(appearance) {
  return `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${encodeURIComponent(appearance.set_num)}`;
}

function rebrickableSetUrl(set) {
  if (set.rebrickableUrl) {
    return set.rebrickableUrl;
  }

  return `https://rebrickable.com/sets/${encodeURIComponent(set.set_num)}/`;
}

function minifigureIcon() {
  return `
    <svg class="minifig-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="4.9" r="2.9"></circle>
      <path d="M8.2 8.2h7.6c1.1 0 2 .9 2 2v2.2c0 .8-.6 1.4-1.4 1.4h-.9v5.7c0 .9-.7 1.6-1.6 1.6h-1.2v-4.7h-1.4v4.7h-1.2c-.9 0-1.6-.7-1.6-1.6v-5.7h-.9c-.8 0-1.4-.6-1.4-1.4v-2.2c0-1.1.9-2 2-2Z"></path>
    </svg>
  `;
}

function initials(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatSeriesOptions(seriesOptions) {
  return seriesOptions
    .map((series) => `<option value="${escapeHtml(series)}">${escapeHtml(series)}</option>`)
    .join("");
}

function isSetView(view) {
  return view === "sets" || view === "owned-sets" || view === "not-owned-sets";
}

function formatTimestamp(value) {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function renderShellMarkup(seriesOptions) {
  return `
    <div class="shell">
      <header class="site-bar panel">
        <button class="site-title-link" data-action="set-view" data-view="home" type="button">
          <span class="site-title">Private Collection Holocron</span>
        </button>
        <div id="site-account" class="site-account"></div>
      </header>

      <header id="command-deck" class="command-deck panel">
        <div class="brand-copy">
          <div class="eyebrow">Private collection control room</div>
          <h1>Lego: The Complete Star Wars Minifigure Compendium</h1>
          <p>Track the full roster, log your collection, and manage a ranked wishlist in a TCS-inspired command deck.</p>
        </div>
        <div class="header-stats-block">
          <div id="header-stats" class="header-stats"></div>
        </div>
      </header>

      <section id="control-bar" class="control-bar panel">
        <div id="filter-controls-block" class="control-group">
          <div class="rail-title">Filters</div>
          <div class="filter-toolbar">
            <button class="ghost-button compact filter-clear-button" data-action="clear-filters">Clear filters</button>
            <label class="inline-field inline-field-view">
              <span>View</span>
              <select id="view-select">
                <optgroup label="Minifigures">
                  <option value="all">All Figures</option>
                  <option value="owned">Owned</option>
                  <option value="not-owned">Not Owned</option>
                  <option value="wishlist">Wishlist</option>
                  <option value="characters">Unique Characters</option>
                </optgroup>
                <optgroup label="Sets">
                  <option value="sets">All Sets</option>
                  <option value="owned-sets">Owned Sets</option>
                  <option value="not-owned-sets">Not Owned Sets</option>
                </optgroup>
              </select>
            </label>
            <label class="inline-field">
              <span>Search</span>
              <input id="search-input" type="search" placeholder="Luke, clone, fig-003..." autocomplete="off">
            </label>
            <label class="inline-field">
              <span>Film / series</span>
              <select id="series-filter">
                <option value="all">All stories</option>
                ${formatSeriesOptions(seriesOptions)}
              </select>
            </label>
            <label class="inline-field">
              <span>Sort</span>
              <select id="sort-filter">
                <option value="bricklink">BrickLink / release order</option>
                <option value="year">Year released</option>
                <option value="name">Alphabetical</option>
                <option value="series">Film / series</option>
                <option value="character">Character</option>
              </select>
            </label>
          </div>
        </div>

        <div id="layout-controls-block" class="control-group control-group-layout">
          <div class="rail-title">Layout</div>
          <div id="display-controls" class="display-controls"></div>
        </div>
      </section>

      <main id="workspace" class="workspace">
        <section class="roster-stage panel">
          <div class="stage-top">
            <div class="stage-copy">
              <div id="result-nav" class="stage-nav"></div>
              <div id="result-heading" class="stage-heading">Roster loading...</div>
              <div id="result-subheading" class="stage-subheading"></div>
            </div>
          </div>
          <div id="figure-grid" class="figure-grid"></div>
        </section>
      </main>

      <aside id="detail-panel" class="detail-panel panel is-hidden"></aside>
      <div id="image-overlay" class="image-overlay is-hidden"></div>
      <div id="auth-overlay" class="auth-overlay is-hidden"></div>
    </div>
  `;
}

function renderHomeLaunchCard(view, label, count, copy) {
  return `
    <button class="home-launch-card" data-action="set-view" data-view="${escapeHtml(view)}" type="button">
      <span class="home-launch-label">${escapeHtml(label)}</span>
      <strong class="home-launch-count">${escapeHtml(count)}</strong>
      <span class="home-launch-copy">${escapeHtml(copy)}</span>
    </button>
  `;
}

function renderHomeLaunchSection(title, cards) {
  return `
    <section class="home-launch-section">
      <div class="home-launch-section-title">${escapeHtml(title)}</div>
      <div class="home-launch-grid">
        ${cards.join("")}
      </div>
    </section>
  `;
}

export function renderHomeOverview(stats, uniqueCharacterCount, setStats) {
  return `
    <div class="home-overview">
      <div class="eyebrow">Launch a view</div>
      ${renderHomeLaunchSection("Minifigures", [
        renderHomeLaunchCard("all", "All Figures", stats.total, "Browse the full Star Wars minifigure catalog"),
        renderHomeLaunchCard("owned", "Owned", stats.ownedCount, "Jump straight into logged figures"),
        renderHomeLaunchCard("not-owned", "Not Owned", stats.notOwnedCount, "Focus on the missing roster"),
        renderHomeLaunchCard("wishlist", "Wishlist", stats.wishlistCount, "Review your ranked targets"),
        renderHomeLaunchCard("characters", "Unique Characters", uniqueCharacterCount, "Browse by character grouping"),
      ])}
      ${renderHomeLaunchSection("Sets", [
        renderHomeLaunchCard("sets", "All Sets", setStats.total, "Track complete sets and auto-log their minifigures"),
        renderHomeLaunchCard("owned-sets", "Owned Sets", setStats.ownedCount, "Review completed set entries"),
        renderHomeLaunchCard("not-owned-sets", "Not Owned Sets", setStats.notOwnedCount, "Focus on missing Star Wars sets"),
      ])}
      ${renderHomeLaunchSection("Catalog", [
        renderHomeLaunchCard("about", "About", "Info", "See catalog sources and last update time"),
      ])}
    </div>
  `;
}

export function renderAboutOverview(meta) {
  const mappedCount = Number(meta.bricklinkMappedCount || 0);
  const coverage = Number(meta.bricklinkCoveragePercent || 0);
  const bricksetFetchedAt = meta.bricksetSeries?.fetchedAt ? formatTimestamp(meta.bricksetSeries.fetchedAt) : null;

  return `
    <div class="about-overview">
      <div class="about-panel">
        <div class="eyebrow">Catalog feed</div>
        <h2>Data sources</h2>
        <p>The catalog is generated locally and committed into the site data so browsing stays fast.</p>
        <ul class="about-meta-list">
          <li><strong>Last updated</strong><span>${escapeHtml(formatTimestamp(meta.generatedAt))}</span></li>
          <li><strong>Figures indexed</strong><span>${escapeHtml(meta.figureCount || 0)}</span></li>
          <li><strong>Star Wars sets scanned</strong><span>${escapeHtml(meta.setCount || 0)}</span></li>
          <li><strong>Source</strong><span>${escapeHtml(meta.source || "Rebrickable bulk data")}</span></li>
          <li><strong>BrickLink IDs linked</strong><span>${escapeHtml(mappedCount)} (${escapeHtml(coverage)}% coverage)</span></li>
          ${bricksetFetchedAt ? `<li><strong>Brickset cache fetched</strong><span>${escapeHtml(bricksetFetchedAt)}</span></li>` : ""}
        </ul>
      </div>
      <div class="about-panel">
        <div class="eyebrow">Build notes</div>
        <h2>How the catalog is assembled</h2>
        <ul class="about-notes-list">
          ${(meta.notes || []).map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
        </ul>
      </div>
    </div>
  `;
}

export function renderHeaderStats(stats, view) {
  return `
    <button
      class="stat-card stat-card-link${view === "owned" ? " is-active" : ""}"
      data-action="set-view"
      data-view="owned"
      type="button"
    >
      <span class="stat-label">Owned</span>
      <strong>${stats.ownedCount}</strong>
    </button>
    <button
      class="stat-card stat-card-link${view === "not-owned" ? " is-active" : ""}"
      data-action="set-view"
      data-view="not-owned"
      type="button"
    >
      <span class="stat-label">Not Owned</span>
      <strong>${stats.notOwnedCount}</strong>
    </button>
    <button
      class="stat-card stat-card-link${view === "wishlist" ? " is-active" : ""}"
      data-action="set-view"
      data-view="wishlist"
      type="button"
    >
      <span class="stat-label">Wishlist</span>
      <strong>${stats.wishlistCount}</strong>
    </button>
    <div class="stat-card">
      <span class="stat-label">Completion</span>
      <strong>${stats.completion}%</strong>
    </div>
  `;
}

export function renderSiteAccountControl(session, accountMenuOpen) {
  if (session.mode !== "firebase") {
    return `
      <div class="account-pill" aria-label="Local mode">
        ${minifigureIcon()}
        <span class="account-pill-label">Local mode</span>
      </div>
    `;
  }

  if (!session.user) {
    return `
      <button class="ghost-button compact account-trigger" data-action="sign-in" type="button">
        ${minifigureIcon()}
        <span>Log in</span>
      </button>
    `;
  }

  const displayName = session.user.displayName || session.user.email || "Signed in";
  const showEmail = Boolean(session.user.email && session.user.email !== displayName);

  return `
    <details class="account-menu">
      <summary class="ghost-button compact account-trigger">
        ${minifigureIcon()}
        <span class="account-trigger-name">${escapeHtml(displayName)}</span>
        <span class="account-caret" aria-hidden="true">▾</span>
      </summary>
      <div class="account-dropdown" role="menu">
        <div class="account-dropdown-copy">
          <strong>${escapeHtml(displayName)}</strong>
          ${showEmail ? `<span>${escapeHtml(session.user.email)}</span>` : ""}
        </div>
        <button class="ghost-button compact account-dropdown-button" data-action="sign-out" type="button" role="menuitem">Log out</button>
      </div>
    </details>
  `;
}

export function renderLeftStats(stats) {
  return `
    <div class="rail-title">Collection Pulse</div>
    <div class="progress-shell">
      <div class="progress-bar">
        <span style="width:${Math.min(stats.completion, 100)}%"></span>
      </div>
      <div class="progress-copy">${stats.ownedCount} of ${stats.total} logged</div>
    </div>
    <div class="rail-metric-grid">
      <div class="rail-metric">
        <span>Upgrade queue</span>
        <strong>${stats.needsUpgradeCount}</strong>
      </div>
      <div class="rail-metric">
        <span>Wishlist slots</span>
        <strong>${stats.wishlistCount}</strong>
      </div>
    </div>
  `;
}

export function renderStageNav(view, characterFocus) {
  if (characterFocus) {
    return `
      <button class="ghost-button compact stage-back-button" data-action="open-character-directory" type="button">
        <span class="stage-back-glyph" aria-hidden="true">&lt;</span>
        <span>Back to Unique Characters</span>
      </button>
    `;
  }

  if (view === "about") {
    return `
      <button class="ghost-button compact stage-back-button" data-action="set-view" data-view="home" type="button">
        <span class="stage-back-glyph" aria-hidden="true">&lt;</span>
        <span>Back to Home</span>
      </button>
    `;
  }

  return "";
}

export function renderDisplayModeControls(figureDisplayMode, showingCharacterDirectory) {
  return `
    <div class="display-mode-shell" role="group" aria-label="Layout mode">
      <button
        class="display-mode-button${!showingCharacterDirectory && figureDisplayMode === "cards" ? " is-active" : ""}"
        data-action="set-display-mode"
        data-display-mode="cards"
        type="button"
      >
        Info
      </button>
      <button
        class="display-mode-button${!showingCharacterDirectory && figureDisplayMode === "holotable" ? " is-active" : ""}"
        data-action="set-display-mode"
        data-display-mode="holotable"
        type="button"
      >
        Heads
      </button>
    </div>
  `;
}

export function renderResultHeading(view, count, options = {}) {
  if (view === "home") {
    return "Collection command hub";
  }
  if (view === "about") {
    return "About this tracker";
  }
  if (options.showingCharacterDirectory) {
    return `${count} unique characters`;
  }
  if (options.characterFocus) {
    return `${count} ${options.characterFocus} variants`;
  }
  if (view === "owned") {
    return `${count} owned figures on file`;
  }
  if (view === "not-owned") {
    return `${count} figures still missing`;
  }
  if (view === "wishlist") {
    return `${count} ranked wishlist targets`;
  }
  if (view === "sets") {
    return `${count} tracked Star Wars sets`;
  }
  if (view === "owned-sets") {
    return `${count} owned Star Wars sets`;
  }
  if (view === "not-owned-sets") {
    return `${count} Star Wars sets still missing`;
  }
  if (view === "characters") {
    return `${count} unique characters`;
  }
  return `${count} figures in the full catalog`;
}

export function renderResultSubheading(filters, view, showingCharacterDirectory, figureDisplayMode, characterFocus) {
  if (view === "home") {
    return "Choose a collection view to begin browsing the holocron.";
  }

  if (view === "about") {
    return "Catalog sources, coverage notes, and the most recent data refresh.";
  }

  const parts = [];
  if (characterFocus) {
    parts.push(`focused on ${characterFocus}`);
  }
  if (filters.series !== "all") {
    parts.push(filters.series);
  }
  if (filters.search) {
    parts.push(`search: "${filters.search}"`);
  }
  if (showingCharacterDirectory) {
    parts.push("grouped by unique character");
  } else if (isSetView(view)) {
    const label = {
      bricklink: "sorted by release order",
      year: "sorted by year released",
      name: "sorted alphabetically",
      series: "sorted by film / series",
      character: "sorted alphabetically",
    }[filters.sort];
    parts.push(label || "sorted by release order");
  } else if (view !== "wishlist") {
    const label = {
      bricklink: "sorted by BrickLink / release order",
      year: "sorted by year released",
      name: "sorted alphabetically",
      series: "sorted by film / series",
      character: "sorted by character",
    }[filters.sort];
    parts.push(label || "sorted by release order");
  } else {
    parts.push("sorted by wishlist rank");
  }

  if (showingCharacterDirectory) {
    parts.push("showing one entry per character");
  } else if (isSetView(view)) {
    parts.push("showing set cards");
  } else {
    parts.push(figureDisplayMode === "holotable" ? "showing TCS head wall" : "showing intel cards");
  }
  return parts.join(" | ");
}

export function renderFigureGrid(figures, records, selectedId, displayMode) {
  if (!figures.length) {
    return `
      <div class="empty-state">
        <h2>No figures match this scan.</h2>
        <p>Clear the filters or switch views to surface a different part of the roster.</p>
      </div>
    `;
  }

  if (displayMode === "holotable") {
    return renderHolotable(figures, records, selectedId);
  }

  return figures.map((figure) => renderFigureCard(figure, records[figure.id], selectedId === figure.id)).join("");
}

export function renderSetGrid(sets, setRecords, figureRecords, selectedId) {
  if (!sets.length) {
    return `
      <div class="empty-state">
        <h2>No sets match this scan.</h2>
        <p>Clear the filters or switch views to surface a different part of the set catalog.</p>
      </div>
    `;
  }

  return sets.map((set) => renderSetCard(set, setRecords[set.id], figureRecords, selectedId === set.id)).join("");
}

function renderSetCard(set, record, figureRecords, selected) {
  const owned = Boolean(record?.owned);
  const partial = Boolean(record?.partial);
  const wishlisted = Boolean(record?.wishlisted);
  const ownedFigureCount = set.figureIds.filter((figureId) => figureRecords[figureId]?.owned).length;
  const stateClasses = [
    owned ? "is-owned" : "",
    selected ? "is-selected" : "",
  ].filter(Boolean).join(" ");
  const badges = [
    partial ? badge("Partial", "neutral") : "",
    wishlisted ? badge("Wishlisted", "wishlist") : "",
  ].join("");

  return `
    <article class="set-card figure-card ${stateClasses}">
      <button class="figure-select set-select" data-action="select-set" data-id="${escapeHtml(set.id)}">
        <div class="figure-order">${escapeHtml(set.set_num)}</div>
        <div class="set-portrait-shell">
          <img src="${escapeHtml(set.imageUrl)}" alt="${escapeHtml(set.name)}" loading="lazy">
        </div>
        <div class="figure-character">${escapeHtml(set.name)}</div>
        <div class="figure-name">${escapeHtml(set.movieSeries)}</div>
        <div class="figure-meta">${escapeHtml(set.year)} · ${escapeHtml(set.figureCount)} minifigs · ${escapeHtml(ownedFigureCount)} owned</div>
      </button>
      <div class="figure-link-row">
        <a class="figure-link-inline" href="${escapeHtml(set.bricklinkUrl)}" target="_blank" rel="noreferrer">Open set on BrickLink</a>
      </div>
      <div class="figure-badges">${badges}</div>
      <div class="figure-actions">
        <button class="state-toggle-button ${owned ? "is-active" : ""}" data-action="toggle-set-owned" data-id="${escapeHtml(set.id)}">
          ${owned ? "Complete Set" : "Complete Set?"}
        </button>
        <button class="state-toggle-button ${wishlisted ? "is-active" : ""}" data-action="toggle-set-wishlist" data-id="${escapeHtml(set.id)}">
          ${wishlisted ? "Wishlisted" : "Wishlist?"}
        </button>
      </div>
    </article>
  `;
}

function renderFigureCard(figure, record, selected) {
  const owned = Boolean(record?.owned);
  const wishlisted = Number.isInteger(record?.wishlistRank);
  const stateClasses = [
    owned ? "is-owned" : "",
    selected ? "is-selected" : "",
  ].filter(Boolean).join(" ");
  const badges = [
    wishlisted ? badge(`#${record.wishlistRank} wishlist`, "wishlist") : "",
  ].join("");

  return `
    <article class="figure-card ${stateClasses}">
      <button class="figure-select" data-action="select-figure" data-id="${escapeHtml(figure.id)}">
        <div class="figure-order">#${String(figure.catalogOrder).padStart(4, "0")}</div>
        <div class="portrait-shell">
          <img src="${escapeHtml(figure.imageUrl)}" alt="${escapeHtml(figure.name)}" loading="lazy">
        </div>
        <div class="figure-character">${escapeHtml(figure.character)}</div>
        <div class="figure-name">${escapeHtml(figure.name)}</div>
        <div class="figure-meta">${escapeHtml(figure.movieSeries)} · ${escapeHtml(figure.releaseYear)}</div>
      </button>
      <div class="figure-link-row">
        <a class="figure-link-inline" href="${escapeHtml(brickLinkUrl(figure))}" target="_blank" rel="noreferrer">Open in BrickLink</a>
      </div>
      <div class="figure-badges">${badges}</div>
      <div class="figure-actions">
        <button class="state-toggle-button ${owned ? "is-active" : ""}" data-action="toggle-owned" data-id="${escapeHtml(figure.id)}">
          ${owned ? "Owned" : "Owned?"}
        </button>
        <button class="state-toggle-button ${wishlisted ? "is-active" : ""}" data-action="toggle-wishlist" data-id="${escapeHtml(figure.id)}">
          ${wishlisted ? "Wishlisted" : "Wishlist?"}
        </button>
      </div>
    </article>
  `;
}

export function renderCharacterDirectory(entries) {
  if (!entries.length) {
    return `
      <div class="empty-state">
        <h2>No characters match this scan.</h2>
        <p>Clear the filters or switch views to surface a different set of unique characters.</p>
      </div>
    `;
  }

  return `
    <div class="character-directory-grid">
      ${entries.map((entry) => renderCharacterCard(entry)).join("")}
    </div>
  `;
}

function renderCharacterCard(entry) {
  const figure = entry.representativeFigure;
  const ownedLabel = entry.ownedFigures === 1 ? "1 owned" : `${entry.ownedFigures} owned`;
  const totalLabel = entry.totalFigures === 1 ? "1 variant" : `${entry.totalFigures} variants`;

  return `
    <article class="character-card${entry.ownedFigures ? " has-owned" : ""}">
      <button class="character-card-button" data-action="select-character" data-character="${escapeHtml(entry.character)}">
        <div class="character-card-portrait">
          <img src="${escapeHtml(figure.imageUrl)}" alt="${escapeHtml(entry.character)}" loading="lazy">
        </div>
        <div class="character-card-name">${escapeHtml(entry.character)}</div>
        <div class="character-card-meta">${escapeHtml(totalLabel)}</div>
        <div class="character-card-owned">${escapeHtml(ownedLabel)}</div>
      </button>
    </article>
  `;
}

function renderHolotable(figures, records, selectedId) {
  return `
    <div class="holotable-grid">
      ${figures.map((figure) => renderHolotableToken(figure, records[figure.id], selectedId === figure.id)).join("")}
    </div>
  `;
}

function renderHolotableToken(figure, record, selected) {
  const owned = Boolean(record?.owned);
  const wishlisted = Number.isInteger(record?.wishlistRank);
  const stateClasses = [
    owned ? "is-owned" : "",
    wishlisted ? "is-wishlisted" : "",
    selected ? "is-selected" : "",
  ].filter(Boolean).join(" ");

  return `
    <article class="figure-token ${stateClasses}">
      <button class="figure-token-button" data-action="select-figure" data-id="${escapeHtml(figure.id)}" aria-label="${escapeHtml(figure.name)}">
        <div class="figure-token-ring">
          <div class="figure-token-core">
            <img class="figure-token-image" src="${escapeHtml(figure.imageUrl)}" alt="${escapeHtml(figure.name)}" loading="lazy" onerror="this.style.display='none'">
            <div class="figure-token-glow"></div>
            <div class="figure-token-fallback">${escapeHtml(initials(figure.character))}</div>
          </div>
          ${wishlisted ? `<span class="figure-token-rank">#${record.wishlistRank}</span>` : ""}
        </div>
        <div class="figure-token-name">${escapeHtml(figure.character)}</div>
        <div class="figure-token-year">${escapeHtml(figure.releaseYear)}</div>
      </button>
    </article>
  `;
}

export function renderCharacterDirectoryPanel(entries) {
  const totalVariants = entries.reduce((sum, entry) => sum + entry.totalFigures, 0);
  const ownedVariants = entries.reduce((sum, entry) => sum + entry.ownedFigures, 0);
  const ownedCharacters = entries.filter((entry) => entry.ownedFigures > 0).length;

  return `
    <div class="detail-empty character-directory-panel">
      <div class="eyebrow">Unique Characters</div>
      <h2>Select a character</h2>
      <p>Each tile groups every minifigure variant for that character into a single archive entry.</p>
      <div class="character-archive-metrics">
        <div class="archive-metric">
          <span>Characters</span>
          <strong>${entries.length}</strong>
        </div>
        <div class="archive-metric">
          <span>Variants shown</span>
          <strong>${totalVariants}</strong>
        </div>
        <div class="archive-metric">
          <span>Owned variants</span>
          <strong>${ownedVariants}</strong>
        </div>
        <div class="archive-metric">
          <span>Owned characters</span>
          <strong>${ownedCharacters}</strong>
        </div>
      </div>
    </div>
  `;
}

export function renderCharacterFocusEmptyPanel(character) {
  return `
    <div class="detail-empty character-directory-panel">
      <div class="eyebrow">Unique Characters</div>
      <h2>No variants visible for ${escapeHtml(character || "this character")}</h2>
      <p>Adjust the active filters or go back to Unique Characters to pick a different character.</p>
      <button class="ghost-button compact" data-action="open-character-directory" type="button">Back to Unique Characters</button>
    </div>
  `;
}

export function renderDetailPanel(figure, record, session, wishlistCount) {
  if (!figure) {
    return `
      <div class="detail-empty">
        <div class="eyebrow">Holocron node</div>
        <h2>Select a figure</h2>
        <p>Open a figure to inspect the catalog record, update your collection log, and manage wishlist notes.</p>
      </div>
    `;
  }

  const owned = Boolean(record?.owned);
  const wishlisted = Number.isInteger(record?.wishlistRank);
  const canEditCollection = session.mode !== "firebase" || Boolean(session.user && session.authorized);
  const collectionFieldState = canEditCollection ? "" : "disabled";
  const wishlistStatus = wishlisted
    ? `
      <div class="wishlist-row">
        <strong>Wishlist rank #${record.wishlistRank}</strong>
        <div class="wishlist-controls">
          <button class="ghost-button compact" data-action="move-wishlist" data-direction="-1" data-id="${escapeHtml(figure.id)}" ${record.wishlistRank === 1 ? "disabled" : ""}>Move up</button>
          <button class="ghost-button compact" data-action="move-wishlist" data-direction="1" data-id="${escapeHtml(figure.id)}" ${record.wishlistRank === wishlistCount ? "disabled" : ""}>Move down</button>
          <button class="ghost-button compact" data-action="toggle-wishlist" data-id="${escapeHtml(figure.id)}">Remove</button>
        </div>
      </div>
    `
    : `
      <button class="state-toggle-button" data-action="toggle-wishlist" data-id="${escapeHtml(figure.id)}">Wishlist?</button>
    `;

  const appearanceRows = figure.setAppearances
    .map((appearance) => `
      <li>
        <strong>${escapeHtml(appearance.set_num)}</strong>
        <span><a class="appearance-link" href="${escapeHtml(brickLinkSetUrl(appearance))}" target="_blank" rel="noreferrer">${escapeHtml(appearance.name)}</a> · ${escapeHtml(appearance.year)}</span>
      </li>
    `)
    .join("");

  return `
    <button class="detail-dismiss-handle" data-action="toggle-detail-panel" type="button" aria-label="Dismiss details">
      <span aria-hidden="true">&gt;</span>
    </button>
    <div class="detail-panel-body">
      <div class="detail-head">
        <div class="detail-portrait-shell">
          <button
            class="detail-portrait detail-portrait-button"
            data-action="open-image-lightbox"
            data-image-src="${escapeHtml(figure.imageUrl)}"
            data-image-alt="${escapeHtml(figure.name)}"
            data-image-title="${escapeHtml(figure.character)}"
            type="button"
          >
            <img src="${escapeHtml(figure.imageUrl)}" alt="${escapeHtml(figure.name)}">
          </button>
        </div>
        <div class="detail-copy">
          <div class="eyebrow">${escapeHtml(figure.movieSeries)}</div>
          <h2>${escapeHtml(figure.character)}</h2>
          <p>${escapeHtml(figure.name)}</p>
          <div class="detail-badges">
            ${badge(`Release #${String(figure.catalogOrder).padStart(4, "0")}`, "neutral")}
            ${figure.bricklinkNumber ? badge(`BL ${figure.bricklinkNumber}`, "neutral") : badge("BrickLink number pending", "neutral")}
            ${wishlisted ? badge(`Wishlist #${record.wishlistRank}`, "wishlist") : ""}
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Collection log</div>
        <div class="detail-actions">
          <button class="state-toggle-button ${owned ? "is-active" : ""}" data-action="toggle-owned" data-id="${escapeHtml(figure.id)}">${owned ? "Owned" : "Owned?"}</button>
          <button class="state-toggle-button ${wishlisted ? "is-active" : ""}" data-action="toggle-wishlist" data-id="${escapeHtml(figure.id)}">${wishlisted ? "Wishlisted" : "Wishlist?"}</button>
          ${owned ? `<button class="ghost-button" data-action="clear-owned" data-id="${escapeHtml(figure.id)}">Clear log fields</button>` : ""}
        </div>
        <form id="detail-form" data-id="${escapeHtml(figure.id)}" class="detail-form">
          <div class="form-grid">
            <label class="field">
              <span>Quantity</span>
              <input type="number" name="quantity" min="1" value="${owned ? escapeHtml(record.quantity || 1) : "1"}" ${collectionFieldState}>
            </label>
            <label class="field">
              <span>Condition</span>
              <select name="condition" ${collectionFieldState}>
                ${renderConditionOptions(record?.condition || "")}
              </select>
            </label>
          </div>
          <label class="field">
            <span>How you got it</span>
            <input type="text" name="acquiredFrom" value="${escapeHtml(record?.acquiredFrom || "")}" placeholder="Cloud City set, polybag, BrickLink lot..." ${collectionFieldState}>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" name="needsUpgrade" ${record?.needsUpgrade ? "checked" : ""} ${collectionFieldState}>
            <span>Needs condition upgrade</span>
          </label>
          <label class="field">
            <span>Collection notes</span>
            <textarea name="notes" rows="4" placeholder="Missing cape, torso crack, display-only copy..." ${collectionFieldState}>${escapeHtml(record?.notes || "")}</textarea>
          </label>
          <label class="field">
            <span>Wishlist notes</span>
            <textarea name="wishlistNotes" rows="3" placeholder="Reason for priority, target set, upgrade notes..." ${(wishlisted && canEditCollection) ? "" : "disabled"}>${escapeHtml(record?.wishlistNotes || "")}</textarea>
          </label>
          <button class="primary-button submit-button" type="submit" ${collectionFieldState}>Save collection log</button>
        </form>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Wishlist ranking</div>
        ${wishlistStatus}
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Catalog data</div>
        <ul class="catalog-facts">
          <li><strong>Rebrickable ID</strong><span>${escapeHtml(figure.rebrickableId)}</span></li>
          <li><strong>First appearance</strong><span>${escapeHtml(figure.firstAppearanceSet)} · ${escapeHtml(figure.firstAppearanceSetName)}</span></li>
          <li><strong>Appears in</strong><span>${escapeHtml(figure.appearanceCount)} tracked sets</span></li>
          <li><strong>Source types</strong><span>${escapeHtml(figure.sourceKinds.join(", "))}</span></li>
        </ul>
        <div class="detail-links">
          <a class="external-link" href="${escapeHtml(figure.rebrickableUrl)}" target="_blank" rel="noreferrer">Open Rebrickable entry</a>
          <a class="external-link" href="${escapeHtml(brickLinkUrl(figure))}" target="_blank" rel="noreferrer">Open BrickLink entry</a>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Known appearances</div>
        <ul class="appearance-list">
          ${appearanceRows}
        </ul>
      </div>
    </div>
  `;
}

export function renderSetDetailPanel(set, record, session, figureCatalogById, figureRecords) {
  if (!set) {
    return `
      <div class="detail-empty">
        <div class="eyebrow">Set tracker</div>
        <h2>Select a set</h2>
        <p>Open a set to mark it complete or partial, save set notes, and manage the included minifigures.</p>
      </div>
    `;
  }

  const owned = Boolean(record?.owned);
  const partial = Boolean(record?.partial);
  const wishlisted = Boolean(record?.wishlisted);
  const canEditCollection = session.mode !== "firebase" || Boolean(session.user && session.authorized);
  const collectionFieldState = canEditCollection ? "" : "disabled";
  const ownedFigureCount = set.figureIds.filter((figureId) => figureRecords[figureId]?.owned).length;
  const includedFigureRows = set.figureIds
    .map((figureId) => {
      const figure = figureCatalogById.get(figureId);
      if (!figure) {
        return "";
      }

      const figureOwned = Boolean(figureRecords[figureId]?.owned);
      const figureWishlisted = Number.isInteger(figureRecords[figureId]?.wishlistRank);
      return `
        <li class="set-figure-row">
          <div class="set-figure-row-copy">
            <strong>${escapeHtml(figure.character)}</strong>
            <span>${escapeHtml(figure.name)}</span>
          </div>
          <div class="set-figure-row-actions">
            <button class="state-toggle-button ${figureOwned ? "is-active" : ""}" data-action="toggle-owned" data-id="${escapeHtml(figure.id)}">${figureOwned ? "Owned" : "Owned?"}</button>
            <button class="state-toggle-button ${figureWishlisted ? "is-active" : ""}" data-action="toggle-wishlist" data-id="${escapeHtml(figure.id)}">${figureWishlisted ? "Wishlisted" : "Wishlist?"}</button>
          </div>
        </li>
      `;
    })
    .filter(Boolean)
    .join("");

  return `
    <button class="detail-dismiss-handle" data-action="toggle-detail-panel" type="button" aria-label="Dismiss details">
      <span aria-hidden="true">&gt;</span>
    </button>
    <div class="detail-panel-body">
      <div class="detail-head">
        <div class="detail-portrait-shell">
          <button
            class="detail-portrait detail-portrait-button detail-set-portrait-button"
            data-action="open-image-lightbox"
            data-image-src="${escapeHtml(set.imageUrl)}"
            data-image-alt="${escapeHtml(set.name)}"
            data-image-title="${escapeHtml(set.set_num)}"
            type="button"
          >
            <img src="${escapeHtml(set.imageUrl)}" alt="${escapeHtml(set.name)}">
          </button>
        </div>
        <div class="detail-copy">
          <div class="eyebrow">${escapeHtml(set.movieSeries)}</div>
          <h2>${escapeHtml(set.set_num)}</h2>
          <p>${escapeHtml(set.name)}</p>
          <div class="detail-badges">
            ${badge(String(set.year), "neutral")}
            ${badge(`${set.figureCount} minifigs`, "neutral")}
            ${badge(`${ownedFigureCount}/${set.figureCount} owned`, "neutral")}
            ${partial ? badge("Partial", "neutral") : ""}
            ${wishlisted ? badge("Wishlisted", "wishlist") : ""}
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Set log</div>
        <div class="detail-actions">
          <button class="state-toggle-button ${owned ? "is-active" : ""}" data-action="toggle-set-owned" data-id="${escapeHtml(set.id)}">${owned ? "Complete Set" : "Complete Set?"}</button>
          <button class="state-toggle-button ${partial ? "is-active" : ""}" data-action="toggle-set-partial" data-id="${escapeHtml(set.id)}">${partial ? "Partial" : "Partial?"}</button>
          <button class="state-toggle-button ${wishlisted ? "is-active" : ""}" data-action="toggle-set-wishlist" data-id="${escapeHtml(set.id)}">${wishlisted ? "Wishlisted" : "Wishlist?"}</button>
        </div>
        <p class="detail-note">Marking a set complete will automatically add the minifigures from this set to your collection. Partial keeps the set tracked without auto-claiming every figure. Removing the complete-set flag does not remove minifigure ownership.</p>
        <form id="set-detail-form" data-id="${escapeHtml(set.id)}" class="detail-form">
          <label class="field">
            <span>How you got it</span>
            <input type="text" name="acquiredFrom" value="${escapeHtml(record?.acquiredFrom || "")}" placeholder="Sealed box, used complete set, local pickup..." ${collectionFieldState}>
          </label>
          <label class="field">
            <span>Set notes</span>
            <textarea name="notes" rows="4" placeholder="Missing manual, box damaged, display build..." ${collectionFieldState}>${escapeHtml(record?.notes || "")}</textarea>
          </label>
          <button class="primary-button submit-button" type="submit" ${collectionFieldState}>Save set log</button>
        </form>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Catalog data</div>
        <ul class="catalog-facts">
          <li><strong>Set number</strong><span>${escapeHtml(set.set_num)}</span></li>
          <li><strong>Year</strong><span>${escapeHtml(set.year)}</span></li>
          <li><strong>Theme path</strong><span>${escapeHtml(set.themePath)}</span></li>
          <li><strong>Included minifigs</strong><span>${escapeHtml(set.figureCount)}</span></li>
        </ul>
        <div class="detail-links">
          <a class="external-link" href="${escapeHtml(rebrickableSetUrl(set))}" target="_blank" rel="noreferrer">Open Rebrickable entry</a>
          <a class="external-link" href="${escapeHtml(set.bricklinkUrl)}" target="_blank" rel="noreferrer">Open BrickLink entry</a>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Included minifigures</div>
        <ul class="appearance-list set-figure-list">
          ${includedFigureRows}
        </ul>
      </div>
    </div>
  `;
}

function renderConditionOptions(selected) {
  const options = [
    "",
    "Mint",
    "Excellent",
    "Good",
    "Display only",
    "Needs work",
  ];

  return options
    .map((option) => {
      const label = option || "Unspecified";
      const isSelected = option === selected ? "selected" : "";
      return `<option value="${escapeHtml(option)}" ${isSelected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

export function renderImageOverlay(lightbox) {
  if (!lightbox) {
    return { hidden: true, markup: "" };
  }

  return {
    hidden: false,
    markup: `
      <div class="image-overlay-backdrop" data-action="close-image-lightbox"></div>
      <div class="overlay-card image-overlay-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(lightbox.alt)}">
        <div class="image-overlay-topbar">
          <div class="image-overlay-copy">
            <div class="eyebrow">Detail image</div>
            <h2>${escapeHtml(lightbox.title || lightbox.alt)}</h2>
          </div>
          <button class="ghost-button compact" data-action="close-image-lightbox" type="button">Close</button>
        </div>
        <div class="image-overlay-frame">
          <img src="${escapeHtml(lightbox.src)}" alt="${escapeHtml(lightbox.alt)}">
        </div>
        <p class="image-overlay-caption">${escapeHtml(lightbox.alt)}</p>
      </div>
    `,
  };
}

export function renderAuthOverlay(session, prompt) {
  if (session.mode !== "firebase") {
    return { hidden: true, markup: "" };
  }

  if (!session.user) {
    if (!prompt) {
      return { hidden: true, markup: "" };
    }

    const promptCopy = {
      owned: {
        eyebrow: "Login required",
        title: "Sign in to track owned figures",
        body: "Browsing stays open without signing in. Use Google sign-in when you want to mark figures as owned and save collection notes.",
      },
      sets: {
        eyebrow: "Login required",
        title: "Sign in to track owned sets",
        body: "Browsing stays open without signing in. Use Google sign-in when you want to mark complete sets and automatically add their included minifigures.",
      },
      "sets-wishlist": {
        eyebrow: "Login required",
        title: "Sign in to wishlist sets",
        body: "Browsing stays open without signing in. Use Google sign-in when you want to save Star Wars sets into your wanted list.",
      },
      wishlist: {
        eyebrow: "Login required",
        title: "Sign in to manage your wishlist",
        body: "Browsing stays open without signing in. Use Google sign-in when you want to rank wishlist targets and save priorities.",
      },
    }[prompt] || {
      eyebrow: "Login required",
      title: "Sign in to update your collection",
      body: "Browsing stays open without signing in. Use Google sign-in when you want to save collection state.",
    };

    return {
      hidden: false,
      markup: `
        <div class="image-overlay-backdrop" data-action="dismiss-auth-overlay"></div>
        <div class="overlay-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(promptCopy.title)}">
          <div class="eyebrow">${escapeHtml(promptCopy.eyebrow)}</div>
          <h2>${escapeHtml(promptCopy.title)}</h2>
          <p>${escapeHtml(promptCopy.body)}</p>
          <div class="detail-actions">
            <button class="primary-button" data-action="sign-in" type="button">Sign in with Google</button>
            <button class="ghost-button" data-action="dismiss-auth-overlay" type="button">Keep browsing</button>
          </div>
        </div>
      `,
    };
  }

  if (!session.authorized) {
    return {
      hidden: false,
      markup: `
        <div class="overlay-card">
          <div class="eyebrow">Access mismatch</div>
          <h2>This Google account is not the configured owner</h2>
          <p>${escapeHtml(session.reason || "Update ownerEmail in the Firebase config or sign in with the intended account.")}</p>
          <button class="ghost-button" data-action="sign-out">Sign out</button>
        </div>
      `,
    };
  }

  return { hidden: true, markup: "" };
}
