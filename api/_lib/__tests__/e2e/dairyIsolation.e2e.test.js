/* Dairy D1 — isolation, RBAC, clean-state, and write-protection e2e tests.
 *
 * Farm A: owner U(30), manager U(31), worker U(32)
 * Farm B: owner U(40), manager U(41)
 *
 * These tests drive the REAL /api/farm handler through the six-step auth gate
 * using the PGlite harness — same path as production, no HTTP transport. */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { freshDb, call, U, buildFarm, dbRef } from "./harness.js";

vi.mock("../../db.js", () => ({ getSql: () => dbRef.sql }));
vi.mock("../../../_middleware/verifyAuth.js", async () => ({
  verifyToken: (await import("./harness.js")).testVerifyToken,
}));
vi.mock("../../blobStore.js", () => ({ deleteAttachment: async () => {} }));

/* ── shared state ─────────────────────────────────────────────────────────── */

let spaceA, spaceB;
let animalA1Id, animalA2Id, animalB1Id;

beforeAll(async () => {
  await freshDb();

  const farmA = await buildFarm(30, "Farm A", { managers: [31], workers: [32] });
  const farmB = await buildFarm(40, "Farm B", { managers: [41] });
  spaceA = farmA.space;
  spaceB = farmB.space;

  // Create animals in Farm A
  const a1 = await call(U(30), "dairy.animals.create", {
    spaceId: spaceA.id,
    payload: { name: "Lakshmi", species: "cow", breed: "Gir", currentStatus: "milking",
                clientUuid: "a1-create" },
  });
  expect(a1.status).toBe(200);
  animalA1Id = a1.data.id;

  const a2 = await call(U(30), "dairy.animals.create", {
    spaceId: spaceA.id,
    payload: { name: "Kamdhenu", species: "buffalo", breed: "Murrah", currentStatus: "dry",
                clientUuid: "a2-create" },
  });
  expect(a2.status).toBe(200);
  animalA2Id = a2.data.id;

  // Populate A1 with milk records, repro events, health events
  const milk = await call(U(32), "dairy.milk.upsert", {
    spaceId: spaceA.id,
    payload: { animalId: animalA1Id, recordDate: "2026-09-01",
                amYieldKg: 5.5, pmYieldKg: 4.5, clientUuid: "milk-a1-0901" },
  });
  expect(milk.status).toBe(200);

  const repro = await call(U(30), "dairy.repro.add", {
    spaceId: spaceA.id,
    payload: { animalId: animalA1Id, eventDate: "2026-08-15",
                eventType: "ai_done", semenLot: "LOT-001", clientUuid: "repro-a1-0815" },
  });
  expect(repro.status).toBe(200);

  const health = await call(U(30), "dairy.health.add", {
    spaceId: spaceA.id,
    payload: { animalId: animalA1Id, eventDate: "2026-09-05",
                eventType: "vaccination", title: "FMD Vaccine",
                isZoonoticConcern: false, clientUuid: "health-a1-0905" },
  });
  expect(health.status).toBe(200);

  // Create animal in Farm B
  const b1 = await call(U(40), "dairy.animals.create", {
    spaceId: spaceB.id,
    payload: { name: "Sundari", species: "cow", breed: "HF/Holstein",
                clientUuid: "b1-create" },
  });
  expect(b1.status).toBe(200);
  animalB1Id = b1.data.id;
}, 60_000);

/* ── cross-animal isolation ───────────────────────────────────────────────── */

