/* Farm chat — phase 5.

   One channel per Farm Space. Membership is the whole access rule: every read
   and write goes through the same gate as tasks and attendance, so there is no
   route by which a message reaches someone outside the space and no way to
   address a person who is not in it.

   Unlike tasks and attendance, chat is NOT narrowed by role. A worker reads
   and writes the same channel a manager does — a channel where the workers
   cannot see each other would not be a conversation. That is a deliberate
   difference, not an oversight: farm.chat.view and farm.chat.send are granted
   to every role in the matrix. */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";
import { memberCan } from "./permissions.js";

const MAX_BODY = 2000;
const MAX_ATTACHMENTS = 4;

export function validateMessageInput(input = {}) {
  const body = String(input.body ?? "").trim();

  const list = Array.isArray(input.attachments) ? input.attachments.slice(0, MAX_ATTACHMENTS) : [];
  const attachments = list.map((a) => ({
    name: String(a?.name ?? "").slice(0, 200),
    size: Number(a?.size) || 0,
    type: String(a?.type ?? "").slice(0, 100),
  }));

  /* Matches the database constraint rather than trusting it: a clear 400 is
     better than a constraint violation surfacing as a 500. */
  if (!body && !attachments.length) return { error: "a message needs text or an attachment" };
  if (body.length > MAX_BODY) return { error: `message must be ${MAX_BODY} characters or fewer` };

  const taskId = input.taskId || null;
  return { value: { body: body || null, attachments, taskId } };
}

export async function sendMessage(sql, membership, actorUserId, input) {
  const { value, error } = validateMessageInput(input);
  if (error) throw new HttpError(400, error);

  /* A message may reference a task, but only one in this space — otherwise a
     member could confirm another farm's task ids by trial. */
  if (value.taskId) {
    const [task] = await sql`
      select id, space_id from farm_tasks where id = ${value.taskId} and deleted_at is null limit 1`;
    requireScope(task, membership);
  }

  const [row] = await sql`
    insert into farm_chat_messages (space_id, sender_user_id, body, attachments, task_id)
    values (${membership.space_id}, ${actorUserId}, ${value.body},
            ${sql.json(value.attachments)}, ${value.taskId})
    returning *`;

  const [withName] = await sql`
    select m.*, u.name as sender_name
      from farm_chat_messages m left join users u on u.id = m.sender_user_id
     where m.id = ${row.id}`;
  return withName;
}

/* Newest first, paged by `before` rather than an offset: an offset shifts
   under you as people keep talking, which is how a chat history ends up
   repeating or skipping messages while you scroll. */
export async function listMessages(sql, membership, { limit = 50, before = null, since = null } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const rows = await sql`
    select m.id, m.body, m.attachments, m.task_id, m.created_at,
           m.sender_user_id, u.name as sender_name,
           t.title as task_title
      from farm_chat_messages m
      left join users u on u.id = m.sender_user_id
      left join farm_tasks t on t.id = m.task_id
     where m.space_id = ${membership.space_id}
       and m.deleted_at is null
       and (${before}::timestamptz is null or m.created_at < ${before}::timestamptz)
       and (${since}::timestamptz  is null or m.created_at > ${since}::timestamptz)
     order by m.created_at desc
     limit ${capped}`;

  /* Returned oldest-first, which is the order a conversation is read in. The
     query stays newest-first so the limit takes the most recent messages. */
  return rows.reverse();
}

/* Your own message, or you manage the farm. Soft delete: the row stays so the
   conversation does not silently renumber, and an audit entry records it. */
export async function removeMessage(sql, membership, actorUserId, { messageId }) {
  const [row] = await sql`
    select * from farm_chat_messages where id = ${messageId} and deleted_at is null limit 1`;
  requireScope(row, membership);

  const own = String(row.sender_user_id) === String(actorUserId);
  if (!own && !memberCan(membership, "farm.settings.manage")) {
    throw new HttpError(403, "You can only remove your own messages");
  }

  await sql`update farm_chat_messages set deleted_at = now() where id = ${messageId}`;
  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "chat.removed",
    targetType: "message", targetId: messageId });
  return { removed: true };
}

/* How many messages have arrived since the caller last looked. Cheap enough to
   poll: one indexed count, no rows returned. */
export async function unreadCount(sql, membership, { since = null } = {}) {
  if (!since) return { unread: 0 };
  const [row] = await sql`
    select count(*)::int as unread
      from farm_chat_messages
     where space_id = ${membership.space_id}
       and deleted_at is null
       and sender_user_id <> ${membership.user_id}
       and created_at > ${since}::timestamptz`;
  return row;
}
