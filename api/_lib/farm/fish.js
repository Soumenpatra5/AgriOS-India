/* Fish / Aquaculture — P1: pond-centric model.
 *
 * Fish farming is pond-centric: each pond holds a batch from stocking to
 * harvest. Individual fish tracking is impractical; the pond is the unit.
 *
 * Pond types:  earthen | cement | tank | cage | other
 * Culture:     monoculture | polyculture | composite
 * Statuses:    active (running) | harvested | inactive
 * Terminal:    harvested | inactive — writes blocked with 409 */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";

/* ── helpers ──────────────────────────────────────────────────────────────── */

const TERMINAL = new Set(["harvested", "inactive"]);

export function assertPondWritable(pond) {
  if (TERMINAL.has(pond.current_status)) {
    throw new HttpError(409, `Pond is ${pond.current_status} and cannot be modified`);
  }
}

export async function loadPond(sql, membership, pondId) {
  if (!pondId) throw new HttpError(400, "pondId required");
  const rows = await sql`
    select * from fish_ponds
    where id = ${pondId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Pond not found");
  requireScope(rows[0], membership);
  return rows[0];
}

/* ── ponds ────────────────────────────────────────────────────────────────── */

export async function listPonds(sql, membership, payload = {}) {
  const { includeTerminal = false } = payload;
  const activeOnly = includeTerminal ? sql`true` : sql`current_status = 'active'`;

  return sql`
    select p.*,
      coalesce((
        select sum(m.count)::int
        from fish_mortality_records m
        where m.pond_id = p.id and m.deleted_at is null
      ), 0) as total_mortality,
      (
        select event_date
        from fish_water_quality w
        where w.pond_id = p.id and w.deleted_at is null
        order by event_date desc limit 1
      ) as last_water_check
    from fish_ponds p
    where p.space_id = ${membership.space_id}
      and p.deleted_at is null
      and ${activeOnly}
    order by p.name asc
  `;
}

export async function getPond(sql, membership, payload) {
  const pond = await loadPond(sql, membership, payload?.pondId);

  const [lastWater, lastFeed, lastHarvest] = await Promise.all([
    sql`
      select * from fish_water_quality
      where pond_id = ${pond.id} and deleted_at is null
      order by event_date desc limit 1
    `,
    sql`
      select * from fish_feed_records
      where pond_id = ${pond.id} and deleted_at is null
      order by feed_date desc limit 1
    `,
    sql`
      select * from fish_harvest_records
      where pond_id = ${pond.id} and deleted_at is null
      order by harvest_date desc limit 1
    `,
  ]);

  return {
    ...pond,
    last_water_quality: lastWater[0] ?? null,
    last_feed: lastFeed[0] ?? null,
    last_harvest: lastHarvest[0] ?? null,
  };
}

export async function createPond(sql, membership, actorUserId, payload) {
  const { name, pondType = "earthen", cultureType = "polyculture", species,
          areaSqm, depthM, stockingDate, stockingCount, stockingSizeCm,
          currentStatus = "active", notes, clientUuid } = payload ?? {};

  if (!name?.trim()) throw new HttpError(400, "name required");
  if (!["earthen","cement","tank","cage","other"].includes(pondType))
    throw new HttpError(400, "pondType must be earthen, cement, tank, cage, or other");
  if (!["monoculture","polyculture","composite"].includes(cultureType))
    throw new HttpError(400, "cultureType must be monoculture, polyculture, or composite");
  if (currentStatus !== "active")
    throw new HttpError(400, "New ponds must start as active");

  if (clientUuid) {
    const existing = await sql`
      select id from fish_ponds
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (existing.length) return existing[0];
  }

  const rows = await sql`
    insert into fish_ponds
      (space_id, name, pond_type, culture_type, species,
       area_sqm, depth_m, stocking_date, stocking_count, stocking_size_cm,
       current_status, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${name.trim()}, ${pondType}, ${cultureType},
      ${species ?? null}, ${areaSqm ?? null}, ${depthM ?? null},
      ${stockingDate ?? null}, ${stockingCount ?? null}, ${stockingSizeCm ?? null},
      ${currentStatus}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.pond.create",
    targetType: "fish_ponds", targetId: rows[0].id,
    meta: { name, pondType, cultureType },
  });

  return rows[0];
}

export async function updatePond(sql, membership, actorUserId, payload) {
  const { pondId, name, pondType, cultureType, species,
          areaSqm, depthM, stockingDate, stockingCount, stockingSizeCm, notes } = payload ?? {};

  const pond = await loadPond(sql, membership, pondId);
  assertPondWritable(pond);

  if (pondType !== undefined &&
      !["earthen","cement","tank","cage","other"].includes(pondType))
    throw new HttpError(400, "Invalid pondType");
  if (cultureType !== undefined &&
      !["monoculture","polyculture","composite"].includes(cultureType))
    throw new HttpError(400, "Invalid cultureType");

  const updated = await sql`
    update fish_ponds set
      name             = ${name           !== undefined ? name.trim()    : pond.name},
      pond_type        = ${pondType        !== undefined ? pondType       : pond.pond_type},
      culture_type     = ${cultureType     !== undefined ? cultureType    : pond.culture_type},
      species          = ${species         !== undefined ? species        : pond.species},
      area_sqm         = ${areaSqm         !== undefined ? areaSqm       : pond.area_sqm},
      depth_m          = ${depthM          !== undefined ? depthM        : pond.depth_m},
      stocking_date    = ${stockingDate    !== undefined ? stockingDate   : pond.stocking_date},
      stocking_count   = ${stockingCount   !== undefined ? stockingCount  : pond.stocking_count},
      stocking_size_cm = ${stockingSizeCm  !== undefined ? stockingSizeCm : pond.stocking_size_cm},
      notes            = ${notes           !== undefined ? notes          : pond.notes}
    where id = ${pondId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.pond.update",
    targetType: "fish_ponds", targetId: pondId,
    meta: payload,
  });

  return updated[0];
}

