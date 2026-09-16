/* Dairy — D1 Finance: milk sales, costs, finance summary.
 *
 * Milk sales are farm-level (no animal_id) — the cooperative or bulk buyer
 * receives the daily pool, not per-animal quantities. The amount column is
 * GENERATED (quantity_kg × price_per_litre) so it never diverges. */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";

const SALE_TYPES = new Set(["morning", "evening", "combined"]);
const COST_CATEGORIES = new Set([
  "concentrate_feed", "roughage", "medicine", "labour",
  "ai_cost", "equipment", "veterinary", "other",
]);

/* ── milk sales ───────────────────────────────────────────────────────────── */

export async function listSales(sql, membership, payload = {}) {
  const { fromDate, toDate, limit = 60 } = payload;
  const fromClause = fromDate ? sql`and sale_date >= ${fromDate}` : sql``;
  const toClause   = toDate   ? sql`and sale_date <= ${toDate}`   : sql``;

  return sql`
    select * from dairy_milk_sales
    where space_id = ${membership.space_id} and deleted_at is null
      ${fromClause} ${toClause}
    order by sale_date desc
    limit ${limit}
  `;
}

export async function addSale(sql, membership, actorUserId, payload) {
  const { saleDate, buyer, saleType = "combined", quantityKg,
          pricePerLitre = 0, fatPct, snfPct, notes, clientUuid } = payload ?? {};

  if (!saleDate) throw new HttpError(400, "saleDate required");
  if (!SALE_TYPES.has(saleType)) throw new HttpError(400, "Invalid sale_type");
  if (!quantityKg || quantityKg <= 0) throw new HttpError(400, "quantityKg must be > 0");
  if (pricePerLitre < 0) throw new HttpError(400, "pricePerLitre must be >= 0");

  if (clientUuid) {
    const dup = await sql`
      select id from dairy_milk_sales
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into dairy_milk_sales
      (space_id, sale_date, buyer, sale_type, quantity_kg, price_per_litre,
       fat_pct, snf_pct, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${saleDate}, ${buyer ?? null}, ${saleType},
      ${quantityKg}, ${pricePerLitre}, ${fatPct ?? null}, ${snfPct ?? null},
      ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.sale.add",
    targetType: "dairy_milk_sales", targetId: rows[0].id,
    meta: { saleDate, quantityKg, pricePerLitre },
  });

  return rows[0];
}

export async function deleteSale(sql, membership, actorUserId, payload) {
  const { saleId } = payload ?? {};
  if (!saleId) throw new HttpError(400, "saleId required");

  const rows = await sql`
    select * from dairy_milk_sales where id = ${saleId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Sale not found");
  requireScope(rows[0], membership);

  await sql`update dairy_milk_sales set deleted_at = now() where id = ${saleId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.sale.delete",
    targetType: "dairy_milk_sales", targetId: saleId,
  });

  return { deleted: true };
}

/* ── costs ────────────────────────────────────────────────────────────────── */

export async function listCosts(sql, membership, payload = {}) {
  const { fromDate, toDate, category, limit = 60 } = payload;
  const fromClause = fromDate  ? sql`and cost_date >= ${fromDate}` : sql``;
  const toClause   = toDate    ? sql`and cost_date <= ${toDate}`   : sql``;
  const catClause  = category  ? sql`and category = ${category}`  : sql``;

  return sql`
    select * from dairy_costs
    where space_id = ${membership.space_id} and deleted_at is null
      ${fromClause} ${toClause} ${catClause}
    order by cost_date desc
    limit ${limit}
  `;
}

export async function addCost(sql, membership, actorUserId, payload) {
  const { costDate, category, description, quantity, unit, unitCost,
          amount, notes, clientUuid } = payload ?? {};

  if (!costDate) throw new HttpError(400, "costDate required");
  if (!COST_CATEGORIES.has(category)) throw new HttpError(400, "Invalid category");
  if (!description?.trim()) throw new HttpError(400, "description required");
  if (!amount || amount <= 0) throw new HttpError(400, "amount must be > 0");

  if (clientUuid) {
    const dup = await sql`
      select id from dairy_costs
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into dairy_costs
      (space_id, cost_date, category, description, quantity, unit,
       unit_cost, amount, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${costDate}, ${category}, ${description.trim()},
      ${quantity ?? null}, ${unit ?? null}, ${unitCost ?? null},
      ${amount}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.cost.add",
    targetType: "dairy_costs", targetId: rows[0].id,
    meta: { costDate, category, amount },
  });

  return rows[0];
}

export async function deleteCost(sql, membership, actorUserId, payload) {
  const { costId } = payload ?? {};
  if (!costId) throw new HttpError(400, "costId required");

  const rows = await sql`
    select * from dairy_costs where id = ${costId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Cost not found");
  requireScope(rows[0], membership);

  await sql`update dairy_costs set deleted_at = now() where id = ${costId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.cost.delete",
    targetType: "dairy_costs", targetId: costId,
  });

  return { deleted: true };
}

/* ── finance summary ──────────────────────────────────────────────────────── */

export async function financeSummary(sql, membership) {
  const spaceId = membership.space_id;
  const monthStart = new Date().toISOString().slice(0, 8) + "01";
  const today = new Date().toISOString().slice(0, 10);

  return sql.begin(async (tx) => {
    const [salesRows, costRows, milkRows] = await Promise.all([
      tx`
        select
          coalesce(sum(quantity_kg), 0)     as total_quantity_kg,
          coalesce(sum(amount), 0)          as total_revenue
        from dairy_milk_sales
        where space_id = ${spaceId} and deleted_at is null
          and sale_date >= ${monthStart} and sale_date <= ${today}
      `,
      tx`
        select
          category,
          coalesce(sum(amount), 0) as total
        from dairy_costs
        where space_id = ${spaceId} and deleted_at is null
          and cost_date >= ${monthStart} and cost_date <= ${today}
        group by category
        order by total desc
      `,
      tx`
        select coalesce(sum(total_yield_kg), 0) as kg
        from dairy_milk_records
        where space_id = ${spaceId} and deleted_at is null
          and record_date >= ${monthStart} and record_date <= ${today}
      `,
    ]);

    const totalRevenue = parseFloat(salesRows[0].total_revenue);
    const costBreakdown = costRows.map(r => ({
      category: r.category,
      total: parseFloat(r.total),
    }));
    const totalCosts = costBreakdown.reduce((s, r) => s + r.total, 0);

    return {
      period: { from: monthStart, to: today },
      total_milk_sold_kg: parseFloat(salesRows[0].total_quantity_kg),
      total_revenue: totalRevenue,
      total_costs: totalCosts,
      net_profit: totalRevenue - totalCosts,
      cost_breakdown: costBreakdown,
      month_milk_produced_kg: parseFloat(milkRows[0].kg),
    };
  });
}
