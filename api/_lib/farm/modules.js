/* Server-side authoritative module registry.
   Validates incoming module configurations and provides core layout defaults. */

export const CORE_MODULES = [
  "farmSpaceTeam",
  "farmSpaceTasks",
  "farmSpaceAttendance",
  "farmSpaceAnnouncements",
  "farmSpaceChat",
  "farmSpaceActivity",
  "farmSpaceNotifications",
];

export const OPTIONAL_MODULES = [
  "poultryDashboard",
  "dairyDashboard",
  "goatDashboard",
  "pigDashboard",
  "fishDashboard",
  "beeDashboard",
  "cropDashboard",
  "farmSpaceAnalytics",
];

const ALL_MODULES = new Set([...CORE_MODULES, ...OPTIONAL_MODULES]);

export function validateModuleConfiguration(orderedModuleIds) {
  if (!Array.isArray(orderedModuleIds)) {
    return { error: "orderedModuleIds must be an array" };
  }

  const seen = new Set();
  
  for (const id of orderedModuleIds) {
    if (typeof id !== "string") {
      return { error: "module_id must be a string" };
    }
    if (!ALL_MODULES.has(id)) {
      return { error: `Unknown module_id: ${id}` };
    }
    if (seen.has(id)) {
      return { error: `Duplicate module_id: ${id}` };
    }
    seen.add(id);
  }

  for (const id of CORE_MODULES) {
    if (!seen.has(id)) {
      return { error: `Missing required module_id: ${id}` };
    }
  }

  return { value: orderedModuleIds };
}
