/* AI engine configuration — single source of truth for models and limits.
   Answer model: highest quality. Router model: fast/cheap intent classification.
   Uses OpenAI GPT models via the serverless proxy. */

export const MODELS = {
  answer: "gpt-4o",
  router: "gpt-4o-mini",
};

export const LIMITS = {
  maxInputChars: 4000,      // per user message
  maxTokens: 2048,          // per assistant response
  historyWindow: 16,        // messages sent to the model per turn
  maxToolRounds: 3,         // tool-use loop cap
  requestsPerMinute: 10,    // client-side rate limit
  maxConversations: 50,     // pruned oldest-unpinned beyond this
  maxMessagesPerConvo: 60,  // stored per conversation
  maxImageDim: 1280,        // px, longest edge after compression
};

export const API_ENDPOINT = "/api/ai/chat";

/* Dev fallback: `npm run dev` has no serverless runtime. If a dev key is
   present in localStorage, the client calls OpenAI directly (dev only).
   Set it once in the browser console:
     localStorage.setItem("agrios:devApiKey", JSON.stringify("sk-..."))   */
export function getDevKey() {
  if (!import.meta.env.DEV) return null;
  try { return JSON.parse(localStorage.getItem("agrios:devApiKey")) || null; }
  catch { return null; }
}
