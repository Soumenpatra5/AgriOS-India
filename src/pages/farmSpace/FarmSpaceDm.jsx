import { useState, useEffect, useCallback, useRef } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, ErrorState, Spinner, BottomSheet, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { farmSpaceApi } from "../../services/farmSpace/farmSpaceApi.js";
import { useFarmPoll } from "../../hooks/useFarmPoll.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";
import { DM_OWN_DELETE_WINDOW_MS } from "../../../api/_lib/farm/dm.js";
import { Bubble, AttachmentDraftChip, ActionRow } from "./chatBubble.jsx";
import { useAttachmentDrafts } from "./useAttachmentDrafts.js";

/* A 1:1 direct message — a second, separate surface from the shared group
   channel (FarmSpaceChat.jsx). No reply, react, pin, mentions, search, or
   voice recording here yet: this is the structural piece (a private,
   addressable conversation between two members at all), the same
   deliberate scope boundary dm.js's own header comment states. Text and
   file/location attachments both work, on the same upload pipeline the
   group channel uses (uploadChatAttachment is not aware of, or scoped to,
   which conversation a file ends up attached to — only which SPACE, via
   farm.chat.send, exactly like the group channel). */

const OUTBOX_SENDING = "sending";
const OUTBOX_FAILED = "failed";

function cursorFrom(list, current) {
  return list.reduce((max, m) => ((m.updated_at || "") > max ? m.updated_at : max), current || "");
}

/* Same cap as FarmSpaceChat — see the comment there. */
const MESSAGE_CAP = 300;

function mergeMessages(prev, incoming) {
  const byId = new Map(prev.map((m) => [m.id, m]));
  const appended = [];
  for (const m of incoming) {
    if (byId.has(m.id)) byId.set(m.id, m);
    else appended.push(m);
  }
  const merged = [...prev.map((m) => byId.get(m.id)), ...appended];
  return merged.length > MESSAGE_CAP ? merged.slice(-MESSAGE_CAP) : merged;
}

