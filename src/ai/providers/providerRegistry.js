/* Provider registry — abstracts LLM provider differences.

   Each provider declares its API URL, model list, and format helpers.
   The active provider is determined by the active key's `provider` field.
   Adding a new provider (Anthropic, Gemini, etc.) is a one-object addition. */

const providers = new Map();

export function registerProvider(provider) {
  providers.set(provider.id, provider);
}

export function getProvider(id) {
  return providers.get(id) || providers.get("openai");
}

export function listProviders() {
  return [...providers.values()].map(({ id, name, models }) => ({ id, name, models }));
}

// ── OpenAI ───────────────────────────────────────────────────────────
registerProvider({
  id: "openai",
  name: "OpenAI",
  apiUrl: "https://api.openai.com/v1/chat/completions",
  models: [
    { id: "gpt-4o", label: "GPT-4o", tier: "answer" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", tier: "router" },
    { id: "gpt-4.1", label: "GPT-4.1", tier: "answer" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", tier: "router" },
    { id: "gpt-4.1-nano", label: "GPT-4.1 Nano", tier: "router" },
    { id: "o3-mini", label: "o3-mini", tier: "answer" },
  ],
  authHeader: (key) => ({ authorization: `Bearer ${key}` }),
});

// ── Anthropic ───────────────────────────────────────────────────────
registerProvider({
  id: "anthropic",
  name: "Anthropic",
  apiUrl: "https://api.anthropic.com/v1/messages",
  models: [
    { id: "claude-opus-4-8", label: "Claude Opus 4.8", tier: "answer" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", tier: "answer" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", tier: "router" },
  ],
  authHeader: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
  buildBody(openAIBody) {
    const { model, messages, tools, max_tokens } = openAIBody;
    let system = "";
    const msgs = [];
    for (const m of messages) {
      if (m.role === "system") { system = typeof m.content === "string" ? m.content : ""; continue; }
      if (m.role === "tool") {
        msgs.push({ role: "user", content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content }] });
        continue;
      }
      if (m.role === "assistant" && m.tool_calls) {
        const content = [];
        if (m.content) content.push({ type: "text", text: m.content });
        for (const tc of m.tool_calls) {
          content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input: JSON.parse(tc.function.arguments || "{}") });
        }
        msgs.push({ role: "assistant", content });
        continue;
      }
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
      max_tokens: max_tokens || 1024,
      stream: true,
    };
  },
  transformSSE(chunk) {
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
  },
});

// ── Google Gemini (future) ───────────────────────────────────────────
registerProvider({
  id: "gemini",
  name: "Google Gemini",
  apiUrl: "https://generativelanguage.googleapis.com/v1beta/models",
  models: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "answer" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "router" },
  ],
  authHeader: (key) => ({ "x-goog-api-key": key }),
});

// ── OpenRouter (future) ─────────────────────────────────────────────
registerProvider({
  id: "openrouter",
  name: "OpenRouter",
  apiUrl: "https://openrouter.ai/api/v1/chat/completions",
  models: [
    { id: "openai/gpt-4o", label: "GPT-4o (via OpenRouter)", tier: "answer" },
    { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5 (via OpenRouter)", tier: "answer" },
    { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (via OpenRouter)", tier: "answer" },
  ],
  authHeader: (key) => ({ authorization: `Bearer ${key}` }),
});

// ── DeepSeek (future) ───────────────────────────────────────────────
registerProvider({
  id: "deepseek",
  name: "DeepSeek",
  apiUrl: "https://api.deepseek.com/v1/chat/completions",
  models: [
    { id: "deepseek-chat", label: "DeepSeek Chat", tier: "answer" },
    { id: "deepseek-reasoner", label: "DeepSeek Reasoner", tier: "answer" },
  ],
  authHeader: (key) => ({ authorization: `Bearer ${key}` }),
});

// ── Grok (future) ───────────────────────────────────────────────────
registerProvider({
  id: "grok",
  name: "Grok (xAI)",
  apiUrl: "https://api.x.ai/v1/chat/completions",
  models: [
    { id: "grok-3", label: "Grok 3", tier: "answer" },
    { id: "grok-3-mini", label: "Grok 3 Mini", tier: "router" },
  ],
  authHeader: (key) => ({ authorization: `Bearer ${key}` }),
});
