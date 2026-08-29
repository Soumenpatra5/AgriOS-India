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
import { productionService } from "../livestock/livestockService.js";
import { safeNum, round2 } from "../../utils/num.js";

const batches = repo("feedBatches");

/* label stays English — it is the stored value, the text in CSV exports and
   the key reports group on. i18n is what the UI shows. */
export const BATCH_STATUSES = [
  { id: "active", label: "Active", i18n: { en: "Active", hi: "सक्रिय", bn: "সক্রিয়" } },
  { id: "closed", label: "Closed", i18n: { en: "Closed", hi: "बंद", bn: "বন্ধ" } },
];

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
  /* `preBatch` lets a caller that already loaded the batch row (e.g.
     speciesInsights) skip re-fetching it. */
  async summary(batchId, preBatch = null) {
    const [batchRow, totals] = await Promise.all([
      preBatch ? Promise.resolve(preBatch) : batches.getById(batchId),
      feedConsumptionService.totalsForBatch(batchId),
    ]);
    const batch = batchRow;
    if (!batch) return null;
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

  /* Species-specific view on top of the generic FCR/cost summary — same
     precedent as HerdManager.jsx (one generic component + per-enterprise
     config) rather than three separate near-duplicate pages. Only
     available when the batch is linked to a real animal/flock/pond record
     (batch.animalId) via the "Link to existing animal/flock/pond" field on
     batch creation, since without that link there's no production data to
     cross-reference.

     Livestock production records use inconsistent id field names per
     enterprise (dairy: animalId, poultry: flockId, fish: pondId — verified
     directly in PoultryManager.jsx/FishManager.jsx/DairyManager.jsx rather
     than assumed), so this reads the whole enterprise's records and
     filters client-side by whichever field that enterprise actually uses,
     rather than relying on productionService.getForAnimal()'s animalId-only
     index (which would silently return nothing for poultry/fish). */
  async speciesInsights(batchId) {
    const batch = await batches.getById(batchId);
    if (!batch || !batch.animalId) return null;

    const idField = batch.enterprise === "dairy" ? "animalId"
      : batch.enterprise === "poultry" ? "flockId"
      : batch.enterprise === "fish" ? "pondId"
      : null;
    if (!idField) return null;

    const start = batch.startDate || "0000-01-01";
    const end = batch.endDate || new Date().toISOString().slice(0, 10);
    const [records, summary] = await Promise.all([
      productionService.getForEnterprise(batch.enterprise, 10000),
      this.summary(batchId, batch), // reuse the batch row we already loaded
    ]);
    if (!summary) return null;
    const inRange = records.filter((r) => r[idField] === batch.animalId && r.date >= start && r.date <= end);

    if (batch.enterprise === "dairy") {
      const milkYield = round2(inRange.reduce((s, r) => s + (Number(r.amLitres) || 0) + (Number(r.pmLitres) || 0), 0));
      return { kind: "dairy", milkYield, costPerLitre: milkYield > 0 ? round2(summary.totalFeedCost / milkYield) : null };
    }
    if (batch.enterprise === "poultry") {
      const eggs = inRange.reduce((s, r) => s + (Number(r.eggs) || 0), 0);
      const mortality = inRange.reduce((s, r) => s + (Number(r.mortality) || 0), 0);
      return { kind: "poultry", eggs, costPerEgg: eggs > 0 ? round2(summary.totalFeedCost / eggs) : null, mortality };
    }
    if (batch.enterprise === "fish") {
      const currentCount = batch.currentCount != null ? safeNum(batch.currentCount) : safeNum(batch.initialCount);
      const biomass = round2(safeNum(batch.currentWeight) * currentCount);
      const mortality = Math.max(0, safeNum(batch.initialCount) - currentCount);
      const latest = [...inRange].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
      return { kind: "fish", biomass, mortality, waterQuality: latest?.waterQuality || null };
    }
    return null;
  },
};
