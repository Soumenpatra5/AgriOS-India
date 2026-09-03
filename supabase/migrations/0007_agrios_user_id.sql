-- AgriOS India — the permanent, user-facing AgriOS User ID.
--
-- Firebase UID is already the internal identity everything else references
-- (users.id, in turn, is what every Farm Space table joins against) — this
-- does not replace that. It adds a SECOND identifier, meant to be read aloud,
-- typed, and shared, for the one thing Firebase UID was never designed for:
-- a human handing their identity to another human so a Farm Space invitation
-- can find them without depending on a phone number being on file.
--
-- Format: AGRI- followed by 8 characters from the Crockford Base32 alphabet
-- (0-9, A-Z minus I/L/O/U) — the standard fix for "a farmer reading this over
-- the phone should never have to guess whether that was a zero or a letter
-- O". 32^8 (~1.1 trillion) combinations is a database uniqueness constraint
-- doing the real work here, not the randomness alone — a collision on insert
-- is a 23505 the caller retries, not a hope.

alter table users add column if not exists agrios_user_id text;

-- Backfill every row that predates this column — done here, once, in SQL
-- rather than lazily in application code, so the NOT NULL constraint below
-- can be added immediately rather than left as a promise application code
-- keeps. Per-row collision retry is defensive: at this address space it will
-- essentially never loop twice, for any number of existing users.
do $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  r record;
  candidate text;
  i int;
begin
  for r in select id from users where agrios_user_id is null loop
    loop
      candidate := 'AGRI-';
      for i in 1..8 loop
        candidate := candidate || substr(alphabet, (floor(random() * 32) + 1)::int, 1);
      end loop;
      exit when not exists (select 1 from users where agrios_user_id = candidate);
    end loop;
    update users set agrios_user_id = candidate where id = r.id;
  end loop;
end $$;

alter table users alter column agrios_user_id set not null;
alter table users add constraint users_agrios_user_id_unique unique (agrios_user_id);

-- Invitations move from matching a phone/email string at accept-time to
-- referencing the invitee's row directly at invite-creation time. Nullable:
-- invitations created before this migration keep working exactly as they do
-- today (matched by phone/email), they just cannot be re-pointed at a user
-- retroactively — re-sending under the new system is the path forward for
-- any that are still pending.
alter table farm_space_invitations add column if not exists invited_user_id uuid references users(id);
create index if not exists idx_farm_invitations_invited_user
  on farm_space_invitations (invited_user_id, status);
