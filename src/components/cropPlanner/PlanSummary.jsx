/* Shared cultivation-cost + profitability summary, used by both the live
   CropPlanner calculator and the read-only CropPlanDetail view so the two
   screens can't drift out of sync with each other's layout. */
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../Icon.jsx";
import { Card } from "../primitives.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { rupee } from "../../utils/format.js";

function Section({ title, icon, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: T.inkSoft,
        textTransform: "uppercase", letterSpacing: .4, marginBottom: 10, padding: "0 2px" }}>
        {icon && <Icon name={icon} size={14} />} {title}
      </div>
      {children}
    </div>
  );
}

function StatBox({ label, value, sub, fg }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "13px 12px" }}>
      <div style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</div>
      <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: fg || T.ink, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13.5 }}>
      <span style={{ color: T.inkSoft }}>{label}</span>
      <span style={{ color: T.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{rupee(value)}</span>
    </div>
  );
}

export default function PlanSummary({ plan, showProfitability }) {
  const { tc } = useApp();
  const roi = plan.profit.roiPct;
  const roiColor = roi === null ? T.ink : roi >= 0 ? T.primary : T.red;

  return (
    <>
      <Section title={tc({ en: "Cultivation cost summary", hi: "खेती लागत सारांश", bn: "চাষের খরচের সারসংক্ষেপ" })} icon="Calculator">
        <Card pad={14}>
          <SummaryRow label={tc({ en: "Seed cost", hi: "बीज लागत", bn: "বীজের খরচ" })} value={plan.seed.totalSeedCost} />
          {plan.fertilizer.total > 0 && <SummaryRow label={tc({ en: "Fertilizer cost", hi: "उर्वरक लागत", bn: "সারের খরচ" })} value={plan.fertilizer.total} />}
          {plan.protection.total > 0 && <SummaryRow label={tc({ en: "Crop protection cost", hi: "फ़सल सुरक्षा लागत", bn: "ফসল সুরক্ষার খরচ" })} value={plan.protection.total} />}
          {plan.organic.total > 0 && <SummaryRow label={tc({ en: "Organic input cost", hi: "जैविक इनपुट लागत", bn: "জৈব উপকরণের খরচ" })} value={plan.organic.total} />}
          {plan.irrigation.total > 0 && <SummaryRow label={tc({ en: "Irrigation cost", hi: "सिंचाई लागत", bn: "সেচের খরচ" })} value={plan.irrigation.total} />}
          {plan.labour.total > 0 && <SummaryRow label={tc({ en: "Labour cost", hi: "श्रम लागत", bn: "শ্রমের খরচ" })} value={plan.labour.total} />}
          {plan.machinery.total > 0 && <SummaryRow label={tc({ en: "Machinery cost", hi: "मशीन लागत", bn: "যন্ত্রপাতির খরচ" })} value={plan.machinery.total} />}
          {plan.other.total > 0 && <SummaryRow label={tc({ en: "Other cost", hi: "अन्य लागत", bn: "অন্যান্য খরচ" })} value={plan.other.total} />}
          <div style={{ height: 1, background: T.lineSoft, margin: "10px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{tc({ en: "Total cultivation cost", hi: "कुल खेती लागत", bn: "মোট চাষের খরচ" })}</span>
            <span style={{ fontFamily: T.display, fontSize: 19, fontWeight: 800, color: T.primary }}>{rupee(plan.totalCost)}</span>
          </div>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <StatBox label={tc({ en: "Cost / acre", hi: "प्रति एकड़ लागत", bn: "প্রতি একরে খরচ" })} value={rupee(plan.costPerAcre)} />
          <StatBox label={tc({ en: "Cost / hectare", hi: "प्रति हेक्टेयर लागत", bn: "প্রতি হেক্টরে খরচ" })} value={rupee(plan.costPerHectare)} />
        </div>
      </Section>

      {showProfitability && (
        <Section title={tc({ en: "Estimated profitability", hi: "अनुमानित लाभप्रदता", bn: "আনুমানিক লাভজনকতা" })} icon="TrendingUp">
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginBottom: 10, display: "flex", gap: 6 }}>
            <Icon name="Info" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            {tc({ en: "Planning estimate only — not a guaranteed yield, price, or profit.",
                  hi: "केवल योजना अनुमान — गारंटीशुदा उपज, कीमत या लाभ नहीं।",
                  bn: "শুধুমাত্র পরিকল্পনার হিসাব — নিশ্চিত ফলন, দাম বা মুনাফা নয়।" })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <StatBox label={tc({ en: "Estimated yield", hi: "अनुमानित उपज", bn: "আনুমানিক ফলন" })} value={`${plan.yield.totalYield.toLocaleString("en-IN")}`} sub={tc({ en: "total, this area", hi: "कुल, इस क्षेत्र में", bn: "মোট, এই এলাকায়" })} />
            <StatBox label={tc({ en: "Estimated revenue", hi: "अनुमानित आय", bn: "আনুমানিক আয়" })} value={rupee(plan.revenue.total)} />
            <StatBox label={tc({ en: "Estimated profit", hi: "अनुमानित लाभ", bn: "আনুমানিক মুনাফা" })} value={rupee(plan.profit.gross)} fg={plan.profit.gross >= 0 ? T.primary : T.red} />
            <StatBox label={tc({ en: "ROI", hi: "ROI", bn: "ROI" })} value={roi === null ? "—" : `${roi}%`} fg={roiColor} />
            <StatBox label={tc({ en: "Cost / kg (or unit)", hi: "प्रति किग्रा (या इकाई) लागत", bn: "প্রতি কেজি (বা ইউনিট) খরচ" })} value={plan.costPerKg === null ? "—" : rupee(plan.costPerKg)} />
            <StatBox label={tc({ en: "Break-even price", hi: "लागत-वसूली कीमत", bn: "খরচ-উসুল দাম" })} value={plan.breakEven.breakEvenPrice === null ? "—" : rupee(plan.breakEven.breakEvenPrice)} sub={tc({ en: "₹ needed / unit to cover cost", hi: "लागत निकालने के लिए ₹ प्रति इकाई", bn: "খরচ তুলতে প্রতি ইউনিটে প্রয়োজনীয় ₹" })} />
          </div>
        </Section>
      )}
    </>
  );
}
