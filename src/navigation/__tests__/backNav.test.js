import { describe, it, expect } from "vitest";
import { backDepth, resolveBack } from "../backNav.js";

describe("backDepth", () => {
  it("is 0 outside the authenticated app", () => {
    expect(backDepth({ stage: "auth", tab: "market", stack: [1, 2] })).toBe(0);
    expect(backDepth({ stage: "splash" })).toBe(0);
    expect(backDepth({})).toBe(0);
  });
  it("counts pushed screens plus a non-home tab", () => {
    expect(backDepth({ stage: "app", tab: "home", stack: [] })).toBe(0);
    expect(backDepth({ stage: "app", tab: "home", stack: [1, 2, 3] })).toBe(3);
    expect(backDepth({ stage: "app", tab: "market", stack: [] })).toBe(1);
    expect(backDepth({ stage: "app", tab: "market", stack: [1, 2] })).toBe(3);
  });
});

describe("resolveBack", () => {
  it("pops when a screen is pushed (regardless of tab)", () => {
    expect(resolveBack({ stack: [1], tab: "home" })).toBe("pop");
    expect(resolveBack({ stack: [1, 2], tab: "market" })).toBe("pop");
  });
  it("returns to Home from a non-home tab with no pushed screen", () => {
    expect(resolveBack({ stack: [], tab: "market" })).toBe("home");
    expect(resolveBack({ stack: [], tab: "profile" })).toBe("home");
  });
  it("exits from the Home root", () => {
    expect(resolveBack({ stack: [], tab: "home" })).toBe("exit");
    expect(resolveBack({})).toBe("exit");
  });
});
