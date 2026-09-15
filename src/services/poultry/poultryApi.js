/* Poultry API — thin wrapper around the /api/farm action-routed endpoint.

   All calls are space-scoped; the server re-checks membership and permission
   on every request so the client never has to trust its own state. */

import { farmSpaceApi, FARM_ERROR } from "../farmSpace/farmSpaceApi.js";

/* Re-export for convenience so callers only import from one place. */
export { FARM_ERROR };

async function call(action, spaceId, payload = {}) {
  // Delegates to the shared call mechanism via a public-enough surface.
  // farmSpaceApi exposes the same call() shape for arbitrary actions via the
  // pattern used by tasks/attendance; we replicate it here directly so the
  // poultry module does not need to reach into farmSpaceApi internals.
  const { authFetch } = await import("../firebase/authFetch.js");
  let res;
  try {
    res = await authFetch("/api/farm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, spaceId, payload }),
    });
  } catch {
    const err = new Error("You appear to be offline.");
    err.reason = FARM_ERROR.OFFLINE;
    throw err;
  }

  let body = null;
  let parsed = true;
  try { body = await res.json(); } catch { parsed = false; }

  if (!res.ok) {
    const err = new Error(body?.error?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.reason = body?.error?.reason ||
      (res.status === 503 ? FARM_ERROR.UNCONFIGURED :
       res.status === 401 ? FARM_ERROR.SIGNED_OUT :
       res.status === 404 ? FARM_ERROR.NOT_FOUND :
       res.status === 403 ? FARM_ERROR.FORBIDDEN :
       res.status === 409 ? FARM_ERROR.ARCHIVED : FARM_ERROR.FAILED);
    err.details = body?.error?.details || null;
    throw err;
  }

  if (!parsed) {
    const err = new Error("Farm Space is not reachable from this build.");
    err.reason = FARM_ERROR.UNCONFIGURED;
    throw err;
  }
  return body?.data;
}

export const poultryApi = {
  /* Sheds */
  listSheds:   (spaceId, params = {}) => call("poultry.sheds.list",   spaceId, params),
  createShed:  (spaceId, payload)     => call("poultry.sheds.create",  spaceId, payload),
  updateShed:  (spaceId, payload)     => call("poultry.sheds.update",  spaceId, payload),
  archiveShed: (spaceId, shedId)      => call("poultry.sheds.archive", spaceId, { shedId }),

  /* Batches */
  listBatches:  (spaceId, params = {})           => call("poultry.batches.list",      spaceId, params),
  getBatch:     (spaceId, batchId)               => call("poultry.batches.get",       spaceId, { batchId }),
  createBatch:  (spaceId, payload)               => call("poultry.batches.create",    spaceId, payload),
  updateBatch:  (spaceId, payload)               => call("poultry.batches.update",    spaceId, payload),
  setBatchStatus: (spaceId, batchId, transition, note) =>
    call("poultry.batches.setStatus", spaceId, { batchId, transition, note: note || null }),
  deleteBatch:  (spaceId, batchId)               => call("poultry.batches.delete",    spaceId, { batchId }),

  /* Daily records */
  listDaily:   (spaceId, batchId)   => call("poultry.daily.list",   spaceId, { batchId }),
  upsertDaily: (spaceId, payload)   => call("poultry.daily.upsert", spaceId, payload),
  deleteDaily: (spaceId, batchId, record_date) =>
    call("poultry.daily.delete", spaceId, { batchId, record_date }),

  /* Body weights */
  listWeights:  (spaceId, batchId) => call("poultry.weights.list",   spaceId, { batchId }),
  addWeight:    (spaceId, payload) => call("poultry.weights.add",    spaceId, payload),
  deleteWeight: (spaceId, weightId) => call("poultry.weights.delete", spaceId, { weightId }),

  /* Feed log */
  listFeed:   (spaceId, batchId) => call("poultry.feed.list",   spaceId, { batchId }),
  addFeed:    (spaceId, payload) => call("poultry.feed.add",    spaceId, payload),
  deleteFeed: (spaceId, feedId)  => call("poultry.feed.delete", spaceId, { feedId }),

  /* Metrics (authoritative live counts + FCR + ADG) */
  metrics: (spaceId, batchId) => call("poultry.metrics", spaceId, { batchId }),

  /* Alert signals (facts for existing alert engine) */
  alertSignals: (spaceId, batchId) => call("poultry.alerts.signals", spaceId, { batchId }),
};
