/* Diagnostic orchestrator — the 11-step AI pipeline.
   Coordinates: image processing → context assembly → AI inference → parsing → history save.
   Never hardcodes disease logic. All knowledge comes from domain fragments and the LLM. */

import { imageValidator }      from "../vision/imageValidator.js";
import { imageProcessor }      from "../vision/imageProcessor.js";
import { metadataExtractor }   from "../vision/metadataExtractor.js";
import { domainRegistry }      from "./domainRegistry.js";
import { contextBuilder }      from "./contextBuilder.js";
import { diagnosisParser }     from "./diagnosisParser.js";
import { escalationEngine }    from "./escalationEngine.js";
import { recommendationEngine } from "./recommendationEngine.js";
import { historyService }      from "./historyService.js";
import { reportService }       from "./reportService.js";
import { hybridProvider }      from "../vision/inference/hybridProvider.js";
import { offlineQueue }        from "../vision/offlineQueue.js";
import { llmClient }           from "../../ai/services/llmClient.js";
import { MODELS }              from "../../ai/config.js";

const JSON_SCHEMA_INSTRUCTION = `
You MUST respond with ONLY a valid JSON object. No explanatory text before or after. No markdown fences.

Required schema:
{
  "domain": "<domain id>",
  "possibleDiseases": [
    { "name": "<disease name>", "probability": 0.85, "category": "fungal|bacterial|viral|pest|nutrient|stress|parasitic|environmental|other", "notes": "<brief>" }
  ],
  "primaryDiagnosis": {
    "name": "<most likely disease or 'Healthy' or 'Unable to Detect'>",
    "confidence": "high|medium|low",
    "score": 0.85,
    "basis": "<brief explanation of what visual evidence supports this>"
  },
  "severity": "Healthy|VeryMild|Mild|Moderate|Severe|Critical",
  "observations": ["<what you see in the image or symptoms>"],
  "differentialDiagnosis": ["<alternative disease 1>", "<alternative disease 2>"],
  "riskFactors": ["<contributing factor>"],
  "recommendations": {
    "immediate": [{ "action": "<what to do now>", "source": "<ICAR/KVIC/etc>", "duration": "<timeframe>" }],
    "organic": [{ "action": "<organic treatment>", "source": "<reference>", "cost": "<approximate ₹>" }],
    "chemical": [{ "action": "<chemical treatment with dosage>", "source": "<reference>", "cost": "<approximate ₹>" }],
    "biological": [{ "action": "<biocontrol>", "source": "<reference>" }],
    "nutrition": [{ "action": "<nutrition advice>", "source": "<reference>" }],
    "environmental": [{ "action": "<environmental management>", "source": "<reference>" }]
  },
  "risk": {
    "spread": "low|medium|high",
    "economicImpact": "low|medium|high|critical",
    "mortalityRisk": "low|medium|high",
    "yieldLoss": "low|medium|high",
    "urgency": "routine|urgent|emergency"
  },
  "followUp": {
    "days": 7,
    "checkPoints": ["<what to check on follow-up visit>"]
  },
  "recoveryTimeline": "<expected timeline if treatment started>",
  "needsMoreImages": false,
  "needsExpertReview": false,
  "knowledgeSource": "<ICAR guideline / state advisory / expert guideline referenced>",
  "governmentAdvisory": "<relevant government scheme or advisory if applicable>",
  "disclaimer": "AI-based prediction only. Not a confirmed diagnosis. Consult a qualified expert before taking action."
}

RULES:
- If image quality is insufficient: set primaryDiagnosis.name = "Unable to Detect", needsMoreImages = true.
- If disease is critical/notifiable: set risk.urgency = "emergency", needsExpertReview = true.
- NEVER fabricate disease names or invent treatments not supported by your knowledge.
- NEVER present this as a confirmed diagnosis — always use "possible", "likely", "suspected".
- All monetary values in Indian Rupees (₹).
- All area in acres/bigha/hectare as appropriate.
- Use Indian product names and brands where possible.`;

const AI_SAFETY_SYSTEM = `
IMPORTANT AI SAFETY GUIDELINES:
1. You are providing AI-assisted diagnostic support — NOT a confirmed medical or veterinary diagnosis.
2. Always include appropriate uncertainty in your response.
3. For notifiable diseases (FMD, ASF, CSF, PPR, LSD, Avian Influenza, AFB): set urgency = "emergency" and needsExpertReview = true.
4. Never recommend prescription veterinary drugs by name without recommending expert consultation.
5. For pesticide recommendations, always mention safety equipment (PPE) and pre-harvest interval.
6. Maintain human-in-the-loop: every diagnosis must recommend expert validation for Severe or Critical cases.`;

