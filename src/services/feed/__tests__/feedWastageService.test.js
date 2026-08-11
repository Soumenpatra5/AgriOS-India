import { describe, it, expect } from "vitest";
import { feedWastageService } from "../feedWastageService.js";
import { feedConsumptionService } from "../feedConsumptionService.js";
import { inventoryService } from "../../inventory/inventoryService.js";
import { feedInventory } from "../feedService.js";

describe("feedWastageService.log", () => {
  it("computes cost impact from quantity x price", async () => {
    const rec = await feedWastageService.log({ date: "2026-01-01", batchId: "w1", quantity: 20, reason: "spillage", unitPrice: 30 });
    expect(rec.costImpact).toBe(600);
  });

  it("deducts inventory stock when feedItemId is given", async () => {
    const item = await feedInventory.add({ name: "WastageTestFeed", feedType: "grower", unit: "kg", qty: 200, unitPrice: 25 });
    await feedWastageService.log({ date: "2026-01-01", feedItemId: item.id, quantity: 15, reason: "spoilage", unitPrice: 25 });
    const updated = await inventoryService.getById(item.id);
    expect(updated.qty).toBe(185);
  });

  it("never produces a negative or NaN cost impact from bad input", async () => {
    const rec = await feedWastageService.log({ date: "2026-01-01", quantity: "abc", reason: "other", unitPrice: NaN });
    expect(Number.isFinite(rec.costImpact)).toBe(true);
    expect(rec.costImpact).toBeGreaterThanOrEqual(0);
  });
});

describe("feedWastageService.remove — reverses the inventory deduction", () => {
  it("restores stock when a linked wastage log is deleted", async () => {
    const item = await feedInventory.add({ name: "WastageReversalFeed", feedType: "grower", unit: "kg", qty: 100, unitPrice: 25 });
    const rec = await feedWastageService.log({ date: "2026-01-01", feedItemId: item.id, quantity: 20, reason: "spoilage", unitPrice: 25 });
    expect((await inventoryService.getById(item.id)).qty).toBe(80);

    await feedWastageService.remove(rec.id);
    expect((await inventoryService.getById(item.id)).qty).toBe(100);
  });
});

describe("feedWastageService.summaryForBatch", () => {
  it("computes wastage % relative to total feed handled (consumed + wasted)", async () => {
    const batchId = "wastage-summary-batch";
    await feedConsumptionService.log({ date: "2026-01-01", batchId, quantityUsed: 90, unitPrice: 20 });
    await feedWastageService.log({ date: "2026-01-02", batchId, quantity: 10, reason: "spillage", unitPrice: 20 });
    const s = await feedWastageService.summaryForBatch(batchId);
    expect(s.totalWastageQty).toBe(10);
    expect(s.totalWastageCost).toBe(200);
    expect(s.wastagePct).toBe(10); // 10 / (10+90) * 100
  });

  it("returns 0% wastage (not NaN) when nothing has been handled yet", async () => {
    const s = await feedWastageService.summaryForBatch("empty-batch");
    expect(s.wastagePct).toBe(0);
  });
});

describe("feedWastageService.reasonLabel", () => {
  it("resolves known reasons and falls back to the raw id for unknown ones", () => {
    expect(feedWastageService.reasonLabel("spillage")).toBe("Spillage");
    expect(feedWastageService.reasonLabel("unknown_reason")).toBe("unknown_reason");
  });
});
