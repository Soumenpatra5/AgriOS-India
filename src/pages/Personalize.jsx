import { useState, useRef, useEffect } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card, BottomSheet } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { notificationService } from "../services/notifications/notificationService.js";
import { usePrefs } from "../customize/PreferencesProvider.jsx";
import { ACCENTS, CARD_STYLES, DISPLAY_SIZES } from "../customize/appearance.js";
import { FARMER_TYPES, TYPE_LABELS } from "../customize/farmerTypes.js";
import LocationPicker from "../components/geo/LocationPicker.jsx";
import { readRegion, writeRegion } from "../services/geo/regionPrefs.js";

const WIDGET_LABELS = {
  weather:      { en: "Weather", hi: "मौसम", bn: "আবহাওয়া" },
  summary:      { en: "Farm summary", hi: "खेत सारांश", bn: "খামার সারসংক্ষেপ" },
  quickActions: { en: "AI quick actions", hi: "AI त्वरित क्रियाएँ", bn: "AI দ্রুত ক্রিয়া" },
  services:     { en: "My services", hi: "मेरी सेवाएँ", bn: "আমার সেবা" },
  tasks:        { en: "Today's tasks", hi: "आज के काम", bn: "আজকের কাজ" },
  diagnostics:  { en: "AI diagnostics", hi: "AI निदान", bn: "AI রোগ নির্ণয়" },
  schemes:      { en: "Govt schemes", hi: "सरकारी योजनाएँ", bn: "সরকারি স্কিম" },
  disease:      { en: "Disease detection", hi: "रोग पहचान", bn: "রোগ শনাক্তকরণ" },
  calculators:  { en: "Calculators", hi: "कैलकुलेटर", bn: "ক্যালকুলেটর" },
  news:         { en: "News", hi: "समाचार", bn: "খবর" },
};
const TAB_LABELS = {
  farmSpace: { en: "Farm Space", hi: "फ़ार्म स्पेस", bn: "ফার্ম স্পেস" },
  ai:        { en: "AI", hi: "AI", bn: "AI" },
  services:  { en: "Services", hi: "सेवाएँ", bn: "সেবা" },
};

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: .4, marginBottom: 10, padding: "0 2px" }}>{title}</div>
      {children}
    </div>
  );
}

