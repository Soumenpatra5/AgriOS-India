import { describe, it, expect, beforeEach, vi } from "vitest";
import { enqueueOrCall, replayQueue } from "../offlineQueue.js";
import { clearQueue, listQueue, queueSize } from "../offlineQueueStore.js";

describe("offlineQueue", () => {
  beforeEach(async () => {
    await clearQueue();
  });

  it("calls callFn immediately when online", async () => {
    const callFn = vi.fn().mockResolvedValue({ id: "milk-123", success: true });
    const payload = { animalId: "a1", recordDate: "2026-11-01", clientUuid: "uuid-1" };

    const result = await enqueueOrCall(true, "dairy.milk.upsert", "space-1", payload, callFn);

    expect(callFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: "milk-123", success: true });
    expect(await queueSize()).toBe(0);
  });

  it("throws when offline and payload has no clientUuid", async () => {
    const callFn = vi.fn();
    const payload = { animalId: "a1", recordDate: "2026-11-01" };

    await expect(
      enqueueOrCall(false, "dairy.milk.upsert", "space-1", payload, callFn)
    ).rejects.toThrow("You appear to be offline.");

    expect(callFn).not.toHaveBeenCalled();
    expect(await queueSize()).toBe(0);
  });

  it("enqueues and returns synthetic pending result when offline with clientUuid", async () => {
    const callFn = vi.fn();
    const payload = { animalId: "a1", recordDate: "2026-11-01", clientUuid: "uuid-offline-1" };

    const result = await enqueueOrCall(false, "dairy.milk.upsert", "space-1", payload, callFn);

    expect(callFn).not.toHaveBeenCalled();
    expect(result).toEqual({ __queued: true, id: "uuid-offline-1" });
    expect(await queueSize()).toBe(1);

    const entries = await listQueue();
    expect(entries[0].action).toBe("dairy.milk.upsert");
    expect(entries[0].spaceId).toBe("space-1");
    expect(entries[0].payload).toEqual(payload);
  });

  it("replays queued operations in FIFO order and clears queue on success", async () => {
    const p1 = { animalId: "a1", clientUuid: "uuid-1" };
    const p2 = { animalId: "a2", clientUuid: "uuid-2" };

    await enqueueOrCall(false, "dairy.milk.upsert", "space-1", p1, vi.fn());
    await enqueueOrCall(false, "dairy.milk.upsert", "space-1", p2, vi.fn());

    expect(await queueSize()).toBe(2);

    const replayedCalls = [];
    const replayFn = vi.fn().mockImplementation(async (action, spaceId, payload) => {
      replayedCalls.push({ action, spaceId, payload });
      return { ok: true };
    });

    const status = await replayQueue(replayFn);

    expect(status).toEqual({ replayed: 2, failed: 0, skipped: 0 });
    expect(replayedCalls).toHaveLength(2);
    expect(replayedCalls[0].payload.clientUuid).toBe("uuid-1");
    expect(replayedCalls[1].payload.clientUuid).toBe("uuid-2");
    expect(await queueSize()).toBe(0);
  });

  it("handles server 4xx rejection during replay by discarding the bad item", async () => {
    const pBad = { animalId: "bad", clientUuid: "uuid-bad" };
    const pGood = { animalId: "good", clientUuid: "uuid-good" };

    await enqueueOrCall(false, "dairy.milk.upsert", "space-1", pBad, vi.fn());
    await enqueueOrCall(false, "dairy.milk.upsert", "space-1", pGood, vi.fn());

    const replayFn = vi.fn().mockImplementation(async (action, spaceId, payload) => {
      if (payload.clientUuid === "uuid-bad") {
        const err = new Error("Invalid animal");
        err.status = 400;
        throw err;
      }
      return { ok: true };
    });

    const status = await replayQueue(replayFn);

    expect(status).toEqual({ replayed: 1, failed: 0, skipped: 1 });
    expect(await queueSize()).toBe(0);
  });

  it("queues and replays poultry workflow actions with canonical action names", async () => {
    const pComplete = { taskId: "t-1", notes: "Done", clientUuid: "uuid-c1" };
    const pSkip     = { taskId: "t-2", reason: "Manual override", clientUuid: "uuid-s1" };
    const pOutcome  = { chainId: "c-1", taskId: "t-3", outcome: "recovered", clientUuid: "uuid-o1" };

    await enqueueOrCall(false, "poultry.workflow.complete", "space-1", pComplete, vi.fn());
    await enqueueOrCall(false, "poultry.workflow.skip", "space-1", pSkip, vi.fn());
    await enqueueOrCall(false, "poultry.followup.record_outcome", "space-1", pOutcome, vi.fn());

    expect(await queueSize()).toBe(3);

    const replayed = [];
    const replayFn = vi.fn().mockImplementation(async (action, spaceId, payload) => {
      replayed.push({ action, spaceId, payload });
      return { ok: true };
    });

    const status = await replayQueue(replayFn);

    expect(status).toEqual({ replayed: 3, failed: 0, skipped: 0 });
    expect(replayed.map(r => r.action)).toEqual([
      "poultry.workflow.complete",
      "poultry.workflow.skip",
      "poultry.followup.record_outcome",
    ]);
    expect(await queueSize()).toBe(0);
  });

  it("stops replay on network error (offline) and retains pending entries", async () => {
    const p1 = { clientUuid: "uuid-net-1" };
    const p2 = { clientUuid: "uuid-net-2" };

    await enqueueOrCall(false, "dairy.milk.upsert", "space-1", p1, vi.fn());
    await enqueueOrCall(false, "dairy.milk.upsert", "space-1", p2, vi.fn());

    const replayFn = vi.fn().mockImplementation(async () => {
      const err = new Error("Network offline");
      err.reason = "offline";
      throw err;
    });

    const status = await replayQueue(replayFn);

    expect(status).toEqual({ replayed: 0, failed: 0, skipped: 0 });
    expect(await queueSize()).toBe(2);
  });

  it("maintains unique IDs and correct FIFO dequeueing in memory fallback", async () => {
    const originalIDB = globalThis.indexedDB;
    try {
      delete globalThis.indexedDB;
      await clearQueue();

      await enqueueOrCall(false, "dairy.milk.upsert", "space-1", { clientUuid: "u1" }, vi.fn());
      await enqueueOrCall(false, "dairy.milk.upsert", "space-1", { clientUuid: "u2" }, vi.fn());

      expect(await queueSize()).toBe(2);
      const items = await listQueue();
      expect(items[0].id).toBeDefined();
      expect(items[1].id).toBeDefined();
      expect(items[0].id).not.toBe(items[1].id);

      const replayFn = vi.fn().mockResolvedValue({ ok: true });
      const status = await replayQueue(replayFn);

      expect(status).toEqual({ replayed: 2, failed: 0, skipped: 0 });
      expect(await queueSize()).toBe(0);
    } finally {
      globalThis.indexedDB = originalIDB;
    }
  });
});
