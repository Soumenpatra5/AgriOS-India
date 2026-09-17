import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet, Dialog,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { goatApi } from "../../services/goat/goatApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const today = () => new Date().toISOString().slice(0, 10);

const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return String(d).slice(0, 10); }
};

const fmtAmount = (n) =>
  n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function currentYM() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

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

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ── Goat finance constants ───────────────────────────────────────────── */

const SALE_TYPE_OPTIONS = [
  { value: "milk",   label: { en: "Milk sale",    hi: "दूध बिक्री",    bn: "দুধ বিক্রয়"    } },
  { value: "animal", label: { en: "Animal sale",  hi: "पशु बिक्री",    bn: "পশু বিক্রয়"    } },
  { value: "fiber",  label: { en: "Fiber / wool", hi: "ऊन / रेशा",     bn: "ফাইবার / পশম"  } },
  { value: "other",  label: { en: "Other",        hi: "अन्य",          bn: "অন্যান্য"       } },
];

const SALE_TYPE_LABEL = Object.fromEntries(SALE_TYPE_OPTIONS.map((o) => [o.value, o.label]));

const COST_CATEGORY_OPTIONS = [
  { value: "concentrate_feed", label: { en: "Concentrate feed", hi: "सांद्र चारा",   bn: "ঘনীভূত খাদ্য"  } },
  { value: "fodder",           label: { en: "Fodder",           hi: "हरा चारा",      bn: "ঘাস / খড়"      } },
  { value: "medicine",         label: { en: "Medicine",         hi: "दवाई",          bn: "ওষুধ"           } },
  { value: "labour",           label: { en: "Labour",           hi: "श्रम",          bn: "শ্রম"           } },
  { value: "veterinary",       label: { en: "Veterinary",       hi: "पशु चिकित्सा",  bn: "পশুচিকিৎসা"    } },
  { value: "equipment",        label: { en: "Equipment",        hi: "उपकरण",         bn: "সরঞ্জাম"        } },
  { value: "fiber_shearing",   label: { en: "Fiber shearing",   hi: "ऊन कटाई",       bn: "পশম ছাঁটাই"    } },
  { value: "other",            label: { en: "Other",            hi: "अन्य",          bn: "অন্যান্য"       } },
];

