import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen, Card } from "../../components/index.js";
import { Button } from "../../components/primitives.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { cropPlanService } from "../../services/cropPlanner/cropPlanService.js";
import { reportService } from "../../services/reports/reportService.js";
import { rupee } from "../../utils/format.js";

/* Built per render rather than held as a module constant, because tc() only
   exists once the app context is mounted. */
const metrics = (tc) => [
  { label: tc({ en: "Area", hi: "क्षेत्रफल", bn: "আয়তন" }), get: (p) => `${p.areaValue ?? p.areaAcres} ${p.areaUnit || tc({ en: "acre", hi: "एकड़", bn: "একর" })}` },
  { label: tc({ en: "Total cultivation cost", hi: "कुल खेती लागत", bn: "মোট চাষের খরচ" }), get: (p) => rupee(p.computed.totalCost) },
  { label: tc({ en: "Cost / acre", hi: "प्रति एकड़ लागत", bn: "প্রতি একরে খরচ" }), get: (p) => rupee(p.computed.costPerAcre) },
  { label: tc({ en: "Labour cost", hi: "श्रम लागत", bn: "শ্রমের খরচ" }), get: (p) => rupee(p.computed.labour.total) },
  { label: tc({ en: "Estimated yield", hi: "अनुमानित उपज", bn: "আনুমানিক ফলন" }), get: (p) => p.computed.yield.totalYield.toLocaleString("en-IN") },
  { label: tc({ en: "Estimated revenue", hi: "अनुमानित आय", bn: "আনুমানিক আয়" }), get: (p) => rupee(p.computed.revenue.total) },
  { label: tc({ en: "Estimated profit", hi: "अनुमानित लाभ", bn: "আনুমানিক মুনাফা" }), get: (p) => rupee(p.computed.profit.gross), highlight: true },
  { label: tc({ en: "ROI", hi: "ROI", bn: "ROI" }), get: (p) => p.computed.profit.roiPct === null ? "—" : `${p.computed.profit.roiPct}%`, highlight: true },
  { label: tc({ en: "Cost / kg (or unit)", hi: "प्रति किग्रा (या इकाई) लागत", bn: "প্রতি কেজি (বা ইউনিট) খরচ" }), get: (p) => p.computed.costPerKg === null ? "—" : rupee(p.computed.costPerKg) },
];

export default function CropPlanCompare({ ids }) {
  const { pop, tc } = useApp();
  const [plans, setPlans] = useState(null);

  useEffect(() => {
    Promise.all((ids || []).map((id) => cropPlanService.getById(id))).then((list) => setPlans(list.filter(Boolean)));
  }, [ids]);

  if (!plans) {
    return (<><AppBar title={tc({ en: "Compare plans", hi: "योजनाओं की तुलना", bn: "পরিকল্পনার তুলনা" })} onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>{tc({ en: "Loading…", hi: "लोड हो रहा है…", bn: "লোড হচ্ছে…" })}</div></>);
  }

  const rows = metrics(tc);
  const bestProfitId = plans.reduce((best, p) => (!best || p.computed.profit.gross > best.computed.profit.gross ? p : best), null)?.id;

  return (
    <>
      <AppBar title={tc({ en: "Compare crop plans", hi: "फ़सल योजनाओं की तुलना", bn: "ফসল পরিকল্পনার তুলনা" })} onBack={pop} />
      <Screen gap={16}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 120 + plans.length * 130 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 12, color: T.inkSoft, position: "sticky", left: 0, background: T.bg }}>{tc({ en: "Metric", hi: "मानक", bn: "মাপকাঠি" })}</th>
                {plans.map((p) => (
                  <th key={p.id} style={{ textAlign: "left", padding: "8px 10px", fontSize: 13, fontWeight: 700, color: T.ink, minWidth: 130 }}>
                    {p.cropName || tc({ en: "Unnamed crop", hi: "बिना नाम की फ़सल", bn: "নামহীন ফসল" })}
                    {p.id === bestProfitId && <Icon name="Award" size={13} style={{ color: T.primary, marginLeft: 5, verticalAlign: -1 }} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.label} style={{ borderTop: `1px solid ${T.lineSoft}` }}>
                  <td style={{ padding: "10px", fontSize: 12.5, color: T.inkSoft, position: "sticky", left: 0, background: T.bg }}>{m.label}</td>
                  {plans.map((p) => (
                    <td key={p.id} style={{ padding: "10px", fontSize: 13.5, fontWeight: m.highlight ? 700 : 500, color: m.highlight ? T.primary : T.ink, fontVariantNumeric: "tabular-nums" }}>
                      {m.get(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Card pad={12}>
          <div style={{ fontSize: 11.5, color: T.inkFaint, lineHeight: 1.5 }}>
            {tc({ en: "Comparison based on each plan's saved figures — estimates, not guaranteed outcomes.",
                  hi: "हर योजना के सहेजे गए आँकड़ों पर आधारित तुलना — अनुमान, गारंटीशुदा परिणाम नहीं।",
                  bn: "প্রতিটি পরিকল্পনার সংরক্ষিত হিসাবের ভিত্তিতে তুলনা — আনুমানিক, নিশ্চিত ফলাফল নয়।" })}
          </div>
        </Card>

        <Button full variant="outline" icon="FileDown" onClick={() => reportService.downloadCsv(cropPlanService.buildComparisonReport(plans))}>
          {tc({ en: "Export comparison (CSV)", hi: "तुलना निर्यात करें (CSV)", bn: "তুলনা রপ্তানি করুন (CSV)" })}
        </Button>
      </Screen>
    </>
  );
}
