import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';

export async function streamGemini(apiKey, body) {
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const { model, messages, tools, max_tokens, temperature } = body;
    let systemInstruction = undefined;
    const contents = [];
    
    for (const m of messages) {
      if (m.role === "system") {
        systemInstruction = m.content;
      } else if (m.role === "user") {
        const parts = [];
        if (Array.isArray(m.content)) {
          for (const block of m.content) {
            if (block.type === "text") {
              parts.push({ text: block.text });
            } else if (block.type === "image_url") {
              const uri = block.image_url?.url || "";
              const match = uri.match(/^data:(image\/(jpeg|png|webp|heic));base64,([A-Za-z0-9+/=]+)$/);
              if (!match) {
                return { ok: false, status: 400, message: "Invalid or unsupported image data URI." };
              }
              const mimeType = match[1];
              const data = match[3];
              if (data.length > 28000000) { // ~20MB
                return { ok: false, status: 400, message: "Image size exceeds limit." };
              }
              parts.push({ inlineData: { mimeType, data } });
            }
          }
        } else {
          parts.push({ text: m.content });
        }
        contents.push({ role: "user", parts });
      } else if (m.role === "assistant") {
        if (m.tool_calls) {
          const parts = m.tool_calls.map(tc => ({
             functionCall: { id: tc.id, name: tc.function.name, args: JSON.parse(tc.function.arguments || "{}") }
          }));
          contents.push({ role: "model", parts });
        } else {
          contents.push({ role: "model", parts: [{ text: m.content || "" }] });
        }
      } else if (m.role === "tool") {
        let responseObj;
        try { responseObj = JSON.parse(m.content); } catch { responseObj = { error: m.content }; }
        contents.push({
          role: "user",
          parts: [{ functionResponse: { id: m.tool_call_id, name: m.name, response: responseObj } }]
        });
      }
    }
    
    const config = {};
    if (systemInstruction) config.systemInstruction = systemInstruction;
    if (temperature !== undefined) config.temperature = temperature;
    if (max_tokens !== undefined) config.maxOutputTokens = max_tokens;
    
    if (tools && tools.length > 0) {
      config.tools = [{
        functionDeclarations: tools.map(t => ({
          name: t.function?.name || t.name,
          description: t.function?.description || t.description || "",
          parameters: t.function?.parameters || t.parameters
        }))
      }];
    }
    
    const stream = await ai.models.generateContentStream({ model, contents, config });
    
    async function* sseIterator() {
      for await (const chunk of stream) {
        if (chunk.text) {
          yield `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: chunk.text } }] })}\n\n`;
        }
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          const tool_calls = chunk.functionCalls.map((fc, i) => ({
            index: i,
            id: fc.id || ("call_" + crypto.randomUUID()),
            type: "function",
            function: {
              name: fc.name,
              arguments: JSON.stringify(fc.args || {})
            }
          }));
          yield `data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls } }] })}\n\n`;
        }
      }
      yield "data: [DONE]\n\n";
    }
    
    return { ok: true, iterator: sseIterator() };
  } catch (err) {
    const status = err.status || 500;
    console.error("Gemini upstream error:", err.message);
    return { ok: false, status, message: `Gemini Provider Error: ${status}` };
  }
}
