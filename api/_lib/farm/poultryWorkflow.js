/* Poultry Workflow Engine — Phase A.
   Generates daily task lists, tracks follow-up chains, records incident
   guided responses, and produces a daily operational summary.

   ARCHITECTURE RULES (enforced here):
   • P1-P4 tables are the authoritative source of truth. This file only reads
     them; every write to P1-P4 goes through the existing API actions.
   • Tasks reference P1-P4 records (linked_record_id) but never duplicate their
     data. A data_recording task is "done" when the linked P1-P4 row exists,
     regardless of what the task row's status column says.
   • No AI, no notifications, no alertSignals wiring, no cron. Everything here
     is deterministic and pull-based: tasks are generated when the farmer opens
     the workflow tab, not pushed in advance.
   • All writes carry client_uuid for offline idempotency. Server deduplicates
     on (space_id, client_uuid) before inserting.

   DEPENDENCY GRAPH (hardcoded for Phase A; template management UI is Phase B+):
     daily-mortality → daily-env → daily-water → daily-feed-check
   Chain follow-up tasks bypass this graph and always surface at the top of
   their priority tier. */

import { HttpError } from "../http.js";
import { audit, requireScope } from "./gate.js";
import { memberCan } from "./permissions.js";

const memberCanManage = (m) => memberCan(m, "farm.poultry.manage");

/* ── local helpers (intentionally self-contained — same pattern as poultryOps.js
   and poultryHealth.js; no cross-file import so each file compiles alone) ── */

function dateOnly(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const clean = (v, max = 500) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

async function loadBatch(sql, membership, batchId) {
  if (!batchId) throw new HttpError(400, "batchId is required");
  const [batch] = await sql`
    select * from poultry_batches where id = ${batchId} and deleted_at is null limit 1`;
  requireScope(batch, membership);
  return batch;
}

const OPEN_STATUSES = ["draft", "active", "harvesting", "partially_sold"];

function assertWritable(batch, { isCorrection = false, canManage = false } = {}) {
  if (OPEN_STATUSES.includes(batch.status)) return;
  if (isCorrection && canManage) return;
  throw new HttpError(409,
    `This batch is ${batch.status}. Corrections require farm.poultry.manage.`);
}

/* ── pure helpers (exported for unit tests) ─────────────────────────────────── */

/* Days from placement to the target date (0-indexed: Day 0 = placement day). */
export function computeBatchDay(placementDate, targetDate) {
  const placed = dateOnly(placementDate);
  const target = dateOnly(targetDate) || todayStr();
  if (!placed) return null;
  const diff = Date.parse(target) - Date.parse(placed);
  return Math.max(0, Math.floor(diff / 86400000));
}

/* Returns true when a template should fire on the given batch day. */
export function templateFires(template, batchDay, batch) {
  const { trigger_type, trigger_config: cfg, day_from, day_to, poultry_types } = template;

  // Poultry-type filter (null = all types)
  if (poultry_types && poultry_types.length > 0) {
    const bType = batch?.poultry_type || "broiler";
    if (!poultry_types.includes(bType)) return false;
  }

  // Day-range filter
  if (day_from !== null && day_from !== undefined && batchDay < day_from) return false;
  if (day_to !== null && day_to !== undefined && batchDay > day_to) return false;

  switch (trigger_type) {
    case "daily":
      return true;
    case "on_day":
      return batchDay === (cfg?.day ?? 0);
    case "every_n_days": {
      const n = cfg?.every_n_days;
      const start = cfg?.start_day ?? 0;
      if (!n || batchDay < start) return false;
      return (batchDay - start) % n === 0;
    }
    case "reactive":
      return false; // Phase A: reactive tasks are created by follow-up engine only
    default:
      return false;
  }
}

/* Deterministic priority escalation. Returns one of: urgent|high|normal|low */
const PRIORITY_ORDER = ["urgent", "high", "normal", "low"];

export function derivePriority(basePriority, { daysOverdue = 0, signals = {} } = {}) {
  let idx = PRIORITY_ORDER.indexOf(basePriority);
  if (idx < 0) idx = 2; // default to normal

  if (daysOverdue >= 3) return "urgent";
  if (daysOverdue >= 1) idx = Math.max(0, idx - 1);

  if (signals.mortalityOverTarget) idx = Math.max(0, idx - 1);
  if (signals.adgNegative) idx = Math.max(0, idx - 1);

  return PRIORITY_ORDER[idx];
}

/* Same-day dependency graph. A task listed here is blocked until its
   prerequisite is completed (or skipped) for the same day. */
const SAME_DAY_DEPS = {
  "daily-env":        "daily-mortality",
  "daily-water":      "daily-env",
  "daily-feed-check": "daily-water",
};

/* Mutates task objects in-place, setting status = 'blocked' where needed.
   Chain follow-up tasks are never blocked by template dependencies. */
export function resolveTaskDependencies(tasks) {
  const byTemplate = {};
  for (const t of tasks) {
    if (t.template_id) byTemplate[t.template_id] = t;
  }
  for (const task of tasks) {
    if (!task.template_id) continue;
    if (task.task_type === "chain_followup") continue; // chain tasks bypass dep graph
    const depId = SAME_DAY_DEPS[task.template_id];
    if (!depId) continue;
    const dep = byTemplate[depId];
    if (!dep) continue;
    if (!["completed", "skipped"].includes(dep.status) && task.status === "pending") {
      task.status = "blocked";
    }
  }
  return tasks;
}

/* Sort tasks for display. Order (highest first):
   1. priority: urgent > high > normal > low
   2. within same priority: chain_followup before template tasks
   3. within same type: overdue before pending before blocked
   4. within same status: sort_order ascending */
const STATUS_RANK = { overdue: 0, in_progress: 1, pending: 2, blocked: 3 };

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    if (pa !== pb) return pa - pb;

    const ac = a.task_type === "chain_followup" ? 0 : 1;
    const bc = b.task_type === "chain_followup" ? 0 : 1;
    if (ac !== bc) return ac - bc;

    const as_ = STATUS_RANK[a.status] ?? 4;
    const bs_ = STATUS_RANK[b.status] ?? 4;
    if (as_ !== bs_) return as_ - bs_;

    return (a.sort_order || 0) - (b.sort_order || 0);
  });
}

/* Returns the single highest-priority actionable task with an explanation. */
export function computeNextRecommendation(sortedActionable, today) {
  const next = sortedActionable[0];
  if (!next) return { task: null, reason: "All tasks for today are complete." };

  let reason = next.reason;
  if (!reason) {
    if (next.status === "overdue") {
      reason = `Overdue${next.scheduled_date && next.scheduled_date < today
        ? ` since ${next.scheduled_date}` : ""} — complete as soon as possible`;
    } else if (next.task_type === "chain_followup") {
      reason = "Follow-up check is due based on a previously recorded event";
    } else if (next.template_id === "daily-mortality") {
      reason = "Record mortality first — it determines today's risk level";
    } else if (next.status === "blocked") {
      reason = "Complete the prerequisite task first to unlock this one";
    } else {
      reason = "Routine next step";
    }
  }
  return { task: next, reason };
}

