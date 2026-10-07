/* Local ERP ↔ Cloud Farm Space Bridge Phase 1 Test Suite
 * Covers at minimum:
 *   1. preview NEW parcel
 *   2. preview EXISTS_SAME
 *   3. preview EXISTS_DIFF
 *   4. publish creates cloud field
 *   5. publish uses local id as client_uuid
 *   6. repeated publish is idempotent
 *   7. cross-space publish is rejected
 *   8. insufficient permission is rejected
 *   9. invalid parcel data is rejected
 *   10. multiple records publish safely
 *   11. audit logging occurs
 *   12. local Firestore sync is not involved
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
  await db.exec(`truncate farm_fields, farm_audit_logs, farm_space_memberships, farm_spaces, users restart identity cascade`);
});

describe("Local ERP ↔ Cloud Farm Space Bridge Phase 1", () => {
  it("1. preview NEW parcel classifies correctly", async () => {
    const f1 = await buildFarm(1, "Bridge Farm 1");
    const parcel = {
      id: "parcel-new-001",
      name: "North Orchard",
      areaAcres: 4.25,
      soilType: "Loamy",
      waterSource: "Borewell",
      currentCrop: "Wheat",
      notes: "High yield potential",
    };

    const res = await call(f1.owner, "bridge.preview", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [parcel] },
    });

    expect(res.status).toBe(200);
    expect(res.data.summary.total).toBe(1);
    expect(res.data.summary.newCount).toBe(1);
    expect(res.data.summary.sameCount).toBe(0);
    expect(res.data.summary.diffCount).toBe(0);

    const item = res.data.items[0];
    expect(item.clientUuid).toBe("parcel-new-001");
    expect(item.name).toBe("North Orchard");
    expect(item.status).toBe("NEW");
    expect(item.cloud).toBeNull();
    expect(item.diffs).toEqual([]);
    expect(item.local.cropType).toBe("wheat");
  });

  it("2. preview EXISTS_SAME identifies identical cloud records", async () => {
    const f1 = await buildFarm(1, "Bridge Farm 1");
    const parcel = {
      id: "parcel-same-001",
      name: "South Meadow",
      areaAcres: 3.5,
      soilType: "Black (Regur)",
      waterSource: "Canal",
      currentCrop: "Cotton",
      notes: "Black soil plot",
    };

    // Publish first
    const pubRes = await call(f1.owner, "bridge.publishFields", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [parcel] },
    });
    expect(pubRes.status).toBe(200);
    expect(pubRes.data.created).toHaveLength(1);

    // Preview identical parcel
    const prevRes = await call(f1.owner, "bridge.preview", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [parcel] },
    });

    expect(prevRes.status).toBe(200);
    expect(prevRes.data.summary.sameCount).toBe(1);
    expect(prevRes.data.summary.newCount).toBe(0);
    expect(prevRes.data.summary.diffCount).toBe(0);

    const item = prevRes.data.items[0];
    expect(item.status).toBe("EXISTS_SAME");
    expect(item.diffs).toHaveLength(0);
    expect(item.cloud.name).toBe("South Meadow");
  });

  it("3. preview EXISTS_DIFF detects field-level modifications", async () => {
    const f1 = await buildFarm(1, "Bridge Farm 1");
    const parcel = {
      id: "parcel-diff-001",
      name: "East Field",
      areaAcres: 5.0,
      soilType: "Clay",
      waterSource: "Drip",
      currentCrop: "Paddy",
    };

    // Publish original
    await call(f1.owner, "bridge.publishFields", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [parcel] },
    });

    // Preview with modified name and area
    const modifiedParcel = {
      ...parcel,
      name: "East Field Extended",
      areaAcres: 6.5,
    };

    const prevRes = await call(f1.owner, "bridge.preview", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [modifiedParcel] },
    });

    expect(prevRes.status).toBe(200);
    expect(prevRes.data.summary.diffCount).toBe(1);
    const item = prevRes.data.items[0];
    expect(item.status).toBe("EXISTS_DIFF");
    expect(item.diffs.length).toBeGreaterThanOrEqual(2);

    const nameDiff = item.diffs.find((d) => d.field === "name");
    expect(nameDiff).toEqual({
      field: "name",
      local: "East Field Extended",
      cloud: "East Field",
    });

    const areaDiff = item.diffs.find((d) => d.field === "area");
    expect(areaDiff).toEqual({
      field: "area",
      local: 6.5,
      cloud: 5,
    });
  });

  it("4. publish creates cloud field row in PostgreSQL", async () => {
    const f1 = await buildFarm(1, "Bridge Farm 1");
    const parcel = {
      id: "parcel-pub-001",
      name: "Riverside Plot",
      areaAcres: 2.75,
      soilType: "Alluvial",
      waterSource: "River",
      currentCrop: "Mustard",
      notes: "Bordering river bank",
    };

    const res = await call(f1.owner, "bridge.publishFields", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [parcel] },
    });

    expect(res.status).toBe(200);
    expect(res.data.created).toHaveLength(1);
    const created = res.data.created[0];
    expect(created.clientUuid).toBe("parcel-pub-001");
    expect(created.name).toBe("Riverside Plot");

    const rows = await db.query(
      `select * from farm_fields where id = $1 and space_id = $2`,
      [created.id, f1.space.id]
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].name).toBe("Riverside Plot");
    expect(Number(rows.rows[0].area)).toBe(2.75);
    expect(rows.rows[0].crop_type).toBe("mustard");
  });

  it("5. publish uses local id as client_uuid and keeps farm_fields.id server-generated", async () => {
    const f1 = await buildFarm(1, "Bridge Farm 1");
    const localId = "local-uuid-custom-123";
    const parcel = {
      id: localId,
      name: "Central Garden",
      areaAcres: 1.5,
    };

    const res = await call(f1.owner, "bridge.publishFields", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [parcel] },
    });

    expect(res.status).toBe(200);
    const created = res.data.created[0];
    expect(created.clientUuid).toBe(localId);
    expect(created.id).not.toBe(localId); // Server-generated UUID

    // UUID format check
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("6. repeated publish is idempotent and does not create duplicate fields", async () => {
    const f1 = await buildFarm(1, "Bridge Farm 1");
    const parcel = {
      id: "parcel-idemp-001",
      name: "Plateau Hill",
      areaAcres: 8.0,
      currentCrop: "Soybean",
    };

    // First publish
    const res1 = await call(f1.owner, "bridge.publishFields", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [parcel] },
    });
    expect(res1.status).toBe(200);
    expect(res1.data.created).toHaveLength(1);
    expect(res1.data.skipped).toHaveLength(0);

    // Second publish
    const res2 = await call(f1.owner, "bridge.publishFields", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [parcel] },
    });
    expect(res2.status).toBe(200);
    expect(res2.data.created).toHaveLength(0);
    expect(res2.data.skipped).toHaveLength(1);
    expect(res2.data.skipped[0].reason).toBe("already_synced");

    // Verify row count in database remains exactly 1
    const countRes = await db.query(
      `select count(*)::int as count from farm_fields where client_uuid = $1`,
      ["parcel-idemp-001"]
    );
    expect(countRes.rows[0].count).toBe(1);
  });

  it("7. cross-space publish is rejected", async () => {
    const f1 = await buildFarm(1, "Farm Alpha");
    const f2 = await buildFarm(2, "Farm Beta");

    const parcel = {
      id: "parcel-cross-001",
      name: "Shared Plot",
      areaAcres: 3.0,
    };

    // Case A: Owner of Farm Alpha tries to publish to Farm Beta's spaceId
    const resWrongSpace = await call(f1.owner, "bridge.publishFields", {
      spaceId: f2.space.id,
      payload: { spaceId: f2.space.id, parcels: [parcel] },
    });
    expect(resWrongSpace.status).toBe(404); // Gate rejects non-member

    // Case B: Space ID in payload mismatches spaceId in route
    const resMismatch = await call(f1.owner, "bridge.publishFields", {
      spaceId: f1.space.id,
      payload: { spaceId: f2.space.id, parcels: [parcel] },
    });
    expect(resMismatch.status).toBe(400); // Target Farm Space mismatch

    // Case C: Parcel already published to Farm Alpha cannot be claimed by Farm Beta
    await call(f1.owner, "bridge.publishFields", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [parcel] },
    });

    // Case D: Preview in Farm Beta detects conflict with Farm Alpha
    const resPreviewConflict = await call(f2.owner, "bridge.preview", {
      spaceId: f2.space.id,
      payload: { spaceId: f2.space.id, parcels: [parcel] },
    });
    expect(resPreviewConflict.status).toBe(200);
    expect(resPreviewConflict.data.summary.conflictCount).toBe(1);
    expect(resPreviewConflict.data.items[0].status).toBe("CONFLICT_OTHER_SPACE");
    expect(resPreviewConflict.data.items[0].error).toMatch(/already linked to another Farm Space/i);
    expect(resPreviewConflict.data.items[0].cloud.space_id).toBe(f1.space.id);

    // Case E: Publish attempt in Farm Beta fails with 409
    const resHijack = await call(f2.owner, "bridge.publishFields", {
      spaceId: f2.space.id,
      payload: { spaceId: f2.space.id, parcels: [parcel] },
    });
    expect(resHijack.status).toBe(409); // Cross-space publish rejected
  });

  it("8. insufficient permission is rejected (workers & supervisors)", async () => {
    const f1 = await buildFarm(1, "Roster Farm", {
      supervisors: [2],
      workers: [3],
    });

    const parcel = { id: "p-perm-001", name: "Worker Plot", areaAcres: 1.0 };

    // Supervisor attempt
    const resSup = await call(f1.supervisors[0], "bridge.preview", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [parcel] },
    });
    expect(resSup.status).toBe(403);
    expect(resSup.error).toMatch(/Not permitted: farm\.crop\.manage/);

    // Worker attempt
    const resWork = await call(f1.workers[0], "bridge.publishFields", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [parcel] },
    });
    expect(resWork.status).toBe(403);
    expect(resWork.error).toMatch(/Not permitted: farm\.crop\.manage/);
  });

  it("9. invalid parcel data is rejected", async () => {
    const f1 = await buildFarm(1, "Validation Farm");

    // Missing id
    const resNoId = await call(f1.owner, "bridge.publishFields", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [{ name: "No ID", areaAcres: 2 }] },
    });
    expect(resNoId.status).toBe(400);

    // Missing name
    const resNoName = await call(f1.owner, "bridge.publishFields", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [{ id: "p-no-name", areaAcres: 2 }] },
    });
    expect(resNoName.status).toBe(400);

    // Negative area
    const resNegArea = await call(f1.owner, "bridge.publishFields", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [{ id: "p-neg", name: "Neg", areaAcres: -5 }] },
    });
    expect(resNegArea.status).toBe(400);
  });

  it("10. multiple records publish safely in a single batch", async () => {
    const f1 = await buildFarm(1, "Batch Farm");
    const parcels = [
      { id: "batch-1", name: "Field Alpha", areaAcres: 2.0, currentCrop: "Rice" },
      { id: "batch-2", name: "Field Beta", areaAcres: 3.5, currentCrop: "Wheat" },
      { id: "batch-3", name: "Field Gamma", areaAcres: 1.2, currentCrop: "Potato" },
    ];

    const res = await call(f1.owner, "bridge.publishFields", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels },
    });

    expect(res.status).toBe(200);
    expect(res.data.created).toHaveLength(3);
    expect(res.data.total).toBe(3);

    const dbRows = await db.query(
      `select client_uuid from farm_fields where space_id = $1 order by client_uuid asc`,
      [f1.space.id]
    );
    expect(dbRows.rows).toHaveLength(3);
    expect(dbRows.rows.map((r) => r.client_uuid)).toEqual(["batch-1", "batch-2", "batch-3"]);
  });

  it("11. audit logging occurs on successful publish", async () => {
    const f1 = await buildFarm(1, "Audit Farm");
    const parcel = { id: "audit-p-01", name: "Audit Plot", areaAcres: 4.0 };

    await call(f1.owner, "bridge.publishFields", {
      spaceId: f1.space.id,
      payload: { spaceId: f1.space.id, parcels: [parcel] },
    });

    const auditRows = await db.query(
      `select * from farm_audit_logs where space_id = $1 and action = 'bridge.publish_fields'`,
      [f1.space.id]
    );
    expect(auditRows.rows).toHaveLength(1);
    const log = auditRows.rows[0];
    expect(log.target_type).toBe("farm_fields");
    expect(log.meta.createdCount).toBe(1);
    expect(log.meta.clientUuids).toContain("audit-p-01");
  });

  it("12. local Firestore sync is not involved in bridge backend or service", async () => {
    // Verify bridge.js source has zero reference to firestore or firebase
    expect(bridgeModule).toBeDefined();
    expect(bridgeModule.preview).toBeTypeOf("function");
    expect(bridgeModule.publishFields).toBeTypeOf("function");

    // Inspect file content directly to verify no firestore/firebase imports
    const fs = await import("fs");
    const bridgeFile = fs.readFileSync(
      new URL("../farm/bridge.js", import.meta.url),
      "utf8"
    );
    expect(bridgeFile).not.toMatch(/firebase/i);
    expect(bridgeFile).not.toMatch(/firestore/i);
    expect(bridgeFile).not.toMatch(/syncRepo/i);
  });
});
