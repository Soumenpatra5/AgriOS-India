/* IndexedDB-backed Dead-Letter Queue (DLQ) for failed offline writes.
 *
 * When an offline action cannot be synced after maximum retries or is rejected
 * by the server with a 4xx client error, it is moved here rather than silently
 * discarded. This preserves the farmer's data for review and surfaces an alert.
 */

const DB_NAME = "agrios_offline_dlq";
const DB_VER  = 1;
const STORE   = "dead_letters";

let memDlq = [];
let memIdCounter = 0;

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

export async function addDeadLetter(entry, reason, error = {}) {
  const item = {
    entry,
    reason: reason || "unknown",
    errorStatus: error?.status || null,
    errorMessage: error?.message || "",
    failedAt: Date.now(),
  };

  try {
    const db = await openDb();
    const id = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).add(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
    db.close();
    return { id, ...item };
  } catch {
    const fallbackItem = { id: ++memIdCounter, ...item };
    memDlq.push(fallbackItem);
    return fallbackItem;
  }
}

export async function listDeadLetters() {
  try {
    const db = await openDb();
    const entries = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
    db.close();
    return entries.sort((a, b) => b.failedAt - a.failedAt);
  } catch {
    return [...memDlq].sort((a, b) => b.failedAt - a.failedAt);
  }
}

export async function removeDeadLetter(id) {
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
    memDlq = memDlq.filter((e) => e.id !== id);
  }
}

export async function clearDeadLetters() {
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
    memDlq = [];
    memIdCounter = 0;
  }
}

export async function deadLetterCount() {
  const list = await listDeadLetters();
  return list.length;
}
