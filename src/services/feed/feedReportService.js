/* Feed reports — builds { title, generatedAt, sections } objects compatible
   with the existing reportService.toCsv/downloadCsv/print (no duplicate
   export infrastructure), covering the report types from the spec. Daily/
   Weekly/Monthly are date-range views of the same underlying cost figures
   (already in feedAnalyticsService.summary), so they're one "Feed Cost
   Report" rather than three near-duplicate report builders. */

import { feedAnalyticsService } from "./feedAnalyticsService.js";
import { feedInventory, LIVESTOCK_TYPES } from "./feedService.js";
import { feedBatchService } from "./feedBatchService.js";
import { feedWastageService } from "./feedWastageService.js";
import { feedPriceHistoryService } from "./feedPriceHistoryService.js";
import { orderService } from "../crm/orderService.js";
import { rupee } from "../../utils/format.js";

export const FEED_REPORT_TYPES = [
  { id: "cost",      label: "Feed Cost Report" },
  { id: "inventory", label: "Feed Inventory Report" },
  { id: "fcr",       label: "FCR Report" },
  { id: "wastage",   label: "Feed Wastage Report" },
  { id: "purchase",  label: "Feed Purchase Report" },
  { id: "supplier",  label: "Supplier Feed Report" },
];

const generatedAt = () => new Date().toLocaleString("en-IN");

export const feedReportService = {
  async build(typeId, farmId) {
    if (typeId === "inventory") return this._inventory(farmId);
    if (typeId === "fcr") return this._fcr(farmId);
    if (typeId === "wastage") return this._wastage(farmId);
    if (typeId === "purchase") return this._purchase();
    if (typeId === "supplier") return this._supplier();
    return this._cost(farmId);
  },

  async _cost(farmId) {
    const [summary, trend, feedTypes] = await Promise.all([
      feedAnalyticsService.summary(farmId), feedAnalyticsService.monthlyTrend(farmId, 6), feedAnalyticsService.feedTypeBreakdown(farmId),
    ]);
    return {
      title: "Feed Cost Report", generatedAt: generatedAt(),
      sections: [
        { heading: "Summary", rows: [
          { label: "Today", value: rupee(summary.todayCost) },
          { label: "This week", value: rupee(summary.weekCost) },
          { label: "This month", value: rupee(summary.monthCost) },
          { label: "Avg cost / kg (this month)", value: rupee(summary.avgCostPerKg) },
          { label: "Feed stock value", value: rupee(summary.stockValue) },
        ]},
        { heading: "Monthly Trend", table: { headers: ["Month", "Cost (₹)", "Quantity (kg)"], data: trend.map((t) => [t.month, t.cost, t.qty]) } },
        { heading: "Cost by Feed Type", table: { headers: ["Feed Type", "Cost (₹)", "Quantity (kg)", "% of Total"], data: feedTypes.map((f) => [f.feedType, f.cost, f.qty, `${f.pct}%`]) } },
      ],
    };
  },

  async _inventory(farmId) {
    const items = await feedInventory.getAll(farmId);
    const alerts = await feedInventory.alerts(farmId);
    return {
      title: "Feed Inventory Report", generatedAt: generatedAt(),
      sections: [
        { heading: "Stock", table: {
          headers: ["Feed", "Type", "Qty", "Unit", "Cost/kg (₹)", "Expiry"],
          data: items.map((i) => [i.name, feedInventory.feedTypeLabel(i.feedType), i.qty, i.unit || "", i.unitPrice || "", i.expiryDate || ""]),
        }},
        { heading: "Alerts", rows: [
          { label: "Low stock", value: alerts.lowStock.length },
          { label: "Expired", value: alerts.expired.length },
          { label: "Expiring within 30 days", value: alerts.expiring.length },
        ]},
      ],
    };
  },

  async _fcr(farmId) {
    const rows = await feedAnalyticsService.batchComparison(farmId);
    return {
      title: "FCR Report", generatedAt: generatedAt(),
      sections: [
        { heading: "Batch FCR", table: {
          headers: ["Batch", "Livestock", "Total Feed (kg)", "Feed Cost (₹)", "FCR", "Target FCR", "Status"],
          data: rows.map((r) => [
            r.batch.label || "Unnamed", LIVESTOCK_TYPES.find((t) => t.id === r.batch.enterprise)?.label || r.batch.enterprise,
            r.totalFeed, r.totalFeedCost, r.fcr === null ? "N/A" : r.fcr, r.targetFCR === null ? "—" : r.targetFCR,
            r.performanceStatus === "no_target" ? "No target" : r.performanceStatus === "on_or_better_than_target" ? "On/better" : "Worse than target",
          ]),
        }},
      ],
    };
  },

  async _wastage(farmId) {
    const entries = await feedWastageService.all(farmId);
    const totalQty = entries.reduce((s, e) => s + (Number(e.quantity) || 0), 0);
    const totalCost = entries.reduce((s, e) => s + (Number(e.costImpact) || 0), 0);
    return {
      title: "Feed Wastage Report", generatedAt: generatedAt(),
      sections: [
        { heading: "Summary", rows: [
          { label: "Total wastage", value: `${totalQty.toLocaleString("en-IN")} kg` },
          { label: "Total wastage cost", value: rupee(totalCost) },
        ]},
        { heading: "Entries", table: {
          headers: ["Date", "Reason", "Quantity (kg)", "Cost (₹)"],
          data: entries.map((e) => [e.date, feedWastageService.reasonLabel(e.reason), e.quantity, e.costImpact]),
        }},
      ],
    };
  },

  async _purchase() {
    const purchases = (await orderService.getByKind("purchase")).filter((o) => o.feedType);
    return {
      title: "Feed Purchase Report", generatedAt: generatedAt(),
      sections: [
        { heading: "Purchases", table: {
          headers: ["Date", "Feed", "Supplier", "Qty", "Rate (₹)", "Total (₹)", "Status"],
          data: purchases.map((p) => [p.date, p.item, p.supplierName || "", p.qty, p.rate, p.totalCost ?? p.amount, p.status]),
        }},
      ],
    };
  },

  async _supplier() {
    // Single fetch of the purchase table, grouped per feed+supplier in memory.
    const rows = [];
    for (const { feedName, suppliers } of await feedPriceHistoryService.allWithSuppliers()) {
      suppliers.forEach((c) => rows.push([feedName, c.supplier, c.average, c.lowest, c.purchases]));
    }
    return {
      title: "Supplier Feed Report", generatedAt: generatedAt(),
      sections: [
        { heading: "Supplier Price Comparison", table: { headers: ["Feed", "Supplier", "Avg Price (₹)", "Lowest (₹)", "Purchases"], data: rows } },
      ],
    };
  },
};
