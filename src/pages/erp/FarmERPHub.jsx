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

/* kind drives navigation; label is display only. */
const MODULES = [
  { kind: "farmProfiles",       label: { en: "Farms", hi: "फार्म", bn: "খামার" },       icon: "House",         a: "primary" },
  { kind: "landManager",        label: { en: "Land", hi: "भूमि", bn: "জমি" },        icon: "Map",           a: "orange"  },
  { kind: "cropCalendar",       label: { en: "Crops", hi: "फ़सलें", bn: "ফসল" },       icon: "Wheat",         a: "primary" },
  { kind: "cropPlanList",       label: { en: "Crop Planner", hi: "फ़सल योजना", bn: "ফসল পরিকল্পনা" }, icon: "Calculator",   a: "yellow"  },
  { kind: "livestockHub",       label: { en: "Livestock", hi: "पशुधन", bn: "পশুসম্পদ" },   icon: "Rabbit",        a: "red"     },
  { kind: "feedHub",            label: { en: "Feed Mgmt", hi: "चारा प्रबंधन", bn: "খাদ্য ব্যবস্থাপনা" },   icon: "Package",       a: "orange"  },
  { kind: "erpTasks",           label: { en: "Tasks", hi: "कार्य", bn: "কাজ" },       icon: "ListChecks",    a: "blue"    },
  { kind: "erpInventory",       label: { en: "Inventory", hi: "स्टॉक", bn: "মজুত" },   icon: "Warehouse",     a: "orange"  },
  { kind: "erpAssets",          label: { en: "Assets", hi: "संपत्ति", bn: "সম্পদ" },      icon: "Tractor",       a: "yellow"  },
  { kind: "erpEmployees",       label: { en: "Team", hi: "टीम", bn: "দল" },        icon: "Users",         a: "blue"    },
  { kind: "erpCrm",             label: { en: "CRM & Orders", hi: "ग्राहक और ऑर्डर", bn: "ক্রেতা ও অর্ডার" },icon: "Handshake",     a: "primary" },
  { kind: "vaccinationCalendar",label: { en: "Vaccinations", hi: "टीकाकरण", bn: "টিকাকরণ" },icon: "Syringe",       a: "red"     },
  { kind: "erpProduction",      label: { en: "Production", hi: "उत्पादन", bn: "উৎপাদন" },  icon: "TrendingUp",    a: "primary" },
  { kind: "farmLedger",         label: { en: "Ledger", hi: "खाता-बही", bn: "খাতা" },      icon: "BookOpen",      a: "yellow"  },
  { kind: "businessDashboard",  label: { en: "Business", hi: "व्यापार", bn: "ব্যবসা" },    icon: "BarChart3",     a: "blue"    },
  { kind: "erpReports",         label: { en: "Reports", hi: "रिपोर्ट", bn: "রিপোর্ট" },     icon: "FileText",      a: "orange"  },
  { kind: "erpAnalytics",       label: { en: "Analytics", hi: "विश्लेषण", bn: "বিশ্লেষণ" },   icon: "PieChart",      a: "primary" },
  { kind: "erpInsights",        label: { en: "AI Insights", hi: "AI जानकारी", bn: "AI অন্তর্দৃষ্টি" }, icon: "Sparkles",      a: "blue"    },
  { kind: "erpDevices",         label: { en: "IoT Devices", hi: "IoT उपकरण", bn: "IoT ডিভাইস" }, icon: "Satellite",     a: "yellow"  },
];

const FG = { primary: T.primary, blue: T.blue, orange: T.orange, red: T.red, yellow: T.yellow };
const BG = { primary: T.primarySoft, blue: T.blueSoft, orange: T.orangeSoft, red: T.redSoft, yellow: T.yellowSoft };

