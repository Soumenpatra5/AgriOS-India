/* Fish / Aquaculture API — thin wrapper around /api/farm action-routed endpoint.
   All calls are space-scoped; the server re-checks membership and permission
   on every request. */

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

export const fishApi = {
  /* Pond metrics */
  pondMetrics:  (spaceId)                => call("fish.metrics",          spaceId),

  /* Ponds */
  listPonds:    (spaceId, params = {})   => call("fish.ponds.list",        spaceId, params),
  getPond:      (spaceId, pondId)        => call("fish.ponds.get",         spaceId, { pondId }),
  createPond:   (spaceId, payload)       => call("fish.ponds.create",      spaceId, payload),
  updatePond:   (spaceId, payload)       => call("fish.ponds.update",      spaceId, payload),
  setStatus:    (spaceId, payload)       => call("fish.ponds.setStatus",   spaceId, payload),

  /* Pond history (unified timeline) */
  pondHistory:  (spaceId, payload = {})  => call("fish.pond.history",      spaceId, payload),

  /* Water quality */
  listWater:    (spaceId, payload = {})  => call("fish.water.list",        spaceId, payload),
  addWater:     (spaceId, payload)       => call("fish.water.add",         spaceId, payload),
  deleteWater:  (spaceId, payload)       => call("fish.water.delete",      spaceId, payload),

  /* Feed records */
  listFeed:     (spaceId, payload = {})  => call("fish.feed.list",         spaceId, payload),
  addFeed:      (spaceId, payload)       => call("fish.feed.add",          spaceId, payload),
  deleteFeed:   (spaceId, payload)       => call("fish.feed.delete",       spaceId, payload),

  /* Health events */
  listHealth:   (spaceId, payload = {})  => call("fish.health.list",       spaceId, payload),
  addHealth:    (spaceId, payload)       => call("fish.health.add",        spaceId, payload),
  updateHealth: (spaceId, payload)       => call("fish.health.update",     spaceId, payload),
  deleteHealth: (spaceId, payload)       => call("fish.health.delete",     spaceId, payload),

  /* Mortality records */
  listMortality:   (spaceId, payload = {}) => call("fish.mortality.list",  spaceId, payload),
  addMortality:    (spaceId, payload)      => call("fish.mortality.add",   spaceId, payload),
  deleteMortality: (spaceId, payload)      => call("fish.mortality.delete", spaceId, payload),

  /* Harvest records */
  listHarvest:   (spaceId, payload = {}) => call("fish.harvest.list",      spaceId, payload),
  addHarvest:    (spaceId, payload)      => call("fish.harvest.add",       spaceId, payload),
  deleteHarvest: (spaceId, payload)      => call("fish.harvest.delete",    spaceId, payload),

  /* Finance — farm.fish.finance permission required */
  financeSummary: (spaceId, params = {}) => call("fish.finance.summary",  spaceId, params),
  listSales:      (spaceId, params = {}) => call("fish.sales.list",       spaceId, params),
  addSale:        (spaceId, payload)     => call("fish.sales.add",        spaceId, payload),
  deleteSale:     (spaceId, payload)     => call("fish.sales.delete",     spaceId, payload),
  listCosts:      (spaceId, params = {}) => call("fish.costs.list",       spaceId, params),
  addCost:        (spaceId, payload)     => call("fish.costs.add",        spaceId, payload),
  deleteCost:     (spaceId, payload)     => call("fish.costs.delete",     spaceId, payload),
};
