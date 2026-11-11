import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkIsDesktop } from "../useResponsive.js";

describe("checkIsDesktop", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when window is undefined (SSR / Node)", () => {
    expect(checkIsDesktop(768)).toBe(false);
  });

  it("returns true when viewport width >= breakpoint", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockImplementation((query) => ({
        matches: query.includes("768px"),
        media: query,
      })),
    });

    expect(checkIsDesktop(768)).toBe(true);
  });

  it("returns false when viewport width < breakpoint", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockImplementation(() => ({
        matches: false,
      })),
    });

    expect(checkIsDesktop(1024)).toBe(false);
  });
});