/* ── incident classification (pure, deterministic) ─────────────────────────── */

const URGENT_KEYWORDS = [
  "dying", "all dead", "mass death", "sudden death",
  "can't breathe", "cannot breathe", "convulsing", "collapsing",
  "emergency", "outbreak",
];
const HIGH_KEYWORDS = [
  "not eating", "feed drop", "no water", "water stopped",
  "nipples blocked", "drinker blocked", "drinkers blocked",
  "weight loss", "lethargic", "won't eat", "not drinking",
];

export function classifyIncidentSeverity(description, signals = {}) {
  const t = (description || "").toLowerCase();
  if (URGENT_KEYWORDS.some((kw) => t.includes(kw))) return "urgent";
  if ((signals.mortalityPct ?? 0) > 5) return "urgent";
  if ((signals.mortalityDays ?? 0) >= 3 && signals.mortalityOverTarget) return "urgent";
  if (HIGH_KEYWORDS.some((kw) => t.includes(kw))) return "high";
  if (signals.feedDrop50) return "high";
  if (signals.adgNegative && signals.mortalityOverTarget) return "high";
  return "normal";
}

export function classifyIncidentCategory(description) {
  const t = (description || "").toLowerCase();
  if (/water|drinker|nipple|pipe|leak|pressure/.test(t)) return "water";
  if (/feed|eating|hungry|feeder|pellet/.test(t)) return "feed";
  if (/temperature|heat|cold|ventilation|fan|humid/.test(t)) return "environment";
  if (/gasping|sneezing|breath|respiratory|cough|wheez/.test(t)) return "respiratory";
  if (/lameness|leg|walk|unable to stand/.test(t)) return "lameness";
  if (/dropp|diarrhea|loose stool/.test(t)) return "digestive";
  return "health";
}

/* Rule table for guided responses: keyed by category.severity.
   Responses are advisory only — no diagnosis, no medication dosing. */
const GUIDED_RESPONSES = {
  "mortality.urgent": {
    checks: [
      "Count how many birds are affected immediately",
      "Check for a pattern — same corner, same drinker, same feeder area",
      "Look at droppings (color, consistency, volume)",
      "Check all water nipples for flow right now",
      "Check shed temperature — is it above safe limit for this age?",
    ],
    explanations: [
      "Sudden high mortality can indicate water failure, extreme heat stress, acute disease, or poisoning",
      "Localized deaths often point to a blocked drinker or localized problem in that area",
    ],
    actions: [
      "Restore water immediately if any drinker is blocked",
      "Increase ventilation if temperature is high",
      "Record mortality in the Daily tab now",
      "Do not move birds to another shed before calling your veterinarian",
    ],
    what_to_record: "Record mortality in Daily tab. Add urgent health observation in Health tab.",
    escalate_if: "More than 2% of birds affected, or deaths continue after fixing water and temperature.",
  },
  "mortality.high": {
    checks: [
      "Check water nipples for blockage or low pressure",
      "Check shed temperature and ventilation",
      "Examine dead birds for external signs (discoloration, swelling, discharge)",
      "Look at today's feed consumption vs yesterday",
    ],
    explanations: [
      "A mortality spike without warning most often means water or temperature failure",
      "Disease-related mortality usually builds over days — sudden spikes point to management factors first",
    ],
    actions: [
      "Fix any water issues first",
      "Improve ventilation if temperature is high",
      "Record mortality in Daily tab with symptoms",
    ],
    what_to_record: "Record mortality in Daily tab. Add health observation in Health tab.",
    escalate_if: "Mortality rate above 1% of flock in a single day, or increasing over 2 consecutive days.",
  },
  "mortality.normal": {
    checks: [
      "Check water and feed availability",
      "Observe bird behavior and movement",
      "Look for any birds showing signs of illness",
    ],
    explanations: [
      "Minor mortality within expected range may be normal attrition",
    ],
    actions: [
      "Record in Daily tab",
      "Monitor trend over next 2 days",
    ],
    what_to_record: "Record mortality in Daily tab.",
    escalate_if: "Mortality increases or exceeds your target rate over the next 2 days.",
  },
  "water.urgent": {
    checks: [
      "Check main water supply valve — is it open?",
      "Check all water lines for blockages or kinks",
      "Test each nipple drinker individually for flow",
      "Check water tank level or mains pressure",
    ],
    explanations: [
      "Birds can die within hours without water in hot weather",
      "A single blocked line can affect hundreds of birds simultaneously",
    ],
    actions: [
      "Restore water immediately — this is the top priority",
      "If supply cannot be restored, place open containers of water in the shed now",
      "Record the incident in the Health tab",
    ],
    what_to_record: "Add urgent health observation in Health tab. Record any mortality in Daily tab.",
    escalate_if: "Water not restored within 2 hours — call your veterinarian and water supplier.",
  },
  "water.high": {
    checks: [
      "Check all drinker nipples — are they dripping freely when pressed?",
      "Check water line for blockages or air locks",
      "Check tank level and supply pressure",
    ],
    explanations: [
      "Reduced water flow causes feed intake to drop and affects bird growth",
    ],
    actions: [
      "Clear any blocked drinkers",
      "Check pressure regulator if installed",
    ],
    what_to_record: "Add health observation in Health tab.",
    escalate_if: "No water flow from more than 20% of drinkers.",
  },
  "feed.high": {
    checks: [
      "Check all feeders for blockages or caking",
      "Check water availability first — birds won't eat without water",
      "Smell the feed — is there any mold or unusual odor?",
      "Check feeder height — should be level with bird's back",
    ],
    explanations: [
      "Water restriction causes feed intake to drop — always check water first",
      "A full feeder that birds ignore usually means water or quality problems, not the feeder itself",
      "Feeder height matters — birds won't reach a feeder that's too high or too low",
    ],
    actions: [
      "Fix water issues first",
      "Clear any blocked feeders",
      "Adjust feeder height if birds have grown",
      "Record feed consumed in Feed tab",
    ],
    what_to_record: "Record feed in Feed tab. Add health observation if quality issue found.",
    escalate_if: "Birds still not eating by end of day after fixing water and feeders.",
  },
  "feed.normal": {
    checks: [
      "Check water availability",
      "Check feeder levels and flow",
      "Observe bird feeding behavior",
    ],
    explanations: [
      "Minor feed intake variation is normal day to day",
    ],
    actions: [
      "Record feed consumed in Feed tab",
      "Monitor over next 2 days",
    ],
    what_to_record: "Record feed in Feed tab.",
    escalate_if: "Feed intake drops below 70% of the previous day's average.",
  },
  "respiratory.urgent": {
    checks: [
      "Count how many birds are showing respiratory symptoms",
      "Listen for gasping, wheezing, or rattling sounds",
      "Check shed ventilation — is CO2 or ammonia building up?",
      "Check if symptoms spread across the shed or are localized",
    ],
    explanations: [
      "Widespread respiratory symptoms with high mortality suggest acute disease",
      "Poor ventilation can cause respiratory distress without disease",
    ],
    actions: [
      "Increase ventilation immediately",
      "Isolate severely affected birds if possible",
      "Record the observation in the Health tab",
      "Do NOT start medication without veterinary advice",
    ],
    what_to_record: "Add urgent health observation in Health tab with bird count and symptoms.",
    escalate_if: "More than 5% of birds showing symptoms, or any sudden deaths — call your veterinarian now.",
  },
  "respiratory.high": {
    checks: [
      "Check ventilation — ammonia smell is a warning sign",
      "Count affected birds and their location in the shed",
      "Look for nasal discharge or swollen sinuses",
    ],
    explanations: [
      "Respiratory signs can come from poor air quality, temperature swings, or early disease",
    ],
    actions: [
      "Improve ventilation",
      "Record observation with symptoms in Health tab",
    ],
    what_to_record: "Add health observation in Health tab.",
    escalate_if: "Symptoms spread to more birds or you see any sudden deaths.",
  },
  "environment.high": {
    checks: [
      "Check thermometer reading — is it within safe range for this age?",
      "Check all fans and ventilation openings",
      "Check humidity level — high humidity makes heat stress worse",
      "Watch bird behavior: panting or huddling tells you more than the thermometer",
    ],
    explanations: [
      "Broilers are most sensitive to heat stress in the last 2 weeks before harvest",
      "High humidity prevents birds from cooling themselves by panting",
    ],
    actions: [
      "Maximize ventilation immediately",
      "Provide extra water access in hot weather",
      "Record temperature in Daily tab",
    ],
    what_to_record: "Record temperature and humidity in Daily tab.",
    escalate_if: "Temperature above 35°C with no ventilation improvement, or birds dying.",
  },
  "health.urgent": {
    checks: [
      "Count how many birds are affected",
      "Check water nipples for flow",
      "Check shed temperature",
      "Look at droppings for abnormal color or consistency",
      "Check for any pattern — same area, same feeder, same age group",
    ],
    explanations: [
      "Urgent health events most often trace back to water, temperature, or feed quality",
    ],
    actions: [
      "Fix any water or temperature issues first",
      "Record observation in Health tab",
      "Do not start medication without veterinary advice",
    ],
    what_to_record: "Record in Health tab with detailed symptoms and bird count.",
    escalate_if: "More than 2% of birds affected, or the situation worsens over the next 2 hours — call your veterinarian.",
  },
  "health.high": {
    checks: [
      "Check water and feed availability",
      "Observe bird behavior — are they active and eating normally?",
      "Check for physical symptoms — discharge, swelling, abnormal posture",
      "Check droppings",
    ],
    explanations: [
      "Most high-severity observations respond to quick management correction",
    ],
    actions: [
      "Fix any immediate water or feed issues",
      "Record observation in Health tab",
    ],
    what_to_record: "Add health observation in Health tab.",
    escalate_if: "Condition worsens, spreads to more birds, or you see deaths over the next 12 hours.",
  },
  "health.normal": {
    checks: [
      "Check water and feed availability",
      "Observe bird behavior",
      "Look for any visible signs of illness",
    ],
    explanations: [
      "Many minor observations resolve with routine management",
    ],
    actions: [
      "Record your observation",
      "Continue daily monitoring",
    ],
    what_to_record: "Add observation in Health tab.",
    escalate_if: "Condition worsens or affects more birds over the next 24 hours.",
  },
};

