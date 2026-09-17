/* Offline write queue — wraps farm API calls so they are held when offline
 * and replayed when connectivity returns.
 *
 * Only write operations with a clientUuid (idempotency key) should use this.
 * Read operations cannot be meaningfully queued — Farm Space data is shared
 * and there is no local source of truth to fall back to.
 *
 * Usage:
 *   import { enqueueOrCall } from "../offlineQueue/offlineQueue.js";
 *   const result = await enqueueOrCall(online, action, spaceId, payload, callFn);
 *
 * When online:  calls callFn immediately and returns the result.
 * When offline: enqueues the call and returns a synthetic pending result so
 *               the UI can show optimistic feedback.
 *
 * The caller is responsible for checking the `__queued` flag on the result. */

import { enqueue, listQueue, dequeue } from "./offlineQueueStore.js";

const PENDING_SENTINEL = { __queued: true };

export async function enqueueOrCall(online, action, spaceId, payload, callFn) {
  if (online) {
    return callFn();
  }

  /* Must have a clientUuid to be safe to queue */
  if (!payload?.clientUuid) {
    const err = new Error("You appear to be offline.");
    err.reason = "offline";
    throw err;
  }

  await enqueue({ action, spaceId, payload });
  return { ...PENDING_SENTINEL, id: payload.clientUuid };
}

/* Replay the queue when connectivity returns.
 *
 * Returns { replayed, failed, skipped }. A failed entry stays in the queue
 * so the next reconnect retries it (up to maxRetries per entry). */
export async function replayQueue(callFn, { maxRetries = 3 } = {}) {
  const entries = await listQueue();
  let replayed = 0, failed = 0, skipped = 0;

  for (const entry of entries) {
    if ((entry.retries ?? 0) >= maxRetries) {
      /* Give up on this entry — remove it so it does not block the queue */
      await dequeue(entry.id);
      skipped++;
      continue;
    }

    try {
      await callFn(entry.action, entry.spaceId, entry.payload);
      await dequeue(entry.id);
      replayed++;
    } catch (err) {
      /* Network error during replay — stop and retry next time */
      if (err?.reason === "offline") break;
      /* Server rejected it (4xx) — remove it so it does not block */
      if (err?.status && err.status >= 400 && err.status < 500) {
        await dequeue(entry.id);
        skipped++;
      } else {
        failed++;
      }
    }
  }

  return { replayed, failed, skipped };
}
