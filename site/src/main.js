import {
  loadCatalogBundle,
  deriveStats,
  deriveSetStats,
  filterAndSortFigures,
  filterAndSortSets,
  cleanRecord,
  cleanSetRecord,
  getWishlistIds,
  normalizeWishlistRanks,
  groupFiguresByCharacter,
  getCharacterArchiveLabel,
} from "./catalog.js?v=20260724d";
import { firebaseConfig } from "./firebase-config.js?v=20260724d";
import { createPersistence } from "./persistence.js?v=20260724d";
import {
  renderShellMarkup,
  renderSiteAccountControl,
  renderHeaderStats,
  renderHomeOverview,
  renderAboutOverview,
  renderStageNav,
  renderDisplayModeControls,
  renderResultHeading,
  renderResultSubheading,
  renderFigureGrid,
  renderSetGrid,
  renderCharacterDirectory,
  renderCharacterFocusEmptyPanel,
  renderDetailPanel,
  renderSetDetailPanel,
  renderImageOverlay,
  renderAuthOverlay,
} from "./ui.js?v=20260724d";

const DISPLAY_MODE_KEY = "sw-holocron-display-mode";
const SET_VIEWS = new Set(["sets", "owned-sets", "not-owned-sets"]);

class HolocronApp {
  constructor(root) {
    this.root = root;
    this.catalog = [];
    this.catalogById = new Map();
    this.setCatalog = [];
    this.setsById = new Map();
    this.catalogMeta = {};
    this.seriesOptions = [];
    this.records = {};
    this.setRecords = {};
    this.selectedId = null;
    this.detailPanelOpen = false;
    this.filters = {
      search: "",
      series: "all",
      sort: "bricklink",
    };
    this.figureDisplayMode = this.loadDisplayMode();
    this.characterFocus = null;
    this.view = "home";
    this.saveState = "idle";
    this.lastSavedLabel = "";
    this.accountMenuOpen = false;
    this.imageLightbox = null;
    this.authPrompt = null;
    this.pendingDetailScrollTop = null;
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
    this.setCatalog = bundle.sets;
    this.setsById = bundle.setsById;
    this.catalogMeta = bundle.meta;
    this.seriesOptions = bundle.seriesOptions;

    this.persistence = await createPersistence(firebaseConfig);
    this.renderShell();
    this.bindEvents();

    this.unsubscribeSession = this.persistence.onSessionChange((session) => {
      this.session = session;
      this.accountMenuOpen = false;
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
      this.setRecords = {};
      return;
    }

    this.unsubscribeState = this.persistence.subscribeState(this.session.userId, (state) => {
      this.records = state?.figures || {};
      this.setRecords = state?.sets || {};
      this.render();
    });
  }

  renderShell() {
    this.root.classList.remove("app-boot");
    this.root.innerHTML = renderShellMarkup(this.seriesOptions);
    this.refs = {
      shell: this.root.querySelector(".shell"),
      siteAccount: document.getElementById("site-account"),
      commandDeck: document.getElementById("command-deck"),
      controlBar: document.getElementById("control-bar"),
      workspace: document.getElementById("workspace"),
      headerStats: document.getElementById("header-stats"),
      filterControlsBlock: document.getElementById("filter-controls-block"),
      layoutControlsBlock: document.getElementById("layout-controls-block"),
      resultNav: document.getElementById("result-nav"),
      resultHeading: document.getElementById("result-heading"),
      resultSubheading: document.getElementById("result-subheading"),
      displayControls: document.getElementById("display-controls"),
      figureGrid: document.getElementById("figure-grid"),
      detailPanel: document.getElementById("detail-panel"),
      imageOverlay: document.getElementById("image-overlay"),
      authOverlay: document.getElementById("auth-overlay"),
      viewSelect: document.getElementById("view-select"),
      searchInput: document.getElementById("search-input"),
      seriesFilter: document.getElementById("series-filter"),
      sortFilter: document.getElementById("sort-filter"),
    };

    this.refs.viewSelect.value = this.view === "home" || this.view === "about" ? "all" : this.view;
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
      window.localStorage.setItem(DISPLAY_MODE_KEY, this.figureDisplayMode);
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

  rememberDetailScroll(target) {
    const panelBody = this.refs.detailPanel?.querySelector(".detail-panel-body");
    if (!panelBody || !target?.closest("#detail-panel")) {
      return;
    }

    this.pendingDetailScrollTop = panelBody.scrollTop;
  }

  handleClick(event) {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) {
      if (this.accountMenuOpen && !event.target.closest(".site-account")) {
        this.accountMenuOpen = false;
        this.render();
      }
      return;
    }

    const action = actionTarget.dataset.action;
    const id = actionTarget.dataset.id;

    if (action === "sign-in") {
      this.accountMenuOpen = false;
      this.authPrompt = null;
      this.persistence.signIn();
      return;
    }

    if (action === "sign-out") {
      this.accountMenuOpen = false;
      this.authPrompt = null;
      this.persistence.signOut();
      return;
    }

    if (action === "dismiss-auth-overlay") {
      this.authPrompt = null;
      this.render();
      return;
    }

    if (this.accountMenuOpen && action !== "toggle-account-menu") {
      this.accountMenuOpen = false;
    }

    if (action === "toggle-account-menu") {
      this.accountMenuOpen = !this.accountMenuOpen;
      this.render();
      return;
    }

    if (action === "set-view") {
      this.view = actionTarget.dataset.view || "all";
      this.characterFocus = null;
      this.selectedId = null;
      this.detailPanelOpen = false;
      this.imageLightbox = null;
      this.authPrompt = null;
      this.accountMenuOpen = false;
      this.render();
      return;
    }

    if (action === "set-display-mode") {
      const nextMode = actionTarget.dataset.displayMode;
      this.figureDisplayMode = nextMode === "holotable" ? "holotable" : "cards";
      this.saveDisplayMode();
      this.render();
      return;
    }

    if (action === "open-character-directory") {
      this.view = "characters";
      this.characterFocus = null;
      this.selectedId = null;
      this.detailPanelOpen = false;
      this.imageLightbox = null;
      this.authPrompt = null;
      this.accountMenuOpen = false;
      this.render();
      return;
    }

    if (action === "toggle-detail-panel") {
      this.detailPanelOpen = !this.detailPanelOpen;
      this.render();
      return;
    }

    if (action === "open-image-lightbox") {
      this.imageLightbox = {
        src: actionTarget.dataset.imageSrc || "",
        alt: actionTarget.dataset.imageAlt || "Minifigure image",
        title: actionTarget.dataset.imageTitle || actionTarget.dataset.imageAlt || "Minifigure image",
      };
      this.render();
      return;
    }

    if (action === "close-image-lightbox") {
      this.imageLightbox = null;
      this.render();
      return;
    }

    if (action === "clear-filters") {
      this.view = "all";
      this.characterFocus = null;
      this.filters = { search: "", series: "all", sort: "bricklink" };
      this.selectedId = null;
      this.detailPanelOpen = false;
      this.imageLightbox = null;
      this.authPrompt = null;
      this.accountMenuOpen = false;
      this.refs.viewSelect.value = "all";
      this.refs.searchInput.value = "";
      this.refs.seriesFilter.value = "all";
      this.refs.sortFilter.value = "bricklink";
      this.render();
      return;
    }

    if (action === "select-character") {
      if (this.view === "sets") {
        return;
      }

      this.characterFocus = actionTarget.dataset.character || null;
      this.selectedId = null;
      this.detailPanelOpen = false;
      this.imageLightbox = null;
      this.authPrompt = null;
      this.accountMenuOpen = false;
      this.render();
      return;
    }

    if (!id) {
      return;
    }

    if (action === "select-figure") {
      this.selectedId = id;
      this.detailPanelOpen = true;
      this.imageLightbox = null;
      this.authPrompt = null;
      this.accountMenuOpen = false;
      this.render();
      return;
    }

    if (action === "select-set") {
      this.selectedId = id;
      this.detailPanelOpen = true;
      this.imageLightbox = null;
      this.authPrompt = null;
      this.accountMenuOpen = false;
      this.render();
      return;
    }

    if (action === "toggle-owned") {
      this.rememberDetailScroll(actionTarget);
      this.toggleOwned(id);
      return;
    }

    if (action === "clear-owned") {
      this.rememberDetailScroll(actionTarget);
      this.clearOwnedFields(id);
      return;
    }

    if (action === "toggle-wishlist") {
      this.rememberDetailScroll(actionTarget);
      this.toggleWishlist(id);
      return;
    }

    if (action === "toggle-set-owned") {
      this.rememberDetailScroll(actionTarget);
      this.toggleSetOwned(id);
      return;
    }

    if (action === "toggle-set-partial") {
      this.rememberDetailScroll(actionTarget);
      this.toggleSetPartial(id);
      return;
    }

    if (action === "toggle-set-wishlist") {
      this.rememberDetailScroll(actionTarget);
      this.toggleSetWishlist(id);
      return;
    }

    if (action === "move-wishlist") {
      this.rememberDetailScroll(actionTarget);
      this.moveWishlist(id, Number(actionTarget.dataset.direction || 0));
    }
  }

  handleInput(event) {
    if (event.target === this.refs.viewSelect) {
      this.view = event.target.value || "all";
      this.characterFocus = null;
      this.selectedId = null;
      this.detailPanelOpen = false;
      this.imageLightbox = null;
      this.authPrompt = null;
      this.accountMenuOpen = false;
      this.render();
      return;
    }

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
    if (form.id === "set-detail-form") {
      event.preventDefault();
      const id = form.dataset.id;
      if (!id) {
        return;
      }

      if (this.session.mode === "firebase" && (!this.session.user || !this.session.authorized)) {
        return;
      }

      this.rememberDetailScroll(form);
      const current = this.setRecords[id] || {};
      const formData = new FormData(form);
      this.setSetRecord(id, cleanSetRecord({
        ...current,
        acquiredFrom: formData.get("acquiredFrom"),
        notes: formData.get("notes"),
      }));
      return;
    }

    if (form.id !== "detail-form") {
      return;
    }

    event.preventDefault();
    const id = form.dataset.id;
    if (!id) {
      return;
    }

    if (this.session.mode === "firebase" && (!this.session.user || !this.session.authorized)) {
      return;
    }

    this.rememberDetailScroll(form);
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

  requireAuth(reason) {
    if (this.session.mode !== "firebase" || (this.session.user && this.session.authorized)) {
      return true;
    }

    this.authPrompt = reason;
    this.render();
    return false;
  }

  toggleOwned(id) {
    if (!this.requireAuth("owned")) {
      return;
    }

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
    if (!this.requireAuth("owned")) {
      return;
    }

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
    if (!this.requireAuth("wishlist")) {
      return;
    }

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
    if (!this.requireAuth("wishlist")) {
      return;
    }

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

  toggleSetOwned(id) {
    if (!this.requireAuth("sets")) {
      return;
    }

    const set = this.setsById.get(id);
    if (!set) {
      return;
    }

    const current = this.setRecords[id] || {};
    if (current.owned) {
      this.setSetRecord(id, cleanSetRecord({
        ...current,
        owned: false,
      }));
      return;
    }

    this.markSetOwned(id, current);
  }

  toggleSetPartial(id) {
    if (!this.requireAuth("sets")) {
      return;
    }

    const set = this.setsById.get(id);
    if (!set) {
      return;
    }

    const current = this.setRecords[id] || {};
    this.setSetRecord(id, cleanSetRecord({
      ...current,
      owned: false,
      partial: !current.partial,
    }));
  }

  toggleSetWishlist(id) {
    if (!this.requireAuth("sets-wishlist")) {
      return;
    }

    const set = this.setsById.get(id);
    if (!set) {
      return;
    }

    const current = this.setRecords[id] || {};
    this.setSetRecord(id, cleanSetRecord({
      ...current,
      wishlisted: !current.wishlisted,
    }));
  }

  markSetOwned(id, nextSetData = {}) {
    const set = this.setsById.get(id);
    if (!set) {
      return;
    }

    const sourceLabel = `Complete set ${set.set_num}: ${set.name}`;
    const nextRecords = { ...this.records };
    set.figureIds.forEach((figureId) => {
      const currentFigure = nextRecords[figureId] || {};
      nextRecords[figureId] = cleanRecord({
        ...currentFigure,
        owned: true,
        quantity: currentFigure.quantity || 1,
        acquiredFrom: currentFigure.acquiredFrom || sourceLabel,
      });
    });

    this.records = nextRecords;
    this.setSetRecord(id, cleanSetRecord({
      ...nextSetData,
      owned: true,
      partial: false,
    }));
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

  setSetRecord(id, record) {
    const nextRecords = { ...this.setRecords };
    if (record) {
      nextRecords[id] = record;
    } else {
      delete nextRecords[id];
    }

    this.setRecords = nextRecords;
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
        await this.persistence.saveState(this.session.userId, {
          figures: this.records,
          sets: this.setRecords,
        });
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
    const setStats = deriveSetStats(this.setCatalog, this.setRecords);
    const allCharacterEntries = groupFiguresByCharacter(this.catalog, this.records);
    const isHomeView = this.view === "home";
    const isAboutView = this.view === "about";
    const isSetsView = SET_VIEWS.has(this.view);
    const activeFigureView = isHomeView || isAboutView || isSetsView ? "all" : this.view;
    const rosterFigures = filterAndSortFigures(this.catalog, this.records, activeFigureView, this.filters);
    const rosterSets = filterAndSortSets(this.setCatalog, this.setRecords, this.view, this.filters);
    const characterEntries = groupFiguresByCharacter(rosterFigures, this.records);
    const visibleFigures = this.characterFocus
      ? rosterFigures.filter((figure) => getCharacterArchiveLabel(figure) === this.characterFocus)
      : rosterFigures;
    const visibleSets = rosterSets;
    const showingCharacterDirectory = this.view === "characters" && !this.characterFocus;
    const visibleFigureIds = new Set(visibleFigures.map((figure) => figure.id));
    const visibleSetIds = new Set(visibleSets.map((set) => set.id));
    const selectedFigure = !isHomeView && !isAboutView && !showingCharacterDirectory && this.selectedId
      ? (isSetsView ? null : this.catalogById.get(this.selectedId))
      : null;
    const selectedSet = isSetsView && this.selectedId ? this.setsById.get(this.selectedId) : null;
    const selectedFigureIsVisible = Boolean(selectedFigure && visibleFigureIds.has(selectedFigure.id));
    const selectedSetIsVisible = Boolean(selectedSet && visibleSetIds.has(selectedSet.id));
    const selectedRecord = selectedFigure ? this.records[selectedFigure.id] : null;
    const selectedSetRecord = selectedSet ? this.setRecords[selectedSet.id] : null;
    const imageOverlay = renderImageOverlay(this.imageLightbox);
    const authOverlay = renderAuthOverlay(this.session, this.authPrompt);
    const detailPanelVisible = !isHomeView && !isAboutView && this.detailPanelOpen && Boolean(selectedFigure || selectedSet);
    const showBrowseControls = !isHomeView && !isAboutView;
    const showLayoutControls = showBrowseControls && !isSetsView;
    const useDocumentScroll = isHomeView;

    this.refs.siteAccount.innerHTML = renderSiteAccountControl(this.session, this.accountMenuOpen);
    this.refs.headerStats.innerHTML = renderHeaderStats(stats, this.view);
    this.refs.shell.classList.toggle("shell-document-scroll", useDocumentScroll);
    this.refs.commandDeck.classList.toggle("is-hidden", !isHomeView);
    this.refs.controlBar.classList.toggle("is-hidden", !showBrowseControls);
    this.refs.filterControlsBlock.classList.toggle("is-hidden", !showBrowseControls);
    this.refs.layoutControlsBlock.classList.toggle("is-hidden", !showLayoutControls);
    this.refs.resultNav.innerHTML = renderStageNav(this.view, this.characterFocus);
    this.refs.displayControls.innerHTML = showLayoutControls
      ? renderDisplayModeControls(this.figureDisplayMode, showingCharacterDirectory)
      : "";
    this.refs.resultHeading.textContent = renderResultHeading(
      this.view,
      isSetsView ? visibleSets.length : (showingCharacterDirectory ? characterEntries.length : visibleFigures.length),
      { showingCharacterDirectory, characterFocus: this.characterFocus },
    );
    this.refs.resultSubheading.textContent = renderResultSubheading(
      this.filters,
      this.view,
      showingCharacterDirectory,
      this.figureDisplayMode,
      this.characterFocus,
    );

    if (isHomeView) {
      this.refs.figureGrid.innerHTML = renderHomeOverview(stats, allCharacterEntries.length, setStats);
      this.refs.figureGrid.classList.remove("figure-grid-holotable", "figure-grid-character-directory", "figure-grid-about", "figure-grid-sets");
      this.refs.figureGrid.classList.add("figure-grid-home");
      this.refs.detailPanel.innerHTML = "";
    } else if (isAboutView) {
      this.refs.figureGrid.innerHTML = renderAboutOverview(this.catalogMeta);
      this.refs.figureGrid.classList.remove("figure-grid-holotable", "figure-grid-character-directory", "figure-grid-home", "figure-grid-sets");
      this.refs.figureGrid.classList.add("figure-grid-about");
      this.refs.detailPanel.innerHTML = "";
    } else if (isSetsView) {
      this.refs.figureGrid.innerHTML = renderSetGrid(
        visibleSets,
        this.setRecords,
        this.records,
        selectedSetIsVisible ? selectedSet.id : null,
      );
      this.refs.figureGrid.classList.remove("figure-grid-holotable", "figure-grid-character-directory", "figure-grid-home", "figure-grid-about");
      this.refs.figureGrid.classList.add("figure-grid-sets");
      this.refs.detailPanel.innerHTML = renderSetDetailPanel(
        selectedSet,
        selectedSetRecord,
        this.session,
        this.catalogById,
        this.records,
      );
    } else if (showingCharacterDirectory) {
      this.refs.figureGrid.innerHTML = renderCharacterDirectory(characterEntries);
      this.refs.figureGrid.classList.remove("figure-grid-holotable", "figure-grid-home", "figure-grid-about", "figure-grid-sets");
      this.refs.figureGrid.classList.add("figure-grid-character-directory");
      this.refs.detailPanel.innerHTML = "";
    } else {
      this.refs.figureGrid.innerHTML = renderFigureGrid(
        visibleFigures,
        this.records,
        selectedFigureIsVisible ? selectedFigure.id : null,
        this.figureDisplayMode,
      );
      this.refs.figureGrid.classList.remove("figure-grid-character-directory", "figure-grid-home", "figure-grid-about", "figure-grid-sets");
      this.refs.figureGrid.classList.toggle("figure-grid-holotable", this.figureDisplayMode === "holotable");
      this.refs.detailPanel.innerHTML = selectedFigure
        ? renderDetailPanel(selectedFigure, selectedRecord, this.session, stats.wishlistCount)
        : this.characterFocus
          ? renderCharacterFocusEmptyPanel(this.characterFocus)
          : renderDetailPanel(null, null, this.session, stats.wishlistCount);
    }

    this.refs.detailPanel.classList.toggle("is-hidden", !detailPanelVisible);
    if (detailPanelVisible && this.pendingDetailScrollTop !== null) {
      const nextScrollTop = this.pendingDetailScrollTop;
      this.pendingDetailScrollTop = null;
      requestAnimationFrame(() => {
        const panelBody = this.refs.detailPanel?.querySelector(".detail-panel-body");
        if (panelBody) {
          panelBody.scrollTop = nextScrollTop;
        }
      });
    } else if (!detailPanelVisible) {
      this.pendingDetailScrollTop = null;
    }

    if (this.view === "home" || this.view === "about") {
      this.refs.viewSelect.value = "all";
    } else {
      this.refs.viewSelect.value = this.view;
    }

    this.refs.imageOverlay.innerHTML = imageOverlay.markup;
    this.refs.imageOverlay.classList.toggle("is-hidden", imageOverlay.hidden);
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
