import { useState, useEffect, useCallback, useRef } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, ErrorState, Spinner, BottomSheet, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { farmSpaceApi } from "../../services/farmSpace/farmSpaceApi.js";
import { useFarmPoll } from "../../hooks/useFarmPoll.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";
import { REACTION_EMOJI, OWN_DELETE_WINDOW_MS } from "../../../api/_lib/farm/chat.js";

/* Farm chat.

   One channel per Farm Space, and the only part of Farm Space not narrowed by
   role — a channel where the workers cannot see each other would not be a
   conversation.

   New messages arrive by polling — faster while this one screen is open
   (4s) than the 15s baseline every other Farm Space screen uses, since a
   chat is the one place where that gap is actually felt. The poll also now
   catches MUTATIONS to existing messages (a reaction, an edit, a pin, a
   delete), not only brand new rows: the server filters on updated_at, and
   results are merged into local state by id rather than assumed to all be
   new — see poll() below.

   Sending is optimistic: the message appears immediately marked as sending,
   and either settles or is marked failed with a retry. On a rural connection
   the alternative is a keyboard that seems to swallow what you typed. */

const OUTBOX_SENDING = "sending";
const OUTBOX_FAILED = "failed";

/* The newest point in time this session has accurate information for —
   the max updated_at across a batch, not just the last item's created_at.
   An older message can have a newer updated_at (a reaction just landed on
   it), and the poll's `since` must not miss that. */
function cursorFrom(list, current) {
  return list.reduce((max, m) => ((m.updated_at || "") > max ? m.updated_at : max), current || "");
}

/* Merge-by-id: replace a message already held (its content changed) rather
   than dropping the update or appending a duplicate; append anything new.
   Existing positions are preserved, so an old message updated by a reaction
   does not jump to the bottom of the conversation. */
/* A sender's name, or the best fallback available — phone, then their
   permanent AgriOS User ID — mirroring farmSpaceService.displayName() and
   the server's own bestName(). A provider that never supplied a display
   name is not a rare case, and leaving the sender line blank is exactly as
   confusing as showing the generic word "Member" everywhere else. */
function senderName(m) {
  return m?.sender_name || m?.sender_phone || m?.sender_agrios_id || null;
}

function mergeMessages(prev, incoming) {
  const byId = new Map(prev.map((m) => [m.id, m]));
  const appended = [];
  for (const m of incoming) {
    if (byId.has(m.id)) byId.set(m.id, m);
    else appended.push(m);
  }
  return [...prev.map((m) => byId.get(m.id)), ...appended];
}

