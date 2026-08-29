/* DPR service — turns a project input into the full bank-format projection,
   and stores drafts so a farmer can come back and refine one over days.

   `project()` is pure: same input, same output, no storage or clock. That
   keeps the whole appraisal testable and lets the wizard re-run it live on
   every keystroke. Persistence is the thin CRUD wrapper at the bottom. */

import { repo } from "../../erp/erpDb.js";
import { safeNum, round2 } from "../../../utils/num.js";
import {
  getModel, DISCOUNT_RATE_PCT, VIABILITY,
} from "./dprConstants.js";
import {
  loanSchedule, straightLineDepreciation, npv, irr, bcr,
  dscr, averageDscr, paybackPeriod, breakEvenUnits, breakEvenPct,
} from "./dprFinance.js";

const projects = repo("dprProjects");

/* Ramp value for a given operating year; the last entry repeats forever. */
const rampAt = (ramp, year) => {
  if (!Array.isArray(ramp) || !ramp.length) return 1;
  const v = ramp[Math.min(year - 1, ramp.length - 1)];
  return Number.isFinite(Number(v)) ? Number(v) : 1;
};

const sumPerUnit = (rows = [], units) =>
  round2(rows.reduce((s, r) => s + safeNum(r.perUnit) * units, 0));

/* A fresh, fully-editable draft seeded from a model template plus whatever the
   app already knows about the farmer — so the wizard opens mostly filled in. */
export function draftFrom(modelId, { farm = null, user = null, tc = null } = {}) {
  const m = getModel(modelId);
  /* Head labels become editable text inside the farmer's draft, so they are
     seeded in the farmer's language once at creation rather than translated on
     every render — otherwise the farmer's own edits would be overwritten. */
  const L = (r) => (tc && r.i18n ? tc(r.i18n) : r.label);
  const clone = (rows) => rows.map((r) => ({ ...r, label: L(r) }));
  return {
    name: L(m),
    modelId: m.id,
    enterprise: m.enterprise,
    units: m.defaultUnits,
    unitLabel: tc && m.unitLabelI18n ? tc(m.unitLabelI18n) : m.unitLabel,
    horizonYears: m.horizonYears,
    promoter: {
      name: user?.name || farm?.ownerName || "",
      fatherName: "",
      village: farm?.village || "",
      district: farm?.district || "",
      state: farm?.state || user?.state || "",
      pincode: "",
      mobile: user?.phone || "",
      category: "",
      landAcres: farm?.sizeAcres || "",
      experienceYears: "",
    },
    project: {
      title: L(m),
      location: [farm?.village, farm?.district, farm?.state].filter(Boolean).join(", "),
      purpose: "",
    },
    bank: { name: "", branch: "" },
    capital:   clone(m.capital),
    recurring: clone(m.recurring),
    revenue:   clone(m.revenue),
    output: { ...m.output },
    revenueRamp: [...m.revenueRamp],
    opexRamp:    [...m.opexRamp],
    finance: { ...m.finance, subsidyPct: 0 },
  };
}

/* "5 milch animals" / "5 দুগ্ধবতী পশু". The English plural -s is only added
   to an English label; a translated unitLabel is left as the language wrote
   it, since Hindi and Bengali do not take an -s here. */
export const unitsText = (units, unitLabel) => {
  const l = unitLabel || "unit";
  /* Printable ASCII means the label is still the English default, which takes
     the plural -s. A translated label is left exactly as the language wrote
     it — neither Hindi nor Bengali pluralises a unit noun this way. */
  const isEnglish = /^[ -~]*$/.test(l);
  return `${units} ${units === 1 || !isEnglish ? l : `${l}s`}`;
};

