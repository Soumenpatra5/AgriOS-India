import { describe, it, expect } from "vitest";
import { computeFeedCost, feedInventory, feedPurchase, FEED_TYPES, LIVESTOCK_TYPES } from "../feedService.js";
import { inventoryService } from "../../inventory/inventoryService.js";
import { orderService } from "../../crm/orderService.js";

describe("computeFeedCost — spec worked example", () => {
  it("80 animals x 1.5 kg/day x 45 days @ ₹36/kg = 5,400 kg, ₹1,94,400", () => {
    const r = computeFeedCost({ animalCount: 80, feedPerAnimalPerDay: 1.5, feedPricePerKg: 36, days: 45 });
    expect(r.totalFeedRequired).toBe(5400);
    expect(r.totalFeedCost).toBe(194400);
  });

  it("matches the original 4-field calculator's per-day and total-feed figures", () => {
    const r = computeFeedCost({ animalCount: 80, feedPerAnimalPerDay: 1.5, feedPricePerKg: 36, days: 45 });
    expect(r.totalDailyFeed).toBe(120); // 80 * 1.5
    expect(r.dailyFeedCost).toBe(4320); // 120 * 36
  });

  it("computes feed cost per animal", () => {
    const r = computeFeedCost({ animalCount: 80, feedPerAnimalPerDay: 1.5, feedPricePerKg: 36, days: 45 });
    expect(r.feedCostPerAnimal).toBe(2430); // 194400 / 80
  });

  it("computes estimated monthly feed cost independent of the entered day count", () => {
    const r = computeFeedCost({ animalCount: 10, feedPerAnimalPerDay: 2, feedPricePerKg: 20, days: 5 });
    expect(r.dailyFeedCost).toBe(400); // 10*2*20
    expect(r.estimatedMonthlyFeedCost).toBe(12000); // 400*30
  });

  it("returns all zeros for zero animals without throwing", () => {
    const r = computeFeedCost({ animalCount: 0, feedPerAnimalPerDay: 1.5, feedPricePerKg: 36, days: 45 });
    expect(r.totalFeedCost).toBe(0);
    expect(r.feedCostPerAnimal).toBe(0);
  });

  it("clamps negative/NaN inputs to 0, never produces NaN or negative totals", () => {
    const r = computeFeedCost({ animalCount: -5, feedPerAnimalPerDay: "abc", feedPricePerKg: NaN, days: undefined });
    expect(Number.isFinite(r.totalFeedCost)).toBe(true);
    expect(r.totalFeedCost).toBeGreaterThanOrEqual(0);
  });

  it("handles decimal inputs without floating-point drift", () => {
    const r = computeFeedCost({ animalCount: 3, feedPerAnimalPerDay: 0.75, feedPricePerKg: 33.5, days: 10 });
    expect(r.totalFeedRequired).toBe(22.5); // 3*0.75*10
    expect(r.totalFeedCost).toBe(753.75); // 22.5*33.5
  });

  it("handles a large flock without precision blowup", () => {
    const r = computeFeedCost({ animalCount: 50000, feedPerAnimalPerDay: 0.12, feedPricePerKg: 28, days: 60 });
    expect(r.totalFeedRequired).toBe(360000); // 50000*0.12*60
    expect(r.totalFeedCost).toBe(10080000);
  });
});

describe("FEED_TYPES / LIVESTOCK_TYPES catalogs", () => {
  it("includes every livestock type from the spec", () => {
    const ids = LIVESTOCK_TYPES.map((t) => t.id);
    for (const id of ["poultry", "dairy", "goat", "pig", "sheep", "fish", "duck", "rabbit", "other"]) {
      expect(ids).toContain(id);
    }
  });
  it("includes every feed type from the spec", () => {
    const ids = FEED_TYPES.map((t) => t.id);
    for (const id of ["starter", "grower", "finisher", "layer", "broiler", "dairy", "goat", "pig", "fish", "duck", "sheep", "rabbit", "bee", "custom"]) {
      expect(ids).toContain(id);
    }
  });
});

