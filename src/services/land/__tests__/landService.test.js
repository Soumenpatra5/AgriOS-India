import { describe, it, expect, beforeEach, vi } from "vitest";

const held = vi.hoisted(() => {
  const stores = {};
  const make = () => {
    let rows = [];
    let seq = 0;
    return {
      add: async (data) => { const r = { id: `p${++seq}`, ...data }; rows.push(r); return r; },
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

const { landService, SOIL_TYPES, WATER_SOURCES, OWNERSHIP } = await import("../landService.js");

describe("landService — CRUD", () => {
  beforeEach(() => { held.resetAll(); });

  it("add seeds an empty rotation by default, honouring an override", async () => {
    expect((await landService.add({ farmId: "f1" })).rotation).toEqual([]);
    expect((await landService.add({ rotation: [{ crop: "Old" }] })).rotation).toHaveLength(1);
  });

  it("scopes getAll to a farm, or returns everything", async () => {
    await landService.add({ farmId: "f1" });
    await landService.add({ farmId: "f2" });
    expect(await landService.getAll("f1")).toHaveLength(1);
    expect(await landService.getAll()).toHaveLength(2);
  });
});

describe("landService.setCrop", () => {
  beforeEach(() => { held.resetAll(); });

  it("sets the current crop and appends to the rotation history", async () => {
    const p = await landService.add({ farmId: "f1", areaAcres: 3 });
    const first = await landService.setCrop(p.id, "Paddy");
    expect(first.currentCrop).toBe("Paddy");
    expect(first.rotation).toHaveLength(1);
    expect(first.rotation[0].crop).toBe("Paddy");
    expect(first.rotation[0].from).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const second = await landService.setCrop(p.id, "Wheat");
    expect(second.currentCrop).toBe("Wheat");
    expect(second.rotation.map((r) => r.crop)).toEqual(["Paddy", "Wheat"]);
  });

  it("returns null for an unknown parcel", async () => {
    expect(await landService.setCrop("nope", "Paddy")).toBeNull();
  });
});

describe("landService.utilization", () => {
  beforeEach(() => { held.resetAll(); });

  it("totals area, cultivated area and utilisation percent", async () => {
    await landService.add({ farmId: "f1", areaAcres: 3, currentCrop: "Paddy" });
    await landService.add({ farmId: "f1", areaAcres: 2 });                         // idle
    await landService.add({ farmId: "f1", areaAcres: "5", currentCrop: "Wheat" }); // coerced
    const u = await landService.utilization("f1");
    expect(u).toEqual({ parcels: 3, totalAcres: 10, usedAcres: 8, pct: 80 });
  });

  it("is all-zero for a farm with no parcels", async () => {
    expect(await landService.utilization("empty")).toEqual({ parcels: 0, totalAcres: 0, usedAcres: 0, pct: 0 });
  });
});

describe("landService — vocabularies", () => {
  it("exposes soil / water / ownership options", () => {
    expect(SOIL_TYPES).toContain("Loamy");
    expect(WATER_SOURCES).toContain("Borewell");
    expect(OWNERSHIP.map((o) => o.id)).toEqual(["owned", "leased", "shared"]);
  });
});
