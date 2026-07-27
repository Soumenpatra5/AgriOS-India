import { describe, it, expect, beforeEach } from "vitest";
import { adminAuth } from "../adminAuth.js";

describe("adminAuth", () => {
  beforeEach(() => { adminAuth.logout(); });

  it("rejects wrong PIN", () => {
    expect(adminAuth.login("wrong")).toBe(false);
    expect(adminAuth.isLoggedIn()).toBe(false);
  });

  it("accepts correct PIN", () => {
    expect(adminAuth.login("admin123")).toBe(true);
    expect(adminAuth.isLoggedIn()).toBe(true);
  });

  it("logout clears session", () => {
    adminAuth.login("admin123");
    adminAuth.logout();
    expect(adminAuth.isLoggedIn()).toBe(false);
  });
});
