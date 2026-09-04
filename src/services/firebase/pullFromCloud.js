import { repo as cloudRepo } from "./firestoreRepo.js";
import { fbEnabled, auth } from "./config.js";
import { CORE_DBS, firestoreName } from "./dbRegistry.js";
import { storage } from "../../utils/storage.js";
import { reconcile } from "./syncReconcile.js";

function pullFlag(uid) { return `fb:pulled:${uid}`; }

/* Merge a store's worth of cloud records into local, last-write-wins: a
   newer cloud copy (incl. a tombstone) is written; a newer local edit is
   left untouched. One database open and ONE readwrite transaction for the
   whole store — this used to open the database once per record, which on a
   new-device login turned a few thousand records into a few thousand
   open/transaction/close cycles on the main thread. Resolves to how many
   records were actually written. */
async function putStoreBatch(dbName, storeName, records) {
  if (!records.length) return 0;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve(0); return; }
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      let wrote = 0;
      for (const cloud of records) {
        const getReq = store.get(cloud.id);
        getReq.onsuccess = () => {
          const local = getReq.result || null;
          const merged = reconcile(local, cloud);
          if (merged && merged !== local) { store.put(merged); wrote++; }
        };
      }
      tx.oncomplete = () => { db.close(); resolve(wrote); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    req.onerror = () => reject(req.error);
  });
}

export async function pullFromCloud() {
  if (!fbEnabled || !auth?.currentUser) return { skipped: true };
  const uid = auth.currentUser.uid;
  if (storage.get(pullFlag(uid))) return { skipped: true, reason: "already pulled" };

  let total = 0;

  for (const db of CORE_DBS) {
    for (const store of db.stores) {
      const fsName = firestoreName(db.name, store);
      try {
        const records = (await cloudRepo(fsName).getAll()).filter((r) => r.id);
        total += await putStoreBatch(db.name, store, records);
      } catch {}
    }
  }

  storage.set(pullFlag(uid), true);
  return { pulled: true, total };
}
