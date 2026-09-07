/* Poultry P2 — daily records, weighings, the feed ledger, and the metrics
   derived from them.

   Split from poultry.js (sheds/batches) to keep both readable; the routing
   table in farm.js is the index of what exists. Everything here is reached
   through the same six-step gate, so a handler cannot ship without
   authorization, and every row carries space_id taken from the membership.

   THE TWO RACES THIS FILE EXISTS TO PREVENT

   1. Mortality. Two workers report deaths at the same moment on a batch with
      few birds left. Checked outside a transaction, both reads see the same
      "birds available" and both writes succeed, burying more birds than the
      shed contains. Every write that consumes birds therefore takes
      `select ... from poultry_batches ... for update` INSIDE sql.begin, so the
      second request waits for the first to commit and re-reads the truth.
   2. Feed stock. Same shape: two consumption entries against the last of the
      feed. Same remedy, same lock — the batch row is the serialization point
      for both, so a mortality write and a feed write on one batch also queue
      behind each other, which is cheap and keeps the reasoning simple.

   An application-level pre-check before the transaction is deliberately absent:
   it would be a lie that passes tests on a single connection and fails in a
   real shed with two phones. */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";
import { memberCan } from "./permissions.js";
import { computePoultryFCR } from "./fcr.js";

/* Correcting a settled cycle is a manager's call, checked here rather than in
   the routing table because the routing permission (farm.poultry.record) is
   the floor for the action itself. */
const memberCanManage = (membership) => memberCan(membership, "farm.poultry.manage");

const DAY = 86400000;
const todayStr = () => new Date().toISOString().slice(0, 10);

/* A date column arrives as a Date from one driver and a string from another
   (PGlite returns Date, postgres.js returns string). Normalise once. */
function dateOnly(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null;
}

const num = (v) => {
  if (v === undefined || v === null || v === "") return { ok: true, value: null };
  const n = Number(v);
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
};
const clean = (v, max = 500) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};
/* Divide only when the denominator is real. Percentages and rates in this file
   return null rather than NaN/Infinity — "no data yet" is a fact a farmer can
   act on; NaN is a bug they have to report. */
const pct = (numerator, denominator) =>
  denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : null;

/* ── shared guards ────────────────────────────────────────────────────────── */

/* A batch id in a payload is attacker-controlled. Re-read it and scope-check
   it — never trust that it belongs to the caller's farm. */
async function loadBatch(sql, membership, batchId) {
  const [batch] = await sql`
    select * from poultry_batches where id = ${batchId} and deleted_at is null limit 1`;
  requireScope(batch, membership);
  return batch;
}

const OPEN_STATUSES = ["draft", "active", "harvesting", "partially_sold"];

/* Writing operational data against a settled cycle changes a P&L somebody has
   already read. Allowed only as an explicit, audited correction by a manager. */
function assertWritable(batch, { isCorrection = false, canManage = false }) {
  if (OPEN_STATUSES.includes(batch.status)) return;
  if (isCorrection && canManage) return;
  throw new HttpError(409,
    `This batch is ${batch.status}. Record it as a correction (requires farm.poultry.manage) if it belongs to this cycle.`);
}

/* record_date must sit inside the cycle: never before the birds arrived, and
   never more than a day ahead — the same one-day clock-skew slack P1 allows on
   placement_date, so a phone with a fast clock still works and a fat-fingered
   year does not. */
function assertDateInCycle(batch, date, field = "Date") {
  const d = dateOnly(date);
  if (!d) throw new HttpError(400, `Enter a valid ${field.toLowerCase()}`);
  const placed = dateOnly(batch.placement_date);
  if (placed && d < placed) {
    throw new HttpError(400, `${field} cannot be before the batch was placed (${placed}).`);
  }
  const limit = new Date(Date.now() + DAY).toISOString().slice(0, 10);
  if (d > limit) throw new HttpError(400, `${field} cannot be in the future.`);
  return d;
}

/* Offline replay: the same client_uuid must yield the same row, not a second
   one. Looked up explicitly rather than via ON CONFLICT so the statement stays
   plain enough for every driver in this project. */
