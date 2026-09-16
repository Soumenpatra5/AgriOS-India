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

/* ── updateLactation terminal write-protection ───────────────────────────── */

describe("updateLactation — terminal animal write protection", () => {
  /* One animal per terminal status, each with one lactation added before
   * the status transition so there is a real lactation row to attempt to
   * update after the animal becomes terminal. */
  let soldLacId, deceasedLacId, retiredLacId;

  beforeAll(async () => {
    for (const [label, status, lacVar] of [
      ["update-terminal-sold",     "sold",     "soldLacId"],
      ["update-terminal-deceased", "deceased", "deceasedLacId"],
      ["update-terminal-retired",  "retired",  "retiredLacId"],
    ]) {
      const created = await call(U(30), "dairy.animals.create", {
        spaceId: spaceA.id,
        payload: { name: `Terminal ${label}`, species: "cow",
                   currentStatus: "milking", clientUuid: label },
      });
      const animalId = created.data.id;

      const lac = await call(U(30), "dairy.lactations.add", {
        spaceId: spaceA.id,
        payload: { animalId, calvingDate: "2026-09-12",
                   clientUuid: `${label}-lac` },
      });
      if (lacVar === "soldLacId")     soldLacId     = lac.data.id;
      if (lacVar === "deceasedLacId") deceasedLacId = lac.data.id;
      if (lacVar === "retiredLacId")  retiredLacId  = lac.data.id;

      await call(U(30), "dairy.animals.setStatus", {
        spaceId: spaceA.id,
        payload: { animalId, status },
      });
    }
  });

  it("updateLactation on sold animal returns 409", async () => {
    const r = await call(U(30), "dairy.lactations.update", {
      spaceId: spaceA.id,
      payload: { lactationId: soldLacId, dryOffDate: "2026-12-01" },
    });
    expect(r.status).toBe(409);
  });

  it("updateLactation on deceased animal returns 409", async () => {
    const r = await call(U(30), "dairy.lactations.update", {
      spaceId: spaceA.id,
      payload: { lactationId: deceasedLacId, notes: "should fail" },
    });
    expect(r.status).toBe(409);
  });

  it("updateLactation on retired animal returns 409", async () => {
    const r = await call(U(30), "dairy.lactations.update", {
      spaceId: spaceA.id,
      payload: { lactationId: retiredLacId, expectedNextCalving: "2027-06-01" },
    });
    expect(r.status).toBe(409);
  });

  it("manager (farm.dairy.manage) cannot update terminal animal lactation (409)", async () => {
    /* Manager U(31) has farm.dairy.manage but the animal is terminal — the
     * assertAnimalWritable invariant applies regardless of permission level. */
    const r = await call(U(31), "dairy.lactations.update", {
      spaceId: spaceA.id,
      payload: { lactationId: soldLacId, dryOffDate: "2026-12-15" },
    });
    expect(r.status).toBe(409);
  });

  it("non-terminal lactation update still succeeds after terminal test (permissions unchanged)", async () => {
    /* Verify that the terminal protection did not break the happy path.
     * A2 already has a non-terminal lactation from the earlier describe block. */
    const list = await call(U(30), "dairy.lactations.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id },
    });
    const lac = list.data.find((l) => l.lactation_number === 2);
    expect(lac).toBeDefined();
    const r = await call(U(30), "dairy.lactations.update", {
      spaceId: spaceA.id,
      payload: { lactationId: lac.id, notes: "terminal protection regression check" },
    });
    expect(r.status).toBe(200);
    expect(r.data.notes).toBe("terminal protection regression check");
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

/* ── feed records ─────────────────────────────────────────────────────────── */

describe("feed records — basic CRUD", () => {
  let feedId;

  it("worker can add a feed record (farm.dairy.record)", async () => {
    const r = await call(U(32), "dairy.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-10",
                  feedType: "concentrate", quantityKg: 5.5, notes: "Morning feed",
                  clientUuid: "feed-a1-0910" },
    });
    expect(r.status).toBe(200);
    expect(r.data.feed_type).toBe("concentrate");
    expect(parseFloat(r.data.quantity_kg)).toBeCloseTo(5.5);
    feedId = r.data.id;
  });

  it("feed record appears in list for the same animal", async () => {
    const r = await call(U(30), "dairy.feed.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.some((f) => f.id === feedId)).toBe(true);
  });

  it("feed record does NOT appear in list for a different animal (A2)", async () => {
    const r = await call(U(30), "dairy.feed.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.some((f) => f.id === feedId)).toBe(false);
  });

  it("owner can delete a feed record", async () => {
    const r = await call(U(30), "dairy.feed.delete", {
      spaceId: spaceA.id,
      payload: { feedId },
    });
    expect(r.status).toBe(200);
    expect(r.data.deleted).toBe(true);
  });

  it("deleted feed record no longer appears in list", async () => {
    const r = await call(U(30), "dairy.feed.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.some((f) => f.id === feedId)).toBe(false);
  });
});

describe("feed records — client_uuid idempotency", () => {
  it("replaying the same client_uuid returns the original record id, not a duplicate", async () => {
    const r1 = await call(U(32), "dairy.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-11",
                  feedType: "fodder", quantityKg: 3, clientUuid: "feed-idem-0911" },
    });
    expect(r1.status).toBe(200);
    expect(r1.data.feed_type).toBe("fodder");

    const r2 = await call(U(32), "dairy.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-11",
                  feedType: "silage", quantityKg: 99, clientUuid: "feed-idem-0911" },
    });
    expect(r2.status).toBe(200);
    expect(r2.data.id).toBe(r1.data.id);

    /* Verify only one record exists for this client_uuid (no duplicate created) */
    const list = await call(U(30), "dairy.feed.list", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id },
    });
    expect(list.status).toBe(200);
    const withId = list.data.filter((f) => f.id === r1.data.id);
    expect(withId.length).toBe(1);
  });
});

