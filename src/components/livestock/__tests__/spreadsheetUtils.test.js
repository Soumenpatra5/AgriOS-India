import { describe, it, expect } from "vitest";
import {
  buildCSVContent,
  filterHerdRecords,
  calculateHerdSummary,
  calculatePondSummary,
} from "../spreadsheetUtils.js";

describe("spreadsheetUtils", () => {
  it("builds escaped CSV content correctly", () => {
    const headers = ["Tag #", "Name", "Breed"];
    const rows = [
      ["GT-01", "Kali", "Black Bengal"],
      ["GT-02", "Rani, Doe", 'Sirohi "Special"'],
    ];
    const csv = buildCSVContent(headers, rows);
    expect(csv).toContain('"Tag #"');
    expect(csv).toContain('"Rani, Doe"');
    expect(csv).toContain('"Sirohi ""Special"""');
  });

  it("filters herd records by name, breed, or tag number", () => {
    const herd = [
      { name: "Kali", breed: "Black Bengal", tagNo: "TAG-101" },
      { name: "Soni", breed: "Sirohi", tagNo: "TAG-102" },
      { name: "Motu", breed: "Barbari", tagNo: "TAG-103" },
    ];

    expect(filterHerdRecords(herd, "kali")).toHaveLength(1);
    expect(filterHerdRecords(herd, "sirohi")).toHaveLength(1);
    expect(filterHerdRecords(herd, "103")).toHaveLength(1);
    expect(filterHerdRecords(herd, "")).toHaveLength(3);
    expect(filterHerdRecords(herd, "nonexistent")).toHaveLength(0);
  });

  it("calculates herd summary statistics correctly", () => {
    const herd = [
      { name: "A1", gender: "female" },
      { name: "A2", gender: "female" },
      { name: "A3", gender: "male" },
    ];
    const summary = calculateHerdSummary(herd);
    expect(summary.total).toBe(3);
    expect(summary.female).toBe(2);
    expect(summary.male).toBe(1);
  });

  it("calculates aquaculture pond summary correctly", () => {
    const ponds = [
      { name: "North Pond", sizeAcres: 1.5, stockingCount: 5000 },
      { name: "South Pond", sizeAcres: 2.2, stockingCount: 8000 },
    ];
    const summary = calculatePondSummary(ponds);
    expect(summary.count).toBe(2);
    expect(summary.totalAcres).toBe(3.7);
    expect(summary.totalStocked).toBe(13000);
  });
});
