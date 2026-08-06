/* Public surface of the AI engine. UI imports ONLY from here. */

import { useCallback, useRef, useState } from "react";
import { sendMessage } from "./gateway/aiGateway.js";
import { conversationStore } from "./memory/conversationStore.js";
import { textOf } from "./models/message.js";
import { getAgent, listAgents, DEFAULT_AGENT_ID } from "./agents/registry.js";

export { conversationStore } from "./memory/conversationStore.js";
export { responseCache } from "./memory/responseCache.js";
export { profileMemory } from "./memory/profileMemory.js";
export { aiAnalytics } from "./analytics/aiAnalytics.js";
export { voice } from "./voice/speech.js";
export { captureImageBlock } from "./vision/imagePipeline.js";
export { getAgent, listAgents, DEFAULT_AGENT_ID } from "./agents/registry.js";

/* React hook driving a chat session. Owns messages, streaming state and errors. */
export function useAI({ agentId = null, conversationId = null, lang = "en" } = {}) {
  const [convoId, setConvoId] = useState(conversationId);
  const [messages, setMessages] = useState(() => {
    const c = conversationId && conversationStore.get(conversationId);
    return c ? c.messages : [];
  });
  const [streamText, setStreamText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [agent, setAgent] = useState(() => (agentId ? getAgent(agentId) : null));
  const abortRef = useRef(null);

  const send = useCallback(async (text, imageBlocks = []) => {
    if (busy) return;
    setError(null); setBusy(true); setStreamText("");
    abortRef.current = new AbortController();

    // Optimistic user bubble
    const optimistic = { id: "tmp" + Date.now(), role: "user",
      content: [...imageBlocks, { type: "text", text }], ts: Date.now() };
    setMessages((m) => [...m, optimistic]);

    try {
      const res = await sendMessage({
        conversationId: convoId, agentId, text, imageBlocks, lang,
        signal: abortRef.current.signal,
        onText: (delta) => setStreamText((s) => s + delta),
        onAgent: setAgent,
      });
      setConvoId(res.conversationId);
      setMessages(conversationStore.get(res.conversationId)?.messages || []);
    } catch (e) {
      if (e.name !== "AbortError") setError(e);
      // Roll back the optimistic bubble on failure so retry doesn't duplicate.
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
    } finally {
      setStreamText(""); setBusy(false);
    }
  }, [busy, convoId, agentId, lang]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // Re-run the last user turn for a fresh answer: drop the last user message and
  // everything after it, then re-send that text so a new response is generated.
  const regenerate = useCallback(() => {
    if (busy || !convoId) return;
    const convo = conversationStore.get(convoId);
    if (!convo?.messages?.length) return;
    let cut = -1;
    for (let i = convo.messages.length - 1; i >= 0; i--) {
      if (convo.messages[i].role === "user") { cut = i; break; }
    }
    if (cut < 0) return;
    const text = textOf(convo.messages[cut]);
    convo.messages = convo.messages.slice(0, cut);
    conversationStore.save(convo);
    setMessages(convo.messages);
    send(text);
  }, [busy, convoId, send]);

  const reset = useCallback(() => {
    stop(); setConvoId(null); setMessages([]); setStreamText(""); setError(null);
    setAgent(agentId ? getAgent(agentId) : null);
  }, [agentId, stop]);

  const load = useCallback((id) => {
    const c = conversationStore.get(id);
    if (!c) return;
    setConvoId(id); setMessages(c.messages);
    setAgent(c.agentId ? getAgent(c.agentId) : null);
  }, []);

  return { messages, streamText, busy, error, agent, conversationId: convoId, send, stop, reset, load, regenerate };
}
