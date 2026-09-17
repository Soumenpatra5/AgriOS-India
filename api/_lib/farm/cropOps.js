/* Crop Finance — field_costs and field_sales, space-scoped. */

import { HttpError } from "../http.js";
import { audit } from "./gate.js";

const COST_CATS  = new Set(["seeds","fertilizer","pesticide","irrigation","labour","equipment","transport","other"]);

/* ── costs ────────────────────────────────────────────────────────────────── */

export async function listCosts(sql, membership, payload = {}) {
  const { fromDate, toDate, fieldId, limit = 100 } = payload;
  const dateFilter  = fromDate && toDate ? sql`and cost_date between ${fromDate} and ${toDate}` : sql``;
  const fieldFilter = fieldId ? sql`and field_id = ${fieldId}` : sql``;
  return sql`
    select * from field_costs
    where space_id = ${membership.space_id} and deleted_at is null
      ${dateFilter} ${fieldFilter}
    order by cost_date desc, created_at desc
    limit ${Math.min(Number(limit), 200)}
  `;
}

export async function addCost(sql, membership, actorUserId, payload) {
  const { costDate, category = "other", description, amount,
          fieldId, notes, clientUuid } = payload ?? {};

  if (!costDate) throw new HttpError(400, "costDate required");
  if (!description?.trim()) throw new HttpError(400, "description required");
  if (!amount || Number(amount) <= 0) throw new HttpError(400, "amount must be > 0");
  if (!COST_CATS.has(category))
    throw new HttpError(400, `category must be one of: ${[...COST_CATS].join(", ")}`);

  if (clientUuid) {
    const dup = await sql`select id from field_costs where space_id = ${membership.space_id} and client_uuid = ${clientUuid}`;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into field_costs
      (space_id, field_id, cost_date, category, description, amount, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${fieldId ?? null}, ${costDate}, ${category},
      ${description.trim()}, ${amount}, ${notes ?? null},
      ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "crop.costs.add",
    targetType: "field_costs", targetId: rows[0].id,
    meta: { costDate, category, amount },
  });

  return rows[0];
}

export async function deleteCost(sql, membership, actorUserId, payload) {
  const { costId } = payload ?? {};
  if (!costId) throw new HttpError(400, "costId required");
  const rows = await sql`select * from field_costs where id = ${costId} and space_id = ${membership.space_id} and deleted_at is null`;
  if (!rows.length) throw new HttpError(404, "Cost not found");
  await sql`update field_costs set deleted_at = now() where id = ${costId}`;
  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "crop.costs.delete",
    targetType: "field_costs", targetId: costId, meta: {},
  });
  return { ok: true };
}

/* ── sales ────────────────────────────────────────────────────────────────── */

export async function listSales(sql, membership, payload = {}) {
  const { fromDate, toDate, fieldId, limit = 100 } = payload;
  const dateFilter  = fromDate && toDate ? sql`and sale_date between ${fromDate} and ${toDate}` : sql``;
  const fieldFilter = fieldId ? sql`and field_id = ${fieldId}` : sql``;
  return sql`
    select * from field_sales
    where space_id = ${membership.space_id} and deleted_at is null
      ${dateFilter} ${fieldFilter}
    order by sale_date desc, created_at desc
    limit ${Math.min(Number(limit), 200)}
  `;
}

export async function addSale(sql, membership, actorUserId, payload) {
  const { saleDate, crop, quantity, unit, unitPrice, amount,
          buyer, fieldId, notes, clientUuid } = payload ?? {};

  if (!saleDate) throw new HttpError(400, "saleDate required");
  if (!crop?.trim()) throw new HttpError(400, "crop required");
  if (!amount || Number(amount) <= 0) throw new HttpError(400, "amount must be > 0");

  if (clientUuid) {
    const dup = await sql`select id from field_sales where space_id = ${membership.space_id} and client_uuid = ${clientUuid}`;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into field_sales
      (space_id, field_id, sale_date, crop, quantity, unit, unit_price, amount, buyer, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${fieldId ?? null}, ${saleDate}, ${crop.trim()},
      ${quantity ?? null}, ${unit ?? null}, ${unitPrice ?? null}, ${amount},
      ${buyer ?? null}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "crop.sales.add",
    targetType: "field_sales", targetId: rows[0].id,
    meta: { saleDate, crop, amount },
  });

  return rows[0];
}

export async function deleteSale(sql, membership, actorUserId, payload) {
  const { saleId } = payload ?? {};
  if (!saleId) throw new HttpError(400, "saleId required");
  const rows = await sql`select * from field_sales where id = ${saleId} and space_id = ${membership.space_id} and deleted_at is null`;
  if (!rows.length) throw new HttpError(404, "Sale not found");
  await sql`update field_sales set deleted_at = now() where id = ${saleId}`;
  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "crop.sales.delete",
    targetType: "field_sales", targetId: saleId, meta: {},
  });
  return { ok: true };
}

/* ── finance summary ─────────────────────────────────────────────────────── */

export async function financeSummary(sql, membership, payload = {}) {
  const { fromDate, toDate } = payload;
  if (!fromDate || !toDate) throw new HttpError(400, "fromDate and toDate required");

  const [salesRows, costsRows] = await Promise.all([
    sql`
      select crop, coalesce(sum(amount), 0) as total
      from field_sales
      where space_id = ${membership.space_id} and deleted_at is null
        and sale_date between ${fromDate} and ${toDate}
      group by crop
    `,
    sql`
      select category, coalesce(sum(amount), 0) as total
      from field_costs
      where space_id = ${membership.space_id} and deleted_at is null
        and cost_date between ${fromDate} and ${toDate}
      group by category
    `,
  ]);

  const total_revenue = salesRows.reduce((s, r) => s + Number(r.total), 0);
  const total_costs   = costsRows.reduce((s, r) => s + Number(r.total), 0);

  return {
    total_revenue,
    total_costs,
    net_profit:      total_revenue - total_costs,
    sales_by_crop:   Object.fromEntries(salesRows.map(r => [r.crop, Number(r.total)])),
    cost_breakdown:  Object.fromEntries(costsRows.map(r => [r.category, Number(r.total)])),
  };
}
