/* DPR financial engine — the appraisal maths a bank/NABARD DPR is judged on.

   Pure functions only: no storage, no React, no clock. Everything here is
   deterministic given its arguments, so the whole viability calculation is
   unit-testable and can be re-run identically when a farmer edits an input.

   Conventions used throughout (standard NABARD term-loan appraisal):
   - Year 0 is the investment year; years 1..N are operating years.
   - Interest is served from year 1; PRINCIPAL repayment starts only after the
     moratorium (gestation) period — that is what a moratorium means here.
   - DSCR counts depreciation and interest back into the numerator because
     both are non-cash / already-counted-as-debt-service items.
   All money is in rupees; all rates are percent per annum unless named _frac. */

import { safeNum, round2 } from "../../../utils/num.js";

/* ---------- loan servicing ---------- */

/* Equated monthly instalment. A 0% loan repays principal evenly. */
export function emi(principal, annualRatePct, months) {
  const P = safeNum(principal);
  const n = Math.round(safeNum(months));
  if (!P || !n) return 0;
  const r = safeNum(annualRatePct) / 100 / 12;
  if (!r) return round2(P / n);
  const f = Math.pow(1 + r, n);
  return round2((P * r * f) / (f - 1));
}

/* Year-wise loan schedule.

   Principal is amortised in equal annual instalments over the repayment years
   that remain after the moratorium (the usual NABARD presentation — banks
   quote a yearly repayment ladder in the DPR, not 84 monthly rows). Interest
   each year is charged on the opening balance.

   Returns [{ year, opening, interest, principal, total, closing }]. */
export function loanSchedule({ principal, ratePct, tenureYears, moratoriumMonths = 0 }) {
  const P = safeNum(principal);
  const years = Math.round(safeNum(tenureYears));
  if (!P || !years) return [];

  const rate = safeNum(ratePct) / 100;
  // Moratorium is expressed in months but the ladder is annual; a part-year of
  // moratorium still shields that whole year's principal.
  const graceYears = Math.min(years - 1, Math.ceil(safeNum(moratoriumMonths) / 12));
  const repayYears = years - graceYears;
  const perYear = P / repayYears;

  const rows = [];
  let opening = P;
  for (let y = 1; y <= years; y++) {
    const interest = round2(opening * rate);
    const principalDue = y > graceYears ? round2(Math.min(perYear, opening)) : 0;
    const closing = round2(opening - principalDue);
    rows.push({ year: y, opening: round2(opening), interest, principal: principalDue,
      total: round2(interest + principalDue), closing });
    opening = closing;
  }
  return rows;
}

/* ---------- capital ---------- */

/* Straight-line depreciation per year over each item's useful life.
   Items: [{ amount, lifeYears }]. Items with no life (e.g. livestock treated
   as a revolving asset) contribute nothing. */
export function straightLineDepreciation(items = []) {
  return round2(items.reduce((sum, i) => {
    const life = safeNum(i.lifeYears);
    return life ? sum + safeNum(i.amount) / life : sum;
  }, 0));
}

/* ---------- discounted measures ---------- */

/* Net present value. flows[0] is the year-0 (investment) flow, undiscounted. */
export function npv(ratePct, flows = []) {
  const r = safeNum(ratePct) / 100;
  return round2(flows.reduce((sum, f, i) => sum + Number(f || 0) / Math.pow(1 + r, i), 0));
}

/* Internal rate of return, as a percent, by bisection.

   Returns null when the flows never cross zero (e.g. a project that is never
   profitable, or one with no negative flow) — an honest "not computable" is
   better than a fabricated rate in a document a bank will read. */
export function irr(flows = [], { lowPct = -99, highPct = 1000, iterations = 200 } = {}) {
  /* An IRR only exists if the project both spends and earns. Without one of
     each the bisection below would "converge" on a meaningless rate — an
     all-zero draft project used to report a confident 450%. */
  if (!flows.some((f) => Number(f) > 0) || !flows.some((f) => Number(f) < 0)) return null;

  const at = (pct) => flows.reduce((s, f, i) => s + Number(f || 0) / Math.pow(1 + pct / 100, i), 0);
  let lo = lowPct, hi = highPct;
  let fLo = at(lo);
  const fHi = at(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const fMid = at(mid);
    if (fMid === 0) return round2(mid);
    // Only the low end's sign is carried forward — the bracket is decided by
    // comparing against it, so fHi is never re-read.
    if (fLo * fMid < 0) { hi = mid; } else { lo = mid; fLo = fMid; }
  }
  return round2((lo + hi) / 2);
}

/* Benefit-cost ratio — PV(benefits) / PV(costs), both discounted at the same
   rate. Banks look for > 1; NABARD typically wants comfortably above 1. */
export function bcr(ratePct, benefits = [], costs = []) {
  const r = safeNum(ratePct) / 100;
  const pv = (arr) => arr.reduce((s, f, i) => s + Number(f || 0) / Math.pow(1 + r, i), 0);
  const pvCosts = pv(costs);
  if (!pvCosts) return null;
  return round2(pv(benefits) / pvCosts);
}

/* ---------- servicing capacity ---------- */

/* Debt service coverage ratio for one year.
   (net surplus + interest + depreciation) / (interest + principal repaid).
   Returns null in years with no debt service — a ratio over zero is undefined,
   not infinite, and printing "∞" in a bank document helps nobody. */
export function dscr({ netSurplus, interest, depreciation, principalRepaid }) {
  const service = safeNum(interest) + safeNum(principalRepaid);
  if (!service) return null;
  const available = Number(netSurplus || 0) + safeNum(interest) + safeNum(depreciation);
  return round2(available / service);
}

/* Average DSCR across the years that actually carry debt service. */
export function averageDscr(rows = []) {
  const vals = rows.map((r) => r.dscr).filter((v) => typeof v === "number");
  if (!vals.length) return null;
  return round2(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/* ---------- payback & break-even ---------- */

/* Payback period in years, interpolated within the year the cumulative net
   flow turns positive. flows[0] is the (negative) investment. Null if never. */
export function paybackPeriod(flows = []) {
  let cum = Number(flows[0] || 0);
  if (cum >= 0) return 0;
  for (let i = 1; i < flows.length; i++) {
    const f = Number(flows[i] || 0);
    if (cum + f >= 0) return round2(i - 1 + (f ? -cum / f : 0));
    cum += f;
  }
  return null;
}

/* Break-even output in production units:
   fixed cost / (price per unit - variable cost per unit). */
export function breakEvenUnits({ fixedCost, pricePerUnit, variableCostPerUnit }) {
  const contribution = safeNum(pricePerUnit) - safeNum(variableCostPerUnit);
  if (contribution <= 0) return null;
  return Math.ceil(safeNum(fixedCost) / contribution);
}

/* Break-even as a percent of a project's rated capacity. */
export function breakEvenPct({ fixedCost, pricePerUnit, variableCostPerUnit, capacityUnits }) {
  const units = breakEvenUnits({ fixedCost, pricePerUnit, variableCostPerUnit });
  const cap = safeNum(capacityUnits);
  if (units === null || !cap) return null;
  return round2((units / cap) * 100);
}
