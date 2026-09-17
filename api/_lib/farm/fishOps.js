/* Fish / Aquaculture — P1 Operations: water quality, feed, health, mortality,
 * harvest records, sales, costs, finance summary. */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";
import { loadPond, assertPondWritable } from "./fish.js";

const FEED_TYPES    = new Set(["pellet","rice_bran","mustard_cake","groundnut_cake","soybean_meal","kitchen_waste","other"]);
const HEALTH_TYPES  = new Set(["observation","disease","treatment","water_treatment","other"]);
const MORT_REASONS  = new Set(["disease","oxygen_depletion","predation","stress","unknown","other"]);
const SALE_TYPES    = new Set(["fresh_fish","dried_fish","fingerlings","prawn","other"]);
const COST_CATS     = new Set(["fingerlings","feed","chemicals","equipment","labour","electricity","pond_prep","other"]);

/* ── water quality ────────────────────────────────────────────────────────── */

export async function listWater(sql, membership, payload) {
  const pond = await loadPond(sql, membership, payload?.pondId);
  const { limit = 50 } = payload ?? {};
  return sql`
    select * from fish_water_quality
    where pond_id = ${pond.id} and deleted_at is null
    order by event_date desc limit ${limit}
  `;
}

export async function addWater(sql, membership, actorUserId, payload) {
  const { pondId, eventDate, ph, dissolvedOxygenPpm, temperatureC,
          ammoniaPpm, notes, clientUuid } = payload ?? {};

  if (!eventDate) throw new HttpError(400, "eventDate required");

  const pond = await loadPond(sql, membership, pondId);
  assertPondWritable(pond);

  if (clientUuid) {
    const dup = await sql`
      select id from fish_water_quality
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into fish_water_quality
      (space_id, pond_id, event_date, ph, dissolved_oxygen_ppm,
       temperature_c, ammonia_ppm, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${pondId}, ${eventDate},
      ${ph ?? null}, ${dissolvedOxygenPpm ?? null}, ${temperatureC ?? null},
      ${ammoniaPpm ?? null}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.water.add",
    targetType: "fish_water_quality", targetId: rows[0].id,
    meta: { pondId, eventDate },
  });

  return rows[0];
}

export async function deleteWater(sql, membership, actorUserId, payload) {
  const { recordId } = payload ?? {};
  if (!recordId) throw new HttpError(400, "recordId required");

  const rows = await sql`
    select * from fish_water_quality where id = ${recordId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Record not found");
  requireScope(rows[0], membership);

  await sql`update fish_water_quality set deleted_at = now() where id = ${recordId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.water.delete",
    targetType: "fish_water_quality", targetId: recordId,
    meta: {},
  });

  return { deleted: true };
}

/* ── feed records ─────────────────────────────────────────────────────────── */

export async function listFeed(sql, membership, payload) {
  const pond = await loadPond(sql, membership, payload?.pondId);
  const { limit = 50 } = payload ?? {};
  return sql`
    select * from fish_feed_records
    where pond_id = ${pond.id} and deleted_at is null
    order by feed_date desc limit ${limit}
  `;
}

export async function addFeed(sql, membership, actorUserId, payload) {
  const { pondId, feedDate, feedType, quantityKg, notes, clientUuid } = payload ?? {};

  if (!feedDate) throw new HttpError(400, "feedDate required");
  if (!feedType || !FEED_TYPES.has(feedType)) throw new HttpError(400, "Invalid feedType");

  const pond = await loadPond(sql, membership, pondId);
  assertPondWritable(pond);

  if (clientUuid) {
    const dup = await sql`
      select id from fish_feed_records
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into fish_feed_records
      (space_id, pond_id, feed_date, feed_type, quantity_kg, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${pondId}, ${feedDate}, ${feedType},
      ${quantityKg ?? null}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.feed.add",
    targetType: "fish_feed_records", targetId: rows[0].id,
    meta: { pondId, feedDate, feedType, quantityKg },
  });

  return rows[0];
}

export async function deleteFeed(sql, membership, actorUserId, payload) {
  const { feedId } = payload ?? {};
  if (!feedId) throw new HttpError(400, "feedId required");

  const rows = await sql`
    select * from fish_feed_records where id = ${feedId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Record not found");
  requireScope(rows[0], membership);

  await sql`update fish_feed_records set deleted_at = now() where id = ${feedId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.feed.delete",
    targetType: "fish_feed_records", targetId: feedId,
    meta: {},
  });

  return { deleted: true };
}