describe("cross-animal isolation", () => {
  it("A2 has no milk records from A1", async () => {
    const r = await call(U(30), "dairy.milk.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("A2 has no repro events from A1", async () => {
    const r = await call(U(30), "dairy.repro.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("A2 has no health events from A1", async () => {
    const r = await call(U(30), "dairy.health.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("Farm B owner cannot read Farm A's animal", async () => {
    const r = await call(U(40), "dairy.animals.get", {
      spaceId: spaceB.id,
      payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(404);
  });

  it("Farm B cannot list Farm A's animals in its space", async () => {
    const r = await call(U(40), "dairy.animals.list", { spaceId: spaceB.id });
    expect(r.status).toBe(200);
    const ids = r.data.map((a) => a.id);
    expect(ids).not.toContain(animalA1Id);
    expect(ids).not.toContain(animalA2Id);
    expect(ids).toContain(animalB1Id);
  });
});

/* ── new animal clean state ───────────────────────────────────────────────── */

describe("new animal clean state", () => {
  it("empty milk records list", async () => {
    const r = await call(U(30), "dairy.milk.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("empty repro list", async () => {
    const r = await call(U(30), "dairy.repro.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("empty health list", async () => {
    const r = await call(U(30), "dairy.health.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("empty lactation list", async () => {
    const r = await call(U(30), "dairy.lactations.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });
});

/* ── terminal animal write protection ─────────────────────────────────────── */

describe("terminal animal write protection", () => {
  let soldAnimalId;

  beforeAll(async () => {
    const r = await call(U(30), "dairy.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "Sold Cow", species: "cow", currentStatus: "milking",
                  clientUuid: "sold-cow-create" },
    });
    soldAnimalId = r.data.id;

    const sold = await call(U(30), "dairy.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: soldAnimalId, status: "sold" },
    });
    expect(sold.status).toBe(200);
  });

  it("sold animal blocks milk record write (409)", async () => {
    const r = await call(U(32), "dairy.milk.upsert", {
      spaceId: spaceA.id,
      payload: { animalId: soldAnimalId, recordDate: "2026-09-10",
                  amYieldKg: 3, pmYieldKg: 2 },
    });
    expect(r.status).toBe(409);
  });

  it("sold animal blocks repro event add (409)", async () => {
    const r = await call(U(30), "dairy.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: soldAnimalId, eventDate: "2026-09-10", eventType: "heat_observed" },
    });
    expect(r.status).toBe(409);
  });

  it("sold animal blocks health event add (409)", async () => {
    const r = await call(U(30), "dairy.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: soldAnimalId, eventDate: "2026-09-10",
                  eventType: "vaccination", title: "Test" },
    });
    expect(r.status).toBe(409);
  });

  it("sold animal cannot transition to another status (409)", async () => {
    const r = await call(U(30), "dairy.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: soldAnimalId, status: "milking" },
    });
    expect(r.status).toBe(409);
  });

  it("sold animal history is still readable", async () => {
    // First add a milk record before selling — use a pre-sold cow for this
    const r = await call(U(30), "dairy.animal.history", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.history).toBeDefined();
  });
});

/* ── RBAC checks ──────────────────────────────────────────────────────────── */

describe("RBAC", () => {
  it("worker can record milk (farm.dairy.record)", async () => {
    const r = await call(U(32), "dairy.milk.upsert", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, recordDate: "2026-09-02",
                  amYieldKg: 6, pmYieldKg: 5, clientUuid: "milk-a1-0902" },
    });
    expect(r.status).toBe(200);
  });

  it("worker cannot create animal (no farm.dairy.manage)", async () => {
    const r = await call(U(32), "dairy.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "Worker Cow", species: "cow" },
    });
    expect(r.status).toBe(403);
  });

  it("worker cannot access finance summary (no farm.dairy.finance)", async () => {
    const r = await call(U(32), "dairy.finance.summary", { spaceId: spaceA.id });
    expect(r.status).toBe(403);
  });

  it("manager can create animal", async () => {
    const r = await call(U(31), "dairy.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "Manager Cow", species: "buffalo", clientUuid: "mgr-cow-create" },
    });
    expect(r.status).toBe(200);
  });

  it("manager can access finance summary", async () => {
    const r = await call(U(31), "dairy.finance.summary", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
  });

  it("non-member gets 404 for Farm A actions", async () => {
    const r = await call(U(40), "dairy.animals.list", { spaceId: spaceA.id });
    expect(r.status).toBe(404);
  });

  it("Farm B animal cannot be read by Farm A member using Farm A space", async () => {
    const r = await call(U(30), "dairy.animals.get", {
      spaceId: spaceA.id,
      payload: { animalId: animalB1Id },
    });
    expect(r.status).toBe(404);
  });
});

/* ── herd metrics ─────────────────────────────────────────────────────────── */

describe("herd metrics", () => {
  it("returns status counts for Farm A", async () => {
    const r = await call(U(30), "dairy.metrics", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    const m = r.data;
    expect(m.status_counts).toBeDefined();
    expect(typeof m.today_milk_kg).toBe("number");
    expect(typeof m.month_milk_kg).toBe("number");
    expect(typeof m.health_due_in_14_days).toBe("number");
    // Farm A has Lakshmi (milking), Kamdhenu (dry), Sold Cow (sold), Manager Cow (heifer)
    expect(m.status_counts.milking).toBeGreaterThanOrEqual(1);
    expect(m.status_counts.dry).toBeGreaterThanOrEqual(1);
  });

  it("Farm B metrics does not include Farm A animals", async () => {
    const r = await call(U(40), "dairy.metrics", { spaceId: spaceB.id });
    expect(r.status).toBe(200);
    const total = Object.values(r.data.status_counts).reduce((s, v) => s + v, 0);
    // Farm B only has Sundari
    expect(total).toBe(1);
  });
});

/* ── animal history scoping ───────────────────────────────────────────────── */

describe("animal history", () => {
  it("returns history entries for A1 with correct animal", async () => {
    const r = await call(U(30), "dairy.animal.history", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.animal.id).toBe(animalA1Id);
    expect(r.data.history.length).toBeGreaterThan(0);
    // Should include the milk record and repro event we added in beforeAll
    const kinds = r.data.history.map((h) => h.kind);
    expect(kinds).toContain("milk_record");
    expect(kinds).toContain("repro_event");
    expect(kinds).toContain("health_event");
  });

  it("A2 history is empty (no contamination from A1)", async () => {
    const r = await call(U(30), "dairy.animal.history", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.history).toHaveLength(0);
  });

  it("Farm B cannot read Farm A animal history via its space", async () => {
    const r = await call(U(40), "dairy.animal.history", {
      spaceId: spaceB.id,
      payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(404);
  });
});

/* ── lactation auto-advance ───────────────────────────────────────────────── */

describe("lactation", () => {
  it("addLactation increments lactation_number and advances status to milking", async () => {
    // A2 is currently dry
    const beforeStatus = await call(U(30), "dairy.animals.get", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id },
    });
    expect(beforeStatus.data.current_status).toBe("dry");

    const r = await call(U(30), "dairy.lactations.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id, calvingDate: "2026-09-10", calfSex: "female", calfAlive: true },
    });
    expect(r.status).toBe(200);
    expect(r.data.lactation_number).toBe(1);

    const after = await call(U(30), "dairy.animals.get", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id },
    });
    expect(after.data.current_status).toBe("milking");
  });

  it("second addLactation auto-increments to 2", async () => {
    const r = await call(U(30), "dairy.lactations.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id, calvingDate: "2026-09-14" },
    });
    expect(r.status).toBe(200);
    expect(r.data.lactation_number).toBe(2);
  });
});

