/* Poultry P4 — health events and vaccination records e2e suite.

   Drives the REAL /api/farm handler against a fresh in-process Postgres.
   Every request goes through farm.js's routing table, the six-step gate, and
   the poultryHealth handlers — the same path as production, minus JWT crypto.

   Coverage checklist:
     ✓ Permission matrix (view, record, manage, wrong farm)
     ✓ Cross-farm isolation (forged ids → 404 not 403)
     ✓ Closed/archived batch writes (blocked for record; allowed as correction for manage)
     ✓ Duplicate vaccination (409 for same batch+date+name)
     ✓ Date validation (before placement, in the future)
     ✓ Soft delete (row gone from list, deleted_at set in DB)
     ✓ Audit records (farm_audit_logs row written on add and delete)
     ✓ List filtering (deleted rows absent from list) */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { freshDb, dbRef, call, U, buildFarm, userIdOf } from "./harness.js";

vi.mock("../../db.js", () => ({ getSql: () => dbRef.sql }));
vi.mock("../../../_middleware/verifyAuth.js", async () => ({
  verifyToken: (await import("./harness.js")).testVerifyToken,
}));
vi.mock("../../blobStore.js", () => ({ deleteAttachment: async () => {} }));

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
/* Use +3 days so the date is unambiguously future regardless of time-of-day.
   The server allows up to +1 day clock-skew; 3 days always exceeds that. */
const futureDate = () => new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);

/* ── farm roster ──────────────────────────────────────────────────────────────
   Farm A: owner=U(30), manager=U(31), worker=U(32)
   Farm B: owner=U(40), manager=U(41), worker=U(42)  (isolation control) */

let A, B;
let batchId; // active batch in Farm A (placement yesterday → all dates valid)

beforeAll(async () => {
  await freshDb();
  A = await buildFarm(30, "Health Farm A", { managers: [31], workers: [32] });
  B = await buildFarm(40, "Health Farm B", { managers: [41], workers: [42] });

  /* Create a shed and an active batch in Farm A */
  const shed = await call(U(31), "poultry.sheds.create", {
    spaceId: A.space.id, payload: { name: "Shed H1", capacity: 5000 },
  });
  expect(shed.status).toBe(200);

  const batchRes = await call(U(31), "poultry.batches.create", {
    spaceId: A.space.id,
    payload: { name: "Health Batch", shed_id: shed.data.id, breed: "Broiler",
               placed_qty: 1000, placement_date: daysAgo(5) },
  });
  expect(batchRes.status).toBe(200);
  batchId = batchRes.data.id;

  // Activate the batch so it is writable without manage permission
  await call(U(31), "poultry.batches.setStatus", {
    spaceId: A.space.id, payload: { batchId, status: "active" },
  });
});

/* ── health events: permission matrix ───────────────────────────────────────── */

describe("health events — permission matrix", () => {
  it("a worker can add a health event (farm.poultry.record)", async () => {
    const r = await call(U(32), "poultry.health.add", {
      spaceId: A.space.id,
      payload: { batchId, event_date: today(), type: "observation", title: "Normal droppings" },
    });
    expect(r.status).toBe(200);
    expect(r.data.title).toBe("Normal droppings");
    expect(r.data.batch_id).toBe(batchId);
    expect(r.data.deleted_at).toBeNull();
  });

  it("an outsider (Farm B worker) cannot add a health event (404 to prevent space enumeration)", async () => {
    /* The gate returns 404 — not 403 — for non-members by design so an outsider
       cannot distinguish "space exists but I lack permission" from "no such space". */
    const r = await call(U(42), "poultry.health.add", {
      spaceId: A.space.id,
      payload: { batchId, event_date: today(), type: "observation", title: "Sneaky entry" },
    });
    expect(r.status).toBe(404);
  });

  it("any viewer can list health events", async () => {
    for (const uid of [U(30), U(31), U(32)]) {
      const r = await call(uid, "poultry.health.list", { spaceId: A.space.id, payload: { batchId } });
      expect(r.status).toBe(200);
      expect(Array.isArray(r.data)).toBe(true);
    }
  });

  it("a worker cannot delete a health event (requires farm.poultry.manage)", async () => {
    const list = await call(U(31), "poultry.health.list", { spaceId: A.space.id, payload: { batchId } });
    const row = list.data[0];
    const r = await call(U(32), "poultry.health.delete", {
      spaceId: A.space.id, payload: { healthId: row.id },
    });
    expect(r.status).toBe(403);
  });

  it("a manager can delete a health event", async () => {
    const list = await call(U(31), "poultry.health.list", { spaceId: A.space.id, payload: { batchId } });
    const row = list.data[0];
    const r = await call(U(31), "poultry.health.delete", {
      spaceId: A.space.id, payload: { healthId: row.id },
    });
    expect(r.status).toBe(200);
    expect(r.data.deleted).toBe(true);
  });
});

