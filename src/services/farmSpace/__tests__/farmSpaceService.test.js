import { describe, it, expect, vi, beforeEach } from "vitest";

/* Client-side Farm Space state. The permission assertions here are not a
   second security boundary — the server re-checks every one of them — they
   prove the UI offers the same actions the server would allow, so a member is
   never shown a button that will 403. */

const api = {
  listSpaces: vi.fn(),
  listMembers: vi.fn(),
  myInvitations: vi.fn(),
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
  createSpace: vi.fn(),
};
vi.mock("../farmSpaceApi.js", () => ({
  farmSpaceApi: api,
  FARM_ERROR: { UNCONFIGURED: "unconfigured", OFFLINE: "offline", NOT_FOUND: "not-found" },
}));

const { farmSpaceService, onFarmSpaceChanged: onChanged } = await import("../farmSpaceService.js");
const { storage } = await import("../../../utils/storage.js");

const space = (over = {}) => ({
  id: "space-a", name: "AgriOS Farm", role: "owner", permissions: {},
  status: "active", member_count: 3, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  farmSpaceService.reset();
  storage.remove("farm:activeSpace");
});

describe("permission mirror", () => {
  it("uses the server's own matrix, so the UI cannot drift from it", () => {
    /* Imported from api/_lib/farm/permissions.js — if this import ever broke,
       these would fail rather than silently falling back to a local copy. */
    const owner = space({ role: "owner" });
    const worker = space({ role: "worker" });

    expect(farmSpaceService.can(owner, "farm.settings.manage")).toBe(true);
    expect(farmSpaceService.can(worker, "farm.settings.manage")).toBe(false);
    expect(farmSpaceService.can(worker, "farm.members.manage")).toBe(false);
    expect(farmSpaceService.can(worker, "farm.chat.send")).toBe(true);
  });

  it("honours per-member overrides the way the server does", () => {
    const promoted = space({ role: "worker", permissions: { "farm.tasks.assign": true } });
    expect(farmSpaceService.can(promoted, "farm.tasks.assign")).toBe(true);
  });

  it("draws nothing for a missing space", () => {
    expect(farmSpaceService.can(null, "farm.view")).toBe(false);
  });

  it("reports a worker's narrowed visibility", () => {
    expect(farmSpaceService.scope(space({ role: "worker" }), "tasks")).toBe("own");
    expect(farmSpaceService.scope(space({ role: "manager" }), "tasks")).toBe("all");
  });
});

describe("active space", () => {
  it("needs no choice when the user is in exactly one", async () => {
    api.listSpaces.mockResolvedValue([space()]);
    const active = await farmSpaceService.active();
    expect(active.id).toBe("space-a");
    expect(farmSpaceService.activeId(), "nothing was persisted to get there").toBeNull();
  });

  it("requires a choice when there are several", async () => {
    api.listSpaces.mockResolvedValue([space(), space({ id: "space-b", name: "Green Valley" })]);
    expect(await farmSpaceService.active()).toBeNull();

    farmSpaceService.setActive("space-b");
    expect((await farmSpaceService.active()).name).toBe("Green Valley");
  });

  it("drops an active space the user no longer belongs to", async () => {
    api.listSpaces.mockResolvedValue([space(), space({ id: "space-b" })]);
    await farmSpaceService.spaces();
    farmSpaceService.setActive("space-b");

    /* Access revoked between loads: the stale selection must not survive, or
       the next screen opens onto a 404. */
    api.listSpaces.mockResolvedValue([space()]);
    await farmSpaceService.spaces({ fresh: true });
    expect(farmSpaceService.activeId()).toBeNull();
  });

  it("returns nothing when the user belongs to no space", async () => {
    api.listSpaces.mockResolvedValue([]);
    expect(await farmSpaceService.active()).toBeNull();
  });
});

describe("caching", () => {
  it("serves repeat reads from cache and refetches on demand", async () => {
    api.listSpaces.mockResolvedValue([space()]);
    await farmSpaceService.spaces();
    await farmSpaceService.spaces();
    expect(api.listSpaces).toHaveBeenCalledTimes(1);

    await farmSpaceService.spaces({ fresh: true });
    expect(api.listSpaces).toHaveBeenCalledTimes(2);
  });

  it("reset clears both the cache and the selection", async () => {
    api.listSpaces.mockResolvedValue([space()]);
    await farmSpaceService.spaces();
    farmSpaceService.setActive("space-a");

    farmSpaceService.reset();
    expect(farmSpaceService.activeId()).toBeNull();
    await farmSpaceService.spaces();
    expect(api.listSpaces, "cache was dropped").toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight request across concurrent callers, fresh or not", async () => {
    /* The hub and its own SwitchSpace child both ask for the list on mount.
       On a cold cache that used to mean two identical requests racing —
       this is what stops it. */
    let resolveApi;
    api.listSpaces.mockReturnValue(new Promise((r) => { resolveApi = r; }));

    const p1 = farmSpaceService.spaces();
    const p2 = farmSpaceService.spaces({ fresh: true });
    resolveApi([space()]);
    const [a, b] = await Promise.all([p1, p2]);

    expect(a).toEqual(b);
    expect(api.listSpaces).toHaveBeenCalledTimes(1);
  });

  it("peekSpaces reads the cache without ever fetching", async () => {
    expect(farmSpaceService.peekSpaces()).toBeNull();
    api.listSpaces.mockResolvedValue([space()]);
    await farmSpaceService.spaces();
    expect(farmSpaceService.peekSpaces()).toHaveLength(1);
    expect(api.listSpaces).toHaveBeenCalledTimes(1);
  });

  it("patchSpace applies a mutation's own response without a refetch", async () => {
    api.listSpaces.mockResolvedValue([space()]);
    await farmSpaceService.spaces();

    farmSpaceService.patchSpace("space-a", { name: "Renamed Farm" });
    expect(farmSpaceService.peekSpaces()[0].name).toBe("Renamed Farm");
    expect(api.listSpaces, "no round trip was needed to learn this").toHaveBeenCalledTimes(1);
  });

  it("removeSpaceFromCache drops a deleted space locally", async () => {
    api.listSpaces.mockResolvedValue([space(), space({ id: "space-b" })]);
    await farmSpaceService.spaces();

    farmSpaceService.removeSpaceFromCache("space-b");
    expect(farmSpaceService.peekSpaces().map((s) => s.id)).toEqual(["space-a"]);
  });
});

