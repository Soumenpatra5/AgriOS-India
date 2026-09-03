/* Farm Space tasks — phase 3.

   Two rules carry most of the weight here, and both are enforced in SQL rather
   than by the caller:

   1. A worker sees and touches only their own tasks. The role matrix says
      scope "own" for them; this file turns that into a `where assigned_to =`
      clause. It is never a filter the client applies, because a client that
      chooses not to would see the whole farm's work.

   2. Status moves along a defined path, and who may make each move depends on
      the role AND on being the assignee. A worker may complete the task they
      were given; they may not verify it, and they may not complete someone
      else's.

   "Overdue" is derived, never stored: it is a function of due_date and status,
   so a stored flag would need a scheduled job to stay true and would be wrong
   in between. */

import { HttpError } from "../http.js";
import { audit, requireScope, visibilityFor } from "./gate.js";
import { memberCan } from "./permissions.js";

export const TASK_STATUS = [
  "pending", "accepted", "in_progress", "completed", "verified", "rejected", "cancelled",
];
export const PRIORITIES = ["high", "medium", "low"];

/* Who may move a task from one status to another.

   `assignee` means the actor must be the person the task is assigned to.
   `permission` is checked against the member's role on top of that. A manager
   is not blocked from doing a worker's step — a farm where the manager cannot
   close a task the worker forgot would be worse than one where they can — but
   the audit trail records who actually did it. */
const TRANSITIONS = {
  accepted:    { from: ["pending"],                    permission: "farm.tasks.update", assigneeOr: "farm.tasks.assign" },
  in_progress: { from: ["accepted", "rejected"],       permission: "farm.tasks.update", assigneeOr: "farm.tasks.assign" },
  completed:   { from: ["accepted", "in_progress"],    permission: "farm.tasks.update", assigneeOr: "farm.tasks.assign" },
  verified:    { from: ["completed"],                  permission: "farm.tasks.verify" },
  rejected:    { from: ["completed"],                  permission: "farm.tasks.verify" },
  cancelled:   { from: ["pending", "accepted", "in_progress", "rejected"], permission: "farm.tasks.assign" },
};

/* Which moves this member may make on this task, right now.

   Exported so the UI can offer exactly the buttons the server would accept.
   It reads the same TRANSITIONS table the enforcement below uses, so the two
   cannot drift — a screen that offered a move the server refuses would put a
   403 in front of a farmer for pressing a button the app drew for them.

   This is still only what to DRAW. Every move is re-checked on arrival. */
export function allowedTransitions(membership, task) {
  if (!membership || !task) return [];
  const isAssignee = task.assigned_to === membership.user_id;
  return Object.entries(TRANSITIONS)
    .filter(([, rule]) => rule.from.includes(task.status))
    .filter(([, rule]) => (rule.assigneeOr
      ? (isAssignee && memberCan(membership, rule.permission)) || memberCan(membership, rule.assigneeOr)
      : memberCan(membership, rule.permission)))
    .map(([status]) => status);
}
/* ── validation ───────────────────────────────────────────────────────────── */

