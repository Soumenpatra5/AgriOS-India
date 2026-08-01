/* AI provider registry — provider-agnostic interface.
   Each provider defines its capabilities and connection contract.
   API keys stay server-side (in api/); entries here hold only metadata and
   the endpoint path — never secrets, nor the names of their server env vars.
   `authType: "server_env"` signals the key lives in a Vercel env var; the
   client never needs to know which one. */

export const SUPPORTED_PROVIDERS = {
  ANTHROPIC: {
    id: "anthropic",
    label: "Anthropic Claude",
    icon: "Bot",
    endpoint: "/api/ai/chat",
    authType: "server_env",
    envKey: null,
    models: ["claude-opus-4-8", "claude-haiku-4-5"],
    capabilities: ["text", "vision", "structured_output"],
    status: "active",
  },
  GOOGLE_GEMINI: {
    id: "google_gemini",
    label: "Google Gemini",
    icon: "Sparkles",
    endpoint: "/api/ai/gemini",
    authType: "server_env",
    envKey: null,
    models: ["gemini-1.5-pro", "gemini-1.5-flash"],
    capabilities: ["text", "vision", "structured_output"],
    status: "planned",
  },
  OPENAI: {
    id: "openai",
    label: "OpenAI",
    icon: "Bot",
    endpoint: "/api/ai/openai",
    authType: "server_env",
    envKey: null,
    models: ["gpt-4o", "gpt-4o-mini"],
    capabilities: ["text", "vision", "structured_output"],
    status: "planned",
  },
  AZURE_OPENAI: {
    id: "azure_openai",
    label: "Azure OpenAI",
    icon: "Cloud",
    endpoint: "/api/ai/azure",
    authType: "server_env",
    envKey: null,
    models: [],
    capabilities: ["text", "vision"],
    status: "planned",
  },
  AWS_BEDROCK: {
    id: "aws_bedrock",
    label: "AWS Bedrock",
    icon: "Server",
    endpoint: "/api/ai/bedrock",
    authType: "iam_role",
    envKey: null,
    models: ["anthropic.claude-3-5-sonnet", "amazon.titan-text-v2"],
    capabilities: ["text", "vision"],
    status: "planned",
  },
  VERTEX_AI: {
    id: "vertex_ai",
    label: "Vertex AI",
    icon: "Network",
    endpoint: "/api/ai/vertex",
    authType: "service_account",
    envKey: null,
    models: ["gemini-1.5-pro", "claude-3-5-sonnet@20241022"],
    capabilities: ["text", "vision"],
    status: "planned",
  },
  CUSTOM_REST: {
    id: "custom_rest",
    label: "Custom REST API",
    icon: "Link",
    endpoint: null,
    authType: "bearer",
    envKey: null,
    models: [],
    capabilities: ["text", "vision"],
    status: "configurable",
  },
  CUSTOM_GRPC: {
    id: "custom_grpc",
    label: "Custom gRPC Service",
    icon: "Radio",
    endpoint: null,
    authType: "mtls",
    envKey: null,
    models: [],
    capabilities: ["text", "vision"],
    status: "configurable",
  },
};

export const providerRegistry = {
  getAll() { return Object.values(SUPPORTED_PROVIDERS); },
  getActive() { return this.getAll().filter((p) => p.status === "active"); },
  get(id) { return Object.values(SUPPORTED_PROVIDERS).find((p) => p.id === id) || null; },

  getForCapability(capability) {
    return this.getAll().filter((p) => p.capabilities.includes(capability));
  },

  /* Returns the effective provider that will handle inference (active + available). */
  getEffective() {
    return this.getActive()[0] || null;
  },
};
