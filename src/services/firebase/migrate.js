import { collection, doc, setDoc } from "firebase/firestore";
import { auth, fbEnabled } from "./config.js";
import { db } from "./firestore.js";
import { storage } from "../../utils/storage.js";
import { CORE_DBS, firestoreName } from "./dbRegistry.js";

const MIGRATION_FLAG = "fb:migrated";

function readIdb(dbName, storeNames) {
  return new Promise((resolve) => {
    const req = indexedDB.open(dbName);
    req.onerror = () => resolve({});
    req.onsuccess = (e) => {
      const idb = e.target.result;
      const result = {};
      const existing = Array.from(idb.objectStoreNames);
      const toRead = storeNames.filter((s) => existing.includes(s));
      if (!toRead.length) { idb.close(); resolve(result); return; }

      const tx = idb.transaction(toRead, "readonly");
      let pending = toRead.length;
      for (const name of toRead) {
        const r = tx.objectStore(name).getAll();
        r.onsuccess = () => { result[name] = r.result || []; if (--pending === 0) { idb.close(); resolve(result); } };
        r.onerror   = () => { result[name] = [];             if (--pending === 0) { idb.close(); resolve(result); } };
      }
    };
  });
}

export async function migrateToFirestore() {
  if (!fbEnabled) return { skipped: true, reason: "firebase not configured" };
  if (storage.get(MIGRATION_FLAG)) return { skipped: true };
  const user = auth.currentUser;
  if (!user) return { skipped: true, reason: "not authenticated" };

  let total = 0;
  const userRoot = `users/${user.uid}`;

  for (const dbEntry of CORE_DBS) {
    const data = await readIdb(dbEntry.name, dbEntry.stores);

    for (const [storeName, records] of Object.entries(data)) {
      const fsCol = firestoreName(dbEntry.name, storeName);
      for (const record of records) {
        if (!record.id) continue;
        await setDoc(doc(collection(db, userRoot, fsCol), record.id), record);
        total++;
      }
    }
  }

  const ledgerTxns = storage.get("ldg:txns", []);
  for (const txn of ledgerTxns) {
    if (!txn.id) continue;
    await setDoc(doc(collection(db, userRoot, "ledgerTxns"), txn.id), txn);
    total++;
  }

  storage.set(MIGRATION_FLAG, true);
  return { migrated: true, total };
}
