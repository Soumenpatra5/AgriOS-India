/* Crop Input & Cultivation Cost Planner — calculation engine.

   Pure, side-effect-free arithmetic only. No fetches, no storage, no i18n —
   callers (UI, tests, future persistence layer) own everything else. Every
   function guards against negative/NaN/Infinity inputs so a bad keystroke in
   the UI can never produce a broken or misleading total.

   This is a planning/estimation tool: nothing here invents an agricultural
   rate, a pesticide dose, or a market price. Every rate/price is either
   supplied by the caller or explicitly configured elsewhere (see
   src/services/agronomy/cropNorms.js) — if neither is available, the field
   is left at 0 and the UI is responsible for prompting the user. */

import { acresToHectares } from "../../utils/units.js";

/* Coerce to a finite, non-negative number. Bad input -> 0, never NaN/Infinity. */
export function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/* ---------------------------------------------------------------- seed -- */

/* areaAcres, seedRate (kg/acre), seedPrice (₹/kg), seedTreatmentCost (₹ flat),
   wastagePct (0-100). Mirrors the worked example in the spec:
   3 acres x 50 kg/acre @ ₹55/kg = 150 kg, ₹8,250. */
export function seedCalc({ areaAcres, seedRate, seedPrice, seedTreatmentCost = 0, wastagePct = 0 } = {}) {
  const area = safeNum(areaAcres);
  const rate = safeNum(seedRate);
  const price = safeNum(seedPrice);
  const treatment = safeNum(seedTreatmentCost);
  const wastage = Math.min(100, Math.max(0, safeNum(wastagePct)));

  const baseRequiredKg = round2(area * rate);
  const wastageKg = round2(baseRequiredKg * (wastage / 100));
  const finalRequiredKg = round2(baseRequiredKg + wastageKg);
  const seedCost = round2(finalRequiredKg * price);
  const totalSeedCost = round2(seedCost + treatment);

  return { baseRequiredKg, wastageKg, finalRequiredKg, seedCost, seedTreatmentCost: treatment, totalSeedCost };
}

/* ------------------------------------------------------- repeatable rows -- */

/* Generic "N rows -> {rows-with-computed-fields, total}" reducer used by
   fertilizer / protection / organic / labour / machinery / other-costs. */
function sumRows(rows, computeRow) {
  const list = Array.isArray(rows) ? rows : [];
  const computed = list.map((r) => computeRow(r || {}));
  const total = round2(computed.reduce((s, r) => s + r.cost, 0));
  return { rows: computed, total };
}

/* row: { name, rate, price, applications } ; rate is per-acre per application */
export function fertilizerCalc(rows, areaAcres) {
  const area = safeNum(areaAcres);
  return sumRows(rows, (r) => {
    const qty = round2(area * safeNum(r.rate) * Math.max(1, safeNum(r.applications) || 1));
    const cost = round2(qty * safeNum(r.price));
    return { ...r, qty, cost };
  });
}

/* row: { product, rate, price, applications } — same shape as fertilizer;
   kept separate so protection-specific fields (e.g. category) can diverge later. */
export function protectionCalc(rows, areaAcres) {
  const area = safeNum(areaAcres);
  return sumRows(rows, (r) => {
    const qty = round2(area * safeNum(r.rate) * Math.max(1, safeNum(r.applications) || 1));
    const cost = round2(qty * safeNum(r.price));
    return { ...r, qty, cost };
  });
}

export function organicCalc(rows, areaAcres) {
  const area = safeNum(areaAcres);
  return sumRows(rows, (r) => {
    const qty = round2(area * safeNum(r.rate) * Math.max(1, safeNum(r.applications) || 1));
    const cost = round2(qty * safeNum(r.price));
    return { ...r, qty, cost };
  });
}

/* Irrigation has no repeatable "rows" in v1 — a single cost block. */
export function irrigationCalc({ numIrrigations = 0, waterCostPerIrrigation = 0, electricityCost = 0, dieselCost = 0 } = {}) {
  const n = safeNum(numIrrigations);
  const perIrrigation = safeNum(waterCostPerIrrigation);
  const waterTotal = round2(n * perIrrigation);
  const electricity = safeNum(electricityCost);
  const diesel = safeNum(dieselCost);
  const total = round2(waterTotal + electricity + diesel);
  return { numIrrigations: n, waterTotal, electricity, diesel, total };
}

/* row: { type, workers, days, wage } */
export function labourCalc(rows) {
  return sumRows(rows, (r) => {
    const labourDays = round2(safeNum(r.workers) * safeNum(r.days));
    const cost = round2(labourDays * safeNum(r.wage));
    return { ...r, labourDays, cost };
  });
}

/* row: { machine, hours, ratePerHour, fuelCost, operatorCost } */
export function machineryCalc(rows) {
  return sumRows(rows, (r) => {
    const machineCost = round2(safeNum(r.hours) * safeNum(r.ratePerHour));
    const fuelCost = safeNum(r.fuelCost);
    const operatorCost = safeNum(r.operatorCost);
    const cost = round2(machineCost + fuelCost + operatorCost);
    return { ...r, machineCost, fuelCost, operatorCost, cost };
  });
}

/* row: { label, amount } — transport, packaging, storage, misc, etc. */
export function otherCostsCalc(rows) {
  return sumRows(rows, (r) => ({ ...r, cost: safeNum(r.amount) }));
}

/* --------------------------------------------------- yield / revenue / profit -- */

export function yieldEstimate({ areaAcres, yieldPerAcre = 0 } = {}) {
  const area = safeNum(areaAcres);
  const perAcre = safeNum(yieldPerAcre);
  return { perAcre, totalYield: round2(area * perAcre) };
}