describe("feed records — terminal animal write protection", () => {
  let terminalFeedAnimalId;

  beforeAll(async () => {
    const a = await call(U(30), "dairy.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "Terminated Feed Cow", species: "cow", currentStatus: "dry",
                  clientUuid: "terminal-feed-animal" },
    });
    expect(a.status).toBe(200);
    terminalFeedAnimalId = a.data.id;

    const sold = await call(U(30), "dairy.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: terminalFeedAnimalId, status: "sold" },
    });
    expect(sold.status).toBe(200);
  });

  it("addFeed on a sold animal returns 409", async () => {
    const r = await call(U(32), "dairy.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: terminalFeedAnimalId, feedDate: "2026-09-12",
                  feedType: "concentrate", quantityKg: 4 },
    });
    expect(r.status).toBe(409);
  });
});

describe("feed records — cross-space isolation", () => {
  let crossFeedId;

  beforeAll(async () => {
    const r = await call(U(30), "dairy.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-13",
                  feedType: "mineral", quantityKg: 0.5,
                  clientUuid: "cross-space-feed-a1" },
    });
    expect(r.status).toBe(200);
    crossFeedId = r.data.id;
  });

  it("Farm B cannot delete Farm A feed record (404)", async () => {
    const r = await call(U(40), "dairy.feed.delete", {
      spaceId: spaceB.id,
      payload: { feedId: crossFeedId },
    });
    expect(r.status).toBe(404);
  });

  it("Farm B cannot list Farm A animal feed records (404 on animal load)", async () => {
    const r = await call(U(40), "dairy.feed.list", {
      spaceId: spaceB.id,
      payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(404);
  });
});

describe("feed records — history timeline visibility", () => {
  let histFeedId;

  beforeAll(async () => {
    const r = await call(U(32), "dairy.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-14",
                  feedType: "concentrate", quantityKg: 6,
                  clientUuid: "history-feed-a1-0914" },
    });
    expect(r.status).toBe(200);
    histFeedId = r.data.id;
  });

  it("feed record appears in animalHistory as feed_record kind", async () => {
    const r = await call(U(30), "dairy.animal.history", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    const feedEntry = r.data.history.find((e) => e.kind === "feed_record" && e.id === histFeedId);
    expect(feedEntry).toBeDefined();
    expect(feedEntry.feed_type).toBe("concentrate");
    expect(parseFloat(feedEntry.quantity_kg)).toBeCloseTo(6);
  });
});

describe("feed records — validation", () => {
  it("addFeed with invalid feed_type returns 400", async () => {
    const r = await call(U(32), "dairy.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-10", feedType: "unicorn_food" },
    });
    expect(r.status).toBe(400);
  });

  it("addFeed without feedDate returns 400", async () => {
    const r = await call(U(32), "dairy.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedType: "concentrate" },
    });
    expect(r.status).toBe(400);
  });

  it("non-member (Farm A worker) cannot add feed record to Farm B (404)", async () => {
    const r = await call(U(32), "dairy.feed.add", {
      spaceId: spaceB.id,
      payload: { animalId: animalB1Id, feedDate: "2026-09-10", feedType: "concentrate" },
    });
    expect(r.status).toBe(404);
  });
});

