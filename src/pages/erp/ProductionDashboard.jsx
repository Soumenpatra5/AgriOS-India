import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, SectionHeader } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { productionAggregator } from "../../services/production/productionAggregator.js";
import { rupee } from "../../utils/format.js";
import { EmptyHint } from "../../components/erp/RecordList.jsx";

const FG = { primary: T.primary, blue: T.blue, orange: T.orange, red: T.red, yellow: T.yellow };
const BG = { primary: T.primarySoft, blue: T.blueSoft, orange: T.orangeSoft, red: T.redSoft, yellow: T.yellowSoft };
const fmtDate = (d) => new Date(d + "T12:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function ProductionDashboard() {
  const { pop, tc } = useApp();
  const [snapshot, setSnapshot]   = useState([]);
  const [harvests, setHarvests]   = useState([]);
  const [mortality, setMortality] = useState(0);

  useEffect(() => {
    productionAggregator.monthSnapshot().then(setSnapshot);
    productionAggregator.harvests().then(setHarvests);
    productionAggregator.monthMortality().then(setMortality);
  }, []);

  const monthName = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <>
      <AppBar title={tc({ en: "Production", hi: "उत्पादन", bn: "উৎপাদন" })} onBack={pop} />
      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 12,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        <SectionHeader title={tc({ en: `This Month — ${monthName}`, hi: `इस माह — ${monthName}`, bn: `এ মাসে — ${monthName}` })} />

        {snapshot.length === 0 ? (
          <EmptyHint icon="TrendingUp"
            text={tc({ en: "No production logged yet — daily logs in each livestock module appear here", hi: "अभी कोई उत्पादन दर्ज नहीं — हर पशुधन मॉड्यूल के दैनिक लॉग यहाँ दिखेंगे", bn: "এখনও কোনও উৎপাদন লেখা হয়নি — প্রতিটি পশুসম্পদ মডিউলের দৈনিক লগ এখানে দেখা যাবে" })} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {snapshot.map((r) => {
              const a = r.enterprise.accent;
              return (
                <Card key={r.enterprise.id} pad={14}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: BG[a] || T.primarySoft,
                      display: "grid", placeItems: "center" }}>
                      <Icon name={r.enterprise.icon} size={16} color={FG[a] || T.primary} />
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft }}>{r.enterprise.i18n ? tc(r.enterprise.i18n) : r.enterprise.label}</div>
                  </div>
                  <div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700, color: FG[a] || T.primary }}>
                    {r.total.toLocaleString("en-IN")} <span style={{ fontSize: 12 }}>{r.metric.unit}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                    {r.metric.label} · {r.entries} log{r.entries !== 1 ? "s" : ""}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {mortality > 0 && (
          <div style={{ background: T.redSoft, borderRadius: T.rLg, padding: "12px 14px",
            borderLeft: `4px solid ${T.red}` }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.red }}>☠ {mortality} mortality this month</div>
            <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
              Check the AI Vet Advisor or run a diagnosis if losses are unusual.
            </div>
          </div>
        )}

        <SectionHeader title={tc({ en: "Recent Harvests", hi: "हाल की कटाई", bn: "সাম্প্রতিক আহরণ" })} />
        {harvests.length === 0
          ? <div style={{ fontSize: 12.5, color: T.inkFaint, textAlign: "center", padding: "12px 0" }}>
              Harvest events (fish, honey…) will appear here.
            </div>
          : harvests.slice(0, 10).map((h) => (
            <Card key={h.id} pad={12}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{h.enterpriseLabel} harvest</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                    {fmtDate(h.date)} · {h.weightKg} kg
                    {h.pricePerKg ? ` @ ${rupee(Number(h.pricePerKg))}/kg` : ""}
                  </div>
                </div>
                {h.weightKg && h.pricePerKg && (
                  <div style={{ fontWeight: 700, fontSize: 14, color: T.primary, fontFamily: T.display }}>
                    {rupee(Number(h.weightKg) * Number(h.pricePerKg))}
                  </div>
                )}
              </div>
            </Card>
          ))}
      </div>
    </>
  );
}