const ALWAYS_ESCALATE =
  "If you are unsure or the situation worsens — call your veterinarian.";

export function buildGuidedResponse(category, severity, batchDay) {
  const key = `${category}.${severity}`;
  const rule = GUIDED_RESPONSES[key] || GUIDED_RESPONSES[`health.${severity}`] || GUIDED_RESPONSES["health.normal"];
  return {
    ...rule,
    escalate_if: `${rule.escalate_if} ${ALWAYS_ESCALATE}`.trim(),
    batch_day: batchDay,
    disclaimer: "This is rule-based guidance, not a veterinary diagnosis. Verify with your veterinarian before any treatment.",
  };
}

/* ── P1-P4 completion cross-check ────────────────────────────────────────────
   For data_recording tasks, the task is "done" if the linked P1-P4 row
   exists for the batch and date — regardless of the task row's status.
   Returns a { isTaskDone(templateId) } checker object (no side effects). */

const DAILY_TEMPLATE_IDS = new Set([
  "daily-mortality", "daily-env", "daily-water", "brooding-check", "day0-setup",
]);
const FEED_TEMPLATE_IDS = new Set(["daily-feed-check"]);
const WEIGHT_TEMPLATE_IDS = new Set(["weight-d7", "weight-weekly"]);

async function checkP1P4Completion(sql, batchId, date) {
  const [dailyRow] = await sql`
    select id from poultry_daily_records
    where batch_id = ${batchId} and record_date = ${date} and deleted_at is null limit 1`;
  const [feedRow] = await sql`
    select id from poultry_feed_logs
    where batch_id = ${batchId} and log_date = ${date} and deleted_at is null limit 1`;
  const [weightRow] = await sql`
    select id from poultry_weights
    where batch_id = ${batchId} and weigh_date = ${date} and deleted_at is null limit 1`;

  return {
    isTaskDone(templateId) {
      if (DAILY_TEMPLATE_IDS.has(templateId)) return !!dailyRow;
      if (FEED_TEMPLATE_IDS.has(templateId)) return !!feedRow;
      if (WEIGHT_TEMPLATE_IDS.has(templateId)) return !!weightRow;
      return false;
    },
    dailyRecordId: dailyRow?.id || null,
    feedRecordId: feedRow?.id || null,
    weightRecordId: weightRow?.id || null,
  };
}

/* ── auto-trigger follow-up from P1-P4 events ────────────────────────────────
   These functions are called non-fatally from farm.js AFTER a P4 row is
   committed. They do NOT modify any P1-P4 table or response. If chain
   creation fails (DB error, constraint), farm.js logs and swallows the error —
   the P4 row is always returned to the caller unchanged.

   Idempotency: the derived client_uuid `auto_chain_{type}_{p4RowId}` is stored
   on the chain row. The unique partial index (space_id, client_uuid) prevents
   duplicate chains even if the P4 action is retried. ─────────────────────── */

/* Pure predicate — exported for unit tests.
   Returns true when a health event must auto-create a 1-day follow-up chain:
     treatment  → always
     outbreak   → always
     observation + severity "urgent" → always
     observation (other severity) / vet_visit → never */
