/* label stays English — it is the stored value, the text in CSV exports and
   the key reports group on. i18n is what the UI shows. */
/* Crop Plan persistence + integration with Inventory, Farm Ledger and CRM
   purchase orders. Built on the same erpDb repo() pattern every other ERP
   service uses, so offline queueing/sync (syncRepo.js) is automatic.

   Nothing here posts to the ledger or creates a purchase order on its own —
   every integration point is an explicit action the UI calls after the
   farmer confirms, per the project rule against silent side effects on
   farm financial/inventory data. */

import { repo } from "../erp/erpDb.js";
import { computePlan } from "./calcEngine.js";
import { inventoryService } from "../inventory/inventoryService.js";
import { ledgerService } from "../ledger/ledgerService.js";
import { orderService } from "../crm/orderService.js";
import { rupee } from "../../utils/format.js";

const plans = repo("cropPlans");

export const CROP_PLAN_STATUSES = [
  { id: "draft",       label: "Draft", i18n: { en: "Draft", hi: "मसौदा", bn: "খসড়া" } },
  { id: "planned",     label: "Planned", i18n: { en: "Planned", hi: "नियोजित", bn: "পরিকল্পিত" } },
  { id: "approved",    label: "Approved", i18n: { en: "Approved", hi: "स्वीकृत", bn: "অনুমোদিত" } },
  { id: "in_progress", label: "In progress", i18n: { en: "In progress", hi: "चल रहा है", bn: "চলমান" } },
  { id: "harvested",   label: "Harvested", i18n: { en: "Harvested", hi: "कटाई हुई", bn: "ফসল কাটা হয়েছে" } },
  { id: "completed",   label: "Completed", i18n: { en: "Completed", hi: "पूर्ण", bn: "সম্পন্ন" } },
  { id: "cancelled",   label: "Cancelled", i18n: { en: "Cancelled", hi: "रद्द", bn: "বাতিল" } },
];

/* Maps a planner cost bucket to the Farm Ledger's existing expense category
   ids (src/services/ledger/ledgerService.js EXPENSE_CATEGORIES) — no new
   categories invented, so posted entries show up in existing P&L/KPI/reports. */
const LEDGER_CATEGORY_BY_BUCKET = {
  seed: "seeds",
  fertilizer: "fertilizer",
  protection: "pesticide",
  organic: "fertilizer",
  irrigation: "irrigation",
  labour: "labour",
  machinery: "equipment",
  other: "other_exp",
};

