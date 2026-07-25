/* GPT Vision inference provider — calls /api/ai/chat with an image block.
   This is the default cloud provider; works immediately with no model download. */

import { CAPABILITIES } from "./inferenceInterface.js";
import { API_ENDPOINT, MODELS } from "../../../ai/config.js";
import { authFetch } from "../../firebase/authFetch.js";

export const claudeVisionProvider = {
  id:   "claude-vision",
  name: "GPT Vision (Cloud)",

  isAvailable() {
    return navigator.onLine;
  },

  getCapabilities() {
    return Object.values(CAPABILITIES);
  },

  async infer(imageBase64, metadata = {}, context = {}) {
    const t0 = Date.now();

    const systemMsg = buildSystem(context);
    const userContent = [
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
      { type: "text", text: context.userPrompt || defaultPrompt(context) },
    ];

    const messages = [
      { role: "system", content: systemMsg },
      { role: "user", content: userContent },
    ];

    const res = await authFetch(API_ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ model: MODELS.answer, max_tokens: 1024, messages }),
    });

    if (!res.ok) {
      let msg = `Vision API error (${res.status})`;
      try { msg = (await res.json()).error?.message || msg; } catch { /* ignore */ }
      throw new Error(msg);
    }

    const text = await consumeSse(res);

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

// Consume an OpenAI SSE stream and return the assembled text.
async function consumeSse(res) {
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let buf  = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        const delta = ev.choices?.[0]?.delta?.content;
        if (delta) text += delta;
      } catch { /* malformed chunk — skip */ }
    }
  }

  return text;
}
