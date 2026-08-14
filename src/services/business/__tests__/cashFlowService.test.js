import { describe, it, expect, beforeEach, vi } from "vitest";

/* cashFlowService only needs ledgerService.monthSummary. */
const H = vi.hoisted(() => ({ summaries: {} }));

vi.mock("../../ledger/ledgerService.js", () => ({
  ledgerService: { monthSummary: async (_y, m) => H.summaries[m] || { income: 0, expense: 0, net: 0 } },
}));

const { cashFlowService } = await import("../cashFlowService.js");

describe("cashFlowService", () => {
  beforeEach(() => {
    // Jan +600, Feb -700 → running balance goes negative and stays there.
    H.summaries = {
      1: { income: 1000, expense: 400, net: 600 },
      2: { income: 200, expense: 900, net: -700 },
    };
  });

  describe("monthlyFlow", () => {
    it("carries a running opening/closing balance across all 12 months", async () => {
      const flow = await cashFlowService.monthlyFlow(2026);
      expect(flow).toHaveLength(12);
      expect(flow[0]).toMatchObject({ month: 1, label: "Jan", income: 1000, expense: 400, net: 600, opening: 0, closing: 600, negative: false });
      expect(flow[1]).toMatchObject({ month: 2, label: "Feb", opening: 600, closing: -100, negative: true });
      expect(flow[11]).toMatchObject({ month: 12, closing: -100, negative: true });
    });
  });

  describe("cashNegativeMonths", () => {
    it("returns every month whose closing balance is below zero", async () => {
      const neg = await cashFlowService.cashNegativeMonths(2026);
      expect(neg).toHaveLength(11); // Feb–Dec stay at -100
      expect(neg.every((m) => m.closing < 0)).toBe(true);
    });
  });

  describe("peakMonths", () => {
    it("finds the highest income and highest expense months", async () => {
      const { peakIncome, peakExpense } = await cashFlowService.peakMonths(2026);
      expect(peakIncome.month).toBe(1);  // 1000
      expect(peakExpense.month).toBe(2); // 900
    });
    it("returns nulls when there is no activity", async () => {
      H.summaries = {};
      expect(await cashFlowService.peakMonths(2026)).toEqual({ peakIncome: null, peakExpense: null });
    });
  });

  describe("runningBalanceSeries", () => {
    it("maps each month to a {label, closing-balance} point", async () => {
      const series = await cashFlowService.runningBalanceSeries(2026);
      expect(series).toHaveLength(12);
      expect(series[0]).toEqual({ label: "Jan", value: 600 });
      expect(series[1]).toEqual({ label: "Feb", value: -100 });
    });
  });
});
