/* Poultry Finance — sales and production costs for a batch cycle.

   Split from poultryOps.js to keep both readable. Every action goes through
   the same six-step gate in farm.js; nothing in here re-checks identity.

   DESIGN DECISIONS

   Feed costs are NOT here. They are tracked in poultry_feed_logs.amount
   (since migration 0014). The finance summary reads them from there. Putting
   feed costs in this table too would double-count them.

   Sales are immutable after creation. Delete + re-add is the pattern used
   throughout this codebase. No update action exists for sales.

   addSale runs inside sql.begin with SELECT ... FOR UPDATE on the batch row,
   the same concurrency pattern as upsertDaily and addFeedLog. Two concurrent
   sales against the same near-empty batch must queue; the second re-reads the
   true available birds after the first commits.

   SHARED HELPERS DUPLICATED HERE (not imported from poultryOps.js):

     loadBatch, assertWritable, assertDateInCycle, dateOnly, clean
     memberCanManage, num

   Copied verbatim so this module stays self-contained. */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";
import { memberCan } from "./permissions.js";

const memberCanManage = (membership) => memberCan(membership, "farm.poultry.manage");

const DAY = 86400000;
const OPEN_STATUSES = ["draft", "active", "harvesting", "partially_sold"];

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

async function loadBatch(sql, membership, batchId) {
  const [batch] = await sql`
    select * from poultry_batches where id = ${batchId} and deleted_at is null limit 1`;
  requireScope(batch, membership);
  return batch;
}

function assertWritable(batch, { isCorrection = false, canManage = false }) {
  if (OPEN_STATUSES.includes(batch.status)) return;
  if (isCorrection && canManage) return;
  throw new HttpError(409,
    `This batch is ${batch.status}. Record it as a correction (requires farm.poultry.manage) if it belongs to this cycle.`);
}

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

const VALID_COST_CATEGORIES = [
  "chick_cost", "labour", "medicine", "equipment",
  "transport", "electricity", "overhead", "other",
];

/* ── sales ────────────────────────────────────────────────────────────────── */

export async function listSales(sql, membership, { batchId, limit = 200 } = {}) {
  const batch = await loadBatch(sql, membership, batchId);
  const capped = Math.min(Math.max(Number(limit) || 200, 1), 500);
  return sql`
    select * from poultry_batch_sales
     where batch_id   = ${batch.id}
       and space_id   = ${membership.space_id}
       and deleted_at is null
     order by sale_date desc, created_at desc
     limit ${capped}`;
}

