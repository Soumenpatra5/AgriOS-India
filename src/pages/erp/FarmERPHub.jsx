import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, SectionHeader } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmService } from "../../services/farm/farmService.js";
import { taskService } from "../../services/tasks/taskService.js";
import { vaccinationService } from "../../services/livestock/vaccinationService.js";
import { inventoryService } from "../../services/inventory/inventoryService.js";
import { kpiService } from "../../services/business/kpiService.js";
import { compact } from "../../utils/format.js";

const H_PAD = 16;

const MODULES = [
  { kind: "farmProfiles",       label: "Farms",       icon: "House",         a: "primary" },
  { kind: "landManager",        label: "Land",        icon: "Map",           a: "orange"  },
  { kind: "cropCalendar",       label: "Crops",       icon: "Wheat",         a: "primary" },
  { kind: "cropPlanList",       label: "Crop Planner", icon: "Calculator",   a: "yellow"  },
  { kind: "livestockHub",       label: "Livestock",   icon: "Rabbit",        a: "red"     },
  { kind: "erpTasks",           label: "Tasks",       icon: "ListChecks",    a: "blue"    },
  { kind: "erpInventory",       label: "Inventory",   icon: "Warehouse",     a: "orange"  },
  { kind: "erpAssets",          label: "Assets",      icon: "Tractor",       a: "yellow"  },
  { kind: "erpEmployees",       label: "Team",        icon: "Users",         a: "blue"    },
  { kind: "erpCrm",             label: "CRM & Orders",icon: "Handshake",     a: "primary" },
  { kind: "vaccinationCalendar",label: "Vaccinations",icon: "Syringe",       a: "red"     },
  { kind: "erpProduction",      label: "Production",  icon: "TrendingUp",    a: "primary" },
  { kind: "farmLedger",         label: "Ledger",      icon: "BookOpen",      a: "yellow"  },
  { kind: "businessDashboard",  label: "Business",    icon: "BarChart3",     a: "blue"    },
  { kind: "erpReports",         label: "Reports",     icon: "FileText",      a: "orange"  },
  { kind: "erpAnalytics",       label: "Analytics",   icon: "PieChart",      a: "primary" },
  { kind: "erpInsights",        label: "AI Insights", icon: "Sparkles",      a: "blue"    },
  { kind: "erpDevices",         label: "IoT Devices", icon: "Satellite",     a: "yellow"  },
];

const FG = { primary: T.primary, blue: T.blue, orange: T.orange, red: T.red, yellow: T.yellow };
const BG = { primary: T.primarySoft, blue: T.blueSoft, orange: T.orangeSoft, red: T.redSoft, yellow: T.yellowSoft };

export default function FarmERPHub() {
  const { pop, push } = useApp();
  const [farm, setFarm]     = useState(null);
  const [alerts, setAlerts] = useState({ overdue: 0, missedVax: 0, lowStock: 0 });
  const [kpi, setKpi]       = useState(null);

  useEffect(() => {
    farmService.getActive().then(setFarm);
    kpiService.summary(new Date().getFullYear()).then(setKpi);
    (async () => {
      const [buckets, vax, inv] = await Promise.all([
        taskService.buckets(),
        vaccinationService.counts(),
        inventoryService.alerts(),
      ]);
      setAlerts({ overdue: buckets.overdue.length, missedVax: vax.missed,
                  lowStock: inv.lowStock.length + inv.expired.length });
    })();
  }, []);

  const totalAlerts = alerts.overdue + alerts.missedVax + alerts.lowStock;

  return (
    <>
      <AppBar title="Farm ERP" onBack={pop} />
      <div style={{ padding: `8px ${H_PAD}px 32px`, display: "flex", flexDirection: "column", gap: 12,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* Active farm header */}
        <button onClick={() => push({ kind: "farmProfiles" })}
          style={{ background: `linear-gradient(135deg, #065f46, #064e3b)`, borderRadius: T.rLg,
            padding: "16px 18px", border: "none", cursor: "pointer", textAlign: "left",
            display: "flex", alignItems: "center", gap: 13, fontFamily: T.body }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,.18)",
            display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon name="House" size={22} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
              {farm ? farm.name : "Set up your farm"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.72)", marginTop: 2 }}>
              {farm
                ? `${farmService.typeLabel(farm.type)}${farm.village ? ` · ${farm.village}` : ""} — tap to switch farm`
                : "Create a farm profile to organise your records"}
            </div>
          </div>
          <Icon name="ChevronRight" size={18} color="rgba(255,255,255,.6)" />
        </button>

        {/* KPI strip */}
        {kpi && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div style={{ background: T.primarySoft, borderRadius: T.rMd, padding: "10px 12px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.primary, fontFamily: T.display }}>{compact(kpi.totalRevenue)}</div>
              <div style={{ fontSize: 10.5, color: T.inkSoft }}>Revenue {new Date().getFullYear()}</div>
            </div>
            <div style={{ background: kpi.netProfit >= 0 ? T.primarySoft : T.redSoft, borderRadius: T.rMd, padding: "10px 12px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: kpi.netProfit >= 0 ? T.primary : T.red, fontFamily: T.display }}>{compact(kpi.netProfit)}</div>
              <div style={{ fontSize: 10.5, color: T.inkSoft }}>Net Profit</div>
            </div>
            <div style={{ background: totalAlerts > 0 ? T.orangeSoft : T.surface2, borderRadius: T.rMd, padding: "10px 12px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: totalAlerts > 0 ? T.orange : T.inkSoft, fontFamily: T.display }}>{totalAlerts}</div>
              <div style={{ fontSize: 10.5, color: T.inkSoft }}>Alerts</div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {totalAlerts > 0 && (
          <div style={{ background: T.orangeSoft, borderRadius: T.rLg, padding: "11px 14px",
            borderLeft: `4px solid ${T.orange}`, fontSize: 12.5, color: T.inkSoft }}>
            {alerts.overdue > 0 && <div>• {alerts.overdue} overdue task{alerts.overdue > 1 ? "s" : ""}</div>}
            {alerts.missedVax > 0 && <div>• {alerts.missedVax} missed vaccination{alerts.missedVax > 1 ? "s" : ""}</div>}
            {alerts.lowStock > 0 && <div>• {alerts.lowStock} stock alert{alerts.lowStock > 1 ? "s" : ""}</div>}
          </div>
        )}

        {/* Module grid */}
        <SectionHeader title="Modules" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {MODULES.map((m) => (
            <Card key={m.kind} onClick={() => push({ kind: m.kind })} pad={12}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: BG[m.a],
                display: "grid", placeItems: "center" }}>
                <Icon name={m.icon} size={19} color={FG[m.a]} />
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: T.ink, textAlign: "center" }}>{m.label}</div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
