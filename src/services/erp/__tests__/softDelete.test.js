import { describe, it, expect } from "vitest";
import { repo } from "../erpDb.js";
import { farmService } from "../../farm/farmService.js";
import { employeeService } from "../../employees/employeeService.js";

/* Phase-1 data-integrity fixes: soft-delete + restore/purge at the shared repo
   layer, and cascade soft-delete of a farm's children so nothing orphans. */

describe("erpDb soft-delete", () => {
  it("hides removed records from every read but keeps them restorable", async () => {
    const items = repo("inventory");
    const rec = await items.add({ name: "Test Feed", farmId: "sd-farmX", qty: 10 });

    expect(await items.getById(rec.id)).toBeTruthy();
    expect((await items.getBy("farmId", "sd-farmX")).some((r) => r.id === rec.id)).toBe(true);

    await items.remove(rec.id);

    // Gone from getById / getAll / getBy …
    expect(await items.getById(rec.id)).toBe(null);
    expect((await items.getAll()).some((r) => r.id === rec.id)).toBe(false);
    expect((await items.getBy("farmId", "sd-farmX")).some((r) => r.id === rec.id)).toBe(false);

    // … but physically retained and restorable.
    const restored = await items.restore(rec.id);
    expect(restored).toBeTruthy();
    expect(restored.deletedAt).toBeUndefined();
    expect(await items.getById(rec.id)).toBeTruthy();
  });

  it("update cannot resurrect or mutate a soft-deleted record", async () => {
    const items = repo("inventory");
    const rec = await items.add({ name: "Ghost", farmId: "sd-farmZ", qty: 1 });
    await items.remove(rec.id);
    expect(await items.update(rec.id, { qty: 99 })).toBe(null);
  });

  it("purge physically deletes a record (irreversible)", async () => {
    const assets = repo("assets");
    const rec = await assets.add({ name: "Tractor", farmId: "sd-farmY" });
    await assets.purge(rec.id);
    expect(await assets.getById(rec.id)).toBe(null);
    expect(await assets.restore(rec.id)).toBe(null); // nothing left to restore
  });
});

describe("farmService cascade delete", () => {
  it("soft-deletes a farm's children so none are left orphaned", async () => {
    const farm = await farmService.add({ name: "Cascade Farm", type: "mixed" });
    await employeeService.add({ name: "Worker A", farmId: farm.id });
    const inv = repo("inventory");
    await inv.add({ name: "Seeds", farmId: farm.id, qty: 5 });

    expect((await employeeService.getAll(farm.id)).length).toBe(1);
    expect((await inv.getBy("farmId", farm.id)).length).toBe(1);

    await farmService.remove(farm.id);

    expect(await farmService.getById(farm.id)).toBe(null);
    expect((await employeeService.getAll(farm.id)).length).toBe(0);
    expect((await inv.getBy("farmId", farm.id)).length).toBe(0);
  });
});