async function findByClientUuid(sql, table, spaceId, clientUuid) {
  const key = clean(clientUuid, 64);
  if (!key) return null;
  const rows = table === "daily"
    ? await sql`select * from poultry_daily_records where space_id = ${spaceId} and client_uuid = ${key} and deleted_at is null limit 1`
    : table === "weights"
      ? await sql`select * from poultry_weights where space_id = ${spaceId} and client_uuid = ${key} and deleted_at is null limit 1`
      : await sql`select * from poultry_feed_logs where space_id = ${spaceId} and client_uuid = ${key} and deleted_at is null limit 1`;
  return rows[0] || null;
}

/* ── bird arithmetic ──────────────────────────────────────────────────────── */

/* Birds lost before a given date — the basis of "opening birds" for that day.
   `excludeId` lets an update to an existing record ignore its own previous
   values, so re-saving a day does not count it twice.

   P2 BOUNDARY: sales and approved adjustments reduce live birds too, but
   neither exists until P5. They are absent here rather than guessed; when they
   arrive this is the one function that changes. */
async function lostBefore(tx, batchId, date, excludeId = null) {
  const [row] = await tx`
    select coalesce(sum(mortality), 0)::int as m, coalesce(sum(culls), 0)::int as c
      from poultry_daily_records
     where batch_id = ${batchId}
       and deleted_at is null
       and record_date < ${date}
       and (${excludeId}::text is null or id::text <> ${excludeId})`;
  return Number(row.m) + Number(row.c);
}

async function lostTotal(tx, batchId, excludeId = null) {
  const [row] = await tx`
    select coalesce(sum(mortality), 0)::int as m, coalesce(sum(culls), 0)::int as c
      from poultry_daily_records
     where batch_id = ${batchId}
       and deleted_at is null
       and (${excludeId}::text is null or id::text <> ${excludeId})`;
  return { mortality: Number(row.m), culls: Number(row.c) };
}

/* ── daily records ────────────────────────────────────────────────────────── */

function validateDailyInput(input = {}) {
  const value = {};
  const ints = [["mortality", "Mortality"], ["culls", "Culls"], ["labour_count", "Labour count"]];
  for (const [f, label] of ints) {
    if (input[f] === undefined) continue;
    const n = num(input[f]);
    if (!n.ok) return { error: `${label} must be a number` };
    if (n.value !== null && (!Number.isInteger(n.value) || n.value < 0)) {
      return { error: `${label} must be a whole number of zero or more` };
    }
    value[f] = n.value;
  }
  const decimals = [
    ["feed_consumed_kg", "Feed consumed", 0, 1e6],
    ["feed_wastage_kg", "Feed wastage", 0, 1e6],
    ["water_litres", "Water", 0, 1e7],
    ["temp_c", "Temperature", -50, 70],
    ["humidity_pct", "Humidity", 0, 100],
    ["lighting_hours", "Lighting hours", 0, 24],
  ];
  for (const [f, label, min, max] of decimals) {
    if (input[f] === undefined) continue;
    const n = num(input[f]);
    if (!n.ok) return { error: `${label} must be a number` };
    if (n.value !== null && (n.value < min || n.value > max)) {
      return { error: `${label} is out of range` };
    }
    value[f] = n.value;
  }
  for (const f of ["feed_type", "ventilation"]) {
    if (input[f] !== undefined) value[f] = clean(input[f], 60);
  }
  for (const f of ["symptoms", "remarks"]) {
    if (input[f] !== undefined) value[f] = clean(input[f], 1000);
  }
  for (const f of ["cleaning", "disinfection"]) {
    if (input[f] !== undefined) value[f] = !!input[f];
  }
  return { value };
}

export async function listDaily(sql, membership, { batchId, from = null, to = null, limit = 60 } = {}) {
  const batch = await loadBatch(sql, membership, batchId);
  const capped = Math.min(Math.max(Number(limit) || 60, 1), 400);
  return sql`
    select * from poultry_daily_records
     where batch_id = ${batch.id}
       and space_id = ${membership.space_id}
       and deleted_at is null
       and (${from}::text is null or record_date >= ${from})
       and (${to}::text is null or record_date <= ${to})
     order by record_date desc
     limit ${capped}`;
}

/* Create-or-update one day. The whole thing runs inside a transaction that
   locks the batch row first, so the bird check below is made against a state
   nobody else can change until this commits. */
