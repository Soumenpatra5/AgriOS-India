const DB_NAME = "agrios-sync-queue";
const DB_VERSION = 1;
const STORE = "pending";

let _db = null;

function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        s.createIndex("storeName", "storeName", { unique: false });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function run(mode, fn) {
  return openDb().then((db) => new Promise((res, rej) => {
    const store = db.transaction(STORE, mode).objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}

export function enqueue(storeName, op, data) {
  return run("readwrite", (s) =>
    s.add({ storeName, op, data, timestamp: Date.now() })
  );
}

export function getAll() {
  return run("readonly", (s) => s.getAll()).then((r) => r || []);
}

export function remove(id) {
  return run("readwrite", (s) => s.delete(id));
}

export async function clear() {
  return run("readwrite", (s) => s.clear());
}
