/* The Farm Space authorization gate.

   Every Farm Space request passes through here before it reads or writes
   anything. It exists as ONE function rather than a check repeated per handler
   because the failure mode of the repeated version is silent: a handler added
   later that forgets step 6 leaks another farm's data, and nothing fails
   loudly. A handler that forgets to call this gets no membership and cannot
   proceed at all.

   The six checks, in order:

     1. Authenticated        verifyToken(req)                  -> 401
     2. Known user           ensureUser(sql, decoded)
     3. Member of space      membership row exists, active     -> 404
     4. Space is active      status = 'active'                 -> 409
     5. Has permission       role matrix + member overrides    -> 403
     6. Object in scope      row.space_id === membership.space_id -> 404

   Step 3 returns 404 rather than 403 deliberately. A 403 confirms the space
   exists, which would let anyone enumerate farms by probing ids. A non-member
   gets exactly what they would get for a space that was never created.

   Step 6 is the one that actually stops cross-farm access and the easiest to
   skip: passing steps 1-5 only proves the caller is a member of SOME space.
   requireScope() is how a handler proves the row it is about to touch belongs
   to the space the caller was authorized for. */

import { verifyToken } from "../../_middleware/verifyAuth.js";
import { ensureUser } from "../ensureUser.js";
import { HttpError } from "../http.js";
import { memberCan, scopeForRole } from "./permissions.js";

/* Not found — used for both "no such space" and "you are not a member", which
   must be indistinguishable from outside. */
const notFound = () => new HttpError(404, "Farm Space not found");

/* Authenticate and identify. Returns the internal users row. */
export async function requireUserRow(req, sql) {
  const decoded = await verifyToken(req);
  if (!decoded) throw new HttpError(401, "Unauthorized");
  return ensureUser(sql, decoded);
}

/* Load the caller's ACTIVE membership of `spaceId`, together with the space.

   The space id always comes from the request body, so it is attacker-
   controlled by definition. That is fine — it is never trusted, only used as a
   lookup key that must match a membership belonging to this user. An id for
   someone else's space simply finds no row. */
export async function requireMembership(sql, userId, spaceId) {
  if (!spaceId || typeof spaceId !== "string") throw notFound();

  /* One query, joined: a separate space lookup would answer "does this space
     exist?" for a non-member, which is the enumeration leak step 3 exists to
     prevent. */
  const rows = await sql`
    select
      m.id           as membership_id,
      m.space_id,
      m.user_id,
      m.role,
      m.status,
      m.permissions,
      s.status       as space_status,
      s.name         as space_name,
      s.owner_user_id
    from farm_space_memberships m
    join farm_spaces s on s.id = m.space_id
    where m.space_id = ${spaceId}
      and m.user_id = ${userId}
      and m.status = 'active'
      and s.deleted_at is null
    limit 1`;

  const m = rows[0];
  if (!m) throw notFound();

  /* An archived space is visible to its members but frozen. 409 rather than
     403: the caller has the right, the space is in the wrong state. */
  if (m.space_status !== "active") {
    throw new HttpError(409, "This Farm Space is archived");
  }
  return m;
}

/* Step 5. Throws 403 with the permission named, which is safe to disclose:
   the caller already proved membership, so this leaks nothing about the space
   and tells an honest client exactly what it lacks. */
export function requirePermission(membership, permission) {
  if (!memberCan(membership, permission)) {
    throw new HttpError(403, `Not permitted: ${permission}`);
  }
  return membership;
}

/* Steps 1-5 in one call, which is how handlers should normally open. */
export async function authorize(req, sql, { spaceId, permission }) {
  const user = await requireUserRow(req, sql);
  const membership = await requireMembership(sql, user.id, spaceId);
  if (permission) requirePermission(membership, permission);
  return { user, membership };
}

/* Step 6. A row fetched by id is only usable if it belongs to the space the
   caller was authorized for.

   Compared as strings because a uuid from the driver and one from a request
   body are both text here, and a loose == between mismatched types is exactly
   the kind of subtlety that turns into a breach. A missing row and a row from
   another space return the same 404 — the caller must not learn which. */
export function requireScope(row, membership) {
  if (!row) throw notFound();
  if (String(row.space_id) !== String(membership.space_id)) throw notFound();
  return row;
}

/* Row-level narrowing for members whose permission is real but limited (a
   worker sees their own tasks, not the farm's). Returned as data for the
   handler to build its `where` from — never sent to the client. */
export function visibilityFor(membership, resource) {
  const scope = scopeForRole(membership.role, resource);
  return { scope, userId: scope === "own" ? membership.user_id : null };
}

/* Audit is part of authorization, not an afterthought: the record of who did
   what is what makes a permission model reviewable. Never throws — a failed
   audit write must not fail the action the farmer just took, but it is logged
   so a silently broken audit trail is noticed. */
export async function audit(sql, { spaceId, actorUserId, action, targetType = null, targetId = null, meta = {} }) {
  try {
    await sql`
      insert into farm_audit_logs (space_id, actor_user_id, action, target_type, target_id, meta)
      values (${spaceId}, ${actorUserId}, ${action}, ${targetType}, ${targetId}, ${sql.json(meta)})`;
  } catch (err) {
    console.error("farm audit write failed:", action, err?.message);
  }
}
