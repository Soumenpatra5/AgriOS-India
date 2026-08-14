import { describe, it, expect, beforeEach, vi } from "vitest";

const held = vi.hoisted(() => {
  const stores = {};
  const make = () => {
    let rows = [];
    let seq = 0;
    return {
      add: async (data) => { const r = { id: `a${++seq}`, ...data }; rows.push(r); return r; },
      getAll: async () => rows.slice(),
      getBy: async (f, v) => rows.filter((r) => r[f] === v),
      getById: async (id) => rows.find((r) => r.id === id) || null,
      update: async (id, patch) => { const r = rows.find((x) => x.id === id); if (!r) return null; Object.assign(r, patch); return r; },
      remove: async (id) => { const i = rows.findIndex((x) => x.id === id); if (i < 0) return null; return rows.splice(i, 1)[0]; },
      reset: () => { rows = []; seq = 0; },
    };
  };
  const repo = (name) => (stores[name] ||= make());
  const resetAll = () => Object.values(stores).forEach((s) => s.reset());
  return { repo, resetAll };
});

vi.mock("../../erp/erpDb.js", () => ({ repo: held.repo, uid: () => "uid" }));

const { assetService, ASSET_CATEGORIES } = await import("../assetService.js");

const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

describe("assetService — CRUD + scoping", () => {
  beforeEach(() => { held.resetAll(); });

  it("scopes getAll to a farm, or returns everything", async () => {
    await assetService.add({ farmId: "fA", name: "X" });
    await assetService.add({ farmId: "fB", name: "Y" });
    expect(await assetService.getAll("fA")).toHaveLength(1);
    expect(await assetService.getAll()).toHaveLength(2);
  });

  it("supports get-by-id / update / remove", async () => {
    const a = await assetService.add({ name: "Pump", purchasePrice: 5000 });
    expect((await assetService.getById(a.id)).name).toBe("Pump");
    expect((await assetService.update(a.id, { condition: "worn" })).condition).toBe("worn");
    await assetService.remove(a.id);
    expect(await assetService.getById(a.id)).toBeNull();
  });
});

describe("assetService — employee assignment (WF-6)", () => {
  beforeEach(() => { held.resetAll(); });

  it("assignToEmployee applies sensible defaults", async () => {
    const asset = await assetService.assignToEmployee({ employeeId: "e3", name: "Hoe" });
    expect(asset).toMatchObject({ category: "other", assignStatus: "assigned", condition: "good" });
    expect(asset.assignedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returnFromEmployee marks the asset returned with a date", async () => {
    const asset = await assetService.assignToEmployee({ employeeId: "e3", name: "Hoe" });
    const ret = await assetService.returnFromEmployee(asset.id, "2026-06-01");
    expect(ret.assignStatus).toBe("returned");
    expect(ret.returnDate).toBe("2026-06-01");
  });

  it("forEmployee returns an employee's assets, newest assignment first", async () => {
    await assetService.assignToEmployee({ employeeId: "e1", name: "Drill", assignedDate: "2026-03-01" });
    await assetService.assignToEmployee({ employeeId: "e1", name: "Saw", assignedDate: "2026-05-01" });
    await assetService.assignToEmployee({ employeeId: "e2", name: "Ladder" });
    expect((await assetService.forEmployee("e1")).map((a) => a.name)).toEqual(["Saw", "Drill"]);
  });
});

describe("assetService — maintenance", () => {
  beforeEach(() => { held.resetAll(); });

  it("logMaintenance coerces cost to a number (defaulting to 0)", async () => {
    const a = await assetService.add({ name: "Tractor" });
    await assetService.logMaintenance(a.id, { date: "2026-02-01", kind: "repair", cost: "1500" });
    await assetService.logMaintenance(a.id, { date: "2026-01-01", kind: "service" }); // no cost
    const logs = await assetService.getMaintenance(a.id);
    expect(logs.map((l) => l.date)).toEqual(["2026-02-01", "2026-01-01"]); // newest first
    expect(logs[0].cost).toBe(1500);
    expect(logs[1].cost).toBe(0);
  });

  it("dueSoon returns assets whose next maintenance falls inside the window", async () => {
    const a = await assetService.add({ farmId: "f1", name: "Tractor" });
    await assetService.logMaintenance(a.id, { date: "2026-01-01", kind: "service", nextDue: plusDays(10) });
    const b = await assetService.add({ farmId: "f1", name: "Pump" });
    await assetService.logMaintenance(b.id, { date: "2026-01-01", kind: "service", nextDue: plusDays(40) });
    const c = await assetService.add({ farmId: "f1", name: "Gen" });
    await assetService.logMaintenance(c.id, { date: "2026-01-01", kind: "service", nextDue: plusDays(-5) });
    await assetService.add({ farmId: "f1", name: "Tool" }); // no maintenance at all

    const due = await assetService.dueSoon("f1", 30);
    expect(due).toHaveLength(1);
    expect(due[0].asset.name).toBe("Tractor");
    expect(due[0].nextDue).toBe(plusDays(10));
  });
});

describe("assetService — totals + labels", () => {
  beforeEach(() => { held.resetAll(); });

  it("totalValue sums purchase prices (coercing, treating missing as 0)", async () => {
    await assetService.add({ farmId: "f2", purchasePrice: 50000 });
    await assetService.add({ farmId: "f2", purchasePrice: "20000" });
    await assetService.add({ farmId: "f2" });
    expect(await assetService.totalValue("f2")).toBe(70000);
  });

  it("category label/icon resolve, with fallbacks", () => {
    expect(assetService.categoryLabel("machinery")).toBe("Machinery");
    expect(assetService.categoryLabel("mystery")).toBe("mystery");
    expect(assetService.categoryIcon("pump")).toBe("Droplets");
    expect(assetService.categoryIcon("mystery")).toBe("Package2");
  });

  it("exposes the eight asset categories", () => {
    expect(ASSET_CATEGORIES).toHaveLength(8);
    expect(ASSET_CATEGORIES.map((c) => c.id)).toContain("machinery");
  });
});
