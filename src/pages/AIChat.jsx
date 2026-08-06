import { useEffect, useRef, useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import Markdown from "../components/markdown.jsx";
import { AppBar, IconTile, BottomSheet, Dialog, EmptyState, accent } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { useAI, conversationStore, voice, getAgent } from "../ai/index.js";
import { textOf } from "../ai/models/message.js";
import { DISCLAIMERS } from "../i18n/strings.js";
import CameraCapture from "../components/CameraCapture.jsx";
import { compressImage, toImageBlock } from "../ai/vision/imagePipeline.js";
import { shareText, canShare } from "../utils/share.js";

const QUICK_TEMPLATES = [
  { cat: { en: "Today's plan", hi: "आज की योजना", bn: "আজকের পরিকল্পনা" },
    text: { en: "What should I do on my farm today?", hi: "आज खेत में क्या काम करूँ?", bn: "আজ খামারে কী কাজ করব?" } },
  { cat: { en: "Diagnose", hi: "रोग पहचान", bn: "রোগ নির্ণয়" },
    text: { en: "My crop leaves are turning yellow, what could be wrong?", hi: "मेरी फसल की पत्तियाँ पीली हो रही हैं, क्या समस्या हो सकती है?", bn: "আমার ফসলের পাতা হলুদ হয়ে যাচ্ছে, কী সমস্যা হতে পারে?" } },
  { cat: { en: "Government schemes", hi: "सरकारी योजनाएँ", bn: "সরকারি প্রকল্প" },
    text: { en: "Which government schemes can I apply for?", hi: "मुझे कौन सी सरकारी योजनाएँ मिल सकती हैं?", bn: "আমি কোন কোন সরকারি প্রকল্পের সুবিধা পেতে পারি?" } },
  { cat: { en: "Market price", hi: "बाज़ार भाव", bn: "বাজার দর" },
    text: { en: "What is the best time to sell my crop?", hi: "मेरी फसल बेचने का सबसे अच्छा समय कब है?", bn: "আমার ফসল বিক্রির সেরা সময় কখন?" } },
  { cat: { en: "Loan help", hi: "ऋण सहायता", bn: "ঋণ সহায়তা" },
    text: { en: "How do I apply for a Kisan Credit Card loan?", hi: "किसान क्रेडिट कार्ड ऋण के लिए कैसे आवेदन करूँ?", bn: "কিষান ক্রেডিট কার্ড ঋণের জন্য কীভাবে আবেদন করব?" } },
];

export default function AIChat({ agentId = null, conversationId = null }) {
  const { t, lang, pop, toast } = useApp();
  const ai = useAI({ agentId, conversationId, lang });
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [cameraOpen, setCameraOpen]     = useState(false);
  const [historyOpen, setHistoryOpen]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const endRef = useRef(null);
  const sttRef = useRef(null);

  const agent = ai.agent || (agentId ? getAgent(agentId) : null);
  const c = accent(agent?.accent || "primary");

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [ai.messages, ai.streamText, ai.busy]);
  useEffect(() => () => sttRef.current?.stop(), []);

  const send = (text) => {
    const q = (text ?? input).trim();
    if (!q || ai.busy) return;
    const blocks = pendingImage ? [pendingImage.block] : [];
    setPendingImage(null); setInput("");
    ai.send(q, blocks);
  };

  const mic = () => {
    if (!voice.sttSupported) { toast(t("voiceUnsupported")); return; }
    if (listening) { sttRef.current?.stop(); return; }
    setListening(true);
    sttRef.current = voice.listen({
      lang,
      onResult: (text) => setInput(text),
      onEnd: () => setListening(false),
      onError: () => { setListening(false); toast(t("voiceUnsupported")); },
    });
  };

  const attach = () => setCameraOpen(true);

  const handleCapture = async (file) => {
    setCameraOpen(false);
    try {
      const compressed = await compressImage(file);
      setPendingImage({ block: toImageBlock(compressed), meta: compressed });
      toast(t("imageAttached"), "success");
    } catch { toast(t("imageFailed"), "error"); }
  };

  const errorText = ai.error
    ? (ai.error.code === "rate-limit"
        ? `${t("aiRateLimited")} (${ai.error.retryInSec}s)`
        : `${t("aiError")}${ai.error.message ? ` — ${ai.error.message}` : ""}`)
    : null;

  return (
    <>
      <AppBar
        title={agent ? agent.name : t("aiTitle")}
        onBack={pop}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <HeaderBtn icon="RotateCcw" label={t("newChat")} onClick={ai.reset} />
            <HeaderBtn icon="Inbox" label={t("chatHistory")} onClick={() => setHistoryOpen(true)} />
          </div>
        }
      />

      <div role="log" aria-live="polite" style={{ padding: "4px 16px 150px", animation: "ag-fade .25s var(--ag-ease)" }}>
        {/* agent hero on empty chat */}
        {ai.messages.length === 0 && !ai.busy && (
          <div style={{ textAlign: "center", padding: "26px 12px 10px" }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: c.bg, color: c.fg, display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
              <Icon name={agent?.icon || "Sparkles"} size={30} />
            </div>
            <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 700 }}>{agent ? agent.name : t("aiTitle")}</div>
            <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>{agent?.tagline || t("advisorAuto")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 22 }}>
              {(agent?.suggested || QUICK_TEMPLATES.map((q) => q.text[lang] || q.text.en)).map((q, i) => (
                <button key={i} onClick={() => send(q)}
                  style={{ textAlign: "left", padding: "12px 15px", borderRadius: T.rLg, cursor: "pointer", fontFamily: T.body,
                    background: T.surface, border: `1px solid ${T.line}`, color: T.ink, fontSize: 13.5 }}>
                  {!agent && QUICK_TEMPLATES[i] && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.primary, display: "block", marginBottom: 3 }}>
                      {QUICK_TEMPLATES[i].cat[lang] || QUICK_TEMPLATES[i].cat.en}
                    </span>
                  )}
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* messages */}
        {ai.messages.map((m, i) => (
          <Bubble key={m.id} msg={m}
            onSpeak={(txt) => { setSpeakingId(m.id); voice.speak(txt, lang); const check = setInterval(() => { if (!speechSynthesis.speaking) { setSpeakingId(null); clearInterval(check); } }, 300); }}
            onStop={() => { voice.stopSpeaking(); setSpeakingId(null); }}
            speaking={speakingId === m.id}
            onShare={async (txt) => { const r = await shareText(txt, "AgriOS"); if (r === "copied") toast(t("copied") || "Copied!", "success"); }}
            isLast={i === ai.messages.length - 1 && !ai.busy} onChip={send} />
        ))}

        {/* regenerate — offered after a completed answer */}
        {!ai.busy && ai.messages.length > 0 && ai.messages[ai.messages.length - 1].role === "assistant" && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <button onClick={ai.regenerate}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: T.pill,
                background: T.surface, border: `1px solid ${T.line}`, color: T.inkSoft, cursor: "pointer",
                fontFamily: T.body, fontSize: 12.5, fontWeight: 600 }}>
              <Icon name="RefreshCw" size={13} /> {t("regenerate") || "Regenerate"}
            </button>
          </div>
        )}

        {/* live stream */}
        {ai.busy && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 12 }}>
            <div style={bubbleCss(false)}>
              {ai.streamText
                ? <Markdown text={ai.streamText} />
                : <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: T.inkSoft, fontSize: 13 }}>
                    <Icon name="Sparkles" size={14} style={{ color: T.primary }} />
                    <span style={{ animation: "ag-blink 1.2s infinite" }}>{t("aiThinking")}</span>
                  </span>}
            </div>
          </div>
        )}

        {errorText && (
          <div style={{ marginTop: 12, padding: "11px 14px", borderRadius: T.rMd, background: T.redSoft, color: T.red, fontSize: 13 }}>
            {errorText}
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 11, color: T.inkFaint, marginTop: 16, lineHeight: 1.5 }}>
          {DISCLAIMERS[detectLang(ai.messages, lang)] || DISCLAIMERS.en}
        </div>
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 25, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 460, background: T.bg, borderTop: `1px solid ${T.lineSoft}`, padding: "10px 12px calc(12px + env(safe-area-inset-bottom))" }}>
          {pendingImage && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "6px 10px", borderRadius: T.rMd, background: T.surface2 }}>
              <img src={pendingImage.block.source?.data ? `data:image/jpeg;base64,${pendingImage.block.source.data}` : ""}
                alt="Attached photo" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{t("imageAttached")}</div>
                <div style={{ fontSize: 11, color: T.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pendingImage.meta.name}</div>
              </div>
              <button onClick={() => setPendingImage(null)} aria-label="Remove image" style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 4 }}>
                <Icon name="X" size={16} />
              </button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <ComposerBtn icon="Camera" label={t("attachImage")} onClick={attach} />
            <ComposerBtn icon="Mic" label={t("voiceInput")} onClick={mic} active={listening} />
            <input
              value={listening ? input || t("listening") : input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={t("chatPh")}
              disabled={ai.busy}
              style={{ flex: 1, minWidth: 0, padding: "13px 15px", borderRadius: T.pill, border: `1px solid ${T.line}`,
                background: T.surface, color: T.ink, fontFamily: T.body, fontSize: 14.5, outline: "none" }}
            />
            {ai.busy ? (
              <ComposerBtn icon="X" label={t("stop")} onClick={ai.stop} danger />
            ) : (
              <button onClick={() => send()} disabled={!input.trim()} aria-label={t("send")}
                style={{ width: 46, height: 46, borderRadius: "50%", border: "none", flexShrink: 0, display: "grid", placeItems: "center",
                  cursor: input.trim() ? "pointer" : "default", background: input.trim() ? T.primary : T.line, color: T.onPrimary, transition: "background .18s" }}>
                <Icon name="Send" size={19} strokeWidth={2.3} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* history sheet */}
      <BottomSheet open={historyOpen} onClose={() => setHistoryOpen(false)} title={t("chatHistory")}>
        <HistoryList
          t={t}
          onOpen={(id) => { ai.load(id); setHistoryOpen(false); }}
          onDelete={(id) => setConfirmDelete(id)}
          onExport={(id) => {
            const text = conversationStore.exportText(id);
            const blob = new Blob([text], { type: "text/plain" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "agrios-chat.txt";
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        />
      </BottomSheet>

      {cameraOpen && (
        <CameraCapture onCapture={handleCapture} onCancel={() => setCameraOpen(false)} />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        title={t("deleteChat") + "?"} body={t("deleteChatBody")} icon="Trash2" danger
        confirmLabel={t("deleteChat")} cancelLabel={t("cancel")}
        onConfirm={() => {
          conversationStore.remove(confirmDelete);
          if (confirmDelete === ai.conversationId) ai.reset();
          setConfirmDelete(null);
        }} />
    </>
  );
}

function parseQuickReplies(text) {
  const match = text.match(/---\s*\n(.+)$/m);
  if (!match) return { body: text, chips: [] };
  const chips = match[1].split("|").map((s) => s.trim()).filter(Boolean);
  if (chips.length < 2 || chips.length > 6) return { body: text, chips: [] };
  return { body: text.slice(0, match.index).trimEnd(), chips };
}

function detectLang(messages, appLang) {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return appLang;
  const text = textOf(last);
  if (/[ঀ-৿]/.test(text)) return "bn";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  return appLang;
}

/* ---------- pieces ---------- */

const bubbleCss = (isUser) => ({
  maxWidth: "88%", padding: "11px 14px", fontSize: 14, lineHeight: 1.55,
  background: isUser ? T.primary : T.surface,
  color: isUser ? T.onPrimary : T.ink,
  border: isUser ? "none" : `1px solid ${T.line}`,
  borderRadius: 18,
  borderBottomRightRadius: isUser ? 6 : 18,
  borderBottomLeftRadius: isUser ? 18 : 6,
});

function Bubble({ msg, onSpeak, onStop, speaking, onShare, isLast, onChip }) {
  const isUser = msg.role === "user";
  const rawText = textOf(msg);
  const hasImage = Array.isArray(msg.content) && msg.content.some((b) => b.type === "image");
  const agent = !isUser && msg.agentId ? getAgent(msg.agentId) : null;
  const { body, chips } = !isUser ? parseQuickReplies(rawText) : { body: rawText, chips: [] };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginTop: 12 }}>
      {agent && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: T.inkFaint, marginBottom: 4, paddingLeft: 4 }}>
          <Icon name={agent.icon} size={12} /> {agent.name}
        </div>
      )}
      <div style={{ ...bubbleCss(isUser), animation: "ag-rise .22s var(--ag-ease)" }}>
        {hasImage && (() => {
          const imgBlock = msg.content.find((b) => b.type === "image");
          const src = imgBlock?.source?.data ? `data:image/jpeg;base64,${imgBlock.source.data}` : null;
          return (
            <div style={{ marginBottom: 8 }}>
              {src ? <img src={src} alt="Uploaded image" style={{ width: "100%", maxWidth: 200, borderRadius: 10, display: "block" }} />
                : <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: .8 }}>
                    <Icon name="Camera" size={13} /> 📷
                  </div>}
            </div>
          );
        })()}
        {isUser ? body : <Markdown text={body} />}
      </div>
      {isLast && chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, maxWidth: "88%" }}>
          {chips.map((chip) => (
            <button key={chip} onClick={() => onChip(chip)}
              style={{ padding: "8px 14px", borderRadius: T.pill, border: `1.5px solid ${T.primary}`,
                background: T.surface, color: T.primary, fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: T.body, whiteSpace: "nowrap" }}>
              {chip}
            </button>
          ))}
        </div>
      )}
      {!isUser && body && (
        <div style={{ display: "flex", gap: 2 }}>
          <button onClick={() => speaking ? onStop() : onSpeak(body)} aria-label={speaking ? "Stop reading" : "Read aloud"}
            style={{ background: "none", border: "none", cursor: "pointer",
              color: speaking ? T.primary : T.inkFaint, display: "flex", alignItems: "center", gap: 4,
              fontSize: 11, padding: "5px 4px", fontFamily: T.body,
              animation: speaking ? "ag-pulse 1s infinite" : "none" }}>
            <Icon name={speaking ? "VolumeX" : "Volume2"} size={13} />
          </button>
          {canShare && (
            <button onClick={() => onShare(body)} aria-label="Share"
              style={{ background: "none", border: "none", cursor: "pointer",
                color: T.inkFaint, display: "flex", alignItems: "center",
                fontSize: 11, padding: "5px 4px", fontFamily: T.body }}>
              <Icon name="Share2" size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryList({ t, onOpen, onDelete, onExport }) {
  const [items, setItems] = useState(() => conversationStore.list());
  const [sq, setSq] = useState("");
  const shown = sq.trim() ? conversationStore.search(sq) : items;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ position: "relative" }}>
        <Icon name="Search" size={15} style={{ position: "absolute", left: 10, top: 10, color: T.inkFaint, pointerEvents: "none" }} />
        <input value={sq} onChange={(e) => setSq(e.target.value)} placeholder={t("searchChats") || "Search chats…"}
          style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px 9px 32px", borderRadius: T.rMd, border: `1px solid ${T.line}`,
            background: T.surface2, color: T.ink, fontSize: 13, fontFamily: T.body, outline: "none" }} />
      </div>
      {!shown.length && <EmptyState icon="Inbox" title={sq ? (t("noResults") || "No results") : t("noChats")} body={sq ? "" : t("noChatsBody")} />}
      {shown.map((e) => {
        const agent = e.agentId ? getAgent(e.agentId) : null;
        return (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: T.rLg, background: T.surface2 }}>
            <IconTile name={agent?.icon || "MessageCircle"} a={agent?.accent || "primary"} size={36} iconSize={17} />
            <button onClick={() => onOpen(e.id)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: T.body, padding: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {e.pinned ? "📌 " : ""}{e.title || t("newChat")}
              </div>
              <div style={{ fontSize: 11.5, color: T.inkFaint }}>{new Date(e.updatedAt).toLocaleDateString()}</div>
            </button>
            <RowBtn icon="Star" label={e.pinned ? t("unpin") : t("pin")}
              onClick={() => { conversationStore.setPinned(e.id, !e.pinned); setItems(conversationStore.list()); }} />
            <RowBtn icon="Download" label={t("exportChat")} onClick={() => onExport(e.id)} />
            <RowBtn icon="Trash2" label={t("deleteChat")} onClick={() => onDelete(e.id)} />
          </div>
        );
      })}
    </div>
  );
}

function HeaderBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick} aria-label={label}
      style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8, cursor: "pointer", color: T.ink, display: "flex" }}>
      <Icon name={icon} size={18} />
    </button>
  );
}
function ComposerBtn({ icon, label, onClick, active, danger }) {
  return (
    <button onClick={onClick} aria-label={label}
      style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, cursor: "pointer", display: "grid", placeItems: "center",
        border: `1px solid ${active ? T.primary : T.line}`,
        background: active ? T.primarySoft : danger ? T.redSoft : T.surface,
        color: active ? T.primary : danger ? T.red : T.inkSoft,
        animation: active ? "ag-blink 1.4s infinite" : "none" }}>
      <Icon name={icon} size={19} />
    </button>
  );
}
function RowBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick} aria-label={label}
      style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 5 }}>
      <Icon name={icon} size={16} />
    </button>
  );
}
