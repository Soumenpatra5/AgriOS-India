import { describe, it, expect } from "vitest";
import { inventoryService } from "../inventoryService.js";

describe("inventoryService.move", () => {
  it("adds stock on 'in' and logs the applied qty", async () => {
    const item = await inventoryService.addItem({ name: "Seed", farmId: "f-m2a", qty: 5, unit: "kg" });
    const mv = await inventoryService.move(item.id, "in", 10);
    expect((await inventoryService.getById(item.id)).qty).toBe(15);
    expect(mv.qty).toBe(10);
    expect(mv.requested).toBe(10);
  });

  it("removes stock on 'out' within available", async () => {
    const item = await inventoryService.addItem({ name: "Seed", farmId: "f-m2b", qty: 20 });
    const mv = await inventoryService.move(item.id, "out", 8);
    expect((await inventoryService.getById(item.id)).qty).toBe(12);
    expect(mv.qty).toBe(8);
  });

  it("clamps an overdraw to zero and logs the APPLIED qty, not the requested one", async () => {
    const item = await inventoryService.addItem({ name: "Seed", farmId: "f-m2c", qty: 10 });
    const mv = await inventoryService.move(item.id, "out", 100);
    expect((await inventoryService.getById(item.id)).qty).toBe(0); // never negative
    expect(mv.qty).toBe(10);        // the change that actually happened
    expect(mv.requested).toBe(100); // preserved for the audit trail
  });
});