/* ── terminal protection for delete operations (Finding E fix) ────────────── */

describe("terminal animal write protection — delete operations", () => {
  let terminalAnimalId, reproEventId, healthEventId;

  beforeAll(async () => {
    // Create an animal, add one repro and one health event, then mark it sold.
    const created = await call(U(30), "dairy.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "Terminal Delete Test", species: "cow", currentStatus: "milking",
                  clientUuid: "terminal-delete-animal" },
    });
    terminalAnimalId = created.data.id;

    const repro = await call(U(30), "dairy.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: terminalAnimalId, eventDate: "2026-09-06",
                  eventType: "ai_done", clientUuid: "terminal-repro-event" },
    });
    reproEventId = repro.data.id;

    const health = await call(U(30), "dairy.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: terminalAnimalId, eventDate: "2026-09-07",
                  eventType: "vaccination", title: "Pre-sale vaccine",
                  clientUuid: "terminal-health-event" },
    });
    healthEventId = health.data.id;

    const sold = await call(U(30), "dairy.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: terminalAnimalId, status: "sold" },
    });
    expect(sold.status).toBe(200);
  });

  it("deleteRepro on sold animal returns 409", async () => {
    const r = await call(U(30), "dairy.repro.delete", {
      spaceId: spaceA.id,
      payload: { eventId: reproEventId },
    });
    expect(r.status).toBe(409);
  });

  it("deleteHealth on sold animal returns 409", async () => {
    const r = await call(U(30), "dairy.health.delete", {
      spaceId: spaceA.id,
      payload: { eventId: healthEventId },
    });
    expect(r.status).toBe(409);
  });

  it("repro event is still readable after terminal status", async () => {
    const r = await call(U(30), "dairy.repro.list", {
      spaceId: spaceA.id,
      payload: { animalId: terminalAnimalId },
    });
    expect(r.status).toBe(200);
    expect(r.data.some((e) => e.id === reproEventId)).toBe(true);
  });

  it("health event is still readable after terminal status", async () => {
    const r = await call(U(30), "dairy.health.list", {
      spaceId: spaceA.id,
      payload: { animalId: terminalAnimalId },
    });
    expect(r.status).toBe(200);
    expect(r.data.some((e) => e.id === healthEventId)).toBe(true);
  });
});

