/* Workforce audit / change history (spec §35).

   In a single-user local-first app this is a change LOG, not a security
   control (see plan §2) — it records who-changed-what for traceability, stored
   in the ERP employeeAudit store and offline-synced like everything else. */

import { repo } from "../erp/erpDb.js";

const audit = repo("employeeAudit");

export const auditService = {
  /* action e.g. "employee.created", "payment.recorded", "document.verified".
     ctx: { employeeId?, employeeName?, detail? } */
  log: (action, ctx = {}) => audit.add({
    action,
    employeeId: ctx.employeeId || "",
    employeeName: ctx.employeeName || "",
    detail: ctx.detail || "",
    at: new Date().toISOString(),
  }).catch(() => {}), // logging must never break the action

  forEmployee: (employeeId) => audit.getBy("employeeId", employeeId)
    .then((list) => list.sort((a, b) => (b.at || "").localeCompare(a.at || ""))),

  recent: (limit = 50) => audit.getAll()
    .then((list) => list.sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, limit)),
};