export async function upsertDaily(sql, membership, actorUserId, input = {}) {
  const { batchId, record_date, client_uuid, is_correction = false } = input;

  const replayed = await findByClientUuid(sql, "daily", membership.space_id, client_uuid);
  if (replayed) return replayed;

  const batch = await loadBatch(sql, membership, batchId);
  const canManage = memberCanManage(membership);
  assertWritable(batch, { isCorrection: !!is_correction, canManage });
  const date = assertDateInCycle(batch, record_date, "Record date");

  const { value, error } = validateDailyInput(input);
  if (error) throw new HttpError(400, error);

  const result = await sql.begin(async (tx) => {
    /* The serialization point. Everything below reads a batch nobody else can
       modify until this transaction ends. */
    const [locked] = await tx`
      select id, placed_qty from poultry_batches where id = ${batch.id} for update`;
    if (!locked) throw new HttpError(404, "Batch not found");

    const [existing] = await tx`
      select * from poultry_daily_records
       where batch_id = ${batch.id} and record_date = ${date} and deleted_at is null
       limit 1`;

    const mortality = value.mortality ?? existing?.mortality ?? 0;
    const culls = value.culls ?? existing?.culls ?? 0;

    const placed = Number(locked.placed_qty);

    /* TWO checks, and both are needed — the second was added after the
       real-Postgres concurrency suite buried 80 birds in a batch of 50.

       1. Per-date. Cannot lose more birds on a day than were alive that
          morning. Opening is derived from EARLIER days only, so it is the
          right question for this row.
       2. Cumulative. The per-date check alone is not enough: it counts only
          what came before, so several out-of-order or back-dated entries each
          pass on their own while the total quietly exceeds the birds ever
          placed. Concurrent writers on different dates hit exactly this. The
          running total across every day is therefore checked against
          placed_qty too, inside the same lock. */
    const lostEarlier = await lostBefore(tx, batch.id, date, existing?.id ?? null);
    const opening = placed - lostEarlier;

    if (mortality + culls > opening) {
      throw new HttpError(400,
        `Mortality and culls (${mortality + culls}) exceed the ${opening} birds alive on ${date}.`,
        { available: opening, requested: mortality + culls, record_date: date });
    }

    const others = await lostTotal(tx, batch.id, existing?.id ?? null);
    const cumulative = others.mortality + others.culls + mortality + culls;
    if (cumulative > placed) {
      const remaining = Math.max(0, placed - (others.mortality + others.culls));
      throw new HttpError(400,
        `That would bring total losses to ${cumulative} birds, but only ${placed} were placed. ${remaining} remain unaccounted for.`,
        { placed_qty: placed, already_lost: others.mortality + others.culls,
          remaining, requested: mortality + culls });
    }

    if (existing) {
      const [updated] = await tx`
        update poultry_daily_records set
          mortality        = ${mortality},
          culls            = ${culls},
          feed_consumed_kg = ${value.feed_consumed_kg !== undefined ? value.feed_consumed_kg : existing.feed_consumed_kg},
          feed_type        = coalesce(${value.feed_type ?? null}, feed_type),
          feed_wastage_kg  = ${value.feed_wastage_kg !== undefined ? value.feed_wastage_kg : existing.feed_wastage_kg},
          water_litres     = ${value.water_litres !== undefined ? value.water_litres : existing.water_litres},
          temp_c           = ${value.temp_c !== undefined ? value.temp_c : existing.temp_c},
          humidity_pct     = ${value.humidity_pct !== undefined ? value.humidity_pct : existing.humidity_pct},
          ventilation      = coalesce(${value.ventilation ?? null}, ventilation),
          lighting_hours   = ${value.lighting_hours !== undefined ? value.lighting_hours : existing.lighting_hours},
          symptoms         = coalesce(${value.symptoms ?? null}, symptoms),
          remarks          = coalesce(${value.remarks ?? null}, remarks),
          labour_count     = ${value.labour_count !== undefined ? value.labour_count : existing.labour_count},
          cleaning         = ${value.cleaning !== undefined ? value.cleaning : existing.cleaning},
          disinfection     = ${value.disinfection !== undefined ? value.disinfection : existing.disinfection},
          is_correction    = ${existing.is_correction || !!is_correction},
          updated_by       = ${actorUserId}
        where id = ${existing.id}
        returning *`;
      return { row: updated, created: false };
    }

    const [created] = await tx`
      insert into poultry_daily_records
        (space_id, batch_id, record_date, mortality, culls, feed_consumed_kg, feed_type,
         feed_wastage_kg, water_litres, temp_c, humidity_pct, ventilation, lighting_hours,
         symptoms, remarks, labour_count, cleaning, disinfection, is_correction,
         created_by, updated_by, client_uuid)
      values (${membership.space_id}, ${batch.id}, ${date}, ${mortality}, ${culls},
              ${value.feed_consumed_kg ?? null}, ${value.feed_type ?? null},
              ${value.feed_wastage_kg ?? null}, ${value.water_litres ?? null},
              ${value.temp_c ?? null}, ${value.humidity_pct ?? null},
              ${value.ventilation ?? null}, ${value.lighting_hours ?? null},
              ${value.symptoms ?? null}, ${value.remarks ?? null},
              ${value.labour_count ?? null}, ${value.cleaning ?? false},
              ${value.disinfection ?? false}, ${!!is_correction},
              ${actorUserId}, ${actorUserId}, ${clean(client_uuid, 64)})
      returning *`;
    return { row: created, created: true };
  });

  await audit(sql, { spaceId: membership.space_id, actorUserId,
    action: result.created ? "poultry.daily.created" : "poultry.daily.updated",
    targetType: "poultry_daily_record", targetId: result.row.id,
    meta: { batch_id: batch.id, record_date: result.row.record_date,
            mortality: result.row.mortality, culls: result.row.culls,
            correction: result.row.is_correction } });
  return result.row;
}

