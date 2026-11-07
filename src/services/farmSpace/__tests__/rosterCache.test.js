import { describe, it, expect, beforeEach } from "vitest";
import { rosterCache } from "../rosterCache.js";
import { storage } from "../../../utils/storage.js";

describe("rosterCache", () => {
  const spaceId = "space-test-1";

  beforeEach(() => {
    storage.clear();
  });

  it("returns null when no cache exists", () => {
    expect(rosterCache.get(spaceId, "dairy")).toBeNull();
    expect(rosterCache.get(null, "dairy")).toBeNull();
  });

  it("saves and retrieves active animal rosters with timestamp", () => {
    const mockAnimals = [
      { id: "a1", name: "Ganga", tag_id: "TAG-001", current_status: "milking" },
      { id: "a2", name: "Yamuna", tag_id: "TAG-002", current_status: "milking" },
    ];

    rosterCache.save(spaceId, "dairy", mockAnimals);

    const cached = rosterCache.get(spaceId, "dairy");
    expect(cached).not.toBeNull();
    expect(cached.animals).toHaveLength(2);
    expect(cached.animals[0].name).toBe("Ganga");
    expect(cached.updatedAt).toBeGreaterThan(0);
  });

  it("isolates rosters across different spaces and domains", () => {
    const dairyHerd = [{ id: "c1", name: "Gauri" }];
    const goatHerd  = [{ id: "g1", name: "Jamunapari-1" }];

    rosterCache.save("space-A", "dairy", dairyHerd);
    rosterCache.save("space-A", "goat", goatHerd);
    rosterCache.save("space-B", "dairy", [{ id: "c2", name: "Kamadhenu" }]);

    expect(rosterCache.get("space-A", "dairy").animals[0].name).toBe("Gauri");
    expect(rosterCache.get("space-A", "goat").animals[0].name).toBe("Jamunapari-1");
    expect(rosterCache.get("space-B", "dairy").animals[0].name).toBe("Kamadhenu");
    expect(rosterCache.get("space-B", "goat")).toBeNull();
  });

  it("clears cached roster correctly", () => {
    rosterCache.save(spaceId, "dairy", [{ id: "c1", name: "Gauri" }]);
    expect(rosterCache.get(spaceId, "dairy")).not.toBeNull();

    rosterCache.clear(spaceId, "dairy");
    expect(rosterCache.get(spaceId, "dairy")).toBeNull();
  });
});