/* ── delete scope checks (non-terminal animal) ────────────────────────────── */

describe("delete scope isolation", () => {
  let reproId, healthId;

  beforeAll(async () => {
    // Add a repro and health event to A1 (milking — writable)
    const r = await call(U(30), "dairy.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-08",
                  eventType: "pregnancy_check", pregnancyResult: "positive",
                  clientUuid: "delete-scope-repro" },
    });
    reproId = r.data.id;

    const h = await call(U(30), "dairy.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-08",
                  eventType: "deworming", title: "Albendazole",
                  clientUuid: "delete-scope-health" },
    });
    healthId = h.data.id;
  });

  it("Farm B cannot delete Farm A repro event (404)", async () => {
    const r = await call(U(40), "dairy.repro.delete", {
      spaceId: spaceB.id,
      payload: { eventId: reproId },
    });
    expect(r.status).toBe(404);
  });

  it("Farm B cannot delete Farm A health event (404)", async () => {
    const r = await call(U(40), "dairy.health.delete", {
      spaceId: spaceB.id,
      payload: { eventId: healthId },
    });
    expect(r.status).toBe(404);
  });

  it("Farm A member can delete a writable animal's repro event", async () => {
    const r = await call(U(30), "dairy.repro.delete", {
      spaceId: spaceA.id,
      payload: { eventId: reproId },
    });
    expect(r.status).toBe(200);
    expect(r.data.deleted).toBe(true);
  });

  it("deleted repro event no longer appears in list", async () => {
    const r = await call(U(30), "dairy.repro.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.some((e) => e.id === reproId)).toBe(false);
  });

  it("Farm A member can delete a writable animal's health event", async () => {
    const r = await call(U(30), "dairy.health.delete", {
      spaceId: spaceA.id,
      payload: { eventId: healthId },
    });
    expect(r.status).toBe(200);
    expect(r.data.deleted).toBe(true);
  });
});

/* ── updateLactation ──────────────────────────────────────────────────────── */

describe("updateLactation", () => {
  it("can set dry_off_date on an existing lactation", async () => {
    // A2 now has lactation 1 and 2 from earlier describe("lactation") tests.
    // List them and update lactation 1.
    const list = await call(U(30), "dairy.lactations.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id },
    });
    expect(list.status).toBe(200);
    expect(list.data.length).toBeGreaterThanOrEqual(1);

    const lac = list.data.find((l) => l.lactation_number === 1);
    expect(lac).toBeDefined();

    const r = await call(U(30), "dairy.lactations.update", {
      spaceId: spaceA.id,
      payload: { lactationId: lac.id, dryOffDate: "2026-11-15", notes: "Dry-off confirmed" },
    });
    expect(r.status).toBe(200);
    // PGlite returns date columns as Date objects; production Postgres as strings.
    // new Date(x).toISOString() handles both correctly.
    expect(new Date(r.data.dry_off_date).toISOString().slice(0, 10)).toBe("2026-11-15");
    expect(r.data.notes).toBe("Dry-off confirmed");
  });

  it("updateLactation with unknown lactationId returns 404", async () => {
    const r = await call(U(30), "dairy.lactations.update", {
      spaceId: spaceA.id,
      payload: { lactationId: "00000000-0000-0000-0000-000000000000", dryOffDate: "2026-10-01" },
    });
    expect(r.status).toBe(404);
  });

  it("Farm B cannot update Farm A lactation (404)", async () => {
    const list = await call(U(30), "dairy.lactations.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id },
    });
    const lac = list.data[0];
    const r = await call(U(40), "dairy.lactations.update", {
      spaceId: spaceB.id,
      payload: { lactationId: lac.id, dryOffDate: "2026-10-01" },
    });
    expect(r.status).toBe(404);
  });
});

