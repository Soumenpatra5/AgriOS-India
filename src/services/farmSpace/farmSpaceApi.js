/* Client for the Farm Space backend (/api/farm).

   One endpoint, action-routed, mirroring the server: every call is a POST
   carrying { action, spaceId, payload } and the Firebase ID token. Follows
   commerceApi.js — authFetch is imported lazily so merely importing this
   module never drags in the Firebase SDK.

   Farm Space is the app's only collaborative feature, and unlike the rest of
   AgriOS it cannot work offline: shared state lives on the server by
   definition, and there is no meaningful local answer to "what has my team
   done today". So the failure modes matter more here than elsewhere, and
   callers get a typed reason rather than a generic throw. */

export const FARM_ERROR = {
  UNCONFIGURED: "unconfigured",  // backend not provisioned (503)
  SIGNED_OUT: "signed-out",      // no or rejected token (401)
  NOT_FOUND: "not-found",        // not a member, or no such space (404)
  FORBIDDEN: "forbidden",        // member, but lacks the permission (403)
  ARCHIVED: "archived",          // space is frozen (409)
  OFFLINE: "offline",            // the request never left the device
  FAILED: "failed",              // anything else
};

function reasonFor(status) {
  if (status === 503) return FARM_ERROR.UNCONFIGURED;
  if (status === 401) return FARM_ERROR.SIGNED_OUT;
  if (status === 404) return FARM_ERROR.NOT_FOUND;
  if (status === 403) return FARM_ERROR.FORBIDDEN;
  if (status === 409) return FARM_ERROR.ARCHIVED;
  return FARM_ERROR.FAILED;
}

async function call(action, { spaceId = null, payload = {} } = {}) {
  const { authFetch } = await import("../firebase/authFetch.js");

  let res;
  try {
    res = await authFetch("/api/farm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, spaceId, payload }),
    });
  } catch {
    /* fetch itself rejected — no network, or the request never left. This is
       the common case on a rural connection and must not read as a crash. */
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
    err.reason = reasonFor(res.status);
    throw err;
  }

  /* A 200 that is not JSON did not come from this API — in dev the endpoint
     does not exist and the SPA fallback answers with index.html, and a
     misconfigured rewrite would do the same in production. Treating that as an
     empty success would show the farmer "you belong to no farms" when the
     truth is the request never reached the server. */
  if (!parsed) {
    const err = new Error("Farm Space is not reachable from this build.");
    err.reason = FARM_ERROR.UNCONFIGURED;
    throw err;
  }
  return body?.data;
}

export const farmSpaceApi = {
  /* Not space-scoped — answered from the caller's own identity. */
  listSpaces:        () => call("spaces.list"),
  createSpace:       (payload) => call("spaces.create", { payload }),
  myInvitations:     () => call("invitations.mine"),
  acceptInvitation:  (invitationId) => call("invitations.accept", { payload: { invitationId } }),
  declineInvitation: (invitationId) => call("invitations.decline", { payload: { invitationId } }),

  /* Space-scoped — the server re-checks membership on every one of these; the
     spaceId travelling from the client is a lookup key, never a claim. */
  getSpace:      (spaceId) => call("spaces.get", { spaceId }),
  updateSpace:   (spaceId, payload) => call("spaces.update", { spaceId, payload }),
  archiveSpace:  (spaceId) => call("spaces.archive", { spaceId }),

  listMembers:   (spaceId) => call("members.list", { spaceId }),
  invite:        (spaceId, payload) => call("members.invite", { spaceId, payload }),
  setMemberRole: (spaceId, userId, role) => call("members.setRole", { spaceId, payload: { userId, role } }),
  removeMember:  (spaceId, userId) => call("members.remove", { spaceId, payload: { userId } }),
  leaveSpace:    (spaceId) => call("members.leave", { spaceId }),

  /* Tasks. The row-level narrowing a worker gets is applied server-side, so
     these same calls return different rows for different members — the client
     never asks for "only mine". */
  listTasks:     (spaceId, params) => call("tasks.list", { spaceId, payload: params || {} }),
  getTask:       (spaceId, taskId) => call("tasks.get", { spaceId, payload: { taskId } }),
  taskSummary:   (spaceId) => call("tasks.summary", { spaceId }),
  createTask:    (spaceId, payload) => call("tasks.create", { spaceId, payload }),
  updateTask:    (spaceId, taskId, patch) => call("tasks.update", { spaceId, payload: { taskId, ...patch } }),
  setTaskStatus: (spaceId, taskId, status, note) => call("tasks.setStatus", { spaceId, payload: { taskId, status, note } }),
  listAudit:     (spaceId, limit) => call("audit.list", { spaceId, payload: { limit } }),
};
