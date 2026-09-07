/* Poultry — Broiler Farm Management, P1: sheds and batches.

   Everything here is space-scoped, which is what makes it safe: the gate in
   farm.js has already proved the caller is an active member of `spaceId` and
   holds the permission the routing table demands, and every write below takes
   space_id from `membership`, never from the request. A batch id or shed id
   that arrives in a payload is only ever a lookup key — requireScope() decides
   whether the caller may see the row it found, and a row from another farm is
   indistinguishable from one that does not exist.

   TWO VALUES ARE DELIBERATELY NOT STORED:

     age_days / age_weeks   derived from placement_date on read. A stored age
                            is wrong the next morning, and the legacy local
                            model's hand-typed "age in weeks" is the specific
                            bug this module replaces.
     live_birds             placed_qty minus recorded mortality, culls and
                            sales. P1 has no such records yet, so it reports
                            placed_qty and flags the figure as provisional
                            rather than inventing a number that later phases
                            would contradict.

   FCR, ADG and the rest of the performance maths are NOT here. They arrive in
   P2 with the records they need, and FCR will be a faithful port of the
   already-validated feedBatchService.computeFCR() rather than a second
   formula. */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";
import { memberCan } from "./permissions.js";

/* ── lifecycle ────────────────────────────────────────────────────────────── */

export const BATCH_STATUS = [
  "draft", "active", "harvesting", "partially_sold", "completed", "closed", "archived",
];

/* Which moves are legal, and who may make them.

   A cycle only ever moves forward under normal operation. The reversals below
   exist because real farms mis-tap buttons, but they are owner-only and, like
   every transition, audited — a correction that leaves no trace is how a
   disputed batch P&L becomes unresolvable.

   `partially_sold` and `completed` are reachable from `harvesting` because P5
   will drive them from the sale itself (birds remaining > 0 vs 0). They are
   also reachable by hand here so a farmer is never stuck waiting for a feature
   the next phase brings. */
const TRANSITIONS = {
  active:         { from: ["draft"],                              permission: "farm.poultry.manage" },
  harvesting:     { from: ["active"],                             permission: "farm.poultry.manage" },
  partially_sold: { from: ["harvesting"],                         permission: "farm.poultry.manage" },
  completed:      { from: ["harvesting", "partially_sold"],       permission: "farm.poultry.manage" },
  closed:         { from: ["completed"],                          permission: "farm.poultry.close" },
  archived:       { from: ["closed", "draft"],                    permission: "farm.poultry.close" },
  /* Reversals — owner only. Re-opening a closed cycle unfreezes its P&L. */
  reopen_completed: { alias: "completed", from: ["closed"],       permission: "farm.poultry.close" },
  reopen_active:    { alias: "active",    from: ["harvesting"],   permission: "farm.poultry.close" },
};

/* What the UI may offer right now. Exported so a screen draws exactly the
   buttons the server would accept — a button that always 403s is worse than
   no button. Still re-checked on arrival; this is only what to draw. */
export function allowedBatchTransitions(membership, batch) {
  if (!membership || !batch) return [];
  return Object.entries(TRANSITIONS)
    .filter(([, rule]) => rule.from.includes(batch.status))
    .filter(([, rule]) => memberCan(membership, rule.permission))
    .map(([key, rule]) => rule.alias || key);
}

/* ── derived values ───────────────────────────────────────────────────────── */

const DAY = 86400000;
const todayStr = () => new Date().toISOString().slice(0, 10);

/* A `date` column comes back as a Date from one driver and as a "YYYY-MM-DD"
   string from another. Both reach these helpers, so normalise once here rather
   than letting an Invalid Date turn into a 500 three calls later. Returns null
   for anything that is not a real calendar date. */
function dateOnly(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null;
}

/* Age from the placement date — the single source of truth for how old a
   batch is. Day 0 is placement day itself, which is how Indian broiler
   growers count ("day-old chick" on the day they arrive). */
