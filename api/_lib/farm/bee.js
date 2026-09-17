/* Beekeeping / Apiculture — hive-centric model.
 *
 * Apiaries group hives. A hive is the unit of record: inspections,
 * harvests and treatments hang off hive_id. Finance (sales/costs) is
 * space-scoped, matching the fish module pattern.
 *
 * Hive statuses:  active | queenless | weak | dead | merged | archived
 * Terminal:       dead | merged | archived — writes blocked with 409 */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";

/* ── helpers ──────────────────────────────────────────────────────────────── */

const TERMINAL_HIVE = new Set(["dead", "merged", "archived"]);

const HIVE_STATUS    = ["active","queenless","weak","dead","merged","archived"];
const HIVE_TYPE      = ["langstroth","top_bar","warre","traditional","other"];

export function assertHiveWritable(hive) {
  if (TERMINAL_HIVE.has(hive.current_status)) {
    throw new HttpError(409, `Hive is ${hive.current_status} and cannot be modified`);
  }
}

export async function loadHive(sql, membership, hiveId) {
  if (!hiveId) throw new HttpError(400, "hiveId required");
  const rows = await sql`
    select * from bee_hives
    where id = ${hiveId} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Hive not found");
  requireScope(rows[0], membership);
  return rows[0];
}

/* ── apiaries ─────────────────────────────────────────────────────────────── */

export async function listApiaries(sql, membership) {
  return sql`
    select a.*,
      count(h.id)::int as hive_count
    from bee_apiaries a
    left join bee_hives h on h.apiary_id = a.id and h.deleted_at is null
    where a.space_id = ${membership.space_id}
      and a.deleted_at is null
    group by a.id
    order by a.name asc
  `;
}

export async function createApiary(sql, membership, actorUserId, payload) {
  const { name, location, notes, clientUuid } = payload ?? {};
  if (!name?.trim()) throw new HttpError(400, "name required");

  if (clientUuid) {
    const existing = await sql`
      select id from bee_apiaries
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (existing.length) return existing[0];
  }

  const rows = await sql`
    insert into bee_apiaries (space_id, name, location, notes, client_uuid, created_by)
    values (${membership.space_id}, ${name.trim()}, ${location ?? null},
            ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId})
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "bee.apiary.create",
    targetType: "bee_apiaries", targetId: rows[0].id,
    meta: { name },
  });

  return rows[0];
}

export async function deleteApiary(sql, membership, actorUserId, payload) {
  const { apiaryId } = payload ?? {};
  if (!apiaryId) throw new HttpError(400, "apiaryId required");

  const rows = await sql`
    select * from bee_apiaries
    where id = ${apiaryId} and space_id = ${membership.space_id} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Apiary not found");

  await sql`
    update bee_apiaries set deleted_at = now() where id = ${apiaryId}
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "bee.apiary.delete",
    targetType: "bee_apiaries", targetId: apiaryId,
    meta: {},
  });

  return { ok: true };
}

/* ── hives ────────────────────────────────────────────────────────────────── */

export async function listHives(sql, membership, payload = {}) {
  const { includeTerminal = false, apiaryId } = payload;
  const statusFilter = includeTerminal ? sql`true` : sql`h.current_status not in ('dead','merged','archived')`;
  const apiaryFilter = apiaryId ? sql`and h.apiary_id = ${apiaryId}` : sql``;

  return sql`
    select h.*,
      a.name as apiary_name,
      (
        select inspection_date from bee_inspections i
        where i.hive_id = h.id and i.deleted_at is null
        order by inspection_date desc limit 1
      ) as last_inspection_date,
      (
        select colony_strength from bee_inspections i
        where i.hive_id = h.id and i.deleted_at is null
        order by inspection_date desc limit 1
      ) as last_colony_strength
    from bee_hives h
    left join bee_apiaries a on a.id = h.apiary_id and a.deleted_at is null
    where h.space_id = ${membership.space_id}
      and h.deleted_at is null
      and ${statusFilter}
      ${apiaryFilter}
    order by h.name asc
  `;
}

export async function getHive(sql, membership, payload) {
  const hive = await loadHive(sql, membership, payload?.hiveId);

  const [lastInspection, lastHarvest, lastTreatment] = await Promise.all([
    sql`
      select * from bee_inspections
      where hive_id = ${hive.id} and deleted_at is null
      order by inspection_date desc limit 1
    `,
    sql`
      select * from bee_harvests
      where hive_id = ${hive.id} and deleted_at is null
      order by harvest_date desc limit 1
    `,
    sql`
      select * from bee_treatments
      where hive_id = ${hive.id} and deleted_at is null
      order by treatment_date desc limit 1
    `,
  ]);

  return {
    ...hive,
    last_inspection: lastInspection[0] ?? null,
    last_harvest: lastHarvest[0] ?? null,
    last_treatment: lastTreatment[0] ?? null,
  };
}

export async function createHive(sql, membership, actorUserId, payload) {
  const { name, hiveType = "langstroth", apiaryId, installationDate,
          source, queenYear, notes, clientUuid } = payload ?? {};

  if (!name?.trim()) throw new HttpError(400, "name required");
  if (!HIVE_TYPE.includes(hiveType))
    throw new HttpError(400, `hiveType must be one of: ${HIVE_TYPE.join(", ")}`);

  if (clientUuid) {
    const existing = await sql`
      select id from bee_hives
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (existing.length) return existing[0];
  }

  const rows = await sql`
    insert into bee_hives
      (space_id, apiary_id, name, hive_type, installation_date,
       source, queen_year, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${apiaryId ?? null}, ${name.trim()}, ${hiveType},
      ${installationDate ?? null}, ${source ?? null}, ${queenYear ?? null},
      ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "bee.hive.create",
    targetType: "bee_hives", targetId: rows[0].id,
    meta: { name, hiveType },
  });

  return rows[0];
}

export async function updateHive(sql, membership, actorUserId, payload) {
  const { hiveId, name, hiveType, apiaryId, installationDate,
          source, queenYear, notes } = payload ?? {};

  const hive = await loadHive(sql, membership, hiveId);
  assertHiveWritable(hive);

  if (hiveType !== undefined && !HIVE_TYPE.includes(hiveType))
    throw new HttpError(400, `Invalid hiveType`);

  const updated = await sql`
    update bee_hives set
      name              = ${name              !== undefined ? name.trim()       : hive.name},
      hive_type         = ${hiveType          !== undefined ? hiveType          : hive.hive_type},
      apiary_id         = ${apiaryId          !== undefined ? apiaryId          : hive.apiary_id},
      installation_date = ${installationDate  !== undefined ? installationDate  : hive.installation_date},
      source            = ${source            !== undefined ? source            : hive.source},
      queen_year        = ${queenYear         !== undefined ? queenYear         : hive.queen_year},
      notes             = ${notes             !== undefined ? notes             : hive.notes},
      updated_at        = now()
    where id = ${hiveId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "bee.hive.update",
    targetType: "bee_hives", targetId: hiveId,
    meta: { name },
  });

  return updated[0];
}

