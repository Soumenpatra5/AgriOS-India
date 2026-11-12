import { describe, it, expect } from "vitest";
import {
  calculateNDVIIndex,
  computePrecipitationRisk,
  computeFieldGeometry,
} from "../SatelliteFieldRadar.jsx";

describe("SatelliteFieldRadar pure calculation helpers", () => {
  describe("calculateNDVIIndex", () => {
    it("returns fallow/low score when crop is empty or null", () => {
      const res = calculateNDVIIndex("", "Alluvial");
      expect(res.level).toBe("low");
      expect(res.score).toBeLessThan(0.3);
    });

    it("calculates high vegetation score for healthy crops like paddy and wheat", () => {
      const paddyRes = calculateNDVIIndex("Paddy", "Alluvial Loam");
      expect(paddyRes.level).toBe("high");
      expect(paddyRes.score).toBeGreaterThanOrEqual(0.75);

      const wheatRes = calculateNDVIIndex("Wheat", "Clay Loam");
      expect(wheatRes.score).toBeGreaterThanOrEqual(0.75);
    });

    it("adjusts score slightly based on soil type", () => {
      const richSoil = calculateNDVIIndex("Mustard", "Alluvial");
      const sandySoil = calculateNDVIIndex("Mustard", "Sandy");
      expect(richSoil.score).toBeGreaterThan(sandySoil.score);
    });
  });

  describe("computePrecipitationRisk", () => {
    it("identifies optimal window under dry and calm conditions", () => {
      const res = computePrecipitationRisk(10, 8);
      expect(res.status).toBe("ideal");
      expect(res.icon).toBe("CheckCircle2");
    });

    it("flags caution when rain or wind are moderate", () => {
      const res = computePrecipitationRisk(35, 12);
      expect(res.status).toBe("moderate");
      expect(res.icon).toBe("AlertCircle");
    });

    it("flags poor/hazardous condition when rain or wind are high", () => {
      const resRain = computePrecipitationRisk(70, 10);
      expect(resRain.status).toBe("poor");

      const resWind = computePrecipitationRisk(15, 30);
      expect(resWind.status).toBe("poor");
    });
  });

  describe("computeFieldGeometry", () => {
    it("returns empty array for empty parcels", () => {
      expect(computeFieldGeometry(null)).toEqual([]);
      expect(computeFieldGeometry([])).toEqual([]);
    });

    it("generates polygon path and center coordinates for parcel plots", () => {
      const parcels = [
        { id: "p1", name: "Plot A", areaAcres: 2.5, currentCrop: "Paddy" },
        { id: "p2", name: "Plot B", areaAcres: 1.8, currentCrop: "Mustard" },
      ];
      const res = computeFieldGeometry(parcels, 500, 300);
      expect(res).toHaveLength(2);
      expect(res[0].path).toContain("M");
      expect(res[0].path).toContain("Z");
      expect(res[0].cx).toBeGreaterThan(0);
      expect(res[0].cy).toBeGreaterThan(0);
    });
  });
});
