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
  ]),
  supervisor: new Set([
    "farm.view", "farm.members.view",
    "farm.tasks.view", "farm.tasks.create", "farm.tasks.assign", "farm.tasks.update", "farm.tasks.verify",
    "farm.attendance.view",
    "farm.chat.view", "farm.chat.send",
    "farm.documents.view",
  ]),
  worker: new Set([
    "farm.view",
    "farm.tasks.view", "farm.tasks.update",
    "farm.attendance.view",
    "farm.chat.view", "farm.chat.send",
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
