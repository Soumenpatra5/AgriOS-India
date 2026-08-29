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

/* label stays English — it is the stored value, the text in CSV exports and
   the key reports group on. i18n is what the UI shows. */
export const FEED_REPORT_TYPES = [
  { id: "cost",      label: "Feed Cost Report" , i18n: { en: "Feed Cost Report", hi: "चारा लागत रिपोर्ट", bn: "খাদ্য ব্যয় রিপোর্ট" } },
  { id: "inventory", label: "Feed Inventory Report" , i18n: { en: "Feed Inventory Report", hi: "चारा स्टॉक रिपोर्ट", bn: "খাদ্য মজুত রিপোর্ট" } },
  { id: "fcr",       label: "FCR Report" , i18n: { en: "FCR Report", hi: "FCR रिपोर्ट", bn: "FCR রিপোর্ট" } },
  { id: "wastage",   label: "Feed Wastage Report" , i18n: { en: "Feed Wastage Report", hi: "चारा बर्बादी रिपोर्ट", bn: "খাদ্য অপচয় রিপোর্ট" } },
  { id: "purchase",  label: "Feed Purchase Report" , i18n: { en: "Feed Purchase Report", hi: "चारा खरीद रिपोर्ट", bn: "খাদ্য ক্রয় রিপোর্ট" } },
  { id: "supplier",  label: "Supplier Feed Report" , i18n: { en: "Supplier Feed Report", hi: "आपूर्तिकर्ता रिपोर्ट", bn: "সরবরাহকারী রিপোর্ট" } },
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
          { label: "Today", value: rupee(summary.todayCost), i18n: { en: "Today", hi: "आज", bn: "আজ" } },
          { label: "This week", value: rupee(summary.weekCost), i18n: { en: "This week", hi: "इस सप्ताह", bn: "এই সপ্তাহ" } },
          { label: "This month", value: rupee(summary.monthCost), i18n: { en: "This month", hi: "इस महीने", bn: "এই মাস" } },
          { label: "Avg cost / kg (this month)", value: rupee(summary.avgCostPerKg), i18n: { en: "Avg cost / kg (this month)", hi: "औसत लागत / किग्रा (इस महीने)", bn: "গড় ব্যয় / কেজি (এই মাস)" } },
          { label: "Feed stock value", value: rupee(summary.stockValue), i18n: { en: "Feed stock value", hi: "चारा स्टॉक मूल्य", bn: "খাদ্য মজুতের মূল্য" } },
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
          { label: "Low stock", value: alerts.lowStock.length, i18n: { en: "Low stock", hi: "कम स्टॉक", bn: "কম মজুত" } },
          { label: "Expired", value: alerts.expired.length, i18n: { en: "Expired", hi: "समय-समाप्त", bn: "মেয়াদোত্তীর্ণ" } },
          { label: "Expiring within 30 days", value: alerts.expiring.length, i18n: { en: "Expiring within 30 days", hi: "30 दिन में समाप्त", bn: "৩০ দিনের মধ্যে মেয়াদ শেষ" } },
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
          { label: "Total wastage", value: `${totalQty.toLocaleString("en-IN")} kg`, i18n: { en: "Total wastage", hi: "कुल बर्बादी", bn: "মোট অপচয়" } },
          { label: "Total wastage cost", value: rupee(totalCost), i18n: { en: "Total wastage cost", hi: "कुल बर्बादी लागत", bn: "মোট অপচয়ের ব্যয়" } },
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
