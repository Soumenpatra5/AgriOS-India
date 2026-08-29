/* Reports Center backend — builds report data and exports CSV (Excel-ready)
   or a printable window (browser's Save-as-PDF). No new dependencies. */

import { plService } from "../business/plService.js";
import { kpiService } from "../business/kpiService.js";
import { ledgerService } from "../ledger/ledgerService.js";
import { inventoryService } from "../inventory/inventoryService.js";
import { animalService, ENTERPRISES } from "../livestock/livestockService.js";
import { productionAggregator } from "../production/productionAggregator.js";
import { taskService } from "../tasks/taskService.js";

const year = () => new Date().getFullYear();

/* label stays English — it is the stored value, the text in CSV exports and
   the key reports group on. i18n is what the UI shows. */
export const REPORT_TYPES = [
  { id: "summary",    label: "Farm Summary",      icon: "House", i18n: { en: "Farm Summary", hi: "फार्म सारांश", bn: "খামার সারসংক্ষেপ" }     },
  { id: "financial",  label: "Financial Report",  icon: "Wallet", i18n: { en: "Financial Report", hi: "वित्तीय रिपोर्ट", bn: "আর্থিক রিপোর্ট" }    },
  { id: "production", label: "Production Report", icon: "TrendingUp", i18n: { en: "Production Report", hi: "उत्पादन रिपोर्ट", bn: "উৎপাদন রিপোর্ট" }},
  { id: "livestock",  label: "Livestock Report",  icon: "Rabbit", i18n: { en: "Livestock Report", hi: "पशुधन रिपोर्ट", bn: "পশুসম্পদ রিপোর্ট" }    },
  { id: "inventory",  label: "Inventory Report",  icon: "Boxes", i18n: { en: "Inventory Report", hi: "स्टॉक रिपोर्ट", bn: "মজুত রিপোর্ট" }     },
];

