import { repo as cloudRepo } from "./firestoreRepo.js";
import { fbEnabled, auth } from "./config.js";
import { CORE_DBS, firestoreName } from "./dbRegistry.js";
import { storage } from "../../utils/storage.js";
import { reconcile } from "./syncReconcile.js";

function pullFlag(uid) { return `fb:pulled:${uid}`; }

/* Merge a cloud record into local by last-write-wins instead of blindly
   overwriting: a newer cloud copy (incl. a tombstone) is written; a newer local
   edit is left untouched. Resolves true if it actually wrote. */
async function putLocal(dbName, storeName, cloud) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve(false); return; }
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      let wrote = false;
      const getReq = store.get(cloud.id);
      getReq.onsuccess = () => {
        const local = getReq.result || null;
        const merged = reconcile(local, cloud);
        if (merged && merged !== local) { store.put(merged); wrote = true; }
      };
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
        const records = await cloudRepo(fsName).getAll();
        for (const record of records) {
          if (!record.id) continue;
          if (await putLocal(db.name, store, record)) total++;
        }
      } catch {}
    }
  }

  storage.set(pullFlag(uid), true);
  return { pulled: true, total };
}
