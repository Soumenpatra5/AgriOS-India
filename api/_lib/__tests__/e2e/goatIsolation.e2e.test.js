/* Goat G1 — isolation, RBAC, clean-state, and write-protection e2e tests.
 *
 * Farm A: owner U(50), manager U(51), worker U(52)
 * Farm B: owner U(60), manager U(61)
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
let milkRecordId, weightRecordId, reproEventId, healthEventId, feedRecordId;

beforeAll(async () => {
  await freshDb();

  const farmA = await buildFarm(50, "Farm A Goat", { managers: [51], workers: [52] });
  const farmB = await buildFarm(60, "Farm B Goat", { managers: [61] });
  spaceA = farmA.space;
  spaceB = farmB.space;

  // Create animals in Farm A
  const a1 = await call(U(50), "goat.animals.create", {
    spaceId: spaceA.id,
    payload: { name: "Chameli", species: "goat", sex: "female", breed: "Sirohi",
                currentStatus: "milking", clientUuid: "goat-a1-create" },
  });
  expect(a1.status).toBe(200);
  animalA1Id = a1.data.id;

  const a2 = await call(U(50), "goat.animals.create", {
    spaceId: spaceA.id,
    payload: { name: "Kalu", species: "goat", sex: "male", breed: "Black Bengal",
                currentStatus: "kid", clientUuid: "goat-a2-create" },
  });
  expect(a2.status).toBe(200);
  animalA2Id = a2.data.id;

  // Populate A1: milk, weight, repro, health, feed
  const milk = await call(U(52), "goat.milk.upsert", {
    spaceId: spaceA.id,
    payload: { animalId: animalA1Id, recordDate: "2026-09-01",
                amYieldKg: 0.8, pmYieldKg: 0.7, clientUuid: "goat-milk-a1-0901" },
  });
  expect(milk.status).toBe(200);
  milkRecordId = milk.data.id;

  const weight = await call(U(52), "goat.weight.add", {
    spaceId: spaceA.id,
    payload: { animalId: animalA1Id, weighDate: "2026-09-01",
                weightKg: 28.5, clientUuid: "goat-weight-a1-0901" },
  });
  expect(weight.status).toBe(200);
  weightRecordId = weight.data.id;

  const repro = await call(U(51), "goat.repro.add", {
    spaceId: spaceA.id,
    payload: { animalId: animalA1Id, eventDate: "2026-08-20",
                eventType: "mating", buckName: "Kesar", clientUuid: "goat-repro-a1-0820" },
  });
  expect(repro.status).toBe(200);
  reproEventId = repro.data.id;

  const health = await call(U(51), "goat.health.add", {
    spaceId: spaceA.id,
    payload: { animalId: animalA1Id, eventDate: "2026-09-05",
                eventType: "vaccination", title: "PPR Vaccine",
                nextDueDate: "2026-03-05", clientUuid: "goat-health-a1-0905" },
  });
  expect(health.status).toBe(200);
  healthEventId = health.data.id;

  const feed = await call(U(52), "goat.feed.add", {
    spaceId: spaceA.id,
    payload: { animalId: animalA1Id, feedDate: "2026-09-01",
                feedType: "concentrate", quantityKg: 0.5, clientUuid: "goat-feed-a1-0901" },
  });
  expect(feed.status).toBe(200);
  feedRecordId = feed.data.id;

  // Create animal in Farm B
  const b1 = await call(U(60), "goat.animals.create", {
    spaceId: spaceB.id,
    payload: { name: "Bhola", species: "sheep", sex: "male", breed: "Merino",
                clientUuid: "goat-b1-create" },
  });
  expect(b1.status).toBe(200);
  animalB1Id = b1.data.id;
}, 60_000);

/* ── cross-animal isolation ───────────────────────────────────────────────── */