export default function FarmERPHub() {
  const { pop, push, tc } = useApp();
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
      <AppBar title={tc({ en: "Farm ERP", hi: "फार्म ERP", bn: "ফার্ম ERP" })} onBack={pop} />
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
              {farm ? farm.name : tc({ en: "Set up your farm", hi: "अपना फार्म सेट करें", bn: "আপনার খামার সেট করুন" })}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.72)", marginTop: 2 }}>
              {farm
                ? `${farmService.typeLabel(farm.type)}${farm.village ? ` · ${farm.village}` : ""} — ${tc({ en: "tap to switch farm", hi: "फार्म बदलने के लिए टैप करें", bn: "খামার বদলাতে ট্যাপ করুন" })}`
                : tc({ en: "Create a farm profile to organise your records", hi: "रिकॉर्ड व्यवस्थित करने के लिए फार्म प्रोफ़ाइल बनाएँ", bn: "রেকর্ড গোছাতে একটি খামার প্রোফাইল তৈরি করুন" })}
            </div>
          </div>
          <Icon name="ChevronRight" size={18} color="rgba(255,255,255,.6)" />
        </button>

        {/* KPI strip */}
        {kpi && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div style={{ background: T.primarySoft, borderRadius: T.rMd, padding: "10px 12px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.primary, fontFamily: T.display }}>{compact(kpi.totalRevenue)}</div>
              <div style={{ fontSize: 10.5, color: T.inkSoft }}>{tc({ en: "Revenue", hi: "राजस्व", bn: "আয়" })} {new Date().getFullYear()}</div>
            </div>
            <div style={{ background: kpi.netProfit >= 0 ? T.primarySoft : T.redSoft, borderRadius: T.rMd, padding: "10px 12px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: kpi.netProfit >= 0 ? T.primary : T.red, fontFamily: T.display }}>{compact(kpi.netProfit)}</div>
              <div style={{ fontSize: 10.5, color: T.inkSoft }}>{tc({ en: "Net Profit", hi: "शुद्ध लाभ", bn: "নিট মুনাফা" })}</div>
            </div>
            <div style={{ background: totalAlerts > 0 ? T.orangeSoft : T.surface2, borderRadius: T.rMd, padding: "10px 12px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: totalAlerts > 0 ? T.orange : T.inkSoft, fontFamily: T.display }}>{totalAlerts}</div>
              <div style={{ fontSize: 10.5, color: T.inkSoft }}>{tc({ en: "Alerts", hi: "अलर्ट", bn: "সতর্কতা" })}</div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {totalAlerts > 0 && (
          <div style={{ background: T.orangeSoft, borderRadius: T.rLg, padding: "11px 14px",
            borderLeft: `4px solid ${T.orange}`, fontSize: 12.5, color: T.inkSoft }}>
            {alerts.overdue > 0 && <div>• {tc({ en: `${alerts.overdue} overdue task${alerts.overdue > 1 ? "s" : ""}`, hi: `${alerts.overdue} विलंबित कार्य`, bn: `${alerts.overdue}টি বিলম্বিত কাজ` })}</div>}
            {alerts.missedVax > 0 && <div>• {tc({ en: `${alerts.missedVax} missed vaccination${alerts.missedVax > 1 ? "s" : ""}`, hi: `${alerts.missedVax} छूटे टीकाकरण`, bn: `${alerts.missedVax}টি বাদ পড়া টিকা` })}</div>}
            {alerts.lowStock > 0 && <div>• {tc({ en: `${alerts.lowStock} stock alert${alerts.lowStock > 1 ? "s" : ""}`, hi: `${alerts.lowStock} स्टॉक अलर्ट`, bn: `${alerts.lowStock}টি মজুত সতর্কতা` })}</div>}
          </div>
        )}

        {/* Module grid */}
        <SectionHeader title={tc({ en: "Modules", hi: "मॉड्यूल", bn: "মডিউল" })} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {MODULES.map((m) => (
            <Card key={m.kind} onClick={() => push({ kind: m.kind })} pad={12}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: BG[m.a],
                display: "grid", placeItems: "center" }}>
                <Icon name={m.icon} size={19} color={FG[m.a]} />
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: T.ink, textAlign: "center" }}>{tc(m.label)}</div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
