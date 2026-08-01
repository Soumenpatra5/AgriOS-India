/* Cloud vision inference provider — delegates to the shared llmClient.

   This provider owns only the vision *prompt* (system + user framing) and the
   result envelope. All transport — key selection, 401/429 failover with retry,
   OpenAI⇄Anthropic translation, and SSE parsing — lives in llmClient, the single
   cloud transport. Do NOT re-implement fetch/streaming here; that duplication
   previously drifted from llmClient (no Anthropic support, no failover retry). */

import { CAPABILITIES } from "./inferenceInterface.js";
import { MODELS } from "../../../ai/config.js";
import { llmClient } from "../../../ai/services/llmClient.js";

export const claudeVisionProvider = {
  id:   "cloudVision",
  name: "Cloud Vision",

  isAvailable() {
    return navigator.onLine;
  },

  getCapabilities() {
    return Object.values(CAPABILITIES);
  },

  async infer(imageBase64, metadata = {}, context = {}) {
    const t0 = Date.now();

    // Internal (Anthropic-style) content blocks — llmClient converts to whatever
    // the active provider needs.
    const messages = [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
        { type: "text", text: context.userPrompt || defaultPrompt(context) },
      ],
    }];

    // Callers (e.g. the diagnostics orchestrator) may supply their own system
    // prompt / model / token budget; otherwise use this provider's defaults.
    const text = await llmClient.complete(
      {
        model:     context.model     || MODELS.answer,
        maxTokens: context.maxTokens || 1024,
        system:    context.system    || buildSystem(context),
        messages,
      },
      { signal: context.signal },
    );

    return {
      provider:    this.id,
      raw:         text,
      inferenceMs: Date.now() - t0,
      modelId:     MODELS.answer,
      metadata,
    };
  },
};

function defaultPrompt(ctx) {
  const parts = ["Analyze this farm image."];
  if (ctx.cropType) parts.push(`Crop: ${ctx.cropType}.`);
  parts.push("Identify any diseases, pests, weeds, or soil problems. State: (1) what you see, (2) diagnosis, (3) confidence level (High/Medium/Low), (4) recommended action.");
  return parts.join(" ");
}

function buildSystem(ctx) {
  const lines = [
    "You are an expert agronomist and plant pathologist specializing in Indian crops.",
    "Analyze farm images and give specific, actionable diagnoses.",
    "Always include: what you observe, likely diagnosis, confidence (High/Medium/Low), and recommended action.",
    "If the image is unclear or insufficient, say so explicitly.",
  ];
  if (ctx.cropType) lines.push(`Current crop: ${ctx.cropType}.`);
  if (ctx.location)  lines.push(`Location: ${ctx.location}.`);
  if (ctx.season)    lines.push(`Season: ${ctx.season}.`);
  return lines.join("\n");
}
