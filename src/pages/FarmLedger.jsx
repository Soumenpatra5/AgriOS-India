import { useState, useEffect } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import {
  AppBar, Screen, Card, Chip, IconTile, Button, Dialog, Dropdown, Input, BottomSheet,
} from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import Restricted from "../components/Restricted.jsx";
import {
  ledgerService, INCOME_CATEGORIES, EXPENSE_CATEGORIES, ENTERPRISES,
} from "../services/ledger/ledgerService.js";
import { compact, rupee } from "../utils/format.js";
import { downloadCsv } from "../utils/exportCsv.js";
import { printReport } from "../utils/printReport.js";
import { useResponsive } from "../hooks/useResponsive.js";

const MONTHS_I18N = [
  {en:"January",hi:"जनवरी",bn:"জানুয়ারি"},{en:"February",hi:"फरवरी",bn:"ফেব্রুয়ারি"},
  {en:"March",hi:"मार्च",bn:"মার্চ"},{en:"April",hi:"अप्रैल",bn:"এপ্রিল"},
  {en:"May",hi:"मई",bn:"মে"},{en:"June",hi:"जून",bn:"জুন"},
  {en:"July",hi:"जुलाई",bn:"জুলাই"},{en:"August",hi:"अगस्त",bn:"আগস্ট"},
  {en:"September",hi:"सितंबर",bn:"সেপ্টেম্বর"},{en:"October",hi:"अक्टूबर",bn:"অক্টোবর"},
  {en:"November",hi:"नवंबर",bn:"নভেম্বর"},{en:"December",hi:"दिसंबर",bn:"ডিসেম্বর"},
];
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function FarmLedger() {
  const { pop, toast, tc, t, can } = useApp();
  const { isDesktop } = useResponsive(768);
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [filter, setFilter]   = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const atCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (atCurrentMonth) return;
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  const [summary, setSummary] = useState({ net: 0, income: 0, expense: 0 });
  const [txns, setTxns]       = useState([]);
  const [breakdown, setBreakdown] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await ledgerService.monthSummary(year, month + 1);
      const all = await ledgerService.forMonth(year, month + 1);
      if (!alive) return;
      setSummary(s);
      setTxns(filter === "all" ? all : all.filter((t) => t.kind === filter));

      // Spending-by-category, from the whole month's expenses (filter-independent).
      const expenses = all.filter((t) => t.kind === "expense");
      const totalExp = expenses.reduce((sum, t) => sum + t.amount, 0);
      const byCat = {};
      for (const e of expenses) byCat[e.categoryId] = (byCat[e.categoryId] || 0) + e.amount;
      setBreakdown(
        Object.entries(byCat)
          .map(([categoryId, total]) => ({
            categoryId, total,
            label: tc(ledgerService.categoryI18n("expense", categoryId)),
            icon: ledgerService.categoryIcon("expense", categoryId),
            pct: totalExp ? Math.round((total / totalExp) * 100) : 0,
          }))
          .sort((a, b) => b.total - a.total)
      );
    })();
    return () => { alive = false; };
  }, [year, month, filter, tick]);

  const netPos = summary.net >= 0;

  const handleExport = () => {
    if (!txns.length) { toast(tc({en:"No entries to export",hi:"निर्यात के लिए कोई प्रविष्टि नहीं",bn:"রপ্তানির জন্য কোনো এন্ট্রি নেই"}), "info"); return; }
    const rows = txns.map((t) => ({
      Date: t.date,
      Type: t.kind === "income" ? "Income" : "Expense",
      Category: ledgerService.categoryLabel(t.kind, t.categoryId),
      Enterprise: t.enterpriseId ? ledgerService.enterpriseLabel(t.enterpriseId) : "",
      Amount: t.amount,
      Note: t.note || "",
    }));
    const fn = `agrios-ledger-${year}-${String(month + 1).padStart(2, "0")}.csv`;
    downloadCsv(rows, fn);
    toast(tc({en:"Ledger exported",hi:"खाता निर्यात हो गया",bn:"খাতা রপ্তানি হয়েছে"}), "success");
  };

  const handlePrint = () => {
    if (!txns.length) {
      toast(tc({ en: "No entries to print", hi: "प्रिंट के लिए कोई प्रविष्टि नहीं", bn: "প্রিন্ট করার মতো কোনো তথ্য নেই" }), "info");
      return;
    }
    const columns = [
      { header: tc({ en: "Date", hi: "तारीख", bn: "তারিখ" }), key: "date" },
      { header: tc({ en: "Type", hi: "प्रकार", bn: "ধরন" }), key: "type" },
      { header: tc({ en: "Category", hi: "श्रेणी", bn: "বিভাগ" }), key: "category" },
      { header: tc({ en: "Enterprise", hi: "उद्यम", bn: "উদ্যোগ" }), key: "enterprise" },
      { header: tc({ en: "Amount", hi: "राशि", bn: "পরিমাণ" }), key: "amount", align: "right" },
      { header: tc({ en: "Note", hi: "विवरण", bn: "নোট" }), key: "note" },
    ];
    const rows = txns.map((t) => ({
      date: t.date,
      type: t.kind === "income" ? tc({ en: "Income", hi: "आय", bn: "আয়" }) : tc({ en: "Expense", hi: "खर्च", bn: "ব্যয়" }),
      category: tc(ledgerService.categoryI18n(t.kind, t.categoryId)),
      enterprise: t.enterpriseId ? ledgerService.enterpriseLabel(t.enterpriseId) : "—",
      amount: rupee(t.amount),
      note: t.note || "—",
    }));
    const summaryList = [
      { label: tc({ en: "Income", hi: "आय", bn: "আয়" }), value: rupee(summary.income) },
      { label: tc({ en: "Expense", hi: "खर्च", bn: "ব্যয়" }), value: rupee(summary.expense) },
      { label: tc({ en: "Net Profit", hi: "शुद्ध लाभ", bn: "নিট লাভ" }), value: rupee(summary.net) },
    ];
    const ok = printReport({
      title: `${tc({ en: "Farm Ledger Report", hi: "खेत का हिसाब रिपोर्ट", bn: "খামারের হিসাব রিপোর্ট" })} — ${tc(MONTHS_I18N[month])} ${year}`,
      subtitle: `${tc({ en: "Total Transactions", hi: "कुल लेन-देन", bn: "মোট লেনদেন" })}: ${txns.length}`,
      columns,
      rows,
      summary: summaryList,
    });
    if (!ok) {
      toast(tc({ en: "Unable to open print preview. Please check pop-up settings.", hi: "प्रिंट विंडो नहीं खुल सकी। पॉप-अप जांचें।", bn: "প্রিন্ট উইন্ডো খোলা যায়নি। পপ-আপ সেটিংস দেখুন।" }), "error");
    }
  };

  if (!can("finance.view")) return (
    <>
      <AppBar title={tc({en:"Farm ledger",hi:"खेत का हिसाब",bn:"খামারের হিসাব"})} onBack={pop} />
      <Restricted tc={tc} />
    </>
  );

  return (
    <>
      <AppBar title={tc({en:"Farm ledger",hi:"खेत का हिसाब",bn:"খামারের হিসাব"})} onBack={pop} action={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isDesktop ? (
            <>
              <button onClick={handleExport} aria-label={tc({ en: "Export CSV", hi: "CSV निर्यात करें", bn: "CSV ডাউনলোড করুন" })}
                style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "8px 12px",
                  cursor: "pointer", color: T.ink, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, fontFamily: T.body }}>
                <Icon name="Download" size={15} /> {tc({ en: "Export CSV", hi: "CSV निर्यात", bn: "CSV ডাউনলোড" })}
              </button>
              <button onClick={handlePrint} aria-label={tc({ en: "Print Report", hi: "रिपोर्ट प्रिंट करें", bn: "রিপোর্ট প্রিন্ট করুন" })}
                style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "8px 12px",
                  cursor: "pointer", color: T.ink, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, fontFamily: T.body }}>
                <Icon name="Printer" size={15} /> {tc({ en: "Print", hi: "प्रिंट", bn: "প্রিন্ট" })}
              </button>
            </>
          ) : (
            <button onClick={handleExport} aria-label={tc({ en: "Export CSV", hi: "CSV निर्यात करें", bn: "CSV ডাউনলোড করুন" })}
              style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8,
                cursor: "pointer", color: T.ink, display: "flex" }}>
              <Icon name="Download" size={17} />
            </button>
          )}
          <button onClick={() => setAddOpen(true)}
            style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
              cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
              fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
            <Icon name="PlusCircle" size={17} /> {tc({en:"Add",hi:"जोड़ें",bn:"যোগ করুন"})}
          </button>
        </div>
      } />

      <Screen gap={16}>
        {isDesktop ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Top Month + P&L Bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface, padding: "16px 20px", borderRadius: 14, border: `1px solid ${T.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={prevMonth} aria-label={tc({ en: "Previous month", hi: "पिछला महीना", bn: "আগের মাস" })}
                  style={{ background: T.surface2, border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", color: T.ink }}>
                  <Icon name="ChevronLeft" size={18} />
                </button>
                <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 800 }}>{tc(MONTHS_I18N[month])} {year}</div>
                <button onClick={nextMonth} disabled={atCurrentMonth} aria-label={tc({ en: "Next month", hi: "अगला महीना", bn: "পরের মাস" })}
                  style={{ background: T.surface2, border: "none", borderRadius: 8, padding: "6px 10px",
                    cursor: atCurrentMonth ? "default" : "pointer", display: "flex",
                    color: atCurrentMonth ? T.inkFaint : T.ink }}>
                  <Icon name="ChevronRight" size={18} />
                </button>
              </div>

              {/* Filter chips */}
              <div style={{ display: "flex", gap: 8 }}>
                {[["all", {en:"All",hi:"सभी",bn:"সব"}], ["income", {en:"Income",hi:"आय",bn:"আয়"}], ["expense", {en:"Expense",hi:"खर्च",bn:"ব্যয়"}]].map(([k, l]) => (
                  <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{tc(l)}</Chip>
                ))}
              </div>
            </div>

            {/* 3 Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <SumTile label={t("net")} icon={netPos ? "TrendingUp" : "TrendingDown"}
                value={(netPos ? "+" : "-") + compact(Math.abs(summary.net))}
                bg={netPos ? T.primarySoft : T.redSoft} fg={netPos ? T.primary : T.red} />
              <SumTile label={t("income")} icon="ArrowDownCircle" value={compact(summary.income)} bg={T.primarySoft} fg={T.primary} />
              <SumTile label={t("expense")} icon="ArrowUpCircle"  value={compact(summary.expense)} bg={T.redSoft}     fg={T.red}     />
            </div>

            {/* 2-Column Main Workspace */}
            <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>
              {/* Left Column: Spending Breakdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="PieChart" size={15} /> {tc({ en: "Spending by category", hi: "श्रेणी अनुसार खर्च", bn: "বিভাগ অনুযায়ী ব্যয়" })}
                </div>
                <Card pad={16} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {breakdown.length === 0 ? (
                    <div style={{ color: T.inkFaint, fontSize: 12.5, textAlign: "center", padding: "16px 0" }}>
                      {tc({ en: "No expense recorded this month", hi: "इस महीने कोई खर्च दर्ज नहीं है", bn: "এই মাসে কোনো ব্যয় রেকর্ড করা নেই" })}
                    </div>
                  ) : (
                    breakdown.map((b) => (
                      <div key={b.categoryId}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <Icon name={b.icon} size={14} style={{ color: T.inkSoft, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 12.5, color: T.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.label}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{rupee(b.total)}</span>
                          <span style={{ fontSize: 11, color: T.inkFaint, width: 34, textAlign: "right" }}>{b.pct}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: T.surface2, overflow: "hidden" }}>
                          <div style={{ width: `${b.pct}%`, height: "100%", background: T.red, borderRadius: 3, transition: "width .4s var(--ag-ease)" }} />
                        </div>
                      </div>
                    ))
                  )}
                </Card>
              </div>

              {/* Right Column: Spreadsheet Table */}
              <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.line}`, overflow: "hidden", boxShadow: T.shadowSm }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
                    {tc({ en: "Ledger Entries", hi: "खाता प्रविष्टियाँ", bn: "খাতা এন্ট্রি" })} ({txns.length})
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleExport}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.line}`, color: T.ink, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      <Icon name="Download" size={14} />
                      <span>{tc({ en: "Export CSV", hi: "CSV निर्यात", bn: "CSV ডাউনলোড" })}</span>
                    </button>
                    <button onClick={() => setAddOpen(true)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, background: T.primary, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      <Icon name="Plus" size={14} strokeWidth={2.6} />
                      <span>{tc({ en: "Add", hi: "जोड़ें", bn: "যোগ করুন" })}</span>
                    </button>
                  </div>
                </div>

                {txns.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 16px", color: T.inkSoft }}>
                    <Icon name="Receipt" size={36} style={{ color: T.inkFaint, display: "block", margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{tc({en:"No entries yet",hi:"अभी कोई प्रविष्टि नहीं",bn:"এখনও কোনো এন্ট্রি নেই"})}</div>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, fontFamily: T.body }}>
                      <thead>
                        <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.line}`, color: T.inkSoft, fontSize: 12, fontWeight: 700 }}>
                          <th style={{ padding: "12px 16px" }}>{tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })}</th>
                          <th style={{ padding: "12px 16px" }}>{tc({ en: "Type", hi: "प्रकार", bn: "ধরন" })}</th>
                          <th style={{ padding: "12px 16px" }}>{tc({ en: "Category", hi: "श्रेणी", bn: "বিভাগ" })}</th>
                          <th style={{ padding: "12px 16px" }}>{tc({ en: "Enterprise", hi: "उद्यम", bn: "উদ্যোগ" })}</th>
                          <th style={{ padding: "12px 16px" }}>{tc({ en: "Note", hi: "विवरण", bn: "নোট" })}</th>
                          <th style={{ padding: "12px 16px", textAlign: "right" }}>{tc({ en: "Amount", hi: "राशि", bn: "টাকা" })}</th>
                          <th style={{ padding: "12px 16px", textAlign: "right" }}>{tc({ en: "Actions", hi: "कार्रवाई", bn: "পদক্ষেপ" })}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txns.map((t, i) => {
                          const isInc = t.kind === "income";
                          const catLabel = tc(ledgerService.categoryI18n(t.kind, t.categoryId));
                          const entLabel = t.enterpriseId ? ledgerService.enterpriseLabel(t.enterpriseId) : "—";
                          return (
                            <tr key={t.id} style={{ borderBottom: `1px solid ${T.lineSoft}`, background: i % 2 === 0 ? "transparent" : `${T.surface2}55` }}>
                              <td style={{ padding: "12px 16px", fontWeight: 600, color: T.inkFaint }}>{fmtDate(t.date)}</td>
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{ background: isInc ? T.primarySoft : T.redSoft, color: isInc ? T.primary : T.red, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                                  {isInc ? tc({ en: "Income", hi: "आय", bn: "আয়" }) : tc({ en: "Expense", hi: "खर्च", bn: "ব্যয়" })}
                                </span>
                              </td>
                              <td style={{ padding: "12px 16px", fontWeight: 600, color: T.ink }}>{catLabel}</td>
                              <td style={{ padding: "12px 16px", color: T.inkSoft }}>{entLabel}</td>
                              <td style={{ padding: "12px 16px", color: T.inkSoft }}>{t.note || "—"}</td>
                              <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: isInc ? T.primary : T.red, fontVariantNumeric: "tabular-nums" }}>
                                {isInc ? "+" : "-"}{rupee(t.amount)}
                              </td>
                              <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                {can("records.delete") && (
                                  <button onClick={() => setDelTarget(t)} aria-label={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                                    <Icon name="Trash2" size={16} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── Mobile Phone View (Screen < 768px): 100% Unchanged ── */
          <>
            {/* Month navigator */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={prevMonth} aria-label={tc({ en: "Previous month", hi: "पिछला महीना", bn: "আগের মাস" })}
                style={{ background: T.surface2, border: "none", borderRadius: 10, padding: 8, cursor: "pointer", display: "flex", color: T.ink }}>
                <Icon name="ChevronLeft" size={20} />
              </button>
              <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700 }}>{tc(MONTHS_I18N[month])} {year}</div>
              <button onClick={nextMonth} disabled={atCurrentMonth} aria-label={tc({ en: "Next month", hi: "अगला महीना", bn: "পরের মাস" })}
                style={{ background: T.surface2, border: "none", borderRadius: 10, padding: 8,
                  cursor: atCurrentMonth ? "default" : "pointer", display: "flex",
                  color: atCurrentMonth ? T.inkFaint : T.ink }}>
                <Icon name="ChevronRight" size={20} />
              </button>
            </div>

            {/* P&L summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <SumTile label={t("net")} icon={netPos ? "TrendingUp" : "TrendingDown"}
                value={(netPos ? "+" : "-") + compact(Math.abs(summary.net))}
                bg={netPos ? T.primarySoft : T.redSoft} fg={netPos ? T.primary : T.red} />
              <SumTile label={t("income")} icon="ArrowDownCircle" value={compact(summary.income)} bg={T.primarySoft} fg={T.primary} />
              <SumTile label={t("expense")} icon="ArrowUpCircle"  value={compact(summary.expense)} bg={T.redSoft}     fg={T.red}     />
            </div>

            {/* Filter chips */}
            <div style={{ display: "flex", gap: 8 }}>
              {[["all", {en:"All",hi:"सभी",bn:"সব"}], ["income", {en:"Income",hi:"आय",bn:"আয়"}], ["expense", {en:"Expense",hi:"खर्च",bn:"ব্যয়"}]].map(([k, l]) => (
                <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{tc(l)}</Chip>
              ))}
            </div>

            {/* Spending by category */}
            {breakdown.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="PieChart" size={15} /> {tc({ en: "Spending by category", hi: "श्रेणी अनुसार खर्च", bn: "বিভাগ অনুযায়ী ব্যয়" })}
                </div>
                <Card pad={14} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {breakdown.slice(0, 6).map((b) => (
                    <div key={b.categoryId}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <Icon name={b.icon} size={14} style={{ color: T.inkSoft, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13, color: T.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{rupee(b.total)}</span>
                        <span style={{ fontSize: 11.5, color: T.inkFaint, width: 34, textAlign: "right" }}>{b.pct}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: T.surface2, overflow: "hidden" }}>
                        <div style={{ width: `${b.pct}%`, height: "100%", background: T.red, borderRadius: 3, transition: "width .4s var(--ag-ease)" }} />
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {/* Transaction list */}
            {txns.length === 0 ? (
              <div style={{ textAlign: "center", padding: "52px 0", color: T.inkSoft }}>
                <Icon name="Receipt" size={36} style={{ color: T.inkFaint, display: "block", margin: "0 auto 12px" }} />
                <div style={{ fontSize: 15, fontWeight: 600 }}>{tc({en:"No entries yet",hi:"अभी कोई प्रविष्टि नहीं",bn:"এখনও কোনো এন্ট্রি নেই"})}</div>
                <div style={{ fontSize: 13, color: T.inkFaint, marginTop: 4, maxWidth: 260, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>{tc({en:"Track every rupee — record your first income or expense to see your monthly balance.",hi:"हर रुपया ट्रैक करें — मासिक बैलेंस देखने के लिए अपनी पहली आय या खर्च दर्ज करें।",bn:"প্রতিটি টাকা ট্র্যাক করুন — মাসিক ব্যালেন্স দেখতে আপনার প্রথম আয় বা ব্যয় লিখুন।"})}</div>
                <button onClick={() => setAddOpen(true)}
                  style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 20px", borderRadius: T.pill,
                    background: T.primary, color: T.onPrimary, border: "none", cursor: "pointer", fontFamily: T.body, fontSize: 14, fontWeight: 600 }}>
                  <Icon name="Plus" size={16} /> {tc({en:"Add first entry",hi:"पहली प्रविष्टि जोड़ें",bn:"প্রথম এন্ট্রি যোগ করুন"})}
                </button>
              </div>
            ) : (
              <Card pad={0}>
                {txns.map((t, i) => {
                  const isInc   = t.kind === "income";
                  const catIcon = ledgerService.categoryIcon(t.kind, t.categoryId);
                  const catLabel = tc(ledgerService.categoryI18n(t.kind, t.categoryId));
                  const entLabel = t.enterpriseId ? ledgerService.enterpriseLabel(t.enterpriseId) : null;
                  return (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                      borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                      <IconTile name={catIcon} a={isInc ? "primary" : "red"} size={40} iconSize={18} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{catLabel}</div>
                        <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>
                          {entLabel && `${entLabel} · `}{fmtDate(t.date)}
                          {t.note && ` · ${t.note}`}
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: isInc ? T.primary : T.red, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                        {isInc ? "+" : "-"}{rupee(t.amount)}
                      </div>
                      {can("records.delete") && (
                      <button onClick={() => setDelTarget(t)} aria-label={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
                        style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 4, flexShrink: 0 }}>
                        <Icon name="Trash2" size={16} />
                      </button>
                      )}
                    </div>
                  );
                })}
              </Card>
            )}
          </>
        )}

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          {tc({en:"All data stored on this device only",hi:"सारा डेटा केवल इस डिवाइस पर संग्रहीत है",bn:"সমস্ত তথ্য শুধুমাত্র এই ডিভাইসে সংরক্ষিত"})}
        </div>
      </Screen>

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)}
        onSaved={(kind) => { refresh(); toast(kind === "income" ? tc({en:"Income recorded",hi:"आय दर्ज हुई",bn:"আয় লিপিবদ্ধ হয়েছে"}) : tc({en:"Expense recorded",hi:"खर्च दर्ज हुआ",bn:"ব্যয় লিপিবদ্ধ হয়েছে"}), "success"); }} />

      <Dialog open={!!delTarget} onClose={() => setDelTarget(null)}
        title={tc({en:"Delete entry?",hi:"प्रविष्टि हटाएं?",bn:"এন্ট্রি মুছবেন?"})}
        body={delTarget ? `${tc(ledgerService.categoryI18n(delTarget.kind, delTarget.categoryId))} · ${rupee(delTarget.amount)}` : ""}
        icon="Trash2" danger confirmLabel={tc({en:"Delete",hi:"हटाएं",bn:"মুছুন"})} cancelLabel={t("cancel")}
        onConfirm={async () => { await ledgerService.remove(delTarget.id); setDelTarget(null); refresh(); toast(tc({en:"Entry deleted",hi:"प्रविष्टि हटाई गई",bn:"এন্ট্রি মোছা হয়েছে"}), "info"); }} />
    </>
  );
}

function SumTile({ label, value, icon, bg, fg }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "13px 12px" }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: bg, color: fg, display: "grid", placeItems: "center", marginBottom: 8 }}>
        <Icon name={icon} size={16} strokeWidth={2.4} />
      </div>
      <div style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</div>
      <div style={{ fontFamily: T.display, fontSize: 15, fontWeight: 700, color: fg, marginTop: 1 }}>{value}</div>
    </div>
  );
}

