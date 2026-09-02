import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, EmptyState, ErrorState, Spinner } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { farmSpaceApi } from "../../services/farmSpace/farmSpaceApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

/* The farm's activity feed.

   Read from what already happened — task events and the audit log — rather
   than a table of its own, and filtered server-side to the entries members are
   meant to see. A worker gets farm news plus their own doings; the whole
   commentary on everyone else's day belongs to the people managing it. */

const EVENT = {
  "space.created":        { icon: "Sprout",       a: "primary", text: { en: "created the Farm Space", hi: "ने फ़ार्म स्पेस बनाया", bn: "ফার্ম স্পেস তৈরি করেছেন" } },
  "member.joined":        { icon: "UserPlus",     a: "primary", text: { en: "joined",                 hi: "शामिल हुए",            bn: "যোগ দিয়েছেন" } },
  "member.invited":       { icon: "Mail",         a: "blue",    text: { en: "invited someone",        hi: "ने किसी को बुलाया",     bn: "কাউকে ডেকেছেন" } },
  "member.left":          { icon: "UserMinus",    a: "faint",   text: { en: "left the Farm Space",    hi: "ने फ़ार्म स्पेस छोड़ा",  bn: "ফার্ম স্পেস ছেড়েছেন" } },
  "task.created":         { icon: "ClipboardList",a: "blue",    text: { en: "created a task",         hi: "ने कार्य बनाया",        bn: "একটি কাজ তৈরি করেছেন" } },
  "task.accepted":        { icon: "Check",        a: "blue",    text: { en: "accepted a task",        hi: "ने कार्य स्वीकारा",     bn: "কাজ গ্রহণ করেছেন" } },
  "task.in_progress":     { icon: "Play",         a: "blue",    text: { en: "started a task",         hi: "ने कार्य शुरू किया",    bn: "কাজ শুরু করেছেন" } },
  "task.completed":       { icon: "CheckCheck",   a: "primary", text: { en: "completed a task",       hi: "ने कार्य पूरा किया",    bn: "কাজ সম্পন্ন করেছেন" } },
  "task.verified":        { icon: "ShieldCheck",  a: "primary", text: { en: "verified a task",        hi: "ने कार्य सत्यापित किया", bn: "কাজ যাচাই করেছেন" } },
  "task.rejected":        { icon: "Undo2",        a: "red",     text: { en: "sent a task back",       hi: "ने कार्य वापस भेजा",    bn: "কাজ ফেরত পাঠিয়েছেন" } },
  "task.cancelled":       { icon: "X",            a: "faint",   text: { en: "cancelled a task",       hi: "ने कार्य रद्द किया",    bn: "কাজ বাতিল করেছেন" } },
  "task.reassigned":      { icon: "Repeat",       a: "blue",    text: { en: "reassigned a task",      hi: "ने कार्य दूसरे को दिया", bn: "কাজ অন্যকে দিয়েছেন" } },
  "announcement.created": { icon: "Megaphone",    a: "orange",  text: { en: "posted an announcement", hi: "ने घोषणा की",           bn: "একটি ঘোষণা দিয়েছেন" } },
  "attendance.marked":    { icon: "CalendarCheck",a: "primary", text: { en: "marked attendance",      hi: "ने उपस्थिति दर्ज की",   bn: "উপস্থিতি নথিভুক্ত করেছেন" } },
};
const TONE = {
  primary: [T.primary, T.primarySoft], blue: [T.blue, T.blueSoft],
  orange: [T.orange, T.orangeSoft], red: [T.red, T.redSoft], faint: [T.inkSoft, T.surface2],
};

/* Relative time, because "2 hours ago" is what a person wants from a feed and
   a timestamp is what they have to decode. */
function ago(iso, tc) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1)  return tc({ en: "just now", hi: "अभी", bn: "এইমাত্র" });
  if (mins < 60) return tc({ en: `${mins}m ago`, hi: `${mins} मिनट पहले`, bn: `${mins} মিনিট আগে` });
  const h = Math.round(mins / 60);
  if (h < 24)    return tc({ en: `${h}h ago`, hi: `${h} घंटे पहले`, bn: `${h} ঘণ্টা আগে` });
  const d = Math.round(h / 24);
  return tc({ en: `${d}d ago`, hi: `${d} दिन पहले`, bn: `${d} দিন আগে` });
}

export default function FarmSpaceActivity() {
  const { pop, tc } = useApp();
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setItems(await farmSpaceApi.listActivity(active.id));
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const title = tc({ en: "Activity", hi: "गतिविधि", bn: "কার্যকলাপ" });

  if (state === "loading") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  }
  if (state === "error") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState message={farmErrorText(reason, tc)} onRetry={load} /></div></>;
  }

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: "4px 16px 24px" }}>
        {!items.length ? (
          <EmptyState icon="Activity"
            title={tc({ en: "Nothing yet", hi: "अभी कुछ नहीं", bn: "এখনও কিছু নেই" })}
            message={tc({ en: "Tasks, announcements and attendance from your farm will show up here.",
                          hi: "आपके फ़ार्म के कार्य, घोषणाएँ और उपस्थिति यहाँ दिखेंगे।",
                          bn: "আপনার খামারের কাজ, ঘোষণা ও উপস্থিতি এখানে দেখা যাবে।" })} />
        ) : (
          <Card pad={0}>
            {items.map((e, i) => {
              const meta = EVENT[e.action] || { icon: "Circle", a: "faint", text: { en: e.action, hi: e.action, bn: e.action } };
              const [fg, bg] = TONE[meta.a] || TONE.faint;
              return (
                <div key={`${e.created_at}-${i}`}
                  style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "11px 12px",
                    borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 10, flexShrink: 0, display: "grid",
                    placeItems: "center", background: bg, color: fg }}>
                    <Icon name={meta.icon} size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.45 }}>
                      <strong style={{ fontWeight: 600 }}>
                        {e.actor_name || tc({ en: "Someone", hi: "किसी ने", bn: "কেউ" })}
                      </strong>{" "}
                      {tc(meta.text)}
                      {e.meta?.title ? ` — ${e.meta.title}` : ""}
                    </div>
                    <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 1 }}>{ago(e.created_at, tc)}</div>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </>
  );
}
