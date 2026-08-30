import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, EmptyState, IconTile } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { seedAiCommerce } from "../../services/aiCommerce/seedAiCommerce.js";
import { businessIntelligence } from "../../services/aiCommerce/businessIntelligence.js";
import { commerceAutomation } from "../../services/aiCommerce/commerceAutomation.js";
import { compact } from "../../utils/format.js";

const MODULES_RAW = [
  { kind: "aiRecs",     label: {en: "Recommendations", hi: "सुझाव", bn: "সুপারিশ"}, desc: {en: "Personalized & seasonal picks", hi: "व्यक्तिगत और मौसमी चयन", bn: "ব্যক্তিগত ও মৌসুমী বাছাই"}, icon: "Sparkles",   a: "blue"    },  { kind: "aiForecast", label: {en: "Demand & Supply", hi: "माँग और आपूर्ति", bn: "চাহিদা ও সরবরাহ"}, desc: {en: "Market outlook by category", hi: "श्रेणी अनुसार बाजार दृष्टिकोण", bn: "বিভাগ অনুযায়ী বাজার দৃষ্টিভঙ্গি"},    icon: "Activity",   a: "orange"  },
  { kind: "aiMatch",    label: {en: "Matchmaking", hi: "मैचमेकिंग", bn: "ম্যাচমেকিং"},     desc: {en: "Buyer & seller scoring", hi: "खरीदार और विक्रेता स्कोरिंग", bn: "ক্রেতা ও বিক্রেতা স্কোরিং"},        icon: "Handshake",  a: "primary" },
  { kind: "aiFraud",    label: {en: "Fraud & Risk", hi: "धोखाधड़ी और जोखिम", bn: "জালিয়াতি ও ঝুঁকি"},    desc: {en: "Flagged listings & risk", hi: "चिह्नित सूचियाँ और जोखिम", bn: "চিহ্নিত তালিকা ও ঝুঁকি"},       icon: "ShieldAlert",a: "red"     },
  { kind: "aiBI",       label: {en: "Business Intelligence", hi: "बिजनेस इंटेलिजेंस", bn: "বিজনেস ইন্টেলিজেন্স"}, desc: {en: "Executive dashboards", hi: "कार्यकारी डैशबोर्ड", bn: "নির্বাহী ড্যাশবোর্ড"},    icon: "BarChart3",  a: "blue"    },
];

const ALERT_ICON = { demand: "Activity", fraud: "ShieldAlert", inventory: "Package", buyer: "Handshake" };

