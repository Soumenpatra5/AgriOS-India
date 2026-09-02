/* Farm Space and membership operations — phase 1.

   Handlers here assume the gate has already run: they receive a verified user
   and, where a space is involved, an authorized membership. Nothing in this
   file re-reads the request or re-derives identity, which keeps the number of
   places that decide "may this happen" at exactly one.

   Validation lives here as pure functions so it is testable without a
   database, matching how api/_lib/listings.js is structured. */

import { HttpError } from "../http.js";
import { audit, requireMembership, requireScope } from "./gate.js";
import { ROLES, canAssignRole } from "./permissions.js";

const MAX_NAME = 80;
const MAX_DESC = 500;
const INVITE_TTL_DAYS = 14;

/* ── validation ───────────────────────────────────────────────────────────── */

export function validateSpaceInput(input = {}, { partial = false } = {}) {
  const value = {};

  if (!partial || input.name !== undefined) {
    const name = String(input.name ?? "").trim();
    if (!name) return { error: "name is required" };
    if (name.length > MAX_NAME) return { error: `name must be ${MAX_NAME} characters or fewer` };
    value.name = name;
  }
  for (const [key, max] of [["description", MAX_DESC], ["location", 200], ["photo_url", 500]]) {
    if (input[key] !== undefined) {
      const v = String(input[key] ?? "").trim();
      if (v.length > max) return { error: `${key} must be ${max} characters or fewer` };
      value[key] = v || null;
    }
  }
  if (partial && Object.keys(value).length === 0) return { error: "nothing to update" };
  return { value };
}

/* Indian mobile numbers, stored the way ensureUser stores them: ten digits, no
   +91. Matching an invitation to a user later is a string comparison, so both
   sides must normalize identically or invitations silently never bind. */
export function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

export function normalizeEmail(raw) {
  if (!raw) return null;
  const e = String(raw).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export function validateInviteInput(input = {}) {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  if (!phone && !email) return { error: "a valid phone or email is required" };

  /* Identity is phone-based: the users table mirrors a Firebase uid, a phone
     and a name, and has no email column, so an email-only invitation could be
     created but never matched to anyone or accepted. Refusing it here makes
     that a visible error at invite time instead of an invitation that appears
     to send and silently never arrives. The email column stays in the schema
     for when email identity exists. */
  if (!phone) return { error: "a phone number is required — email invitations are not supported yet" };

  const role = String(input.role ?? "worker");
  if (!ROLES.includes(role)) return { error: `role must be one of: ${ROLES.join(", ")}` };
  /* Ownership is transferred, never invited — otherwise a manager could mint a
     second owner and lock the original out of their own farm. */
  if (role === "owner") return { error: "cannot invite someone as owner; transfer ownership instead" };

  return { value: { phone, email, role } };
}

/* Unguessable, and not derived from the space or user — an invitation token is
   a bearer credential, so a predictable one is a way into someone's farm. */
export function newInviteToken() {
  const bytes = new Uint8Array(24);
  (globalThis.crypto ?? {}).getRandomValues?.(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ── spaces ───────────────────────────────────────────────────────────────── */

/* Every space a user actually belongs to. The only Farm Space query with no
   space id, and it is still scoped: it reads through memberships, so it can
   only ever return spaces this user is a member of. */
export async function listSpaces(sql, userId) {
  const rows = await sql`
    select
      s.id, s.name, s.description, s.photo_url, s.location, s.status,
      s.owner_user_id, s.created_at,
      m.user_id, m.role, m.permissions, m.joined_at,
      (select count(*)::int from farm_space_memberships x
        where x.space_id = s.id and x.status = 'active') as member_count
    from farm_space_memberships m
    join farm_spaces s on s.id = m.space_id
    where m.user_id = ${userId}
      and m.status = 'active'
      and s.deleted_at is null
    order by s.created_at asc`;
  return rows;
}

/* Creating a space makes the creator its owner. Both rows are written in one
   transaction: a space with no owner membership would be unreachable by
   anyone, including the person who just made it. */
export async function createSpace(sql, userId, input) {
  const { value, error } = validateSpaceInput(input);
  if (error) throw new HttpError(400, error);

  const space = await sql.begin(async (tx) => {
    const [s] = await tx`
      insert into farm_spaces (name, owner_user_id, description, photo_url, location)
      values (${value.name}, ${userId}, ${value.description ?? null},
              ${value.photo_url ?? null}, ${value.location ?? null})
      returning *`;
    await tx`
      insert into farm_space_memberships (space_id, user_id, role, status)
      values (${s.id}, ${userId}, 'owner', 'active')`;
    return s;
  });

  await audit(sql, { spaceId: space.id, actorUserId: userId, action: "space.created",
    targetType: "space", targetId: space.id, meta: { name: space.name } });
  return space;
}

export async function updateSpace(sql, membership, actorUserId, input) {
  const { value, error } = validateSpaceInput(input, { partial: true });
  if (error) throw new HttpError(400, error);

  /* Scoped by the membership's space id, never by an id from the body — the
     caller was authorized for exactly one space and this is it. */
  const [updated] = await sql`
    update farm_spaces
       set name        = coalesce(${value.name ?? null}, name),
           description = coalesce(${value.description ?? null}, description),
           photo_url   = coalesce(${value.photo_url ?? null}, photo_url),
           location    = coalesce(${value.location ?? null}, location)
     where id = ${membership.space_id} and deleted_at is null
     returning *`;
  if (!updated) throw new HttpError(404, "Farm Space not found");

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "space.settings_changed",
    targetType: "space", targetId: membership.space_id, meta: { fields: Object.keys(value) } });
  return updated;
}

export async function archiveSpace(sql, membership, actorUserId) {
  const [updated] = await sql`
    update farm_spaces set status = 'archived'
     where id = ${membership.space_id} and deleted_at is null
     returning *`;
  if (!updated) throw new HttpError(404, "Farm Space not found");

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "space.archived",
    targetType: "space", targetId: membership.space_id });
  return updated;
}

