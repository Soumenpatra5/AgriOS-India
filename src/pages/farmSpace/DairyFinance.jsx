import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet, Dialog,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { dairyApi } from "../../services/dairy/dairyApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const today = () => new Date().toISOString().slice(0, 10);

const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return String(d).slice(0, 10); }
};

const fmtAmount = (n) =>
  n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/* Current {year, month} in local time. */
function currentYM() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/* First and last day of a month as YYYY-MM-DD strings. */
function monthRange(year, month) {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    fromDate: `${year}-${mm}-01`,
    toDate:   `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function prevYM({ year, month }) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}
function nextYM({ year, month }) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function isFuture({ year, month }) {
  const cur = currentYM();
  return year > cur.year || (year === cur.year && month > cur.month);
}

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/* ── Finance constants ─────────────────────────────────────────────────── */

const SALE_TYPE_OPTIONS = [
  { value: "morning",  label: { en: "Morning",  hi: "सुबह",   bn: "সকাল"   } },
  { value: "evening",  label: { en: "Evening",  hi: "शाम",    bn: "সন্ধ্যা" } },
  { value: "combined", label: { en: "Combined", hi: "संयुक्त", bn: "মিলিত"  } },
];

const SALE_TYPE_LABEL = Object.fromEntries(SALE_TYPE_OPTIONS.map((o) => [o.value, o.label]));

const COST_CATEGORY_OPTIONS = [
  { value: "concentrate_feed", label: { en: "Concentrate feed",  hi: "सांद्रित चारा",    bn: "ঘন খাদ্য"         } },
  { value: "roughage",         label: { en: "Roughage",          hi: "रेशेदार चारा",     bn: "রাফেজ"            } },
  { value: "medicine",         label: { en: "Medicine",          hi: "दवाई",              bn: "ওষুধ"             } },
  { value: "labour",           label: { en: "Labour",            hi: "श्रम",              bn: "শ্রম"             } },
  { value: "ai_cost",          label: { en: "AI / Bull cost",    hi: "कृत्रिम गर्भाधान",  bn: "কৃত্রিম গর্ভাধান" } },
  { value: "equipment",        label: { en: "Equipment",         hi: "उपकरण",             bn: "সরঞ্জাম"          } },
  { value: "veterinary",       label: { en: "Veterinary",        hi: "पशु चिकित्सा",      bn: "পশুচিকিৎসা"      } },
  { value: "other",            label: { en: "Other",             hi: "अन्य",              bn: "অন্যান্য"         } },
];

const COST_CATEGORY_LABEL = Object.fromEntries(COST_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

/* Category chip colours — light accent per category. */
const CATEGORY_COLOR = {
  concentrate_feed: { fg: "#5a6e1a", bg: "#eef4d2" },
  roughage:         { fg: "#4a7a2a", bg: "#e4f3d5" },
  medicine:         { fg: "#8b2828", bg: "#fde8e8" },
  labour:           { fg: "#1a5c8b", bg: "#ddeef8" },
  ai_cost:          { fg: "#6b2d8b", bg: "#f0e4f8" },
  equipment:        { fg: "#7a5a1a", bg: "#f8f0d8" },
  veterinary:       { fg: "#8b4a1a", bg: "#fbe8d8" },
  other:            { fg: "#4a4a4a", bg: "#f0f0f0" },
};

/* ── Sub-components ────────────────────────────────────────────────────── */

function SummaryCard({ summary, tc }) {
  const net = summary?.net_profit ?? 0;
  const netColor = net >= 0 ? T.primary : T.red;
  const netBg    = net >= 0 ? T.primarySoft : T.redSoft;

  return (
    <div style={{ margin: "12px 16px 0", borderRadius: T.rMd, overflow: "hidden",
      border: `1px solid ${T.line}` }}>
      <div style={{ background: T.surface2, padding: "10px 14px 8px",
        borderBottom: `1px solid ${T.line}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft,
          fontFamily: T.body, letterSpacing: 0.5, textTransform: "uppercase" }}>
          {tc({ en: "This month", hi: "इस माह", bn: "এ মাসে" })}
        </span>
      </div>
      <div style={{ display: "flex" }}>
        <SummaryTile
          label={tc({ en: "Revenue", hi: "राजस्व", bn: "রাজস্ব" })}
          value={fmtAmount(summary?.total_revenue)}
          icon="TrendingUp" color={T.blue} bg={T.blueSoft} />
        <div style={{ width: 1, background: T.line, flexShrink: 0 }} />
        <SummaryTile
          label={tc({ en: "Costs", hi: "लागत", bn: "খরচ" })}
          value={fmtAmount(summary?.total_costs)}
          icon="ShoppingCart" color={T.orange} bg="#fff3e8" />
        <div style={{ width: 1, background: T.line, flexShrink: 0 }} />
        <SummaryTile
          label={tc({ en: "Net P&L", hi: "शुद्ध लाभ/हानि", bn: "নিট লাভ/ক্ষতি" })}
          value={`${net >= 0 ? "+" : ""}${fmtAmount(net)}`}
          icon={net >= 0 ? "ArrowUpRight" : "ArrowDownRight"}
          color={netColor} bg={netBg} />
      </div>
      {summary?.total_milk_sold_kg > 0 && (
        <div style={{ padding: "7px 14px", borderTop: `1px solid ${T.line}`,
          background: T.surface2, fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>
          {tc({ en: "Milk sold", hi: "दूध बेचा", bn: "দুধ বিক্রি" })}{" "}
          <strong style={{ color: T.ink }}>
            {Number(summary.total_milk_sold_kg).toFixed(1)} kg
          </strong>
          {summary.month_milk_produced_kg > 0 && ` / ${Number(summary.month_milk_produced_kg).toFixed(1)} kg ${tc({ en: "produced", hi: "उत्पादित", bn: "উৎপাদিত" })}`}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, icon, color, bg }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, padding: "12px 10px", background: bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        <Icon name={icon} size={12} color={color} />
        <span style={{ fontSize: 10, color, fontWeight: 700, fontFamily: T.body,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: T.display,
        lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </div>
    </div>
  );
}

function CategoryChip({ category, tc }) {
  const cfg = CATEGORY_COLOR[category] || CATEGORY_COLOR.other;
  const label = COST_CATEGORY_LABEL[category];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: T.body,
      color: cfg.fg, background: cfg.bg, borderRadius: 5, padding: "2px 7px",
      whiteSpace: "nowrap" }}>
      {label ? tc(label) : category}
    </span>
  );
}

