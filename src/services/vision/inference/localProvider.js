/* On-device inference provider — runtime-agnostic.

   The heavy ML runtime (ONNX Runtime Web / TF.js / WASM) is intentionally NOT
   bundled here. To enable real on-device inference, load your runtime + trained
   model wherever you like, then register a `run` closure:

     import { localProvider } from ".../localProvider.js";
     import { CAPABILITIES }  from ".../inferenceInterface.js";

     const session = await ort.InferenceSession.create("/models/crop-disease.onnx");
     localProvider.registerModel("crop-disease-v1", {
       run: async (tensor, dims) => {
         const feeds = { input: new ort.Tensor("float32", tensor, dims) };
         const { output } = await session.run(feeds);
         return output.data;                     // Float32Array of logits
       },
       labels: ["Healthy", "Early Blight", "Late Blight", ...],  // index -> class name
       capabilities: [CAPABILITIES.DISEASE_DETECTION],
       inputSize: 224, layout: "nchw",            // must match how the model was trained
       mean: [0.485,0.456,0.406], std: [0.229,0.224,0.225],
       minConfidence: 0.7,
     });

   Until a model is registered, isAvailable() is false and the hybrid provider
   falls through to cloud — no behavior change and no dependency cost. This
   provider owns image preprocessing and output ranking; the caller supplies only
   the model `run` closure and its labels/normalization.

   NOTE: a bare classifier yields a disease *label*, not a treatment plan, so its
   diagnosis always sets needsExpertReview = true — on-device is fast triage; the
   cloud advisor / a local expert provides treatment. */

import { CAPABILITIES } from "./inferenceInterface.js";
import { preprocessImage, softmax, topK } from "./localInference.js";

const models = new Map();

export const localProvider = {
  id:   "local",
  name: "On-Device Model",

  isAvailable() { return models.size > 0; },

  getCapabilities() {
    const caps = new Set();
    for (const m of models.values()) m.capabilities.forEach((c) => caps.add(c));
    return [...caps];
  },

  /* Register a trained model. `run(tensor, dims) => Float32Array logits` wraps the
     caller's chosen runtime; everything else (preprocess/rank) is handled here. */
  registerModel(id, {
    run,
    labels,
    capabilities = [CAPABILITIES.DISEASE_DETECTION],
    inputSize    = 224,
    mean         = [0.485, 0.456, 0.406],
    std          = [0.229, 0.224, 0.225],
    layout       = "nchw",
    minConfidence = 0.7,
  } = {}) {
    if (typeof run !== "function") throw new Error("registerModel: `run(tensor, dims) => logits` is required");
    if (!Array.isArray(labels) || labels.length === 0) throw new Error("registerModel: non-empty `labels` array is required");
    models.set(id, { run, labels, capabilities, inputSize, mean, std, layout, minConfidence });
    return id;
  },

  unregisterModel(id) { models.delete(id); },

  async infer(imageBase64, metadata = {}, context = {}) {
    const model = selectModel(context.capability);
    if (!model) throw new Error("No on-device model registered — falling back to cloud.");
    const t0 = Date.now();

    const { tensor, dims } = await preprocessImage(imageBase64, model);
    const logits = await model.run(tensor, dims);
    const probs  = softmax(Array.from(logits));
    const ranked = topK(probs, model.labels, 3);
    const top    = ranked[0];
    const lowConf = top.prob < model.minConfidence;

    // Emit the diagnosis schema the orchestrator's parser consumes. A classifier
    // supplies the label; treatment is deferred to expert/cloud (needsExpertReview).
    const diagnosis = {
      domain: context.domainId || "plant",
      primaryDiagnosis: { name: top.label, confidence: confLabel(top.prob), score: top.prob, basis: "On-device model classification." },
      possibleDiseases: ranked.map((r) => ({ name: r.label, probability: r.prob, category: "unknown" })),
      severity: "Mild",
      observations: [],
      recommendations: { immediate: [], organic: [], chemical: [], biological: [], nutrition: [], environmental: [] },
      needsMoreImages:  lowConf,
      needsExpertReview: true,
      knowledgeSource:  "On-device classifier",
      disclaimer: "On-device AI classification only — not a confirmed diagnosis. Confirm treatment with an expert or the cloud advisor.",
    };

    return {
      provider:    "local",
      prediction:  top.label,
      confidence:  top.prob,
      ranked,
      lowConfidence: lowConf,
      raw:         JSON.stringify(diagnosis),
      inferenceMs: Date.now() - t0,
      metadata,
    };
  },
};

function selectModel(capability) {
  if (!models.size) return null;
  if (capability) {
    for (const m of models.values()) if (m.capabilities.includes(capability)) return m;
  }
  return models.values().next().value;
}

function confLabel(p) {
  if (p >= 0.80) return "high";
  if (p >= 0.55) return "medium";
  return "low";
}
