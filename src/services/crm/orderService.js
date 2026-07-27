/* Sales & purchase orders with payment tracking.
   Order: {kind: sale|purchase, contactId, item, qty, unit, rate, amount,
           date, status, paidAmount, deliveryDate} */

import { repo } from "../erp/erpDb.js";

export const ORDER_STATUS = [
  { id: "open",      label: "Open"      },
  { id: "delivered", label: "Delivered" },
  { id: "paid",      label: "Paid"      },
  { id: "cancelled", label: "Cancelled" },
];

const orders = repo("orders");

export const orderService = {
  add: (data) => orders.add({
    status: "open", paidAmount: 0, ...data,
    amount: (Number(data.qty) || 0) * (Number(data.rate) || 0),
  }),
  getAll:  () => orders.getAll().then((l) => l.sort((a, b) => (b.date || "").localeCompare(a.date || ""))),
  getByKind: (kind) => orders.getBy("kind", kind)
    .then((l) => l.sort((a, b) => (b.date || "").localeCompare(a.date || ""))),
  getForContact: (contactId) => orders.getBy("contactId", contactId),
  update:  (id, patch) => orders.update(id, patch),
  remove:  (id) => orders.remove(id),

  recordPayment: async (id, amount) => {
    const o = await orders.getById(id);
    if (!o) return null;
    const paid = (Number(o.paidAmount) || 0) + Number(amount);
    return orders.update(id, { paidAmount: paid, status: paid >= o.amount ? "paid" : o.status });
  },

  async summary() {
    const all = await orders.getAll();
    const active = all.filter((o) => o.status !== "cancelled");
    const sales     = active.filter((o) => o.kind === "sale");
    const purchases = active.filter((o) => o.kind === "purchase");
    const sum = (l, f) => l.reduce((s, o) => s + (Number(f(o)) || 0), 0);
    return {
      salesTotal:    sum(sales, (o) => o.amount),
      salesDue:      sum(sales, (o) => o.amount - (o.paidAmount || 0)),
      purchaseTotal: sum(purchases, (o) => o.amount),
      purchaseDue:   sum(purchases, (o) => o.amount - (o.paidAmount || 0)),
      openOrders:    active.filter((o) => o.status === "open").length,
    };
  },
};
