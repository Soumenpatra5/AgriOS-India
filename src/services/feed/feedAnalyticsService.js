/* Feed Cost Analytics — reads from the services already built (consumption,
   batches, inventory) rather than a separate analytics store. Everything is
   computed on demand from existing records, same approach as costAnalysis.js
   / kpiService.js elsewhere in the app. */

import { feedConsumptionService } from "./feedConsumptionService.js";
import { feedBatchService } from "./feedBatchService.js";
import { feedInventory, LIVESTOCK_TYPES } from "./feedService.js";
import { round2 } from "../../utils/num.js";

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

export const feedAnalyticsService = {
  /* Today / this week / this month cost + quantity, plus current stock value. */
  async summary(farmId) {
    const [entries, stockValue] = await Promise.all([feedConsumptionService.all(farmId), feedInventory.stockValue(farmId)]);
    const today = todayStr();
    const weekStart = daysAgoStr(7);
    const monthPrefix = today.slice(0, 7);

    const sum = (list, field) => round2(list.reduce((s, e) => s + (Number(e[field]) || 0), 0));
    const todayEntries = entries.filter((e) => e.date === today);
    const weekEntries = entries.filter((e) => e.date >= weekStart);
    const monthEntries = entries.filter((e) => (e.date || "").startsWith(monthPrefix));

    return {
      todayCost: sum(todayEntries, "totalCost"), todayQty: sum(todayEntries, "quantityUsed"),
      weekCost: sum(weekEntries, "totalCost"), weekQty: sum(weekEntries, "quantityUsed"),
      monthCost: sum(monthEntries, "totalCost"), monthQty: sum(monthEntries, "quantityUsed"),
      avgCostPerKg: sum(monthEntries, "quantityUsed") > 0 ? round2(sum(monthEntries, "totalCost") / sum(monthEntries, "quantityUsed")) : 0,
      stockValue: round2(stockValue),
    };
  },

  /* Monthly cost/quantity trend for the last N months (default 6). */
  async monthlyTrend(farmId, months = 6) {
    const entries = await feedConsumptionService.all(farmId);
    const buckets = {};
    entries.forEach((e) => {
      const key = (e.date || "").slice(0, 7);
      if (!key) return;
      if (!buckets[key]) buckets[key] = { month: key, cost: 0, qty: 0 };
      buckets[key].cost += Number(e.totalCost) || 0;
      buckets[key].qty += Number(e.quantityUsed) || 0;
    });
    const now = new Date();
    const out = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      /* Build the key from local date parts, not toISOString() — in
         UTC+ timezones, toISOString() on a local midnight can roll back
         to the previous day (and month) in UTC. */
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const b = buckets[key] || { month: key, cost: 0, qty: 0 };
      out.push({ month: key, cost: round2(b.cost), qty: round2(b.qty) });
    }
    return out;
  },

  /* One row per batch: cost, FCR, efficiency — used for batch comparison. */
  async batchComparison(farmId) {
    const batches = await feedBatchService.getAll(farmId);
    const summaries = await Promise.all(batches.map((b) => feedBatchService.summary(b.id)));
    return summaries.filter(Boolean).sort((a, b) => b.totalFeedCost - a.totalFeedCost);
  },

  /* Same comparison, grouped/summed by livestock type. */
  async livestockComparison(farmId) {
    const rows = await this.batchComparison(farmId);
    const groups = {};
    rows.forEach((r) => {
      const key = r.batch.enterprise || "other";
      if (!groups[key]) groups[key] = { enterprise: key, totalFeed: 0, totalCost: 0, batches: 0 };
      groups[key].totalFeed += r.totalFeed;
      groups[key].totalCost += r.totalFeedCost;
      groups[key].batches += 1;
    });
    return Object.values(groups)
      .map((g) => ({ ...g, totalFeed: round2(g.totalFeed), totalCost: round2(g.totalCost), label: LIVESTOCK_TYPES.find((t) => t.id === g.enterprise)?.label || g.enterprise }))
      .sort((a, b) => b.totalCost - a.totalCost);
  },

  /* Cost breakdown by feed type, from consumption records. */
  async feedTypeBreakdown(farmId) {
    const entries = await feedConsumptionService.all(farmId);
    const groups = {};
    entries.forEach((e) => {
      const key = e.feedType || "unspecified";
      if (!groups[key]) groups[key] = { feedType: key, cost: 0, qty: 0 };
      groups[key].cost += Number(e.totalCost) || 0;
      groups[key].qty += Number(e.quantityUsed) || 0;
    });
    const totalCost = Object.values(groups).reduce((s, g) => s + g.cost, 0);
    return Object.values(groups)
      .map((g) => ({ ...g, cost: round2(g.cost), qty: round2(g.qty), pct: totalCost > 0 ? round2((g.cost / totalCost) * 100) : 0 }))
      .sort((a, b) => b.cost - a.cost);
  },
};
