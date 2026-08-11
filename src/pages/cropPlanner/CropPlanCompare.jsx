import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen, Card } from "../../components/index.js";
import { Button } from "../../components/primitives.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { cropPlanService } from "../../services/cropPlanner/cropPlanService.js";
import { reportService } from "../../services/reports/reportService.js";
import { rupee } from "../../utils/format.js";

const METRICS = [
  { label: "Area", get: (p) => `${p.areaValue ?? p.areaAcres} ${p.areaUnit || "acre"}` },
  { label: "Total cultivation cost", get: (p) => rupee(p.computed.totalCost) },
  { label: "Cost / acre", get: (p) => rupee(p.computed.costPerAcre) },
  { label: "Labour cost", get: (p) => rupee(p.computed.labour.total) },
  { label: "Estimated yield", get: (p) => p.computed.yield.totalYield.toLocaleString("en-IN") },
  { label: "Estimated revenue", get: (p) => rupee(p.computed.revenue.total) },
  { label: "Estimated profit", get: (p) => rupee(p.computed.profit.gross), highlight: true },
  { label: "ROI", get: (p) => p.computed.profit.roiPct === null ? "—" : `${p.computed.profit.roiPct}%`, highlight: true },
  { label: "Cost / kg (or unit)", get: (p) => p.computed.costPerKg === null ? "—" : rupee(p.computed.costPerKg) },
];

export default function CropPlanCompare({ ids }) {
  const { pop } = useApp();
  const [plans, setPlans] = useState(null);

  useEffect(() => {
    Promise.all((ids || []).map((id) => cropPlanService.getById(id))).then((list) => setPlans(list.filter(Boolean)));
  }, [ids]);

  if (!plans) {
    return (<><AppBar title="Compare plans" onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>Loading…</div></>);
  }

  const bestProfitId = plans.reduce((best, p) => (!best || p.computed.profit.gross > best.computed.profit.gross ? p : best), null)?.id;

  return (
    <>
      <AppBar title="Compare crop plans" onBack={pop} />
      <Screen gap={16}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 120 + plans.length * 130 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 12, color: T.inkSoft, position: "sticky", left: 0, background: T.bg }}>Metric</th>
                {plans.map((p) => (
                  <th key={p.id} style={{ textAlign: "left", padding: "8px 10px", fontSize: 13, fontWeight: 700, color: T.ink, minWidth: 130 }}>
                    {p.cropName || "Unnamed crop"}
                    {p.id === bestProfitId && <Icon name="Award" size={13} style={{ color: T.primary, marginLeft: 5, verticalAlign: -1 }} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m, i) => (
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
            Comparison based on each plan's saved figures — estimates, not guaranteed outcomes.
          </div>
        </Card>

        <Button full variant="outline" icon="FileDown" onClick={() => reportService.downloadCsv(cropPlanService.buildComparisonReport(plans))}>
          Export comparison (CSV)
        </Button>
      </Screen>
    </>
  );
}
