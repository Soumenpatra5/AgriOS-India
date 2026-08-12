/* Device-local role-based access control (M7).

   The app is offline-first and single-user-per-device, so this is NOT
   server-enforced multi-user auth — it's a device-local "who's holding the
   phone" gate: the Owner can drop the device into a restricted role (e.g. hand
   it to a worker to mark attendance) so sensitive sections — salaries, employee
   documents, finances, settings — aren't casually visible. Elevating back to a
   higher role requires the Owner's PIN (see roleService).

   Pure + data-driven so the matrix is trivial to adjust and unit-test. */

export const ROLES = ["owner", "manager", "worker"];
export const DEFAULT_ROLE = "owner";

export const ROLE_META = {
  owner:   { label: { en: "Owner",   hi: "मालिक",     bn: "মালিক" },   rank: 2 },
  manager: { label: { en: "Manager", hi: "प्रबंधक",   bn: "ম্যানেজার" }, rank: 1 },
  worker:  { label: { en: "Worker",  hi: "कर्मचारी",  bn: "কর্মী" },    rank: 0 },
};

/* Capabilities screens check. Anything not listed here is ungated (home,
   attendance marking, tasks, weather, prices, AI, …) so a worker keeps the
   day-to-day app. */
export const CAPABILITIES = [
  "finance.view",     // ledger, business P&L, cash flow
  "team.view",        // employee roster + profiles
  "team.manage",      // add / edit / remove employees
  "salary.view",      // wages / salary figures
  "documents.view",   // employee documents (ID / bank / medical)
  "payroll.manage",   // record payments / advances / bonuses
  "records.delete",   // delete critical records (farms, employees, ledger…)
  "settings.manage",  // security / privacy / subscription / API keys
];

const MATRIX = {
  owner:   new Set(CAPABILITIES), // everything
  manager: new Set(["finance.view", "team.view", "team.manage", "salary.view", "documents.view", "payroll.manage"]),
  worker:  new Set(["team.view"]), // roster only (for attendance); no salary/docs/finance
};

/* Does `role` have `capability`? Unknown roles are treated as the most
   restricted (worker), never as more privileged. */
export function can(role, capability) {
  const set = MATRIX[ROLES.includes(role) ? role : "worker"];
  return set.has(capability);
}

export function roleRank(role) {
  return ROLE_META[role]?.rank ?? -1;
}

/* Switching to a MORE privileged role needs the PIN (if one is set); dropping to
   a lower/equal role — e.g. Owner → Worker to hand off the device — is free. */
export function requiresPin(currentRole, targetRole, hasPin) {
  return !!hasPin && roleRank(targetRole) > roleRank(currentRole);
}
