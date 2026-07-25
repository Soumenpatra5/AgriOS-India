/* AI Gateway — the single pipeline every AI request flows through:

   validate → rate-limit → route → context → prompt → LLM (streaming)
   → tool loop → persist → analytics

   UI code never talks to agents, prompts, or the LLM client directly. */

import { MODELS, LIMITS } from "../config.js";
import { llmClient } from "../services/llmClient.js";
import { routeIntent } from "../router/intentRouter.js";
import { getAgent } from "../agents/registry.js";
import { buildSystemPrompt } from "../prompts/promptEngine.js";
import { checkOutput } from "../prompts/safety.js";
import { contextEngine } from "../context/contextEngine.js";
import { memoryEngine } from "../memory/memoryEngine.js";
import { conversationStore } from "../memory/conversationStore.js";
import { toolRegistry } from "../tools/toolRegistry.js";
import { validateInput, detectSensitive, rateLimit } from "../middleware/validation.js";
import { aiAnalytics } from "../analytics/aiAnalytics.js";
import { userMessage, assistantMessage, toWire } from "../models/message.js";

export async function sendMessage({
  conversationId = null,
  agentId = null,          // pinned agent (user opened a specific expert); null = auto-route
  text,
  imageBlocks = [],
  lang = "en",
  onText,                  // (delta) => void — streaming callback
  onAgent,                 // (agent) => void — fires once routing is decided
  signal,
}) {
  const started = Date.now();

  // 1. Guards
  const v = validateInput(text);
  if (!v.ok) throw Object.assign(new Error(v.reason), { code: v.reason });
  const rl = rateLimit();
  if (!rl.ok) throw Object.assign(new Error(`rate-limited`), { code: "rate-limit", retryInSec: rl.retryInSec });
  const sensitive = detectSensitive(v.text);

  // 2. Conversation
  const convo = (conversationId && conversationStore.get(conversationId)) || conversationStore.create(agentId);

  // 3. Routing (pinned agent wins; otherwise sticky + classify)
  let resolvedId = agentId || convo.agentId;
  let routeMethod = "pinned";
  if (!agentId) {
    const r = await routeIntent(v.text, { currentAgentId: convo.agentId, signal });
    resolvedId = r.agentId;
    routeMethod = r.method;
  }
  const agent = getAgent(resolvedId);
  convo.agentId = agent.id;
  onAgent?.(agent);

  // 4. Prompt
  const system = buildSystemPrompt({
    agent,
    contextBlock: contextEngine.build({ convo }),
    lang,
  });

  // 5. Messages: history window + the new user turn
  const userMsg = userMessage(v.text, imageBlocks);
  const wire = [...memoryEngine.window(convo), toWire(userMsg)];

  // 6. LLM call with tool loop
  const tools = toolRegistry.schemasFor(agent);
  let finalText = "";
  let usage = null;
  let ok = true;
  let toolRounds = 0;

  try {
    for (;;) {
      const result = await llmClient.streamChat(
        { model: MODELS.answer, system, messages: wire, tools, maxTokens: LIMITS.maxTokens },
        { onText, signal },
      );
      usage = result.usage || usage;
      finalText += result.content.filter((b) => b.type === "text").map((b) => b.text).join("");

      const toolUses = result.content.filter((b) => b.type === "tool_use");
      if (result.stopReason !== "tool_use" || !toolUses.length || ++toolRounds > LIMITS.maxToolRounds) break;

      const toolResults = await Promise.all(toolUses.map((b) => toolRegistry.execute(b)));
      // OpenAI format: assistant message with tool_calls, then individual tool messages
      const roundText = result.content.filter((b) => b.type === "text").map((b) => b.text).join("") || null;
      const assistantMsg = { role: "assistant", content: roundText };
      assistantMsg.tool_calls = toolUses.map((b) => ({
        id: b.id, type: "function",
        function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
      }));
      wire.push(assistantMsg);
      for (const tr of toolResults) wire.push(tr);
    }
  } catch (e) {
    ok = false;
    aiAnalytics.log({ type: "turn", agentId: agent.id, ok, latencyMs: Date.now() - started, error: e.code || e.message });
    throw e;
  }

  // 7. Output check (cheap leak guard)
  const guard = checkOutput(finalText);

  // 8. Persist
  convo.messages.push(userMsg);
  convo.messages.push(assistantMessage(finalText, agent.id, { flagged: guard.flagged || undefined }));
  conversationStore.save(convo);

  // 9. Analytics (metadata only)
  aiAnalytics.log({
    type: "turn", agentId: agent.id, routeMethod, ok,
    latencyMs: Date.now() - started, toolRounds,
    inputTokens: usage?.input_tokens, outputTokens: usage?.output_tokens,
    sensitiveInput: sensitive.sensitive || undefined,
  });

  return { conversationId: convo.id, agent, text: finalText, usage, sensitive };
}
