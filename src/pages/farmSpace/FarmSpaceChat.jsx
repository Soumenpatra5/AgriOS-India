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
import { senderName, formatDuration, AttachmentDraftChip, ActionRow, Bubble } from "./chatBubble.jsx";
import { useAttachmentDrafts } from "./useAttachmentDrafts.js";

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
/* The DOM renders every message in this array and the 4s poll re-renders it,
   so an all-day session must not accumulate an unbounded list on a cheap
   phone. 300 is six initial pages — far past what anyone scrolls back
   through in-session; the server keeps everything. */
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

  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const attachments = useAttachmentDrafts({ spaceId: space?.id, toast, tc });
  const mediaInputRef = useRef(null);
  const docInputRef = useRef(null);

  const [members, setMembers] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);   // partial name text right before the caret, or null
  const [mentionPicks, setMentionPicks] = useState([]);     // [{ userId, name }] chosen this compose session

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const messageRefs = useRef({});

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordStartRef = useRef(0);
  const recordCancelRef = useRef(false);
  const recordTimerRef = useRef(null);

  const textareaRef = useRef(null);
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

      /* For @mention autocomplete only — never load-bearing for the screen
         itself, so a stale cache or a failed background refresh is fine
         either way. */
      const cachedMembers = farmSpaceService.peekMembers(active.id);
      if (cachedMembers) setMembers(cachedMembers);
      farmSpaceService.members(active.id, { fresh: true }).then(setMembers).catch(() => {});
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

  /* Debounced so typing "urea" does not fire four separate searches for
     "u", "ur", "ure", "urea" — the sheet stays open across keystrokes, only
     the request is delayed until typing pauses. */
  useEffect(() => {
    if (!searchOpen || !space) return;
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      farmSpaceApi.searchMessages(space.id, q)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchOpen, space]);

  const patchLocal = (updated) => {
    setMessages((prev) => mergeMessages(prev, [updated]));
    farmSpaceService.appendChatMessages(space.id, [updated]);
  };

  /* A recorded voice note becomes an attachment draft through the same
     addFileDraft() every picked file uses (same upload lifecycle, same cap,
     same retry-on-failure) — it just starts life as a Blob from
     MediaRecorder instead of a file input, and carries a duration nothing
     else does. */
  const addVoiceDraft = (blob, seconds) => {
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || "audio/webm" });
    attachments.addFileDraft(file, { forceKind: "audio", extra: { duration: seconds } });
  };

  const startRecording = async () => {
    if (attachments.attachmentDrafts.length >= attachments.max) {
      toast(tc({ en: `Up to ${attachments.max} attachments per message.`, hi: `प्रति संदेश अधिकतम ${attachments.max} अनुलग्नक।`, bn: `প্রতি বার্তায় সর্বোচ্চ ${attachments.max}টি সংযুক্তি।` }), "error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordChunksRef.current = [];
      recordCancelRef.current = false;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const seconds = Math.round((Date.now() - recordStartRef.current) / 1000);
        if (!recordCancelRef.current && seconds >= 1 && recordChunksRef.current.length) {
          const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
          addVoiceDraft(blob, seconds);
        }
      };
      recorderRef.current = recorder;
      recordStartRef.current = Date.now();
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      toast(tc({ en: "Couldn't access the microphone — check the app's permissions.",
                  hi: "माइक्रोफ़ोन तक पहुँच नहीं मिली — ऐप की अनुमतियाँ जाँचें।",
                  bn: "মাইক্রোফোন অ্যাক্সেস করা যায়নি — অ্যাপের অনুমতি পরীক্ষা করুন।" }), "error");
    }
  };

  const stopRecording = (cancel = false) => {
    recordCancelRef.current = cancel;
    clearInterval(recordTimerRef.current);
    recorderRef.current?.stop();
    setRecording(false);
  };

  /* If the farmer leaves the screen mid-recording, the mic must not stay
     hot in the background — stop() also releases the media stream's tracks
     (see recorder.onstop above). */
  useEffect(() => () => {
    clearInterval(recordTimerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recordCancelRef.current = true;
      recorderRef.current.stop();
    }
  }, []);

  /* Typing "@" starts a mention; the picker stays open only while the text
     right before the caret is "@partialName" with no space in between —
     leaving that word (a space, or moving the caret elsewhere) closes it.
     `null` (not "") is the closed state, since an empty query ("@" with
     nothing typed yet) must still show the full member list. */
  const onDraftChange = (e) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setDraft(val);
    const before = val.slice(0, pos);
    const m = before.match(/(?:^|\s)@([^\s@]{0,30})$/);
    setMentionQuery(m ? m[1] : null);
  };

  const mentionMatches = mentionQuery == null ? [] : members
    .filter((mem) => mem.user_id !== space?.user_id)
    .filter((mem) => (farmSpaceService.displayName(mem) || "").toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 5);

  /* Replaces the "@partial" text the caret is sitting in with "@FullName ",
     and remembers the id so send() can resolve it back — the server is the
     one that actually verifies this id names a real, active member (see
     chat.js's sendMessage); this is only bookkeeping for what to send. */
  const pickMention = (member) => {
    const name = farmSpaceService.displayName(member) || "Member";
    const val = draft;
    const pos = textareaRef.current?.selectionStart ?? val.length;
    const before = val.slice(0, pos);
    const match = before.match(/(?:^|\s)@([^\s@]{0,30})$/);
    if (!match) { setMentionQuery(null); return; }
    const atIndex = before.lastIndexOf("@");
    const head = val.slice(0, atIndex);
    const tail = val.slice(pos);
    const inserted = `@${name} `;
    setDraft(head + inserted + tail);
    setMentionQuery(null);
    setMentionPicks((picks) => [...picks.filter((p) => p.userId !== member.user_id), { userId: member.user_id, name }]);

    const caret = head.length + inserted.length;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(caret, caret);
    });
  };

  /* Only a pick whose "@Name" text is still actually present in the body
     counts — backspacing over it (or editing it away) un-mentions them
     without needing separate bookkeeping for that. */
  const mentionsPayloadFrom = (body, picks) => picks.filter((p) => body.includes(`@${p.name}`)).map((p) => p.userId);

  const openSearch = () => { setSearchOpen(true); setSearchQuery(""); setSearchResults([]); };

  const jumpToMessage = (id) => {
    setSearchOpen(false);
    const el = messageRefs.current[id];
    if (!el) {
      toast(tc({ en: "That message isn't in the recent view — scroll up to find it.",
                  hi: "वह संदेश हाल के दृश्य में नहीं है — उसे खोजने के लिए ऊपर स्क्रॉल करें।",
                  bn: "সেই বার্তাটি সাম্প্রতিক দৃশ্যে নেই — এটি খুঁজতে উপরে স্ক্রল করুন।" }), "error");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1600);
  };

  const send = async () => {
    const body = draft.trim();

    if (editing) {
      if (!body) return;
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

    if (!space) return;
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
    const mentions = mentionsPayloadFrom(body, mentionPicks);

    const parentMessageId = replyTo?.id || null;
    const replyPreview = replyTo;
    setReplyTo(null);

    const localId = `local-${Date.now()}`;
    setPending((p) => [...p, { localId, body, attachments: attachmentsPayload, mentions, state: OUTBOX_SENDING, replyPreview }]);
    setDraft("");
    attachments.clearDrafts();
    setMentionPicks([]);
    setMentionQuery(null);

    try {
      const saved = await farmSpaceApi.sendMessage(space.id, { body, parentMessageId, attachments: attachmentsPayload, mentions });
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
      const saved = await farmSpaceApi.sendMessage(space.id, { body: item.body, parentMessageId: item.replyPreview?.id || null, attachments: item.attachments || [], mentions: item.mentions || [] });
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
  /* Editing rewrites text only (editMessage never touches attachments), so
     any attachment mid-upload for a still-unsent message is dropped rather
     than left stranded in limbo while the composer is repurposed. */
  const doStartEdit = (m) => { setEditing(m); setDraft(m.body || ""); setReplyTo(null); attachments.clearDrafts(); setMentionPicks([]); setMentionQuery(null); closeActions(); };
  const doCancelCompose = () => { setEditing(null); setReplyTo(null); setDraft(""); attachments.clearDrafts(); setMentionPicks([]); setMentionQuery(null); };

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
      patchLocal({ ...m, deleted: true, body: null, attachments: [], mentions: [], reactions: [], reply_to: null });
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

  const canSend = editing ? !!draft.trim()
    : (!!draft.trim() || attachments.hasReadyAttachment) && !attachments.attachmentsUploading && !attachments.hasErroredAttachment;
  const mentionDropdownOpen = mentionQuery != null && mentionMatches.length > 0;
  const composerHeight = 76 + (replyTo || editing ? 56 : 0) + (attachments.attachmentDrafts.length > 0 ? 72 : 0)
    + (mentionDropdownOpen ? Math.min(mentionMatches.length * 42, 168) + 12 : 0);

  return (
    <>
      <AppBar title={title} onBack={pop} action={
        <button onClick={openSearch} aria-label={tc({ en: "Search", hi: "खोजें", bn: "খুঁজুন" })}
          style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft, padding: 6, display: "flex" }}>
          <Icon name="Search" size={19} />
        </button>
      } />

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
          <div key={m.id} ref={(el) => { messageRefs.current[m.id] = el; }}
            style={{ borderRadius: 14, transition: "background-color .6s ease",
              backgroundColor: highlightId === m.id ? T.primarySoft : "transparent" }}>
            <Bubble m={m} own={mine(m)} myUserId={space?.user_id} tc={tc}
              onOpen={() => openActions(m)} onReact={(emoji) => doReact(m, emoji)} />
          </div>
        ))}

        {pending.map((p) => (
          <Bubble key={p.localId} own
            m={{ body: p.body, attachments: p.attachments, mentions: p.mentions, sender_name: null, created_at: null, reply_to: p.replyPreview
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

        {mentionQuery != null && mentionMatches.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "6px 8px",
            borderBottom: `1px solid ${T.lineSoft}`, maxHeight: 168, overflowY: "auto" }}>
            {mentionMatches.map((mem) => (
              <button key={mem.user_id} onClick={() => pickMention(mem)}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", borderRadius: 10,
                  background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: T.body }}>
                <div style={{ width: 28, height: 28, borderRadius: 999, background: T.primarySoft, color: T.primary,
                  display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {(farmSpaceService.displayName(mem) || "?").slice(0, 1).toUpperCase()}
                </div>
                <span style={{ fontSize: 13.5, color: T.ink, fontWeight: 600 }}>{farmSpaceService.displayName(mem)}</span>
              </button>
            ))}
          </div>
        )}

        {recording ? (
          <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => stopRecording(true)}
              aria-label={tc({ en: "Discard recording", hi: "रिकॉर्डिंग रद्द करें", bn: "রেকর্ডিং বাতিল করুন" })}
              style={{ width: 42, height: 42, borderRadius: 999, flexShrink: 0, border: "none",
                background: T.surface2, color: T.red, cursor: "pointer", display: "grid", placeItems: "center" }}>
              <Icon name="Trash2" size={18} />
            </button>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: 999, background: T.red, animation: "ag-pulse 1s ease-in-out infinite" }} />
              <span style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>
                {tc({ en: "Recording…", hi: "रिकॉर्ड हो रहा है…", bn: "রেকর্ড হচ্ছে…" })} {formatDuration(recordSeconds)}
              </span>
            </div>
            <button onClick={() => stopRecording(false)}
              aria-label={tc({ en: "Stop and add to message", hi: "रोकें और संदेश में जोड़ें", bn: "থামুন এবং বার্তায় যোগ করুন" })}
              style={{ width: 42, height: 42, borderRadius: 999, flexShrink: 0, border: "none",
                background: T.primary, color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <Icon name="Check" size={18} />
            </button>
          </div>
        ) : (
          <div style={{ padding: "10px 12px", display: "flex", gap: 9, alignItems: "flex-end" }}>
            <button onClick={() => setAttachSheetOpen(true)} disabled={!!editing}
              aria-label={tc({ en: "Attach", hi: "संलग्न करें", bn: "সংযুক্ত করুন" })}
              style={{ width: 42, height: 42, borderRadius: 999, flexShrink: 0, border: "none",
                background: T.surface2, color: editing ? T.inkFaint : T.inkSoft,
                cursor: editing ? "default" : "pointer", display: "grid", placeItems: "center" }}>
              <Icon name="Paperclip" size={18} />
            </button>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={onDraftChange}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              placeholder={tc({ en: "Message your team…", hi: "टीम को संदेश…", bn: "দলকে বার্তা…" })}
              aria-label={tc({ en: "Message", hi: "संदेश", bn: "বার্তা" })}
              style={{ flex: 1, resize: "none", maxHeight: 120, padding: "10px 12px", borderRadius: 14,
                border: `1px solid ${T.line}`, background: T.surface2, color: T.ink,
                fontFamily: T.body, fontSize: 14.5, lineHeight: 1.4, outline: "none" }} />
            {canSend ? (
              <button onClick={send}
                aria-label={tc({ en: "Send", hi: "भेजें", bn: "পাঠান" })}
                style={{ width: 42, height: 42, borderRadius: 999, flexShrink: 0, border: "none",
                  background: T.primary, color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
                <Icon name={editing ? "Check" : "Send"} size={18} />
              </button>
            ) : (
              <button onClick={startRecording} disabled={!!editing}
                aria-label={tc({ en: "Record a voice message", hi: "आवाज़ संदेश रिकॉर्ड करें", bn: "ভয়েস বার্তা রেকর্ড করুন" })}
                style={{ width: 42, height: 42, borderRadius: 999, flexShrink: 0, border: "none",
                  background: T.surface2, color: editing ? T.inkFaint : T.inkSoft,
                  cursor: editing ? "default" : "pointer", display: "grid", placeItems: "center" }}>
                <Icon name="Mic" size={18} />
              </button>
            )}
          </div>
        )}
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

      <BottomSheet open={searchOpen} onClose={() => setSearchOpen(false)}
        title={tc({ en: "Search messages", hi: "संदेश खोजें", bn: "বার্তা খুঁজুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <Icon name="Search" size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.inkFaint }} />
            <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tc({ en: "Search this chat…", hi: "इस चैट में खोजें…", bn: "এই চ্যাটে খুঁজুন…" })}
              aria-label={tc({ en: "Search messages", hi: "संदेश खोजें", bn: "বার্তা খুঁজুন" })}
              style={{ width: "100%", padding: "11px 14px 11px 34px", borderRadius: T.rMd, border: `1px solid ${T.line}`,
                background: T.surface2, color: T.ink, fontFamily: T.body, fontSize: 14.5, outline: "none", boxSizing: "border-box" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "56vh", overflowY: "auto" }}>
            {searching && <div style={{ padding: "16px 0", display: "grid", placeItems: "center" }}><Spinner size={18} /></div>}
            {!searching && searchQuery.trim() && searchResults.length === 0 && (
              <div style={{ padding: "20px 0", textAlign: "center", color: T.inkFaint, fontSize: 13 }}>
                {tc({ en: "No messages found.", hi: "कोई संदेश नहीं मिला।", bn: "কোনও বার্তা পাওয়া যায়নি।" })}
              </div>
            )}
            {!searching && searchResults.map((m) => (
              <button key={m.id} onClick={() => jumpToMessage(m.id)}
                style={{ textAlign: "left", padding: "10px 11px", borderRadius: T.rMd, border: `1px solid ${T.line}`,
                  background: T.surface, cursor: "pointer", fontFamily: T.body, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: T.inkSoft }}>{senderName(m)}</span>
                  <span style={{ fontSize: 10.5, color: T.inkFaint, flexShrink: 0 }}>
                    {m.created_at ? new Date(m.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.4 }}>{highlightSnippet(m.body, searchQuery.trim())}</div>
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>

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

/* A search result's body, trimmed to a window around the first match with
   the match itself marked — so a farmer scanning results sees WHY each one
   matched, not just that it did. Falls back to a plain lead-in when the
   term somehow is not literally in the body (shouldn't happen, since the
   server's own ILIKE is what selected this row — defensive, not load-bearing). */
function highlightSnippet(body, query) {
  const text = body || "";
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 140);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 60);
  return (
    <>
      {start > 0 ? "…" : ""}
      {text.slice(start, idx)}
      <mark style={{ background: T.primarySoft, color: T.primary, borderRadius: 3, padding: "0 2px" }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length, end)}
      {end < text.length ? "…" : ""}
    </>
  );
}

