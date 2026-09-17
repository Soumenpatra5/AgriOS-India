/* Crop / Field API — thin wrapper around /api/farm action-routed endpoint. */

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

export const cropApi = {
  /* Field metrics */
  fieldMetrics:  (spaceId)              => call("crop.metrics",           spaceId),

  /* Fields */
  listFields:    (spaceId, payload = {}) => call("crop.fields.list",      spaceId, payload),
  getField:      (spaceId, payload)      => call("crop.fields.get",       spaceId, payload),
  createField:   (spaceId, payload)      => call("crop.fields.create",    spaceId, payload),
  updateField:   (spaceId, payload)      => call("crop.fields.update",    spaceId, payload),
  setStatus:     (spaceId, payload)      => call("crop.fields.setStatus", spaceId, payload),
  fieldHistory:  (spaceId, payload = {}) => call("crop.field.history",    spaceId, payload),

  /* Sowing */
  listSowing:    (spaceId, payload = {}) => call("crop.sowing.list",      spaceId, payload),
  addSowing:     (spaceId, payload)      => call("crop.sowing.add",       spaceId, payload),
  deleteSowing:  (spaceId, payload)      => call("crop.sowing.delete",    spaceId, payload),

  /* Activities */
  listActivities:  (spaceId, payload = {}) => call("crop.activities.list",   spaceId, payload),
  addActivity:     (spaceId, payload)      => call("crop.activities.add",    spaceId, payload),
  deleteActivity:  (spaceId, payload)      => call("crop.activities.delete", spaceId, payload),

  /* Harvests */
  listHarvests:  (spaceId, payload = {}) => call("crop.harvests.list",    spaceId, payload),
  addHarvest:    (spaceId, payload)      => call("crop.harvests.add",     spaceId, payload),
  deleteHarvest: (spaceId, payload)      => call("crop.harvests.delete",  spaceId, payload),

  /* Finance — farm.crop.finance permission required */
  financeSummary: (spaceId, payload = {}) => call("crop.finance.summary", spaceId, payload),
  listSales:      (spaceId, payload = {}) => call("crop.sales.list",      spaceId, payload),
  addSale:        (spaceId, payload)      => call("crop.sales.add",       spaceId, payload),
  deleteSale:     (spaceId, payload)      => call("crop.sales.delete",    spaceId, payload),
  listCosts:      (spaceId, payload = {}) => call("crop.costs.list",      spaceId, payload),
  addCost:        (spaceId, payload)      => call("crop.costs.add",       spaceId, payload),
  deleteCost:     (spaceId, payload)      => call("crop.costs.delete",    spaceId, payload),
};
