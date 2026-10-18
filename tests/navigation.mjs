// Run with: node tests/navigation.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../site/src/main.js", import.meta.url), "utf8")
  .replace(/^import[\s\S]*?from "[^"\n]+";\n/gm, "").split("const app = new HolocronApp")[0];
const HolocronApp = new Function("getCharacterArchiveLabel", `${main}\nreturn HolocronApp;`)((figure) => figure.character);
const listeners = {};
const entries = ["https://example.com/tracker/?campaign=test"];
let position = 0;
globalThis.window = {
  location: { href: entries[0] },
  history: {
    pushState(state, title, url) {
      entries.splice(position + 1);
      entries.push(String(url));
      window.location.href = entries[++position];
    },
    replaceState(state, title, url) {
      window.location.href = entries[position] = String(url);
    },
  },
  addEventListener(type, handler) { listeners[type] = handler; },
};
const events = {};
const app = Object.create(HolocronApp.prototype);
Object.assign(app, {
  catalog: [{ id: "fig1", character: "Luke Skywalker" }],
  catalogById: new Map([["fig1", {}]]), setsById: new Map([["75380-1", {}]]),
  seriesOptions: ["Episode IV - A New Hope"], figureDisplayMode: "cards",
  refs: { searchInput: {}, seriesFilter: {}, sortFilter: {}, viewSelect: {} },
  root: { addEventListener(type, handler) { events[type] = handler; } },
  render() {},
});
app.restoreNavigation();
app.updateNavigation(true);
app.bindEvents();
app.view = "sets";
app.updateNavigation();
const browsePosition = position;
for (const value of ["p", "po", "podrace"]) {
  app.refs.searchInput.value = value;
  events.input({ target: app.refs.searchInput, type: "input" });
}
assert.equal(position, browsePosition + 1, "Search creates one history entry");
app.selectedId = "75380-1";
app.detailPanelOpen = true;
app.updateNavigation();
const detailURL = window.location.href;
assert.equal(new URL(detailURL).searchParams.get("item"), "75380-1");
assert.equal(new URL(detailURL).searchParams.get("campaign"), "test");
window.location.href = entries[--position]; listeners.popstate();
assert.equal(app.selectedId, null);
assert.equal(app.filters.search, "podrace");
window.location.href = entries[--position]; listeners.popstate();
assert.equal(app.filters.search, "");
assert.equal(app.refs.searchInput.value, "");
window.location.href = entries[++position]; listeners.popstate();
assert.equal(app.filters.search, "podrace");
window.location.href = detailURL; app.restoreNavigation();
assert.equal(app.selectedId, "75380-1");
assert.equal(app.detailPanelOpen, true);
app.view = "characters";
app.filters = { search: "Luke & Leia", series: app.seriesOptions[0], sort: "character" };
app.characterFocus = "Luke Skywalker";
app.selectedId = "fig1";
app.figureDisplayMode = "holotable";
app.detailPanelOpen = false;
app.updateNavigation(); app.restoreNavigation();
assert.equal(app.filters.search, "Luke & Leia");
assert.equal(app.filters.series, app.seriesOptions[0]);
assert.equal(app.filters.sort, "character");
assert.equal(app.characterFocus, "Luke Skywalker");
assert.equal(app.figureDisplayMode, "holotable");
assert.equal(app.detailPanelOpen, false);
const figureURL = window.location.href;
const setLink = {
  dataset: { action: "open-set-page" },
  getAttribute: () => "?view=sets&item=75380-1",
};
let prevented = false;
events.click({
  target: { closest: () => setLink }, button: 0,
  preventDefault() { prevented = true; },
});
assert.equal(prevented, true);
assert.equal(app.view, "sets");
assert.equal(app.selectedId, "75380-1");
assert.equal(app.filters.search, "");
assert.equal(app.filters.series, "all");
assert.equal(app.characterFocus, null);
window.location.href = entries[--position]; listeners.popstate();
assert.equal(window.location.href, figureURL);
assert.equal(app.selectedId, "fig1");
assert.equal(app.filters.search, "Luke & Leia");
prevented = false;
const beforeModifiedClick = window.location.href;
events.click({
  target: { closest: () => setLink }, button: 0, ctrlKey: true,
  preventDefault() { prevented = true; },
});
assert.equal(prevented, false, "Modified clicks retain native link behavior");
assert.equal(window.location.href, beforeModifiedClick);
window.location.href = "https://example.com/tracker/?view=invalid&series=invalid&sort=invalid&item=missing&character=missing";
app.restoreNavigation();
assert.equal(app.view, "home");
assert.equal(app.filters.series, "all");
assert.equal(app.filters.sort, "bricklink");
assert.equal(app.selectedId, null);
assert.equal(app.characterFocus, null);
console.log("Passed: URL round trips, search history grouping, Back/Forward, and invalid parameters.");