export function validateTaskInput(input = {}, { partial = false } = {}) {
  const value = {};

  if (!partial || input.title !== undefined) {
    const title = String(input.title ?? "").trim();
    if (!title) return { error: "title is required" };
    if (title.length > 140) return { error: "title must be 140 characters or fewer" };
    value.title = title;
  }
  for (const [key, max] of [["description", 2000], ["unit", 80], ["notes", 2000]]) {
    if (input[key] !== undefined) {
      const v = String(input[key] ?? "").trim();
      if (v.length > max) return { error: `${key} must be ${max} characters or fewer` };
      value[key] = v || null;
    }
  }
  if (input.priority !== undefined) {
    if (!PRIORITIES.includes(input.priority)) return { error: `priority must be one of: ${PRIORITIES.join(", ")}` };
    value.priority = input.priority;
  }
  for (const key of ["start_date", "due_date"]) {
    if (input[key] !== undefined) {
      const v = input[key];
      if (v === null || v === "") { value[key] = null; continue; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return { error: `${key} must be YYYY-MM-DD` };
      value[key] = v;
    }
  }
  if (input.assigned_to !== undefined) value.assigned_to = input.assigned_to || null;

  /* Attachments carry only a description of the file. The bytes stay on the
     device that produced them — Farm Space has no file store, and shipping a
     farmer's photo into a shared table would be a second document system. */
  if (input.attachments !== undefined) {
    const list = Array.isArray(input.attachments) ? input.attachments.slice(0, 8) : [];
    value.attachments = list.map((a) => ({
      name: String(a?.name ?? "").slice(0, 200),
      size: Number(a?.size) || 0,
      type: String(a?.type ?? "").slice(0, 100),
    }));
  }

  if (partial && Object.keys(value).length === 0) return { error: "nothing to update" };
  return { value };
}

/* Derived on read, for exactly the reason given at the top of this file. */
export function withOverdue(task, today = new Date().toISOString().slice(0, 10)) {
  if (!task) return task;
  const open = ["pending", "accepted", "in_progress", "rejected"].includes(task.status);
  const overdue = open && !!task.due_date && String(task.due_date).slice(0, 10) < today;
  return { ...task, overdue };
}

/* The assignee must actually be a member of this space. Without this check an
   owner could assign work to any user id in the system, which would leak the
   task — and the farm's name with it — to someone who never joined. */
async function assertAssigneeIsMember(sql, spaceId, userId) {
  if (!userId) return;
  const [m] = await sql`
    select 1 from farm_space_memberships
     where space_id = ${spaceId} and user_id = ${userId} and status = 'active' limit 1`;
  if (!m) throw new HttpError(400, "That person is not a member of this Farm Space");
}

/* ── reads ────────────────────────────────────────────────────────────────── */

/* The `own` narrowing is applied here, in the query. A worker asking for the
   farm's tasks gets their own and nothing else, whatever they send. */
export async function listTasks(sql, membership, { status = null, limit = 100 } = {}) {
  const { scope, userId } = visibilityFor(membership, "tasks");
  const capped = Math.min(Math.max(Number(limit) || 100, 1), 200);

  /* assignee_phone/assignee_agrios_id ride along so the client has a real
     fallback when assignee_name is null (a provider that never supplied a
     display name) — otherwise a task that IS assigned reads as "Unassigned",
     which is actively misleading, not just unhelpful. */
  const rows = await sql`
    select t.*,
           a.name as assignee_name, a.phone as assignee_phone, a.agrios_user_id as assignee_agrios_id,
           c.name as creator_name
      from farm_tasks t
      left join users a on a.id = t.assigned_to
      left join users c on c.id = t.created_by
     where t.space_id = ${membership.space_id}
       and t.deleted_at is null
       and (${scope}::text = 'all' or t.assigned_to = ${userId})
       and (${status}::text is null or t.status = ${status})
     order by
       case when t.status in ('pending','accepted','in_progress','rejected') then 0 else 1 end,
       t.due_date asc nulls last,
       t.created_at desc
     limit ${capped}`;
  return rows.map((r) => withOverdue(r));
}

export async function getTask(sql, membership, { taskId }) {
  const [row] = await sql`
    select t.*, a.name as assignee_name, a.phone as assignee_phone, a.agrios_user_id as assignee_agrios_id,
           c.name as creator_name
      from farm_tasks t
      left join users a on a.id = t.assigned_to
      left join users c on c.id = t.created_by
     where t.id = ${taskId} and t.deleted_at is null limit 1`;

  /* Step 6: a row fetched by id is only usable if it is in the caller's space. */
  requireScope(row, membership);

  /* And a worker may only open their own, or they could read the whole farm's
     work one id at a time. Same 404 as a foreign task — they must not learn
     the difference. */
  const { scope } = visibilityFor(membership, "tasks");
  if (scope === "own" && row.assigned_to !== membership.user_id) {
    throw new HttpError(404, "Task not found");
  }

  const events = await sql`
    select e.from_status, e.to_status, e.note, e.created_at, u.name as actor_name
      from farm_task_events e
      left join users u on u.id = e.actor_user_id
     where e.task_id = ${taskId}
     order by e.created_at asc`;

  return { ...withOverdue(row), events };
}

/* ── writes ───────────────────────────────────────────────────────────────── */

export async function createTask(sql, membership, actorUserId, input) {
  const { value, error } = validateTaskInput(input);
  if (error) throw new HttpError(400, error);

  if (value.assigned_to) {
    if (!memberCan(membership, "farm.tasks.assign")) {
      throw new HttpError(403, "Not permitted: farm.tasks.assign");
    }
    await assertAssigneeIsMember(sql, membership.space_id, value.assigned_to);
  }

  const [task] = await sql`
    insert into farm_tasks
      (space_id, title, description, unit, assigned_to, created_by, priority,
       start_date, due_date, attachments)
    values (${membership.space_id}, ${value.title}, ${value.description ?? null},
            ${value.unit ?? null}, ${value.assigned_to ?? null}, ${actorUserId},
            ${value.priority ?? "medium"}, ${value.start_date ?? null},
            ${value.due_date ?? null}, ${sql.json(value.attachments ?? [])})
    returning *`;

  await sql`
    insert into farm_task_events (space_id, task_id, actor_user_id, from_status, to_status)
    values (${membership.space_id}, ${task.id}, ${actorUserId}, null, 'pending')`;

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "task.created",
    targetType: "task", targetId: task.id, meta: { title: task.title, assigned: !!task.assigned_to } });

  return withOverdue(task);
}

