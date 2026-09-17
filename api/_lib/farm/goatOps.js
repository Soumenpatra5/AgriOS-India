/* Goat — G1 Operations: milk records, weight records, reproductive events,
 * health events, feed records, sales, costs, finance summary.
 *
 * Milk records use query-then-update-or-insert (NOT ON CONFLICT) because of
 * the GENERATED total_yield_kg column. */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";
import { loadAnimal, assertAnimalWritable } from "./goat.js";

/* ── milk records ─────────────────────────────────────────────────────────── */

export async function listMilk(sql, membership, payload = {}) {
  const { animalId, fromDate, toDate, limit = 60 } = payload;

  if (animalId) {
    const animal = await loadAnimal(sql, membership, animalId);
    const fromClause = fromDate ? sql`and record_date >= ${fromDate}` : sql``;
    const toClause   = toDate   ? sql`and record_date <= ${toDate}`   : sql``;
    return sql`
      select * from goat_milk_records
      where animal_id = ${animal.id} and deleted_at is null
        ${fromClause} ${toClause}
      order by record_date desc
      limit ${limit}
    `;
  }

  const fromClause = fromDate ? sql`and r.record_date >= ${fromDate}` : sql``;
  const toClause   = toDate   ? sql`and r.record_date <= ${toDate}`   : sql``;
  return sql`
    select r.*, a.name as animal_name, a.tag_id as animal_tag_id
    from goat_milk_records r
    join goat_animals a on a.id = r.animal_id
    where r.space_id = ${membership.space_id} and r.deleted_at is null
      ${fromClause} ${toClause}
    order by r.record_date desc, a.name asc
    limit ${limit}
  `;
}

export async function upsertMilk(sql, membership, actorUserId, payload) {
  const { animalId, recordDate, amYieldKg = 0, pmYieldKg = 0,
          fatPct, remarks, clientUuid } = payload ?? {};

  if (!recordDate) throw new HttpError(400, "recordDate required");
  const animal = await loadAnimal(sql, membership, animalId);
  assertAnimalWritable(animal);

  if (clientUuid) {
    const existing = await sql`
      select id from goat_milk_records
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (existing.length) return existing[0];
  }

  const existing = await sql`
    select id from goat_milk_records
    where animal_id = ${animalId} and record_date = ${recordDate} and deleted_at is null
  `;

  let result;
  if (existing.length) {
    result = await sql`
      update goat_milk_records set
        am_yield_kg = ${amYieldKg},
        pm_yield_kg = ${pmYieldKg},
        fat_pct     = ${fatPct ?? null},
        remarks     = ${remarks ?? null}
      where id = ${existing[0].id}
      returning *
    `;
    await audit(sql, {
      spaceId: membership.space_id, actorUserId,
      action: "goat.milk.update",
      targetType: "goat_milk_records", targetId: existing[0].id,
      meta: { animalId, recordDate },
    });
  } else {
    result = await sql`
      insert into goat_milk_records
        (space_id, animal_id, record_date, am_yield_kg, pm_yield_kg,
         fat_pct, remarks, client_uuid, created_by)
      values (
        ${membership.space_id}, ${animalId}, ${recordDate},
        ${amYieldKg}, ${pmYieldKg}, ${fatPct ?? null},
        ${remarks ?? null}, ${clientUuid ?? null}, ${actorUserId}
      )
      returning *
    `;
    await audit(sql, {
      spaceId: membership.space_id, actorUserId,
      action: "goat.milk.create",
      targetType: "goat_milk_records", targetId: result[0].id,
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
    from goat_milk_records r
    join goat_animals a on a.id = r.animal_id
    where r.id = ${recordId} and r.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Milk record not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  await sql`update goat_milk_records set deleted_at = now() where id = ${recordId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.milk.delete",
    targetType: "goat_milk_records", targetId: recordId,
  });

  return { deleted: true };
}

/* ── weight records ───────────────────────────────────────────────────────── */

export async function listWeight(sql, membership, payload) {
  const animal = await loadAnimal(sql, membership, payload?.animalId);
  const { limit = 50 } = payload ?? {};
  return sql`
    select * from goat_weight_records
    where animal_id = ${animal.id} and deleted_at is null
    order by weigh_date desc
    limit ${limit}
  `;
}

