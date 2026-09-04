import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { Spinner } from "../../components/index.js";

/* Shared between Farm Chat's group channel (FarmSpaceChat.jsx) and 1:1
   direct messages (FarmSpaceDm.jsx) — a message bubble, its attachments,
   and the small pieces around them look and behave the same in both, and
   this is the one place that decides how. Fields a screen does not use
   (reactions, reply_to, mentions, pinned_at, task_title) are simply absent
   on the messages that screen passes in, so Bubble renders correctly for
   either without a feature flag. */

/* A sender's name, or the best fallback available — phone, then their
   permanent AgriOS User ID — mirroring farmSpaceService.displayName() and
   the server's own bestName(). A provider that never supplied a display
   name is not a rare case, and leaving the sender line blank is exactly as
   confusing as showing the generic word "Member" everywhere else. */
export function senderName(m) {
  return m?.sender_name || m?.sender_phone || m?.sender_agrios_id || null;
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function humanSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* Purely visual: any "@Word" shaped run of text in the body is styled like a
   mention, regardless of whether it corresponds to a verified id in
   `mentions` — cheap and correct for what it is (typed text that LOOKS like
   a mention), and avoids needing to reconcile display names that may have
   since changed. */
export function renderBodyWithMentions(body, own) {
  const parts = body.split(/(@[^\s@]{1,40})/g);
  const color = own ? "#fff" : T.primary;
  return parts.map((part, i) => (part.startsWith("@")
    ? <span key={i} style={{ color, fontWeight: 800, textDecoration: own ? "underline" : "none" }}>{part}</span>
    : part));
}

/* A picked-but-not-yet-sent attachment, shown as a thumbnail chip above the
   composer — uploading (spinner), done (plain), or error (tap X and pick
   again; there is no in-place retry, the file is still on the device). */
/* Uploading (spinner) or done (plain) needs no interaction. Error is the one
   that must never be silent: a visible, tappable retry button — not a hover
   `title` tooltip, which does not exist on a touch device — is what tells a
   farmer their photo/document/location actually failed and lets them do
   something about it without re-picking the file from scratch. The real
   reason is also toast'd the moment the failure happens (see
   useAttachmentDrafts.js); this button is for acting on it, not explaining it
   a second time in a space too small for a sentence. */
export function AttachmentDraftChip({ draft, tc, onRemove, onRetry }) {
  const size = 56;
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: 10, overflow: "hidden", background: T.surface2,
        border: `1px solid ${draft.status === "error" ? T.red : T.line}`, display: "flex", alignItems: "center",
        justifyContent: "center", position: "relative" }}>
        {draft.kind === "image" && draft.previewUrl && (
          <img src={draft.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {draft.kind === "video" && <Icon name="Video" size={20} style={{ color: T.inkSoft }} />}
        {draft.kind === "audio" && <Icon name="Mic" size={20} style={{ color: T.inkSoft }} />}
        {draft.kind === "document" && <Icon name="FileText" size={20} style={{ color: T.inkSoft }} />}
        {draft.kind === "location" && <Icon name="MapPin" size={20} style={{ color: T.inkSoft }} />}

        {draft.status === "uploading" && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center" }}>
            <Spinner size={16} />
          </div>
        )}
        {draft.status === "error" && (
          <button onClick={() => onRetry?.(draft.localId)}
            aria-label={tc({ en: "Retry", hi: "फिर कोशिश करें", bn: "আবার চেষ্টা করুন" })}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", border: "none", padding: 0,
              cursor: "pointer", display: "grid", placeItems: "center" }}>
            <Icon name="RefreshCw" size={18} style={{ color: "#fff" }} />
          </button>
        )}
      </div>
      <button onClick={onRemove} aria-label={tc({ en: "Remove", hi: "हटाएँ", bn: "সরান" })}
        style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 999,
          background: T.ink, color: "#fff", border: `2px solid ${T.surface}`, display: "grid", placeItems: "center",
          cursor: "pointer", padding: 0 }}>
        <Icon name="X" size={11} />
      </button>
    </div>
  );
}

/* One already-sent attachment, rendered per kind. Images/video/audio play
   inline; a document or a shared location is a tappable row that opens the
   Blob URL (or a Google Maps link built from the stored coordinates) in a
   new tab — this component never fetches anything itself. */
export function AttachmentView({ a, own, tc }) {
  if (a.kind === "image") {
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
        <img src={a.url} alt={a.name || "photo"}
          style={{ maxWidth: 220, maxHeight: 260, width: "100%", borderRadius: 12, display: "block", objectFit: "cover" }} />
      </a>
    );
  }
  if (a.kind === "video") {
    return <video src={a.url} controls style={{ maxWidth: 240, maxHeight: 260, borderRadius: 12, display: "block" }} />;
  }
  if (a.kind === "audio") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <audio src={a.url} controls style={{ width: 220, display: "block" }} />
        {a.duration > 0 && (
          <span style={{ fontSize: 10.5, color: own ? "rgba(255,255,255,.75)" : T.inkFaint }}>{formatDuration(a.duration)}</span>
        )}
      </div>
    );
  }

  const rowStyle = { display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 12,
    background: own ? "rgba(255,255,255,.15)" : T.surface, textDecoration: "none",
    border: own ? "none" : `1px solid ${T.line}` };
  const iconColor = own ? "#fff" : T.primary;

  if (a.kind === "location") {
    const href = `https://www.google.com/maps?q=${a.lat},${a.lng}`;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={rowStyle}>
        <Icon name="MapPin" size={18} style={{ color: iconColor, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: own ? "#fff" : T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.label || tc({ en: "Shared location", hi: "साझा स्थान", bn: "শেয়ার করা অবস্থান" })}
        </span>
      </a>
    );
  }

  return (
    <a href={a.url} target="_blank" rel="noopener noreferrer" style={rowStyle}>
      <Icon name="FileText" size={18} style={{ color: iconColor, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: own ? "#fff" : T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
          {a.name || tc({ en: "Document", hi: "दस्तावेज़", bn: "নথি" })}
        </div>
        {a.size > 0 && <div style={{ fontSize: 10.5, color: own ? "rgba(255,255,255,.75)" : T.inkFaint }}>{humanSize(a.size)}</div>}
      </div>
      <Icon name="Download" size={14} style={{ color: iconColor, marginLeft: 4, flexShrink: 0 }} />
    </a>
  );
}

export function ActionRow({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 8px",
        background: "none", border: "none", cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
      <Icon name={icon} size={18} style={{ color: danger ? T.red : T.inkSoft }} />
      <span style={{ fontSize: 14.5, fontWeight: 500, color: danger ? T.red : T.ink }}>{label}</span>
    </button>
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

export function Bubble({ m, own, myUserId, tc, footer, onOpen, onReact }) {
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

  const mentionedMe = !own && myUserId && m.mentions?.includes(myUserId);

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
          <div style={{ background: own ? T.primary : (mentionedMe ? T.primarySoft : T.surface2), color: own ? "#fff" : T.ink,
            borderRadius: 16, padding: "9px 12px", fontSize: 14, lineHeight: 1.45, textAlign: "left",
            border: mentionedMe ? `1px solid ${T.primary}` : "none" }}>
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
            {m.attachments?.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: m.body ? 6 : 0 }}>
                {m.attachments.map((a, i) => <AttachmentView key={i} a={a} own={own} tc={tc} />)}
              </div>
            )}
            {m.body && <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{renderBodyWithMentions(m.body, own)}</span>}
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