export async function deleteDaily(sql, membership, actorUserId, { recordId } = {}) {
  const [existing] = await sql`
    select * from poultry_daily_records where id = ${recordId} and deleted_at is null limit 1`;
  requireScope(existing, membership);

  await sql`update poultry_daily_records set deleted_at = now(), updated_by = ${actorUserId} where id = ${recordId}`;
  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "poultry.daily.deleted",
    targetType: "poultry_daily_record", targetId: recordId,
    meta: { batch_id: existing.batch_id, record_date: existing.record_date } });
  return { id: recordId, deleted: true };
}

/* ── weighings ────────────────────────────────────────────────────────────── */

export async function listWeights(sql, membership, { batchId, limit = 100 } = {}) {
  const batch = await loadBatch(sql, membership, batchId);
  const capped = Math.min(Math.max(Number(limit) || 100, 1), 400);
  return sql`
    select * from poultry_weights
     where batch_id = ${batch.id} and space_id = ${membership.space_id} and deleted_at is null
     order by weigh_date desc, created_at desc
     limit ${capped}`;
}

export async function addWeight(sql, membership, actorUserId, input = {}) {
  const { batchId, weigh_date, client_uuid } = input;

  const replayed = await findByClientUuid(sql, "weights", membership.space_id, client_uuid);
  if (replayed) return replayed;

  const batch = await loadBatch(sql, membership, batchId);
  assertWritable(batch, { isCorrection: !!input.is_correction, canManage: memberCanManage(membership) });
  const date = assertDateInCycle(batch, weigh_date, "Weighing date");

  const sample = num(input.sample_count);
  const total = num(input.total_sample_weight_g);
  if (!sample.ok || sample.value === null) throw new HttpError(400, "Sample count is required");
  if (!Number.isInteger(sample.value) || sample.value <= 0) {
    throw new HttpError(400, "Sample count must be a whole number above zero");
  }
  if (!total.ok || total.value === null) throw new HttpError(400, "Total sample weight is required");
  if (total.value <= 0) throw new HttpError(400, "Total sample weight must be above zero");

  /* Derived, never taken from the body: a client-supplied average is the one
     number that could quietly flatter an FCR. Rounded to 2dp to match the
     column and to keep the arithmetic reproducible. */
  const average = Math.round((total.value / sample.value) * 100) / 100;
  if (!(average > 0)) throw new HttpError(400, "Average weight could not be calculated");

  const [row] = await sql`
    insert into poultry_weights
      (space_id, batch_id, weigh_date, sample_count, total_sample_weight_g,
       average_weight_g, weighing_method, notes, created_by, updated_by, client_uuid)
    values (${membership.space_id}, ${batch.id}, ${date}, ${sample.value}, ${total.value},
            ${average}, ${clean(input.weighing_method, 60)}, ${clean(input.notes, 500)},
            ${actorUserId}, ${actorUserId}, ${clean(client_uuid, 64)})
    returning *`;

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "poultry.weight.added",
    targetType: "poultry_weight", targetId: row.id,
    meta: { batch_id: batch.id, weigh_date: date, average_weight_g: average } });
  return row;
}

