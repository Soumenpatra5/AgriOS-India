/* Feed alerts — composes existing alert-relevant data (inventory low-stock/
   expiry, consumption trend, wastage %, price history) into one list for the
   dashboard. Deliberately does NOT auto-dispatch push notifications: browser
   Notification permission generally requires a user gesture (see
   notificationService's own comment), and there's no scheduler anywhere
   else in this app either — so alerts surface in the UI, and the caller can
   choose to call notificationService.dispatch() from a real user action if
   they want one pushed. No duplicate notification engine. */

import { feedInventory } from "./feedService.js";
import { feedAnalyticsService } from "./feedAnalyticsService.js";
import { feedBatchService } from "./feedBatchService.js";
import { feedWastageService } from "./feedWastageService.js";
import { feedPriceHistoryService } from "./feedPriceHistoryService.js";

const UNUSUAL_CONSUMPTION_MULTIPLIER = 1.5; // today's use vs trailing 7-day daily average
const HIGH_COST_INCREASE_PCT = 20;          // month-over-month
const HIGH_WASTAGE_PCT = 5;
const PRICE_JUMP_PCT = 10;

export const feedAlertsService = {
  async getAll(farmId) {
    const alerts = [];

    const inv = await feedInventory.alerts(farmId);
    inv.lowStock.forEach((i) => alerts.push({ type: "low_stock", severity: "medium", title: "Low stock", message: `${i.name} is at ${i.qty} ${i.unit || "kg"} (min ${i.minQty})`, itemId: i.id }));
    inv.expired.forEach((i) => alerts.push({ type: "expired", severity: "high", title: "Expired feed", message: `${i.name} expired on ${i.expiryDate}`, itemId: i.id }));
    inv.expiring.forEach((i) => alerts.push({ type: "expiring", severity: "medium", title: "Expiring soon", message: `${i.name} expires on ${i.expiryDate}`, itemId: i.id }));

    const trend = await feedAnalyticsService.monthlyTrend(farmId, 2);
    if (trend.length === 2 && trend[0].cost > 0) {
      const changePct = Math.round(((trend[1].cost - trend[0].cost) / trend[0].cost) * 100);
      if (changePct >= HIGH_COST_INCREASE_PCT) {
        alerts.push({ type: "high_cost", severity: "medium", title: "Feed cost rising", message: `This month's feed cost is up ${changePct}% vs last month` });
      }
    }

    const summary = await feedAnalyticsService.summary(farmId);
    if (summary.weekQty > 0) {
      const trailingDailyAvg = (summary.weekQty - summary.todayQty) / 6 || 0;
      if (trailingDailyAvg > 0 && summary.todayQty > trailingDailyAvg * UNUSUAL_CONSUMPTION_MULTIPLIER) {
        alerts.push({ type: "unusual_consumption", severity: "low", title: "Unusual consumption", message: `Today's feed use (${summary.todayQty} kg) is well above the recent daily average (${Math.round(trailingDailyAvg)} kg)` });
      }
    }

    const batches = await feedBatchService.getAll(farmId);
    for (const b of batches) {
      const w = await feedWastageService.summaryForBatch(b.id);
      if (w.wastagePct > HIGH_WASTAGE_PCT) {
        alerts.push({ type: "wastage", severity: "medium", title: "High feed wastage", message: `${b.label || "Batch"}: ${w.wastagePct}% wastage`, batchId: b.id });
      }
    }

    const prices = await feedPriceHistoryService.all();
    prices.filter((p) => p.changePct !== null && p.changePct >= PRICE_JUMP_PCT)
      .forEach((p) => alerts.push({ type: "price_increase", severity: "low", title: "Price increase", message: `${p.feedName} price up ${p.changePct}% (₹${p.previous} → ₹${p.current})` }));

    return alerts;
  },
};