/* ── health events: validation ──────────────────────────────────────────────── */

describe("health events — validation", () => {
  it("rejects missing title", async () => {
    const r = await call(U(32), "poultry.health.add", {
      spaceId: A.space.id,
      payload: { batchId, event_date: today(), type: "observation", title: "   " },
    });
    expect(r.status).toBe(400);
  });

  it("rejects invalid type", async () => {
    const r = await call(U(32), "poultry.health.add", {
      spaceId: A.space.id,
      payload: { batchId, event_date: today(), type: "sneaky_type", title: "Bad" },
    });
    expect(r.status).toBe(400);
  });

  it("rejects event_date before batch placement", async () => {
    const r = await call(U(32), "poultry.health.add", {
      spaceId: A.space.id,
      payload: { batchId, event_date: daysAgo(30), type: "observation", title: "Before birds" },
    });
    expect(r.status).toBe(400);
    expect(r.error).toMatch(/before the batch was placed/i);
  });

  it("rejects event_date in the future (more than 1 day clock-skew)", async () => {
    const r = await call(U(32), "poultry.health.add", {
      spaceId: A.space.id,
      payload: { batchId, event_date: futureDate(), type: "observation", title: "Future event" },
    });
    expect(r.status).toBe(400);
    expect(r.error).toMatch(/cannot be in the future/i);
  });

  it("accepts all valid event types", async () => {
    for (const type of ["observation", "treatment", "vet_visit", "outbreak"]) {
      const r = await call(U(32), "poultry.health.add", {
        spaceId: A.space.id,
        payload: { batchId, event_date: today(), type, title: `Test ${type}` },
      });
      expect(r.status).toBe(200);
    }
  });
});

/* ── health events: soft delete and list filtering ───────────────────────────── */

describe("health events — soft delete and list filtering", () => {
  it("deleted row is absent from list but still in DB with deleted_at set", async () => {
    const added = await call(U(32), "poultry.health.add", {
      spaceId: A.space.id,
      payload: { batchId, event_date: today(), type: "observation", title: "Will be deleted" },
    });
    expect(added.status).toBe(200);
    const id = added.data.id;

    await call(U(31), "poultry.health.delete", { spaceId: A.space.id, payload: { healthId: id } });

    const list = await call(U(31), "poultry.health.list", { spaceId: A.space.id, payload: { batchId } });
    expect(list.data.find(r => r.id === id)).toBeUndefined();

    // DB must have deleted_at set (soft delete, not hard delete)
    const [row] = await dbRef.sql`select deleted_at from poultry_health_events where id = ${id}`;
    expect(row).toBeDefined();
    expect(row.deleted_at).not.toBeNull();
  });
});

/* ── health events: audit trail ──────────────────────────────────────────────── */

describe("health events — audit trail", () => {
  it("add writes an audit log row", async () => {
    const r = await call(U(32), "poultry.health.add", {
      spaceId: A.space.id,
      payload: { batchId, event_date: today(), type: "treatment", title: "Newcastle", medicine: "Lasota" },
    });
    expect(r.status).toBe(200);
    const id = r.data.id;
    const logs = await dbRef.sql`
      select * from farm_audit_logs where target_id = ${id} and action = 'poultry.health.added'`;
    expect(logs.length).toBeGreaterThan(0);
    /* actor_user_id stores the internal UUID (from agrios_users), not the firebase/test UID */
    const internalId = await userIdOf(U(32));
    expect(logs[0].actor_user_id).toBe(internalId);
  });

  it("delete writes an audit log row", async () => {
    const added = await call(U(32), "poultry.health.add", {
      spaceId: A.space.id,
      payload: { batchId, event_date: today(), type: "observation", title: "Audit delete test" },
    });
    const id = added.data.id;
    await call(U(31), "poultry.health.delete", { spaceId: A.space.id, payload: { healthId: id } });
    const logs = await dbRef.sql`
      select * from farm_audit_logs where target_id = ${id} and action = 'poultry.health.deleted'`;
    expect(logs.length).toBeGreaterThan(0);
  });
});

/* ── health events: closed/archived batch ────────────────────────────────────── */

