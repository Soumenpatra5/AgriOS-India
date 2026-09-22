import { driftDetector } from "./driftDetector.js";
import { storage } from "../../../utils/storage.js";

const KEY = "mlops:drift_reports";

export const driftReporter = {
  async generateReport(modelId = null) {
    const result = await driftDetector.detect(modelId);
    const report = {
      id: `dr-${Date.now()}`,
      modelId: modelId || "all",
      ...result,
      recommendations: this._buildRecommendations(result),
      generatedAt: new Date().toISOString(),
    };

    const existing = storage.get(KEY, []);
    storage.set(KEY, [report, ...existing].slice(0, 20));
    return report;
  },

  _buildRecommendations(result) {
    const recs = [];
    if (!result.detected) {
      recs.push("Model behavior is stable. Continue monitoring.");
      return recs;
    }
    if (["HIGH", "CRITICAL"].includes(result.overallSeverity)) {
      recs.push("Immediately investigate data pipeline for distribution shift.");
      recs.push("Consider triggering a retraining pipeline.");
      recs.push("Escalate to ML team — confidence drift is significant.");
    }
    if (result.confidenceDrift?.severity !== "NONE") {
      recs.push("Confidence distribution has shifted — review recent input images for quality issues.");
    }
    if (result.predictionDrift?.severity !== "NONE") {
      recs.push("Prediction success rate has changed — check if field conditions have changed seasonally.");
    }
    recs.push("Add more recent annotated samples from current conditions to the training dataset.");
    return recs;
  },

  getReports(modelId = null) {
    const all = storage.get(KEY, []);
    if (modelId) return all.filter((r) => r.modelId === modelId);
    return all;
  },

  getLatestReport(modelId = null) {
    return this.getReports(modelId)[0] || null;
  },
};
