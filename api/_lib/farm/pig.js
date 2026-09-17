/* Pig / Swine — P1: individual animals, weight records, herd metrics,
 * animal history.
 *
 * Sex: boar | sow | gilt | barrow | unknown.
 * Statuses: piglet | grower | finisher | breeder (active); sold | deceased | retired (terminal).
 * No milk records — farrowing litter data lives on reproductive events. */

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
    select * from pig_animals
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
        from pig_health_events h
        where h.animal_id = a.id
          and h.deleted_at is null
          and h.next_due_date is not null
          and h.next_due_date < current_date
      ) as overdue_count
    from pig_animals a
    where a.space_id = ${membership.space_id}
      and a.deleted_at is null
      and ${terminalClause}
      ${statusClause}
    order by a.name asc
  `;
}

export async function getAnimal(sql, membership, payload) {
  const animal = await loadAnimal(sql, membership, payload?.animalId);

  const [lastWeight, lastRepro] = await Promise.all([
    sql`
      select * from pig_weight_records
      where animal_id = ${animal.id} and deleted_at is null
      order by weigh_date desc
      limit 1
    `,
    sql`
      select * from pig_reproductive_events
      where animal_id = ${animal.id} and deleted_at is null
      order by event_date desc
      limit 1
    `,
  ]);

  return {
    ...animal,
    last_weight: lastWeight[0] ?? null,
    last_repro_event: lastRepro[0] ?? null,
  };
}

export async function createAnimal(sql, membership, actorUserId, payload) {
  const { name, breed, sex = "unknown", tagId, dob,
          acquisitionDate, acquisitionSource, currentStatus = "piglet",
          notes, clientUuid } = payload ?? {};

  if (!name?.trim()) throw new HttpError(400, "name required");
  if (!["boar", "sow", "gilt", "barrow", "unknown"].includes(sex))
    throw new HttpError(400, "sex must be boar, sow, gilt, barrow, or unknown");
  const validStatuses = ["piglet", "grower", "finisher", "breeder"];
  if (!validStatuses.includes(currentStatus))
    throw new HttpError(400, `currentStatus must be one of: ${validStatuses.join(", ")}`);

  if (clientUuid) {
    const existing = await sql`
      select id from pig_animals
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (existing.length) return existing[0];
  }

  const rows = await sql`
    insert into pig_animals
      (space_id, tag_id, name, breed, sex, dob, acquisition_date,
       acquisition_source, current_status, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${tagId ?? null}, ${name.trim()}, ${breed ?? null},
      ${sex}, ${dob ?? null}, ${acquisitionDate ?? null},
      ${acquisitionSource ?? null}, ${currentStatus}, ${notes ?? null},
      ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "pig.animal.create",
    targetType: "pig_animals", targetId: rows[0].id,
    meta: { name, sex },
  });

  return rows[0];
}

export async function updateAnimal(sql, membership, actorUserId, payload) {
  const { animalId, name, breed, sex, tagId, dob,
          acquisitionDate, acquisitionSource, notes } = payload ?? {};

  const animal = await loadAnimal(sql, membership, animalId);
  assertAnimalWritable(animal);

  if (sex !== undefined &&
      !["boar", "sow", "gilt", "barrow", "unknown"].includes(sex))
    throw new HttpError(400, "sex must be boar, sow, gilt, barrow, or unknown");

  const updated = await sql`
    update pig_animals set
      name               = ${name              !== undefined ? name.trim()         : animal.name},
      breed              = ${breed             !== undefined ? breed               : animal.breed},
      sex                = ${sex               !== undefined ? sex                 : animal.sex},
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
    action: "pig.animal.update",
    targetType: "pig_animals", targetId: animalId,
    meta: payload,
  });

  return updated[0];
}

export async function setAnimalStatus(sql, membership, actorUserId, payload) {
  const { animalId, status } = payload ?? {};
  const valid = ["piglet", "grower", "finisher", "breeder", "sold", "deceased", "retired"];
  if (!valid.includes(status)) throw new HttpError(400, "Invalid status");

  const animal = await loadAnimal(sql, membership, animalId);

  if (TERMINAL.has(animal.current_status)) {
    throw new HttpError(409, `Animal is already ${animal.current_status}`);
  }

  const updated = await sql`
    update pig_animals set current_status = ${status}
    where id = ${animalId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "pig.animal.status",
    targetType: "pig_animals", targetId: animalId,
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

  const [statusCounts, healthDue, healthOverdue, farrowingDue, monthWeight] = await Promise.all([
    sql`
      select current_status, count(*)::int as count
      from pig_animals
      where space_id = ${spaceId} and deleted_at is null
      group by current_status
    `,
    sql`
      select count(*)::int as count
      from pig_health_events
      where space_id = ${spaceId}
        and next_due_date between ${today} and ${twoWeeksLater}
        and deleted_at is null
    `,
    sql`
      select count(*)::int as count
      from pig_health_events
      where space_id = ${spaceId}
        and next_due_date < ${today}
        and deleted_at is null
    `,
    sql`
      select count(*)::int as count
      from pig_reproductive_events
      where space_id = ${spaceId}
        and event_type = 'pregnancy_check'
        and pregnancy_result = 'positive'
        and deleted_at is null
        and event_date >= ${monthStart}
    `,
    sql`
      select coalesce(avg(w.weight_kg), 0) as avg_kg,
             count(distinct w.animal_id)::int as animals_weighed
      from pig_weight_records w
      join pig_animals a on a.id = w.animal_id
      where a.space_id = ${spaceId}
        and w.weigh_date >= ${monthStart}
        and w.deleted_at is null
    `,
  ]);

  const byStatus = {};
  for (const row of statusCounts) byStatus[row.current_status] = row.count;

  return {
    status_counts: byStatus,
    health_due_in_14_days: healthDue[0].count,
    health_overdue_count: healthOverdue[0].count,
    farrowing_expected_count: farrowingDue[0].count,
    month_avg_weight_kg: parseFloat(monthWeight[0].avg_kg),
    month_animals_weighed: monthWeight[0].animals_weighed,
  };
}

/* ── animal history ───────────────────────────────────────────────────────── */

export async function animalHistory(sql, membership, payload) {
  const animal = await loadAnimal(sql, membership, payload?.animalId);
  const { limit = 50 } = payload ?? {};

  const [weightRows, reproRows, healthRows, feedRows] = await Promise.all([
    sql`
      select id, weigh_date as event_date, 'weight_record' as kind,
             weight_kg, notes
      from pig_weight_records
      where animal_id = ${animal.id} and deleted_at is null
      order by weigh_date desc
      limit ${limit}
    `,
    sql`
      select id, event_date, 'repro_event' as kind,
             event_type, pregnancy_result, litter_size, live_born,
             still_born, weaned_count, boar_name, notes
      from pig_reproductive_events
      where animal_id = ${animal.id} and deleted_at is null
      order by event_date desc
      limit ${limit}
    `,
    sql`
      select id, event_date, 'health_event' as kind,
             event_type, title, medicine, dose, vet_name,
             notes, next_due_date, is_zoonotic_concern
      from pig_health_events
      where animal_id = ${animal.id} and deleted_at is null
      order by event_date desc
      limit ${limit}
    `,
    sql`
      select id, feed_date as event_date, 'feed_record' as kind,
             feed_type, quantity_kg, notes
      from pig_feed_records
      where animal_id = ${animal.id} and deleted_at is null
      order by feed_date desc
      limit ${limit}
    `,
  ]);

  const all = [...weightRows, ...reproRows, ...healthRows, ...feedRows]
    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))
    .slice(0, limit);

  return { animal, history: all };
}
