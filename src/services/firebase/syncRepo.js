import { enqueue } from "./syncQueue.js";

/* firestoreRepo pulls in the Firestore SDK (~600kB). Load it lazily so reads —
   which never touch the cloud — keep Firestore off the initial render path. */
async function cloudRepo(storeName) {
  const { repo } = await import("./firestoreRepo.js");
  return repo(storeName);
}

export function wrapWithSync(storeName, local) {
  function pushToCloud(op) {
    cloudRepo(storeName).then(op).catch(() => {});
  }

  return {
    async add(data) {
      const record = await local.add(data);
      pushToCloud((cloud) =>
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
        pushToCloud((cloud) =>
          cloud.update(id, patch).catch(() => enqueue(storeName, "update", { id, ...patch }))
        );
      }
      return updated;
    },

    async remove(id) {
      await local.remove(id);
      pushToCloud((cloud) =>
        cloud.remove(id).catch(() => enqueue(storeName, "remove", { id }))
      );
    },

    count: () => local.count(),
  };
}