export function ageOf(batch, today = todayStr()) {
  const from = dateOnly(batch?.placement_date);
  const to = dateOnly(today);
  if (!from || !to) return { age_days: null, age_weeks: null };
  const placed = Date.parse(from + "T00:00:00Z");
  const now = Date.parse(to + "T00:00:00Z");
  const age_days = Math.max(0, Math.round((now - placed) / DAY));
  return { age_days, age_weeks: Math.floor(age_days / 7) + 1 };
}

/* Expected harvest date = placement + target age, when a target was set. Null
   without one: a guessed harvest date would drive alerts the farmer never
   asked for. */
export function expectedHarvestDate(batch) {
  const from = dateOnly(batch?.placement_date);
  const t = Number(batch?.target_harvest_age_days);
  if (!from || !Number.isFinite(t) || t <= 0) return null;
  return new Date(Date.parse(from + "T00:00:00Z") + t * DAY).toISOString().slice(0, 10);
}

/* The read shape every batch endpoint returns. `live_birds_provisional` is
   true until the record types that reduce it exist (P2 mortality, P5 sales) —
   an honest flag beats a number the next phase would silently change. */
export function decorate(batch, membership = null) {
  if (!batch) return batch;
  const { age_days, age_weeks } = ageOf(batch);
  return {
    ...batch,
    age_days,
    age_weeks,
    expected_harvest_date: expectedHarvestDate(batch),
    live_birds: batch.placed_qty,
    live_birds_provisional: true,
    allowed_transitions: membership ? allowedBatchTransitions(membership, batch) : undefined,
  };
}

/* ── validation ───────────────────────────────────────────────────────────── */

const POULTRY_TYPES = ["broiler", "layer", "breeder", "country"];
const PURPOSES = ["meat", "eggs", "dual"];
const MAX_TEXT = 120;

const clean = (v, max = MAX_TEXT) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

/* Integers and decimals arrive from a phone keyboard, so "" and null both mean
   "not given" — only an actual value is validated. */
function num(v) {
  if (v === undefined || v === null || v === "") return { ok: true, value: null };
  const n = Number(v);
  if (!Number.isFinite(n)) return { ok: false };
  return { ok: true, value: n };
}

export function validateShedInput(input = {}, { partial = false } = {}) {
  const value = {};
  if (!partial || input.name !== undefined) {
    const name = clean(input.name);
    if (!name) return { error: "Shed name is required" };
    value.name = name;
  }
  for (const [field, label] of [["capacity", "Capacity"], ["area_sqft", "Area"]]) {
    if (input[field] !== undefined) {
      const n = num(input[field]);
      if (!n.ok) return { error: `${label} must be a number` };
      if (n.value !== null && n.value < 0) return { error: `${label} cannot be negative` };
      value[field] = n.value;
    }
  }
  if (input.ventilation_type !== undefined) value.ventilation_type = clean(input.ventilation_type, 40);
  if (input.notes !== undefined) value.notes = clean(input.notes, 500);
  if (input.status !== undefined) {
    if (!["active", "inactive"].includes(input.status)) return { error: "Invalid shed status" };
    value.status = input.status;
  }
  return { value };
}

