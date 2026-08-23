import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, SectionHeader } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import Restricted from "../../components/Restricted.jsx";
import { kpiService } from "../../services/business/kpiService.js";
import { plService } from "../../services/business/plService.js";
import { rupee, compact } from "../../utils/format.js";

const H_PAD = 16;

function Sparkline({ data, color, height = 36 }) {
  if (!data || data.length < 2) return null;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 120; const h = height;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={pts.split(" ").pop().split(",")[0]} cy={pts.split(" ").pop().split(",")[1]}
        r="3" fill={color} />
    </svg>
  );
}

export default function BusinessDashboard() {
  const { pop, push, tc, can } = useApp();
  const [year, setYear]   = useState(new Date().getFullYear());
  const [kpi, setKpi]     = useState(null);
  const [byEnt, setByEnt] = useState([]);
  const [years, setYears] = useState([]);

  useEffect(() => {
    plService.availableYears().then(setYears);
  }, []);

  useEffect(() => {
    (async () => {
      setKpi(await kpiService.summary(year));
      setByEnt(await plService.byEnterprise(year));
    })();
  }, [year]);

  const profitColor = kpi?.netProfit >= 0 ? T.primary : T.red;

  if (!can("finance.view")) return (
    <>
      <AppBar title={tc({en: "Business Dashboard", hi: "व्यापार डैशबोर्ड", bn: "ব্যবসা ড্যাশবোর্ড"})} onBack={pop} />
      <Restricted tc={tc} />
    </>
  );

  return (
    <>
      <AppBar title={tc({en: "Business Dashboard", hi: "व्यापार डैशबोर्ड", bn: "ব্যবসা ড্যাশবোর্ড"})} onBack={pop} />
      <div style={{ padding: `8px ${H_PAD}px 32px`, display: "flex", flexDirection: "column", gap: 14,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* Year selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
          {years.map((y) => (
            <button key={y} onClick={() => setYear(Number(y))}
              style={{ padding: "5px 12px", borderRadius: T.pill, border: `1px solid ${T.line}`,
                background: year === Number(y) ? T.primary : T.surface, color: year === Number(y) ? "#fff" : T.ink,
                fontFamily: T.body, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {y}
            </button>
          ))}
        </div>

        {/* KPI cards */}
        {kpi && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: tc({en: "Total Revenue", hi: "कुल राजस्व", bn: "মোট রাজস্ব"}), value: compact(kpi.totalRevenue), icon: "TrendingUp", color: T.primary, bg: T.primarySoft },
                { label: tc({en: "Total Cost", hi: "कुल लागत", bn: "মোট খরচ"}),    value: compact(kpi.totalCost),    icon: "TrendingDown", color: T.red,     bg: T.redSoft    },
                { label: tc({en: "Net Profit", hi: "शुद्ध लाभ", bn: "নিট লাভ"}),    icon: "Wallet",       value: compact(kpi.netProfit), color: profitColor, bg: kpi.netProfit >= 0 ? T.primarySoft : T.redSoft },
                { label: tc({en: "Profit Margin", hi: "लाभ मार्जिन", bn: "লাভের মার্জিন"}), value: `${kpi.profitMargin}%`,   icon: "Percent",      color: T.blue,    bg: T.blueSoft   },
              ].map((c) => (
                <div key={c.label} style={{ background: c.bg, borderRadius: T.rLg, padding: "14px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Icon name={c.icon} size={14} color={c.color} />
                    <div style={{ fontSize: 11, color: T.inkSoft }}>{c.label}</div>
                  </div>
                  <div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700, color: c.color }}>
                    {c.value}
                  </div>
                </div>
              ))}
            </div>

            {/* ROI and growth */}
            <Card pad={14}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: T.inkSoft }}>{tc({en: "Return on Investment", hi: "निवेश पर प्रतिफल", bn: "বিনিয়োগের রিটার্ন"})}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: kpi.roi >= 0 ? T.primary : T.red, fontFamily: T.display }}>
                    {kpi.roi}%
                  </div>
                </div>
                {kpi.revenueGrowth !== null && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: T.inkSoft }}>{tc({en: "Month-on-Month Revenue", hi: "माह-दर-माह राजस्व", bn: "মাসে মাসে রাজস্ব"})}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: T.display,
                      color: kpi.revenueGrowth >= 0 ? T.primary : T.red }}>
                      {kpi.revenueGrowth >= 0 ? "+" : ""}{kpi.revenueGrowth}%
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Best enterprise */}
            {kpi.bestEnterprise && (
              <Card pad={14} style={{ borderLeft: `4px solid ${T.primary}` }}>
                <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 4 }}>{tc({en: "🏆 Best Performing Enterprise", hi: "🏆 सर्वश्रेष्ठ प्रदर्शन करने वाला उद्यम", bn: "🏆 সেরা পারফর্মিং এন্টারপ্রাইজ"})}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: T.ink }}>{kpi.bestEnterprise.label}</div>
                <div style={{ fontSize: 13, color: T.primary, marginTop: 2 }}>
                  {tc({en: "Net profit", hi: "शुद्ध लाभ", bn: "নিট লাভ"})}: {rupee(kpi.bestEnterprise.net)}
                </div>
              </Card>
            )}
          </>
        )}

        {/* Enterprise breakdown */}
        <SectionHeader title={tc({en: "By Enterprise", hi: "उद्यम अनुसार", bn: "এন্টারপ্রাইজ অনুসারে"})} />
        {byEnt.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: T.inkFaint, fontSize: 13 }}>
            {tc({en: `No transactions recorded for ${year}.`, hi: `${year} के लिए कोई लेनदेन दर्ज नहीं।`, bn: `${year}-এর জন্য কোনো লেনদেন নেই।`})}<br />{tc({en: "Add entries in Farm Ledger to see your P&L.", hi: "अपना लाभ-हानि देखने के लिए फार्म लेजर में प्रविष्टि करें।", bn: "আপনার লাভ-ক্ষতি দেখতে ফার্ম লেজারে এন্ট্রি করুন।"})}
          </div>
        ) : (
          byEnt.map((e) => {
            const barW = e.income > 0 ? Math.round((Math.max(0, e.net) / e.income) * 100) : 0;
            return (
              <Card key={e.id} pad={12}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{e.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: e.net >= 0 ? T.primary : T.red }}>
                    {e.net >= 0 ? "+" : ""}{rupee(e.net)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.inkSoft, marginBottom: 8 }}>
                  <span>↑ {rupee(e.income)}</span>
                  <span>↓ {rupee(e.expense)}</span>
                </div>
                {/* Profit bar */}
                <div style={{ height: 4, background: T.line, borderRadius: 4 }}>
                  <div style={{ height: 4, width: `${barW}%`, background: e.net >= 0 ? T.primary : T.red,
                    borderRadius: 4, transition: "width .4s var(--ag-ease)" }} />
                </div>
              </Card>
            );
          })
        )}

        {/* Quick links */}
        <SectionHeader title={tc({en: "Reports", hi: "रिपोर्ट", bn: "রিপোর্ট"})} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: tc({en: "P&L Report", hi: "लाभ-हानि रिपोर्ट", bn: "লাভ-ক্ষতি রিপোর্ট"}),    icon: "FileText", kind: "plReport",    color: T.primary, bg: T.primarySoft },
            { label: tc({en: "Cash Flow", hi: "नकदी प्रवाह", bn: "নগদ প্রবাহ"}),     icon: "ArrowLeftRight", kind: "cashFlow", color: T.blue, bg: T.blueSoft },
            { label: tc({en: "DPR Generator", hi: "डीपीआर जनरेटर", bn: "ডিপিআর জেনারেটর"}), icon: "Landmark", kind: "dprGenerator", color: T.orange, bg: T.orangeSoft },
          ].map((r) => (
            <Card key={r.label} onClick={() => push({ kind: r.kind })} pad={14}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: r.bg, border: "none" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,.6)",
                display: "grid", placeItems: "center" }}>
                <Icon name={r.icon} size={20} color={r.color} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: r.color }}>{r.label}</div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
