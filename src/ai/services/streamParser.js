/* Parses an OpenAI Chat Completions SSE stream into content blocks.

   Emits text deltas via onText as they arrive and returns the fully
   accumulated message: { content, stopReason, usage }. Handles text
   and tool_call blocks (function calling). */

export async function parseStream(response, { onText, signal } = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let text = "";
  let stopReason = null;
  let usage = null;
  const toolCalls = new Map(); // index -> { id, name, arguments }

  const handle = (data) => {
    if (data === "[DONE]") return;
    let ev;
    try { ev = JSON.parse(data); } catch { return; }

    if (ev.usage) usage = ev.usage;

    const choice = ev.choices?.[0];
    if (!choice) return;

    if (choice.finish_reason) stopReason = choice.finish_reason;

    const delta = choice.delta;
    if (!delta) return;

    // Text content
    if (delta.content) {
      text += delta.content;
      onText?.(delta.content);
    }

    // Tool calls
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        if (!toolCalls.has(idx)) {
          toolCalls.set(idx, { type: "tool_use", id: tc.id || "", name: tc.function?.name || "", _json: "" });
        }
        const entry = toolCalls.get(idx);
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) entry.name = tc.function.name;
        if (tc.function?.arguments) entry._json += tc.function.arguments;
      }
    }
  };

  for (;;) {
    if (signal?.aborted) { reader.cancel(); throw new DOMException("aborted", "AbortError"); }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n");
    buffer = parts.pop();
    for (const line of parts) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) handle(trimmed.slice(5).trim());
    }
  }

  // Build content blocks
  const content = [];
  if (text) content.push({ type: "text", text });
  for (const tc of toolCalls.values()) {
    try { tc.input = tc._json ? JSON.parse(tc._json) : {}; } catch { tc.input = {}; }
    delete tc._json;
    content.push(tc);
  }

  // Map OpenAI stop reasons to Anthropic-style
  const stopMap = { stop: "end_turn", tool_calls: "tool_use", length: "max_tokens" };
  return { content, stopReason: stopMap[stopReason] || stopReason, usage };
}
