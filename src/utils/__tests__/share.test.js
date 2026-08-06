import { describe, it, expect, beforeEach, vi } from "vitest";

const nav = {};
vi.stubGlobal("navigator", nav);

const { shareText } = await import("../share.js");

describe("shareText", () => {
  beforeEach(() => { delete nav.share; delete nav.clipboard; });

  it("returns 'shared' when the Web Share API succeeds", async () => {
    nav.share = vi.fn().mockResolvedValue(undefined);
    const r = await shareText("hello", "Title");
    expect(r).toBe("shared");
    expect(nav.share).toHaveBeenCalledWith({ title: "Title", text: "hello" });
  });

  it("returns 'cancelled' when the user aborts the share sheet", async () => {
    nav.share = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "AbortError" }));
    expect(await shareText("hello")).toBe("cancelled");
  });

  it("falls back to clipboard when share throws a non-abort error", async () => {
    nav.share = vi.fn().mockRejectedValue(new Error("not allowed"));
    nav.clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    const r = await shareText("hello");
    expect(r).toBe("copied");
    expect(nav.clipboard.writeText).toHaveBeenCalledWith("hello");
  });

  it("copies to clipboard when Web Share is unavailable", async () => {
    nav.clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    expect(await shareText("hello")).toBe("copied");
  });

  it("defaults the title to 'AgriOS'", async () => {
    nav.share = vi.fn().mockResolvedValue(undefined);
    await shareText("body");
    expect(nav.share).toHaveBeenCalledWith({ title: "AgriOS", text: "body" });
  });

  it("returns 'failed' when both share and clipboard are unavailable", async () => {
    expect(await shareText("hello")).toBe("failed");
  });

  it("returns 'failed' when clipboard write rejects", async () => {
    nav.clipboard = { writeText: vi.fn().mockRejectedValue(new Error("denied")) };
    expect(await shareText("hello")).toBe("failed");
  });
});