export async function addWeight(sql, membership, actorUserId, payload) {
  const { animalId, weighDate, weightKg, notes, clientUuid } = payload ?? {};

  if (!weighDate) throw new HttpError(400, "weighDate required");
  if (!weightKg || weightKg <= 0) throw new HttpError(400, "weightKg must be > 0");

  const animal = await loadAnimal(sql, membership, animalId);
  assertAnimalWritable(animal);

  if (clientUuid) {
    const dup = await sql`
      select id from goat_weight_records
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into goat_weight_records
      (space_id, animal_id, weigh_date, weight_kg, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${animalId}, ${weighDate}, ${weightKg},
      ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.weight.add",
    targetType: "goat_weight_records", targetId: rows[0].id,
    meta: { animalId, weighDate, weightKg },
  });

  return rows[0];
}

export async function deleteWeight(sql, membership, actorUserId, payload) {
  const { weightId } = payload ?? {};
  if (!weightId) throw new HttpError(400, "weightId required");

  const rows = await sql`
    select w.*, a.current_status as animal_status
    from goat_weight_records w
    join goat_animals a on a.id = w.animal_id
    where w.id = ${weightId} and w.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Weight record not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  await sql`update goat_weight_records set deleted_at = now() where id = ${weightId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.weight.delete",
    targetType: "goat_weight_records", targetId: weightId,
  });

  return { deleted: true };
}

/* ── reproductive events ──────────────────────────────────────────────────── */

const REPRO_TYPES = new Set([
  "heat_observed", "mating", "pregnancy_check", "kidding",
  "abortion", "weaning", "other",
]);
const PREG_RESULTS = new Set(["positive", "negative", "inconclusive"]);

export async function listRepro(sql, membership, payload) {
  const animal = await loadAnimal(sql, membership, payload?.animalId);
  const { limit = 50 } = payload ?? {};
  return sql`
    select * from goat_reproductive_events
    where animal_id = ${animal.id} and deleted_at is null
    order by event_date desc
    limit ${limit}
  `;
}

export async function addRepro(sql, membership, actorUserId, payload) {
  const { animalId, eventDate, eventType, buckName, pregnancyResult,
          kidCount, kidSex, kidAlive, notes, clientUuid } = payload ?? {};

  if (!eventDate) throw new HttpError(400, "eventDate required");
  if (!REPRO_TYPES.has(eventType)) throw new HttpError(400, "Invalid event_type");
  if (pregnancyResult && !PREG_RESULTS.has(pregnancyResult))
    throw new HttpError(400, "Invalid pregnancy_result");

  const animal = await loadAnimal(sql, membership, animalId);
  assertAnimalWritable(animal);

  if (clientUuid) {
    const dup = await sql`
      select id from goat_reproductive_events
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into goat_reproductive_events
      (space_id, animal_id, event_date, event_type, buck_name,
       pregnancy_result, kid_count, kid_sex, kid_alive, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${animalId}, ${eventDate}, ${eventType},
      ${buckName ?? null}, ${pregnancyResult ?? null},
      ${kidCount ?? null}, ${kidSex ?? null}, ${kidAlive ?? null},
      ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.repro.add",
    targetType: "goat_reproductive_events", targetId: rows[0].id,
    meta: { animalId, eventType, eventDate },
  });

  return rows[0];
}

