/* Service Hub state — favorites, recents and usage counts for the Services
   Hub. Backed by the existing localStorage wrapper (src/utils/storage.js),
   service-scoped keys (svc:*) so it never collides with the generic
   src/utils/favorites.js (which AIHub uses for AI-tool ids). Usage counts
   mirror the ring-buffer/append pattern of src/ai/analytics/aiAnalytics.js
   but keyed by service id for a "frequently used" list.

   Ids here are serviceRegistry ids, not screen kinds — so a service can be
   renamed/re-routed without losing a user's favorites. */

import { storage } from "../../utils/storage.js";
import { SERVICE_REGISTRY } from "./serviceRegistry.js";
import { isTypeEnabled } from "../../customize/farmerTypes.js";

const FAV_KEY = "svc:favorites";     // ordered array of service ids
const RECENT_KEY = "svc:recents";    // most-recent-first array of service ids
const USAGE_KEY = "svc:usage";       // { [serviceId]: count }
const RECENT_MAX = 12;

export const serviceHubService = {
  /* ── Favorites (ordered; user can reorder by re-adding) ── */
  getFavorites() {
    const list = storage.get(FAV_KEY, []);
    return Array.isArray(list) ? list : [];
  },
  isFavorite(id) {
    return this.getFavorites().includes(id);
  },
  toggleFavorite(id) {
    const list = this.getFavorites();
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    storage.set(FAV_KEY, next);
    return next.includes(id);
  },
  /* Move a favorite up/down within the favorites order. dir = -1 | 1. */
  reorderFavorite(id, dir) {
    const list = this.getFavorites();
    const i = list.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    storage.set(FAV_KEY, next);
    return next;
  },

  /* ── Recents (most-recent-first, capped, de-duplicated) ── */
  getRecents() {
    const list = storage.get(RECENT_KEY, []);
    return Array.isArray(list) ? list : [];
  },
  /* Record that a service was opened: moves it to the front of recents and
     increments its usage count. Called from the hub when a tile is tapped. */
  recordUse(id) {
    const recents = [id, ...this.getRecents().filter((x) => x !== id)].slice(0, RECENT_MAX);
    storage.set(RECENT_KEY, recents);

    const usage = storage.get(USAGE_KEY, {}) || {};
    usage[id] = (Number(usage[id]) || 0) + 1;
    storage.set(USAGE_KEY, usage);
    return recents;
  },
  clearRecents() {
    storage.set(RECENT_KEY, []);
  },

  /* ── Usage ── */
  getUsage() {
    const u = storage.get(USAGE_KEY, {});
    return u && typeof u === "object" ? u : {};
  },
  /* Service ids sorted by usage count, highest first, capped. */
  frequentlyUsed(limit = 6) {
    const usage = this.getUsage();
    return Object.keys(usage)
      .sort((a, b) => (usage[b] || 0) - (usage[a] || 0))
      .slice(0, limit);
  },

  /* Farmer-type-personalized service suggestions: non-coming services whose
     `types` match the enabled farmer profile (via farmerTypes.isTypeEnabled —
     the one place that opt-out gate lives), excluding the given ids. Single
     source of truth for both the Services tab and Home's "My services" widget
     so the personalization rule can't drift between the two. */
  suggestedFor(prefs, { excludeIds = [], limit } = {}) {
    const exclude = new Set(excludeIds);
    const list = SERVICE_REGISTRY.filter((s) =>
      !s.coming && s.types && s.types.some((ty) => isTypeEnabled(prefs, ty)) && !exclude.has(s.id));
    return typeof limit === "number" ? list.slice(0, limit) : list;
  },
};
