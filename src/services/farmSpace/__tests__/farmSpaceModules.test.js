import { describe, it, expect, vi, beforeEach } from "vitest";

const api = {
  listSpaces: vi.fn(),
  getModules: vi.fn(),
  updateModules: vi.fn(),
};

vi.mock("../farmSpaceApi.js", () => ({
  farmSpaceApi: api,
  FARM_ERROR: { UNCONFIGURED: "unconfigured", OFFLINE: "offline", NOT_FOUND: "not-found" },
}));

const { farmSpaceService, onFarmSpaceChanged } = await import("../farmSpaceService.js");
const { storage } = await import("../../../utils/storage.js");

const testSpace = (over = {}) => ({
  id: "space-1",
  name: "Test Farm",
  role: "owner",
  configuration_version: 1,
  status: "active",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  farmSpaceService.reset();
  storage.remove("farm:activeSpace");
});

describe("farmSpaceService — module configuration", () => {
  it("fetches modules from API and caches subsequent requests", async () => {
    const mockModules = [
      { module_id: "farmSpaceTeam", enabled: true, sort_order: 0 },
      { module_id: "poultryDashboard", enabled: true, sort_order: 1 },
    ];
    api.getModules.mockResolvedValueOnce(mockModules);

    // First call fetches from API
    const res1 = await farmSpaceService.modules("space-1");
    expect(res1).toEqual(mockModules);
    expect(api.getModules).toHaveBeenCalledTimes(1);

    // Second call reads from cache
    const res2 = await farmSpaceService.modules("space-1");
    expect(res2).toEqual(mockModules);
    expect(api.getModules).toHaveBeenCalledTimes(1);

    // peekModules returns cache synchronously
    expect(farmSpaceService.peekModules("space-1")).toEqual(mockModules);

    // Fresh call bypasses cache
    api.getModules.mockResolvedValueOnce(mockModules);
    const res3 = await farmSpaceService.modules("space-1", { fresh: true });
    expect(res3).toEqual(mockModules);
    expect(api.getModules).toHaveBeenCalledTimes(2);
  });

  it("updateModules updates cache, patches configuration_version, and notifies subscribers", async () => {
    api.listSpaces.mockResolvedValueOnce([testSpace()]);
    await farmSpaceService.spaces({ fresh: true });

    api.updateModules.mockResolvedValueOnce({ configuration_version: 2 });

    let notified = false;
    const unsub = onFarmSpaceChanged(() => {
      notified = true;
    });

    const payload = {
      expected_version: 1,
      orderedModuleIds: ["farmSpaceTeam", "dairyDashboard"],
    };

    const res = await farmSpaceService.updateModules("space-1", payload);
    expect(res.configuration_version).toBe(2);
    expect(api.updateModules).toHaveBeenCalledWith("space-1", payload);

    // Verify cache updated immediately
    const cached = farmSpaceService.peekModules("space-1");
    expect(cached).toBeDefined();
    expect(cached.map((m) => m.module_id)).toEqual(["farmSpaceTeam", "dairyDashboard"]);
    expect(cached[0].enabled).toBe(true);

    // Verify space patched
    const updatedSpace = farmSpaceService.peekSpaces().find((s) => s.id === "space-1");
    expect(updatedSpace.configuration_version).toBe(2);

    // Verify subscriber notified
    expect(notified).toBe(true);
    unsub();
  });
});
