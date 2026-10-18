// Run with: node tests/toggles.mjs
import { readFileSync } from "node:fs";

const source = (name) => readFileSync(new URL(`../site/src/${name}.js`, import.meta.url), "utf8");
const catalog = new Function(`${source("catalog").replaceAll("export ", "").replaceAll("import.meta.url", JSON.stringify(new URL("../site/src/catalog.js", import.meta.url).href))}\nreturn { cleanRecord, cleanSetRecord, getWishlistIds, normalizeWishlistRanks };`)();
const createFirebasePersistence = new Function(`${source("persistence").replaceAll("export ", "")}\nreturn createFirebasePersistence;`)();
const main = source("main").replace(/^import[\s\S]*?from "[^"\n]+";\n/gm, "").split("const app = new HolocronApp")[0];
const HolocronApp = new Function(...Object.keys(catalog), `${main}\nreturn HolocronApp;`)(...Object.values(catalog));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

// Model Firestore's recursive merge versus replacement of explicit top-level fields.
const merge = (target, patch) => {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && Object.keys(value).length) {
      target[key] = merge(target[key] || {}, value);
    } else {
      target[key] = structuredClone(value);
    }
  }
  return target;
};
let saved = { unrelated: "preserved" };
const persistence = createFirebasePersistence({}, { initializeApp: () => ({}) }, {
  getAuth: () => ({}),
  GoogleAuthProvider: class { setCustomParameters() {} },
}, {
  getFirestore: () => ({}), doc: () => ({}), serverTimestamp: () => "now",
  onSnapshot(ref, callback) {
    callback({ exists: () => true, data: () => structuredClone(saved) });
    return () => {};
  },
  async setDoc(ref, data, options) {
    if (options?.mergeFields) {
      for (const field of options.mergeFields) saved[field] = structuredClone(data[field]);
    } else if (options?.merge) {
      merge(saved, data);
    } else {
      saved = structuredClone(data);
    }
  },
});
const app = Object.create(HolocronApp.prototype);
Object.assign(app, {
  records: {}, setRecords: {}, setsById: new Map([["set1", { figureIds: [] }]]),
  session: { mode: "local" }, queueSave() {}, render() {},
});
const sync = async () => {
  await persistence.saveState("owner", { figures: app.records, sets: app.setRecords });
  persistence.subscribeState("owner", (state) => {
    app.records = state.figures;
    app.setRecords = state.sets;
  });
};
for (const [method, map, id, field] of [
  ["toggleOwned", "records", "fig1", "owned"],
  ["toggleWishlist", "records", "fig1", "wishlistRank"],
  ["toggleSetOwned", "setRecords", "set1", "owned"],
  ["toggleSetWishlist", "setRecords", "set1", "wishlisted"],
]) {
  for (let cycle = 0; cycle < 2; cycle++) {
    app[method](id);
    await sync();
    assert(Boolean(app[map][id]?.[field]), `${method}: on did not persist`);
    app[method](id);
    await sync();
    assert(!app[map][id], `${method}: off was restored after sync`);
  }
}
assert(saved.unrelated === "preserved", "Unrelated document fields were lost");
console.log("Passed: figure and set owned/wishlist toggles persist on and off across sync.");
