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

const plans = repo("cropPlans");

export const CROP_PLAN_STATUSES = [
  { id: "draft",       label: "Draft" },
  { id: "planned",     label: "Planned" },
  { id: "approved",    label: "Approved" },
  { id: "in_progress", label: "In progress" },
  { id: "harvested",   label: "Harvested" },
  { id: "completed",   label: "Completed" },
  { id: "cancelled",   label: "Cancelled" },
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
    const amount = bucket === "seed" ? plan.computed.seed.totalSeedCost
      : bucket === "irrigation" ? plan.computed.irrigation.total
      : plan.computed[bucket]?.total;
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
