/* Dairy — D1: individual animals, lactations, herd metrics, animal history.
 *
 * Canonical identity: animal_id (UUID → dairy_animals). NOT batch_id.
 * Every row in every dairy table hangs off one animal for its entire life.
 *
 * Terminal statuses (sold/deceased/retired): once set, the animal row is
 * read-only for operational writes. assertAnimalWritable() enforces this with
 * no manager-override escape hatch — unlike poultry's assertWritable(). */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";

/* ── helpers ──────────────────────────────────────────────────────────────── */

const TERMINAL = new Set(["sold", "deceased", "retired"]);

export function assertAnimalWritable(animal) {
  if (TERMINAL.has(animal.current_status)) {
    throw new HttpError(409, `Animal is ${animal.current_status} and cannot be modified`);
  }
}

/* Load one animal and verify it belongs to the caller's space. Throws 404 if
 * not found, not in scope, or soft-deleted. */
export async function loadAnimal(sql, membership, animalId) {
  if (!animalId) throw new HttpError(400, "animalId required");
  const rows = await sql`
    select * from dairy_animals
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
        from dairy_health_events h
        where h.animal_id = a.id
          and h.deleted_at is null
          and h.next_due_date is not null
          and h.next_due_date < current_date
      ) as overdue_count
    from dairy_animals a
    where a.space_id = ${membership.space_id}
      and a.deleted_at is null
      and ${terminalClause}
      ${statusClause}
    order by a.name asc
  `;
}

export async function getAnimal(sql, membership, payload) {
  const animal = await loadAnimal(sql, membership, payload?.animalId);

  const [lastLactation, lastMilk] = await Promise.all([
    sql`
      select * from dairy_lactations
      where animal_id = ${animal.id}
      order by lactation_number desc
      limit 1
    `,
    sql`
      select * from dairy_milk_records
      where animal_id = ${animal.id} and deleted_at is null
      order by record_date desc
      limit 1
    `,
  ]);

  return {
    ...animal,
    last_lactation: lastLactation[0] ?? null,
    last_milk_record: lastMilk[0] ?? null,
  };
}

export async function createAnimal(sql, membership, actorUserId, payload) {
  const { name, species, breed, tagId, dob, acquisitionDate, acquisitionSource,
          currentStatus = "heifer", notes, clientUuid } = payload ?? {};

  if (!name?.trim()) throw new HttpError(400, "name required");
  if (!["cow", "buffalo"].includes(species))
    throw new HttpError(400, "species must be cow or buffalo");
  const validStatuses = ["heifer", "milking", "dry"];
  if (!validStatuses.includes(currentStatus))
    throw new HttpError(400, `currentStatus must be one of: ${validStatuses.join(", ")}`);

  if (clientUuid) {
    const existing = await sql`
      select id from dairy_animals
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (existing.length) return existing[0];
  }

  const rows = await sql`
    insert into dairy_animals
      (space_id, tag_id, name, species, breed, dob, acquisition_date,
       acquisition_source, current_status, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${tagId ?? null}, ${name.trim()}, ${species},
      ${breed ?? null}, ${dob ?? null}, ${acquisitionDate ?? null},
      ${acquisitionSource ?? null}, ${currentStatus}, ${notes ?? null},
      ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.animal.create",
    targetType: "dairy_animals", targetId: rows[0].id,
    meta: { name, species },
  });

  return rows[0];
}

