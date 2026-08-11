import { describe, it, expect } from "vitest";
import { toAcres, fromAcres, acresToHectares, AREA_UNITS, AREA_UNIT_OPTIONS } from "../units.js";

describe("toAcres", () => {
  it("acre passes through unchanged", () => { expect(toAcres(5, "acre")).toBe(5); });
  it("converts hectares to acres (1 hectare = 2.47105 acres)", () => { expect(toAcres(1, "hectare")).toBeCloseTo(2.47105, 4); });
  it("converts decimal to acres (100 decimal = 1 acre)", () => { expect(toAcres(100, "decimal")).toBeCloseTo(1, 6); });
  it("converts sqft to acres (43560 sqft = 1 acre)", () => { expect(toAcres(43560, "sqft")).toBeCloseTo(1, 6); });
  it("converts sqm to acres", () => { expect(toAcres(4046.86, "sqm")).toBeCloseTo(1, 3); });
  it("returns 0 for an unknown unit", () => { expect(toAcres(5, "furlong")).toBe(0); });
  it("returns 0 for negative input", () => { expect(toAcres(-5, "acre")).toBe(0); });
  it("returns 0 for NaN input", () => { expect(toAcres(NaN, "acre")).toBe(0); });
});

describe("fromAcres", () => {
  it("round-trips through hectare", () => {
    const hect = fromAcres(2.47105, "hectare");
    expect(hect).toBeCloseTo(1, 3);
  });
  it("round-trips acre -> unit -> acre for every unit", () => {
    for (const unit of AREA_UNIT_OPTIONS) {
      const asUnit = fromAcres(10, unit);
      const back = toAcres(asUnit, unit);
      expect(back).toBeCloseTo(10, 3);
    }
  });
});

describe("acresToHectares", () => {
  it("converts 2.47105 acres to ~1 hectare", () => {
    expect(acresToHectares(2.47105)).toBeCloseTo(1, 3);
  });
  it("returns 0 for zero or negative acres", () => {
    expect(acresToHectares(0)).toBe(0);
    expect(acresToHectares(-3)).toBe(0);
  });
});

describe("AREA_UNITS", () => {
  it("flags bigha as an approximate/regional unit", () => {
    expect(AREA_UNITS.bigha.approx).toBe(true);
  });
  it("does not flag acre/hectare/decimal/sqm/sqft as approximate", () => {
    for (const key of ["acre", "hectare", "decimal", "sqm", "sqft"]) {
      expect(AREA_UNITS[key].approx).toBe(false);
    }
  });
});
