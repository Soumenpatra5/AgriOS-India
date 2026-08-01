# Audit — Cloud-Vision Paths

**Scope:** duplicate/parallel implementations of the cloud LLM-vision call across
chat, diagnostics, and the vision pipeline.
**Status:** ✅ Resolved (see commits). Two minor follow-ups remain (F3b, F6).

---

## Background

Three code paths sent an image to the cloud LLM:

| Path | Chain | Caller | Original status |
|---|---|---|---|
| A — Chat | `AIChat` → `aiGateway.sendMessage` → `llmClient.streamChat` | `AIChat.jsx` | Live |
| B — Diagnostics | `DiagnosticFlow` → `orchestrator.analyze` → `llmClient.complete` | `DiagnosticFlow.jsx` | Live |
| C — Vision pipeline | `visionPipeline.analyze` → `hybridProvider` → `claudeVisionProvider` (own fetch/SSE/failover) | none | **Dead** |

Paths A and B shared `llmClient`. Path C was an unreachable parallel implementation
that re-implemented the transport and had already drifted from `llmClient`.

---

## Findings & resolution

### F1 — Path C was dead code duplicating `llmClient` · ✅ RESOLVED
The entire `visionPipeline → hybridProvider → {localProvider, claudeVisionProvider}
→ confidenceEngine → modelManager` chain was reachable from no screen.
**Fix:** retired the dead free-text path — deleted `services/vision/pipeline.js`,
`confidence/confidenceEngine.js`, `models/modelManager.js`, and the stale
`visionPipeline` re-export. — commit `1eabfa3`

### F2 — `claudeVisionProvider` re-implemented `llmClient`'s transport · ✅ RESOLVED
It duplicated key selection, direct-key-vs-proxy branching, 401/429 failover, and
SSE parsing (~80 lines).
**Fix:** `claudeVisionProvider.infer()` now delegates to `llmClient.complete()`;
it owns only the vision prompt and result envelope. — commit `8c927a3`

### F3 — Path C had drifted from the canonical transport · ✅ RESOLVED
Copies diverge. Path C had accumulated latent bugs vs `llmClient`:
- **No Anthropic support** — sent OpenAI shape to any provider URL (the class of bug
  fixed elsewhere this cycle).
- **Two SSE parsers** — a private `consumeSse` vs the shared `parseStream`.
- **Failover asymmetry** — rotated a key but did **not** retry the request.

**Fix:** by delegating to `llmClient` (F2), the provider inherits Anthropic
translation, failover-with-retry, and the shared parser automatically. — commit `8c927a3`

### F3b — Naming drift · ⚠️ PARTIAL (cosmetic)
Provider display name corrected to "Cloud Vision", but `id` remains
`"claude-vision"` (kept to avoid breaking any persisted references), and it sends
`MODELS.answer` (gpt-4o). Non-functional; rename `id → cloudVision` in a future pass.

### F4 — The live diagnostics flow bypassed the abstraction · ✅ RESOLVED
`orchestrator.analyze()` called `llmClient.complete()` directly, so the local-first
/ hybrid / offline machinery never ran for real diagnoses.
**Fix:** image diagnoses now route through `hybridProvider.infer()` (on-device model
first → cloud fallback); text-only stays on `llmClient`. The provider was extended to
honor a caller-supplied system prompt / model / token budget so the orchestrator keeps
its strict-JSON schema. Added offline support: an image diagnosis submitted offline is
queued in IndexedDB and replayed on reconnect, landing in Diagnostic History. — commit `b3904dc`

### F5 — Brittle free-text confidence parsing · ✅ RESOLVED (by removal)
`confidenceEngine.parseClaudeOutput` regex-scraped confidence/diagnosis from prose.
Only the dead Path C used it; the orchestrator uses the robust strict-JSON
`diagnosisParser`.
**Fix:** deleted with F1. — commit `1eabfa3`

---

## Post-audit architecture

- **One cloud transport:** `llmClient` (chat, diagnostics, and the vision provider all
  funnel through it).
- **One diagnosis parser:** the orchestrator's strict-JSON `diagnosisParser`.
- **One image-inference path:** `orchestrator → hybridProvider → claudeVisionProvider →
  llmClient`, with `localProvider` (on-device) as the preferred-but-unimplemented first hop.
- **Offline-capable diagnoses:** queued in the vision `offlineQueue`, flushed on reconnect.

Kept intentionally (still live): `models/modelRegistry.js` (seeds MLOps
`mlModelRegistry`), `analytics/visionAnalytics.js` (MLOps `performanceTracker`), the
`inference/` provider tree, `offlineQueue`, and the image utils.

---

## Open follow-ups

- **F3b** — rename provider `id` `claude-vision → cloudVision` (cosmetic).
- **F6** — wire a real on-device model into `localProvider` (TF.js/ONNX). Seams are
  ready; today it reports unavailable and the hybrid falls straight to cloud.
- **Verification gap** — full end-to-end AI diagnosis not yet exercised in production
  (needs the deployed serverless API + a logged-in session). Build, module-graph load,
  and domain-validation paths are verified locally.

## Verification performed
- `vite build` passes after each change.
- Runtime module-graph load checked in-browser (orchestrator / hybridProvider /
  offlineQueue / claudeVisionProvider resolve; `imagePipeline` no longer exports
  `visionPipeline`).
- Grep confirms no dangling references to deleted modules.
