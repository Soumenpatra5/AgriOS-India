/* Farm Alerts Center — a single, cross-domain "what needs my attention" list.

   Every alert source in the app already computes its own alerts in its own
   screen (inventory low-stock, vaccination due, document expiry, overdue crop
   tasks, feed alerts, triggered price alerts). Nothing aggregated them. This
   composes those existing sources — it introduces no new alert store and
   invents no data. Each source is wrapped so one failing source can never
   blank the whole center.

   Honest about scheduling: this computes on demand when the user opens the
   Alerts Center (or Home), exactly like feedAlertsService already does. There
   is no background scheduler in this app (no push backend / service-worker
   cron), so nothing here claims to notify proactively. Callers may
   opportunistically dispatch the top items via notificationService from a
   real user action (app open), which is how the app already behaves. */

import { inventoryService } from "../inventory/inventoryService.js";
import { vaccinationService } from "../livestock/vaccinationService.js";
import { documentService } from "../employees/documentService.js";
import { cropCalendarService } from "../calendar/cropCalendarService.js";
import { feedAlertsService } from "../feed/feedAlertsService.js";
import { priceAlertService } from "../market/priceAlerts.js";
import { notificationService } from "../notifications/notificationService.js";
import { storage } from "../../utils/storage.js";
import { rupee } from "../../utils/format.js";

const NOTIFY_KEY = "alerts:notified"; // { date, keys[] } — one browser notification per urgent alert per day

/* severity weight for sorting: higher = more urgent */
const SEV_WEIGHT = { high: 3, medium: 2, low: 1 };

async function safe(fn, fallback) {
  try { return await fn(); } catch { return fallback; }
}

