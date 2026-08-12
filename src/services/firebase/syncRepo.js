import { enqueue } from "./syncQueue.js";

/* firestoreRepo pulls in the Firestore SDK (~600kB). Load it lazily so reads —
   which never touch the cloud — keep Firestore off the initial render path. */
async function cloudRepo(storeName) {
  const { repo } = await import("./firestoreRepo.js");
  return repo(storeName);
}

export function wrapWithSync(storeName, local, options = {}) {
  // Fields that must never leave the device — e.g. base64 file blobs, which
  // would blow past Firestore's 1 MB document limit and put sensitive data
  // (ID/bank/medical scans) in the cloud. Stripped from every record and patch
  // before it is pushed; the full value stays in local IndexedDB.
  const strip = options.stripForSync || [];
  const forCloud = (obj) => {
    if (!strip.length || !obj) return obj;
    const copy = { ...obj };
    for (const k of strip) delete copy[k];
    return copy;
  };

  function pushToCloud(op) {
    cloudRepo(storeName).then(op).catch(() => {});
  }

  return {
    async add(data) {
      const record = await local.add(data);
      const cloudRecord = forCloud(record);
      pushToCloud((cloud) =>
        cloud.add(cloudRecord).catch(() => enqueue(storeName, "add", cloudRecord))
      );
      return record;
    },

    getAll: () => local.getAll(),
    getBy: (index, value) => local.getBy(index, value),
    getById: (id) => local.getById(id),

    async update(id, patch) {
      const updated = await local.update(id, patch);
      if (updated) {
        const cloudPatch = forCloud(patch);
        pushToCloud((cloud) =>
          cloud.update(id, cloudPatch).catch(() => enqueue(storeName, "update", { id, ...cloudPatch }))
        );
      }
      return updated;
    },

    async remove(id) {
      const result = await local.remove(id);
      const tombstone = result && result.deletedAt ? result : null;
      if (tombstone) {
        // Soft-delete: propagate a tombstone (deletedAt) rather than hard-deleting
        // the cloud doc, so peers learn of the deletion and it doesn't resurrect
        // (H2). The timestamp drives last-write-wins on the next pull (H3).
        const patch = { deletedAt: tombstone.deletedAt, updatedAt: tombstone.deletedAt };
        pushToCloud((cloud) =>
          cloud.update(id, patch).catch(() => enqueue(storeName, "update", { id, ...patch }))
        );
      } else {
        // Hard-delete repos (no local soft-delete): remove the cloud doc.
        pushToCloud((cloud) =>
          cloud.remove(id).catch(() => enqueue(storeName, "remove", { id }))
        );
      }
    },

    // Undo a soft delete (no-op on stores whose local repo lacks soft-delete).
    restore(id) {
      if (!local.restore) return Promise.resolve(null);
      const p = local.restore(id);
      pushToCloud((cloud) =>
        cloud.update(id, { deletedAt: null }).catch(() => enqueue(storeName, "update", { id, deletedAt: null }))
      );
      return p;
    },

    // Irreversible physical delete (falls back to remove where unsupported).
    async purge(id) {
      if (local.purge) await local.purge(id); else await local.remove(id);
      pushToCloud((cloud) =>
        cloud.remove(id).catch(() => enqueue(storeName, "remove", { id }))
      );
    },

    count: () => local.count(),
  };
}