export async function updateRepro(sql, membership, actorUserId, payload) {
  const { eventId, eventDate, eventType, buckName, pregnancyResult,
          kidCount, kidSex, kidAlive, notes } = payload ?? {};
  if (!eventId) throw new HttpError(400, "eventId required");
  if (eventType !== undefined && !REPRO_TYPES.has(eventType)) throw new HttpError(400, "Invalid event_type");
  if (pregnancyResult != null && pregnancyResult !== "" && !PREG_RESULTS.has(pregnancyResult))
    throw new HttpError(400, "Invalid pregnancy_result");

  const rows = await sql`
    select e.*, a.current_status as animal_status
    from goat_reproductive_events e
    join goat_animals a on a.id = e.animal_id
    where e.id = ${eventId} and e.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Reproductive event not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  const updated = await sql`
    update goat_reproductive_events set
      event_date       = ${eventDate       !== undefined ? eventDate                     : rows[0].event_date},
      event_type       = ${eventType       !== undefined ? eventType                     : rows[0].event_type},
      buck_name        = ${buckName        !== undefined ? (buckName       || null)      : rows[0].buck_name},
      pregnancy_result = ${pregnancyResult !== undefined ? (pregnancyResult || null)    : rows[0].pregnancy_result},
      kid_count        = ${kidCount        !== undefined ? (kidCount       ?? null)      : rows[0].kid_count},
      kid_sex          = ${kidSex          !== undefined ? (kidSex         || null)      : rows[0].kid_sex},
      kid_alive        = ${kidAlive        !== undefined ? kidAlive                      : rows[0].kid_alive},
      notes            = ${notes           !== undefined ? (notes          || null)      : rows[0].notes},
      updated_at       = now()
    where id = ${eventId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.repro.update",
    targetType: "goat_reproductive_events", targetId: eventId,
    meta: { eventType: updated[0].event_type, eventDate: updated[0].event_date },
  });

  return updated[0];
}

export async function deleteRepro(sql, membership, actorUserId, payload) {
  const { eventId } = payload ?? {};
  if (!eventId) throw new HttpError(400, "eventId required");

  const rows = await sql`
    select e.*, a.current_status as animal_status
    from goat_reproductive_events e
    join goat_animals a on a.id = e.animal_id
    where e.id = ${eventId} and e.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Reproductive event not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  await sql`
    update goat_reproductive_events set deleted_at = now() where id = ${eventId}
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.repro.delete",
    targetType: "goat_reproductive_events", targetId: eventId,
  });

  return { deleted: true };
}

/* ── health events ────────────────────────────────────────────────────────── */

const HEALTH_TYPES = new Set([
  "observation", "vaccination", "treatment", "deworming", "vet_visit", "other",
]);

export async function listHealth(sql, membership, payload) {
  const animal = await loadAnimal(sql, membership, payload?.animalId);
  const { limit = 50 } = payload ?? {};
  return sql`
    select * from goat_health_events
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
      select id from goat_health_events
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into goat_health_events
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
    action: "goat.health.add",
    targetType: "goat_health_events", targetId: rows[0].id,
    meta: { animalId, eventType, title },
  });

  return rows[0];
}

export async function updateHealth(sql, membership, actorUserId, payload) {
  const { eventId, eventDate, eventType, title, medicine, dose, vetName,
          nextDueDate, isZoonoticConcern, notes } = payload ?? {};
  if (!eventId) throw new HttpError(400, "eventId required");
  if (eventType !== undefined && !HEALTH_TYPES.has(eventType)) throw new HttpError(400, "Invalid event_type");
  if (title !== undefined && !title?.trim()) throw new HttpError(400, "title cannot be empty");

  const rows = await sql`
    select e.*, a.current_status as animal_status
    from goat_health_events e
    join goat_animals a on a.id = e.animal_id
    where e.id = ${eventId} and e.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Health event not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  const updated = await sql`
    update goat_health_events set
      event_date          = ${eventDate          !== undefined ? eventDate                   : rows[0].event_date},
      event_type          = ${eventType          !== undefined ? eventType                   : rows[0].event_type},
      title               = ${title              !== undefined ? title.trim()               : rows[0].title},
      medicine            = ${medicine           !== undefined ? (medicine     || null)      : rows[0].medicine},
      dose                = ${dose               !== undefined ? (dose         || null)      : rows[0].dose},
      vet_name            = ${vetName            !== undefined ? (vetName      || null)      : rows[0].vet_name},
      next_due_date       = ${nextDueDate        !== undefined ? (nextDueDate  || null)      : rows[0].next_due_date},
      is_zoonotic_concern = ${isZoonoticConcern  !== undefined ? isZoonoticConcern           : rows[0].is_zoonotic_concern},
      notes               = ${notes              !== undefined ? (notes        || null)      : rows[0].notes},
      updated_at          = now()
    where id = ${eventId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.health.update",
    targetType: "goat_health_events", targetId: eventId,
    meta: { eventType: updated[0].event_type, title: updated[0].title },
  });

  return updated[0];
}

export async function deleteHealth(sql, membership, actorUserId, payload) {
  const { eventId } = payload ?? {};
  if (!eventId) throw new HttpError(400, "eventId required");

  const rows = await sql`
    select e.*, a.current_status as animal_status
    from goat_health_events e
    join goat_animals a on a.id = e.animal_id
    where e.id = ${eventId} and e.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Health event not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  await sql`update goat_health_events set deleted_at = now() where id = ${eventId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.health.delete",
    targetType: "goat_health_events", targetId: eventId,
  });

  return { deleted: true };
}

/* ── feed records ─────────────────────────────────────────────────────────── */

const FEED_TYPES = new Set([
  "concentrate", "fodder", "silage", "mineral", "browse", "other",
]);

export async function listFeed(sql, membership, payload) {
  const animal = await loadAnimal(sql, membership, payload?.animalId);
  const { limit = 50 } = payload ?? {};
  return sql`
    select * from goat_feed_records
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
      select id from goat_feed_records
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into goat_feed_records
      (space_id, animal_id, feed_date, feed_type, quantity_kg, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${animalId}, ${feedDate}, ${feedType},
      ${quantityKg ?? null}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.feed.add",
    targetType: "goat_feed_records", targetId: rows[0].id,
    meta: { animalId, feedType, feedDate },
  });

  return rows[0];
}