/* The whole appraisal. Pure function of `input`. */
export function project(input) {
  const units = Math.max(safeNum(input.units), 0);
  const horizon = Math.max(Math.round(safeNum(input.horizonYears)) || 7, 1);
  const fin = input.finance || {};

  /* ---- cost of project ---- */
  const capitalRows = (input.capital || []).map((c) => ({
    ...c,
    units,
    amount: round2(safeNum(c.perUnit) * units),
  }));
  const totalCapital = round2(capitalRows.reduce((s, r) => s + r.amount, 0));

  /* ---- means of finance ---- */
  const marginPct  = safeNum(fin.marginPct);
  const subsidyPct = safeNum(fin.subsidyPct);
  const margin  = round2(totalCapital * marginPct / 100);
  const subsidy = round2(totalCapital * subsidyPct / 100);
  const loan    = round2(Math.max(totalCapital - margin - subsidy, 0));
  const means = { totalCapital, margin, marginPct, subsidy, subsidyPct, loan };

  /* ---- annual figures at full capacity ---- */
  const revenueFull = sumPerUnit(input.revenue, units);
  const opexFull    = sumPerUnit(input.recurring, units);
  const depreciation = straightLineDepreciation(capitalRows);

  /* ---- loan ladder ---- */
  const loanRows = loanSchedule({
    principal: loan,
    ratePct: safeNum(fin.ratePct),
    tenureYears: safeNum(fin.tenureYears),
    moratoriumMonths: safeNum(fin.moratoriumMonths),
  });
  const loanAt = (y) => loanRows.find((r) => r.year === y) || { interest: 0, principal: 0 };

  /* ---- year-wise profitability ---- */
  const years = [];
  for (let y = 1; y <= horizon; y++) {
    const revenue = round2(revenueFull * rampAt(input.revenueRamp, y));
    const opex    = round2(opexFull    * rampAt(input.opexRamp, y));
    const grossSurplus = round2(revenue - opex);
    const { interest, principal } = loanAt(y);
    const netSurplus = round2(grossSurplus - depreciation - interest);
    years.push({
      year: y,
      capacityPct: round2(rampAt(input.revenueRamp, y) * 100),
      revenue, opex, grossSurplus, depreciation, interest,
      principalRepaid: principal,
      netSurplus,
      netCashAccrual: round2(netSurplus + depreciation),
      surplusAfterService: round2(grossSurplus - interest - principal),
      dscr: dscr({ netSurplus, interest, depreciation, principalRepaid: principal }),
    });
  }

  /* ---- discounted measures ----
     Project (not equity) convention: year 0 is the full capital outlay and the
     operating years carry the pre-financing surplus, so IRR/NPV describe the
     project itself rather than the loan structure layered on it. */
  const capitalFlows = [-totalCapital, ...years.map((r) => r.grossSurplus)];
  const benefits = [0, ...years.map((r) => r.revenue)];
  const costs    = [totalCapital, ...years.map((r) => r.opex)];

  const avgInterest = loanRows.length
    ? round2(loanRows.reduce((s, r) => s + r.interest, 0) / loanRows.length)
    : 0;

  /* DSCR is read over the REPAYMENT years only. During a moratorium the bank
     has deliberately asked for no principal — and for a long-gestation crop
     that is also a year with little or no income — so including those years
     would report a ratio no lending officer actually applies, and would make
     every orchard proposal look unserviceable. */
  const repaymentYears = years.filter((r) => r.principalRepaid > 0);
  const capacityUnits = round2(safeNum(input.output?.perUnit) * units);
  const pricePerUnit = safeNum(input.output?.pricePerUnit);
  /* Break-even only means something once the project actually has rated
     capacity and a selling price. Without both, report nothing rather than a
     technically-true "0 units" that would read as an achievable target. */
  const beInput = capacityUnits && pricePerUnit
    ? { fixedCost: depreciation + avgInterest, pricePerUnit,
        variableCostPerUnit: round2(opexFull / capacityUnits), capacityUnits }
    : null;

  const viability = {
    discountRatePct: DISCOUNT_RATE_PCT,
    npv: npv(DISCOUNT_RATE_PCT, capitalFlows),
    irr: irr(capitalFlows),
    bcr: bcr(DISCOUNT_RATE_PCT, benefits, costs),
    avgDscr: averageDscr(repaymentYears),
    minDscr: repaymentYears.reduce((min, r) => (typeof r.dscr === "number" && (min === null || r.dscr < min) ? r.dscr : min), null),
    payback: paybackPeriod(capitalFlows),
    breakEvenUnits: beInput ? breakEvenUnits(beInput) : null,
    breakEvenPct:   beInput ? breakEvenPct(beInput)   : null,
    capacityUnits,
    outputUnit: input.output?.unit || "unit",
  };

  return {
    units, horizon,
    capitalRows, totalCapital, means,
    revenueFull, opexFull, depreciation,
    loanRows, years, viability,
    verdict: verdictFor(viability),
  };
}

/* Plain-language read of the ratios a lending officer checks first.
   Deliberately conservative: anything that cannot be computed counts against
   "strong", because a blank ratio is not a passing one. */
export function verdictFor(v) {
  const checks = [
    { key: "dscr", label: VIABILITY.dscr.label, value: v.avgDscr, ...VIABILITY.dscr },
    { key: "bcr",  label: VIABILITY.bcr.label,  value: v.bcr,     ...VIABILITY.bcr },
    { key: "irr",  label: VIABILITY.irr.label,  value: v.irr,     ...VIABILITY.irr },
  ].map((c) => ({
    key: c.key,
    label: c.label,
    value: c.value,
    status: typeof c.value !== "number" ? "unknown"
      : c.value >= c.good ? "good"
      : c.value >= c.ok   ? "ok"
      : "weak",
  }));

  const weak = checks.filter((c) => c.status === "weak");
  const unknown = checks.filter((c) => c.status === "unknown");
  const level = weak.length ? "weak"
    : unknown.length ? "incomplete"
    : checks.every((c) => c.status === "good") ? "strong"
    : "viable";

  return { level, checks };
}

/* ---------- persistence ---------- */

export const dprService = {
  draftFrom,
  project,
  verdictFor,

  list: () => projects.getAll(),
  get:  (id) => projects.getById(id),
  create: (input) => projects.add(input),
  update: (id, patch) => projects.update(id, patch),
  remove: (id) => projects.remove(id),
};
