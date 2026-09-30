import { describe, it, expect, beforeAll, vi } from "vitest";
import { validateModuleConfiguration, CORE_MODULES } from "../farm/modules.js";

vi.mock("../db.js", async () => {
  const { dbRef } = await import("./e2e/harness.js");
  return { getSql: () => dbRef.sql };
});
vi.mock("../../_middleware/verifyAuth.js", async () => {
  const { testVerifyToken } = await import("./e2e/harness.js");
  return { verifyToken: testVerifyToken };
});
vi.mock("../blobStore.js", () => ({ deleteAttachment: vi.fn(async () => {}) }));

import {
  freshDb, call, createFarm, join, U,
} from "./e2e/harness.js";

describe("Farm Space Module Configuration", () => {
  describe("validateModuleConfiguration", () => {
    it("rejects non-array input", () => {
      const res = validateModuleConfiguration("not-an-array");
      expect(res.error).toBe("orderedModuleIds must be an array");
    });

    it("rejects unknown module_id", () => {
      const res = validateModuleConfiguration([...CORE_MODULES, "unknownModule"]);
      expect(res.error).toContain("Unknown module_id");
    });

    it("rejects duplicate module_id", () => {
      const res = validateModuleConfiguration([...CORE_MODULES, CORE_MODULES[0]]);
      expect(res.error).toContain("Duplicate module_id");
    });

    it("rejects missing core required module", () => {
      const missingCore = CORE_MODULES.slice(1);
      const res = validateModuleConfiguration(missingCore);
      expect(res.error).toContain("Missing required module_id");
    });

    it("accepts valid module list with core and optional modules", () => {
      const valid = [...CORE_MODULES, "poultryDashboard", "dairyDashboard"];
      const res = validateModuleConfiguration(valid);
      expect(res.error).toBeUndefined();
      expect(res.value).toEqual(valid);
    });
  });

  describe("API Integration: spaces.modules.get and spaces.modules.update", () => {
    let ownerUid;
    let workerUid;
    let space;

    beforeAll(async () => {
      await freshDb();
      ownerUid = U(101);
      workerUid = U(102);
      space = await createFarm(ownerUid, "Modular Farm Space");
      await join(ownerUid, space.id, workerUid, "worker");
    }, 120000);

    it("gets configured modules for the space", async () => {
      const res = await call(ownerUid, "spaces.modules.get", { spaceId: space.id });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(CORE_MODULES.length);
      const moduleIds = res.data.map((m) => m.module_id);
      for (const core of CORE_MODULES) {
        expect(moduleIds).toContain(core);
      }
    });

    it("enables and reorders modules as owner", async () => {
      const newOrder = [
        "poultryDashboard",
        ...CORE_MODULES,
        "dairyDashboard",
      ];

      const updateRes = await call(ownerUid, "spaces.modules.update", {
        spaceId: space.id,
        payload: {
          expected_version: 1,
          orderedModuleIds: newOrder,
        },
      });

      expect(updateRes.status).toBe(200);
      expect(updateRes.data.configuration_version).toBe(2);

      // Verify the new order persisted
      const getRes = await call(ownerUid, "spaces.modules.get", { spaceId: space.id });
      expect(getRes.status).toBe(200);
      const persistedIds = getRes.data.map((m) => m.module_id);
      expect(persistedIds).toEqual(newOrder);
    });

    it("disables an optional module by omitting it from orderedModuleIds", async () => {
      // Omit dairyDashboard to disable it
      const newOrderWithoutDairy = [
        "poultryDashboard",
        ...CORE_MODULES,
      ];

      const updateRes = await call(ownerUid, "spaces.modules.update", {
        spaceId: space.id,
        payload: {
          expected_version: 2,
          orderedModuleIds: newOrderWithoutDairy,
        },
      });

      expect(updateRes.status).toBe(200);
      expect(updateRes.data.configuration_version).toBe(3);

      const getRes = await call(ownerUid, "spaces.modules.get", { spaceId: space.id });
      expect(getRes.status).toBe(200);
      const persistedIds = getRes.data.map((m) => m.module_id);
      expect(persistedIds).toEqual(newOrderWithoutDairy);
      expect(persistedIds).not.toContain("dairyDashboard");
    });

    it("rejects duplicate module in API request with 400", async () => {
      const dupOrder = [
        ...CORE_MODULES,
        "poultryDashboard",
        "poultryDashboard",
      ];

      const res = await call(ownerUid, "spaces.modules.update", {
        spaceId: space.id,
        payload: {
          expected_version: 3,
          orderedModuleIds: dupOrder,
        },
      });

      expect(res.status).toBe(400);
      expect(res.error).toContain("Duplicate module_id");
    });

    it("rejects invalid module in API request with 400", async () => {
      const invalidOrder = [
        ...CORE_MODULES,
        "nonExistentModule",
      ];

      const res = await call(ownerUid, "spaces.modules.update", {
        spaceId: space.id,
        payload: {
          expected_version: 3,
          orderedModuleIds: invalidOrder,
        },
      });

      expect(res.status).toBe(400);
      expect(res.error).toContain("Unknown module_id");
    });

    it("rejects update with stale configuration_version (OCC 409 conflict)", async () => {
      const validOrder = [...CORE_MODULES, "poultryDashboard"];

      // Current version is 3, send stale version 1
      const res = await call(ownerUid, "spaces.modules.update", {
        spaceId: space.id,
        payload: {
          expected_version: 1,
          orderedModuleIds: validOrder,
        },
      });

      expect(res.status).toBe(409);
      expect(res.error).toContain("modified by another user");
    });

    it("rejects unauthorized role (worker) with 403", async () => {
      const validOrder = [...CORE_MODULES, "poultryDashboard"];

      const res = await call(workerUid, "spaces.modules.update", {
        spaceId: space.id,
        payload: {
          expected_version: 3,
          orderedModuleIds: validOrder,
        },
      });

      expect(res.status).toBe(403);
    });
  });
});
