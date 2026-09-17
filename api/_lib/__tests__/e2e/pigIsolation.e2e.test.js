/* Pig P1 — isolation, RBAC, clean-state, and write-protection e2e tests.
 *
 * Farm A: owner U(70), manager U(71), worker U(72)
 * Farm B: owner U(80), manager U(81)
 *
 * These tests drive the REAL /api/farm handler through the six-step auth gate
 * using the PGlite harness — same path as production, no HTTP transport.
 *
 * Pig differences vs goat:
 *   - No milk records (farrowing litter data lives on repro events instead)
 *   - Sex: boar|sow|gilt|barrow|unknown
 *   - Status: piglet|grower|finisher|breeder (active) + terminal
 *   - Repro: farrowing (not kidding), litter_size/live_born/still_born/weaned_count/boar_name
 *   - Feed types: starter|grower_feed|finisher_feed|sow_feed|concentrate|other
 *   - Sales: live_animal|pork|piglet|other
 *   - Costs: feed|medicine|labour|veterinary|equipment|housing|other
 *   - herdMetrics: month_avg_weight_kg / month_animals_weighed, farrowing_expected_count */

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
let weightRecordId, reproEventId, healthEventId, feedRecordId;

beforeAll(async () => {
  await freshDb();

  const farmA = await buildFarm(70, "Farm A Pig", { managers: [71], workers: [72] });
  const farmB = await buildFarm(80, "Farm B Pig", { managers: [81] });
  spaceA = farmA.space;
  spaceB = farmB.space;

  // Create animals in Farm A
  const a1 = await call(U(70), "pig.animals.create", {
    spaceId: spaceA.id,
    payload: { name: "Moti", sex: "sow", breed: "Landrace",
                currentStatus: "breeder", clientUuid: "pig-a1-create" },
  });
  expect(a1.status).toBe(200);
  animalA1Id = a1.data.id;

  const a2 = await call(U(70), "pig.animals.create", {
    spaceId: spaceA.id,
    payload: { name: "Chotu", sex: "barrow", breed: "Desi",
                currentStatus: "grower", clientUuid: "pig-a2-create" },
  });
  expect(a2.status).toBe(200);
  animalA2Id = a2.data.id;

  // Populate A1: weight, repro, health, feed
  const weight = await call(U(72), "pig.weight.add", {
    spaceId: spaceA.id,
    payload: { animalId: animalA1Id, weighDate: "2026-09-01",
                weightKg: 80.5, clientUuid: "pig-weight-a1-0901" },
  });
  expect(weight.status).toBe(200);
  weightRecordId = weight.data.id;

  const repro = await call(U(71), "pig.repro.add", {
    spaceId: spaceA.id,
    payload: { animalId: animalA1Id, eventDate: "2026-08-20",
                eventType: "mating", boarName: "Raja", clientUuid: "pig-repro-a1-0820" },
  });
  expect(repro.status).toBe(200);
  reproEventId = repro.data.id;

  const health = await call(U(71), "pig.health.add", {
    spaceId: spaceA.id,
    payload: { animalId: animalA1Id, eventDate: "2026-09-05",
                eventType: "vaccination", title: "PRRS Vaccine",
                nextDueDate: "2026-03-05", clientUuid: "pig-health-a1-0905" },
  });
  expect(health.status).toBe(200);
  healthEventId = health.data.id;

  const feed = await call(U(72), "pig.feed.add", {
    spaceId: spaceA.id,
    payload: { animalId: animalA1Id, feedDate: "2026-09-01",
                feedType: "sow_feed", quantityKg: 2.5, clientUuid: "pig-feed-a1-0901" },
  });
  expect(feed.status).toBe(200);
  feedRecordId = feed.data.id;

  // Create animal in Farm B
  const b1 = await call(U(80), "pig.animals.create", {
    spaceId: spaceB.id,
    payload: { name: "Kaalu", sex: "boar", breed: "Yorkshire",
                clientUuid: "pig-b1-create" },
  });
  expect(b1.status).toBe(200);
  animalB1Id = b1.data.id;
}, 60_000);

/* ── cross-animal isolation ───────────────────────────────────────────────── */