/* ── members ──────────────────────────────────────────────────────────────── */

export async function listMembers(sql, membership) {
  return sql`
    select m.id, m.user_id, m.role, m.status, m.permissions, m.joined_at,
           u.name, u.phone
      from farm_space_memberships m
      join users u on u.id = m.user_id
     where m.space_id = ${membership.space_id}
       and m.status = 'active'
     order by m.joined_at asc`;
}

export async function setMemberRole(sql, membership, actorUserId, { userId, role }) {
  if (!ROLES.includes(role)) throw new HttpError(400, `role must be one of: ${ROLES.join(", ")}`);
  if (!canAssignRole(membership.role, role)) {
    throw new HttpError(403, "You cannot assign a role at or above your own");
  }
  /* The owner's own role is structural, not editable: demoting the owner would
     leave the space with none. Ownership moves by transfer, which is phase 2. */
  const [target] = await sql`
    select * from farm_space_memberships
     where space_id = ${membership.space_id} and user_id = ${userId} and status = 'active' limit 1`;
  requireScope(target, membership);
  if (target.role === "owner") throw new HttpError(409, "Transfer ownership instead of changing the owner's role");

  const [updated] = await sql`
    update farm_space_memberships set role = ${role}
     where id = ${target.id} returning *`;

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "member.role_changed",
    targetType: "user", targetId: userId, meta: { from: target.role, to: role } });
  return updated;
}

/* Removal is a status change, not a delete: the audit trail and any work the
   person did must survive them leaving. */
export async function removeMember(sql, membership, actorUserId, { userId }) {
  const [target] = await sql`
    select * from farm_space_memberships
     where space_id = ${membership.space_id} and user_id = ${userId} and status = 'active' limit 1`;
  requireScope(target, membership);
  if (target.role === "owner") throw new HttpError(409, "The owner cannot be removed");

  await sql`update farm_space_memberships set status = 'removed' where id = ${target.id}`;
  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "member.removed",
    targetType: "user", targetId: userId, meta: { role: target.role } });
  return { removed: true };
}

/* A member may always leave — except the owner, who would strand the space. */
export async function leaveSpace(sql, membership, actorUserId) {
  if (membership.role === "owner") {
    throw new HttpError(409, "Transfer ownership or archive the Farm Space before leaving");
  }
  await sql`update farm_space_memberships set status = 'removed' where id = ${membership.membership_id}`;
  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "member.left",
    targetType: "user", targetId: actorUserId });
  return { left: true };
}

/* ── invitations ──────────────────────────────────────────────────────────── */

