import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, SectionHeader } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { kpiService } from "../../services/business/kpiService.js";
import { costAnalysis } from "../../services/finance/costAnalysis.js";
import { inventoryService } from "../../services/inventory/inventoryService.js";
import { assetService } from "../../services/assets/assetService.js";
import { rupee, compact } from "../../utils/format.js";

export default function FarmAnalytics() {
  const { pop, tc } = useApp();
  const year = new Date().getFullYear();
  const [kpi, setKpi]             = useState(null);
  const [costs, setCosts]         = useState([]);
  const [breakEven, setBreakEven] = useState([]);
  const [forecast, setForecast]   = useState([]);
  const [stockValue, setStockValue] = useState(0);
  const [assetValue, setAssetValue] = useState(0);

  useEffect(() => {
    kpiService.summary(year).then(setKpi);
    costAnalysis.forecast(year).then(setForecast);
    costAnalysis.costPerUnit(year).then(setCosts);
    costAnalysis.breakEven(year).then(setBreakEven);
    inventoryService.stockValue().then(setStockValue);
    assetService.totalValue().then(setAssetValue);
  }, [year]);

  return (
    <>
      <AppBar title={tc({ en: "Farm Analytics", hi: "फार्म विश्लेषण", bn: "খামার বিশ্লেষণ" })} onBack={pop} />
      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 12,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* KPI grid */}
        {kpi && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: tc({ en: "Revenue", hi: "राजस्व", bn: "আয়" }), value: compact(kpi.totalRevenue), fg: T.primary, bg: T.primarySoft },
              { label: tc({ en: "Net Profit", hi: "शुद्ध लाभ", bn: "নিট মুনাফা" }), value: compact(kpi.netProfit), fg: kpi.netProfit >= 0 ? T.primary : T.red, bg: kpi.netProfit >= 0 ? T.primarySoft : T.redSoft },
              { label: tc({ en: "ROI", hi: "ROI", bn: "ROI" }), value: `${kpi.roi}%`, fg: T.blue, bg: T.blueSoft },
              { label: tc({ en: "Margin", hi: "मार्जिन", bn: "মার্জিন" }), value: `${kpi.profitMargin}%`, fg: T.orange, bg: T.orangeSoft },
              { label: tc({ en: "Stock Value", hi: "स्टॉक मूल्य", bn: "মজুতের মূল্য" }), value: compact(stockValue), fg: T.yellow, bg: T.yellowSoft },
              { label: tc({ en: "Asset Value", hi: "संपत्ति मूल्य", bn: "সম্পদের মূল্য" }), value: compact(assetValue), fg: T.blue, bg: T.blueSoft },
            ].map((c) => (
              <div key={c.label} style={{ background: c.bg, borderRadius: T.rLg, padding: "13px 14px" }}>
                <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 700, color: c.fg }}>{c.value}</div>
                <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{c.label} · {year}</div>
              </div>
            ))}
          </div>
        )}

        {/* Cost per unit */}
        <SectionHeader title={tc({ en: "Cost Per Unit", hi: "प्रति इकाई लागत", bn: "প্রতি এককের ব্যয়" })} />
        {costs.filter((c) => c.costPerUnit !== null).length === 0 ? (
          <div style={{ fontSize: 12.5, color: T.inkFaint, textAlign: "center", padding: "10px 0" }}>
            Log production and tag ledger entries to an enterprise to see cost per egg / litre / kg.
          </div>
        ) : (
          costs.filter((c) => c.costPerUnit !== null).map((c) => (
            <Card key={c.enterprise.id} pad={13}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.enterprise.label}</div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
                    {c.output.toLocaleString("en-IN")} {c.metric.unit} produced · {rupee(c.expense)} spent
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: T.orange, fontFamily: T.display }}>
                    ₹{c.costPerUnit}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.inkSoft }}>per {c.metric.unit || "unit"}</div>
                </div>
              </div>
            </Card>
          ))
        )}

        {/* Break-even */}
        {breakEven.length > 0 && (
          <>
            <SectionHeader title={tc({ en: "Break-even", hi: "लाभ-हानि बराबर", bn: "সমতা বিন্দু" })} />
            {breakEven.map((b) => (
              <Card key={b.enterprise.id} pad={13}>
                <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>{b.enterprise.label}</div>
                <div style={{ fontSize: 12, color: T.inkSoft }}>
                  Needs <b style={{ color: T.ink }}>{b.breakEvenUnits.toLocaleString("en-IN")} {b.metric.unit}</b> sold
                  at ₹{b.pricePerUnit}/{b.metric.unit || "unit"} to cover {rupee(b.expense)} costs
                  {b.achievedPct !== null && (
                    <span style={{ color: b.achievedPct >= 100 ? T.primary : T.orange, fontWeight: 700 }}>
                      {" "}— {b.achievedPct}% achieved
                    </span>
                  )}
                </div>
                <div style={{ height: 5, background: T.line, borderRadius: 4, marginTop: 8 }}>
                  <div style={{ height: 5, width: `${Math.min(100, b.achievedPct || 0)}%`,
                    background: (b.achievedPct || 0) >= 100 ? T.primary : T.orange, borderRadius: 4 }} />
                </div>
              </Card>
            ))}
          </>
        )}

        {/* Cash forecast */}
        <SectionHeader title="3-Month Cash Forecast" />
        {forecast.length === 0 ? (
          <div style={{ fontSize: 12.5, color: T.inkFaint, textAlign: "center", padding: "10px 0" }}>
            Add ledger entries to enable forecasting.
          </div>
        ) : (
          <Card pad={13}>
            <div style={{ fontSize: 11, color: T.inkFaint, marginBottom: 10 }}>
              Projected from your last 3 months' average income and expense.
            </div>
            {forecast.map((f) => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between",
                padding: "7px 0", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 13 }}>
                <span style={{ color: T.inkSoft }}>{f.label}</span>
                <span>
                  <span style={{ color: T.primary }}>+{compact(f.income)}</span>
                  {" / "}
                  <span style={{ color: T.red }}>−{compact(f.expense)}</span>
                  {" → "}
                  <b style={{ color: f.projectedBalance >= 0 ? T.primary : T.red }}>{compact(f.projectedBalance)}</b>
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
