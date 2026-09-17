/* Goat / Small Ruminant — G1: individual animals, weight records, herd metrics,
 * animal history.
 *
 * Species: goat | sheep. Sex: male | female | unknown.
 * Terminal statuses (sold/deceased/retired): once set, the animal row is
 * read-only for operational writes. assertAnimalWritable() enforces this. */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";

/* ── helpers ──────────────────────────────────────────────────────────────── */

const TERMINAL = new Set(["sold", "deceased", "retired"]);

export function assertAnimalWritable(animal) {
  if (TERMINAL.has(animal.current_status)) {
    throw new HttpError(409, `Animal is ${animal.current_status} and cannot be modified`);
  }
}

export async function loadAnimal(sql, membership, animalId) {
  if (!animalId) throw new HttpError(400, "animalId required");
  const rows = await sql`
    select * from goat_animals
    where id = ${animalId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Animal not found");
  requireScope(rows[0], membership);
  return rows[0];
}

/* ── animals ──────────────────────────────────────────────────────────────── */

export async function listAnimals(sql, membership, payload = {}) {
  const { statusFilter, includeTerminal = false } = payload;

  const terminalClause = includeTerminal
    ? sql`true`
    : sql`current_status not in ('sold','deceased','retired')`;

  const statusClause = statusFilter
    ? sql`and current_status = ${statusFilter}`
    : sql``;

  return sql`
    select a.*,
      (
        select count(*)::int
        from goat_health_events h
        where h.animal_id = a.id
          and h.deleted_at is null
          and h.next_due_date is not null
          and h.next_due_date < current_date
      ) as overdue_count
    from goat_animals a
    where a.space_id = ${membership.space_id}
      and a.deleted_at is null
      and ${terminalClause}
      ${statusClause}
    order by a.name asc
  `;
}

export async function getAnimal(sql, membership, payload) {
  const animal = await loadAnimal(sql, membership, payload?.animalId);

  const [lastWeight, lastMilk] = await Promise.all([
    sql`
      select * from goat_weight_records
      where animal_id = ${animal.id} and deleted_at is null
      order by weigh_date desc
      limit 1
    `,
    sql`
      select * from goat_milk_records
      where animal_id = ${animal.id} and deleted_at is null
      order by record_date desc
      limit 1
    `,
  ]);

  return {
    ...animal,
    last_weight: lastWeight[0] ?? null,
    last_milk_record: lastMilk[0] ?? null,
  };
}

export async function createAnimal(sql, membership, actorUserId, payload) {
  const { name, species = "goat", sex = "unknown", breed, tagId, dob,
          acquisitionDate, acquisitionSource, currentStatus = "kid",
          notes, clientUuid } = payload ?? {};

  if (!name?.trim()) throw new HttpError(400, "name required");
  if (!["goat", "sheep"].includes(species))
    throw new HttpError(400, "species must be goat or sheep");
  if (!["male", "female", "unknown"].includes(sex))
    throw new HttpError(400, "sex must be male, female, or unknown");
  const validStatuses = ["kid", "grower", "milking", "dry", "breeding"];
  if (!validStatuses.includes(currentStatus))
    throw new HttpError(400, `currentStatus must be one of: ${validStatuses.join(", ")}`);

  if (clientUuid) {
    const existing = await sql`
      select id from goat_animals
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (existing.length) return existing[0];
  }

  const rows = await sql`
    insert into goat_animals
      (space_id, tag_id, name, species, sex, breed, dob, acquisition_date,
       acquisition_source, current_status, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${tagId ?? null}, ${name.trim()}, ${species},
      ${sex}, ${breed ?? null}, ${dob ?? null}, ${acquisitionDate ?? null},
      ${acquisitionSource ?? null}, ${currentStatus}, ${notes ?? null},
      ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.animal.create",
    targetType: "goat_animals", targetId: rows[0].id,
    meta: { name, species, sex },
  });

  return rows[0];
}

export async function updateAnimal(sql, membership, actorUserId, payload) {
  const { animalId, name, species, sex, breed, tagId, dob,
          acquisitionDate, acquisitionSource, notes } = payload ?? {};

  const animal = await loadAnimal(sql, membership, animalId);
  assertAnimalWritable(animal);

  if (species !== undefined && !["goat", "sheep"].includes(species))
    throw new HttpError(400, "species must be goat or sheep");
  if (sex !== undefined && !["male", "female", "unknown"].includes(sex))
    throw new HttpError(400, "sex must be male, female, or unknown");

  const updated = await sql`
    update goat_animals set
      name               = ${name              !== undefined ? name.trim()         : animal.name},
      species            = ${species           !== undefined ? species             : animal.species},
      sex                = ${sex               !== undefined ? sex                 : animal.sex},
      breed              = ${breed             !== undefined ? breed               : animal.breed},
      tag_id             = ${tagId             !== undefined ? tagId               : animal.tag_id},
      dob                = ${dob               !== undefined ? dob                 : animal.dob},
      acquisition_date   = ${acquisitionDate   !== undefined ? acquisitionDate     : animal.acquisition_date},
      acquisition_source = ${acquisitionSource !== undefined ? acquisitionSource   : animal.acquisition_source},
      notes              = ${notes             !== undefined ? notes               : animal.notes}
    where id = ${animalId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.animal.update",
    targetType: "goat_animals", targetId: animalId,
    meta: payload,
  });

  return updated[0];
}

