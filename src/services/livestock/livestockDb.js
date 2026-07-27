/* IndexedDB for livestock management — agrios-livestock database.
   Stores: animals (register), productions (daily logs), events (vaccinations/treatments/harvests) */

const DB_NAME = "agrios-livestock";
const DB_VERSION = 1;

let _db = null;

export function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("animals")) {
        const s = db.createObjectStore("animals", { keyPath: "id" });
        s.createIndex("enterprise", "enterprise", { unique: false });
      }
      if (!db.objectStoreNames.contains("productions")) {
        const s = db.createObjectStore("productions", { keyPath: "id" });
        s.createIndex("animalId", "animalId", { unique: false });
        s.createIndex("enterprise", "enterprise", { unique: false });
        s.createIndex("date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains("events")) {
        const s = db.createObjectStore("events", { keyPath: "id" });
        s.createIndex("animalId", "animalId", { unique: false });
        s.createIndex("enterprise", "enterprise", { unique: false });
        s.createIndex("date", "date", { unique: false });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

export function txn(storeName, mode = "readonly") {
  return openDb().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

import { wrapWithSync } from "../firebase/syncRepo.js";

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
