import { describe, it, expect, beforeEach } from "vitest";
import {
  addDeadLetter,
  listDeadLetters,
  removeDeadLetter,
  clearDeadLetters,
  deadLetterCount,
} from "../offlineDeadLetterStore.js";

describe("offlineDeadLetterStore", () => {
  beforeEach(async () => {
    await clearDeadLetters();
  });

  it("stores a dead-letter item and retrieves it", async () => {
    const entry = { action: "dairy.upsertMilk", spaceId: "sp-1", payload: { volume: 10 } };
    const saved = await addDeadLetter(entry, "server_rejected", { status: 409, message: "Conflict" });

    expect(saved.id).toBeDefined();
    expect(saved.reason).toBe("server_rejected");
    expect(saved.errorStatus).toBe(409);
    expect(saved.errorMessage).toBe("Conflict");

    const list = await listDeadLetters();
    expect(list).toHaveLength(1);
    expect(list[0].entry.action).toBe("dairy.upsertMilk");
    expect(await deadLetterCount()).toBe(1);
  });

  it("removes a single dead-letter item", async () => {
    const item1 = await addDeadLetter({ action: "a1" }, "max_retries_exceeded");
    const item2 = await addDeadLetter({ action: "a2" }, "server_rejected");

    expect(await deadLetterCount()).toBe(2);

    await removeDeadLetter(item1.id);
    const list = await listDeadLetters();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(item2.id);
  });

  it("clears all dead letters", async () => {
    await addDeadLetter({ action: "a1" }, "r1");
    await addDeadLetter({ action: "a2" }, "r2");
    expect(await deadLetterCount()).toBe(2);

    await clearDeadLetters();
    expect(await deadLetterCount()).toBe(0);
  });
});
