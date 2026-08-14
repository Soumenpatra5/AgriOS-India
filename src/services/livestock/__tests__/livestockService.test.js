import { describe, it, expect, beforeEach, vi } from "vitest";

/* In-memory stand-in for livestockDb: one independent store per name so the
   animal / production / event services are tested without IndexedDB. */
const held = vi.hoisted(() => {
  const stores = {};
  const make = () => {
    let rows = [];
    let seq = 0;
    return {
      add: async (data) => { const r = { id: `r${++seq}`, ...data }; rows.push(r); return r; },
      getAll: async () => rows.slice(),
      getBy: async (field, value) => rows.filter((r) => r[field] === value),
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

vi.mock("../livestockDb.js", () => ({ repo: held.repo }));

const { animalService, productionService, eventService, ENTERPRISES } = await import("../livestockService.js");

const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

describe("livestock ENTERPRISES", () => {
  it("covers the seven livestock enterprises", () => {
    expect(ENTERPRISES.map((e) => e.id)).toEqual(["poultry", "dairy", "goat", "pig", "sheep", "fish", "bee"]);
  });
});

describe("animalService", () => {
  beforeEach(() => { held.resetAll(); });

  it("scopes getAll/count to an enterprise, or returns all when none given", async () => {
    await animalService.add({ enterprise: "poultry", name: "Hen 1" });
    await animalService.add({ enterprise: "poultry", name: "Hen 2" });
    await animalService.add({ enterprise: "dairy", name: "Cow 1" });
    expect(await animalService.getAll("poultry")).toHaveLength(2);
    expect(await animalService.getAll()).toHaveLength(3);
    expect(await animalService.count("poultry")).toBe(2);
    expect(await animalService.count()).toBe(3);
  });

  it("supports get-by-id, update and remove", async () => {
    const a = await animalService.add({ enterprise: "goat", name: "Nanny", weightKg: 30 });
    expect((await animalService.getById(a.id)).name).toBe("Nanny");
    const up = await animalService.update(a.id, { weightKg: 35 });
    expect(up.weightKg).toBe(35);
    await animalService.remove(a.id);
    expect(await animalService.getById(a.id)).toBeNull();
    expect(await animalService.count()).toBe(0);
  });
});

describe("productionService", () => {
  beforeEach(() => { held.resetAll(); });

  it("getForEnterprise returns newest-first and honours the limit", async () => {
    await productionService.add({ enterprise: "dairy", date: "2026-05-01", quantity: 10 });
    await productionService.add({ enterprise: "dairy", date: "2026-05-03", quantity: 12 });
    await productionService.add({ enterprise: "dairy", date: "2026-05-02", quantity: 11 });
    const recent = await productionService.getForEnterprise("dairy", 2);
    expect(recent.map((r) => r.date)).toEqual(["2026-05-03", "2026-05-02"]);
  });

  it("getForEnterprise filters out other enterprises", async () => {
    await productionService.add({ enterprise: "dairy", date: "2026-05-01", quantity: 10 });
    await productionService.add({ enterprise: "poultry", date: "2026-05-01", eggs: 40 });
    const dairy = await productionService.getForEnterprise("dairy");
    expect(dairy).toHaveLength(1);
    expect(dairy[0].quantity).toBe(10);
  });

  it("getForAnimal returns that animal's records newest-first", async () => {
    await productionService.add({ enterprise: "dairy", animalId: "cow-1", date: "2026-05-01", quantity: 8 });
    await productionService.add({ enterprise: "dairy", animalId: "cow-1", date: "2026-05-04", quantity: 9 });
    await productionService.add({ enterprise: "dairy", animalId: "cow-2", date: "2026-05-02", quantity: 7 });
    const rec = await productionService.getForAnimal("cow-1");
    expect(rec.map((r) => r.date)).toEqual(["2026-05-04", "2026-05-01"]);
  });
});

describe("eventService", () => {
  beforeEach(() => { held.resetAll(); });

  it("getForEnterprise returns events newest-first", async () => {
    await eventService.add({ enterprise: "goat", type: "vaccination", date: "2026-04-01" });
    await eventService.add({ enterprise: "goat", type: "treatment", date: "2026-04-10" });
    const list = await eventService.getForEnterprise("goat");
    expect(list.map((e) => e.date)).toEqual(["2026-04-10", "2026-04-01"]);
  });

  it("getUpcoming keeps only events due within the window", async () => {
    await eventService.add({ enterprise: "goat", type: "vaccination", date: "x", dueDate: plusDays(10) });  // in window
    await eventService.add({ enterprise: "goat", type: "vaccination", date: "x", dueDate: plusDays(40) });  // beyond 30d
    await eventService.add({ enterprise: "goat", type: "vaccination", date: "x", dueDate: plusDays(-5) });  // already past
    await eventService.add({ enterprise: "goat", type: "breeding",    date: "x" });                          // no dueDate
    const upcoming = await eventService.getUpcoming("goat", 30);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].dueDate).toBe(plusDays(10));
  });

  it("remove drops an event", async () => {
    const e = await eventService.add({ enterprise: "fish", type: "harvest", date: "2026-06-01" });
    await eventService.remove(e.id);
    expect(await eventService.getForEnterprise("fish")).toHaveLength(0);
  });
});
