-- Enable row-level security on all 31 public tables confirmed by live audit
-- (2026-09-16). No policies are added or removed; no grants are changed.
--
-- The postgres role (rolbypassrls=true) is unaffected — all server API reads
-- and writes continue to work unchanged.
--
-- anon and authenticated receive implicit DENY ALL because no permissive
-- policy exists. Supabase Data API access to these tables is closed.
--
-- The 5 tables introduced by migration 0016 (poultry_task_templates,
-- poultry_followup_chains, poultry_batch_tasks, poultry_followup_outcomes,
-- poultry_incidents) are NOT listed here — their RLS is enabled inside 0016.
--
-- ALTER TABLE … ENABLE ROW LEVEL SECURITY is a no-op if RLS is already on,
-- making these statements safe to re-run. A missing table produces an error
-- (intentional — do not wrap in IF EXISTS).

-- Commerce (8)
alter table listings                enable row level security;
alter table listing_media           enable row level security;
alter table orders                  enable row level security;
alter table order_items             enable row level security;
alter table payments                enable row level security;
alter table reviews                 enable row level security;
alter table users                   enable row level security;
alter table webhook_events          enable row level security;

-- Farm Space (4)
alter table farm_spaces             enable row level security;
alter table farm_space_memberships  enable row level security;
alter table farm_space_invitations  enable row level security;
alter table farm_audit_logs         enable row level security;

-- Farm Ops (10)
alter table farm_tasks              enable row level security;
alter table farm_task_events        enable row level security;
alter table farm_attendance         enable row level security;
alter table farm_announcements      enable row level security;
alter table farm_chat_messages      enable row level security;
alter table farm_chat_reactions     enable row level security;
alter table farm_chat_message_hides enable row level security;
alter table farm_dm_conversations   enable row level security;
alter table farm_dm_messages        enable row level security;
alter table farm_dm_message_hides   enable row level security;

-- Auth / Security (1)
alter table otp_challenges          enable row level security;

-- Poultry P1-P4 (7)
alter table poultry_sheds           enable row level security;
alter table poultry_batches         enable row level security;
alter table poultry_daily_records   enable row level security;
alter table poultry_weights         enable row level security;
alter table poultry_feed_logs       enable row level security;
alter table poultry_health_events   enable row level security;
alter table poultry_vaccinations    enable row level security;

-- Infra (1)
alter table schema_migrations       enable row level security;
