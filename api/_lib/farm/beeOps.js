/* Bee Finance — Sales & Costs for the beekeeping module.
 *
 * Pattern mirrors fishOps.js: space-scoped, month-range summary. */

import { HttpError } from "../http.js";
import { audit } from "./gate.js";

const PRODUCT_TYPES = new Set(["honey","beeswax","propolis","pollen","royal_jelly","other"]);
const COST_CATS     = new Set(["equipment","feed_supplement","treatment","labour","transport","other"]);

/* ── sales ────────────────────────────────────────────────────────────────── */

export async function listSales(sql, membership, payload = {}) {
  const { fromDate, toDate, limit = 50 } = payload;
  const dateFilter = fromDate && toDate
    ? sql`and sale_date between ${fromDate} and ${toDate}`
    : sql``;

  return sql`
    select * from bee_sales
    where space_id = ${membership.space_id}
      and deleted_at is null
      ${dateFilter}
    order by sale_date desc
    limit ${Math.min(Number(limit), 200)}
  `;
}

export async function addSale(sql, membership, actorUserId, payload) {
  const {
    saleDate, productType = "honey", quantityKg,
    unitPrice, amount, buyer, notes, clientUuid,
  } = payload ?? {};

  if (!saleDate) throw new HttpError(400, "saleDate required");
  if (!amount || Number(amount) <= 0) throw new HttpError(400, "amount must be > 0");
  if (!PRODUCT_TYPES.has(productType))
    throw new HttpError(400, `productType must be one of: ${[...PRODUCT_TYPES].join(", ")}`);

  if (clientUuid) {
    const existing = await sql`
      select id from bee_sales
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (existing.length) return existing[0];
  }

  const rows = await sql`
    insert into bee_sales
      (space_id, sale_date, product_type, quantity_kg, unit_price, amount, buyer, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${saleDate}, ${productType},
      ${quantityKg ?? null}, ${unitPrice ?? null}, ${amount},
      ${buyer ?? null}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "bee.sale.add",
    targetType: "bee_sales", targetId: rows[0].id,
    meta: { saleDate, productType, amount },
  });

  return rows[0];
}

export async function deleteSale(sql, membership, actorUserId, payload) {
  const { saleId } = payload ?? {};
  if (!saleId) throw new HttpError(400, "saleId required");

  const rows = await sql`
    select * from bee_sales
    where id = ${saleId} and space_id = ${membership.space_id} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Sale not found");

  await sql`update bee_sales set deleted_at = now() where id = ${saleId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "bee.sale.delete",
    targetType: "bee_sales", targetId: saleId,
    meta: {},
  });

  return { ok: true };
}

/* ── costs ────────────────────────────────────────────────────────────────── */

export async function listCosts(sql, membership, payload = {}) {
  const { fromDate, toDate, limit = 50 } = payload;
  const dateFilter = fromDate && toDate
    ? sql`and cost_date between ${fromDate} and ${toDate}`
    : sql``;

  return sql`
    select * from bee_costs
    where space_id = ${membership.space_id}
      and deleted_at is null
      ${dateFilter}
    order by cost_date desc
    limit ${Math.min(Number(limit), 200)}
  `;
}

export async function addCost(sql, membership, actorUserId, payload) {
  const { costDate, category = "equipment", description, amount, notes, clientUuid } = payload ?? {};

  if (!costDate) throw new HttpError(400, "costDate required");
  if (!description?.trim()) throw new HttpError(400, "description required");
  if (!amount || Number(amount) <= 0) throw new HttpError(400, "amount must be > 0");
  if (!COST_CATS.has(category))
    throw new HttpError(400, `category must be one of: ${[...COST_CATS].join(", ")}`);

  if (clientUuid) {
    const existing = await sql`
      select id from bee_costs
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (existing.length) return existing[0];
  }

  const rows = await sql`
    insert into bee_costs
      (space_id, cost_date, category, description, amount, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${costDate}, ${category}, ${description.trim()},
      ${amount}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "bee.cost.add",
    targetType: "bee_costs", targetId: rows[0].id,
    meta: { costDate, category, amount },
  });

  return rows[0];
}

export async function deleteCost(sql, membership, actorUserId, payload) {
  const { costId } = payload ?? {};
  if (!costId) throw new HttpError(400, "costId required");

  const rows = await sql`
    select * from bee_costs
    where id = ${costId} and space_id = ${membership.space_id} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Cost not found");

  await sql`update bee_costs set deleted_at = now() where id = ${costId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "bee.cost.delete",
    targetType: "bee_costs", targetId: costId,
    meta: {},
  });

  return { ok: true };
}

/* ── finance summary ─────────────────────────────────────────────────────── */

export async function financeSummary(sql, membership, payload = {}) {
  const { fromDate, toDate } = payload;
  if (!fromDate || !toDate) throw new HttpError(400, "fromDate and toDate required");

  const [salesRows, costsRows] = await Promise.all([
    sql`
      select product_type, coalesce(sum(amount), 0) as total
      from bee_sales
      where space_id = ${membership.space_id}
        and deleted_at is null
        and sale_date between ${fromDate} and ${toDate}
      group by product_type
    `,
    sql`
      select category, coalesce(sum(amount), 0) as total
      from bee_costs
      where space_id = ${membership.space_id}
        and deleted_at is null
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
    sales_breakdown: Object.fromEntries(salesRows.map(r => [r.product_type, Number(r.total)])),
    cost_breakdown:  Object.fromEntries(costsRows.map(r => [r.category, Number(r.total)])),
  };
}