export async function createInvitation(sql, membership, actorUserId, input) {
  const { value, error } = validateInviteInput(input);
  if (error) throw new HttpError(400, error);
  if (!canAssignRole(membership.role, value.role)) {
    throw new HttpError(403, "You cannot invite someone at or above your own role");
  }

  /* Someone already in the space does not need an invitation, and issuing one
     would let a manager quietly re-role an existing member on accept. */
  const [existing] = await sql`
    select m.id from farm_space_memberships m
      join users u on u.id = m.user_id
     where m.space_id = ${membership.space_id} and m.status = 'active'
       and ((${value.phone}::text is not null and u.phone = ${value.phone})
         or (${value.email}::text is not null and u.name = ${value.email}))
     limit 1`;
  if (existing) throw new HttpError(409, "That person is already a member");

  const expires = new Date(Date.now() + INVITE_TTL_DAYS * 86400000).toISOString();
  const [invite] = await sql`
    insert into farm_space_invitations
      (space_id, phone, email, role, token, invited_by, expires_at)
    values (${membership.space_id}, ${value.phone}, ${value.email}, ${value.role},
            ${newInviteToken()}, ${actorUserId}, ${expires})
    returning *`;

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "member.invited",
    targetType: "invitation", targetId: invite.id, meta: { role: value.role } });
  return invite;
}

/* Invitations addressed to THIS user, matched on the contact details their
   account carries. Deliberately not matched on token alone: a leaked token
   should not let a different account join in the invitee's place. */
export async function listMyInvitations(sql, user) {
  const phone = normalizePhone(user.phone);
  return sql`
    select i.id, i.role, i.created_at, i.expires_at,
           s.id as space_id, s.name as space_name
      from farm_space_invitations i
      join farm_spaces s on s.id = i.space_id
     where i.status = 'pending'
       and i.expires_at > now()
       and s.deleted_at is null
       and (${phone}::text is not null and i.phone = ${phone})
     order by i.created_at desc`;
}

/* Accepting is the only path that creates a membership from an invitation, and
   it re-checks that the invitation is for this user rather than trusting the
   id: a caller can pass any invitation id they like. */
export async function acceptInvitation(sql, user, { invitationId }) {
  const phone = normalizePhone(user.phone);

  const membership = await sql.begin(async (tx) => {
    const [invite] = await tx`
      select * from farm_space_invitations
       where id = ${invitationId} and status = 'pending' and expires_at > now()
       for update`;
    if (!invite) throw new HttpError(404, "Invitation not found");
    if (!phone || invite.phone !== phone) throw new HttpError(404, "Invitation not found");

    await tx`update farm_space_invitations
                set status = 'accepted', accepted_by = ${user.id}
              where id = ${invite.id}`;

    /* A previously removed member rejoining reuses their row, which is why
       this is an upsert rather than an insert — the unique (space_id,user_id)
       constraint would otherwise reject them forever. */
    const [m] = await tx`
      insert into farm_space_memberships (space_id, user_id, role, status, permissions, invited_by)
      values (${invite.space_id}, ${user.id}, ${invite.role}, 'active',
              ${tx.json(invite.permissions || {})}, ${invite.invited_by})
      on conflict (space_id, user_id) do update
        set status = 'active', role = excluded.role, joined_at = now()
      returning *`;
    return m;
  });

  await audit(sql, { spaceId: membership.space_id, actorUserId: user.id, action: "member.joined",
    targetType: "user", targetId: user.id, meta: { role: membership.role } });
  return membership;
}

export async function declineInvitation(sql, user, { invitationId }) {
  const phone = normalizePhone(user.phone);
  const [invite] = await sql`
    select * from farm_space_invitations
     where id = ${invitationId} and status = 'pending' limit 1`;
  if (!invite || !phone || invite.phone !== phone) throw new HttpError(404, "Invitation not found");

  await sql`update farm_space_invitations set status = 'declined', accepted_by = ${user.id}
             where id = ${invite.id}`;
  return { declined: true };
}

export async function listAudit(sql, membership, { limit = 50 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return sql`
    select a.id, a.action, a.target_type, a.target_id, a.meta, a.created_at,
           u.name as actor_name
      from farm_audit_logs a
      left join users u on u.id = a.actor_user_id
     where a.space_id = ${membership.space_id}
     order by a.created_at desc
     limit ${capped}`;
}

/* Re-exported so handlers compose the gate and these operations from one
   import rather than reaching past this module. */
export { requireMembership };
