/* Farm ERP database — one IndexedDB (agrios-erp) with a store per module.
   `repo(store)` returns a generic repository so every ERP service shares one
   tested CRUD implementation (Repository Pattern) instead of copying it. */

const DB_NAME = "agrios-erp";
const DB_VERSION = 9;

/* store name -> indexes created on upgrade. onupgradeneeded is additive: it
   only creates stores that don't yet exist, so bumping the version to add a
   store never touches existing data. */
const STORES = {
  farms:       [],
  parcels:     ["farmId"],
  tasks:       ["farmId", "status", "dueDate"],
  inventory:   ["farmId", "category"],
  stockMoves:  ["itemId", "date"],
  assets:      ["farmId", "category"],
  maintenance: ["assetId", "date"],
  employees:   ["farmId"],
  attendance:  ["employeeId", "date"],
  contacts:    ["type"],
  orders:      ["contactId", "kind", "date"],
  devices:     ["farmId"],
  telemetry:   ["deviceId", "date"],
  ledgerTxns:  ["type", "category", "date"],
  employeePayments: ["employeeId", "date"], // WF-3 payroll
  employeeLeaves:   ["employeeId", "status"], // WF-4 leave
  employeeDocuments: ["employeeId", "type"], // WF-5 documents
  employeeRecords:   ["employeeId", "kind"], // WF-6 skills/training/performance
  employeeAudit:     ["employeeId"], // WF-7 audit/history
  cropPlans:   ["farmId", "fieldId", "cropId", "status"],
  feedBatches:     ["farmId", "enterprise", "animalId", "status"],
  feedConsumption: ["batchId", "farmId", "date"],
  feedWastage:     ["batchId", "farmId", "date"],
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

/* Generic repository over one store. All ERP services build on this.

   Deletes are SOFT: remove() stamps a `deletedAt` and physically retains the
   row, so records are recoverable (restore), auditable, and never silently
   orphan related data. Every normal read below hides soft-deleted rows, so
   callers and tests see unchanged behaviour. purge() is the explicit,
   irreversible physical delete for cleanup. */
function _localRepo(storeName) {
  const run = (mode, fn) => openDb().then((db) => new Promise((res, rej) => {
    const store = db.transaction(storeName, mode).objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));

  const live = (r) => r && !r.deletedAt;
  const rawGet = (id) => run("readonly", (s) => s.get(id)).then((r) => r || null);

  return {
    async add(data) {
      const record = { ...data, id: uid(), createdAt: new Date().toISOString() };
      await run("readwrite", (s) => s.add(record));
      return record;
    },
    getAll: () => run("readonly", (s) => s.getAll()).then((r) => (r || []).filter(live)),
    getBy: (index, value) =>
      run("readonly", (s) => s.index(index).getAll(value)).then((r) => (r || []).filter(live)),
    getById: (id) => rawGet(id).then((r) => (live(r) ? r : null)),
    async update(id, patch) {
      const existing = await this.getById(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
      await run("readwrite", (s) => s.put(updated));
      return updated;
    },
    async remove(id) {
      const existing = await rawGet(id);
      if (!existing || existing.deletedAt) return null;
      const tombstone = { ...existing, deletedAt: new Date().toISOString() };
      await run("readwrite", (s) => s.put(tombstone));
      return tombstone; // let the sync layer propagate a tombstone (see wrapWithSync)
    },
    async restore(id) {
      const existing = await rawGet(id);
      if (!existing || !existing.deletedAt) return null;
      const { deletedAt, ...rest } = existing;
      const restored = { ...rest, updatedAt: new Date().toISOString() };
      await run("readwrite", (s) => s.put(restored));
      return restored;
    },
    purge: (id) => run("readwrite", (s) => s.delete(id)),
    count: () => run("readonly", (s) => s.getAll()).then((r) => (r || []).filter(live).length),
  };
}

export function repo(storeName, syncOptions) {
  return wrapWithSync(storeName, _localRepo(storeName), syncOptions);
}