describe("feedInventory — reuses inventoryService, filtered to category=feed", () => {
  it("only returns items added through feedInventory (category=feed), not other categories", async () => {
    await feedInventory.add({ name: "Broiler Starter Mix", feedType: "starter", unit: "kg", qty: 500, unitPrice: 32 });
    await inventoryService.addItem({ name: "Amoxicillin", category: "medicine", unit: "vial", qty: 10 });
    const list = await feedInventory.getAll();
    expect(list.every((i) => i.category === "feed")).toBe(true);
    expect(list.find((i) => i.name === "Amoxicillin")).toBeUndefined();
  });

  it("alerts() only surfaces feed-category low-stock/expiry items", async () => {
    await feedInventory.add({ name: "LowStockLayerFeed", feedType: "layer", unit: "kg", qty: 5, minQty: 50 });
    await inventoryService.addItem({ name: "LowStockMedicine", category: "medicine", unit: "vial", qty: 1, minQty: 10 });
    const alerts = await feedInventory.alerts();
    expect(alerts.lowStock.some((i) => i.name === "LowStockLayerFeed")).toBe(true);
    expect(alerts.lowStock.some((i) => i.name === "LowStockMedicine")).toBe(false);
  });

  it("computes feed-only stock value", async () => {
    const item = await feedInventory.add({ name: "ValueCheckFeed", feedType: "grower", unit: "kg", qty: 100, unitPrice: 30 });
    const items = await feedInventory.getAll();
    const total = items.filter((i) => i.id === item.id).reduce((s, i) => s + i.qty * i.unitPrice, 0);
    expect(total).toBe(3000);
  });
});

describe("feedPurchase.record — purchase -> inventory + order integration", () => {
  it("creates a purchase order and a new feed inventory item when no existing item is given", async () => {
    const { order, item } = await feedPurchase.record({
      feedName: "NewPurchaseFeed", feedType: "dairy", quantity: 200, unitPrice: 25,
      gst: 500, transportCost: 300,
    });
    expect(order.kind).toBe("purchase");
    expect(order.totalCost).toBe(200 * 25 + 500 + 300); // goods + gst + transport
    expect(item.name).toBe("NewPurchaseFeed");
    expect(item.qty).toBe(200);
    expect(item.category).toBe("feed");
  });

  it("stocks in an existing feed item instead of creating a duplicate when feedItemId is given", async () => {
    const existing = await feedInventory.add({ name: "RestockFeed", feedType: "finisher", unit: "kg", qty: 100, unitPrice: 28 });
    const { item } = await feedPurchase.record({
      feedItemId: existing.id, feedName: "RestockFeed", feedType: "finisher", quantity: 50, unitPrice: 28,
    });
    expect(item.id).toBe(existing.id);
    expect(item.qty).toBe(150); // 100 existing + 50 purchased
  });

  it("applies discount to reduce total cost", async () => {
    const { order } = await feedPurchase.record({
      feedName: "DiscountFeed", feedType: "custom", quantity: 100, unitPrice: 20, discount: 200,
    });
    expect(order.totalCost).toBe(100 * 20 - 200);
  });

  it("shows up in orderService's purchase list", async () => {
    const { order } = await feedPurchase.record({ feedName: "ListedFeed", feedType: "custom", quantity: 10, unitPrice: 40 });
    const purchases = await orderService.getByKind("purchase");
    expect(purchases.find((o) => o.id === order.id)).toBeTruthy();
  });

  it("never produces a negative or NaN total cost from bad numeric input", async () => {
    const { order } = await feedPurchase.record({
      feedName: "BadInputFeed", feedType: "custom", quantity: "abc", unitPrice: NaN, gst: -50,
    });
    expect(Number.isFinite(order.totalCost)).toBe(true);
    expect(order.totalCost).toBeGreaterThanOrEqual(0);
  });
});