export default function FarmSpaceChat() {
  const { pop, tc, toast } = useApp();
  const [space, setSpace] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState([]);     // optimistic, not yet acknowledged
  const [draft, setDraft] = useState("");
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);

  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [actionsFor, setActionsFor] = useState(null);   // message showing its action sheet
  const [pinned, setPinned] = useState([]);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { message, forEveryone }

  const bottomRef = useRef(null);
  const newestRef = useRef(null);                 // timestamp cursor for polling

  /* Only the INITIAL page is cached — polling below is untouched in spirit,
     still an incremental `since` fetch while the screen is open. */
  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);

      const cached = farmSpaceService.peekChatInitial(active.id);
      let paintedFromCache = false;
      if (cached) {
        setMessages(cached);
        newestRef.current = cursorFrom(cached, null) || null;
        setState("ready");
        paintedFromCache = true;
      } else {
        setState("loading");
      }

      try {
        const list = await farmSpaceService.chatInitial(active.id, { fresh: true });
        setMessages(list);
        newestRef.current = cursorFrom(list, null) || null;
        setState("ready");
      } catch (err) {
        /* A cache that is truthy but genuinely empty must not let a failing
           background refresh hide behind it silently — see FarmSpaceTasks.jsx
           for the full reasoning. Polling would likely correct this within a
           few seconds anyway, but if the SAME failure is also breaking
           polling, silence here would mean a broken chat with no signal at
           all that anything is wrong. */
        if (!paintedFromCache) throw err;
        toast(farmErrorText(err?.reason, tc), "error");
      }

      farmSpaceApi.listPinnedMessages(active.id).then(setPinned).catch(() => {});
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, [tc, toast]);

  useEffect(() => { load(); }, [load]);

  const poll = useCallback(async () => {
    if (!space) return;
    const fresh = await farmSpaceApi.listMessages(space.id, { since: newestRef.current, limit: 50 });
    if (!fresh.length) return;
    setMessages((prev) => mergeMessages(prev, fresh));
    newestRef.current = cursorFrom(fresh, newestRef.current);
    /* Keeps the cache in step with what polling just showed, so leaving and
       reopening chat does not show stale reactions/edits for a moment. */
    farmSpaceService.appendChatMessages(space.id, fresh);
  }, [space]);

  /* Faster than the 15s every other Farm Space screen polls at — chat is the
     one place a several-second gap is actually noticeable. useFarmPoll
     already stops entirely while the tab is hidden. */
  useFarmPoll(poll, { intervalMs: 4000, enabled: state === "ready" && !!space });

  /* Follow the conversation as it grows, the way a chat should. */
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, pending.length]);

  const patchLocal = (updated) => {
    setMessages((prev) => mergeMessages(prev, [updated]));
    farmSpaceService.appendChatMessages(space.id, [updated]);
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || !space) return;

    if (editing) {
      const id = editing.id;
      setEditing(null); setDraft("");
      try {
        patchLocal(await farmSpaceApi.editMessage(space.id, id, body));
      } catch (err) {
        toast(err?.status === 400 || err?.status === 403 || err?.status === 409
          ? err.message : farmErrorText(err?.reason, tc), "error");
      }
      return;
    }

    const parentMessageId = replyTo?.id || null;
    const replyPreview = replyTo;
    setReplyTo(null);

    const localId = `local-${Date.now()}`;
    setPending((p) => [...p, { localId, body, state: OUTBOX_SENDING, replyPreview }]);
    setDraft("");

    try {
      const saved = await farmSpaceApi.sendMessage(space.id, { body, parentMessageId });
      setPending((p) => p.filter((x) => x.localId !== localId));
      setMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]));
      newestRef.current = cursorFrom([saved], newestRef.current);
      farmSpaceService.appendChatMessages(space.id, [saved]);
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
      const saved = await farmSpaceApi.sendMessage(space.id, { body: item.body, parentMessageId: item.replyPreview?.id || null });
      setPending((p) => p.filter((x) => x.localId !== item.localId));
      setMessages((prev) => [...prev, saved]);
      newestRef.current = cursorFrom([saved], newestRef.current);
      farmSpaceService.appendChatMessages(space.id, [saved]);
    } catch {
      setPending((p) => p.map((x) => (x.localId === item.localId ? { ...x, state: OUTBOX_FAILED } : x)));
    }
  };

  const mine = (m) => m.sender_user_id === space?.user_id;
  const canModerate = farmSpaceService.can(space, "farm.members.manage");
  const withinEditWindow = (m) => Date.now() - new Date(m.created_at).getTime() < OWN_DELETE_WINDOW_MS;
  const canEditOwn = (m) => mine(m) && !m.deleted && withinEditWindow(m);
  const canDeleteForEveryone = (m) => !m.deleted && (canModerate || (mine(m) && withinEditWindow(m)));

  const openActions = (m) => { if (!m.deleted) setActionsFor(m); };
  const closeActions = () => setActionsFor(null);

  const doReply = (m) => { setReplyTo(m); setEditing(null); closeActions(); };
  const doStartEdit = (m) => { setEditing(m); setDraft(m.body || ""); setReplyTo(null); closeActions(); };
  const doCancelCompose = () => { setEditing(null); setReplyTo(null); setDraft(""); };

  const doCopy = async (m) => {
    closeActions();
    try {
      await navigator.clipboard.writeText(m.body || "");
      toast(tc({ en: "Copied", hi: "कॉपी हो गया", bn: "কপি হয়েছে" }), "success");
    } catch { /* clipboard permission denied — not worth surfacing as an error */ }
  };

  const doReact = async (m, emoji) => {
    closeActions();
    const mineReaction = m.reactions?.find((r) => r.user_id === space.user_id);
    try {
      const updated = mineReaction?.emoji === emoji
        ? await farmSpaceApi.removeReaction(space.id, m.id)
        : await farmSpaceApi.reactToMessage(space.id, m.id, emoji);
      patchLocal(updated);
    } catch (err) { toast(farmErrorText(err?.reason, tc), "error"); }
  };

  const doPin = async (m) => {
    closeActions();
    try {
      const updated = await farmSpaceApi.pinMessage(space.id, m.id);
      patchLocal(updated);
      setPinned((list) => (list.some((p) => p.id === updated.id) ? list : [updated, ...list]));
    } catch (err) { toast(farmErrorText(err?.reason, tc), "error"); }
  };

  const doUnpin = async (m) => {
    closeActions();
    try {
      await farmSpaceApi.unpinMessage(space.id, m.id);
      const updated = { ...m, pinned_at: null, pinned_by: null };
      patchLocal(updated);
      setPinned((list) => list.filter((p) => p.id !== m.id));
    } catch (err) { toast(farmErrorText(err?.reason, tc), "error"); }
  };

  const doDeleteForMe = async (m) => {
    closeActions();
    try {
      await farmSpaceApi.hideMessage(space.id, m.id);
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err) { toast(farmErrorText(err?.reason, tc), "error"); }
  };

  const doDeleteForEveryone = async (m) => {
    closeActions();
    try {
      await farmSpaceApi.removeMessage(space.id, m.id);
      patchLocal({ ...m, deleted: true, body: null, attachments: [], reactions: [], reply_to: null });
      setPinned((list) => list.filter((p) => p.id !== m.id));
    } catch (err) {
      toast(err?.status === 409 ? err.message : farmErrorText(err?.reason, tc), "error");
    }
  };

  const title = tc({ en: "Farm chat", hi: "फ़ार्म चैट", bn: "খামার চ্যাট" });

  if (state === "loading") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  }
  if (state === "error") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;
  }

  const composerHeight = (replyTo || editing) ? 132 : 76;

  return (
    <>
      <AppBar title={title} onBack={pop} />

      {pinned.length > 0 && (
        <button onClick={() => setPinnedOpen(true)}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
            background: T.primarySoft, border: "none", borderBottom: `1px solid ${T.line}`,
            cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
          <Icon name="Pin" size={14} style={{ color: T.primary, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: T.primary, fontWeight: 600, flex: 1, minWidth: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {pinned[0].body || tc({ en: "Pinned message", hi: "पिन किया संदेश", bn: "পিন করা বার্তা" })}
          </span>
          {pinned.length > 1 && (
            <span style={{ fontSize: 11, color: T.primary, fontWeight: 700, flexShrink: 0 }}>+{pinned.length - 1}</span>
          )}
        </button>
      )}

      {/* Bottom padding clears the composer, which sits 76px above the
         bottom nav — plus extra when a reply/edit banner adds to its
         height, so the last message is never hidden behind either. */}
      <div style={{ padding: `8px 16px calc(${96 + composerHeight}px + env(safe-area-inset-bottom))`,
        display: "flex", flexDirection: "column", gap: 8 }}>
        {!messages.length && !pending.length && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: T.inkSoft, fontSize: 13.5, lineHeight: 1.6 }}>
            {tc({ en: "No messages yet. Anything you write here is seen by everyone in this Farm Space — and by nobody outside it.",
                  hi: "अभी कोई संदेश नहीं। यहाँ आप जो लिखेंगे वह इस फ़ार्म स्पेस के सभी लोग देखेंगे — बाहर कोई नहीं।",
                  bn: "এখনও কোনও বার্তা নেই। এখানে যা লিখবেন তা এই ফার্ম স্পেসের সবাই দেখবে — বাইরের কেউ নয়।" })}
          </div>
        )}

        {messages.map((m) => (
          <Bubble key={m.id} m={m} own={mine(m)} myUserId={space?.user_id} tc={tc}
            onOpen={() => openActions(m)} onReact={(emoji) => doReact(m, emoji)} />
        ))}

        {pending.map((p) => (
          <Bubble key={p.localId} own
            m={{ body: p.body, sender_name: null, created_at: null, reply_to: p.replyPreview
              ? { sender_name: senderName(p.replyPreview), body: p.replyPreview.body, deleted: p.replyPreview.deleted }
              : null }}
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

      {/* composer — the bottom nav is always rendered (ScreenRouter.jsx) and
         sits at bottom:0 with z-index:30, so the composer must clear its
         height rather than out-stack it. 76px is the value this app already
         uses for that (UpdateBanner.jsx positions the same way). */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(76px + env(safe-area-inset-bottom))",
        zIndex: 20, background: T.surface, borderTop: `1px solid ${T.line}` }}>
        {(replyTo || editing) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
            borderBottom: `1px solid ${T.lineSoft}`, background: T.surface2 }}>
            <div style={{ width: 3, alignSelf: "stretch", background: T.primary, borderRadius: 2, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.primary }}>
                {editing
                  ? tc({ en: "Editing", hi: "संपादन", bn: "সম্পাদনা" })
                  : tc({ en: `Replying to ${senderName(replyTo) || ""}`, hi: `${senderName(replyTo) || ""} को उत्तर`, bn: `${senderName(replyTo) || ""}-কে উত্তর` })}
              </div>
              <div style={{ fontSize: 12, color: T.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {(editing || replyTo)?.body}
              </div>
            </div>
            <button onClick={doCancelCompose} aria-label={tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" })}
              style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4, display: "flex" }}>
              <Icon name="X" size={16} />
            </button>
          </div>
        )}
        <div style={{ padding: "10px 12px", display: "flex", gap: 9, alignItems: "flex-end" }}>
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
            <Icon name={editing ? "Check" : "Send"} size={18} />
          </button>
        </div>
      </div>

      <BottomSheet open={!!actionsFor} onClose={closeActions}
        title={tc({ en: "Message", hi: "संदेश", bn: "বার্তা" })}>
        {actionsFor && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", gap: 8, padding: "4px 0 12px", justifyContent: "center" }}>
              {REACTION_EMOJI.map((e) => (
                <button key={e} onClick={() => doReact(actionsFor, e)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, padding: 4,
                    borderRadius: 10, lineHeight: 1 }}>
                  {e}
                </button>
              ))}
            </div>
            <ActionRow icon="CornerUpLeft" label={tc({ en: "Reply", hi: "उत्तर दें", bn: "উত্তর দিন" })} onClick={() => doReply(actionsFor)} />
            <ActionRow icon="Copy" label={tc({ en: "Copy", hi: "कॉपी", bn: "কপি" })} onClick={() => doCopy(actionsFor)} />
            {canEditOwn(actionsFor) && (
              <ActionRow icon="Pencil" label={tc({ en: "Edit", hi: "संपादित करें", bn: "সম্পাদনা" })} onClick={() => doStartEdit(actionsFor)} />
            )}
            {canModerate && !actionsFor.pinned_at && (
              <ActionRow icon="Pin" label={tc({ en: "Pin", hi: "पिन करें", bn: "পিন করুন" })} onClick={() => doPin(actionsFor)} />
            )}
            {canModerate && actionsFor.pinned_at && (
              <ActionRow icon="PinOff" label={tc({ en: "Unpin", hi: "अनपिन करें", bn: "আনপিন করুন" })} onClick={() => doUnpin(actionsFor)} />
            )}
            <ActionRow icon="UserX" label={tc({ en: "Delete for me", hi: "मेरे लिए हटाएँ", bn: "আমার জন্য মুছুন" })}
              onClick={() => { setConfirmDelete({ message: actionsFor, forEveryone: false }); closeActions(); }} />
            {canDeleteForEveryone(actionsFor) && (
              <ActionRow icon="Trash2" danger label={tc({ en: "Delete for everyone", hi: "सभी के लिए हटाएँ", bn: "সবার জন্য মুছুন" })}
                onClick={() => { setConfirmDelete({ message: actionsFor, forEveryone: true }); closeActions(); }} />
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={pinnedOpen} onClose={() => setPinnedOpen(false)}
        title={tc({ en: "Pinned messages", hi: "पिन किए संदेश", bn: "পিন করা বার্তা" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!pinned.length ? (
            <div style={{ fontSize: 13, color: T.inkSoft, textAlign: "center", padding: "12px 0" }}>
              {tc({ en: "Nothing pinned yet.", hi: "अभी कुछ पिन नहीं है।", bn: "এখনও কিছু পিন করা নেই।" })}
            </div>
          ) : pinned.map((m) => (
            <Card key={m.id} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft }}>{senderName(m)}</div>
              <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.45 }}>{m.body}</div>
            </Card>
          ))}
        </div>
      </BottomSheet>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        title={confirmDelete?.forEveryone
          ? tc({ en: "Delete for everyone?", hi: "सभी के लिए हटाएँ?", bn: "সবার জন্য মুছবেন?" })
          : tc({ en: "Delete for me?", hi: "मेरे लिए हटाएँ?", bn: "আমার জন্য মুছবেন?" })}
        body={confirmDelete?.forEveryone
          ? tc({ en: "This removes the message for everyone in this Farm Space.",
                 hi: "यह संदेश इस फ़ार्म स्पेस के सभी लोगों के लिए हटा देगा।",
                 bn: "এটি এই ফার্ম স্পেসের সবার জন্য বার্তাটি মুছে দেবে।" })
          : tc({ en: "This only removes it from your own view — others will still see it.",
                 hi: "यह केवल आपके लिए हटेगा — बाकी लोग इसे देखते रहेंगे।",
                 bn: "এটি শুধু আপনার দৃষ্টি থেকে সরবে — অন্যরা এটি দেখতেই থাকবেন।" })}
        icon="Trash2" danger
        confirmLabel={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
        cancelLabel={tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" })}
        onConfirm={() => (confirmDelete.forEveryone ? doDeleteForEveryone(confirmDelete.message) : doDeleteForMe(confirmDelete.message))} />
    </>
  );
}

