/* Bank-format DPR document model.

   Pure: takes the saved input plus the computed projection and lays them out
   in the section order a bank/NABARD proposal is read in. Rendering (print,
   CSV) lives in dprExport.js so the document itself stays testable without a
   DOM.

   Section shapes:
     { heading, text }                      — narrative
     { heading, rows: [{label, value}] }    — label/value block
     { heading, table: { headers, data, total? } }  — tabular annexure */

import { rupee } from "../../../utils/format.js";
import { DPR_DISCLAIMER } from "./dprConstants.js";
import { unitsText } from "./dprService.js";

const dash = "—";
const val = (v) => (v === null || v === undefined || v === "" ? dash : v);
const pct = (v) => (typeof v === "number" ? `${v}%` : dash);
const ratio = (v) => (typeof v === "number" ? v.toFixed(2) : dash);
const yearsOf = (v) => (typeof v === "number" ? `${v.toFixed(1)} years` : dash);

/* Build the full document. `now` is injected so the output is deterministic
   in tests and identical across a print/CSV pair generated together. */
export function buildDocument(input, computed, now = new Date()) {
  const p = input.promoter || {};
  const proj = input.project || {};
  const bank = input.bank || {};
  const fin = input.finance || {};
  const v = computed.viability;

  const sections = [];

  /* A — the applicant */
  sections.push({
    heading: "A. Promoter profile",
    rows: [
      { label: "Name of applicant", value: val(p.name) },
      { label: "Father's / husband's name", value: val(p.fatherName) },
      { label: "Village / town", value: val(p.village) },
      { label: "District", value: val(p.district) },
      { label: "State", value: val(p.state) },
      { label: "PIN code", value: val(p.pincode) },
      { label: "Mobile", value: val(p.mobile) },
      { label: "Category", value: val(p.category) },
      { label: "Land holding", value: p.landAcres ? `${p.landAcres} acres` : dash },
      { label: "Experience in the activity", value: p.experienceYears ? `${p.experienceYears} years` : dash },
    ],
  });

  /* B — what is being financed */
  sections.push({
    heading: "B. Project details",
    rows: [
      { label: "Project", value: val(proj.title || input.name) },
      { label: "Activity", value: val(input.name) },
      { label: "Location", value: val(proj.location) },
      { label: "Size of unit", value: unitsText(input.units, input.unitLabel) },
      { label: "Projection horizon", value: `${computed.horizon} years` },
      { label: "Financing bank", value: val(bank.name) },
      { label: "Branch", value: val(bank.branch) },
    ],
  });

  if (proj.purpose) {
    sections.push({ heading: "C. Purpose of the proposal", text: proj.purpose });
  }

  /* Cost of project */
  sections.push({
    heading: "D. Cost of project",
    table: {
      headers: ["Sl.", "Particulars", "Rate per unit", "Units", "Amount"],
      data: computed.capitalRows.map((r, i) => [
        i + 1, r.label, rupee(r.perUnit), r.units, rupee(r.amount),
      ]),
      total: ["", "Total cost of project", "", "", rupee(computed.totalCapital)],
    },
  });

  /* Means of finance */
  const m = computed.means;
  sections.push({
    heading: "E. Means of finance",
    table: {
      headers: ["Source", "Share", "Amount"],
      data: [
        ["Promoter's margin / own contribution", pct(m.marginPct), rupee(m.margin)],
        ["Subsidy / back-ended assistance", pct(m.subsidyPct), rupee(m.subsidy)],
        ["Bank term loan", pct(round1(m.totalCapital ? (m.loan / m.totalCapital) * 100 : 0)), rupee(m.loan)],
      ],
      total: ["Total", "100%", rupee(m.totalCapital)],
    },
  });

  /* Loan terms + ladder */
  sections.push({
    heading: "F. Term loan and repayment",
    rows: [
      { label: "Loan amount", value: rupee(m.loan) },
      { label: "Rate of interest", value: pct(Number(fin.ratePct) || 0) },
      { label: "Repayment period", value: `${fin.tenureYears || 0} years` },
      { label: "Moratorium on principal", value: `${fin.moratoriumMonths || 0} months` },
    ],
  });

  if (computed.loanRows.length) {
    sections.push({
      heading: "F.1 Repayment schedule",
      table: {
        headers: ["Year", "Opening balance", "Interest", "Principal repaid", "Total outgo", "Closing balance"],
        data: computed.loanRows.map((r) => [
          r.year, rupee(r.opening), rupee(r.interest), rupee(r.principal), rupee(r.total), rupee(r.closing),
        ]),
      },
    });
  }

  /* Profitability */
  sections.push({
    heading: "G. Projected profitability",
    table: {
      headers: ["Year", "Capacity", "Revenue", "Running cost", "Gross surplus",
                "Depreciation", "Interest", "Net surplus", "DSCR"],
      data: computed.years.map((y) => [
        y.year, `${y.capacityPct}%`, rupee(y.revenue), rupee(y.opex), rupee(y.grossSurplus),
        rupee(y.depreciation), rupee(y.interest), rupee(y.netSurplus), ratio(y.dscr),
      ]),
    },
  });

  /* Viability */
  sections.push({
    heading: "H. Financial viability",
    rows: [
      { label: `Net present value (at ${v.discountRatePct}%)`, value: rupee(v.npv) },
      { label: "Internal rate of return", value: pct(v.irr) },
      { label: `Benefit-cost ratio (at ${v.discountRatePct}%)`, value: ratio(v.bcr) },
      { label: "Average DSCR (repayment years)", value: ratio(v.avgDscr) },
      { label: "Minimum DSCR (repayment years)", value: ratio(v.minDscr) },
      { label: "Payback period", value: yearsOf(v.payback) },
      { label: "Break-even output (against depreciation + interest)", value: v.breakEvenUnits === null ? dash
          : `${v.breakEvenUnits.toLocaleString("en-IN")} ${v.outputUnit} (${ratio(v.breakEvenPct)}% of capacity)` },
    ],
  });

  /* Annexures: the per-unit norms the projection was built on, so an
     appraising officer can see exactly what was assumed. */
  sections.push({
    heading: "I. Annexure I — Revenue assumptions (per year at full capacity)",
    table: {
      headers: ["Particulars", `Per ${input.unitLabel || "unit"}`, "Total"],
      data: (input.revenue || []).map((r) => [
        r.label, rupee(r.perUnit), rupee(Number(r.perUnit || 0) * computed.units),
      ]),
      total: ["Total revenue", "", rupee(computed.revenueFull)],
    },
  });

  sections.push({
    heading: "J. Annexure II — Running cost assumptions (per year at full capacity)",
    table: {
      headers: ["Particulars", `Per ${input.unitLabel || "unit"}`, "Total"],
      data: (input.recurring || []).map((r) => [
        r.label, rupee(r.perUnit), rupee(Number(r.perUnit || 0) * computed.units),
      ]),
      total: ["Total running cost", "", rupee(computed.opexFull)],
    },
  });

  return {
    title: proj.title || input.name || "Detailed Project Report",
    applicant: p.name || "",
    generatedAt: now.toLocaleString("en-IN"),
    verdict: computed.verdict,
    disclaimer: DPR_DISCLAIMER,
    sections,
  };
}

const round1 = (n) => Math.round(n * 10) / 10;
