/* AgriOS AI Gateway — Vercel serverless function.

   Multi-provider, multi-key with automatic failover.
   Supports OpenAI and Anthropic APIs. If the primary key fails (401/429),
   automatically tries the next available key.

   Setup — add in Vercel → Project → Settings → Environment Variables:
     OPENAI_API_KEY      = sk-...           (primary OpenAI key)
     ANTHROPIC_API_KEY   = sk-ant-...       (Anthropic Claude key)
     OPENAI_API_KEY_2    = sk-...           (backup OpenAI key, optional)  */

import { verifyToken } from "../_middleware/verifyAuth.js";

const MAX_TOKENS_CAP = 4096;
const MAX_BODY_CHARS = 400_000;
const MAX_MESSAGES = 40;
const RATE = { windowMs: 60_000, max: 20 };

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  if (arr.length >= RATE.max) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

// ── Provider definitions ─────────────────────────────────────────────
const PROVIDERS = {
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o3-mini"],
    headers: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
    buildBody: ({ model, messages, tools, max_tokens }) => ({
      model,
      messages,
      ...(Array.isArray(tools) && tools.length ? { tools } : {}),
      max_tokens: Math.min(Number(max_tokens) || 1024, MAX_TOKENS_CAP),
      stream: true,
    }),
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    models: ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5", "claude-sonnet-4-5-20250514"],
    headers: (key) => ({ "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }),
    buildBody: ({ model, messages, tools, max_tokens }) => {
      // Extract system message from messages array
      let system = "";
      const msgs = [];
      for (const m of messages) {
        if (m.role === "system") { system = typeof m.content === "string" ? m.content : ""; continue; }
        // Convert tool messages to Anthropic format
        if (m.role === "tool") {
          msgs.push({ role: "user", content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content }] });
          continue;
        }
        // Convert assistant tool_calls to Anthropic format
        if (m.role === "assistant" && m.tool_calls) {
          const content = [];
          if (m.content) content.push({ type: "text", text: m.content });
          for (const tc of m.tool_calls) {
            content.push({
              type: "tool_use", id: tc.id, name: tc.function.name,
              input: JSON.parse(tc.function.arguments || "{}"),
            });
          }
          msgs.push({ role: "assistant", content });
          continue;
        }
        // Convert image_url blocks to Anthropic format
        if (m.role === "user" && Array.isArray(m.content)) {
          const parts = m.content.map((block) => {
            if (block.type === "image_url") {
              const url = block.image_url?.url || "";
              const match = url.match(/^data:(image\/\w+);base64,(.+)/);
              if (match) return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
            }
            return block;
          });
          msgs.push({ role: "user", content: parts });
          continue;
        }
        msgs.push(m);
      }
      // Convert tools to Anthropic format
      let anthropicTools;
      if (Array.isArray(tools) && tools.length) {
        anthropicTools = tools.map((t) => ({
          name: t.function?.name || t.name,
          description: t.function?.description || t.description || "",
          input_schema: t.function?.parameters || t.input_schema || { type: "object", properties: {} },
        }));
      }
      return {
        model,
        ...(system ? { system } : {}),
        messages: msgs,
        ...(anthropicTools ? { tools: anthropicTools } : {}),
        max_tokens: Math.min(Number(max_tokens) || 1024, MAX_TOKENS_CAP),
        stream: true,
      };
    },
    // Transform Anthropic SSE events to OpenAI SSE format for the client
    transformStream: true,
  },
};

// ── Build key list from env vars ─────────────────────────────────────
function getKeys() {
  const keys = [];
  if (process.env.OPENAI_API_KEY) keys.push({ provider: "openai", key: process.env.OPENAI_API_KEY });
  if (process.env.ANTHROPIC_API_KEY) keys.push({ provider: "anthropic", key: process.env.ANTHROPIC_API_KEY });
  if (process.env.OPENAI_API_KEY_2) keys.push({ provider: "openai", key: process.env.OPENAI_API_KEY_2 });
  if (process.env.OPENAI_API_KEY_3) keys.push({ provider: "openai", key: process.env.OPENAI_API_KEY_3 });
  if (process.env.ANTHROPIC_API_KEY_2) keys.push({ provider: "anthropic", key: process.env.ANTHROPIC_API_KEY_2 });
  return keys;
}

