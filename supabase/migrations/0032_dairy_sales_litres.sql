-- Migration 0032: Dairy Sales Litre Support
--
-- Purely additive. Preserves existing kilogram sales with unit = 'kg' while
-- enabling first-class litre sales records with database-level validation,
-- generated amount calculation for litres/kg, and mutual exclusion.

-- 1. Add unit discriminator with 'kg' default
alter table dairy_milk_sales
  add column if not exists unit text not null default 'kg';

-- 2. Add litre-based quantity column
alter table dairy_milk_sales
  add column if not exists quantity_litres numeric(8,2);

-- 3. Drop NOT NULL constraint on quantity_kg to allow litre sales
alter table dairy_milk_sales
  alter column quantity_kg drop not null;

-- 4. Drop table/column check constraints on quantity_kg if present
alter table dairy_milk_sales
  drop constraint if exists dairy_milk_sales_quantity_kg_check;

-- 5. Drop old amount generated column and recreate with unit awareness (kg or L)
alter table dairy_milk_sales
  drop column if exists amount;

alter table dairy_milk_sales
  add column amount numeric(12,2) generated always as (
    case
      when unit = 'L' then (coalesce(quantity_litres, 0) * price_per_litre)
      else (coalesce(quantity_kg, 0) * price_per_litre)
    end
  ) stored;

-- 6. Enforce unit domain integrity
alter table dairy_milk_sales
  drop constraint if exists dairy_milk_sales_unit_ck,
  add constraint dairy_milk_sales_unit_ck
    check (unit in ('kg', 'L'));

-- 7. Mutual exclusion and positive quantity check
alter table dairy_milk_sales
  drop constraint if exists dairy_milk_sales_quantity_ck,
  add constraint dairy_milk_sales_quantity_ck check (
    (unit = 'kg' and quantity_kg is not null and quantity_kg > 0 and (quantity_litres is null or quantity_litres = 0))
    or
    (unit = 'L'  and quantity_litres is not null and quantity_litres > 0 and (quantity_kg is null or quantity_kg = 0))
  );

-- 8. Index for unit-scoped queries
create index if not exists idx_dairy_milk_sales_unit_date
  on dairy_milk_sales (space_id, unit, sale_date desc);