export function validateBatchInput(input = {}, { partial = false } = {}) {
  const value = {};

  if (!partial || input.name !== undefined) {
    const name = clean(input.name);
    if (!name) return { error: "Batch name is required" };
    value.name = name;
  }

  if (!partial || input.placement_date !== undefined) {
    const d = String(input.placement_date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) {
      return { error: "Enter a valid placement date" };
    }
    /* One day of slack for a farmer whose phone clock is ahead, but a
       placement a week in the future is a typo, not a plan. */
    const tomorrow = new Date(Date.now() + DAY).toISOString().slice(0, 10);
    if (d > tomorrow) return { error: "Placement date cannot be in the future" };
    value.placement_date = d;
  }

  if (!partial || input.placed_qty !== undefined) {
    const n = num(input.placed_qty);
    if (!n.ok || n.value === null) return { error: "Number of chicks placed is required" };
    if (!Number.isInteger(n.value) || n.value <= 0) return { error: "Number of chicks must be a whole number above zero" };
    if (n.value > 10_000_000) return { error: "Number of chicks is unrealistically large" };
    value.placed_qty = n.value;
  }

  if (input.poultry_type !== undefined) {
    if (!POULTRY_TYPES.includes(input.poultry_type)) return { error: "Invalid poultry type" };
    value.poultry_type = input.poultry_type;
  }
  if (input.purpose !== undefined) {
    if (!PURPOSES.includes(input.purpose)) return { error: "Invalid purpose" };
    value.purpose = input.purpose;
  }

  for (const f of ["batch_code", "breed", "strain", "hatchery", "doc_supplier", "feed_program"]) {
    if (input[f] !== undefined) value[f] = clean(input[f]);
  }
  if (input.notes !== undefined) value.notes = clean(input.notes, 1000);

  /* Targets: optional, farmer-set, never defaulted. A target the software
      invented would make every variance report a comparison against a guess. */
  const targets = [
    ["placement_avg_weight_g", "Placement weight", 0, 100000],
    ["target_harvest_age_days", "Target harvest age", 1, 1000],
    ["target_weight_g", "Target weight", 0, 100000],
    ["target_fcr", "Target FCR", 0.001, 100],
    ["target_mortality_pct", "Target mortality %", 0, 100],
  ];
  for (const [field, label, min, max] of targets) {
    if (input[field] === undefined) continue;
    const n = num(input[field]);
    if (!n.ok) return { error: `${label} must be a number` };
    if (n.value !== null && (n.value < min || n.value > max)) {
      return { error: `${label} is out of range` };
    }
    if (field === "target_harvest_age_days" && n.value !== null && !Number.isInteger(n.value)) {
      return { error: "Target harvest age must be a whole number of days" };
    }
    value[field] = n.value;
  }

  return { value };
}

/* ── sheds ────────────────────────────────────────────────────────────────── */

export async function listSheds(sql, membership, { includeInactive = false } = {}) {
  /* Filters ride as parameters rather than composed SQL fragments — the same
     shape every other handler here uses, and the one the test harness's
     tagged-template shim can execute. */
  return sql`
    select * from poultry_sheds
     where space_id = ${membership.space_id}
       and deleted_at is null
       and (${!!includeInactive} or status = 'active')
     order by lower(name)`;
}

export async function createShed(sql, membership, actorUserId, input = {}) {
  const { value, error } = validateShedInput(input);
  if (error) throw new HttpError(400, error);

  /* Offline replay lands here twice with the same client_uuid. Resolving it
     with an explicit lookup rather than ON CONFLICT keeps the statement plain
     enough for every driver in the project to run, and returns the original
     row so the caller sees one shed, not an error. */
  const existing = await findByClientUuid(sql, "poultry_sheds", membership.space_id, input.client_uuid);
  if (existing) return existing;

  const [dupe] = await sql`
    select 1 from poultry_sheds
     where space_id = ${membership.space_id} and lower(name) = lower(${value.name})
       and deleted_at is null limit 1`;
  if (dupe) throw new HttpError(409, `A shed named "${value.name}" already exists on this farm.`);

  const [row] = await sql`
    insert into poultry_sheds
      (space_id, name, capacity, area_sqft, ventilation_type, notes, created_by, updated_by, client_uuid)
    values (${membership.space_id}, ${value.name}, ${value.capacity ?? null},
            ${value.area_sqft ?? null}, ${value.ventilation_type ?? null},
            ${value.notes ?? null}, ${actorUserId}, ${actorUserId},
            ${clean(input.client_uuid, 64)})
    returning *`;

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "poultry.shed.created",
    targetType: "poultry_shed", targetId: row.id, meta: { name: row.name } });
  return row;
}

