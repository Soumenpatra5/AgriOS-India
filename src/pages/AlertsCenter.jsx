/* Farm Alerts Center — one screen for every alert the app computes across
   inventory, vaccinations, worker documents, crop tasks, feed and price
   alerts. Composes farmAlertsService (which reuses each existing source);
   tapping an alert deep-links to the screen that resolves it. */
import { useEffect, useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Screen, Card, Chip } from "../components/index.js";
import { EmptyState } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { farmAlertsService } from "../services/alerts/farmAlertsService.js";

const SEV = {
  high:   { label: { en: "Urgent", hi: "अत्यावश्यक", bn: "জরুরি" }, fg: T.red, bg: T.redSoft, icon: "AlertTriangle" },
  medium: { label: { en: "Attention", hi: "ध्यान दें", bn: "মনোযোগ" }, fg: T.orange, bg: T.orangeSoft, icon: "AlertCircle" },
  low:    { label: { en: "Info", hi: "सूचना", bn: "তথ্য" }, fg: T.inkSoft, bg: T.surface2, icon: "Info" },
};

const SOURCE_ICON = {
  inventory: "Warehouse", vaccination: "Syringe", document: "FileText",
  cropTask: "CalendarDays", feed: "Package", price: "TrendingUp",
};

export default function AlertsCenter() {
  const { pop, push, tc } = useApp();
  const [alerts, setAlerts] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => { farmAlertsService.getAll().then(setAlerts); }, []);

  if (alerts === null) {
    return (<><AppBar title={tc({ en: "Alerts", hi: "अलर्ट", bn: "সতর্কতা" })} onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>Loading…</div></>);
  }

  const counts = { all: alerts.length, high: 0, medium: 0, low: 0 };
  alerts.forEach((a) => { counts[a.severity] = (counts[a.severity] || 0) + 1; });
  const visible = filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);

  const FILTERS = [
    { id: "all", label: { en: "All", hi: "सभी", bn: "সব" } },
    { id: "high", label: SEV.high.label },
    { id: "medium", label: SEV.medium.label },
    { id: "low", label: SEV.low.label },
  ];

  return (
    <>
      <AppBar title={tc({ en: "Alerts", hi: "अलर्ट", bn: "সতর্কতা" })} onBack={pop} />
      <Screen gap={14}>
        {alerts.length === 0 ? (
          <EmptyState icon="CheckCircle2"
            title={tc({ en: "All clear", hi: "सब ठीक है", bn: "সব ঠিক আছে" })}
            body={tc({ en: "Nothing needs your attention right now.", hi: "अभी कुछ भी ध्यान देने योग्य नहीं है।", bn: "এখন কিছুতেই মনোযোগ প্রয়োজন নেই।" })} />
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
              {FILTERS.map((f) => (
                <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
                  {tc(f.label)}{counts[f.id] ? ` ${counts[f.id]}` : ""}
                </Chip>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visible.map((a) => {
                const sev = SEV[a.severity] || SEV.low;
                const tappable = !!a.kind;
                return (
                  <Card key={a.id} pad={13} onClick={tappable ? () => push({ kind: a.kind, props: a.props }) : undefined}
                    style={{ cursor: tappable ? "pointer" : "default" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: sev.bg, color: sev.fg, display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <Icon name={SOURCE_ICON[a.source] || sev.icon} size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: T.ink }}>{a.title}</span>
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: sev.fg, background: sev.bg, padding: "1px 6px", borderRadius: 5 }}>{tc(sev.label)}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>{a.message}</div>
                      </div>
                      {tappable && <Icon name="ChevronRight" size={17} style={{ color: T.inkFaint, flexShrink: 0, marginTop: 8 }} />}
                    </div>
                  </Card>
                );
              })}
            </div>

            <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
              {tc({ en: "Alerts are computed from your latest farm data each time you open this screen.", hi: "यह स्क्रीन खोलने पर आपके नवीनतम डेटा से अलर्ट बनते हैं।", bn: "এই স্ক্রিন খোলার সময় আপনার সর্বশেষ ডেটা থেকে সতর্কতা তৈরি হয়।" })}
            </div>
          </>
        )}
      </Screen>
    </>
  );
}
