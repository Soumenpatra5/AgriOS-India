-- Farm Chat — mentions and search.
--
-- Mentions are stored as an explicit list of user ids, resolved and verified
-- server-side at send time (see chat.js) — never parsed back out of the
-- @Name text at read time, so a later name change, or plain body text that
-- happens to look like a mention, can never mis-tag or silently drop one.
--
-- Search stays a simple ILIKE over the body: at farm-chat scale (a handful
-- of members, pages of tens of messages) a full-text index is machinery
-- this app does not need yet — the same reasoning chat.js already applies
-- to reactions/replies (see withReactionsAndReplies there).

alter table farm_chat_messages add column if not exists mentions jsonb not null default '[]'::jsonb;

-- Supports "was this member mentioned" via the jsonb `?` containment
-- operator, which the default (jsonb_ops) GIN index below supports.
create index if not exists idx_farm_chat_messages_mentions on farm_chat_messages using gin (mentions);
