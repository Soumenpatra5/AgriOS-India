-- Enable row-level security on remaining public tables introduced in
-- migrations 0024 (Beekeeping), 0025 (Crop Foundation), and 0026 (Notifications).
--
-- No policies are added or removed; no grants are changed.
--
-- The postgres role (rolbypassrls=true) is unaffected — all server API reads
-- and writes continue to work unchanged.
--
-- anon and authenticated receive implicit DENY ALL because no permissive
-- policy exists. Supabase Data API access to these tables is closed.
--
-- ALTER TABLE … ENABLE ROW LEVEL SECURITY is a no-op if RLS is already on,
-- making these statements safe to re-run. A missing table produces an error
-- (intentional — do not wrap in IF EXISTS).

-- Beekeeping / Apiculture (7)
alter table bee_apiaries       enable row level security;
alter table bee_hives          enable row level security;
alter table bee_inspections    enable row level security;
alter table bee_harvests       enable row level security;
alter table bee_treatments     enable row level security;
alter table bee_sales          enable row level security;
alter table bee_costs          enable row level security;

-- Crop / Field (6)
alter table farm_fields        enable row level security;
alter table field_sowing       enable row level security;
alter table field_activities   enable row level security;
alter table field_harvests     enable row level security;
alter table field_costs        enable row level security;
alter table field_sales        enable row level security;

-- Notifications (1)
alter table farm_notifications enable row level security;
