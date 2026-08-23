import { describe, it, expect, vi } from "vitest";

vi.mock("../../../erp/erpDb.js", () => ({ repo: () => ({}), uid: () => "uid" }));

const { buildDocument } = await import("../dprDocument.js");
const { toHtml, toCsv } = await import("../dprExport.js");
const { project, draftFrom } = await import("../dprService.js");

const FIXED = new Date("2026-08-22T10:30:00Z");

function sample(overrides = {}) {
  const input = {
    ...draftFrom("dairy"),
    units: 5,
    promoter: { name: "Sita Devi", fatherName: "Ram Prasad", village: "Rampur", district: "Nadia",
      state: "West Bengal", pincode: "741101", mobile: "9800000000", category: "SC",
      landAcres: 3, experienceYears: 6 },
    bank: { name: "State Bank of India", branch: "Krishnanagar" },
    ...overrides,
  };
  return { input, computed: project(input) };
}

const findSection = (doc, prefix) => doc.sections.find((s) => s.heading.startsWith(prefix));

describe("buildDocument", () => {
  it("lays the report out in bank-proposal order", () => {
    const { input, computed } = sample();
    const doc = buildDocument(input, computed, FIXED);
    expect(doc.sections.map((s) => s.heading[0])).toEqual(["A", "B", "D", "E", "F", "F", "G", "H", "I", "J"]);
  });

  it("carries the promoter's details into section A", () => {
    const { input, computed } = sample();
    const rows = findSection(buildDocument(input, computed, FIXED), "A.").rows;
    expect(rows.find((r) => r.label === "Name of applicant").value).toBe("Sita Devi");
    expect(rows.find((r) => r.label === "Land holding").value).toBe("3 acres");
  });

  it("shows an em dash rather than a blank for details not supplied", () => {
    const { input, computed } = sample({ promoter: { name: "Sita Devi" } });
    const rows = findSection(buildDocument(input, computed, FIXED), "A.").rows;
    expect(rows.find((r) => r.label === "District").value).toBe("—");
    expect(rows.find((r) => r.label === "Land holding").value).toBe("—");
  });

  it("totals the cost-of-project table", () => {
    const { input, computed } = sample();
    const t = findSection(buildDocument(input, computed, FIXED), "D.").table;
    expect(t.data).toHaveLength(3);            // animals, shed, equipment
    expect(t.total[1]).toBe("Total cost of project");
    expect(t.total[4]).toBe("₹5,05,000");      // 5 × (70000 + 25000 + 6000)
  });

  it("splits means of finance so the three sources add back to the project cost", () => {
    const { input, computed } = sample();
    const t = findSection(buildDocument(input, computed, FIXED), "E.").table;
    expect(t.data.map((r) => r[0])).toEqual([
      "Promoter's margin / own contribution", "Subsidy / back-ended assistance", "Bank term loan",
    ]);
    expect(t.total).toEqual(["Total", "100%", "₹5,05,000"]);
  });

  it("prints one repayment row per loan year", () => {
    const { input, computed } = sample();
    const t = findSection(buildDocument(input, computed, FIXED), "F.1").table;
    expect(t.data).toHaveLength(7);            // 7-year dairy tenure
    expect(t.data[6][5]).toBe("₹0");           // fully repaid by the last year
  });

  it("reports a ratio it could not compute as an em dash, not as zero", () => {
    const { input, computed } = sample();
    computed.viability.irr = null;
    computed.viability.breakEvenUnits = null;
    const rows = findSection(buildDocument(input, computed, FIXED), "H.").rows;
    expect(rows.find((r) => r.label === "Internal rate of return").value).toBe("—");
    expect(rows.find((r) => r.label.startsWith("Break-even output")).value).toBe("—");
  });

  it("includes the purpose section only when a purpose was written", () => {
    const { input, computed } = sample();
    expect(findSection(buildDocument(input, computed, FIXED), "C.")).toBeUndefined();

    const withPurpose = sample({ project: { title: "Dairy unit", location: "Rampur", purpose: "Expand to 5 cows." } });
    expect(findSection(buildDocument(withPurpose.input, withPurpose.computed, FIXED), "C.").text)
      .toBe("Expand to 5 cows.");
  });

  it("always carries the disclaimer and a generation timestamp", () => {
    const { input, computed } = sample();
    const doc = buildDocument(input, computed, FIXED);
    expect(doc.disclaimer).toMatch(/not a bank appraisal or a sanction/);
    expect(doc.generatedAt).toBeTruthy();
    expect(doc.verdict.level).toBeTruthy();
  });
});

describe("toHtml", () => {
  it("escapes free text the farmer typed", () => {
    const { input, computed } = sample({
      promoter: { name: 'Sita <script>alert("x")</script>', village: "Ram & Sons" },
      project: { title: "Dairy", location: "", purpose: "Cows > goats & sheep" },
    });
    const html = toHtml(buildDocument(input, computed, FIXED));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Ram &amp; Sons");
    expect(html).toContain("Cows &gt; goats &amp; sheep");
  });

  it("renders every section heading and a signature block", () => {
    const { input, computed } = sample();
    const html = toHtml(buildDocument(input, computed, FIXED));
    expect(html).toContain("A. Promoter profile");
    expect(html).toContain("H. Financial viability");
    expect(html).toContain("Signature of applicant");
    expect(html).toContain("Disclaimer.");
  });
});

describe("toCsv", () => {
  it("emits every section with its heading, rows and totals", () => {
    const { input, computed } = sample();
    const csv = toCsv(input, computed, FIXED);
    expect(csv).toContain('"A. Promoter profile"');
    expect(csv).toContain('"Name of applicant","Sita Devi"');
    expect(csv).toContain('"Total cost of project"');
    expect(csv).toContain('"Disclaimer"');
  });

  it("doubles embedded quotes so the CSV stays well-formed", () => {
    const { input, computed } = sample({ promoter: { name: 'Sita "Didi" Devi' } });
    expect(toCsv(input, computed, FIXED)).toContain('"Sita ""Didi"" Devi"');
  });
});
