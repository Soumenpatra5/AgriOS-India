import { useState, useEffect, useCallback } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card, Dialog } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { conversationStore, responseCache } from "../ai/index.js";
import { reminderService } from "../services/calendar/reminderService.js";
import { priceAlertService } from "../services/market/priceAlerts.js";
import { errorLog } from "../utils/errorLog.js";

const NS = "agrios:";

/* Rough on-device localStorage footprint for agrios: keys, in bytes. */
function localStorageBytes() {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS)) bytes += k.length + (localStorage.getItem(k)?.length || 0);
    }
  } catch { /* storage blocked */ }
  return bytes * 2; // UTF-16 code units → bytes
}

function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function StorageManager() {
  const { pop, tc, toast, push } = useApp();
  const [tick, setTick] = useState(0);
  const [estimate, setEstimate] = useState(null);
  const [confirm, setConfirm] = useState(null); // { title, body, run }

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const counts = {
    chats: conversationStore.list().length,
    aiCache: responseCache.count(),
    reminders: reminderService.count(),
    alerts: priceAlertService.getAll().length,
  };
  const errors = errorLog.all();
  const localBytes = localStorageBytes();

  const clearErrors = () => { errorLog.clear(); refresh(); toast(tc({ en: "Error log cleared", hi: "त्रुटि लॉग साफ़", bn: "ত্রুটি লগ মুছে গেছে" }), "success"); };

  useEffect(() => {
    let alive = true;
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((e) => { if (alive) setEstimate(e); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [tick]);

  const usagePct = estimate?.quota ? Math.min(100, Math.round((estimate.usage / estimate.quota) * 100)) : null;

  const clearChats = () => { conversationStore.list().forEach((c) => conversationStore.remove(c.id)); refresh(); toast(tc({ en: "Chat history cleared", hi: "बातचीत इतिहास साफ़", bn: "কথোপকথন ইতিহাস মুছে গেছে" }), "success"); };
  const clearCache = () => { responseCache.clear(); refresh(); toast(tc({ en: "AI cache cleared", hi: "AI कैश साफ़", bn: "AI ক্যাশ মুছে গেছে" }), "success"); };
  const clearReminders = () => { reminderService.clear(); refresh(); toast(tc({ en: "Reminders cleared", hi: "रिमाइंडर साफ़", bn: "রিমাইন্ডার মুছে গেছে" }), "success"); };

  const ask = (title, body, run) => setConfirm({ title, body, run });

  return (
    <>
      <AppBar title={tc({ en: "Storage & Data", hi: "स्टोरेज और डेटा", bn: "স্টোরেজ ও ডেটা" })} onBack={pop} />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 16, animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* usage overview */}
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: T.primarySoft, color: T.primary, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="Database" size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700 }}>{tc({ en: "On-device data", hi: "डिवाइस पर डेटा", bn: "ডিভাইসে ডেটা" })}</div>
              <div style={{ fontSize: 12.5, color: T.inkSoft }}>
                {tc({ en: "App data", hi: "ऐप डेटा", bn: "অ্যাপ ডেটা" })}: {fmtBytes(localBytes)}
                {estimate?.usage != null && ` · ${tc({ en: "total", hi: "कुल", bn: "মোট" })} ${fmtBytes(estimate.usage)}`}
              </div>
            </div>
          </div>
          {usagePct != null && (
            <div>
              <div style={{ height: 8, borderRadius: 4, background: T.surface2, overflow: "hidden" }}>
                <div style={{ width: `${usagePct}%`, height: "100%", background: usagePct > 85 ? T.red : T.primary, transition: "width .3s var(--ag-ease)" }} />
              </div>
              <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 5 }}>
                {tc({ en: `${usagePct}% of available space used`, hi: `उपलब्ध स्थान का ${usagePct}% उपयोग`, bn: `উপলব্ধ স্থানের ${usagePct}% ব্যবহৃত` })}
              </div>
            </div>
          )}
        </Card>

        {/* breakdown + clear actions */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: .4, marginBottom: 8, padding: "0 2px" }}>
            {tc({ en: "Manage data", hi: "डेटा प्रबंधित करें", bn: "ডেটা পরিচালনা" })}
          </div>
          <Card pad={6}>
            <DataRow icon="MessageCircle" label={tc({ en: "Chat history", hi: "बातचीत इतिहास", bn: "কথোপকথন ইতিহাস" })}
              count={counts.chats} clearLabel={tc({ en: "Clear", hi: "साफ़", bn: "মুছুন" })}
              onClear={() => ask(tc({ en: "Clear chat history?", hi: "बातचीत इतिहास साफ़ करें?", bn: "কথোপকথন ইতিহাস মুছবেন?" }),
                tc({ en: "All saved AI conversations will be deleted from this device.", hi: "सभी सहेजी गई AI बातचीत इस डिवाइस से हटा दी जाएँगी।", bn: "সমস্ত সংরক্ষিত AI কথোপকথন এই ডিভাইস থেকে মুছে যাবে।" }), clearChats)} />
            <DataRow icon="Sparkles" label={tc({ en: "AI response cache", hi: "AI उत्तर कैश", bn: "AI উত্তর ক্যাশ" })}
              count={counts.aiCache} clearLabel={tc({ en: "Clear", hi: "साफ़", bn: "মুছুন" })}
              onClear={() => ask(tc({ en: "Clear AI cache?", hi: "AI कैश साफ़ करें?", bn: "AI ক্যাশ মুছবেন?" }),
                tc({ en: "Cached answers used for instant offline replies will be removed.", hi: "तुरंत ऑफ़लाइन उत्तरों के लिए कैश किए गए जवाब हटा दिए जाएँगे।", bn: "তাৎক্ষণিক অফলাইন উত্তরের জন্য ক্যাশ করা জবাব মুছে যাবে।" }), clearCache)} />
            <DataRow icon="Bell" label={tc({ en: "Task reminders", hi: "कार्य रिमाइंडर", bn: "কাজের রিমাইন্ডার" })}
              count={counts.reminders} clearLabel={tc({ en: "Clear", hi: "साफ़", bn: "মুছুন" })}
              onClear={() => ask(tc({ en: "Clear all reminders?", hi: "सभी रिमाइंडर साफ़ करें?", bn: "সমস্ত রিমাইন্ডার মুছবেন?" }),
                tc({ en: "Scheduled crop-task reminders will be cancelled.", hi: "निर्धारित फसल-कार्य रिमाइंडर रद्द कर दिए जाएँगे।", bn: "নির্ধারিত ফসল-কাজের রিমাইন্ডার বাতিল হবে।" }), clearReminders)} />
            <DataRow icon="TrendingUp" label={tc({ en: "Price alerts", hi: "मूल्य अलर्ट", bn: "মূল্য সতর্কতা" })}
              count={counts.alerts} last
              clearLabel={counts.alerts ? tc({ en: "Manage", hi: "प्रबंधित", bn: "পরিচালনা" }) : ""}
              onClear={counts.alerts ? () => push({ kind: "mandiPrices" }) : undefined} />
          </Card>
        </div>

        {/* backup shortcut */}
        <Card pad={6}>
          <div onClick={() => push({ kind: "settings" })} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 12px", cursor: "pointer" }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: T.surface2, color: T.inkSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="Download" size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 500 }}>{tc({ en: "Backup & restore", hi: "बैकअप और पुनर्स्थापना", bn: "ব্যাকআপ ও পুনরুদ্ধার" })}</div>
              <div style={{ fontSize: 12.5, color: T.inkSoft }}>{tc({ en: "Export or import all your data", hi: "अपना सारा डेटा निर्यात या आयात करें", bn: "আপনার সমস্ত ডেটা রপ্তানি বা আমদানি করুন" })}</div>
            </div>
            <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
          </div>
        </Card>

        {/* recent errors — only when something has crashed */}
        {errors.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8, padding: "0 2px" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: .4 }}>
                {tc({ en: "Recent errors", hi: "हाल की त्रुटियाँ", bn: "সাম্প্রতিক ত্রুটি" })}
              </span>
              <button onClick={clearErrors} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.primary, fontSize: 12.5, fontWeight: 600, fontFamily: T.body }}>
                {tc({ en: "Clear", hi: "साफ़", bn: "মুছুন" })}
              </button>
            </div>
            <Card pad={6}>
              {errors.slice(0, 5).map((e, i) => (
                <div key={i} style={{ padding: "10px 12px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, wordBreak: "break-word" }}>{e.message}</div>
                  <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 2 }}>
                    {new Date(e.time).toLocaleString()}
                  </div>
                </div>
              ))}
            </Card>
            <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 6, padding: "0 2px" }}>
              {tc({ en: "Stored on this device only — nothing is sent anywhere.", hi: "केवल इस डिवाइस पर संग्रहीत — कहीं नहीं भेजा जाता।", bn: "শুধু এই ডিভাইসে সংরক্ষিত — কোথাও পাঠানো হয় না।" })}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6, padding: "0 8px" }}>
          {tc({ en: "All data is stored on this device. Clearing data here cannot be undone — back up first if unsure.",
            hi: "सारा डेटा इस डिवाइस पर संग्रहीत है। यहाँ डेटा साफ़ करना पूर्ववत नहीं किया जा सकता — अनिश्चित हों तो पहले बैकअप लें।",
            bn: "সমস্ত ডেটা এই ডিভাইসে সংরক্ষিত। এখানে ডেটা মোছা পূর্বাবস্থায় ফেরানো যায় না — নিশ্চিত না হলে আগে ব্যাকআপ নিন।" })}
        </div>
      </div>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title} body={confirm?.body}
        icon="Trash2" danger
        confirmLabel={tc({ en: "Clear", hi: "साफ़ करें", bn: "মুছুন" })}
        cancelLabel={tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" })}
        onConfirm={() => { confirm?.run?.(); setConfirm(null); }} />
    </>
  );
}

function DataRow({ icon, label, count, clearLabel, onClear, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 12px", borderTop: last ? "none" : undefined }}>
      <div style={{ width: 36, height: 36, borderRadius: 11, background: T.surface2, color: T.inkSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name={icon} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 500, color: T.ink }}>{label}</div>
        <div style={{ fontSize: 12.5, color: T.inkSoft }}>{count} {count === 1 ? "item" : "items"}</div>
      </div>
      {clearLabel && onClear && (
        <button onClick={onClear} disabled={!count}
          style={{ background: count ? T.surface2 : "transparent", border: "none", borderRadius: 9, padding: "7px 12px",
            cursor: count ? "pointer" : "default", color: count ? T.primary : T.inkFaint, fontSize: 12.5, fontWeight: 600, fontFamily: T.body }}>
          {clearLabel}
        </button>
      )}
    </div>
  );
}
