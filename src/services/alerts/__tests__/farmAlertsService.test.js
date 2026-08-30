import { describe, it, expect, beforeEach, vi } from "vitest";
import { farmAlertsService } from "../farmAlertsService.js";
import { inventoryService } from "../../inventory/inventoryService.js";
import { notificationService } from "../../notifications/notificationService.js";

/* cropCalendar reads localStorage, absent in the node test env. */
class MemLS { constructor(){this.m=new Map();} getItem(k){return this.m.has(k)?this.m.get(k):null;} setItem(k,v){this.m.set(k,String(v));} removeItem(k){this.m.delete(k);} clear(){this.m.clear();} }
beforeEach(() => { globalThis.localStorage = new MemLS(); });

const SEV_WEIGHT = { high: 3, medium: 2, low: 1 };

describe("farmAlertsService.getAll", () => {
  it("surfaces an expired inventory item as a high-severity alert linking to inventory", async () => {
    const farmId = "alerts-farm-expired";
    await inventoryService.addItem({ name: "OldSeedBag", category: "seeds", qty: 5, unit: "kg", farmId, expiryDate: "2000-01-01" });
    const alerts = await farmAlertsService.getAll(farmId);
    const hit = alerts.find((a) => a.source === "inventory" && a.message.includes("OldSeedBag"));
    expect(hit).toBeTruthy();
    expect(hit.severity).toBe("high");
    expect(hit.kind).toBe("erpInventory");
  });

  it("surfaces a low-stock item as a medium-severity alert", async () => {
    const farmId = "alerts-farm-lowstock";
    await inventoryService.addItem({ name: "LowFertBag", category: "fertilizer", qty: 2, unit: "kg", minQty: 20, farmId });
    const alerts = await farmAlertsService.getAll(farmId);
    const hit = alerts.find((a) => a.source === "inventory" && a.message.includes("LowFertBag"));
    expect(hit).toBeTruthy();
    expect(hit.severity).toBe("medium");
  });

  it("returns results sorted by severity, most urgent first", async () => {
    const farmId = "alerts-farm-sort";
    await inventoryService.addItem({ name: "ExpiredThing", category: "feed", qty: 1, unit: "kg", farmId, expiryDate: "2000-01-01" });
    await inventoryService.addItem({ name: "LowThing", category: "feed", qty: 1, unit: "kg", minQty: 99, farmId });
    const alerts = await farmAlertsService.getAll(farmId);
    for (let i = 1; i < alerts.length; i++) {
      expect(SEV_WEIGHT[alerts[i - 1].severity]).toBeGreaterThanOrEqual(SEV_WEIGHT[alerts[i].severity]);
    }
  });

  it("every alert carries a stable id, title and message", async () => {
    const farmId = "alerts-farm-shape";
    await inventoryService.addItem({ name: "ShapeItem", category: "feed", qty: 0, unit: "kg", minQty: 5, farmId });
    const alerts = await farmAlertsService.getAll(farmId);
    for (const a of alerts) {
      expect(typeof a.id).toBe("string");
      expect(a.title.length).toBeGreaterThan(0);
      expect(typeof a.message).toBe("string");
    }
    const ids = alerts.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not throw for a farm with no data", async () => {
    const alerts = await farmAlertsService.getAll("totally-empty-farm-xyz");
    expect(Array.isArray(alerts)).toBe(true);
  });
});

describe("farmAlertsService.notifyHighPriority", () => {
  it("does nothing when notifications are disabled", async () => {
    vi.spyOn(notificationService, "isEnabled").mockReturnValue(false);
    const res = await farmAlertsService.notifyHighPriority("notify-farm-disabled");
    expect(res).toEqual({ dispatched: false, reason: "disabled" });
    vi.restoreAllMocks();
  });

  it("dispatches once for a fresh urgent alert, then dedupes on the next open", async () => {
    const farmId = "notify-farm-fresh";
    await inventoryService.addItem({ name: "NotifyExpired", category: "feed", qty: 1, unit: "kg", farmId, expiryDate: "2000-01-01" });
    vi.spyOn(notificationService, "isEnabled").mockReturnValue(true);
    const dispatch = vi.spyOn(notificationService, "dispatch").mockImplementation(() => {});

    const first = await farmAlertsService.notifyHighPriority(farmId);
    expect(first.dispatched).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);

    const second = await farmAlertsService.notifyHighPriority(farmId);
    expect(second).toEqual({ dispatched: false, reason: "already_notified" });
    expect(dispatch).toHaveBeenCalledTimes(1); // not called again
    vi.restoreAllMocks();
  });

  it("reports 'none' when there are no urgent alerts", async () => {
    vi.spyOn(notificationService, "isEnabled").mockReturnValue(true);
    vi.spyOn(notificationService, "dispatch").mockImplementation(() => {});
    const res = await farmAlertsService.notifyHighPriority("notify-farm-clean-xyz");
    expect(res.reason).toBe("none");
    vi.restoreAllMocks();
  });
});

describe("farmAlertsService.summary", () => {
  it("counts by severity and totals consistently", async () => {
    const farmId = "alerts-farm-summary";
    await inventoryService.addItem({ name: "SumExpired", category: "feed", qty: 1, unit: "kg", farmId, expiryDate: "2000-01-01" });
    await inventoryService.addItem({ name: "SumLow", category: "feed", qty: 1, unit: "kg", minQty: 50, farmId });
    const s = await farmAlertsService.summary(farmId);
    expect(s.total).toBe(s.high + s.medium + s.low);
    expect(s.high).toBeGreaterThanOrEqual(1);
    expect(s.medium).toBeGreaterThanOrEqual(1);
  });
});