export function shouldAutoFollowupHealth(type, severity) {
  if (type === "treatment" || type === "outbreak") return true;
  if (type === "observation" && severity === "urgent") return true;
  return false;
}

/* Pure helper — exported for unit tests. */
export function outcomeClosesChain(outcome) {
  return ["recovered", "resolved", "deceased"].includes(outcome);
}

/* Pure helper — exported for unit tests.
   Validates and normalises the caller-supplied vaccination follow-up interval.
   Accepts any integer >= 1 and <= 365; defaults to 7 when absent or invalid. */
export function vaccinationFollowupDays(payloadDays) {
  const n = Number(payloadDays);
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : 7;
}

/* Auto-create a follow-up chain for treatment, outbreak, and urgent-observation
   health events. Severity is forwarded from the farm.js payload (not stored in
   poultry_health_events — confirmed in migration 0015). */
export async function maybeCreateFollowupFromHealthEvent(
  sql, membership, userId, healthRow, severity = null,
) {
  if (!shouldAutoFollowupHealth(healthRow.type, severity)) return null;
  return _createChainInternal(sql, membership, userId, {
    batchId: healthRow.batch_id,
    chainType: "health",
    sourceType: "health_event",
    sourceId: healthRow.id,
    title: `${healthRow.title} — follow-up check`,
    severity: severity === "urgent" ? "urgent" : "normal",
    followupDays: 1,
    clientUuid: `auto_chain_health_${healthRow.id}`,
  });
}

/* Auto-create a post-vaccination follow-up chain.
   Default interval is 7 days; callers may pass a validated followupDays value
   (use vaccinationFollowupDays() to normalise payload.followup_days first). */
export async function maybeCreateFollowupFromVaccination(
  sql, membership, userId, vaccRow, followupDays = 7,
) {
  return _createChainInternal(sql, membership, userId, {
    batchId: vaccRow.batch_id,
    chainType: "vaccination",
    sourceType: "vaccination",
    sourceId: vaccRow.id,
    title: `${vaccRow.vaccine_name} — post-vaccination check`,
    severity: "normal",
    followupDays,
    clientUuid: `auto_chain_vacc_${vaccRow.id}`,
  });
}

/* ── workflow actions ─────────────────────────────────────────────────────── */

/* Statuses that indicate a live batch the engine should generate tasks for. */
const WORKFLOW_STATUSES = new Set(["active", "harvesting", "partially_sold"]);

/* Generate (and return) today's task list for a batch.
   Inserts missing task rows, updates overdue status, cross-checks P1-P4,
   applies dependency resolution, and returns a sorted list + recommendation.
   Idempotent: calling twice on the same day returns the same list. */
export async function generateTodaysTasks(sql, membership, payload) {
  const { batchId, date } = payload || {};
  const today = date ? dateOnly(date) : todayStr();
  if (!today) throw new HttpError(400, "Enter a valid date");

  const batch = await loadBatch(sql, membership, batchId);

  if (!WORKFLOW_STATUSES.has(batch.status)) {
    return { tasks: [], recommendation: null, batchDay: null, status: batch.status };
  }

  const batchDay = computeBatchDay(batch.placement_date, today);

  // Load all active templates once.
  const templates = await sql`
    select * from poultry_task_templates where active = true order by sort_order`;

  // Load all task rows that already exist for this batch + today.
  const todayRows = await sql`
    select * from poultry_batch_tasks
    where batch_id = ${batchId} and scheduled_date = ${today} and deleted_at is null`;
  const byTemplate = new Map();
  for (const t of todayRows) {
    if (t.template_id) byTemplate.set(t.template_id, t);
  }

  // Determine which templates fire today and insert missing rows.
  const inserts = [];
  for (const tmpl of templates) {
    if (!templateFires(tmpl, batchDay, batch)) continue;
    if (byTemplate.has(tmpl.id)) continue; // already exists — skip
    inserts.push({
      space_id: membership.space_id,
      batch_id: batchId,
      template_id: tmpl.id,
      task_type: tmpl.task_type,
      category: tmpl.category,
      scheduled_date: today,
      batch_day: batchDay,
      title: tmpl.title,
      priority: tmpl.default_priority,
      sort_order: tmpl.sort_order,
      source: "engine",
    });
  }

  let allTasks = [...todayRows];
  if (inserts.length > 0) {
    const cols = [
      "space_id", "batch_id", "template_id", "task_type", "category",
      "scheduled_date", "batch_day", "title", "priority", "sort_order", "source",
    ];
    const newRows = await sql`
      insert into poultry_batch_tasks ${sql(inserts, ...cols)} returning *`;
    for (const t of newRows) {
      if (t.template_id) byTemplate.set(t.template_id, t);
      allTasks.push(t);
    }
  }

  // Mark pending tasks from previous days as overdue (lazy detection).
  await sql`
    update poultry_batch_tasks
    set status = 'overdue', updated_at = now()
    where batch_id = ${batchId}
      and scheduled_date < ${today}
      and status = 'pending'
      and deleted_at is null`;

  // Load overdue tasks from previous days (capped at 20 to avoid flooding
  // historical batches with hundreds of missed tasks on first load).
  const overdueRows = await sql`
    select * from poultry_batch_tasks
    where batch_id = ${batchId}
      and scheduled_date < ${today}
      and status in ('overdue','in_progress')
      and deleted_at is null
    order by scheduled_date desc
    limit 20`;

  // Load chain tasks due today from active chains.
  const chainTasks = await sql`
    select t.* from poultry_batch_tasks t
    join poultry_followup_chains c on c.id = t.chain_id
    where t.batch_id = ${batchId}
      and t.scheduled_date = ${today}
      and c.status = 'active'
      and t.status not in ('completed','skipped','cancelled')
      and t.deleted_at is null`;

  // Add chain tasks not already in allTasks.
  const existingIds = new Set(allTasks.map((t) => t.id));
  for (const ct of chainTasks) {
    if (!existingIds.has(ct.id)) allTasks.push(ct);
  }

  // P1-P4 cross-check: auto-complete data_recording tasks when P1-P4 records exist.
  const p1p4 = await checkP1P4Completion(sql, batchId, today);
  const toComplete = [];
  for (const task of allTasks) {
    if (["completed", "skipped", "cancelled"].includes(task.status)) continue;
    if (!task.template_id) continue;
    if (!p1p4.isTaskDone(task.template_id)) continue;
    toComplete.push(task.id);
    task.status = "completed";
    task.completed_at = new Date().toISOString();
  }
  if (toComplete.length > 0) {
    await sql`
      update poultry_batch_tasks
      set status = 'completed', completed_at = now(), updated_at = now()
      where id = any(${toComplete}::uuid[]) and deleted_at is null`;
  }

  // Resolve same-day dependencies for today's tasks.
  resolveTaskDependencies(allTasks);

  // Combine and sort: today's tasks + overdue from previous days.
  const combined = sortTasks([...allTasks, ...overdueRows.filter((t) => !existingIds.has(t.id))]);

  const actionable = combined.filter(
    (t) => !["completed", "skipped", "cancelled"].includes(t.status),
  );
  const recommendation = computeNextRecommendation(actionable, today);

  return { tasks: combined, recommendation, batchDay };
}

