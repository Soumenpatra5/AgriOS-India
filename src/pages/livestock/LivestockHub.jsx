import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, SectionHeader } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { usePrefs } from "../../customize/PreferencesProvider.jsx";
import { filterByType } from "../../customize/farmerTypes.js";
import { ENTERPRISES, animalService, eventService } from "../../services/livestock/livestockService.js";

const H_PAD = 16;

const ROUTE_MAP = {
  poultry: "poultryManager",
  dairy:   "dairyManager",
  goat:    "goatManager",
  pig:     "pigManager",
  sheep:   "sheepManager",
  fish:    "fishManager",
  bee:     "beeManager",
};

const accentColor = {
  primary: T.primary,
  blue:    T.blue,
  orange:  T.orange,
  yellow:  T.yellow,
  red:     T.red,
};

const accentSoft = {
  primary: T.primarySoft,
  blue:    T.blueSoft,
  orange:  T.orangeSoft,
  yellow:  T.yellowSoft,
  red:     T.redSoft,
};

export default function LivestockHub() {
  const { pop, push } = useApp();
  const { prefs } = usePrefs();
  const enterprises = filterByType(prefs, ENTERPRISES);
  const [counts, setCounts]   = useState({});
  const [upcoming, setUpcoming] = useState({});

  useEffect(() => {
    ENTERPRISES.forEach(async (e) => {
      const count = await animalService.count(e.id);
      setCounts((prev) => ({ ...prev, [e.id]: count }));
      const events = await eventService.getUpcoming(e.id, 14);
      setUpcoming((prev) => ({ ...prev, [e.id]: events.length }));
    });
  }, []);

  return (
    <>
      <AppBar title="Livestock" onBack={pop} />
      <div style={{ padding: `8px ${H_PAD}px 32px`, display: "flex", flexDirection: "column", gap: 12,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* Header banner */}
        <div style={{ background: `linear-gradient(135deg, #7c3aed, #4f46e5)`, borderRadius: T.rLg,
          padding: "18px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(255,255,255,.18)",
            display: "grid", placeItems: "center", flexShrink: 0, fontSize: 26, lineHeight: 1 }}>
            🐄
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Livestock Manager</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 2 }}>
              Manage all your farm enterprises in one place
            </div>
          </div>
        </div>

        <Card onClick={() => push({ kind: "feedHub" })} pad={0}
          style={{ display: "flex", alignItems: "center", gap: 0, overflow: "hidden" }}>
          <div style={{ width: 4, alignSelf: "stretch", background: T.orange, flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 13, padding: "14px 14px" }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: T.orangeSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="Package" size={22} color={T.orange} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.display, fontSize: 15, fontWeight: 700, color: T.ink }}>Feed Management</div>
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>Calculator, inventory, purchases</div>
            </div>
            <Icon name="ChevronRight" size={18} color={T.inkFaint} />
          </div>
        </Card>

        <SectionHeader title="Your Enterprises" />

        {enterprises.map((e) => {
          const fg  = accentColor[e.accent] || T.primary;
          const bg  = accentSoft[e.accent]  || T.primarySoft;
          const cnt = counts[e.id] || 0;
          const upcomingCount = upcoming[e.id] || 0;
          return (
            <Card key={e.id} onClick={() => push({ kind: ROUTE_MAP[e.id] })} pad={0}
              style={{ display: "flex", alignItems: "center", gap: 0, overflow: "hidden" }}>
              {/* Accent stripe */}
              <div style={{ width: 4, alignSelf: "stretch", background: fg, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 13, padding: "14px 14px" }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: bg,
                  display: "grid", placeItems: "center", flexShrink: 0, fontSize: 26, lineHeight: 1 }}>
                  {e.emoji || <Icon name={e.icon} size={22} color={fg} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.display, fontSize: 15, fontWeight: 700, color: T.ink }}>
                    {e.label}
                  </div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                    {cnt === 0 ? "No animals added yet" : `${cnt} animal${cnt !== 1 ? "s" : ""} registered`}
                    {upcomingCount > 0 && (
                      <span style={{ marginLeft: 8, background: T.orangeSoft, color: T.orange,
                        borderRadius: 6, padding: "1px 6px", fontSize: 11, fontWeight: 600 }}>
                        {upcomingCount} due
                      </span>
                    )}
                  </div>
                </div>
                <Icon name="ChevronRight" size={18} color={T.inkFaint} />
              </div>
            </Card>
          );
        })}

        {/* Quick tips */}
        <SectionHeader title="Quick Tips" style={{ marginTop: 8 }} />
        {[
          { icon: "Syringe",    text: "Log vaccinations to get timely reminders" },
          { icon: "TrendingUp", text: "Daily production logs help track profitability" },
          { icon: "AlertCircle",text: "Use AI Vet Advisor for health concerns" },
        ].map((tip, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10,
            padding: "10px 12px", background: T.surface2, borderRadius: T.rMd }}>
            <Icon name={tip.icon} size={16} color={T.inkSoft} style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 12.5, color: T.inkSoft }}>{tip.text}</div>
          </div>
        ))}
      </div>
    </>
  );
}
