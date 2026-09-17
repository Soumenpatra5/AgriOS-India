/* Pig API — thin wrapper around the /api/farm action-routed endpoint.
   All calls are space-scoped; the server re-checks membership and permission
   on every request, so the client never trusts its own permission state. */

import { FARM_ERROR } from "../farmSpace/farmSpaceApi.js";
export { FARM_ERROR };

async function call(action, spaceId, payload = {}) {
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

export const pigApi = {
  /* Herd overview */
  herdMetrics:  (spaceId)                => call("pig.metrics",          spaceId),

  /* Animals */
  listAnimals:  (spaceId, params = {})   => call("pig.animals.list",     spaceId, params),
  getAnimal:    (spaceId, animalId)      => call("pig.animals.get",      spaceId, { animalId }),
  createAnimal: (spaceId, payload)       => call("pig.animals.create",   spaceId, payload),
  updateAnimal: (spaceId, payload)       => call("pig.animals.update",   spaceId, payload),
  setStatus:    (spaceId, animalId, status) => call("pig.animals.setStatus", spaceId, { animalId, status }),

  /* Animal history (unified timeline) */
  animalHistory: (spaceId, animalId, limit = 50) =>
    call("pig.animal.history", spaceId, { animalId, limit }),

  /* Weight records */
  listWeight:  (spaceId, animalId)      => call("pig.weight.list",       spaceId, { animalId }),
  addWeight:   (spaceId, payload)       => call("pig.weight.add",        spaceId, payload),
  deleteWeight:(spaceId, weightId)      => call("pig.weight.delete",     spaceId, { weightId }),

  /* Reproductive events */
  listRepro:   (spaceId, animalId)      => call("pig.repro.list",        spaceId, { animalId }),
  addRepro:    (spaceId, payload)       => call("pig.repro.add",         spaceId, payload),
  updateRepro: (spaceId, payload)       => call("pig.repro.update",      spaceId, payload),
  deleteRepro: (spaceId, eventId)       => call("pig.repro.delete",      spaceId, { eventId }),

  /* Health events */
  listHealth:   (spaceId, animalId)     => call("pig.health.list",       spaceId, { animalId }),
  addHealth:    (spaceId, payload)      => call("pig.health.add",        spaceId, payload),
  updateHealth: (spaceId, payload)      => call("pig.health.update",     spaceId, payload),
  deleteHealth: (spaceId, eventId)      => call("pig.health.delete",     spaceId, { eventId }),

  /* Feed records */
  listFeed:    (spaceId, animalId)      => call("pig.feed.list",         spaceId, { animalId }),
  addFeed:     (spaceId, payload)       => call("pig.feed.add",          spaceId, payload),
  updateFeed:  (spaceId, payload)       => call("pig.feed.update",       spaceId, payload),
  deleteFeed:  (spaceId, feedId)        => call("pig.feed.delete",       spaceId, { feedId }),

  /* Finance — farm.pig.finance permission required */
  financeSummary: (spaceId, params = {}) => call("pig.finance.summary",  spaceId, params),
  listSales:      (spaceId, params = {}) => call("pig.sales.list",       spaceId, params),
  addSale:        (spaceId, payload)     => call("pig.sales.add",        spaceId, payload),
  deleteSale:     (spaceId, saleId)      => call("pig.sales.delete",     spaceId, { saleId }),
  listCosts:      (spaceId, params = {}) => call("pig.costs.list",       spaceId, params),
  addCost:        (spaceId, payload)     => call("pig.costs.add",        spaceId, payload),
  deleteCost:     (spaceId, costId)      => call("pig.costs.delete",     spaceId, { costId }),
};
