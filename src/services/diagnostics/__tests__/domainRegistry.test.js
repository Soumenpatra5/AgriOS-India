import { describe, it, expect } from "vitest";
import { domainRegistry } from "../domainRegistry.js";

describe("domainRegistry", () => {
  it("registers the seven built-in domains, each with an id + name", () => {
    const all = domainRegistry.getAll();
    expect(all.length).toBeGreaterThanOrEqual(7);
    expect(all.every((d) => d.id && d.name)).toBe(true);
  });

  it("get / has resolve a known domain and reject an unknown one", () => {
    const first = domainRegistry.getAll()[0];
    expect(domainRegistry.get(first.id)).toBe(first);
    expect(domainRegistry.has(first.id)).toBe(true);
    expect(domainRegistry.get("no-such-domain")).toBeNull();
    expect(domainRegistry.has("no-such-domain")).toBe(false);
  });

  it("register adds a valid domain", () => {
    const before = domainRegistry.getAll().length;
    domainRegistry.register({ id: "test-domain-xyz", name: "Test", symptoms: [], systemFragment: "…" });
    expect(domainRegistry.has("test-domain-xyz")).toBe(true);
    expect(domainRegistry.getAll().length).toBe(before + 1);
  });

  it("register rejects a domain missing required fields", () => {
    expect(() => domainRegistry.register({ id: "incomplete" })).toThrow(/required fields/);
  });
});
