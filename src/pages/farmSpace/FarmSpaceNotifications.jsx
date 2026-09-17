import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, AlertCircle, Info, Bell, CheckCheck, Trash2 } from "lucide-react";
import { T } from "../../theme/ThemeProvider.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { AppBar, Card, Button, EmptyState, ErrorState, Spinner } from "../../components/index.js";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { notificationsApi, FARM_ERROR } from "../../services/notifications/notificationsApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const SEVERITY_ICON = {
  critical: <AlertCircle size={18} color="#ef4444" />,
  warning:  <AlertTriangle size={18} color={T.orange} />,
  info:     <Info size={18} color={T.primary} />,
};
const SEVERITY_BG = {
  critical: "#ef444418", warning: `${T.orange}18`, info: `${T.primary}12`,
};

const CATEGORY_LABEL = {
  bee:     { en: "Beekeeping",     hi: "मधुमक्खी", bn: "মৌমাছি" },
  fish:    { en: "Fish",           hi: "मत्स्य",    bn: "মাছ" },
  crop:    { en: "Crop",           hi: "फसल",       bn: "ফসল" },
  dairy:   { en: "Dairy",          hi: "डेयरी",     bn: "ডেয়ারি" },
  tasks:   { en: "Tasks",          hi: "कार्य",     bn: "কাজ" },
  general: { en: "General",        hi: "सामान्य",   bn: "সাধারণ" },
};

