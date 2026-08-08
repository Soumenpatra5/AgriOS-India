import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
vi.stubGlobal("localStorage", {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
});
// no VITE_FB_API_KEY in tests → cloudAvailable() is false (base64 path); we
// only test metadata-only adds here, so file upload isn't exercised.

const { documentService, DOC_TYPES } = await import("../documentService.js");

describe("documentService (WF-5)", () => {
  const clear = async () => { for (const d of await documentService.forEmployee("D1")) await documentService.remove(d.id); };
  beforeEach(clear);

  describe("expiryState", () => {
    const ref = "2026-08-10";
    it("returns valid when there is no expiry", () => {
      expect(documentService.expiryState({}, ref)).toBe("valid");
    });
    it("flags expired dates in the past", () => {
      expect(documentService.expiryState({ expiryDate: "2026-08-01" }, ref)).toBe("expired");
    });
    it("flags expiring-soon within 30 days", () => {
      expect(documentService.expiryState({ expiryDate: "2026-08-20" }, ref)).toBe("expiring_soon");
    });
    it("returns valid when far in the future", () => {
      expect(documentService.expiryState({ expiryDate: "2027-01-01" }, ref)).toBe("valid");
    });
  });

  it("adds a metadata-only document with defaults", async () => {
    const d = await documentService.add({ employeeId: "D1", type: "id_proof", number: "1234-5678" });
    expect(d.status).toBe("uploaded");
    expect(d.name).toBe("Identity Proof"); // falls back to type label
    expect(d.number).toBe("1234-5678");
    expect(d.uploadDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.storage).toBeUndefined(); // no file
  });

  it("setStatus verifies and stamps a verified date", async () => {
    const d = await documentService.add({ employeeId: "D1", type: "agreement", name: "Contract" });
    await documentService.setStatus(d.id, "verified");
    const rows = await documentService.forEmployee("D1");
    const v = rows.find((r) => r.id === d.id);
    expect(v.status).toBe("verified");
    expect(v.verifiedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("expirySummary buckets expired vs expiring-soon", async () => {
    await documentService.add({ employeeId: "D1", type: "driving_licence", name: "DL", expiryDate: "2000-01-01" });
    await documentService.add({ employeeId: "D1", type: "medical", name: "Med", expiryDate: "2100-01-01" });
    const s = await documentService.expirySummary();
    expect(s.expired.some((d) => d.name === "DL")).toBe(true);
    expect(s.expiringSoon.some((d) => d.name === "DL")).toBe(false);
    await clear();
  });

  it("exposes all document types", () => {
    expect(DOC_TYPES.length).toBe(12);
    expect(documentService.typeLabel("bank_proof")).toBe("Bank Account Proof");
  });
});