describe("cross-animal isolation", () => {
  it("A2 has no milk records from A1", async () => {
    const r = await call(U(50), "goat.milk.list", {
      spaceId: spaceA.id, payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("A2 has no weight records from A1", async () => {
    const r = await call(U(50), "goat.weight.list", {
      spaceId: spaceA.id, payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("A2 has no repro events from A1", async () => {
    const r = await call(U(50), "goat.repro.list", {
      spaceId: spaceA.id, payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("A2 has no health events from A1", async () => {
    const r = await call(U(50), "goat.health.list", {
      spaceId: spaceA.id, payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("A2 has no feed records from A1", async () => {
    const r = await call(U(50), "goat.feed.list", {
      spaceId: spaceA.id, payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });
});

/* ── cross-space isolation ────────────────────────────────────────────────── */

describe("cross-space isolation", () => {
  it("Farm B owner cannot access Farm A's animal", async () => {
    const r = await call(U(60), "goat.animals.get", {
      spaceId: spaceB.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(404);
  });

  it("Farm A owner cannot access Farm B's animal", async () => {
    const r = await call(U(50), "goat.animals.get", {
      spaceId: spaceA.id, payload: { animalId: animalB1Id },
    });
    expect(r.status).toBe(404);
  });

  it("Farm A worker using spaceB.id gets 404 (space not visible to non-member)", async () => {
    const r = await call(U(52), "goat.animals.list", {
      spaceId: spaceB.id, payload: {},
    });
    expect(r.status).toBe(404);
  });

  it("Farm B manager cannot add weight to Farm A animal via spaceB", async () => {
    const r = await call(U(61), "goat.weight.add", {
      spaceId: spaceB.id,
      payload: { animalId: animalA1Id, weighDate: "2026-09-10", weightKg: 30 },
    });
    expect(r.status).toBe(404);
  });
});

/* ── listAnimals ──────────────────────────────────────────────────────────── */

describe("listAnimals", () => {
  it("owner sees active animals only by default", async () => {
    const r = await call(U(50), "goat.animals.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(2);
    expect(r.data.every(a => !["sold","deceased","retired"].includes(a.current_status))).toBe(true);
  });

  it("listAnimals with statusFilter=kid returns only kids", async () => {
    const r = await call(U(50), "goat.animals.list", {
      spaceId: spaceA.id, payload: { statusFilter: "kid" },
    });
    expect(r.status).toBe(200);
    expect(r.data.every(a => a.current_status === "kid")).toBe(true);
  });

  it("every row has numeric overdue_count", async () => {
    const r = await call(U(50), "goat.animals.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    for (const a of r.data) {
      expect(typeof a.overdue_count).toBe("number");
    }
  });

  it("manager can list animals", async () => {
    const r = await call(U(51), "goat.animals.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
  });

  it("worker can list animals (view permission)", async () => {
    const r = await call(U(52), "goat.animals.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
  });
});

/* ── getAnimal ────────────────────────────────────────────────────────────── */

describe("getAnimal", () => {
  it("returns last_weight and last_milk_record", async () => {
    const r = await call(U(50), "goat.animals.get", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.last_weight).not.toBeNull();
    expect(r.data.last_weight.weight_kg).toBe("28.50");
    expect(r.data.last_milk_record).not.toBeNull();
  });

  it("returns null last_weight for an animal with no weighings", async () => {
    const r = await call(U(50), "goat.animals.get", {
      spaceId: spaceA.id, payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.last_weight).toBeNull();
    expect(r.data.last_milk_record).toBeNull();
  });
});

/* ── createAnimal validation ──────────────────────────────────────────────── */

describe("createAnimal validation", () => {
  it("400 when name is missing", async () => {
    const r = await call(U(50), "goat.animals.create", {
      spaceId: spaceA.id, payload: { species: "goat" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when species is invalid", async () => {
    const r = await call(U(50), "goat.animals.create", {
      spaceId: spaceA.id, payload: { name: "Test", species: "pig" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when sex is invalid", async () => {
    const r = await call(U(50), "goat.animals.create", {
      spaceId: spaceA.id, payload: { name: "Test", species: "goat", sex: "alien" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when currentStatus is terminal", async () => {
    const r = await call(U(50), "goat.animals.create", {
      spaceId: spaceA.id, payload: { name: "Test", species: "goat", currentStatus: "sold" },
    });
    expect(r.status).toBe(400);
  });

  it("worker (farm.goat.record) cannot create animal — 403", async () => {
    const r = await call(U(52), "goat.animals.create", {
      spaceId: spaceA.id, payload: { name: "Keri", species: "goat" },
    });
    expect(r.status).toBe(403);
  });

  it("clientUuid idempotency — same request returns existing row", async () => {
    const r1 = await call(U(50), "goat.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "Idempotent", species: "sheep", sex: "female", clientUuid: "goat-idem-test-1" },
    });
    expect(r1.status).toBe(200);
    const r2 = await call(U(50), "goat.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "Idempotent", species: "sheep", sex: "female", clientUuid: "goat-idem-test-1" },
    });
    expect(r2.status).toBe(200);
    expect(r2.data.id).toBe(r1.data.id);
  });

  it("sheep species is accepted", async () => {
    const r = await call(U(50), "goat.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "Fluffy", species: "sheep", sex: "female",
                  clientUuid: "goat-sheep-create-1" },
    });
    expect(r.status).toBe(200);
    expect(r.data.species).toBe("sheep");
  });
});

/* ── updateAnimal ─────────────────────────────────────────────────────────── */

describe("updateAnimal", () => {
  it("manager can update name and breed", async () => {
    const r = await call(U(51), "goat.animals.update", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, breed: "Beetal", notes: "Updated by manager" },
    });
    expect(r.status).toBe(200);
    expect(r.data.breed).toBe("Beetal");
  });

  it("worker cannot update animal — 403", async () => {
    const r = await call(U(52), "goat.animals.update", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, notes: "sneaky edit" },
    });
    expect(r.status).toBe(403);
  });

  it("400 when updating with invalid sex", async () => {
    const r = await call(U(50), "goat.animals.update", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, sex: "neuter" },
    });
    expect(r.status).toBe(400);
  });
});

/* ── setAnimalStatus ──────────────────────────────────────────────────────── */

describe("setAnimalStatus", () => {
  it("400 when status value is invalid", async () => {
    const r = await call(U(50), "goat.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, status: "fattening" },
    });
    expect(r.status).toBe(400);
  });

  it("worker cannot set status — 403", async () => {
    const r = await call(U(52), "goat.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, status: "dry" },
    });
    expect(r.status).toBe(403);
  });

  it("owner can advance status to breeding", async () => {
    const r = await call(U(50), "goat.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id, status: "grower" },
    });
    expect(r.status).toBe(200);
    expect(r.data.current_status).toBe("grower");
  });
});

/* ── milk records ─────────────────────────────────────────────────────────── */

describe("milk records", () => {
  it("listMilk for A1 returns seeded record", async () => {
    const r = await call(U(50), "goat.milk.list", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
    expect(r.data[0].animal_id).toBe(animalA1Id);
  });

  it("space-wide listMilk returns records with animal_name", async () => {
    const r = await call(U(50), "goat.milk.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data[0]).toHaveProperty("animal_name");
  });

  it("upsertMilk for existing date updates in place (same record ID)", async () => {
    const r = await call(U(52), "goat.milk.upsert", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, recordDate: "2026-09-01",
                  amYieldKg: 1.0, pmYieldKg: 0.9 },
    });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(milkRecordId);
    expect(Number(r.data.am_yield_kg)).toBe(1.0);
  });

  it("clientUuid idempotency on upsertMilk", async () => {
    const r1 = await call(U(52), "goat.milk.upsert", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, recordDate: "2026-09-10",
                  amYieldKg: 0.6, clientUuid: "goat-milk-idem-1" },
    });
    expect(r1.status).toBe(200);
    const r2 = await call(U(52), "goat.milk.upsert", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, recordDate: "2026-09-10",
                  amYieldKg: 0.6, clientUuid: "goat-milk-idem-1" },
    });
    expect(r2.status).toBe(200);
    expect(r2.data.id).toBe(r1.data.id);
  });

  it("worker (farm.goat.record) can upsert milk — 200", async () => {
    const r = await call(U(52), "goat.milk.upsert", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, recordDate: "2026-09-11",
                  amYieldKg: 0.5, clientUuid: "goat-milk-worker-1" },
    });
    expect(r.status).toBe(200);
  });

  it("deleteMilk soft-deletes the record", async () => {
    const create = await call(U(52), "goat.milk.upsert", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, recordDate: "2026-09-15",
                  amYieldKg: 0.4, clientUuid: "goat-milk-del-1" },
    });
    expect(create.status).toBe(200);
    const del = await call(U(52), "goat.milk.delete", {
      spaceId: spaceA.id, payload: { recordId: create.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });
});

/* ── weight records ───────────────────────────────────────────────────────── */

describe("weight records", () => {
  it("listWeight for A1 returns seeded weight", async () => {
    const r = await call(U(50), "goat.weight.list", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
    expect(Number(r.data[0].weight_kg)).toBe(28.5);
  });

  it("400 when weighDate is missing", async () => {
    const r = await call(U(52), "goat.weight.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, weightKg: 30 },
    });
    expect(r.status).toBe(400);
  });

  it("400 when weightKg is zero", async () => {
    const r = await call(U(52), "goat.weight.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, weighDate: "2026-09-20", weightKg: 0 },
    });
    expect(r.status).toBe(400);
  });

  it("clientUuid idempotency on addWeight", async () => {
    const r1 = await call(U(52), "goat.weight.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, weighDate: "2026-09-20",
                  weightKg: 29.0, clientUuid: "goat-wt-idem-1" },
    });
    expect(r1.status).toBe(200);
    const r2 = await call(U(52), "goat.weight.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, weighDate: "2026-09-20",
                  weightKg: 29.0, clientUuid: "goat-wt-idem-1" },
    });
    expect(r2.status).toBe(200);
    expect(r2.data.id).toBe(r1.data.id);
  });

  it("deleteWeight soft-deletes the record", async () => {
    const del = await call(U(52), "goat.weight.delete", {
      spaceId: spaceA.id, payload: { weightId: weightRecordId },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });

  it("400 when weightId is missing from delete", async () => {
    const r = await call(U(50), "goat.weight.delete", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(400);
  });
});

/* ── reproductive events ──────────────────────────────────────────────────── */

describe("reproductive events", () => {
  it("listRepro returns seeded mating event", async () => {
    const r = await call(U(50), "goat.repro.list", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
    expect(r.data[0].event_type).toBe("mating");
  });

  it("400 when eventType is invalid", async () => {
    const r = await call(U(51), "goat.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-10",
                  eventType: "calving" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when eventDate is missing", async () => {
    const r = await call(U(51), "goat.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventType: "kidding" },
    });
    expect(r.status).toBe(400);
  });

  it("kidding event is valid and accepted", async () => {
    const r = await call(U(51), "goat.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-12",
                  eventType: "kidding", kidCount: 2, kidSex: "female",
                  kidAlive: true, clientUuid: "goat-kidding-1" },
    });
    expect(r.status).toBe(200);
    expect(r.data.event_type).toBe("kidding");
    expect(r.data.kid_count).toBe(2);
  });

  it("updateRepro changes persist", async () => {
    const r = await call(U(51), "goat.repro.update", {
      spaceId: spaceA.id,
      payload: { eventId: reproEventId, buckName: "Updated Buck" },
    });
    expect(r.status).toBe(200);
    expect(r.data.buck_name).toBe("Updated Buck");
  });

  it("400 when updateRepro is given invalid eventType", async () => {
    const r = await call(U(51), "goat.repro.update", {
      spaceId: spaceA.id,
      payload: { eventId: reproEventId, eventType: "calving" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when updateRepro has no eventId", async () => {
    const r = await call(U(51), "goat.repro.update", {
      spaceId: spaceA.id, payload: { notes: "no eventId" },
    });
    expect(r.status).toBe(400);
  });

  it("worker (farm.goat.record) can add repro event — 200", async () => {
    const r = await call(U(52), "goat.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-13",
                  eventType: "heat_observed", clientUuid: "goat-repro-worker-1" },
    });
    expect(r.status).toBe(200);
  });

  it("404 on non-existent eventId in deleteRepro", async () => {
    const r = await call(U(50), "goat.repro.delete", {
      spaceId: spaceA.id,
      payload: { eventId: "00000000-0000-0000-0000-000000000099" },
    });
    expect(r.status).toBe(404);
  });

  it("deleteRepro soft-deletes event", async () => {
    const add = await call(U(51), "goat.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-14",
                  eventType: "weaning", clientUuid: "goat-repro-del-1" },
    });
    expect(add.status).toBe(200);
    const del = await call(U(51), "goat.repro.delete", {
      spaceId: spaceA.id, payload: { eventId: add.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });
});

/* ── health events ────────────────────────────────────────────────────────── */

describe("health events", () => {
  it("listHealth returns seeded vaccination event", async () => {
    const r = await call(U(50), "goat.health.list", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.some(h => h.event_type === "vaccination")).toBe(true);
  });

  it("400 when title is missing from addHealth", async () => {
    const r = await call(U(51), "goat.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-10",
                  eventType: "vaccination" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when eventType is invalid in addHealth", async () => {
    const r = await call(U(51), "goat.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-10",
                  eventType: "surgery", title: "Op" },
    });
    expect(r.status).toBe(400);
  });

  it("updateHealth changes persist", async () => {
    const r = await call(U(51), "goat.health.update", {
      spaceId: spaceA.id,
      payload: { eventId: healthEventId, medicine: "PPR-Vax", dose: "2ml IM" },
    });
    expect(r.status).toBe(200);
    expect(r.data.medicine).toBe("PPR-Vax");
  });

  it("400 when updateHealth title is empty string", async () => {
    const r = await call(U(51), "goat.health.update", {
      spaceId: spaceA.id,
      payload: { eventId: healthEventId, title: "" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when updateHealth has no eventId", async () => {
    const r = await call(U(51), "goat.health.update", {
      spaceId: spaceA.id, payload: { title: "Orphan" },
    });
    expect(r.status).toBe(400);
  });

  it("cross-space: Farm B manager cannot update Farm A health event — 404", async () => {
    const r = await call(U(61), "goat.health.update", {
      spaceId: spaceB.id,
      payload: { eventId: healthEventId, notes: "xss" },
    });
    expect(r.status).toBe(404);
  });

  it("worker (farm.goat.record) can update health event — 200", async () => {
    const r = await call(U(52), "goat.health.update", {
      spaceId: spaceA.id,
      payload: { eventId: healthEventId, notes: "worker note" },
    });
    expect(r.status).toBe(200);
  });

  it("404 on non-existent eventId in updateHealth", async () => {
    const r = await call(U(50), "goat.health.update", {
      spaceId: spaceA.id,
      payload: { eventId: "00000000-0000-0000-0000-000000000099", title: "Ghost" },
    });
    expect(r.status).toBe(404);
  });

  it("deleteHealth soft-deletes event", async () => {
    const add = await call(U(51), "goat.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-16",
                  eventType: "deworming", title: "Ivermectin", clientUuid: "goat-health-del-1" },
    });
    expect(add.status).toBe(200);
    const del = await call(U(51), "goat.health.delete", {
      spaceId: spaceA.id, payload: { eventId: add.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });
});

/* ── feed records ─────────────────────────────────────────────────────────── */

describe("feed records", () => {
  it("listFeed returns seeded record", async () => {
    const r = await call(U(50), "goat.feed.list", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
  });

  it("400 when feedType is invalid", async () => {
    const r = await call(U(52), "goat.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-10", feedType: "hay" },
    });
    expect(r.status).toBe(400);
  });

  it("browse feedType is valid (goat-specific)", async () => {
    const r = await call(U(52), "goat.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-10",
                  feedType: "browse", quantityKg: 1.5, clientUuid: "goat-feed-browse-1" },
    });
    expect(r.status).toBe(200);
    expect(r.data.feed_type).toBe("browse");
  });

  it("updateFeed changes persist", async () => {
    const r = await call(U(52), "goat.feed.update", {
      spaceId: spaceA.id,
      payload: { feedId: feedRecordId, quantityKg: 0.7, notes: "Extra ration" },
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.quantity_kg)).toBe(0.7);
  });

  it("updateFeed 400 when feedType is invalid", async () => {
    const r = await call(U(52), "goat.feed.update", {
      spaceId: spaceA.id,
      payload: { feedId: feedRecordId, feedType: "hay" },
    });
    expect(r.status).toBe(400);
  });

  it("deleteFeed soft-deletes", async () => {
    const add = await call(U(52), "goat.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-17",
                  feedType: "mineral", clientUuid: "goat-feed-del-1" },
    });
    expect(add.status).toBe(200);
    const del = await call(U(52), "goat.feed.delete", {
      spaceId: spaceA.id, payload: { feedId: add.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });
});

/* ── herd metrics ─────────────────────────────────────────────────────────── */

describe("herdMetrics", () => {
  it("returns expected keys", async () => {
    const r = await call(U(50), "goat.metrics", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("status_counts");
    expect(r.data).toHaveProperty("today_milk_kg");
    expect(r.data).toHaveProperty("month_milk_kg");
    expect(r.data).toHaveProperty("health_due_in_14_days");
    expect(r.data).toHaveProperty("health_overdue_count");
    expect(r.data).toHaveProperty("kidding_expected_count");
  });

  it("status_counts reflects created animals", async () => {
    const r = await call(U(50), "goat.metrics", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    expect(r.data.status_counts).toHaveProperty("milking");
  });

  it("worker can view herd metrics", async () => {
    const r = await call(U(52), "goat.metrics", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
  });
});

/* ── animal history ───────────────────────────────────────────────────────── */

describe("animalHistory", () => {
  it("returns animal + history array including weight_record kind", async () => {
    // Re-add a weight so history has at least one
    await call(U(52), "goat.weight.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, weighDate: "2026-09-02",
                  weightKg: 27.0, clientUuid: "goat-wt-hist-1" },
    });

    const r = await call(U(50), "goat.animal.history", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.animal.id).toBe(animalA1Id);
    expect(Array.isArray(r.data.history)).toBe(true);
    const kinds = r.data.history.map(h => h.kind);
    expect(kinds).toContain("weight_record");
    expect(kinds).toContain("milk_record");
  });
});

/* ── overdue_count ────────────────────────────────────────────────────────── */

describe("overdue_count in listAnimals", () => {
  it("animal with past next_due_date gets overdue_count = 1", async () => {
    // seeded health event has next_due_date in the past (2026-03-05)
    const r = await call(U(50), "goat.animals.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    const a1 = r.data.find(a => a.id === animalA1Id);
    expect(a1).toBeTruthy();
    expect(a1.overdue_count).toBeGreaterThanOrEqual(1);
  });

  it("animal with no health events has overdue_count = 0", async () => {
    // Create a fresh animal with no events
    const fresh = await call(U(50), "goat.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "CleanSlate", species: "goat",
                  clientUuid: "goat-overdue-clean-1" },
    });
    expect(fresh.status).toBe(200);

    const r = await call(U(50), "goat.animals.list", {
      spaceId: spaceA.id, payload: {},
    });
    const cleanAnimal = r.data.find(a => a.id === fresh.data.id);
    expect(cleanAnimal).toBeTruthy();
    expect(cleanAnimal.overdue_count).toBe(0);
  });

  it("soft-deleted health events are excluded from overdue_count", async () => {
    const fresh = await call(U(50), "goat.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "OverdueThenDeleted", species: "goat",
                  clientUuid: "goat-overdue-del-clean-1" },
    });
    expect(fresh.status).toBe(200);
    const fid = fresh.data.id;

    const h = await call(U(51), "goat.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: fid, eventDate: "2026-09-01",
                  eventType: "deworming", title: "Test", nextDueDate: "2026-01-01",
                  clientUuid: "goat-overdue-del-health-1" },
    });
    expect(h.status).toBe(200);

    await call(U(51), "goat.health.delete", {
      spaceId: spaceA.id, payload: { eventId: h.data.id },
    });

    const r = await call(U(50), "goat.animals.list", {
      spaceId: spaceA.id, payload: {},
    });
    const found = r.data.find(a => a.id === fid);
    expect(found?.overdue_count ?? 0).toBe(0);
  });
});

/* ── terminal write-protection ────────────────────────────────────────────── */

describe("terminal write-protection", () => {
  let terminalId;

  beforeAll(async () => {
    const c = await call(U(50), "goat.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "Sold Goat", species: "goat",
                  currentStatus: "milking", clientUuid: "goat-terminal-1" },
    });
    expect(c.status).toBe(200);
    terminalId = c.data.id;

    const s = await call(U(50), "goat.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, status: "sold" },
    });
    expect(s.status).toBe(200);
  });

  it("409 on setStatus transition out of terminal", async () => {
    const r = await call(U(50), "goat.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, status: "milking" },
    });
    expect(r.status).toBe(409);
  });

  it("409 on upsertMilk for terminal animal", async () => {
    const r = await call(U(52), "goat.milk.upsert", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, recordDate: "2026-09-10", amYieldKg: 1 },
    });
    expect(r.status).toBe(409);
  });

  it("409 on addWeight for terminal animal", async () => {
    const r = await call(U(52), "goat.weight.add", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, weighDate: "2026-09-10", weightKg: 30 },
    });
    expect(r.status).toBe(409);
  });

  it("409 on addRepro for terminal animal", async () => {
    const r = await call(U(51), "goat.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, eventDate: "2026-09-10", eventType: "mating" },
    });
    expect(r.status).toBe(409);
  });

  it("409 on addHealth for terminal animal", async () => {
    const r = await call(U(51), "goat.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, eventDate: "2026-09-10",
                  eventType: "vaccination", title: "Blocked" },
    });
    expect(r.status).toBe(409);
  });

  it("409 on addFeed for terminal animal", async () => {
    const r = await call(U(52), "goat.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, feedDate: "2026-09-10", feedType: "concentrate" },
    });
    expect(r.status).toBe(409);
  });

  it("409 on updateAnimal for terminal animal", async () => {
    const r = await call(U(50), "goat.animals.update", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, notes: "ghost edit" },
    });
    expect(r.status).toBe(409);
  });
});

