/* IndexedDB-backed offline write queue.
 *
 * Each entry is a pending farm API call: { action, spaceId, payload }.
 * On reconnect the queue is replayed in insertion order; idempotent calls
 * (those with clientUuid in payload) are safe to replay — the server
 * returns the existing record on duplicates.
 *
 * Falls back to an in-memory array when IndexedDB is unavailable (private
 * windows, storage blocked) so the queue at least works for the session. */

const DB_NAME   = "agrios_offline_queue";
const DB_VER    = 1;
const STORE     = "queue";

let memQueue = [];

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function enqueue(entry) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).add({ ...entry, enqueuedAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
    db.close();
  } catch {
    memQueue.push({ ...entry, enqueuedAt: Date.now() });
  }
}

export async function dequeue(id) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
    db.close();
  } catch {
    memQueue = memQueue.filter(e => e.id !== id);
  }
}

export async function listQueue() {
  try {
    const db = await openDb();
    const entries = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
    db.close();
    return entries.sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  } catch {
    return [...memQueue];
  }
}

export async function clearQueue() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
    db.close();
  } catch {
    memQueue = [];
  }
}

export async function queueSize() {
  const q = await listQueue();
  return q.length;
}