/* Mark a task complete. For data_recording tasks the caller should supply the
   linked P1-P4 record id (obtained from the P1-P4 action they called first).
   chain_followup tasks are rejected here — they require record_outcome. */
export async function markTaskComplete(sql, membership, userId, payload) {
  const { taskId, linkedRecordId, linkedRecordType, notes, clientUuid } = payload || {};
  if (!taskId) throw new HttpError(400, "taskId is required");

  // Idempotency: if we've seen this client_uuid before, return the prior result.
  if (clientUuid) {
    const key = clean(clientUuid, 64);
    const [prior] = await sql`
      select * from poultry_batch_tasks
      where space_id = ${membership.space_id} and client_uuid = ${key} and deleted_at is null limit 1`;
    if (prior) return prior;
  }

  const [task] = await sql`
    select * from poultry_batch_tasks where id = ${taskId} and deleted_at is null limit 1`;
  if (!task) throw new HttpError(404, "Task not found");
  requireScope(task, membership);

  if (["completed", "skipped", "cancelled"].includes(task.status)) return task;

  if (task.task_type === "chain_followup") {
    throw new HttpError(400,
      "Chain follow-up tasks require outcome recording via poultry.followup.record_outcome");
  }

  // Overdue tasks require manage permission.
  if (task.status === "overdue" && !memberCanManage(membership)) {
    throw new HttpError(403, "Completing an overdue task requires farm.poultry.manage");
  }

  const [updated] = await sql`
    update poultry_batch_tasks
    set status = 'completed',
        completed_at = now(),
        completed_by = ${userId},
        notes = ${clean(notes, 1000)},
        linked_record_id = ${linkedRecordId || null},
        linked_record_type = ${linkedRecordType || null},
        client_uuid = ${clientUuid ? clean(clientUuid, 64) : null},
        updated_at = now()
    where id = ${taskId} and deleted_at is null
    returning *`;

  await audit(sql, {
    spaceId: membership.space_id,
    actorUserId: userId,
    action: "poultry.workflow.task.completed",
    targetType: "poultry_batch_tasks",
    targetId: taskId,
    meta: { task_type: task.task_type, template_id: task.template_id },
  });
  return updated;
}

/* Skip a task. Requires farm.poultry.manage (enforced in routing table). */
export async function skipTask(sql, membership, userId, payload) {
  const { taskId, reason, notes, clientUuid } = payload || {};
  if (!taskId) throw new HttpError(400, "taskId is required");
  if (!reason) throw new HttpError(400, "reason is required for skipping a task");

  const SKIP_REASONS = [
    "Not applicable today",
    "Will complete later",
    "Birds did not require it",
    "Manual override",
  ];
  if (!SKIP_REASONS.includes(reason)) {
    throw new HttpError(400, `reason must be one of: ${SKIP_REASONS.join(", ")}`);
  }

  if (clientUuid) {
    const key = clean(clientUuid, 64);
    const [prior] = await sql`
      select * from poultry_batch_tasks
      where space_id = ${membership.space_id} and client_uuid = ${key} and deleted_at is null limit 1`;
    if (prior) return prior;
  }

  const [task] = await sql`
    select * from poultry_batch_tasks where id = ${taskId} and deleted_at is null limit 1`;
  if (!task) throw new HttpError(404, "Task not found");
  requireScope(task, membership);
  if (["completed", "skipped", "cancelled"].includes(task.status)) return task;

  const [updated] = await sql`
    update poultry_batch_tasks
    set status = 'skipped',
        skipped_at = now(),
        skipped_by = ${userId},
        skipped_reason = ${reason},
        notes = ${clean(notes, 500)},
        client_uuid = ${clientUuid ? clean(clientUuid, 64) : null},
        updated_at = now()
    where id = ${taskId} and deleted_at is null
    returning *`;

  await audit(sql, {
    spaceId: membership.space_id,
    actorUserId: userId,
    action: "poultry.workflow.task.skipped",
    targetType: "poultry_batch_tasks",
    targetId: taskId,
    meta: { reason },
  });
  return updated;
}

/* Unified timeline: P1-P4 events + workflow tasks + incidents + outcomes,
   all sorted by date. Reads only — never writes to any table. */
export async function buildTimeline(sql, membership, payload) {
  const { batchId } = payload || {};
  const batch = await loadBatch(sql, membership, batchId);

  const [daily, weights, feed, health, vacc, tasks, incidents, sales, costs] = await Promise.all([
    sql`select id, record_date as event_date, 'daily_record' as event_kind,
               mortality, culls, temp_c, remarks
          from poultry_daily_records
         where batch_id = ${batchId} and deleted_at is null
         order by record_date`,
    sql`select id, weigh_date as event_date, 'weight' as event_kind,
               average_weight_g, sample_count
          from poultry_weights
         where batch_id = ${batchId} and deleted_at is null
         order by weigh_date`,
    sql`select id, log_date as event_date, 'feed_log' as event_kind, kind, quantity_kg
          from poultry_feed_logs
         where batch_id = ${batchId} and deleted_at is null
         order by log_date`,
    sql`select id, event_date, 'health_event' as event_kind, type as health_type,
               title, medicine
          from poultry_health_events
         where batch_id = ${batchId} and deleted_at is null
         order by event_date`,
    sql`select id, given_at as event_date, 'vaccination' as event_kind,
               vaccine_name, route
          from poultry_vaccinations
         where batch_id = ${batchId} and deleted_at is null
         order by given_at`,
    sql`select * from poultry_batch_tasks
         where batch_id = ${batchId} and deleted_at is null
         order by scheduled_date, sort_order`,
    sql`select id, created_at as event_date, 'incident' as event_kind,
               severity, description, status, batch_day
          from poultry_incidents
         where batch_id = ${batchId} and deleted_at is null
         order by created_at`,
    sql`select id, sale_date as event_date, 'sale' as event_kind,
               buyer_name, birds_sold, gross_amount, net_revenue
          from poultry_batch_sales
         where batch_id = ${batchId} and deleted_at is null
         order by sale_date`,
    sql`select id, cost_date as event_date, 'batch_cost' as event_kind,
               category, description, amount
          from poultry_batch_costs
         where batch_id = ${batchId} and deleted_at is null
         order by cost_date`,
  ]);

  // Flatten tasks + outcomes together.
  const taskIds = tasks.map((t) => t.id);
  const outcomes = taskIds.length > 0
    ? await sql`
        select o.*, t.scheduled_date as task_date
          from poultry_followup_outcomes o
          join poultry_batch_tasks t on t.id = o.task_id
         where o.task_id = any(${taskIds}::uuid[])
         order by o.created_at`
    : [];

  const mapDate = (e, field = "event_date") => {
    const d = dateOnly(e[field] || e.scheduled_date || e.created_at);
    return { ...e, event_date: d };
  };

  const allEvents = [
    ...daily.map((e) => mapDate(e)),
    ...weights.map((e) => mapDate(e)),
    ...feed.map((e) => mapDate(e)),
    ...health.map((e) => mapDate(e)),
    ...vacc.map((e) => mapDate(e)),
    ...tasks.map((e) => ({ ...e, event_date: dateOnly(e.scheduled_date), event_kind: "task" })),
    ...incidents.map((e) => mapDate(e)),
    ...outcomes.map((e) => ({ ...e, event_date: dateOnly(e.recorded_at), event_kind: "outcome" })),
    ...sales.map((e) => mapDate(e)),
    ...costs.map((e) => mapDate(e)),
  ].sort((a, b) => {
    const da = a.event_date || "";
    const db = b.event_date || "";
    return da < db ? -1 : da > db ? 1 : 0;
  });

  return { batch: { id: batch.id, name: batch.name, placement_date: batch.placement_date, status: batch.status }, timeline: allEvents };
}

