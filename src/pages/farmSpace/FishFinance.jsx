import { useState, useEffect, useCallback, useRef } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet, Dialog,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { fishApi } from "../../services/fish/fishApi.js";
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
  return { fromDate: `${year}-${mm}-01`, toDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

function prevYM({ year, month }) { return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }; }
function nextYM({ year, month }) { return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }; }
function isFuture({ year, month }) {
  const cur = currentYM();
  return year > cur.year || (year === cur.year && month > cur.month);
}

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ── Fish finance constants ───────────────────────────────────────────── */

const SALE_TYPE_OPTIONS = [
  { value: "fresh_fish",  label: { en: "Fresh fish",   hi: "ताजी मछली",     bn: "তাজা মাছ"        } },
  { value: "dried_fish",  label: { en: "Dried fish",   hi: "सूखी मछली",     bn: "শুকনো মাছ"       } },
  { value: "fingerlings", label: { en: "Fingerlings",  hi: "अंगुलिका",      bn: "পোনা মাছ"        } },
  { value: "prawn",       label: { en: "Prawn / shrimp", hi: "झींगा",       bn: "চিংড়ি"           } },
  { value: "other",       label: { en: "Other",        hi: "अन्य",          bn: "অন্যান্য"         } },
];

const SALE_TYPE_LABEL = Object.fromEntries(SALE_TYPE_OPTIONS.map((o) => [o.value, o.label]));

const COST_CATEGORY_OPTIONS = [
  { value: "fingerlings",  label: { en: "Fingerlings (stocking)", hi: "अंगुलिका (भंडारण)", bn: "পোনা মাছ (মজুত)"   } },
  { value: "feed",         label: { en: "Feed",                   hi: "चारा",              bn: "খাবার"             } },
  { value: "chemicals",    label: { en: "Chemicals / lime",       hi: "रसायन / चूना",       bn: "রাসায়নিক / চুন"  } },
  { value: "equipment",    label: { en: "Equipment",              hi: "उपकरण",              bn: "সরঞ্জাম"           } },
  { value: "labour",       label: { en: "Labour",                 hi: "श्रम",               bn: "শ্রম"              } },
  { value: "electricity",  label: { en: "Electricity",            hi: "बिजली",              bn: "বিদ্যুৎ"           } },
  { value: "pond_prep",    label: { en: "Pond preparation",       hi: "तालाब तैयारी",       bn: "পুকুর প্রস্তুতি"  } },
  { value: "other",        label: { en: "Other",                  hi: "अन्य",               bn: "অন্যান্য"          } },
];

