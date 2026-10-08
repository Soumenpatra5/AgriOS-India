/* Local ERP ↔ Cloud Farm Space Bridge Phase 3: Flocks, Ponds & Apiaries Test Suite
 * Covers at minimum:
 *   1. Poultry normalization (country, layer, broiler, count validation, derived placement date, null shed)
 *   2. Fish normalization (acres to sqm, stocking count, stocking date, no createdAt fallback)
 *   3. Bee normalization (colony strength, installed date, no createdAt fallback, null apiary, no location in notes)
 *   4. Diff functions (poultry, fish, bee)
 *   5. Module gating (poultryDashboard, fishDashboard, beeDashboard disabled -> HTTP 400)
 *   6. RBAC permission checks (owner/manager allowed, supervisor/worker rejected with HTTP 403)
 *   7. Preview classification (NEW, EXISTS_SAME, EXISTS_DIFF, CONFLICT_OTHER_SPACE)
 *   8. Publish creates records in poultry_batches, fish_ponds, and bee_hives
 *   9. Idempotency on repeated publish and overwrite toggle behavior
 *   10. Strict cross-space isolation & transaction rollback on conflict (HTTP 409)
 *   11. Audit logging occurs with action 'bridge.publish_livestock'
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

let db;

beforeAll(async () => {
  const env = await freshDb();
  db = env.pg;
}, 40000);

beforeEach(async () => {
  await db.exec(`
    truncate poultry_batches, fish_ponds, bee_hives, farm_audit_logs,
             farm_space_memberships, farm_space_modules, farm_spaces, users
    restart identity cascade
  `);
});

describe("Local ERP ↔ Cloud Farm Space Bridge Phase 3 — Normalization", () => {
  it("normalizes poultry flocks accurately with purpose, breed, and derived placement date", () => {
    // 1. Broiler flock with age in weeks
    const p1 = bridgeModule.normalizePoultryFlock({
      id: "poultry-1",
      name: "Broiler Batch Alpha",
      count: 500,
      breed: "Cobb 500",
      purpose: "meat",
      ageWeeks: 3,
      createdAt: "2026-03-22T10:00:00Z",
    });
    expect(p1.clientUuid).toBe("poultry-1");
    expect(p1.name).toBe("Broiler Batch Alpha");
    expect(p1.placedQty).toBe(500);
    expect(p1.poultryType).toBe("broiler");
    expect(p1.purpose).toBe("meat");
    expect(p1.breed).toBe("Cobb 500");
    expect(p1.shedId).toBeNull();
    expect(p1.batchCode).toBeNull();
    expect(p1.status).toBe("draft");
    expect(p1.notes).toBeNull();
    // 2026-03-22 minus 21 days = 2026-03-01
    expect(p1.placementDate).toBe("2026-03-01");

    // 2. Layer flock (purpose: layer -> poultry_type: layer, purpose: eggs)
    const p2 = bridgeModule.normalizePoultryFlock({
      id: "poultry-2",
      name: "Layer Flock 1",
      count: 200,
      purpose: "layer",
      createdAt: "2026-03-15T00:00:00Z",
    });
    expect(p2.poultryType).toBe("layer");
    expect(p2.purpose).toBe("eggs");
    expect(p2.placementDate).toBe("2026-03-15");

    // 3. Country / Desi breed
    const p3 = bridgeModule.normalizePoultryFlock({
      id: "poultry-3",
      name: "Desi Flock 1",
      count: 50,
      breed: "Desi/Country",
      purpose: "meat",
      createdAt: "2026-03-10T00:00:00Z",
    });
    expect(p3.poultryType).toBe("country");
    expect(p3.purpose).toBe("meat");

    // 4. Invalid count rejection: must be positive integer (never fabricate 1)
    expect(() => bridgeModule.normalizePoultryFlock({ id: "p-err", name: "Zero", count: 0 })).toThrow(/Invalid bird count/);
    expect(() => bridgeModule.normalizePoultryFlock({ id: "p-err", name: "Negative", count: -10 })).toThrow(/Invalid bird count/);
    expect(() => bridgeModule.normalizePoultryFlock({ id: "p-err", name: "Fraction", count: 12.5 })).toThrow(/Invalid bird count/);
    expect(() => bridgeModule.normalizePoultryFlock({ id: "p-err", name: "Missing" })).toThrow(/Bird count is required/);

    // 5. Missing name or id throws 400
    expect(() => bridgeModule.normalizePoultryFlock({ id: "p-err" })).toThrow(/Animal name is required/);
    expect(() => bridgeModule.normalizePoultryFlock({ name: "P" })).toThrow(/Animal id is required/);
  });

  it("normalizes aquaculture fish ponds accurately with area conversion and stocking date", () => {
    // 1. Fish pond with acres converted to sqm
    const f1 = bridgeModule.normalizeFishPond({
      id: "fish-1",
      name: "Pond North",
      species: "Rohu, Catla",
      sizeAcres: 1.5,
      stockingCount: 3000,
      stockingDate: "2026-02-15",
      createdAt: "2026-03-01T00:00:00Z",
    });
    expect(f1.clientUuid).toBe("fish-1");
    expect(f1.name).toBe("Pond North");
    expect(f1.species).toBe("Rohu, Catla");
    // 1.5 * 4046.86 = 6070.29 sqm
    expect(f1.areaSqm).toBe(6070.29);
    expect(f1.stockingCount).toBe(3000);
    expect(f1.stockingDate).toBe("2026-02-15");
    expect(f1.pondType).toBe("earthen");
    expect(f1.cultureType).toBe("polyculture");
    expect(f1.currentStatus).toBe("active");
    expect(f1.depthM).toBeNull();
    expect(f1.notes).toBeNull();

    // 2. Missing stockingDate NEVER substitutes createdAt
    const f2 = bridgeModule.normalizeFishPond({
      id: "fish-2",
      name: "Pond South",
      createdAt: "2026-03-01T00:00:00Z",
    });
    expect(f2.stockingDate).toBeNull();
    expect(f2.areaSqm).toBeNull();
    expect(f2.stockingCount).toBeNull();

    // 3. Negative pond area throws 400
    expect(() => bridgeModule.normalizeFishPond({ id: "f-err", name: "Neg", sizeAcres: -1 })).toThrow(/Invalid pond size/);
  });

  it("normalizes apiary bee hives accurately with colony strength and null apiary container", () => {
    // 1. Bee hive with installation date
    const b1 = bridgeModule.normalizeBeeHive({
      id: "bee-1",
      name: "Hive 01",
      location: "East Orchard",
      colonyStrength: "strong",
      installedDate: "2026-01-20",
      createdAt: "2026-02-01T00:00:00Z",
    });
    expect(b1.clientUuid).toBe("bee-1");
    expect(b1.name).toBe("Hive 01");
    expect(b1.apiaryId).toBeNull();
    expect(b1.hiveType).toBe("langstroth");
    expect(b1.installationDate).toBe("2026-01-20");
    expect(b1.currentStatus).toBe("active");
    expect(b1.notes).toBeNull(); // local location must not be leaked into notes

    // 2. Weak colony status mapping
    const b2 = bridgeModule.normalizeBeeHive({
      id: "bee-2",
      name: "Hive 02",
      colonyStrength: "weak",
    });
    expect(b2.currentStatus).toBe("weak");
    expect(b2.installationDate).toBeNull(); // NEVER substitutes createdAt
  });
});

describe("Local ERP ↔ Cloud Farm Space Bridge Phase 3 — Module Gating & RBAC", () => {
  it("rejects bridge when enterprise module is disabled in target space", async () => {
    const f1 = await buildFarm(1, "Disabled Phase 3 Modules Farm");

    // Disable poultryDashboard, fishDashboard, beeDashboard
    await db.query(
      `insert into farm_space_modules (space_id, module_id, sort_order, enabled)
       values ($1, 'poultryDashboard', 1, false),
              ($1, 'fishDashboard', 2, false),
              ($1, 'beeDashboard', 3, false)
       on conflict (space_id, module_id) do update set enabled = false`,
      [f1.space.id]
    );

    const poultryItem = { id: "p-1", name: "Flock 1", count: 100 };
    const fishItem = { id: "f-1", name: "Pond 1" };
    const beeItem = { id: "b-1", name: "Hive 1" };

    // Poultry disabled check
    const prevPoultry = await call(f1.owner, "bridge.previewLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "poultry", animals: [poultryItem] },
    });
    expect(prevPoultry.status).toBe(400);
    expect(prevPoultry.error).toMatch(/Module "poultryDashboard" is disabled/i);

    // Fish disabled check
    const pubFish = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "fish", animals: [fishItem] },
    });
    expect(pubFish.status).toBe(400);
    expect(pubFish.error).toMatch(/Module "fishDashboard" is disabled/i);

    // Bee disabled check
    const prevBee = await call(f1.owner, "bridge.previewLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "bee", animals: [beeItem] },
    });
    expect(prevBee.status).toBe(400);
    expect(prevBee.error).toMatch(/Module "beeDashboard" is disabled/i);
  });

  it("enforces enterprise-specific RBAC permissions for poultry, fish, and bee", async () => {
    const f1 = await buildFarm(1, "Phase 3 RBAC Farm", {
      managers: [2],
      supervisors: [3],
      workers: [4],
    });

    const poultryItem = { id: "p-perm", name: "Flock Perm", count: 100 };
    const fishItem = { id: "f-perm", name: "Pond Perm" };
    const beeItem = { id: "b-perm", name: "Hive Perm" };

    // Supervisor rejected (HTTP 403)
    const supPoultry = await call(f1.supervisors[0], "bridge.previewLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "poultry", animals: [poultryItem] },
    });
    expect(supPoultry.status).toBe(403);
    expect(supPoultry.error).toMatch(/Not permitted: farm\.poultry\.manage/);

    const supFish = await call(f1.supervisors[0], "bridge.previewLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "fish", animals: [fishItem] },
    });
    expect(supFish.status).toBe(403);
    expect(supFish.error).toMatch(/Not permitted: farm\.fish\.manage/);

    const supBee = await call(f1.supervisors[0], "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "bee", animals: [beeItem] },
    });
    expect(supBee.status).toBe(403);
    expect(supBee.error).toMatch(/Not permitted: farm\.bee\.manage/);

    // Worker rejected (HTTP 403)
    const workFish = await call(f1.workers[0], "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "fish", animals: [fishItem] },
    });
    expect(workFish.status).toBe(403);
    expect(workFish.error).toMatch(/Not permitted: farm\.fish\.manage/);

    // Manager and Owner allowed (HTTP 200)
    const mgrPoultry = await call(f1.managers[0], "bridge.previewLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "poultry", animals: [poultryItem] },
    });
    expect(mgrPoultry.status).toBe(200);

    const ownerFish = await call(f1.owner, "bridge.previewLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "fish", animals: [fishItem] },
    });
    expect(ownerFish.status).toBe(200);

    const ownerBee = await call(f1.owner, "bridge.previewLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "bee", animals: [beeItem] },
    });
    expect(ownerBee.status).toBe(200);
  });
});

describe("Local ERP ↔ Cloud Farm Space Bridge Phase 3 — Preview & Publish", () => {
  it("classifies preview states accurately for Phase 3 domains", async () => {
    const f1 = await buildFarm(1, "P3 Farm 1");
    const f2 = await buildFarm(2, "P3 Farm 2");

    const pNew = { id: "p-new", name: "Batch New", count: 100 };
    const pSame = { id: "p-same", name: "Batch Same", count: 200, breed: "Vencobb", createdAt: "2026-01-01" };
    const pDiff = { id: "p-diff", name: "Batch Diff", count: 300, createdAt: "2026-01-01" };
    const pConf = { id: "p-conf", name: "Batch Other Space", count: 150 };

    // Publish pSame and pDiff into f1
    await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "poultry", animals: [pSame, pDiff] },
    });

    // Publish pConf into f2
    await call(f2.owner, "bridge.publishLivestock", {
      spaceId: f2.space.id,
      payload: { spaceId: f2.space.id, enterprise: "poultry", animals: [pConf] },
    });

    // Preview in f1 with modified pDiff and cross-space pConf
    const modifiedDiff = { ...pDiff, count: 350 };
    const previewRes = await call(f1.owner, "bridge.previewLivestock", {
      spaceId: f1.space.id,
      payload: {
        spaceId: f1.space.id,
        enterprise: "poultry",
        animals: [pNew, pSame, modifiedDiff, pConf],
      },
    });

    expect(previewRes.status).toBe(200);
    const { summary, items } = previewRes.data;
    expect(summary.total).toBe(4);
    expect(summary.newCount).toBe(1);
    expect(summary.sameCount).toBe(1);
    expect(summary.diffCount).toBe(1);
    expect(summary.conflictCount).toBe(1);

    expect(items.find((i) => i.clientUuid === "p-new").status).toBe("NEW");
    expect(items.find((i) => i.clientUuid === "p-same").status).toBe("EXISTS_SAME");
    const diffItem = items.find((i) => i.clientUuid === "p-diff");
    expect(diffItem.status).toBe("EXISTS_DIFF");
    expect(diffItem.diffs).toContainEqual({ field: "placed_qty", local: 350, cloud: 300 });
    expect(items.find((i) => i.clientUuid === "p-conf").status).toBe("CONFLICT_OTHER_SPACE");
  });

  it("publishes poultry flocks, fish ponds, and bee hives safely into cloud tables", async () => {
    const f1 = await buildFarm(1, "Production Registers Farm");

    // 1. Publish Poultry
    const poultryRes = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: {
        spaceId: f1.space.id,
        enterprise: "poultry",
        animals: [{ id: "poultry-pub-1", name: "Flock May", count: 1000, breed: "Ross 308", createdAt: "2026-05-01" }],
      },
    });
    expect(poultryRes.status).toBe(200);
    expect(poultryRes.data.created).toHaveLength(1);
    expect(poultryRes.data.created[0].clientUuid).toBe("poultry-pub-1");

    // 2. Publish Fish
    const fishRes = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: {
        spaceId: f1.space.id,
        enterprise: "fish",
        animals: [{ id: "fish-pub-1", name: "Main Pond", species: "Pangasius", sizeAcres: 2.0, stockingCount: 5000, stockingDate: "2026-04-10" }],
      },
    });
    expect(fishRes.status).toBe(200);
    expect(fishRes.data.created).toHaveLength(1);
    expect(fishRes.data.created[0].clientUuid).toBe("fish-pub-1");

    // 3. Publish Bee
    const beeRes = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: {
        spaceId: f1.space.id,
        enterprise: "bee",
        animals: [{ id: "bee-pub-1", name: "Apiary Box A", colonyStrength: "strong", installedDate: "2026-03-15" }],
      },
    });
    expect(beeRes.status).toBe(200);
    expect(beeRes.data.created).toHaveLength(1);
    expect(beeRes.data.created[0].clientUuid).toBe("bee-pub-1");

    // Verify database rows directly
    const poultryRows = await db.query(`select * from poultry_batches where space_id = $1`, [f1.space.id]);
    expect(poultryRows.rows).toHaveLength(1);
    expect(poultryRows.rows[0].client_uuid).toBe("poultry-pub-1");
    expect(poultryRows.rows[0].name).toBe("Flock May");
    expect(poultryRows.rows[0].placed_qty).toBe(1000);
    expect(poultryRows.rows[0].shed_id).toBeNull(); // No auto-created parent container
    expect(poultryRows.rows[0].status).toBe("draft");

    const fishRows = await db.query(`select * from fish_ponds where space_id = $1`, [f1.space.id]);
    expect(fishRows.rows).toHaveLength(1);
    expect(fishRows.rows[0].client_uuid).toBe("fish-pub-1");
    expect(fishRows.rows[0].name).toBe("Main Pond");
    expect(Number(fishRows.rows[0].area_sqm)).toBe(8093.72); // 2.0 * 4046.86
    expect(fishRows.rows[0].stocking_count).toBe(5000);

    const beeRows = await db.query(`select * from bee_hives where space_id = $1`, [f1.space.id]);
    expect(beeRows.rows).toHaveLength(1);
    expect(beeRows.rows[0].client_uuid).toBe("bee-pub-1");
    expect(beeRows.rows[0].name).toBe("Apiary Box A");
    expect(beeRows.rows[0].apiary_id).toBeNull(); // No auto-created parent container
    expect(beeRows.rows[0].hive_type).toBe("langstroth");
    expect(beeRows.rows[0].current_status).toBe("active");
  });

  it("is idempotent on repeated publish and respects overwrite toggle", async () => {
    const f1 = await buildFarm(1, "Idempotency Farm");

    const fishPond = {
      id: "f-idem-1",
      name: "Fingerling Nursery",
      species: "Tilapia",
      sizeAcres: 0.5,
      stockingCount: 1500,
      stockingDate: "2026-05-01",
    };

    // First publish
    const pub1 = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "fish", animals: [fishPond] },
    });
    expect(pub1.status).toBe(200);
    expect(pub1.data.created).toHaveLength(1);

    // Repeated publish without changes -> skipped as already_synced
    const pub2 = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "fish", animals: [fishPond] },
    });
    expect(pub2.status).toBe(200);
    expect(pub2.data.created).toHaveLength(0);
    expect(pub2.data.skipped).toHaveLength(1);
    expect(pub2.data.skipped[0].reason).toBe("already_synced");

    // Modify local stockingCount
    const modifiedPond = { ...fishPond, stockingCount: 2200 };

    // Publish with overwrite=false -> skipped as exists_diff_no_overwrite
    const pub3 = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "fish", animals: [modifiedPond], overwrite: false },
    });
    expect(pub3.status).toBe(200);
    expect(pub3.data.updated).toHaveLength(0);
    expect(pub3.data.skipped).toHaveLength(1);
    expect(pub3.data.skipped[0].reason).toBe("exists_diff_no_overwrite");

    // Publish with overwrite=true -> updated
    const pub4 = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "fish", animals: [modifiedPond], overwrite: true },
    });
    expect(pub4.status).toBe(200);
    expect(pub4.data.updated).toHaveLength(1);
    expect(pub4.data.updated[0].clientUuid).toBe("f-idem-1");

    const updatedRow = await db.query(`select stocking_count from fish_ponds where client_uuid = $1`, ["f-idem-1"]);
    expect(updatedRow.rows[0].stocking_count).toBe(2200);
  });

  it("strictly rejects cross-space publishing with HTTP 409 and rolls back transaction", async () => {
    const f1 = await buildFarm(1, "Space 1");
    const f2 = await buildFarm(2, "Space 2");

    const hiveF1 = { id: "b-iso-1", name: "Hive Owned by F1" };
    const hiveF2 = { id: "b-iso-2", name: "Hive Clean" };

    // Publish hiveF1 into Space 1
    await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "bee", animals: [hiveF1] },
    });

    // Space 2 attempts to publish both hiveF2 and hiveF1
    const badPub = await call(f2.owner, "bridge.publishLivestock", {
      spaceId: f2.space.id,
      payload: { spaceId: f2.space.id, enterprise: "bee", animals: [hiveF2, hiveF1] },
    });

    expect(badPub.status).toBe(409);
    expect(badPub.error).toMatch(/Cross-space publish rejected/);

    // Ensure hiveF2 was rolled back and NOT created in Space 2
    const f2Hives = await db.query(`select * from bee_hives where space_id = $1`, [f2.space.id]);
    expect(f2Hives.rows).toHaveLength(0);
  });

  it("writes structured audit log entries upon successful publish", async () => {
    const f1 = await buildFarm(1, "Audit Farm");

    const flock = { id: "p-audit-1", name: "Audit Flock", count: 400 };

    await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "poultry", animals: [flock] },
    });

    const logs = await db.query(
      `select * from farm_audit_logs where space_id = $1 and action = 'bridge.publish_livestock'`,
      [f1.space.id]
    );

    expect(logs.rows).toHaveLength(1);
    const entry = logs.rows[0];
    expect(entry.target_type).toBe("poultry_batches");
    expect(entry.meta.enterprise).toBe("poultry");
    expect(entry.meta.total).toBe(1);
    expect(entry.meta.createdCount).toBe(1);
    expect(entry.meta.clientUuids).toEqual(["p-audit-1"]);
  });
});