/* ── finance (farm.goat.finance permission) ───────────────────────────────── */

describe("finance operations", () => {
  it("worker cannot add sale — 403", async () => {
    const r = await call(U(52), "goat.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-01", saleType: "milk", amount: 500 },
    });
    expect(r.status).toBe(403);
  });

  it("manager can add milk sale", async () => {
    const r = await call(U(51), "goat.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-01", saleType: "milk", buyer: "Local dairy",
                  quantity: 25, unit: "kg", unitPrice: 40,
                  amount: 1000, clientUuid: "goat-sale-milk-1" },
    });
    expect(r.status).toBe(200);
    expect(r.data.sale_type).toBe("milk");
  });

  it("manager can add animal sale", async () => {
    const r = await call(U(51), "goat.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-05", saleType: "animal",
                  buyer: "Butcher", quantity: 1, unit: "head",
                  amount: 5000, clientUuid: "goat-sale-animal-1" },
    });
    expect(r.status).toBe(200);
  });

  it("fiber sale type is accepted", async () => {
    const r = await call(U(51), "goat.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-06", saleType: "fiber",
                  quantity: 2.5, unit: "kg", amount: 300,
                  clientUuid: "goat-sale-fiber-1" },
    });
    expect(r.status).toBe(200);
  });

  it("400 when sale_type is invalid", async () => {
    const r = await call(U(51), "goat.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-01", saleType: "wool", amount: 100 },
    });
    expect(r.status).toBe(400);
  });

  it("400 when amount is zero", async () => {
    const r = await call(U(51), "goat.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-01", saleType: "milk", amount: 0 },
    });
    expect(r.status).toBe(400);
  });

  it("listSales returns added sales", async () => {
    const r = await call(U(51), "goat.sales.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(2);
  });

  it("deleteSale soft-deletes", async () => {
    const add = await call(U(51), "goat.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-07", saleType: "other",
                  amount: 200, clientUuid: "goat-sale-del-1" },
    });
    expect(add.status).toBe(200);
    const del = await call(U(51), "goat.sales.delete", {
      spaceId: spaceA.id, payload: { saleId: add.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });

  it("manager can add cost", async () => {
    const r = await call(U(51), "goat.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-01", category: "concentrate_feed",
                  description: "Pellets 25kg", amount: 750,
                  clientUuid: "goat-cost-1" },
    });
    expect(r.status).toBe(200);
  });

  it("fiber_shearing category is valid", async () => {
    const r = await call(U(51), "goat.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-08", category: "fiber_shearing",
                  description: "Wool shearer fee", amount: 300,
                  clientUuid: "goat-cost-shearing-1" },
    });
    expect(r.status).toBe(200);
    expect(r.data.category).toBe("fiber_shearing");
  });

  it("400 when cost category is invalid", async () => {
    const r = await call(U(51), "goat.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-01", category: "ai_cost",
                  description: "invalid", amount: 100 },
    });
    expect(r.status).toBe(400);
  });

  it("listCosts returns added costs", async () => {
    const r = await call(U(51), "goat.costs.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
  });

  it("deleteCost soft-deletes", async () => {
    const add = await call(U(51), "goat.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-09", category: "labour",
                  description: "Daily herder", amount: 250,
                  clientUuid: "goat-cost-del-1" },
    });
    expect(add.status).toBe(200);
    const del = await call(U(51), "goat.costs.delete", {
      spaceId: spaceA.id, payload: { costId: add.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });

  it("financeSummary returns expected keys", async () => {
    const r = await call(U(51), "goat.finance.summary", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("period");
    expect(r.data).toHaveProperty("total_revenue");
    expect(r.data).toHaveProperty("total_costs");
    expect(r.data).toHaveProperty("net_profit");
    expect(r.data).toHaveProperty("sales_breakdown");
    expect(r.data).toHaveProperty("cost_breakdown");
    expect(r.data).toHaveProperty("month_milk_produced_kg");
  });

  it("financeSummary revenue > 0 after adding sales", async () => {
    const r = await call(U(51), "goat.finance.summary", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data.total_revenue).toBeGreaterThan(0);
  });

  it("worker cannot access financeSummary — 403", async () => {
    const r = await call(U(52), "goat.finance.summary", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(403);
  });
});
