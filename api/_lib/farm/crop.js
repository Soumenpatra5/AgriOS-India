/* Crop / Field module — field-centric model.
 *
 * Each farm_field is a plot with a crop cycle. Activities (irrigation, spray,
 * weeding) hang off field_id. Finance (costs/sales) is space-scoped.
 *
 * Field statuses:  fallow | sowing | growing | ready | harvesting | inactive
 * Terminal:        inactive — writes blocked with 409 */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";

const TERMINAL = new Set(["inactive"]);
const FIELD_STATUS = ["fallow","sowing","growing","ready","harvesting","inactive"];

export function assertFieldWritable(field) {
  if (TERMINAL.has(field.current_status)) {
    throw new HttpError(409, `Field is inactive and cannot be modified`);
  }
}

export async function loadField(sql, membership, fieldId) {
  if (!fieldId) throw new HttpError(400, "fieldId required");
  const rows = await sql`
    select * from farm_fields
    where id = ${fieldId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Field not found");
  requireScope(rows[0], membership);
  return rows[0];
}

/* ── fields ───────────────────────────────────────────────────────────────── */

export async function listFields(sql, membership, payload = {}) {
  const { includeInactive = false } = payload;
  const statusFilter = includeInactive ? sql`true` : sql`current_status != 'inactive'`;

  return sql`
    select f.*,
      (
        select sowing_date from field_sowing s
        where s.field_id = f.id and s.deleted_at is null
        order by sowing_date desc limit 1
      ) as last_sowing_date,
      (
        select crop from field_sowing s
        where s.field_id = f.id and s.deleted_at is null
        order by sowing_date desc limit 1
      ) as last_sowing_crop,
      (
        select harvest_date from field_harvests h
        where h.field_id = f.id and h.deleted_at is null
        order by harvest_date desc limit 1
      ) as last_harvest_date,
      coalesce((
        select sum(quantity) from field_harvests h
        where h.field_id = f.id and h.deleted_at is null
          and extract(year from harvest_date) = extract(year from now())
      ), 0) as year_harvest_qty
    from farm_fields f
    where f.space_id = ${membership.space_id}
      and f.deleted_at is null
      and ${statusFilter}
    order by f.name asc
  `;
}

export async function getField(sql, membership, payload) {
  const field = await loadField(sql, membership, payload?.fieldId);

  const [lastSowing, lastHarvest] = await Promise.all([
    sql`
      select * from field_sowing
      where field_id = ${field.id} and deleted_at is null
      order by sowing_date desc limit 1
    `,
    sql`
      select * from field_harvests
      where field_id = ${field.id} and deleted_at is null
      order by harvest_date desc limit 1
    `,
  ]);

  return {
    ...field,
    last_sowing:  lastSowing[0]  ?? null,
    last_harvest: lastHarvest[0] ?? null,
  };
}

export async function createField(sql, membership, actorUserId, payload) {
  const { name, area, areaUnit = "acres", cropType = "other", currentCrop,
          season, soilType, irrigationType, notes, clientUuid } = payload ?? {};

  if (!name?.trim()) throw new HttpError(400, "name required");

  if (clientUuid) {
    const dup = await sql`
      select id from farm_fields
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into farm_fields
      (space_id, name, area, area_unit, crop_type, current_crop,
       season, soil_type, irrigation_type, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${name.trim()}, ${area ?? null}, ${areaUnit},
      ${cropType}, ${currentCrop ?? null}, ${season ?? null},
      ${soilType ?? null}, ${irrigationType ?? null}, ${notes ?? null},
      ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "crop.fields.create",
    targetType: "farm_fields", targetId: rows[0].id,
    meta: { name, cropType },
  });

  return rows[0];
}

