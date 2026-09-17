/* Dairy — D1 Operations: milk records, reproductive events, health events.
 *
 * Milk records use query-then-update-or-insert (NOT ON CONFLICT) to match
 * the poultry daily-record pattern and avoid the GENERATED column issue
 * with ON CONFLICT DO UPDATE. */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";
import { loadAnimal, assertAnimalWritable } from "./dairy.js";

/* ── milk records ─────────────────────────────────────────────────────────── */

export async function listMilk(sql, membership, payload = {}) {
  const { animalId, fromDate, toDate, limit = 60 } = payload;

  if (animalId) {
    const animal = await loadAnimal(sql, membership, animalId);
    const fromClause = fromDate ? sql`and record_date >= ${fromDate}` : sql``;
    const toClause   = toDate   ? sql`and record_date <= ${toDate}`   : sql``;
    return sql`
      select * from dairy_milk_records
      where animal_id = ${animal.id} and deleted_at is null
        ${fromClause} ${toClause}
      order by record_date desc
      limit ${limit}
    `;
  }

  // Space-wide query with animal name join
  const fromClause = fromDate ? sql`and r.record_date >= ${fromDate}` : sql``;
  const toClause   = toDate   ? sql`and r.record_date <= ${toDate}`   : sql``;
  return sql`
    select r.*, a.name as animal_name, a.tag_id as animal_tag_id
    from dairy_milk_records r
    join dairy_animals a on a.id = r.animal_id
    where r.space_id = ${membership.space_id} and r.deleted_at is null
      ${fromClause} ${toClause}
    order by r.record_date desc, a.name asc
    limit ${limit}
  `;
}

/* Query-then-update-or-insert: one active record per animal per day. */
export async function upsertMilk(sql, membership, actorUserId, payload) {
  const { animalId, recordDate, amYieldKg = 0, pmYieldKg = 0,
          fatPct, snfPct, remarks, clientUuid } = payload ?? {};

  if (!recordDate) throw new HttpError(400, "recordDate required");
  const animal = await loadAnimal(sql, membership, animalId);
  assertAnimalWritable(animal);

  // Client UUID idempotency check
  if (clientUuid) {
    const existing = await sql`
      select id from dairy_milk_records
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (existing.length) return existing[0];
  }

  const existing = await sql`
    select id from dairy_milk_records
    where animal_id = ${animalId} and record_date = ${recordDate} and deleted_at is null
  `;

  let result;
  if (existing.length) {
    result = await sql`
      update dairy_milk_records set
        am_yield_kg = ${amYieldKg},
        pm_yield_kg = ${pmYieldKg},
        fat_pct     = ${fatPct ?? null},
        snf_pct     = ${snfPct ?? null},
        remarks     = ${remarks ?? null}
      where id = ${existing[0].id}
      returning *
    `;
    await audit(sql, {
      spaceId: membership.space_id, actorUserId,
      action: "dairy.milk.update",
      targetType: "dairy_milk_records", targetId: existing[0].id,
      meta: { animalId, recordDate },
    });
  } else {
    result = await sql`
      insert into dairy_milk_records
        (space_id, animal_id, record_date, am_yield_kg, pm_yield_kg,
         fat_pct, snf_pct, remarks, client_uuid, created_by)
      values (
        ${membership.space_id}, ${animalId}, ${recordDate},
        ${amYieldKg}, ${pmYieldKg}, ${fatPct ?? null}, ${snfPct ?? null},
        ${remarks ?? null}, ${clientUuid ?? null}, ${actorUserId}
      )
      returning *
    `;
    await audit(sql, {
      spaceId: membership.space_id, actorUserId,
      action: "dairy.milk.create",
      targetType: "dairy_milk_records", targetId: result[0].id,
      meta: { animalId, recordDate },
    });
  }

  return result[0];
}

export async function deleteMilk(sql, membership, actorUserId, payload) {
  const { recordId } = payload ?? {};
  if (!recordId) throw new HttpError(400, "recordId required");

  const rows = await sql`
    select r.*, a.current_status as animal_status
    from dairy_milk_records r
    join dairy_animals a on a.id = r.animal_id
    where r.id = ${recordId} and r.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Milk record not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  await sql`
    update dairy_milk_records set deleted_at = now() where id = ${recordId}
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.milk.delete",
    targetType: "dairy_milk_records", targetId: recordId,
  });

  return { deleted: true };
}

/* ── reproductive events ──────────────────────────────────────────────────── */

const REPRO_TYPES = new Set([
  "heat_observed", "natural_service", "ai_done", "pregnancy_check",
  "dry_off", "calving", "abortion", "other",
]);
const PREG_RESULTS = new Set(["positive", "negative", "inconclusive"]);

export async function listRepro(sql, membership, payload) {
  const animal = await loadAnimal(sql, membership, payload?.animalId);
  const { limit = 50 } = payload ?? {};
  return sql`
    select * from dairy_reproductive_events
    where animal_id = ${animal.id} and deleted_at is null
    order by event_date desc
    limit ${limit}
  `;
}

export async function addRepro(sql, membership, actorUserId, payload) {
  const { animalId, eventDate, eventType, bullName, semenLot,
          pregnancyResult, calfCount, calfSex, calfAlive, notes, clientUuid } = payload ?? {};

  if (!eventDate) throw new HttpError(400, "eventDate required");
  if (!REPRO_TYPES.has(eventType)) throw new HttpError(400, "Invalid event_type");
  if (pregnancyResult && !PREG_RESULTS.has(pregnancyResult))
    throw new HttpError(400, "Invalid pregnancy_result");

  const animal = await loadAnimal(sql, membership, animalId);
  assertAnimalWritable(animal);

  if (clientUuid) {
    const dup = await sql`
      select id from dairy_reproductive_events
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into dairy_reproductive_events
      (space_id, animal_id, event_date, event_type, bull_name, semen_lot,
       pregnancy_result, calf_count, calf_sex, calf_alive, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${animalId}, ${eventDate}, ${eventType},
      ${bullName ?? null}, ${semenLot ?? null}, ${pregnancyResult ?? null},
      ${calfCount ?? null}, ${calfSex ?? null}, ${calfAlive ?? null},
      ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.repro.add",
    targetType: "dairy_reproductive_events", targetId: rows[0].id,
    meta: { animalId, eventType, eventDate },
  });

  return rows[0];
}

