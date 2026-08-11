/* Feed price history — derived entirely from real purchase records
   (orderService, kind:"purchase", tagged with feedType by feedPurchase.record),
   never an invented/estimated price. If there's no purchase history for a
   feed, this returns nothing rather than guessing. */

import { orderService } from "../crm/orderService.js";
import { round2 } from "../../utils/num.js";

async function feedPurchases() {
  const all = await orderService.getByKind("purchase");
  return all.filter((o) => o.feedType); // feed purchases are tagged with feedType; other CRM purchases aren't
}

export const feedPriceHistoryService = {
  /* Price history for one feed (matched by item name), sorted oldest-first. */
  async forFeed(feedName) {
    const purchases = (await feedPurchases())
      .filter((o) => o.item === feedName)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (purchases.length === 0) return null;

    const rates = purchases.map((p) => Number(p.rate) || 0);
    const current = rates[rates.length - 1];
    const previous = rates.length > 1 ? rates[rates.length - 2] : null;
    return {
      feedName,
      current, previous,
      lowest: Math.min(...rates), highest: Math.max(...rates),
      average: round2(rates.reduce((s, r) => s + r, 0) / rates.length),
      changePct: previous ? round2(((current - previous) / previous) * 100) : null,
      history: purchases.map((p) => ({ date: p.date, rate: Number(p.rate) || 0, supplierName: p.supplierName || "", contactId: p.contactId || null })),
    };
  },

  /* Price history for every feed that has at least one purchase on record. */
  async all() {
    const purchases = await feedPurchases();
    const names = [...new Set(purchases.map((p) => p.item))];
    const results = await Promise.all(names.map((n) => this.forFeed(n)));
    return results.filter(Boolean);
  },

  /* Average price per supplier for one feed — helps compare where to buy. */
  async supplierComparison(feedName) {
    const purchases = (await feedPurchases()).filter((o) => o.item === feedName);
    const groups = {};
    purchases.forEach((p) => {
      const key = p.supplierName || p.contactId || "Unknown supplier";
      if (!groups[key]) groups[key] = { supplier: key, rates: [] };
      groups[key].rates.push(Number(p.rate) || 0);
    });
    return Object.values(groups).map((g) => ({
      supplier: g.supplier,
      average: round2(g.rates.reduce((s, r) => s + r, 0) / g.rates.length),
      lowest: Math.min(...g.rates), purchases: g.rates.length,
    })).sort((a, b) => a.average - b.average);
  },
};
