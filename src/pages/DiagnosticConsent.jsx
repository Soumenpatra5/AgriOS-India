/* Diagnostic consent — the DPDP Act / GDPR gate a farmer passes once before
   the first AI diagnosis. consentService has always held the policy and the
   storage; this is the screen that was missing, which left every domain on
   DiagnosticsHome leading nowhere. */

import { useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card, Button, Divider } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { consentService } from "../services/diagnostics/consentService.js";

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

/* The three the service checks in hasAll(), plus location as genuinely optional. */
const ITEMS = [
  {
    key: "imageProcessing", required: true, icon: "Camera",
    label: { en: "Photo analysis", hi: "फ़ोटो विश्लेषण", bn: "ছবি বিশ্লেষণ" },
    body: {
      en: "Photos you take of a crop or animal are analysed to suggest possible causes.",
      hi: "फ़सल या पशु की ली गई फ़ोटो का विश्लेषण संभावित कारण सुझाने के लिए किया जाता है।",
      bn: "ফসল বা পশুর তোলা ছবি সম্ভাব্য কারণ জানাতে বিশ্লেষণ করা হয়।",
    },
  },
  {
    key: "aiAnalysis", required: true, icon: "Sparkles",
    label: { en: "AI diagnosis", hi: "AI निदान", bn: "AI রোগ নির্ণয়" },
    body: {
      en: "Your symptom answers are sent for AI analysis. Results are possible causes only — always confirm with your KVK or vet.",
      hi: "आपके लक्षण उत्तर AI विश्लेषण के लिए भेजे जाते हैं। परिणाम केवल संभावित कारण हैं — हमेशा अपने KVK या पशु चिकित्सक से पुष्टि करें।",
      bn: "আপনার উপসর্গের উত্তর AI বিশ্লেষণে পাঠানো হয়। ফলাফল কেবল সম্ভাব্য কারণ — সর্বদা KVK বা পশুচিকিৎসকের সঙ্গে নিশ্চিত করুন।",
    },
  },
  {
    key: "dataRetention", required: true, icon: "Database",
    label: { en: "Keep my records", hi: "मेरे रिकॉर्ड रखें", bn: "আমার রেকর্ড রাখুন" },
    body: {
      en: "Diagnosis records are stored on this device so you can look back at them. You can delete them at any time.",
      hi: "निदान रिकॉर्ड इसी डिवाइस पर सहेजे जाते हैं ताकि आप उन्हें बाद में देख सकें। आप उन्हें कभी भी हटा सकते हैं।",
      bn: "রোগ নির্ণয়ের রেকর্ড এই ডিভাইসেই রাখা হয় যাতে পরে দেখতে পারেন। আপনি যেকোনো সময় মুছে ফেলতে পারেন।",
    },
  },
  {
    key: "locationSharing", required: false, icon: "MapPin",
    label: { en: "Use my location", hi: "मेरा स्थान उपयोग करें", bn: "আমার অবস্থান ব্যবহার করুন" },
    body: {
      en: "Optional. Helps match diagnoses to pests and diseases common in your area.",
      hi: "वैकल्पिक। आपके क्षेत्र में आम कीट और रोगों से निदान मिलाने में मदद करता है।",
      bn: "ঐচ্ছিক। আপনার এলাকায় সাধারণ পোকা ও রোগের সঙ্গে মেলাতে সাহায্য করে।",
    },
  },
];

