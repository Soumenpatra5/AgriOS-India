import { describe, it, expect } from "vitest";
import {
  computeTrendPoints,
  computeBarMetrics,
  computeCategoryMeters,
} from "../AnalyticsCharts.jsx";

describe("AnalyticsCharts pure calculation helpers", () => {
  describe("computeTrendPoints", () => {
    it("returns null when data has less than 2 points", () => {
      expect(computeTrendPoints(null)).toBeNull();
      expect(computeTrendPoints([])).toBeNull();
      expect(computeTrendPoints([{ date: "01 Nov", value: 40 }])).toBeNull();
    });

    it("calculates trend points, peak, average, and paths for single series", () => {
      const data = [
        { date: "01 Nov", value: 10 },
        { date: "02 Nov", value: 20 },
        { date: "03 Nov", value: 30 },
      ];
      const res = computeTrendPoints(data, { width: 500, height: 150 });
      expect(res).not.toBeNull();
      expect(res.total).toBe(60);
      expect(res.avg).toBe(20);
      expect(res.peak).toBe(30);
      expect(res.primPts).toHaveLength(3);
      expect(res.primLine).toContain("M");
      expect(res.primLine).toContain("L");
      expect(res.primArea).toContain("Z");
      expect(res.secPts).toEqual([]);
      expect(res.secLine).toBe("");
    });

    it("calculates secondary series points when secondaryValue is provided", () => {
      const data = [
        { date: "01 Nov", value: 40, secondaryValue: 20 },
        { date: "02 Nov", value: 50, secondaryValue: 25 },
      ];
      const res = computeTrendPoints(data, { width: 500, height: 150 });
      expect(res).not.toBeNull();
      expect(res.secPts).toHaveLength(2);
      expect(res.secLine).toContain("M");
      expect(res.peak).toBe(50);
      expect(res.max).toBe(50);
      expect(res.min).toBe(0);
    });
  });

  describe("computeBarMetrics", () => {
    it("returns null for empty or null items", () => {
      expect(computeBarMetrics(null)).toBeNull();
      expect(computeBarMetrics([])).toBeNull();
    });

    it("calculates bar dimensions and positions correctly", () => {
      const items = [
        { label: "Oct", primary: 10000, secondary: 6000 },
        { label: "Nov", primary: 15000, secondary: 9000 },
      ];
      const res = computeBarMetrics(items, { width: 460, height: 160 });
      expect(res).not.toBeNull();
      expect(res.maxVal).toBe(15000);
      expect(res.bars).toHaveLength(2);
      expect(res.bars[0].label).toBe("Oct");
      expect(res.bars[0].pVal).toBe(10000);
      expect(res.bars[0].sVal).toBe(6000);
      expect(res.bars[0].barW).toBeGreaterThan(0);
      expect(res.bars[0].ph).toBeGreaterThan(0);
      expect(res.bars[0].sh).toBeGreaterThan(0);
    });
  });

  describe("computeCategoryMeters", () => {
    it("returns empty array for empty inputs", () => {
      expect(computeCategoryMeters(null)).toEqual([]);
      expect(computeCategoryMeters([])).toEqual([]);
    });

    it("computes accurate percentage distribution", () => {
      const categories = [
        { categoryId: "seeds", label: "Seeds", total: 6000 },
        { categoryId: "fert", label: "Fertilizer", total: 3000 },
        { categoryId: "fuel", label: "Fuel", total: 1000 },
      ];
      const res = computeCategoryMeters(categories);
      expect(res).toHaveLength(3);
      expect(res[0].pct).toBe(60);
      expect(res[1].pct).toBe(30);
      expect(res[2].pct).toBe(10);
    });
  });
});
