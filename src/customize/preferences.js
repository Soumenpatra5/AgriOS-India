/* Customization engine — the single, scalable source of truth for every user
   preference in AgriOS India.

   Design goals (per the customization spec):
   - Modular & future-proof: add a new option by adding a default here + a UI
     control; nothing else in the app needs to change.
   - Local-first + cloud-synced: prefs live in localStorage and mirror to the
     user's cloud profile so a new device restores everything on sign-in.
   - Backup / restore / reset: whole-object export & import, one-click reset.

   Consumers read via usePrefs()/PreferencesProvider; this module is the store. */

import { storage } from "../utils/storage.js";

const KEY = "prefs";
const VERSION = 1;

/* DEFAULTS = the full preference tree. Extend this to add customizations. */
export const DEFAULTS = {
  _v: VERSION,

  appearance: {
    theme:       "system",       // light | dark | system
    accent:      "green",        // green | teal | blue | indigo | orange | rose
    cardStyle:   "rounded",      // rounded | flat | glass | material
    displaySize: "comfortable",  // compact | comfortable | spacious
    highContrast: false,
  },

  dashboard: {
    // which Home widgets are shown, and in what order (top → bottom)
    widgets: {
      weather: true, summary: true, quickActions: true, services: true, tasks: true,
      diagnostics: true, schemes: true, disease: true, calculators: true, news: true,
    },
    order: ["weather", "summary", "quickActions", "services", "tasks", "diagnostics", "schemes", "disease", "calculators", "news"],
  },

  nav: {
    // which bottom-nav tabs are visible (home & profile are always kept)
    tabs: { home: true, ai: true, market: true, services: true, profile: true },
  },

  layout: {
    view: "grid",   // grid | list — for content screens (AI hub, Services)
  },

  farmerProfile: {
    // which enterprises the farmer runs — opt-out: all on by default, turn off
    // the ones you don't do to declutter diagnostics / livestock to your farm.
    types: { crop: true, poultry: true, dairy: true, fish: true, goat: true, pig: true, bee: true },
  },

  notifications: { push: true, sms: false, email: false },

  /* state/district are the denormalised display names; the *Id fields are the
     structured truth (services/geo). Both are kept because priceProxy and the
     scheme eligibility engine still match on text. */
  region: { countryId: "IN", state: "", district: "", stateId: "", districtId: "" },

  offline: { mode: "auto" },     // auto | aggressive | off

  accessibility: { largerText: false, reduceMotion: false, screenReader: false },
};

/* Deep-merge stored prefs over defaults so new keys appear automatically. */
function merge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (base && typeof base === "object") {
    const out = { ...base };
    for (const k of Object.keys(base)) {
      if (over && k in over) out[k] = merge(base[k], over[k]);
    }
    return out;
  }
  return over === undefined ? base : over;
}

let state = merge(DEFAULTS, storage.get(KEY, {}));
const subs = new Set();

function persist() { storage.set(KEY, state); subs.forEach((cb) => cb(state)); }

/* Set a nested value by dot-path, e.g. set("appearance.accent", "blue"). */
function setPath(obj, path, value) {
  const keys = path.split(".");
  const next = structuredClone(obj);
  let node = next;
  for (let i = 0; i < keys.length - 1; i++) node = node[keys[i]];
  node[keys[keys.length - 1]] = value;
  return next;
}
function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

export const preferences = {
  all() { return state; },
  get(path, fallback) { const v = getPath(state, path); return v === undefined ? fallback : v; },

  set(path, value) { state = setPath(state, path, value); persist(); return state; },

  /* Replace the whole tree (used by cloud restore / import), merged over defaults. */
  replace(next) { state = merge(DEFAULTS, next || {}); persist(); return state; },

  reset() { state = structuredClone(DEFAULTS); persist(); return state; },

  subscribe(cb) { subs.add(cb); return () => subs.delete(cb); },

  /* Backup / restore as a portable JSON string. */
  export() { return JSON.stringify(state, null, 2); },
  import(json) {
    try {
      const parsed = typeof json === "string" ? JSON.parse(json) : json;
      this.replace(parsed);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  },
};