export default function DiagnosticConsent({ domainId }) {
  const { pop, push, tc, toast } = useApp();
  const [state, setState] = useState(() => {
    const c = consentService.get();
    return {
      imageProcessing: !!c.imageProcessing,
      aiAnalysis:      !!c.aiAnalysis,
      dataRetention:   !!c.dataRetention,
      locationSharing: !!c.locationSharing,
    };
  });

  const policy = consentService.getRetentionPolicy();
  const canContinue = state.imageProcessing && state.aiAnalysis && state.dataRetention;

  const accept = () => {
    /* Stamp the date the consent was actually given. update() carries the
       patch through untouched — only grantAll() sets consentDate — and
       isExpired() reads a missing date as already expired, so omitting this
       would file a consent record that is stale the moment it is written. */
    consentService.update({ ...state, consentDate: new Date().toISOString() });
    // Drop this screen before opening the flow, so Back from the diagnosis
    // returns to the domain list rather than asking for consent again.
    pop();
    push({ kind: "diagnosticFlow", props: { domainId } });
  };

  return (
    <>
      <AppBar title={tc({ en: "Before we start", hi: "शुरू करने से पहले", bn: "শুরু করার আগে" })} onBack={pop} />
      <div style={{ padding: "8px 16px 108px", display: "flex", flexDirection: "column", gap: 12,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        <Card pad={14} style={{ background: T.primarySoft, border: "none" }}>
          <div style={{ display: "flex", gap: 11 }}>
            <Icon name="ShieldCheck" size={20} color={T.primary} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.primary, marginBottom: 3 }}>
                {tc({ en: "Your data stays on your phone",
                      hi: "आपका डेटा आपके फ़ोन पर रहता है",
                      bn: "আপনার তথ্য আপনার ফোনেই থাকে" })}
              </div>
              <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.5 }}>
                {tc({
                  en: "Diagnosis records are saved on this device. Nothing is shared without the permissions you give below, and you can withdraw them at any time in Settings.",
                  hi: "निदान रिकॉर्ड इसी डिवाइस पर सहेजे जाते हैं। नीचे दी गई अनुमतियों के बिना कुछ भी साझा नहीं होता, और आप उन्हें कभी भी सेटिंग्स में वापस ले सकते हैं।",
                  bn: "রোগ নির্ণয়ের রেকর্ড এই ডিভাইসেই সংরক্ষিত হয়। নিচের অনুমতি ছাড়া কিছুই শেয়ার হয় না, এবং আপনি যেকোনো সময় সেটিংসে তা প্রত্যাহার করতে পারেন।",
                })}
              </div>
            </div>
          </div>
        </Card>

        {ITEMS.map((it) => (
          <Card key={it.key} pad={14}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: T.surface2,
                display: "grid", placeItems: "center", flexShrink: 0, color: T.inkSoft }}>
                <Icon name={it.icon} size={17} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{tc(it.label)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                    background: it.required ? T.redSoft : T.surface2, color: it.required ? T.red : T.inkSoft }}>
                    {it.required
                      ? tc({ en: "Required", hi: "आवश्यक", bn: "আবশ্যক" })
                      : tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>{tc(it.body)}</div>
              </div>
              <Toggle on={state[it.key]} onChange={(v) => setState((s) => ({ ...s, [it.key]: v }))} />
            </div>
          </Card>
        ))}

        {/* The policy the service already defines — shown rather than buried. */}
        <Card pad={14}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 8 }}>
            {tc({ en: "How your data is handled", hi: "आपका डेटा कैसे संभाला जाता है", bn: "আপনার তথ্য কীভাবে ব্যবহৃত হয়" })}
          </div>
          {[
            [tc({ en: "Purpose", hi: "उद्देश्य", bn: "উদ্দেশ্য" }), policy.purpose],
            [tc({ en: "Kept for", hi: "अवधि", bn: "সময়কাল" }), `${policy.retentionDays} ${tc({ en: "days", hi: "दिन", bn: "দিন" })}`],
            [tc({ en: "Stored by", hi: "संग्रहकर्ता", bn: "সংরক্ষণকারী" }), policy.controller],
            [tc({ en: "Lawful basis", hi: "कानूनी आधार", bn: "আইনি ভিত্তি" }), policy.lawfulBasis],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 12, padding: "6px 0" }}>
              <div style={{ flex: "0 0 96px", fontSize: 12, color: T.inkFaint }}>{k}</div>
              <div style={{ flex: 1, fontSize: 12, color: T.ink, lineHeight: 1.45 }}>{v}</div>
            </div>
          ))}
          <Divider my={8} />
          <div style={{ fontSize: 12, color: T.inkFaint, marginBottom: 6 }}>
            {tc({ en: "Your rights", hi: "आपके अधिकार", bn: "আপনার অধিকার" })}
          </div>
          {policy.rights.map((r) => (
            <div key={r} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0" }}>
              <Icon name="Check" size={14} color={T.primary} />
              <span style={{ fontSize: 12, color: T.ink }}>{r}</span>
            </div>
          ))}
        </Card>

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          {tc({
            en: "AI Diagnostics gives AI-assisted guidance only — not a substitute for your KVK, veterinarian or agronomist.",
            hi: "AI निदान केवल AI-सहायित मार्गदर्शन देता है — यह आपके KVK, पशु चिकित्सक या कृषि विशेषज्ञ का विकल्प नहीं है।",
            bn: "AI ডায়াগনস্টিকস কেবল AI-সহায়ক পরামর্শ দেয় — এটি আপনার KVK, পশুচিকিৎসক বা কৃষিবিদের বিকল্প নয়।",
          })}
        </div>
      </div>

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "10px 16px",
        background: T.surface, borderTop: `1px solid ${T.line}`, display: "flex", gap: 10, zIndex: 20 }}>
        <Button variant="outline" style={{ flex: 1 }} onClick={pop}>
          {tc({ en: "Not now", hi: "अभी नहीं", bn: "এখন নয়" })}
        </Button>
        <Button style={{ flex: 1.4 }} disabled={!canContinue} icon="ShieldCheck"
          onClick={() => {
            if (!canContinue) {
              toast(tc({
                en: "The three required permissions are needed to run a diagnosis",
                hi: "निदान चलाने के लिए तीनों आवश्यक अनुमतियाँ चाहिए",
                bn: "রোগ নির্ণয় চালাতে তিনটি আবশ্যক অনুমতি প্রয়োজন",
              }), "info");
              return;
            }
            accept();
          }}>
          {tc({ en: "Agree & continue", hi: "सहमत और आगे बढ़ें", bn: "সম্মত ও এগিয়ে যান" })}
        </Button>
      </div>
    </>
  );
}
