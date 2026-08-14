import { describe, it, expect, beforeEach, vi } from "vitest";

/* Mock the ledger the P&L reads from: forMonth drives byEnterprise,
   monthSummary drives byMonth/yearTotal, all drives availableYears. */
const H = vi.hoisted(() => ({ months: {}, summaries: {}, all: [] }));

vi.mock("../../ledger/ledgerService.js", () => ({
  ENTERPRISES: [{ id: "crop", label: "Crop" }, { id: "dairy", label: "Dairy" }, { id: "goat", label: "Goat" }],
  ledgerService: {
    forMonth: async (_y, m) => H.months[m] || [],
    monthSummary: async (_y, m) => H.summaries[m] || { income: 0, expense: 0, net: 0 },
    all: async () => H.all,
  },
}));

const { plService } = await import("../plService.js");

describe("plService", () => {
  beforeEach(() => { H.months = {}; H.summaries = {}; H.all = []; });

  describe("byEnterprise", () => {
    it("aggregates income/expense per enterprise and drops empty ones", async () => {
      H.months = {
        1: [{ enterpriseId: "crop", kind: "income", amount: 5000 }, { enterpriseId: "crop", kind: "expense", amount: 1000 }],
        2: [{ enterpriseId: "dairy", kind: "income", amount: 3000 }],
      };
      const list = await plService.byEnterprise(2026);
      expect(list).toHaveLength(2); // goat had no activity → filtered
      expect(list.find((e) => e.id === "crop")).toMatchObject({ income: 5000, expense: 1000, net: 4000 });
      expect(list.find((e) => e.id === "dairy")).toMatchObject({ income: 3000, expense: 0, net: 3000 });
      expect(list.find((e) => e.id === "goat")).toBeUndefined();
    });

    it("buckets an unknown enterprise id under its own row", async () => {
      H.months = { 3: [{ enterpriseId: "mystery", kind: "income", amount: 700 }] };
      const list = await plService.byEnterprise(2026);
      expect(list.find((e) => e.id === "mystery")).toMatchObject({ income: 700, net: 700 });
    });
  });

  describe("byMonth / yearTotal", () => {
    beforeEach(() => {
      H.summaries = { 1: { income: 5000, expense: 1000, net: 4000 }, 2: { income: 3000, expense: 0, net: 3000 } };
    });
    it("byMonth returns all 12 months in order", async () => {
      const months = await plService.byMonth(2026);
      expect(months).toHaveLength(12);
      expect(months[0]).toEqual({ month: 1, income: 5000, expense: 1000, net: 4000 });
      expect(months[1]).toEqual({ month: 2, income: 3000, expense: 0, net: 3000 });
      expect(months[11]).toEqual({ month: 12, income: 0, expense: 0, net: 0 });
    });
    it("yearTotal sums every month", async () => {
      expect(await plService.yearTotal(2026)).toEqual({ income: 8000, expense: 1000, net: 7000 });
    });
  });

  describe("bestEnterprise", () => {
    it("returns the highest-net enterprise", async () => {
      H.months = {
        1: [{ enterpriseId: "crop", kind: "income", amount: 5000 }, { enterpriseId: "crop", kind: "expense", amount: 1000 }],
        2: [{ enterpriseId: "dairy", kind: "income", amount: 3000 }],
      };
      expect((await plService.bestEnterprise(2026)).id).toBe("crop"); // net 4000 > 3000
    });
    it("returns null when there is no activity", async () => {
      expect(await plService.bestEnterprise(2026)).toBeNull();
    });
  });

  describe("availableYears", () => {
    it("lists distinct years newest first", async () => {
      const cur = String(new Date().getFullYear());
      const old = String(new Date().getFullYear() - 2);
      H.all = [{ date: `${cur}-03-01` }, { date: `${old}-05-01` }, { date: `${cur}-07-01` }];
      const years = await plService.availableYears();
      expect(years[0]).toBe(cur);
      expect(years).toContain(old);
      expect(new Set(years).size).toBe(years.length); // no duplicates
    });
    it("prepends the current year when it has no data yet", async () => {
      const older = String(new Date().getFullYear() - 6);
      H.all = [{ date: `${older}-01-01` }];
      const years = await plService.availableYears();
      expect(years[0]).toBe(String(new Date().getFullYear()));
      expect(years).toContain(older);
    });
  });
});