export const farmAlertsService = {
  /* Returns a flat, severity-sorted list of alerts. Each item:
     { id, source, severity, title, message, kind, props } — `kind`/`props`
     deep-link to the screen that resolves the alert (or null). */
  async getAll(farmId) {
    const out = [];

    /* Every source is independent — fetch them concurrently so opening the
       Alerts Center costs max(source latency), not the sum. */
    const [inv, vaccMissed, vaccUpcoming, docs, overdue, dueSoon, feed, price] = await Promise.all([
      safe(() => inventoryService.alerts(farmId), { lowStock: [], expired: [], expiring: [] }),
      safe(() => vaccinationService.missed(), []),
      safe(() => vaccinationService.upcoming(14), []),
      safe(() => documentService.expirySummary(), { expired: [], expiringSoon: [] }),
      safe(() => cropCalendarService.overdueTasks(), []),
      safe(() => cropCalendarService.upcomingTasks(3), []),
      safe(() => feedAlertsService.getAll(farmId), []),
      safe(() => priceAlertService.getAll(), []),
    ]);

    /* Inventory (all categories) — low stock / expired / expiring soon */
    inv.expired.forEach((i) => out.push(alert("inventory", "high", "Expired stock", `${i.name} expired ${i.expiryDate ? "on " + i.expiryDate : ""}`.trim(), "erpInventory")));
    inv.lowStock.forEach((i) => out.push(alert("inventory", "medium", "Low stock", `${i.name} at ${i.qty} ${i.unit || ""}${i.minQty ? ` (min ${i.minQty})` : ""}`.trim(), "erpInventory")));
    inv.expiring.forEach((i) => out.push(alert("inventory", "medium", "Expiring soon", `${i.name} expires ${i.expiryDate || "soon"}`, "erpInventory")));

    /* Vaccination / health events */
    vaccMissed.forEach((e) => out.push(alert("vaccination", "high", "Vaccination overdue", `${labelOf(e.type)} — ${e.enterpriseLabel || ""} (due ${e.dueDate})`.trim(), "vaccinationCalendar")));
    vaccUpcoming.forEach((e) => out.push(alert("vaccination", "medium", "Vaccination due", `${labelOf(e.type)} — ${e.enterpriseLabel || ""} (${e.dueDate})`.trim(), "vaccinationCalendar")));

    /* Worker document expiry */
    docs.expired.forEach((d) => out.push(alert("document", "high", "Document expired", `${d.name || d.type || "Document"} expired ${d.expiryDate || ""}`.trim(), "erpEmployees")));
    docs.expiringSoon.forEach((d) => out.push(alert("document", "medium", "Document expiring", `${d.name || d.type || "Document"} expires ${d.expiryDate || "soon"}`, "erpEmployees")));

    /* Crop-calendar tasks */
    overdue.forEach((t) => out.push(alert("cropTask", "high", "Task overdue", `${labelOf(t.type)}${t.cropName ? " — " + t.cropName : ""} (due ${t.dueDate})`, "cropCalendar")));
    dueSoon.forEach((t) => out.push(alert("cropTask", "low", "Task due soon", `${labelOf(t.type)}${t.cropName ? " — " + t.cropName : ""} (${t.dueDate})`, "cropCalendar")));

    /* Feed alerts (already severity-tagged by feedAlertsService) */
    feed.forEach((a) => out.push(alert("feed", a.severity || "medium", a.title, a.message, "feedDashboard")));

    /* Triggered price alerts the user set */
    price.filter((a) => a.enabled && a.triggeredAt).forEach((a) =>
      out.push(alert("price", "medium", "Price alert", `${a.cropName || "Crop"} ${a.direction === "above" ? "≥" : "≤"} ${rupee(a.targetPrice)}`, "mandiPrices")));

    return out.sort((a, b) => (SEV_WEIGHT[b.severity] || 0) - (SEV_WEIGHT[a.severity] || 0));
  },

  /* Opportunistic browser notification for urgent (high-severity) alerts.
     Called on app open — NOT a background scheduler (this PWA has no push
     backend). Honest guarantees: fires only if the user has enabled
     notifications, only for high-severity alerts, and at most once per
     distinct alert per day (deduped via NOTIFY_KEY) so opening the app
     repeatedly never re-nags. Returns a result object describing what
     happened, which also makes it testable without a real Notification API. */
  async notifyHighPriority(farmId, precomputed = null) {
    if (!notificationService.isEnabled()) return { dispatched: false, reason: "disabled" };

    const all = precomputed || await this.getAll(farmId);
    const high = all.filter((a) => a.severity === "high");
    if (high.length === 0) return { dispatched: false, reason: "none" };

    const today = new Date().toISOString().slice(0, 10);
    const rec = storage.get(NOTIFY_KEY, {}) || {};
    const seen = rec.date === today ? (rec.keys || []) : [];
    const sig = (a) => `${a.source}:${a.title}:${a.message}`;
    const fresh = high.filter((a) => !seen.includes(sig(a)));
    if (fresh.length === 0) return { dispatched: false, reason: "already_notified" };

    const body = fresh.length === 1
      ? `${fresh[0].title} — ${fresh[0].message}`
      : `${fresh.length} urgent items need your attention`;
    notificationService.dispatch("AgriOS — urgent farm alerts", body, "agrios-alerts");
    storage.set(NOTIFY_KEY, { date: today, keys: [...seen, ...fresh.map(sig)] });
    return { dispatched: true, count: fresh.length };
  },

  /* Count by severity + total, for a badge. */
  async summary(farmId) {
    const all = await this.getAll(farmId);
    return {
      total: all.length,
      high: all.filter((a) => a.severity === "high").length,
      medium: all.filter((a) => a.severity === "medium").length,
      low: all.filter((a) => a.severity === "low").length,
    };
  },
};

let _seq = 0;
function alert(source, severity, title, message, kind = null, props = undefined) {
  return { id: `${source}-${_seq++}`, source, severity, title, message, kind, props };
}

/* task/event `type` may be a string or a {label} object depending on source. */
function labelOf(type) {
  if (!type) return "";
  return typeof type === "object" ? (type.label || type.id || "") : String(type);
}
