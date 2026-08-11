import { describe, it, expect } from "vitest";
import { cropPlanService } from "../cropPlanService.js";
import { inventoryService } from "../../inventory/inventoryService.js";
import { ledgerService } from "../../ledger/ledgerService.js";
import { orderService } from "../../crm/orderService.js";

function basicInput(overrides = {}) {
  return {
    cropName: "Wheat", variety: "HD-2967", areaAcres: 3,
    seed: { seedRate: 50, seedPrice: 55 },
    fertilizer: [{ name: "Urea", rate: 20, price: 6, applications: 1 }],
    labour: [{ type: "Sowing", workers: 2, days: 1, wage: 400 }],
    yieldPerAcre: 20, sellingPrice: 2000,
    ...overrides,
  };
}

describe("cropPlanService — CRUD", () => {
  it("saves a plan with a computed snapshot and draft status", async () => {
    const plan = await cropPlanService.add(basicInput());
    expect(plan.id).toBeTruthy();
    expect(plan.status).toBe("draft");
    expect(plan.computed.seed.totalSeedCost).toBe(8250); // 3*50=150kg*55
    expect(plan.computed.totalCost).toBeGreaterThan(0);
  });

  it("lists saved plans newest first", async () => {
    const a = await cropPlanService.add(basicInput({ cropName: "Older" }));
    await new Promise((r) => setTimeout(r, 5));
    const b = await cropPlanService.add(basicInput({ cropName: "Newer" }));
    const all = await cropPlanService.getAll();
    const idxA = all.findIndex((p) => p.id === a.id);
    const idxB = all.findIndex((p) => p.id === b.id);
    expect(idxB).toBeLessThan(idxA);
  });

  it("updates a plan and recomputes its snapshot", async () => {
    const plan = await cropPlanService.add(basicInput());
    const updated = await cropPlanService.update(plan.id, basicInput({ areaAcres: 6 }));
    expect(updated.computed.seed.totalSeedCost).toBe(16500); // double the area
  });

  it("changes status", async () => {
    const plan = await cropPlanService.add(basicInput());
    await cropPlanService.setStatus(plan.id, "approved");
    const reloaded = await cropPlanService.getById(plan.id);
    expect(reloaded.status).toBe("approved");
  });

  it("removes a plan", async () => {
    const plan = await cropPlanService.add(basicInput());
    await cropPlanService.remove(plan.id);
    const reloaded = await cropPlanService.getById(plan.id);
    expect(reloaded).toBeNull();
  });
});

describe("cropPlanService.reconcileInventory", () => {
  it("reports full shortfall when no matching inventory item exists", async () => {
    const plan = await cropPlanService.add(basicInput({ cropName: "Unmatched Crop XYZ" }));
    const lines = await cropPlanService.reconcileInventory(plan);
    const seedLine = lines.find((l) => l.label === "Seed");
    expect(seedLine.available).toBeNull();
    expect(seedLine.shortfall).toBe(seedLine.required);
  });

  it("reduces shortfall when matching stock is available", async () => {
    await inventoryService.addItem({ name: "Urea", category: "fertilizer", qty: 1000, unit: "kg" });
    const plan = await cropPlanService.add(basicInput());
    const lines = await cropPlanService.reconcileInventory(plan);
    const ureaLine = lines.find((l) => l.label === "Urea");
    expect(ureaLine.available).toBe(1000);
    expect(ureaLine.shortfall).toBe(0); // 3 acres * 20 kg = 60kg needed, 1000 in stock
  });

  it("reports partial shortfall when stock is insufficient", async () => {
    await inventoryService.addItem({ name: "LowStockUrea", category: "fertilizer", qty: 10, unit: "kg" });
    const plan = await cropPlanService.add(basicInput({
      fertilizer: [{ name: "LowStockUrea", rate: 20, price: 6, applications: 1 }],
    }));
    const lines = await cropPlanService.reconcileInventory(plan);
    const line = lines.find((l) => l.label === "LowStockUrea");
    expect(line.available).toBe(10);
    expect(line.shortfall).toBe(50); // 60 required - 10 available
    expect(line.purchaseCost).toBe(300); // 50 * 6
  });
});

describe("cropPlanService.postBucketToLedger", () => {
  it("posts the seed cost as a ledger expense tagged to the crop enterprise", async () => {
    const plan = await cropPlanService.add(basicInput());
    const before = await ledgerService.all();
    const res = await cropPlanService.postBucketToLedger(plan, "seed");
    expect(res.posted).toBe(true);
    const after = await ledgerService.all();
    expect(after.length).toBe(before.length + 1);
    const entry = after.find((t) => t.id === res.txnId);
    expect(entry.categoryId).toBe("seeds");
    expect(entry.amount).toBe(8250);
    expect(entry.sourceCropPlanId).toBe(plan.id);
  });

  it("does not double-post the same bucket", async () => {
    const plan = await cropPlanService.add(basicInput());
    await cropPlanService.postBucketToLedger(plan, "seed");
    const reloaded = await cropPlanService.getById(plan.id);
    const res2 = await cropPlanService.postBucketToLedger(reloaded, "seed");
    expect(res2.alreadyPosted).toBe(true);
  });

  it("skips posting a zero-amount bucket", async () => {
    const plan = await cropPlanService.add(basicInput({ machinery: [] }));
    const res = await cropPlanService.postBucketToLedger(plan, "machinery");
    expect(res.skipped).toBe(true);
  });
});

describe("cropPlanService.createPurchaseRequest", () => {
  it("creates an open CRM purchase order without a pre-assigned supplier", async () => {
    const order = await cropPlanService.createPurchaseRequest({ item: "Urea", qty: 50, unit: "kg", rate: 6 });
    expect(order.kind).toBe("purchase");
    expect(order.status).toBe("open");
    expect(order.contactId).toBeNull();
    expect(order.amount).toBe(300);
    const all = await orderService.getByKind("purchase");
    expect(all.find((o) => o.id === order.id)).toBeTruthy();
  });
});
