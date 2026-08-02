import { useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card, BottomSheet } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { usePrefs } from "../customize/PreferencesProvider.jsx";
import { ACCENTS, CARD_STYLES, DISPLAY_SIZES } from "../customize/appearance.js";

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

        <Section title={tc({ en: "Display size", hi: "प्रदर्शन आकार", bn: "প্রদর্শন আকার" })}>
          <Segmented options={Object.entries(DISPLAY_SIZES).map(([v, d]) => ({ value: v, label: d.label }))}
            value={a.displaySize} onChange={(v) => set("appearance.displaySize", v)} />
        </Section>

        <Section title={tc({ en: "Accessibility", hi: "सुलभता", bn: "অ্যাক্সেসিবিলিটি" })}>
          <Card pad={6}>
            <Row label={tc({ en: "High contrast", hi: "उच्च कंट्रास्ट", bn: "উচ্চ কনট্রাস্ট" })}>
              <Toggle on={a.highContrast} onChange={(v) => set("appearance.highContrast", v)} />
            </Row>
            <Row label={tc({ en: "Larger text", hi: "बड़ा टेक्स्ट", bn: "বড় লেখা" })} last>
              <Toggle on={prefs.accessibility.largerText} onChange={(v) => { set("accessibility.largerText", v); set("appearance.displaySize", v ? "spacious" : "comfortable"); }} />
            </Row>
          </Card>
        </Section>

        <Section title={tc({ en: "Backup & reset", hi: "बैकअप और रीसेट", bn: "ব্যাকআপ ও রিসেট" })}>
          <Card pad={6}>
            <Row label={tc({ en: "Copy settings (backup)", hi: "सेटिंग्स कॉपी करें", bn: "সেটিংস কপি করুন" })} onClick={copyBackup}>
              <Icon name="Copy" size={18} style={{ color: T.inkFaint }} />
            </Row>
            <Row label={tc({ en: "Restore from backup", hi: "बैकअप से बहाल करें", bn: "ব্যাকআপ থেকে পুনরুদ্ধার" })} onClick={() => setRestoreOpen(true)}>
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
