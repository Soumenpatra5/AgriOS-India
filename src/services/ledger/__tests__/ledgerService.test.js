import { describe, it, expect, beforeEach, vi } from "vitest";

/* In-memory erpDb repo so ledger aggregation is tested without IndexedDB. */
const held = vi.hoisted(() => {
  let rows = [];
  let seq = 0;
  const repoObj = {
    add: async (data) => { const r = { id: `x${++seq}`, ...data }; rows.push(r); return r; },
    getAll: async () => rows.slice(),
    /* Models erpDb's bounded index scan: inclusive bounds on the named field,
       matching IDBKeyRange.bound() semantics. */
    getRange: async (field, lower, upper) => rows.filter((r) => r[field] >= lower && r[field] <= upper),
    remove: async (id) => { const i = rows.findIndex((r) => r.id === id); if (i < 0) return null; return rows.splice(i, 1)[0]; },
    reset: () => { rows = []; seq = 0; },
  };
  return { repoObj };
});

vi.mock("../../erp/erpDb.js", () => ({ repo: () => held.repoObj, uid: () => "uid" }));

const { ledgerService } = await import("../ledgerService.js");

describe("ledgerService", () => {
  beforeEach(() => { held.repoObj.reset(); });

  describe("all", () => {
    it("returns transactions newest date first", async () => {
      await ledgerService.add({ date: "2026-02-01", kind: "income", amount: 1 });
      await ledgerService.add({ date: "2026-03-10", kind: "income", amount: 1 });
      await ledgerService.add({ date: "2026-01-15", kind: "income", amount: 1 });
      expect((await ledgerService.all()).map((t) => t.date)).toEqual(["2026-03-10", "2026-02-01", "2026-01-15"]);
    });
  });

  describe("forMonth", () => {
    it("filters to a zero-padded year-month prefix", async () => {
      await ledgerService.add({ date: "2026-01-15", kind: "income", amount: 1 });
      await ledgerService.add({ date: "2026-02-01", kind: "income", amount: 1 });
      await ledgerService.add({ date: "2026-02-20", kind: "expense", amount: 1 });
      expect(await ledgerService.forMonth(2026, 1)).toHaveLength(1);
      expect(await ledgerService.forMonth(2026, 2)).toHaveLength(2);
      expect(await ledgerService.forMonth(2026, 12)).toHaveLength(0);
    });
  });

  describe("monthSummary", () => {
    it("sums income and expense and nets them", async () => {
      await ledgerService.add({ date: "2026-05-02", kind: "income", amount: 1000 });
      await ledgerService.add({ date: "2026-05-09", kind: "expense", amount: 400 });
      await ledgerService.add({ date: "2026-05-20", kind: "income", amount: 200 });
      await ledgerService.add({ date: "2026-06-01", kind: "income", amount: 999 }); // other month
      expect(await ledgerService.monthSummary(2026, 5)).toEqual({ income: 1200, expense: 400, net: 800 });
    });

    it("nets to zero for an empty month", async () => {
      expect(await ledgerService.monthSummary(2026, 7)).toEqual({ income: 0, expense: 0, net: 0 });
    });
  });

  describe("currentMonthSummary", () => {
    it("summarises the live current month", async () => {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      await ledgerService.add({ date: `${ym}-15`, kind: "income", amount: 777 });
      expect((await ledgerService.currentMonthSummary()).income).toBe(777);
    });
  });

  describe("add / remove", () => {
    it("add returns the new id; remove drops the row", async () => {
      const id = await ledgerService.add({ date: "2026-04-01", kind: "expense", amount: 50 });
      expect(typeof id).toBe("string");
      expect(await ledgerService.all()).toHaveLength(1);
      await ledgerService.remove(id);
      expect(await ledgerService.all()).toHaveLength(0);
    });
  });

  describe("label helpers (pure lookups)", () => {
    it("resolves category labels, falling back to the raw id", () => {
      expect(ledgerService.categoryLabel("income", "crop_sale")).toBe("Crop sale");
      expect(ledgerService.categoryLabel("expense", "seeds")).toBe("Seeds");
      expect(ledgerService.categoryLabel("income", "mystery")).toBe("mystery");
    });
    it("resolves category icons, falling back to Wallet", () => {
      expect(ledgerService.categoryIcon("income", "milk_sale")).toBe("Milk");
      expect(ledgerService.categoryIcon("expense", "mystery")).toBe("Wallet");
    });
    it("resolves enterprise labels, falling back to empty string", () => {
      expect(ledgerService.enterpriseLabel("dairy")).toBe("Dairy");
      expect(ledgerService.enterpriseLabel("mystery")).toBe("");
    });
  });
});
