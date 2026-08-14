import { describe, it, expect, beforeEach, vi } from "vitest";

/* In-memory stand-in for the erpDb repository, so taskService's own logic
   (bucketing, recurrence spawn, assignee sort) is tested in isolation without
   IndexedDB or the sync layer. */
const held = vi.hoisted(() => {
  let rows = [];
  let seq = 0;
  const repoObj = {
    add: async (data) => { const r = { id: `t${++seq}`, createdAt: "2026-01-01T00:00:00.000Z", ...data }; rows.push(r); return r; },
    getAll: async () => rows.slice(),
    getBy: async (field, value) => rows.filter((r) => r[field] === value),
    getById: async (id) => rows.find((r) => r.id === id) || null,
    update: async (id, patch) => { const r = rows.find((x) => x.id === id); if (!r) return null; Object.assign(r, patch); return r; },
    remove: async (id) => { const i = rows.findIndex((x) => x.id === id); if (i < 0) return null; return rows.splice(i, 1)[0]; },
    reset: () => { rows = []; seq = 0; },
  };
  return { repoObj };
});

vi.mock("../../erp/erpDb.js", () => ({ repo: () => held.repoObj, uid: () => "uid" }));

const { taskService, PRIORITIES, RECURRENCE } = await import("../taskService.js");

/* Same date maths taskService uses internally, so expectations are tz-stable. */
const iso = (d) => d.toISOString().slice(0, 10);
const day = 86400000;
const today = iso(new Date());
const yesterday = iso(new Date(Date.now() - day));
const tomorrow = iso(new Date(Date.now() + day));
const advance = (dateStr, kind) => {
  const d = new Date(dateStr + "T12:00:00");
  if (kind === "daily") d.setDate(d.getDate() + 1);
  if (kind === "weekly") d.setDate(d.getDate() + 7);
  if (kind === "monthly") d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

describe("taskService", () => {
  beforeEach(() => { held.repoObj.reset(); });

  describe("add", () => {
    it("defaults status to 'open'", async () => {
      const t = await taskService.add({ title: "Water field" });
      expect(t.status).toBe("open");
      expect(t.title).toBe("Water field");
    });
    it("lets the caller override the default status", async () => {
      const t = await taskService.add({ title: "x", status: "done" });
      expect(t.status).toBe("done");
    });
  });

  describe("getAll", () => {
    it("scopes to a farm when a farmId is given, else returns everything", async () => {
      await taskService.add({ title: "A", farmId: "f1" });
      await taskService.add({ title: "B", farmId: "f2" });
      expect(await taskService.getAll("f1")).toHaveLength(1);
      expect((await taskService.getAll("f1"))[0].title).toBe("A");
      expect(await taskService.getAll()).toHaveLength(2);
    });
  });

  describe("buckets", () => {
    it("splits open tasks into overdue / today / upcoming and lists done separately", async () => {
      await taskService.add({ title: "late", farmId: "f1", dueDate: yesterday });
      await taskService.add({ title: "now", farmId: "f1", dueDate: today });
      await taskService.add({ title: "soon", farmId: "f1", dueDate: tomorrow });
      await taskService.add({ title: "someday", farmId: "f1" }); // no dueDate
      await taskService.add({ title: "finished", farmId: "f1", dueDate: yesterday, status: "done" });

      const b = await taskService.buckets("f1");
      expect(b.overdue.map((t) => t.title)).toEqual(["late"]);
      expect(b.today.map((t) => t.title)).toEqual(["now"]);
      expect(b.upcoming.map((t) => t.title).sort()).toEqual(["someday", "soon"]);
      expect(b.done.map((t) => t.title)).toEqual(["finished"]);
    });
  });

  describe("complete", () => {
    it("marks a one-time task done and returns null (no follow-up)", async () => {
      const t = await taskService.add({ title: "one-off", dueDate: today });
      const next = await taskService.complete(t.id);
      expect(next).toBeNull();
      const done = await taskService.getAll();
      expect(done[0].status).toBe("done");
      expect(done[0].completedAt).toBeTruthy();
    });

    it("spawns the next occurrence for a recurring task", async () => {
      const t = await taskService.add({ title: "feed", dueDate: today, recurrence: "weekly", priority: "high" });
      const next = await taskService.complete(t.id);
      expect(next).not.toBeNull();
      expect(next.id).not.toBe(t.id);
      expect(next.status).toBe("open");
      expect(next.title).toBe("feed");
      expect(next.recurrence).toBe("weekly");
      expect(next.dueDate).toBe(advance(today, "weekly"));
    });

    it("advances daily and monthly recurrences correctly", async () => {
      const d = await taskService.add({ title: "d", dueDate: today, recurrence: "daily" });
      expect((await taskService.complete(d.id)).dueDate).toBe(advance(today, "daily"));
      const m = await taskService.add({ title: "m", dueDate: today, recurrence: "monthly" });
      expect((await taskService.complete(m.id)).dueDate).toBe(advance(today, "monthly"));
    });

    it("returns null for an unknown id", async () => {
      expect(await taskService.complete("nope")).toBeNull();
    });
  });

  describe("reopen", () => {
    it("clears the done status and completedAt", async () => {
      const t = await taskService.add({ title: "x", dueDate: today });
      await taskService.complete(t.id);
      const re = await taskService.reopen(t.id);
      expect(re.status).toBe("open");
      expect(re.completedAt).toBeNull();
    });
  });

  describe("forEmployee", () => {
    it("returns only that assignee's tasks, earliest due first", async () => {
      await taskService.add({ title: "later", assigneeId: "e1", dueDate: tomorrow });
      await taskService.add({ title: "sooner", assigneeId: "e1", dueDate: yesterday });
      await taskService.add({ title: "other", assigneeId: "e2", dueDate: today });
      const list = await taskService.forEmployee("e1");
      expect(list.map((t) => t.title)).toEqual(["sooner", "later"]);
    });
  });

  describe("constants", () => {
    it("exposes the priority and recurrence vocabularies", () => {
      expect(PRIORITIES.map((p) => p.id)).toEqual(["high", "medium", "low"]);
      expect(RECURRENCE.map((r) => r.id)).toEqual(["", "daily", "weekly", "monthly"]);
    });
  });
});
