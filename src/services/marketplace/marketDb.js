/* Marketplace database — one IndexedDB (agrios-marketplace) with a store per
   concern, sharing the same generic repository pattern as erpDb. This file is
   the ONLY storage adapter for the marketplace: when the shared backend
   (Supabase) lands, swap the repo implementation here and every marketplace
   service keeps working unchanged. */

const DB_NAME = "agrios-marketplace";
const DB_VERSION = 1;

/* store name -> indexes created on upgrade */
const STORES = {
  sellers:  [],
  products: ["sellerId", "category", "status"],
  cart:     ["productId"],
  wishlist: ["refId", "type"],
  orders:   ["sellerId", "status"],
  reviews:  ["productId", "sellerId"],
};

let _db = null;

export function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      Object.entries(STORES).forEach(([name, indexes]) => {
        if (db.objectStoreNames.contains(name)) return;
        const s = db.createObjectStore(name, { keyPath: "id" });
        indexes.forEach((ix) => s.createIndex(ix, ix, { unique: false }));
      });
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

import { wrapWithSync } from "../firebase/syncRepo.js";

/* Generic repository over one store — same contract as erpDb's repo(). */
function _localRepo(storeName) {
  const run = (mode, fn) => openDb().then((db) => new Promise((res, rej) => {
    const store = db.transaction(storeName, mode).objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));

  return {
    async add(data) {
      const record = { ...data, id: uid(), createdAt: new Date().toISOString() };
      await run("readwrite", (s) => s.add(record));
      return record;
    },
    getAll: () => run("readonly", (s) => s.getAll()).then((r) => r || []),
    getBy: (index, value) =>
      run("readonly", (s) => s.index(index).getAll(value)).then((r) => r || []),
    getById: (id) => run("readonly", (s) => s.get(id)).then((r) => r || null),
    async update(id, patch) {
      const existing = await this.getById(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
      await run("readwrite", (s) => s.put(updated));
      return updated;
    },
    remove: (id) => run("readwrite", (s) => s.delete(id)),
    count: () => run("readonly", (s) => s.count()),
  };
}

export function repo(storeName) {
  return wrapWithSync(storeName, _localRepo(storeName));
}
