import { useEffect, useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { usePrefs } from "../customize/PreferencesProvider.jsx";
import { filterByType } from "../customize/farmerTypes.js";
import { domainRegistry } from "../services/diagnostics/domainRegistry.js";
import { historyService } from "../services/diagnostics/historyService.js";
import { consentService } from "../services/diagnostics/consentService.js";
import DiagnosticCard from "../components/DiagnosticCard.jsx";

const ACCENT_COLORS = {
  primary: { bg: "var(--ag-primary-soft)", fg: "var(--ag-primary)" },
  orange:  { bg: "var(--ag-orange-soft)",  fg: "var(--ag-orange)"  },
  blue:    { bg: "var(--ag-blue-soft)",    fg: "var(--ag-blue)"    },
  yellow:  { bg: "var(--ag-yellow-soft)",  fg: "var(--ag-yellow)"  },
  red:     { bg: "var(--ag-red-soft)",     fg: "var(--ag-red)"     },
};

export default function DiagnosticsHome() {
  const { pop, push, tc } = useApp();
  const { prefs } = usePrefs();
  // Show only the enterprises the farmer runs (Personalize → Farmer profile).
  const domains = filterByType(prefs, domainRegistry.getAll());
  const [recent,  setRecent]  = useState([]);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    setConsent(consentService.hasAll());
    historyService.getAll({ limit: 4 }).then(setRecent).catch(() => {});
  }, []);

  const startFlow = (domainId) => {
    if (!consent) {
      push({ kind: "diagnosticConsent", props: { domainId } });
    } else {
      push({ kind: "diagnosticFlow", props: { domainId } });
    }
  };

  const openResult = (record) => push({ kind: "diagnosticResult", props: { record } });

  return (
    <>
      <AppBar title={tc({en:"AI Diagnostics", hi:"AI निदान", bn:"AI রোগ নির্ণয়"})} onBack={pop}
        action={
          <button onClick={() => push({ kind: "diagnosticHistory" })}
            style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12,
              padding: 8, cursor: "pointer", color: T.ink, display: "flex" }}>
            <Icon name="History" size={18} />
          </button>
        } />

      <div style={{ padding: "8px 16px 32px", animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", padding: "20px 12px 24px" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, margin: "0 auto 14px",
            background: "var(--ag-primary-soft)", display: "grid", placeItems: "center" }}>
            <Icon name="Microscope" size={30} style={{ color: "var(--ag-primary)" }} />
          </div>
          <div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700, color: T.ink }}>
            {tc({en:"Select Diagnostic Domain", hi:"निदान श्रेणी चुनें", bn:"রোগ নির্ণয়ের বিভাগ নির্বাচন করুন"})}
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4, lineHeight: 1.5 }}>
            {tc({en:"AI-powered diagnosis for crops, livestock, fish, and bees", hi:"फसलों, पशुओं, मछली और मधुमक्खियों के लिए AI निदान", bn:"ফসল, পশু, মাছ এবং মৌমাছির জন্য AI রোগ নির্ণয়"})}
          </div>
        </div>

        {/* Domain grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
          {domains.map((d) => {
            const ac = ACCENT_COLORS[d.accent] || ACCENT_COLORS.primary;
            return (
              <button key={d.id} onClick={() => startFlow(d.id)}
                style={{ padding: "18px 14px", borderRadius: T.rLg, cursor: "pointer",
                  background: T.surface, border: `1.5px solid ${T.line}`,
                  display: "flex", flexDirection: "column", alignItems: "flex-start",
                  gap: 8, fontFamily: T.body, textAlign: "left",
                  transition: "border-color .15s" }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: ac.bg,
                  display: "grid", placeItems: "center" }}>
                  <Icon name={d.icon} size={22} style={{ color: ac.fg }} />
                </div>
                {/* Fall back to the English name so a domain registered
                    without display copy still shows something. */}
                <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{d.label ? tc(d.label) : d.name}</div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: 1.4 }}>{d.desc ? tc(d.desc) : d.description}</div>
              </button>
            );
          })}
        </div>

        {/* Recent history */}
        {recent.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: T.display, fontSize: 15, fontWeight: 700, color: T.ink }}>
                {tc({en:"Recent Diagnoses", hi:"हाल के निदान", bn:"সাম্প্রতিক রোগ নির্ণয়"})}
              </span>
              <button onClick={() => push({ kind: "diagnosticHistory" })}
                style={{ background: "none", border: "none", cursor: "pointer",
                  color: "var(--ag-primary)", fontSize: 12.5, fontFamily: T.body, fontWeight: 600 }}>
                {tc({en:"See all", hi:"सभी देखें", bn:"সব দেখুন"})}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recent.map((r) => (
                <DiagnosticCard key={r.id} record={r} onClick={openResult} />
              ))}
            </div>
          </>
        )}

        {/* Disclaimer */}
        <div style={{ marginTop: 24, padding: "12px 14px", borderRadius: T.rMd,
          background: T.surface2, border: `1px solid ${T.lineSoft}` }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Icon name="Info" size={14} style={{ color: T.inkFaint, flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11.5, color: T.inkFaint, margin: 0, lineHeight: 1.5 }}>
              {tc({en:"AgriOS AI Diagnostics provides AI-assisted guidance only — not a confirmed diagnosis. Always consult a qualified agricultural expert or veterinarian before acting on AI recommendations.", hi:"AgriOS AI निदान केवल AI-सहायता मार्गदर्शन प्रदान करता है — यह कोई पक्का निदान नहीं है। AI सिफारिशों पर कार्य करने से पहले हमेशा किसी योग्य कृषि विशेषज्ञ या पशु चिकित्सक से परामर्श करें।", bn:"AgriOS AI রোগ নির্ণয় শুধুমাত্র AI-সহায়তা নির্দেশিকা প্রদান করে — এটি নিশ্চিত রোগ নির্ণয় নয়। AI সুপারিশের উপর কাজ করার আগে সর্বদা একজন যোগ্য কৃষি বিশেষজ্ঞ বা পশু চিকিৎসকের সাথে পরামর্শ করুন।"})}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