export default function FarmSpaceDm({ otherUserId, otherName }) {
  const { pop, tc, toast } = useApp();
  const [space, setSpace] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState([]);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);

  const [editing, setEditing] = useState(null);
  const [actionsFor, setActionsFor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const attachments = useAttachmentDrafts({ spaceId: space?.id, toast, tc });
  const mediaInputRef = useRef(null);
  const docInputRef = useRef(null);

  const bottomRef = useRef(null);
  const newestRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);

      const conv = await farmSpaceApi.openConversation(active.id, otherUserId);
      setConversation(conv);

      const list = await farmSpaceApi.listDmMessages(active.id, conv.id);
      setMessages(list);
      newestRef.current = cursorFrom(list, null) || null;
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, [otherUserId]);

  useEffect(() => { load(); }, [load]);

  const poll = useCallback(async () => {
    if (!space || !conversation) return;
    const fresh = await farmSpaceApi.listDmMessages(space.id, conversation.id, { since: newestRef.current, limit: 50 });
    if (!fresh.length) return;
    setMessages((prev) => mergeMessages(prev, fresh));
    newestRef.current = cursorFrom(fresh, newestRef.current);
  }, [space, conversation]);

  useFarmPoll(poll, { intervalMs: 4000, enabled: state === "ready" && !!conversation });

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, pending.length]);

  const patchLocal = (updated) => setMessages((prev) => mergeMessages(prev, [updated]));

  const send = async () => {
    const body = draft.trim();

    if (editing) {
      if (!body) return;
      const id = editing.id;
      setEditing(null); setDraft("");
      try {
        patchLocal(await farmSpaceApi.editDm(space.id, conversation.id, id, body));
      } catch (err) {
        toast(err?.status === 400 || err?.status === 403 || err?.status === 409
          ? err.message : farmErrorText(err?.reason, tc), "error");
      }
      return;
    }

    if (!conversation) return;
    if (attachments.attachmentsUploading) {
      toast(tc({ en: "Still uploading — hang on a moment.", hi: "अभी अपलोड हो रहा है — थोड़ा इंतज़ार करें।", bn: "এখনও আপলোড হচ্ছে — একটু অপেক্ষা করুন।" }), "error");
      return;
    }
    if (attachments.hasErroredAttachment) {
      toast(tc({ en: "One attachment failed to upload — retry or remove it before sending.",
                  hi: "एक अनुलग्नक अपलोड नहीं हो सका — भेजने से पहले फिर कोशिश करें या हटाएँ।",
                  bn: "একটি সংযুক্তি আপলোড হয়নি — পাঠানোর আগে আবার চেষ্টা করুন বা সরান।" }), "error");
      return;
    }
    const attachmentsPayload = attachments.payloadFrom(attachments.attachmentDrafts);
    if (!body && !attachmentsPayload.length) return;

    const localId = `local-${Date.now()}`;
    setPending((p) => [...p, { localId, body, attachments: attachmentsPayload, state: OUTBOX_SENDING }]);
    setDraft("");
    attachments.clearDrafts();

    try {
      const saved = await farmSpaceApi.sendDm(space.id, conversation.id, { body, attachments: attachmentsPayload });
      setPending((p) => p.filter((x) => x.localId !== localId));
      setMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]));
      newestRef.current = cursorFrom([saved], newestRef.current);
    } catch {
      setPending((p) => p.map((x) => (x.localId === localId ? { ...x, state: OUTBOX_FAILED } : x)));
    }
  };

  const retry = async (item) => {
    setPending((p) => p.map((x) => (x.localId === item.localId ? { ...x, state: OUTBOX_SENDING } : x)));
    try {
      const saved = await farmSpaceApi.sendDm(space.id, conversation.id, { body: item.body, attachments: item.attachments || [] });
      setPending((p) => p.filter((x) => x.localId !== item.localId));
      setMessages((prev) => [...prev, saved]);
      newestRef.current = cursorFrom([saved], newestRef.current);
    } catch {
      setPending((p) => p.map((x) => (x.localId === item.localId ? { ...x, state: OUTBOX_FAILED } : x)));
    }
  };

  const mine = (m) => m.sender_user_id === space?.user_id;
  const withinEditWindow = (m) => Date.now() - new Date(m.created_at).getTime() < DM_OWN_DELETE_WINDOW_MS;
  const canEditOwn = (m) => mine(m) && !m.deleted && withinEditWindow(m);
  const canDeleteForEveryone = (m) => mine(m) && !m.deleted && withinEditWindow(m);

  const openActions = (m) => { if (!m.deleted) setActionsFor(m); };
  const closeActions = () => setActionsFor(null);

  const doStartEdit = (m) => { setEditing(m); setDraft(m.body || ""); attachments.clearDrafts(); closeActions(); };
  const doCancelCompose = () => { setEditing(null); setDraft(""); attachments.clearDrafts(); };

  const doCopy = async (m) => {
    closeActions();
    try {
      await navigator.clipboard.writeText(m.body || "");
      toast(tc({ en: "Copied", hi: "कॉपी हो गया", bn: "কপি হয়েছে" }), "success");
    } catch { /* clipboard permission denied — not worth surfacing as an error */ }
  };

  const doDeleteForMe = async (m) => {
    closeActions();
    try {
      await farmSpaceApi.hideDm(space.id, conversation.id, m.id);
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err) { toast(farmErrorText(err?.reason, tc), "error"); }
  };

  const doDeleteForEveryone = async (m) => {
    closeActions();
    try {
      await farmSpaceApi.removeDm(space.id, conversation.id, m.id);
      patchLocal({ ...m, deleted: true, body: null, attachments: [] });
    } catch (err) {
      toast(err?.status === 409 || err?.status === 403 ? err.message : farmErrorText(err?.reason, tc), "error");
    }
  };

  const title = otherName || conversation?.other_display_name
    || tc({ en: "Direct message", hi: "सीधा संदेश", bn: "সরাসরি বার্তা" });

  if (state === "loading") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  }
  if (state === "error") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;
  }

  const canSend = editing ? !!draft.trim()
    : (!!draft.trim() || attachments.hasReadyAttachment) && !attachments.attachmentsUploading && !attachments.hasErroredAttachment;
  const composerHeight = 76 + (editing ? 56 : 0) + (attachments.attachmentDrafts.length > 0 ? 72 : 0);

  return (
    <>
      <AppBar title={title} onBack={pop} />

      <div style={{ padding: `8px 16px calc(${96 + composerHeight}px + env(safe-area-inset-bottom))`,
        display: "flex", flexDirection: "column", gap: 8 }}>
        {!messages.length && !pending.length && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: T.inkSoft, fontSize: 13.5, lineHeight: 1.6 }}>
            {tc({ en: "This is private — only the two of you can see it.",
                  hi: "यह निजी है — केवल आप दोनों इसे देख सकते हैं।",
                  bn: "এটি ব্যক্তিগত — শুধু আপনারা দুজনেই এটি দেখতে পাবেন।" })}
          </div>
        )}

        {messages.map((m) => (
          <Bubble key={m.id} m={m} own={mine(m)} tc={tc} onOpen={() => openActions(m)} />
        ))}

        {pending.map((p) => (
          <Bubble key={p.localId} own
            m={{ body: p.body, attachments: p.attachments, sender_name: null, created_at: null }}
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

      <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(76px + env(safe-area-inset-bottom))",
        zIndex: 20, background: T.surface, borderTop: `1px solid ${T.line}` }}>
        {editing && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
            borderBottom: `1px solid ${T.lineSoft}`, background: T.surface2 }}>
            <div style={{ width: 3, alignSelf: "stretch", background: T.primary, borderRadius: 2, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.primary }}>
                {tc({ en: "Editing", hi: "संपादन", bn: "সম্পাদনা" })}
              </div>
              <div style={{ fontSize: 12, color: T.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {editing.body}
              </div>
            </div>
            <button onClick={doCancelCompose} aria-label={tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" })}
              style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4, display: "flex" }}>
              <Icon name="X" size={16} />
            </button>
          </div>
        )}

        {attachments.attachmentDrafts.length > 0 && (
          <div style={{ display: "flex", gap: 8, padding: "8px 12px 0", overflowX: "auto" }}>
            {attachments.attachmentDrafts.map((d) => (
              <AttachmentDraftChip key={d.localId} draft={d} tc={tc}
                onRemove={() => attachments.removeDraft(d.localId)} onRetry={attachments.retryDraft} />
            ))}
          </div>
        )}

        <input ref={mediaInputRef} type="file" accept="image/*,video/*" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) attachments.addFileDraft(f); }} />
        <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) attachments.addFileDraft(f); }} />

        <div style={{ padding: "10px 12px", display: "flex", gap: 9, alignItems: "flex-end" }}>
          <button onClick={() => setAttachSheetOpen(true)} disabled={!!editing}
            aria-label={tc({ en: "Attach", hi: "संलग्न करें", bn: "সংযুক্ত করুন" })}
            style={{ width: 42, height: 42, borderRadius: 999, flexShrink: 0, border: "none",
              background: T.surface2, color: editing ? T.inkFaint : T.inkSoft,
              cursor: editing ? "default" : "pointer", display: "grid", placeItems: "center" }}>
            <Icon name="Paperclip" size={18} />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder={tc({ en: "Message…", hi: "संदेश…", bn: "বার্তা…" })}
            aria-label={tc({ en: "Message", hi: "संदेश", bn: "বার্তা" })}
            style={{ flex: 1, resize: "none", maxHeight: 120, padding: "10px 12px", borderRadius: 14,
              border: `1px solid ${T.line}`, background: T.surface2, color: T.ink,
              fontFamily: T.body, fontSize: 14.5, lineHeight: 1.4, outline: "none" }} />
          <button onClick={send} disabled={!canSend}
            aria-label={tc({ en: "Send", hi: "भेजें", bn: "পাঠান" })}
            style={{ width: 42, height: 42, borderRadius: 999, flexShrink: 0, border: "none",
              background: canSend ? T.primary : T.surface2,
              color: canSend ? "#fff" : T.inkFaint,
              cursor: canSend ? "pointer" : "default", display: "grid", placeItems: "center" }}>
            <Icon name={editing ? "Check" : "Send"} size={18} />
          </button>
        </div>
      </div>

      <BottomSheet open={attachSheetOpen} onClose={() => setAttachSheetOpen(false)}
        title={tc({ en: "Attach", hi: "संलग्न करें", bn: "সংযুক্ত করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <ActionRow icon="ImagePlus" label={tc({ en: "Photo or video", hi: "फ़ोटो या वीडियो", bn: "ছবি বা ভিডিও" })}
            onClick={() => { setAttachSheetOpen(false); mediaInputRef.current?.click(); }} />
          <ActionRow icon="FileText" label={tc({ en: "Document", hi: "दस्तावेज़", bn: "নথি" })}
            onClick={() => { setAttachSheetOpen(false); docInputRef.current?.click(); }} />
          <ActionRow icon="MapPin" label={tc({ en: "Location", hi: "स्थान", bn: "অবস্থান" })}
            onClick={() => { setAttachSheetOpen(false); attachments.addLocationDraft(); }} />
        </div>
      </BottomSheet>

      <BottomSheet open={!!actionsFor} onClose={closeActions}
        title={tc({ en: "Message", hi: "संदेश", bn: "বার্তা" })}>
        {actionsFor && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <ActionRow icon="Copy" label={tc({ en: "Copy", hi: "कॉपी", bn: "কপি" })} onClick={() => doCopy(actionsFor)} />
            {canEditOwn(actionsFor) && (
              <ActionRow icon="Pencil" label={tc({ en: "Edit", hi: "संपादित करें", bn: "সম্পাদনা" })} onClick={() => doStartEdit(actionsFor)} />
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

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        title={confirmDelete?.forEveryone
          ? tc({ en: "Delete for everyone?", hi: "सभी के लिए हटाएँ?", bn: "সবার জন্য মুছবেন?" })
          : tc({ en: "Delete for me?", hi: "मेरे लिए हटाएँ?", bn: "আমার জন্য মুছবেন?" })}
        body={confirmDelete?.forEveryone
          ? tc({ en: "This removes the message for both of you.",
                 hi: "यह संदेश आप दोनों के लिए हटा देगा।",
                 bn: "এটি আপনাদের দুজনের জন্যই বার্তাটি মুছে দেবে।" })
          : tc({ en: "This only removes it from your own view.",
                 hi: "यह केवल आपके लिए हटेगा।",
                 bn: "এটি শুধু আপনার দৃষ্টি থেকে সরবে।" })}
        icon="Trash2" danger
        confirmLabel={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
        cancelLabel={tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" })}
        onConfirm={() => (confirmDelete.forEveryone ? doDeleteForEveryone(confirmDelete.message) : doDeleteForMe(confirmDelete.message))} />
    </>
  );
}
