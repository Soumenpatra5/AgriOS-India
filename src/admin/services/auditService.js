import { repo } from "../adminDb.js";

const logs = repo("auditLogs");

export const auditService = {
  async log(action, entity, details = {}) {
    return logs.add({ action, entity, details, adminId: "admin", timestamp: new Date().toISOString() });
  },
  getAll: () => logs.getAll(),
  getByAction: (action) => logs.getBy("action", action),
  getByEntity: (entity) => logs.getBy("entity", entity),
  clear: () => logs.getAll().then((all) => Promise.all(all.map((r) => logs.remove(r.id)))),
};
