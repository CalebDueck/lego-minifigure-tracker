import { loadCatalogBundle, deriveStats, filterAndSortFigures, cleanRecord, getWishlistIds, normalizeWishlistRanks } from "./catalog.js";
import { firebaseConfig } from "./firebase-config.js";
import { createPersistence } from "./persistence.js";
import {
  renderShellMarkup,
  renderHeaderStats,
  renderModeBar,
  renderLeftStats,
  renderCatalogMeta,
  renderDisplayModeControls,
  renderResultHeading,
  renderResultSubheading,
  renderFigureGrid,
  renderDetailPanel,
  renderAuthOverlay,
} from "./ui.js";

const CONFIG_PATH = "site/src/firebase-config.js";
const DISPLAY_MODE_KEY = "sw-holocron-display-mode";

class HolocronApp {
  constructor(root) {
    this.root = root;
    this.catalog = [];
    this.catalogById = new Map();
    this.catalogMeta = {};
    this.seriesOptions = [];
    this.records = {};
    this.selectedId = null;
    this.detailPanelOpen = true;
    this.filters = {
      search: "",
      series: "all",
      sort: "bricklink",
    };
    this.displayMode = this.loadDisplayMode();
    this.view = "roster";
    this.saveState = "idle";
    this.lastSavedLabel = "";
    this.persistence = null;
    this.session = {
      mode: "local",
      authorized: true,
      userId: "local-owner",
      user: null,
      reason: "",
    };
    this.refs = {};
    this.unsubscribeSession = null;
    this.unsubscribeState = null;
    this.saveTimer = null;
  }

  async init() {
    const bundle = await loadCatalogBundle();
    this.catalog = bundle.catalog;
    this.catalogById = bundle.byId;
    this.catalogMeta = bundle.meta;
    this.seriesOptions = bundle.seriesOptions;
    this.selectedId = this.catalog[0]?.id || null;

    this.persistence = await createPersistence(firebaseConfig);
    this.renderShell();
    this.bindEvents();

    this.unsubscribeSession = this.persistence.onSessionChange((session) => {
      this.session = session;
      this.connectState();
      this.render();
    });
  }

  connectState() {
    if (this.unsubscribeState) {
      this.unsubscribeState();
      this.unsubscribeState = null;
    }

    if (!this.session.userId || !this.session.authorized) {
      this.records = {};
      return;
    }

    this.unsubscribeState = this.persistence.subscribeState(this.session.userId, (records) => {
      this.records = records || {};
      this.render();
    });
  }

  renderShell() {
    this.root.classList.remove("app-boot");
    this.root.innerHTML = renderShellMarkup(this.seriesOptions);
    this.refs = {
      workspace: document.getElementById("workspace"),
      headerStats: document.getElementById("header-stats"),
      modeBar: document.getElementById("mode-bar"),
      leftStats: document.getElementById("left-stats"),
      catalogMeta: document.getElementById("catalog-meta"),
      resultHeading: document.getElementById("result-heading"),
      resultSubheading: document.getElementById("result-subheading"),
      displayControls: document.getElementById("display-controls"),
      figureGrid: document.getElementById("figure-grid"),
      detailPanel: document.getElementById("detail-panel"),
      authOverlay: document.getElementById("auth-overlay"),
      searchInput: document.getElementById("search-input"),
      seriesFilter: document.getElementById("series-filter"),
      sortFilter: document.getElementById("sort-filter"),
      tabRoster: document.getElementById("tab-roster"),
      tabCollection: document.getElementById("tab-collection"),
      tabWishlist: document.getElementById("tab-wishlist"),
      countRoster: document.getElementById("count-roster"),
      countCollection: document.getElementById("count-collection"),
      countWishlist: document.getElementById("count-wishlist"),
    };

    this.refs.searchInput.value = this.filters.search;
    this.refs.seriesFilter.value = this.filters.series;
    this.refs.sortFilter.value = this.filters.sort;
    this.render();
  }

  loadDisplayMode() {
    try {
      const saved = window.localStorage.getItem(DISPLAY_MODE_KEY);
      return saved === "holotable" ? "holotable" : "cards";
    } catch (error) {
      return "cards";
    }
  }

