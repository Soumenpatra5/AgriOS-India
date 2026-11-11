import { describe, it, expect, vi, beforeEach } from "vitest";

let mockWin = null;
globalThis.window = {
  open: vi.fn(),
};

const { generateReportHtml, printReport } = await import("../printReport.js");

describe("generateReportHtml", () => {
  it("renders report title, subtitle, columns, and rows", () => {
    const html = generateReportHtml({
      title: "Daily Milk Production",
      subtitle: "Dairy Farm Sector 4",
      columns: [
        { header: "Date", key: "date" },
        { header: "Yield (L)", key: "yield", align: "right" },
      ],
      rows: [
        { date: "2026-11-10", yield: "45.5" },
        { date: "2026-11-11", yield: "48.0" },
      ],
      summary: [{ label: "Total Yield", value: "93.5 L" }],
      generatedAt: "11 Nov 2026",
    });

    expect(html).toContain("Daily Milk Production");
    expect(html).toContain("Dairy Farm Sector 4");
    expect(html).toContain("Date");
    expect(html).toContain("Yield (L)");
    expect(html).toContain("2026-11-10");
    expect(html).toContain("45.5");
    expect(html).toContain("Total Yield");
    expect(html).toContain("93.5 L");
    expect(html).toContain("11 Nov 2026");
  });

  it("escapes malicious or special HTML characters", () => {
    const html = generateReportHtml({
      title: "Milk & Honey <script>alert(1)</script>",
      columns: [{ header: "Name & Tag", key: "name" }],
      rows: [{ name: 'Gauri "Best" Cow & Buffalo' }],
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Milk &amp; Honey");
    expect(html).toContain("Gauri &quot;Best&quot; Cow &amp; Buffalo");
  });
});

describe("printReport", () => {
  beforeEach(() => {
    mockWin = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
    };
  });

  it("returns false if popup is blocked (window.open returns null)", () => {
    window.open = vi.fn().mockReturnValue(null);
    const result = printReport({ title: "Test" });
    expect(result).toBe(false);
  });

  it("opens window, writes html, closes document, and calls print()", () => {
    window.open = vi.fn().mockReturnValue(mockWin);

    const result = printReport({
      title: "Test Report",
      columns: [{ header: "Col", key: "c" }],
      rows: [{ c: "123" }],
    });

    expect(result).toBe(true);
    expect(window.open).toHaveBeenCalledWith("", "_blank");
    expect(mockWin.document.open).toHaveBeenCalled();
    expect(mockWin.document.write).toHaveBeenCalled();
    expect(mockWin.document.close).toHaveBeenCalled();
    expect(mockWin.focus).toHaveBeenCalled();
    expect(mockWin.print).toHaveBeenCalled();
  });
});
