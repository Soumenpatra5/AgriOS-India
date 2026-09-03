-- Farm Chat — reply, react, edit, pin, and proper delete semantics.
--
-- Reactions and per-viewer hides live in their own tables, since a message
-- can gather many of each; reply/edit/pin are columns on the message itself,
-- since each message has at most one parent, one edit state, one pin state.
--
-- updated_at is new here specifically so polling can catch a MUTATION to an
-- EXISTING message (a reaction, an edit, a pin, a delete) — not only a brand
-- new row. Without it, another member's screen only sees a reaction after
-- they reload the whole chat, which is not the "feels instant" this exists
-- for.

alter table farm_chat_messages add column if not exists parent_message_id uuid references farm_chat_messages(id) on delete set null;
alter table farm_chat_messages add column if not exists edited_at timestamptz;
alter table farm_chat_messages add column if not exists pinned_at timestamptz;
alter table farm_chat_messages add column if not exists pinned_by uuid references users(id);
alter table farm_chat_messages add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_farm_chat_messages_updated on farm_chat_messages;
create trigger trg_farm_chat_messages_updated before update on farm_chat_messages
  for each row execute function set_updated_at();

-- The poll's own query: "what changed in this space since I last looked".
create index if not exists idx_farm_chat_messages_updated on farm_chat_messages (space_id, updated_at desc);
create index if not exists idx_farm_chat_messages_parent on farm_chat_messages (parent_message_id) where parent_message_id is not null;
create index if not exists idx_farm_chat_messages_pinned on farm_chat_messages (space_id, pinned_at desc) where pinned_at is not null;

-- One reaction per member per message — tapping a different emoji replaces
-- the old one rather than stacking several, the interaction pattern most
-- chat apps use.
create table if not exists farm_chat_reactions (
  message_id  uuid not null references farm_chat_messages(id) on delete cascade,
  user_id     uuid not null references users(id),
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists idx_farm_chat_reactions_message on farm_chat_reactions (message_id);

-- "Delete for me": hidden from one viewer only, everyone else's copy is
-- unaffected. A separate table because the message's own deleted_at is
-- global ("delete for everyone") — the two deletions mean different things
-- and must not collide with each other.
create table if not exists farm_chat_message_hides (
  message_id  uuid not null references farm_chat_messages(id) on delete cascade,
  user_id     uuid not null references users(id),
  hidden_at   timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists idx_farm_chat_hides_user on farm_chat_message_hides (user_id, message_id);
