import { useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import SeverityBadge from "../components/SeverityBadge.jsx";
import ConfidenceMeter from "../components/ConfidenceMeter.jsx";
import { domainRegistry } from "../services/diagnostics/domainRegistry.js";
import { reportService } from "../services/diagnostics/reportService.js";
import { shareText } from "../utils/share.js";

const TABS = [
  { id: "diagnosis",       label: {en:"Diagnosis", hi:"निदान", bn:"রোগ নির্ণয়"},       icon: "Microscope"   },
  { id: "recommendations", label: {en:"Treatment", hi:"उपचार", bn:"চিকিৎসা"},        icon: "Stethoscope"  },
  { id: "risk",            label: {en:"Risk", hi:"जोखिम", bn:"ঝুঁকি"},             icon: "ShieldAlert"  },
  { id: "followup",        label: {en:"Follow-up", hi:"अनुवर्ती", bn:"ফলো-আপ"},        icon: "CalendarDays" },
];

export default function DiagnosticResult({ record }) {
  const { pop, push, tc, toast } = useApp();
  const [tab, setTab] = useState("diagnosis");

  if (!record) return null;

  const domain    = domainRegistry.get(record.domainId);
  const recs      = record.structuredRecommendations || {};
  const esc       = record.escalation || {};
  const isEmerg   = esc.hasEmergency;

  const share = async () => {
    const text = `AgriOS Diagnosis\n${record.primaryDiagnosis}\nSeverity: ${record.severity?.label}\nDate: ${new Date(record.createdAt).toLocaleDateString("en-IN")}\n\nReport ID: ${record.reportId}`;
    const r = await shareText(text, "AgriOS Diagnostic Report");
    if (r === "copied") toast(tc({ en: "Copied!", hi: "कॉपी हो गया!", bn: "কপি হয়েছে!" }), "success");
  };

  /* ── Emergency banner ─────────────────────────────────────────────────── */
  const EmergencyBanner = isEmerg && (
    <div style={{ margin: "0 16px 16px", padding: "12px 16px", borderRadius: T.rLg,
      background: "#fee2e2", border: "2px solid var(--ag-red)", animation: "ag-blink 1.4s infinite" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Icon name="ShieldAlert" size={18} style={{ color: "var(--ag-red)", flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, color: "var(--ag-red)", fontSize: 14, marginBottom: 3 }}>
            {tc({en:"EMERGENCY — Immediate Action Required", hi:"आपातकाल — तुरंत कार्रवाई आवश्यक", bn:"জরুরি — অবিলম্বে পদক্ষেপ প্রয়োজন"})}
          </div>
          <div style={{ fontSize: 13, color: T.ink }}>
            {tc({en:"This condition requires urgent expert attention. Contact a veterinarian or agriculture officer immediately.", hi:"इस स्थिति में तत्काल विशेषज्ञ ध्यान आवश्यक है। तुरंत पशु चिकित्सक या कृषि अधिकारी से संपर्क करें।", bn:"এই অবস্থায় জরুরি বিশেষজ্ঞ মনোযোগ প্রয়োজন। অবিলম্বে পশু চিকিৎসক বা কৃষি অফিসারের সাথে যোগাযোগ করুন।"})}
          </div>
        </div>
      </div>
    </div>
  );

  /* ── Header card ──────────────────────────────────────────────────────── */
  const HeaderCard = (
    <div style={{ margin: "0 16px 16px", padding: "18px 16px", borderRadius: T.rLg,
      background: T.surface, border: `1px solid ${T.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: T.inkFaint, marginBottom: 4, fontWeight: 600, letterSpacing: .5 }}>
            {(domain?.label ? tc(domain.label) : (domain?.name || record.domainId || "")).toUpperCase()}
            {record.species ? ` · ${record.species}` : ""}
          </div>
          <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 800, color: T.ink, lineHeight: 1.2 }}>
            {record.primaryDiagnosis || tc({en:"Unable to Detect", hi:"पता नहीं चल सका", bn:"শনাক্ত করা যায়নি"})}
          </div>
        </div>
        <SeverityBadge severity={record.severity} pulse={isEmerg} />
      </div>
      <ConfidenceMeter confidence={record.confidence} needsMoreImages={record.needsMoreImages} />
    </div>
  );

  /* ── Tab bar ──────────────────────────────────────────────────────────── */
  const TabBar = (
    <div style={{ display: "flex", margin: "0 16px 16px", borderRadius: T.rLg,
      background: T.surface2, padding: 4, gap: 4 }}>
      {TABS.map((t) => (
        <button key={t.id} onClick={() => setTab(t.id)}
          style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: "none", cursor: "pointer",
            fontFamily: T.body, fontSize: 11.5, fontWeight: tab === t.id ? 700 : 400,
            background: tab === t.id ? T.bg : "transparent",
            color: tab === t.id ? "var(--ag-primary)" : T.inkSoft,
            boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,.1)" : "none",
            transition: "all .15s", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <Icon name={t.icon} size={14} />
          {tc(t.label)}
        </button>
      ))}
    </div>
  );

  /* ── Tab content ──────────────────────────────────────────────────────── */
  const Content = (
    <div style={{ padding: "0 16px" }}>

      {/* DIAGNOSIS tab */}
      {tab === "diagnosis" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {record.observations?.length > 0 && (
            <Section icon="Search" title={tc({en:"Observations", hi:"अवलोकन", bn:"পর্যবেক্ষণ"})}>
              {record.observations.map((o, i) => <BulletItem key={i} text={o} />)}
            </Section>
          )}

          {record.possibleDiseases?.length > 1 && (
            <Section icon="BarChart3" title={tc({en:"Possible Diseases", hi:"संभावित रोग", bn:"সম্ভাব্য রোগ"})}>
              {record.possibleDiseases.map((d, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: i < record.possibleDiseases.length - 1 ? `1px solid ${T.lineSoft}` : "none" }}>
                  <span style={{ fontSize: 13.5, color: T.ink }}>{d.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {d.category && <span style={{ fontSize: 11, color: T.inkFaint, background: T.surface2,
                      padding: "2px 7px", borderRadius: 99 }}>{d.category}</span>}
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ag-primary)" }}>
                      {Math.round((d.probability || 0) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </Section>
          )}

          {record.differentialDiagnosis?.length > 0 && (
            <Section icon="GitBranch" title={tc({en:"Differential Diagnosis", hi:"विभेदक निदान", bn:"ডিফারেনশিয়াল রোগ নির্ণয়"})}>
              {record.differentialDiagnosis.map((d, i) => <BulletItem key={i} text={d} />)}
            </Section>
          )}

          {record.riskFactors?.length > 0 && (
            <Section icon="AlertTriangle" title={tc({en:"Risk Factors", hi:"जोखिम कारक", bn:"ঝুঁকির কারণ"})}>
              {record.riskFactors.map((r, i) => <BulletItem key={i} text={r} color="var(--ag-orange)" />)}
            </Section>
          )}

          {record.knowledgeSource && (
            <div style={{ fontSize: 11.5, color: T.inkFaint, padding: "8px 0" }}>
              <b>{tc({en:"Knowledge source:", hi:"ज्ञान स्रोत:", bn:"জ্ঞানের উৎস:"})}</b> {record.knowledgeSource}
            </div>
          )}
        </div>
      )}

      {/* RECOMMENDATIONS tab */}
      {tab === "recommendations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {recs.categories?.length > 0
            ? recs.categories.map((cat) => (
                <Section key={cat.key} icon={cat.icon} title={cat.label} accentColor={cat.color}>
                  {cat.items.map((item, i) => (
                    <div key={i} style={{ padding: "10px 0",
                      borderBottom: i < cat.items.length - 1 ? `1px solid ${T.lineSoft}` : "none" }}>
                      <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}>{item.text}</div>
                      {(item.source || item.cost || item.duration) && (
                        <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                          {item.source   && <Tag icon="BookmarkCheck" text={item.source} />}
                          {item.cost     && <Tag icon="CreditCard"    text={item.cost} />}
                          {item.duration && <Tag icon="Clock"         text={item.duration} />}
                        </div>
                      )}
                    </div>
                  ))}
                </Section>
              ))
            : <EmptySection text={tc({en:"No specific recommendations available. Please consult an expert.", hi:"कोई विशिष्ट सिफारिश उपलब्ध नहीं। कृपया विशेषज्ञ से परामर्श करें।", bn:"কোনো নির্দিষ্ট সুপারিশ নেই। অনুগ্রহ করে বিশেষজ্ঞের সাথে পরামর্শ করুন।"})} />
          }

          {recs.disclaimer && (
            <div style={{ fontSize: 11.5, color: T.inkFaint, padding: "8px 12px",
              background: T.yellowSoft, borderRadius: 10 }}>
              ⚠️ {recs.disclaimer}
            </div>
          )}
        </div>
      )}

      {/* RISK tab */}
      {tab === "risk" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {record.risk && (
            <Section icon="ShieldAlert" title={tc({en:"Risk Assessment", hi:"जोखिम मूल्यांकन", bn:"ঝুঁকি মূল্যায়ন"})}>
              <RiskRow label={tc({en:"Disease Spread", hi:"रोग फैलाव", bn:"রোগ বিস্তার"})}     level={record.risk.spread?.level} />
              <RiskRow label={tc({en:"Economic Impact", hi:"आर्थिक प्रभाव", bn:"অর্থনৈতিক প্রভাব"})}    level={record.risk.economicImpact?.level} />
              <RiskRow label={tc({en:"Mortality Risk", hi:"मृत्यु जोखिम", bn:"মৃত্যু ঝুঁকি"})}     level={record.risk.mortalityRisk?.level} />
              <RiskRow label={tc({en:"Yield Loss", hi:"उपज हानि", bn:"ফলন ক্ষতি"})}         level={record.risk.yieldLoss?.level} />
            </Section>
          )}

          {record.risk?.urgency && (
            <div style={{ padding: "14px 16px", borderRadius: T.rLg,
              background: record.risk.urgency.key === "emergency" ? "#fee2e2"
                        : record.risk.urgency.key === "urgent"    ? "var(--ag-orange-soft)"
                        : "var(--ag-primary-soft)",
              border: `1px solid ${record.risk.urgency.color}33` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: record.risk.urgency.color,
                letterSpacing: .5, marginBottom: 4 }}>URGENCY</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: record.risk.urgency.color }}>
                {record.risk.urgency.label}
              </div>
            </div>
          )}

          {/* Escalation flags */}
          {esc.flags?.length > 0 && (
            <Section icon="ArrowUpCircle" title={tc({en:"Next Steps", hi:"अगले कदम", bn:"পরবর্তী পদক্ষেপ"})}>
              {esc.flags.map((f) => (
                <EscalationFlag key={f.id} flag={f} onAction={(cta) => handleEscalation(cta)} />
              ))}
            </Section>
          )}

          {esc.referralSummary && (
            <button onClick={() => copyReferral(esc.referralSummary)}
              style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 16px",
                borderRadius: T.rLg, background: T.surface2, border: `1px solid ${T.line}`,
                cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
              <Icon name="ClipboardList" size={18} style={{ color: "var(--ag-primary)" }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{tc({en:"Copy Referral Summary", hi:"रेफरल सारांश कॉपी करें", bn:"রেফারেল সারাংশ কপি করুন"})}</div>
                <div style={{ fontSize: 12, color: T.inkSoft }}>{tc({en:"Share with your veterinarian or agri officer", hi:"अपने पशु चिकित्सक या कृषि अधिकारी से साझा करें", bn:"আপনার পশু চিকিৎসক বা কৃষি অফিসারের সাথে শেয়ার করুন"})}</div>
              </div>
            </button>
          )}
        </div>
      )}

      {/* FOLLOW-UP tab */}
      {tab === "followup" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {record.followUp && (
            <Section icon="CalendarDays" title={tc({en:`Follow-up in ${record.followUp.days} days`, hi:`${record.followUp.days} दिनों में अनुवर्ती`, bn:`${record.followUp.days} দিনে ফলো-আপ`})}>
              {record.followUp.checkPoints?.length > 0
                ? record.followUp.checkPoints.map((c, i) => <BulletItem key={i} text={c} />)
                : <p style={{ fontSize: 13.5, color: T.inkSoft }}>{tc({en:"Monitor the condition and contact an expert if it worsens.", hi:"स्थिति पर नज़र रखें और बिगड़ने पर विशेषज्ञ से संपर्क करें।", bn:"অবস্থা পর্যবেক্ষণ করুন এবং খারাপ হলে বিশেষজ্ঞের সাথে যোগাযোগ করুন।"})}</p>}
            </Section>
          )}

          {record.recoveryTimeline && (
            <Section icon="TrendingUp" title={tc({en:"Recovery Timeline", hi:"रिकवरी समयसीमा", bn:"পুনরুদ্ধারের সময়সীমা"})}>
              <p style={{ fontSize: 14, color: T.ink, lineHeight: 1.6, margin: 0 }}>{record.recoveryTimeline}</p>
            </Section>
          )}

          <Section icon="Info" title={tc({en:"Disclaimer", hi:"अस्वीकरण", bn:"দাবিত্যাগ"})}>
            <p style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.6, margin: 0 }}>
              {record.disclaimer}
            </p>
          </Section>
        </div>
      )}
    </div>
  );

  /* ── Escalation handler ───────────────────────────────────────────────── */
  function handleEscalation(cta) {
    if (cta === "chat") push({ kind: "chat", props: { agentId: "veterinaryExpert" } });
    if (cta === "nearby") push({ kind: "nearby" });
    if (cta === "retake") pop();
  }

  async function copyReferral(text) {
    await navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <>
      <AppBar title={tc({en:"Diagnosis Result", hi:"निदान परिणाम", bn:"রোগ নির্ণয়ের ফলাফল"})} onBack={pop}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <HdrBtn icon="Share2" label={tc({ en: "Share", hi: "साझा करें", bn: "শেয়ার" })} onClick={share} />
            <HdrBtn icon="FileDown" label={tc({ en: "Download report", hi: "रिपोर्ट डाउनलोड करें", bn: "রিপোর্ট ডাউনলোড করুন" })} onClick={() => reportService.downloadJson(record)} />
            <HdrBtn icon="Printer" label={tc({ en: "Print report", hi: "रिपोर्ट प्रिंट करें", bn: "রিপোর্ট প্রিন্ট করুন" })} onClick={() => reportService.print(record)} />
          </div>
        } />

      <div style={{ paddingBottom: 32, animation: "ag-fade .22s var(--ag-ease)" }}>
        {EmergencyBanner}
        {HeaderCard}
        {TabBar}
        {Content}
      </div>
    </>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function Section({ icon, title, accentColor, children }) {
  return (
    <div style={{ background: T.surface, borderRadius: T.rLg, padding: "14px 16px",
      border: `1px solid ${T.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <Icon name={icon} size={15} style={{ color: accentColor || "var(--ag-primary)" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function BulletItem({ text, color }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "5px 0", alignItems: "flex-start" }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", marginTop: 7, flexShrink: 0,
        background: color || "var(--ag-primary)" }} />
      <span style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

const RISK_COLORS = { low: "var(--ag-primary)", medium: "var(--ag-yellow)", high: "var(--ag-orange)", critical: "var(--ag-red)" };
function RiskRow({ label, level }) {
  if (!level) return null;
  const color = RISK_COLORS[level] || RISK_COLORS.low;
  const pct   = { low: 20, medium: 50, high: 75, critical: 100 }[level] || 20;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
      <span style={{ width: 120, fontSize: 12.5, color: T.inkSoft, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 99, background: T.surface2 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99 }} />
      </div>
      <span style={{ width: 54, fontSize: 12, fontWeight: 700, color, textAlign: "right" }}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </span>
    </div>
  );
}

function Tag({ icon, text }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11,
      color: T.inkSoft, background: T.surface2, padding: "2px 8px", borderRadius: 99 }}>
      <Icon name={icon} size={10} />
      {text}
    </span>
  );
}

function EscalationFlag({ flag, onAction }) {
  return (
    <button onClick={() => onAction(flag.cta)}
      style={{ display: "flex", gap: 10, alignItems: "center", width: "100%",
        padding: "10px 0", borderBottom: `1px solid ${T.lineSoft}`,
        background: "none", border: "none", cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: flag.urgent ? "#fee2e2" : "var(--ag-primary-soft)",
        display: "grid", placeItems: "center" }}>
        <Icon name={flag.icon} size={17} style={{ color: flag.urgent ? "var(--ag-red)" : "var(--ag-primary)" }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: flag.urgent ? "var(--ag-red)" : T.ink }}>
          {flag.label}
        </div>
        <div style={{ fontSize: 12, color: T.inkSoft }}>{flag.sublabel}</div>
      </div>
      <Icon name="ChevronRight" size={14} style={{ color: T.inkFaint, flexShrink: 0 }} />
    </button>
  );
}

function EmptySection({ text }) {
  return <p style={{ fontSize: 13.5, color: T.inkSoft, margin: 0, padding: "8px 0" }}>{text}</p>;
}

function HdrBtn({ icon, onClick, label }) {
  return (
    <button onClick={onClick} aria-label={label} style={{ background: T.surface, border: `1px solid ${T.line}`,
      borderRadius: 12, padding: 8, cursor: "pointer", color: T.ink, display: "flex" }}>
      <Icon name={icon} size={17} />
    </button>
  );
}
