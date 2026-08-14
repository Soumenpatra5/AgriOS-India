import { describe, it, expect, beforeEach, vi } from "vitest";

const held = vi.hoisted(() => {
  const stores = {};
  const make = () => {
    let rows = [];
    let seq = 0;
    return {
      add: async (data) => { const r = { id: `o${++seq}`, ...data }; rows.push(r); return r; },
      getAll: async () => rows.slice(),
      getBy: async (f, v) => rows.filter((r) => r[f] === v),
      getById: async (id) => rows.find((r) => r.id === id) || null,
      update: async (id, patch) => { const r = rows.find((x) => x.id === id); if (!r) return null; Object.assign(r, patch); return r; },
      remove: async (id) => { const i = rows.findIndex((x) => x.id === id); if (i < 0) return null; return rows.splice(i, 1)[0]; },
      reset: () => { rows = []; seq = 0; },
    };
  };
  const repo = (name) => (stores[name] ||= make());
  const resetAll = () => Object.values(stores).forEach((s) => s.reset());
  return { repo, resetAll };
});

vi.mock("../../erp/erpDb.js", () => ({ repo: held.repo, uid: () => "uid" }));

const { orderService, ORDER_STATUS } = await import("../orderService.js");

describe("orderService", () => {
  beforeEach(() => { held.resetAll(); });

  describe("add", () => {
    it("computes amount = qty × rate and applies status/paidAmount defaults", async () => {
      const o = await orderService.add({ kind: "sale", qty: 5, rate: 100 });
      expect(o.amount).toBe(500);
      expect(o.status).toBe("open");
      expect(o.paidAmount).toBe(0);
    });
    it("treats missing qty/rate as a zero amount", async () => {
      expect((await orderService.add({ kind: "sale" })).amount).toBe(0);
    });
    it("lets the caller override the default status", async () => {
      const o = await orderService.add({ kind: "sale", qty: 1, rate: 10, status: "delivered" });
      expect(o.status).toBe("delivered");
    });
  });

  describe("queries", () => {
    it("getAll and getByKind return newest date first", async () => {
      await orderService.add({ kind: "sale", date: "2026-01-01", qty: 1, rate: 1 });
      await orderService.add({ kind: "sale", date: "2026-03-01", qty: 1, rate: 1 });
      await orderService.add({ kind: "purchase", date: "2026-02-01", qty: 1, rate: 1 });
      expect((await orderService.getAll()).map((o) => o.date)).toEqual(["2026-03-01", "2026-02-01", "2026-01-01"]);
      expect((await orderService.getByKind("sale")).map((o) => o.date)).toEqual(["2026-03-01", "2026-01-01"]);
    });
    it("getForContact filters by contactId", async () => {
      await orderService.add({ kind: "sale", contactId: "x", qty: 1, rate: 1 });
      await orderService.add({ kind: "sale", contactId: "y", qty: 1, rate: 1 });
      expect(await orderService.getForContact("x")).toHaveLength(1);
    });
  });

  describe("recordPayment", () => {
    it("accumulates payment and flips to paid once fully covered", async () => {
      const o = await orderService.add({ kind: "sale", qty: 5, rate: 100 }); // amount 500
      const partial = await orderService.recordPayment(o.id, 200);
      expect(partial.paidAmount).toBe(200);
      expect(partial.status).toBe("open");
      const full = await orderService.recordPayment(o.id, 300);
      expect(full.paidAmount).toBe(500);
      expect(full.status).toBe("paid");
    });
    it("returns null for an unknown order", async () => {
      expect(await orderService.recordPayment("nope", 100)).toBeNull();
    });
  });

  describe("summary", () => {
    it("totals sales/purchases and dues, excluding cancelled orders", async () => {
      const s1 = await orderService.add({ kind: "sale", qty: 5, rate: 100 });     // 500
      await orderService.recordPayment(s1.id, 200);                                // paid 200 → open
      const s2 = await orderService.add({ kind: "sale", qty: 3, rate: 100 });     // 300
      await orderService.recordPayment(s2.id, 300);                                // paid 300 → paid
      const p1 = await orderService.add({ kind: "purchase", qty: 4, rate: 100 }); // 400
      await orderService.recordPayment(p1.id, 100);                                // paid 100 → open
      await orderService.add({ kind: "sale", qty: 999, rate: 1, status: "cancelled" }); // excluded

      const sum = await orderService.summary();
      expect(sum.salesTotal).toBe(800);
      expect(sum.salesDue).toBe(300);      // (500-200) + (300-300)
      expect(sum.purchaseTotal).toBe(400);
      expect(sum.purchaseDue).toBe(300);   // 400-100
      expect(sum.openOrders).toBe(2);      // s1 + p1
    });
  });

  it("exposes the order-status vocabulary", () => {
    expect(ORDER_STATUS.map((s) => s.id)).toEqual(["open", "delivered", "paid", "cancelled"]);
  });
});