describe("cross-animal isolation", () => {
  it("A2 has no weight records from A1", async () => {
    const r = await call(U(70), "pig.weight.list", {
      spaceId: spaceA.id, payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("A2 has no repro events from A1", async () => {
    const r = await call(U(70), "pig.repro.list", {
      spaceId: spaceA.id, payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("A2 has no health events from A1", async () => {
    const r = await call(U(70), "pig.health.list", {
      spaceId: spaceA.id, payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("A2 has no feed records from A1", async () => {
    const r = await call(U(70), "pig.feed.list", {
      spaceId: spaceA.id, payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });
});

/* ── cross-space isolation ────────────────────────────────────────────────── */

describe("cross-space isolation", () => {
  it("Farm B owner cannot access Farm A animal", async () => {
    const r = await call(U(80), "pig.animals.get", {
      spaceId: spaceB.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(404);
  });

  it("Farm A owner cannot access Farm B animal", async () => {
    const r = await call(U(70), "pig.animals.get", {
      spaceId: spaceA.id, payload: { animalId: animalB1Id },
    });
    expect(r.status).toBe(404);
  });

  it("Farm A worker using spaceB.id gets 404 (space not visible to non-member)", async () => {
    const r = await call(U(72), "pig.animals.list", {
      spaceId: spaceB.id, payload: {},
    });
    expect(r.status).toBe(404);
  });

  it("Farm B manager cannot add weight to Farm A animal via spaceB", async () => {
    const r = await call(U(81), "pig.weight.add", {
      spaceId: spaceB.id,
      payload: { animalId: animalA1Id, weighDate: "2026-09-10", weightKg: 90 },
    });
    expect(r.status).toBe(404);
  });
});

/* ── listAnimals ──────────────────────────────────────────────────────────── */

describe("listAnimals", () => {
  it("owner sees active animals only by default", async () => {
    const r = await call(U(70), "pig.animals.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(2);
    expect(r.data.every(a => !["sold","deceased","retired"].includes(a.current_status))).toBe(true);
  });

  it("listAnimals with statusFilter=grower returns only growers", async () => {
    const r = await call(U(70), "pig.animals.list", {
      spaceId: spaceA.id, payload: { statusFilter: "grower" },
    });
    expect(r.status).toBe(200);
    expect(r.data.every(a => a.current_status === "grower")).toBe(true);
  });

  it("every row has numeric overdue_count", async () => {
    const r = await call(U(70), "pig.animals.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    for (const a of r.data) {
      expect(typeof a.overdue_count).toBe("number");
    }
  });

  it("manager can list animals", async () => {
    const r = await call(U(71), "pig.animals.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
  });

  it("worker can list animals (view permission)", async () => {
    const r = await call(U(72), "pig.animals.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
  });
});

/* ── getAnimal ────────────────────────────────────────────────────────────── */

describe("getAnimal", () => {
  it("returns last_weight and last_repro_event (no last_milk_record)", async () => {
    const r = await call(U(70), "pig.animals.get", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.last_weight).not.toBeNull();
    expect(Number(r.data.last_weight.weight_kg)).toBe(80.5);
    expect(r.data.last_repro_event).not.toBeNull();
    expect(r.data).not.toHaveProperty("last_milk_record");
  });

  it("returns null last_weight for an animal with no weighings", async () => {
    const r = await call(U(70), "pig.animals.get", {
      spaceId: spaceA.id, payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.last_weight).toBeNull();
    expect(r.data.last_repro_event).toBeNull();
  });
});

/* ── createAnimal validation ──────────────────────────────────────────────── */

describe("createAnimal validation", () => {
  it("400 when name is missing", async () => {
    const r = await call(U(70), "pig.animals.create", {
      spaceId: spaceA.id, payload: { sex: "sow" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when sex is invalid", async () => {
    const r = await call(U(70), "pig.animals.create", {
      spaceId: spaceA.id, payload: { name: "Test", sex: "heifer" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when currentStatus is terminal", async () => {
    const r = await call(U(70), "pig.animals.create", {
      spaceId: spaceA.id, payload: { name: "Test", currentStatus: "sold" },
    });
    expect(r.status).toBe(400);
  });

  it("worker (farm.pig.record) cannot create animal — 403", async () => {
    const r = await call(U(72), "pig.animals.create", {
      spaceId: spaceA.id, payload: { name: "Sneaky", sex: "gilt" },
    });
    expect(r.status).toBe(403);
  });

  it("clientUuid idempotency — same request returns existing row", async () => {
    const r1 = await call(U(70), "pig.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "IdemPig", sex: "gilt", clientUuid: "pig-idem-test-1" },
    });
    expect(r1.status).toBe(200);
    const r2 = await call(U(70), "pig.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "IdemPig", sex: "gilt", clientUuid: "pig-idem-test-1" },
    });
    expect(r2.status).toBe(200);
    expect(r2.data.id).toBe(r1.data.id);
  });

  it("boar sex is accepted and stored", async () => {
    const r = await call(U(70), "pig.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "BigBoar", sex: "boar", clientUuid: "pig-boar-create-1" },
    });
    expect(r.status).toBe(200);
    expect(r.data.sex).toBe("boar");
  });
});

/* ── updateAnimal ─────────────────────────────────────────────────────────── */

describe("updateAnimal", () => {
  it("manager can update breed and notes", async () => {
    const r = await call(U(71), "pig.animals.update", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, breed: "Duroc", notes: "Updated by manager" },
    });
    expect(r.status).toBe(200);
    expect(r.data.breed).toBe("Duroc");
  });

  it("worker cannot update animal — 403", async () => {
    const r = await call(U(72), "pig.animals.update", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, notes: "sneaky edit" },
    });
    expect(r.status).toBe(403);
  });

  it("400 when updating with invalid sex", async () => {
    const r = await call(U(70), "pig.animals.update", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, sex: "hen" },
    });
    expect(r.status).toBe(400);
  });
});

/* ── setAnimalStatus ──────────────────────────────────────────────────────── */

describe("setAnimalStatus", () => {
  it("400 when status value is invalid", async () => {
    const r = await call(U(70), "pig.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, status: "milking" },
    });
    expect(r.status).toBe(400);
  });

  it("worker cannot set status — 403", async () => {
    const r = await call(U(72), "pig.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, status: "finisher" },
    });
    expect(r.status).toBe(403);
  });

  it("owner can advance status to finisher", async () => {
    const r = await call(U(70), "pig.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id, status: "finisher" },
    });
    expect(r.status).toBe(200);
    expect(r.data.current_status).toBe("finisher");
  });
});

/* ── weight records ───────────────────────────────────────────────────────── */

describe("weight records", () => {
  it("listWeight for A1 returns seeded weight", async () => {
    const r = await call(U(70), "pig.weight.list", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
    expect(Number(r.data[0].weight_kg)).toBe(80.5);
  });

  it("400 when weighDate is missing", async () => {
    const r = await call(U(72), "pig.weight.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, weightKg: 85 },
    });
    expect(r.status).toBe(400);
  });

  it("400 when weightKg is zero", async () => {
    const r = await call(U(72), "pig.weight.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, weighDate: "2026-09-20", weightKg: 0 },
    });
    expect(r.status).toBe(400);
  });

  it("clientUuid idempotency on addWeight", async () => {
    const r1 = await call(U(72), "pig.weight.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, weighDate: "2026-09-20",
                  weightKg: 82.0, clientUuid: "pig-wt-idem-1" },
    });
    expect(r1.status).toBe(200);
    const r2 = await call(U(72), "pig.weight.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, weighDate: "2026-09-20",
                  weightKg: 82.0, clientUuid: "pig-wt-idem-1" },
    });
    expect(r2.status).toBe(200);
    expect(r2.data.id).toBe(r1.data.id);
  });

  it("deleteWeight soft-deletes the record", async () => {
    const del = await call(U(72), "pig.weight.delete", {
      spaceId: spaceA.id, payload: { weightId: weightRecordId },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });

  it("400 when weightId is missing from delete", async () => {
    const r = await call(U(70), "pig.weight.delete", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(400);
  });
});

/* ── reproductive events ──────────────────────────────────────────────────── */

describe("reproductive events", () => {
  it("listRepro returns seeded mating event", async () => {
    const r = await call(U(70), "pig.repro.list", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
    expect(r.data[0].event_type).toBe("mating");
  });

  it("400 when eventType is invalid (goat-specific type rejected)", async () => {
    const r = await call(U(71), "pig.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-10",
                  eventType: "kidding" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when eventDate is missing", async () => {
    const r = await call(U(71), "pig.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventType: "farrowing" },
    });
    expect(r.status).toBe(400);
  });

  it("farrowing event with litter data is valid and accepted", async () => {
    const r = await call(U(71), "pig.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-12",
                  eventType: "farrowing", litterSize: 10, liveBorn: 9,
                  stillBorn: 1, weanedCount: 0, clientUuid: "pig-farrowing-1" },
    });
    expect(r.status).toBe(200);
    expect(r.data.event_type).toBe("farrowing");
    expect(r.data.litter_size).toBe(10);
    expect(r.data.live_born).toBe(9);
    expect(r.data.still_born).toBe(1);
  });

  it("updateRepro changes persist (boarName)", async () => {
    const r = await call(U(71), "pig.repro.update", {
      spaceId: spaceA.id,
      payload: { eventId: reproEventId, boarName: "Updated Boar" },
    });
    expect(r.status).toBe(200);
    expect(r.data.boar_name).toBe("Updated Boar");
  });

  it("400 when updateRepro is given invalid eventType", async () => {
    const r = await call(U(71), "pig.repro.update", {
      spaceId: spaceA.id,
      payload: { eventId: reproEventId, eventType: "kidding" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when updateRepro has no eventId", async () => {
    const r = await call(U(71), "pig.repro.update", {
      spaceId: spaceA.id, payload: { notes: "no eventId" },
    });
    expect(r.status).toBe(400);
  });

  it("worker (farm.pig.record) can add repro event — 200", async () => {
    const r = await call(U(72), "pig.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-13",
                  eventType: "heat_observed", clientUuid: "pig-repro-worker-1" },
    });
    expect(r.status).toBe(200);
  });

  it("404 on non-existent eventId in deleteRepro", async () => {
    const r = await call(U(70), "pig.repro.delete", {
      spaceId: spaceA.id,
      payload: { eventId: "00000000-0000-0000-0000-000000000099" },
    });
    expect(r.status).toBe(404);
  });

  it("deleteRepro soft-deletes event", async () => {
    const add = await call(U(71), "pig.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-14",
                  eventType: "weaning", clientUuid: "pig-repro-del-1" },
    });
    expect(add.status).toBe(200);
    const del = await call(U(71), "pig.repro.delete", {
      spaceId: spaceA.id, payload: { eventId: add.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });
});

/* ── health events ────────────────────────────────────────────────────────── */

describe("health events", () => {
  it("listHealth returns seeded vaccination event", async () => {
    const r = await call(U(70), "pig.health.list", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.some(h => h.event_type === "vaccination")).toBe(true);
  });

  it("400 when title is missing from addHealth", async () => {
    const r = await call(U(71), "pig.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-10",
                  eventType: "vaccination" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when eventType is invalid in addHealth", async () => {
    const r = await call(U(71), "pig.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-10",
                  eventType: "surgery", title: "Op" },
    });
    expect(r.status).toBe(400);
  });

  it("updateHealth changes persist", async () => {
    const r = await call(U(71), "pig.health.update", {
      spaceId: spaceA.id,
      payload: { eventId: healthEventId, medicine: "PRRS-Vax", dose: "2ml IM" },
    });
    expect(r.status).toBe(200);
    expect(r.data.medicine).toBe("PRRS-Vax");
  });

  it("400 when updateHealth title is empty string", async () => {
    const r = await call(U(71), "pig.health.update", {
      spaceId: spaceA.id,
      payload: { eventId: healthEventId, title: "" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when updateHealth has no eventId", async () => {
    const r = await call(U(71), "pig.health.update", {
      spaceId: spaceA.id, payload: { title: "Orphan" },
    });
    expect(r.status).toBe(400);
  });

  it("cross-space: Farm B manager cannot update Farm A health event — 404", async () => {
    const r = await call(U(81), "pig.health.update", {
      spaceId: spaceB.id,
      payload: { eventId: healthEventId, notes: "xss" },
    });
    expect(r.status).toBe(404);
  });

  it("worker (farm.pig.record) can update health event — 200", async () => {
    const r = await call(U(72), "pig.health.update", {
      spaceId: spaceA.id,
      payload: { eventId: healthEventId, notes: "worker note" },
    });
    expect(r.status).toBe(200);
  });

  it("404 on non-existent eventId in updateHealth", async () => {
    const r = await call(U(70), "pig.health.update", {
      spaceId: spaceA.id,
      payload: { eventId: "00000000-0000-0000-0000-000000000099", title: "Ghost" },
    });
    expect(r.status).toBe(404);
  });

  it("deleteHealth soft-deletes event", async () => {
    const add = await call(U(71), "pig.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-16",
                  eventType: "deworming", title: "Ivermectin", clientUuid: "pig-health-del-1" },
    });
    expect(add.status).toBe(200);
    const del = await call(U(71), "pig.health.delete", {
      spaceId: spaceA.id, payload: { eventId: add.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });
});

/* ── feed records ─────────────────────────────────────────────────────────── */

describe("feed records", () => {
  it("listFeed returns seeded record", async () => {
    const r = await call(U(70), "pig.feed.list", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
  });

  it("400 when feedType is invalid (goat type rejected)", async () => {
    const r = await call(U(72), "pig.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-10", feedType: "browse" },
    });
    expect(r.status).toBe(400);
  });

  it("sow_feed feedType is valid (pig-specific)", async () => {
    const r = await call(U(72), "pig.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-10",
                  feedType: "sow_feed", quantityKg: 3.0, clientUuid: "pig-feed-sowfeed-1" },
    });
    expect(r.status).toBe(200);
    expect(r.data.feed_type).toBe("sow_feed");
  });

  it("finisher_feed feedType is valid", async () => {
    const r = await call(U(72), "pig.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id, feedDate: "2026-09-11",
                  feedType: "finisher_feed", quantityKg: 2.0, clientUuid: "pig-feed-finisher-1" },
    });
    expect(r.status).toBe(200);
    expect(r.data.feed_type).toBe("finisher_feed");
  });

  it("updateFeed changes persist", async () => {
    const r = await call(U(72), "pig.feed.update", {
      spaceId: spaceA.id,
      payload: { feedId: feedRecordId, quantityKg: 3.5, notes: "Extra ration" },
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.quantity_kg)).toBe(3.5);
  });

  it("updateFeed 400 when feedType is invalid", async () => {
    const r = await call(U(72), "pig.feed.update", {
      spaceId: spaceA.id,
      payload: { feedId: feedRecordId, feedType: "browse" },
    });
    expect(r.status).toBe(400);
  });

  it("deleteFeed soft-deletes", async () => {
    const add = await call(U(72), "pig.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-17",
                  feedType: "starter", clientUuid: "pig-feed-del-1" },
    });
    expect(add.status).toBe(200);
    const del = await call(U(72), "pig.feed.delete", {
      spaceId: spaceA.id, payload: { feedId: add.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });
});

/* ── herd metrics ─────────────────────────────────────────────────────────── */

describe("herdMetrics", () => {
  it("returns expected keys (no milk metrics, has weight metrics)", async () => {
    const r = await call(U(70), "pig.metrics", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("status_counts");
    expect(r.data).toHaveProperty("health_due_in_14_days");
    expect(r.data).toHaveProperty("health_overdue_count");
    expect(r.data).toHaveProperty("farrowing_expected_count");
    expect(r.data).toHaveProperty("month_avg_weight_kg");
    expect(r.data).toHaveProperty("month_animals_weighed");
    expect(r.data).not.toHaveProperty("today_milk_kg");
    expect(r.data).not.toHaveProperty("month_milk_kg");
  });

  it("status_counts reflects created animals", async () => {
    const r = await call(U(70), "pig.metrics", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    expect(r.data.status_counts).toHaveProperty("breeder");
  });

  it("month_animals_weighed > 0 after adding weights", async () => {
    const r = await call(U(70), "pig.metrics", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    expect(r.data.month_animals_weighed).toBeGreaterThan(0);
  });

  it("worker can view herd metrics", async () => {
    const r = await call(U(72), "pig.metrics", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
  });
});

/* ── animal history ───────────────────────────────────────────────────────── */

describe("animalHistory", () => {
  it("returns animal + history with weight_record and repro_event kinds (no milk_record)", async () => {
    await call(U(72), "pig.weight.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, weighDate: "2026-09-02",
                  weightKg: 78.0, clientUuid: "pig-wt-hist-1" },
    });

    const r = await call(U(70), "pig.animal.history", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.animal.id).toBe(animalA1Id);
    expect(Array.isArray(r.data.history)).toBe(true);
    const kinds = new Set(r.data.history.map(h => h.kind));
    expect(kinds.has("weight_record")).toBe(true);
    expect(kinds.has("milk_record")).toBe(false);
  });
});

/* ── overdue_count in listAnimals ─────────────────────────────────────────── */

describe("overdue_count in listAnimals", () => {
  it("animal with past next_due_date gets overdue_count >= 1", async () => {
    // seeded health event has next_due_date 2026-03-05 (past)
    const r = await call(U(70), "pig.animals.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    const a1 = r.data.find(a => a.id === animalA1Id);
    expect(a1).toBeTruthy();
    expect(a1.overdue_count).toBeGreaterThanOrEqual(1);
  });

  it("animal with no health events has overdue_count = 0", async () => {
    const fresh = await call(U(70), "pig.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "CleanPig", sex: "gilt", clientUuid: "pig-overdue-clean-1" },
    });
    expect(fresh.status).toBe(200);

    const r = await call(U(70), "pig.animals.list", {
      spaceId: spaceA.id, payload: {},
    });
    const cleanAnimal = r.data.find(a => a.id === fresh.data.id);
    expect(cleanAnimal).toBeTruthy();
    expect(cleanAnimal.overdue_count).toBe(0);
  });

  it("soft-deleted health events are excluded from overdue_count", async () => {
    const fresh = await call(U(70), "pig.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "OverdueThenDeleted", sex: "barrow",
                  clientUuid: "pig-overdue-del-clean-1" },
    });
    expect(fresh.status).toBe(200);
    const fid = fresh.data.id;

    const h = await call(U(71), "pig.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: fid, eventDate: "2026-09-01",
                  eventType: "deworming", title: "Test", nextDueDate: "2026-01-01",
                  clientUuid: "pig-overdue-del-health-1" },
    });
    expect(h.status).toBe(200);

    await call(U(71), "pig.health.delete", {
      spaceId: spaceA.id, payload: { eventId: h.data.id },
    });

    const r = await call(U(70), "pig.animals.list", {
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
    const c = await call(U(70), "pig.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "Sold Pig", sex: "barrow",
                  currentStatus: "finisher", clientUuid: "pig-terminal-1" },
    });
    expect(c.status).toBe(200);
    terminalId = c.data.id;

    const s = await call(U(70), "pig.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, status: "sold" },
    });
    expect(s.status).toBe(200);
  });

  it("409 on setStatus transition out of terminal", async () => {
    const r = await call(U(70), "pig.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, status: "grower" },
    });
    expect(r.status).toBe(409);
  });

  it("409 on addWeight for terminal animal", async () => {
    const r = await call(U(72), "pig.weight.add", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, weighDate: "2026-09-10", weightKg: 90 },
    });
    expect(r.status).toBe(409);
  });

  it("409 on addRepro for terminal animal", async () => {
    const r = await call(U(71), "pig.repro.add", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, eventDate: "2026-09-10", eventType: "mating" },
    });
    expect(r.status).toBe(409);
  });

  it("409 on addHealth for terminal animal", async () => {
    const r = await call(U(71), "pig.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, eventDate: "2026-09-10",
                  eventType: "vaccination", title: "Blocked" },
    });
    expect(r.status).toBe(409);
  });

  it("409 on addFeed for terminal animal", async () => {
    const r = await call(U(72), "pig.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, feedDate: "2026-09-10", feedType: "concentrate" },
    });
    expect(r.status).toBe(409);
  });

  it("409 on updateAnimal for terminal animal", async () => {
    const r = await call(U(70), "pig.animals.update", {
      spaceId: spaceA.id,
      payload: { animalId: terminalId, notes: "ghost edit" },
    });
    expect(r.status).toBe(409);
  });
});

/* ── finance (farm.pig.finance permission) ────────────────────────────────── */

describe("finance operations", () => {
  it("worker cannot add sale — 403", async () => {
    const r = await call(U(72), "pig.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-01", saleType: "pork", amount: 800 },
    });
    expect(r.status).toBe(403);
  });

  it("manager can add pork sale", async () => {
    const r = await call(U(71), "pig.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-01", saleType: "pork", buyer: "Local butcher",
                  quantity: 50, unit: "kg", unitPrice: 200,
                  amount: 10000, clientUuid: "pig-sale-pork-1" },
    });
    expect(r.status).toBe(200);
    expect(r.data.sale_type).toBe("pork");
  });

  it("manager can add live_animal sale", async () => {
    const r = await call(U(71), "pig.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-05", saleType: "live_animal",
                  buyer: "Farmer", quantity: 2, unit: "head",
                  amount: 8000, clientUuid: "pig-sale-live-1" },
    });
    expect(r.status).toBe(200);
  });

  it("piglet sale type is accepted", async () => {
    const r = await call(U(71), "pig.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-06", saleType: "piglet",
                  quantity: 5, unit: "head", amount: 2500,
                  clientUuid: "pig-sale-piglet-1" },
    });
    expect(r.status).toBe(200);
  });

  it("400 when sale_type is invalid (goat type rejected)", async () => {
    const r = await call(U(71), "pig.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-01", saleType: "milk", amount: 100 },
    });
    expect(r.status).toBe(400);
  });

  it("400 when amount is zero", async () => {
    const r = await call(U(71), "pig.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-01", saleType: "pork", amount: 0 },
    });
    expect(r.status).toBe(400);
  });

  it("listSales returns added sales", async () => {
    const r = await call(U(71), "pig.sales.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(2);
  });

  it("deleteSale soft-deletes", async () => {
    const add = await call(U(71), "pig.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-07", saleType: "other",
                  amount: 200, clientUuid: "pig-sale-del-1" },
    });
    expect(add.status).toBe(200);
    const del = await call(U(71), "pig.sales.delete", {
      spaceId: spaceA.id, payload: { saleId: add.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });

  it("manager can add feed cost", async () => {
    const r = await call(U(71), "pig.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-01", category: "feed",
                  description: "Grower feed 50kg", amount: 1200,
                  clientUuid: "pig-cost-1" },
    });
    expect(r.status).toBe(200);
  });

  it("housing category is valid (pig-specific)", async () => {
    const r = await call(U(71), "pig.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-08", category: "housing",
                  description: "Sty repair", amount: 500,
                  clientUuid: "pig-cost-housing-1" },
    });
    expect(r.status).toBe(200);
    expect(r.data.category).toBe("housing");
  });

  it("400 when cost category is invalid (goat-specific category rejected)", async () => {
    const r = await call(U(71), "pig.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-01", category: "fiber_shearing",
                  description: "invalid for pig", amount: 100 },
    });
    expect(r.status).toBe(400);
  });

  it("listCosts returns added costs", async () => {
    const r = await call(U(71), "pig.costs.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
  });

  it("deleteCost soft-deletes", async () => {
    const add = await call(U(71), "pig.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-09", category: "labour",
                  description: "Daily pigsty cleaner", amount: 300,
                  clientUuid: "pig-cost-del-1" },
    });
    expect(add.status).toBe(200);
    const del = await call(U(71), "pig.costs.delete", {
      spaceId: spaceA.id, payload: { costId: add.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });

  it("financeSummary returns expected keys (no month_milk_produced_kg)", async () => {
    const r = await call(U(71), "pig.finance.summary", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("period");
    expect(r.data).toHaveProperty("total_revenue");
    expect(r.data).toHaveProperty("total_costs");
    expect(r.data).toHaveProperty("net_profit");
    expect(r.data).toHaveProperty("sales_breakdown");
    expect(r.data).toHaveProperty("cost_breakdown");
    expect(r.data).not.toHaveProperty("month_milk_produced_kg");
  });

  it("financeSummary revenue > 0 after adding sales", async () => {
    const r = await call(U(71), "pig.finance.summary", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data.total_revenue).toBeGreaterThan(0);
  });

  it("worker cannot access financeSummary — 403", async () => {
    const r = await call(U(72), "pig.finance.summary", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(403);
  });
});
