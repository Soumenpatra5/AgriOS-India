import { describe, it, expect } from "vitest";
import { auditService } from "../services/auditService.js";

describe("auditService", () => {
  it("logs an action and retrieves it", async () => {
    const entry = await auditService.log("create", "article", { title: "test" });
    expect(entry.action).toBe("create");
    expect(entry.entity).toBe("article");

    const all = await auditService.getAll();
    expect(all.some((e) => e.id === entry.id)).toBe(true);
  });
});