export async function setHiveStatus(sql, membership, actorUserId, payload) {
  const { hiveId, status, notes } = payload ?? {};

  const hive = await loadHive(sql, membership, hiveId);
  if (!HIVE_STATUS.includes(status))
    throw new HttpError(400, `status must be one of: ${HIVE_STATUS.join(", ")}`);

  const updated = await sql`
    update bee_hives set
      current_status = ${status},
      notes          = ${notes !== undefined ? notes : hive.notes},
      updated_at     = now()
    where id = ${hiveId}
    returning *
  `;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "bee.hive.setStatus",
    targetType: "bee_hives", targetId: hiveId,
    meta: { from: hive.current_status, to: status },
  });

  return updated[0];
}

export async function hiveHistory(sql, membership, payload) {
  const hive = await loadHive(sql, membership, payload?.hiveId);

  const [inspections, harvests, treatments] = await Promise.all([
    sql`
      select *, 'inspection' as event_kind from bee_inspections
      where hive_id = ${hive.id} and deleted_at is null
      order by inspection_date desc
    `,
    sql`
      select *, 'harvest' as event_kind from bee_harvests
      where hive_id = ${hive.id} and deleted_at is null
      order by harvest_date desc
    `,
    sql`
      select *, 'treatment' as event_kind from bee_treatments
      where hive_id = ${hive.id} and deleted_at is null
      order by treatment_date desc
    `,
  ]);

  return { hive, inspections, harvests, treatments };
}

