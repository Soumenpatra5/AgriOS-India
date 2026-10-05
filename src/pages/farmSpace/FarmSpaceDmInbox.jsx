import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, ErrorState, Spinner, EmptyState, BottomSheet } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { farmSpaceApi } from "../../services/farmSpace/farmSpaceApi.js";
import { useFarmPoll } from "../../hooks/useFarmPoll.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

/* Direct messages — the inbox for 1:1 conversations, separate from the
   shared group channel (FarmSpaceChat.jsx). Each row is a conversation with
   one other member of this Farm Space; opening one goes to FarmSpaceDm.jsx. */

export default function FarmSpaceDmInbox() {
  const { pop, push, tc } = useApp();
  const [space, setSpace] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [members, setMembers] = useState([]);
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const [list, memberList] = await Promise.all([
        farmSpaceApi.listConversations(active.id),
        farmSpaceService.members(active.id, { fresh: true }).catch(() => farmSpaceService.peekMembers(active.id) || []),
      ]);
      setConversations(list);
      setMembers(memberList);
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const poll = useCallback(async () => {
    if (!space?.id) return;
    try {
      const list = await farmSpaceApi.listConversations(space.id);
      setConversations(list);
    } catch {
      /* silent by design */
    }
  }, [space?.id]);

  useFarmPoll(poll, { intervalMs: 15000, enabled: state === "ready" && !!space });

  const openWith = (member) => {
    setPickerOpen(false);
    push({ kind: "farmSpaceDm", props: { otherUserId: member.user_id, otherName: farmSpaceService.displayName(member) } });
  };

  const openConversation = (c) => {
    push({ kind: "farmSpaceDm", props: { otherUserId: c.other_user_id, otherName: c.other_display_name } });
  };

  const title = tc({ en: "Direct messages", hi: "सीधे संदेश", bn: "সরাসরি বার্তা" });

  if (state === "loading") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  }
  if (state === "error") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;
  }

  const pickable = members.filter((m) => m.user_id !== space?.user_id);

  return (
    <>
      <AppBar title={title} onBack={pop} action={
        <button onClick={() => setPickerOpen(true)} aria-label={tc({ en: "New message", hi: "नया संदेश", bn: "নতুন বার্তা" })}
          style={{ width: 36, height: 36, borderRadius: 999, border: "none", background: T.primary, color: "#fff",
            cursor: "pointer", display: "grid", placeItems: "center" }}>
          <Icon name="Plus" size={18} />
        </button>
      } />

      <div style={{ padding: "8px 16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        {!conversations.length ? (
          <EmptyState icon="MessageCircle"
            title={tc({ en: "No conversations yet", hi: "अभी कोई बातचीत नहीं", bn: "এখনও কোনও কথোপকথন নেই" })}
            body={tc({ en: "Message one teammate privately — separate from the group Farm chat.",
                       hi: "किसी एक साथी को निजी तौर पर संदेश भेजें — फ़ार्म चैट समूह से अलग।",
                       bn: "একজন সহকর্মীকে ব্যক্তিগতভাবে বার্তা পাঠান — গ্রুপ ফার্ম চ্যাট থেকে আলাদা।" })}
            action={tc({ en: "New message", hi: "नया संदेश", bn: "নতুন বার্তা" })}
            onAction={() => setPickerOpen(true)} />
        ) : conversations.map((c) => (
          <Card key={c.id} onClick={() => openConversation(c)}
            style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", width: 42, height: 42, flexShrink: 0 }}>
              <div style={{ width: 42, height: 42, borderRadius: 999, background: T.primarySoft, color: T.primary,
                display: "grid", placeItems: "center", fontSize: 15, fontWeight: 700 }}>
                {(c.other_display_name || "?").slice(0, 1).toUpperCase()}
              </div>
              {c.other_is_online && (
                <span
                  data-testid="presence-online-indicator"
                  style={{
                    position: "absolute", bottom: 0, right: 0, width: 11, height: 11,
                    borderRadius: "50%", background: T.primary || "#16a34a",
                    border: `2px solid ${T.bg || "#ffffff"}`,
                  }}
                />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: c.unread_count > 0 ? 800 : 700, color: T.ink, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>{c.other_display_name}</span>
                {c.unread_count > 0 && (
                  <span
                    data-testid={`dm-unread-badge-${c.id}`}
                    style={{
                      padding: "2px 7px",
                      borderRadius: 10,
                      background: T.accentRed || "#ef4444",
                      color: "#fff",
                      fontSize: 11.5,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      flexShrink: 0,
                    }}
                  >
                    {c.unread_count > 99 ? "99+" : c.unread_count}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 12.5,
                fontWeight: c.unread_count > 0 ? 600 : 400,
                color: c.unread_count > 0 ? T.ink : T.inkSoft,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {c.last_message
                  ? (c.last_message.deleted
                      ? tc({ en: "Message deleted", hi: "संदेश हटाया गया", bn: "বার্তা মুছে ফেলা হয়েছে" })
                      : `${c.last_message.mine ? tc({ en: "You: ", hi: "आप: ", bn: "আপনি: " }) : ""}${
                          c.last_message.body || tc({ en: "Attachment", hi: "अनुलग्नक", bn: "সংযুক্তি" })}`)
                  : tc({ en: "Say hello", hi: "नमस्ते कहें", bn: "হ্যালো বলুন" })}
              </div>
            </div>
            {c.last_message?.created_at && (
              <span style={{ fontSize: 10.5, color: T.inkFaint, flexShrink: 0 }}>
                {new Date(c.last_message.created_at).toLocaleDateString()}
              </span>
            )}
          </Card>
        ))}
      </div>

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}
        title={tc({ en: "Message a teammate", hi: "साथी को संदेश भेजें", bn: "সহকর্মীকে বার্তা পাঠান" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {!pickable.length && (
            <div style={{ fontSize: 13, color: T.inkSoft, textAlign: "center", padding: "16px 0" }}>
              {tc({ en: "No other members in this Farm Space yet.", hi: "इस फ़ार्म स्पेस में अभी कोई और सदस्य नहीं है।",
                    bn: "এই ফার্ম স্পেসে এখনও অন্য কোনও সদস্য নেই।" })}
            </div>
          )}
          {pickable.map((m) => (
            <button key={m.user_id} onClick={() => openWith(m)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 12,
                background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: T.body }}>
              <div style={{ width: 34, height: 34, borderRadius: 999, background: T.primarySoft, color: T.primary,
                display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {(farmSpaceService.displayName(m) || "?").slice(0, 1).toUpperCase()}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{farmSpaceService.displayName(m)}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
