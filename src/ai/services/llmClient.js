/* LLM transport with automatic key selection and failover.

   Uses keyManager for the active API key. If a request fails with
   401/429, automatically rotates to the next healthy key and retries.

   Production path: POST /api/ai/chat (serverless proxy holds no key —
   the client-managed key is sent via x-api-key header, and the proxy
   forwards it).
   Direct path: if an active key exists, call the provider API directly. */

import { API_ENDPOINT } from "../config.js";
import { parseStream } from "./streamParser.js";
import { authFetch } from "../../services/firebase/authFetch.js";
import { keyManager } from "../keyManager.js";
import { getProvider } from "../providers/providerRegistry.js";

/* Convert Anthropic-style messages to OpenAI format */
function toOpenAIMessages(system, messages) {
  const out = [];
  if (system) out.push({ role: "system", content: system });

  for (const msg of messages) {
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

  const activeKey = keyManager.getActiveKey();

  if (activeKey) {
    const provider = getProvider(activeKey.provider);
    const url = provider.apiUrl;
    const headers = { "content-type": "application/json", ...provider.authHeader(activeKey.key) };
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json())?.error?.message || ""; } catch { /* opaque */ }
      const err = new Error(detail || `AI request failed (HTTP ${res.status})`);
      err.status = res.status;
      err.keyId = activeKey.id;
      throw err;
    }
    return { res, keyId: activeKey.id };
  }

  // No client-side key — use serverless proxy
  const res = await authFetch(API_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error?.message || ""; } catch { /* opaque */ }
    const err = new Error(detail || `AI request failed (HTTP ${res.status})`);
    err.status = res.status;
    throw err;
  }
  return { res, keyId: null };
}

export const llmClient = {
  /* Streams a chat completion with automatic failover. */
  async streamChat(request, { onText, signal } = {}) {
    try {
      const { res, keyId } = await openAIFetch(request, signal);
      const result = await parseStream(res, { onText, signal });
      if (keyId) keyManager.recordSuccess(keyId);
      return result;
    } catch (err) {
      if (err.keyId) {
        keyManager.recordFailure(err.keyId, err.message, err.status);
        if (keyManager.shouldFailover(err.status)) {
          const next = keyManager.rotateKey(err.keyId);
          if (next) {
            const { res, keyId } = await openAIFetch(request, signal);
            const result = await parseStream(res, { onText, signal });
            if (keyId) keyManager.recordSuccess(keyId);
            return result;
          }
        }
      }
      throw err;
    }
  },

  /* One-shot, non-streamed short completion (used by the router). */
  async complete(request, { signal } = {}) {
    const { content } = await this.streamChat(request, { signal });
    const text = content.find((b) => b.type === "text");
    return text ? text.text.trim() : "";
  },
};