const COST_CATEGORY_LABEL = Object.fromEntries(COST_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

const SALE_TYPE_COLOR = {
  milk:   { fg: "#1a5c8b", bg: "#ddeef8" },
  animal: { fg: "#5a6e1a", bg: "#eef4d2" },
  fiber:  { fg: "#6b3a8b", bg: "#ede0f8" },
  other:  { fg: "#4a4a4a", bg: "#f0f0f0" },
};

const COST_CATEGORY_COLOR = {
  concentrate_feed: { fg: "#5a6e1a", bg: "#eef4d2" },
  fodder:           { fg: "#7c5a1e", bg: "#f5ead8" },
  medicine:         { fg: "#8b2828", bg: "#fde8e8" },
  labour:           { fg: "#1a5c8b", bg: "#ddeef8" },
  veterinary:       { fg: "#8b4a1a", bg: "#fbe8d8" },
  equipment:        { fg: "#7a5a1a", bg: "#f8f0d8" },
  fiber_shearing:   { fg: "#6b3a8b", bg: "#ede0f8" },
  other:            { fg: "#4a4a4a", bg: "#f0f0f0" },
};

/* ── Sub-components ──────────────────────────────────────────────────── */

function SummaryCard({ summary, tc }) {
  const net = summary?.net_profit ?? 0;
  const netColor = net >= 0 ? T.primary : T.red;
  const netBg    = net >= 0 ? T.primarySoft : T.redSoft;

  return (
    <div style={{ margin: "12px 16px 0", borderRadius: T.rMd, overflow: "hidden", border: `1px solid ${T.line}` }}>
      <div style={{ background: T.surface2, padding: "10px 14px 8px", borderBottom: `1px solid ${T.line}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft,
          fontFamily: T.body, letterSpacing: 0.5, textTransform: "uppercase" }}>
          {tc({ en: "This period", hi: "इस अवधि में", bn: "এই সময়কালে" })}
        </span>
      </div>
      <div style={{ display: "flex" }}>
        <SummaryTile label={tc({ en: "Revenue", hi: "राजस्व", bn: "রাজস্ব" })}
          value={fmtAmount(summary?.total_revenue)} icon="TrendingUp" color={T.blue} bg={T.blueSoft} />
        <div style={{ width: 1, background: T.line, flexShrink: 0 }} />
        <SummaryTile label={tc({ en: "Costs", hi: "लागत", bn: "খরচ" })}
          value={fmtAmount(summary?.total_costs)} icon="ShoppingCart" color={T.orange} bg="#fff3e8" />
        <div style={{ width: 1, background: T.line, flexShrink: 0 }} />
        <SummaryTile label={tc({ en: "Net P&L", hi: "शुद्ध लाभ/हानि", bn: "নিট লাভ/ক্ষতি" })}
          value={`${net >= 0 ? "+" : ""}${fmtAmount(net)}`}
          icon={net >= 0 ? "ArrowUpRight" : "ArrowDownRight"} color={netColor} bg={netBg} />
      </div>
      {summary?.month_milk_produced_kg != null && (
        <div style={{ borderTop: `1px solid ${T.line}`, padding: "8px 14px",
          background: T.surface, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="Droplets" size={13} color={T.blue} />
          <span style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>
            {tc({ en: "Milk produced", hi: "दूध उत्पादन", bn: "দুধ উৎপাদন" })}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.blue, fontFamily: T.display, marginLeft: "auto" }}>
            {Number(summary.month_milk_produced_kg).toFixed(1)} kg
          </span>
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

function SaleTypeChip({ saleType, tc }) {
  const cfg = SALE_TYPE_COLOR[saleType] || SALE_TYPE_COLOR.other;
  const label = SALE_TYPE_LABEL[saleType];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: T.body,
      color: cfg.fg, background: cfg.bg, borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap" }}>
      {label ? tc(label) : saleType}
    </span>
  );
}

function CategoryChip({ category, tc }) {
  const cfg = COST_CATEGORY_COLOR[category] || COST_CATEGORY_COLOR.other;
  const label = COST_CATEGORY_LABEL[category];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: T.body,
      color: cfg.fg, background: cfg.bg, borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap" }}>
      {label ? tc(label) : category}
    </span>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */

export default function GoatFinance() {
  const { pop, tc, toast } = useApp();

  const [space,   setSpace]   = useState(null);
  const [summary, setSummary] = useState(null);
  const [sales,   setSales]   = useState([]);
  const [costs,   setCosts]   = useState([]);
  const [tab,     setTab]     = useState("sales");
  const [ym,      setYm]      = useState(currentYM);
  const [state,   setState]   = useState("loading");
  const [reason,  setReason]  = useState(null);

  /* Add sale */
  const blankSform = () => ({
    saleDate: today(), saleType: "milk", buyer: "", quantity: "",
    unit: "", unitPrice: "", amount: "", notes: "", clientUuid: crypto.randomUUID(),
  });
  const [saleOpen, setSaleOpen] = useState(false);
  const [sform,    setSform]    = useState(blankSform);
  const [sbusy,    setSbusy]    = useState(false);

  /* Add cost */
  const blankCform = () => ({
    costDate: today(), category: "concentrate_feed", description: "", quantity: "",
    unit: "", unitCost: "", amount: "", notes: "", clientUuid: crypto.randomUUID(),
  });
  const [costOpen, setCostOpen] = useState(false);
  const [cform,    setCform]    = useState(blankCform);
  const [cbusy,    setCbusy]    = useState(false);

  /* Delete dialogs */
  const [deleteSaleId,   setDeleteSaleId]   = useState(null);
  const [deleteSaleBusy, setDeleteSaleBusy] = useState(false);
  const [deleteCostId,   setDeleteCostId]   = useState(null);
  const [deleteCostBusy, setDeleteCostBusy] = useState(false);

  const load = useCallback(async (ymOverride) => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const { fromDate, toDate } = monthRange((ymOverride || ym).year, (ymOverride || ym).month);
      const [summ, saleList, costList] = await Promise.all([
        goatApi.financeSummary(active.id, { fromDate, toDate }),
        goatApi.listSales(active.id, { fromDate, toDate }),
        goatApi.listCosts(active.id, { fromDate, toDate }),
      ]);
      setSummary(summ);
      setSales(saleList || []);
      setCosts(costList || []);
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, [ym]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const navigate = (newYm) => {
    setYm(newYm);
    setState("loading");
    load(newYm);
  };

  const canFinance = space && farmSpaceService.can(space, "farm.goat.finance");

  const addSale = async () => {
    if (!sform.amount || parseFloat(sform.amount) <= 0) return;
    setSbusy(true);
    try {
      const rec = await goatApi.addSale(space.id, {
        saleDate: sform.saleDate, saleType: sform.saleType,
        buyer: sform.buyer || null,
        quantity: sform.quantity ? parseFloat(sform.quantity) : null,
        unit: sform.unit || null,
        unitPrice: sform.unitPrice ? parseFloat(sform.unitPrice) : null,
        amount: parseFloat(sform.amount),
        notes: sform.notes || null, clientUuid: sform.clientUuid,
      });
      setSales((prev) => [rec, ...prev]);
      setSaleOpen(false);
      setSform(blankSform());
      toast(tc({ en: "Sale recorded", hi: "बिक्री दर्ज हुई", bn: "বিক্রয় নথিভুক্ত হয়েছে" }), "success");
      load();
    } catch (err) {
      toast(err.message || tc({ en: "Failed to save sale", hi: "बिक्री सहेजने में विफल", bn: "বিক্রয় সংরক্ষণ ব্যর্থ" }), "error");
    } finally { setSbusy(false); }
  };

  const deleteSale = async () => {
    if (!deleteSaleId) return;
    setDeleteSaleBusy(true);
    try {
      await goatApi.deleteSale(space.id, { saleId: deleteSaleId });
      setSales((prev) => prev.filter((s) => s.id !== deleteSaleId));
      setDeleteSaleId(null);
      load();
    } catch (err) {
      toast(err.message || tc({ en: "Delete failed", hi: "हटाना विफल", bn: "মুছে ফেলা ব্যর্থ" }), "error");
    } finally { setDeleteSaleBusy(false); }
  };

  const addCost = async () => {
    if (!cform.amount || parseFloat(cform.amount) <= 0 || !cform.description.trim()) return;
    setCbusy(true);
    try {
      const rec = await goatApi.addCost(space.id, {
        costDate: cform.costDate, category: cform.category,
        description: cform.description.trim(),
        quantity: cform.quantity ? parseFloat(cform.quantity) : null,
        unit: cform.unit || null,
        unitCost: cform.unitCost ? parseFloat(cform.unitCost) : null,
        amount: parseFloat(cform.amount),
        notes: cform.notes || null, clientUuid: cform.clientUuid,
      });
      setCosts((prev) => [rec, ...prev]);
      setCostOpen(false);
      setCform(blankCform());
      toast(tc({ en: "Cost recorded", hi: "लागत दर्ज हुई", bn: "খরচ নথিভুক্ত হয়েছে" }), "success");
      load();
    } catch (err) {
      toast(err.message || tc({ en: "Failed to save cost", hi: "लागत सहेजने में विफल", bn: "খরচ সংরক্ষণ ব্যর্থ" }), "error");
    } finally { setCbusy(false); }
  };

  const deleteCost = async () => {
    if (!deleteCostId) return;
    setDeleteCostBusy(true);
    try {
      await goatApi.deleteCost(space.id, { costId: deleteCostId });
      setCosts((prev) => prev.filter((c) => c.id !== deleteCostId));
      setDeleteCostId(null);
      load();
    } catch (err) {
      toast(err.message || tc({ en: "Delete failed", hi: "हटाना विफल", bn: "মুছে ফেলা ব্যর্থ" }), "error");
    } finally { setDeleteCostBusy(false); }
  };

  /* Share report */
  const share = async () => {
    if (!summary) return;
    const { fromDate, toDate } = monthRange(ym.year, ym.month);
    const milkLine = summary.month_milk_produced_kg != null
      ? `\nMilk produced: ${Number(summary.month_milk_produced_kg).toFixed(1)} kg`
      : "";
    const text = [
      `🐐 Goat Finance Report — ${MONTH_NAMES[ym.month]} ${ym.year}`,
      `Period: ${fromDate} to ${toDate}`,
      `Revenue: ${fmtAmount(summary.total_revenue)}`,
      `Costs:   ${fmtAmount(summary.total_costs)}`,
      `Net P&L: ${fmtAmount(summary.net_profit)}${milkLine}`,
    ].join("\n");
    try {
      if (navigator.share) { await navigator.share({ text }); }
      else { await navigator.clipboard.writeText(text); toast(tc({ en: "Copied to clipboard", hi: "क्लिपबोर्ड पर कॉपी", bn: "ক্লিপবোর্ডে কপি" }), "success"); }
    } catch { /* user cancelled */ }
  };

  const bar = (
    <AppBar
      title={tc({ en: "Goat & Sheep Finance", hi: "बकरी/भेड़ वित्त", bn: "ছাগল ও ভেড়া অর্থ" })}
      onBack={pop}
      action={(
        <button onClick={share}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 8px" }}>
          <Icon name="Share2" size={18} color={T.inkSoft} />
        </button>
      )}
    />
  );

  if (state === "loading") return <>{bar}<div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error")   return <>{bar}<div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;

  return (
    <>
      {bar}

      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px 0", fontFamily: T.body }}>
        <button onClick={() => navigate(prevYM(ym))}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
          <Icon name="ChevronLeft" size={20} color={T.inkSoft} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>
          {MONTH_NAMES[ym.month]} {ym.year}
        </span>
        <button onClick={() => { if (!isFuture(nextYM(ym))) navigate(nextYM(ym)); }}
          style={{ background: "none", border: "none",
            cursor: isFuture(nextYM(ym)) ? "default" : "pointer", padding: 6,
            opacity: isFuture(nextYM(ym)) ? 0.3 : 1 }}>
          <Icon name="ChevronRight" size={20} color={T.inkSoft} />
        </button>
      </div>

      {/* Summary card */}
      <SummaryCard summary={summary} tc={tc} />

      {/* Tabs: Sales | Costs */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px" }}>
        <Chip active={tab === "sales"} onClick={() => setTab("sales")}>{tc({ en: "Sales", hi: "बिक्री", bn: "বিক্রয়" })}</Chip>
        <Chip active={tab === "costs"} onClick={() => setTab("costs")}>{tc({ en: "Costs", hi: "लागत",  bn: "খরচ"   })}</Chip>
      </div>

      {/* Sales tab */}
      {tab === "sales" && (
        <div style={{ padding: "6px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
          {canFinance && (
            <Button full onClick={() => { setSform(blankSform()); setSaleOpen(true); }}>
              {tc({ en: "+ Log Sale", hi: "+ बिक्री दर्ज करें", bn: "+ বিক্রয় লিখুন" })}
            </Button>
          )}
          {sales.length === 0 ? (
            <EmptyState icon="TrendingUp"
              title={tc({ en: "No sales this month", hi: "इस माह कोई बिक्री नहीं", bn: "এ মাসে কোনো বিক্রয় নেই" })}
              body={tc({ en: "Log milk, animal or fiber sales to track revenue.", hi: "राजस्व ट्रैक करने के लिए दूध, पशु या ऊन की बिक्री दर्ज करें।", bn: "রাজস্ব ট্র্যাক করতে দুধ, পশু বা পশম বিক্রয় লিখুন।" })} />
          ) : (
            sales.map((s) => (
              <Card key={s.id} pad={0}>
                <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: T.primary, fontFamily: T.display }}>
                        {fmtAmount(s.amount)}
                      </span>
                      <SaleTypeChip saleType={s.sale_type} tc={tc} />
                    </div>
                    <div style={{ fontSize: 11.5, color: T.inkSoft, fontFamily: T.body }}>
                      {fmtDate(s.sale_date)}
                      {s.buyer ? ` · ${s.buyer}` : ""}
                      {s.quantity && s.unit ? ` · ${s.quantity} ${s.unit}` : ""}
                    </div>
                    {s.notes && <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: T.body, marginTop: 2 }}>{s.notes}</div>}
                  </div>
                  {canFinance && (
                    <button onClick={() => setDeleteSaleId(s.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                      <Icon name="Trash2" size={15} color={T.inkFaint} />
                    </button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Costs tab */}
      {tab === "costs" && (
        <div style={{ padding: "6px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
          {canFinance && (
            <Button full onClick={() => { setCform(blankCform()); setCostOpen(true); }}>
              {tc({ en: "+ Log Cost", hi: "+ लागत दर्ज करें", bn: "+ খরচ লিখুন" })}
            </Button>
          )}
          {costs.length === 0 ? (
            <EmptyState icon="ShoppingCart"
              title={tc({ en: "No costs this month", hi: "इस माह कोई लागत नहीं", bn: "এ মাসে কোনো খরচ নেই" })}
              body={tc({ en: "Log feed, medicine and other expenses.", hi: "चारा, दवाई और अन्य खर्च दर्ज करें।", bn: "খাদ্য, ওষুধ এবং অন্যান্য খরচ লিখুন।" })} />
          ) : (
            costs.map((c) => (
              <Card key={c.id} pad={0}>
                <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: T.red, fontFamily: T.display }}>
                        {fmtAmount(c.amount)}
                      </span>
                      <CategoryChip category={c.category} tc={tc} />
                    </div>
                    <div style={{ fontSize: 13, color: T.ink, fontFamily: T.body, fontWeight: 500 }}>{c.description}</div>
                    <div style={{ fontSize: 11.5, color: T.inkSoft, fontFamily: T.body }}>
                      {fmtDate(c.cost_date)}
                      {c.quantity && c.unit ? ` · ${c.quantity} ${c.unit}` : ""}
                    </div>
                    {c.notes && <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: T.body, marginTop: 2 }}>{c.notes}</div>}
                  </div>
                  {canFinance && (
                    <button onClick={() => setDeleteCostId(c.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                      <Icon name="Trash2" size={15} color={T.inkFaint} />
                    </button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Delete dialogs */}
      <Dialog
        open={!!deleteSaleId}
        title={tc({ en: "Delete sale?", hi: "बिक्री हटाएँ?", bn: "বিক্রয় মুছবেন?" })}
        body={tc({ en: "This cannot be undone.", hi: "यह पूर्ववत नहीं होगा।", bn: "এটি পূর্বাবস্থায় ফেরানো যাবে না।" })}
        actions={[
          { label: tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" }), onClick: () => setDeleteSaleId(null) },
          { label: deleteSaleBusy ? "…" : tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" }), danger: true, onClick: deleteSale, disabled: deleteSaleBusy },
        ]} />

      <Dialog
        open={!!deleteCostId}
        title={tc({ en: "Delete cost?", hi: "लागत हटाएँ?", bn: "খরচ মুছবেন?" })}
        body={tc({ en: "This cannot be undone.", hi: "यह पूर्ववत नहीं होगा।", bn: "এটি পূর্বাবস্থায় ফেরানো যাবে না।" })}
        actions={[
          { label: tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" }), onClick: () => setDeleteCostId(null) },
          { label: deleteCostBusy ? "…" : tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" }), danger: true, onClick: deleteCost, disabled: deleteCostBusy },
        ]} />

      {/* Add sale sheet */}
      <BottomSheet open={saleOpen} onClose={() => setSaleOpen(false)}
        title={tc({ en: "Log Sale", hi: "बिक्री दर्ज करें", bn: "বিক্রয় লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date"
            value={sform.saleDate} onChange={(v) => setSform((f) => ({ ...f, saleDate: v }))} />
          <Dropdown label={tc({ en: "Sale type", hi: "बिक्री प्रकार", bn: "বিক্রয়ের ধরন" })}
            value={sform.saleType} onChange={(v) => setSform((f) => ({ ...f, saleType: v }))}
            options={SALE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: tc(o.label) }))} />
          <Input label={tc({ en: "Buyer (optional)", hi: "खरीदार (वैकल्पिक)", bn: "ক্রেতা (ঐচ্ছিক)" })}
            placeholder={tc({ en: "e.g. Local market", hi: "उदा. स्थानीय बाज़ार", bn: "যেমন স্থানীয় বাজার" })}
            value={sform.buyer} onChange={(v) => setSform((f) => ({ ...f, buyer: v }))} />
          <Input label={tc({ en: "Quantity (optional)", hi: "मात्रा (वैकल्पिक)", bn: "পরিমাণ (ঐচ্ছিক)" })}
            type="number" placeholder="e.g. 3"
            value={sform.quantity} onChange={(v) => setSform((f) => ({ ...f, quantity: v }))} />
          <Input label={tc({ en: "Unit (optional)", hi: "इकाई (वैकल्पिक)", bn: "একক (ঐচ্ছিক)" })}
            placeholder={tc({ en: "e.g. animals / litres / kg", hi: "उदा. पशु / लीटर / किलो", bn: "যেমন পশু / লিটার / কেজি" })}
            value={sform.unit} onChange={(v) => setSform((f) => ({ ...f, unit: v }))} />
          <Input label={tc({ en: "Amount (₹)", hi: "राशि (₹)", bn: "পরিমাণ (₹)" })} type="number"
            placeholder="e.g. 5500"
            value={sform.amount} onChange={(v) => setSform((f) => ({ ...f, amount: v }))} />
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={sform.notes} onChange={(v) => setSform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addSale} disabled={sbusy || !sform.amount}>
            {sbusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save Sale", hi: "बिक्री सहेजें", bn: "বিক্রয় সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Add cost sheet */}
      <BottomSheet open={costOpen} onClose={() => setCostOpen(false)}
        title={tc({ en: "Log Cost", hi: "लागत दर्ज करें", bn: "খরচ লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date"
            value={cform.costDate} onChange={(v) => setCform((f) => ({ ...f, costDate: v }))} />
          <Dropdown label={tc({ en: "Category", hi: "श्रेणी", bn: "বিভাগ" })}
            value={cform.category} onChange={(v) => setCform((f) => ({ ...f, category: v }))}
            options={COST_CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: tc(o.label) }))} />
          <Input label={tc({ en: "Description", hi: "विवरण", bn: "বিবরণ" })}
            placeholder={tc({ en: "e.g. Groundnut cake — 25 kg bag", hi: "उदा. मूंगफली खली — 25 किलो बैग", bn: "যেমন চিনাবাদাম খৈল — ২৫ কেজি ব্যাগ" })}
            value={cform.description} onChange={(v) => setCform((f) => ({ ...f, description: v }))} />
          <Input label={tc({ en: "Amount (₹)", hi: "राशि (₹)", bn: "পরিমাণ (₹)" })} type="number"
            placeholder="e.g. 900"
            value={cform.amount} onChange={(v) => setCform((f) => ({ ...f, amount: v }))} />
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={cform.notes} onChange={(v) => setCform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addCost} disabled={cbusy || !cform.amount || !cform.description.trim()}>
            {cbusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save Cost", hi: "लागत सहेजें", bn: "খরচ সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
