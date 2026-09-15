/* Poultry P4 — health events and vaccination records.

   Split from poultry.js / poultryOps.js to keep each module readable.
   The routing table in farm.js is the index of what exists; every action
   goes through the same six-step gate (parse → auth → membership → permission
   → action → audit) so nothing in here needs to re-check identity.

   SHARED HELPERS DUPLICATED HERE (not exported from poultryOps.js):

     loadBatch, assertWritable, assertDateInCycle, dateOnly, clean
     memberCanManage

   These are small, stable, and copy-pasted verbatim so this module stays
   self-contained and the P2 module can evolve without coupling. */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";
import { memberCan } from "./permissions.js";

const memberCanManage = (membership) => memberCan(membership, "farm.poultry.manage");

const DAY = 86400000;
const OPEN_STATUSES = ["draft", "active", "harvesting", "partially_sold"];

function dateOnly(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null;
}

const clean = (v, max = 500) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

async function loadBatch(sql, membership, batchId) {
  const [batch] = await sql`
    select * from poultry_batches where id = ${batchId} and deleted_at is null limit 1`;
  requireScope(batch, membership);
  return batch;
}

function assertWritable(batch, { isCorrection = false, canManage = false }) {
  if (OPEN_STATUSES.includes(batch.status)) return;
  if (isCorrection && canManage) return;
  throw new HttpError(409,
    `This batch is ${batch.status}. Record it as a correction (requires farm.poultry.manage) if it belongs to this cycle.`);
}

function assertDateInCycle(batch, date, field = "Date") {
  const d = dateOnly(date);
  if (!d) throw new HttpError(400, `Enter a valid ${field.toLowerCase()}`);
  const placed = dateOnly(batch.placement_date);
  if (placed && d < placed) {
    throw new HttpError(400, `${field} cannot be before the batch was placed (${placed}).`);
  }
  const limit = new Date(Date.now() + DAY).toISOString().slice(0, 10);
  if (d > limit) throw new HttpError(400, `${field} cannot be in the future.`);
  return d;
}

const HEALTH_EVENT_TYPES = ["observation", "treatment", "vet_visit", "outbreak"];
const VACCINATION_ROUTES  = ["drinking_water", "spray", "eye_drop", "injection"];

/* ── health events ────────────────────────────────────────────────────────── */

export async function listHealth(sql, membership, { batchId, limit = 100 } = {}) {
  const batch = await loadBatch(sql, membership, batchId);
  const capped = Math.min(Math.max(Number(limit) || 100, 1), 400);
  return sql`
    select * from poultry_health_events
     where batch_id = ${batch.id}
       and space_id  = ${membership.space_id}
       and deleted_at is null
     order by event_date desc, created_at desc
     limit ${capped}`;
}

export async function addHealth(sql, membership, actorUserId, input = {}) {
  const { batchId, event_date, type, title } = input;

  const batch = await loadBatch(sql, membership, batchId);
  assertWritable(batch, { isCorrection: !!input.is_correction, canManage: memberCanManage(membership) });
  const date = assertDateInCycle(batch, event_date, "Event date");

  if (!type || !HEALTH_EVENT_TYPES.includes(type)) {
    throw new HttpError(400, `Type must be one of: ${HEALTH_EVENT_TYPES.join(", ")}`);
  }
  const titleClean = clean(title, 200);
  if (!titleClean) throw new HttpError(400, "Title is required");

  const isCorrection = !OPEN_STATUSES.includes(batch.status);

  const [row] = await sql`
    insert into poultry_health_events
      (space_id, batch_id, event_date, type, title, medicine, dose, note, created_by, updated_by)
    values (
      ${membership.space_id}, ${batch.id}, ${date}, ${type}, ${titleClean},
      ${clean(input.medicine, 200)}, ${clean(input.dose, 100)}, ${clean(input.note, 1000)},
      ${actorUserId}, ${actorUserId}
    )
    returning *`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "poultry.health.added",
    targetType: "poultry_health_event", targetId: row.id,
    meta: { batch_id: batch.id, event_date: date, type,
            ...(isCorrection ? { correction: true } : {}) },
  });
  return row;
}

