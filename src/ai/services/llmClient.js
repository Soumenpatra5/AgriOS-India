/* Provider abstraction over the LLM transport.

   Production: POST /api/ai/chat (Vercel serverless holds the API key).
   Dev:        if a dev key is set (see config.getDevKey), call the OpenAI
               API directly from the browser — dev convenience only.

   The client sends messages in Anthropic-style format internally. The
   serverless proxy (or dev path) translates to OpenAI wire format. */

import { API_ENDPOINT, getDevKey } from "../config.js";
import { parseStream } from "./streamParser.js";
import { authFetch } from "../../services/firebase/authFetch.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/* Convert Anthropic-style messages to OpenAI format */
function toOpenAIMessages(system, messages) {
  const out = [];
  if (system) out.push({ role: "system", content: system });

  for (const msg of messages) {
    // Pass through OpenAI-format messages (tool results, assistant with tool_calls)
    if (msg.role === "tool") { out.push(msg); continue; }
    if (msg.tool_calls) { out.push(msg); continue; }

    if (typeof msg.content === "string") {
      out.push({ role: msg.role, content: msg.content });
    } else if (Array.isArray(msg.content)) {
      const parts = [];
      for (const block of msg.content) {
        if (block.type === "text") {
          parts.push({ type: "text", text: block.text });
        } else if (block.type === "image") {
          const b64 = block.source?.data;
          const mime = block.source?.media_type || "image/jpeg";
          parts.push({ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } });
        }
      }
      out.push({ role: msg.role, content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts });
    } else {
      out.push({ role: msg.role, content: String(msg.content ?? "") });
    }
  }
  return out;
}

/* Convert Anthropic-style tools to OpenAI format */
function toOpenAITools(tools) {
  if (!tools?.length) return undefined;
  return tools.map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description || "",
      parameters: t.input_schema || { type: "object", properties: {} },
    },
  }));
}

async function openAIFetch({ model, system, messages, tools, maxTokens }, signal) {
  const openAIMessages = toOpenAIMessages(system, messages);
  const openAITools = toOpenAITools(tools);

  const body = {
    model,
    messages: openAIMessages,
    max_tokens: maxTokens,
    stream: true,
    ...(openAITools ? { tools: openAITools } : {}),
  };

  const devKey = getDevKey();
  const url = devKey ? OPENAI_URL : API_ENDPOINT;
  const headers = devKey
    ? { "content-type": "application/json", "authorization": `Bearer ${devKey}` }
    : { "content-type": "application/json" };

  const fetcher = devKey ? fetch : authFetch;
  const res = await fetcher(url, { method: "POST", headers, body: JSON.stringify(body), signal });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error?.message || ""; } catch { /* opaque */ }
    const err = new Error(detail || `AI request failed (HTTP ${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res;
}

export const llmClient = {
  /* Streams a chat completion. Returns { content, stopReason, usage }. */
  async streamChat(request, { onText, signal } = {}) {
    const res = await openAIFetch(request, signal);
    return parseStream(res, { onText, signal });
  },

  /* One-shot, non-streamed short completion (used by the router). */
  async complete(request, { signal } = {}) {
    const { content } = await this.streamChat(request, { signal });
    const text = content.find((b) => b.type === "text");
    return text ? text.text.trim() : "";
  },
};