export async function updateField(sql, membership, actorUserId, payload) {
  const { fieldId, name, area, areaUnit, cropType, currentCrop,
          season, soilType, irrigationType, notes } = payload ?? {};

  const field = await loadField(sql, membership, fieldId);
  assertFieldWritable(field);

  const rows = await sql`
    update farm_fields set
      name            = ${name            !== undefined ? name.trim()     : field.name},
      area            = ${area            !== undefined ? area             : field.area},
      area_unit       = ${areaUnit        !== undefined ? areaUnit        : field.area_unit},
      crop_type       = ${cropType        !== undefined ? cropType        : field.crop_type},
      current_crop    = ${currentCrop     !== undefined ? currentCrop     : field.current_crop},
      season          = ${season          !== undefined ? season          : field.season},
      soil_type       = ${soilType        !== undefined ? soilType        : field.soil_type},
      irrigation_type = ${irrigationType  !== undefined ? irrigationType  : field.irrigation_type},
      notes           = ${notes           !== undefined ? notes           : field.notes},
      updated_at      = now()
    where id = ${fieldId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "crop.fields.update",
    targetType: "farm_fields", targetId: fieldId,
    meta: { name },
  });

  return rows[0];
}

export async function setFieldStatus(sql, membership, actorUserId, payload) {
  const { fieldId, status } = payload ?? {};
  if (!FIELD_STATUS.includes(status))
    throw new HttpError(400, `status must be one of: ${FIELD_STATUS.join(", ")}`);

  await loadField(sql, membership, fieldId);

  const rows = await sql`
    update farm_fields set
      current_status = ${status}, updated_at = now()
    where id = ${fieldId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "crop.fields.setStatus",
    targetType: "farm_fields", targetId: fieldId,
    meta: { status },
  });

  return rows[0];
}

export async function fieldMetrics(sql, membership) {
  const rows = await sql`
    select
      count(*) filter (where current_status not in ('inactive'))::int as active_fields,
      count(*) filter (where current_status = 'growing')::int          as growing_count,
      count(*) filter (where current_status = 'ready')::int            as ready_count,
      count(*) filter (where current_status = 'fallow')::int           as fallow_count,
      coalesce(sum(area) filter (where current_status not in ('inactive')), 0)
                                                                        as total_area,
      (
        select coalesce(sum(quantity), 0)
        from field_harvests
        where space_id = ${membership.space_id}
          and deleted_at is null
          and extract(year from harvest_date) = extract(year from now())
      ) as year_harvest_qty
    from farm_fields
    where space_id = ${membership.space_id} and deleted_at is null
  `;
  return rows[0];
}

export async function fieldHistory(sql, membership, payload) {
  const field = await loadField(sql, membership, payload?.fieldId);
  const { limit = 60 } = payload ?? {};

  const [sowing, activities, harvests] = await Promise.all([
    sql`
      select *, 'sowing' as event_kind, sowing_date as event_date
      from field_sowing
      where field_id = ${field.id} and deleted_at is null
    `,
    sql`
      select *, 'activity' as event_kind, activity_date as event_date
      from field_activities
      where field_id = ${field.id} and deleted_at is null
    `,
    sql`
      select *, 'harvest' as event_kind, harvest_date as event_date
      from field_harvests
      where field_id = ${field.id} and deleted_at is null
    `,
  ]);

  const all = [...sowing, ...activities, ...harvests]
    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))
    .slice(0, limit);

  return { field, history: all };
}

/* ── sowing ───────────────────────────────────────────────────────────────── */

export async function listSowing(sql, membership, payload = {}) {
  const { fieldId, limit = 20 } = payload;
  const fieldFilter = fieldId ? sql`and field_id = ${fieldId}` : sql``;
  return sql`
    select * from field_sowing
    where space_id = ${membership.space_id} and deleted_at is null ${fieldFilter}
    order by sowing_date desc limit ${Math.min(Number(limit), 100)}
  `;
}

export async function addSowing(sql, membership, actorUserId, payload) {
  const { fieldId, sowingDate, crop, variety, seedKg,
          method, expectedHarvestDate, notes, clientUuid } = payload ?? {};

  if (!fieldId) throw new HttpError(400, "fieldId required");
  if (!sowingDate) throw new HttpError(400, "sowingDate required");
  if (!crop?.trim()) throw new HttpError(400, "crop required");

  const field = await loadField(sql, membership, fieldId);
  assertFieldWritable(field);

  if (clientUuid) {
    const dup = await sql`select id from field_sowing where space_id = ${membership.space_id} and client_uuid = ${clientUuid}`;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into field_sowing
      (space_id, field_id, sowing_date, crop, variety, seed_kg,
       method, expected_harvest_date, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${fieldId}, ${sowingDate}, ${crop.trim()},
      ${variety ?? null}, ${seedKg ?? null}, ${method ?? null},
      ${expectedHarvestDate ?? null}, ${notes ?? null},
      ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "crop.sowing.add",
    targetType: "field_sowing", targetId: rows[0].id,
    meta: { fieldId, sowingDate, crop },
  });

  return rows[0];
}

export async function deleteSowing(sql, membership, actorUserId, payload) {
  const { sowingId } = payload ?? {};
  if (!sowingId) throw new HttpError(400, "sowingId required");
  const rows = await sql`select * from field_sowing where id = ${sowingId} and space_id = ${membership.space_id} and deleted_at is null`;
  if (!rows.length) throw new HttpError(404, "Sowing record not found");
  await sql`update field_sowing set deleted_at = now() where id = ${sowingId}`;
  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "crop.sowing.delete",
    targetType: "field_sowing", targetId: sowingId, meta: {},
  });
  return { ok: true };
}