export async function updateFeed(sql, membership, actorUserId, payload) {
  const { feedId, feedDate, feedType, quantityKg, notes } = payload ?? {};
  if (!feedId) throw new HttpError(400, "feedId required");
  if (feedType !== undefined && !FEED_TYPES.has(feedType)) throw new HttpError(400, "Invalid feed_type");

  const rows = await sql`
    select f.*, a.current_status as animal_status
    from goat_feed_records f
    join goat_animals a on a.id = f.animal_id
    where f.id = ${feedId} and f.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Feed record not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  const updated = await sql`
    update goat_feed_records set
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
    action: "goat.feed.update",
    targetType: "goat_feed_records", targetId: feedId,
    meta: { feedType: updated[0].feed_type, feedDate: updated[0].feed_date },
  });

  return updated[0];
}

export async function deleteFeed(sql, membership, actorUserId, payload) {
  const { feedId } = payload ?? {};
  if (!feedId) throw new HttpError(400, "feedId required");

  const rows = await sql`
    select f.*, a.current_status as animal_status
    from goat_feed_records f
    join goat_animals a on a.id = f.animal_id
    where f.id = ${feedId} and f.deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Feed record not found");
  requireScope(rows[0], membership);
  assertAnimalWritable({ current_status: rows[0].animal_status });

  await sql`update goat_feed_records set deleted_at = now() where id = ${feedId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.feed.delete",
    targetType: "goat_feed_records", targetId: feedId,
  });

  return { deleted: true };
}

/* ── sales ────────────────────────────────────────────────────────────────── */

const SALE_TYPES = new Set(["milk", "animal", "fiber", "other"]);

export async function listSales(sql, membership, payload = {}) {
  const { fromDate, toDate, saleType, limit = 60 } = payload;
  const fromClause = fromDate  ? sql`and sale_date >= ${fromDate}` : sql``;
  const toClause   = toDate    ? sql`and sale_date <= ${toDate}`   : sql``;
  const typeClause = saleType  ? sql`and sale_type = ${saleType}`  : sql``;

  return sql`
    select * from goat_sales
    where space_id = ${membership.space_id} and deleted_at is null
      ${fromClause} ${toClause} ${typeClause}
    order by sale_date desc
    limit ${limit}
  `;
}

