-- Migration 0033: Goat Milk Unit Safety (Kilograms and Litres)
--
-- Purely additive. Preserves existing kilogram rows with unit = 'kg' while
-- enabling first-class litre records with database-level validation, generated totals,
-- and mutual exclusion.

-- 1. Add unit discriminator with 'kg' default
alter table goat_milk_records
  add column if not exists unit text not null default 'kg';

-- 2. Add litre-based yield columns
alter table goat_milk_records
  add column if not exists am_yield_litres numeric(6,2),
  add column if not exists pm_yield_litres numeric(6,2);

-- 3. Add generated total litre column (deterministic sum of sessions)
alter table goat_milk_records
  add column if not exists total_yield_litres numeric(7,2)
    generated always as (coalesce(am_yield_litres, 0) + coalesce(pm_yield_litres, 0)) stored;

-- 4. Column-level non-negative constraints
alter table goat_milk_records
  drop constraint if exists goat_milk_records_am_litres_ck,
  add constraint goat_milk_records_am_litres_ck
    check (am_yield_litres is null or (am_yield_litres >= 0 and am_yield_litres <= 9999.99)),
  drop constraint if exists goat_milk_records_pm_litres_ck,
  add constraint goat_milk_records_pm_litres_ck
    check (pm_yield_litres is null or (pm_yield_litres >= 0 and pm_yield_litres <= 9999.99));

-- 5. Enforce unit domain integrity
alter table goat_milk_records
  drop constraint if exists goat_milk_records_unit_domain_ck,
  add constraint goat_milk_records_unit_domain_ck
    check (unit in ('kg', 'L'));

-- 6. Enforce mutual exclusion between kilogram and litre measurements
alter table goat_milk_records
  drop constraint if exists goat_milk_records_unit_values_ck,
  add constraint goat_milk_records_unit_values_ck check (
    (unit = 'kg' and (am_yield_litres is null or am_yield_litres = 0)
                 and (pm_yield_litres is null or pm_yield_litres = 0))
    or
    (unit = 'L'  and am_yield_kg = 0
                 and pm_yield_kg = 0
                 and (am_yield_litres is not null or pm_yield_litres is not null))
  );

-- 7. Performance index for unit-scoped aggregations
create index if not exists idx_goat_milk_records_unit_date
  on goat_milk_records (space_id, unit, record_date desc);
