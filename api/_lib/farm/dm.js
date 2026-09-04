/* Farm Space — 1:1 direct messages.

   A second, separate surface from the group channel (chat.js): a
   conversation here is private to exactly two members of the same Farm
   Space, addressed by conversation id, never by space id alone. Every
   function below checks BOTH that the conversation belongs to the caller's
   authorized space (the same requireScope discipline every other Farm Space
   object uses) AND that the caller is one of its two participants —
   membership in the space is necessary but not sufficient here, unlike the
   group channel where it is the whole rule.

   Deliberately smaller than the group channel: no reply, react, pin,
   mention or search yet. Those are the same enhancements chat.js already
   went through one at a time; this is the structural piece underneath —
   private, addressable conversations existing at all. */

import { HttpError } from "../http.js";
import { deleteAttachment } from "../blobStore.js";
import { validateAttachments } from "./chatAttachments.js";

const MAX_BODY = 2000;

/* Mirrors chat.js's OWN_DELETE_WINDOW_MS — the same "recent own message can
   be unsent, an old one only hidden for yourself" rule, for the same reason. */
export const DM_OWN_DELETE_WINDOW_MS = 60 * 60 * 1000;

const notFound = () => new HttpError(404, "Conversation not found");

/* Loads a conversation and proves the caller is actually in it — the space
   scope check (row belongs to membership.space_id) plus a participant check
   neither the group channel nor requireScope() needs, because a Farm Space
   membership alone does not entitle you to read someone ELSE's private
   conversation with a third member. */
async function loadConversation(sql, membership, actorUserId, conversationId) {
  const [row] = await sql`
    select * from farm_dm_conversations where id = ${conversationId} and space_id = ${membership.space_id} limit 1`;
  if (!row) throw notFound();
  if (String(row.member_a_id) !== String(actorUserId) && String(row.member_b_id) !== String(actorUserId)) {
    throw notFound();
  }
  return row;
}

/* One query for one or many conversations: the other member joined by
   whichever side of the pair the caller is NOT, and the latest message via
   LATERAL — which the (conversation_id, created_at desc) index serves as a
   single backward index probe per conversation. This used to be 3 sequential
   queries per conversation (re-select, other-user select, last-message
   select), which made the inbox 1+3N round trips — ~31 for ten colleagues,
   on a polled surface. */
async function conversationRows(sql, membership, actorUserId, { conversationId = null } = {}) {
  const rows = await sql`
    select c.id, c.space_id, c.member_a_id, c.member_b_id, c.created_at, c.updated_at,
           ou.name as other_name, ou.phone as other_phone, ou.agrios_user_id as other_agrios_id,
           lm.body as last_body, lm.attachments as last_attachments, lm.created_at as last_created_at,
           lm.sender_user_id as last_sender_user_id, (lm.deleted_at is not null) as last_deleted,
           (lm.conversation_id is not null) as has_last
      from farm_dm_conversations c
      join users ou on ou.id = (case when c.member_a_id = ${actorUserId} then c.member_b_id else c.member_a_id end)
      left join lateral (
        select conversation_id, body, attachments, created_at, sender_user_id, deleted_at
          from farm_dm_messages
         where conversation_id = c.id
         order by created_at desc
         limit 1
      ) lm on true
     where c.space_id = ${membership.space_id}
       and (c.member_a_id = ${actorUserId} or c.member_b_id = ${actorUserId})
       and (${conversationId}::uuid is null or c.id = ${conversationId}::uuid)
     order by c.updated_at desc`;

  return rows.map((row) => ({
    id: row.id,
    space_id: row.space_id,
    other_user_id: String(row.member_a_id) === String(actorUserId) ? row.member_b_id : row.member_a_id,
    other_name: row.other_name || null,
    other_phone: row.other_phone || null,
    other_agrios_id: row.other_agrios_id || null,
    other_display_name: row.other_name || row.other_phone || row.other_agrios_id || null,
    updated_at: row.updated_at,
    created_at: row.created_at,
    last_message: row.has_last ? {
      body: row.last_deleted ? null : row.last_body,
      attachments: row.last_deleted ? [] : row.last_attachments,
      created_at: row.last_created_at,
      mine: String(row.last_sender_user_id) === String(actorUserId),
      deleted: row.last_deleted,
    } : null,
  }));
}