function AddSheet({ open, onClose, onSaved }) {
  const { tc, lang } = useApp();
  const [form, setForm] = useState({ kind: "income", amount: "", categoryId: "", enterpriseId: "crop", date: todayStr(), note: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const cats = form.kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const catOpts = [{ value: "", label: tc({en:"Select category…",hi:"श्रेणी चुनें…",bn:"বিভাগ নির্বাচন করুন…"}) }, ...cats.map((c) => ({ value: c.id, label: c.i18n ? tc(c.i18n) : c.label }))];
  const entOpts = ENTERPRISES.map((e) => ({ value: e.id, label: e.i18n ? tc(e.i18n) : e.label }));

  const canSubmit = form.amount && parseFloat(form.amount) > 0 && form.categoryId;

  const submit = async () => {
    if (!canSubmit) return;
    const { kind } = form;
    await ledgerService.add({ ...form, amount: parseFloat(form.amount) });
    onSaved(kind);
    onClose();
    setForm({ kind: "income", amount: "", categoryId: "", enterpriseId: "crop", date: todayStr(), note: "" });
  };

  const switchKind = (k) => setForm((f) => ({ ...f, kind: k, categoryId: "" }));

  return (
    <BottomSheet open={open} onClose={onClose} title={tc({en:"Add entry",hi:"प्रविष्टि जोड़ें",bn:"এন্ট্রি যোগ করুন"})}
      footer={<Button full onClick={submit} disabled={!canSubmit}>{tc({en:"Save entry",hi:"प्रविष्टि सहेजें",bn:"এন্ট্রি সংরক্ষণ করুন"})}</Button>}>

      {/* Income / Expense toggle */}
      <div style={{ display: "flex", background: T.surface2, borderRadius: T.rLg, padding: 4, marginBottom: 16 }}>
        {[["income", {en:"Income",hi:"आय",bn:"আয়"}, "ArrowDownCircle"], ["expense", {en:"Expense",hi:"खर्च",bn:"ব্যয়"}, "ArrowUpCircle"]].map(([k, l, ico]) => (
          <button key={k} onClick={() => switchKind(k)}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "11px 0", borderRadius: T.rMd, border: "none", cursor: "pointer", fontFamily: T.body,
              fontSize: 14, fontWeight: 600, transition: "all .16s var(--ag-ease)",
              background: form.kind === k ? T.surface : "transparent",
              color: form.kind === k ? (k === "income" ? T.primary : T.red) : T.inkSoft,
              boxShadow: form.kind === k ? T.shadowSm : "none" }}>
            <Icon name={ico} size={16} /> {tc(l)}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label={tc({en:"Amount (₹)",hi:"राशि (₹)",bn:"পরিমাণ (₹)"})} value={form.amount} onChange={(v) => set("amount", v)}
          type="number" inputMode="decimal" placeholder="0.00" prefix="₹" />
        <Dropdown label={tc({en:"Category",hi:"श्रेणी",bn:"বিভাগ"})} value={form.categoryId} onChange={(v) => set("categoryId", v)} options={catOpts} />
        <Dropdown label={tc({en:"Enterprise",hi:"उद्यम",bn:"এন্টারপ্রাইজ"})} value={form.enterpriseId} onChange={(v) => set("enterpriseId", v)} options={entOpts} />
        <Input label={tc({en:"Date",hi:"तारीख",bn:"তারিখ"})} value={form.date} onChange={(v) => set("date", v)} type="date" />
        <Input label={tc({en:"Note (optional)",hi:"नोट (वैकल्पिक)",bn:"নোট (ঐচ্ছিক)"})} value={form.note} onChange={(v) => set("note", v)} placeholder={tc({en:"e.g. North field paddy sale",hi:"जैसे उत्तरी खेत धान बिक्री",bn:"যেমন উত্তর মাঠের ধান বিক্রি"})} mic lang={lang} />
      </div>
    </BottomSheet>
  );
}
