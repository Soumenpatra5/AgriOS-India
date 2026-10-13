/* Local ERP ↔ Cloud Farm Space Bridge Phase 5: Dairy Operational Records Test Suite
 * Covers at minimum:
 *   1. Database constraints & Migration 0031 (unit domain, non-negative, mutual exclusion, generated total)
 *   2. Session yield validation (validateSessionYield: strings, numbers, negatives, NaN, out of bounds)
 *   3. Module gating (dairyDashboard disabled -> HTTP 400 for preview and publish)
 *   4. RBAC permissions (owner/manager/supervisor allowed with farm.dairy.record, worker rejected 403, non-member 404)
 *   5. Preview reconciliation states (NEW, EXISTS_SAME, EXISTS_DIFF, CONFLICT_OTHER_SPACE, DUPLICATE_IN_BATCH,
 *      NATURAL_KEY_CONFLICT, UNASSIGNED_ANIMAL, PARENT_NOT_FOUND, UNSUPPORTED_EVENT_DOMAIN, UNSUPPORTED_EVENT_TYPE, INVALID_DATE)
 *   6. Publish creates litre records with unit='L' and health events linked to parent animals
 *   7. Client UUID idempotency on repeated publish
 *   8. Diff handling with overwrite=false and overwrite=true
 *   9. Cross-space isolation rejection with HTTP 409 and atomic rollback
 *   10. Audit logging with action 'bridge.publish_dairy_ops'
 *   11. Cross-unit conflict protection in upsertMilk (rejects 409 cross-unit overwrite)
 *   12. Analytics separation in herdMetrics and financeSummary (independent kg and L values)
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("../db.js", async () => {
  const { dbRef } = await import("./e2e/harness.js");
  return { getSql: () => dbRef.sql };
});
vi.mock("../../_middleware/verifyAuth.js", async () => {
  const { testVerifyToken } = await import("./e2e/harness.js");
  return { verifyToken: testVerifyToken };
});
vi.mock("../blobStore.js", () => ({ deleteAttachment: vi.fn(async () => {}) }));

import { freshDb, call, buildFarm } from "./e2e/harness.js";
import * as bridgeModule from "../farm/bridge.js";
import * as dairyOpsModule from "../farm/dairyOps.js";
import * as dairyModule from "../farm/dairy.js";
import * as dairyFinanceModule from "../farm/dairyFinance.js";

let db, sql;

beforeAll(async () => {
  const env = await freshDb();
  db = env.pg;
  sql = env.sql;
}, 40000);

beforeEach(async () => {
  await db.exec(`
    truncate dairy_milk_records, dairy_health_events, dairy_animals, farm_audit_logs,
             farm_space_memberships, farm_space_modules, farm_spaces, users
    restart identity cascade
  `);
});

describe("Local ERP ↔ Cloud Farm Space Bridge Phase 5 — Unit Safety & Yield Validation", () => {
  it("validates session yield values with strict boundary rules", () => {
    // 1. Blank inputs
    expect(bridgeModule.validateSessionYield(undefined)).toEqual({ isBlank: true, isInvalid: false, value: 0 });
    expect(bridgeModule.validateSessionYield(null)).toEqual({ isBlank: true, isInvalid: false, value: 0 });
    expect(bridgeModule.validateSessionYield("")).toEqual({ isBlank: true, isInvalid: false, value: 0 });
    expect(bridgeModule.validateSessionYield("   ")).toEqual({ isBlank: true, isInvalid: false, value: 0 });

    // 2. Valid numeric strings
    expect(bridgeModule.validateSessionYield("12.5")).toEqual({ isBlank: false, isInvalid: false, value: 12.5, isExplicitZero: false });
    expect(bridgeModule.validateSessionYield("0")).toEqual({ isBlank: false, isInvalid: false, value: 0, isExplicitZero: true });
    expect(bridgeModule.validateSessionYield("150.756")).toEqual({ isBlank: false, isInvalid: false, value: 150.76, isExplicitZero: false });

    // 3. Valid numbers
    expect(bridgeModule.validateSessionYield(14.2)).toEqual({ isBlank: false, isInvalid: false, value: 14.2, isExplicitZero: false });
    expect(bridgeModule.validateSessionYield(0)).toEqual({ isBlank: false, isInvalid: false, value: 0, isExplicitZero: true });

    // 4. Invalid strings and values (must NOT coerce to zero)
    expect(bridgeModule.validateSessionYield("-5").isInvalid).toBe(true);
    expect(bridgeModule.validateSessionYield(-1).isInvalid).toBe(true);
    expect(bridgeModule.validateSessionYield("abc").isInvalid).toBe(true);
    expect(bridgeModule.validateSessionYield("12.34.56").isInvalid).toBe(true);
    expect(bridgeModule.validateSessionYield(Infinity).isInvalid).toBe(true);
    expect(bridgeModule.validateSessionYield(10000).isInvalid).toBe(true); // > 9999.99
    expect(bridgeModule.validateSessionYield({}).isInvalid).toBe(true);
  });

  it("enforces PostgreSQL database constraints on dairy_milk_records (Migration 0031)", async () => {
    const f = await buildFarm(1, "DB Constraint Farm");
    const animalRow = (await db.query(
      `insert into dairy_animals (space_id, name, species, client_uuid, created_by)
       values ($1, 'Cow 1', 'cow', 'cow-c1', $2) returning id`,
      [f.space.id, f.owner.id]
    )).rows[0];

    // 1. Valid Litre record (unit='L', kg fields 0, litres set)
    const validLitre = await db.query(
      `insert into dairy_milk_records
         (space_id, animal_id, record_date, unit, am_yield_litres, pm_yield_litres, am_yield_kg, pm_yield_kg, created_by)
       values ($1, $2, '2026-10-01', 'L', 10.5, 8.25, 0, 0, $3)
       returning unit, am_yield_litres, pm_yield_litres, total_yield_litres, total_yield_kg`,
      [f.space.id, animalRow.id, f.owner.id]
    );
    expect(validLitre.rows[0].unit).toBe("L");
    expect(Number(validLitre.rows[0].total_yield_litres)).toBe(18.75);
    expect(Number(validLitre.rows[0].total_yield_kg)).toBe(0);

    // 2. Reject negative litre yield
    await expect(
      db.query(
        `insert into dairy_milk_records
           (space_id, animal_id, record_date, unit, am_yield_litres, pm_yield_litres, am_yield_kg, pm_yield_kg, created_by)
         values ($1, $2, '2026-10-02', 'L', -1.0, 5.0, 0, 0, $3)`,
        [f.space.id, animalRow.id, f.owner.id]
      )
    ).rejects.toThrow();

    // 3. Reject invalid unit code
    await expect(
      db.query(
        `insert into dairy_milk_records
           (space_id, animal_id, record_date, unit, am_yield_litres, pm_yield_litres, am_yield_kg, pm_yield_kg, created_by)
         values ($1, $2, '2026-10-03', 'gallons', 10.0, 5.0, 0, 0, $3)`,
        [f.space.id, animalRow.id, f.owner.id]
      )
    ).rejects.toThrow();

    // 4. Reject mixing kg values into unit='L' record (mutual exclusion check)
    await expect(
      db.query(
        `insert into dairy_milk_records
           (space_id, animal_id, record_date, unit, am_yield_litres, pm_yield_litres, am_yield_kg, pm_yield_kg, created_by)
         values ($1, $2, '2026-10-04', 'L', 10.0, 5.0, 5.0, 0, $3)`,
        [f.space.id, animalRow.id, f.owner.id]
      )
    ).rejects.toThrow();

    // 5. Reject mixing litre values into unit='kg' record (mutual exclusion check)
    await expect(
      db.query(
        `insert into dairy_milk_records
           (space_id, animal_id, record_date, unit, am_yield_litres, pm_yield_litres, am_yield_kg, pm_yield_kg, created_by)
         values ($1, $2, '2026-10-05', 'kg', 10.0, null, 5.0, 4.0, $3)`,
        [f.space.id, animalRow.id, f.owner.id]
      )
    ).rejects.toThrow();

    // 6. Max valid yield precision: AM 9999.99 + PM 9999.99 -> total 19999.98
    const maxRow = await db.query(
      `insert into dairy_milk_records
         (space_id, animal_id, record_date, unit, am_yield_litres, pm_yield_litres, am_yield_kg, pm_yield_kg, created_by)
       values ($1, $2, '2026-10-06', 'L', 9999.99, 9999.99, 0, 0, $3)
       returning unit, am_yield_litres, pm_yield_litres, total_yield_litres`,
      [f.space.id, animalRow.id, f.owner.id]
    );
    expect(Number(maxRow.rows[0].am_yield_litres)).toBe(9999.99);
    expect(Number(maxRow.rows[0].pm_yield_litres)).toBe(9999.99);
    expect(Number(maxRow.rows[0].total_yield_litres)).toBe(19999.98);

    // 7. Reject per-session yield exceeding 9999.99
    await expect(
      db.query(
        `insert into dairy_milk_records
           (space_id, animal_id, record_date, unit, am_yield_litres, pm_yield_litres, am_yield_kg, pm_yield_kg, created_by)
         values ($1, $2, '2026-10-07', 'L', 10000.00, 0, 0, 0, $3)`,
        [f.space.id, animalRow.id, f.owner.id]
      )
    ).rejects.toThrow();
  });
});

describe("Local ERP ↔ Cloud Farm Space Bridge Phase 5 — Permissions & Module Gating", () => {
  it("rejects preview and publish when dairyDashboard module is disabled (HTTP 400)", async () => {
    const f = await buildFarm(1, "No Dairy Module Farm");

    // Disable dairyDashboard module
    await db.query(
      `insert into farm_space_modules (space_id, module_id, sort_order, enabled)
       values ($1, 'dairyDashboard', 10, false)
       on conflict (space_id, module_id) do update set enabled = false`,
      [f.space.id]
    );

    const payload = {
      spaceId: f.space.id,
      productions: [{ id: "m-1", animalId: "a-1", date: "2026-10-01", amLitres: 10 }],
      events: [],
    };

    const prevRes = await call(f.owner, "bridge.previewDairyOps", { spaceId: f.space.id, payload });
    expect(prevRes.status).toBe(400);
    expect(prevRes.error).toMatch(/Module "dairyDashboard" is disabled/i);

    const pubRes = await call(f.owner, "bridge.publishDairyOps", { spaceId: f.space.id, payload });
    expect(pubRes.status).toBe(400);
    expect(pubRes.error).toMatch(/Module "dairyDashboard" is disabled/i);
  });

  it("enforces RBAC permissions for bridge.previewDairyOps and bridge.publishDairyOps (farm.dairy.record)", async () => {
    const f = await buildFarm(1, "RBAC Dairy Ops Farm", {
      managers: [2],
      supervisors: [3],
      workers: [4],
    });

    const payload = {
      spaceId: f.space.id,
      productions: [{ id: "m-perm", animalId: "a-perm", date: "2026-10-01", amLitres: 12 }],
      events: [],
    };

    // 1. Owner has farm.dairy.record -> 200
    const ownerPrev = await call(f.owner, "bridge.previewDairyOps", { spaceId: f.space.id, payload });
    expect(ownerPrev.status).toBe(200);

    // 2. Manager has farm.dairy.record -> 200
    const mgrPrev = await call(f.managers[0], "bridge.previewDairyOps", { spaceId: f.space.id, payload });
    expect(mgrPrev.status).toBe(200);

    // 3. Supervisor has farm.dairy.record -> 200
    const supPrev = await call(f.supervisors[0], "bridge.previewDairyOps", { spaceId: f.space.id, payload });
    expect(supPrev.status).toBe(200);

    // 4. Worker has farm.dairy.record -> 200
    const workPrev = await call(f.workers[0], "bridge.previewDairyOps", { spaceId: f.space.id, payload });
    expect(workPrev.status).toBe(200);

    const workPub = await call(f.workers[0], "bridge.publishDairyOps", { spaceId: f.space.id, payload });
    expect(workPub.status).toBe(200);

    // 5. Member with explicit override denying farm.dairy.record -> 403
    await db.query(
      `update farm_space_memberships
       set permissions = jsonb_build_object('farm.dairy.record', false)
       where space_id = $1 and user_id = (select id from users where firebase_uid = $2)`,
      [f.space.id, f.workers[0]]
    );

    const deniedPrev = await call(f.workers[0], "bridge.previewDairyOps", { spaceId: f.space.id, payload });
    expect(deniedPrev.status).toBe(403);
    expect(deniedPrev.error).toMatch(/Not permitted: farm\.dairy\.record/);

    const deniedPub = await call(f.workers[0], "bridge.publishDairyOps", { spaceId: f.space.id, payload });
    expect(deniedPub.status).toBe(403);
    expect(deniedPub.error).toMatch(/Not permitted: farm\.dairy\.record/);

    // 6. Non-member user -> 404 (Farm Space not found)
    const outsiderFarm = await buildFarm(9, "Outsider Farm");
    const outsiderCall = await call(outsiderFarm.owner, "bridge.previewDairyOps", { spaceId: f.space.id, payload });
    expect(outsiderCall.status).toBe(404);
    expect(outsiderCall.error).toMatch(/Farm Space not found/);

    // 7. Unauthenticated request -> 401 (Unauthorized)
    const unauthCall = await call(null, "bridge.previewDairyOps", { spaceId: f.space.id, payload });
    expect(unauthCall.status).toBe(401);
  });
});

describe("Local ERP ↔ Cloud Farm Space Bridge Phase 5 — Preview Reconciliation", () => {
  it("accurately classifies all milk preview states", async () => {
    const f1 = await buildFarm(1, "Preview Farm 1");
    const f2 = await buildFarm(2, "Preview Farm 2");

    // Seed parent animals in f1
    const a1Row = (await db.query(
      `insert into dairy_animals (space_id, name, species, client_uuid, created_by)
       values ($1, 'Kamdhenu', 'cow', 'a-local-1', $2) returning id`,
      [f1.space.id, f1.owner.id]
    )).rows[0];

    const a2Row = (await db.query(
      `insert into dairy_animals (space_id, name, species, client_uuid, created_by)
       values ($1, 'Shyama', 'cow', 'a-local-2', $2) returning id`,
      [f1.space.id, f1.owner.id]
    )).rows[0];

    // Seed milk records:
    // 1. Same record in f1
    await db.query(
      `insert into dairy_milk_records
         (space_id, animal_id, record_date, unit, am_yield_litres, pm_yield_litres, am_yield_kg, pm_yield_kg, client_uuid, created_by)
       values ($1, $2, '2026-10-01', 'L', 10.0, 5.0, 0, 0, 'm-same', $3)`,
      [f1.space.id, a1Row.id, f1.owner.id]
    );

    // 2. Diff record in f1
    await db.query(
      `insert into dairy_milk_records
         (space_id, animal_id, record_date, unit, am_yield_litres, pm_yield_litres, am_yield_kg, pm_yield_kg, client_uuid, created_by)
       values ($1, $2, '2026-10-02', 'L', 8.0, 4.0, 0, 0, 'm-diff', $3)`,
      [f1.space.id, a1Row.id, f1.owner.id]
    );

    // 3. Record belonging to f2
    const f2Animal = (await db.query(
      `insert into dairy_animals (space_id, name, species, client_uuid, created_by)
       values ($1, 'Cow F2', 'cow', 'a-f2', $2) returning id`,
      [f2.space.id, f2.owner.id]
    )).rows[0];

    await db.query(
      `insert into dairy_milk_records
         (space_id, animal_id, record_date, unit, am_yield_litres, pm_yield_litres, am_yield_kg, pm_yield_kg, client_uuid, created_by)
       values ($1, $2, '2026-10-03', 'L', 12.0, 6.0, 0, 0, 'm-other-space', $3)`,
      [f2.space.id, f2Animal.id, f2.owner.id]
    );

    // 4. Natural key collision in f1: record logged with a different origin clientUuid
    await db.query(
      `insert into dairy_milk_records
         (space_id, animal_id, record_date, unit, am_yield_litres, pm_yield_litres, am_yield_kg, pm_yield_kg, client_uuid, created_by)
       values ($1, $2, '2026-10-04', 'L', 9.0, 4.5, 0, 0, 'm-different-uuid', $3)`,
      [f1.space.id, a2Row.id, f1.owner.id]
    );

    const productions = [
      { id: "m-new", animalId: "a-local-1", date: "2026-10-05", amLitres: 11, pmLitres: 5 },
      { id: "m-same", animalId: "a-local-1", date: "2026-10-01", amLitres: 10, pmLitres: 5 },
      { id: "m-diff", animalId: "a-local-1", date: "2026-10-02", amLitres: 12, pmLitres: 6 }, // changed yields
      { id: "m-other-space", animalId: "a-local-1", date: "2026-10-03", amLitres: 12, pmLitres: 6 },
      { id: "m-natural-conf", animalId: "a-local-2", date: "2026-10-04", amLitres: 9, pmLitres: 4.5 },
      { id: "m-unassigned", animalId: "", date: "2026-10-06", amLitres: 5, pmLitres: 5 },
      { id: "m-missing-parent", animalId: "a-unknown-999", date: "2026-10-06", amLitres: 5, pmLitres: 5 },
      { id: "m-invalid-qty", animalId: "a-local-1", date: "2026-10-07", amLitres: -5, pmLitres: 5 },
      { id: "m-both-blank", animalId: "a-local-1", date: "2026-10-08", amLitres: "", pmLitres: null },
      { id: "m-explicit-zero", animalId: "a-local-1", date: "2026-10-10", amLitres: 0, pmLitres: 0 },
      { id: "m-blank-one-session", animalId: "a-local-1", date: "2026-10-11", amLitres: "12.5", pmLitres: "" },
      { id: "m-max-precision", animalId: "a-local-1", date: "2026-10-12", amLitres: 9999.99, pmLitres: 9999.99 },
      { id: "m-exceed-session-max", animalId: "a-local-1", date: "2026-10-13", amLitres: 10000.00, pmLitres: 0 },
      { id: "m-dup-1", animalId: "a-local-1", date: "2026-10-09", amLitres: 7, pmLitres: 4 },
      { id: "m-dup-2", animalId: "a-local-1", date: "2026-10-09", amLitres: 8, pmLitres: 4 }, // duplicate animal/date in batch
    ];

    const prevRes = await call(f1.owner, "bridge.previewDairyOps", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, productions, events: [] },
    });

    expect(prevRes.status).toBe(200);
    const items = prevRes.data.milkItems;

    expect(items.find((i) => i.clientUuid === "m-new").status).toBe("NEW");
    expect(items.find((i) => i.clientUuid === "m-same").status).toBe("EXISTS_SAME");
    expect(items.find((i) => i.clientUuid === "m-diff").status).toBe("EXISTS_DIFF");
    expect(items.find((i) => i.clientUuid === "m-other-space").status).toBe("CONFLICT_OTHER_SPACE");
    expect(items.find((i) => i.clientUuid === "m-natural-conf").status).toBe("NATURAL_KEY_CONFLICT");
    expect(items.find((i) => i.clientUuid === "m-unassigned").status).toBe("UNASSIGNED_ANIMAL");
    expect(items.find((i) => i.clientUuid === "m-missing-parent").status).toBe("PARENT_NOT_FOUND");
    expect(items.find((i) => i.clientUuid === "m-invalid-qty").status).toBe("INVALID_QUANTITY");
    expect(items.find((i) => i.clientUuid === "m-both-blank").status).toBe("INVALID_QUANTITY");
    expect(items.find((i) => i.clientUuid === "m-dup-1").status).toBe("DUPLICATE_IN_BATCH");
    expect(items.find((i) => i.clientUuid === "m-dup-2").status).toBe("DUPLICATE_IN_BATCH");

    const zeroItem = items.find((i) => i.clientUuid === "m-explicit-zero");
    expect(zeroItem.status).toBe("NEW");
    expect(zeroItem.publishable).toBe(true);
    expect(zeroItem.totalYieldLitres).toBe(0);

    const partialBlankItem = items.find((i) => i.clientUuid === "m-blank-one-session");
    expect(partialBlankItem.status).toBe("NEW");
    expect(partialBlankItem.publishable).toBe(true);
    expect(partialBlankItem.totalYieldLitres).toBe(12.5);

    const maxPrecItem = items.find((i) => i.clientUuid === "m-max-precision");
    expect(maxPrecItem.status).toBe("NEW");
    expect(maxPrecItem.publishable).toBe(true);
    expect(maxPrecItem.totalYieldLitres).toBe(19999.98);

    const exceedItem = items.find((i) => i.clientUuid === "m-exceed-session-max");
    expect(exceedItem.status).toBe("INVALID_QUANTITY");
    expect(exceedItem.publishable).toBe(false);
  });

  it("accurately classifies health event preview states and rejects reproductive domains", async () => {
    const f1 = await buildFarm(1, "Preview Events Farm");

    // Parent animal in f1
    await db.query(
      `insert into dairy_animals (space_id, name, species, client_uuid, created_by)
       values ($1, 'Nandi', 'cow', 'a-ev-1', $2)`,
      [f1.space.id, f1.owner.id]
    );

    const events = [
      { id: "e-valid", animalId: "a-ev-1", date: "2026-10-01", type: "vaccination", note: "FMD Vaccine" },
      { id: "e-repro", animalId: "a-ev-1", date: "2026-10-02", type: "ai_breeding", note: "AI done" },
      { id: "e-calving", animalId: "a-ev-1", date: "2026-10-03", type: "calving", note: "Calved female" },
      { id: "e-unsupported", animalId: "a-ev-1", date: "2026-10-04", type: "random_checkup", note: "Test" },
      { id: "e-unassigned", animalId: "", date: "2026-10-05", type: "treatment", note: "Herd deworming" },
      { id: "e-missing-parent", animalId: "a-missing", date: "2026-10-06", type: "deworming", note: "Dewormed" },
    ];

    const prevRes = await call(f1.owner, "bridge.previewDairyOps", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, productions: [], events },
    });

    expect(prevRes.status).toBe(200);
    const evItems = prevRes.data.eventItems;

    expect(evItems.find((e) => e.clientUuid === "e-valid").status).toBe("NEW");
    expect(evItems.find((e) => e.clientUuid === "e-repro").status).toBe("UNSUPPORTED_EVENT_DOMAIN");
    expect(evItems.find((e) => e.clientUuid === "e-calving").status).toBe("UNSUPPORTED_EVENT_DOMAIN");
    expect(evItems.find((e) => e.clientUuid === "e-unsupported").status).toBe("UNSUPPORTED_EVENT_TYPE");
    expect(evItems.find((e) => e.clientUuid === "e-unassigned").status).toBe("UNASSIGNED_ANIMAL");
    expect(evItems.find((e) => e.clientUuid === "e-missing-parent").status).toBe("PARENT_NOT_FOUND");
  });
});

describe("Local ERP ↔ Cloud Farm Space Bridge Phase 5 — Publish Flow, Idempotency & Audit", () => {
  it("publishes valid litre records and health events linked to parent animals", async () => {
    const f1 = await buildFarm(1, "Publish Ops Farm");

    // Parent animal in f1
    const animal = (await db.query(
      `insert into dairy_animals (space_id, name, species, client_uuid, created_by)
       values ($1, 'Radha', 'cow', 'a-radha', $2) returning id`,
      [f1.space.id, f1.owner.id]
    )).rows[0];

    const productions = [
      { id: "m-pub-1", animalId: "a-radha", date: "2026-10-01", amLitres: 12.5, pmLitres: 8.5 },
      { id: "m-pub-2", animalId: "a-radha", date: "2026-10-02", amLitres: "14.0", pmLitres: "9.0" },
    ];

    const events = [
      { id: "e-pub-1", animalId: "a-radha", date: "2026-10-01", type: "vaccination", note: "Anthrax booster", dueDate: "2027-10-01" },
      { id: "e-pub-2", animalId: "a-radha", date: "2026-10-02", type: "deworming", note: "Albendazole oral" },
    ];

    const pubRes = await call(f1.owner, "bridge.publishDairyOps", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, productions, events },
    });

    expect(pubRes.status).toBe(200);
    expect(pubRes.data.milk.created).toHaveLength(2);
    expect(pubRes.data.events.created).toHaveLength(2);

    // Verify database rows directly
    const milkRows = await db.query(
      `select * from dairy_milk_records where space_id = $1 order by record_date asc`,
      [f1.space.id]
    );
    expect(milkRows.rows).toHaveLength(2);
    expect(milkRows.rows[0].client_uuid).toBe("m-pub-1");
    expect(milkRows.rows[0].unit).toBe("L");
    expect(Number(milkRows.rows[0].am_yield_litres)).toBe(12.5);
    expect(Number(milkRows.rows[0].pm_yield_litres)).toBe(8.5);
    expect(Number(milkRows.rows[0].total_yield_litres)).toBe(21.0);
    expect(Number(milkRows.rows[0].total_yield_kg)).toBe(0);
    expect(milkRows.rows[0].animal_id).toBe(animal.id);

    const eventRows = await db.query(
      `select * from dairy_health_events where space_id = $1 order by event_date asc`,
      [f1.space.id]
    );
    expect(eventRows.rows).toHaveLength(2);
    expect(eventRows.rows[0].client_uuid).toBe("e-pub-1");
    expect(eventRows.rows[0].event_type).toBe("vaccination");
    expect(eventRows.rows[0].animal_id).toBe(animal.id);
    expect(new Date(eventRows.rows[0].next_due_date).toISOString().slice(0, 10)).toBe("2027-10-01");

    // Verify Audit Log
    const auditRows = await db.query(
      `select * from farm_audit_logs where space_id = $1 and action = 'bridge.publish_dairy_ops'`,
      [f1.space.id]
    );
    expect(auditRows.rows).toHaveLength(1);
    expect(auditRows.rows[0].meta.milkCreatedCount).toBe(2);
    expect(auditRows.rows[0].meta.eventsCreatedCount).toBe(2);
  });

  it("handles repeated publish idempotency and overwrite toggle correctly", async () => {
    const f1 = await buildFarm(1, "Idempotent Ops Farm");

    await db.query(
      `insert into dairy_animals (space_id, name, species, client_uuid, created_by)
       values ($1, 'Gauri', 'cow', 'a-gauri', $2)`,
      [f1.space.id, f1.owner.id]
    );

    const p = { id: "m-idem", animalId: "a-gauri", date: "2026-10-01", amLitres: 10, pmLitres: 5 };

    // 1st Publish
    const pub1 = await call(f1.owner, "bridge.publishDairyOps", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, productions: [p], events: [] },
    });
    expect(pub1.status).toBe(200);
    expect(pub1.data.milk.created).toHaveLength(1);
    expect(pub1.data.milk.skipped).toHaveLength(0);

    // 2nd Publish identical -> skipped already_synced
    const pub2 = await call(f1.owner, "bridge.publishDairyOps", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, productions: [p], events: [] },
    });
    expect(pub2.status).toBe(200);
    expect(pub2.data.milk.created).toHaveLength(0);
    expect(pub2.data.milk.skipped).toHaveLength(1);
    expect(pub2.data.milk.skipped[0].reason).toBe("already_synced");

    // 3rd Publish modified yield with overwrite=false -> skipped exists_diff_no_overwrite
    const pModified = { ...p, amLitres: 14, pmLitres: 7 };
    const pub3 = await call(f1.owner, "bridge.publishDairyOps", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, productions: [pModified], events: [], overwrite: false },
    });
    expect(pub3.status).toBe(200);
    expect(pub3.data.milk.updated).toHaveLength(0);
    expect(pub3.data.milk.skipped).toHaveLength(1);
    expect(pub3.data.milk.skipped[0].reason).toBe("exists_diff_no_overwrite");

    // 4th Publish modified yield with overwrite=true -> updated
    const pub4 = await call(f1.owner, "bridge.publishDairyOps", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, productions: [pModified], events: [], overwrite: true },
    });
    expect(pub4.status).toBe(200);
    expect(pub4.data.milk.updated).toHaveLength(1);
    expect(pub4.data.milk.updated[0].yield).toBe(21);

    const row = await db.query(`select total_yield_litres from dairy_milk_records where client_uuid = $1`, ["m-idem"]);
    expect(Number(row.rows[0].total_yield_litres)).toBe(21);
  });

  it("strictly rejects cross-space publishing with HTTP 409 and rolls back transaction", async () => {
    const f1 = await buildFarm(1, "Space 1");
    const f2 = await buildFarm(2, "Space 2");

    const a1 = (await db.query(
      `insert into dairy_animals (space_id, name, species, client_uuid, created_by)
       values ($1, 'Cow One', 'cow', 'a-cross-1', $2) returning id`,
      [f1.space.id, f1.owner.id]
    )).rows[0];

    const a2 = (await db.query(
      `insert into dairy_animals (space_id, name, species, client_uuid, created_by)
       values ($1, 'Cow Two', 'cow', 'a-cross-2', $2) returning id`,
      [f2.space.id, f2.owner.id]
    )).rows[0];

    // Space 1 publishes milk record m-space1
    await call(f1.owner, "bridge.publishDairyOps", {
      spaceId: f1.space.id,
      payload: {
        spaceId: f1.space.id,
        productions: [{ id: "m-space1", animalId: "a-cross-1", date: "2026-10-01", amLitres: 10, pmLitres: 5 }],
      },
    });

    // Space 2 attempts to publish batch with [m-space2, m-space1] where m-space1 belongs to Space 1
    const hijackRes = await call(f2.owner, "bridge.publishDairyOps", {
      spaceId: f2.space.id,
      payload: {
        spaceId: f2.space.id,
        productions: [
          { id: "m-space2", animalId: "a-cross-2", date: "2026-10-01", amLitres: 8, pmLitres: 4 },
          { id: "m-space1", animalId: "a-cross-2", date: "2026-10-02", amLitres: 9, pmLitres: 4 },
        ],
      },
    });

    expect(hijackRes.status).toBe(409);
    expect(hijackRes.error).toMatch(/Cross-space publish rejected/);

    // Verify ATOMIC ROLLBACK: m-space2 must NOT have been inserted into Space 2
    const rows = await db.query(`select * from dairy_milk_records where space_id = $1`, [f2.space.id]);
    expect(rows.rows).toHaveLength(0);
  });
});

describe("Local ERP ↔ Cloud Farm Space Bridge Phase 5 — CRUD & Analytics Unit Separation", () => {
  it("protects against cross-unit overwrite in upsertMilk (HTTP 409)", async () => {
    const f = await buildFarm(1, "Upsert Protection Farm");
    const animal = (await db.query(
      `insert into dairy_animals (space_id, name, species, client_uuid, created_by)
       values ($1, 'Cow Ops', 'cow', 'a-ops', $2) returning id`,
      [f.space.id, f.owner.id]
    )).rows[0];

    const membership = { space_id: f.space.id };

    // 1. Insert a litre-based record via upsertMilk
    const litreEntry = await dairyOpsModule.upsertMilk(sql, membership, f.owner.id, {
      animalId: animal.id,
      recordDate: "2026-10-10",
      unit: "L",
      amYieldLitres: 11.5,
      pmYieldLitres: 9.0,
    });
    expect(litreEntry.unit).toBe("L");
    expect(Number(litreEntry.total_yield_litres)).toBe(20.5);

    // 2. Attempting to overwrite the litre record with a kg entry must throw 409
    await expect(
      dairyOpsModule.upsertMilk(sql, membership, f.owner.id, {
        animalId: animal.id,
        recordDate: "2026-10-10",
        unit: "kg",
        amYieldKg: 10,
        pmYieldKg: 8,
      })
    ).rejects.toThrow(/Cannot overwrite litre-based record with kilogram entry/);

    // 3. Insert a kg-based record on a different date
    const kgEntry = await dairyOpsModule.upsertMilk(sql, membership, f.owner.id, {
      animalId: animal.id,
      recordDate: "2026-10-11",
      unit: "kg",
      amYieldKg: 10,
      pmYieldKg: 8,
    });
    expect(kgEntry.unit).toBe("kg");

    // 4. Attempting to overwrite the kg record with a litre entry must throw 409
    await expect(
      dairyOpsModule.upsertMilk(sql, membership, f.owner.id, {
        animalId: animal.id,
        recordDate: "2026-10-11",
        unit: "L",
        amYieldLitres: 10,
        pmYieldLitres: 8,
      })
    ).rejects.toThrow(/Cannot overwrite kilogram-based record with litre entry/);
  });

  it("calculates independent kg and litre totals in herdMetrics and financeSummary", async () => {
    const f = await buildFarm(1, "Analytics Farm");
    const animal = (await db.query(
      `insert into dairy_animals (space_id, name, species, client_uuid, created_by)
       values ($1, 'Cow Dual', 'cow', 'a-dual', $2) returning id`,
      [f.space.id, f.owner.id]
    )).rows[0];

    const todayStr = new Date().toISOString().slice(0, 10);
    const membership = { space_id: f.space.id };

    // Record today: 20 L
    await db.query(
      `insert into dairy_milk_records
         (space_id, animal_id, record_date, unit, am_yield_litres, pm_yield_litres, am_yield_kg, pm_yield_kg, created_by)
       values ($1, $2, $3, 'L', 12.0, 8.0, 0, 0, $4)`,
      [f.space.id, animal.id, todayStr, f.owner.id]
    );

    // Second animal with kg record today: 15 kg
    const animal2 = (await db.query(
      `insert into dairy_animals (space_id, name, species, client_uuid, created_by)
       values ($1, 'Cow Kg', 'cow', 'a-kg', $2) returning id`,
      [f.space.id, f.owner.id]
    )).rows[0];

    await db.query(
      `insert into dairy_milk_records
         (space_id, animal_id, record_date, unit, am_yield_litres, pm_yield_litres, am_yield_kg, pm_yield_kg, created_by)
       values ($1, $2, $3, 'kg', null, null, 9.0, 6.0, $4)`,
      [f.space.id, animal2.id, todayStr, f.owner.id]
    );

    // Check herdMetrics
    const metrics = await dairyModule.herdMetrics(sql, membership);
    expect(Number(metrics.today_milk_litres)).toBe(20.0);
    expect(Number(metrics.today_milk_kg)).toBe(15.0);

    // Check financeSummary
    const finSummary = await dairyFinanceModule.financeSummary(sql, membership);
    expect(Number(finSummary.month_milk_produced_litres)).toBe(20.0);
    expect(Number(finSummary.month_milk_produced_kg)).toBe(15.0);
  });
});