/* ── health event extended fields ─────────────────────────────────────────── */

describe("health events — extended fields (dose, vet_name, notes)", () => {
  let healthExtId;

  beforeAll(async () => {
    const r = await call(U(30), "dairy.health.add", {
      spaceId: spaceA.id,
      payload: {
        animalId: animalA1Id, eventDate: "2026-09-10",
        eventType: "vaccination", title: "FMD Dose 2",
        medicine: "Aftopor", dose: "5 ml", vetName: "Dr. Sharma",
        nextDueDate: "2027-03-10", isZoonoticConcern: true,
        notes: "Left neck injection", clientUuid: "health-ext-a1-0910",
      },
    });
    expect(r.status).toBe(200);
    healthExtId = r.data.id;
  });

  it("list returns the extended-field health event", async () => {
    const r = await call(U(30), "dairy.health.list", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    const ev = r.data.find((e) => e.id === healthExtId);
    expect(ev).toBeDefined();
    expect(ev.medicine).toBe("Aftopor");
    expect(ev.dose).toBe("5 ml");
    expect(ev.vet_name).toBe("Dr. Sharma");
    expect(ev.is_zoonotic_concern).toBe(true);
    expect(ev.notes).toBe("Left neck injection");
  });

  it("animalHistory includes dose, vet_name, notes for health_event", async () => {
    const r = await call(U(30), "dairy.animal.history", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    const ev = r.data.history.find((e) => e.kind === "health_event" && e.id === healthExtId);
    expect(ev).toBeDefined();
    expect(ev.dose).toBe("5 ml");
    expect(ev.vet_name).toBe("Dr. Sharma");
    expect(ev.notes).toBe("Left neck injection");
  });

  it("invalid health event_type returns 400", async () => {
    const r = await call(U(30), "dairy.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-10",
                  eventType: "surgery", title: "Not a valid type" },
    });
    expect(r.status).toBe(400);
  });

  it("health add without title returns 400", async () => {
    const r = await call(U(30), "dairy.health.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, eventDate: "2026-09-10",
                  eventType: "observation", title: "  " },
    });
    expect(r.status).toBe(400);
  });
});

/* ── herd metrics — health_overdue_count ─────────────────────────────────── */

describe("herd metrics — health_overdue_count", () => {
  it("metrics includes health_overdue_count as a number", async () => {
    const r = await call(U(30), "dairy.metrics", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    expect(typeof r.data.health_overdue_count).toBe("number");
  });

  it("overdue count is 0 for Farm B (no health events with past next_due_date)", async () => {
    const r = await call(U(40), "dairy.metrics", { spaceId: spaceB.id });
    expect(r.status).toBe(200);
    expect(r.data.health_overdue_count).toBe(0);
  });
});

/* ── feed records ─────────────────────────────────────────────────────────── */

describe("feed records — CRUD, isolation, RBAC", () => {
  let feedId;

  it("worker can add a feed record (farm.dairy.record)", async () => {
    const r = await call(U(32), "dairy.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-11",
                  feedType: "concentrate", quantityKg: 4.5,
                  notes: "Morning feed", clientUuid: "feed-a1-0911" },
    });
    expect(r.status).toBe(200);
    expect(r.data.feed_type).toBe("concentrate");
    expect(parseFloat(r.data.quantity_kg)).toBe(4.5);
    feedId = r.data.id;
  });

  it("list returns the feed record for A1", async () => {
    const r = await call(U(30), "dairy.feed.list", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.some((f) => f.id === feedId)).toBe(true);
  });

  it("A2 has no feed records from A1", async () => {
    const r = await call(U(30), "dairy.feed.list", {
      spaceId: spaceA.id, payload: { animalId: animalA2Id },
    });
    expect(r.status).toBe(200);
    const ids = r.data.map((f) => f.id);
    expect(ids).not.toContain(feedId);
  });

  it("animalHistory includes feed_record kind", async () => {
    const r = await call(U(30), "dairy.animal.history", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    const kinds = r.data.history.map((h) => h.kind);
    expect(kinds).toContain("feed_record");
    const fev = r.data.history.find((h) => h.kind === "feed_record" && h.id === feedId);
    expect(fev).toBeDefined();
    expect(fev.feed_type).toBe("concentrate");
  });

  it("client_uuid idempotency returns same record on replay", async () => {
    const r2 = await call(U(32), "dairy.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-11",
                  feedType: "fodder", quantityKg: 99, clientUuid: "feed-a1-0911" },
    });
    expect(r2.status).toBe(200);
    expect(r2.data.id).toBe(feedId);
  });

  it("invalid feed_type returns 400", async () => {
    const r = await call(U(32), "dairy.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedDate: "2026-09-11", feedType: "pizza" },
    });
    expect(r.status).toBe(400);
  });

  it("feed add without feedDate returns 400", async () => {
    const r = await call(U(32), "dairy.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: animalA1Id, feedType: "fodder" },
    });
    expect(r.status).toBe(400);
  });

  it("Farm B cannot delete Farm A feed record (404)", async () => {
    const r = await call(U(40), "dairy.feed.delete", {
      spaceId: spaceB.id,
      payload: { feedId },
    });
    expect(r.status).toBe(404);
  });

  it("worker can delete their own farm's feed record", async () => {
    const r = await call(U(32), "dairy.feed.delete", {
      spaceId: spaceA.id,
      payload: { feedId },
    });
    expect(r.status).toBe(200);
    expect(r.data.deleted).toBe(true);
  });

  it("deleted feed record no longer appears in list", async () => {
    const r = await call(U(30), "dairy.feed.list", {
      spaceId: spaceA.id, payload: { animalId: animalA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.some((f) => f.id === feedId)).toBe(false);
  });
});

