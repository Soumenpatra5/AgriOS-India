/* Employee documents — now a thin, employee-bound view over the unified
   document service (services/documents/documentService.js).

   The implementation that used to live here (IndexedDB + Firebase Storage +
   expiry + verification) was the mature one of the app's two document systems,
   so it became the basis of the shared service rather than being replaced. The
   farmer's Documents screen, which previously kept a list of titles in
   localStorage with no files at all, now runs on the same code.

   This file stays because the workforce module speaks in employees, not in
   subjects: EmployeeDetail, EmployeeManager and farmAlertsService all call
   forEmployee()/DOC_TYPES. Keeping their vocabulary here means unification did
   not ripple through the whole workforce UI. */

import {
  documentService as unified, categoriesFor, expiryState,
} from "../documents/documentService.js";

/* The employee-relevant slice of the shared category list, in the field shape
   the workforce screens already render ({ id, label, i18n }). */
export const DOC_TYPES = categoriesFor("employee").map((c) => ({
  id: c.id, label: c.i18n.en, i18n: c.i18n, icon: c.icon,
}));

const typeLabel = (id) => DOC_TYPES.find((t) => t.id === id)?.label ?? id ?? "Document";

/* Records come back in the shared shape (title / category / subjectId). The
   workforce screens and alerts read name / type / employeeId, so translate on
   the way out. Both sets of keys are present, which keeps every existing
   caller working while new code can use the shared names. */
const toEmployeeShape = (d) => (d && {
  ...d,
  name: d.title ?? d.name ?? "",
  type: d.category ?? d.type ?? "",
  employeeId: d.subjectId ?? d.employeeId ?? "",
});

export const documentService = {
  typeLabel,
  expiryState,

  /* Create a document for one employee. Same signature as before the merge —
     `name` is the caller's word for what the shared service calls `title`. */
  add({ employeeId, type, name, number, issueDate, expiryDate }, file, opts = {}) {
    return unified.add({
      subjectType: "employee", subjectId: employeeId, category: type,
      title: name, number, issueDate, expiryDate,
    }, file, opts).then(toEmployeeShape);
  },

  update: (id, patch) => unified.update(id, patch),
  remove: (id) => unified.remove(id),
  setStatus: (id, status) => unified.setStatus(id, status),
  replaceFile: (id, file, opts) => unified.replaceFile(id, file, opts),
  openable: (doc) => unified.openable(doc),
  logDownload: (doc) => unified.logDownload(doc),

  forEmployee: (employeeId) => unified.list("employee", employeeId).then((l) => l.map(toEmployeeShape)),

  /* Expiry roll-up. This now spans EVERY document, the farmer's own records
     included — which is what the Alerts Center wants: an expired land record
     matters at least as much as an expired worker ID. */
  expirySummary: () => unified.expirySummary().then((s) => ({
    expired: s.expired.map(toEmployeeShape),
    expiringSoon: s.expiringSoon.map(toEmployeeShape),
  })),
};
