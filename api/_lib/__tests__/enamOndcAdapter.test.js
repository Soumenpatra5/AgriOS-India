import { describe, it, expect } from "vitest";
import { validateEnamLot, formatEnamLot, formatBecknCatalog } from "../enamOndcAdapter.js";

describe("enamOndcAdapter", () => {
  describe("validateEnamLot", () => {
    it("returns null on valid input", () => {
      const err = validateEnamLot({
        commodity: "Paddy",
        mandiCode: "APMC_01",
        quantity: 10,
        reservePrice: 2000,
      });
      expect(err).toBeNull();
    });

    it("detects missing or invalid fields", () => {
      expect(validateEnamLot(null)).toBe("Payload must be an object");
      expect(validateEnamLot({})).toBe("Commodity is required");
      expect(validateEnamLot({ commodity: "Wheat" })).toBe("Mandi code is required");
      expect(validateEnamLot({ commodity: "Wheat", mandiCode: "M1", quantity: 0 })).toBe("Quantity must be greater than zero");
      expect(validateEnamLot({ commodity: "Wheat", mandiCode: "M1", quantity: 10, reservePrice: -5 })).toBe("Reserve price must be greater than zero");
    });
  });

  describe("formatEnamLot", () => {
    it("formats APMC Mandi lot and computes total reserve values", () => {
      const formatted = formatEnamLot({
        commodity: "Raw Milk",
        mandiCode: "WB_COOP_01",
        quantity: 500,
        unit: "LITRE",
        reservePrice: 42,
        fatPct: 4.5,
        snfPct: 8.8,
      });

      expect(formatted.enamLotId).toMatch(/^ENAM-/);
      expect(formatted.commodity.code).toBe("RAW_MILK");
      expect(formatted.metrics.quantity).toBe(500);
      expect(formatted.metrics.unit).toBe("LITRE");
      expect(formatted.pricing.totalReserveValue).toBe(21000);
      expect(formatted.status).toBe("listed");
    });
  });

  describe("formatBecknCatalog", () => {
    it("builds compliant Beckn v1.2.0 protocol JSON structure", () => {
      const catalog = formatBecknCatalog({
        provider: {
          id: "prov-1",
          name: "Bengal Agri Collective",
          district: "Hooghly",
          state: "West Bengal",
        },
        items: [
          {
            id: "it-1",
            commodity: "milk",
            quantity: 1000,
            unit: "L",
            price: 45,
          },
          {
            id: "it-2",
            commodity: "mustard",
            quantity: 50,
            unit: "QUINTAL",
            price: 5500,
          },
        ],
      });

      expect(catalog.context.core_version).toBe("1.2.0");
      expect(catalog.context.action).toBe("on_search");
      expect(catalog.message.catalog["bpp/providers"][0].items).toHaveLength(2);
      expect(catalog.message.catalog["bpp/providers"][0].items[0].category_id).toBe("cat-dairy");
      expect(catalog.message.catalog["bpp/providers"][0].items[1].category_id).toBe("cat-grains");
    });
  });
});
