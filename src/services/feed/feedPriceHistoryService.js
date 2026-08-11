/* Feed price history — derived entirely from real purchase records
   (orderService, kind:"purchase", tagged with feedType by feedPurchase.record),
   never an invented/estimated price. If there's no purchase history for a
   feed, this returns nothing rather than guessing.

   The pure `historyFor`/`suppliersFor` helpers operate on an already-fetched
   purchases list, so `all()`/`allWithSuppliers()` fetch the table ONCE and
   group in memory instead of re-querying orderService per feed name. */

import { orderService } from "../crm/orderService.js";
import { round2 } from "../../utils/num.js";

async function feedPurchases() {
  const all = await orderService.getByKind("purchase");
  return all.filter((o) => o.feedType); // feed purchases are tagged with feedType; other CRM purchases aren't
}

function historyFor(purchases, feedName) {
  const list = purchases
    .filter((o) => o.item === feedName)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  if (list.length === 0) return null;

  const rates = list.map((p) => Number(p.rate) || 0);
  const current = rates[rates.length - 1];
  const previous = rates.length > 1 ? rates[rates.length - 2] : null;
  return {
    feedName,
    current, previous,
    lowest: Math.min(...rates), highest: Math.max(...rates),
    average: round2(rates.reduce((s, r) => s + r, 0) / rates.length),
    changePct: previous ? round2(((current - previous) / previous) * 100) : null,
    history: list.map((p) => ({ date: p.date, rate: Number(p.rate) || 0, supplierName: p.supplierName || "", contactId: p.contactId || null })),
  };
}

function suppliersFor(purchases, feedName) {
  const groups = {};
  purchases.filter((o) => o.item === feedName).forEach((p) => {
    const key = p.supplierName || p.contactId || "Unknown supplier";
    if (!groups[key]) groups[key] = { supplier: key, rates: [] };
    groups[key].rates.push(Number(p.rate) || 0);
  });
  return Object.values(groups).map((g) => ({
    supplier: g.supplier,
    average: round2(g.rates.reduce((s, r) => s + r, 0) / g.rates.length),
    lowest: Math.min(...g.rates), purchases: g.rates.length,
  })).sort((a, b) => a.average - b.average);
}

export const feedPriceHistoryService = {
  /* Price history for one feed (matched by item name), sorted oldest-first. */
  async forFeed(feedName) {
    return historyFor(await feedPurchases(), feedName);
  },

  /* Price history for every feed that has at least one purchase on record. */
  async all() {
    const purchases = await feedPurchases();
    return [...new Set(purchases.map((p) => p.item))]
      .map((name) => historyFor(purchases, name))
      .filter(Boolean);
  },

  /* Average price per supplier for one feed — helps compare where to buy.
     `prefetched` lets a caller that already has the purchases list avoid a
     re-fetch. */
  async supplierComparison(feedName, prefetched = null) {
    return suppliersFor(prefetched || await feedPurchases(), feedName);
  },

  /* Every feed's per-supplier comparison in a single fetch (used by reports). */
  async allWithSuppliers() {
    const purchases = await feedPurchases();
    return [...new Set(purchases.map((p) => p.item))]
      .map((feedName) => ({ feedName, suppliers: suppliersFor(purchases, feedName) }));
  },
};
