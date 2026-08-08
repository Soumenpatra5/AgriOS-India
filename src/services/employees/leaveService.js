/* Employee leave management (spec §12). Requests are stored in the ERP
   `employeeLeaves` store (offline-synced). In this single-user app the farm
   owner both records and approves leave, so "apply" creates a pending request
   and approve/reject decide it. Balance = annual allowance − approved days. */

import { repo } from "../erp/erpDb.js";

export const LEAVE_TYPES = [
  { id: "casual",    label: "Casual Leave",    allowance: 12 },
  { id: "sick",      label: "Sick Leave",      allowance: 12 },
  { id: "annual",    label: "Annual Leave",    allowance: 15 },
  { id: "emergency", label: "Emergency Leave", allowance: 6 },
  { id: "unpaid",    label: "Unpaid Leave",    allowance: 0 },
  { id: "other",     label: "Other",           allowance: 0 },
];

const leaves = repo("employeeLeaves");
const meta = (id) => LEAVE_TYPES.find((t) => t.id === id);

/* Inclusive whole-day span between two YYYY-MM-DD dates. */
export function leaveDays(fromDate, toDate) {
  if (!fromDate) return 0;
  const a = new Date(fromDate + "T12:00:00");
  const b = new Date((toDate || fromDate) + "T12:00:00");
  const diff = Math.round((b - a) / 86400000);
  return diff >= 0 ? diff + 1 : 0;
}

export const leaveService = {
  typeLabel: (id) => meta(id)?.label ?? id ?? "",

  async apply({ employeeId, employeeName, type, fromDate, toDate, reason }) {
    return leaves.add({
      employeeId, employeeName, type,
      fromDate, toDate: toDate || fromDate,
      days: leaveDays(fromDate, toDate),
      reason: reason || "",
      status: "pending",
      appliedDate: new Date().toISOString().slice(0, 10),
    });
  },

  decide: (id, status) => leaves.update(id, { status, decidedDate: new Date().toISOString().slice(0, 10) }),
  approve: (id) => leaveService.decide(id, "approved"),
  reject:  (id) => leaveService.decide(id, "rejected"),
  remove:  (id) => leaves.remove(id),

  forEmployee: (employeeId) => leaves.getBy("employeeId", employeeId)
    .then((list) => list.sort((a, b) => (b.fromDate || "").localeCompare(a.fromDate || ""))),

  pending: () => leaves.getBy("status", "pending"),

  /* Per-type balance for an employee in a given year (default: current). */
  async balance(employeeId, year = new Date().getFullYear()) {
    const rows = (await leaves.getBy("employeeId", employeeId))
      .filter((l) => l.status === "approved" && (l.fromDate || "").startsWith(String(year)));
    return LEAVE_TYPES.filter((t) => t.allowance > 0).map((t) => {
      const used = rows.filter((l) => l.type === t.id).reduce((s, l) => s + (Number(l.days) || 0), 0);
      return { type: t.id, label: t.label, allowance: t.allowance, used, remaining: Math.max(0, t.allowance - used) };
    });
  },
};