/* ── health events ────────────────────────────────────────────────────────── */

export async function listHealth(sql, membership, payload) {
  const pond = await loadPond(sql, membership, payload?.pondId);
  const { limit = 50 } = payload ?? {};
  return sql`
    select * from fish_health_events
    where pond_id = ${pond.id} and deleted_at is null
    order by event_date desc limit ${limit}
  `;
}

export async function addHealth(sql, membership, actorUserId, payload) {
  const { pondId, eventDate, eventType, title, medicine, dose, notes, clientUuid } = payload ?? {};

  if (!eventDate) throw new HttpError(400, "eventDate required");
  if (!title?.trim()) throw new HttpError(400, "title required");
  if (!eventType || !HEALTH_TYPES.has(eventType)) throw new HttpError(400, "Invalid eventType");

  const pond = await loadPond(sql, membership, pondId);
  assertPondWritable(pond);

  if (clientUuid) {
    const dup = await sql`
      select id from fish_health_events
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into fish_health_events
      (space_id, pond_id, event_date, event_type, title, medicine,
       dose, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${pondId}, ${eventDate}, ${eventType},
      ${title.trim()}, ${medicine ?? null}, ${dose ?? null},
      ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.health.add",
    targetType: "fish_health_events", targetId: rows[0].id,
    meta: { pondId, eventDate, eventType },
  });

  return rows[0];
}

export async function updateHealth(sql, membership, actorUserId, payload) {
  const { eventId, eventDate, eventType, title, medicine, dose, notes } = payload ?? {};
  if (!eventId) throw new HttpError(400, "eventId required");

  const rows = await sql`
    select * from fish_health_events where id = ${eventId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Event not found");
  requireScope(rows[0], membership);

  const ev = rows[0];
  if (eventType !== undefined && !HEALTH_TYPES.has(eventType))
    throw new HttpError(400, "Invalid eventType");
  if (title !== undefined && !title?.trim()) throw new HttpError(400, "title required");

  const updated = await sql`
    update fish_health_events set
      event_date = ${eventDate !== undefined ? eventDate      : ev.event_date},
      event_type = ${eventType !== undefined ? eventType      : ev.event_type},
      title      = ${title     !== undefined ? title.trim()   : ev.title},
      medicine   = ${medicine  !== undefined ? medicine       : ev.medicine},
      dose       = ${dose      !== undefined ? dose           : ev.dose},
      notes      = ${notes     !== undefined ? notes          : ev.notes}
    where id = ${eventId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.health.update",
    targetType: "fish_health_events", targetId: eventId,
    meta: payload,
  });

  return updated[0];
}

export async function deleteHealth(sql, membership, actorUserId, payload) {
  const { eventId } = payload ?? {};
  if (!eventId) throw new HttpError(400, "eventId required");

  const rows = await sql`
    select * from fish_health_events where id = ${eventId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Event not found");
  requireScope(rows[0], membership);

  await sql`update fish_health_events set deleted_at = now() where id = ${eventId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.health.delete",
    targetType: "fish_health_events", targetId: eventId,
    meta: {},
  });

  return { deleted: true };
}

/* ── mortality records ────────────────────────────────────────────────────── */

export async function listMortality(sql, membership, payload) {
  const pond = await loadPond(sql, membership, payload?.pondId);
  const { limit = 50 } = payload ?? {};
  return sql`
    select * from fish_mortality_records
    where pond_id = ${pond.id} and deleted_at is null
    order by event_date desc limit ${limit}
  `;
}

export async function addMortality(sql, membership, actorUserId, payload) {
  const { pondId, eventDate, count, reason, notes, clientUuid } = payload ?? {};

  if (!eventDate) throw new HttpError(400, "eventDate required");
  if (!count || count <= 0) throw new HttpError(400, "count must be > 0");
  if (reason !== undefined && reason !== null && !MORT_REASONS.has(reason))
    throw new HttpError(400, "Invalid reason");

  const pond = await loadPond(sql, membership, pondId);
  assertPondWritable(pond);

  if (clientUuid) {
    const dup = await sql`
      select id from fish_mortality_records
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into fish_mortality_records
      (space_id, pond_id, event_date, count, reason, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${pondId}, ${eventDate}, ${count},
      ${reason ?? null}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.mortality.add",
    targetType: "fish_mortality_records", targetId: rows[0].id,
    meta: { pondId, eventDate, count, reason },
  });

  return rows[0];
}

export async function deleteMortality(sql, membership, actorUserId, payload) {
  const { recordId } = payload ?? {};
  if (!recordId) throw new HttpError(400, "recordId required");

  const rows = await sql`
    select * from fish_mortality_records where id = ${recordId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Record not found");
  requireScope(rows[0], membership);

  await sql`update fish_mortality_records set deleted_at = now() where id = ${recordId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.mortality.delete",
    targetType: "fish_mortality_records", targetId: recordId,
    meta: {},
  });

  return { deleted: true };
}

/* ── harvest records ──────────────────────────────────────────────────────── */

export async function listHarvest(sql, membership, payload) {
  const pond = await loadPond(sql, membership, payload?.pondId);
  const { limit = 50 } = payload ?? {};
  return sql`
    select * from fish_harvest_records
    where pond_id = ${pond.id} and deleted_at is null
    order by harvest_date desc limit ${limit}
  `;
}

export async function addHarvest(sql, membership, actorUserId, payload) {
  const { pondId, harvestDate, harvestType, weightKg, count,
          avgWeightG, pricePerKg, notes, clientUuid } = payload ?? {};

  if (!harvestDate) throw new HttpError(400, "harvestDate required");
  if (!harvestType || !["partial","full"].includes(harvestType))
    throw new HttpError(400, "harvestType must be partial or full");

  const pond = await loadPond(sql, membership, pondId);
  assertPondWritable(pond);

  if (clientUuid) {
    const dup = await sql`
      select id from fish_harvest_records
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into fish_harvest_records
      (space_id, pond_id, harvest_date, harvest_type, weight_kg,
       count, avg_weight_g, price_per_kg, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${pondId}, ${harvestDate}, ${harvestType},
      ${weightKg ?? null}, ${count ?? null}, ${avgWeightG ?? null},
      ${pricePerKg ?? null}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.harvest.add",
    targetType: "fish_harvest_records", targetId: rows[0].id,
    meta: { pondId, harvestDate, harvestType, weightKg },
  });

  return rows[0];
}

export async function deleteHarvest(sql, membership, actorUserId, payload) {
  const { harvestId } = payload ?? {};
  if (!harvestId) throw new HttpError(400, "harvestId required");

  const rows = await sql`
    select * from fish_harvest_records where id = ${harvestId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Record not found");
  requireScope(rows[0], membership);

  await sql`update fish_harvest_records set deleted_at = now() where id = ${harvestId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.harvest.delete",
    targetType: "fish_harvest_records", targetId: harvestId,
    meta: {},
  });

  return { deleted: true };
}

/* ── sales ────────────────────────────────────────────────────────────────── */

export async function listSales(sql, membership, payload = {}) {
  const { fromDate, toDate, limit = 200 } = payload;
  const fromClause = fromDate ? sql`and sale_date >= ${fromDate}` : sql``;
  const toClause   = toDate   ? sql`and sale_date <= ${toDate}`   : sql``;

  return sql`
    select * from fish_sales
    where space_id = ${membership.space_id} and deleted_at is null
      ${fromClause} ${toClause}
    order by sale_date desc limit ${limit}
  `;
}

export async function addSale(sql, membership, actorUserId, payload) {
  const { saleDate, saleType, species, buyer, weightKg,
          unitPrice, amount, notes, clientUuid } = payload ?? {};

  if (!saleDate) throw new HttpError(400, "saleDate required");
  if (!saleType || !SALE_TYPES.has(saleType)) throw new HttpError(400, "Invalid saleType");
  if (!amount || amount <= 0) throw new HttpError(400, "amount must be > 0");

  if (clientUuid) {
    const dup = await sql`
      select id from fish_sales
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into fish_sales
      (space_id, sale_date, sale_type, species, buyer, weight_kg,
       unit_price, amount, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${saleDate}, ${saleType},
      ${species ?? null}, ${buyer ?? null}, ${weightKg ?? null},
      ${unitPrice ?? null}, ${amount}, ${notes ?? null},
      ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.sales.add",
    targetType: "fish_sales", targetId: rows[0].id,
    meta: { saleDate, saleType, amount },
  });

  return rows[0];
}

export async function deleteSale(sql, membership, actorUserId, payload) {
  const { saleId } = payload ?? {};
  if (!saleId) throw new HttpError(400, "saleId required");

  const rows = await sql`
    select * from fish_sales where id = ${saleId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Sale not found");
  requireScope(rows[0], membership);

  await sql`update fish_sales set deleted_at = now() where id = ${saleId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.sales.delete",
    targetType: "fish_sales", targetId: saleId,
    meta: {},
  });

  return { deleted: true };
}

/* ── costs ────────────────────────────────────────────────────────────────── */

export async function listCosts(sql, membership, payload = {}) {
  const { fromDate, toDate, limit = 200 } = payload;
  const fromClause = fromDate ? sql`and cost_date >= ${fromDate}` : sql``;
  const toClause   = toDate   ? sql`and cost_date <= ${toDate}`   : sql``;

  return sql`
    select * from fish_costs
    where space_id = ${membership.space_id} and deleted_at is null
      ${fromClause} ${toClause}
    order by cost_date desc limit ${limit}
  `;
}

export async function addCost(sql, membership, actorUserId, payload) {
  const { costDate, category, description, amount, notes, clientUuid } = payload ?? {};

  if (!costDate) throw new HttpError(400, "costDate required");
  if (!category || !COST_CATS.has(category)) throw new HttpError(400, "Invalid category");
  if (!description?.trim()) throw new HttpError(400, "description required");
  if (!amount || amount <= 0) throw new HttpError(400, "amount must be > 0");

  if (clientUuid) {
    const dup = await sql`
      select id from fish_costs
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into fish_costs
      (space_id, cost_date, category, description, amount, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${costDate}, ${category}, ${description.trim()},
      ${amount}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.costs.add",
    targetType: "fish_costs", targetId: rows[0].id,
    meta: { costDate, category, amount },
  });

  return rows[0];
}

export async function deleteCost(sql, membership, actorUserId, payload) {
  const { costId } = payload ?? {};
  if (!costId) throw new HttpError(400, "costId required");

  const rows = await sql`
    select * from fish_costs where id = ${costId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Cost not found");
  requireScope(rows[0], membership);

  await sql`update fish_costs set deleted_at = now() where id = ${costId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.costs.delete",
    targetType: "fish_costs", targetId: costId,
    meta: {},
  });

  return { deleted: true };
}

/* ── finance summary ──────────────────────────────────────────────────────── */

export async function financeSummary(sql, membership, payload = {}) {
  const { fromDate, toDate } = payload;
  const spaceId = membership.space_id;
  const fromSale = fromDate ? sql`and sale_date >= ${fromDate}` : sql``;
  const toSale   = toDate   ? sql`and sale_date <= ${toDate}`   : sql``;
  const fromCost = fromDate ? sql`and cost_date >= ${fromDate}` : sql``;
  const toCost   = toDate   ? sql`and cost_date <= ${toDate}`   : sql``;

  const [salesRows, costsRows] = await Promise.all([
    sql`
      select sale_type, sum(amount) as total
      from fish_sales
      where space_id = ${spaceId} and deleted_at is null ${fromSale} ${toSale}
      group by sale_type
    `,
    sql`
      select category, sum(amount) as total
      from fish_costs
      where space_id = ${spaceId} and deleted_at is null ${fromCost} ${toCost}
      group by category
    `,
  ]);

  const salesBreakdown = {};
  let totalRevenue = 0;
  for (const r of salesRows) {
    salesBreakdown[r.sale_type] = parseFloat(r.total);
    totalRevenue += parseFloat(r.total);
  }

  const costBreakdown = {};
  let totalCosts = 0;
  for (const r of costsRows) {
    costBreakdown[r.category] = parseFloat(r.total);
    totalCosts += parseFloat(r.total);
  }

  return {
    period: { fromDate: fromDate ?? null, toDate: toDate ?? null },
    total_revenue: totalRevenue,
    total_costs: totalCosts,
    net_profit: totalRevenue - totalCosts,
    sales_breakdown: salesBreakdown,
    cost_breakdown: costBreakdown,
  };
}
