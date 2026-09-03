-- Farm Chat — 1:1 direct messages between two members of the same Farm
-- Space.
--
-- Kept as an entirely separate structure from farm_chat_messages (the
-- shared group channel) rather than folded into it. The group channel's
-- whole design — every read and write scoped by space_id, seen by every
-- role — is deliberately wrong for a conversation that must be private to
-- two people; retrofitting that distinction onto the existing, already
-- shipped table risked the one chat surface that already works in
-- production. This is the structural piece — private, addressable
-- conversations at all. Reply, react, pin, mentions and search are
-- deliberately NOT here yet; those are the same enhancements the group
-- channel already went through, and can follow it the same way.
--
-- One row per unordered pair of members per space: member_a_id/member_b_id
-- are stored in a canonical order (a < b, enforced below and by INSERTs
-- always using least()/greatest()) so "Amit messages Priya" and "Priya
-- messages Amit" resolve to the same conversation rather than two.

create table if not exists farm_dm_conversations (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references farm_spaces(id) on delete cascade,
  member_a_id  uuid not null references users(id),
  member_b_id  uuid not null references users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint farm_dm_ordered_pair check (member_a_id < member_b_id),
  unique (space_id, member_a_id, member_b_id)
);
drop trigger if exists trg_farm_dm_conversations_updated on farm_dm_conversations;
create trigger trg_farm_dm_conversations_updated before update on farm_dm_conversations
  for each row execute function set_updated_at();

-- "My conversations in this space" is looked up from either side of the pair.
create index if not exists idx_farm_dm_conversations_a on farm_dm_conversations (space_id, member_a_id, updated_at desc);
create index if not exists idx_farm_dm_conversations_b on farm_dm_conversations (space_id, member_b_id, updated_at desc);

create table if not exists farm_dm_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references farm_dm_conversations(id) on delete cascade,
  sender_user_id   uuid not null references users(id),
  body             text,
  attachments      jsonb not null default '[]'::jsonb,
  edited_at        timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint farm_dm_messages_not_empty check (body is not null or jsonb_array_length(attachments) > 0)
);
drop trigger if exists trg_farm_dm_messages_updated on farm_dm_messages;
create trigger trg_farm_dm_messages_updated before update on farm_dm_messages
  for each row execute function set_updated_at();

create index if not exists idx_farm_dm_messages_conversation on farm_dm_messages (conversation_id, created_at desc);
-- The poll's own query: "what changed in this conversation since I last looked".
create index if not exists idx_farm_dm_messages_updated on farm_dm_messages (conversation_id, updated_at desc);

-- "Delete for me" — hidden from one viewer only, mirroring farm_chat_message_hides.
create table if not exists farm_dm_message_hides (
  message_id  uuid not null references farm_dm_messages(id) on delete cascade,
  user_id     uuid not null references users(id),
  hidden_at   timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists idx_farm_dm_hides_user on farm_dm_message_hides (user_id, message_id);