export async function deleteRepro(sql, membership, actorUserId, payload) {
  const { eventId } = payload ?? {};
  if (!eventId) throw new HttpError(400, "eventId required");

  const rows = await sql`
    select e.*, a.current_status as animal_status
    from dairy_reproductive_events e
    join dairy_animals a on a.id = e.animal_id
    where e.id = ${eventId} and e.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Reproductive event not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  await sql`
    update dairy_reproductive_events set deleted_at = now() where id = ${eventId}
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.repro.delete",
    targetType: "dairy_reproductive_events", targetId: eventId,
  });

  return { deleted: true };
}

export async function updateRepro(sql, membership, actorUserId, payload) {
  const { eventId, eventDate, eventType, bullName, semenLot,
          pregnancyResult, calfCount, calfSex, calfAlive, notes } = payload ?? {};
  if (!eventId) throw new HttpError(400, "eventId required");
  if (eventType !== undefined && !REPRO_TYPES.has(eventType)) throw new HttpError(400, "Invalid event_type");
  if (pregnancyResult != null && pregnancyResult !== "" && !PREG_RESULTS.has(pregnancyResult))
    throw new HttpError(400, "Invalid pregnancy_result");

  const rows = await sql`
    select e.*, a.current_status as animal_status
    from dairy_reproductive_events e
    join dairy_animals a on a.id = e.animal_id
    where e.id = ${eventId} and e.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Reproductive event not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  const updated = await sql`
    update dairy_reproductive_events set
      event_date       = ${eventDate        !== undefined ? eventDate                     : rows[0].event_date},
      event_type       = ${eventType        !== undefined ? eventType                     : rows[0].event_type},
      bull_name        = ${bullName         !== undefined ? (bullName        || null)     : rows[0].bull_name},
      semen_lot        = ${semenLot         !== undefined ? (semenLot        || null)     : rows[0].semen_lot},
      pregnancy_result = ${pregnancyResult  !== undefined ? (pregnancyResult || null)    : rows[0].pregnancy_result},
      calf_count       = ${calfCount        !== undefined ? (calfCount       ?? null)    : rows[0].calf_count},
      calf_sex         = ${calfSex          !== undefined ? (calfSex         || null)    : rows[0].calf_sex},
      calf_alive       = ${calfAlive        !== undefined ? calfAlive                    : rows[0].calf_alive},
      notes            = ${notes            !== undefined ? (notes           || null)    : rows[0].notes},
      updated_at       = now()
    where id = ${eventId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.repro.update",
    targetType: "dairy_reproductive_events", targetId: eventId,
    meta: { eventType: updated[0].event_type, eventDate: updated[0].event_date },
  });

  return updated[0];
}

