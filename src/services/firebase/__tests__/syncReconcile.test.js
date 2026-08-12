import { describe, it, expect } from "vitest";
import { reconcile, recordTime } from "../syncReconcile.js";

const T1 = "2026-08-12T10:00:00.000Z";
const T2 = "2026-08-12T11:00:00.000Z"; // newer than T1

describe("recordTime", () => {
  it("uses the newest of deletedAt / updatedAt / createdAt", () => {
    expect(recordTime(null)).toBe(0);
    expect(recordTime({ createdAt: T1 })).toBe(Date.parse(T1));
    expect(recordTime({ createdAt: T1, updatedAt: T2 })).toBe(Date.parse(T2));
    expect(recordTime({ updatedAt: T1, deletedAt: T2 })).toBe(Date.parse(T2));
    expect(recordTime({ createdAt: "not-a-date" })).toBe(0);
  });
});

describe("reconcile", () => {
  it("takes cloud when there is no local (including tombstones)", () => {
    expect(reconcile(null, { id: "a", updatedAt: T1 })).toMatchObject({ id: "a" });
    expect(reconcile(null, { id: "a", deletedAt: T1 })).toMatchObject({ id: "a", deletedAt: T1 });
  });

  it("keeps local when there is no cloud", () => {
    expect(reconcile({ id: "a", updatedAt: T1 }, null)).toMatchObject({ id: "a" });
    expect(reconcile(null, null)).toBe(null);
  });

  it("newer wins (last-write-wins)", () => {
    const local = { id: "a", updatedAt: T1, v: "old" };
    const cloud = { id: "a", updatedAt: T2, v: "new" };
    expect(reconcile(local, cloud).v).toBe("new");
  });

  it("H2: a newer cloud tombstone deletes the local record (no resurrection)", () => {
    const local = { id: "a", updatedAt: T1 };
    const cloudTomb = { id: "a", deletedAt: T2 };
    expect(reconcile(local, cloudTomb).deletedAt).toBe(T2);
  });

  it("H2: a stale cloud copy does NOT resurrect a newer local tombstone", () => {
    const localTomb = { id: "a", deletedAt: T2 };
    const cloudLive = { id: "a", updatedAt: T1, v: "stale" };
    expect(reconcile(localTomb, cloudLive).deletedAt).toBe(T2);
  });

  it("H3: a newer local edit is not clobbered by a stale cloud copy", () => {
    const local = { id: "a", updatedAt: T2, v: "mine" };
    const cloud = { id: "a", updatedAt: T1, v: "theirs" };
    expect(reconcile(local, cloud).v).toBe("mine");
  });

  it("on an exact tie, a deletion wins (bias against resurrection)", () => {
    expect(reconcile({ id: "a", updatedAt: T1 }, { id: "a", deletedAt: T1 }).deletedAt).toBe(T1);
    expect(reconcile({ id: "a", deletedAt: T1 }, { id: "a", updatedAt: T1 }).deletedAt).toBe(T1);
  });
});
