/* Farm Space permissions — SERVER-side, unlike src/services/rbac/permissions.js.

   The app already has a role matrix, and it is deliberately not reused here.
   That one says of itself: "this is NOT server-enforced multi-user auth — it's
   a device-local 'who's holding the phone' gate". It decides what to hide on a
   shared handset. This one decides what a request is allowed to touch, on a
   server, where the caller controls the client. Same shape so it reads
   familiarly; entirely different trust model.

   Pure and data-driven: no database, no request object, so the matrix is
   trivially testable and the gate that uses it stays small. */

export const ROLES = ["owner", "manager", "supervisor", "worker"];

export const ROLE_META = {
  owner:      { rank: 3, label: { en: "Owner",      hi: "मालिक",     bn: "মালিক" } },
  manager:    { rank: 2, label: { en: "Manager",    hi: "प्रबंधक",    bn: "ম্যানেজার" } },
  supervisor: { rank: 1, label: { en: "Supervisor", hi: "पर्यवेक्षक", bn: "সুপারভাইজার" } },
  worker:     { rank: 0, label: { en: "Worker",     hi: "कर्मचारी",   bn: "কর্মী" } },
};

export const PERMISSIONS = [
  "farm.view",
  "farm.members.view",
  "farm.members.manage",
  "farm.tasks.view",
  "farm.tasks.create",
  "farm.tasks.assign",
  "farm.tasks.update",
  "farm.tasks.verify",
  "farm.attendance.view",
  "farm.attendance.manage",
  "farm.announcement.create",
  "farm.chat.view",
  "farm.chat.send",
  "farm.documents.view",
  "farm.documents.manage",
  "farm.settings.manage",
  /* Poultry (Broiler Farm Management). Split four ways because the jobs are
     genuinely different people: everyone in the farm reads the batch, the
     stockman records the day, a manager sets up batches and targets, money is
     narrower still, and only the owner closes a cycle. Adding entries here is
     additive — memberCan() only honours keys present in this list, so a
     member row that predates them is unaffected. */
  "farm.poultry.view",
  "farm.poultry.record",
  "farm.poultry.manage",
  "farm.poultry.finance",
  "farm.poultry.close",
  /* Dairy (Individual Animal Management). Four levels: reading the herd,
     recording daily milk/health/events, managing animals and lactations,
     and accessing financials. No close permission — dairy has no batch-cycle
     concept to freeze. */
  "farm.dairy.view",
  "farm.dairy.record",
  "farm.dairy.manage",
  "farm.dairy.finance",
  /* Goat / small ruminant. Same four levels as dairy. */
  "farm.goat.view",
  "farm.goat.record",
  "farm.goat.manage",
  "farm.goat.finance",
  /* Pig / swine. Same four levels. */
  "farm.pig.view",
  "farm.pig.record",
  "farm.pig.manage",
  "farm.pig.finance",
  /* Fish / aquaculture. Same four levels. */
  "farm.fish.view",
  "farm.fish.record",
  "farm.fish.manage",
  "farm.fish.finance",
];

/* Worker holds the permissions whose ROWS are narrowed elsewhere rather than
   denied outright: they may view tasks (their own), update tasks (their own),
   and view attendance (their own). The narrowing is a `where` clause the
   server adds — see scopeForRole — never a filter the client is trusted to
   apply. Granting the permission and narrowing the rows keeps the two concerns
   separate; folding them together is how "worker can read every task" ships. */