export async function deleteHealth(sql, membership, actorUserId, { healthId } = {}) {
  const [existing] = await sql`
    select * from poultry_health_events where id = ${healthId} and deleted_at is null limit 1`;
  requireScope(existing, membership);
  await sql`
    update poultry_health_events
       set deleted_at = now(), updated_by = ${actorUserId}
     where id = ${healthId}`;
  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "poultry.health.deleted",
    targetType: "poultry_health_event", targetId: healthId,
    meta: { batch_id: existing.batch_id },
  });
  return { id: healthId, deleted: true };
}

/* ── vaccinations ─────────────────────────────────────────────────────────── */

export async function listVaccinations(sql, membership, { batchId, limit = 100 } = {}) {
  const batch = await loadBatch(sql, membership, batchId);
  const capped = Math.min(Math.max(Number(limit) || 100, 1), 400);
  return sql`
    select * from poultry_vaccinations
     where batch_id = ${batch.id}
       and space_id  = ${membership.space_id}
       and deleted_at is null
     order by given_at desc, created_at desc
     limit ${capped}`;
}

export async function addVaccination(sql, membership, actorUserId, input = {}) {
  const { batchId, given_at, vaccine_name, route } = input;

  const batch = await loadBatch(sql, membership, batchId);
  assertWritable(batch, { isCorrection: !!input.is_correction, canManage: memberCanManage(membership) });
  const date = assertDateInCycle(batch, given_at, "Vaccination date");

  const vaccineNameClean = clean(vaccine_name, 200);
  if (!vaccineNameClean) throw new HttpError(400, "Vaccine name is required");
  if (!route || !VACCINATION_ROUTES.includes(route)) {
    throw new HttpError(400, `Route must be one of: ${VACCINATION_ROUTES.join(", ")}`);
  }

  /* Application-level pre-check for the duplicate that returns a clear
     farmer-readable 409. The partial unique index on the table is a
     last-resort safety net in case two concurrent requests both pass this
     check before either insert commits. */
  const [dup] = await sql`
    select id from poultry_vaccinations
     where batch_id        = ${batch.id}
       and given_at        = ${date}
       and lower(vaccine_name) = lower(${vaccineNameClean})
       and deleted_at is null
     limit 1`;
  if (dup) {
    throw new HttpError(409,
      `${vaccineNameClean} was already recorded on ${date} for this batch.`);
  }

  const isCorrection = !OPEN_STATUSES.includes(batch.status);

  const [row] = await sql`
    insert into poultry_vaccinations
      (space_id, batch_id, given_at, vaccine_name, route, dose, batch_lot, note,
       created_by, updated_by)
    values (
      ${membership.space_id}, ${batch.id}, ${date}, ${vaccineNameClean}, ${route},
      ${clean(input.dose, 100)}, ${clean(input.batch_lot, 100)}, ${clean(input.note, 500)},
      ${actorUserId}, ${actorUserId}
    )
    returning *`;

  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "poultry.vaccination.added",
    targetType: "poultry_vaccination", targetId: row.id,
    meta: { batch_id: batch.id, given_at: date, vaccine_name: vaccineNameClean,
            ...(isCorrection ? { correction: true } : {}) },
  });
  return row;
}

export async function deleteVaccination(sql, membership, actorUserId, { vaccinationId } = {}) {
  const [existing] = await sql`
    select * from poultry_vaccinations where id = ${vaccinationId} and deleted_at is null limit 1`;
  requireScope(existing, membership);
  await sql`
    update poultry_vaccinations
       set deleted_at = now(), updated_by = ${actorUserId}
     where id = ${vaccinationId}`;
  await audit(sql, {
    spaceId: membership.space_id, actorUserId,
    action: "poultry.vaccination.deleted",
    targetType: "poultry_vaccination", targetId: vaccinationId,
    meta: { batch_id: existing.batch_id },
  });
  return { id: vaccinationId, deleted: true };
}
