import { describe, it, expect, vi, beforeEach } from "vitest";

let lastBlob = null;
let lastLink = null;

globalThis.Blob = class FakeBlob {
  constructor(parts, opts) { this.parts = parts; this.opts = opts; lastBlob = this; }
};
globalThis.URL.createObjectURL = vi.fn(() => "blob:test");
globalThis.URL.revokeObjectURL = vi.fn();
globalThis.document = {
  createElement: vi.fn(() => {
    lastLink = { href: "", download: "", click: vi.fn() };
    return lastLink;
  }),
};

const { downloadCsv } = await import("../exportCsv.js");

describe("downloadCsv", () => {
  beforeEach(() => { lastBlob = null; lastLink = null; });

  it("returns false for empty rows", () => {
    expect(downloadCsv([], "test.csv")).toBe(false);
  });

  it("generates CSV and triggers download", () => {
    const rows = [
      { Date: "2026-01-15", Type: "Income", Amount: 5000 },
      { Date: "2026-01-16", Type: "Expense", Amount: 1200 },
    ];
    expect(downloadCsv(rows, "ledger.csv")).toBe(true);
    expect(lastLink.click).toHaveBeenCalled();
    expect(lastLink.download).toBe("ledger.csv");
    const csv = lastBlob.parts[0];
    expect(csv).toContain("Date,Type,Amount");
    expect(csv).toContain("2026-01-15,Income,5000");
  });

  it("escapes commas in values", () => {
    const rows = [{ Note: "seeds, fertilizer", Amount: 100 }];
    expect(downloadCsv(rows, "test.csv")).toBe(true);
    const csv = lastBlob.parts[0];
    expect(csv).toContain('"seeds, fertilizer"');
  });
});
