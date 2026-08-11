/* Feed batches — the unit FCR (Feed Conversion Ratio) is computed against.
   No batch/group entity existed anywhere in the app before this (poultry
   and fish already treat their "animal" row as a group with a count, but
   goat/pig/sheep/dairy track individuals) — this is deliberately new and
   generic so it works the same way for every enterprise, referencing
   livestock's animalId loosely (same cross-service reference pattern used
   by Crop Plans -> farmId/fieldId) rather than requiring changes to
   livestockService.

   Weight gain is whatever the farmer records as initial/current average
   weight -- nothing here derives a gain from existing per-animal weight
   logs, since no such delta calculation exists anywhere in the app and
   guessing which two log entries represent "before/after" would be
   inventing data the project's rules explicitly warn against. */

import { repo } from "../erp/erpDb.js";
import { feedConsumptionService } from "./feedConsumptionService.js";

const batches = repo("feedBatches");

export const BATCH_STATUSES = [
  { id: "active", label: "Active" },
  { id: "closed", label: "Closed" },
];

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function round2(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round((x + Number.EPSILON) * 100) / 100 : 0;
}

export const feedBatchService = {
  add: (data) => batches.add({ status: "active", ...data }),
  update: (id, patch) => batches.update(id, patch),
  remove: (id) => batches.remove(id),
  getById: (id) => batches.getById(id),
  getAll: (farmId) => (farmId ? batches.getBy("farmId", farmId) : batches.getAll())
    .then((l) => l.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))),
  getByEnterprise: (enterprise) => batches.getBy("enterprise", enterprise),

  close: (id, { endDate, currentCount, currentWeight }) =>
    batches.update(id, { status: "closed", endDate: endDate || new Date().toISOString().slice(0, 10), currentCount, currentWeight }),

  /* FCR = total feed consumed / total weight gain (biomass, not per-animal).
     Biomass = average weight x count, matching the spec's worked example
     (2,500 birds initial, 1.8kg average weight now -> current biomass).
     Returns null (not 0/Infinity) when weight gain is 0 or negative — there
     is no meaningful FCR to report yet. targetFCR is whatever the farmer
     configured on the batch (never a built-in default). */
  computeFCR(batch, totalFeedConsumed) {
    const initialBiomass = safeNum(batch.initialWeight) * safeNum(batch.initialCount);
    const currentCount = batch.currentCount != null ? safeNum(batch.currentCount) : safeNum(batch.initialCount);
    const currentWeight = batch.currentWeight != null ? safeNum(batch.currentWeight) : 0;
    const currentBiomass = currentWeight * currentCount;
    const weightGain = round2(currentBiomass - initialBiomass);
    const feed = safeNum(totalFeedConsumed);

    const fcr = weightGain > 0 ? round2(feed / weightGain) : null;
    const target = batch.targetFCR != null && batch.targetFCR !== "" ? Number(batch.targetFCR) : null;
    const fcrDiff = fcr !== null && target !== null && Number.isFinite(target) ? round2(fcr - target) : null;
    /* Lower FCR is better (less feed per kg gained), so a negative diff
       (actual below target) is "better than target". */
    const performanceStatus = fcrDiff === null ? "no_target"
      : fcrDiff <= 0 ? "on_or_better_than_target" : "worse_than_target";
    const feedEfficiency = fcr !== null && fcr > 0 ? round2(100 / fcr) : null; // % biomass gained per unit feed

    return { weightGain, fcr, targetFCR: target, fcrDiff, performanceStatus, feedEfficiency };
  },

  /* Full batch-level summary: consumption totals + FCR, in one call. */
  async summary(batchId) {
    const batch = await batches.getById(batchId);
    if (!batch) return null;
    const totals = await feedConsumptionService.totalsForBatch(batchId);
    const fcr = this.computeFCR(batch, totals.totalQty);

    const days = batch.startDate
      ? Math.max(1, Math.round((Date.parse(batch.endDate || new Date().toISOString()) - Date.parse(batch.startDate)) / 86400000))
      : 1;
    const countForCost = batch.currentCount != null ? safeNum(batch.currentCount) || safeNum(batch.initialCount) : safeNum(batch.initialCount);

    return {
      batch,
      totalFeed: totals.totalQty,
      totalFeedCost: totals.totalCost,
      averageDailyFeed: round2(totals.totalQty / days),
      feedCostPerAnimal: countForCost > 0 ? round2(totals.totalCost / countForCost) : 0,
      feedCostPerKgGain: fcr.weightGain > 0 ? round2(totals.totalCost / fcr.weightGain) : null,
      ...fcr,
    };
  },
};
