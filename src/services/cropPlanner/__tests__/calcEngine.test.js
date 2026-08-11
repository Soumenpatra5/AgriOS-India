import { describe, it, expect } from "vitest";
import {
  safeNum, round2, seedCalc, fertilizerCalc, protectionCalc, organicCalc,
  irrigationCalc, labourCalc, machineryCalc, otherCostsCalc,
  yieldEstimate, revenueEstimate, profitEstimate, breakEven, computePlan,
} from "../calcEngine.js";

describe("safeNum", () => {
  it("passes through positive finite numbers", () => { expect(safeNum(50)).toBe(50); });
  it("clamps negatives to 0", () => { expect(safeNum(-10)).toBe(0); });
  it("clamps NaN to 0", () => { expect(safeNum(NaN)).toBe(0); });
  it("clamps Infinity to 0", () => { expect(safeNum(Infinity)).toBe(0); });
  it("clamps non-numeric strings to 0", () => { expect(safeNum("abc")).toBe(0); });
  it("parses numeric strings", () => { expect(safeNum("12.5")).toBe(12.5); });
});

describe("seedCalc — worked example from spec", () => {
  it("3 acres x 50 kg/acre @ ₹55/kg = 150 kg, ₹8,250", () => {
    const r = seedCalc({ areaAcres: 3, seedRate: 50, seedPrice: 55 });
    expect(r.baseRequiredKg).toBe(150);
    expect(r.finalRequiredKg).toBe(150);
    expect(r.seedCost).toBe(8250);
    expect(r.totalSeedCost).toBe(8250);
  });

  it("applies wastage % on top of the base requirement", () => {
    const r = seedCalc({ areaAcres: 2, seedRate: 10, seedPrice: 100, wastagePct: 10 });
    expect(r.baseRequiredKg).toBe(20);
    expect(r.wastageKg).toBe(2);
    expect(r.finalRequiredKg).toBe(22);
    expect(r.seedCost).toBe(2200);
  });

  it("adds a flat seed treatment cost on top of seed cost", () => {
    const r = seedCalc({ areaAcres: 1, seedRate: 10, seedPrice: 50, seedTreatmentCost: 100 });
    expect(r.seedCost).toBe(500);
    expect(r.totalSeedCost).toBe(600);
  });

  it("clamps wastage % to the 0-100 range", () => {
    const over = seedCalc({ areaAcres: 1, seedRate: 10, seedPrice: 1, wastagePct: 500 });
    expect(over.wastageKg).toBe(10); // 100% of 10kg base, not 500%
    const under = seedCalc({ areaAcres: 1, seedRate: 10, seedPrice: 1, wastagePct: -50 });
    expect(under.wastageKg).toBe(0);
  });

  it("returns all zeros for zero area without throwing", () => {
    const r = seedCalc({ areaAcres: 0, seedRate: 50, seedPrice: 55 });
    expect(r.finalRequiredKg).toBe(0);
    expect(r.totalSeedCost).toBe(0);
  });

  it("never produces NaN or negative totals from bad input", () => {
    const r = seedCalc({ areaAcres: -5, seedRate: "abc", seedPrice: NaN });
    expect(Number.isFinite(r.totalSeedCost)).toBe(true);
    expect(r.totalSeedCost).toBeGreaterThanOrEqual(0);
  });

  it("handles decimal areas correctly", () => {
    const r = seedCalc({ areaAcres: 2.5, seedRate: 40, seedPrice: 60 });
    expect(r.baseRequiredKg).toBe(100);
    expect(r.seedCost).toBe(6000);
  });

  it("handles a large area without precision blowup", () => {
    const r = seedCalc({ areaAcres: 10000, seedRate: 50, seedPrice: 55 });
    expect(r.finalRequiredKg).toBe(500000);
    expect(r.totalSeedCost).toBe(27500000);
  });
});

describe("repeatable-row calculators", () => {
  it("fertilizerCalc multiplies rate x area x applications x price per row and sums", () => {
    const r = fertilizerCalc([
      { name: "Urea", rate: 20, price: 6, applications: 2 },
      { name: "DAP", rate: 10, price: 30, applications: 1 },
    ], 5);
    // Urea: 5 acres * 20 * 2 apps = 200 kg * 6 = 1200
    // DAP: 5 acres * 10 * 1 app = 50 kg * 30 = 1500
    expect(r.rows[0].qty).toBe(200);
    expect(r.rows[0].cost).toBe(1200);
    expect(r.rows[1].cost).toBe(1500);
    expect(r.total).toBe(2700);
  });

  it("handles an empty row list", () => {
    expect(fertilizerCalc([], 5).total).toBe(0);
    expect(fertilizerCalc(undefined, 5).total).toBe(0);
  });

  it("protectionCalc and organicCalc use the same rate x area x applications x price shape", () => {
    const p = protectionCalc([{ product: "Neem oil", rate: 2, price: 300, applications: 1 }], 4);
    expect(p.total).toBe(2400); // 4*2*1*300
    const o = organicCalc([{ name: "Vermicompost", rate: 500, price: 5, applications: 1 }], 1);
    expect(o.total).toBe(2500); // 1*500*1*5
  });

  it("labourCalc computes labour-days then cost", () => {
    const r = labourCalc([{ type: "Weeding", workers: 4, days: 3, wage: 350 }]);
    expect(r.rows[0].labourDays).toBe(12);
    expect(r.rows[0].cost).toBe(4200);
    expect(r.total).toBe(4200);
  });

  it("machineryCalc sums machine + fuel + operator cost", () => {
    const r = machineryCalc([{ machine: "Tractor", hours: 5, ratePerHour: 400, fuelCost: 300, operatorCost: 200 }]);
    expect(r.rows[0].machineCost).toBe(2000);
    expect(r.rows[0].cost).toBe(2500);
  });

  it("otherCostsCalc sums flat amounts", () => {
    const r = otherCostsCalc([{ label: "Transport", amount: 800 }, { label: "Packaging", amount: 450 }]);
    expect(r.total).toBe(1250);
  });

  it("never produces negative cost from negative row inputs", () => {
    const r = fertilizerCalc([{ name: "X", rate: -20, price: -6, applications: -2 }], 5);
    expect(r.total).toBeGreaterThanOrEqual(0);
  });
});