  saveDisplayMode() {
    try {
      window.localStorage.setItem(DISPLAY_MODE_KEY, this.displayMode);
    } catch (error) {
      // ignore local preference write failures
    }
  }

  bindEvents() {
    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.root.addEventListener("input", (event) => this.handleInput(event));
    this.root.addEventListener("change", (event) => this.handleInput(event));
    this.root.addEventListener("submit", (event) => this.handleSubmit(event));
  }

  handleClick(event) {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) {
      return;
    }

    const action = actionTarget.dataset.action;
    const id = actionTarget.dataset.id;

    if (action === "sign-in") {
      this.persistence.signIn();
      return;
    }

    if (action === "sign-out") {
      this.persistence.signOut();
      return;
    }

    if (action === "set-view") {
      this.view = actionTarget.dataset.view;
      this.render();
      return;
    }

    if (action === "set-display-mode") {
      this.displayMode = actionTarget.dataset.displayMode === "holotable" ? "holotable" : "cards";
      this.saveDisplayMode();
      this.render();
      return;
    }

    if (action === "toggle-detail-panel") {
      this.detailPanelOpen = !this.detailPanelOpen;
      this.render();
      return;
    }

    if (action === "clear-filters") {
      this.filters = { search: "", series: "all", sort: "bricklink" };
      this.refs.searchInput.value = "";
      this.refs.seriesFilter.value = "all";
      this.refs.sortFilter.value = "bricklink";
      this.render();
      return;
    }

    if (!id) {
      return;
    }

    if (action === "select-figure") {
      this.selectedId = id;
      this.detailPanelOpen = true;
      this.render();
      return;
    }

    if (action === "toggle-owned") {
      this.toggleOwned(id);
      return;
    }

    if (action === "clear-owned") {
      this.clearOwnedFields(id);
      return;
    }

    if (action === "toggle-wishlist") {
      this.toggleWishlist(id);
      return;
    }