/* Editing the description of a task, as opposed to moving its status. Kept
   apart because the two have different permissions: a worker may add a note to
   their own task, but must not rewrite what they were asked to do. */
export async function updateTask(sql, membership, actorUserId, { taskId, ...input }) {
  const [existing] = await sql`select * from farm_tasks where id = ${taskId} and deleted_at is null limit 1`;
  requireScope(existing, membership);

  const { value, error } = validateTaskInput(input, { partial: true });
  if (error) throw new HttpError(400, error);

  const { scope } = visibilityFor(membership, "tasks");
  const isAssignee = existing.assigned_to === membership.user_id;
  if (scope === "own" && !isAssignee) throw new HttpError(404, "Task not found");

  /* A worker may only ever add notes or attachments — their record of the work
     — not retitle, re-date, re-prioritise or reassign it. */
  if (!memberCan(membership, "farm.tasks.create")) {
    const allowed = ["notes", "attachments"];
    const touched = Object.keys(value).filter((k) => !allowed.includes(k));
    if (touched.length) throw new HttpError(403, `Not permitted to change: ${touched.join(", ")}`);
  }

  if (value.assigned_to !== undefined && value.assigned_to !== existing.assigned_to) {
    if (!memberCan(membership, "farm.tasks.assign")) throw new HttpError(403, "Not permitted: farm.tasks.assign");
    await assertAssigneeIsMember(sql, membership.space_id, value.assigned_to);
  }

  const [updated] = await sql`
    update farm_tasks set
      title       = coalesce(${value.title ?? null}, title),
      description = coalesce(${value.description ?? null}, description),
      unit        = coalesce(${value.unit ?? null}, unit),
      notes       = coalesce(${value.notes ?? null}, notes),
      priority    = coalesce(${value.priority ?? null}, priority),
      start_date  = coalesce(${value.start_date ?? null}, start_date),
      due_date    = coalesce(${value.due_date ?? null}, due_date),
      assigned_to = ${value.assigned_to !== undefined ? value.assigned_to : existing.assigned_to},
      attachments = coalesce(${value.attachments ? sql.json(value.attachments) : null}, attachments)
    where id = ${taskId}
    returning *`;

  if (value.assigned_to !== undefined && value.assigned_to !== existing.assigned_to) {
    await sql`
      insert into farm_task_events (space_id, task_id, actor_user_id, from_status, to_status, note)
      values (${membership.space_id}, ${taskId}, ${actorUserId}, ${existing.status}, ${existing.status}, 'reassigned')`;
    await audit(sql, { spaceId: membership.space_id, actorUserId, action: "task.reassigned",
      targetType: "task", targetId: taskId, meta: { to: value.assigned_to } });
  }

  return withOverdue(updated);
}