/* Segmented control for a small set of options. */
function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            style={{ flex: "1 1 auto", minWidth: 80, padding: "11px 12px", borderRadius: T.rMd, cursor: "pointer", fontFamily: T.body,
              fontSize: 13.5, fontWeight: 600, background: on ? T.primarySoft : T.surface,
              border: `1.5px solid ${on ? T.primary : T.line}`, color: on ? T.primary : T.inkSoft, transition: "all .16s var(--ag-ease)" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* Touch/mouse drag-and-drop reorder for a vertical list of rows.
   Reads live row height from the DOM so it works at any display size /
   text scale, and shifts sibling rows as a live preview while dragging. */
function DragReorderList({ items, renderRow, onReorder }) {
  const { tc } = useApp();
  const [dragIdx, setDragIdx] = useState(null);
  const [dragY, setDragY] = useState(0);
  const startY = useRef(0);
  const rowH = useRef(52);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const currentIdx = dragIdx === null ? null
    : Math.min(items.length - 1, Math.max(0, dragIdx + Math.round(dragY / rowH.current)));

  useEffect(() => {
    if (dragIdx === null) return;
    const pos = (e) => (e.touches ? e.touches[0] : e);
    const move = (e) => { e.preventDefault(); setDragY(pos(e).clientY - startY.current); };
    const up = (e) => {
      const finalDelta = pos(e).clientY - startY.current;
      const target = Math.min(itemsRef.current.length - 1, Math.max(0, dragIdx + Math.round(finalDelta / rowH.current)));
      if (target !== dragIdx) {
        const next = [...itemsRef.current];
        const [moved] = next.splice(dragIdx, 1);
        next.splice(target, 0, moved);
        onReorder(next);
      }
      setDragIdx(null);
      setDragY(0);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [dragIdx, onReorder]);

  const startDrag = (idx) => (e) => {
    if (e.cancelable) e.preventDefault();
    const row = e.currentTarget.closest("[data-drag-row]");
    if (row) rowH.current = row.offsetHeight;
    startY.current = (e.touches ? e.touches[0] : e).clientY;
    setDragIdx(idx);
    setDragY(0);
  };

  return items.map((id, idx) => {
    let translateY = 0;
    if (dragIdx !== null) {
      if (idx === dragIdx) translateY = dragY;
      else if (dragIdx < currentIdx && idx > dragIdx && idx <= currentIdx) translateY = -rowH.current;
      else if (dragIdx > currentIdx && idx < dragIdx && idx >= currentIdx) translateY = rowH.current;
    }
    const dragging = idx === dragIdx;
    return (
      <div key={id} data-drag-row
        style={{ position: "relative", zIndex: dragging ? 2 : 1, background: dragging ? T.surface : "transparent",
          borderRadius: dragging ? T.rMd : 0, boxShadow: dragging ? T.shadowMd : "none",
          transform: `translateY(${translateY}px)`, transition: dragging ? "none" : "transform .18s var(--ag-ease)" }}>
        {renderRow(id, idx, <button onPointerDown={startDrag(idx)} onTouchStart={startDrag(idx)} aria-label={tc({ en: "Drag to reorder", hi: "क्रम बदलने के लिए खींचें", bn: "ক্রম বদলাতে টেনে আনুন" })}
          style={{ background: "none", border: "none", cursor: dragging ? "grabbing" : "grab", color: T.inkFaint,
            display: "flex", padding: 4, touchAction: "none" }}>
          <Icon name="GripVertical" size={17} />
        </button>)}
      </div>
    );
  });
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on}
      style={{ width: 46, height: 28, borderRadius: 999, border: "none", cursor: "pointer", padding: 3, flexShrink: 0,
        background: on ? T.primary : T.line, transition: "background .2s var(--ag-ease)" }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", transform: `translateX(${on ? 18 : 0}px)`,
        transition: "transform .2s var(--ag-ease)", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
    </button>
  );
}

export default function Personalize() {
  const { pop, tc, toast } = useApp();
  const { prefs, set, reset, exportPrefs, importPrefs } = usePrefs();
  const a = prefs.appearance;
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreText, setRestoreText] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const themeOpts = [
    { value: "light", label: tc({ en: "Light", hi: "लाइट", bn: "লাইট" }) },
    { value: "dark", label: tc({ en: "Dark", hi: "डार्क", bn: "ডার্ক" }) },
    { value: "system", label: tc({ en: "System", hi: "सिस्टम", bn: "সিস্টেম" }) },
  ];

  const fileRef = useRef(null);

  const setPush = async (v) => {
    if (v && notificationService.getPermission() !== "granted") {
      const res = await notificationService.requestPermission();
      const granted = res === "granted";
      set("notifications.push", granted);
      notificationService.setEnabled(granted);
      toast(granted ? tc({ en: "Push notifications on", hi: "पुश सूचनाएँ चालू", bn: "পুশ বিজ্ঞপ্তি চালু" }) : tc({ en: "Blocked — enable in browser settings", hi: "ब्लॉक — ब्राउज़र सेटिंग्स में चालू करें", bn: "ব্লক — ব্রাউজার সেটিংসে চালু করুন" }), granted ? "success" : "info");
      return;
    }
    set("notifications.push", v);
    notificationService.setEnabled(v);
  };

  const downloadBackup = () => {
    const blob = new Blob([exportPrefs()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "agrios-settings.json"; a.click();
    URL.revokeObjectURL(url);
    toast(tc({ en: "Backup downloaded", hi: "बैकअप डाउनलोड हुआ", bn: "ব্যাকআপ ডাউনলোড হয়েছে" }), "success");
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const res = importPrefs(String(r.result));
      toast(res.ok ? tc({ en: "Settings restored", hi: "सेटिंग्स बहाल हुईं", bn: "সেটিংস পুনরুদ্ধার হয়েছে" }) : tc({ en: "Invalid backup file", hi: "अमान्य बैकअप फ़ाइल", bn: "অবৈধ ব্যাকআপ ফাইল" }), res.ok ? "success" : "error");
    };
    r.readAsText(f);
  };

  const moveWidget = (id, dir) => {
    const order = [...prefs.dashboard.order];
    const i = order.indexOf(id), j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    set("dashboard.order", order);
  };

  const copyBackup = async () => {
    try { await navigator.clipboard.writeText(exportPrefs()); toast(tc({ en: "Settings copied to clipboard", hi: "सेटिंग्स कॉपी हुईं", bn: "সেটিংস কপি হয়েছে" }), "success"); }
    catch { toast(tc({ en: "Couldn't copy", hi: "कॉपी नहीं हुआ", bn: "কপি করা যায়নি" }), "error"); }
  };

  const applyRestore = () => {
    const r = importPrefs(restoreText.trim());
    if (r.ok) { toast(tc({ en: "Settings restored", hi: "सेटिंग्स बहाल हुईं", bn: "সেটিংস পুনরুদ্ধার হয়েছে" }), "success"); setRestoreOpen(false); setRestoreText(""); }
    else toast(tc({ en: "Invalid settings text", hi: "अमान्य सेटिंग्स", bn: "অবৈধ সেটিংস" }), "error");
  };

  return (
    <>
      <AppBar title={tc({ en: "Personalize", hi: "अनुकूलित करें", bn: "ব্যক্তিগতকরণ" })} onBack={pop} />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 20, animation: "ag-fade .25s var(--ag-ease)" }}>

        <Section title={tc({ en: "Theme", hi: "थीम", bn: "থিম" })}>
          <Segmented options={themeOpts} value={a.theme} onChange={(v) => set("appearance.theme", v)} />
        </Section>

        <Section title={tc({ en: "Accent color", hi: "एक्सेंट रंग", bn: "অ্যাকসেন্ট রঙ" })}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {Object.entries(ACCENTS).map(([key, def]) => {
              const on = a.accent === key;
              return (
                <button key={key} onClick={() => set("appearance.accent", key)} aria-label={def.label}
                  style={{ width: 40, height: 40, borderRadius: "50%", cursor: "pointer", background: def.light.p,
                    border: `3px solid ${on ? T.ink : "transparent"}`, outline: on ? `2px solid ${def.light.p}` : "none", outlineOffset: 2, transition: "all .15s" }} />
              );
            })}
          </div>
        </Section>

        <Section title={tc({ en: "Card style", hi: "कार्ड शैली", bn: "কার্ড স্টাইল" })}>
          <Segmented options={Object.entries(CARD_STYLES).map(([v, d]) => ({ value: v, label: d.label }))}
            value={a.cardStyle} onChange={(v) => set("appearance.cardStyle", v)} />
        </Section>

        <Section title={tc({ en: "List view", hi: "सूची दृश्य", bn: "তালিকা ভিউ" })}>
          <Segmented
            options={[
              { value: "grid", label: tc({ en: "Grid", hi: "ग्रिड", bn: "গ্রিড" }) },
              { value: "list", label: tc({ en: "List", hi: "सूची", bn: "তালিকা" }) },
            ]}
            value={prefs.layout.view} onChange={(v) => set("layout.view", v)} />
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 6, padding: "0 2px" }}>
            {tc({ en: "How the AI assistants and services are shown.", hi: "AI सहायक और सेवाएँ कैसे दिखें।", bn: "AI সহায়ক ও সেবা কীভাবে দেখানো হয়।" })}
          </div>
        </Section>

        <Section title={tc({ en: "Display size", hi: "प्रदर्शन आकार", bn: "প্রদর্শন আকার" })}>
          <Segmented options={Object.entries(DISPLAY_SIZES).map(([v, d]) => ({ value: v, label: d.label }))}
            value={a.displaySize} onChange={(v) => set("appearance.displaySize", v)} />
        </Section>

        <Section title={tc({ en: "Accessibility", hi: "सुलभता", bn: "অ্যাক্সেসিবিলিটি" })}>
          <Card pad={6}>
            <Row label={tc({ en: "High contrast", hi: "उच्च कंट्रास्ट", bn: "উচ্চ কনট্রাস্ট" })}>
              <Toggle on={a.highContrast} onChange={(v) => set("appearance.highContrast", v)} />
            </Row>
            <Row label={tc({ en: "Larger text", hi: "बड़ा टेक्स्ट", bn: "বড় লেখা" })}>
              <Toggle on={prefs.accessibility.largerText} onChange={(v) => { set("accessibility.largerText", v); set("appearance.displaySize", v ? "spacious" : "comfortable"); }} />
            </Row>
            <Row label={tc({ en: "Reduce motion", hi: "गति कम करें", bn: "মোশন কমান" })} last>
              <Toggle on={prefs.accessibility.reduceMotion} onChange={(v) => set("accessibility.reduceMotion", v)} />
            </Row>
          </Card>
        </Section>

        <Section title={tc({ en: "Dashboard widgets", hi: "डैशबोर्ड विजेट", bn: "ড্যাশবোর্ড উইজেট" })}>
          <Card pad={6}>
            <DragReorderList items={prefs.dashboard.order} onReorder={(next) => set("dashboard.order", next)}
              renderRow={(id, idx, handle) => (
                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 12px",
                  borderTop: idx ? `1px solid ${T.lineSoft}` : "none" }}>
                  {handle}
                  <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: prefs.dashboard.widgets[id] === false ? T.inkFaint : T.ink }}>{tc(WIDGET_LABELS[id] || { en: id })}</span>
                  <button onClick={() => moveWidget(id, -1)} disabled={idx === 0} aria-label={tc({ en: "move up", hi: "ऊपर ले जाएँ", bn: "উপরে নিন" })}
                    style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? T.inkFaint : T.inkSoft, opacity: idx === 0 ? .35 : 1, display: "flex", padding: 2 }}>
                    <Icon name="ChevronUp" size={16} />
                  </button>
                  <button onClick={() => moveWidget(id, 1)} disabled={idx === prefs.dashboard.order.length - 1} aria-label={tc({ en: "move down", hi: "नीचे ले जाएँ", bn: "নিচে নিন" })}
                    style={{ background: "none", border: "none", cursor: idx === prefs.dashboard.order.length - 1 ? "default" : "pointer", color: T.inkSoft, opacity: idx === prefs.dashboard.order.length - 1 ? .35 : 1, display: "flex", padding: 2 }}>
                    <Icon name="ChevronDown" size={16} />
                  </button>
                  <Toggle on={prefs.dashboard.widgets[id] !== false} onChange={(v) => set(`dashboard.widgets.${id}`, v)} />
                </div>
              )} />
          </Card>
        </Section>

        <Section title={tc({ en: "Farmer profile", hi: "किसान प्रोफ़ाइल", bn: "কৃষক প্রোফাইল" })}>
          <Card pad={6}>
            {FARMER_TYPES.map((k, idx) => (
              <Row key={k} label={tc(TYPE_LABELS[k])} last={idx === FARMER_TYPES.length - 1}>
                <Toggle on={prefs.farmerProfile.types[k] !== false} onChange={(v) => set(`farmerProfile.types.${k}`, v)} />
              </Row>
            ))}
          </Card>
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 6, padding: "0 2px" }}>
            {tc({ en: "Turn off what you don't farm — diagnostics and livestock tailor to you.", hi: "जो आप नहीं करते उसे बंद करें — निदान और पशुपालन आपके अनुसार दिखेंगे।", bn: "যা করেন না তা বন্ধ করুন — রোগ নির্ণয় ও পশুপালন আপনার অনুযায়ী দেখাবে।" })}
          </div>
        </Section>

        <Section title={tc({ en: "Region", hi: "क्षेत्र", bn: "অঞ্চল" })}>
          <Card pad={12} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <LocationPicker value={readRegion()} onChange={(next) => { writeRegion(next); set("region.stateId", next.stateId); }} labels={false} />
          </Card>
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 6, padding: "0 2px" }}>
            {tc({ en: "Used to pull mandi prices for your state.", hi: "आपके राज्य के मंडी भाव के लिए उपयोग होता है।", bn: "আপনার রাজ্যের মান্ডি দর আনতে ব্যবহৃত হয়।" })}
          </div>
        </Section>

        <Section title={tc({ en: "Bottom navigation", hi: "नीचे नेविगेशन", bn: "নিচের নেভিগেশন" })}>
          <Card pad={6}>
            {Object.keys(TAB_LABELS).map((k, idx) => (
              <Row key={k} label={tc(TAB_LABELS[k])} last={idx === Object.keys(TAB_LABELS).length - 1}>
                <Toggle on={prefs.nav.tabs[k] !== false} onChange={(v) => set(`nav.tabs.${k}`, v)} />
              </Row>
            ))}
          </Card>
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 6, padding: "0 2px" }}>
            {tc({ en: "Home and Profile are always shown.", hi: "होम और प्रोफ़ाइल हमेशा दिखते हैं।", bn: "হোম ও প্রোফাইল সবসময় দেখানো হয়।" })}
          </div>
        </Section>

        <Section title={tc({ en: "Notifications", hi: "सूचनाएँ", bn: "বিজ্ঞপ্তি" })}>
          <Card pad={6}>
            <Row label={tc({ en: "Push notifications", hi: "पुश सूचनाएँ", bn: "পুশ বিজ্ঞপ্তি" })}>
              <Toggle on={prefs.notifications.push} onChange={setPush} />
            </Row>
            <Row label={tc({ en: "SMS", hi: "एसएमएस", bn: "এসএমএস" })}>
              <Toggle on={prefs.notifications.sms} onChange={(v) => set("notifications.sms", v)} />
            </Row>
            <Row label={tc({ en: "Email", hi: "ईमेल", bn: "ইমেইল" })} last>
              <Toggle on={prefs.notifications.email} onChange={(v) => set("notifications.email", v)} />
            </Row>
          </Card>
        </Section>

        <Section title={tc({ en: "Offline data", hi: "ऑफ़लाइन डेटा", bn: "অফলাইন ডেটা" })}>
          <Segmented
            options={[
              { value: "auto", label: tc({ en: "Auto", hi: "स्वतः", bn: "স্বয়ং" }) },
              { value: "aggressive", label: tc({ en: "Save more", hi: "ज़्यादा सहेजें", bn: "বেশি সংরক্ষণ" }) },
              { value: "off", label: tc({ en: "Local only", hi: "केवल डिवाइस", bn: "শুধু ডিভাইস" }) },
            ]}
            value={prefs.offline.mode} onChange={(v) => set("offline.mode", v)} />
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 6, padding: "0 2px" }}>
            {tc({ en: "“Local only” keeps your data on this device and won't sync to the cloud.", hi: "“केवल डिवाइस” आपका डेटा इसी डिवाइस पर रखता है, क्लाउड सिंक नहीं करता।", bn: "“শুধু ডিভাইস” আপনার তথ্য এই ডিভাইসেই রাখে, ক্লাউডে সিঙ্ক করে না।" })}
          </div>
        </Section>

        <Section title={tc({ en: "Backup & reset", hi: "बैकअप और रीसेट", bn: "ব্যাকআপ ও রিসেট" })}>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
          <Card pad={6}>
            <Row label={tc({ en: "Download backup file", hi: "बैकअप फ़ाइल डाउनलोड करें", bn: "ব্যাকআপ ফাইল ডাউনলোড করুন" })} onClick={downloadBackup}>
              <Icon name="Download" size={18} style={{ color: T.inkFaint }} />
            </Row>
            <Row label={tc({ en: "Restore from file", hi: "फ़ाइल से बहाल करें", bn: "ফাইল থেকে পুনরুদ্ধার" })} onClick={() => fileRef.current?.click()}>
              <Icon name="Upload" size={18} style={{ color: T.inkFaint }} />
            </Row>
            <Row label={tc({ en: "Copy settings (backup)", hi: "सेटिंग्स कॉपी करें", bn: "সেটিংস কপি করুন" })} onClick={copyBackup}>
              <Icon name="Copy" size={18} style={{ color: T.inkFaint }} />
            </Row>
            <Row label={tc({ en: "Restore from text", hi: "टेक्स्ट से बहाल करें", bn: "টেক্সট থেকে পুনরুদ্ধার" })} onClick={() => setRestoreOpen(true)}>
              <Icon name="Upload" size={18} style={{ color: T.inkFaint }} />
            </Row>
            <Row label={tc({ en: "Reset to default", hi: "डिफ़ॉल्ट पर रीसेट", bn: "ডিফল্টে রিসেট" })} onClick={() => setConfirmReset(true)} last danger>
              <Icon name="RotateCcw" size={18} style={{ color: T.red }} />
            </Row>
          </Card>
        </Section>

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          {tc({ en: "Your preferences are saved on this device and synced to your account.", hi: "आपकी सेटिंग्स इस डिवाइस पर सहेजी और आपके खाते में सिंक होती हैं।", bn: "আপনার সেটিংস এই ডিভাইসে সংরক্ষিত ও আপনার অ্যাকাউন্টে সিঙ্ক হয়।" })}
        </div>
      </div>

      <BottomSheet open={restoreOpen} onClose={() => setRestoreOpen(false)} title={tc({ en: "Restore settings", hi: "सेटिंग्स बहाल करें", bn: "সেটিংস পুনরুদ্ধার" })}>
        <textarea value={restoreText} onChange={(e) => setRestoreText(e.target.value)}
          placeholder={tc({ en: "Paste your backup text here…", hi: "अपना बैकअप टेक्स्ट यहाँ पेस्ट करें…", bn: "আপনার ব্যাকআপ টেক্সট এখানে পেস্ট করুন…" })}
          style={{ width: "100%", minHeight: 120, padding: 12, borderRadius: T.rMd, border: `1px solid ${T.line}`, background: T.surface2,
            color: T.ink, fontFamily: T.body, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical" }} />
        <button onClick={applyRestore} disabled={!restoreText.trim()}
          style={{ width: "100%", marginTop: 12, padding: "13px", borderRadius: T.pill, border: "none", background: T.primary, color: T.onPrimary,
            fontFamily: T.body, fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: restoreText.trim() ? 1 : .4 }}>
          {tc({ en: "Restore", hi: "बहाल करें", bn: "পুনরুদ্ধার" })}
        </button>
      </BottomSheet>

      <BottomSheet open={confirmReset} onClose={() => setConfirmReset(false)} title={tc({ en: "Reset all settings?", hi: "सभी सेटिंग्स रीसेट करें?", bn: "সব সেটিংস রিসেট করবেন?" })}>
        <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5, marginBottom: 16 }}>
          {tc({ en: "This restores every preference to its default. Your farm data is not affected.", hi: "यह हर सेटिंग को डिफ़ॉल्ट पर लौटाता है। आपका खेत डेटा प्रभावित नहीं होता।", bn: "এটি প্রতিটি সেটিং ডিফল্টে ফেরায়। আপনার খামারের তথ্য প্রভাবিত হয় না।" })}
        </div>
        <button onClick={() => { reset(); setConfirmReset(false); toast(tc({ en: "Reset to defaults", hi: "डिफ़ॉल्ट पर रीसेट", bn: "ডিফল্টে রিসেট" }), "success"); }}
          style={{ width: "100%", padding: "13px", borderRadius: T.pill, border: "none", background: T.red, color: "#fff",
            fontFamily: T.body, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          {tc({ en: "Reset everything", hi: "सब रीसेट करें", bn: "সব রিসেট করুন" })}
        </button>
      </BottomSheet>
    </>
  );
}

function Row({ label, children, onClick, last, danger }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 12px",
      borderTop: last ? "none" : `1px solid ${T.lineSoft}`, cursor: onClick ? "pointer" : "default" }}>
      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: danger ? T.red : T.ink }}>{label}</span>
      {children}
    </div>
  );
}