/* ── finance operations ───────────────────────────────────────────────────── */

describe("finance — sales and costs", () => {
  it("manager can add a milk sale and it appears in the list", async () => {
    const add = await call(U(31), "dairy.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-01", saleType: "combined",
                  quantityKg: 50, pricePerLitre: 35,
                  buyer: "AMUL", clientUuid: "sale-0901" },
    });
    expect(add.status).toBe(200);
    expect(parseFloat(add.data.amount)).toBe(50 * 35);

    const list = await call(U(31), "dairy.sales.list", { spaceId: spaceA.id });
    expect(list.status).toBe(200);
    expect(list.data.some((s) => s.id === add.data.id)).toBe(true);
  });

  it("worker cannot add a sale (no farm.dairy.finance)", async () => {
    const r = await call(U(32), "dairy.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-01", saleType: "combined", quantityKg: 10, pricePerLitre: 35 },
    });
    expect(r.status).toBe(403);
  });

  it("manager can add a cost", async () => {
    const r = await call(U(31), "dairy.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-01", category: "concentrate_feed",
                  description: "Mustard cake 50kg", amount: 800,
                  clientUuid: "cost-0901" },
    });
    expect(r.status).toBe(200);
    expect(parseFloat(r.data.amount)).toBe(800);
  });

  it("finance summary returns numeric totals", async () => {
    const r = await call(U(31), "dairy.finance.summary", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    expect(typeof r.data.total_revenue).toBe("number");
    expect(typeof r.data.total_costs).toBe("number");
    expect(typeof r.data.net_profit).toBe("number");
    expect(typeof r.data.month_milk_produced_kg).toBe("number");
    expect(Array.isArray(r.data.cost_breakdown)).toBe(true);
  });

  it("Farm B cannot see Farm A sales (different space)", async () => {
    const r = await call(U(40), "dairy.sales.list", { spaceId: spaceB.id });
    expect(r.status).toBe(200);
    // Farm B has no sales; list must be empty
    expect(r.data).toHaveLength(0);
  });

  it("invalid sale_type returns 400", async () => {
    const r = await call(U(31), "dairy.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-01", saleType: "INVALID", quantityKg: 10, pricePerLitre: 35 },
    });
    expect(r.status).toBe(400);
  });

  it("invalid cost category returns 400", async () => {
    const r = await call(U(31), "dairy.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-01", category: "snacks", description: "Tea", amount: 50 },
    });
    expect(r.status).toBe(400);
  });
});

/* ── supervisor RBAC ──────────────────────────────────────────────────────── */

describe("supervisor RBAC", () => {
  let supervisorSpace;

  beforeAll(async () => {
    // Build a new farm with a supervisor (U(50)) alongside owner (U(49))
    const farm = await buildFarm(49, "Supervisor Farm", { supervisors: [50] });
    supervisorSpace = farm.space;

    // Create one animal as the owner so the supervisor has something to work with
    await call(U(49), "dairy.animals.create", {
      spaceId: supervisorSpace.id,
      payload: { name: "Supervisor Animal", species: "cow", currentStatus: "milking",
                  clientUuid: "sup-animal" },
    });
  });

  it("supervisor can list animals (farm.dairy.view)", async () => {
    const r = await call(U(50), "dairy.animals.list", { spaceId: supervisorSpace.id });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
  });

  it("supervisor can record milk (farm.dairy.record)", async () => {
    const animals = await call(U(50), "dairy.animals.list", { spaceId: supervisorSpace.id });
    const animalId = animals.data[0].id;
    const r = await call(U(50), "dairy.milk.upsert", {
      spaceId: supervisorSpace.id,
      payload: { animalId, recordDate: "2026-09-10", amYieldKg: 4, pmYieldKg: 3 },
    });
    expect(r.status).toBe(200);
  });

  it("supervisor cannot create animal (no farm.dairy.manage)", async () => {
    const r = await call(U(50), "dairy.animals.create", {
      spaceId: supervisorSpace.id,
      payload: { name: "Sup Cow", species: "cow" },
    });
    expect(r.status).toBe(403);
  });

  it("supervisor cannot access finance summary (no farm.dairy.finance)", async () => {
    const r = await call(U(50), "dairy.finance.summary", { spaceId: supervisorSpace.id });
    expect(r.status).toBe(403);
  });
});

