/* Farm chat — phase 5, extended with reply, react, edit, pin and proper
   delete semantics.

   One channel per Farm Space. Membership is the whole access rule: every
   read and write goes through the same gate as tasks and attendance, so
   there is no route by which a message reaches someone outside the space
   and no way to address a person who is not in it.

   Unlike tasks and attendance, chat is NOT narrowed by role. A worker reads
   and writes the same channel a manager does — a channel where the workers
   cannot see each other would not be a conversation. That is a deliberate
   difference, not an oversight: farm.chat.view and farm.chat.send are
   granted to every role in the matrix.

   Pinning and moderating someone else's message are the two chat actions
   that ARE role-gated, using farm.members.manage (owner + manager) rather
   than a new permission — the brief is explicit that admins/managers get
   extra chat controls "according to existing Farm Space permissions", and
   this is the existing permission that already means "manage people and
   conduct in this farm". */

import { HttpError } from "../http.js";
import { deleteAttachment } from "../blobStore.js";
import { validateAttachments } from "./chatAttachments.js";
import { audit, requireScope } from "./gate.js";
import { memberCan } from "./permissions.js";

const MAX_BODY = 2000;
const MAX_MENTIONS = 20;

/* A member may delete their OWN message for everyone within this window;
   after it, only removing it for themselves is left. Whoever holds
   farm.members.manage can remove anyone's message at any time — the same
   authority that already governs the roster governs the channel. Editing is
   different: it is always own-message-only, at any role, because rewriting
   someone else's words is a different kind of act than removing them. */
export const OWN_DELETE_WINDOW_MS = 60 * 60 * 1000;

/* A fixed set rather than free-text: validating an arbitrary "emoji" string
   correctly (grapheme clusters, ZWJ sequences, spoofing) is genuinely hard
   to get right, and a small quick-reaction set is itself a WhatsApp-like
   interaction pattern, not a copy of anything proprietary. */
export const REACTION_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉", "👏"];

export function validateMessageInput(input = {}) {
  const body = String(input.body ?? "").trim();

  const { attachments, error: attachmentError } = validateAttachments(input.attachments);
  if (attachmentError) return { error: attachmentError };

  /* Matches the database constraint rather than trusting it: a clear 400 is
     better than a constraint violation surfacing as a 500. */
  if (!body && !attachments.length) return { error: "a message needs text or an attachment" };
  if (body.length > MAX_BODY) return { error: `message must be ${MAX_BODY} characters or fewer` };

  /* Who the client SAYS is mentioned — shape only. sendMessage below is what
     actually verifies each id names a real, currently active member of this
     space before any of them is stored; nothing here is trusted on its own. */
  const mentionsRaw = Array.isArray(input.mentions) ? input.mentions.slice(0, MAX_MENTIONS) : [];
  const mentions = [...new Set(mentionsRaw.map((id) => String(id ?? "").trim()).filter(Boolean))];

  const taskId = input.taskId || null;
  const parentMessageId = input.parentMessageId || null;
  return { value: { body: body || null, attachments, mentions, taskId, parentMessageId } };
}

export async function sendMessage(sql, membership, actorUserId, input) {
  const { value, error } = validateMessageInput(input);
  if (error) throw new HttpError(400, error);

  /* A message may reference a task, but only one in this space — otherwise a
     member could confirm another farm's task ids by trial. Same reasoning
     for the message it is replying to. */
  if (value.taskId) {
    const [task] = await sql`
      select id, space_id from farm_tasks where id = ${value.taskId} and deleted_at is null limit 1`;
    requireScope(task, membership);
  }
  if (value.parentMessageId) {
    const [parent] = await sql`
      select id, space_id from farm_chat_messages where id = ${value.parentMessageId} limit 1`;
    requireScope(parent, membership);
  }

  /* Re-resolved against real membership rather than trusted as sent — a
     client claiming "user X is mentioned" is only honored if X is actually
     an active member of THIS space right now. Anyone else named is silently
     dropped, the same way an over-cap attachment list is silently trimmed
     rather than rejected outright. */
  let mentions = value.mentions;
  if (mentions.length) {
    const rows = await sql`
      select user_id from farm_space_memberships
       where space_id = ${membership.space_id} and status = 'active' and user_id = any(${mentions})`;
    const valid = new Set(rows.map((r) => String(r.user_id)));
    mentions = mentions.filter((id) => valid.has(id));
  }

  const [row] = await sql`
    insert into farm_chat_messages (space_id, sender_user_id, body, attachments, mentions, task_id, parent_message_id)
    values (${membership.space_id}, ${actorUserId}, ${value.body},
            ${sql.json(value.attachments)}, ${sql.json(mentions)}, ${value.taskId}, ${value.parentMessageId})
    returning id`;

  return oneMessage(sql, membership, row.id);
}

