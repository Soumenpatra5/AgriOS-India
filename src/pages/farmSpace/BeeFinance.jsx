import { useState, useEffect, useCallback, useRef } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, Spinner, BottomSheet,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { beeApi } from "../../services/bee/beeApi.js";

const MONTH_NAMES = [
  { en: "January", hi: "जनवरी", bn: "জানুয়ারি" },
  { en: "February", hi: "फरवरी", bn: "ফেব্রুয়ারি" },
  { en: "March", hi: "मार्च", bn: "মার্চ" },
  { en: "April", hi: "अप्रैल", bn: "এপ্রিল" },
  { en: "May", hi: "मई", bn: "মে" },
  { en: "June", hi: "जून", bn: "জুন" },
  { en: "July", hi: "जुलाई", bn: "জুলাই" },
  { en: "August", hi: "अगस्त", bn: "আগস্ট" },
  { en: "September", hi: "सितंबर", bn: "সেপ্টেম্বর" },
  { en: "October", hi: "अक्टूबर", bn: "অক্টোবর" },
  { en: "November", hi: "नवंबर", bn: "নভেম্বর" },
  { en: "December", hi: "दिसंबर", bn: "ডিসেম্বর" },
];

function prevYM({ year, month }) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}
function nextYM({ year, month }) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}
function isFuture({ year, month }) {
  const now = new Date();
  return year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
}
function monthRange(year, month) {
  const from = new Date(year, month - 1, 1);
  const to   = new Date(year, month, 0);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate:   to.toISOString().slice(0, 10),
  };
}

const SALE_TYPE_OPTIONS = [
  { value: "honey",       label: { en: "Honey",       hi: "शहद",       bn: "মধু"          } },
  { value: "beeswax",     label: { en: "Beeswax",     hi: "मोम",        bn: "মোম"           } },
  { value: "propolis",    label: { en: "Propolis",    hi: "प्रोपोलिस",  bn: "প্রপোলিস"      } },
  { value: "pollen",      label: { en: "Pollen",      hi: "पराग",      bn: "পরাগ"           } },
  { value: "royal_jelly", label: { en: "Royal Jelly", hi: "रॉयल जेली", bn: "রয়্যাল জেলি"   } },
  { value: "other",       label: { en: "Other",       hi: "अन्य",      bn: "অন্যান্য"        } },
];

const COST_CATEGORY_OPTIONS = [
  { value: "equipment",       label: { en: "Equipment",       hi: "उपकरण",         bn: "সরঞ্জাম"      } },
  { value: "feed_supplement", label: { en: "Feed supplement", hi: "चारा पूरक",      bn: "খাদ্য সম্পূরক" } },
  { value: "treatment",       label: { en: "Treatment",       hi: "उपचार",         bn: "চিকিৎসা"      } },
  { value: "labour",          label: { en: "Labour",          hi: "श्रम",           bn: "শ্রম"          } },
  { value: "transport",       label: { en: "Transport",       hi: "परिवहन",         bn: "পরিবহন"        } },
  { value: "other",           label: { en: "Other",           hi: "अन्य",           bn: "অন্যান্য"       } },
];

function SummaryCard({ label, value, color, sub }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, background: T.surface, border: `1px solid ${T.line}`,
      borderRadius: T.rMd, padding: "12px 14px" }}>
      <div style={{ fontSize: 10.5, color: T.inkFaint, fontFamily: T.body,
        textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: T.display, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 3, fontFamily: T.body }}>{sub}</div>}
    </div>
  );
}

function BreakdownRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 0", borderBottom: `1px solid ${T.line}`, fontFamily: T.body }}>
      <span style={{ fontSize: 13, color: T.inkSoft }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

const fmtRs = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function BeeFinance() {
  const { tc, pop, toast } = useApp();

  const now = new Date();
  const [ym,    setYm]    = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [space, setSpace] = useState(null);
  const [tab,   setTab]   = useState("sales");

  const [summary,    setSummary]    = useState(null);
  const [sumState,   setSumState]   = useState("loading");
  const [sales,      setSales]      = useState([]);
  const [salesState, setSalesState] = useState("loading");
  const [costs,      setCosts]      = useState([]);
  const [costsState, setCostsState] = useState("loading");

  const [addSaleOpen, setAddSaleOpen] = useState(false);
  const [addCostOpen, setAddCostOpen] = useState(false);
  const [deleteSaleId, setDeleteSaleId] = useState(null);
  const [deleteCostId, setDeleteCostId] = useState(null);
  const [busy, setBusy] = useState(false);

  const saleUuid = useRef(crypto.randomUUID());
  const costUuid = useRef(crypto.randomUUID());

  const blankSale = () => ({
    saleDate: today(), productType: "honey",
    quantityKg: "", unitPrice: "", amount: "", buyer: "", notes: "",
  });
  const blankCost = () => ({
    costDate: today(), category: "equipment",
    description: "", amount: "", notes: "",
  });
  const [saleForm, setSaleForm] = useState(blankSale);
  const [costForm, setCostForm] = useState(blankCost);

  const loadFinance = useCallback(async (activeSpace, currentYm) => {
    if (!activeSpace) return;
    const range = monthRange(currentYm.year, currentYm.month);

    setSumState("loading");
    setSalesState("loading");
    setCostsState("loading");

    beeApi.financeSummary(activeSpace.id, range)
      .then(setSummary).catch(() => setSummary(null))
      .finally(() => setSumState("ready"));

    beeApi.listSales(activeSpace.id, range)
      .then(setSales).catch(() => setSales([]))
      .finally(() => setSalesState("ready"));

    beeApi.listCosts(activeSpace.id, range)
      .then(setCosts).catch(() => setCosts([]))
      .finally(() => setCostsState("ready"));
  }, []);

  const loadSpace = useCallback(async () => {
    const active = await farmSpaceService.active();
    setSpace(active);
    loadFinance(active, ym);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadSpace(); }, [loadSpace]);

  const changeMonth = (newYm) => {
    setYm(newYm);
    loadFinance(space, newYm);
  };

  const saveSale = async () => {
    if (!saleForm.amount || parseFloat(saleForm.amount) <= 0) {
      toast(tc({ en: "Amount must be > 0", hi: "राशि > 0 होनी चाहिए", bn: "পরিমাণ > 0 হতে হবে" }), "error");
      return;
    }
    setBusy(true);
    try {
      const row = await beeApi.addSale(space.id, {
        saleDate:    saleForm.saleDate,
        productType: saleForm.productType,
        quantityKg:  saleForm.quantityKg ? parseFloat(saleForm.quantityKg) : null,
        unitPrice:   saleForm.unitPrice  ? parseFloat(saleForm.unitPrice)  : null,
        amount:      parseFloat(saleForm.amount),
        buyer:       saleForm.buyer   || null,
        notes:       saleForm.notes   || null,
        clientUuid:  saleUuid.current,
      });
      saleUuid.current = crypto.randomUUID();
      setSales((prev) => [row, ...prev]);
      setAddSaleOpen(false);
      setSaleForm(blankSale());
      loadFinance(space, ym);
      toast(tc({ en: "Sale added", hi: "बिक्री दर्ज हुई", bn: "বিক্রয় যোগ হয়েছে" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setBusy(false); }
  };

  const saveCost = async () => {
    if (!costForm.description.trim()) {
      toast(tc({ en: "Description required", hi: "विवरण आवश्यक", bn: "বিবরণ প্রয়োজন" }), "error");
      return;
    }
    if (!costForm.amount || parseFloat(costForm.amount) <= 0) {
      toast(tc({ en: "Amount must be > 0", hi: "राशि > 0 होनी चाहिए", bn: "পরিমাণ > 0 হতে হবে" }), "error");
      return;
    }
    setBusy(true);
    try {
      const row = await beeApi.addCost(space.id, {
        costDate:    costForm.costDate,
        category:    costForm.category,
        description: costForm.description.trim(),
        amount:      parseFloat(costForm.amount),
        notes:       costForm.notes  || null,
        clientUuid:  costUuid.current,
      });
      costUuid.current = crypto.randomUUID();
      setCosts((prev) => [row, ...prev]);
      setAddCostOpen(false);
      setCostForm(blankCost());
      loadFinance(space, ym);
      toast(tc({ en: "Cost added", hi: "लागत दर्ज हुई", bn: "খরচ যোগ হয়েছে" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setBusy(false); }
  };

  const doDeleteSale = async (id) => {
    try {
      await beeApi.deleteSale(space.id, { saleId: id });
      setSales((prev) => prev.filter((r) => r.id !== id));
      setDeleteSaleId(null);
      loadFinance(space, ym);
      toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে ফেলা হয়েছে" }), "success");
    } catch (err) { toast(err.message, "error"); }
  };

  const doDeleteCost = async (id) => {
    try {
      await beeApi.deleteCost(space.id, { costId: id });
      setCosts((prev) => prev.filter((r) => r.id !== id));
      setDeleteCostId(null);
      loadFinance(space, ym);
      toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে ফেলা হয়েছে" }), "success");
    } catch (err) { toast(err.message, "error"); }
  };

  const shareText = () => {
    const monthLabel = `${tc(MONTH_NAMES[ym.month - 1])} ${ym.year}`;
    const lines = [
      `🍯 ${tc({ en: "Bee Finance Report", hi: "मधुमक्खी वित्त रिपोर्ट", bn: "মৌমাছি অর্থ প্রতিবেদন" })} — ${monthLabel}`,
      `${tc({ en: "Revenue", hi: "आय", bn: "রাজস্ব" })}: ${fmtRs(summary?.total_revenue)}`,
      `${tc({ en: "Costs",   hi: "लागत", bn: "খরচ" })}: ${fmtRs(summary?.total_costs)}`,
      `${tc({ en: "Profit",  hi: "लाभ", bn: "লাভ" })}: ${fmtRs(summary?.net_profit)}`,
    ];
    if (navigator.share) {
      navigator.share({ text: lines.join("\n") }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(lines.join("\n"))
        .then(() => toast(tc({ en: "Copied!", hi: "कॉपी हुआ!", bn: "কপি হয়েছে!" }), "success"));
    }
  };

  const monthLabel = `${tc(MONTH_NAMES[ym.month - 1])} ${ym.year}`;
  const canFinance = space && farmSpaceService.can(space, "farm.bee.finance");

  return (
    <>
      <AppBar
        title={tc({ en: "Bee Finance", hi: "मधुमक्खी वित्त", bn: "মৌমাছি অর্থ" })}
        onBack={pop}
        action={
          <button onClick={shareText} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <Icon name="Share2" size={20} color={T.primary} />
          </button>
        }
      />

      {/* Month navigator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px 0" }}>
        <button onClick={() => changeMonth(prevYM(ym))}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
          <Icon name="ChevronLeft" size={22} color={T.primary} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.ink, fontFamily: T.display }}>
          {monthLabel}
        </span>
        <button onClick={() => changeMonth(nextYM(ym))}
          style={{ background: "none", border: "none",
            cursor: isFuture(nextYM(ym)) ? "default" : "pointer", padding: 6,
            opacity: isFuture(nextYM(ym)) ? 0.3 : 1 }}
          disabled={isFuture(nextYM(ym))}>
          <Icon name="ChevronRight" size={22} color={T.primary} />
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 0" }}>
        {sumState === "loading"
          ? <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 20 }}><Spinner /></div>
          : <>
            <SummaryCard
              label={tc({ en: "Revenue", hi: "आय", bn: "রাজস্ব" })}
              value={fmtRs(summary?.total_revenue)}
              color={T.blue} />
            <SummaryCard
              label={tc({ en: "Costs", hi: "लागत", bn: "খরচ" })}
              value={fmtRs(summary?.total_costs)}
              color={T.orange} />
            <SummaryCard
              label={tc({ en: "Profit", hi: "लाभ", bn: "লাভ" })}
              value={fmtRs(summary?.net_profit)}
              color={(summary?.net_profit ?? 0) >= 0 ? T.primary : T.red} />
          </>
        }
      </div>

      {/* Breakdown when ready */}
      {sumState === "ready" && summary && (
        <div style={{ padding: "10px 16px 0" }}>
          <Card>
            {Object.entries(summary.sales_breakdown || {})
              .filter(([, v]) => v > 0)
              .map(([k, v]) => (
                <BreakdownRow
                  key={k}
                  label={tc((SALE_TYPE_OPTIONS.find(o => o.value === k) || { label: { en: k, hi: k, bn: k } }).label)}
                  value={fmtRs(v)}
                  color={T.blue} />
              ))}
            {Object.entries(summary.cost_breakdown || {})
              .filter(([, v]) => v > 0)
              .map(([k, v]) => (
                <BreakdownRow
                  key={k}
                  label={tc((COST_CATEGORY_OPTIONS.find(o => o.value === k) || { label: { en: k, hi: k, bn: k } }).label)}
                  value={fmtRs(v)}
                  color={T.orange} />
              ))}
          </Card>
        </div>
      )}

      {/* Tab selector */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 0" }}>
        <Chip active={tab === "sales"} onPress={() => setTab("sales")}
          label={tc({ en: "Sales", hi: "बिक्री", bn: "বিক্রয়" })} />
        <Chip active={tab === "costs"} onPress={() => setTab("costs")}
          label={tc({ en: "Costs", hi: "लागत", bn: "খরচ" })} />
      </div>

      {/* Add button */}
      {canFinance && (
        <div style={{ padding: "8px 16px 0" }}>
          <Button
            label={tab === "sales"
              ? tc({ en: "+ Add Sale", hi: "+ बिक्री जोड़ें", bn: "+ বিক্রয় যোগ" })
              : tc({ en: "+ Add Cost", hi: "+ लागत जोड़ें", bn: "+ খরচ যোগ" })}
            onPress={() => tab === "sales" ? setAddSaleOpen(true) : setAddCostOpen(true)}
            fullWidth />
        </div>
      )}

      {/* Sales list */}
      {tab === "sales" && (
        <div style={{ padding: "8px 0 16px" }}>
          {salesState === "loading" && <div style={{ padding: 20, display: "grid", placeItems: "center" }}><Spinner /></div>}
          {salesState === "ready" && sales.length === 0 && (
            <EmptyState icon="Droplets" title={tc({ en: "No sales this month", hi: "इस महीने कोई बिक्री नहीं", bn: "এই মাসে বিক্রয় নেই" })} />
          )}
          {salesState === "ready" && sales.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: T.blueSoft,
                display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name="Droplets" size={15} color={T.blue} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, fontFamily: T.body }}>
                  {fmtRs(r.amount)}
                  {r.quantity_kg && <span style={{ fontWeight: 400, color: T.inkSoft }}> · {r.quantity_kg} kg</span>}
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>
                  {new Date(r.sale_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  {" · "}{tc((SALE_TYPE_OPTIONS.find(o => o.value === r.product_type) || SALE_TYPE_OPTIONS[0]).label)}
                  {r.buyer && ` · ${r.buyer}`}
                </div>
              </div>
              {canFinance && (
                <button onClick={() => setDeleteSaleId(r.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <Icon name="Trash2" size={15} color={T.red} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Costs list */}
      {tab === "costs" && (
        <div style={{ padding: "8px 0 16px" }}>
          {costsState === "loading" && <div style={{ padding: 20, display: "grid", placeItems: "center" }}><Spinner /></div>}
          {costsState === "ready" && costs.length === 0 && (
            <EmptyState icon="Receipt" title={tc({ en: "No costs this month", hi: "इस महीने कोई लागत नहीं", bn: "এই মাসে খরচ নেই" })} />
          )}
          {costsState === "ready" && costs.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fff3e8",
                display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name="Receipt" size={15} color={T.orange} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, fontFamily: T.body }}>
                  {fmtRs(r.amount)} · {r.description}
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>
                  {new Date(r.cost_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  {" · "}{tc((COST_CATEGORY_OPTIONS.find(o => o.value === r.category) || COST_CATEGORY_OPTIONS[0]).label)}
                </div>
              </div>
              {canFinance && (
                <button onClick={() => setDeleteCostId(r.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <Icon name="Trash2" size={15} color={T.red} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Sale Sheet */}
      <BottomSheet open={addSaleOpen} onClose={() => { setAddSaleOpen(false); setSaleForm(blankSale()); }}>
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, fontFamily: T.display, marginBottom: 16 }}>
            {tc({ en: "Add Sale", hi: "बिक्री जोड़ें", bn: "বিক্রয় যোগ করুন" })}
          </div>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *" })} type="date"
            value={saleForm.saleDate}
            onChange={(v) => setSaleForm((f) => ({ ...f, saleDate: v }))} />
          <Dropdown
            label={tc({ en: "Product", hi: "उत्पाद", bn: "পণ্য" })}
            value={saleForm.productType}
            onChange={(v) => setSaleForm((f) => ({ ...f, productType: v }))}
            options={SALE_TYPE_OPTIONS.map(o => ({ value: o.value, label: tc(o.label) }))} />
          <Input label={tc({ en: "Quantity (kg)", hi: "मात्रा (kg)", bn: "পরিমাণ (kg)" })} type="number"
            value={saleForm.quantityKg}
            onChange={(v) => setSaleForm((f) => ({ ...f, quantityKg: v }))} />
          <Input label={tc({ en: "Unit price (₹/kg)", hi: "प्रति किलो मूल्य", bn: "প্রতি কেজি মূল্য" })} type="number"
            value={saleForm.unitPrice}
            onChange={(v) => setSaleForm((f) => ({ ...f, unitPrice: v }))} />
          <Input label={tc({ en: "Total amount (₹) *", hi: "कुल राशि (₹) *", bn: "মোট পরিমাণ (₹) *" })} type="number"
            value={saleForm.amount}
            onChange={(v) => setSaleForm((f) => ({ ...f, amount: v }))} />
          <Input label={tc({ en: "Buyer", hi: "खरीदार", bn: "ক্রেতা" })}
            value={saleForm.buyer}
            onChange={(v) => setSaleForm((f) => ({ ...f, buyer: v }))} />
          <Input label={tc({ en: "Notes", hi: "नोट्स", bn: "নোট" })} multiline
            value={saleForm.notes}
            onChange={(v) => setSaleForm((f) => ({ ...f, notes: v }))} />
          <Button
            label={busy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save Sale", hi: "बिक्री सहेजें", bn: "বিক্রয় সংরক্ষণ" })}
            onPress={saveSale} disabled={busy || !saleForm.amount} fullWidth />
        </div>
      </BottomSheet>

      {/* Add Cost Sheet */}
      <BottomSheet open={addCostOpen} onClose={() => { setAddCostOpen(false); setCostForm(blankCost()); }}>
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, fontFamily: T.display, marginBottom: 16 }}>
            {tc({ en: "Add Cost", hi: "लागत जोड़ें", bn: "খরচ যোগ করুন" })}
          </div>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *" })} type="date"
            value={costForm.costDate}
            onChange={(v) => setCostForm((f) => ({ ...f, costDate: v }))} />
          <Dropdown
            label={tc({ en: "Category", hi: "श्रेणी", bn: "বিভাগ" })}
            value={costForm.category}
            onChange={(v) => setCostForm((f) => ({ ...f, category: v }))}
            options={COST_CATEGORY_OPTIONS.map(o => ({ value: o.value, label: tc(o.label) }))} />
          <Input label={tc({ en: "Description *", hi: "विवरण *", bn: "বিবরণ *" })}
            value={costForm.description}
            onChange={(v) => setCostForm((f) => ({ ...f, description: v }))}
            placeholder={tc({ en: "What was purchased / done", hi: "क्या खरीदा / किया गया", bn: "কী কেনা / করা হয়েছে" })} />
          <Input label={tc({ en: "Amount (₹) *", hi: "राशि (₹) *", bn: "পরিমাণ (₹) *" })} type="number"
            value={costForm.amount}
            onChange={(v) => setCostForm((f) => ({ ...f, amount: v }))} />
          <Input label={tc({ en: "Notes", hi: "नोट्स", bn: "নোট" })} multiline
            value={costForm.notes}
            onChange={(v) => setCostForm((f) => ({ ...f, notes: v }))} />
          <Button
            label={busy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save Cost", hi: "लागत सहेजें", bn: "খরচ সংরক্ষণ" })}
            onPress={saveCost} disabled={busy || !costForm.description || !costForm.amount} fullWidth />
        </div>
      </BottomSheet>

      {/* Confirm delete sale */}
      <BottomSheet open={!!deleteSaleId} onClose={() => setDeleteSaleId(null)}>
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontFamily: T.body, fontSize: 14, marginBottom: 16 }}>
            {tc({ en: "Delete this sale record?", hi: "यह बिक्री हटाएँ?", bn: "এই বিক্রয় মুছবেন?" })}
          </div>
          <Button label={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
            onPress={() => doDeleteSale(deleteSaleId)} fullWidth danger />
        </div>
      </BottomSheet>

      {/* Confirm delete cost */}
      <BottomSheet open={!!deleteCostId} onClose={() => setDeleteCostId(null)}>
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontFamily: T.body, fontSize: 14, marginBottom: 16 }}>
            {tc({ en: "Delete this cost record?", hi: "यह लागत हटाएँ?", bn: "এই খরচ মুছবেন?" })}
          </div>
          <Button label={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
            onPress={() => doDeleteCost(deleteCostId)} fullWidth danger />
        </div>
      </BottomSheet>
    </>
  );
}