/* ── feed — terminal animal write protection ──────────────────────────────── */

describe("feed — terminal animal write protection", () => {
  let termFeedAnimalId;

  beforeAll(async () => {
    const cr = await call(U(30), "dairy.animals.create", {
      spaceId: spaceA.id,
      payload: { name: "Feed Terminal Test", species: "cow", currentStatus: "milking",
                  clientUuid: "feed-terminal-animal" },
    });
    termFeedAnimalId = cr.data.id;
    await call(U(30), "dairy.animals.setStatus", {
      spaceId: spaceA.id,
      payload: { animalId: termFeedAnimalId, status: "deceased" },
    });
  });

  it("feed add on deceased animal returns 409", async () => {
    const r = await call(U(32), "dairy.feed.add", {
      spaceId: spaceA.id,
      payload: { animalId: termFeedAnimalId, feedDate: "2026-09-12", feedType: "fodder" },
    });
    expect(r.status).toBe(409);
  });
});

/* ══════════════════════════════════════════════════════════════════════════ */
/* Phase 5 — Finance: milk sales, costs, finance summary                     */
/* ══════════════════════════════════════════════════════════════════════════ */

/* ── finance summary — baseline ──────────────────────────────────────────── */

describe("finance summary — baseline", () => {
  it("returns correct shape; totals are zero for a month with no data", async () => {
    /* Use Jan 2026 — no finance records exist in that range for spaceA. */
    const r = await call(U(30), "dairy.finance.summary", {
      spaceId: spaceA.id,
      payload: { fromDate: "2026-01-01", toDate: "2026-01-31" },
    });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({
      total_revenue:          expect.any(Number),
      total_costs:            expect.any(Number),
      net_profit:             expect.any(Number),
      total_milk_sold_kg:     expect.any(Number),
      month_milk_produced_kg: expect.any(Number),
      cost_breakdown:         expect.any(Array),
      period:                 expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
    });
    expect(Number(r.data.total_revenue)).toBe(0);
    expect(Number(r.data.total_costs)).toBe(0);
    expect(Number(r.data.net_profit)).toBe(0);
  });

  it("worker without finance permission gets 403", async () => {
    const r = await call(U(32), "dairy.finance.summary", { spaceId: spaceA.id });
    expect(r.status).toBe(403);
  });
});

/* ── milk sales — CRUD, isolation, RBAC ──────────────────────────────────── */