/* Own message, and only own message — at any role. Rewriting what someone
   else said is a different act from removing it, and nothing in this
   feature earns that. */
export async function editMessage(sql, membership, actorUserId, { messageId, body }) {
  const [row] = await sql`select * from farm_chat_messages where id = ${messageId} and deleted_at is null limit 1`;
  requireScope(row, membership);

  if (String(row.sender_user_id) !== String(actorUserId)) {
    throw new HttpError(403, "You can only edit your own messages");
  }
  if (Date.now() - new Date(row.created_at).getTime() > OWN_DELETE_WINDOW_MS) {
    throw new HttpError(409, "This message is too old to edit");
  }

  const text = String(body ?? "").trim();
  const hasAttachments = Array.isArray(row.attachments) && row.attachments.length > 0;
  if (!text && !hasAttachments) throw new HttpError(400, "a message needs text or an attachment");
  if (text.length > MAX_BODY) throw new HttpError(400, `message must be ${MAX_BODY} characters or fewer`);

  await sql`update farm_chat_messages set body = ${text || null}, edited_at = now() where id = ${messageId}`;
  return oneMessage(sql, membership, messageId);
}

/* "Delete for everyone" — the original removeMessage, now with a time rule
   for the own-message path. Soft delete: the row stays so the conversation
   does not silently renumber and other members' screens can be told a
   message was removed rather than have it just vanish. */
export async function removeMessage(sql, membership, actorUserId, { messageId }) {
  const [row] = await sql`
    select * from farm_chat_messages where id = ${messageId} and deleted_at is null limit 1`;
  requireScope(row, membership);

  const own = String(row.sender_user_id) === String(actorUserId);
  const moderator = memberCan(membership, "farm.members.manage");
  if (!own && !moderator) {
    throw new HttpError(403, "You can only remove your own messages");
  }
  if (own && !moderator && Date.now() - new Date(row.created_at).getTime() > OWN_DELETE_WINDOW_MS) {
    throw new HttpError(409, "This message is too old to remove for everyone — you can still delete it for yourself");
  }

  await sql`update farm_chat_messages set deleted_at = now() where id = ${messageId}`;
  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "chat.removed",
    targetType: "message", targetId: messageId });

  /* Delete-for-everyone frees the actual file too, not just the row — a
     location attachment has no url and is skipped. Best-effort and after
     the fact: a farmer who was told the message was removed must see that
     succeed even if the blob delete itself fails (deleteAttachment already
     swallows its own errors; see blobStore.js). */
  const attachments = Array.isArray(row.attachments) ? row.attachments : [];
  await Promise.all(attachments.filter((a) => a?.url).map((a) => deleteAttachment(a.url)));

  return { removed: true };
}

/* "Delete for me" — hidden from this viewer only, nobody else's copy is
   touched. Idempotent: hiding an already-hidden message is not an error. */
export async function hideMessageForSelf(sql, membership, actorUserId, { messageId }) {
  const [row] = await sql`select id, space_id from farm_chat_messages where id = ${messageId} limit 1`;
  requireScope(row, membership);

  await sql`
    insert into farm_chat_message_hides (message_id, user_id)
    values (${messageId}, ${actorUserId})
    on conflict (message_id, user_id) do nothing`;
  return { hidden: true };
}

/* Reacting replaces any reaction this member already left on the message —
   tapping a different emoji changes your reaction, it does not add a second
   one. The parent message's updated_at is bumped in the same transaction so
   the poll below picks the change up for every other member, not just a
   page reload. */
export async function reactToMessage(sql, membership, actorUserId, { messageId, emoji }) {
  if (!REACTION_EMOJI.includes(emoji)) throw new HttpError(400, "Not a supported reaction");

  const [row] = await sql`select id, space_id from farm_chat_messages where id = ${messageId} and deleted_at is null limit 1`;
  requireScope(row, membership);

  await sql.begin(async (tx) => {
    await tx`
      insert into farm_chat_reactions (message_id, user_id, emoji)
      values (${messageId}, ${actorUserId}, ${emoji})
      on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now()`;
    await tx`update farm_chat_messages set updated_at = now() where id = ${messageId}`;
  });
  return oneMessage(sql, membership, messageId);
}

