/* THE canonical Feed Conversion Ratio implementation.

   This function was born in src/services/feed/feedBatchService.js and was
   validated there. It now lives here, alone, and BOTH callers import it:

     src/services/feed/feedBatchService.js   (client, feed batches)
     api/_lib/farm/poultryOps.js             (server, poultry batches)

   There is exactly one implementation, so the two can never drift. Moving it
   rather than copying it is the whole point: a "server port kept in parity by
   tests" is still two implementations, and the tests only catch drift after
   someone has already shipped it.

   WHY THIS FILE HAS NO IMPORTS. api/ is self-contained by design — nothing
   under api/ imports from src/ anywhere in this project, while src/ imports
   from api/ in five places (permissions, chat, dm, tasks). Keeping this a leaf
   module preserves that direction, makes a circular dependency impossible, and
   means the client bundles a few hundred bytes of pure arithmetic with no
   server-only code attached. safeNum/round2 are therefore defined here rather
   than imported from src/utils/num.js; fcr.test.js asserts the two behave
   identically, so the duplication cannot rot silently.

   UNITS — the one thing to get wrong. This function is unit-agnostic: it only
   requires that weight and feed use the SAME mass unit. The original caller
   works in kilograms throughout. Poultry stores bird weights in GRAMS and feed
   in KILOGRAMS, so poultry MUST convert at fcrInputsFromPoultry() below and
   nowhere else. Feeding grams straight in reports an FCR about 1000x wrong. */

/* Coerce to a finite POSITIVE number — negatives, NaN and non-numeric input
   all become 0, so a bad keystroke cannot produce a negative quantity.
   Mirrors src/utils/num.js safeNum exactly. */
export function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* Round to 2 decimals, finite-guarded. Mirrors src/utils/num.js round2. */
export function round2(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round((x + Number.EPSILON) * 100) / 100 : 0;
}

/* The single, named grams -> kilograms boundary. Every poultry weight crossing
   into FCR passes through here; there are no other /1000 conversions in the
   poultry code, by rule. Returns null for absent input so a missing weight
   stays missing rather than becoming a confident 0. */
export function gramsToKg(grams) {
  if (grams === null || grams === undefined || grams === "") return null;
  const n = Number(grams);
  if (!Number.isFinite(n)) return null;
  return n / 1000;
}

/* FCR = total feed consumed / total weight gain (biomass, not per-animal).
   Biomass = average weight x count.

   Returns null (not 0, not Infinity) when weight gain is 0 or negative: there
   is no meaningful FCR to report yet, and a 0 would read as "perfect
   conversion". targetFCR is whatever the farmer configured — never a built-in
   default, because a variance against a number the software invented is not a
   variance against anything.

   Unchanged from the original implementation. Do not add a second formula. */
export function computeFCR(batch, totalFeedConsumed) {
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
}

/* The poultry adapter: the ONE place grams become kilograms.

   Poultry's own vocabulary (placed_qty, placement_avg_weight_g, live birds,
   latest sample weight) is translated into the batch shape computeFCR expects,
   with every weight converted to kg so it matches feed's unit.

   A batch with no weighing yet has currentWeight null — computeFCR then reads
   it as 0 biomass, weight gain comes out negative or zero, and FCR is null.
   That is the correct answer: you cannot know feed conversion before you have
   weighed anything. */
export function fcrInputsFromPoultry({
  placedQty, placementAvgWeightG, liveBirds, latestAvgWeightG, targetFcr,
}) {
  return {
    initialCount: placedQty,
    initialWeight: gramsToKg(placementAvgWeightG) ?? 0,
    currentCount: liveBirds,
    currentWeight: gramsToKg(latestAvgWeightG),
    targetFCR: targetFcr,
  };
}

/* Convenience: poultry inputs straight to an FCR result, so a caller never
   assembles the intermediate shape by hand and forgets the conversion. */
export function computePoultryFCR(inputs, totalFeedConsumedKg) {
  return computeFCR(fcrInputsFromPoultry(inputs), totalFeedConsumedKg);
}