/* ── health events ────────────────────────────────────────────────────────── */

const HEALTH_TYPES = new Set([
  "observation", "vaccination", "treatment", "deworming", "vet_visit", "other",
]);

export async function listHealth(sql, membership, payload) {
  const animal = await loadAnimal(sql, membership, payload?.animalId);
  const { limit = 50 } = payload ?? {};
  return sql`
    select * from dairy_health_events
    where animal_id = ${animal.id} and deleted_at is null
    order by event_date desc
    limit ${limit}
  `;
}

export async function addHealth(sql, membership, actorUserId, payload) {
  const { animalId, eventDate, eventType, title, medicine, dose, vetName,
          nextDueDate, isZoonoticConcern = false, notes, clientUuid } = payload ?? {};

  if (!eventDate) throw new HttpError(400, "eventDate required");
  if (!HEALTH_TYPES.has(eventType)) throw new HttpError(400, "Invalid event_type");
  if (!title?.trim()) throw new HttpError(400, "title required");

  const animal = await loadAnimal(sql, membership, animalId);
  assertAnimalWritable(animal);

  if (clientUuid) {
    const dup = await sql`
      select id from dairy_health_events
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into dairy_health_events
      (space_id, animal_id, event_date, event_type, title, medicine, dose,
       vet_name, next_due_date, is_zoonotic_concern, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${animalId}, ${eventDate}, ${eventType},
      ${title.trim()}, ${medicine ?? null}, ${dose ?? null}, ${vetName ?? null},
      ${nextDueDate ?? null}, ${isZoonoticConcern}, ${notes ?? null},
      ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.health.add",
    targetType: "dairy_health_events", targetId: rows[0].id,
    meta: { animalId, eventType, title },
  });

  return rows[0];
}

export async function deleteHealth(sql, membership, actorUserId, payload) {
  const { eventId } = payload ?? {};
  if (!eventId) throw new HttpError(400, "eventId required");

  const rows = await sql`
    select e.*, a.current_status as animal_status
    from dairy_health_events e
    join dairy_animals a on a.id = e.animal_id
    where e.id = ${eventId} and e.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Health event not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  await sql`
    update dairy_health_events set deleted_at = now() where id = ${eventId}
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.health.delete",
    targetType: "dairy_health_events", targetId: eventId,
  });

  return { deleted: true };
}

export async function updateHealth(sql, membership, actorUserId, payload) {
  const { eventId, eventDate, eventType, title, medicine, dose, vetName,
          nextDueDate, isZoonoticConcern, notes } = payload ?? {};
  if (!eventId) throw new HttpError(400, "eventId required");
  if (eventType !== undefined && !HEALTH_TYPES.has(eventType)) throw new HttpError(400, "Invalid event_type");
  if (title !== undefined && !title?.trim()) throw new HttpError(400, "title cannot be empty");

  const rows = await sql`
    select e.*, a.current_status as animal_status
    from dairy_health_events e
    join dairy_animals a on a.id = e.animal_id
    where e.id = ${eventId} and e.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Health event not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  const updated = await sql`
    update dairy_health_events set
      event_date          = ${eventDate          !== undefined ? eventDate                   : rows[0].event_date},
      event_type          = ${eventType          !== undefined ? eventType                   : rows[0].event_type},
      title               = ${title              !== undefined ? title.trim()               : rows[0].title},
      medicine            = ${medicine            !== undefined ? (medicine     || null)     : rows[0].medicine},
      dose                = ${dose                !== undefined ? (dose         || null)     : rows[0].dose},
      vet_name            = ${vetName             !== undefined ? (vetName      || null)     : rows[0].vet_name},
      next_due_date       = ${nextDueDate         !== undefined ? (nextDueDate  || null)     : rows[0].next_due_date},
      is_zoonotic_concern = ${isZoonoticConcern   !== undefined ? isZoonoticConcern          : rows[0].is_zoonotic_concern},
      notes               = ${notes               !== undefined ? (notes        || null)     : rows[0].notes},
      updated_at          = now()
    where id = ${eventId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.health.update",
    targetType: "dairy_health_events", targetId: eventId,
    meta: { eventType: updated[0].event_type, title: updated[0].title },
  });

  return updated[0];
}

/* ── feed records ─────────────────────────────────────────────────────────── */

const FEED_TYPES = new Set([
  "concentrate", "fodder", "silage", "mineral", "other",
]);

export async function listFeed(sql, membership, payload) {
  const animal = await loadAnimal(sql, membership, payload?.animalId);
  const { limit = 50 } = payload ?? {};
  return sql`
    select * from dairy_feed_records
    where animal_id = ${animal.id} and deleted_at is null
    order by feed_date desc
    limit ${limit}
  `;
}

export async function addFeed(sql, membership, actorUserId, payload) {
  const { animalId, feedDate, feedType, quantityKg, notes, clientUuid } = payload ?? {};

  if (!feedDate) throw new HttpError(400, "feedDate required");
  if (!FEED_TYPES.has(feedType)) throw new HttpError(400, "Invalid feed_type");

  const animal = await loadAnimal(sql, membership, animalId);
  assertAnimalWritable(animal);

  if (clientUuid) {
    const dup = await sql`
      select id from dairy_feed_records
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into dairy_feed_records
      (space_id, animal_id, feed_date, feed_type, quantity_kg, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${animalId}, ${feedDate}, ${feedType},
      ${quantityKg ?? null}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.feed.add",
    targetType: "dairy_feed_records", targetId: rows[0].id,
    meta: { animalId, feedType, feedDate },
  });

  return rows[0];
}

