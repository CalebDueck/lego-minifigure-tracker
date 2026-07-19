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

export function renderShellMarkup(seriesOptions) {
  return `
    <div class="shell">
      <header class="command-deck panel">
        <div class="brand-copy">
          <div class="eyebrow">Private collection control room</div>
          <h1>Star Wars Minifigure Holocron</h1>
          <p>Track the full roster, log your collection, and manage a ranked wishlist in a TCS-inspired command deck.</p>
        </div>
        <div id="header-stats" class="header-stats"></div>
      </header>

      <div id="mode-bar" class="mode-bar"></div>

      <main id="workspace" class="workspace">
        <aside class="left-rail panel">
          <section class="rail-block">
            <div class="rail-title">Views</div>
            <div class="view-tabs">
              <button class="view-tab is-active" id="tab-roster" data-action="set-view" data-view="roster">
                <span>Roster</span>
                <strong id="count-roster">0</strong>
              </button>
              <button class="view-tab" id="tab-collection" data-action="set-view" data-view="collection">
                <span>Collection</span>
                <strong id="count-collection">0</strong>
              </button>
              <button class="view-tab" id="tab-wishlist" data-action="set-view" data-view="wishlist">
                <span>Wishlist</span>
                <strong id="count-wishlist">0</strong>
              </button>
            </div>
          </section>

          <section class="rail-block">
            <div class="rail-title">Scan Filters</div>
            <label class="field">
              <span>Search</span>
              <input id="search-input" type="search" placeholder="Luke, clone, fig-003..." autocomplete="off">
            </label>
            <label class="field">
              <span>Movie / series</span>
              <select id="series-filter">
                <option value="all">All stories</option>
                ${formatSeriesOptions(seriesOptions)}
              </select>
            </label>
            <label class="field">
              <span>Sort</span>
              <select id="sort-filter">
                <option value="bricklink">BrickLink / release order</option>
                <option value="character">Character</option>
                <option value="series">Movie / series</option>
                <option value="name">Name</option>
              </select>
            </label>
            <button class="ghost-button" data-action="clear-filters">Clear scan</button>
          </section>

          <section id="left-stats" class="rail-block"></section>
          <section id="catalog-meta" class="rail-block rail-meta"></section>
        </aside>

        <section class="roster-stage panel">
          <div class="stage-top">
            <div>
              <div id="result-heading" class="stage-heading">Roster loading...</div>
              <div id="result-subheading" class="stage-subheading"></div>
            </div>
            <div class="stage-tools">
              <div id="display-controls" class="display-controls"></div>
              <div class="stage-legend">
                ${badge("Owned", "owned")}
                ${badge("Wishlist", "wishlist")}
                ${badge("Needs upgrade", "warning")}
              </div>
            </div>
          </div>
          <div id="figure-grid" class="figure-grid"></div>
        </section>

        <aside id="detail-panel" class="detail-panel panel"></aside>
      </main>

      <div id="auth-overlay" class="auth-overlay is-hidden"></div>
    </div>
  `;
}

