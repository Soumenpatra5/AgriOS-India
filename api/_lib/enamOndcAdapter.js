/* e-NAM & ONDC Commerce Adapter
 * Standardizes agricultural lots for National Agriculture Market (e-NAM) APMC trade
 * and Open Network for Digital Commerce (ONDC) Beckn protocol v1.2.0. */

export function validateEnamLot(data) {
  if (!data || typeof data !== "object") return "Payload must be an object";
  if (!data.commodity || typeof data.commodity !== "string") return "Commodity is required";
  if (!data.mandiCode || typeof data.mandiCode !== "string") return "Mandi code is required";
  const qty = Number(data.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return "Quantity must be greater than zero";
  const price = Number(data.reservePrice);
  if (!Number.isFinite(price) || price <= 0) return "Reserve price must be greater than zero";
  return null;
}

export function formatEnamLot(lot) {
  const quantity = Number(lot.quantity) || 0;
  const reservePrice = Number(lot.reservePrice) || 0;
  const currentBid = Number(lot.currentBid) || reservePrice;

  return {
    enamLotId: lot.lotId || `ENAM-${Date.now().toString(36).toUpperCase()}`,
    apmcMandi: {
      code: lot.mandiCode || "APMC_GENERIC",
      name: lot.mandiName || "Mandi APMC",
      state: lot.state || "West Bengal",
      district: lot.district || "Nadia",
    },
    commodity: {
      code: lot.commodity.toUpperCase().replace(/\s+/g, "_"),
      name: lot.commodity,
      variety: lot.variety || "FAQ",
      grade: lot.assayGrade || "Standard Grade 1",
    },
    metrics: {
      quantity,
      unit: (lot.unit || "QUINTAL").toUpperCase(),
      moisturePercentage: lot.moisturePct !== undefined ? Number(lot.moisturePct) : null,
      fatPercentage: lot.fatPct !== undefined ? Number(lot.fatPct) : null,
      snfPercentage: lot.snfPct !== undefined ? Number(lot.snfPct) : null,
    },
    pricing: {
      currency: "INR",
      reservePricePerUnit: reservePrice,
      currentHighestBid: currentBid,
      totalReserveValue: Number((quantity * reservePrice).toFixed(2)),
      totalCurrentValue: Number((quantity * currentBid).toFixed(2)),
    },
    status: lot.status || "listed", // listed | bidding | awarded | dispatched | settled
    bids: Array.isArray(lot.bids) ? lot.bids : [],
    awardedTo: lot.awardedTo || null,
    gatePassNumber: lot.gatePassNumber || null,
  };
}

export function formatBecknCatalog({ provider, items = [], fulfillments = [] }) {
  const providerId = provider?.id || "agrios-fpo-provider";
  const providerName = provider?.name || "AgriOS Producer Federation";

  return {
    context: {
      domain: "nic2004:0111", // Agriculture & Animal Husbandry
      action: "on_search",
      core_version: "1.2.0",
      bap_id: "ondc.buyer.network",
      bpp_id: "agrios.in",
      bpp_uri: "https://agrios.in/api/commerce/ondc",
      transaction_id: `txn_${Date.now().toString(36)}`,
      message_id: `msg_${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      ttl: "PT30M",
    },
    message: {
      catalog: {
        "bpp/descriptor": {
          name: "AgriOS Farmer Federation Network",
          short_desc: "Direct-from-farm collective bulk agricultural produce",
          symbol: "https://agrios.in/logo.png",
        },
        "bpp/providers": [
          {
            id: providerId,
            descriptor: {
              name: providerName,
              short_desc: provider.tagline || "Verified FPO Collective",
              images: [],
            },
            locations: [
              {
                id: `${providerId}-hub`,
                gps: provider.gps || "23.4013,88.5002",
                address: {
                  locality: provider.district || "Nadia",
                  city: provider.district || "Nadia",
                  state: provider.state || "West Bengal",
                  area_code: provider.pincode || "741101",
                },
              },
            ],
            categories: [
              { id: "cat-dairy", descriptor: { name: "Raw Chilled Milk" } },
              { id: "cat-grains", descriptor: { name: "Cereals & Food Grains" } },
              { id: "cat-oilseeds", descriptor: { name: "Oilseeds & Pulses" } },
            ],
            items: items.map((item, idx) => ({
              id: item.id || `item_${idx + 1}`,
              descriptor: {
                name: item.title || item.commodity,
                short_desc: item.description || `${item.quantity} ${item.unit} ${item.commodity}`,
                code: item.code || `AGRI-${item.commodity?.slice(0, 3)?.toUpperCase()}`,
              },
              category_id: item.category || (item.commodity === "milk" ? "cat-dairy" : "cat-grains"),
              price: {
                currency: "INR",
                value: String(item.price || item.reservePrice || 0),
              },
              quantity: {
                available: { count: Number(item.quantity) || 0 },
                unit: item.unit || "QUINTAL",
              },
              tags: [
                {
                  code: "origin",
                  list: [
                    { code: "fpo_registration", value: provider.regNumber || "PENDING" },
                    { code: "state", value: provider.state || "West Bengal" },
                  ],
                },
                {
                  code: "quality",
                  list: [
                    { code: "grade", value: item.assayGrade || "FAQ" },
                    { code: "moisture", value: String(item.moisturePct || "N/A") },
                  ],
                },
              ],
            })),
            fulfillments: fulfillments.length > 0 ? fulfillments : [
              {
                id: "ful-bulk-transport",
                type: "Delivery",
                tracking: true,
                contact: { phone: provider.phone || "+919830123456" },
              },
            ],
          },
        ],
      },
    },
  };
}
