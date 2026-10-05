-- Migration 0029: Farm Space Collaboration State Layer (Read Markers & Presence)

-- 1. Farm Space Memberships: Group chat read cursor & durable presence timestamp
alter table farm_space_memberships
  add column if not exists last_read_chat_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now();

-- 2. Direct Messages: 1:1 conversation read cursors
alter table farm_dm_conversations
  add column if not exists member_a_last_read_at timestamptz not null default now(),
  add column if not exists member_b_last_read_at timestamptz not null default now();

-- 3. Indexes for rapid unread message counting & presence checks
create index if not exists idx_farm_chat_messages_unread
  on farm_chat_messages (space_id, created_at)
  where deleted_at is null;

create index if not exists idx_farm_dm_messages_unread
  on farm_dm_messages (conversation_id, created_at)
  where deleted_at is null;

create index if not exists idx_farm_space_memberships_presence
  on farm_space_memberships (space_id, last_seen_at);