export const cropPlanService = {
  statusLabel: (id) => CROP_PLAN_STATUSES.find((s) => s.id === id)?.label ?? id,

  /* `input` is the raw planner form state (see calcEngine.computePlan docs)
     plus identifying fields: farmId, fieldId, cropId, cropName, variety,
     season, areaValue, areaUnit, notes. We store both the raw inputs (so the
     plan can be edited/recomputed) and a `computed` snapshot (so list/detail
     views and future comparisons show what was decided at save time, not a
     figure that silently drifts if the calc engine changes later). */
  async add(input) {
    const computed = computePlan(input);
    return plans.add({ ...input, computed, status: "draft", postedCategories: {} });
  },

  async update(id, input) {
    const computed = computePlan(input);
    return plans.update(id, { ...input, computed });
  },

  getAll: (farmId) => (farmId ? plans.getBy("farmId", farmId) : plans.getAll())
    .then((l) => l.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))),
  getByField: (fieldId) => plans.getBy("fieldId", fieldId),
  getById: (id) => plans.getById(id),
  remove: (id) => plans.remove(id),

  setStatus: (id, status) => plans.update(id, { status }),
  setNotes: (id, notes) => plans.update(id, { notes }),

  /* Cross-references each seed/fertilizer/protection/organic line against
     inventoryService stock (best-effort name match — this app has no
     canonical product catalog linking planner rows to inventory item ids).
     Returns one row per planner input line with required/available/shortfall
     so the UI can offer "Create Purchase Request" — it never purchases
     anything itself. */
  async reconcileInventory(plan, farmId) {
    const items = await inventoryService.getAll(farmId);
    const matchItem = (name) => {
      const needle = (name || "").trim().toLowerCase();
      if (!needle) return null;
      return items.find((it) => (it.name || "").trim().toLowerCase() === needle)
        || items.find((it) => (it.name || "").trim().toLowerCase().includes(needle) || needle.includes((it.name || "").trim().toLowerCase()))
        || null;
    };

    const lines = [];
    if (plan.computed?.seed?.finalRequiredKg > 0) {
      const match = matchItem(plan.cropName ? `${plan.cropName} seed` : "seed") || matchItem("seed");
      lines.push(reconcileLine("Seed", plan.computed.seed.finalRequiredKg, "kg", match, plan.seed?.seedPrice || 0));
    }
    for (const row of plan.computed?.fertilizer?.rows || []) {
      if (row.qty > 0) lines.push(reconcileLine(row.name || "Fertilizer", row.qty, "kg", matchItem(row.name), row.price));
    }
    for (const row of plan.computed?.protection?.rows || []) {
      if (row.qty > 0) lines.push(reconcileLine(row.product || "Crop protection", row.qty, "unit", matchItem(row.product), row.price));
    }
    for (const row of plan.computed?.organic?.rows || []) {
      if (row.qty > 0) lines.push(reconcileLine(row.name || "Organic input", row.qty, "kg", matchItem(row.name), row.price));
    }
    return lines;
  },

  /* Explicit, per-bucket "post to ledger" action. Idempotent per bucket via
     postedCategories, so re-opening a plan can't double-post the same cost. */
  async postBucketToLedger(plan, bucket, enterpriseId = "crop") {
    if (plan.postedCategories?.[bucket]) return { alreadyPosted: true };
    // Every computed bucket (incl. seed, via its `total` alias) exposes `.total`.
    const amount = plan.computed[bucket]?.total;
    if (!amount || amount <= 0) return { skipped: true, reason: "zero_amount" };

    const categoryId = LEDGER_CATEGORY_BY_BUCKET[bucket] || "other_exp";
    const txnId = await ledgerService.add({
      kind: "expense",
      categoryId,
      enterpriseId,
      amount,
      date: new Date().toISOString().slice(0, 10),
      note: `Crop plan: ${plan.cropName || "Unnamed crop"}${plan.variety ? ` (${plan.variety})` : ""} — ${bucket}`,
      sourceCropPlanId: plan.id,
    });
    await plans.update(plan.id, { postedCategories: { ...(plan.postedCategories || {}), [bucket]: txnId } });
    return { posted: true, txnId };
  },

  /* Explicit purchase-request action for one inventory shortfall line.
     Creates an open CRM purchase order — never auto-purchases, never
     auto-selects a supplier (contactId left null for the user to assign
     in CRM if they choose). */
  async createPurchaseRequest({ item, qty, unit, rate }) {
    return orderService.add({
      kind: "purchase", item, qty, unit, rate,
      date: new Date().toISOString().slice(0, 10),
      contactId: null,
    });
  },
};

/* Builds a { title, generatedAt, sections } report compatible with
   reportService.toCsv/downloadCsv/print (src/services/reports/reportService.js)
   — reused as-is rather than duplicating CSV/print export logic. */