const MATRIX = {
  owner: new Set(PERMISSIONS),
  manager: new Set([
    "farm.view", "farm.members.view", "farm.members.manage",
    "farm.tasks.view", "farm.tasks.create", "farm.tasks.assign", "farm.tasks.update", "farm.tasks.verify",
    "farm.attendance.view", "farm.attendance.manage",
    "farm.announcement.create",
    "farm.chat.view", "farm.chat.send",
    "farm.documents.view", "farm.documents.manage",
    /* Runs the poultry operation day to day, including its money — but
       closing a cycle (which freezes the batch P&L) stays with the owner. */
    "farm.poultry.view", "farm.poultry.record", "farm.poultry.manage", "farm.poultry.finance",
    /* Manages the dairy herd day to day, including its financials. */
    "farm.dairy.view", "farm.dairy.record", "farm.dairy.manage", "farm.dairy.finance",
    /* Manages the goat/sheep flock day to day, including its financials. */
    "farm.goat.view", "farm.goat.record", "farm.goat.manage", "farm.goat.finance",
    /* Manages the pig herd day to day, including its financials. */
    "farm.pig.view", "farm.pig.record", "farm.pig.manage", "farm.pig.finance",
    /* Manages the fish ponds day to day, including its financials. */
    "farm.fish.view", "farm.fish.record", "farm.fish.manage", "farm.fish.finance",
  ]),
  supervisor: new Set([
    "farm.view", "farm.members.view",
    "farm.tasks.view", "farm.tasks.create", "farm.tasks.assign", "farm.tasks.update", "farm.tasks.verify",
    "farm.attendance.view",
    "farm.chat.view", "farm.chat.send",
    "farm.documents.view",
    /* Records the day; cannot create batches, set targets, or touch money. */
    "farm.poultry.view", "farm.poultry.record",
    /* Records dairy milk, health and events; cannot create animals or see financials. */
    "farm.dairy.view", "farm.dairy.record",
    /* Records goat milk, weight, health and events; cannot create animals or see financials. */
    "farm.goat.view", "farm.goat.record",
    /* Records pig weight, health and events; cannot create animals or see financials. */
    "farm.pig.view", "farm.pig.record",
    /* Records fish feed, water quality and events; cannot create ponds or see financials. */
    "farm.fish.view", "farm.fish.record",
  ]),
  worker: new Set([
    "farm.view",
    "farm.tasks.view", "farm.tasks.update",
    "farm.attendance.view",
    "farm.chat.view", "farm.chat.send",
    /* The stockman who feeds the birds and counts the mortality is usually a
       worker — the daily record is exactly their job. Reading the batch they
       work in is not narrowed by row: like chat, membership is the access
       rule, and a shed the worker cannot see is one they cannot report on. */
    "farm.poultry.view", "farm.poultry.record",
    /* The milkman records the morning and evening yield — that is their job. */
    "farm.dairy.view", "farm.dairy.record",
    /* The goat herder records daily milk, weight, and health — that is their job. */
    "farm.goat.view", "farm.goat.record",
    /* The pig herder records daily weight, health and feed — that is their job. */
    "farm.pig.view", "farm.pig.record",
    /* The fish farmer records daily feed, water quality and events. */
    "farm.fish.view", "farm.fish.record",
  ]),
};

/* Unknown roles collapse to the most restricted, never to more privileged —
   a typo in the database must not hand someone the owner's permissions. */
export function permissionsForRole(role) {
  return MATRIX[ROLES.includes(role) ? role : "worker"];
}

/* Does this membership carry `permission`?

   Per-member overrides in the `permissions` jsonb column are applied on top of
   the role matrix: { "farm.tasks.assign": true } grants, false revokes. Only
   keys in PERMISSIONS are honoured, so a member row cannot invent a capability
   the server does not know how to check. */
export function memberCan(membership, permission) {
  if (!membership || membership.status !== "active") return false;
  if (!PERMISSIONS.includes(permission)) return false;

  const overrides = membership.permissions || {};
  if (Object.prototype.hasOwnProperty.call(overrides, permission)) {
    return overrides[permission] === true;
  }
  return permissionsForRole(membership.role).has(permission);
}

/* How far a member may see within a resource they are permitted to view.
   "all" reads every row in the space; "own" is restricted to rows belonging to
   this member. Callers turn this into a `where` clause — it is never sent to
   the client to act on. */
export function scopeForRole(role, resource) {
  const r = ROLES.includes(role) ? role : "worker";
  if (r === "worker") {
    if (resource === "tasks") return "own";        // tasks assigned to them
    if (resource === "attendance") return "own";   // their own attendance
  }
  return "all";
}

/* Only an owner may act on another owner, and nobody may promote above
   themselves — a manager must not be able to mint a second owner and lock the
   original out. */
export function canAssignRole(actorRole, targetRole) {
  const actor = ROLE_META[actorRole]?.rank ?? -1;
  const target = ROLE_META[targetRole]?.rank ?? -1;
  if (actor < 0 || target < 0) return false;
  if (actorRole === "owner") return true;
  return target < actor;
}
