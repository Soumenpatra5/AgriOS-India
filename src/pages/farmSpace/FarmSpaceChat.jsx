import { useState, useEffect, useCallback, useRef } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, ErrorState, Spinner } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { farmSpaceApi } from "../../services/farmSpace/farmSpaceApi.js";
import { useFarmPoll } from "../../hooks/useFarmPoll.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

/* Farm chat.

   One channel per Farm Space, and the only part of Farm Space not narrowed by
   role — a channel where the workers cannot see each other would not be a
   conversation.

   New messages arrive by polling while the screen is open; the hook stops
   while the tab is hidden. Sending is optimistic: the message appears
   immediately marked as sending, and either settles or is marked failed with a
   retry. On a rural connection the alternative is a keyboard that seems to
   swallow what you typed. */

const OUTBOX_SENDING = "sending";
const OUTBOX_FAILED = "failed";

export default function FarmSpaceChat() {
  const { pop, tc } = useApp();
  const [space, setSpace] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState([]);     // optimistic, not yet acknowledged
  const [draft, setDraft] = useState("");
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);

  const bottomRef = useRef(null);
  const newestRef = useRef(null);                 // timestamp cursor for polling

  const load = useCallback(async () => {
    setState("loading");
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const list = await farmSpaceApi.listMessages(active.id, { limit: 50 });
      setMessages(list);
      newestRef.current = list.at(-1)?.created_at ?? null;
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Only what arrived since the last message we hold, so a quiet farm costs
     one empty response rather than the whole history every fifteen seconds. */
  const poll = useCallback(async () => {
    if (!space) return;
    const fresh = await farmSpaceApi.listMessages(space.id, { since: newestRef.current, limit: 50 });
    if (!fresh.length) return;
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const added = fresh.filter((m) => !known.has(m.id));
      return added.length ? [...prev, ...added] : prev;
    });
    newestRef.current = fresh.at(-1).created_at;
  }, [space]);

  useFarmPoll(poll, { intervalMs: 15000, enabled: state === "ready" && !!space });

  /* Follow the conversation as it grows, the way a chat should. */
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, pending.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !space) return;

    const localId = `local-${Date.now()}`;
    setPending((p) => [...p, { localId, body, state: OUTBOX_SENDING }]);
    setDraft("");

    try {
      const saved = await farmSpaceApi.sendMessage(space.id, { body });
      setPending((p) => p.filter((x) => x.localId !== localId));
      setMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]));
      newestRef.current = saved.created_at;
    } catch {
      /* Kept on screen and marked, rather than vanishing. The farmer decides
         whether to retry; nothing is silently re-sent hours later, which for a
         message like "storm tonight, secure the feed" would be worse than not
         sending it at all. */
      setPending((p) => p.map((x) => (x.localId === localId ? { ...x, state: OUTBOX_FAILED } : x)));
    }
  };

  const retry = async (item) => {
    setPending((p) => p.map((x) => (x.localId === item.localId ? { ...x, state: OUTBOX_SENDING } : x)));
    try {
      const saved = await farmSpaceApi.sendMessage(space.id, { body: item.body });
      setPending((p) => p.filter((x) => x.localId !== item.localId));
      setMessages((prev) => [...prev, saved]);
      newestRef.current = saved.created_at;
    } catch {
      setPending((p) => p.map((x) => (x.localId === item.localId ? { ...x, state: OUTBOX_FAILED } : x)));
    }
  };

  const title = tc({ en: "Farm chat", hi: "फ़ार्म चैट", bn: "খামার চ্যাট" });

  if (state === "loading") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  }
  if (state === "error") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState message={farmErrorText(reason, tc)} onRetry={load} /></div></>;
  }

  const mine = (m) => m.sender_user_id === space?.user_id;

  return (
    <>
      <AppBar title={title} onBack={pop} />

      <div style={{ padding: "8px 16px 96px", display: "flex", flexDirection: "column", gap: 8 }}>
        {!messages.length && !pending.length && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: T.inkSoft, fontSize: 13.5, lineHeight: 1.6 }}>
            {tc({ en: "No messages yet. Anything you write here is seen by everyone in this Farm Space — and by nobody outside it.",
                  hi: "अभी कोई संदेश नहीं। यहाँ आप जो लिखेंगे वह इस फ़ार्म स्पेस के सभी लोग देखेंगे — बाहर कोई नहीं।",
                  bn: "এখনও কোনও বার্তা নেই। এখানে যা লিখবেন তা এই ফার্ম স্পেসের সবাই দেখবে — বাইরের কেউ নয়।" })}
          </div>
        )}

        {messages.map((m) => <Bubble key={m.id} m={m} own={mine(m)} tc={tc} />)}

        {pending.map((p) => (
          <Bubble key={p.localId} own
            m={{ body: p.body, sender_name: null, created_at: null }}
            tc={tc}
            footer={p.state === OUTBOX_FAILED
              ? <button onClick={() => retry(p)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                    color: T.red, fontSize: 11, fontWeight: 600, fontFamily: T.body }}>
                  {tc({ en: "Not sent · Retry", hi: "नहीं भेजा · फिर कोशिश", bn: "পাঠানো হয়নি · আবার চেষ্টা" })}
                </button>
              : <span style={{ fontSize: 11, color: T.inkFaint }}>
                  {tc({ en: "Sending…", hi: "भेजा जा रहा है…", bn: "পাঠানো হচ্ছে…" })}
                </span>} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: T.surface,
        borderTop: `1px solid ${T.line}`, padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
        display: "flex", gap: 9, alignItems: "flex-end" }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder={tc({ en: "Message your team…", hi: "टीम को संदेश…", bn: "দলকে বার্তা…" })}
          aria-label={tc({ en: "Message", hi: "संदेश", bn: "বার্তা" })}
          style={{ flex: 1, resize: "none", maxHeight: 120, padding: "10px 12px", borderRadius: 14,
            border: `1px solid ${T.line}`, background: T.surface2, color: T.ink,
            fontFamily: T.body, fontSize: 14.5, lineHeight: 1.4, outline: "none" }} />
        <button onClick={send} disabled={!draft.trim()}
          aria-label={tc({ en: "Send", hi: "भेजें", bn: "পাঠান" })}
          style={{ width: 42, height: 42, borderRadius: 999, flexShrink: 0, border: "none",
            background: draft.trim() ? T.primary : T.surface2,
            color: draft.trim() ? "#fff" : T.inkFaint,
            cursor: draft.trim() ? "pointer" : "default", display: "grid", placeItems: "center" }}>
          <Icon name="Send" size={18} />
        </button>
      </div>
    </>
  );
}

function Bubble({ m, own, tc, footer }) {
  const time = m.created_at
    ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  return (
    <div style={{ display: "flex", justifyContent: own ? "flex-end" : "flex-start" }}>
      <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", gap: 3,
        alignItems: own ? "flex-end" : "flex-start" }}>
        {!own && m.sender_name && (
          <div style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft, padding: "0 4px" }}>{m.sender_name}</div>
        )}
        <div style={{ background: own ? T.primary : T.surface2, color: own ? "#fff" : T.ink,
          borderRadius: 16, padding: "9px 12px", fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap",
          wordBreak: "break-word" }}>
          {m.body}
        </div>
        {m.task_title && (
          <div style={{ fontSize: 11, color: T.inkSoft, padding: "0 4px", display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="ClipboardList" size={11} /> {m.task_title}
          </div>
        )}
        <div style={{ padding: "0 4px" }}>
          {footer ?? <span style={{ fontSize: 10.5, color: T.inkFaint }}>{time}</span>}
        </div>
      </div>
    </div>
  );
}
