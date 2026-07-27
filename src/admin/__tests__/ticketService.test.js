import { describe, it, expect } from "vitest";
import { ticketService } from "../services/ticketService.js";

describe("ticketService", () => {
  it("creates and resolves a ticket", async () => {
    const ticket = await ticketService.create({ subject: "Test issue", priority: "high" });
    expect(ticket.status).toBe("open");
    expect(ticket.priority).toBe("high");

    const resolved = await ticketService.resolve(ticket.id);
    expect(resolved.status).toBe("resolved");
  });
});
