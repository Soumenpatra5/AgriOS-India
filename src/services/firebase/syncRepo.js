import { repo as cloudRepo } from "./firestoreRepo.js";
import { enqueue } from "./syncQueue.js";

export function wrapWithSync(storeName, local) {
  const cloud = cloudRepo(storeName);

  function pushToCloud(fn) {
    try { fn().catch(() => {}); } catch {}
  }

  return {
    async add(data) {
      const record = await local.add(data);
      pushToCloud(() =>
        cloud.add(record).catch(() => enqueue(storeName, "add", record))
      );
      return record;
    },

    getAll: () => local.getAll(),
    getBy: (index, value) => local.getBy(index, value),
    getById: (id) => local.getById(id),

    async update(id, patch) {
      const updated = await local.update(id, patch);
      if (updated) {
        pushToCloud(() =>
          cloud.update(id, patch).catch(() => enqueue(storeName, "update", { id, ...patch }))
        );
      }
      return updated;
    },

    async remove(id) {
      await local.remove(id);
      pushToCloud(() =>
        cloud.remove(id).catch(() => enqueue(storeName, "remove", { id }))
      );
    },

    count: () => local.count(),
  };
}