export async function deleteWeight(sql, membership, actorUserId, { weightId } = {}) {
  const [existing] = await sql`
    select * from poultry_weights where id = ${weightId} and deleted_at is null limit 1`;
  requireScope(existing, membership);
  await sql`update poultry_weights set deleted_at = now(), updated_by = ${actorUserId} where id = ${weightId}`;
  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "poultry.weight.deleted",
    targetType: "poultry_weight", targetId: weightId, meta: { batch_id: existing.batch_id } });
  return { id: weightId, deleted: true };
}

/* Average Daily Gain between the two most recent weighings.

   Returns null — never 0 — when it cannot be known: fewer than two weighings,
   or two on the same day (a zero interval is a division by zero, not a
   growth rate of nothing). A NEGATIVE result is returned as-is: birds losing
   weight is real, usually the first sign of a problem, and clamping it to zero
   would hide exactly the signal a farmer needs. */
export function computeADG(weights) {
  const rows = (weights || [])
    .map((w) => ({ date: dateOnly(w.weigh_date), avg: Number(w.average_weight_g) }))
    .filter((w) => w.date && Number.isFinite(w.avg))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length < 2) return null;

  const latest = rows[rows.length - 1];
  /* Walk back to the most recent weighing on an EARLIER day — several
     weighings on one day are normal (different pens) and would otherwise give
     a zero interval. */
  const previous = [...rows].reverse().find((r) => r.date < latest.date);
  if (!previous) return null;

  const days = Math.round((Date.parse(latest.date) - Date.parse(previous.date)) / DAY);
  if (!(days > 0)) return null;
  return Math.round(((latest.avg - previous.avg) / days) * 100) / 100;
}

/* ── feed ledger ──────────────────────────────────────────────────────────── */

const FEED_KINDS = ["received", "consumed", "wastage", "adjustment_in", "adjustment_out"];
/* Which kinds take feed OUT of the batch's stock. */
const OUTBOUND = ["consumed", "wastage", "adjustment_out"];

export async function listFeed(sql, membership, { batchId, kind = null, limit = 200 } = {}) {
  const batch = await loadBatch(sql, membership, batchId);
  const capped = Math.min(Math.max(Number(limit) || 200, 1), 400);
  return sql`
    select * from poultry_feed_logs
     where batch_id = ${batch.id} and space_id = ${membership.space_id} and deleted_at is null
       and (${kind}::text is null or kind = ${kind})
     order by log_date desc, created_at desc
     limit ${capped}`;
}

/* Feed stock = what came in minus what went out. Derived from the ledger every
   time rather than kept as a running total, so it can never disagree with its
   own history. */
async function feedStock(tx, batchId, excludeId = null) {
  const [row] = await tx`
    select
      coalesce(sum(case when kind in ('received','adjustment_in') then quantity_kg else 0 end), 0) as inbound,
      coalesce(sum(case when kind in ('consumed','wastage','adjustment_out') then quantity_kg else 0 end), 0) as outbound
      from poultry_feed_logs
     where batch_id = ${batchId} and deleted_at is null
       and (${excludeId}::text is null or id::text <> ${excludeId})`;
  const inbound = Number(row.inbound) || 0;
  const outbound = Number(row.outbound) || 0;
  return Math.round((inbound - outbound) * 1000) / 1000;
}

