import { describe, it, expect } from "vitest";
import { feedPriceHistoryService } from "../feedPriceHistoryService.js";
import { feedPurchase } from "../feedService.js";

describe("feedPriceHistoryService.forFeed", () => {
  it("returns null when there's no purchase history for a feed", async () => {
    const r = await feedPriceHistoryService.forFeed("Never Purchased Feed XYZ");
    expect(r).toBeNull();
  });

  it("computes current/previous/lowest/highest/average from real purchase records", async () => {
    const feedName = "PriceHistoryTestFeed";
    await feedPurchase.record({ feedName, feedType: "grower", quantity: 10, unitPrice: 20, purchaseDate: "2026-01-01" });
    await feedPurchase.record({ feedName, feedType: "grower", quantity: 10, unitPrice: 25, purchaseDate: "2026-02-01" });
    await feedPurchase.record({ feedName, feedType: "grower", quantity: 10, unitPrice: 22, purchaseDate: "2026-03-01" });

    const r = await feedPriceHistoryService.forFeed(feedName);
    expect(r.current).toBe(22);
    expect(r.previous).toBe(25);
    expect(r.lowest).toBe(20);
    expect(r.highest).toBe(25);
    expect(r.average).toBeCloseTo(22.33, 1);
    expect(r.history).toHaveLength(3);
  });

  it("computes changePct between the last two purchases", async () => {
    const feedName = "PriceChangeTestFeed";
    await feedPurchase.record({ feedName, feedType: "grower", quantity: 10, unitPrice: 100, purchaseDate: "2026-01-01" });
    await feedPurchase.record({ feedName, feedType: "grower", quantity: 10, unitPrice: 110, purchaseDate: "2026-02-01" });

    const r = await feedPriceHistoryService.forFeed(feedName);
    expect(r.changePct).toBe(10);
  });

  it("returns null changePct (not NaN) for a feed with only one purchase", async () => {
    const feedName = "SinglePurchaseFeed";
    await feedPurchase.record({ feedName, feedType: "grower", quantity: 10, unitPrice: 15 });
    const r = await feedPriceHistoryService.forFeed(feedName);
    expect(r.changePct).toBeNull();
  });
});

describe("feedPriceHistoryService.supplierComparison", () => {
  it("ranks suppliers by average price, cheapest first", async () => {
    const feedName = "SupplierCompareFeed";
    await feedPurchase.record({ feedName, feedType: "grower", quantity: 10, unitPrice: 30, supplierName: "Expensive Co" });
    await feedPurchase.record({ feedName, feedType: "grower", quantity: 10, unitPrice: 20, supplierName: "Cheap Co" });

    const cmp = await feedPriceHistoryService.supplierComparison(feedName);
    expect(cmp[0].supplier).toBe("Cheap Co");
    expect(cmp[1].supplier).toBe("Expensive Co");
  });
});