async function oneConversation(sql, membership, actorUserId, conversationId) {
  const rows = await conversationRows(sql, membership, actorUserId, { conversationId });
  return rows[0] || null;
}

/* Opens the (single, canonical) conversation with another active member of
   this space, creating it on first contact. `least`/`greatest` — not JS-side
   comparison — decide the stored order, so "Amit messages Priya" and "Priya
   messages Amit" always resolve to the same row regardless of who acts
   first; the unique index is what actually prevents a duplicate under a
   race, this just makes the common case a single round trip. */
export async function openConversation(sql, membership, actorUserId, { otherUserId } = {}) {
  const other = String(otherUserId ?? "").trim();
  if (!other) throw new HttpError(400, "Choose who to message");
  if (other === String(actorUserId)) throw new HttpError(400, "You can't message yourself");

  const [otherMember] = await sql`
    select user_id from farm_space_memberships
     where space_id = ${membership.space_id} and status = 'active' and user_id = ${other} limit 1`;
  if (!otherMember) throw notFound();

  const [row] = await sql`
    insert into farm_dm_conversations (space_id, member_a_id, member_b_id)
    values (${membership.space_id}, least(${actorUserId}::uuid, ${other}::uuid), greatest(${actorUserId}::uuid, ${other}::uuid))
    on conflict (space_id, member_a_id, member_b_id) do update set space_id = excluded.space_id
    returning id`;

  return oneConversation(sql, membership, actorUserId, row.id);
}

/* Inbox: every conversation this member is part of in this space, most
   recently active first — one round trip total, however many conversations
   there are (see conversationRows above for what this replaced). */
export async function listConversations(sql, membership, actorUserId) {
  return conversationRows(sql, membership, actorUserId);
}

async function oneDmMessage(sql, conversationId, messageId) {
  const [row] = await sql`
    select id, conversation_id, sender_user_id, body, attachments, edited_at, created_at, updated_at,
           (deleted_at is not null) as deleted
      from farm_dm_messages where id = ${messageId} and conversation_id = ${conversationId}`;
  if (!row) return row;
  return row.deleted ? { ...row, body: null, attachments: [] } : row;
}

export async function sendDm(sql, membership, actorUserId, input = {}) {
  const conversation = await loadConversation(sql, membership, actorUserId, input.conversationId);

  const body = String(input.body ?? "").trim();
  const { attachments, error } = validateAttachments(input.attachments);
  if (error) throw new HttpError(400, error);
  if (!body && !attachments.length) throw new HttpError(400, "a message needs text or an attachment");
  if (body.length > MAX_BODY) throw new HttpError(400, `message must be ${MAX_BODY} characters or fewer`);

  /* One atomic statement: the insert and the inbox bump (which floats the
     conversation to the top of both participants' inboxes) succeed or fail
     together — previously two separate auto-commit trips with a small
     window where the message existed but the inbox hadn't moved. */
  const [row] = await sql`
    with msg as (
      insert into farm_dm_messages (conversation_id, sender_user_id, body, attachments)
      values (${conversation.id}, ${actorUserId}, ${body || null}, ${sql.json(attachments)})
      returning id
    ), bump as (
      update farm_dm_conversations set updated_at = now() where id = ${conversation.id}
    )
    select id from msg`;

  return oneDmMessage(sql, conversation.id, row.id);
}

