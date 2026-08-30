/* Commerce automation — turns engine signals into actionable AI alerts. Rules
   evaluate the current state, dedup against stored alerts (so the same alert
   isn't raised twice), persist to aiCommerceDb for audit, and optionally push a
   local notification. This is the "automatic recommendations / alerts" layer. */

import { repo } from "./aiCommerceDb.js";
import { featureStore } from "./featureStore.js";
import { demandForecast } from "./demandForecast.js";
import { fraudDetection } from "./fraudDetection.js";
import { buyerMatching } from "./buyerMatching.js";
import { notificationService } from "../notifications/notificationService.js";

const alerts = repo("aiAlerts");
const num = (v) => Number(v) || 0;

async function raise(kind, title, body, { dispatch = false } = {}) {
  // Dedup: same kind+title still unread → skip.
  const existing = await alerts.getBy("kind", kind);
  if (existing.some((a) => a.title === title && !a.read)) return null;
  const rec = await alerts.add({ kind, title, body, read: false });
  if (dispatch && notificationService.isEnabled?.()) {
    try { notificationService.dispatch(title, body, "ai-commerce"); } catch { /* no-op */ }
  }
  return rec;
}

export const commerceAutomation = {
  /* Evaluate every rule and raise new alerts. Returns the freshly-raised set. */
  async run({ dispatch = false } = {}) {
    featureStore.invalidate();
    const raised = [];
    const push = (r) => { if (r) raised.push(r); };

    // 1. High-demand category alert
    const demand = await demandForecast.ranking();
    const top = demand[0];
    if (top && top.level === "High") {
      push(await raise("demand", `High demand: ${top.label}`,
        `${top.label} demand is high right now (${top.demandIndex}/100). Consider stocking or listing.`, { dispatch }));
    }

    // 3. Fraud alert (high severity)
    const fraud = await fraudDetection.scan();
    const high = fraud.filter((f) => f.severity === "high");
    if (high.length) {
      push(await raise("fraud", `${high.length} high-risk listing${high.length > 1 ? "s" : ""} flagged`,
        `Review flagged listings: ${high.slice(0, 3).map((f) => f.name).join(", ")}.`, { dispatch }));
    }

    // 4. Inventory alert (out of stock)
    const snap = await featureStore.snapshot();
    const oos = snap.products.filter((p) => p.status === "published" && p.available <= 0);
    if (oos.length) {
      push(await raise("inventory", `${oos.length} product${oos.length > 1 ? "s" : ""} out of stock`,
        `Restock: ${oos.slice(0, 3).map((p) => p.name).join(", ")}.`, { dispatch }));
    }

    // 5. High-value buyer match
    const buyers = await buyerMatching.highValue({ limit: 1 });
    const b = buyers.items[0];
    if (b) {
      push(await raise("buyer", `Buyer match: ${b.buyer.name}`,
        `${b.buyer.name} (score ${b.score}/100) is active for ${b.buyer.commodities.join(", ") || "produce"}.`, { dispatch }));
    }

    return raised;
  },

  list: () => alerts.getAll().then((l) => l.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))),
  unread: () => alerts.getBy("read", false),
  markRead: (id) => alerts.update(id, { read: true }),
  async markAllRead() {
    const list = await alerts.getBy("read", false);
    await Promise.all(list.map((a) => alerts.update(a.id, { read: true })));
    return list.length;
  },
  clearAll: async () => {
    const list = await alerts.getAll();
    await Promise.all(list.map((a) => alerts.remove(a.id)));
  },
};