export async function deleteFeed(sql, membership, actorUserId, payload) {
  const { feedId } = payload ?? {};
  if (!feedId) throw new HttpError(400, "feedId required");

  const rows = await sql`
    select f.*, a.current_status as animal_status
    from dairy_feed_records f
    join dairy_animals a on a.id = f.animal_id
    where f.id = ${feedId} and f.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Feed record not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  await sql`
    update dairy_feed_records set deleted_at = now() where id = ${feedId}
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.feed.delete",
    targetType: "dairy_feed_records", targetId: feedId,
  });

  return { deleted: true };
}

export async function updateFeed(sql, membership, actorUserId, payload) {
  const { feedId, feedDate, feedType, quantityKg, notes } = payload ?? {};
  if (!feedId) throw new HttpError(400, "feedId required");
  if (feedType !== undefined && !FEED_TYPES.has(feedType)) throw new HttpError(400, "Invalid feed_type");

  const rows = await sql`
    select f.*, a.current_status as animal_status
    from dairy_feed_records f
    join dairy_animals a on a.id = f.animal_id
    where f.id = ${feedId} and f.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Feed record not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  const updated = await sql`
    update dairy_feed_records set
      feed_date   = ${feedDate   !== undefined ? feedDate              : rows[0].feed_date},
      feed_type   = ${feedType   !== undefined ? feedType              : rows[0].feed_type},
      quantity_kg = ${quantityKg !== undefined ? (quantityKg ?? null)  : rows[0].quantity_kg},
      notes       = ${notes      !== undefined ? (notes || null)       : rows[0].notes},
      updated_at  = now()
    where id = ${feedId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.feed.update",
    targetType: "dairy_feed_records", targetId: feedId,
    meta: { feedType: updated[0].feed_type, feedDate: updated[0].feed_date },
  });

  return updated[0];
}