/* ── apiary metrics / dashboard ──────────────────────────────────────────── */

export async function hiveMetrics(sql, membership) {
  const rows = await sql`
    select
      count(*) filter (where current_status not in ('dead','merged','archived'))::int as active_hives,
      count(*) filter (where current_status = 'queenless')::int                      as queenless_count,
      count(*) filter (where current_status = 'weak')::int                           as weak_count,
      (
        select coalesce(sum(quantity_kg),0)
        from bee_harvests
        where space_id = ${membership.space_id}
          and deleted_at is null
          and date_trunc('month', harvest_date) = date_trunc('month', current_date)
      ) as month_honey_kg,
      (
        select count(distinct hive_id)::int
        from bee_inspections
        where space_id = ${membership.space_id}
          and deleted_at is null
          and inspection_date > current_date - interval '14 days'
      ) as inspected_last_14d
    from bee_hives
    where space_id = ${membership.space_id} and deleted_at is null
  `;
  return rows[0];
}

/* ── inspections ──────────────────────────────────────────────────────────── */

export async function listInspections(sql, membership, payload = {}) {
  const { hiveId, limit = 20 } = payload;
  const hiveFilter = hiveId ? sql`and hive_id = ${hiveId}` : sql``;

  return sql`
    select * from bee_inspections
    where space_id = ${membership.space_id}
      and deleted_at is null
      ${hiveFilter}
    order by inspection_date desc
    limit ${Math.min(Number(limit), 100)}
  `;
}

