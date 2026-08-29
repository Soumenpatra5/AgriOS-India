/* Feed wastage — spoilage, spillage, damaged/expired stock. Deducts
   inventory through the existing inventoryService.move() (same audit
   trail as consumption), tagged with the wastage reason. */

import { repo } from "../erp/erpDb.js";
import { inventoryService } from "../inventory/inventoryService.js";
import { feedConsumptionService } from "./feedConsumptionService.js";
import { safeNum, round2 } from "../../utils/num.js";

const wastage = repo("feedWastage");

export const WASTAGE_REASONS = [
  { id: "spillage",  label: "Spillage" , i18n: { en: "Spillage", hi: "छलकाव", bn: "ছিটকে পড়া" } },
  { id: "spoilage",  label: "Spoilage" , i18n: { en: "Spoilage", hi: "खराब होना", bn: "নষ্ট হওয়া" } },
  { id: "expired",   label: "Expired" , i18n: { en: "Expired", hi: "समय-सीमा समाप्त", bn: "মেয়াদোত্তীর্ণ" } },
  { id: "damaged",   label: "Damaged" , i18n: { en: "Damaged", hi: "क्षतिग्रस्त", bn: "ক্ষতিগ্রস্ত" } },
  { id: "pest",      label: "Pest / rodent damage" , i18n: { en: "Pest / rodent damage", hi: "कीट / चूहे से नुकसान", bn: "পোকা / ইঁদুরের ক্ষতি" } },
  { id: "other",     label: "Other" , i18n: { en: "Other", hi: "अन्य", bn: "অন্যান্য" } },
];

export const feedWastageService = {
  async log({ date, farmId, batchId = null, feedItemId = null, feedType = "", quantity, reason = "other", unitPrice = 0, recordedBy = "" }) {
    const qty = safeNum(quantity);
    const price = safeNum(unitPrice);
    const costImpact = round2(qty * price);

    const record = await wastage.add({
      date: date || new Date().toISOString().slice(0, 10),
      farmId, batchId, feedItemId, feedType, quantity: qty, reason, unitPrice: price, costImpact, recordedBy,
    });

    if (feedItemId && qty > 0) {
      await inventoryService.move(feedItemId, "out", qty, `Wastage — ${WASTAGE_REASONS.find((r) => r.id === reason)?.label || reason}`);
    }

    return record;
  },

  /* Same reversal principle as feedConsumptionService.remove(). */
  async remove(id) {
    const rec = await wastage.getById(id);
    if (rec?.feedItemId && Number(rec.quantity) > 0) {
      await inventoryService.move(rec.feedItemId, "in", rec.quantity, "Reversal — wastage log deleted");
    }
    return wastage.remove(id);
  },

  forBatch: (batchId) => wastage.getBy("batchId", batchId)
    .then((l) => l.sort((a, b) => (b.date || "").localeCompare(a.date || ""))),

  all: (farmId) => (farmId ? wastage.getBy("farmId", farmId) : wastage.getAll())
    .then((l) => l.sort((a, b) => (b.date || "").localeCompare(a.date || ""))),

  reasonLabel: (id) => WASTAGE_REASONS.find((r) => r.id === id)?.label ?? id,

  /* Total wastage, wastage cost, and wastage % relative to total feed
     handled (consumption + wastage) for the same batch — the natural
     denominator, since "% of what" needs a comparison base. */
  async summaryForBatch(batchId) {
    const [wasteEntries, consumptionTotals] = await Promise.all([
      this.forBatch(batchId),
      feedConsumptionService.totalsForBatch(batchId),
    ]);
    const totalWastageQty = round2(wasteEntries.reduce((s, w) => s + (Number(w.quantity) || 0), 0));
    const totalWastageCost = round2(wasteEntries.reduce((s, w) => s + (Number(w.costImpact) || 0), 0));
    const totalHandled = totalWastageQty + consumptionTotals.totalQty;
    const wastagePct = totalHandled > 0 ? round2((totalWastageQty / totalHandled) * 100) : 0;
    return { entries: wasteEntries, totalWastageQty, totalWastageCost, wastagePct };
  },
};
