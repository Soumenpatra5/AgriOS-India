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

// ── Anthropic (future) ───────────────────────────────────────────────
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
