import { describe, it, expect } from "vitest";
import { generateAgriosUserId, normalizeAgriosUserId } from "../agriosId.js";

describe("generateAgriosUserId", () => {
  it("has the AGRI-XXXXXXXX shape, from the Crockford alphabet only", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateAgriosUserId()).toMatch(/^AGRI-[0-9A-HJKMNP-TV-Z]{8}$/);
    }
  });

  it("never produces the confusable letters I, L, O, U", () => {
    /* The whole point of the alphabet choice — worth pinning explicitly
       rather than trusting the regex above to catch a typo in it. */
    const seen = new Set();
    for (let i = 0; i < 500; i++) seen.add(generateAgriosUserId().slice(5));
    const all = [...seen].join("");
    expect(all).not.toMatch(/[ILOU]/);
  });

  it("is not obviously predictable across calls", () => {
    const a = generateAgriosUserId();
    const b = generateAgriosUserId();
    expect(a).not.toBe(b);
  });
});

describe("normalizeAgriosUserId", () => {
  it("accepts the canonical form unchanged", () => {
    expect(normalizeAgriosUserId("AGRI-8F42K7M9")).toBe("AGRI-8F42K7M9");
  });

  it("upper-cases what a person typed", () => {
    expect(normalizeAgriosUserId("agri-8f42k7m9")).toBe("AGRI-8F42K7M9");
  });

  it("accepts the id typed without the AGRI- prefix", () => {
    expect(normalizeAgriosUserId("8f42k7m9")).toBe("AGRI-8F42K7M9");
  });

  it("strips stray whitespace", () => {
    expect(normalizeAgriosUserId("  AGRI-8F42K7M9  ")).toBe("AGRI-8F42K7M9");
    expect(normalizeAgriosUserId("agri - 8f42 k7m9")).toBe("AGRI-8F42K7M9");
  });

  it("rejects the confusable letters I, L, O, U even if typed", () => {
    expect(normalizeAgriosUserId("AGRI-8I42K7M9")).toBeNull();
    expect(normalizeAgriosUserId("AGRI-8L42K7M9")).toBeNull();
    expect(normalizeAgriosUserId("AGRI-8O42K7M9")).toBeNull();
    expect(normalizeAgriosUserId("AGRI-8U42K7M9")).toBeNull();
  });

  it("rejects the wrong length", () => {
    expect(normalizeAgriosUserId("AGRI-8F42K7M")).toBeNull();
    expect(normalizeAgriosUserId("AGRI-8F42K7M99")).toBeNull();
  });

  it("rejects empty and non-id input", () => {
    expect(normalizeAgriosUserId("")).toBeNull();
    expect(normalizeAgriosUserId(null)).toBeNull();
    expect(normalizeAgriosUserId(undefined)).toBeNull();
    expect(normalizeAgriosUserId("hello world")).toBeNull();
  });

  it("round-trips everything generateAgriosUserId produces", () => {
    for (let i = 0; i < 200; i++) {
      const id = generateAgriosUserId();
      expect(normalizeAgriosUserId(id)).toBe(id);
      expect(normalizeAgriosUserId(id.toLowerCase())).toBe(id);
    }
  });
});