function buildReport(plan) {
  const c = plan.computed;
  return {
    title: `Crop Plan — ${plan.cropName || "Unnamed crop"}`,
    generatedAt: new Date().toLocaleString("en-IN"),
    sections: [
      { heading: "Plan Details", rows: [
        { label: "Crop", value: plan.cropName || "", i18n: { en: "Crop", hi: "फ़सल", bn: "ফসল" } },
        { label: "Variety", value: plan.variety || "", i18n: { en: "Variety", hi: "किस्म", bn: "জাত" } },
        { label: "Season", value: plan.season || "", i18n: { en: "Season", hi: "मौसम", bn: "মৌসুম" } },
        { label: "Area", value: `${plan.areaValue ?? plan.areaAcres} ${plan.areaUnit || "acre"}`, i18n: { en: "Area", hi: "क्षेत्रफल", bn: "আয়তন" } },
        { label: "Status", value: CROP_PLAN_STATUSES.find((s) => s.id === plan.status)?.label || plan.status, i18n: { en: "Status", hi: "स्थिति", bn: "অবস্থা" } },
      ]},
      { heading: "Cultivation Cost Breakdown", rows: [
        { label: "Seed cost", value: rupee(c.seed.totalSeedCost), i18n: { en: "Seed cost", hi: "बीज लागत", bn: "বীজের ব্যয়" } },
        { label: "Fertilizer cost", value: rupee(c.fertilizer.total), i18n: { en: "Fertilizer cost", hi: "उर्वरक लागत", bn: "সারের ব্যয়" } },
        { label: "Crop protection cost", value: rupee(c.protection.total) },
        { label: "Organic input cost", value: rupee(c.organic.total) },
        { label: "Irrigation cost", value: rupee(c.irrigation.total) },
        { label: "Labour cost", value: rupee(c.labour.total), i18n: { en: "Labour cost", hi: "श्रम लागत", bn: "শ্রমের ব্যয়" } },
        { label: "Machinery cost", value: rupee(c.machinery.total) },
        { label: "Other cost", value: rupee(c.other.total) },
        { label: "Total cultivation cost", value: rupee(c.totalCost) },
        { label: "Cost / acre", value: rupee(c.costPerAcre), i18n: { en: "Cost / acre", hi: "प्रति एकड़ लागत", bn: "প্রতি একরের ব্যয়" } },
        { label: "Cost / hectare", value: rupee(c.costPerHectare) },
      ]},
      { heading: "Estimated Profitability (planning estimate, not guaranteed)", rows: [
        { label: "Estimated yield", value: c.yield.totalYield.toLocaleString("en-IN") },
        { label: "Estimated revenue", value: rupee(c.revenue.total) },
        { label: "Estimated profit", value: rupee(c.profit.gross) },
        { label: "ROI", value: c.profit.roiPct === null ? "N/A" : `${c.profit.roiPct}%`, i18n: { en: "ROI", hi: "ROI", bn: "ROI" } },
        { label: "Cost / kg (or unit)", value: c.costPerKg === null ? "N/A" : rupee(c.costPerKg) },
        { label: "Break-even price", value: c.breakEven.breakEvenPrice === null ? "N/A" : rupee(c.breakEven.breakEvenPrice) },
      ]},
    ],
  };
}

/* Side-by-side comparison across 2+ saved plans (spec item 22). */
function buildComparisonReport(plans) {
  const headers = ["Metric", ...plans.map((p) => p.cropName || "Unnamed crop")];
  const row = (label, fn, money = false) => [label, ...plans.map((p) => money ? rupee(fn(p.computed)) : fn(p.computed).toLocaleString("en-IN"))];
  return {
    title: "Crop Plan Comparison",
    generatedAt: new Date().toLocaleString("en-IN"),
    sections: [
      { heading: "Comparison", table: { headers, data: [
        ["Area", ...plans.map((p) => `${p.areaValue ?? p.areaAcres} ${p.areaUnit || "acre"}`)],
        row("Total cultivation cost", (c) => c.totalCost, true),
        row("Cost / acre", (c) => c.costPerAcre, true),
        row("Labour cost", (c) => c.labour.total, true),
        row("Estimated yield", (c) => c.yield.totalYield),
        row("Estimated revenue", (c) => c.revenue.total, true),
        row("Estimated profit", (c) => c.profit.gross, true),
        ["ROI", ...plans.map((p) => p.computed.profit.roiPct === null ? "N/A" : `${p.computed.profit.roiPct}%`)],
      ] } },
    ],
  };
}

cropPlanService.buildReport = buildReport;
cropPlanService.buildComparisonReport = buildComparisonReport;

function reconcileLine(label, required, unit, matchedItem, price) {
  const available = matchedItem ? Number(matchedItem.qty) || 0 : null;
  const shortfall = available === null ? required : Math.max(0, required - available);
  return {
    label, required, unit, available,
    matchedItemName: matchedItem?.name || null,
    shortfall,
    purchaseCost: shortfall > 0 ? Math.round(shortfall * (Number(price) || 0) * 100) / 100 : 0,
  };
}
