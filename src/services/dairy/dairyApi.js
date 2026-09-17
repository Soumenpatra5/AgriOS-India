/* Dairy API — thin wrapper around the /api/farm action-routed endpoint.
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

export const dairyApi = {
  /* Herd overview */
  herdMetrics:  (spaceId)                => call("dairy.metrics",          spaceId),

  /* Animals */
  listAnimals:  (spaceId, params = {})   => call("dairy.animals.list",     spaceId, params),
  getAnimal:    (spaceId, animalId)      => call("dairy.animals.get",      spaceId, { animalId }),
  createAnimal: (spaceId, payload)       => call("dairy.animals.create",   spaceId, payload),
  updateAnimal: (spaceId, payload)       => call("dairy.animals.update",   spaceId, payload),
  setStatus:    (spaceId, animalId, status) => call("dairy.animals.setStatus", spaceId, { animalId, status }),

  /* Lactations */
  listLactations:   (spaceId, animalId) => call("dairy.lactations.list",   spaceId, { animalId }),
  addLactation:     (spaceId, payload)  => call("dairy.lactations.add",    spaceId, payload),
  updateLactation:  (spaceId, payload)  => call("dairy.lactations.update", spaceId, payload),

  /* Milk records */
  listMilk:  (spaceId, params = {})     => call("dairy.milk.list",         spaceId, params),
  upsertMilk:(spaceId, payload)         => call("dairy.milk.upsert",       spaceId, payload),
  deleteMilk:(spaceId, recordId)        => call("dairy.milk.delete",       spaceId, { recordId }),

  /* Animal history (unified timeline) */
  animalHistory: (spaceId, animalId, limit = 50) =>
    call("dairy.animal.history", spaceId, { animalId, limit }),

  /* Reproductive events */
  listRepro:   (spaceId, animalId)      => call("dairy.repro.list",        spaceId, { animalId }),
  addRepro:    (spaceId, payload)       => call("dairy.repro.add",         spaceId, payload),
  updateRepro: (spaceId, payload)       => call("dairy.repro.update",      spaceId, payload),
  deleteRepro: (spaceId, eventId)       => call("dairy.repro.delete",      spaceId, { eventId }),

  /* Health events */
  listHealth:   (spaceId, animalId)     => call("dairy.health.list",       spaceId, { animalId }),
  addHealth:    (spaceId, payload)      => call("dairy.health.add",        spaceId, payload),
  updateHealth: (spaceId, payload)      => call("dairy.health.update",     spaceId, payload),
  deleteHealth: (spaceId, eventId)      => call("dairy.health.delete",     spaceId, { eventId }),

  /* Feed records */
  listFeed:    (spaceId, animalId)      => call("dairy.feed.list",         spaceId, { animalId }),
  addFeed:     (spaceId, payload)       => call("dairy.feed.add",          spaceId, payload),
  updateFeed:  (spaceId, payload)       => call("dairy.feed.update",       spaceId, payload),
  deleteFeed:  (spaceId, feedId)        => call("dairy.feed.delete",       spaceId, { feedId }),

  /* Finance — farm.dairy.finance permission required */
  financeSummary: (spaceId, params = {}) => call("dairy.finance.summary", spaceId, params),
  listSales:      (spaceId, params = {}) => call("dairy.sales.list",      spaceId, params),
  addSale:        (spaceId, payload)     => call("dairy.sales.add",       spaceId, payload),
  deleteSale:     (spaceId, saleId)      => call("dairy.sales.delete",    spaceId, { saleId }),
  listCosts:      (spaceId, params = {}) => call("dairy.costs.list",      spaceId, params),
  addCost:        (spaceId, payload)     => call("dairy.costs.add",       spaceId, payload),
  deleteCost:     (spaceId, costId)      => call("dairy.costs.delete",    spaceId, { costId }),
};