export async function updateShed(sql, membership, actorUserId, { shedId, ...input } = {}) {
  const [existing] = await sql`
    select * from poultry_sheds where id = ${shedId} and deleted_at is null limit 1`;
  requireScope(existing, membership);

  const { value, error } = validateShedInput(input, { partial: true });
  if (error) throw new HttpError(400, error);
  if (Object.keys(value).length === 0) return existing;

  /* Columns listed explicitly (the pattern farm_tasks uses) rather than a
     dynamic SET built from the payload: only these columns can ever be
     written, whatever else arrives in the body. */
  const [row] = await sql`
    update poultry_sheds set
      name             = coalesce(${value.name ?? null}, name),
      capacity         = ${value.capacity !== undefined ? value.capacity : existing.capacity},
      area_sqft        = ${value.area_sqft !== undefined ? value.area_sqft : existing.area_sqft},
      ventilation_type = coalesce(${value.ventilation_type ?? null}, ventilation_type),
      notes            = coalesce(${value.notes ?? null}, notes),
      status           = coalesce(${value.status ?? null}, status),
      updated_by       = ${actorUserId}
     where id = ${shedId} returning *`;

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "poultry.shed.updated",
    targetType: "poultry_shed", targetId: shedId, meta: { fields: Object.keys(value) } });
  return row;
}

/* Archive rather than delete: a shed that held batches is part of their
   history. Refused while live batches still point at it, because a batch whose
   shed silently vanished is a batch nobody can locate on the farm. */
export async function archiveShed(sql, membership, actorUserId, { shedId } = {}) {
  const [existing] = await sql`
    select * from poultry_sheds where id = ${shedId} and deleted_at is null limit 1`;
  requireScope(existing, membership);

  const [{ n }] = await sql`
    select count(*)::int as n from poultry_batches
     where shed_id = ${shedId} and deleted_at is null
       and status in ('draft','active','harvesting','partially_sold')`;
  if (n > 0) {
    throw new HttpError(409, `This shed still has ${n} open batch${n > 1 ? "es" : ""}. Close or move them first.`);
  }

  const [row] = await sql`
    update poultry_sheds set status = 'inactive', updated_by = ${actorUserId}
     where id = ${shedId} returning *`;
  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "poultry.shed.archived",
    targetType: "poultry_shed", targetId: shedId, meta: {} });
  return row;
}

/* ── batches ──────────────────────────────────────────────────────────────── */

/* A shed id supplied with a batch is attacker-controlled like any other id, so
   it is re-read and scope-checked rather than trusted — otherwise a batch
   could be parented to another farm's shed. */
/* Offline idempotency: a queued create replayed after reconnect must return the
   row it already made, not a second one. */
async function findByClientUuid(sql, table, spaceId, clientUuid) {
  const key = clean(clientUuid, 64);
  if (!key) return null;
  const rows = table === "poultry_sheds"
    ? await sql`select * from poultry_sheds where space_id = ${spaceId} and client_uuid = ${key} limit 1`
    : await sql`select * from poultry_batches where space_id = ${spaceId} and client_uuid = ${key} limit 1`;
  return rows[0] || null;
}

async function resolveShed(sql, membership, shedId) {
  if (shedId === undefined || shedId === null || shedId === "") return null;
  const [shed] = await sql`
    select id, space_id from poultry_sheds where id = ${shedId} and deleted_at is null limit 1`;
  requireScope(shed, membership);
  return shed.id;
}

