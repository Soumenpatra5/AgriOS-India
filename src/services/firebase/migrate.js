import { collection, doc, writeBatch } from "firebase/firestore";
import { auth, fbEnabled } from "./config.js";
import { db } from "./firestore.js";
import { storage } from "../../utils/storage.js";
import { CORE_DBS, firestoreName } from "./dbRegistry.js";

/* Scoped by uid. The old global "fb:migrated" flag meant a SECOND account
   signing in on the same device never migrated its local data at all — the
   first account's flag suppressed it. The legacy flag is claimed once, for
   whichever account encounters it first (historically the device's only
   account), so existing devices don't re-run a migration that could
   overwrite newer cloud data with stale local copies. */
const LEGACY_FLAG = "fb:migrated";
const migrationFlag = (uid) => `fb:migrated:${uid}`;

/* Firestore caps a WriteBatch at 500 operations. */
const BATCH_SIZE = 400;

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
  const user = auth.currentUser;
  if (!user) return { skipped: true, reason: "not authenticated" };

  if (storage.get(migrationFlag(user.uid))) return { skipped: true };
  if (storage.get(LEGACY_FLAG)) {
    /* This device already migrated under the old un-scoped flag — claim it
       for this account and don't re-copy stale local data over the cloud. */
    storage.set(migrationFlag(user.uid), true);
    storage.remove(LEGACY_FLAG);
    return { skipped: true, reason: "legacy flag claimed" };
  }

  let total = 0;
  const userRoot = `users/${user.uid}`;

  /* Batched: the old loop awaited one setDoc per record, serially — a farm
     with a few thousand rows meant a few thousand sequential round trips on
     first login. A WriteBatch commits up to BATCH_SIZE writes in one. */
  let batch = writeBatch(db);
  let inBatch = 0;
  const flush = async () => {
    if (inBatch === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    inBatch = 0;
  };
  const queueWrite = async (fsCol, record) => {
    batch.set(doc(collection(db, userRoot, fsCol), record.id), record);
    total++;
    if (++inBatch >= BATCH_SIZE) await flush();
  };

  for (const dbEntry of CORE_DBS) {
    const data = await readIdb(dbEntry.name, dbEntry.stores);

    for (const [storeName, records] of Object.entries(data)) {
      const fsCol = firestoreName(dbEntry.name, storeName);
      for (const record of records) {
        if (!record.id) continue;
        await queueWrite(fsCol, record);
      }
    }
  }

  const ledgerTxns = storage.get("ldg:txns", []);
  for (const txn of ledgerTxns) {
    if (!txn.id) continue;
    await queueWrite("ledgerTxns", txn);
  }

  await flush();
  storage.set(migrationFlag(user.uid), true);
  return { migrated: true, total };
}