export async function addSale(sql, membership, actorUserId, input = {}) {
  const {
    batchId,
    sale_date,
    buyer_name,
    birds_sold,
    live_weight_kg,
    price_per_kg,
    price_per_bird,
    gross_amount,
    transport_deduction = 0,
    commission_deduction = 0,
    other_deduction = 0,
    notes,
    clientUuid,
    isCorrection = false,
  } = input;

  if (!batchId) throw new HttpError(400, "batchId is required");

  // Idempotency: if client_uuid seen before, return the existing row
  if (clientUuid) {
    const key = clean(clientUuid, 64);
    if (key) {
      const [prior] = await sql`
        select * from poultry_batch_sales
         where space_id = ${membership.space_id} and client_uuid = ${key} and deleted_at is null limit 1`;
      if (prior) return prior;
    }
  }

  // Validate birds_sold
  const bSold = Number(birds_sold);
  if (!Number.isInteger(bSold) || bSold < 1) throw new HttpError(400, "birds_sold must be a whole number greater than zero");

  // Validate gross_amount
  const gross = Number(gross_amount);
  if (!Number.isFinite(gross) || gross < 0) throw new HttpError(400, "gross_amount must be zero or more");

  // Validate optional numeric fields
  const nLiveWeight = num(live_weight_kg);
  if (!nLiveWeight.ok || (nLiveWeight.value !== null && nLiveWeight.value <= 0)) throw new HttpError(400, "live_weight_kg must be greater than zero");
  const nPPK = num(price_per_kg);
  if (!nPPK.ok || (nPPK.value !== null && nPPK.value < 0)) throw new HttpError(400, "price_per_kg must be zero or more");
  const nPPB = num(price_per_bird);
  if (!nPPB.ok || (nPPB.value !== null && nPPB.value < 0)) throw new HttpError(400, "price_per_bird must be zero or more");
  const nTransport = Number(transport_deduction) || 0;
  const nCommission = Number(commission_deduction) || 0;
  const nOther = Number(other_deduction) || 0;
  if (nTransport < 0 || nCommission < 0 || nOther < 0) throw new HttpError(400, "Deductions cannot be negative");

  const canManage = memberCanManage(membership);

  const row = await sql.begin(async (tx) => {
    // Lock the batch row — the same serialization point used by upsertDaily
    const [batch] = await tx`
      select * from poultry_batches where id = ${batchId} and deleted_at is null for update`;
    requireScope(batch, membership);
    assertWritable(batch, { isCorrection, canManage });

    const saleDate = assertDateInCycle(batch, sale_date, "Sale date");

    // How many birds are currently live?
    const [dailyRow] = await tx`
      select coalesce(sum(mortality), 0)::int as m,
             coalesce(sum(culls), 0)::int     as c
        from poultry_daily_records
       where batch_id = ${batchId} and deleted_at is null`;
    const [soldRow] = await tx`
      select coalesce(sum(birds_sold), 0)::int as total_sold
        from poultry_batch_sales
       where batch_id = ${batchId} and deleted_at is null`;

    const placed  = Number(batch.placed_qty) || 0;
    const lost    = Number(dailyRow.m) + Number(dailyRow.c);
    const alreadySold = Number(soldRow.total_sold);
    const available = Math.max(0, placed - lost - alreadySold);

    if (bSold > available) {
      throw new HttpError(409, `Only ${available.toLocaleString()} birds are available for sale (placed ${placed.toLocaleString()}, lost ${lost.toLocaleString()}, already sold ${alreadySold.toLocaleString()}).`, {
        details: { available, birds_sold: bSold, placed, lost, already_sold: alreadySold },
      });
    }

    const [inserted] = await tx`
      insert into poultry_batch_sales (
        space_id, batch_id, sale_date, buyer_name,
        birds_sold, live_weight_kg, price_per_kg, price_per_bird,
        gross_amount, transport_deduction, commission_deduction, other_deduction,
        notes, created_by, updated_by, client_uuid
      ) values (
        ${membership.space_id}, ${batchId}, ${saleDate}, ${clean(buyer_name, 100)},
        ${bSold}, ${nLiveWeight.value}, ${nPPK.value}, ${nPPB.value},
        ${gross}, ${nTransport}, ${nCommission}, ${nOther},
        ${clean(notes, 500)}, ${actorUserId}, ${actorUserId}, ${clean(clientUuid, 64)}
      )
      returning *`;

    await audit(tx, membership, actorUserId, "poultry.sale.add",
      { batch_id: batchId, sale_id: inserted.id, birds_sold: bSold });

    return inserted;
  });

  return row;
}

export async function deleteSale(sql, membership, actorUserId, { saleId, isCorrection = false } = {}) {
  if (!saleId) throw new HttpError(400, "saleId is required");

  const [sale] = await sql`
    select * from poultry_batch_sales where id = ${saleId} and deleted_at is null limit 1`;
  if (!sale) throw new HttpError(404, "Sale not found");
  requireScope(sale, membership);

  // Check writable state (can correct a closed batch if canManage)
  const [batch] = await sql`
    select * from poultry_batches where id = ${sale.batch_id} and deleted_at is null limit 1`;
  requireScope(batch, membership);
  assertWritable(batch, { isCorrection, canManage: memberCanManage(membership) });

  await sql`
    update poultry_batch_sales
       set deleted_at = now(), updated_by = ${actorUserId}
     where id = ${saleId}`;

  await audit(sql, membership, actorUserId, "poultry.sale.delete",
    { batch_id: sale.batch_id, sale_id: saleId });

  return { deleted: true, id: saleId };
}

