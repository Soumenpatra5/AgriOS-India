import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { useApp } from "../../store/AppStore.jsx";
import {
  AppBar, Card, Button, EmptyState, ErrorState, Spinner
} from "../../components/index.js";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { FARM_ERROR } from "../../services/farmSpace/farmSpaceApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";
import { analyticsApi } from "../../services/analytics/analyticsApi.js";

const MODULE_LABEL = {
  poultry: { en: "Poultry",     hi: "मुर्गीपालन",      bn: "হাঁস-মুরগি" },
  dairy:   { en: "Dairy",       hi: "डेयरी",            bn: "ডেয়ারি" },
  goat:    { en: "Goat & Sheep", hi: "बकरी व भेड़",      bn: "ছাগল ও ভেড়া" },
  pig:     { en: "Pig & Swine", hi: "सूअर पालन",         bn: "শূকর পালন" },
  fish:    { en: "Fish & Aqua", hi: "मत्स्य पालन",       bn: "মাছ চাষ" },
  bee:     { en: "Beekeeping",  hi: "मधुमक्खी पालन",     bn: "মৌমাছি পালন" },
  crop:    { en: "Crop",        hi: "फसल",               bn: "ফসল" },
};

const MODULE_COLOR = {
  poultry: "#f97316", dairy: "#3b82f6", goat: "#8b5cf6",
  pig: "#ec4899", fish: "#06b6d4", bee: "#f59e0b", crop: "#22c55e",
};

function fmt(n) { return Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: T.surface2, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: T.display, color: color ?? T.ink }}>
        ₹{fmt(value)}
      </div>
      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function TrendBar({ month, revenue, cost, maxVal }) {
  const revH = maxVal > 0 ? (revenue / maxVal) * 80 : 0;
  const costH = maxVal > 0 ? (cost / maxVal) * 80 : 0;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 80 }}>
        <div style={{ width: 8, background: "#22c55e", height: `${revH}px`, borderRadius: "2px 2px 0 0", minHeight: 2 }} />
        <div style={{ width: 8, background: "#ef4444", height: `${costH}px`, borderRadius: "2px 2px 0 0", minHeight: 2 }} />
      </div>
      <div style={{ fontSize: 9, color: T.inkFaint, writingMode: "vertical-rl", transform: "rotate(180deg)", marginTop: 2 }}>
        {month.slice(5)}
      </div>
    </div>
  );
}

export default function FarmSpaceAnalytics() {
  const { pop, tc } = useApp();
  const [space, setSpace]   = useState(null);
  const [data, setData]     = useState(null);
  const [state, setState]   = useState("loading");
  const [reason, setReason] = useState(null);
  const [from, setFrom]     = useState(yearStart());
  const [to, setTo]         = useState(today());

  const load = useCallback(async () => {
    setState("loading");
    try {
      const sp = await farmSpaceService.active();
      if (!sp) { setState("error"); setReason(FARM_ERROR.NOT_FOUND); return; }
      setSpace(sp);
      const r = await analyticsApi.summary(sp.id, { fromDate: from, toDate: to });
      setData(r);
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const title = tc({ en: "Farm Analytics", hi: "फार्म विश्लेषण", bn: "খামার বিশ্লেষণ" });

  if (state === "loading") return <><AppBar title={title} onBack={pop} />
    <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error") return <><AppBar title={title} onBack={pop} />
    <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;

  const maxTrendVal = data?.trend?.length
    ? Math.max(...data.trend.map(t => Math.max(t.revenue, t.cost)), 1)
    : 1;

  const activeModules = data?.by_module
    ? Object.entries(data.by_module).filter(([, m]) => m.revenue > 0 || m.cost > 0)
    : [];

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Date range */}
        <Card>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: T.inkSoft }}>{tc({ en: "From", hi: "से", bn: "থেকে" })}</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 3, padding: "7px 10px",
                  borderRadius: 8, border: `1px solid ${T.border}`, fontFamily: T.body,
                  fontSize: 13, background: T.surface, color: T.ink, boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: T.inkSoft }}>{tc({ en: "To", hi: "तक", bn: "পর্যন্ত" })}</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 3, padding: "7px 10px",
                  borderRadius: 8, border: `1px solid ${T.border}`, fontFamily: T.body,
                  fontSize: 13, background: T.surface, color: T.ink, boxSizing: "border-box" }} />
            </div>
          </div>
        </Card>

        {/* Summary strip */}
        <div style={{ display: "flex", gap: 8 }}>
          <SummaryCard label={tc({ en: "Revenue", hi: "राजस्व", bn: "রাজস্ব" })} value={data?.total_revenue} color="#22c55e" />
          <SummaryCard label={tc({ en: "Cost", hi: "लागत", bn: "খরচ" })} value={data?.total_cost} color="#ef4444" />
          <SummaryCard label={tc({ en: "Profit", hi: "लाभ", bn: "মুনাফা" })}
            value={data?.net_profit} color={data?.net_profit >= 0 ? "#22c55e" : "#ef4444"} />
        </div>

        {/* Monthly trend chart */}
        {data?.trend?.length > 0 && (
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 10 }}>
              {tc({ en: "Monthly trend", hi: "मासिक रुझान", bn: "মাসিক প্রবণতা" })}
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end", overflowX: "auto" }}>
              {data.trend.map(t => (
                <TrendBar key={t.month} month={t.month}
                  revenue={t.revenue} cost={t.cost} maxVal={maxTrendVal} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 8, justifyContent: "center" }}>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <div style={{ width: 10, height: 10, background: "#22c55e", borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: T.inkSoft }}>{tc({ en: "Revenue", hi: "राजस्व", bn: "রাজস্ব" })}</span>
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <div style={{ width: 10, height: 10, background: "#ef4444", borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: T.inkSoft }}>{tc({ en: "Cost", hi: "लागत", bn: "খরচ" })}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Module breakdown */}
        {activeModules.length > 0 ? (
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 10 }}>
              {tc({ en: "By module", hi: "मॉड्यूल अनुसार", bn: "মডিউল অনুসারে" })}
            </div>
            {activeModules.map(([mod, m]) => (
              <div key={mod} style={{ display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%",
                  background: MODULE_COLOR[mod] ?? T.primary, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 13.5, color: T.ink }}>
                  {tc(MODULE_LABEL[mod] ?? { en: mod })}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 600,
                    color: m.profit >= 0 ? "#22c55e" : "#ef4444" }}>
                    ₹{fmt(m.profit)}
                  </div>
                  <div style={{ fontSize: 11, color: T.inkSoft }}>
                    ₹{fmt(m.revenue)} / ₹{fmt(m.cost)}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState icon="BarChart2"
            title={tc({ en: "No data for this period", hi: "इस अवधि के लिए कोई डेटा नहीं", bn: "এই সময়কালের জন্য কোনও ডেটা নেই" })}
            body={tc({ en: "Record sales and costs in any module to see analytics here.", hi: "विश्लेषण देखने के लिए किसी भी मॉड्यूल में बिक्री और लागत दर्ज करें।", bn: "এখানে বিশ্লেষণ দেখতে যেকোনো মডিউলে বিক্রয় ও খরচ রেকর্ড করুন।" })} />
        )}
      </div>
    </>
  );
}