function findProvider(model) {
  for (const [id, p] of Object.entries(PROVIDERS)) {
    if (p.models.includes(model)) return id;
  }
  return null;
}

// ── Anthropic SSE → OpenAI SSE transformer ───────────────────────────
function anthropicToOpenAI(chunk) {
  const lines = chunk.split("\n");
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) { out.push(line); continue; }
    const data = trimmed.slice(5).trim();
    if (data === "[DONE]") { out.push("data: [DONE]"); continue; }
    try {
      const ev = JSON.parse(data);
      if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
        out.push(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: ev.delta.text } }] })}`);
      } else if (ev.type === "content_block_delta" && ev.delta?.type === "input_json_delta") {
        out.push(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: ev.index || 0, function: { arguments: ev.delta.partial_json } }] } }] })}`);
      } else if (ev.type === "content_block_start" && ev.content_block?.type === "tool_use") {
        out.push(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: ev.index || 0, id: ev.content_block.id, type: "function", function: { name: ev.content_block.name, arguments: "" } }] } }] })}`);
      } else if (ev.type === "message_stop") {
        out.push("data: [DONE]");
      } else if (ev.type === "message_delta" && ev.delta?.stop_reason) {
        const reason = ev.delta.stop_reason === "end_turn" ? "stop" : ev.delta.stop_reason === "tool_use" ? "tool_calls" : ev.delta.stop_reason;
        out.push(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: reason }] })}`);
      } else {
        out.push(line);
      }
    } catch { out.push(line); }
  }
  return out.join("\n");
}

// ── Try one key ──────────────────────────────────────────────────────
async function tryKey(entry, body) {
  const provider = PROVIDERS[entry.provider];
  if (!provider) return { ok: false, status: 400, message: `unknown provider: ${entry.provider}` };

  // Map model to this provider's default if needed
  let reqBody = { ...body };
  if (!provider.models.includes(body.model)) {
    // Use provider's first answer-tier model as fallback
    reqBody.model = provider.models[0];
  }

  const upstream = await fetch(provider.url, {
    method: "POST",
    headers: provider.headers(entry.key),
    body: JSON.stringify(provider.buildBody(reqBody)),
  });

  if (!upstream.ok) {
    let detail = `upstream error (${upstream.status})`;
    try { detail = ((await upstream.json()).error?.message) || detail; } catch { /* opaque */ }
    return { ok: false, status: upstream.status, message: detail };
  }

  return { ok: true, upstream, transform: provider.transformStream || false };
}

// ── Handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  try {
  if (req.method !== "POST") return res.status(405).json({ error: { message: "POST only" } });

  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: { message: "Unauthorized" } });

  // Client-provided key (from API Key Manager) takes priority
  const clientKey = req.headers["x-client-api-key"];
  const clientProvider = req.headers["x-client-provider"];

  const keys = clientKey && clientProvider
    ? [{ provider: clientProvider, key: clientKey }]
    : getKeys();
  if (!keys.length) return res.status(503).json({ error: { message: "AI is not configured — add API keys in Vercel environment variables." } });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ error: { message: "Too many requests. Please wait a minute." } });

  const body = req.body || {};
  const { model, messages, max_tokens } = body;

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: { message: "invalid messages" } });
  }
  if (JSON.stringify(body).length > MAX_BODY_CHARS) {
    return res.status(413).json({ error: { message: "request too large" } });
  }

  // Try keys in order; failover on 401/429/403
  let lastError = "No API keys available";
  for (const entry of keys) {
    const result = await tryKey(entry, body);
    if (!result.ok) {
      lastError = result.message;
      if (result.status === 401 || result.status === 429 || result.status === 403) continue;
      return res.status(result.status).json({ error: { message: result.message } });
    }

    // Stream the response
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    });

    const reader = result.upstream.body.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (result.transform) {
          const text = decoder.decode(value, { stream: true });
          res.write(anthropicToOpenAI(text));
        } else {
          res.write(Buffer.from(value));
        }
      }
    } catch { /* client disconnected */ }
    finally { res.end(); }
    return;
  }

  return res.status(502).json({ error: { message: `All API keys failed. Last error: ${lastError}` } });
  } catch (err) {
    // TEMPORARY diagnostic — surface the real crash instead of FUNCTION_INVOCATION_FAILED
    console.error("chat handler crash:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: { message: `handler crash: ${err?.message}`, stack: err?.stack } });
    }
  }
}
