import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { adminAuth } from "../adminAuth.js";

/* The gate's contract changed deliberately: there is no built-in PIN any
   more. Unconfigured (VITE_ADMIN_PIN unset — production today) the panel
   refuses every PIN, INCLUDING the old hardcoded "admin123" this replaced;
   configured, it accepts exactly the configured value. */
describe("adminAuth", () => {
  beforeEach(() => { adminAuth.logout(); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("refuses every PIN when none is configured — including the old default", () => {
    expect(adminAuth.login("admin123")).toBe(false);
    expect(adminAuth.login("")).toBe(false);
    expect(adminAuth.login(undefined)).toBe(false);
    expect(adminAuth.isLoggedIn()).toBe(false);
  });

  it("accepts the configured PIN", () => {
    vi.stubEnv("VITE_ADMIN_PIN", "s3cret-pin");
    expect(adminAuth.login("s3cret-pin")).toBe(true);
    expect(adminAuth.isLoggedIn()).toBe(true);
  });

  it("rejects a wrong PIN when one is configured", () => {
    vi.stubEnv("VITE_ADMIN_PIN", "s3cret-pin");
    expect(adminAuth.login("admin123")).toBe(false);
    expect(adminAuth.isLoggedIn()).toBe(false);
  });

  it("logout clears session", () => {
    vi.stubEnv("VITE_ADMIN_PIN", "s3cret-pin");
    adminAuth.login("s3cret-pin");
    adminAuth.logout();
    expect(adminAuth.isLoggedIn()).toBe(false);
  });
});