export async function addFeedLog(sql, membership, actorUserId, input = {}) {
  const { batchId, log_date, kind, client_uuid } = input;

  const replayed = await findByClientUuid(sql, "feed", membership.space_id, client_uuid);
  if (replayed) return replayed;

  const batch = await loadBatch(sql, membership, batchId);
  assertWritable(batch, { isCorrection: !!input.is_correction, canManage: memberCanManage(membership) });
  const date = assertDateInCycle(batch, log_date, "Feed date");

  if (!FEED_KINDS.includes(kind)) throw new HttpError(400, "Unknown feed entry type");

  const qty = num(input.quantity_kg);
  if (!qty.ok || qty.value === null) throw new HttpError(400, "Quantity is required");
  if (!(qty.value > 0)) throw new HttpError(400, "Quantity must be above zero");
  const rate = num(input.rate_per_kg);
  if (!rate.ok) throw new HttpError(400, "Rate must be a number");
  if (rate.value !== null && rate.value < 0) throw new HttpError(400, "Rate cannot be negative");
  const amount = rate.value !== null ? Math.round(qty.value * rate.value * 100) / 100 : null;

  const row = await sql.begin(async (tx) => {
    const [locked] = await tx`select id from poultry_batches where id = ${batch.id} for update`;
    if (!locked) throw new HttpError(404, "Batch not found");

    /* An overdraw is rejected, not clamped. The device-local farm inventory
       clamps because it was built for one offline user; this ledger is shared,
       where clamping would silently swallow a second worker's entry. The error
       carries the available quantity so the UI can explain it — the figures
       come from this batch alone, so nothing crosses a Farm Space boundary. */
    if (OUTBOUND.includes(kind)) {
      const available = await feedStock(tx, batch.id);
      if (qty.value > available) {
        throw new HttpError(400,
          `Only ${available} kg of feed is on hand for this batch; you entered ${qty.value} kg.`,
          { available_kg: available, requested_kg: qty.value, kind });
      }
    }

    const [created] = await tx`
      insert into poultry_feed_logs
        (space_id, batch_id, log_date, kind, feed_type, quantity_kg, rate_per_kg,
         amount, supplier, notes, created_by, updated_by, client_uuid)
      values (${membership.space_id}, ${batch.id}, ${date}, ${kind},
              ${clean(input.feed_type, 60)}, ${qty.value}, ${rate.value},
              ${amount}, ${clean(input.supplier, 120)}, ${clean(input.notes, 500)},
              ${actorUserId}, ${actorUserId}, ${clean(client_uuid, 64)})
      returning *`;
    return created;
  });

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "poultry.feed.added",
    targetType: "poultry_feed_log", targetId: row.id,
    meta: { batch_id: batch.id, kind, quantity_kg: qty.value, log_date: date } });
  return row;
}

export async function deleteFeedLog(sql, membership, actorUserId, { feedLogId } = {}) {
  const [existing] = await sql`
    select * from poultry_feed_logs where id = ${feedLogId} and deleted_at is null limit 1`;
  requireScope(existing, membership);

  /* Removing an inbound entry can push stock negative if it has already been
     eaten. Refuse rather than leave the ledger inconsistent. */
  await sql.begin(async (tx) => {
    await tx`select id from poultry_batches where id = ${existing.batch_id} for update`;
    if (!OUTBOUND.includes(existing.kind)) {
      const without = await feedStock(tx, existing.batch_id, existing.id);
      if (without < 0) {
        throw new HttpError(409,
          `Removing this entry would leave ${without} kg of feed on hand. Remove the consumption it covered first.`,
          { resulting_stock_kg: without });
      }
    }
    await tx`update poultry_feed_logs set deleted_at = now(), updated_by = ${actorUserId} where id = ${existing.id}`;
  });

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "poultry.feed.deleted",
    targetType: "poultry_feed_log", targetId: feedLogId,
    meta: { batch_id: existing.batch_id, kind: existing.kind, quantity_kg: existing.quantity_kg } });
  return { id: feedLogId, deleted: true };
}

/* ── metrics ──────────────────────────────────────────────────────────────── */

/* One consistent snapshot of a batch.

   Read inside a single transaction so every figure describes the same instant.
   Without that, live_birds could be counted before a mortality write commits
   and the FCR's currentCount after it — a snapshot that never actually existed,
   and the kind of inconsistency that makes a farmer distrust the whole screen.

   Aggregates are computed in SQL (four grouped reads), not by pulling the
   history into JavaScript: a batch at day 40 has 40 daily rows and could have
   hundreds of feed entries, and none of them need to travel to answer "what is
   the FCR". */