    if (action === "move-wishlist") {
      this.moveWishlist(id, Number(actionTarget.dataset.direction || 0));
    }
  }

  handleInput(event) {
    if (event.target === this.refs.searchInput) {
      this.filters.search = event.target.value;
      this.render();
      return;
    }

    if (event.target === this.refs.seriesFilter) {
      this.filters.series = event.target.value;
      this.render();
      return;
    }

    if (event.target === this.refs.sortFilter) {
      this.filters.sort = event.target.value;
      this.render();
    }
  }

  handleSubmit(event) {
    const form = event.target;
    if (form.id !== "detail-form") {
      return;
    }

    event.preventDefault();
    const id = form.dataset.id;
    if (!id) {
      return;
    }

    const current = this.records[id] || {};
    const formData = new FormData(form);
    const next = cleanRecord({
      ...current,
      owned: true,
      quantity: Number(formData.get("quantity")) || 1,
      condition: formData.get("condition"),
      acquiredFrom: formData.get("acquiredFrom"),
      notes: formData.get("notes"),
      needsUpgrade: formData.get("needsUpgrade") === "on",
      wishlistNotes: current.wishlistRank ? formData.get("wishlistNotes") : current.wishlistNotes,
    });

    this.setRecord(id, next);
  }

  toggleOwned(id) {
    const current = this.records[id] || {};
    if (current.owned) {
      this.setRecord(id, cleanRecord({
        ...current,
        owned: false,
        quantity: null,
        condition: "",
        acquiredFrom: "",
        notes: "",
        needsUpgrade: false,
      }));
      return;
    }

    this.setRecord(id, cleanRecord({
      ...current,
      owned: true,
      quantity: current.quantity || 1,
    }));
  }

  clearOwnedFields(id) {
    const current = this.records[id] || {};
    this.setRecord(id, cleanRecord({
      ...current,
      owned: true,
      quantity: 1,
      condition: "",
      acquiredFrom: "",
      notes: "",
      needsUpgrade: false,
    }));
  }

  toggleWishlist(id) {
    const current = this.records[id] || {};
    if (Number.isInteger(current.wishlistRank)) {
      this.setRecord(id, cleanRecord({
        ...current,
        wishlistRank: null,
        wishlistNotes: "",
      }), true);
      return;
    }

    const nextRank = getWishlistIds(this.records).length + 1;
    this.setRecord(id, cleanRecord({
      ...current,
      wishlistRank: nextRank,
      wishlistNotes: current.wishlistNotes || "",
    }), true);
  }

  moveWishlist(id, direction) {
    const ordered = getWishlistIds(this.records);
    const index = ordered.indexOf(id);
    const nextIndex = index + direction;
    if (index === -1 || nextIndex < 0 || nextIndex >= ordered.length) {
      return;
    }

    const reordered = ordered.slice();
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);

    const nextRecords = { ...this.records };
    reordered.forEach((figureId, orderIndex) => {
      nextRecords[figureId] = cleanRecord({
        ...(nextRecords[figureId] || {}),
        wishlistRank: orderIndex + 1,
      });
    });

    this.records = nextRecords;
    this.queueSave();
    this.render();
  }

  setRecord(id, record, normalizeWishlist = false) {
    const nextRecords = { ...this.records };
    if (record) {
      nextRecords[id] = record;
    } else {
      delete nextRecords[id];
    }

    this.records = normalizeWishlist ? normalizeWishlistRanks(nextRecords) : nextRecords;
    this.queueSave();
    this.render();
  }

  queueSave() {
    if (!this.session.userId || !this.session.authorized) {
      return;
    }

    this.saveState = "saving";
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      try {
        await this.persistence.saveState(this.session.userId, this.records);
        this.saveState = "saved";
        this.lastSavedLabel = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      } catch (error) {
        this.saveState = "error";
      }
      this.render();
    }, 350);
  }

  render() {
    const stats = deriveStats(this.catalog, this.records);
    const visibleFigures = filterAndSortFigures(this.catalog, this.records, this.view, this.filters);
    const selectedFigure = this.catalogById.get(this.selectedId) || visibleFigures[0] || this.catalog[0] || null;
    const selectedRecord = selectedFigure ? this.records[selectedFigure.id] : null;
    const authOverlay = renderAuthOverlay(this.session);

    this.refs.headerStats.innerHTML = renderHeaderStats(stats, this.view);
    this.refs.modeBar.innerHTML = renderModeBar(this.session, this.saveState, this.lastSavedLabel, CONFIG_PATH);
    this.refs.leftStats.innerHTML = renderLeftStats(stats);
    this.refs.catalogMeta.innerHTML = renderCatalogMeta(this.catalogMeta);
    this.refs.displayControls.innerHTML = renderDisplayModeControls(this.displayMode, this.detailPanelOpen, Boolean(selectedFigure));
    this.refs.resultHeading.textContent = renderResultHeading(this.view, visibleFigures.length);
    this.refs.resultSubheading.textContent = renderResultSubheading(this.filters, this.view, this.displayMode);
    this.refs.figureGrid.innerHTML = renderFigureGrid(visibleFigures, this.records, selectedFigure?.id || null, this.displayMode);
    this.refs.figureGrid.classList.toggle("figure-grid-holotable", this.displayMode === "holotable");
    this.refs.detailPanel.innerHTML = renderDetailPanel(selectedFigure, selectedRecord, this.session, stats.wishlistCount);
    this.refs.workspace.classList.toggle("workspace-detail-hidden", !this.detailPanelOpen);
    this.refs.detailPanel.classList.toggle("is-hidden", !this.detailPanelOpen);

    this.refs.countRoster.textContent = String(this.catalog.length);
    this.refs.countCollection.textContent = String(stats.ownedCount);
    this.refs.countWishlist.textContent = String(stats.wishlistCount);

    this.refs.tabRoster.classList.toggle("is-active", this.view === "roster");
    this.refs.tabCollection.classList.toggle("is-active", this.view === "collection");
    this.refs.tabWishlist.classList.toggle("is-active", this.view === "wishlist");

    this.refs.authOverlay.innerHTML = authOverlay.markup;
    this.refs.authOverlay.classList.toggle("is-hidden", authOverlay.hidden);
  }
}

const app = new HolocronApp(document.getElementById("app"));
app.init().catch((error) => {
  document.getElementById("app").innerHTML = `
    <div class="boot-panel">
      <div class="boot-kicker">Boot failure</div>
      <h1>Holocron startup failed</h1>
      <p>${error.message}</p>
    </div>
  `;
});