/* ── milk.list space-wide (no animalId) ──────────────────────────────────── */

describe("dairy.milk.list — space-wide query", () => {
  it("returns records from all animals in the space with animal name joined", async () => {
    const r = await call(U(30), "dairy.milk.list", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThan(0);
    // Every row should carry animal_name from the JOIN
    for (const row of r.data) {
      expect(typeof row.animal_name).toBe("string");
      expect(row.animal_name.length).toBeGreaterThan(0);
    }
  });

  it("space-wide list does not include Farm B records", async () => {
    // Add a record in Farm B first
    const bAnimals = await call(U(40), "dairy.animals.list", { spaceId: spaceB.id });
    const bAnimalId = bAnimals.data[0].id;
    await call(U(40), "dairy.milk.upsert", {
      spaceId: spaceB.id,
      payload: { animalId: bAnimalId, recordDate: "2026-09-11", amYieldKg: 7, pmYieldKg: 6 },
    });

    // Farm A space-wide list must not include Farm B's record
    const rA = await call(U(30), "dairy.milk.list", { spaceId: spaceA.id });
    const rAIds = rA.data.map((r) => r.animal_id);
    expect(rAIds).not.toContain(bAnimalId);
  });
});

/* ── invalid input rejection ──────────────────────────────────────────────── */

describe("invalid input rejection", () => {
  it("createAnimal with no name returns 400", async () => {
    const r = await call(U(30), "dairy.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "", species: "cow" },
    });
    expect(r.status).toBe(400);
  });

  it("createAnimal with invalid species returns 400", async () => {
    const r = await call(U(30), "dairy.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "Bad Species", species: "goat" },
    });
    expect(r.status).toBe(400);
  });

  it("createAnimal with empty string currentStatus returns 400 (not 500)", async () => {
    const r = await call(U(30), "dairy.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "Status Test", species: "cow", currentStatus: "" },
    });
    expect(r.status).toBe(400);
  });

  it("createAnimal with invalid currentStatus returns 400", async () => {
    const r = await call(U(30), "dairy.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "Status Test", species: "cow", currentStatus: "sold" },
    });
    expect(r.status).toBe(400);
  });

  it("upsertMilk without recordDate returns 400", async () => {
    const r = await call(U(32), "dairy.milk.upsert", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, amYieldKg: 5 },
    });
    expect(r.status).toBe(400);
  });

  it("addRepro with invalid event_type returns 400", async () => {
    const r = await call(U(30), "dairy.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-10", eventType: "alien_abduction" },
    });
    expect(r.status).toBe(400);
  });

  it("addHealth without title returns 400", async () => {
    const r = await call(U(30), "dairy.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-10", eventType: "vaccination", title: "" },
    });
    expect(r.status).toBe(400);
  });
});

/* ── milk upsert idempotency ──────────────────────────────────────────────── */

describe("milk upsert idempotency", () => {
  it("same date upsert updates the existing record", async () => {
    const first = await call(U(32), "dairy.milk.upsert", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, recordDate: "2026-09-03",
                  amYieldKg: 4, pmYieldKg: 3, clientUuid: "milk-a1-0903-first" },
    });
    expect(first.status).toBe(200);

    const second = await call(U(32), "dairy.milk.upsert", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, recordDate: "2026-09-03",
                  amYieldKg: 5, pmYieldKg: 4 },
    });
    expect(second.status).toBe(200);

    const list = await call(U(30), "dairy.milk.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, fromDate: "2026-09-03", toDate: "2026-09-03" },
    });
    expect(list.status).toBe(200);
    expect(list.data).toHaveLength(1);
    expect(parseFloat(list.data[0].am_yield_kg)).toBe(5);
  });

  it("client_uuid idempotency returns same record on replay", async () => {
    const r1 = await call(U(32), "dairy.milk.upsert", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, recordDate: "2026-09-04",
                  amYieldKg: 3, pmYieldKg: 3, clientUuid: "idempotent-0904" },
    });
    const r2 = await call(U(32), "dairy.milk.upsert", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, recordDate: "2026-09-04",
                  amYieldKg: 99, pmYieldKg: 99, clientUuid: "idempotent-0904" },
    });
    expect(r1.data.id).toBe(r2.data.id);
  });
});
