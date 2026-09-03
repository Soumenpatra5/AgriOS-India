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
  listTasks: vi.fn(),
  listAttendance: vi.fn(),
  attendanceSummary: vi.fn(),
  listAnnouncements: vi.fn(),
  listActivity: vi.fn(),
  listMessages: vi.fn(),
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

describe("displayName", () => {
  it("prefers name, then phone, then the AgriOS User ID", () => {
    expect(farmSpaceService.displayName({ name: "Priya", phone: "9000000001", agrios_user_id: "AGRI-X" })).toBe("Priya");
    expect(farmSpaceService.displayName({ name: null, phone: "9000000001", agrios_user_id: "AGRI-X" })).toBe("9000000001");
    expect(farmSpaceService.displayName({ name: null, phone: null, agrios_user_id: "AGRI-X" })).toBe("AGRI-X");
  });

  it("returns null, not a hardcoded word, when nothing identifies the member", () => {
    /* The final "Member" fallback is a translated string, decided by the
       call site — this must not bake in an English default underneath it. */
    expect(farmSpaceService.displayName({})).toBeNull();
    expect(farmSpaceService.displayName(null)).toBeNull();
  });
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

describe("tasks cache", () => {
  const tasks = () => [{ id: "t1", title: "Feed goats", status: "pending" }];

  it("serves repeat reads from cache, kept per space", async () => {
    api.listTasks.mockResolvedValue(tasks());
    await farmSpaceService.tasks("space-a");
    await farmSpaceService.tasks("space-a");
    expect(api.listTasks).toHaveBeenCalledTimes(1);
  });

  it("shares one in-flight request", async () => {
    let resolveApi;
    api.listTasks.mockReturnValue(new Promise((r) => { resolveApi = r; }));
    const p1 = farmSpaceService.tasks("space-a");
    const p2 = farmSpaceService.tasks("space-a", { fresh: true });
    resolveApi(tasks());
    await Promise.all([p1, p2]);
    expect(api.listTasks).toHaveBeenCalledTimes(1);
  });

  it("peekTasks reads without fetching", async () => {
    expect(farmSpaceService.peekTasks("space-a")).toBeNull();
    api.listTasks.mockResolvedValue(tasks());
    await farmSpaceService.tasks("space-a");
    expect(farmSpaceService.peekTasks("space-a")).toHaveLength(1);
  });

  it("patchTask updates one row without a refetch", async () => {
    api.listTasks.mockResolvedValue(tasks());
    await farmSpaceService.tasks("space-a");
    farmSpaceService.patchTask("space-a", "t1", { status: "completed" });
    expect(farmSpaceService.peekTasks("space-a")[0].status).toBe("completed");
    expect(api.listTasks).toHaveBeenCalledTimes(1);
  });

  it("prependTask adds a newly created task to the cache", async () => {
    api.listTasks.mockResolvedValue(tasks());
    await farmSpaceService.tasks("space-a");
    farmSpaceService.prependTask("space-a", { id: "t2", title: "Milk cows", status: "pending" });
    expect(farmSpaceService.peekTasks("space-a").map((t) => t.id)).toEqual(["t2", "t1"]);
  });

  it("patching before anything is cached is a no-op, not a crash", () => {
    expect(() => farmSpaceService.patchTask("space-z", "t1", { status: "done" })).not.toThrow();
    expect(farmSpaceService.peekTasks("space-z")).toBeNull();
  });
});

describe("attendance cache", () => {
  const day = () => ({ rows: [{ user_id: "u1", status: "present" }], summary: { present: 1, members: 3 } });

  it("serves repeat reads from cache and combines the two requests into one round trip", async () => {
    api.listAttendance.mockResolvedValue(day().rows);
    api.attendanceSummary.mockResolvedValue(day().summary);
    const first = await farmSpaceService.attendanceToday("space-a");
    expect(first.rows).toEqual(day().rows);
    expect(first.summary).toEqual(day().summary);

    await farmSpaceService.attendanceToday("space-a");
    expect(api.listAttendance).toHaveBeenCalledTimes(1);
    expect(api.attendanceSummary).toHaveBeenCalledTimes(1);
  });

  it("peekAttendanceToday reads without fetching", async () => {
    expect(farmSpaceService.peekAttendanceToday("space-a")).toBeNull();
    api.listAttendance.mockResolvedValue(day().rows);
    api.attendanceSummary.mockResolvedValue(day().summary);
    await farmSpaceService.attendanceToday("space-a");
    expect(farmSpaceService.peekAttendanceToday("space-a").rows).toEqual(day().rows);
  });

  it("invalidateAttendanceToday forces the next read back to the network", async () => {
    api.listAttendance.mockResolvedValue(day().rows);
    api.attendanceSummary.mockResolvedValue(day().summary);
    await farmSpaceService.attendanceToday("space-a");

    farmSpaceService.invalidateAttendanceToday("space-a");
    expect(farmSpaceService.peekAttendanceToday("space-a")).toBeNull();
    await farmSpaceService.attendanceToday("space-a");
    expect(api.listAttendance).toHaveBeenCalledTimes(2);
  });

  it("keeps two different spaces' attendance apart", async () => {
    api.listAttendance.mockResolvedValueOnce([{ user_id: "u1" }]).mockResolvedValueOnce([{ user_id: "u2" }]);
    api.attendanceSummary.mockResolvedValue(day().summary);
    await farmSpaceService.attendanceToday("space-a");
    await farmSpaceService.attendanceToday("space-b");
    expect(farmSpaceService.peekAttendanceToday("space-a").rows[0].user_id).toBe("u1");
    expect(farmSpaceService.peekAttendanceToday("space-b").rows[0].user_id).toBe("u2");
  });
});

describe("announcements cache", () => {
  const items = () => [{ id: "a1", message: "Vaccination Friday" }];

  it("serves repeat reads from cache", async () => {
    api.listAnnouncements.mockResolvedValue(items());
    await farmSpaceService.announcements("space-a");
    await farmSpaceService.announcements("space-a");
    expect(api.listAnnouncements).toHaveBeenCalledTimes(1);
  });

  it("prependAnnouncement adds a newly posted one without a refetch", async () => {
    api.listAnnouncements.mockResolvedValue(items());
    await farmSpaceService.announcements("space-a");
    farmSpaceService.prependAnnouncement("space-a", { id: "a2", message: "Storm tonight" });
    expect(farmSpaceService.peekAnnouncements("space-a").map((a) => a.id)).toEqual(["a2", "a1"]);
    expect(api.listAnnouncements).toHaveBeenCalledTimes(1);
  });

  it("removeAnnouncementFromCache drops a removed one", async () => {
    api.listAnnouncements.mockResolvedValue(items());
    await farmSpaceService.announcements("space-a");
    farmSpaceService.removeAnnouncementFromCache("space-a", "a1");
    expect(farmSpaceService.peekAnnouncements("space-a")).toEqual([]);
  });
});

describe("activity cache", () => {
  it("serves repeat reads from cache, with no mutation hooks of its own", async () => {
    api.listActivity.mockResolvedValue([{ id: "e1", action: "task.created" }]);
    await farmSpaceService.activity("space-a");
    await farmSpaceService.activity("space-a");
    expect(api.listActivity).toHaveBeenCalledTimes(1);

    /* Only a fresh call — the background refresh a screen fires on every
       mount — reaches the network again, since nothing here invalidates it. */
    await farmSpaceService.activity("space-a", { fresh: true });
    expect(api.listActivity).toHaveBeenCalledTimes(2);
  });
});

describe("chat initial-page cache", () => {
  const msgs = () => [{ id: "m1", body: "hi", created_at: "2026-01-01T00:00:00Z" }];

  it("serves repeat reads from cache", async () => {
    api.listMessages.mockResolvedValue(msgs());
    await farmSpaceService.chatInitial("space-a");
    await farmSpaceService.chatInitial("space-a");
    expect(api.listMessages).toHaveBeenCalledTimes(1);
  });

  it("appendChatMessages merges new ones in, deduped by id, capped at 50", async () => {
    api.listMessages.mockResolvedValue(msgs());
    await farmSpaceService.chatInitial("space-a");

    farmSpaceService.appendChatMessages("space-a", [
      { id: "m1", body: "hi", created_at: "2026-01-01T00:00:00Z" },
      { id: "m2", body: "there", created_at: "2026-01-01T00:01:00Z" },
    ]);
    const list = farmSpaceService.peekChatInitial("space-a");
    expect(list.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("appendChatMessages caps the cached page at 50", async () => {
    api.listMessages.mockResolvedValue(msgs());
    await farmSpaceService.chatInitial("space-a");

    const many = Array.from({ length: 60 }, (_, i) => ({ id: `gen-${i}`, body: String(i), created_at: `t${i}` }));
    farmSpaceService.appendChatMessages("space-a", many);
    expect(farmSpaceService.peekChatInitial("space-a")).toHaveLength(50);
  });

  it("appendChatMessages replaces an existing message in place, in place — a reaction/edit must not duplicate or reorder it", async () => {
    /* Polling now returns messages that only CHANGED (a reaction, an edit, a
       pin), not just brand new ones — the old append-only version silently
       dropped these, which was the actual bug: a reaction never showed up
       without a full reload. */
    api.listMessages.mockResolvedValue([
      { id: "m1", body: "first", created_at: "t1" },
      { id: "m2", body: "second", created_at: "t2" },
    ]);
    await farmSpaceService.chatInitial("space-a");

    farmSpaceService.appendChatMessages("space-a", [
      { id: "m1", body: "first", created_at: "t1", reactions: [{ user_id: "u1", emoji: "👍" }] },
      { id: "m3", body: "third", created_at: "t3" },
    ]);

    const list = farmSpaceService.peekChatInitial("space-a");
    expect(list.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    expect(list[0].reactions).toEqual([{ user_id: "u1", emoji: "👍" }]);
  });

  it("appending before anything is cached is a no-op, not a crash", () => {
    /* Same convention as patchTask/patchMember: in practice load() always
       populates the cache before poll() or send() can fire, so this is a
       defensive no-op rather than a real path — but it must not throw. */
    expect(() => farmSpaceService.appendChatMessages("space-z", [{ id: "x" }])).not.toThrow();
    expect(farmSpaceService.peekChatInitial("space-z")).toBeNull();
  });
});

describe("reset clears every domain cache", () => {
  it("tasks, attendance, announcements, activity and chat are all gone after reset", async () => {
    api.listTasks.mockResolvedValue([{ id: "t1" }]);
    api.listAttendance.mockResolvedValue([{ user_id: "u1" }]);
    api.attendanceSummary.mockResolvedValue({ present: 1, members: 1 });
    api.listAnnouncements.mockResolvedValue([{ id: "a1" }]);
    api.listActivity.mockResolvedValue([{ id: "e1" }]);
    api.listMessages.mockResolvedValue([{ id: "m1" }]);

    await Promise.all([
      farmSpaceService.tasks("space-a"),
      farmSpaceService.attendanceToday("space-a"),
      farmSpaceService.announcements("space-a"),
      farmSpaceService.activity("space-a"),
      farmSpaceService.chatInitial("space-a"),
    ]);

    farmSpaceService.reset();

    expect(farmSpaceService.peekTasks("space-a")).toBeNull();
    expect(farmSpaceService.peekAttendanceToday("space-a")).toBeNull();
    expect(farmSpaceService.peekAnnouncements("space-a")).toBeNull();
    expect(farmSpaceService.peekActivity("space-a")).toBeNull();
    expect(farmSpaceService.peekChatInitial("space-a")).toBeNull();
  });
});