/* ── costs ────────────────────────────────────────────────────────────────── */

export async function listCosts(sql, membership, { batchId, limit = 200 } = {}) {
  const batch = await loadBatch(sql, membership, batchId);
  const capped = Math.min(Math.max(Number(limit) || 200, 1), 500);
  return sql`
    select * from poultry_batch_costs
     where batch_id   = ${batch.id}
       and space_id   = ${membership.space_id}
       and deleted_at is null
     order by cost_date desc, created_at desc
     limit ${capped}`;
}

export async function addCost(sql, membership, actorUserId, input = {}) {
  const {
    batchId,
    cost_date,
    category,
    description,
    quantity,
    unit,
    unit_cost,
    amount,
    supplier,
    reference,
    notes,
    clientUuid,
    isCorrection = false,
  } = input;

  if (!batchId) throw new HttpError(400, "batchId is required");
  if (!VALID_COST_CATEGORIES.includes(category)) {
    throw new HttpError(400, `category must be one of: ${VALID_COST_CATEGORIES.join(", ")}`);
  }
  const desc = clean(description, 200);
  if (!desc) throw new HttpError(400, "description is required");
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new HttpError(400, "amount must be greater than zero");

  const nQty = num(quantity);
  if (!nQty.ok || (nQty.value !== null && nQty.value <= 0)) throw new HttpError(400, "quantity must be greater than zero");
  const nUnitCost = num(unit_cost);
  if (!nUnitCost.ok || (nUnitCost.value !== null && nUnitCost.value < 0)) throw new HttpError(400, "unit_cost must be zero or more");

  // Idempotency
  if (clientUuid) {
    const key = clean(clientUuid, 64);
    if (key) {
      const [prior] = await sql`
        select * from poultry_batch_costs
         where space_id = ${membership.space_id} and client_uuid = ${key} and deleted_at is null limit 1`;
      if (prior) return prior;
    }
  }

  const batch = await loadBatch(sql, membership, batchId);
  assertWritable(batch, { isCorrection, canManage: memberCanManage(membership) });
  const costDate = assertDateInCycle(batch, cost_date, "Cost date");

  const [row] = await sql`
    insert into poultry_batch_costs (
      space_id, batch_id, cost_date, category, description,
      quantity, unit, unit_cost, amount,
      supplier, reference, notes,
      created_by, updated_by, client_uuid
    ) values (
      ${membership.space_id}, ${batchId}, ${costDate}, ${category}, ${desc},
      ${nQty.value}, ${clean(unit, 20)}, ${nUnitCost.value}, ${amt},
      ${clean(supplier, 100)}, ${clean(reference, 100)}, ${clean(notes, 500)},
      ${actorUserId}, ${actorUserId}, ${clean(clientUuid, 64)}
    )
    returning *`;

  await audit(sql, membership, actorUserId, "poultry.cost.add",
    { batch_id: batchId, cost_id: row.id, category, amount: amt });

  return row;
}

export async function deleteCost(sql, membership, actorUserId, { costId, isCorrection = false } = {}) {
  if (!costId) throw new HttpError(400, "costId is required");

  const [cost] = await sql`
    select * from poultry_batch_costs where id = ${costId} and deleted_at is null limit 1`;
  if (!cost) throw new HttpError(404, "Cost entry not found");
  requireScope(cost, membership);

  const [batch] = await sql`
    select * from poultry_batches where id = ${cost.batch_id} and deleted_at is null limit 1`;
  requireScope(batch, membership);
  assertWritable(batch, { isCorrection, canManage: memberCanManage(membership) });

  await sql`
    update poultry_batch_costs
       set deleted_at = now(), updated_by = ${actorUserId}
     where id = ${costId}`;

  await audit(sql, membership, actorUserId, "poultry.cost.delete",
    { batch_id: cost.batch_id, cost_id: costId });

  return { deleted: true, id: costId };
}