/* The status lifecycle. One function for every move, so the rules live in one
   readable table rather than scattered across an endpoint per verb. */
export async function setTaskStatus(sql, membership, actorUserId, { taskId, status, note = null }) {
  if (!TRANSITIONS[status]) throw new HttpError(400, `Cannot move a task to: ${status}`);

  const [existing] = await sql`select * from farm_tasks where id = ${taskId} and deleted_at is null limit 1`;
  requireScope(existing, membership);

  const rule = TRANSITIONS[status];
  if (!rule.from.includes(existing.status)) {
    throw new HttpError(409, `A ${existing.status} task cannot be marked ${status}`);
  }

  const isAssignee = existing.assigned_to === membership.user_id;
  const { scope } = visibilityFor(membership, "tasks");
  if (scope === "own" && !isAssignee) throw new HttpError(404, "Task not found");

  /* Either you are the assignee doing your own step, or you hold the wider
     permission that covers doing it on someone's behalf. */
  const permitted = rule.assigneeOr
    ? (isAssignee && memberCan(membership, rule.permission)) || memberCan(membership, rule.assigneeOr)
    : memberCan(membership, rule.permission);
  if (!permitted) throw new HttpError(403, `Not permitted: ${rule.permission}`);

  /* Each stamp is set on the move that earns it and otherwise left alone.
     Writing them unconditionally would wipe completed_at the moment a
     supervisor verified the task — losing the record of when the work was
     actually finished, which is the one date a payroll dispute turns on. */
  const [updated] = await sql`
    update farm_tasks set
      status       = ${status},
      notes        = coalesce(${note}, notes),
      completed_at = case when ${status} = 'completed' then now() else completed_at end,
      verified_at  = case when ${status} = 'verified'  then now() else verified_at  end,
      verified_by  = case when ${status} = 'verified'  then ${actorUserId}::uuid else verified_by end
    where id = ${taskId}
    returning *`;

  await sql`
    insert into farm_task_events (space_id, task_id, actor_user_id, from_status, to_status, note)
    values (${membership.space_id}, ${taskId}, ${actorUserId}, ${existing.status}, ${status}, ${note})`;

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: `task.${status}`,
    targetType: "task", targetId: taskId, meta: { from: existing.status } });

  return withOverdue(updated);
}

/* Counts for the hub, honouring the same narrowing as the list — a worker's
   summary describes their own work, not the farm's. */
export async function taskSummary(sql, membership) {
  const { scope, userId } = visibilityFor(membership, "tasks");
  const today = new Date().toISOString().slice(0, 10);

  const [row] = await sql`
    select
      count(*) filter (where status in ('pending','accepted','in_progress','rejected'))::int as open,
      count(*) filter (where status = 'completed')::int as completed,
      count(*) filter (where status = 'verified')::int as verified,
      count(*) filter (where status in ('pending','accepted','in_progress','rejected')
                         and due_date is not null and due_date < ${today})::int as overdue,
      count(*) filter (where due_date = ${today})::int as due_today
    from farm_tasks
    where space_id = ${membership.space_id}
      and deleted_at is null
      and (${scope}::text = 'all' or assigned_to = ${userId})`;
  return row;
}
