/* localStorage for the node test environment.

   Tests run with environment:"node", which has no Web Storage. utils/storage.js
   swallows the resulting error and hands back the fallback, so any code that
   persists through it silently did nothing under test — which quietly hid the
   document migration (its "already migrated" flag could never stick).

   fake-indexeddb already does this job for IndexedDB; this is the same idea for
   the other store the app writes to. */

class MemoryStorage {
  #map = new Map();
  get length() { return this.#map.size; }
  key(i) { return [...this.#map.keys()][i] ?? null; }
  getItem(k) { return this.#map.has(String(k)) ? this.#map.get(String(k)) : null; }
  setItem(k, v) { this.#map.set(String(k), String(v)); }
  removeItem(k) { this.#map.delete(String(k)); }
  clear() { this.#map.clear(); }
}

if (typeof globalThis.localStorage === "undefined") {
  globalThis.localStorage = new MemoryStorage();
}
if (typeof globalThis.sessionStorage === "undefined") {
  globalThis.sessionStorage = new MemoryStorage();
}
