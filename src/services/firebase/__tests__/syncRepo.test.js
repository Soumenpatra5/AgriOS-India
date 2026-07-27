import { describe, it, expect } from "vitest";
import { CORE_DBS, firestoreName, FIRESTORE_RENAMES } from "../dbRegistry.js";
import { enqueue, getAll, clear } from "../syncQueue.js";

describe("dbRegistry", () => {
  it("lists 7 core databases", () => {
    expect(CORE_DBS).toHaveLength(7);
  });

  it("resolves store name collisions", () => {
    expect(firestoreName("agrios-marketplace", "orders")).toBe("mpOrders");
    expect(firestoreName("agrios-logistics", "telemetry")).toBe("logTelemetry");
    expect(firestoreName("agrios-erp", "orders")).toBe("orders");
    expect(firestoreName("agrios-erp", "farms")).toBe("farms");
  });

  it("has no duplicate store names across DBs after rename", () => {
    const names = new Set();
    for (const db of CORE_DBS) {
      for (const store of db.stores) {
        const fsName = firestoreName(db.name, store);
        expect(names.has(fsName)).toBe(false);
        names.add(fsName);
      }
    }
  });
});

describe("syncQueue", () => {
  it("enqueue and retrieve pending operations", async () => {
    await clear();
    await enqueue("farms", "add", { id: "f1", name: "Test" });
    await enqueue("products", "update", { id: "p1", price: 100 });
    const all = await getAll();
    expect(all.length).toBe(2);
    expect(all[0].storeName).toBe("farms");
    expect(all[0].op).toBe("add");
    expect(all[1].storeName).toBe("products");
    await clear();
    const empty = await getAll();
    expect(empty.length).toBe(0);
  });
});
