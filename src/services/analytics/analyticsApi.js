/* FarmSpace Analytics API — cross-module aggregation endpoint. */

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
    throw err;
  }

  if (!parsed) {
    const err = new Error("Farm Space is not reachable from this build.");
    err.reason = FARM_ERROR.UNCONFIGURED;
    throw err;
  }
  return body?.data;
}

export const analyticsApi = {
  summary:     (spaceId, payload = {}) => call("farm.analytics.summary",     spaceId, payload),
  leaderboard: (spaceId, payload = {}) => call("farm.analytics.leaderboard", spaceId, payload),
};