export async function addInspection(sql, membership, actorUserId, payload) {
  const {
    hiveId, inspectionDate, colonyStrength, queenStatus,
    honeyFrames, broodFrames, varroaLevel, sawQueen, eggsPresent,
    diseaseSigns, actionTaken, nextInspection, notes, clientUuid,
  } = payload ?? {};

  if (!hiveId) throw new HttpError(400, "hiveId required");
  if (!inspectionDate) throw new HttpError(400, "inspectionDate required");

  const hive = await loadHive(sql, membership, hiveId);
  assertHiveWritable(hive);

  if (clientUuid) {
    const existing = await sql`
      select id from bee_inspections
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (existing.length) return existing[0];
  }

  const rows = await sql`
    insert into bee_inspections
      (space_id, hive_id, inspection_date, colony_strength, queen_status,
       honey_frames, brood_frames, varroa_level, saw_queen, eggs_present,
       disease_signs, action_taken, next_inspection, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${hiveId}, ${inspectionDate},
      ${colonyStrength ?? null}, ${queenStatus ?? null},
      ${honeyFrames ?? null}, ${broodFrames ?? null}, ${varroaLevel ?? null},
      ${sawQueen ?? false}, ${eggsPresent ?? false},
      ${diseaseSigns ?? null}, ${actionTaken ?? null}, ${nextInspection ?? null},
      ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  return rows[0];
}

export async function deleteInspection(sql, membership, actorUserId, payload) {
  const { inspectionId } = payload ?? {};
  if (!inspectionId) throw new HttpError(400, "inspectionId required");

  const rows = await sql`
    select * from bee_inspections
    where id = ${inspectionId} and space_id = ${membership.space_id} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Inspection not found");

  await sql`update bee_inspections set deleted_at = now() where id = ${inspectionId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "bee.inspection.delete",
    targetType: "bee_inspections", targetId: inspectionId,
    meta: {},
  });

  return { ok: true };
}

/* ── harvests ─────────────────────────────────────────────────────────────── */

export async function listHarvests(sql, membership, payload = {}) {
  const { hiveId, limit = 20 } = payload;
  const hiveFilter = hiveId ? sql`and hive_id = ${hiveId}` : sql``;

  return sql`
    select * from bee_harvests
    where space_id = ${membership.space_id}
      and deleted_at is null
      ${hiveFilter}
    order by harvest_date desc
    limit ${Math.min(Number(limit), 100)}
  `;
}

export async function addHarvest(sql, membership, actorUserId, payload) {
  const {
    hiveId, harvestDate, productType = "honey",
    quantityKg, qualityGrade, notes, clientUuid,
  } = payload ?? {};

  if (!harvestDate) throw new HttpError(400, "harvestDate required");
  if (!quantityKg || Number(quantityKg) <= 0) throw new HttpError(400, "quantityKg must be > 0");

  if (clientUuid) {
    const existing = await sql`
      select id from bee_harvests
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (existing.length) return existing[0];
  }

  const rows = await sql`
    insert into bee_harvests
      (space_id, hive_id, harvest_date, product_type, quantity_kg, quality_grade, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${hiveId ?? null}, ${harvestDate}, ${productType},
      ${quantityKg}, ${qualityGrade ?? null}, ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  return rows[0];
}

export async function deleteHarvest(sql, membership, actorUserId, payload) {
  const { harvestId } = payload ?? {};
  if (!harvestId) throw new HttpError(400, "harvestId required");

  const rows = await sql`
    select * from bee_harvests
    where id = ${harvestId} and space_id = ${membership.space_id} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Harvest record not found");

  await sql`update bee_harvests set deleted_at = now() where id = ${harvestId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "bee.harvest.delete",
    targetType: "bee_harvests", targetId: harvestId,
    meta: {},
  });

  return { ok: true };
}

/* ── treatments ───────────────────────────────────────────────────────────── */

export async function listTreatments(sql, membership, payload = {}) {
  const { hiveId, limit = 20 } = payload;
  const hiveFilter = hiveId ? sql`and hive_id = ${hiveId}` : sql``;

  return sql`
    select * from bee_treatments
    where space_id = ${membership.space_id}
      and deleted_at is null
      ${hiveFilter}
    order by treatment_date desc
    limit ${Math.min(Number(limit), 100)}
  `;
}

export async function addTreatment(sql, membership, actorUserId, payload) {
  const {
    hiveId, treatmentDate, treatmentType, productName, dose, target,
    notes, clientUuid,
  } = payload ?? {};

  if (!treatmentDate) throw new HttpError(400, "treatmentDate required");
  if (!treatmentType?.trim()) throw new HttpError(400, "treatmentType required");

  if (clientUuid) {
    const existing = await sql`
      select id from bee_treatments
      where space_id = ${membership.space_id} and client_uuid = ${clientUuid}
    `;
    if (existing.length) return existing[0];
  }

  const rows = await sql`
    insert into bee_treatments
      (space_id, hive_id, treatment_date, treatment_type, product_name, dose, target, notes, client_uuid, created_by)
    values (
      ${membership.space_id}, ${hiveId ?? null}, ${treatmentDate}, ${treatmentType.trim()},
      ${productName ?? null}, ${dose ?? null}, ${target ?? null},
      ${notes ?? null}, ${clientUuid ?? null}, ${actorUserId}
    )
    returning *
  `;

  return rows[0];
}

export async function deleteTreatment(sql, membership, actorUserId, payload) {
  const { treatmentId } = payload ?? {};
  if (!treatmentId) throw new HttpError(400, "treatmentId required");

  const rows = await sql`
    select * from bee_treatments
    where id = ${treatmentId} and space_id = ${membership.space_id} and deleted_at is null
  `;
  if (!rows.length) throw new HttpError(404, "Treatment not found");

  await sql`update bee_treatments set deleted_at = now() where id = ${treatmentId}`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "bee.treatment.delete",
    targetType: "bee_treatments", targetId: treatmentId,
    meta: {},
  });

  return { ok: true };
}
