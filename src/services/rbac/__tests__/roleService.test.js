import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { roleService } from "../roleService.js";
import { storage } from "../../../utils/storage.js";

// The vitest node env has no localStorage (only fake-indexeddb); the storage
// wrapper is prefs-only and no-ops without it. Provide an in-memory shim so this
// suite exercises real round-trip persistence.
beforeAll(() => {
  if (!globalThis.localStorage) {
    const m = new Map();
    globalThis.localStorage = {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => { m.set(k, String(v)); },
      removeItem: (k) => { m.delete(k); },
      clear: () => m.clear(),
    };
  }
});

describe("roleService", () => {
  beforeEach(() => { storage.remove("rbac:role"); storage.remove("rbac:pinHash"); });

  it("defaults to owner and persists a valid role", () => {
    expect(roleService.getRole()).toBe("owner");
    expect(roleService.setRole("worker")).toBe("worker");
    expect(roleService.getRole()).toBe("worker");
  });

  it("ignores an invalid role", () => {
    roleService.setRole("worker");
    roleService.setRole("bogus");
    expect(roleService.getRole()).toBe("worker");
  });

  it("sets/verifies/clears a PIN, stored hashed (not in the clear)", async () => {
    expect(roleService.hasPin()).toBe(false);
    await roleService.setPin("1234");
    expect(roleService.hasPin()).toBe(true);
    expect(storage.get("rbac:pinHash")).not.toBe("1234"); // hashed
    expect(await roleService.verifyPin("1234")).toBe(true);
    expect(await roleService.verifyPin("0000")).toBe(false);
    roleService.clearPin();
    expect(roleService.hasPin()).toBe(false);
  });

  it("asks for the PIN only when elevating with a PIN set", async () => {
    roleService.setRole("worker");
    expect(roleService.switchNeedsPin("owner")).toBe(false); // no PIN yet
    await roleService.setPin("1234");
    expect(roleService.switchNeedsPin("owner")).toBe(true);  // elevate → PIN
    roleService.setRole("owner");
    expect(roleService.switchNeedsPin("worker")).toBe(false); // drop → free
  });
});
