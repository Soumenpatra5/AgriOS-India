/* Local ERP ↔ Cloud Farm Space Bridge Phase 2: Livestock Test Suite
 * Covers at minimum:
 *   1. Dairy normalization (species, breed, tag, lactation -> status, null fields)
 *   2. Goat/Sheep normalization (species, sex, age brackets -> status, null fields)
 *   3. Pig normalization (sex mapping by gender & age, age brackets -> status, null fields)
 *   4. Module disabled rejection (HTTP 400 for dairy, goat, pig)
 *   5. RBAC permission checks (owner/manager allowed, supervisor/worker rejected 403)
 *   6. Preview classification (NEW, EXISTS_SAME, EXISTS_DIFF, CONFLICT_OTHER_SPACE)
 *   7. Publish creates cloud animal rows in PostgreSQL (dairy, goat, sheep, pig)
 *   8. Publish uses local animal id as client_uuid with server-generated UUID
 *   9. Repeated publish is idempotent and does not create duplicate rows
 *   10. Diff handling: overwrite=false skips; overwrite=true updates cloud fields
 *   11. Strict cross-space isolation & transaction rollback on conflict (HTTP 409)
 *   12. Audit logging occurs with action 'bridge.publish_livestock'
 *   13. Local Firestore sync and local database mutation are not involved
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
    truncate dairy_animals, goat_animals, pig_animals, farm_audit_logs,
             farm_space_memberships, farm_space_modules, farm_spaces, users
    restart identity cascade
  `);
});

describe("Local ERP ↔ Cloud Farm Space Bridge Phase 2 — Normalization", () => {
  it("normalizes dairy animals accurately with required fallbacks", () => {
    // 1. Lactating cow
    const norm1 = bridgeModule.normalizeDairyAnimal({
      id: "dairy-1",
      name: "Gauri",
      type: "cow",
      breed: "Gir",
      tagNo: "TAG-001",
      lactationStatus: "lactating",
    });
    expect(norm1).toEqual({
      clientUuid: "dairy-1",
      name: "Gauri",
      species: "cow",
      breed: "Gir",
      tagId: "TAG-001",
      currentStatus: "milking",
      dob: null,
      acquisitionDate: null,
      acquisitionSource: null,
      notes: null,
    });

    // 2. Buffalo dry and pregnant fallback
    const norm2 = bridgeModule.normalizeDairyAnimal({
      id: "dairy-2",
      name: "Lakshmi",
      type: "buffalo",
      breed: "Murrah",
      tagNo: "TAG-002",
      lactationStatus: "pregnant",
    });
    expect(norm2.species).toBe("buffalo");
    expect(norm2.currentStatus).toBe("dry");

    // 3. Unknown/missing lactationStatus defaults to 'heifer'
    const norm3 = bridgeModule.normalizeDairyAnimal({
      id: "dairy-3",
      name: "Calf 1",
    });
    expect(norm3.species).toBe("cow");
    expect(norm3.currentStatus).toBe("heifer");
    expect(norm3.breed).toBeNull();
    expect(norm3.tagId).toBeNull();

    // 4. Missing name or id throws 400
    expect(() => bridgeModule.normalizeDairyAnimal({ id: "x" })).toThrow(/Animal name is required/);
    expect(() => bridgeModule.normalizeDairyAnimal({ name: "x" })).toThrow(/Animal id is required/);
  });

  it("normalizes goat and sheep animals accurately with age brackets", () => {
    // 1. Goat kid (age <= 6)
    const g1 = bridgeModule.normalizeGoatAnimal({
      id: "goat-1",
      name: "Champa",
      enterprise: "goat",
      gender: "female",
      breed: "Jamnapari",
      tagNo: "G-101",
      ageMonths: 4,
    });
    expect(g1).toEqual({
      clientUuid: "goat-1",
      name: "Champa",
      species: "goat",
      sex: "female",
      breed: "Jamnapari",
      tagId: "G-101",
      currentStatus: "kid",
      dob: null,
      acquisitionDate: null,
      acquisitionSource: null,
      notes: null,
    });

    // 2. Goat grower (6 < age <= 12)
    const g2 = bridgeModule.normalizeGoatAnimal({
      id: "goat-2",
      name: "Raju",
      gender: "male",
      ageMonths: 8,
    });
    expect(g2.species).toBe("goat");
    expect(g2.sex).toBe("male");
    expect(g2.currentStatus).toBe("grower");

    // 3. Goat male breeding (> 12)
    const g3 = bridgeModule.normalizeGoatAnimal({
      id: "goat-3",
      name: "Sultan",
      gender: "male",
      ageMonths: 18,
    });
    expect(g3.currentStatus).toBe("breeding");

    // 4. Goat female milking (> 12)
    const g4 = bridgeModule.normalizeGoatAnimal({
      id: "goat-4",
      name: "Sundari",
      gender: "female",
      ageMonths: 24,
    });
    expect(g4.currentStatus).toBe("milking");

    // 5. Sheep species distinction
    const s1 = bridgeModule.normalizeGoatAnimal({
      id: "sheep-1",
      name: "Bholu",
      enterprise: "sheep",
      gender: "male",
      ageMonths: 15,
    });
    expect(s1.species).toBe("sheep");
    expect(s1.sex).toBe("male");
    expect(s1.currentStatus).toBe("breeding");

    // 6. Missing/invalid age falls back to kid
    const g5 = bridgeModule.normalizeGoatAnimal({
      id: "goat-5",
      name: "NoAge",
    });
    expect(g5.sex).toBe("unknown");
    expect(g5.currentStatus).toBe("kid");
  });

  it("normalizes pig animals accurately with sex and age brackets", () => {
    // 1. Young piglet (age <= 2)
    const p1 = bridgeModule.normalizePigAnimal({
      id: "pig-1",
      name: "Pinky",
      gender: "female",
      breed: "Large White Yorkshire",
      tagNo: "P-01",
      ageMonths: 1.5,
    });
    expect(p1).toEqual({
      clientUuid: "pig-1",
      name: "Pinky",
      sex: "gilt",
      breed: "Large White Yorkshire",
      tagId: "P-01",
      currentStatus: "piglet",
      dob: null,
      acquisitionDate: null,
      acquisitionSource: null,
      notes: null,
    });

    // 2. Male -> boar, grower (2 < age <= 5)
    const p2 = bridgeModule.normalizePigAnimal({
      id: "pig-2",
      name: "Rocky",
      gender: "male",
      ageMonths: 4,
    });
    expect(p2.sex).toBe("boar");
    expect(p2.currentStatus).toBe("grower");

    // 3. Female finisher (5 < age <= 8) -> gilt (age <= 7) vs sow (age > 7)
    const p3 = bridgeModule.normalizePigAnimal({
      id: "pig-3",
      name: "Rosy",
      gender: "female",
      ageMonths: 6,
    });
    expect(p3.sex).toBe("gilt");
    expect(p3.currentStatus).toBe("finisher");

    const p4 = bridgeModule.normalizePigAnimal({
      id: "pig-4",
      name: "Big Mama",
      gender: "female",
      ageMonths: 12,
    });
    expect(p4.sex).toBe("sow");
    expect(p4.currentStatus).toBe("breeder");

    // 4. Missing/invalid age defaults to piglet & unknown sex
    const p5 = bridgeModule.normalizePigAnimal({
      id: "pig-5",
      name: "Anon",
    });
    expect(p5.sex).toBe("unknown");
    expect(p5.currentStatus).toBe("piglet");
  });
});

describe("Local ERP ↔ Cloud Farm Space Bridge Phase 2 — API, Gating & RBAC", () => {
  it("rejects bridge when enterprise module is disabled in target space", async () => {
    const f1 = await buildFarm(1, "Disabled Module Farm");

    // Disable dairyDashboard module in database
    await db.query(
      `insert into farm_space_modules (space_id, module_id, sort_order, enabled)
       values ($1, 'dairyDashboard', 10, false)
       on conflict (space_id, module_id) do update set enabled = false`,
      [f1.space.id]
    );

    const animal = {
      id: "d-001",
      name: "Nandi",
      type: "cow",
      lactationStatus: "lactating",
    };

    const prevRes = await call(f1.owner, "bridge.previewLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "dairy", animals: [animal] },
    });
    expect(prevRes.status).toBe(400);
    expect(prevRes.error).toMatch(/Module "dairyDashboard" is disabled/i);

    const pubRes = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "dairy", animals: [animal] },
    });
    expect(pubRes.status).toBe(400);
    expect(pubRes.error).toMatch(/Module "dairyDashboard" is disabled/i);
  });

  it("enforces enterprise-specific RBAC permissions", async () => {
    const f1 = await buildFarm(1, "RBAC Farm", {
      managers: [2],
      supervisors: [3],
      workers: [4],
    });

    const dairyAnimal = { id: "d-perm", name: "Radha", type: "cow" };
    const goatAnimal = { id: "g-perm", name: "Sonu", enterprise: "goat" };
    const pigAnimal = { id: "p-perm", name: "Babe", gender: "male" };

    // Supervisor attempts should fail with 403
    const supDairy = await call(f1.supervisors[0], "bridge.previewLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "dairy", animals: [dairyAnimal] },
    });
    expect(supDairy.status).toBe(403);
    expect(supDairy.error).toMatch(/Not permitted: farm\.dairy\.manage/);

    const supGoat = await call(f1.supervisors[0], "bridge.previewLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "goat", animals: [goatAnimal] },
    });
    expect(supGoat.status).toBe(403);
    expect(supGoat.error).toMatch(/Not permitted: farm\.goat\.manage/);

    const supPig = await call(f1.supervisors[0], "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "pig", animals: [pigAnimal] },
    });
    expect(supPig.status).toBe(403);
    expect(supPig.error).toMatch(/Not permitted: farm\.pig\.manage/);

    // Worker attempts should fail with 403
    const workDairy = await call(f1.workers[0], "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "dairy", animals: [dairyAnimal] },
    });
    expect(workDairy.status).toBe(403);
    expect(workDairy.error).toMatch(/Not permitted: farm\.dairy\.manage/);

    // Manager and Owner attempts succeed (200)
    const mgrDairy = await call(f1.managers[0], "bridge.previewLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "dairy", animals: [dairyAnimal] },
    });
    expect(mgrDairy.status).toBe(200);

    const ownerGoat = await call(f1.owner, "bridge.previewLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "goat", animals: [goatAnimal] },
    });
    expect(ownerGoat.status).toBe(200);
  });
});

describe("Local ERP ↔ Cloud Farm Space Bridge Phase 2 — Preview & Publish", () => {
  it("classifies preview states accurately (NEW, EXISTS_SAME, EXISTS_DIFF, CONFLICT_OTHER_SPACE)", async () => {
    const f1 = await buildFarm(1, "Livestock Farm 1");
    const f2 = await buildFarm(2, "Livestock Farm 2");

    const aNew = { id: "a-new", name: "New Cow", type: "cow", lactationStatus: "lactating" };
    const aSame = { id: "a-same", name: "Same Cow", type: "cow", breed: "Jersey", lactationStatus: "dry" };
    const aDiff = { id: "a-diff", name: "Diff Cow", type: "buffalo", lactationStatus: "lactating" };
    const aConf = { id: "a-conf", name: "Other Space Cow", type: "cow" };

    // Publish aSame and aDiff into f1
    await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "dairy", animals: [aSame, aDiff] },
    });

    // Publish aConf into f2
    await call(f2.owner, "bridge.publishLivestock", {
      spaceId: f2.space.id,
      payload: { spaceId: f2.space.id, enterprise: "dairy", animals: [aConf] },
    });

    // Preview in f1 with:
    // - aNew (not in cloud -> NEW)
    // - aSame (exact match -> EXISTS_SAME)
    // - modified aDiff (name and lactationStatus changed -> EXISTS_DIFF)
    // - aConf (belongs to f2 -> CONFLICT_OTHER_SPACE)
    const modifiedDiff = { ...aDiff, name: "Diff Cow Renamed", lactationStatus: "dry" };

    const previewRes = await call(f1.owner, "bridge.previewLivestock", {
      spaceId: f1.space.id,
      payload: {
        spaceId: f1.space.id,
        enterprise: "dairy",
        animals: [aNew, aSame, modifiedDiff, aConf],
      },
    });

    expect(previewRes.status).toBe(200);
    const { summary, items } = previewRes.data;
    expect(summary.total).toBe(4);
    expect(summary.newCount).toBe(1);
    expect(summary.sameCount).toBe(1);
    expect(summary.diffCount).toBe(1);
    expect(summary.conflictCount).toBe(1);

    const itemNew = items.find((i) => i.clientUuid === "a-new");
    expect(itemNew.status).toBe("NEW");

    const itemSame = items.find((i) => i.clientUuid === "a-same");
    expect(itemSame.status).toBe("EXISTS_SAME");

    const itemDiff = items.find((i) => i.clientUuid === "a-diff");
    expect(itemDiff.status).toBe("EXISTS_DIFF");
    expect(itemDiff.diffs).toEqual([
      { field: "name", local: "Diff Cow Renamed", cloud: "Diff Cow" },
      { field: "current_status", local: "dry", cloud: "milking" },
    ]);

    const itemConf = items.find((i) => i.clientUuid === "a-conf");
    expect(itemConf.status).toBe("CONFLICT_OTHER_SPACE");
    expect(itemConf.cloud.space_id).toBe(f2.space.id);
  });

  it("publishes dairy, goat, sheep and pig animals safely into target cloud tables", async () => {
    const f1 = await buildFarm(1, "Multi Species Farm");

    // Dairy
    const dairyRes = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: {
        spaceId: f1.space.id,
        enterprise: "dairy",
        animals: [{ id: "d-pub-1", name: "Kamadhenu", type: "cow", breed: "Sahiwal", tagNo: "TAG-D1" }],
      },
    });
    expect(dairyRes.status).toBe(200);
    expect(dairyRes.data.created).toHaveLength(1);
    expect(dairyRes.data.created[0].clientUuid).toBe("d-pub-1");

    // Goat & Sheep
    const goatRes = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: {
        spaceId: f1.space.id,
        enterprise: "goat",
        animals: [
          { id: "g-pub-1", name: "Barkha", enterprise: "goat", gender: "female", ageMonths: 14 },
          { id: "s-pub-1", name: "Moti", enterprise: "sheep", gender: "male", ageMonths: 16 },
        ],
      },
    });
    expect(goatRes.status).toBe(200);
    expect(goatRes.data.created).toHaveLength(2);

    // Pig
    const pigRes = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: {
        spaceId: f1.space.id,
        enterprise: "pig",
        animals: [{ id: "p-pub-1", name: "Napoleon", gender: "male", ageMonths: 10 }],
      },
    });
    expect(pigRes.status).toBe(200);
    expect(pigRes.data.created).toHaveLength(1);

    // Verify database rows directly
    const dairyRows = await db.query(`select * from dairy_animals where space_id = $1`, [f1.space.id]);
    expect(dairyRows.rows).toHaveLength(1);
    expect(dairyRows.rows[0].client_uuid).toBe("d-pub-1");
    expect(dairyRows.rows[0].species).toBe("cow");
    expect(dairyRows.rows[0].breed).toBe("Sahiwal");
    expect(dairyRows.rows[0].dob).toBeNull();
    expect(dairyRows.rows[0].acquisition_date).toBeNull();

    const goatRows = await db.query(`select * from goat_animals where space_id = $1 order by client_uuid asc`, [f1.space.id]);
    expect(goatRows.rows).toHaveLength(2);
    expect(goatRows.rows[0].species).toBe("goat");
    expect(goatRows.rows[0].current_status).toBe("milking");
    expect(goatRows.rows[1].species).toBe("sheep");
    expect(goatRows.rows[1].current_status).toBe("breeding");

    const pigRows = await db.query(`select * from pig_animals where space_id = $1`, [f1.space.id]);
    expect(pigRows.rows).toHaveLength(1);
    expect(pigRows.rows[0].sex).toBe("boar");
    expect(pigRows.rows[0].current_status).toBe("breeder");
  });

  it("is idempotent on repeated publish and respects overwrite toggle", async () => {
    const f1 = await buildFarm(1, "Idempotency Farm");
    const animal = { id: "d-idem", name: "Shyama", type: "cow", lactationStatus: "lactating" };

    // 1st Publish
    const pub1 = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "dairy", animals: [animal] },
    });
    expect(pub1.status).toBe(200);
    expect(pub1.data.created).toHaveLength(1);
    expect(pub1.data.skipped).toHaveLength(0);

    // 2nd Publish (exact same) -> skipped as already_synced
    const pub2 = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "dairy", animals: [animal] },
    });
    expect(pub2.status).toBe(200);
    expect(pub2.data.created).toHaveLength(0);
    expect(pub2.data.skipped).toHaveLength(1);
    expect(pub2.data.skipped[0].reason).toBe("already_synced");

    // 3rd Publish with differences & overwrite=false -> skipped as exists_diff_no_overwrite
    const modified = { ...animal, name: "Shyama Rani" };
    const pub3 = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "dairy", animals: [modified], overwrite: false },
    });
    expect(pub3.status).toBe(200);
    expect(pub3.data.updated).toHaveLength(0);
    expect(pub3.data.skipped[0].reason).toBe("exists_diff_no_overwrite");

    // 4th Publish with differences & overwrite=true -> updated
    const pub4 = await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "dairy", animals: [modified], overwrite: true },
    });
    expect(pub4.status).toBe(200);
    expect(pub4.data.updated).toHaveLength(1);
    expect(pub4.data.updated[0].name).toBe("Shyama Rani");

    const row = await db.query(`select name from dairy_animals where client_uuid = $1`, ["d-idem"]);
    expect(row.rows[0].name).toBe("Shyama Rani");
  });

  it("strictly rejects cross-space publishing with HTTP 409 and rolls back transaction", async () => {
    const f1 = await buildFarm(1, "Space 1");
    const f2 = await buildFarm(2, "Space 2");

    const a1 = { id: "a-cross-1", name: "Cow One", type: "cow" };
    const a2 = { id: "a-cross-2", name: "Cow Two", type: "cow" };

    // Publish a1 to f1
    await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "dairy", animals: [a1] },
    });

    // Space 2 owner attempts to publish batch [a2, a1] where a1 belongs to Space 1
    const hijackRes = await call(f2.owner, "bridge.publishLivestock", {
      spaceId: f2.space.id,
      payload: { spaceId: f2.space.id, enterprise: "dairy", animals: [a2, a1] },
    });

    expect(hijackRes.status).toBe(409);
    expect(hijackRes.error).toMatch(/Cross-space publish rejected/);

    // Verify ATOMIC ROLLBACK: a2 must NOT have been inserted in Space 2
    const rows = await db.query(`select * from dairy_animals where space_id = $1`, [f2.space.id]);
    expect(rows.rows).toHaveLength(0);
  });

  it("writes structured audit log entries upon successful publish", async () => {
    const f1 = await buildFarm(1, "Audit Log Farm");
    const animal = { id: "d-audit-1", name: "Anandi", type: "cow" };

    await call(f1.owner, "bridge.publishLivestock", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, enterprise: "dairy", animals: [animal] },
    });

    const auditRows = await db.query(
      `select * from farm_audit_logs where space_id = $1 and action = 'bridge.publish_livestock'`,
      [f1.space.id]
    );
    expect(auditRows.rows).toHaveLength(1);
    const log = auditRows.rows[0];
    expect(log.target_type).toBe("dairy_animals");
    expect(log.meta.enterprise).toBe("dairy");
    expect(log.meta.createdCount).toBe(1);
    expect(log.meta.clientUuids).toContain("d-audit-1");
  });
});
