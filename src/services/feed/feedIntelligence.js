/* Feed Intelligence — the seam for future AI features (demand forecasting,
   optimal feed recommendation, price prediction, purchase optimization,
   waste prediction, FCR prediction, efficiency/profit optimization).

   Dormant-until-configured: every method returns { unavailable: true } today rather than
   a fabricated prediction. When a real model/service backs this, swap the
   method bodies for real calls — the shape should stay
   predicted/range/confidence/reasons/disclaimer, the app's convention for AI
   estimates. Nothing here invents agricultural data. */

const unavailable = (message) => ({ unavailable: true, message });

export const feedIntelligence = {
  async demandForecast() {
    return unavailable("Feed demand forecasting isn't available yet.");
  },
  async optimalFeedRecommendation() {
    return unavailable("Feed recommendations aren't available yet.");
  },
  async pricePrediction() {
    return unavailable("Feed price prediction isn't available yet.");
  },
  async purchaseOptimization() {
    return unavailable("Purchase optimization isn't available yet.");
  },
  async wastePrediction() {
    return unavailable("Waste prediction isn't available yet.");
  },
  async fcrPrediction() {
    return unavailable("FCR prediction isn't available yet.");
  },
  async efficiencyOptimization() {
    return unavailable("Efficiency optimization isn't available yet.");
  },
  async profitOptimization() {
    return unavailable("Profit optimization isn't available yet.");
  },
};