describe("irrigationCalc", () => {
  it("sums water + electricity + diesel", () => {
    const r = irrigationCalc({ numIrrigations: 6, waterCostPerIrrigation: 150, electricityCost: 500, dieselCost: 200 });
    expect(r.waterTotal).toBe(900);
    expect(r.total).toBe(1600);
  });
  it("defaults to all zeros", () => {
    expect(irrigationCalc({}).total).toBe(0);
    expect(irrigationCalc().total).toBe(0);
  });
});

describe("yield / revenue / profit / ROI", () => {
  it("yieldEstimate multiplies area by per-acre yield", () => {
    expect(yieldEstimate({ areaAcres: 3, yieldPerAcre: 20 }).totalYield).toBe(60);
  });

  it("revenueEstimate multiplies yield by selling price", () => {
    expect(revenueEstimate({ totalYield: 60, sellingPrice: 2000 }).total).toBe(120000);
  });

  it("profitEstimate computes gross profit and ROI %", () => {
    const p = profitEstimate({ revenue: 120000, totalCost: 80000 });
    expect(p.gross).toBe(40000);
    expect(p.roiPct).toBe(50);
  });

  it("profitEstimate returns null ROI (not 0, not Infinity) when cost is zero", () => {
    const p = profitEstimate({ revenue: 5000, totalCost: 0 });
    expect(p.gross).toBe(5000);
    expect(p.roiPct).toBeNull();
  });

  it("profitEstimate handles a loss (negative gross) correctly", () => {
    const p = profitEstimate({ revenue: 50000, totalCost: 80000 });
    expect(p.gross).toBe(-30000);
    expect(p.roiPct).toBe(-37.5);
  });
});

describe("breakEven", () => {
  it("computes break-even yield and price when both price and yield are known", () => {
    const be = breakEven({ totalCost: 10000, sellingPrice: 20, totalYield: 600 });
    expect(be.breakEvenYield).toBe(500); // 10000/20
    expect(be.breakEvenPrice).toBeCloseTo(16.67, 1); // 10000/600
    expect(be.breakEvenRevenue).toBe(10000);
  });

  it("returns null (not Infinity/NaN) break-even yield when price is 0", () => {
    const be = breakEven({ totalCost: 10000, sellingPrice: 0, totalYield: 600 });
    expect(be.breakEvenYield).toBeNull();
  });

  it("returns null break-even price when yield is 0", () => {
    const be = breakEven({ totalCost: 10000, sellingPrice: 20, totalYield: 0 });
    expect(be.breakEvenPrice).toBeNull();
  });
});

describe("computePlan — full composition", () => {
  it("matches the seed-only worked example when every other input is empty", () => {
    const plan = computePlan({ areaAcres: 3, seed: { seedRate: 50, seedPrice: 55 } });
    expect(plan.seed.totalSeedCost).toBe(8250);
    expect(plan.totalCost).toBe(8250);
    expect(plan.costPerAcre).toBe(2750);
  });

  it("sums every cost bucket into totalCost", () => {
    const plan = computePlan({
      areaAcres: 2,
      seed: { seedRate: 50, seedPrice: 55 },
      fertilizer: [{ name: "Urea", rate: 20, price: 6, applications: 1 }],
      labour: [{ type: "Sowing", workers: 2, days: 1, wage: 400 }],
      other: [{ label: "Transport", amount: 300 }],
    });
    // seed: 2*50=100kg*55=5500 | fert: 2*20=40kg*6=240 | labour: 2*1*400=800 | other: 300
    expect(plan.totalCost).toBe(5500 + 240 + 800 + 300);
  });

  it("computes cost/acre, cost/hectare, cost/kg and ROI together", () => {
    const plan = computePlan({
      areaAcres: 1, seed: { seedRate: 10, seedPrice: 10 },
      yieldPerAcre: 20, sellingPrice: 100,
    });
    expect(plan.totalCost).toBe(100);
    expect(plan.costPerAcre).toBe(100);
    expect(plan.costPerHectare).toBeCloseTo(247.1, 0);
    expect(plan.yield.totalYield).toBe(20);
    expect(plan.revenue.total).toBe(2000);
    expect(plan.profit.gross).toBe(1900);
    expect(plan.profit.roiPct).toBe(1900);
    expect(plan.costPerKg).toBe(5);
  });

  it("handles a fully zeroed plan without throwing or producing NaN", () => {
    const plan = computePlan({});
    expect(plan.totalCost).toBe(0);
    expect(plan.costPerAcre).toBe(0);
    expect(plan.profit.roiPct).toBeNull();
    expect(plan.costPerKg).toBeNull();
    expect(Number.isFinite(plan.totalCost)).toBe(true);
  });
});
