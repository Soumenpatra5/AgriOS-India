import { describe, it, expect } from "vitest";
import { feedConsumptionService } from "../feedConsumptionService.js";
import { inventoryService } from "../../inventory/inventoryService.js";
import { feedInventory } from "../feedService.js";

describe("feedConsumptionService.log", () => {
  it("computes total cost, cost/animal, and cost/kg body weight", async () => {
    const rec = await feedConsumptionService.log({
      date: "2026-01-01", batchId: "b1", animalCount: 50, avgWeight: 2, quantityUsed: 75, unitPrice: 30,
    });
    expect(rec.totalCost).toBe(2250); // 75*30
    expect(rec.feedCostPerAnimal).toBe(45); // 2250/50
    expect(rec.feedCostPerKgBodyWeight).toBe(22.5); // 2250/(2*50)
  });

  it("omits feedCostPerKgBodyWeight (null, not NaN) when avgWeight isn't given", async () => {
    const rec = await feedConsumptionService.log({ date: "2026-01-01", batchId: "b1", animalCount: 50, quantityUsed: 10, unitPrice: 20 });
    expect(rec.feedCostPerKgBodyWeight).toBeNull();
  });

  it("deducts inventory stock when feedItemId is given", async () => {
    const item = await feedInventory.add({ name: "ConsumeTestFeed", feedType: "grower", unit: "kg", qty: 500, unitPrice: 25 });
    await feedConsumptionService.log({ date: "2026-01-01", batchId: "b2", feedItemId: item.id, quantityUsed: 60, unitPrice: 25 });
    const updated = await inventoryService.getById(item.id);
    expect(updated.qty).toBe(440); // 500-60
  });

  it("does not touch inventory when no feedItemId is given", async () => {
    const rec = await feedConsumptionService.log({ date: "2026-01-01", batchId: "b3", quantityUsed: 10, unitPrice: 20 });
    expect(rec.feedItemId).toBeNull();
  });
});

describe("feedConsumptionService.remove — reverses the inventory deduction", () => {
  it("restores stock when a linked consumption log is deleted", async () => {
    const item = await feedInventory.add({ name: "ReversalTestFeed", feedType: "grower", unit: "kg", qty: 300, unitPrice: 20 });
    const rec = await feedConsumptionService.log({ date: "2026-01-01", batchId: "b4", feedItemId: item.id, quantityUsed: 40, unitPrice: 20 });
    expect((await inventoryService.getById(item.id)).qty).toBe(260);

    await feedConsumptionService.remove(rec.id);
    expect((await inventoryService.getById(item.id)).qty).toBe(300);
  });

  it("does nothing to inventory when removing a log that wasn't linked to an item", async () => {
    const rec = await feedConsumptionService.log({ date: "2026-01-01", batchId: "b5", quantityUsed: 10, unitPrice: 20 });
    await expect(feedConsumptionService.remove(rec.id)).resolves.not.toThrow();
  });
});

describe("feedConsumptionService.totalsForBatch / forBatch", () => {
  it("aggregates all log entries for a batch", async () => {
    const batchId = "batch-totals-test";
    await feedConsumptionService.log({ date: "2026-01-01", batchId, quantityUsed: 100, unitPrice: 20 });
    await feedConsumptionService.log({ date: "2026-01-02", batchId, quantityUsed: 50, unitPrice: 22 });
    const totals = await feedConsumptionService.totalsForBatch(batchId);
    expect(totals.totalQty).toBe(150);
    expect(totals.totalCost).toBe(100 * 20 + 50 * 22);
    expect(totals.entries).toHaveLength(2);
  });

  it("returns entries sorted newest-first", async () => {
    const batchId = "batch-sort-test";
    await feedConsumptionService.log({ date: "2026-01-01", batchId, quantityUsed: 10, unitPrice: 5 });
    await feedConsumptionService.log({ date: "2026-01-15", batchId, quantityUsed: 10, unitPrice: 5 });
    const list = await feedConsumptionService.forBatch(batchId);
    expect(list[0].date).toBe("2026-01-15");
  });

  it("returns zero totals for a batch with no entries, not NaN", async () => {
    const totals = await feedConsumptionService.totalsForBatch("nonexistent-batch");
    expect(totals.totalQty).toBe(0);
    expect(totals.totalCost).toBe(0);
  });
});