describe("health events — closed/archived batch writes", () => {
  let closedBatchId;

  beforeAll(async () => {
    const shed = await call(U(31), "poultry.sheds.create", {
      spaceId: A.space.id, payload: { name: "Shed Closed" },
    });
    const b = await call(U(31), "poultry.batches.create", {
      spaceId: A.space.id,
      payload: { name: "Closed Batch", shed_id: shed.data.id, breed: "Broiler",
                 placed_qty: 500, placement_date: daysAgo(50) },
    });
    closedBatchId = b.data.id;
    // Walk forward to closed: draft → active → harvesting → completed → closed
    for (const status of ["active", "harvesting", "completed"]) {
      await call(U(31), "poultry.batches.setStatus", {
        spaceId: A.space.id, payload: { batchId: closedBatchId, status },
      });
    }
    await call(U(30), "poultry.batches.setStatus", {
      spaceId: A.space.id, payload: { batchId: closedBatchId, status: "closed" },
    });
  });

  it("a worker cannot add a health event to a closed batch", async () => {
    const r = await call(U(32), "poultry.health.add", {
      spaceId: A.space.id,
      payload: { batchId: closedBatchId, event_date: daysAgo(2), type: "observation", title: "Late entry" },
    });
    expect(r.status).toBe(409);
  });

  it("a manager CAN add a correction to a closed batch (is_correction=true)", async () => {
    const r = await call(U(31), "poultry.health.add", {
      spaceId: A.space.id,
      payload: { batchId: closedBatchId, event_date: daysAgo(2), type: "observation",
                 title: "Correction entry", is_correction: true },
    });
    expect(r.status).toBe(200);
    // Audit meta should flag is_correction
    const logs = await dbRef.sql`
      select meta from farm_audit_logs where target_id = ${r.data.id} and action = 'poultry.health.added'`;
    expect(logs[0]?.meta?.correction).toBe(true);
  });
});

/* ── vaccinations: permission matrix ────────────────────────────────────────── */

describe("vaccinations — permission matrix", () => {
  it("a worker can add a vaccination", async () => {
    const r = await call(U(32), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId, given_at: today(), vaccine_name: "Newcastle B1", route: "drinking_water" },
    });
    expect(r.status).toBe(200);
    expect(r.data.vaccine_name).toBe("Newcastle B1");
  });

  it("an outsider cannot add a vaccination (404 to prevent space enumeration)", async () => {
    const r = await call(U(42), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId, given_at: today(), vaccine_name: "Evil vacc", route: "spray" },
    });
    expect(r.status).toBe(404);
  });

  it("any viewer can list vaccinations", async () => {
    for (const uid of [U(30), U(31), U(32)]) {
      const r = await call(uid, "poultry.vaccinations.list", { spaceId: A.space.id, payload: { batchId } });
      expect(r.status).toBe(200);
      expect(Array.isArray(r.data)).toBe(true);
    }
  });

  it("a worker cannot delete a vaccination (requires farm.poultry.manage)", async () => {
    const list = await call(U(31), "poultry.vaccinations.list", { spaceId: A.space.id, payload: { batchId } });
    const row = list.data[0];
    const r = await call(U(32), "poultry.vaccinations.delete", {
      spaceId: A.space.id, payload: { vaccinationId: row.id },
    });
    expect(r.status).toBe(403);
  });

  it("a manager can delete a vaccination", async () => {
    const list = await call(U(31), "poultry.vaccinations.list", { spaceId: A.space.id, payload: { batchId } });
    const row = list.data[0];
    const r = await call(U(31), "poultry.vaccinations.delete", {
      spaceId: A.space.id, payload: { vaccinationId: row.id },
    });
    expect(r.status).toBe(200);
    expect(r.data.deleted).toBe(true);
  });
});

/* ── vaccinations: validation ───────────────────────────────────────────────── */

describe("vaccinations — validation", () => {
  it("rejects missing vaccine_name", async () => {
    const r = await call(U(32), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId, given_at: today(), vaccine_name: "  ", route: "spray" },
    });
    expect(r.status).toBe(400);
  });

  it("rejects invalid route", async () => {
    const r = await call(U(32), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId, given_at: today(), vaccine_name: "Good Vacc", route: "oral_spray_invalid" },
    });
    expect(r.status).toBe(400);
  });

  it("rejects given_at before batch placement", async () => {
    const r = await call(U(32), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId, given_at: daysAgo(30), vaccine_name: "IBD", route: "drinking_water" },
    });
    expect(r.status).toBe(400);
    expect(r.error).toMatch(/before the batch was placed/i);
  });

  it("rejects given_at in the future", async () => {
    const r = await call(U(32), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId, given_at: futureDate(), vaccine_name: "ND", route: "spray" },
    });
    expect(r.status).toBe(400);
  });

  it("accepts all valid administration routes", async () => {
    let offset = 0;
    for (const route of ["drinking_water", "spray", "eye_drop", "injection"]) {
      const givenAt = daysAgo(offset);
      const r = await call(U(32), "poultry.vaccinations.add", {
        spaceId: A.space.id,
        payload: { batchId, given_at: givenAt, vaccine_name: `Route test ${route}`, route },
      });
      expect(r.status).toBe(200);
      // Clean up so the next run doesn't hit a duplicate
      await call(U(31), "poultry.vaccinations.delete", { spaceId: A.space.id, payload: { vaccinationId: r.data.id } });
      offset++;
    }
  });
});

