import { describe, it, expect, beforeEach, vi } from "vitest";

const held = vi.hoisted(() => {
  const stores = {};
  const make = () => {
    let rows = [];
    let seq = 0;
    return {
      add: async (data) => { const r = { id: `c${++seq}`, ...data }; rows.push(r); return r; },
      getAll: async () => rows.slice(),
      getBy: async (f, v) => rows.filter((r) => r[f] === v),
      getById: async (id) => rows.find((r) => r.id === id) || null,
      update: async (id, patch) => { const r = rows.find((x) => x.id === id); if (!r) return null; Object.assign(r, patch); return r; },
      remove: async (id) => { const i = rows.findIndex((x) => x.id === id); if (i < 0) return null; return rows.splice(i, 1)[0]; },
      reset: () => { rows = []; seq = 0; },
    };
  };
  const repo = (name) => (stores[name] ||= make());
  const resetAll = () => Object.values(stores).forEach((s) => s.reset());
  return { repo, resetAll };
});

vi.mock("../../erp/erpDb.js", () => ({ repo: held.repo, uid: () => "uid" }));

const { contactService, CONTACT_TYPES } = await import("../contactService.js");

describe("contactService", () => {
  beforeEach(() => { held.resetAll(); });

  it("splits contacts into customers vs suppliers by type", async () => {
    await contactService.add({ name: "A", type: "customer" });
    await contactService.add({ name: "B", type: "wholesaler" });
    await contactService.add({ name: "C", type: "supplier" });
    await contactService.add({ name: "D", type: "vendor" });
    expect((await contactService.getCustomers()).map((c) => c.name).sort()).toEqual(["A", "B"]);
    expect((await contactService.getSuppliers()).map((c) => c.name).sort()).toEqual(["C", "D"]);
  });

  it("isSupplier recognises supplier/vendor only", () => {
    expect(contactService.isSupplier({ type: "supplier" })).toBe(true);
    expect(contactService.isSupplier({ type: "vendor" })).toBe(true);
    expect(contactService.isSupplier({ type: "customer" })).toBe(false);
    expect(contactService.isSupplier({})).toBe(false);
  });

  it("typeLabel resolves labels and falls back to the raw id", () => {
    expect(contactService.typeLabel("distributor")).toBe("Distributor");
    expect(contactService.typeLabel("mystery")).toBe("mystery");
  });

  it("supports basic CRUD", async () => {
    const c = await contactService.add({ name: "Ravi", type: "buyer" });
    expect((await contactService.getById(c.id)).name).toBe("Ravi");
    const up = await contactService.update(c.id, { phone: "999" });
    expect(up.phone).toBe("999");
    await contactService.remove(c.id);
    expect(await contactService.getById(c.id)).toBeNull();
    expect(await contactService.getAll()).toHaveLength(0);
  });

  it("exposes the contact-type vocabulary", () => {
    expect(CONTACT_TYPES.map((t) => t.id)).toContain("customer");
    expect(CONTACT_TYPES).toHaveLength(7);
  });
});
