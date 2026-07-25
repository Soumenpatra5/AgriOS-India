/* AI engine configuration — single source of truth for models and limits.
   Answer model: highest quality. Router model: fast/cheap intent classification.
   Key management is handled by keyManager.js — no keys stored here. */

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