describe("members cache", () => {
  const roster = () => [{ user_id: "u1", role: "worker", name: "Bijoy" }];

  it("serves repeat reads from cache, kept separately per space", async () => {
    api.listMembers.mockResolvedValue(roster());
    await farmSpaceService.members("space-a");
    await farmSpaceService.members("space-a");
    expect(api.listMembers).toHaveBeenCalledTimes(1);

    await farmSpaceService.members("space-b");
    expect(api.listMembers, "a different space is not the same cache entry").toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight request per space", async () => {
    /* Team, the task-creation sheet and Settings can all mount around the
       same time and each used to fire their own listMembers call. */
    let resolveApi;
    api.listMembers.mockReturnValue(new Promise((r) => { resolveApi = r; }));

    const p1 = farmSpaceService.members("space-a");
    const p2 = farmSpaceService.members("space-a");
    resolveApi(roster());
    await Promise.all([p1, p2]);

    expect(api.listMembers).toHaveBeenCalledTimes(1);
  });

  it("patchMember updates one row without a refetch", async () => {
    api.listMembers.mockResolvedValue(roster());
    await farmSpaceService.members("space-a");

    farmSpaceService.patchMember("space-a", "u1", { role: "manager" });
    expect(farmSpaceService.peekMembers("space-a")[0].role).toBe("manager");
    expect(api.listMembers).toHaveBeenCalledTimes(1);
  });

  it("removeMemberFromCache drops a removed member", async () => {
    api.listMembers.mockResolvedValue(roster());
    await farmSpaceService.members("space-a");

    farmSpaceService.removeMemberFromCache("space-a", "u1");
    expect(farmSpaceService.peekMembers("space-a")).toEqual([]);
  });

  it("invalidateMembers forces the next read back to the network", async () => {
    api.listMembers.mockResolvedValue(roster());
    await farmSpaceService.members("space-a");

    farmSpaceService.invalidateMembers("space-a");
    expect(farmSpaceService.peekMembers("space-a")).toBeNull();
    await farmSpaceService.members("space-a");
    expect(api.listMembers).toHaveBeenCalledTimes(2);
  });

  it("reset clears the member cache too", async () => {
    api.listMembers.mockResolvedValue(roster());
    await farmSpaceService.members("space-a");
    farmSpaceService.reset();
    expect(farmSpaceService.peekMembers("space-a")).toBeNull();
  });
});

describe("joining", () => {
  it("accepting drops the caches and opens the space just joined", async () => {
    api.acceptInvitation.mockResolvedValue({ space_id: "space-b", role: "worker" });
    api.listSpaces.mockResolvedValue([space({ id: "space-b" })]);

    await farmSpaceService.accept("inv-1");
    expect(farmSpaceService.activeId()).toBe("space-b");
    /* Fresh list, not the stale one from before the join. */
    await farmSpaceService.spaces();
    expect(api.listSpaces).toHaveBeenCalledTimes(1);
  });

  it("creating a space opens it", async () => {
    api.createSpace.mockResolvedValue({ id: "space-new", name: "New Farm" });
    const s = await farmSpaceService.create({ name: "New Farm" });
    expect(s.id).toBe("space-new");
    expect(farmSpaceService.activeId()).toBe("space-new");
  });
});

describe("change notification", () => {
  it("tells subscribers when the selection or membership changes", async () => {
    const seen = vi.fn();
    const off = onChanged(seen);
    farmSpaceService.setActive("space-a");
    expect(seen).toHaveBeenCalled();
    off();
    farmSpaceService.setActive("space-b");
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("one broken subscriber does not stop the others", async () => {
    const good = vi.fn();
    const offBad = onChanged(() => { throw new Error("boom"); });
    const offGood = onChanged(good);
    expect(() => farmSpaceService.setActive("space-a")).not.toThrow();
    expect(good).toHaveBeenCalled();
    offBad(); offGood();
  });
});
