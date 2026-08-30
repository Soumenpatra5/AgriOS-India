/* AI-commerce tool — lets the Commerce Advisor agent call the Phase 7D engines
   (recommendations, buyer match, demand outlook, fraud check).
   Returns compact JSON with the explainable reasons so the model can narrate the
   "why". This is the bridge from the provider-agnostic AI gateway to the local
   decision engines — no engine logic is duplicated here. */

import { recommendationEngine } from "../../services/aiCommerce/recommendationEngine.js";
import { buyerMatching } from "../../services/aiCommerce/buyerMatching.js";
import { demandForecast } from "../../services/aiCommerce/demandForecast.js";
import { fraudDetection } from "../../services/aiCommerce/fraudDetection.js";

export const aiCommerceTool = {
  name: "aiCommerce",
  description:
    "Compute commerce decisions from the platform's own data. Use for: product " +
    "recommendations (action='recommend'), finding buyers for a commodity (action='buyers', pass " +
    "`crop`), demand outlook by category (action='demand'), or checking risky listings " +
    "(action='fraud'). Results include a confidence score and the reasons behind them — always " +
    "relay the reasons and note these are data-reasoned estimates, not live quotes.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["recommend", "buyers", "demand", "fraud"],
        description: "Which commerce computation to run.",
      },
      crop: { type: "string", description: "Crop/commodity name (for buyers)." },
    },
    required: ["action"],
  },

  async run({ action, crop }) {
    try {
      switch (action) {
        case "recommend": {
          const r = await recommendationEngine.personalized({ limit: 5 });
          return JSON.stringify({
            basis: r.basis, confidence: r.confidence,
            items: r.items.map((x) => ({ name: x.product.name, price: x.product.price, score: x.score, why: x.reasons.slice(0, 2) })),
          });
        }
        case "buyers": {
          const b = await buyerMatching.rank({ commodity: crop || null, limit: 5 });
          return JSON.stringify({
            confidence: b.confidence,
            buyers: b.items.map((x) => ({ name: x.buyer.name, score: x.score, tags: x.tags, value: x.buyer.totalValue, why: x.reasons.slice(0, 2) })),
          });
        }
        case "demand": {
          const d = await demandForecast.ranking();
          return JSON.stringify({ topDemand: d.slice(0, 5).map((x) => ({ category: x.label, level: x.level, index: x.demandIndex, festival: x.festival })) });
        }
        case "fraud": {
          const flags = await fraudDetection.scan();
          return JSON.stringify({ flagged: flags.length, items: flags.slice(0, 5).map((f) => ({ name: f.name, severity: f.severity, why: f.reasons.map((r) => r.label) })) });
        }
        default:
          return JSON.stringify({ error: `unknown action: ${action}` });
      }
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  },
};
