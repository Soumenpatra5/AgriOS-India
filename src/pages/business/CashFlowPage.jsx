import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, SectionHeader } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import Restricted from "../../components/Restricted.jsx";
import { cashFlowService } from "../../services/business/cashFlowService.js";
import { plService } from "../../services/business/plService.js";
import { rupee } from "../../utils/format.js";

function WaterfallChart({ data }) {
  const vals   = data.map((d) => d.closing);
  const min    = Math.min(...vals, 0);
  const max    = Math.max(...vals, 1);
  const range  = max - min || 1;
  const H = 80; const W_ITEM = 26;

  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: H + 24, minWidth: data.length * (W_ITEM + 4) }}>
        {data.map((d, i) => {
          const barH = Math.max(3, Math.round(((d.closing - min) / range) * (H - 4)));
          const color = d.closing >= 0 ? T.primary : T.red;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{ fontSize: 8, color: T.inkFaint, textAlign: "center" }}>
                {d.closing >= 0 ? "" : "−"}
              </div>
              <div style={{ width: W_ITEM, height: barH, background: color, borderRadius: "3px 3px 0 0",
                transition: "height .3s var(--ag-ease)" }} />
              <div style={{ fontSize: 9, color: T.inkFaint }}>{d.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CashFlowPage() {
  const { pop, tc, can } = useApp();
  const [year, setYear]   = useState(new Date().getFullYear());
  const [flow, setFlow]   = useState([]);
  const [peaks, setPeaks] = useState({});
  const [years, setYears] = useState([]);

  useEffect(() => {
    plService.availableYears().then(setYears);
  }, []);

  useEffect(() => {
    (async () => {
      setFlow(await cashFlowService.monthlyFlow(year));
      setPeaks(await cashFlowService.peakMonths(year));
    })();
  }, [year]);

  const activeFlow = flow.filter((m) => m.income > 0 || m.expense > 0 || m.opening !== 0);
  const negativeMths = flow.filter((m) => m.closing < 0);

  if (!can("finance.view")) return (
    <>
      <AppBar title={tc({en: "Cash Flow", hi: "नकदी प्रवाह", bn: "নগদ প্রবাহ"})} onBack={pop} />
      <Restricted tc={tc} />
    </>
  );

  return (
    <>
      <AppBar title={tc({en: "Cash Flow", hi: "नकदी प्रवाह", bn: "নগদ প্রবাহ"})} onBack={pop} />
      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 14,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* Year selector */}
        <div style={{ display: "flex", gap: 8 }}>
          {years.map((y) => (
            <button key={y} onClick={() => setYear(Number(y))}
              style={{ padding: "5px 12px", borderRadius: T.pill, border: `1px solid ${T.line}`,
                background: year === Number(y) ? T.primary : T.surface, color: year === Number(y) ? "#fff" : T.ink,
                fontFamily: T.body, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {y}
            </button>
          ))}
        </div>

        {/* Running balance chart */}
        <Card pad={14}>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>{tc({en: `Running Cash Balance — ${year}`, hi: `चालू नकद शेष — ${year}`, bn: `চলমান নগদ ব্যালেন্স — ${year}`})}</div>
          <WaterfallChart data={flow} />
        </Card>

        {/* Alerts */}
        {negativeMths.length > 0 && (
          <div style={{ background: T.redSoft, borderRadius: T.rLg, padding: "12px 14px",
            borderLeft: `4px solid ${T.red}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.red, marginBottom: 4 }}>
              {tc({en: "⚠ Cash-negative months", hi: "⚠ नकदी-ऋणात्मक महीने", bn: "⚠ নগদ-ঋণাত্মক মাসগুলি"})}
            </div>
            <div style={{ fontSize: 12, color: T.inkSoft }}>
              {negativeMths.map((m) => m.label).join(", ")} — {tc({en: "plan credit or reduce expenses in advance.", hi: "पहले से ऋण की योजना बनाएं या खर्च कम करें।", bn: "আগে থেকে ঋণের পরিকল্পনা করুন বা খরচ কমান।"})}
            </div>
          </div>
        )}

        {/* Peak months */}
        {peaks.peakIncome && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Card pad={12} style={{ borderTop: `3px solid ${T.primary}` }}>
              <div style={{ fontSize: 11, color: T.inkSoft }}>{tc({en: "Peak Income Month", hi: "अधिकतम आय माह", bn: "সর্বোচ্চ আয়ের মাস"})}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: T.ink, marginTop: 4 }}>{peaks.peakIncome.label}</div>
              <div style={{ fontSize: 13, color: T.primary }}>{rupee(peaks.peakIncome.income)}</div>
            </Card>
            <Card pad={12} style={{ borderTop: `3px solid ${T.red}` }}>
              <div style={{ fontSize: 11, color: T.inkSoft }}>{tc({en: "Peak Expense Month", hi: "अधिकतम व्यय माह", bn: "সর্বোচ্চ ব্যয়ের মাস"})}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: T.ink, marginTop: 4 }}>{peaks.peakExpense.label}</div>
              <div style={{ fontSize: 13, color: T.red }}>{rupee(peaks.peakExpense.expense)}</div>
            </Card>
          </div>
        )}

        {/* Monthly detail table */}
        <SectionHeader title={tc({en: "Monthly Breakdown", hi: "मासिक विवरण", bn: "মাসিক বিবরণ"})} />
        {activeFlow.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: T.inkFaint, fontSize: 13 }}>
            {tc({en: `No transactions for ${year}. Add entries in Farm Ledger to see cash flow.`, hi: `${year} के लिए कोई लेनदेन नहीं। नकदी प्रवाह देखने के लिए फार्म लेजर में प्रविष्टि करें।`, bn: `${year}-এর জন্য কোনো লেনদেন নেই। নগদ প্রবাহ দেখতে ফার্ম লেজারে এন্ট্রি করুন।`})}
          </div>
        ) : (
          flow.map((m) => (
            <Card key={m.month} pad={12} style={{
              borderLeft: `3px solid ${m.closing < 0 ? T.red : m.net > 0 ? T.primary : T.line}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {m.label}
                    {m.closing < 0 && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: T.red, background: T.redSoft,
                        borderRadius: 5, padding: "1px 5px", fontWeight: 700 }}>{tc({en: "NEGATIVE", hi: "ऋणात्मक", bn: "ঋণাত্মক"})}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>
                    {tc({en: "Opening", hi: "शुरुआती", bn: "শুরুর"})}: {rupee(m.opening)} &nbsp;|&nbsp;
                    <span style={{ color: T.primary }}>+{rupee(m.income)}</span> &nbsp;
                    <span style={{ color: T.red }}>−{rupee(m.expense)}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: T.inkSoft }}>{tc({en: "Closing", hi: "समापन", bn: "সমাপনী"})}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: m.closing >= 0 ? T.primary : T.red }}>
                    {rupee(m.closing)}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