export async function removeReaction(sql, membership, actorUserId, { messageId }) {
  const [row] = await sql`select id, space_id from farm_chat_messages where id = ${messageId} and deleted_at is null limit 1`;
  requireScope(row, membership);

  await sql.begin(async (tx) => {
    await tx`delete from farm_chat_reactions where message_id = ${messageId} and user_id = ${actorUserId}`;
    await tx`update farm_chat_messages set updated_at = now() where id = ${messageId}`;
  });
  return oneMessage(sql, membership, messageId);
}

export async function pinMessage(sql, membership, actorUserId, { messageId }) {
  const [row] = await sql`select id, space_id from farm_chat_messages where id = ${messageId} and deleted_at is null limit 1`;
  requireScope(row, membership);

  await sql`update farm_chat_messages set pinned_at = now(), pinned_by = ${actorUserId} where id = ${messageId}`;
  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "chat.pinned",
    targetType: "message", targetId: messageId });
  return oneMessage(sql, membership, messageId);
}

export async function unpinMessage(sql, membership, actorUserId, { messageId }) {
  const [row] = await sql`select id, space_id from farm_chat_messages where id = ${messageId} limit 1`;
  requireScope(row, membership);

  await sql`update farm_chat_messages set pinned_at = null, pinned_by = null where id = ${messageId}`;
  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "chat.unpinned",
    targetType: "message", targetId: messageId });
  return { unpinned: true };
}

export async function listPinnedMessages(sql, membership) {
  const rows = await withReactionsAndReplies(sql, sql`
    select m.*, u.name as sender_name, u.phone as sender_phone, u.agrios_user_id as sender_agrios_id,
           pu.name as pinned_by_name
      from farm_chat_messages m
      left join users u on u.id = m.sender_user_id
      left join users pu on pu.id = m.pinned_by
     where m.space_id = ${membership.space_id}
       and m.pinned_at is not null
       and m.deleted_at is null
     order by m.pinned_at desc`);
  return rows;
}

/* One message, fully hydrated the same way the list is — the shape every
   mutation above returns, so the client can patch its local copy from the
   same response instead of refetching the list.

   Tombstoned defensively, the same way listMessages shapes its rows, even
   though every caller today already excludes a deleted row before getting
   here — a future caller that forgets to must not be able to hand a
   deleted message's real body back to the client as a side effect of an
   unrelated action. */
async function oneMessage(sql, membership, messageId) {
  const rows = await withReactionsAndReplies(sql, sql`
    select m.*, u.name as sender_name, u.phone as sender_phone, u.agrios_user_id as sender_agrios_id,
           (m.deleted_at is not null) as deleted
      from farm_chat_messages m
      left join users u on u.id = m.sender_user_id
     where m.id = ${messageId} and m.space_id = ${membership.space_id}`);
  const row = rows[0];
  if (!row) return row;
  return row.deleted ? { ...row, body: null, attachments: [], mentions: [], reactions: [], reply_to: null } : row;
}

/* A sender's name, or the best fallback available — phone, then their
   permanent AgriOS User ID — never blank. A provider that never supplied a
   display name (a Google account with none set) is not a rare case, and a
   blank sender line is exactly as confusing as the client's own "Member"
   fallback this mirrors (farmSpaceService.displayName). */
function bestName(row) {
  return row.sender_name || row.sender_phone || row.sender_agrios_id || null;
}

/* Attaches reactions (who reacted, with what) and a lightweight preview of
   the message being replied to, without pulling in a real join for either —
   at farm-chat scale (a handful of members, pages of tens of messages) two
   extra round trips per page is simpler and plenty fast, and keeps the main
   query above readable. */
async function withReactionsAndReplies(sql, rowsPromise) {
  const rows = await rowsPromise;
  if (!rows.length) return rows;

  const ids = rows.map((r) => r.id);
  const parentIds = [...new Set(rows.map((r) => r.parent_message_id).filter(Boolean))];

  /* = ANY($1) with a plain array, not the tagged-template IN helper — the
     latter is a postgres.js-specific marker that plain tagged-template
     mocks (used in tests) do not understand, while a single array parameter
     binds the same way everywhere. */
  const [reactions, parents] = await Promise.all([
    sql`select r.message_id, r.user_id, u.name, r.emoji
          from farm_chat_reactions r join users u on u.id = r.user_id
         where r.message_id = any(${ids})
         order by r.created_at`,
    parentIds.length
      ? sql`select m.id, m.body, m.deleted_at,
                   u.name as sender_name, u.phone as sender_phone, u.agrios_user_id as sender_agrios_id
              from farm_chat_messages m left join users u on u.id = m.sender_user_id
             where m.id = any(${parentIds})`
      : [],
  ]);

  const byMessage = new Map();
  for (const r of reactions) {
    if (!byMessage.has(r.message_id)) byMessage.set(r.message_id, []);
    byMessage.get(r.message_id).push({ user_id: r.user_id, name: r.name, emoji: r.emoji });
  }
  const parentById = new Map(parents.map((p) => [p.id, p]));

  return rows.map((m) => {
    const parent = m.parent_message_id ? parentById.get(m.parent_message_id) : null;
    return {
      ...m,
      reactions: byMessage.get(m.id) || [],
      /* reply_to is a nested, already-resolved shape (unlike the top-level
         message, which hands sender_name/phone/agrios_id to the client
         separately) — resolved here so the client does not need a second
         fallback chain just for a reply preview. */
      reply_to: parent
        ? { id: parent.id, sender_name: bestName(parent), body: parent.deleted_at ? null : parent.body, deleted: !!parent.deleted_at }
        : null,
    };
  });
}