export async function setAnimalStatus(sql, membership, actorUserId, payload) {
  const { animalId, status } = payload ?? {};
  const valid = ["kid", "grower", "milking", "dry", "breeding", "sold", "deceased", "retired"];
  if (!valid.includes(status)) throw new HttpError(400, "Invalid status");

  const animal = await loadAnimal(sql, membership, animalId);

  if (TERMINAL.has(animal.current_status)) {
    throw new HttpError(409, `Animal is already ${animal.current_status}`);
  }

  const updated = await sql`
    update goat_animals set current_status = ${status}
    where id = ${animalId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "goat.animal.status",
    targetType: "goat_animals", targetId: animalId,
    meta: { from: animal.current_status, to: status },
  });

  return updated[0];
}

/* ── herd metrics ─────────────────────────────────────────────────────────── */

export async function herdMetrics(sql, membership) {
  const spaceId = membership.space_id;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const twoWeeksLater = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  const [statusCounts, todayMilk, monthMilk, healthDue, healthOverdue, kiddingDue] = await Promise.all([
    sql`
      select current_status, count(*)::int as count
      from goat_animals
      where space_id = ${spaceId} and deleted_at is null
      group by current_status
    `,
    sql`
      select coalesce(sum(total_yield_kg), 0) as kg
      from goat_milk_records
      where space_id = ${spaceId}
        and record_date = ${today}
        and deleted_at is null
    `,
    sql`
      select coalesce(sum(total_yield_kg), 0) as kg
      from goat_milk_records
      where space_id = ${spaceId}
        and record_date >= ${monthStart}
        and deleted_at is null
    `,
    sql`
      select count(*)::int as count
      from goat_health_events
      where space_id = ${spaceId}
        and next_due_date between ${today} and ${twoWeeksLater}
        and deleted_at is null
    `,
    sql`
      select count(*)::int as count
      from goat_health_events
      where space_id = ${spaceId}
        and next_due_date < ${today}
        and deleted_at is null
    `,
    sql`
      select count(*)::int as count
      from goat_reproductive_events
      where space_id = ${spaceId}
        and event_type = 'pregnancy_check'
        and pregnancy_result = 'positive'
        and deleted_at is null
        and event_date >= ${monthStart}
    `,
  ]);

  const byStatus = {};
  for (const row of statusCounts) byStatus[row.current_status] = row.count;

  return {
    status_counts: byStatus,
    today_milk_kg: parseFloat(todayMilk[0].kg),
    month_milk_kg: parseFloat(monthMilk[0].kg),
    health_due_in_14_days: healthDue[0].count,
    health_overdue_count: healthOverdue[0].count,
    kidding_expected_count: kiddingDue[0].count,
  };
}

/* ── animal history ───────────────────────────────────────────────────────── */

export async function animalHistory(sql, membership, payload) {
  const animal = await loadAnimal(sql, membership, payload?.animalId);
  const { limit = 50 } = payload ?? {};

  const [milkRows, weightRows, reproRows, healthRows, feedRows] = await Promise.all([
    sql`
      select id, record_date as event_date, 'milk_record' as kind,
             total_yield_kg, am_yield_kg, pm_yield_kg, fat_pct, remarks
      from goat_milk_records
      where animal_id = ${animal.id} and deleted_at is null
      order by record_date desc
      limit ${limit}
    `,
    sql`
      select id, weigh_date as event_date, 'weight_record' as kind,
             weight_kg, notes
      from goat_weight_records
      where animal_id = ${animal.id} and deleted_at is null
      order by weigh_date desc
      limit ${limit}
    `,
    sql`
      select id, event_date, 'repro_event' as kind,
             event_type, pregnancy_result, kid_count, kid_sex, kid_alive, notes
      from goat_reproductive_events
      where animal_id = ${animal.id} and deleted_at is null
      order by event_date desc
      limit ${limit}
    `,
    sql`
      select id, event_date, 'health_event' as kind,
             event_type, title, medicine, dose, vet_name, notes, next_due_date, is_zoonotic_concern
      from goat_health_events
      where animal_id = ${animal.id} and deleted_at is null
      order by event_date desc
      limit ${limit}
    `,
    sql`
      select id, feed_date as event_date, 'feed_record' as kind,
             feed_type, quantity_kg, notes
      from goat_feed_records
      where animal_id = ${animal.id} and deleted_at is null
      order by feed_date desc
      limit ${limit}
    `,
  ]);

  const all = [...milkRows, ...weightRows, ...reproRows, ...healthRows, ...feedRows]
    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))
    .slice(0, limit);

  return { animal, history: all };
}