/* ── Main component ────────────────────────────────────────────────────── */

export default function DairyFinance({ spaceId }) {
  const { pop, tc, toast } = useApp();

  const [space,   setSpace]   = useState(null);
  const [summary, setSummary] = useState(null);
  const [sales,   setSales]   = useState([]);
  const [costs,   setCosts]   = useState([]);
  const [tab,     setTab]     = useState("sales");
  const [ym,      setYm]      = useState(currentYM);
  const [state,   setState]   = useState("loading");
  const [reason,  setReason]  = useState(null);

  /* Add sale sheet */
  const blankSform = () => ({
    saleDate: today(), saleType: "combined", quantityKg: "",
    pricePerLitre: "", buyer: "", fatPct: "", snfPct: "", notes: "",
    clientUuid: crypto.randomUUID(),
  });
  const [saleOpen, setSaleOpen] = useState(false);
  const [sform,    setSform]    = useState(blankSform);
  const [sbusy,    setSbusy]    = useState(false);

  /* Add cost sheet */
  const blankCform = () => ({
    costDate: today(), category: "concentrate_feed", description: "",
    amount: "", quantity: "", unit: "", unitCost: "", notes: "",
    clientUuid: crypto.randomUUID(),
  });
  const [costOpen, setCostOpen] = useState(false);
  const [cform,    setCform]    = useState(blankCform);
  const [cbusy,    setCbusy]    = useState(false);

  /* Delete confirms */
  const [delSaleId,   setDelSaleId]   = useState(null);
  const [delSaleBusy, setDelSaleBusy] = useState(false);
  const [delCostId,   setDelCostId]   = useState(null);
  const [delCostBusy, setDelCostBusy] = useState(false);

  const { fromDate, toDate } = monthRange(ym.year, ym.month);
  const canFinance = space && farmSpaceService.can(space, "farm.dairy.finance");

  const load = useCallback(async (targetSpaceId, range) => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);

      if (!farmSpaceService.can(active, "farm.dairy.finance")) {
        setState("ready");
        return;
      }

      const sid  = targetSpaceId || active.id;
      const rng  = range || monthRange(ym.year, ym.month);
      const [sum, sl, cl] = await Promise.all([
        dairyApi.financeSummary(sid, { fromDate: rng.fromDate, toDate: rng.toDate }),
        dairyApi.listSales(sid,   { fromDate: rng.fromDate, toDate: rng.toDate }),
        dairyApi.listCosts(sid,   { fromDate: rng.fromDate, toDate: rng.toDate }),
      ]);
      setSummary(sum);
      setSales(sl || []);
      setCosts(cl || []);
      setState("ready");
    } catch (err) {
      if (state !== "ready") { setReason(err?.reason || FARM_ERROR.FAILED); setState("error"); }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Initial load */
  useEffect(() => { load(spaceId, { fromDate, toDate }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Reload when month changes */
  const reloadForMonth = useCallback(async (newYm) => {
    if (!space) return;
    const rng = monthRange(newYm.year, newYm.month);
    setState("loading");
    try {
      const [sum, sl, cl] = await Promise.all([
        dairyApi.financeSummary(spaceId || space.id, { fromDate: rng.fromDate, toDate: rng.toDate }),
        dairyApi.listSales(spaceId || space.id,   { fromDate: rng.fromDate, toDate: rng.toDate }),
        dairyApi.listCosts(spaceId || space.id,   { fromDate: rng.fromDate, toDate: rng.toDate }),
      ]);
      setSummary(sum);
      setSales(sl || []);
      setCosts(cl || []);
      setState("ready");
    } catch {
      setState("ready");
    }
  }, [space, spaceId]);

  /* ── Handlers ─────────────────────────────────────────────────────────── */

  const openSaleSheet = () => { setSform(blankSform()); setSaleOpen(true); };
  const openCostSheet = () => { setCform(blankCform()); setCostOpen(true); };

  const refreshSummary = () => {
    const sid = spaceId || space?.id;
    if (!sid) return;
    dairyApi.financeSummary(sid, { fromDate, toDate })
      .then(setSummary).catch(() => {});
  };

  const saveSale = async () => {
    const qty = parseFloat(sform.quantityKg);
    if (!sform.saleDate || !qty || qty <= 0) return;
    setSbusy(true);
    try {
      const rec = await dairyApi.addSale(spaceId || space.id, {
        saleDate:      sform.saleDate,
        saleType:      sform.saleType,
        quantityKg:    qty,
        pricePerLitre: parseFloat(sform.pricePerLitre) || 0,
        buyer:         sform.buyer  || null,
        fatPct:        sform.fatPct ? parseFloat(sform.fatPct) : null,
        snfPct:        sform.snfPct ? parseFloat(sform.snfPct) : null,
        notes:         sform.notes  || null,
        clientUuid:    sform.clientUuid,
      });
      /* Only add to list if the sale falls within the displayed month. */
      if (rec.sale_date >= fromDate && rec.sale_date <= toDate) {
        setSales((prev) => [rec, ...prev].sort((a, b) => b.sale_date.localeCompare(a.sale_date)));
      }
      setSaleOpen(false);
      toast(tc({ en: "Sale recorded", hi: "बिक्री दर्ज हुई", bn: "বিক্রয় নথিভুক্ত হয়েছে" }), "success");
      refreshSummary();
    } catch (err) {
      toast(err.message || tc({ en: "Failed to save sale", hi: "बिक्री सहेजी नहीं जा सकी", bn: "বিক্রয় সংরক্ষণ ব্যর্থ" }), "error");
    } finally {
      setSbusy(false);
    }
  };

  const confirmDeleteSale = async () => {
    if (!delSaleId) return;
    setDelSaleBusy(true);
    try {
      await dairyApi.deleteSale(spaceId || space.id, delSaleId);
      setSales((prev) => prev.filter((s) => s.id !== delSaleId));
      setDelSaleId(null);
      toast(tc({ en: "Sale removed", hi: "बिक्री हटाई गई", bn: "বিক্রয় সরানো হয়েছে" }), "success");
      refreshSummary();
    } catch (err) {
      toast(err.message || tc({ en: "Failed to remove sale", hi: "बिक्री नहीं हटाई जा सकी", bn: "বিক্রয় সরাতে ব্যর্থ" }), "error");
    } finally {
      setDelSaleBusy(false);
    }
  };

  const saveCost = async () => {
    const amt = parseFloat(cform.amount);
    if (!cform.costDate || !cform.category || !cform.description.trim() || !amt || amt <= 0) return;
    setCbusy(true);
    try {
      const rec = await dairyApi.addCost(spaceId || space.id, {
        costDate:    cform.costDate,
        category:    cform.category,
        description: cform.description.trim(),
        amount:      amt,
        quantity:    cform.quantity  ? parseFloat(cform.quantity)  : null,
        unit:        cform.unit      || null,
        unitCost:    cform.unitCost  ? parseFloat(cform.unitCost)  : null,
        notes:       cform.notes     || null,
        clientUuid:  cform.clientUuid,
      });
      if (rec.cost_date >= fromDate && rec.cost_date <= toDate) {
        setCosts((prev) => [rec, ...prev].sort((a, b) => b.cost_date.localeCompare(a.cost_date)));
      }
      setCostOpen(false);
      toast(tc({ en: "Cost recorded", hi: "लागत दर्ज हुई", bn: "খরচ নথিভুক্ত হয়েছে" }), "success");
      refreshSummary();
    } catch (err) {
      toast(err.message || tc({ en: "Failed to save cost", hi: "लागत सहेजी नहीं जा सकी", bn: "খরচ সংরক্ষণ ব্যর্থ" }), "error");
    } finally {
      setCbusy(false);
    }
  };

  const confirmDeleteCost = async () => {
    if (!delCostId) return;
    setDelCostBusy(true);
    try {
      await dairyApi.deleteCost(spaceId || space.id, delCostId);
      setCosts((prev) => prev.filter((c) => c.id !== delCostId));
      setDelCostId(null);
      toast(tc({ en: "Cost removed", hi: "लागत हटाई गई", bn: "খরচ সরানো হয়েছে" }), "success");
      refreshSummary();
    } catch (err) {
      toast(err.message || tc({ en: "Failed to remove cost", hi: "लागत नहीं हटाई जा सकी", bn: "খরচ সরাতে ব্যর্থ" }), "error");
    } finally {
      setDelCostBusy(false);
    }
  };

  /* ── Month nav ─────────────────────────────────────────────────────────── */

  const goToPrev = () => {
    const newYm = prevYM(ym);
    setYm(newYm);
    reloadForMonth(newYm);
  };

  const goToNext = () => {
    if (isFuture(nextYM(ym))) return;
    const newYm = nextYM(ym);
    setYm(newYm);
    reloadForMonth(newYm);
  };

  const atCurrentMonth = !isFuture(nextYM(ym));

  /* ── AppBar ─────────────────────────────────────────────────────────────── */

  const monthLabel = `${MONTH_NAMES[ym.month]} ${ym.year}`;

  const bar = (
    <AppBar
      title={tc({ en: "Dairy Finance", hi: "डेयरी वित्त", bn: "ডেয়ারি অর্থ" })}
      onBack={pop}
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button onClick={goToPrev}
            style={{ background: "none", border: "none", cursor: "pointer",
              padding: "6px 8px", borderRadius: 8, color: T.ink }}>
            <Icon name="ChevronLeft" size={17} color={T.ink} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: T.body,
            color: T.ink, minWidth: 72, textAlign: "center" }}>
            {monthLabel}
          </span>
          <button onClick={goToNext} disabled={!atCurrentMonth}
            style={{ background: "none", border: "none",
              cursor: atCurrentMonth ? "pointer" : "default",
              padding: "6px 8px", borderRadius: 8,
              opacity: atCurrentMonth ? 1 : 0.3 }}>
            <Icon name="ChevronRight" size={17} color={T.ink} />
          </button>
        </div>
      }
    />
  );

  if (state === "loading") return <>{bar}<div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error")   return <>{bar}<div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={() => load(spaceId, { fromDate, toDate })} /></div></>;

  /* ── No finance permission ──────────────────────────────────────────────── */
  if (!canFinance) {
    return (
      <>
        {bar}
        <div style={{ padding: 20 }}>
          <EmptyState
            icon="Lock"
            title={tc({ en: "Finance access required", hi: "वित्त अनुमति आवश्यक", bn: "আর্থিক অ্যাক্সেস প্রয়োজন" })}
            body={tc({ en: "Ask your farm manager to grant finance access.", hi: "वित्त अनुमति के लिए अपने फ़ार्म मैनेजर से कहें।", bn: "অর্থ অ্যাক্সেসের জন্য আপনার ফার্ম ম্যানেজারকে জিজ্ঞাসা করুন।" })}
          />
        </div>
      </>
    );
  }

  /* ── Main render ─────────────────────────────────────────────────────────── */
  return (
    <>
      {bar}

      {/* P&L summary card */}
      <SummaryCard summary={summary} tc={tc} />

      {/* Tab chips */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 4px" }}>
        <Chip active={tab === "sales"} onClick={() => setTab("sales")}>
          {tc({ en: "Sales", hi: "बिक्री", bn: "বিক্রয়" })}
        </Chip>
        <Chip active={tab === "costs"} onClick={() => setTab("costs")}>
          {tc({ en: "Costs", hi: "लागत", bn: "খরচ" })}
        </Chip>
      </div>

      {/* ── Sales tab ─────────────────────────────────────────────────────── */}
      {tab === "sales" && (
        <div style={{ padding: "6px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={openSaleSheet}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              background: T.primary, border: "none", borderRadius: T.rMd, padding: "12px",
              cursor: "pointer", color: "#fff", fontFamily: T.body, fontSize: 14, fontWeight: 600 }}>
            <Icon name="Plus" size={15} color="#fff" />
            {tc({ en: "Log sale", hi: "बिक्री दर्ज करें", bn: "বিক্রয় লিখুন" })}
          </button>

          {sales.length === 0 ? (
            <EmptyState
              icon="ShoppingCart"
              title={tc({ en: "No sales yet", hi: "अभी कोई बिक्री नहीं", bn: "এখনো কোনো বিক্রয় নেই" })}
              body={tc({ en: "Log a milk sale to track revenue.", hi: "राजस्व ट्रैक करने के लिए दूध की बिक्री दर्ज करें।", bn: "রাজস্ব ট্র্যাক করতে একটি দুধ বিক্রয় লিখুন।" })}
            />
          ) : (
            sales.map((s) => <SaleRow key={s.id} sale={s} tc={tc} onDelete={() => setDelSaleId(s.id)} />)
          )}
        </div>
      )}

      {/* ── Costs tab ─────────────────────────────────────────────────────── */}
      {tab === "costs" && (
        <div style={{ padding: "6px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={openCostSheet}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              background: T.orange, border: "none", borderRadius: T.rMd, padding: "12px",
              cursor: "pointer", color: "#fff", fontFamily: T.body, fontSize: 14, fontWeight: 600 }}>
            <Icon name="Plus" size={15} color="#fff" />
            {tc({ en: "Log cost", hi: "लागत दर्ज करें", bn: "খরচ লিখুন" })}
          </button>

          {costs.length === 0 ? (
            <EmptyState
              icon="ReceiptText"
              title={tc({ en: "No costs yet", hi: "अभी कोई लागत नहीं", bn: "এখনো কোনো খরচ নেই" })}
              body={tc({ en: "Log feed, medicine, labour or other costs here.", hi: "यहाँ चारा, दवाई, श्रम या अन्य लागत दर्ज करें।", bn: "এখানে খাদ্য, ওষুধ, শ্রম বা অন্যান্য খরচ লিখুন।" })}
            />
          ) : (
            costs.map((c) => <CostRow key={c.id} cost={c} tc={tc} onDelete={() => setDelCostId(c.id)} />)
          )}
        </div>
      )}

      {/* ── Add sale sheet ─────────────────────────────────────────────────── */}
      <BottomSheet
        open={saleOpen}
        onClose={() => setSaleOpen(false)}
        title={tc({ en: "Log Milk Sale", hi: "दूध बिक्री दर्ज करें", bn: "দুধ বিক্রয় লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })}
            type="date"
            value={sform.saleDate}
            onChange={(v) => setSform((f) => ({ ...f, saleDate: v }))} />
          <Dropdown
            label={tc({ en: "Sale type", hi: "बिक्री प्रकार", bn: "বিক্রয় ধরন" })}
            value={sform.saleType}
            onChange={(v) => setSform((f) => ({ ...f, saleType: v }))}
            options={SALE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: tc(o.label) }))} />
          <Input
            label={tc({ en: "Quantity (kg)", hi: "मात्रा (किग्रा)", bn: "পরিমাণ (কেজি)" })}
            type="number"
            placeholder="0.0"
            value={sform.quantityKg}
            onChange={(v) => setSform((f) => ({ ...f, quantityKg: v }))} />
          <Input
            label={tc({ en: "Price per litre (₹)", hi: "प्रति लीटर मूल्य (₹)", bn: "প্রতি লিটার মূল্য (₹)" })}
            type="number"
            placeholder="0"
            value={sform.pricePerLitre}
            onChange={(v) => setSform((f) => ({ ...f, pricePerLitre: v }))} />
          <Input
            label={tc({ en: "Buyer (optional)", hi: "खरीदार (वैकल्पिक)", bn: "ক্রেতা (ঐচ্ছিক)" })}
            placeholder={tc({ en: "e.g. Village cooperative", hi: "उदा. ग्राम सहकारी", bn: "যেমন গ্রাম সমবায়" })}
            value={sform.buyer}
            onChange={(v) => setSform((f) => ({ ...f, buyer: v }))} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Input
                label={tc({ en: "Fat % (optional)", hi: "वसा % (वैकल्पिक)", bn: "ফ্যাট % (ঐচ্ছিক)" })}
                type="number"
                placeholder="3.5"
                value={sform.fatPct}
                onChange={(v) => setSform((f) => ({ ...f, fatPct: v }))} />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label={tc({ en: "SNF % (optional)", hi: "SNF % (वैकल्पिक)", bn: "SNF % (ঐচ্ছিক)" })}
                type="number"
                placeholder="8.5"
                value={sform.snfPct}
                onChange={(v) => setSform((f) => ({ ...f, snfPct: v }))} />
            </div>
          </div>
          <Input
            label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={sform.notes}
            onChange={(v) => setSform((f) => ({ ...f, notes: v }))} />
          <Button
            full
            onClick={saveSale}
            disabled={!sform.saleDate || !sform.quantityKg || parseFloat(sform.quantityKg) <= 0 || sbusy}>
            {sbusy
              ? tc({ en: "Saving…", hi: "सहेजा जा रहा है…", bn: "সংরক্ষণ হচ্ছে…" })
              : tc({ en: "Save sale", hi: "बिक्री सहेजें", bn: "বিক্রয় সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* ── Add cost sheet ─────────────────────────────────────────────────── */}
      <BottomSheet
        open={costOpen}
        onClose={() => setCostOpen(false)}
        title={tc({ en: "Log Cost", hi: "लागत दर्ज करें", bn: "খরচ লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })}
            type="date"
            value={cform.costDate}
            onChange={(v) => setCform((f) => ({ ...f, costDate: v }))} />
          <Dropdown
            label={tc({ en: "Category", hi: "श्रेणी", bn: "বিভাগ" })}
            value={cform.category}
            onChange={(v) => setCform((f) => ({ ...f, category: v }))}
            options={COST_CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: tc(o.label) }))} />
          <Input
            label={tc({ en: "Description", hi: "विवरण", bn: "বিবরণ" })}
            placeholder={tc({ en: "e.g. Bajra concentrate 50 kg", hi: "उदा. बाजरा सांद्र 50 किग्रा", bn: "যেমন বাজরা ঘন 50 কেজি" })}
            value={cform.description}
            onChange={(v) => setCform((f) => ({ ...f, description: v }))} />
          <Input
            label={tc({ en: "Amount (₹)", hi: "राशि (₹)", bn: "পরিমাণ (₹)" })}
            type="number"
            placeholder="0"
            value={cform.amount}
            onChange={(v) => setCform((f) => ({ ...f, amount: v }))} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Input
                label={tc({ en: "Qty (optional)", hi: "मात्रा (वैकल्पिक)", bn: "পরিমাণ (ঐচ্ছিক)" })}
                type="number"
                placeholder="50"
                value={cform.quantity}
                onChange={(v) => setCform((f) => ({ ...f, quantity: v }))} />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label={tc({ en: "Unit (optional)", hi: "इकाई (वैकल्पिक)", bn: "একক (ঐচ্ছিক)" })}
                placeholder="kg"
                value={cform.unit}
                onChange={(v) => setCform((f) => ({ ...f, unit: v }))} />
            </div>
          </div>
          <Input
            label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={cform.notes}
            onChange={(v) => setCform((f) => ({ ...f, notes: v }))} />
          <Button
            full
            onClick={saveCost}
            disabled={!cform.costDate || !cform.category || !cform.description.trim() || !cform.amount || parseFloat(cform.amount) <= 0 || cbusy}>
            {cbusy
              ? tc({ en: "Saving…", hi: "सहेजा जा रहा है…", bn: "সংরক্ষণ হচ্ছে…" })
              : tc({ en: "Save cost", hi: "लागत सहेजें", bn: "খরচ সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Remove sale confirm */}
      <Dialog
        open={!!delSaleId}
        title={tc({ en: "Remove sale?", hi: "बिक्री हटाएँ?", bn: "বিক্রয় সরাবেন?" })}
        body={tc({ en: "This sale record will be removed.", hi: "यह बिक्री रिकॉर्ड हटा दिया जाएगा।", bn: "এই বিক্রয় রেকর্ডটি সরানো হবে।" })}
        confirmLabel={delSaleBusy
          ? tc({ en: "Removing…", hi: "हटाया जा रहा है…", bn: "সরানো হচ্ছে…" })
          : tc({ en: "Remove", hi: "हटाएँ", bn: "সরান" })}
        danger
        onConfirm={confirmDeleteSale}
        onClose={() => setDelSaleId(null)}
      />

      {/* Remove cost confirm */}
      <Dialog
        open={!!delCostId}
        title={tc({ en: "Remove cost?", hi: "लागत हटाएँ?", bn: "খরচ সরাবেন?" })}
        body={tc({ en: "This cost record will be removed.", hi: "यह लागत रिकॉर्ड हटा दिया जाएगा।", bn: "এই খরচ রেকর্ডটি সরানো হবে।" })}
        confirmLabel={delCostBusy
          ? tc({ en: "Removing…", hi: "हटाया जा रहा है…", bn: "সরানো হচ্ছে…" })
          : tc({ en: "Remove", hi: "हटाएँ", bn: "সরান" })}
        danger
        onConfirm={confirmDeleteCost}
        onClose={() => setDelCostId(null)}
      />
    </>
  );
}

/* ── Sale row ──────────────────────────────────────────────────────────── */

function SaleRow({ sale, tc, onDelete }) {
  const amount = sale.amount != null
    ? fmtAmount(sale.amount)
    : sale.quantity_kg && sale.price_per_litre
      ? fmtAmount(sale.quantity_kg * sale.price_per_litre)
      : "—";
  const saleTypeLabel = SALE_TYPE_LABEL[sale.sale_type];

  return (
    <Card pad={0}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: T.blueSoft, display: "grid", placeItems: "center" }}>
          <Icon name="Droplets" size={17} color={T.blue} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: T.body }}>
              {amount}
            </span>
            {saleTypeLabel && (
              <span style={{ fontSize: 10.5, color: T.blue, fontWeight: 600,
                fontFamily: T.body, background: T.blueSoft, borderRadius: 4, padding: "1px 6px" }}>
                {tc(saleTypeLabel)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2, fontFamily: T.body }}>
            {fmtDate(sale.sale_date)}
            {sale.quantity_kg ? ` · ${Number(sale.quantity_kg).toFixed(1)} kg` : ""}
            {sale.price_per_litre ? ` · ₹${Number(sale.price_per_litre).toFixed(2)}/L` : ""}
            {sale.buyer ? ` · ${sale.buyer}` : ""}
          </div>
          {(sale.fat_pct != null || sale.snf_pct != null) && (
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 1, fontFamily: T.body }}>
              {sale.fat_pct != null ? `Fat ${sale.fat_pct}%` : ""}
              {sale.fat_pct != null && sale.snf_pct != null ? " · " : ""}
              {sale.snf_pct != null ? `SNF ${sale.snf_pct}%` : ""}
            </div>
          )}
        </div>
        <button onClick={onDelete}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6,
            borderRadius: 8, color: T.inkSoft, flexShrink: 0 }}>
          <Icon name="Trash2" size={15} color={T.inkSoft} />
        </button>
      </div>
    </Card>
  );
}

/* ── Cost row ──────────────────────────────────────────────────────────── */

function CostRow({ cost, tc, onDelete }) {
  return (
    <Card pad={0}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: "#fff3e8", display: "grid", placeItems: "center" }}>
          <Icon name="ReceiptText" size={17} color={T.orange} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: T.body }}>
              {fmtAmount(cost.amount)}
            </span>
            <CategoryChip category={cost.category} tc={tc} />
          </div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2, fontFamily: T.body,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {cost.description}
          </div>
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 1, fontFamily: T.body }}>
            {fmtDate(cost.cost_date)}
            {cost.quantity && cost.unit ? ` · ${cost.quantity} ${cost.unit}` : ""}
          </div>
        </div>
        <button onClick={onDelete}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6,
            borderRadius: 8, color: T.inkSoft, flexShrink: 0 }}>
          <Icon name="Trash2" size={15} color={T.inkSoft} />
        </button>
      </div>
    </Card>
  );
}
