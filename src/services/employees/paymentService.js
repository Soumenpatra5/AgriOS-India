/* Employee salary/wage payments (spec §11). One record per disbursement,
   stored in the ERP `employeePayments` store so it inherits offline sync.
   A payment captures the computed gross plus per-payment bonus/allowance/
   advance/deduction and the resulting net that was actually paid. */

import { repo } from "../erp/erpDb.js";

const payments = repo("employeePayments");
const n = (v) => Number(v) || 0;

export const paymentService = {
  /* data: { employeeId, employeeName, date, period, method, reference,
             gross, bonus, allowance, advance, deduction, net, status, notes } */
  add: (data) => payments.add({
    status: "paid",
    date: data.date || new Date().toISOString().slice(0, 10),
    ...data,
    gross: n(data.gross), bonus: n(data.bonus), allowance: n(data.allowance),
    advance: n(data.advance), deduction: n(data.deduction), net: n(data.net),
  }),

  remove: (id) => payments.remove(id),

  forEmployee: (employeeId) => payments.getBy("employeeId", employeeId)
    .then((list) => list.sort((a, b) => (b.date || "").localeCompare(a.date || ""))),

  all: () => payments.getAll().then((list) => list.sort((a, b) => (b.date || "").localeCompare(a.date || ""))),

  /* Totals for a given month "YYYY-MM" (by payment date). */
  async monthTotals(yearMonth) {
    const list = (await payments.getAll()).filter((p) => (p.date || "").startsWith(yearMonth));
    return {
      count: list.length,
      paid: list.filter((p) => p.status === "paid").reduce((s, p) => s + n(p.net), 0),
      pending: list.filter((p) => p.status !== "paid").reduce((s, p) => s + n(p.net), 0),
    };
  },
};