export function revenueEstimate({ totalYield = 0, sellingPrice = 0 } = {}) {
  const qty = safeNum(totalYield);
  const price = safeNum(sellingPrice);
  return { total: round2(qty * price) };
}

/* profit = revenue - cost ; ROI% = profit / cost * 100 (null when cost is 0 — undefined, not 0%) */
export function profitEstimate({ revenue = 0, totalCost = 0 } = {}) {
  const rev = safeNum(revenue);
  const cost = safeNum(totalCost);
  const gross = round2(rev - cost);
  const roiPct = cost > 0 ? round2((gross / cost) * 100) : null;
  return { gross, roiPct };
}

/* Break-even yield: quantity that must be produced (at the given selling
   price) to exactly cover total cost. Break-even price: the selling price
   needed (at the given yield) to exactly cover total cost. Both are null
   when the divisor is 0 — there is no meaningful break-even to report. */
export function breakEven({ totalCost = 0, sellingPrice = 0, totalYield = 0 } = {}) {
  const cost = safeNum(totalCost);
  const price = safeNum(sellingPrice);
  const qty = safeNum(totalYield);
  return {
    breakEvenYield: price > 0 ? round2(cost / price) : null,
    breakEvenPrice: qty > 0 ? round2(cost / qty) : null,
    breakEvenRevenue: cost,
  };
}

/* --------------------------------------------------------------- composition -- */

/**
 * computePlan — composes every domain calculation into one cultivation-cost
 * summary. `input` is a plain object (no classes), shaped as:
 * {
 *   areaAcres, yieldUnit,
 *   seed: { seedRate, seedPrice, seedTreatmentCost, wastagePct },
 *   fertilizer: [{ name, rate, price, applications }],
 *   protection: [{ product, rate, price, applications }],
 *   organic: [{ name, rate, price, applications }],
 *   irrigation: { numIrrigations, waterCostPerIrrigation, electricityCost, dieselCost },
 *   labour: [{ type, workers, days, wage }],
 *   machinery: [{ machine, hours, ratePerHour, fuelCost, operatorCost }],
 *   other: [{ label, amount }],
 *   yieldPerAcre, sellingPrice,
 * }
 */
export function computePlan(input = {}) {
  const areaAcres = safeNum(input.areaAcres);

  const seed = seedCalc({ areaAcres, ...input.seed });
  const fertilizer = fertilizerCalc(input.fertilizer, areaAcres);
  const protection = protectionCalc(input.protection, areaAcres);
  const organic = organicCalc(input.organic, areaAcres);
  const irrigation = irrigationCalc(input.irrigation);
  const labour = labourCalc(input.labour);
  const machinery = machineryCalc(input.machinery);
  const other = otherCostsCalc(input.other);

  const totalCost = round2(
    seed.totalSeedCost + fertilizer.total + protection.total + organic.total +
    irrigation.total + labour.total + machinery.total + other.total
  );

  const costPerAcre = areaAcres > 0 ? round2(totalCost / areaAcres) : 0;
  const areaHectares = acresToHectares(areaAcres);
  const costPerHectare = areaHectares > 0 ? round2(totalCost / areaHectares) : 0;

  const yld = yieldEstimate({ areaAcres, yieldPerAcre: input.yieldPerAcre });
  const revenue = revenueEstimate({ totalYield: yld.totalYield, sellingPrice: input.sellingPrice });
  const profit = profitEstimate({ revenue: revenue.total, totalCost });
  const costPerKg = yld.totalYield > 0 ? round2(totalCost / yld.totalYield) : null;
  const be = breakEven({ totalCost, sellingPrice: input.sellingPrice, totalYield: yld.totalYield });

  return {
    areaAcres, costPerAcre, costPerHectare,
    seed, fertilizer, protection, organic, irrigation, labour, machinery, other,
    totalCost,
    yield: yld, revenue, profit, costPerKg, breakEven: be,
  };
}

/* ------------------------------------------------- scenarios / sensitivity -- */

/**
 * applyScenario — recomputes yield/revenue/profit/ROI/cost-per-kg from an
 * already-computed plan under a hypothetical %-adjustment to yield, selling
 * price, and total cost. Percentages are whatever the caller/user types
 * (e.g. "Conservative" = -15% yield) — this function invents no numbers of
 * its own, it only does the arithmetic once given someone else's assumption.
 * areaAcres is carried through unchanged (a scenario doesn't resize a field).
 */
export function applyScenario(plan, { yieldPct = 0, pricePct = 0, costPct = 0 } = {}) {
  const yieldMult = 1 + safePct(yieldPct) / 100;
  const priceMult = 1 + safePct(pricePct) / 100;
  const costMult = 1 + safePct(costPct) / 100;

  const totalYield = round2(Math.max(0, plan.yield.totalYield * yieldMult));
  const effectivePrice = Math.max(0, (plan.revenue.total > 0 && plan.yield.totalYield > 0 ? plan.revenue.total / plan.yield.totalYield : 0) * priceMult);
  const totalCost = round2(Math.max(0, plan.totalCost * costMult));

  const revenue = revenueEstimate({ totalYield, sellingPrice: effectivePrice });
  const profit = profitEstimate({ revenue: revenue.total, totalCost });
  const costPerKg = totalYield > 0 ? round2(totalCost / totalYield) : null;
  const costPerAcre = plan.areaAcres > 0 ? round2(totalCost / plan.areaAcres) : 0;

  return { totalYield, sellingPrice: round2(effectivePrice), totalCost, costPerAcre, revenue: revenue.total, profit: profit.gross, roiPct: profit.roiPct, costPerKg };
}

/* Percentage deltas may be negative (e.g. "-15% yield" for a conservative
   scenario), so this only guards against NaN/Infinity — it does not clamp
   to positive like safeNum() does for absolute quantities. */
function safePct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