export async function addSale(sql, membership, actorUserId, payload) {
  const { saleDate, saleType, buyer, quantity, unit, unitPrice,
          amount, notes, clientUuid } = payload ?? {};

  if (!saleDate) throw new HttpError(400, "saleDate required");
  if (!SALE_TYPES.has(saleType)) throw new HttpError(400, "Invalid sale_type");
  if (!amount || amount <= 0) throw new HttpError(400, "amount must be > 0");

  if (clientUuid) {
    const dup = await sql`
      select id from goat_sales
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into goat_sales
      (space_id, sale_date, sale_type, buyer, quantity, unit,
       unit_price, amount, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${saleDate}, ${saleType}, ${buyer ?? null},
      ${quantity ?? null}, ${unit ?? null}, ${unitPrice ?? null},
      ${amount}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.sale.add",
    targetType: "goat_sales", targetId: rows[0].id,
    meta: { saleDate, saleType, amount },
  });

  return rows[0];
}

export async function deleteSale(sql, membership, actorUserId, payload) {
  const { saleId } = payload ?? {};
  if (!saleId) throw new HttpError(400, "saleId required");

  const rows = await sql`
    select * from goat_sales where id = ${saleId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Sale not found");
  requireScope(rows[0], membership);

  await sql`update goat_sales set deleted_at = now() where id = ${saleId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.sale.delete",
    targetType: "goat_sales", targetId: saleId,
  });

  return { deleted: true };
}

/* ── costs ────────────────────────────────────────────────────────────────── */

const COST_CATEGORIES = new Set([
  "concentrate_feed", "fodder", "medicine", "labour",
  "veterinary", "equipment", "fiber_shearing", "other",
]);

export async function listCosts(sql, membership, payload = {}) {
  const { fromDate, toDate, category, limit = 60 } = payload;
  const fromClause = fromDate  ? sql`and cost_date >= ${fromDate}` : sql``;
  const toClause   = toDate    ? sql`and cost_date <= ${toDate}`   : sql``;
  const catClause  = category  ? sql`and category = ${category}`   : sql``;

  return sql`
    select * from goat_costs
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
      select id from goat_costs
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (dup.length) return dup[0];
  }

  const rows = await sql`
    insert into goat_costs
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
    action: "goat.cost.add",
    targetType: "goat_costs", targetId: rows[0].id,
    meta: { costDate, category, amount },
  });

  return rows[0];
}

export async function deleteCost(sql, membership, actorUserId, payload) {
  const { costId } = payload ?? {};
  if (!costId) throw new HttpError(400, "costId required");

  const rows = await sql`
    select * from goat_costs where id = ${costId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Cost not found");
  requireScope(rows[0], membership);

  await sql`update goat_costs set deleted_at = now() where id = ${costId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.cost.delete",
    targetType: "goat_costs", targetId: costId,
  });

  return { deleted: true };
}

/* ── finance summary ──────────────────────────────────────────────────────── */

export async function financeSummary(sql, membership, payload = {}) {
  const spaceId = membership.space_id;
  const { fromDate, toDate } = payload;
  const monthStart = fromDate ?? (new Date().toISOString().slice(0, 8) + "01");
  const today      = toDate   ?? new Date().toISOString().slice(0, 10);

  return sql.begin(async (tx) => {
    const [salesRows, costRows, milkRows] = await Promise.all([
      tx`
        select
          sale_type,
          coalesce(sum(amount), 0) as total
        from goat_sales
        where space_id = ${spaceId} and deleted_at is null
          and sale_date >= ${monthStart} and sale_date <= ${today}
        group by sale_type
        order by total desc
      `,
      tx`
        select
          category,
          coalesce(sum(amount), 0) as total
        from goat_costs
        where space_id = ${spaceId} and deleted_at is null
          and cost_date >= ${monthStart} and cost_date <= ${today}
        group by category
        order by total desc
      `,
      tx`
        select coalesce(sum(total_yield_kg), 0) as kg
        from goat_milk_records
        where space_id = ${spaceId} and deleted_at is null
          and record_date >= ${monthStart} and record_date <= ${today}
      `,
    ]);

    const salesBreakdown = salesRows.map(r => ({
      sale_type: r.sale_type,
      total: parseFloat(r.total),
    }));
    const totalRevenue = salesBreakdown.reduce((s, r) => s + r.total, 0);

    const costBreakdown = costRows.map(r => ({
      category: r.category,
      total: parseFloat(r.total),
    }));
    const totalCosts = costBreakdown.reduce((s, r) => s + r.total, 0);

    return {
      period: { from: monthStart, to: today },
      total_revenue: totalRevenue,
      total_costs: totalCosts,
      net_profit: totalRevenue - totalCosts,
      sales_breakdown: salesBreakdown,
      cost_breakdown: costBreakdown,
      month_milk_produced_kg: parseFloat(milkRows[0].kg),
    };
  });
}