export const orchestrator = {
  async analyze({ domainId, imageFile, symptoms = {}, species = "", additionalNotes = "", lang = "en", signal = null, _imageBase64 = null, _metadata = null }) {
    ensureFlushRegistered();

    // Step 1 — Validate domain
    const domain = domainRegistry.get(domainId);
    if (!domain) throw new Error(`Unknown domain: ${domainId}`);

    // Step 2 — Image processing (optional — text-only diagnosis if no image).
    // On an offline-flush re-entry the base64 is already processed — reuse it.
    let imageBase64 = _imageBase64;
    let metadata    = _metadata || {};
    if (!imageBase64 && imageFile) {
      const validation = await imageValidator.validate(imageFile);
      if (!validation.valid) {
        return buildError(domainId, "Image validation failed: " + validation.error);
      }
      const processed = await imageProcessor.process(imageFile);
      imageBase64     = processed.base64;
      metadata        = await metadataExtractor.extract(imageFile).catch(() => ({}));
    }

    // Step 2b — Offline with an image: queue the diagnosis and return. The flush
    // handler re-runs analyze on reconnect; the result lands in Diagnostic History.
    if (imageBase64 && !_imageBase64 && typeof navigator !== "undefined" && navigator.onLine === false) {
      await offlineQueue.enqueue({
        kind:   "diagnosis",
        params: { domainId, symptoms, species, additionalNotes, lang },
        imageBase64,
        metadata,
      });
      return buildQueued(domainId);
    }

    // Steps 3–7 — Assemble context (weather, farm profile, GPS, history)
    const contextBlock = await contextBuilder.build({ domainId, metadata, species });

    // Build symptom summary from checklist answers
    const symptomSummary = domain.buildContext(symptoms, species);

    // Step 8 — Compose AI call
    const systemPrompt = [
      domain.systemFragment,
      AI_SAFETY_SYSTEM,
      `\nFARMER CONTEXT:\n${contextBlock}`,
      `\n${JSON_SCHEMA_INSTRUCTION}`,
    ].join("\n\n");

    const userText = buildUserMessage({ domain, domainId, symptomSummary, additionalNotes, lang, hasImage: !!imageBase64 });

    // Inference — image diagnoses go through the provider abstraction
    // (on-device model first, cloud fallback); text-only uses the shared
    // llmClient directly. Both ultimately share one cloud transport.
    let rawText;
    try {
      if (imageBase64) {
        const inf = await hybridProvider.infer(imageBase64, metadata, {
          system: systemPrompt, userPrompt: userText, model: MODELS.answer, maxTokens: 2048, signal,
        });
        rawText = inf.raw;
      } else {
        rawText = await llmClient.complete(
          { model: MODELS.answer, maxTokens: 2048, system: systemPrompt,
            messages: [{ role: "user", content: [{ type: "text", text: userText }] }] },
          { signal },
        );
      }
    } catch (err) {
      return buildError(domainId, "AI inference failed: " + err.message);
    }

    // Step 9 — Parse structured response
    const parsed = diagnosisParser.parse(rawText, domainId);

    // Step 10 — Structure recommendations
    const recommendations = recommendationEngine.structure(parsed.recommendations, parsed);

    // Step 11 — Escalation evaluation
    const escalation = escalationEngine.evaluate(parsed);

    // Build final record
    const reportId = reportService.generateId();
    const record = {
      ...parsed,
      reportId,
      domainId,
      species,
      imageCapture: imageBase64 ? "attached" : "none",
      symptomInput: symptomSummary,
      additionalNotes,
      structuredRecommendations: recommendations,
      escalation,
      createdAt: new Date().toISOString(),
    };

    // Save to history
    await historyService.save(record);

    return record;
  },
};

// Register the offline-queue flush handler exactly once. On reconnect, any
// queued diagnosis re-runs through analyze() and is saved to history.
let _flushRegistered = false;
function ensureFlushRegistered() {
  if (_flushRegistered) return;
  _flushRegistered = true;
  offlineQueue.onFlush(async (job) => {
    if (job?.kind !== "diagnosis") return;
    await orchestrator.analyze({ ...job.params, _imageBase64: job.imageBase64, _metadata: job.metadata });
  });
}

function buildQueued(domainId) {
  return {
    ok:        true,
    queued:    true,
    domainId,
    message:   "Saved for analysis when back online.",
    createdAt: new Date().toISOString(),
  };
}

function buildUserMessage({ domain, domainId, symptomSummary, additionalNotes, lang, hasImage }) {
  const parts = [
    `Domain: ${domain.name}`,
    symptomSummary ? `Observed symptoms: ${symptomSummary}` : "",
    additionalNotes ? `Additional notes from farmer: ${additionalNotes}` : "",
    hasImage ? "I have attached a photo of the affected area for your analysis." : "No image available — please diagnose based on symptoms only.",
    `Please respond in: ${lang === "hi" ? "Hindi" : lang === "bn" ? "Bengali" : "English"} where applicable, but keep the JSON keys in English.`,
    `Provide your diagnosis as a JSON object following the schema in the system prompt.`,
  ];
  return parts.filter(Boolean).join("\n");
}

function buildError(domainId, message) {
  return {
    ok:       false,
    domainId,
    error:    message,
    primaryDiagnosis: "Unable to Detect",
    severity: { level: "Mild", label: "Mild" },
    confidence: { score: 0, label: "low", isLow: true },
    observations: [],
    recommendations: { immediate: [], organic: [], chemical: [], biological: [], nutrition: [], environmental: [] },
    structuredRecommendations: { categories: [], hasImmediate: false, hasChemical: false, totalCount: 0 },
    escalation: { flags: [], hasEmergency: false, needsExpert: true, needsMoreImages: true },
    risk: { urgency: { key: "routine", label: "Routine" }, isHighRisk: false },
    followUp: { days: 3, checkPoints: [] },
    needsMoreImages: true,
    needsExpertReview: true,
    disclaimer: "AI-based prediction only. Not a confirmed diagnosis.",
    createdAt: new Date().toISOString(),
  };
}