export async function listBatches(sql, membership, { status = null, shedId = null, limit = 100 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const rows = await sql`
    select b.*, s.name as shed_name
      from poultry_batches b
      left join poultry_sheds s on s.id = b.shed_id
     where b.space_id = ${membership.space_id}
       and b.deleted_at is null
       and (${status}::text is null or b.status = ${status})
       and (${shedId}::text is null or b.shed_id::text = ${shedId})
     order by b.placement_date desc, b.created_at desc
     limit ${capped}`;
  return rows.map((b) => decorate(b, membership));
}

export async function getBatch(sql, membership, { batchId } = {}) {
  const [row] = await sql`
    select b.*, s.name as shed_name
      from poultry_batches b
      left join poultry_sheds s on s.id = b.shed_id
     where b.id = ${batchId} and b.deleted_at is null limit 1`;
  requireScope(row, membership);
  return decorate(row, membership);
}

export async function createBatch(sql, membership, actorUserId, input = {}) {
  const { value, error } = validateBatchInput(input);
  if (error) throw new HttpError(400, error);
  const replayed = await findByClientUuid(sql, "poultry_batches", membership.space_id, input.client_uuid);
  if (replayed) return decorate(replayed, membership);
  const shed_id = await resolveShed(sql, membership, input.shed_id);

  const [row] = await sql`
    insert into poultry_batches
      (space_id, shed_id, name, batch_code, poultry_type, purpose, breed, strain,
       hatchery, doc_supplier, placement_date, placed_qty, placement_avg_weight_g,
       target_harvest_age_days, target_weight_g, target_fcr, target_mortality_pct,
       feed_program, notes, status, created_by, updated_by, client_uuid)
    values (${membership.space_id}, ${shed_id}, ${value.name}, ${value.batch_code ?? null},
            ${value.poultry_type ?? "broiler"}, ${value.purpose ?? "meat"},
            ${value.breed ?? null}, ${value.strain ?? null}, ${value.hatchery ?? null},
            ${value.doc_supplier ?? null}, ${value.placement_date}, ${value.placed_qty},
            ${value.placement_avg_weight_g ?? null}, ${value.target_harvest_age_days ?? null},
            ${value.target_weight_g ?? null}, ${value.target_fcr ?? null},
            ${value.target_mortality_pct ?? null}, ${value.feed_program ?? null},
            ${value.notes ?? null}, ${input.status === "active" ? "active" : "draft"},
            ${actorUserId}, ${actorUserId}, ${clean(input.client_uuid, 64)})
    returning *`;

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "poultry.batch.created",
    targetType: "poultry_batch", targetId: row.id,
    meta: { name: row.name, placed_qty: row.placed_qty, status: row.status } });
  return decorate(row, membership);
}

export async function updateBatch(sql, membership, actorUserId, { batchId, ...input } = {}) {
  const [existing] = await sql`
    select * from poultry_batches where id = ${batchId} and deleted_at is null limit 1`;
  requireScope(existing, membership);

  /* A closed cycle is a settled record. Editing it would change a P&L that has
     already been read and acted on, so it must be reopened first — deliberately,
     by an owner, leaving an audit entry. */
  if (["closed", "archived"].includes(existing.status)) {
    throw new HttpError(409, "This batch is closed. Reopen it before making changes.");
  }

  const { value, error } = validateBatchInput(input, { partial: true });
  if (error) throw new HttpError(400, error);
  if (input.shed_id !== undefined) value.shed_id = await resolveShed(sql, membership, input.shed_id);
  if (Object.keys(value).length === 0) return decorate(existing, membership);

  /* shed_id and the numeric targets use an explicit ternary rather than
     coalesce() because clearing them is a real operation — moving a batch out
     of a shed, or removing a target — and coalesce(null, col) would silently
     ignore it. */
  const [row] = await sql`
    update poultry_batches set
      name                    = coalesce(${value.name ?? null}, name),
      batch_code              = coalesce(${value.batch_code ?? null}, batch_code),
      poultry_type            = coalesce(${value.poultry_type ?? null}, poultry_type),
      purpose                 = coalesce(${value.purpose ?? null}, purpose),
      breed                   = coalesce(${value.breed ?? null}, breed),
      strain                  = coalesce(${value.strain ?? null}, strain),
      hatchery                = coalesce(${value.hatchery ?? null}, hatchery),
      doc_supplier            = coalesce(${value.doc_supplier ?? null}, doc_supplier),
      feed_program            = coalesce(${value.feed_program ?? null}, feed_program),
      notes                   = coalesce(${value.notes ?? null}, notes),
      placement_date          = coalesce(${value.placement_date ?? null}, placement_date),
      placed_qty              = coalesce(${value.placed_qty ?? null}, placed_qty),
      shed_id                 = ${value.shed_id !== undefined ? value.shed_id : existing.shed_id},
      placement_avg_weight_g  = ${value.placement_avg_weight_g !== undefined ? value.placement_avg_weight_g : existing.placement_avg_weight_g},
      target_harvest_age_days = ${value.target_harvest_age_days !== undefined ? value.target_harvest_age_days : existing.target_harvest_age_days},
      target_weight_g         = ${value.target_weight_g !== undefined ? value.target_weight_g : existing.target_weight_g},
      target_fcr              = ${value.target_fcr !== undefined ? value.target_fcr : existing.target_fcr},
      target_mortality_pct    = ${value.target_mortality_pct !== undefined ? value.target_mortality_pct : existing.target_mortality_pct},
      updated_by              = ${actorUserId}
     where id = ${batchId} returning *`;

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "poultry.batch.updated",
    targetType: "poultry_batch", targetId: batchId, meta: { fields: Object.keys(value) } });
  return decorate(row, membership);
}