/* ── finance summary ─────────────────────────────────────────────────────── */

/* One consistent snapshot: revenue from sales + feed costs from feed_logs +
   other costs from poultry_batch_costs. All reads run in a single transaction
   so the numbers describe one instant rather than moments across concurrent
   writes. */
export async function financeSummary(sql, membership, { batchId } = {}) {
  const batch = await loadBatch(sql, membership, batchId);

  const snap = await sql.begin(async (tx) => {
    const [birds] = await tx`
      select coalesce(sum(mortality), 0)::int as mortality,
             coalesce(sum(culls), 0)::int     as culls
        from poultry_daily_records
       where batch_id = ${batchId} and deleted_at is null`;

    const [sales] = await tx`
      select coalesce(count(*), 0)::int       as sale_count,
             coalesce(sum(birds_sold), 0)::int as birds_sold,
             coalesce(sum(live_weight_kg), 0)  as live_weight_kg,
             coalesce(sum(gross_amount), 0)    as gross_revenue,
             coalesce(sum(transport_deduction + commission_deduction + other_deduction), 0) as total_deductions,
             coalesce(sum(net_revenue), 0)     as net_revenue
        from poultry_batch_sales
       where batch_id = ${batchId} and deleted_at is null`;

    const [feedCost] = await tx`
      select coalesce(sum(amount), 0) as feed_cost
        from poultry_feed_logs
       where batch_id = ${batchId} and deleted_at is null`;

    const [otherCosts] = await tx`
      select coalesce(sum(amount), 0) as other_costs,
             coalesce(count(*), 0)::int as cost_count
        from poultry_batch_costs
       where batch_id = ${batchId} and deleted_at is null`;

    return { birds, sales, feedCost, otherCosts };
  });

  const placed      = Number(batch.placed_qty) || 0;
  const mortality   = Number(snap.birds.mortality) || 0;
  const culls       = Number(snap.birds.culls) || 0;
  const birdsSold   = Number(snap.sales.birds_sold) || 0;
  const remaining   = Math.max(0, placed - mortality - culls - birdsSold);

  const grossRevenue    = round2(Number(snap.sales.gross_revenue) || 0);
  const totalDeductions = round2(Number(snap.sales.total_deductions) || 0);
  const netRevenue      = round2(Number(snap.sales.net_revenue) || 0);
  const feedCost        = round2(Number(snap.feedCost.feed_cost) || 0);
  const otherCosts      = round2(Number(snap.otherCosts.other_costs) || 0);
  const totalCosts      = round2(feedCost + otherCosts);
  const netProfit       = round2(netRevenue - totalCosts);

  return {
    batch_id:         batch.id,
    status:           batch.status,
    placed_qty:       placed,
    mortality,
    culls,
    birds_sold:       birdsSold,
    birds_remaining:  remaining,
    live_weight_sold_kg: round3(Number(snap.sales.live_weight_kg) || 0),
    sale_count:       Number(snap.sales.sale_count) || 0,
    cost_count:       Number(snap.otherCosts.cost_count) || 0,
    gross_revenue:    grossRevenue,
    total_deductions: totalDeductions,
    net_revenue:      netRevenue,
    feed_cost:        feedCost,
    other_costs:      otherCosts,
    total_costs:      totalCosts,
    net_profit:       netProfit,
    // helpful derived metrics (null when no data)
    revenue_per_kg:   (snap.sales.live_weight_kg > 0 && netRevenue > 0)
      ? round2(netRevenue / Number(snap.sales.live_weight_kg)) : null,
    cost_per_bird_placed: placed > 0 ? round2(totalCosts / placed) : null,
    cost_per_bird_sold:   birdsSold > 0 ? round2(totalCosts / birdsSold) : null,
  };
}

function round2(n) { return Math.round(n * 100) / 100; }
function round3(n) { return Math.round(n * 1000) / 1000; }
