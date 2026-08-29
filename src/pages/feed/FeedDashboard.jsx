/* Feed Cost Analytics dashboard — reads from feedAnalyticsService /
   feedAlertsService, no new charting dependency (this app has none) —
   trends render as simple bars, matching how FarmAnalytics.jsx already
   visualizes break-even progress elsewhere in the app. */
import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen, Card } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { feedAnalyticsService } from "../../services/feed/feedAnalyticsService.js";
import { feedAlertsService } from "../../services/feed/feedAlertsService.js";
import { rupee } from "../../utils/format.js";

function StatBox({ label, value, sub, fg }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "13px 12px" }}>
      <div style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</div>
      <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: fg || T.ink, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
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

const SEVERITY_COLOR = { high: { fg: T.red, bg: T.redSoft }, medium: { fg: T.orange, bg: T.orangeSoft }, low: { fg: T.inkSoft, bg: T.surface2 } };

export default function FeedDashboard() {
  const { pop, push, tc } = useApp();
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [batches, setBatches] = useState([]);
  const [livestock, setLivestock] = useState([]);
  const [feedTypes, setFeedTypes] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    feedAnalyticsService.summary().then(setSummary);
    feedAnalyticsService.monthlyTrend(undefined, 6).then(setTrend);
    feedAnalyticsService.batchComparison().then(setBatches);
    feedAnalyticsService.livestockComparison().then(setLivestock);
    feedAnalyticsService.feedTypeBreakdown().then(setFeedTypes);
    feedAlertsService.getAll().then(setAlerts);
  }, []);

  if (!summary) {
    return (<><AppBar title={tc({ en: "Feed cost analytics", hi: "चारा लागत विश्लेषण", bn: "খাদ্য ব্যয় বিশ্লেষণ" })} onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>{tc({ en: "Loading…", hi: "लोड हो रहा है…", bn: "লোড হচ্ছে…" })}</div></>);
  }

  const maxTrendCost = Math.max(1, ...trend.map((t) => t.cost));

  return (
    <>
      <AppBar title={tc({ en: "Feed cost analytics", hi: "चारा लागत विश्लेषण", bn: "খাদ্য ব্যয় বিশ্লেষণ" })} onBack={pop} />
      <Screen gap={20}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatBox label={tc({ en: "Today", hi: "आज", bn: "আজ" })} value={rupee(summary.todayCost)} sub={`${summary.todayQty} kg`} />
          <StatBox label={tc({ en: "This week", hi: "इस सप्ताह", bn: "এ সপ্তাহে" })} value={rupee(summary.weekCost)} sub={`${summary.weekQty} kg`} />
          <StatBox label={tc({ en: "This month", hi: "इस माह", bn: "এ মাসে" })} value={rupee(summary.monthCost)} sub={`${summary.monthQty} kg`} fg={T.primary} />
          <StatBox label={tc({ en: "Avg cost / kg", hi: "औसत लागत / किग्रा", bn: "গড় ব্যয় / কেজি" })} value={rupee(summary.avgCostPerKg)} sub={tc({ en: "this month", hi: "इस माह", bn: "এ মাসে" })} />
          <StatBox label={tc({ en: "Feed stock value", hi: "चारा स्टॉक मूल्य", bn: "খাদ্য মজুতের মূল্য" })} value={rupee(summary.stockValue)} />
          <StatBox label={tc({ en: "Alerts", hi: "अलर्ट", bn: "সতর্কতা" })} value={alerts.length} fg={alerts.length > 0 ? T.red : T.primary} />
        </div>

        {alerts.length > 0 && (
          <Section title={tc({ en: "Alerts", hi: "अलर्ट", bn: "সতর্কতা" })} icon="AlertTriangle">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alerts.slice(0, 8).map((a, i) => {
                const c = SEVERITY_COLOR[a.severity] || SEVERITY_COLOR.low;
                return (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "10px 12px", background: c.bg, borderRadius: T.rMd }}>
                    <Icon name="AlertTriangle" size={15} style={{ color: c.fg, flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: c.fg }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{a.message}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <Section title={tc({ en: "Feed cost trend (6 months)", hi: "चारा लागत रुझान (6 माह)", bn: "খাদ্য ব্যয়ের ধারা (৬ মাস)" })} icon="TrendingUp">
          <Card pad={14}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
              {trend.map((t) => (
                <div key={t.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: Math.max(3, (t.cost / maxTrendCost) * 80), background: t.cost > 0 ? T.primary : T.line, borderRadius: 4 }} />
                  <div style={{ fontSize: 9.5, color: T.inkFaint }}>{t.month.slice(5)}</div>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {livestock.length > 0 && (
          <Section title={tc({ en: "Livestock comparison", hi: "पशु तुलना", bn: "প্রাণী তুলনা" })} icon="Layers">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {livestock.map((g) => (
                <Card key={g.enterprise} pad={12}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{g.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.primary }}>{rupee(g.totalCost)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{g.totalFeed} kg · {g.batches} batch{g.batches !== 1 ? "es" : ""}</div>
                </Card>
              ))}
            </div>
          </Section>
        )}

        {feedTypes.length > 0 && (
          <Section title={tc({ en: "Cost by feed type", hi: "चारा प्रकार अनुसार लागत", bn: "খাদ্যের ধরন অনুযায়ী ব্যয়" })} icon="PieChart">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {feedTypes.map((f) => (
                <div key={f.feedType} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 70, fontSize: 12, color: T.inkSoft, textTransform: "capitalize" }}>{f.feedType}</div>
                  <div style={{ flex: 1, height: 8, background: T.surface2, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${f.pct}%`, height: "100%", background: T.orange }} />
                  </div>
                  <div style={{ width: 50, fontSize: 11.5, color: T.ink, textAlign: "right" }}>{f.pct}%</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {batches.length > 0 && (
          <Section title={tc({ en: "Batch comparison", hi: "बैच तुलना", bn: "ব্যাচ তুলনা" })} icon="Gauge">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {batches.map((b) => (
                <Card key={b.batch.id} onClick={() => push({ kind: "feedBatchDetail", props: { id: b.batch.id } })} pad={12}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{b.batch.label}</span>
                    <span style={{ fontSize: 12.5, color: T.inkSoft }}>FCR {b.fcr === null ? "—" : b.fcr}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{rupee(b.totalFeedCost)} · {b.totalFeed} kg</div>
                </Card>
              ))}
            </div>
          </Section>
        )}
      </Screen>
    </>
  );
}