export const reportService = {
  /* Each builder returns { title, generatedAt, sections:[{heading, rows:[{label,value}] or table:{headers,data}}] } */
  async build(typeId) {
    const generatedAt = new Date().toLocaleString("en-IN");
    if (typeId === "financial")  return { title: `Financial Report ${year()}`,  generatedAt, sections: await this._financial() };
    if (typeId === "production") return { title: `Production Report ${year()}`, generatedAt, sections: await this._production() };
    if (typeId === "livestock")  return { title: "Livestock Report",            generatedAt, sections: await this._livestock() };
    if (typeId === "inventory")  return { title: "Inventory Report",            generatedAt, sections: await this._inventory() };
    return { title: "Farm Summary", generatedAt, sections: await this._summary() };
  },

  async _summary() {
    const kpi = await kpiService.summary(year());
    const snapshot = await productionAggregator.monthSnapshot();
    const buckets = await taskService.buckets();
    return [
      { heading: "Financials (This Year)", rows: [
        { label: "Total Revenue", value: `₹${kpi.totalRevenue.toLocaleString("en-IN")}`, i18n: { en: "Total Revenue", hi: "कुल आय", bn: "মোট আয়" } },
        { label: "Total Cost",    value: `₹${kpi.totalCost.toLocaleString("en-IN")}`, i18n: { en: "Total Cost", hi: "कुल लागत", bn: "মোট ব্যয়" } },
        { label: "Net Profit",    value: `₹${kpi.netProfit.toLocaleString("en-IN")}`, i18n: { en: "Net Profit", hi: "शुद्ध लाभ", bn: "নিট মুনাফা" } },
        { label: "Profit Margin", value: `${kpi.profitMargin}%`, i18n: { en: "Profit Margin", hi: "लाभ मार्जिन", bn: "মুনাফার হার" } },
      ]},
      { heading: "Production (This Month)", table: {
        headers: ["Enterprise", "Output", "Entries"],
        data: snapshot.map((r) => [r.enterprise.label, `${r.total} ${r.metric.unit}`, r.entries]),
      }},
      { heading: "Tasks", rows: [
        { label: "Overdue",  value: buckets.overdue.length, i18n: { en: "Overdue", hi: "बकाया", bn: "বকেয়া" } },
        { label: "Today",    value: buckets.today.length, i18n: { en: "Today", hi: "आज", bn: "আজ" } },
        { label: "Upcoming", value: buckets.upcoming.length, i18n: { en: "Upcoming", hi: "आगामी", bn: "আসন্ন" } },
      ]},
    ];
  },

  async _financial() {
    const months = (await plService.byMonth(year())).filter((m) => m.income > 0 || m.expense > 0);
    const byEnt = await plService.byEnterprise(year());
    return [
      { heading: "Month-wise P&L", table: {
        headers: ["Month", "Income (₹)", "Expense (₹)", "Net (₹)"],
        data: months.map((m) => [m.month, m.income, m.expense, m.net]),
      }},
      { heading: "Enterprise-wise P&L", table: {
        headers: ["Enterprise", "Income (₹)", "Expense (₹)", "Net (₹)"],
        data: byEnt.map((e) => [e.label, e.income, e.expense, e.net]),
      }},
    ];
  },

  async _production() {
    const snapshot = await productionAggregator.monthSnapshot();
    const harvests = await productionAggregator.harvests();
    return [
      { heading: "Production Snapshot", table: {
        headers: ["Enterprise", "Metric", "This Month", "All Records"],
        data: snapshot.map((r) => [r.enterprise.label, r.metric.label, `${r.total} ${r.metric.unit}`, `${r.allTime} ${r.metric.unit}`]),
      }},
      { heading: "Harvests", table: {
        headers: ["Date", "Enterprise", "Weight (kg)", "Price (₹/kg)"],
        data: harvests.map((h) => [h.date, h.enterpriseLabel, h.weightKg || "", h.pricePerKg || ""]),
      }},
    ];
  },

  async _livestock() {
    const rows = await Promise.all(ENTERPRISES.map(async (e) => {
      const animals = await animalService.getAll(e.id);
      return [e.label, animals.length];
    }));
    return [
      { heading: "Animal Register", table: { headers: ["Enterprise", "Registered"], data: rows } },
    ];
  },

  async _inventory() {
    const items = await inventoryService.getAll();
    const alerts = await inventoryService.alerts();
    return [
      { heading: "Stock", table: {
        headers: ["Item", "Category", "Qty", "Unit", "Min Qty", "Expiry"],
        data: items.map((i) => [i.name, inventoryService.categoryLabel(i.category), i.qty, i.unit || "", i.minQty || "", i.expiryDate || ""]),
      }},
      { heading: "Alerts", rows: [
        { label: "Low stock items", value: alerts.lowStock.length, i18n: { en: "Low stock items", hi: "कम स्टॉक वाली वस्तुएँ", bn: "কম মজুতের সামগ্রী" } },
        { label: "Expired items",   value: alerts.expired.length, i18n: { en: "Expired items", hi: "समय-समाप्त वस्तुएँ", bn: "মেয়াদোত্তীর্ণ সামগ্রী" } },
        { label: "Expiring in 30 days", value: alerts.expiring.length, i18n: { en: "Expiring in 30 days", hi: "30 दिन में समाप्त", bn: "৩০ দিনে মেয়াদ শেষ" } },
      ]},
    ];
  },

  /* CSV download — opens in Excel. */
  toCsv(report) {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [report.title, `Generated: ${report.generatedAt}`, ""];
    report.sections.forEach((s) => {
      lines.push(s.heading);
      if (s.rows)  s.rows.forEach((r) => lines.push(`${esc(r.label)},${esc(r.value)}`));
      if (s.table) {
        lines.push(s.table.headers.map(esc).join(","));
        s.table.data.forEach((row) => lines.push(row.map(esc).join(",")));
      }
      lines.push("");
    });
    return lines.join("\r\n");
  },

  downloadCsv(report) {
    const blob = new Blob(["﻿" + this.toCsv(report)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${report.title.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  /* Print window — user saves as PDF from the browser dialog. */
  print(report) {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = (s) => s.rows
      ? `<table>${s.rows.map((r) => `<tr><td>${r.label}</td><td><b>${r.value}</b></td></tr>`).join("")}</table>`
      : `<table><tr>${s.table.headers.map((h) => `<th>${h}</th>`).join("")}</tr>
         ${s.table.data.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
    w.document.write(`<!doctype html><html><head><title>${report.title}</title><style>
      body{font-family:system-ui,sans-serif;padding:24px;color:#12211A}
      h1{font-size:20px} h2{font-size:14px;margin-top:20px;border-bottom:1px solid #ccc;padding-bottom:4px}
      table{border-collapse:collapse;width:100%;margin-top:8px;font-size:12px}
      td,th{border:1px solid #ddd;padding:6px 8px;text-align:left}
      .meta{color:#777;font-size:11px}
    </style></head><body>
      <h1>${report.title}</h1><div class="meta">AgriOS India · ${report.generatedAt}</div>
      ${report.sections.map((s) => `<h2>${s.heading}</h2>${rows(s)}`).join("")}
    </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  },
};
