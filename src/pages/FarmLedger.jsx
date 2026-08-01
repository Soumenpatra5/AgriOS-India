import { useState, useMemo, useEffect } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import {
  AppBar, Screen, Card, Chip, IconTile, Button, Dialog, Dropdown, Input, BottomSheet,
} from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import {
  ledgerService, INCOME_CATEGORIES, EXPENSE_CATEGORIES, ENTERPRISES,
} from "../services/ledger/ledgerService.js";
import { compact, rupee } from "../utils/format.js";

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
  const { pop, toast, tc, t, lang } = useApp();
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

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await ledgerService.monthSummary(year, month + 1);
      const all = await ledgerService.forMonth(year, month + 1);
      if (!alive) return;
      setSummary(s);
      setTxns(filter === "all" ? all : all.filter((t) => t.kind === filter));
    })();
    return () => { alive = false; };
  }, [year, month, filter, tick]);

  const netPos = summary.net >= 0;

  return (
    <>
      <AppBar title={tc({en:"Farm ledger",hi:"खेत का हिसाब",bn:"খামারের হিসাব"})} onBack={pop} action={
        <button onClick={() => setAddOpen(true)}
          style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="PlusCircle" size={17} /> {tc({en:"Add",hi:"जोड़ें",bn:"যোগ করুন"})}
        </button>
      } />

      <Screen gap={16}>
        {/* Month navigator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={prevMonth}
            style={{ background: T.surface2, border: "none", borderRadius: 10, padding: 8, cursor: "pointer", display: "flex", color: T.ink }}>
            <Icon name="ChevronLeft" size={20} />
          </button>
          <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700 }}>{tc(MONTHS_I18N[month])} {year}</div>
          <button onClick={nextMonth} disabled={atCurrentMonth}
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

        {/* Transaction list */}
        {txns.length === 0 ? (
          <div style={{ textAlign: "center", padding: "52px 0", color: T.inkSoft }}>
            <Icon name="Receipt" size={36} style={{ color: T.inkFaint, display: "block", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>{tc({en:"No entries yet",hi:"अभी कोई प्रविष्टि नहीं",bn:"এখনও কোনো এন্ট্রি নেই"})}</div>
            <div style={{ fontSize: 13, color: T.inkFaint, marginTop: 4 }}>{tc({en:"Tap + Add to record income or expenses",hi:"आय या खर्च दर्ज करने के लिए + जोड़ें दबाएं",bn:"আয় বা ব্যয় লিখতে + যোগ করুন টিপুন"})}</div>
          </div>
        ) : (
          <Card pad={0}>
            {txns.map((t, i) => {
              const isInc   = t.kind === "income";
              const catIcon = ledgerService.categoryIcon(t.kind, t.categoryId);
              const catLabel = ledgerService.categoryLabel(t.kind, t.categoryId);
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
                  <button onClick={() => setDelTarget(t)} aria-label="Delete"
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 4, flexShrink: 0 }}>
                    <Icon name="Trash2" size={16} />
                  </button>
                </div>
              );
            })}
          </Card>
        )}

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          {tc({en:"All data stored on this device only",hi:"सारा डेटा केवल इस डिवाइस पर संग्रहीत है",bn:"সমস্ত তথ্য শুধুমাত্র এই ডিভাইসে সংরক্ষিত"})}
        </div>
      </Screen>

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)}
        onSaved={(kind) => { refresh(); toast(kind === "income" ? tc({en:"Income recorded",hi:"आय दर्ज हुई",bn:"আয় লিপিবদ্ধ হয়েছে"}) : tc({en:"Expense recorded",hi:"खर्च दर्ज हुआ",bn:"ব্যয় লিপিবদ্ধ হয়েছে"}), "success"); }} />

      <Dialog open={!!delTarget} onClose={() => setDelTarget(null)}
        title={tc({en:"Delete entry?",hi:"प्रविष्टि हटाएं?",bn:"এন্ট্রি মুছবেন?"})}
        body={delTarget ? `${ledgerService.categoryLabel(delTarget.kind, delTarget.categoryId)} · ${rupee(delTarget.amount)}` : ""}
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
  const { tc } = useApp();
  const [form, setForm] = useState({ kind: "income", amount: "", categoryId: "", enterpriseId: "crop", date: todayStr(), note: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const cats = form.kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const catOpts = [{ value: "", label: tc({en:"Select category…",hi:"श्रेणी चुनें…",bn:"বিভাগ নির্বাচন করুন…"}) }, ...cats.map((c) => ({ value: c.id, label: c.label }))];
  const entOpts = ENTERPRISES.map((e) => ({ value: e.id, label: e.label }));

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