/* Newest first, paged by `before` rather than an offset: an offset shifts
   under you as people keep talking, which is how a chat history ends up
   repeating or skipping messages while you scroll.

   `since` now filters on updated_at, not created_at — a poll must surface a
   MUTATION to an existing message (a reaction, an edit, a pin, a delete),
   not only a brand new row, or another member only sees it after reloading
   the whole chat. The client merges results by id rather than assuming
   everything returned is new. */
export async function listMessages(sql, membership, { limit = 50, before = null, since = null } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const rows = await withReactionsAndReplies(sql, sql`
    select m.id, m.body, m.attachments, m.mentions, m.task_id, m.created_at, m.updated_at,
           m.sender_user_id, u.name as sender_name, u.phone as sender_phone, u.agrios_user_id as sender_agrios_id,
           m.parent_message_id, m.edited_at, m.pinned_at, m.pinned_by,
           t.title as task_title,
           (m.deleted_at is not null) as deleted
      from farm_chat_messages m
      left join users u on u.id = m.sender_user_id
      left join farm_tasks t on t.id = m.task_id
     where m.space_id = ${membership.space_id}
       and not exists (
         select 1 from farm_chat_message_hides h
          where h.message_id = m.id and h.user_id = ${membership.user_id}
       )
       and (${before}::timestamptz is null or m.created_at < ${before}::timestamptz)
       and (${since}::timestamptz  is null or m.updated_at > ${since}::timestamptz)
     order by m.created_at desc
     limit ${capped}`);

  /* A tombstone, not a blank row: the client needs to know a message was
     here and removed, distinct from one that was never sent. */
  const shaped = rows.map((m) => (m.deleted
    ? { ...m, body: null, attachments: [], mentions: [], reactions: [], reply_to: null }
    : m));

  /* Returned oldest-first, which is the order a conversation is read in. The
     query stays newest-first so the limit takes the most recent messages. */
  return shaped.reverse();
}

/* Escapes ILIKE's own wildcard characters in a search term typed by a
   farmer, not by a developer — "50%" must search for the literal text "50%",
   not "50" followed by anything. The backslash itself is escaped first so a
   term that already contains one is not turned into a different escape. */
function escapeLike(s) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/* A plain substring search over the body, newest match first — no separate
   index, the same "simple and plenty fast at this scale" call the rest of
   this file already makes (see withReactionsAndReplies). Deleted messages
   and ones hidden from this viewer are excluded the same way listMessages
   excludes them; a search that surfaced a tombstone's old body back would
   defeat delete-for-everyone. */
export async function searchMessages(sql, membership, { query = "", limit = 30 } = {}) {
  const q = String(query ?? "").trim();
  if (!q) return [];
  const capped = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const pattern = `%${escapeLike(q)}%`;

  return withReactionsAndReplies(sql, sql`
    select m.id, m.body, m.attachments, m.mentions, m.task_id, m.created_at, m.updated_at,
           m.sender_user_id, u.name as sender_name, u.phone as sender_phone, u.agrios_user_id as sender_agrios_id,
           m.parent_message_id, m.edited_at, m.pinned_at, m.pinned_by,
           t.title as task_title
      from farm_chat_messages m
      left join users u on u.id = m.sender_user_id
      left join farm_tasks t on t.id = m.task_id
     where m.space_id = ${membership.space_id}
       and m.deleted_at is null
       and m.body ilike ${pattern} escape '\\'
       and not exists (
         select 1 from farm_chat_message_hides h
          where h.message_id = m.id and h.user_id = ${membership.user_id}
       )
     order by m.created_at desc
     limit ${capped}`);
}

/* How many messages have arrived since the caller last looked. Cheap enough to
   poll: one indexed count, no rows returned. Unaffected by reactions/edits to
   older messages — those are not what "unread" means. */
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
