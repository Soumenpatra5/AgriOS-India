/* Daily feed consumption log. Deducts inventory through the existing
   inventoryService.move() (same stock-movement audit trail every other
   ERP module uses) rather than writing to inventory records directly —
   consumption and inventory deduction stay consistent because they go
   through the one function that owns that invariant. */

import { repo } from "../erp/erpDb.js";
import { inventoryService } from "../inventory/inventoryService.js";

const consumption = repo("feedConsumption");

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function round2(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round((x + Number.EPSILON) * 100) / 100 : 0;
}

export const feedConsumptionService = {
  /**
   * log — records one day's feed use for a batch. `feedItemId` is optional
   * (a log can be recorded without linking to a specific inventory item,
   * e.g. while inventory tracking isn't set up yet) but when given, stock
   * is deducted via inventoryService.move("out", ...) as an explicit
   * consequence of confirming this log entry.
   */
  async log({
    date, farmId, batchId, enterprise, animalCount, avgWeight,
    feedItemId = null, feedType = "", quantityUsed, unitPrice = 0,
    recordedBy = "", notes = "",
  }) {
    const qty = safeNum(quantityUsed);
    const price = safeNum(unitPrice);
    const totalCost = round2(qty * price);
    const animals = safeNum(animalCount);
    const weight = safeNum(avgWeight);

    const record = await consumption.add({
      date: date || new Date().toISOString().slice(0, 10),
      farmId, batchId, enterprise, animalCount: animals, avgWeight: weight,
      feedItemId, feedType, quantityUsed: qty, unitPrice: price, totalCost,
      feedCostPerAnimal: animals > 0 ? round2(totalCost / animals) : 0,
      feedCostPerKgBodyWeight: (weight > 0 && animals > 0) ? round2(totalCost / (weight * animals)) : null,
      recordedBy, notes,
    });

    if (feedItemId && qty > 0) {
      await inventoryService.move(feedItemId, "out", qty, `Consumption${batchId ? " — batch " + batchId : ""}`);
    }

    return record;
  },

  /* Deleting a log must not leave inventory permanently short by the
     quantity that was deducted when it was logged — reverse the stock
     movement first, same audit-trailed inventoryService.move() used to
     make the original deduction. */
  async remove(id) {
    const rec = await consumption.getById(id);
    if (rec?.feedItemId && Number(rec.quantityUsed) > 0) {
      await inventoryService.move(rec.feedItemId, "in", rec.quantityUsed, "Reversal — consumption log deleted");
    }
    return consumption.remove(id);
  },

  forBatch: (batchId) => consumption.getBy("batchId", batchId)
    .then((l) => l.sort((a, b) => (b.date || "").localeCompare(a.date || ""))),

  async totalsForBatch(batchId) {
    const entries = await this.forBatch(batchId);
    return {
      entries,
      totalQty: round2(entries.reduce((s, e) => s + (Number(e.quantityUsed) || 0), 0)),
      totalCost: round2(entries.reduce((s, e) => s + (Number(e.totalCost) || 0), 0)),
    };
  },

  async recent(farmId, limit = 20) {
    const all = await this.all(farmId);
    return all.slice(0, limit);
  },

  async all(farmId) {
    const list = farmId ? await consumption.getBy("farmId", farmId) : await consumption.getAll();
    return list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  },
};