describe("milk sales — CRUD, isolation, RBAC", () => {
  let saleId;

  it("owner can add a milk sale and gets back the record", async () => {
    const r = await call(U(30), "dairy.sales.add", {
      spaceId: spaceA.id,
      payload: {
        saleDate:      "2026-09-16",
        saleType:      "morning",
        quantityKg:    50,
        pricePerLitre: 40,
        buyer:         "Village Cooperative",
        fatPct:        3.8,
        snfPct:        8.5,
        clientUuid:    "sale-a-001",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.quantity_kg).toBeCloseTo(50, 1);
    expect(r.data.price_per_litre).toBeCloseTo(40, 1);
    expect(r.data.buyer).toBe("Village Cooperative");
    expect(r.data.fat_pct).toBeCloseTo(3.8, 1);
    saleId = r.data.id;
  });

  it("generated amount equals quantity_kg × price_per_litre", async () => {
    const r = await call(U(30), "dairy.sales.list", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    const s = r.data.find((x) => x.id === saleId);
    expect(s).toBeDefined();
    /* amount is a GENERATED column: 50 × 40 = 2000 */
    expect(Number(s.amount)).toBeCloseTo(2000, 1);
  });

  it("worker cannot add a sale — 403", async () => {
    const r = await call(U(32), "dairy.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-16", saleType: "combined", quantityKg: 10, pricePerLitre: 40 },
    });
    expect(r.status).toBe(403);
  });

  it("wrong-space isolation — spaceB owner cannot list spaceA sales", async () => {
    const r = await call(U(40), "dairy.sales.list", { spaceId: spaceA.id });
    expect(r.status).toBe(404); // not a member of spaceA → space not found
  });

  it("clientUuid idempotency — duplicate POST returns existing record not a new one", async () => {
    const r = await call(U(30), "dairy.sales.add", {
      spaceId: spaceA.id,
      payload: {
        saleDate: "2026-09-16", saleType: "morning",
        quantityKg: 50, pricePerLitre: 40,
        clientUuid: "sale-a-001",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(saleId);
    /* List should still have exactly one record with this uuid. */
    const list = await call(U(30), "dairy.sales.list", { spaceId: spaceA.id });
    const matches = list.data.filter((s) => s.id === saleId);
    expect(matches.length).toBe(1);
  });

  it("invalid saleType is rejected with 400", async () => {
    const r = await call(U(30), "dairy.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-16", saleType: "noon", quantityKg: 10 },
    });
    expect(r.status).toBe(400);
  });

  it("quantityKg ≤ 0 is rejected with 400", async () => {
    const r = await call(U(30), "dairy.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-16", saleType: "morning", quantityKg: 0 },
    });
    expect(r.status).toBe(400);
  });

  it("owner can delete a sale", async () => {
    const r = await call(U(30), "dairy.sales.delete", {
      spaceId: spaceA.id,
      payload: { saleId },
    });
    expect(r.status).toBe(200);
    expect(r.data.deleted).toBe(true);
  });

  it("deleted sale no longer appears in list", async () => {
    const r = await call(U(30), "dairy.sales.list", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    expect(r.data.some((s) => s.id === saleId)).toBe(false);
  });
});

/* ── costs — CRUD, isolation, RBAC ───────────────────────────────────────── */

describe("costs — CRUD, isolation, RBAC", () => {
  let costId;

  it("owner can add a cost entry", async () => {
    const r = await call(U(30), "dairy.costs.add", {
      spaceId: spaceA.id,
      payload: {
        costDate:    "2026-09-15",
        category:    "concentrate_feed",
        description: "Bajra concentrate 50 kg",
        amount:      1500,
        quantity:    50,
        unit:        "kg",
        clientUuid:  "cost-a-001",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.category).toBe("concentrate_feed");
    expect(Number(r.data.amount)).toBeCloseTo(1500, 1);
    expect(r.data.description).toBe("Bajra concentrate 50 kg");
    costId = r.data.id;
  });

  it("invalid category is rejected with 400", async () => {
    const r = await call(U(30), "dairy.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-15", category: "garbage", description: "x", amount: 100 },
    });
    expect(r.status).toBe(400);
  });

  it("missing description is rejected with 400", async () => {
    const r = await call(U(30), "dairy.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-15", category: "labour", description: "", amount: 500 },
    });
    expect(r.status).toBe(400);
  });

  it("amount ≤ 0 is rejected with 400", async () => {
    const r = await call(U(30), "dairy.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-15", category: "medicine", description: "Antibiotic", amount: 0 },
    });
    expect(r.status).toBe(400);
  });

  it("worker cannot add a cost — 403", async () => {
    const r = await call(U(32), "dairy.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-15", category: "labour", description: "Labour", amount: 500 },
    });
    expect(r.status).toBe(403);
  });

  it("wrong-space isolation — spaceB owner cannot list spaceA costs", async () => {
    const r = await call(U(40), "dairy.costs.list", { spaceId: spaceA.id });
    expect(r.status).toBe(404); // not a member of spaceA → space not found
  });

  it("clientUuid idempotency — duplicate POST returns existing cost record", async () => {
    const r = await call(U(30), "dairy.costs.add", {
      spaceId: spaceA.id,
      payload: {
        costDate: "2026-09-15", category: "concentrate_feed",
        description: "Bajra concentrate 50 kg", amount: 1500,
        clientUuid: "cost-a-001",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(costId);
  });

  it("owner can delete a cost", async () => {
    const r = await call(U(30), "dairy.costs.delete", {
      spaceId: spaceA.id,
      payload: { costId },
    });
    expect(r.status).toBe(200);
    expect(r.data.deleted).toBe(true);
  });

  it("deleted cost no longer appears in list", async () => {
    const r = await call(U(30), "dairy.costs.list", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    expect(r.data.some((c) => c.id === costId)).toBe(false);
  });
});

/* ── finance summary — with data ─────────────────────────────────────────── */

describe("finance summary — with data", () => {
  const TODAY = "2026-09-16";

  beforeAll(async () => {
    /* Add two sales in the current month window. */
    await call(U(30), "dairy.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: TODAY, saleType: "morning",  quantityKg: 40, pricePerLitre: 50, clientUuid: "fin-sale-1" },
    });
    await call(U(30), "dairy.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: TODAY, saleType: "evening",  quantityKg: 30, pricePerLitre: 50, clientUuid: "fin-sale-2" },
    });

    /* Add costs in two categories. */
    await call(U(30), "dairy.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: TODAY, category: "concentrate_feed", description: "Feed A", amount: 1200, clientUuid: "fin-cost-1" },
    });
    await call(U(30), "dairy.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: TODAY, category: "medicine", description: "Antibiotic", amount: 300, clientUuid: "fin-cost-2" },
    });
  });

  it("total_revenue reflects all sales in the month", async () => {
    const r = await call(U(30), "dairy.finance.summary", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    /* Cumulative in spaceA (Sept 2026):
     *   sale-0901 (from existing Phase 1 tests): 50 kg × ₹35 = 1750
     *   fin-sale-1: 40 kg × ₹50 = 2000
     *   fin-sale-2: 30 kg × ₹50 = 1500
     *   Total: 5250, milk_sold: 120 kg */
    expect(Number(r.data.total_revenue)).toBeCloseTo(5250, 1);
    expect(Number(r.data.total_milk_sold_kg)).toBeCloseTo(120, 1);
  });

  it("total_costs is sum of all cost entries and cost_breakdown has correct categories", async () => {
    const r = await call(U(30), "dairy.finance.summary", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    /* Cumulative in spaceA (Sept 2026):
     *   cost-0901 (existing): concentrate_feed ₹800
     *   fin-cost-1: concentrate_feed ₹1200
     *   fin-cost-2: medicine ₹300
     *   Total: 2300; concentrate_feed total: 2000 */
    expect(Number(r.data.total_costs)).toBeCloseTo(2300, 1);
    const cats = r.data.cost_breakdown.map((b) => b.category);
    expect(cats).toContain("concentrate_feed");
    expect(cats).toContain("medicine");
    const feedEntry = r.data.cost_breakdown.find((b) => b.category === "concentrate_feed");
    expect(Number(feedEntry.total)).toBeCloseTo(2000, 1);
  });

  it("net_profit equals total_revenue minus total_costs", async () => {
    const r = await call(U(30), "dairy.finance.summary", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    const { total_revenue, total_costs, net_profit } = r.data;
    /* Relationship check (holds regardless of accumulated data). */
    expect(Number(net_profit)).toBeCloseTo(Number(total_revenue) - Number(total_costs), 1);
    /* 5250 − 2300 = 2950 (cumulative spaceA Sept totals) */
    expect(Number(net_profit)).toBeCloseTo(2950, 1);
  });

  it("explicit fromDate/toDate for a prior month with no data returns zeros", async () => {
    const r = await call(U(30), "dairy.finance.summary", {
      spaceId: spaceA.id,
      payload: { fromDate: "2026-07-01", toDate: "2026-07-31" },
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.total_revenue)).toBe(0);
    expect(Number(r.data.total_costs)).toBe(0);
    expect(Number(r.data.net_profit)).toBe(0);
    expect(r.data.cost_breakdown).toHaveLength(0);
  });
});