export async function editDm(sql, membership, actorUserId, { conversationId, messageId, body } = {}) {
  const conversation = await loadConversation(sql, membership, actorUserId, conversationId);
  const [row] = await sql`
    select * from farm_dm_messages where id = ${messageId} and conversation_id = ${conversation.id} and deleted_at is null limit 1`;
  if (!row) throw notFound();
  if (String(row.sender_user_id) !== String(actorUserId)) throw new HttpError(403, "You can only edit your own messages");
  if (Date.now() - new Date(row.created_at).getTime() > DM_OWN_DELETE_WINDOW_MS) {
    throw new HttpError(409, "This message is too old to edit");
  }

  const text = String(body ?? "").trim();
  const hasAttachments = Array.isArray(row.attachments) && row.attachments.length > 0;
  if (!text && !hasAttachments) throw new HttpError(400, "a message needs text or an attachment");
  if (text.length > MAX_BODY) throw new HttpError(400, `message must be ${MAX_BODY} characters or fewer`);

  await sql`update farm_dm_messages set body = ${text || null}, edited_at = now() where id = ${messageId}`;
  return oneDmMessage(sql, conversation.id, messageId);
}

/* "Delete for everyone" — own message within the window, at any time either
   participant can hide their own send for themselves (hideDmForSelf below).
   Unlike the group channel there is no moderator override: a DM has no
   manager role over it, only its two participants. */
export async function removeDm(sql, membership, actorUserId, { conversationId, messageId } = {}) {
  const conversation = await loadConversation(sql, membership, actorUserId, conversationId);
  const [row] = await sql`
    select * from farm_dm_messages where id = ${messageId} and conversation_id = ${conversation.id} and deleted_at is null limit 1`;
  if (!row) throw notFound();
  if (String(row.sender_user_id) !== String(actorUserId)) {
    throw new HttpError(403, "You can only remove your own messages");
  }
  if (Date.now() - new Date(row.created_at).getTime() > DM_OWN_DELETE_WINDOW_MS) {
    throw new HttpError(409, "This message is too old to remove for everyone — you can still delete it for yourself");
  }

  await sql`update farm_dm_messages set deleted_at = now() where id = ${messageId}`;

  const attachments = Array.isArray(row.attachments) ? row.attachments : [];
  await Promise.all(attachments.filter((a) => a?.url).map((a) => deleteAttachment(a.url)));

  return { removed: true };
}

export async function hideDmForSelf(sql, membership, actorUserId, { conversationId, messageId } = {}) {
  const conversation = await loadConversation(sql, membership, actorUserId, conversationId);
  const [row] = await sql`select id from farm_dm_messages where id = ${messageId} and conversation_id = ${conversation.id} limit 1`;
  if (!row) throw notFound();

  await sql`
    insert into farm_dm_message_hides (message_id, user_id)
    values (${messageId}, ${actorUserId})
    on conflict (message_id, user_id) do nothing`;
  return { hidden: true };
}

/* Newest first, paged by `before`; `since` filters on updated_at so a poll
   catches an edit or a delete to an existing message, not only a new row —
   the same reasoning as chat.js's listMessages. */
export async function listDmMessages(sql, membership, actorUserId, { conversationId, limit = 50, before = null, since = null } = {}) {
  const conversation = await loadConversation(sql, membership, actorUserId, conversationId);
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const rows = await sql`
    select m.id, m.conversation_id, m.body, m.attachments, m.sender_user_id, m.edited_at,
           m.created_at, m.updated_at, (m.deleted_at is not null) as deleted
      from farm_dm_messages m
     where m.conversation_id = ${conversation.id}
       and not exists (
         select 1 from farm_dm_message_hides h where h.message_id = m.id and h.user_id = ${actorUserId}
       )
       and (${before}::timestamptz is null or m.created_at < ${before}::timestamptz)
       and (${since}::timestamptz  is null or m.updated_at > ${since}::timestamptz)
     order by m.created_at desc
     limit ${capped}`;

  const shaped = rows.map((m) => (m.deleted ? { ...m, body: null, attachments: [] } : m));
  return shaped.reverse();
}