export async function setBatchStatus(sql, membership, actorUserId, { batchId, status, note = null } = {}) {
  const [existing] = await sql`
    select * from poultry_batches where id = ${batchId} and deleted_at is null limit 1`;
  requireScope(existing, membership);

  if (!BATCH_STATUS.includes(status)) throw new HttpError(400, "Unknown batch status");
  if (status === existing.status) return decorate(existing, membership);

  /* Find the rule that produces this status FROM the current one. Two entries
     can target the same status (a forward move and an owner-only reversal);
     the caller gets the one whose `from` matches, so a reversal cannot be
     performed under the forward move's lighter permission. */
  const rule = Object.values(TRANSITIONS)
    .find((r) => (r.alias || Object.keys(TRANSITIONS).find((k) => TRANSITIONS[k] === r)) === status
      && r.from.includes(existing.status));

  if (!rule) {
    throw new HttpError(409, `A batch cannot go from ${existing.status} to ${status}.`);
  }
  if (!memberCan(membership, rule.permission)) {
    throw new HttpError(403, `Not permitted: ${rule.permission}`);
  }

  /* closed_at is stamped on the way in and cleared on a reopen, so it always
     means "when this cycle was last settled" rather than "ever was". */
  const closedAt = status === "closed" ? new Date().toISOString() : null;
  const [row] = await sql`
    update poultry_batches
       set status = ${status},
           closed_at = ${closedAt},
           updated_by = ${actorUserId}
     where id = ${batchId} returning *`;

  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "poultry.batch.status",
    targetType: "poultry_batch", targetId: batchId,
    meta: { from: existing.status, to: status, note: note ? String(note).slice(0, 500) : null } });
  return decorate(row, membership);
}

/* Hard delete only while the batch is a draft nobody has recorded against.
   Anything further along is soft-deleted so its history survives. */
export async function deleteBatch(sql, membership, actorUserId, { batchId } = {}) {
  const [existing] = await sql`
    select * from poultry_batches where id = ${batchId} and deleted_at is null limit 1`;
  requireScope(existing, membership);

  if (existing.status === "draft") {
    await sql`delete from poultry_batches where id = ${batchId}`;
  } else {
    await sql`update poultry_batches set deleted_at = now(), updated_by = ${actorUserId} where id = ${batchId}`;
  }
  await audit(sql, { spaceId: membership.space_id, actorUserId, action: "poultry.batch.deleted",
    targetType: "poultry_batch", targetId: batchId,
    meta: { status: existing.status, hard: existing.status === "draft" } });
  return { id: batchId, deleted: true };
}