export function renderHeaderStats(stats, view) {
  return `
    <button
      class="stat-card stat-card-link${view === "collection" ? " is-active" : ""}"
      data-action="set-view"
      data-view="collection"
      type="button"
    >
      <span class="stat-label">Owned</span>
      <strong>${stats.ownedCount}</strong>
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

export function renderModeBar(session, saveState, lastSavedLabel, configPath) {
  const saveLabelMap = {
    idle: "Standing by",
    saving: "Saving holocron state...",
    saved: lastSavedLabel ? `Saved ${lastSavedLabel}` : "Saved",
    error: "Save failed",
  };

  const modeLabel = session.mode === "firebase" ? "Cloud sync" : "Local device mode";
  const authLabel = session.mode === "firebase" && session.user
    ? `Signed in as ${escapeHtml(session.user.displayName || session.user.email)}`
    : session.mode === "firebase"
      ? "Google sign-in required"
      : `Edit ${escapeHtml(configPath)} when Firebase is ready`;

  return `
    <div class="mode-cluster">
      <span class="mode-pill">${escapeHtml(modeLabel)}</span>
      <span class="mode-copy">${authLabel}</span>
    </div>
    <div class="mode-cluster mode-right">
      <span class="save-state save-${saveState}">${escapeHtml(saveLabelMap[saveState] || "Standing by")}</span>
      ${session.mode === "firebase" && session.user
        ? `<button class="ghost-button compact" data-action="sign-out">Sign out</button>`
        : ""}
    </div>
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

export function renderCatalogMeta(meta) {
  const mappedCount = Number(meta.bricklinkMappedCount || 0);
  const coverage = Number(meta.bricklinkCoveragePercent || 0);

  return `
    <div class="rail-title">Catalog Feed</div>
    <ul class="meta-list">
      <li>${escapeHtml(meta.figureCount || 0)} figures indexed</li>
      <li>${escapeHtml(meta.setCount || 0)} Star Wars sets scanned</li>
      <li>Source: ${escapeHtml(meta.source || "Rebrickable bulk data")}</li>
      <li>${escapeHtml(mappedCount)} BrickLink IDs linked (${escapeHtml(coverage)}% coverage)</li>
    </ul>
  `;
}

export function renderDisplayModeControls(browseMode, figureDisplayMode, detailPanelOpen, hasSelectedFigure, hasCharacterFocus) {
  const detailLabel = detailPanelOpen ? "Hide details" : "Show details";
  const detailDisabled = hasSelectedFigure ? "" : "disabled";

  return `
    <div class="display-mode-shell" role="group" aria-label="Display mode">
      <span class="display-mode-label">Display mode</span>
      <button
        class="display-mode-button${browseMode === "figures" && figureDisplayMode === "cards" ? " is-active" : ""}"
        data-action="set-display-mode"
        data-display-mode="cards"
      >
        Intel cards
      </button>
      <button
        class="display-mode-button${browseMode === "figures" && figureDisplayMode === "holotable" ? " is-active" : ""}"
        data-action="set-display-mode"
        data-display-mode="holotable"
      >
        TCS head wall
      </button>
      <button
        class="display-mode-button${browseMode === "characters" ? " is-active" : ""}"
        data-action="set-display-mode"
        data-display-mode="characters"
      >
        Character archive
      </button>
      ${hasCharacterFocus
        ? `
          <button class="display-mode-button" data-action="open-character-directory">
            Back to characters
          </button>
        `
        : ""}
      <button
        class="display-mode-button display-mode-button-detail${detailPanelOpen ? " is-active" : ""}"
        data-action="toggle-detail-panel"
        ${detailDisabled}
      >
        ${detailLabel}
      </button>
    </div>
  `;
}

export function renderResultHeading(view, count, options = {}) {
  if (options.browseMode === "characters" && !options.characterFocus) {
    return `${count} unique characters in the archive`;
  }
  if (options.characterFocus) {
    return `${count} ${options.characterFocus} variants`;
  }
  if (view === "collection") {
    return `${count} owned figures on file`;
  }
  if (view === "wishlist") {
    return `${count} ranked wishlist targets`;
  }
  return `${count} figures in the roster`;
}

export function renderResultSubheading(filters, view, browseMode, figureDisplayMode, characterFocus) {
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
  if (browseMode === "characters" && !characterFocus) {
    parts.push("grouped by unique character");
  } else if (view !== "wishlist") {
    const label = {
      bricklink: "sorted by BrickLink / release order",
      character: "sorted by character",
      series: "sorted by movie / series",
      name: "sorted by name",
    }[filters.sort];
    parts.push(label || "sorted by release order");
  } else {
    parts.push("sorted by wishlist rank");
  }

  if (browseMode === "characters" && !characterFocus) {
    parts.push("showing one entry per character");
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

function renderFigureCard(figure, record, selected) {
  const owned = Boolean(record?.owned);
  const wishlisted = Number.isInteger(record?.wishlistRank);
  const badges = [
    owned ? badge("Owned", "owned") : "",
    wishlisted ? badge(`#${record.wishlistRank} wishlist`, "wishlist") : "",
    record?.needsUpgrade ? badge("Needs upgrade", "warning") : "",
  ].join("");

  return `
    <article class="figure-card${selected ? " is-selected" : ""}">
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
        <button class="mini-button ${owned ? "is-active" : ""}" data-action="toggle-owned" data-id="${escapeHtml(figure.id)}">
          ${owned ? "Owned" : "Log owned"}
        </button>
        <button class="mini-button ${wishlisted ? "is-active wishlist" : ""}" data-action="toggle-wishlist" data-id="${escapeHtml(figure.id)}">
          ${wishlisted ? "Wishlisted" : "Wishlist"}
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
        <p>Clear the filters or switch views to surface a different character archive.</p>
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
  const needsUpgrade = Boolean(record?.needsUpgrade);
  const stateClasses = [
    owned ? "is-owned" : "",
    wishlisted ? "is-wishlisted" : "",
    needsUpgrade ? "is-warning" : "",
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
      <div class="eyebrow">Character archive</div>
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
      <div class="eyebrow">Character archive</div>
      <h2>No variants visible for ${escapeHtml(character || "this character")}</h2>
      <p>Adjust the active filters or go back to the character archive to pick a different character.</p>
      <button class="ghost-button compact" data-action="open-character-directory" type="button">Back to characters</button>
    </div>
  `;
}

export function renderDetailPanel(figure, record, session, wishlistCount) {
  if (!figure) {
    return `
      <div class="detail-empty">
        <div class="eyebrow">Holocron node</div>
        <h2>Select a figure card</h2>
        <p>The right panel becomes your collection log, wishlist editor, and appearance reference.</p>
      </div>
    `;
  }

  const owned = Boolean(record?.owned);
  const wishlisted = Number.isInteger(record?.wishlistRank);
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
      <button class="primary-button secondary" data-action="toggle-wishlist" data-id="${escapeHtml(figure.id)}">Add to ranked wishlist</button>
    `;

  const appearanceRows = figure.setAppearances
    .map((appearance) => `
      <li>
        <strong>${escapeHtml(appearance.set_num)}</strong>
        <span>${escapeHtml(appearance.name)} · ${escapeHtml(appearance.year)}</span>
      </li>
    `)
    .join("");

  return `
    <div class="detail-panel-topbar">
      <button class="ghost-button compact" data-action="toggle-detail-panel" type="button">Dismiss panel</button>
    </div>
    <div class="detail-head">
      <div class="detail-portrait">
        <img src="${escapeHtml(figure.imageUrl)}" alt="${escapeHtml(figure.name)}">
      </div>
      <div class="detail-copy">
        <div class="eyebrow">${escapeHtml(figure.movieSeries)}</div>
        <h2>${escapeHtml(figure.character)}</h2>
        <p>${escapeHtml(figure.name)}</p>
        <div class="detail-badges">
          ${badge(`Release #${String(figure.catalogOrder).padStart(4, "0")}`, "neutral")}
          ${figure.bricklinkNumber ? badge(`BL ${figure.bricklinkNumber}`, "neutral") : badge("BrickLink number pending", "neutral")}
          ${owned ? badge("Owned", "owned") : ""}
          ${wishlisted ? badge(`Wishlist #${record.wishlistRank}`, "wishlist") : ""}
        </div>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Collection log</div>
      <div class="detail-actions">
        <button class="primary-button" data-action="toggle-owned" data-id="${escapeHtml(figure.id)}">${owned ? "Remove from collection" : "Mark as owned"}</button>
        ${owned ? `<button class="ghost-button" data-action="clear-owned" data-id="${escapeHtml(figure.id)}">Clear log fields</button>` : ""}
      </div>
      <form id="detail-form" data-id="${escapeHtml(figure.id)}" class="detail-form">
        <div class="form-grid">
          <label class="field">
            <span>Quantity</span>
            <input type="number" name="quantity" min="1" value="${owned ? escapeHtml(record.quantity || 1) : "1"}">
          </label>
          <label class="field">
            <span>Condition</span>
            <select name="condition">
              ${renderConditionOptions(record?.condition || "")}
            </select>
          </label>
        </div>
        <label class="field">
          <span>How you got it</span>
          <input type="text" name="acquiredFrom" value="${escapeHtml(record?.acquiredFrom || "")}" placeholder="Cloud City set, polybag, BrickLink lot...">
        </label>
        <label class="checkbox-row">
          <input type="checkbox" name="needsUpgrade" ${record?.needsUpgrade ? "checked" : ""}>
          <span>Needs condition upgrade</span>
        </label>
        <label class="field">
          <span>Collection notes</span>
          <textarea name="notes" rows="4" placeholder="Missing cape, torso crack, display-only copy...">${escapeHtml(record?.notes || "")}</textarea>
        </label>
        <label class="field">
          <span>Wishlist notes</span>
          <textarea name="wishlistNotes" rows="3" placeholder="Reason for priority, target set, upgrade notes..." ${wishlisted ? "" : "disabled"}>${escapeHtml(record?.wishlistNotes || "")}</textarea>
        </label>
        <button class="primary-button submit-button" type="submit">Save collection log</button>
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

export function renderAuthOverlay(session) {
  if (session.mode !== "firebase") {
    return { hidden: true, markup: "" };
  }

  if (!session.user) {
    return {
      hidden: false,
      markup: `
        <div class="overlay-card">
          <div class="eyebrow">Google auth required</div>
          <h2>Open your private holocron</h2>
          <p>Sign in with the Google account attached to your Firebase project to load synced collection data.</p>
          <button class="primary-button" data-action="sign-in">Sign in with Google</button>
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
