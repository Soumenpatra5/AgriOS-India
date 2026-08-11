import { describe, it, expect } from "vitest";
import { feedBatchService } from "../feedBatchService.js";
import { feedConsumptionService } from "../feedConsumptionService.js";
import { productionService } from "../../livestock/livestockService.js";

describe("feedBatchService — CRUD", () => {
  it("creates a batch with active status by default", async () => {
    const b = await feedBatchService.add({ enterprise: "poultry", label: "Batch A", initialCount: 100, initialWeight: 0 });
    expect(b.status).toBe("active");
  });

  it("closes a batch with an end date and final counts", async () => {
    const b = await feedBatchService.add({ enterprise: "poultry", label: "Batch B", initialCount: 100, initialWeight: 0 });
    const closed = await feedBatchService.close(b.id, { endDate: "2026-01-01", currentCount: 95, currentWeight: 2 });
    expect(closed.status).toBe("closed");
    expect(closed.currentCount).toBe(95);
  });

  it("lists batches for a farm", async () => {
    await feedBatchService.add({ enterprise: "dairy", label: "Farm-scoped batch", farmId: "farm1", initialCount: 5, initialWeight: 300 });
    const list = await feedBatchService.getAll("farm1");
    expect(list.every((b) => b.farmId === "farm1")).toBe(true);
  });
});

describe("feedBatchService.computeFCR — spec worked example", () => {
  it("5,400 kg feed / 2,000 kg weight gain = FCR 2.70", () => {
    // 1000 birds, 0kg initial (day-old), 1000 birds now at 2kg avg -> 2000kg biomass gain
    const batch = { initialCount: 1000, initialWeight: 0, currentCount: 1000, currentWeight: 2 };
    const fcr = feedBatchService.computeFCR(batch, 5400);
    expect(fcr.weightGain).toBe(2000);
    expect(fcr.fcr).toBe(2.7);
  });

  it("returns null FCR (not Infinity/NaN) when weight gain is zero or negative", () => {
    const batch = { initialCount: 100, initialWeight: 2, currentCount: 100, currentWeight: 2 };
    const fcr = feedBatchService.computeFCR(batch, 500);
    expect(fcr.weightGain).toBe(0);
    expect(fcr.fcr).toBeNull();
  });

  it("does not hardcode any default target FCR — no target means no performance status", () => {
    const batch = { initialCount: 100, initialWeight: 0, currentCount: 100, currentWeight: 2 };
    const fcr = feedBatchService.computeFCR(batch, 200);
    expect(fcr.targetFCR).toBeNull();
    expect(fcr.performanceStatus).toBe("no_target");
  });

  it("compares actual FCR to a farmer-configured target", () => {
    const batch = { initialCount: 100, initialWeight: 0, currentCount: 100, currentWeight: 2, targetFCR: 1.5 };
    const fcr = feedBatchService.computeFCR(batch, 200); // FCR = 200/200 = 1.0, better than target 1.5
    expect(fcr.fcr).toBe(1);
    expect(fcr.fcrDiff).toBe(-0.5);
    expect(fcr.performanceStatus).toBe("on_or_better_than_target");
  });

  it("flags worse-than-target performance", () => {
    const batch = { initialCount: 100, initialWeight: 0, currentCount: 100, currentWeight: 1, targetFCR: 1.0 };
    const fcr = feedBatchService.computeFCR(batch, 200); // FCR = 200/100 = 2.0, worse than target 1.0
    expect(fcr.performanceStatus).toBe("worse_than_target");
  });

  it("never throws or produces NaN from missing/invalid batch fields", () => {
    const fcr = feedBatchService.computeFCR({}, "abc");
    expect(Number.isFinite(fcr.weightGain)).toBe(true);
    expect(fcr.fcr === null || Number.isFinite(fcr.fcr)).toBe(true);
  });
});

describe("feedBatchService.summary — full batch rollup", () => {
  it("combines consumption totals with FCR into one summary", async () => {
    const b = await feedBatchService.add({
      enterprise: "poultry", label: "Summary Batch", farmId: "farmS", initialCount: 100, initialWeight: 0,
      currentCount: 100, currentWeight: 2, startDate: "2026-01-01", targetFCR: 2,
    });
    await feedConsumptionService.log({ date: "2026-01-05", farmId: "farmS", batchId: b.id, quantityUsed: 100, unitPrice: 30 });
    await feedConsumptionService.log({ date: "2026-01-10", farmId: "farmS", batchId: b.id, quantityUsed: 100, unitPrice: 30 });

    const s = await feedBatchService.summary(b.id);
    expect(s.totalFeed).toBe(200);
    expect(s.totalFeedCost).toBe(6000);
    expect(s.weightGain).toBe(200); // 100*2 - 100*0
    expect(s.fcr).toBe(1); // 200/200
    expect(s.feedCostPerKgGain).toBe(30); // 6000/200
  });

  it("returns null for a batch that doesn't exist", async () => {
    const s = await feedBatchService.summary("nonexistent-id");
    expect(s).toBeNull();
  });
});