export default function AICommerceHub() {
  const { pop, push, toast, tc } = useApp();
  const [hasData, setHasData] = useState(null);
  const [exec, setExec] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  useEffect(() => {
    seedAiCommerce.hasData().then(setHasData);
    businessIntelligence.executive().then(setExec).catch(() => setExec(null));
    commerceAutomation.list().then(setAlerts);
  }, [tick]);

  const loadDemo = async () => {
    setBusy(true);
    const r = await seedAiCommerce.load();
    await commerceAutomation.run();
    setBusy(false);
    toast(tc({en: `AI commerce ready — ${r.orders} sample orders analysed`, hi: `AI कॉमर्स तैयार — ${r.orders} नमूना ऑर्डर विश्लेषित`, bn: `AI কমার্স প্রস্তুত — ${r.orders} নমুনা অর্ডার বিশ্লেষিত`}), "success");
    refresh();
  };

  const runScan = async () => {
    setBusy(true);
    const raised = await commerceAutomation.run();
    setBusy(false);
    toast(raised.length ? tc({en: `${raised.length} new AI alert${raised.length > 1 ? "s" : ""}`, hi: `${raised.length} नई AI अलर्ट`, bn: `${raised.length} নতুন AI সতর্কতা`}) : tc({en: "No new alerts — all clear", hi: "कोई नई अलर्ट नहीं — सब ठीक", bn: "কোনো নতুন সতর্কতা নেই — সব ঠিক"}), "info");
    refresh();
  };

  const clearDemo = async () => {
    await seedAiCommerce.clear();
    await commerceAutomation.clearAll();
    toast(tc({en: "Demo data cleared", hi: "डेमो डेटा हटाया गया", bn: "ডেমো ডেটা মুছে ফেলা হয়েছে"}), "info");
    refresh();
  };

  const unread = alerts.filter((a) => !a.read);

  const MODULES = MODULES_RAW.map((m) => ({ ...m, label: tc(m.label), desc: tc(m.desc) }));

  return (
    <>
      <AppBar title={tc({en: "AI Commerce", hi: "AI कॉमर्स", bn: "AI কমার্স"})} onBack={pop} />
      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 16,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {hasData === false ? (
          <EmptyState icon="BrainCircuit" title={tc({en: "AI Commerce Platform", hi: "AI कॉमर्स प्लेटफ़ॉर्म", bn: "AI কমার্স প্ল্যাটফর্ম"})}
            body={tc({en: "The intelligent decision engine for the marketplace — recommendations, price forecasts, buyer/seller matching, demand outlook, fraud detection and business intelligence, all explainable. Load demo data to see it work.", hi: "बाज़ार के लिए बुद्धिमान निर्णय इंजन — सुझाव, मूल्य पूर्वानुमान, खरीदार/विक्रेता मिलान, माँग दृष्टिकोण, धोखाधड़ी पहचान और बिजनेस इंटेलिजेंस, सभी स्पष्ट रूप से समझाए गए। इसे काम करते देखने के लिए डेमो डेटा लोड करें।", bn: "বাজারের জন্য বুদ্ধিমান সিদ্ধান্ত ইঞ্জিন — সুপারিশ, মূল্য পূর্বাভাস, ক্রেতা/বিক্রেতা মেলানো, চাহিদার দৃষ্টিভঙ্গি, জালিয়াতি সনাক্তকরণ এবং বিজনেস ইন্টেলিজেন্স, সবকিছু ব্যাখ্যাযোগ্য। এটি কাজ করতে দেখতে ডেমো ডেটা লোড করুন।"})}
            action={busy ? tc({en: "Analysing…", hi: "विश्लेषण हो रहा है…", bn: "বিশ্লেষণ চলছে…"}) : tc({en: "Load demo data", hi: "डेमो डेटा लोड करें", bn: "ডেমো ডেটা লোড করুন"})} onAction={busy ? undefined : loadDemo} />
        ) : (
          <>
            {/* headline BI tiles */}
            {exec && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
                {[
                  { label: tc({en: "Revenue", hi: "राजस्व", bn: "রাজস্ব"}), value: compact(exec.sales.revenue), icon: "IndianRupee" },
                  { label: tc({en: "Orders", hi: "ऑर्डर", bn: "অর্ডার"}), value: exec.sales.orders, icon: "Package" },
                  { label: tc({en: "Hot leads", hi: "गर्म लीड्स", bn: "হট লিড"}), value: exec.customer.hotLeads, icon: "Flame" },
                  { label: tc({en: "Fraud flags", hi: "धोखाधड़ी चिह्न", bn: "জালিয়াতি চিহ্ন"}), value: exec.operational.fraudFlags, icon: "ShieldAlert" },
                ].map((s) => (
                  <div key={s.label} style={{ flexShrink: 0, background: T.surface, border: `1px solid ${T.line}`,
                    borderRadius: T.rMd, padding: "10px 14px", minWidth: 104 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon name={s.icon} size={14} color={T.blue} />
                      <span style={{ fontSize: 17, fontWeight: 800, color: T.ink, fontFamily: T.display }}>{s.value}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Ask the advisor */}
            <button onClick={() => push({ kind: "chat", props: { agentId: "commerceAdvisor" } })}
              style={{ width: "100%", padding: "14px 18px", borderRadius: T.rLg, cursor: "pointer",
                background: `linear-gradient(135deg, #4338ca, #3730a3)`, border: "none", fontFamily: T.body,
                textAlign: "left", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,.15)",
                display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name="BrainCircuit" size={22} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{tc({en: "Ask the Commerce Advisor", hi: "कॉमर्स सलाहकार से पूछें", bn: "কমার্স উপদেষ্টাকে জিজ্ঞাসা করুন"})}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 2 }}>
                  {tc({en: '"What price for my paddy?" · "Which buyers want potato?"', hi: '"मेरे धान की क्या कीमत मिलेगी?" · "आलू कौन से खरीदार चाहते हैं?"', bn: '"আমার ধানের দাম কত পাব?" · "কোন ক্রেতারা আলু চান?"'})}
                </div>
              </div>
              <Icon name="ChevronRight" size={18} color="rgba(255,255,255,.7)" />
            </button>

            {/* AI alerts */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
                  {tc({en: "AI Alerts", hi: "AI अलर्ट", bn: "AI সতর্কতা"})} {unread.length > 0 && <span style={{ color: T.red }}>· {unread.length} {tc({en: "new", hi: "नई", bn: "নতুন"})}</span>}
                </span>
                <button onClick={runScan} disabled={busy}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.blue, fontSize: 12,
                    display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon name="RefreshCw" size={13} /> {tc({en: "Run AI scan", hi: "AI स्कैन चलाएँ", bn: "AI স্ক্যান চালান"})}
                </button>
              </div>
              {alerts.length === 0 ? (
                <Card pad={13}><span style={{ fontSize: 12.5, color: T.inkFaint }}>{tc({en: "No alerts yet — run an AI scan.", hi: "अभी तक कोई अलर्ट नहीं — AI स्कैन चलाएँ।", bn: "এখনো কোনো সতর্কতা নেই — AI স্ক্যান চালান।"})}</span></Card>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {alerts.slice(0, 5).map((a) => (
                    <Card key={a.id} pad={12} onClick={() => { commerceAutomation.markRead(a.id).then(refresh); }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <Icon name={ALERT_ICON[a.kind] || "Bell"} size={17} color={a.read ? T.inkFaint : T.blue} style={{ marginTop: 1 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{a.title}</div>
                          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 1 }}>{a.body}</div>
                        </div>
                        {!a.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.blue, flexShrink: 0, marginTop: 4 }} />}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* modules */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {MODULES.map((m) => (
                <Card key={m.kind} onClick={() => push({ kind: m.kind })} pad={13}>
                  <IconTile name={m.icon} a={m.a} size={40} iconSize={20} />
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, marginTop: 9 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{m.desc}</div>
                </Card>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: T.surface2,
              borderRadius: T.rMd, padding: "10px 12px" }}>
              <Icon name="Info" size={15} color={T.inkSoft} style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: 1.5 }}>
                {tc({en: "Every prediction is a data-reasoned estimate with an explainable basis and confidence — not a live market quote. Real ML models and vector search are planned for the backend phase.", hi: "हर पूर्वानुमान एक डेटा-आधारित अनुमान है जिसका स्पष्ट आधार और विश्वसनीयता स्तर है — यह लाइव बाज़ार भाव नहीं है। असली ML मॉडल और वेक्टर सर्च बैकएंड चरण में लाए जाएँगे।", bn: "প্রতিটি পূর্বাভাস একটি ডেটা-ভিত্তিক অনুমান, যার একটি ব্যাখ্যাযোগ্য ভিত্তি ও নির্ভরযোগ্যতা রয়েছে — এটি লাইভ বাজার দর নয়। প্রকৃত ML মডেল এবং ভেক্টর সার্চ ব্যাকএন্ড পর্যায়ে যুক্ত হবে।"})}
              </span>
            </div>

            <Button variant="soft" full icon="Trash2" onClick={clearDemo}>{tc({en: "Clear demo data", hi: "डेमो डेटा हटाएँ", bn: "ডেমো ডেটা মুছুন"})}</Button>
          </>
        )}
      </div>
    </>
  );
}
