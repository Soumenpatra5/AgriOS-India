import { describe, it, expect } from "vitest";
import { feedAnalyticsService } from "../feedAnalyticsService.js";
import { feedConsumptionService } from "../feedConsumptionService.js";
import { feedBatchService } from "../feedBatchService.js";

const todayStr = () => new Date().toISOString().slice(0, 10);

describe("feedAnalyticsService.summary", () => {
  it("aggregates today/week/month cost and quantity for a farm", async () => {
    const farmId = "analytics-farm-1";
    await feedConsumptionService.log({ date: todayStr(), farmId, batchId: "b1", quantityUsed: 50, unitPrice: 20 });
    const s = await feedAnalyticsService.summary(farmId);
    expect(s.todayCost).toBe(1000);
    expect(s.todayQty).toBe(50);
    expect(s.monthCost).toBeGreaterThanOrEqual(1000);
  });

  it("returns all-zero summary for a farm with no consumption, not NaN", async () => {
    const s = await feedAnalyticsService.summary("empty-analytics-farm");
    expect(s.todayCost).toBe(0);
    expect(s.avgCostPerKg).toBe(0);
  });
});

describe("feedAnalyticsService.monthlyTrend", () => {
  it("returns the requested number of months, most recent last", async () => {
    const trend = await feedAnalyticsService.monthlyTrend("trend-farm", 3);
    expect(trend).toHaveLength(3);
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(trend[2].month).toBe(currentMonthKey);
  });
});

describe("feedAnalyticsService.batchComparison / livestockComparison", () => {
  it("ranks batches by total feed cost, highest first", async () => {
    const farmId = "compare-farm";
    const b1 = await feedBatchService.add({ enterprise: "poultry", label: "Low cost", farmId, initialCount: 10, initialWeight: 0 });
    const b2 = await feedBatchService.add({ enterprise: "poultry", label: "High cost", farmId, initialCount: 10, initialWeight: 0 });
    await feedConsumptionService.log({ date: todayStr(), farmId, batchId: b1.id, quantityUsed: 10, unitPrice: 10 });
    await feedConsumptionService.log({ date: todayStr(), farmId, batchId: b2.id, quantityUsed: 100, unitPrice: 10 });

    const rows = await feedAnalyticsService.batchComparison(farmId);
    expect(rows[0].batch.label).toBe("High cost");
  });

  it("groups batch comparison by livestock type with summed totals", async () => {
    const farmId = "livestock-compare-farm";
    const b1 = await feedBatchService.add({ enterprise: "dairy", label: "D1", farmId, initialCount: 5, initialWeight: 0 });
    const b2 = await feedBatchService.add({ enterprise: "dairy", label: "D2", farmId, initialCount: 5, initialWeight: 0 });
    await feedConsumptionService.log({ date: todayStr(), farmId, batchId: b1.id, quantityUsed: 20, unitPrice: 10 });
    await feedConsumptionService.log({ date: todayStr(), farmId, batchId: b2.id, quantityUsed: 30, unitPrice: 10 });

    const groups = await feedAnalyticsService.livestockComparison(farmId);
    const dairy = groups.find((g) => g.enterprise === "dairy");
    expect(dairy.totalFeed).toBe(50);
    expect(dairy.batches).toBe(2);
  });
});

describe("feedAnalyticsService.feedTypeBreakdown", () => {
  it("computes cost percentage share per feed type", async () => {
    const farmId = "feedtype-farm";
    await feedConsumptionService.log({ date: todayStr(), farmId, batchId: "x", feedType: "starter", quantityUsed: 10, unitPrice: 10 });
    await feedConsumptionService.log({ date: todayStr(), farmId, batchId: "x", feedType: "finisher", quantityUsed: 10, unitPrice: 30 });

    const breakdown = await feedAnalyticsService.feedTypeBreakdown(farmId);
    const starter = breakdown.find((b) => b.feedType === "starter");
    const finisher = breakdown.find((b) => b.feedType === "finisher");
    expect(starter.cost).toBe(100);
    expect(finisher.cost).toBe(300);
    expect(starter.pct).toBe(25); // 100/400
    expect(finisher.pct).toBe(75);
  });
});
