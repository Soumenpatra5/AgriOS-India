import { describe, it, expect } from "vitest";
import {
  emi, loanSchedule, straightLineDepreciation, npv, irr, bcr,
  dscr, averageDscr, paybackPeriod, breakEvenUnits, breakEvenPct,
} from "../dprFinance.js";

describe("dprFinance", () => {
  describe("emi", () => {
    it("computes the standard amortised instalment", () => {
      // ₹1,00,000 at 12% for 12 months → ₹8,884.88
      expect(emi(100000, 12, 12)).toBeCloseTo(8884.88, 1);
    });
    it("splits principal evenly when the loan is interest-free", () => {
      expect(emi(120000, 0, 12)).toBe(10000);
    });
    it("returns 0 for a missing principal or tenure", () => {
      expect(emi(0, 12, 12)).toBe(0);
      expect(emi(100000, 12, 0)).toBe(0);
    });
  });

  describe("loanSchedule", () => {
    it("amortises principal evenly and charges interest on the opening balance", () => {
      const rows = loanSchedule({ principal: 100000, ratePct: 10, tenureYears: 5 });
      expect(rows).toHaveLength(5);
      expect(rows[0]).toMatchObject({ year: 1, opening: 100000, interest: 10000, principal: 20000, closing: 80000 });
      expect(rows[1]).toMatchObject({ year: 2, opening: 80000, interest: 8000, principal: 20000, closing: 60000 });
      expect(rows[4].closing).toBe(0);
    });

    it("shields principal during the moratorium but still charges interest", () => {
      const rows = loanSchedule({ principal: 100000, ratePct: 10, tenureYears: 5, moratoriumMonths: 12 });
      expect(rows[0]).toMatchObject({ year: 1, interest: 10000, principal: 0, closing: 100000 });
      // 4 repayment years remain → ₹25,000 a year
      expect(rows[1]).toMatchObject({ year: 2, principal: 25000, closing: 75000 });
      expect(rows[4].closing).toBe(0);
    });

    it("always leaves at least one repayment year, however long the moratorium", () => {
      const rows = loanSchedule({ principal: 90000, ratePct: 10, tenureYears: 3, moratoriumMonths: 60 });
      expect(rows).toHaveLength(3);
      expect(rows[0].principal).toBe(0);
      expect(rows[1].principal).toBe(0);
      expect(rows[2].principal).toBe(90000);
      expect(rows[2].closing).toBe(0);
    });

    it("rounds a part-year moratorium up to a whole shielded year", () => {
      const rows = loanSchedule({ principal: 100000, ratePct: 10, tenureYears: 5, moratoriumMonths: 6 });
      expect(rows[0].principal).toBe(0);
      expect(rows[1].principal).toBe(25000);
    });

    it("returns nothing without a principal or a tenure", () => {
      expect(loanSchedule({ principal: 0, ratePct: 10, tenureYears: 5 })).toEqual([]);
      expect(loanSchedule({ principal: 100000, ratePct: 10, tenureYears: 0 })).toEqual([]);
    });
  });

  describe("straightLineDepreciation", () => {
    it("sums each item's annual write-down over its useful life", () => {
      expect(straightLineDepreciation([
        { amount: 200000, lifeYears: 20 }, // shed  → 10,000
        { amount: 60000,  lifeYears: 10 }, // plant →  6,000
      ])).toBe(16000);
    });
    it("ignores items with no useful life (e.g. livestock)", () => {
      expect(straightLineDepreciation([{ amount: 70000 }, { amount: 20000, lifeYears: 10 }])).toBe(2000);
    });
    it("is 0 for an empty schedule", () => {
      expect(straightLineDepreciation([])).toBe(0);
    });
  });

  describe("npv", () => {
    it("discounts each year and leaves year 0 undiscounted", () => {
      expect(npv(10, [-1000, 500, 500, 500])).toBeCloseTo(243.43, 1);
    });
    it("equals the plain sum at a 0% discount rate", () => {
      expect(npv(0, [-1000, 500, 500, 500])).toBe(500);
    });
  });

  describe("irr", () => {
    it("finds the rate that zeroes the NPV", () => {
      const rate = irr([-1000, 500, 500, 500]);
      expect(rate).toBeGreaterThan(23);
      expect(rate).toBeLessThan(24);
      expect(npv(rate, [-1000, 500, 500, 500])).toBeCloseTo(0, 0);
    });
    it("returns null when the flows never cross zero", () => {
      expect(irr([1000, 500, 500])).toBeNull();   // no investment
      expect(irr([-1000, -50, -50])).toBeNull();  // never profitable
    });
    it("returns null for an empty or all-zero project rather than a made-up rate", () => {
      expect(irr([0, 0, 0, 0])).toBeNull();
      expect(irr([])).toBeNull();
    });
  });

  describe("bcr", () => {
    it("is the ratio of discounted benefits to discounted costs", () => {
      // costs 1000 at year 0; benefits 600 in each of years 1-2
      const ratio = bcr(10, [0, 600, 600], [1000, 0, 0]);
      expect(ratio).toBeCloseTo(1.04, 2);
    });
    it("returns null when there are no costs to compare against", () => {
      expect(bcr(10, [0, 600], [0, 0])).toBeNull();
    });
  });

  describe("dscr", () => {
    it("adds interest and depreciation back before dividing by debt service", () => {
      // (50000 + 10000 + 16000) / (10000 + 20000) = 2.53
      expect(dscr({ netSurplus: 50000, interest: 10000, depreciation: 16000, principalRepaid: 20000 }))
        .toBeCloseTo(2.53, 2);
    });
    it("is null in a year with no debt service rather than infinite", () => {
      expect(dscr({ netSurplus: 50000, interest: 0, depreciation: 0, principalRepaid: 0 })).toBeNull();
    });
    it("goes below 1 when the surplus cannot cover the instalment", () => {
      expect(dscr({ netSurplus: -5000, interest: 10000, depreciation: 2000, principalRepaid: 20000 }))
        .toBeLessThan(1);
    });
  });

  describe("averageDscr", () => {
    it("averages only the years that actually carry debt service", () => {
      expect(averageDscr([{ dscr: 2 }, { dscr: 3 }, { dscr: null }])).toBe(2.5);
    });
    it("is null when no year carries debt service", () => {
      expect(averageDscr([{ dscr: null }])).toBeNull();
    });
  });

  describe("paybackPeriod", () => {
    it("interpolates within the year the project turns cash-positive", () => {
      expect(paybackPeriod([-1000, 400, 400, 400])).toBe(2.5);
    });
    it("is 0 when there is no net investment to recover", () => {
      expect(paybackPeriod([0, 400])).toBe(0);
    });
    it("is null when the investment is never recovered in the horizon", () => {
      expect(paybackPeriod([-1000, 100, 100])).toBeNull();
    });
  });

  describe("breakEvenUnits", () => {
    it("divides fixed cost by the per-unit contribution, rounded up", () => {
      expect(breakEvenUnits({ fixedCost: 100000, pricePerUnit: 35, variableCostPerUnit: 20 })).toBe(6667);
    });
    it("is null when a unit does not cover its own variable cost", () => {
      expect(breakEvenUnits({ fixedCost: 100000, pricePerUnit: 20, variableCostPerUnit: 20 })).toBeNull();
      expect(breakEvenUnits({ fixedCost: 100000, pricePerUnit: 15, variableCostPerUnit: 20 })).toBeNull();
    });
  });

  describe("breakEvenPct", () => {
    it("expresses the break-even output as a share of rated capacity", () => {
      expect(breakEvenPct({ fixedCost: 100000, pricePerUnit: 35, variableCostPerUnit: 20, capacityUnits: 10000 }))
        .toBeCloseTo(66.67, 1);
    });
    it("is null without a capacity to compare against", () => {
      expect(breakEvenPct({ fixedCost: 100000, pricePerUnit: 35, variableCostPerUnit: 20, capacityUnits: 0 })).toBeNull();
    });
  });
});
