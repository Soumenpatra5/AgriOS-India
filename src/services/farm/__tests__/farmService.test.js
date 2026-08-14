import { describe, it, expect, beforeEach, vi } from "vitest";

const H = vi.hoisted(() => {
  const stores = {};
  const make = () => {
    let rows = [];
    let seq = 0;
    return {
      add: async (data) => { const r = { id: `f${++seq}`, ...data }; rows.push(r); return r; },
      getAll: async () => rows.slice(),
      getBy: async (f, v) => rows.filter((r) => r[f] === v),
      getById: async (id) => rows.find((r) => r.id === id) || null,
      update: async (id, patch) => { const r = rows.find((x) => x.id === id); if (!r) return null; Object.assign(r, patch); return r; },
      remove: async (id) => { const i = rows.findIndex((x) => x.id === id); if (i < 0) return null; return rows.splice(i, 1)[0]; },
      count: async () => rows.length,
      reset: () => { rows = []; seq = 0; },
    };
  };
  const repo = (name) => (stores[name] ||= make());
  const resetAll = () => Object.values(stores).forEach((s) => s.reset());
  const mem = {};
  return { repo, resetAll, mem };
});

vi.mock("../../erp/erpDb.js", () => ({ repo: H.repo, uid: () => "uid" }));
vi.mock("../../../utils/storage.js", () => ({
  storage: {
    get: (k, d = null) => (k in H.mem ? H.mem[k] : d),
    set: (k, v) => { H.mem[k] = v; },
    remove: (k) => { delete H.mem[k]; },
  },
}));

const { farmService, FARM_TYPES } = await import("../farmService.js");

beforeEach(() => { H.resetAll(); for (const k of Object.keys(H.mem)) delete H.mem[k]; });

describe("farmService — CRUD + count", () => {
  it("adds, reads, updates and counts farms", async () => {
    const a = await farmService.add({ name: "Main", type: "mixed" });
    expect((await farmService.getById(a.id)).name).toBe("Main");
    expect((await farmService.update(a.id, { name: "Renamed" })).name).toBe("Renamed");
    await farmService.add({ name: "Second" });
    expect(await farmService.count()).toBe(2);
  });
});

describe("farmService — active farm", () => {
  it("getActiveId / setActive round-trip", () => {
    expect(farmService.getActiveId()).toBeNull();
    farmService.setActive("f1");
    expect(farmService.getActiveId()).toBe("f1");
  });

  it("getActive returns the stored active farm, else the first, else null", async () => {
    expect(await farmService.getActive()).toBeNull(); // no farms

    const a = await farmService.add({ name: "A" });
    const b = await farmService.add({ name: "B" });
    farmService.setActive(b.id);
    expect((await farmService.getActive()).id).toBe(b.id);

    farmService.setActive("stale-id"); // no longer exists → fall back to first
    expect((await farmService.getActive()).id).toBe(a.id);
  });
});

describe("farmService.remove — cascade soft-delete", () => {
  it("removes the farm, cascades to its children, and clears the active id", async () => {
    const farm = await farmService.add({ name: "Main" });
    const parcels = H.repo("parcels");
    const tasks = H.repo("tasks");
    await parcels.add({ farmId: farm.id, name: "P1" });
    await parcels.add({ farmId: "other-farm", name: "P2" }); // belongs to another farm
    await tasks.add({ farmId: farm.id, title: "T1" });
    farmService.setActive(farm.id);

    await farmService.remove(farm.id);

    expect(await farmService.getById(farm.id)).toBeNull();
    expect(await parcels.getBy("farmId", farm.id)).toHaveLength(0);   // cascaded
    expect(await parcels.getBy("farmId", "other-farm")).toHaveLength(1); // untouched
    expect(await tasks.getBy("farmId", farm.id)).toHaveLength(0);     // cascaded
    expect(farmService.getActiveId()).toBeNull();                     // active cleared
  });

  it("keeps the active id when a different farm is removed", async () => {
    const a = await farmService.add({ name: "A" });
    const b = await farmService.add({ name: "B" });
    farmService.setActive(a.id);
    await farmService.remove(b.id);
    expect(farmService.getActiveId()).toBe(a.id);
  });
});

describe("farmService — type labels", () => {
  it("resolves a farm-type label, falling back to the id", () => {
    expect(farmService.typeLabel("dairy")).toBe("Dairy Farm");
    expect(farmService.typeLabel("mystery")).toBe("mystery");
  });
  it("exposes the nine farm types", () => {
    expect(FARM_TYPES).toHaveLength(9);
  });
});