/* ── incident actions ─────────────────────────────────────────────────────── */

export async function reportIncident(sql, membership, userId, payload) {
  const { batchId, description, signals = {}, clientUuid } = payload || {};
  if (!batchId) throw new HttpError(400, "batchId is required");
  if (!description || !description.trim()) throw new HttpError(400, "description is required");

  if (clientUuid) {
    const key = clean(clientUuid, 64);
    const [prior] = await sql`
      select * from poultry_incidents
      where space_id = ${membership.space_id} and client_uuid = ${key} and deleted_at is null limit 1`;
    if (prior) return prior;
  }

  const batch = await loadBatch(sql, membership, batchId);
  assertWritable(batch);

  const batchDay = computeBatchDay(batch.placement_date, todayStr());
  const severity = classifyIncidentSeverity(description, signals);
  const category = classifyIncidentCategory(description);
  const guidedResponse = buildGuidedResponse(category, severity, batchDay);

  // Snapshot the batch context provided by the caller (or minimal fallback).
  const batchContext = typeof signals === "object" ? { ...signals, batch_day: batchDay } : { batch_day: batchDay };

  const [incident] = await sql`
    insert into poultry_incidents
      (space_id, batch_id, batch_day, status, severity, description,
       batch_context, guided_response, reported_by, client_uuid)
    values
      (${membership.space_id}, ${batchId}, ${batchDay}, 'open', ${severity},
       ${description.trim()}, ${sql.json(batchContext)}, ${sql.json(guidedResponse)},
       ${userId}, ${clientUuid ? clean(clientUuid, 64) : null})
    returning *`;

  // Auto-create a follow-up chain for high/urgent incidents.
  let chain = null;
  if (severity !== "normal") {
    chain = await _createChainInternal(sql, membership, userId, {
      batchId,
      chainType: "incident",
      sourceType: "incident",
      sourceId: incident.id,
      title: `Incident follow-up: ${description.trim().slice(0, 80)}`,
      severity,
      followupDays: 1,
    });

    // Link the chain to the incident.
    await sql`
      update poultry_incidents set chain_id = ${chain.id}, updated_at = now()
      where id = ${incident.id}`;
  }

  await audit(sql, {
    spaceId: membership.space_id,
    actorUserId: userId,
    action: "poultry.incident.reported",
    targetType: "poultry_incidents",
    targetId: incident.id,
    meta: { severity, category, batch_day: batchDay },
  });

  return { ...incident, chain_id: chain?.id || null, guided_response: guidedResponse };
}

export async function listIncidents(sql, membership, payload) {
  const { batchId, status, limit = 50, offset = 0 } = payload || {};
  if (!batchId) throw new HttpError(400, "batchId is required");
  await loadBatch(sql, membership, batchId); // scope-check

  const statusFilter = status ? sql`and status = ${status}` : sql``;
  return sql`
    select * from poultry_incidents
    where batch_id = ${batchId} and deleted_at is null ${statusFilter}
    order by created_at desc
    limit ${Math.min(limit, 100)} offset ${offset}`;
}

export async function resolveIncident(sql, membership, userId, payload) {
  const { incidentId, notes } = payload || {};
  if (!incidentId) throw new HttpError(400, "incidentId is required");

  const [incident] = await sql`
    select * from poultry_incidents where id = ${incidentId} and deleted_at is null limit 1`;
  if (!incident) throw new HttpError(404, "Incident not found");
  requireScope(incident, membership);
  if (incident.status === "resolved") return incident;

  const [updated] = await sql`
    update poultry_incidents
    set status = 'resolved',
        resolution_notes = ${clean(notes, 2000)},
        resolved_at = now(),
        resolved_by = ${userId},
        updated_at = now()
    where id = ${incidentId} and deleted_at is null
    returning *`;

  await audit(sql, {
    spaceId: membership.space_id,
    actorUserId: userId,
    action: "poultry.incident.resolved",
    targetType: "poultry_incidents",
    targetId: incidentId,
    meta: {},
  });
  return updated;
}

/* ── template actions ────────────────────────────────────────────────────── */

export async function listTemplates(sql, _membership, payload) {
  const { activeOnly = true } = payload || {};
  return sql`
    select * from poultry_task_templates
    ${activeOnly ? sql`where active = true` : sql``}
    order by category, sort_order`;
}

/* ── follow-up chain actions ─────────────────────────────────────────────── */

/* Internal helper used by both createFollowupChain (public) and
   reportIncident (which auto-creates chains). */
async function _createChainInternal(sql, membership, userId, opts) {
  const {
    batchId, chainType, sourceType, sourceId, title, severity = "normal",
    followupDays = 1, clientUuid,
  } = opts;

  if (clientUuid) {
    const key = clean(clientUuid, 64);
    const [prior] = await sql`
      select * from poultry_followup_chains
      where space_id = ${membership.space_id} and client_uuid = ${key} and deleted_at is null limit 1`;
    if (prior) return prior;
  }

  const batch = await loadBatch(sql, membership, batchId);
  const batchDay = computeBatchDay(batch.placement_date, todayStr());

  const [chain] = await sql`
    insert into poultry_followup_chains
      (space_id, batch_id, chain_type, status, severity, title,
       source_type, source_id, batch_day, triggered_by, client_uuid)
    values
      (${membership.space_id}, ${batchId}, ${chainType}, 'active', ${severity},
       ${title.trim().slice(0, 500)}, ${sourceType}, ${sourceId || null},
       ${batchDay}, ${userId}, ${clientUuid ? clean(clientUuid, 64) : null})
    returning *`;

  // Schedule the first follow-up task.
  await _scheduleChainTask(sql, membership, batchId, chain, batchDay, followupDays);
  return chain;
}