export async function updateAnimal(sql, membership, actorUserId, payload) {
  const { animalId, name, species, breed, tagId, dob, acquisitionDate,
          acquisitionSource, notes } = payload ?? {};

  const animal = await loadAnimal(sql, membership, animalId);
  assertAnimalWritable(animal);

  const updated = await sql`
    update dairy_animals set
      name               = ${name              !== undefined ? name.trim()         : animal.name},
      species            = ${species           !== undefined ? species             : animal.species},
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
    action: "dairy.animal.update",
    targetType: "dairy_animals", targetId: animalId,
    meta: payload,
  });

  return updated[0];
}

export async function setAnimalStatus(sql, membership, actorUserId, payload) {
  const { animalId, status } = payload ?? {};
  const valid = ["heifer", "milking", "dry", "sold", "deceased", "retired"];
  if (!valid.includes(status)) throw new HttpError(400, "Invalid status");

  const animal = await loadAnimal(sql, membership, animalId);

  // Cannot transition OUT of a terminal status
  if (TERMINAL.has(animal.current_status)) {
    throw new HttpError(409, `Animal is already ${animal.current_status}`);
  }

  const updated = await sql`
    update dairy_animals set current_status = ${status}
    where id = ${animalId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.animal.status",
    targetType: "dairy_animals", targetId: animalId,
    meta: { from: animal.current_status, to: status },
  });

  return updated[0];
}

/* ── lactations ───────────────────────────────────────────────────────────── */

export async function listLactations(sql, membership, payload) {
  const animal = await loadAnimal(sql, membership, payload?.animalId);
  return sql`
    select * from dairy_lactations
    where animal_id = ${animal.id}
    order by lactation_number desc
  `;
}

export async function addLactation(sql, membership, actorUserId, payload) {
  const { animalId, calvingDate, calfSex, calfAlive, dryOffDate,
          expectedNextCalving, notes } = payload ?? {};

  if (!calvingDate) throw new HttpError(400, "calvingDate required");
  const animal = await loadAnimal(sql, membership, animalId);
  assertAnimalWritable(animal);

  // Auto-increment lactation number
  const numRows = await sql`
    select coalesce(max(lactation_number), 0) + 1 as next_num
    from dairy_lactations where animal_id = ${animalId}
  `;
  const lactationNumber = numRows[0].next_num;

  const rows = await sql`
    insert into dairy_lactations
      (space_id, animal_id, lactation_number, calving_date, calf_sex,
       calf_alive, dry_off_date, expected_next_calving, notes, created_by)
    values (
      ${membership.space_id}, ${animalId}, ${lactationNumber},
      ${calvingDate}, ${calfSex ?? null}, ${calfAlive ?? null},
      ${dryOffDate ?? null}, ${expectedNextCalving ?? null},
      ${notes ?? null}, ${actorUserId}
    )
    returning *
  `;

  // Advance animal status to milking
  await sql`
    update dairy_animals set current_status = 'milking'
    where id = ${animalId} and current_status not in ('sold','deceased','retired')
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.lactation.add",
    targetType: "dairy_lactations", targetId: rows[0].id,
    meta: { animalId, lactationNumber, calvingDate },
  });

  return rows[0];
}

export async function updateLactation(sql, membership, actorUserId, payload) {
  const { lactationId, dryOffDate, expectedNextCalving, calfSex, calfAlive, notes } = payload ?? {};
  if (!lactationId) throw new HttpError(400, "lactationId required");

  const rows = await sql`
    select * from dairy_lactations where id = ${lactationId}
  `;
  if (!rows.length) throw new HttpError(404, "Lactation not found");
  requireScope(rows[0], membership);

  /* Terminal write-protection: same invariant as all other dairy writes. */
  const animal = await loadAnimal(sql, membership, rows[0].animal_id);
  assertAnimalWritable(animal);

  const lac = rows[0];
  const updated = await sql`
    update dairy_lactations set
      dry_off_date          = ${dryOffDate          !== undefined ? dryOffDate          : lac.dry_off_date},
      expected_next_calving = ${expectedNextCalving  !== undefined ? expectedNextCalving  : lac.expected_next_calving},
      calf_sex              = ${calfSex             !== undefined ? calfSex             : lac.calf_sex},
      calf_alive            = ${calfAlive           !== undefined ? calfAlive           : lac.calf_alive},
      notes                 = ${notes               !== undefined ? notes               : lac.notes}
    where id = ${lactationId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "dairy.lactation.update",
    targetType: "dairy_lactations", targetId: lactationId,
    meta: payload,
  });

  return updated[0];
}

