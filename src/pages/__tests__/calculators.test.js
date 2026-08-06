import { describe, it, expect, vi } from "vitest";

// Calculator.jsx imports theme/icon/store modules; give them a benign env.
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });

const { CALCS } = await import("../Calculator.jsx");

// Pull the numeric value out of a result row by (English) label substring.
const val = (rows, labelPart) => rows.find((r) => r.label.en.includes(labelPart))?.value;

describe("calculators", () => {
  it("returns null until required fields are provided", () => {
    expect(CALCS.emi.compute({ P: null, rate: 10, months: null })).toBeNull();
    expect(CALCS.profit.compute({ revenue: null, cost: 50 })).toBeNull();
    expect(CALCS.yield.compute({ prod: 40, acres: null })).toBeNull();
  });

  describe("EMI", () => {
    it("matches the standard amortization formula", () => {
      // ₹100000 at 10%/yr for 12 months → EMI ≈ ₹8792
      const rows = CALCS.emi.compute({ P: 100000, rate: 10, months: 12 });
      expect(val(rows, "Monthly EMI")).toBe("₹8,792");
    });

    it("handles a zero interest rate (principal / months)", () => {
      const rows = CALCS.emi.compute({ P: 12000, rate: 0, months: 12 });
      expect(val(rows, "Monthly EMI")).toBe("₹1,000");
      expect(val(rows, "Total interest")).toBe("₹0");
    });

    it("returns null for non-positive tenure", () => {
      expect(CALCS.emi.compute({ P: 100000, rate: 10, months: 0 })).toBeNull();
    });
  });

  describe("Profit", () => {
    it("computes profit, margin and per-acre profit", () => {
      const rows = CALCS.profit.compute({ revenue: 80000, cost: 50000, acres: 2 });
      expect(val(rows, "Profit")).toBe("₹30,000");
      expect(val(rows, "Margin")).toBe("37.5%");
      expect(val(rows, "acre")).toBe("₹15,000");
    });

    it("flags a loss as negative and omits per-acre when no area", () => {
      const rows = CALCS.profit.compute({ revenue: 40000, cost: 50000 });
      const profitRow = rows.find((r) => r.label.en === "Profit");
      expect(profitRow.negative).toBe(true);
      expect(rows.some((r) => r.label.en.includes("acre"))).toBe(false);
    });
  });

  describe("Feed cost", () => {
    it("multiplies animals × kg × price × days", () => {
      const rows = CALCS.feed.compute({ animals: 10, kg: 5, price: 25, days: 30 });
      expect(val(rows, "Total feed cost")).toBe("₹37,500");
      expect(val(rows, "Cost per day")).toBe("₹1,250");
      expect(rows.find((r) => r.label.en === "Total feed")?.value).toBe("1,500 kg");
    });
  });

  describe("Seed rate", () => {
    it("computes total seed and cost only when priced", () => {
      const withPrice = CALCS.seed.compute({ acres: 2, rate: 20, price: 40 });
      expect(val(withPrice, "Total seed needed")).toBe("40 kg");
      expect(val(withPrice, "Total seed cost")).toBe("₹1,600");

      const noPrice = CALCS.seed.compute({ acres: 2, rate: 20, price: null });
      expect(noPrice.some((r) => r.label.en.includes("cost"))).toBe(false);
    });
  });

  describe("Fertilizer", () => {
    it("computes total, rounds bags up, and costs by bag", () => {
      const rows = CALCS.fert.compute({ acres: 2, dose: 50, bag: 50, price: 1350 });
      expect(val(rows, "Total fertilizer")).toBe("100 kg");
      expect(val(rows, "Bags needed")).toBe("2");
      expect(val(rows, "Total cost")).toBe("₹2,700");
    });

    it("rounds a partial bag up to the next whole bag", () => {
      const rows = CALCS.fert.compute({ acres: 1, dose: 60, bag: 50, price: null });
      expect(val(rows, "Bags needed")).toBe("2"); // 60kg / 50 = 1.2 → 2 bags
    });
  });

  describe("Yield", () => {
    it("computes yield per acre and total value", () => {
      const rows = CALCS.yield.compute({ prod: 40, acres: 2, price: 2300 });
      expect(val(rows, "Yield per acre")).toBe("20 qtl");
      expect(val(rows, "Total value")).toBe("₹92,000");
    });
  });
});