export async function setPondStatus(sql, membership, actorUserId, payload) {
  const { pondId, status } = payload ?? {};
  const valid = ["active", "harvested", "inactive"];
  if (!valid.includes(status)) throw new HttpError(400, "Invalid status");

  const pond = await loadPond(sql, membership, pondId);
  if (TERMINAL.has(pond.current_status)) {
    throw new HttpError(409, `Pond is already ${pond.current_status}`);
  }

  const updated = await sql`
    update fish_ponds set current_status = ${status}
    where id = ${pondId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "fish.pond.status",
    targetType: "fish_ponds", targetId: pondId,
    meta: { from: pond.current_status, to: status },
  });

  return updated[0];
}

/* ── pond metrics ─────────────────────────────────────────────────────────── */

export async function pondMetrics(sql, membership) {
  const spaceId = membership.space_id;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const sevenDaysAgo  = new Date(Date.now() -  7 * 86400000).toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

  const [pondStats, monthFeedRows, monthMortRows, harvestDueRows, waterOverdueRows] =
    await Promise.all([
      sql`
        select count(*)::int as total_ponds,
               coalesce(sum(stocking_count)::int, 0) as total_stocked
        from fish_ponds
        where space_id = ${spaceId}
          and current_status = 'active'
          and deleted_at is null
      `,
      sql`
        select coalesce(sum(quantity_kg), 0) as total_kg
        from fish_feed_records
        where space_id = ${spaceId}
          and feed_date >= ${monthStart}
          and deleted_at is null
      `,
      sql`
        select coalesce(sum(count)::int, 0) as total
        from fish_mortality_records
        where space_id = ${spaceId}
          and event_date >= ${monthStart}
          and deleted_at is null
      `,
      sql`
        select count(*)::int as count
        from fish_ponds
        where space_id = ${spaceId}
          and current_status = 'active'
          and deleted_at is null
          and stocking_date is not null
          and stocking_date <= ${ninetyDaysAgo}
      `,
      sql`
        select count(*)::int as count
        from fish_ponds p
        where p.space_id = ${spaceId}
          and p.current_status = 'active'
          and p.deleted_at is null
          and not exists (
            select 1 from fish_water_quality w
            where w.pond_id = p.id
              and w.event_date >= ${sevenDaysAgo}
              and w.deleted_at is null
          )
      `,
    ]);

  return {
    total_ponds:        pondStats[0].total_ponds,
    total_stocked:      pondStats[0].total_stocked,
    month_feed_kg:      parseFloat(monthFeedRows[0].total_kg),
    month_mortality:    monthMortRows[0].total,
    harvest_due_count:  harvestDueRows[0].count,
    water_check_overdue: waterOverdueRows[0].count,
  };
}

/* ── pond history (unified timeline) ─────────────────────────────────────── */

export async function pondHistory(sql, membership, payload) {
  const pond = await loadPond(sql, membership, payload?.pondId);
  const { limit = 50 } = payload ?? {};

  const [waterRows, feedRows, healthRows, mortalityRows, harvestRows] = await Promise.all([
    sql`
      select id, event_date, 'water_quality' as kind,
             ph, dissolved_oxygen_ppm, temperature_c, ammonia_ppm, notes
      from fish_water_quality
      where pond_id = ${pond.id} and deleted_at is null
      order by event_date desc limit ${limit}
    `,
    sql`
      select id, feed_date as event_date, 'feed_record' as kind,
             feed_type, quantity_kg, notes
      from fish_feed_records
      where pond_id = ${pond.id} and deleted_at is null
      order by feed_date desc limit ${limit}
    `,
    sql`
      select id, event_date, 'health_event' as kind,
             event_type, title, medicine, dose, notes
      from fish_health_events
      where pond_id = ${pond.id} and deleted_at is null
      order by event_date desc limit ${limit}
    `,
    sql`
      select id, event_date, 'mortality_record' as kind,
             count, reason, notes
      from fish_mortality_records
      where pond_id = ${pond.id} and deleted_at is null
      order by event_date desc limit ${limit}
    `,
    sql`
      select id, harvest_date as event_date, 'harvest_record' as kind,
             harvest_type, weight_kg, count, avg_weight_g, price_per_kg, notes
      from fish_harvest_records
      where pond_id = ${pond.id} and deleted_at is null
      order by harvest_date desc limit ${limit}
    `,
  ]);

  const all = [...waterRows, ...feedRows, ...healthRows, ...mortalityRows, ...harvestRows]
    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))
    .slice(0, limit);

  return { pond, history: all };
}