/* ── herd metrics ─────────────────────────────────────────────────────────── */

export async function herdMetrics(sql, membership) {
  const spaceId = membership.space_id;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const twoWeeksLater   = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const threeWeeksLater = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);

  const [statusCounts, todayMilk, monthMilk, healthDue, healthOverdue, calvingDue] = await Promise.all([
    sql`
      select current_status, count(*)::int as count
      from dairy_animals
      where space_id = ${spaceId} and deleted_at is null
      group by current_status
    `,
    sql`
      select coalesce(sum(total_yield_kg), 0) as kg
      from dairy_milk_records
      where space_id = ${spaceId}
        and record_date = ${today}
        and deleted_at is null
    `,
    sql`
      select coalesce(sum(total_yield_kg), 0) as kg
      from dairy_milk_records
      where space_id = ${spaceId}
        and record_date >= ${monthStart}
        and deleted_at is null
    `,
    sql`
      select count(*)::int as count
      from dairy_health_events
      where space_id = ${spaceId}
        and next_due_date between ${today} and ${twoWeeksLater}
        and deleted_at is null
    `,
    sql`
      select count(*)::int as count
      from dairy_health_events
      where space_id = ${spaceId}
        and next_due_date < ${today}
        and deleted_at is null
    `,
    sql`
      select count(*)::int as count
      from (
        select distinct on (l.animal_id) l.expected_next_calving
        from dairy_lactations l
        join dairy_animals a on a.id = l.animal_id
        where a.space_id = ${spaceId}
          and a.deleted_at is null
        order by l.animal_id, l.lactation_number desc
      ) latest
      where latest.expected_next_calving is not null
        and latest.expected_next_calving between ${today} and ${threeWeeksLater}
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
    calving_due_count: calvingDue[0].count,
  };
}

/* ── animal history ───────────────────────────────────────────────────────── */

export async function animalHistory(sql, membership, payload) {
  const animal = await loadAnimal(sql, membership, payload?.animalId);
  const { limit = 50 } = payload ?? {};

  const [milkRows, reproRows, healthRows, lactationRows, feedRows] = await Promise.all([
    sql`
      select id, record_date as event_date, 'milk_record' as kind,
             total_yield_kg, am_yield_kg, pm_yield_kg, fat_pct, snf_pct, remarks
      from dairy_milk_records
      where animal_id = ${animal.id} and deleted_at is null
      order by record_date desc
      limit ${limit}
    `,
    sql`
      select id, event_date, 'repro_event' as kind,
             event_type, pregnancy_result, notes
      from dairy_reproductive_events
      where animal_id = ${animal.id} and deleted_at is null
      order by event_date desc
      limit ${limit}
    `,
    sql`
      select id, event_date, 'health_event' as kind,
             event_type, title, medicine, dose, vet_name, notes, next_due_date, is_zoonotic_concern
      from dairy_health_events
      where animal_id = ${animal.id} and deleted_at is null
      order by event_date desc
      limit ${limit}
    `,
    sql`
      select id, calving_date as event_date, 'lactation' as kind,
             lactation_number, dry_off_date, calf_sex, calf_alive
      from dairy_lactations
      where animal_id = ${animal.id}
      order by calving_date desc
      limit ${limit}
    `,
    sql`
      select id, feed_date as event_date, 'feed_record' as kind,
             feed_type, quantity_kg, notes
      from dairy_feed_records
      where animal_id = ${animal.id} and deleted_at is null
      order by feed_date desc
      limit ${limit}
    `,
  ]);

  const all = [...milkRows, ...reproRows, ...healthRows, ...lactationRows, ...feedRows]
    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))
    .slice(0, limit);

  return { animal, history: all };
}