async function _scheduleChainTask(sql, membership, batchId, chain, currentBatchDay, followupDays) {
  if (!followupDays || followupDays < 1) return null;

  const today = todayStr();
  const scheduledDate = new Date(Date.parse(today) + followupDays * 86400000)
    .toISOString().slice(0, 10);
  const nextBatchDay = currentBatchDay + followupDays;

  // Duplicate prevention: don't create a second pending task for the same chain in the near future.
  const [existing] = await sql`
    select id from poultry_batch_tasks
    where chain_id = ${chain.id}
      and status not in ('completed','skipped','cancelled')
      and scheduled_date between ${today}::date and ${today}::date + 7
      and deleted_at is null
    limit 1`;
  if (existing) return existing;

  const [task] = await sql`
    insert into poultry_batch_tasks
      (space_id, batch_id, chain_id, task_type, category, scheduled_date,
       batch_day, title, priority, source, reason, sort_order)
    values
      (${membership.space_id}, ${batchId}, ${chain.id}, 'chain_followup', 'health',
       ${scheduledDate}, ${nextBatchDay},
       ${"Follow-up: " + chain.title.slice(0, 120)},
       ${chain.severity === "urgent" ? "urgent" : chain.severity === "high" ? "high" : "normal"},
       'engine',
       ${"Follow-up scheduled from: " + chain.title.slice(0, 200)},
       10)
    returning *`;
  return task;
}

export async function createFollowupChain(sql, membership, userId, payload) {
  const {
    batchId, chainType = "health", sourceType, sourceId, title, severity,
    followupDays = 1, clientUuid,
  } = payload || {};
  if (!batchId) throw new HttpError(400, "batchId is required");
  if (!sourceType) throw new HttpError(400, "sourceType is required");
  if (!title || !title.trim()) throw new HttpError(400, "title is required");

  const validSourceTypes = ["health_event", "vaccination", "incident", "manual"];
  if (!validSourceTypes.includes(sourceType)) {
    throw new HttpError(400, `sourceType must be one of: ${validSourceTypes.join(", ")}`);
  }

  const chain = await _createChainInternal(sql, membership, userId, {
    batchId, chainType, sourceType, sourceId, title,
    severity: severity || "normal", followupDays, clientUuid,
  });

  await audit(sql, {
    spaceId: membership.space_id,
    actorUserId: userId,
    action: "poultry.followup.chain.created",
    targetType: "poultry_followup_chains",
    targetId: chain.id,
    meta: { sourceType, severity, followupDays },
  });

  // Load the first task created for this chain.
  const [firstTask] = await sql`
    select * from poultry_batch_tasks
    where chain_id = ${chain.id} and deleted_at is null
    order by scheduled_date limit 1`;

  return { chain, task: firstTask || null };
}

/* Record the outcome of a chain follow-up task.
   If the issue is resolved, closes the chain and cancels remaining tasks.
   Otherwise, schedules the next follow-up task if nextFollowupDays is given. */
export async function recordFollowupOutcome(sql, membership, userId, payload) {
  const {
    chainId, taskId, outcome, observationNotes, actionTaken,
    nextLinkedEventType, nextLinkedEventId, nextFollowupDays, clientUuid,
  } = payload || {};
  if (!chainId) throw new HttpError(400, "chainId is required");
  if (!taskId) throw new HttpError(400, "taskId is required");
  if (!outcome) throw new HttpError(400, "outcome is required");

  const VALID_OUTCOMES = ["improved", "same", "worse", "recovered", "resolved", "deceased"];
  if (!VALID_OUTCOMES.includes(outcome)) {
    throw new HttpError(400, `outcome must be one of: ${VALID_OUTCOMES.join(", ")}`);
  }

  // Idempotency.
  if (clientUuid) {
    const key = clean(clientUuid, 64);
    const [prior] = await sql`
      select * from poultry_followup_outcomes
      where space_id = ${membership.space_id} and client_uuid = ${key} limit 1`;
    if (prior) return { outcome: prior };
  }

  const [chain] = await sql`
    select * from poultry_followup_chains where id = ${chainId} and deleted_at is null limit 1`;
  if (!chain) throw new HttpError(404, "Follow-up chain not found");
  requireScope(chain, membership);
  if (chain.status !== "active") throw new HttpError(409, "This follow-up chain is already closed");

  const [task] = await sql`
    select * from poultry_batch_tasks where id = ${taskId} and deleted_at is null limit 1`;
  if (!task) throw new HttpError(404, "Task not found");
  if (task.chain_id !== chainId) throw new HttpError(400, "Task does not belong to this chain");
  if (["completed", "skipped", "cancelled"].includes(task.status)) {
    throw new HttpError(409, "This task is already closed");
  }

  const batchDay = computeBatchDay(chain.triggered_at, todayStr());

  // Determine if this outcome resolves the chain.
  const isResolution = ["recovered", "resolved", "deceased"].includes(outcome);
  const resolvedFollowupDays = isResolution ? null : (nextFollowupDays ?? 1);

  // Record outcome.
  const [recorded] = await sql`
    insert into poultry_followup_outcomes
      (space_id, chain_id, task_id, batch_day, recorded_by, outcome,
       observation_notes, action_taken,
       next_linked_event_type, next_linked_event_id,
       next_followup_days, client_uuid)
    values
      (${membership.space_id}, ${chainId}, ${taskId}, ${batchDay}, ${userId}, ${outcome},
       ${clean(observationNotes, 2000)}, ${actionTaken || null},
       ${nextLinkedEventType || null}, ${nextLinkedEventId || null},
       ${resolvedFollowupDays}, ${clientUuid ? clean(clientUuid, 64) : null})
    returning *`;

  // Complete the task.
  await sql`
    update poultry_batch_tasks
    set status = 'completed', completed_at = now(), completed_by = ${userId}, updated_at = now()
    where id = ${taskId} and deleted_at is null`;

  let nextTask = null;
  if (isResolution) {
    // Resolve the chain and cancel all remaining pending tasks.
    await sql`
      update poultry_followup_chains
      set status = 'resolved', resolved_at = now(), resolved_by = ${userId}, updated_at = now()
      where id = ${chainId}`;
    await sql`
      update poultry_batch_tasks
      set status = 'cancelled', cancelled_at = now(), cancelled_by = ${userId},
          cancelled_reason = 'Chain resolved', updated_at = now()
      where chain_id = ${chainId}
        and status not in ('completed','skipped','cancelled')
        and deleted_at is null`;
  } else if (resolvedFollowupDays && resolvedFollowupDays >= 1) {
    nextTask = await _scheduleChainTask(
      sql, membership, chain.batch_id, chain,
      batchDay, resolvedFollowupDays,
    );
  }

  await audit(sql, {
    spaceId: membership.space_id,
    actorUserId: userId,
    action: "poultry.followup.outcome.recorded",
    targetType: "poultry_followup_outcomes",
    targetId: recorded.id,
    meta: { outcome, chainId, isResolution },
  });

  const [updatedChain] = await sql`
    select * from poultry_followup_chains where id = ${chainId} limit 1`;
  return { outcome: recorded, nextTask, chain: updatedChain };
}

