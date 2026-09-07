/* Production statistics — monthly summaries, FCR, cost-per-unit per enterprise */

import { productionService } from "./livestockService.js";

export const productionStats = {
  /* Returns last N days of daily totals for an enterprise metric key */
  async dailyTotals(enterprise, metricKey, days = 30) {
    const records = await productionService.getForEnterprise(enterprise, days * 4);
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const filtered = records.filter((r) => new Date(r.date) >= cutoff);
    const byDate = {};
    filtered.forEach((r) => {
      byDate[r.date] = (byDate[r.date] || 0) + (Number(r[metricKey]) || 0);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
  },

  /* Monthly summary: total production, total feed cost, cost-per-unit */
  async monthlySummary(enterprise, productionKey = "quantity", feedKey = "feedKg") {
    const records = await productionService.getForEnterprise(enterprise, 365);
    const months = {};
    records.forEach((r) => {
      const m = r.date.slice(0, 7);
      if (!months[m]) months[m] = { production: 0, feedKg: 0, count: 0 };
      months[m].production += Number(r[productionKey]) || 0;
      months[m].feedKg     += Number(r[feedKey]) || 0;
      months[m].count++;
    });
    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, d]) => ({
        month,
        production: d.production,
        feedKg: d.feedKg,
        /* feed per unit of OUTPUT — kg of feed per egg, per litre of milk.
           Renamed from `fcr`, which it never was: Feed Conversion Ratio is
           feed per kg of LIVE-WEIGHT GAIN, and calling this that invited a
           reader to compare it against a real FCR target. The authoritative
           FCR lives in api/_lib/farm/fcr.js and is the only implementation. */
        feedPerUnit: d.production > 0 ? +(d.feedKg / d.production).toFixed(2) : null,
        avgPerDay: d.count > 0 ? +(d.production / d.count).toFixed(1) : 0,
      }));
  },

  /* Current month totals */
  async currentMonth(enterprise, productionKey = "quantity") {
    const records = await productionService.getForEnterprise(enterprise, 31);
    const prefix = new Date().toISOString().slice(0, 7);
    const thisMonth = records.filter((r) => r.date.startsWith(prefix));
    return {
      total: thisMonth.reduce((s, r) => s + (Number(r[productionKey]) || 0), 0),
      days:  thisMonth.length,
    };
  },
};
