/* Farm Space operations — phase 4: attendance, announcements, activity.

   Attendance is the one place where "shared" and "private" meet awkwardly: a
   manager legitimately needs to see who worked, and a worker legitimately
   should not see their colleagues' records. The role matrix already says scope
   "own" for a worker; this file turns that into a where clause, the same way
   tasks does.

   The activity feed is deliberately a READ, not a table. Task events and audit
   entries already record what happened; a third table holding the same events
   would be a copy to keep in sync. It is also filtered: the audit log holds
   entries members should not all see (permission changes, document access), so
   the feed names an allow-list rather than showing everything. */

import { HttpError } from "../http.js";
import { audit, requireScope, visibilityFor } from "./gate.js";
import { memberCan } from "./permissions.js";

export const ATTENDANCE_STATUS = ["present", "absent", "leave", "half_day"];
export const ANNOUNCEMENT_KINDS = ["notice", "meeting", "vaccination", "weather", "emergency"];

const today = () => new Date().toISOString().slice(0, 10);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));

/* ── attendance ───────────────────────────────────────────────────────────── */

export function validateAttendanceInput(input = {}) {
  const value = {};
  const date = input.date ?? today();
  if (!isDate(date)) return { error: "date must be YYYY-MM-DD" };
  value.date = date;

  const status = input.status ?? "present";
  if (!ATTENDANCE_STATUS.includes(status)) {
    return { error: `status must be one of: ${ATTENDANCE_STATUS.join(", ")}` };
  }
  value.status = status;

  if (input.note !== undefined) {
    const n = String(input.note ?? "").trim();
    if (n.length > 500) return { error: "note must be 500 characters or fewer" };
    value.note = n || null;
  }
  if (input.userId !== undefined) value.userId = input.userId || null;
  return { value };
}

/* Marking attendance. A member may always mark their own; marking someone
   else's needs farm.attendance.manage, because "who was here" is the input to
   what people get paid. */
export async function markAttendance(sql, membership, actorUserId, input) {
  const { value, error } = validateAttendanceInput(input);
  if (error) throw new HttpError(400, error);

  const target = value.userId || actorUserId;
  const forSomeoneElse = String(target) !== String(actorUserId);

  if (forSomeoneElse && !memberCan(membership, "farm.attendance.manage")) {
    throw new HttpError(403, "Not permitted: farm.attendance.manage");
  }

  /* The person being marked must be in this space — otherwise attendance could
     be recorded against a stranger's account. */
  const [isMember] = await sql`
    select 1 from farm_space_memberships
     where space_id = ${membership.space_id} and user_id = ${target} and status = 'active' limit 1`;
  if (!isMember) throw new HttpError(400, "That person is not a member of this Farm Space");

  const [row] = await sql`
    insert into farm_attendance (space_id, user_id, date, status, note, marked_by, check_in)
    values (${membership.space_id}, ${target}, ${value.date}, ${value.status},
            ${value.note ?? null}, ${forSomeoneElse ? actorUserId : null},
            ${value.status === "present" ? new Date().toISOString() : null})
    on conflict (space_id, user_id, date) do update
      set status    = excluded.status,
          note      = coalesce(excluded.note, farm_attendance.note),
          marked_by = excluded.marked_by,
          -- The first check-in of the day stands: re-marking must not rewrite
          -- when someone actually arrived.
          check_in  = coalesce(farm_attendance.check_in, excluded.check_in)
    returning *`;

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "attendance.marked",
    targetType: "user", targetId: target, meta: { date: value.date, status: value.status } });
  return row;
}

/* Checking out closes the day. Only the person themselves, or a manager. */
export async function checkOut(sql, membership, actorUserId, { userId, date } = {}) {
  const target = userId || actorUserId;
  if (String(target) !== String(actorUserId) && !memberCan(membership, "farm.attendance.manage")) {
    throw new HttpError(403, "Not permitted: farm.attendance.manage");
  }
  const d = date || today();
  if (!isDate(d)) throw new HttpError(400, "date must be YYYY-MM-DD");

  const [row] = await sql`
    update farm_attendance set check_out = now()
     where space_id = ${membership.space_id} and user_id = ${target} and date = ${d}
     returning *`;
  if (!row) throw new HttpError(409, "There is no check-in for that day yet");
  return row;
}

/* A worker sees their own record; a manager sees the farm's. Narrowed here, in
   the query — never by the client choosing to ask for less. */
export async function listAttendance(sql, membership, { date = null, limit = 100 } = {}) {
  const { scope, userId } = visibilityFor(membership, "attendance");
  const capped = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const d = date && isDate(date) ? date : null;

  return sql`
    select a.id, a.user_id, a.date, a.status, a.check_in, a.check_out, a.note,
           u.name as member_name
      from farm_attendance a
      join users u on u.id = a.user_id
     where a.space_id = ${membership.space_id}
       and (${scope}::text = 'all' or a.user_id = ${userId})
       and (${d}::date is null or a.date = ${d}::date)
     order by a.date desc, u.name asc
     limit ${capped}`;
}