const COST_CATEGORY_LABEL = Object.fromEntries(COST_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

const SALE_TYPE_COLOR = {
  fresh_fish:  { fg: "#1a5c8b", bg: "#ddeef8" },
  dried_fish:  { fg: "#7a5a1a", bg: "#f8f0d8" },
  fingerlings: { fg: "#5a6e1a", bg: "#eef4d2" },
  prawn:       { fg: "#6b3a8b", bg: "#ede0f8" },
  other:       { fg: "#4a4a4a", bg: "#f0f0f0" },
};

const COST_CATEGORY_COLOR = {
  fingerlings:  { fg: "#5a6e1a", bg: "#eef4d2" },
  feed:         { fg: "#7c5a1e", bg: "#f5ead8" },
  chemicals:    { fg: "#8b2828", bg: "#fde8e8" },
  equipment:    { fg: "#7a5a1a", bg: "#f8f0d8" },
  labour:       { fg: "#1a5c8b", bg: "#ddeef8" },
  electricity:  { fg: "#8b4a1a", bg: "#fbe8d8" },
  pond_prep:    { fg: "#6b3a8b", bg: "#ede0f8" },
  other:        { fg: "#4a4a4a", bg: "#f0f0f0" },
};

/* ── Sub-components ──────────────────────────────────────────────────── */

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

export default function FishFinance() {
  const { pop, tc, toast } = useApp();

  const [space,   setSpace]   = useState(null);
  const [summary, setSummary] = useState(null);
  const [sales,   setSales]   = useState([]);
  const [costs,   setCosts]   = useState([]);
  const [ym,      setYm]      = useState(currentYM);
  const [tab,     setTab]     = useState("sales");
  const [state,   setState]   = useState("loading");
  const [reason,  setReason]  = useState(null);

  /* Add sale */
  const blankSform = () => ({
    saleDate: today(), saleType: "fresh_fish", species: "",
    buyer: "", weightKg: "", unitPrice: "", amount: "", notes: "",
  });
  const [saleOpen, setSaleOpen] = useState(false);
  const [sform,    setSform]    = useState(blankSform);
  const [sbusy,    setSbusy]    = useState(false);

  /* Add cost */
  const blankCform = () => ({
    costDate: today(), category: "feed", description: "", amount: "", notes: "",
  });
  const [costOpen, setCostOpen] = useState(false);
  const [cform,    setCform]    = useState(blankCform);
  const [cbusy,    setCbusy]    = useState(false);

  /* Delete dialogs */
  const [deleteSaleId, setDeleteSaleId] = useState(null);
  const [deleteCostId, setDeleteCostId] = useState(null);
  const [dbusy,        setDbusy]        = useState(false);

  /* client_uuid dedup */
  const saleUuid = useRef(crypto.randomUUID());
  const costUuid = useRef(crypto.randomUUID());

  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const range = monthRange(ym.year, ym.month);
      const [sum, sl, cl] = await Promise.all([
        fishApi.financeSummary(active.id, range),
        fishApi.listSales(active.id, range),
        fishApi.listCosts(active.id, range),
      ]);
      setSummary(sum);
      setSales(sl || []);
      setCosts(cl || []);
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, [ym]);

  useEffect(() => { setState("loading"); load(); }, [load]);

  const canManage = space && farmSpaceService.can(space, "farm.fish.finance");

  /* Navigate month */
  const goMonth = (fn) => {
    const next = fn(ym);
    if (!isFuture(next)) setYm(next);
  };

  /* Share */
  const share = () => {
    const mm = `${MONTH_NAMES[ym.month]} ${ym.year}`;
    const net = summary?.net_profit ?? 0;
    const text = [
      `🐟 Fish Finance Report — ${mm}`,
      `Revenue: ${fmtAmount(summary?.total_revenue)}`,
      `Costs: ${fmtAmount(summary?.total_costs)}`,
      `Net P&L: ${net >= 0 ? "+" : ""}${fmtAmount(net)}`,
    ].join("\n");
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else { navigator.clipboard?.writeText(text).then(() => toast(tc({ en: "Copied!", hi: "कॉपी हो गया!", bn: "কপি হয়েছে!" }), "success")); }
  };

  /* Add sale */
  const addSale = async () => {
    if (!sform.amount || parseFloat(sform.amount) <= 0) return;
    setSbusy(true);
    try {
      const row = await fishApi.addSale(space.id, {
        saleDate:   sform.saleDate,
        saleType:   sform.saleType,
        species:    sform.species || null,
        buyer:      sform.buyer || null,
        weightKg:   sform.weightKg ? parseFloat(sform.weightKg) : null,
        unitPrice:  sform.unitPrice ? parseFloat(sform.unitPrice) : null,
        amount:     parseFloat(sform.amount),
        notes:      sform.notes || null,
        clientUuid: saleUuid.current,
      });
      saleUuid.current = crypto.randomUUID();
      setSales((prev) => [row, ...prev]);
      setSaleOpen(false);
      setSform(blankSform());
      toast(tc({ en: "Sale recorded", hi: "बिक्री दर्ज हुई", bn: "বিক্রয় নথিভুক্ত হয়েছে" }), "success");
      fishApi.financeSummary(space.id, monthRange(ym.year, ym.month)).then(setSummary).catch(() => {});
    } catch (err) {
      toast(err.message || tc({ en: "Failed to save sale", hi: "बिक्री सहेजने में विफल", bn: "বিক্রয় সংরক্ষণ ব্যর্থ" }), "error");
    } finally { setSbusy(false); }
  };

  /* Add cost */
  const addCost = async () => {
    if (!cform.description.trim() || !cform.amount || parseFloat(cform.amount) <= 0) return;
    setCbusy(true);
    try {
      const row = await fishApi.addCost(space.id, {
        costDate:    cform.costDate,
        category:    cform.category,
        description: cform.description.trim(),
        amount:      parseFloat(cform.amount),
        notes:       cform.notes || null,
        clientUuid:  costUuid.current,
      });
      costUuid.current = crypto.randomUUID();
      setCosts((prev) => [row, ...prev]);
      setCostOpen(false);
      setCform(blankCform());
      toast(tc({ en: "Cost recorded", hi: "लागत दर्ज हुई", bn: "খরচ নথিভুক্ত হয়েছে" }), "success");
      fishApi.financeSummary(space.id, monthRange(ym.year, ym.month)).then(setSummary).catch(() => {});
    } catch (err) {
      toast(err.message || tc({ en: "Failed to save cost", hi: "लागत सहेजने में विफल", bn: "খরচ সংরক্ষণ ব্যর্থ" }), "error");
    } finally { setCbusy(false); }
  };

  /* Delete sale */
  const confirmDeleteSale = async () => {
    if (!deleteSaleId) return;
    setDbusy(true);
    try {
      await fishApi.deleteSale(space.id, { saleId: deleteSaleId });
      setSales((prev) => prev.filter((s) => s.id !== deleteSaleId));
      setDeleteSaleId(null);
      fishApi.financeSummary(space.id, monthRange(ym.year, ym.month)).then(setSummary).catch(() => {});
    } catch (err) {
      toast(err.message || tc({ en: "Delete failed", hi: "हटाने में विफल", bn: "মুছে ফেলা ব্যর্থ" }), "error");
    } finally { setDbusy(false); }
  };

  /* Delete cost */
  const confirmDeleteCost = async () => {
    if (!deleteCostId) return;
    setDbusy(true);
    try {
      await fishApi.deleteCost(space.id, { costId: deleteCostId });
      setCosts((prev) => prev.filter((c) => c.id !== deleteCostId));
      setDeleteCostId(null);
      fishApi.financeSummary(space.id, monthRange(ym.year, ym.month)).then(setSummary).catch(() => {});
    } catch (err) {
      toast(err.message || tc({ en: "Delete failed", hi: "हटाने में विफल", bn: "মুছে ফেলা ব্যর্থ" }), "error");
    } finally { setDbusy(false); }
  };

  const bar = (
    <AppBar
      title={tc({ en: "Fish Finance", hi: "मत्स्य वित्त", bn: "মৎস্য অর্থ" })}
      onBack={pop}
      action={
        <div style={{ display: "flex", gap: 4 }}>
          {summary && (
            <button onClick={share} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 8px" }}>
              <Icon name="Share2" size={18} color={T.inkSoft} />
            </button>
          )}
          {canManage && (
            <button
              onClick={() => { tab === "sales" ? (setSform(blankSform()), setSaleOpen(true)) : (setCform(blankCform()), setCostOpen(true)); }}
              style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
                cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
                fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
              <Icon name="Plus" size={15} color="#fff" />
              {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
            </button>
          )}
        </div>
      }
    />
  );

  if (state === "loading") return <>{bar}<div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error")   return <>{bar}<div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;

  return (
    <>
      {bar}

      {/* Month navigator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
        padding: "10px 16px 0", fontFamily: T.body }}>
        <button onClick={() => goMonth(prevYM)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 10px" }}>
          <Icon name="ChevronLeft" size={18} color={T.inkSoft} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.ink, minWidth: 100, textAlign: "center" }}>
          {MONTH_NAMES[ym.month]} {ym.year}
        </span>
        <button onClick={() => goMonth(nextYM)} disabled={isFuture(nextYM(ym))}
          style={{ background: "none", border: "none",
            cursor: isFuture(nextYM(ym)) ? "default" : "pointer", padding: "6px 10px",
            opacity: isFuture(nextYM(ym)) ? 0.3 : 1 }}>
          <Icon name="ChevronRight" size={18} color={T.inkSoft} />
        </button>
      </div>

      {/* Summary card */}
      <SummaryCard summary={summary} tc={tc} />

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 4px", borderBottom: `1px solid ${T.line}` }}>
        {[
          { id: "sales", label: { en: "Sales", hi: "बिक्री", bn: "বিক্রয়" } },
          { id: "costs", label: { en: "Costs", hi: "लागत",   bn: "খরচ"    } },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? T.primarySoft : "transparent",
            border: "none", cursor: "pointer",
            padding: "6px 14px", borderRadius: 20, fontFamily: T.body, fontSize: 13, fontWeight: 600,
            color: tab === t.id ? T.primary : T.inkSoft,
          }}>
            {tc(t.label)}
          </button>
        ))}
      </div>

      {/* Sales list */}
      {tab === "sales" && (
        <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
          {sales.length === 0 ? (
            <EmptyState icon="TrendingUp"
              title={tc({ en: "No sales this month", hi: "इस माह कोई बिक्री नहीं", bn: "এই মাসে কোনো বিক্রয় নেই" })}
              body={tc({ en: "Record fish sales to track revenue.", hi: "राजस्व ट्रैक करने के लिए बिक्री दर्ज करें।", bn: "রাজস্ব ট্র্যাক করতে মাছ বিক্রয় নথিভুক্ত করুন।" })} />
          ) : (
            sales.map((s) => (
              <Card key={s.id} pad={0}>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                        <SaleTypeChip saleType={s.sale_type} tc={tc} />
                        {s.species && (
                          <span style={{ fontSize: 11.5, color: T.inkSoft, fontFamily: T.body }}>{s.species}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>
                        {fmtDate(s.sale_date)}
                        {s.buyer ? ` · ${s.buyer}` : ""}
                        {s.weight_kg ? ` · ${s.weight_kg} kg` : ""}
                        {s.unit_price ? ` · ₹${s.unit_price}/kg` : ""}
                      </div>
                      {s.notes && <div style={{ fontSize: 11.5, color: T.inkFaint, fontFamily: T.body, marginTop: 2 }}>{s.notes}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: T.blue, fontFamily: T.display }}>
                        {fmtAmount(s.amount)}
                      </span>
                      {canManage && (
                        <button onClick={() => setDeleteSaleId(s.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>
                          <Icon name="Trash2" size={14} color={T.inkFaint} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Costs list */}
      {tab === "costs" && (
        <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
          {costs.length === 0 ? (
            <EmptyState icon="ShoppingCart"
              title={tc({ en: "No costs this month", hi: "इस माह कोई लागत नहीं", bn: "এই মাসে কোনো খরচ নেই" })}
              body={tc({ en: "Record expenses to track your costs.", hi: "खर्च ट्रैक करने के लिए लागत दर्ज करें।", bn: "খরচ ট্র্যাক করতে ব্যয় নথিভুক্ত করুন।" })} />
          ) : (
            costs.map((c) => (
              <Card key={c.id} pad={0}>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                        <CategoryChip category={c.category} tc={tc} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: T.body }}>{c.description}</span>
                      </div>
                      <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>{fmtDate(c.cost_date)}</div>
                      {c.notes && <div style={{ fontSize: 11.5, color: T.inkFaint, fontFamily: T.body, marginTop: 2 }}>{c.notes}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: T.orange, fontFamily: T.display }}>
                        {fmtAmount(c.amount)}
                      </span>
                      {canManage && (
                        <button onClick={() => setDeleteCostId(c.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>
                          <Icon name="Trash2" size={14} color={T.inkFaint} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Add sale sheet */}
      <BottomSheet open={saleOpen} onClose={() => setSaleOpen(false)}
        title={tc({ en: "Record Sale", hi: "बिक्री दर्ज करें", bn: "বিক্রয় নথিভুক্ত করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Sale date", hi: "बिक्री तारीख", bn: "বিক্রয়ের তারিখ" })}
            type="date" value={sform.saleDate} onChange={(v) => setSform((f) => ({ ...f, saleDate: v }))} />
          <Dropdown label={tc({ en: "Sale type", hi: "बिक्री प्रकार", bn: "বিক্রয়ের ধরন" })}
            value={sform.saleType} onChange={(v) => setSform((f) => ({ ...f, saleType: v }))}
            options={SALE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: tc(o.label) }))} />
          <Input label={tc({ en: "Species (optional)", hi: "प्रजाति (वैकल्पिक)", bn: "প্রজাতি (ঐচ্ছিক)" })}
            placeholder={tc({ en: "e.g. Rohu, Catla", hi: "उदा. रोहू, कतला", bn: "যেমন রুই, কাতলা" })}
            value={sform.species} onChange={(v) => setSform((f) => ({ ...f, species: v }))} />
          <Input label={tc({ en: "Buyer (optional)", hi: "खरीदार (वैकल्पिक)", bn: "ক্রেতা (ঐচ্ছিক)" })}
            placeholder={tc({ en: "Name or market", hi: "नाम या बाजार", bn: "নাম বা বাজার" })}
            value={sform.buyer} onChange={(v) => setSform((f) => ({ ...f, buyer: v }))} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Input label={tc({ en: "Weight (kg)", hi: "वजन (kg)", bn: "ওজন (kg)" })}
                type="number" placeholder="e.g. 50"
                value={sform.weightKg} onChange={(v) => setSform((f) => ({ ...f, weightKg: v }))} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label={tc({ en: "Price / kg (₹)", hi: "कीमत / kg (₹)", bn: "মূল্য / kg (₹)" })}
                type="number" placeholder="e.g. 120"
                value={sform.unitPrice} onChange={(v) => setSform((f) => ({ ...f, unitPrice: v }))} />
            </div>
          </div>
          <Input label={tc({ en: "Total amount (₹) *", hi: "कुल राशि (₹) *", bn: "মোট পরিমাণ (₹) *" })}
            type="number" placeholder="e.g. 6000"
            value={sform.amount} onChange={(v) => setSform((f) => ({ ...f, amount: v }))} />
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={sform.notes} onChange={(v) => setSform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addSale} disabled={sbusy || !sform.amount || parseFloat(sform.amount) <= 0}>
            {sbusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save Sale", hi: "बिक्री सहेजें", bn: "বিক্রয় সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Add cost sheet */}
      <BottomSheet open={costOpen} onClose={() => setCostOpen(false)}
        title={tc({ en: "Record Cost", hi: "लागत दर्ज करें", bn: "খরচ নথিভুক্ত করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Cost date", hi: "लागत तारीख", bn: "খরচের তারিখ" })}
            type="date" value={cform.costDate} onChange={(v) => setCform((f) => ({ ...f, costDate: v }))} />
          <Dropdown label={tc({ en: "Category", hi: "श्रेणी", bn: "বিভাগ" })}
            value={cform.category} onChange={(v) => setCform((f) => ({ ...f, category: v }))}
            options={COST_CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: tc(o.label) }))} />
          <Input label={tc({ en: "Description *", hi: "विवरण *", bn: "বিবরণ *" })}
            placeholder={tc({ en: "What was purchased / paid for", hi: "क्या खरीदा / भुगतान किया", bn: "কী কেনা / পরিশোধ করা হয়েছে" })}
            value={cform.description} onChange={(v) => setCform((f) => ({ ...f, description: v }))} />
          <Input label={tc({ en: "Amount (₹) *", hi: "राशि (₹) *", bn: "পরিমাণ (₹) *" })}
            type="number" placeholder="e.g. 2500"
            value={cform.amount} onChange={(v) => setCform((f) => ({ ...f, amount: v }))} />
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={cform.notes} onChange={(v) => setCform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addCost}
            disabled={cbusy || !cform.description.trim() || !cform.amount || parseFloat(cform.amount) <= 0}>
            {cbusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save Cost", hi: "लागत सहेजें", bn: "খরচ সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Delete sale dialog */}
      <Dialog open={!!deleteSaleId} onClose={() => setDeleteSaleId(null)}
        title={tc({ en: "Delete sale?", hi: "बिक्री हटाएँ?", bn: "বিক্রয় মুছবেন?" })}
        body={tc({ en: "This sale will be permanently removed.", hi: "यह बिक्री स्थायी रूप से हटा दी जाएगी।", bn: "এই বিক্রয়টি স্থায়ীভাবে মুছে ফেলা হবে।" })}
        confirmLabel={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
        confirmDestructive
        onConfirm={confirmDeleteSale}
        busy={dbusy} />

      {/* Delete cost dialog */}
      <Dialog open={!!deleteCostId} onClose={() => setDeleteCostId(null)}
        title={tc({ en: "Delete cost?", hi: "लागत हटाएँ?", bn: "খরচ মুছবেন?" })}
        body={tc({ en: "This cost record will be permanently removed.", hi: "यह लागत रिकॉर्ड स्थायी रूप से हटा दिया जाएगा।", bn: "এই খরচ রেকর্ডটি স্থায়ীভাবে মুছে ফেলা হবে।" })}
        confirmLabel={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
        confirmDestructive
        onConfirm={confirmDeleteCost}
        busy={dbusy} />
    </>
  );
}
