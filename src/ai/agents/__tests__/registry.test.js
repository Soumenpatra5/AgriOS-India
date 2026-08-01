import { describe, it, expect } from "vitest";
import { listAgents, getAgent, DEFAULT_AGENT_ID } from "../registry.js";

describe("agent registry", () => {
  it("lists all registered agents", () => {
    const agents = listAgents();
    expect(agents.length).toBeGreaterThanOrEqual(14);
    const ids = agents.map((a) => a.id);
    expect(ids).toContain("generalAssistant");
    expect(ids).toContain("dprGenerator");
    expect(ids).toContain("farmDoctor");
  });

  it("getAgent returns the correct agent by id", () => {
    const dpr = getAgent("dprGenerator");
    expect(dpr.id).toBe("dprGenerator");
  });

  it("getAgent falls back to generalAssistant for unknown id", () => {
    const fallback = getAgent("nonexistent");
    expect(fallback.id).toBe("generalAssistant");
  });

  it("DEFAULT_AGENT_ID is generalAssistant", () => {
    expect(DEFAULT_AGENT_ID).toBe("generalAssistant");
  });
});
