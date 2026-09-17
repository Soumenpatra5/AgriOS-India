/* Bee / Apiculture API — thin wrapper around /api/farm action-routed endpoint.
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

export const beeApi = {
  /* Apiaries */
  listApiaries:  (spaceId, payload = {}) => call("bee.apiaries.list",   spaceId, payload),
  createApiary:  (spaceId, payload)      => call("bee.apiaries.create", spaceId, payload),
  deleteApiary:  (spaceId, payload)      => call("bee.apiaries.delete", spaceId, payload),

  /* Hive metrics */
  hiveMetrics:   (spaceId)              => call("bee.metrics",          spaceId),

  /* Hives */
  listHives:     (spaceId, payload = {}) => call("bee.hives.list",      spaceId, payload),
  getHive:       (spaceId, payload)      => call("bee.hives.get",       spaceId, payload),
  createHive:    (spaceId, payload)      => call("bee.hives.create",    spaceId, payload),
  updateHive:    (spaceId, payload)      => call("bee.hives.update",    spaceId, payload),
  setStatus:     (spaceId, payload)      => call("bee.hives.setStatus", spaceId, payload),
  hiveHistory:   (spaceId, payload = {}) => call("bee.hive.history",    spaceId, payload),

  /* Inspections */
  listInspections:  (spaceId, payload = {}) => call("bee.inspections.list",   spaceId, payload),
  addInspection:    (spaceId, payload)      => call("bee.inspections.add",    spaceId, payload),
  deleteInspection: (spaceId, payload)      => call("bee.inspections.delete", spaceId, payload),

  /* Harvests */
  listHarvests:  (spaceId, payload = {}) => call("bee.harvests.list",   spaceId, payload),
  addHarvest:    (spaceId, payload)      => call("bee.harvests.add",    spaceId, payload),
  deleteHarvest: (spaceId, payload)      => call("bee.harvests.delete", spaceId, payload),

  /* Treatments */
  listTreatments:  (spaceId, payload = {}) => call("bee.treatments.list",   spaceId, payload),
  addTreatment:    (spaceId, payload)      => call("bee.treatments.add",    spaceId, payload),
  deleteTreatment: (spaceId, payload)      => call("bee.treatments.delete", spaceId, payload),

  /* Finance — farm.bee.finance permission required */
  financeSummary: (spaceId, payload = {}) => call("bee.finance.summary", spaceId, payload),
  listSales:      (spaceId, payload = {}) => call("bee.sales.list",      spaceId, payload),
  addSale:        (spaceId, payload)      => call("bee.sales.add",       spaceId, payload),
  deleteSale:     (spaceId, payload)      => call("bee.sales.delete",    spaceId, payload),
  listCosts:      (spaceId, payload = {}) => call("bee.costs.list",      spaceId, payload),
  addCost:        (spaceId, payload)      => call("bee.costs.add",       spaceId, payload),
  deleteCost:     (spaceId, payload)      => call("bee.costs.delete",    spaceId, payload),
};
