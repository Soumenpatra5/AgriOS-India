import { describe, it, expect } from "vitest";
import { feedAlertsService } from "../feedAlertsService.js";
import { feedInventory } from "../feedService.js";
import { feedBatchService } from "../feedBatchService.js";
import { feedConsumptionService } from "../feedConsumptionService.js";
import { feedWastageService } from "../feedWastageService.js";

const todayStr = () => new Date().toISOString().slice(0, 10);

describe("feedAlertsService.getAll", () => {
  it("surfaces a low-stock alert from feed inventory", async () => {
    const farmId = "alerts-lowstock-farm";
    await feedInventory.add({ name: "LowStockAlertFeed", feedType: "grower", unit: "kg", qty: 5, minQty: 50, farmId });
    const alerts = await feedAlertsService.getAll(farmId);
    expect(alerts.some((a) => a.type === "low_stock" && a.message.includes("LowStockAlertFeed"))).toBe(true);
  });

  it("surfaces an expired-feed alert", async () => {
    const farmId = "alerts-expired-farm";
    await feedInventory.add({ name: "ExpiredAlertFeed", feedType: "grower", unit: "kg", qty: 10, expiryDate: "2000-01-01", farmId });
    const alerts = await feedAlertsService.getAll(farmId);
    expect(alerts.some((a) => a.type === "expired")).toBe(true);
  });

  it("surfaces a high-wastage alert for a batch above the threshold", async () => {
    const farmId = "alerts-wastage-farm";
    const b = await feedBatchService.add({ enterprise: "poultry", label: "Wasteful Batch", farmId, initialCount: 10, initialWeight: 0 });
    await feedConsumptionService.log({ date: todayStr(), farmId, batchId: b.id, quantityUsed: 90, unitPrice: 10 });
    await feedWastageService.log({ date: todayStr(), farmId, batchId: b.id, quantity: 20, reason: "spillage", unitPrice: 10 }); // 20/(20+90) = 18%
    const alerts = await feedAlertsService.getAll(farmId);
    expect(alerts.some((a) => a.type === "wastage" && a.batchId === b.id)).toBe(true);
  });

  it("does not throw and returns an array for a farm with no data", async () => {
    const alerts = await feedAlertsService.getAll("empty-alerts-farm");
    expect(Array.isArray(alerts)).toBe(true);
  });
});