export async function getChainDetail(sql, membership, payload) {
  const { chainId } = payload || {};
  if (!chainId) throw new HttpError(400, "chainId is required");

  const [chain] = await sql`
    select * from poultry_followup_chains where id = ${chainId} and deleted_at is null limit 1`;
  if (!chain) throw new HttpError(404, "Chain not found");
  requireScope(chain, membership);

  const [tasks, outcomes, batchRows] = await Promise.all([
    sql`select * from poultry_batch_tasks
         where chain_id = ${chainId} and deleted_at is null order by scheduled_date`,
    sql`select * from poultry_followup_outcomes
         where chain_id = ${chainId} order by created_at`,
    sql`select id, name, batch_code from poultry_batches where id = ${chain.batch_id} limit 1`,
  ]);

  const batch = batchRows[0] || null;

  let sourceEvent = null;
  if (chain.source_id) {
    if (chain.source_type === "health_event") {
      const [row] = await sql`
        select title, note from poultry_health_events where id = ${chain.source_id} limit 1`;
      if (row) sourceEvent = { title: row.title, detail: row.note || null };
    } else if (chain.source_type === "vaccination") {
      const [row] = await sql`
        select vaccine_name, note from poultry_vaccinations where id = ${chain.source_id} limit 1`;
      if (row) sourceEvent = { title: row.vaccine_name, detail: row.note || null };
    } else if (chain.source_type === "incident") {
      const [row] = await sql`
        select description from poultry_incidents where id = ${chain.source_id} limit 1`;
      if (row) sourceEvent = { title: row.description, detail: null };
    }
  }

  return { chain, tasks, outcomes, batch, sourceEvent };
}

export async function cancelChain(sql, membership, userId, payload) {
  const { chainId, reason } = payload || {};
  if (!chainId) throw new HttpError(400, "chainId is required");

  const [chain] = await sql`
    select * from poultry_followup_chains where id = ${chainId} and deleted_at is null limit 1`;
  if (!chain) throw new HttpError(404, "Chain not found");
  requireScope(chain, membership);
  if (chain.status !== "active") return chain; // idempotent

  await sql`
    update poultry_followup_chains
    set status = 'cancelled', resolved_at = now(), resolved_by = ${userId},
        resolution_notes = ${clean(reason, 500)}, updated_at = now()
    where id = ${chainId}`;
  await sql`
    update poultry_batch_tasks
    set status = 'cancelled', cancelled_at = now(), cancelled_by = ${userId},
        cancelled_reason = ${clean(reason, 200) || 'Chain cancelled'}, updated_at = now()
    where chain_id = ${chainId}
      and status not in ('completed','skipped','cancelled')
      and deleted_at is null`;

  await audit(sql, {
    spaceId: membership.space_id,
    actorUserId: userId,
    action: "poultry.followup.chain.cancelled",
    targetType: "poultry_followup_chains",
    targetId: chainId,
    meta: { reason },
  });

  const [updated] = await sql`select * from poultry_followup_chains where id = ${chainId} limit 1`;
  return updated;
}

/* ── daily summary ───────────────────────────────────────────────────────── */

/* Generates a complete daily operational summary for one batch.
   Purely read-side — does not create or modify any records. */
export async function generateDailySummary(sql, membership, payload) {
  const { batchId, date } = payload || {};
  const today = date ? dateOnly(date) : todayStr();
  if (!today) throw new HttpError(400, "Enter a valid date");
  if (!batchId) throw new HttpError(400, "batchId is required");

  const batch = await loadBatch(sql, membership, batchId);
  const batchDay = computeBatchDay(batch.placement_date, today);

  // Generate today's tasks (also applies overdue detection + P1-P4 cross-check).
  const { tasks: allTasks, recommendation } = await generateTodaysTasks(
    sql, membership, { batchId, date: today },
  );

  const todayTasks = allTasks.filter((t) => dateOnly(t.scheduled_date) === today);
  const overdueTasks = allTasks.filter(
    (t) => t.status === "overdue" && dateOnly(t.scheduled_date) < today,
  );

  // P1-P4 record counts for today.
  const [[dailyC], [feedC], [weightC], [healthC], [vaccC]] = await Promise.all([
    sql`select count(*)::int as c from poultry_daily_records where batch_id = ${batchId} and record_date = ${today} and deleted_at is null`,
    sql`select count(*)::int as c from poultry_feed_logs where batch_id = ${batchId} and log_date = ${today} and deleted_at is null`,
    sql`select count(*)::int as c from poultry_weights where batch_id = ${batchId} and weigh_date = ${today} and deleted_at is null`,
    sql`select count(*)::int as c from poultry_health_events where batch_id = ${batchId} and event_date = ${today} and deleted_at is null`,
    sql`select count(*)::int as c from poultry_vaccinations where batch_id = ${batchId} and given_at = ${today} and deleted_at is null`,
  ]);

  // Upcoming tasks (next 7 days, excluding today).
  const upcoming = await sql`
    select * from poultry_batch_tasks
    where batch_id = ${batchId}
      and scheduled_date > ${today}::date
      and scheduled_date <= ${today}::date + 7
      and status in ('pending','blocked')
      and deleted_at is null
    order by scheduled_date, sort_order
    limit 30`;

  // Active chains (for the "Attention needed" section).
  const activeChains = await sql`
    select * from poultry_followup_chains
    where batch_id = ${batchId} and status = 'active' and deleted_at is null
    order by severity desc, triggered_at asc`;

  // Open incidents.
  const openIncidents = await sql`
    select id, severity, description, batch_day, created_at, chain_id, guided_response
    from poultry_incidents
    where batch_id = ${batchId} and status in ('open','investigating') and deleted_at is null
    order by created_at desc limit 10`;

  return {
    date: today,
    batchId,
    batchName: batch.name,
    batchDay,
    batchStatus: batch.status,
    summary: {
      completed: {
        tasks: todayTasks.filter((t) => t.status === "completed"),
        p1p4_records: {
          daily_records: Number(dailyC.c),
          feed_logs: Number(feedC.c),
          weights: Number(weightC.c),
          health_events: Number(healthC.c),
          vaccinations: Number(vaccC.c),
        },
      },
      pending: {
        tasks: todayTasks.filter((t) => ["pending", "in_progress", "blocked"].includes(t.status)),
      },
      overdue: { tasks: overdueTasks },
      upcoming: { tasks: upcoming },
      attention: {
        active_chains: activeChains,
        open_incidents: openIncidents,
      },
      recommendation,
    },
  };
}
