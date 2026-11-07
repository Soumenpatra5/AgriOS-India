import { describe, it, expect, beforeEach } from "vitest";
import { enamOndcService } from "../enamOndcService.js";

describe("enamOndcService", () => {
  beforeEach(async () => {
    await enamOndcService.clearDemoLots();
  });

  it("creates a standardized e-NAM lot with required APMC fields", async () => {
    const lot = await enamOndcService.createEnamLot({
      mandiCode: "WB_BDN_01",
      mandiName: "Burdwan APMC Mandi",
      commodity: "Paddy",
      variety: "Swarna",
      quantity: 100,
      unit: "QUINTAL",
      reservePrice: 2300,
      moisturePct: 12.8,
      assayGrade: "FAQ Grade 1",
      demo: true,
    });

    expect(lot.id).toBeDefined();
    expect(lot.enamLotId).toMatch(/^ENAM-/);
    expect(lot.status).toBe("listed");
    expect(lot.pricing.reservePricePerUnit).toBe(2300);
    expect(lot.pricing.totalReserveValue).toBe(230000);
  });

  it("rejects invalid e-NAM lot creation", async () => {
    await expect(
      enamOndcService.createEnamLot({ commodity: "Paddy", quantity: 0 })
    ).rejects.toThrow("Mandi code is required");
  });

  it("submits incremental bids and updates lot bidding status", async () => {
    const lot = await enamOndcService.createEnamLot({
      mandiCode: "WB_BDN_01",
      commodity: "Mustard",
      quantity: 50,
      unit: "QUINTAL",
      reservePrice: 5400,
      demo: true,
    });

    // Lower bid rejected
    await expect(
      enamOndcService.submitBid(lot.id, {
        buyerName: "Low Trader",
        bidPrice: 5300,
      })
    ).rejects.toThrow("Bid must be strictly higher than current highest bid");

    // Valid higher bid
    const bidded = await enamOndcService.submitBid(lot.id, {
      buyerName: "Adani Wilmar Ltd",
      bidPrice: 5600,
      bidderType: "institutional",
    });

    expect(bidded.status).toBe("bidding");
    expect(bidded.pricing.currentHighestBid).toBe(5600);
    expect(bidded.pricing.totalCurrentValue).toBe(280000);
    expect(bidded.bids).toHaveLength(1);
  });

  it("awards lot and generates an e-NAM Gate Pass Number", async () => {
    const lot = await enamOndcService.createEnamLot({
      mandiCode: "WB_BDN_01",
      commodity: "Wheat",
      quantity: 200,
      reservePrice: 2275,
      demo: true,
    });

    await enamOndcService.submitBid(lot.id, {
      buyerName: "ITC Agri-Business",
      bidPrice: 2350,
    });

    const awarded = await enamOndcService.awardLot(lot.id, {
      buyerName: "ITC Agri-Business",
      finalPrice: 2350,
    });

    expect(awarded.status).toBe("awarded");
    expect(awarded.awardedTo).toBe("ITC Agri-Business");
    expect(awarded.gatePassNumber).toMatch(/^GP-/);
  });

  it("generates ONDC Beckn v1.2.0 export catalog", () => {
    const provider = {
      id: "fpo-nadia-01",
      name: "Nadia Krishi Utthan FPO",
      district: "Nadia",
      state: "West Bengal",
      phone: "+919830123456",
    };

    const lots = [
      {
        id: "lot-1",
        enamLotId: "ENAM-101",
        commodity: { name: "Paddy", variety: "Basmati", grade: "FAQ" },
        metrics: { quantity: 100, unit: "QUINTAL", moisturePercentage: 12.5 },
        pricing: { reservePricePerUnit: 3200, currentHighestBid: 3400 },
      },
    ];

    const catalog = enamOndcService.generateBecknCatalog(provider, lots);
    expect(catalog.context.domain).toBe("nic2004:0111");
    expect(catalog.context.core_version).toBe("1.2.0");
    expect(catalog.message.catalog["bpp/providers"]).toHaveLength(1);
    expect(catalog.message.catalog["bpp/providers"][0].items[0].price.value).toBe("3400");
  });
});