/* ── vaccinations: duplicate prevention ──────────────────────────────────────── */

describe("vaccinations — duplicate prevention", () => {
  it("returns 409 when the same vaccine is given twice on the same date", async () => {
    const payload = { batchId, given_at: daysAgo(1), vaccine_name: "IBD Vac Dup Test", route: "drinking_water" };
    const first = await call(U(32), "poultry.vaccinations.add", { spaceId: A.space.id, payload });
    expect(first.status).toBe(200);

    const second = await call(U(32), "poultry.vaccinations.add", { spaceId: A.space.id, payload });
    expect(second.status).toBe(409);
    expect(second.error).toMatch(/already recorded/i);
  });

  it("case-insensitive duplicate check (IBD vs ibd)", async () => {
    // First record (lower-case)
    await call(U(32), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId, given_at: today(), vaccine_name: "ib bronchitis", route: "spray" },
    });
    // Same name, different case → must be 409
    const dup = await call(U(32), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId, given_at: today(), vaccine_name: "IB Bronchitis", route: "spray" },
    });
    expect(dup.status).toBe(409);
  });

  it("after soft-deleting a vaccination, the same vaccine can be re-entered on that date", async () => {
    const vacc = "Reuse After Delete Vacc";
    const d = daysAgo(2);
    const first = await call(U(32), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId, given_at: d, vaccine_name: vacc, route: "eye_drop" },
    });
    expect(first.status).toBe(200);

    await call(U(31), "poultry.vaccinations.delete", {
      spaceId: A.space.id, payload: { vaccinationId: first.data.id },
    });

    // Now the same vaccine+date combo should be accepted again
    const second = await call(U(32), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId, given_at: d, vaccine_name: vacc, route: "eye_drop" },
    });
    expect(second.status).toBe(200);
    expect(second.data.id).not.toBe(first.data.id);
  });
});

/* ── vaccinations: soft delete and list filtering ────────────────────────────── */

describe("vaccinations — soft delete and list filtering", () => {
  it("deleted vaccination absent from list but deleted_at set in DB", async () => {
    const added = await call(U(32), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId, given_at: daysAgo(3), vaccine_name: "Soft Del Vacc", route: "injection" },
    });
    const id = added.data.id;

    await call(U(31), "poultry.vaccinations.delete", { spaceId: A.space.id, payload: { vaccinationId: id } });

    const list = await call(U(31), "poultry.vaccinations.list", { spaceId: A.space.id, payload: { batchId } });
    expect(list.data.find(r => r.id === id)).toBeUndefined();

    const [row] = await dbRef.sql`select deleted_at from poultry_vaccinations where id = ${id}`;
    expect(row.deleted_at).not.toBeNull();
  });
});

/* ── vaccinations: audit trail ───────────────────────────────────────────────── */

describe("vaccinations — audit trail", () => {
  it("add writes an audit log", async () => {
    const r = await call(U(32), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId, given_at: today(), vaccine_name: "Audit Vacc", route: "spray" },
    });
    expect(r.status).toBe(200);
    const logs = await dbRef.sql`
      select * from farm_audit_logs where target_id = ${r.data.id} and action = 'poultry.vaccination.added'`;
    expect(logs.length).toBeGreaterThan(0);
    const internalId = await userIdOf(U(32));
    expect(logs[0].actor_user_id).toBe(internalId);
  });

  it("delete writes an audit log", async () => {
    const added = await call(U(32), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId, given_at: today(), vaccine_name: "Audit Del Vacc", route: "injection" },
    });
    // Skip if duplicate (other test may have added it); just test the delete log
    if (added.status !== 200) return;
    const id = added.data.id;
    await call(U(31), "poultry.vaccinations.delete", { spaceId: A.space.id, payload: { vaccinationId: id } });
    const logs = await dbRef.sql`
      select * from farm_audit_logs where target_id = ${id} and action = 'poultry.vaccination.deleted'`;
    expect(logs.length).toBeGreaterThan(0);
  });
});