describe("feedBatchService.speciesInsights", () => {
  it("returns null when the batch isn't linked to an animal/flock/pond", async () => {
    const b = await feedBatchService.add({ enterprise: "poultry", label: "Unlinked", initialCount: 10, initialWeight: 0 });
    const insights = await feedBatchService.speciesInsights(b.id);
    expect(insights).toBeNull();
  });

  it("computes cost per litre milk for a dairy batch, using productionService's animalId field", async () => {
    const b = await feedBatchService.add({ enterprise: "dairy", label: "Dairy Insight", animalId: "cow-1", initialCount: 1, initialWeight: 0, startDate: "2026-01-01" });
    await feedConsumptionService.log({ date: "2026-01-05", batchId: b.id, quantityUsed: 20, unitPrice: 10 });
    await productionService.add({ enterprise: "dairy", animalId: "cow-1", date: "2026-01-05", amLitres: 5, pmLitres: 4 });
    await productionService.add({ enterprise: "dairy", animalId: "cow-1", date: "2026-01-06", amLitres: 6, pmLitres: 5 });

    const insights = await feedBatchService.speciesInsights(b.id);
    expect(insights.kind).toBe("dairy");
    expect(insights.milkYield).toBe(20); // 5+4+6+5
    expect(insights.costPerLitre).toBe(10); // 200 total feed cost / 20 litres
  });

  it("computes cost per egg for a poultry batch, using productionService's flockId field (not animalId)", async () => {
    const b = await feedBatchService.add({ enterprise: "poultry", label: "Poultry Insight", animalId: "flock-1", initialCount: 100, initialWeight: 0, startDate: "2026-01-01" });
    await feedConsumptionService.log({ date: "2026-01-05", batchId: b.id, quantityUsed: 50, unitPrice: 20 });
    await productionService.add({ enterprise: "poultry", flockId: "flock-1", date: "2026-01-05", eggs: 40, mortality: 1 });
    await productionService.add({ enterprise: "poultry", flockId: "flock-1", date: "2026-01-06", eggs: 60, mortality: 0 });

    const insights = await feedBatchService.speciesInsights(b.id);
    expect(insights.kind).toBe("poultry");
    expect(insights.eggs).toBe(100);
    expect(insights.mortality).toBe(1);
    expect(insights.costPerEgg).toBe(10); // 1000 total feed cost / 100 eggs
  });

  it("computes biomass, mortality and latest water quality for a fish batch, using productionService's pondId field", async () => {
    const b = await feedBatchService.add({
      enterprise: "fish", label: "Fish Insight", animalId: "pond-1", initialCount: 1000, initialWeight: 0,
      currentCount: 950, currentWeight: 0.5, startDate: "2026-01-01",
    });
    await productionService.add({ enterprise: "fish", pondId: "pond-1", date: "2026-01-05", feedKg: 10, waterQuality: "good" });
    await productionService.add({ enterprise: "fish", pondId: "pond-1", date: "2026-01-06", feedKg: 12, waterQuality: "poor" });

    const insights = await feedBatchService.speciesInsights(b.id);
    expect(insights.kind).toBe("fish");
    expect(insights.biomass).toBe(475); // 0.5 * 950
    expect(insights.mortality).toBe(50); // 1000 - 950
    expect(insights.waterQuality).toBe("poor"); // most recent record
  });

  it("excludes production records outside the batch's date range", async () => {
    const b = await feedBatchService.add({ enterprise: "dairy", label: "Date Range Test", animalId: "cow-2", initialCount: 1, initialWeight: 0, startDate: "2026-02-01", endDate: "2026-02-28" });
    await productionService.add({ enterprise: "dairy", animalId: "cow-2", date: "2026-01-15", amLitres: 100, pmLitres: 0 }); // before range
    await productionService.add({ enterprise: "dairy", animalId: "cow-2", date: "2026-02-10", amLitres: 5, pmLitres: 5 }); // in range

    const insights = await feedBatchService.speciesInsights(b.id);
    expect(insights.milkYield).toBe(10);
  });
});