function ActionRow({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 8px",
        background: "none", border: "none", cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
      <Icon name={icon} size={18} style={{ color: danger ? T.red : T.inkSoft }} />
      <span style={{ fontSize: 14.5, fontWeight: 500, color: danger ? T.red : T.ink }}>{label}</span>
    </button>
  );
}

function Bubble({ m, own, myUserId, tc, footer, onOpen, onReact }) {
  const time = m.created_at
    ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  if (m.deleted) {
    return (
      <div style={{ display: "flex", justifyContent: own ? "flex-end" : "flex-start" }}>
        <div style={{ maxWidth: "82%", padding: "9px 12px", borderRadius: 16,
          background: T.surface2, fontSize: 13, fontStyle: "italic", color: T.inkFaint,
          display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="Trash2" size={13} />
          {tc({ en: "This message was deleted", hi: "यह संदेश हटा दिया गया", bn: "এই বার্তাটি মুছে ফেলা হয়েছে" })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: own ? "flex-end" : "flex-start" }}>
      <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", gap: 3,
        alignItems: own ? "flex-end" : "flex-start" }}>
        {!own && senderName(m) && (
          <div style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft, padding: "0 4px" }}>{senderName(m)}</div>
        )}
        <button onClick={onOpen} disabled={!onOpen}
          style={{ background: "none", border: "none", padding: 0, cursor: onOpen ? "pointer" : "default",
            display: "block", textAlign: "inherit", font: "inherit", color: "inherit" }}>
          <div style={{ background: own ? T.primary : T.surface2, color: own ? "#fff" : T.ink,
            borderRadius: 16, padding: "9px 12px", fontSize: 14, lineHeight: 1.45, textAlign: "left" }}>
            {m.reply_to && (
              <div style={{ borderLeft: `3px solid ${own ? "rgba(255,255,255,.6)" : T.primary}`, paddingLeft: 8, marginBottom: 5,
                opacity: .85 }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{m.reply_to.sender_name}</div>
                <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.reply_to.deleted
                    ? tc({ en: "Original message deleted", hi: "मूल संदेश हटाया गया", bn: "মূল বার্তা মুছে ফেলা হয়েছে" })
                    : (m.reply_to.body || tc({ en: "Attachment", hi: "अनुलग्नक", bn: "সংযুক্তি" }))}
                </div>
              </div>
            )}
            <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</span>
          </div>
        </button>

        {m.reactions?.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {groupReactions(m.reactions, myUserId).map(({ emoji, count, mine: isMine }) => (
              <button key={emoji} onClick={() => onReact?.(emoji)}
                style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 99,
                  border: `1px solid ${isMine ? T.primary : T.line}`, background: isMine ? T.primarySoft : T.surface,
                  cursor: onReact ? "pointer" : "default", fontSize: 12 }}>
                <span>{emoji}</span>
                {count > 1 && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft }}>{count}</span>}
              </button>
            ))}
          </div>
        )}

        {m.task_title && (
          <div style={{ fontSize: 11, color: T.inkSoft, padding: "0 4px", display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="ClipboardList" size={11} /> {m.task_title}
          </div>
        )}
        <div style={{ padding: "0 4px", display: "flex", alignItems: "center", gap: 5 }}>
          {footer ?? (
            <>
              {m.pinned_at && <Icon name="Pin" size={10} style={{ color: T.inkFaint }} />}
              <span style={{ fontSize: 10.5, color: T.inkFaint }}>
                {time}{m.edited_at ? ` · ${tc({ en: "edited", hi: "संपादित", bn: "সম্পাদিত" })}` : ""}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* One reaction per member (server-enforced) — grouped here purely for
   display, so "3 people picked 👍" reads as one pill, not three. `mine`
   marks the pill the viewer tapped, whichever emoji it turned out to be. */
function groupReactions(reactions, myUserId) {
  const order = [];
  const byEmoji = new Map();
  for (const r of reactions) {
    if (!byEmoji.has(r.emoji)) { byEmoji.set(r.emoji, { emoji: r.emoji, count: 0, mine: false }); order.push(r.emoji); }
    const g = byEmoji.get(r.emoji);
    g.count += 1;
    if (r.user_id === myUserId) g.mine = true;
  }
  return order.map((e) => byEmoji.get(e));
}