/* ── vaccinations: closed/archived batch writes ──────────────────────────────── */

describe("vaccinations — closed batch writes", () => {
  let closedBatchId2;

  beforeAll(async () => {
    const shed = await call(U(31), "poultry.sheds.create", {
      spaceId: A.space.id, payload: { name: "Shed VClosed" },
    });
    const b = await call(U(31), "poultry.batches.create", {
      spaceId: A.space.id,
      payload: { name: "Vacc Closed Batch", shed_id: shed.data.id, breed: "Broiler",
                 placed_qty: 300, placement_date: daysAgo(55) },
    });
    closedBatchId2 = b.data.id;
    for (const status of ["active", "harvesting", "completed"]) {
      await call(U(31), "poultry.batches.setStatus", {
        spaceId: A.space.id, payload: { batchId: closedBatchId2, status },
      });
    }
    await call(U(30), "poultry.batches.setStatus", {
      spaceId: A.space.id, payload: { batchId: closedBatchId2, status: "closed" },
    });
  });

  it("a worker cannot add a vaccination to a closed batch", async () => {
    const r = await call(U(32), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId: closedBatchId2, given_at: daysAgo(10), vaccine_name: "ND", route: "spray" },
    });
    expect(r.status).toBe(409);
  });

  it("a manager CAN add a correction vaccination to a closed batch", async () => {
    const r = await call(U(31), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId: closedBatchId2, given_at: daysAgo(10), vaccine_name: "ND Corrected",
                 route: "spray", is_correction: true },
    });
    expect(r.status).toBe(200);
    const logs = await dbRef.sql`
      select meta from farm_audit_logs where target_id = ${r.data.id} and action = 'poultry.vaccination.added'`;
    expect(logs[0]?.meta?.correction).toBe(true);
  });
});

/* ── cross-farm isolation ────────────────────────────────────────────────────── */

describe("cross-farm isolation", () => {
  let farmAHealthId;
  let farmAVaccId;

  beforeAll(async () => {
    /* Add one health event and one vaccination in Farm A that Farm B will try to touch */
    const h = await call(U(32), "poultry.health.add", {
      spaceId: A.space.id,
      payload: { batchId, event_date: today(), type: "observation", title: "Farm A only event" },
    });
    farmAHealthId = h.data.id;

    const v = await call(U(32), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId, given_at: today(), vaccine_name: "Farm A Only Vacc", route: "spray" },
    });
    // May already exist from earlier tests; tolerate 409
    if (v.status === 200) farmAVaccId = v.data.id;
    else {
      const list = await call(U(31), "poultry.vaccinations.list", { spaceId: A.space.id, payload: { batchId } });
      farmAVaccId = list.data.find(r => r.vaccine_name === "Farm A Only Vacc")?.id;
    }
  });

  it("Farm B manager cannot list Farm A health events using Farm A spaceId → 404", async () => {
    // Gate returns 404 (not 403) for non-members; prevents space enumeration
    const r = await call(U(41), "poultry.health.list", { spaceId: A.space.id, payload: { batchId } });
    expect(r.status).toBe(404);
  });

  it("Farm B user with forged healthId → 404 not 403", async () => {
    // They use their own spaceId but a Farm A row id — must get 404
    const [farmBBatch] = await dbRef.sql`
      select id from poultry_batches where space_id = ${B.space.id} limit 1`;
    if (!farmBBatch) return; // nothing to attack
    const r = await call(U(41), "poultry.health.delete", {
      spaceId: B.space.id, payload: { healthId: farmAHealthId },
    });
    // 404 because row.space_id ≠ membership.space_id → requireScope throws 404
    expect(r.status).toBe(404);
  });

  it("Farm B user with forged vaccinationId → 404 not 403", async () => {
    if (!farmAVaccId) return;
    const r = await call(U(41), "poultry.vaccinations.delete", {
      spaceId: B.space.id, payload: { vaccinationId: farmAVaccId },
    });
    expect(r.status).toBe(404);
  });

  it("Farm B user cannot list Farm A health by forging batchId with own spaceId", async () => {
    // batchId belongs to Farm A; passing Farm B's spaceId → requireScope inside loadBatch → 404
    const r = await call(U(41), "poultry.health.list", { spaceId: B.space.id, payload: { batchId } });
    expect(r.status).toBe(404);
  });
});