export async function batchMetrics(sql, membership, { batchId } = {}) {
  const batch = await loadBatch(sql, membership, batchId);

  const snap = await sql.begin(async (tx) => {
    const [birds] = await tx`
      select coalesce(sum(mortality), 0)::int as mortality,
             coalesce(sum(culls), 0)::int     as culls,
             count(*)::int                    as record_count,
             max(record_date)                 as last_record_date
        from poultry_daily_records
       where batch_id = ${batch.id} and deleted_at is null`;

    const [feed] = await tx`
      select
        coalesce(sum(case when kind = 'consumed' then quantity_kg else 0 end), 0)                    as consumed,
        coalesce(sum(case when kind = 'wastage' then quantity_kg else 0 end), 0)                     as wastage,
        coalesce(sum(case when kind in ('received','adjustment_in') then quantity_kg else 0 end), 0) as inbound,
        coalesce(sum(case when kind in ('consumed','wastage','adjustment_out') then quantity_kg else 0 end), 0) as outbound,
        coalesce(sum(amount), 0)                                                                     as cost
        from poultry_feed_logs
       where batch_id = ${batch.id} and deleted_at is null`;

    /* Only the two most recent weigh days are needed for ADG and current
       weight; the rest of the history stays in the database. */
    const weights = await tx`
      select weigh_date, average_weight_g
        from poultry_weights
       where batch_id = ${batch.id} and deleted_at is null
       order by weigh_date desc, created_at desc
       limit 50`;

    return { birds, feed, weights };
  });

  const placed = Number(batch.placed_qty) || 0;
  const mortality = Number(snap.birds.mortality) || 0;
  const culls = Number(snap.birds.culls) || 0;
  const lost = mortality + culls;

  /* P2 BOUNDARY — sales and approved adjustments also reduce live birds, but
     neither exists before P5. They are omitted rather than guessed. */
  const liveBirds = Math.max(0, placed - lost);

  const latest = snap.weights[0] || null;
  const latestAvgWeightG = latest ? Number(latest.average_weight_g) : null;

  const feedConsumed = Math.round((Number(snap.feed.consumed) || 0) * 1000) / 1000;
  const feedStockKg = Math.round(((Number(snap.feed.inbound) || 0) - (Number(snap.feed.outbound) || 0)) * 1000) / 1000;

  /* THE authoritative engine — same function feedBatchService uses. Grams
     become kilograms inside fcr.js and nowhere else. Both liveBirds and the
     weight come from the snapshot above, so currentCount and the biomass
     describe one consistent state. */
  const fcr = computePoultryFCR({
    placedQty: placed,
    placementAvgWeightG: batch.placement_avg_weight_g,
    liveBirds,
    latestAvgWeightG,
    targetFcr: batch.target_fcr,
  }, feedConsumed);

  const cumulativeMortalityPct = pct(lost, placed);

  return {
    batch_id: batch.id,
    status: batch.status,
    placed_qty: placed,
    mortality,
    culls,
    live_birds: liveBirds,
    live_birds_excludes: ["sales", "adjustments"], // arriving in P5
    cumulative_mortality_pct: cumulativeMortalityPct,
    survival_pct: cumulativeMortalityPct === null ? null : Math.round((100 - cumulativeMortalityPct) * 100) / 100,
    daily_record_count: Number(snap.birds.record_count) || 0,
    last_record_date: dateOnly(snap.birds.last_record_date),
    latest_avg_weight_g: latestAvgWeightG,
    latest_weigh_date: latest ? dateOnly(latest.weigh_date) : null,
    adg_g_per_day: computeADG(snap.weights),
    feed_consumed_kg: feedConsumed,
    feed_wastage_kg: Math.round((Number(snap.feed.wastage) || 0) * 1000) / 1000,
    feed_stock_kg: feedStockKg,
    feed_cost: Math.round((Number(snap.feed.cost) || 0) * 100) / 100,
    ...fcr,
  };
}

/* Validated inputs for the EXISTING farmAlertsService to consume later. No
   alert engine here, no thresholds invented — just facts and the comparisons
   the farmer's own targets make available, each null when unknowable. */
export async function alertSignals(sql, membership, { batchId } = {}) {
  const m = await batchMetrics(sql, membership, { batchId });
  const [batch] = await sql`select target_mortality_pct, target_weight_g, target_fcr from poultry_batches where id = ${batchId}`;

  const daysSinceRecord = m.last_record_date
    ? Math.round((Date.parse(todayStr()) - Date.parse(m.last_record_date)) / DAY)
    : null;

  return {
    batch_id: m.batch_id,
    mortality_pct: m.cumulative_mortality_pct,
    mortality_over_target: (m.cumulative_mortality_pct !== null && batch?.target_mortality_pct != null)
      ? m.cumulative_mortality_pct > Number(batch.target_mortality_pct) : null,
    days_since_last_record: daysSinceRecord,
    weight_below_target: (m.latest_avg_weight_g !== null && batch?.target_weight_g != null)
      ? m.latest_avg_weight_g < Number(batch.target_weight_g) : null,
    fcr: m.fcr,
    fcr_worse_than_target: m.performanceStatus === "worse_than_target",
    feed_stock_kg: m.feed_stock_kg,
    adg_g_per_day: m.adg_g_per_day,
    adg_negative: m.adg_g_per_day === null ? null : m.adg_g_per_day < 0,
  };
}
