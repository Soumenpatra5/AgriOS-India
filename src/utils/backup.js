import { CORE_DBS } from "../services/firebase/dbRegistry.js";

const NS = "agrios:";

function exportLocalStorage() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(NS)) {
      try { data[k] = JSON.parse(localStorage.getItem(k)); }
      catch { data[k] = localStorage.getItem(k); }
    }
  }
  return data;
}

function importLocalStorage(data) {
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith(NS)) localStorage.setItem(k, JSON.stringify(v));
  }
}

async function readAllStores(dbName, storeNames) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onerror = () => resolve({});
    req.onsuccess = () => {
      const db = req.result;
      const result = {};
      const existing = Array.from(db.objectStoreNames);
      const toRead = storeNames.filter((s) => existing.includes(s));
      if (!toRead.length) { db.close(); resolve(result); return; }
      const tx = db.transaction(toRead, "readonly");
      let pending = toRead.length;
      for (const name of toRead) {
        const store = tx.objectStore(name);
        const getAll = store.getAll();
        getAll.onsuccess = () => { result[name] = getAll.result; if (--pending === 0) { db.close(); resolve(result); } };
        getAll.onerror = () => { result[name] = []; if (--pending === 0) { db.close(); resolve(result); } };
      }
    };
  });
}

async function writeAllStores(dbName, storeNames, data) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onerror = () => resolve();
    req.onsuccess = () => {
      const db = req.result;
      const existing = Array.from(db.objectStoreNames);
      const toWrite = Object.keys(data).filter((s) => existing.includes(s));
      if (!toWrite.length) { db.close(); resolve(); return; }
      const tx = db.transaction(toWrite, "readwrite");
      for (const name of toWrite) {
        const store = tx.objectStore(name);
        store.clear();
        for (const row of data[name] || []) store.put(row);
      }
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    };
  });
}

export async function createBackup() {
  const backup = {
    version: 1,
    createdAt: new Date().toISOString(),
    localStorage: exportLocalStorage(),
    indexedDB: {},
  };
  for (const { name, stores } of CORE_DBS) {
    backup.indexedDB[name] = await readAllStores(name, stores);
  }
  return backup;
}

export function downloadBackup(backup) {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agrios-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function restoreBackup(file) {
  const text = await file.text();
  const backup = JSON.parse(text);
  if (!backup.version || !backup.localStorage) throw new Error("Invalid backup file");

  importLocalStorage(backup.localStorage);

  if (backup.indexedDB) {
    for (const { name, stores } of CORE_DBS) {
      if (backup.indexedDB[name]) {
        await writeAllStores(name, stores, backup.indexedDB[name]);
      }
    }
  }

  return backup.createdAt;
}

export async function getBackupSize() {
  const backup = await createBackup();
  return JSON.stringify(backup).length;
}