/* ── activities ───────────────────────────────────────────────────────────── */

export async function listActivities(sql, membership, payload = {}) {
  const { fieldId, limit = 30 } = payload;
  const fieldFilter = fieldId ? sql`and field_id = ${fieldId}` : sql``;
  return sql`
    select * from field_activities
    where space_id = ${membership.space_id} and deleted_at is null ${fieldFilter}
    order by activity_date desc limit ${Math.min(Number(limit), 100)}
  `;
}

export async function addActivity(sql, membership, actorUserId, payload) {
  const { fieldId, activityDate, activityType = "other",
          description, quantity, unit, cost, notes, clientUuid } = payload ?? {};

  if (!fieldId) throw new HttpError(400, "fieldId required");
  if (!activityDate) throw new HttpError(400, "activityDate required");

  const field = await loadField(sql, membership, fieldId);
  assertFieldWritable(field);

  if (clientUuid) {
    const dup = await sql`select id from field_activities where space_id = ${membership.space_id} and client_uuid = ${clientUuid}`;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into field_activities
      (space_id, field_id, activity_date, activity_type, description,
       quantity, unit, cost, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${fieldId}, ${activityDate}, ${activityType},
      ${description ?? null}, ${quantity ?? null}, ${unit ?? null},
      ${cost ?? null}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "crop.activities.add",
    targetType: "field_activities", targetId: rows[0].id,
    meta: { fieldId, activityDate, activityType },
  });

  return rows[0];
}

export async function deleteActivity(sql, membership, actorUserId, payload) {
  const { activityId } = payload ?? {};
  if (!activityId) throw new HttpError(400, "activityId required");
  const rows = await sql`select * from field_activities where id = ${activityId} and space_id = ${membership.space_id} and deleted_at is null`;
  if (!rows.length) throw new HttpError(404, "Activity not found");
  await sql`update field_activities set deleted_at = now() where id = ${activityId}`;
  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "crop.activities.delete",
    targetType: "field_activities", targetId: activityId, meta: {},
  });
  return { ok: true };
}

/* ── harvests ─────────────────────────────────────────────────────────────── */

export async function listHarvests(sql, membership, payload = {}) {
  const { fieldId, limit = 20 } = payload;
  const fieldFilter = fieldId ? sql`and field_id = ${fieldId}` : sql``;
  return sql`
    select * from field_harvests
    where space_id = ${membership.space_id} and deleted_at is null ${fieldFilter}
    order by harvest_date desc limit ${Math.min(Number(limit), 100)}
  `;
}

export async function addHarvest(sql, membership, actorUserId, payload) {
  const { fieldId, harvestDate, crop, quantity, unit = "kg",
          qualityGrade, notes, clientUuid } = payload ?? {};

  if (!fieldId) throw new HttpError(400, "fieldId required");
  if (!harvestDate) throw new HttpError(400, "harvestDate required");
  if (!crop?.trim()) throw new HttpError(400, "crop required");
  if (!quantity || Number(quantity) <= 0) throw new HttpError(400, "quantity must be > 0");

  const field = await loadField(sql, membership, fieldId);
  assertFieldWritable(field);

  if (clientUuid) {
    const dup = await sql`select id from field_harvests where space_id = ${membership.space_id} and client_uuid = ${clientUuid}`;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into field_harvests
      (space_id, field_id, harvest_date, crop, quantity, unit, quality_grade, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${fieldId}, ${harvestDate}, ${crop.trim()},
      ${quantity}, ${unit}, ${qualityGrade ?? null}, ${notes ?? null},
      ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "crop.harvests.add",
    targetType: "field_harvests", targetId: rows[0].id,
    meta: { fieldId, harvestDate, crop, quantity },
  });

  return rows[0];
}

export async function deleteHarvest(sql, membership, actorUserId, payload) {
  const { harvestId } = payload ?? {};
  if (!harvestId) throw new HttpError(400, "harvestId required");
  const rows = await sql`select * from field_harvests where id = ${harvestId} and space_id = ${membership.space_id} and deleted_at is null`;
  if (!rows.length) throw new HttpError(404, "Harvest not found");
  await sql`update field_harvests set deleted_at = now() where id = ${harvestId}`;
  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "crop.harvests.delete",
    targetType: "field_harvests", targetId: harvestId, meta: {},
  });
  return { ok: true };
}