function NotifCard({ notif, tc, onMarkRead, onDismiss, onNavigate }) {
  const icon = SEVERITY_ICON[notif.severity] ?? SEVERITY_ICON.info;
  const bg = SEVERITY_BG[notif.severity] ?? SEVERITY_BG.info;
  const catLabel = tc(CATEGORY_LABEL[notif.category] ?? { en: notif.category });
  const timeAgo = formatTimeAgo(notif.created_at);

  return (
    <Card pad={0}>
      <div style={{ display: "flex", gap: 0 }}>
        {/* Unread dot */}
        <div style={{ width: 4, background: notif.is_read ? "transparent" : T.primary,
          borderRadius: "12px 0 0 12px", flexShrink: 0 }} />
        <div style={{ flex: 1, padding: "12px 12px 10px 12px", background: notif.is_read ? T.surface : bg,
          borderRadius: "0 12px 12px 0" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ flexShrink: 0, marginTop: 1 }}>{icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: notif.is_read ? 500 : 700, color: T.ink }}>
                  {notif.title}
                </span>
                <span style={{ fontSize: 11, color: T.inkFaint, flexShrink: 0 }}>{timeAgo}</span>
              </div>
              {notif.body && (
                <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3, lineHeight: 1.4 }}>
                  {notif.body}
                </div>
              )}
              <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 4, textTransform: "uppercase",
                letterSpacing: "0.5px" }}>
                {catLabel}
              </div>
            </div>
          </div>
          {/* Action row */}
          <div style={{ display: "flex", gap: 10, marginTop: 8, justifyContent: "flex-end" }}>
            {notif.link_kind && (
              <button onClick={() => onNavigate(notif)}
                style={{ fontSize: 12, color: T.primary, background: "none", border: "none",
                  cursor: "pointer", fontFamily: T.body, fontWeight: 600 }}>
                {tc({ en: "View", hi: "देखें", bn: "দেখুন" })}
              </button>
            )}
            {!notif.is_read && (
              <button onClick={() => onMarkRead(notif.id)}
                style={{ fontSize: 12, color: T.inkSoft, background: "none", border: "none",
                  cursor: "pointer", fontFamily: T.body }}>
                {tc({ en: "Mark read", hi: "पढ़ा", bn: "পঠিত" })}
              </button>
            )}
            <button onClick={() => onDismiss(notif.id)}
              style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none",
                cursor: "pointer", fontFamily: T.body }}>
              {tc({ en: "Dismiss", hi: "हटाएं", bn: "বাতিল" })}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function formatTimeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function FarmSpaceNotifications() {
  const { pop, push, tc } = useApp();
  const [space, setSpace]       = useState(null);
  const [notifs, setNotifs]     = useState([]);
  const [state, setState]       = useState("loading");
  const [reason, setReason]     = useState(null);
  const [checking, setChecking] = useState(false);
  const [showAll, setShowAll]   = useState(false);

  const load = useCallback(async () => {
    try {
      const sp = await farmSpaceService.active();
      if (!sp) { setState("error"); setReason(FARM_ERROR.NOT_FOUND); return; }
      setSpace(sp);
      const list = await notificationsApi.list(sp.id, { includeRead: showAll });
      setNotifs(list);
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, [showAll]);

  useEffect(() => { load(); }, [load]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await notificationsApi.check(space.id);
      load();
    } catch (err) { /* silently ignore */ }
    finally { setChecking(false); }
  };

  const handleMarkRead = async (notificationId) => {
    try {
      await notificationsApi.markRead(space.id, { notificationId });
      setNotifs(n => n.map(x => x.id === notificationId ? { ...x, is_read: true } : x));
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markRead(space.id, { all: true });
      setNotifs(n => n.map(x => ({ ...x, is_read: true })));
    } catch { /* ignore */ }
  };

  const handleDismiss = async (notificationId) => {
    try {
      await notificationsApi.dismiss(space.id, { notificationId });
      setNotifs(n => n.filter(x => x.id !== notificationId));
    } catch { /* ignore */ }
  };

  const handleDismissAll = async () => {
    try {
      await notificationsApi.dismiss(space.id, { all: true });
      setNotifs([]);
    } catch { /* ignore */ }
  };

  const handleNavigate = (notif) => {
    if (!notif.link_kind) return;
    const props = notif.link_props ?? {};
    push({ kind: notif.link_kind, props });
    handleMarkRead(notif.id);
  };

  const unread = notifs.filter(n => !n.is_read).length;
  const title = tc({ en: "Notifications", hi: "सूचनाएँ", bn: "বিজ্ঞপ্তি" });

  if (state === "loading") return <><AppBar title={title} onBack={pop} />
    <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error") return <><AppBar title={title} onBack={pop} />
    <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Top actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Button size="sm" variant="soft" onClick={handleCheck} loading={checking}>
            <Bell size={13} style={{ marginRight: 4 }} />
            {tc({ en: "Check alerts", hi: "अलर्ट जाँचें", bn: "সতর্কতা পরীক্ষা করুন" })}
          </Button>
          {unread > 0 && (
            <Button size="sm" variant="soft" onClick={handleMarkAllRead}>
              <CheckCheck size={13} style={{ marginRight: 4 }} />
              {tc({ en: "Mark all read", hi: "सभी पढ़ा", bn: "সব পঠিত" })}
            </Button>
          )}
          {notifs.length > 0 && (
            <Button size="sm" variant="soft" onClick={handleDismissAll}>
              <Trash2 size={13} style={{ marginRight: 4 }} />
              {tc({ en: "Dismiss all", hi: "सभी हटाएं", bn: "সব বাতিল" })}
            </Button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowAll(a => !a)}
            style={{ fontSize: 12.5, color: T.primary, background: "none", border: "none",
              cursor: "pointer", fontFamily: T.body }}>
            {showAll
              ? tc({ en: "Unread only", hi: "केवल अपठित", bn: "কেবল অপঠিত" })
              : tc({ en: "Show all", hi: "सभी दिखाएं", bn: "সব দেখান" })}
          </button>
        </div>

        {/* Unread summary chip */}
        {unread > 0 && (
          <div style={{ background: `${T.primary}14`, borderRadius: 10, padding: "8px 12px",
            fontSize: 13, color: T.primary, fontWeight: 600 }}>
            {unread} {tc({ en: "unread", hi: "अपठित", bn: "অপঠিত" })}
          </div>
        )}

        {/* Notification list */}
        {notifs.length === 0 ? (
          <EmptyState icon="Bell"
            title={tc({ en: "All caught up!", hi: "कोई नई सूचना नहीं", bn: "সব আপ টু ডেট!" })}
            body={tc({ en: "Tap 'Check alerts' to scan for new conditions.", hi: "नई स्थितियाँ जाँचने के लिए 'अलर्ट जाँचें' पर टैप करें।", bn: "নতুন অবস্থার জন্য 'সতর্কতা পরীক্ষা করুন' ট্যাপ করুন।" })} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifs.map(n => (
              <NotifCard key={n.id} notif={n} tc={tc}
                onMarkRead={handleMarkRead}
                onDismiss={handleDismiss}
                onNavigate={handleNavigate} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