/* The roll-up the hub shows: who is in today, out of how many. A worker's
   summary describes only themselves, so present/total collapse to their own
   row rather than reporting the farm's headcount. */
export async function attendanceSummary(sql, membership, { date = null } = {}) {
  const { scope, userId } = visibilityFor(membership, "attendance");
  const d = date && isDate(date) ? date : today();

  const [row] = await sql`
    select
      count(*) filter (where status = 'present')::int  as present,
      count(*) filter (where status = 'absent')::int   as absent,
      count(*) filter (where status = 'leave')::int    as on_leave,
      count(*) filter (where status = 'half_day')::int as half_day
    from farm_attendance
    where space_id = ${membership.space_id}
      and date = ${d}::date
      and (${scope}::text = 'all' or user_id = ${userId})`;

  const [members] = scope === "all"
    ? await sql`select count(*)::int as n from farm_space_memberships
                 where space_id = ${membership.space_id} and status = 'active'`
    : [{ n: 1 }];

  return { ...row, members: members.n, date: d };
}

/* ── announcements ────────────────────────────────────────────────────────── */

export function validateAnnouncementInput(input = {}) {
  const message = String(input.message ?? "").trim();
  if (!message) return { error: "message is required" };
  if (message.length > 2000) return { error: "message must be 2000 characters or fewer" };

  const kind = input.kind ?? "notice";
  if (!ANNOUNCEMENT_KINDS.includes(kind)) {
    return { error: `kind must be one of: ${ANNOUNCEMENT_KINDS.join(", ")}` };
  }
  return { value: { message, kind } };
}

export async function createAnnouncement(sql, membership, actorUserId, input) {
  const { value, error } = validateAnnouncementInput(input);
  if (error) throw new HttpError(400, error);

  const [row] = await sql`
    insert into farm_announcements (space_id, created_by, kind, message)
    values (${membership.space_id}, ${actorUserId}, ${value.kind}, ${value.message})
    returning *`;

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "announcement.created",
    targetType: "announcement", targetId: row.id, meta: { kind: value.kind } });
  return row;
}

/* Everyone in the space reads announcements — that is what they are for, and
   the role matrix grants farm.view to every role. */
export async function listAnnouncements(sql, membership, { limit = 50 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return sql`
    select a.id, a.kind, a.message, a.created_at, u.name as author_name
      from farm_announcements a
      left join users u on u.id = a.created_by
     where a.space_id = ${membership.space_id}
       and a.deleted_at is null
     order by a.created_at desc
     limit ${capped}`;
}

export async function removeAnnouncement(sql, membership, actorUserId, { announcementId }) {
  const [row] = await sql`
    select * from farm_announcements where id = ${announcementId} and deleted_at is null limit 1`;
  requireScope(row, membership);

  /* Your own notice, or you manage announcements for the farm. */
  const own = String(row.created_by) === String(actorUserId);
  if (!own && !memberCan(membership, "farm.announcement.create")) {
    throw new HttpError(403, "Not permitted: farm.announcement.create");
  }

  await sql`update farm_announcements set deleted_at = now() where id = ${announcementId}`;
  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "announcement.removed",
    targetType: "announcement", targetId: announcementId });
  return { removed: true };
}

/* ── activity feed ────────────────────────────────────────────────────────── */

/* Audit actions safe for every member to see. The audit log also holds
   entries that are a security record rather than farm news — permission
   changes, document access, ownership transfer — and those stay out of the
   feed. An allow-list rather than a deny-list, so a new audit action is
   invisible until someone decides it belongs here. */
const FEED_ACTIONS = new Set([
  "space.created",
  "member.joined", "member.invited", "member.left",
  "task.created", "task.accepted", "task.in_progress",
  "task.completed", "task.verified", "task.rejected", "task.cancelled",
  "task.reassigned",
  "announcement.created",
  "attendance.marked",
]);

/* One merged, member-safe stream. Reads the two tables that already record
   what happened rather than a third that would have to be kept in step. */
export async function listActivity(sql, membership, { limit = 50 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const allowed = [...FEED_ACTIONS];

  const { scope, userId } = visibilityFor(membership, "tasks");

  /* A worker sees farm-wide news plus their own doings — not a running
     commentary on every other worker's tasks and attendance.

     The filter is on WHO ACTED, not on the audit row's target: a task entry
     records the task id, so comparing that against a user id would match
     nothing and quietly empty the feed. Announcements, joins and space
     events are farm news and stay visible to everyone. */
  const personal = ["task", "attendance"];

  return sql`
    select a.action, a.target_type, a.target_id, a.meta, a.created_at,
           u.name as actor_name
      from farm_audit_logs a
      left join users u on u.id = a.actor_user_id
     where a.space_id = ${membership.space_id}
       and a.action = any(${allowed})
       and (
         ${scope}::text = 'all'
         or a.actor_user_id = ${userId}
         or split_part(a.action, '.', 1) <> all(${personal})
       )
     order by a.created_at desc
     limit ${capped}`;
}
