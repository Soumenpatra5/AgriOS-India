/* Batch Finance — sales and production costs for one poultry batch.
   Accessed via the ₹ button in PoultryBatchDetail's AppBar. */

import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet, Dialog,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { poultryApi } from "../../services/poultry/poultryApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const today = () => new Date().toISOString().slice(0, 10);

const fmt = (n) => Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n ?? 0).toLocaleString("en-IN");

const COST_CATEGORIES = [
  { value: "chick_cost",  label: { en: "Chick cost (DOC)",  hi: "चूज़ा लागत",         bn: "ছানার খরচ" } },
  { value: "labour",      label: { en: "Labour",            hi: "मज़दूरी",             bn: "শ্রম" } },
  { value: "medicine",    label: { en: "Medicine",          hi: "दवा",                bn: "ওষুধ" } },
  { value: "equipment",   label: { en: "Equipment",         hi: "उपकरण",              bn: "সরঞ্জাম" } },
  { value: "transport",   label: { en: "Transport",         hi: "परिवहन",             bn: "পরিবহন" } },
  { value: "electricity", label: { en: "Electricity",       hi: "बिजली",              bn: "বিদ্যুৎ" } },
  { value: "overhead",    label: { en: "Overhead",          hi: "ओवरहेड",             bn: "ওভারহেড" } },
  { value: "other",       label: { en: "Other",             hi: "अन्य",               bn: "অন্যান্য" } },
];

function SummaryTile({ label, value, accent, small }) {
  const bg = accent === "primary" ? `${T.primary}12`
    : accent === "green" ? `${T.primary}12`
    : accent === "red" ? `${T.error}12`
    : T.surface2;
  const color = accent === "primary" ? T.primary
    : accent === "green" ? T.primary
    : accent === "red" ? T.error
    : T.ink;
  return (
    <div style={{ background: bg, borderRadius: T.rMd, padding: "10px 14px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: small ? 15 : 18, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function SaleRow({ row, tc, canManage, onDelete }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingBottom: 10,
      borderBottom: `1px solid ${T.lineSoft}` }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${T.primary}12`,
        display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name="ShoppingCart" size={15} color={T.primary} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
            {fmtInt(row.birds_sold)} {tc({ en: "birds", hi: "पक्षी", bn: "পাখি" })}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.primary }}>₹{fmt(row.net_revenue)}</span>
        </div>
        <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
          {row.sale_date}
          {row.buyer_name ? ` · ${row.buyer_name}` : ""}
          {row.live_weight_kg ? ` · ${Number(row.live_weight_kg).toFixed(2)} kg` : ""}
          {Number(row.gross_amount) !== Number(row.net_revenue)
            ? ` · ${tc({ en: "Deducted", hi: "कटौती", bn: "কর্তন" })} ₹${fmt(Number(row.gross_amount) - Number(row.net_revenue))}`
            : ""}
        </div>
        {row.notes && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{row.notes}</div>}
      </div>
      {canManage && (
        <button onClick={() => onDelete(row)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: T.inkFaint }}>
          <Icon name="Trash2" size={15} />
        </button>
      )}
    </div>
  );
}

function CostRow({ row, tc, canManage, onDelete }) {
  const catLabel = COST_CATEGORIES.find(c => c.value === row.category);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingBottom: 10,
      borderBottom: `1px solid ${T.lineSoft}` }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${T.orange}12`,
        display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name="Receipt" size={15} color={T.orange} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
            {row.description}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.orange }}>₹{fmt(row.amount)}</span>
        </div>
        <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
          {row.cost_date}
          {catLabel ? ` · ${tc(catLabel.label)}` : ""}
          {row.supplier ? ` · ${row.supplier}` : ""}
        </div>
        {row.notes && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{row.notes}</div>}
      </div>
      {canManage && (
        <button onClick={() => onDelete(row)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: T.inkFaint }}>
          <Icon name="Trash2" size={15} />
        </button>
      )}
    </div>
  );
}

export default function PoultryBatchFinance({ batchId }) {
  const { pop, tc, toast } = useApp();

  const [space, setSpace]       = useState(null);
  const [batch, setBatch]       = useState(null);
  const [summary, setSummary]   = useState(null);
  const [sales, setSales]       = useState(null);
  const [costs, setCosts]       = useState(null);
  const [state, setState]       = useState("loading");
  const [reason, setReason]     = useState(null);

  /* Sale form */
  const [saleOpen, setSaleOpen] = useState(false);
  const [sform, setSform] = useState({
    sale_date: today(), buyer_name: "", birds_sold: "", live_weight_kg: "",
    gross_amount: "", transport_deduction: "", commission_deduction: "",
    other_deduction: "", notes: "",
  });
  const [sbusy, setSbusy] = useState(false);

  /* Cost form */
  const [costOpen, setCostOpen] = useState(false);
  const [cform, setCform] = useState({
    cost_date: today(), category: "labour", description: "",
    amount: "", supplier: "", notes: "",
  });
  const [cbusy, setCbusy] = useState(false);

  /* Delete confirm */
  const [delTarget, setDelTarget] = useState(null);
  const [delBusy, setDelBusy]     = useState(false);

  const canRecord = space && farmSpaceService.can(space, "farm.poultry.record");
  const canManage = space && farmSpaceService.can(space, "farm.poultry.manage");

  const isWritable = batch && ["draft", "active", "harvesting", "partially_sold"].includes(batch.status);

  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const [b, summ, sl, cl] = await Promise.all([
        poultryApi.getBatch(active.id, batchId),
        poultryApi.financeSummary(active.id, batchId),
        poultryApi.listSales(active.id, batchId),
        poultryApi.listCosts(active.id, batchId),
      ]);
      setBatch(b);
      setSummary(summ);
      setSales(sl || []);
      setCosts(cl || []);
      setState("ready");
    } catch (err) {
      if (state !== "ready") { setReason(err?.reason || FARM_ERROR.FAILED); setState("error"); }
    }
  }, [batchId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const submitSale = async () => {
    if (!sform.sale_date || !sform.birds_sold || !sform.gross_amount) return;
    setSbusy(true);
    try {
      await poultryApi.addSale(space.id, {
        batchId,
        sale_date:           sform.sale_date,
        buyer_name:          sform.buyer_name.trim() || null,
        birds_sold:          Number(sform.birds_sold),
        live_weight_kg:      sform.live_weight_kg ? Number(sform.live_weight_kg) : null,
        gross_amount:        Number(sform.gross_amount),
        transport_deduction: sform.transport_deduction ? Number(sform.transport_deduction) : 0,
        commission_deduction:sform.commission_deduction ? Number(sform.commission_deduction) : 0,
        other_deduction:     sform.other_deduction ? Number(sform.other_deduction) : 0,
        notes:               sform.notes.trim() || null,
      });
      setSaleOpen(false);
      setSform({ sale_date: today(), buyer_name: "", birds_sold: "", live_weight_kg: "",
        gross_amount: "", transport_deduction: "", commission_deduction: "", other_deduction: "", notes: "" });
      toast(tc({ en: "Sale recorded", hi: "बिक्री दर्ज हुई", bn: "বিক্রয় রেকর্ড হয়েছে" }), "success");
      setSales(null); setSummary(null); // force re-fetch
      load();
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setSbusy(false); }
  };

  const submitCost = async () => {
    if (!cform.cost_date || !cform.description.trim() || !cform.amount) return;
    setCbusy(true);
    try {
      await poultryApi.addCost(space.id, {
        batchId,
        cost_date:   cform.cost_date,
        category:    cform.category,
        description: cform.description.trim(),
        amount:      Number(cform.amount),
        supplier:    cform.supplier.trim() || null,
        notes:       cform.notes.trim() || null,
      });
      setCostOpen(false);
      setCform({ cost_date: today(), category: "labour", description: "", amount: "", supplier: "", notes: "" });
      toast(tc({ en: "Cost recorded", hi: "लागत दर्ज हुई", bn: "খরচ রেকর্ড হয়েছে" }), "success");
      setCosts(null); setSummary(null);
      load();
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setCbusy(false); }
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    setDelBusy(true);
    try {
      if (delTarget.type === "sale") {
        await poultryApi.deleteSale(space.id, delTarget.id);
        toast(tc({ en: "Sale removed", hi: "बिक्री हटाई", bn: "বিক্রয় সরানো হয়েছে" }), "success");
        setSales(null); setSummary(null);
      } else {
        await poultryApi.deleteCost(space.id, delTarget.id);
        toast(tc({ en: "Cost removed", hi: "लागत हटाई", bn: "খরচ সরানো হয়েছে" }), "success");
        setCosts(null); setSummary(null);
      }
      setDelTarget(null);
      load();
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর्থ" }), "error");
    } finally { setDelBusy(false); }
  };

  const title = batch?.name
    ? `${batch.name} — ${tc({ en: "Finance", hi: "वित्त", bn: "অর্থ" })}`
    : tc({ en: "Finance", hi: "वित्त", bn: "অর্থ" });

  if (state === "loading") return (
    <>
      <AppBar title={tc({ en: "Finance", hi: "वित्त", bn: "অর্থ" })} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div>
    </>
  );

  if (state === "error") return (
    <>
      <AppBar title={tc({ en: "Finance", hi: "वित्त", bn: "অর্থ" })} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div>
    </>
  );

  const netProfitColor = summary.net_profit > 0 ? "primary" : summary.net_profit < 0 ? "red" : undefined;
  const costCatOptions = COST_CATEGORIES.map(c => ({ value: c.value, label: tc(c.label) }));

  return (
    <>
      <AppBar title={title} onBack={pop} />

      <div style={{ padding: "4px 16px 100px", display: "flex", flexDirection: "column", gap: 16 }}>

        {!isWritable && (
          <div style={{ padding: "10px 14px", background: T.surface2, borderRadius: T.rMd,
            fontSize: 13, color: T.inkSoft, display: "flex", gap: 8, alignItems: "center" }}>
            <Icon name="Lock" size={14} />
            {tc({ en: "Read-only — batch is closed", hi: "केवल पढ़ें — बैच बंद है", bn: "শুধু পড়া — ব্যাচ বন্ধ" })}
          </div>
        )}

        {/* P&L Summary */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, marginBottom: 10 }}>
            {tc({ en: "P&L Summary", hi: "लाभ-हानि सारांश", bn: "লাভ-লোকসান সারসংক্ষেপ" })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <SummaryTile
              label={tc({ en: "Net revenue", hi: "शुद्ध आय", bn: "নিট রাজস্ব" })}
              value={`₹${fmt(summary.net_revenue)}`}
              accent="primary" />
            <SummaryTile
              label={tc({ en: "Total costs", hi: "कुल लागत", bn: "মোট খরচ" })}
              value={`₹${fmt(summary.total_costs)}`} />
            <SummaryTile
              label={tc({ en: "Net profit", hi: "शुद्ध लाभ", bn: "নিট লাভ" })}
              value={`₹${fmt(summary.net_profit)}`}
              accent={netProfitColor} />
            <SummaryTile
              label={tc({ en: "Gross revenue", hi: "सकल आय", bn: "গ্রস রাজস্ব" })}
              value={`₹${fmt(summary.gross_revenue)}`}
              small />
          </div>
          {summary.total_deductions > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: T.inkSoft }}>
              {tc({ en: "Deductions", hi: "कटौती", bn: "কর্তন" })}: ₹{fmt(summary.total_deductions)}
            </div>
          )}
        </Card>

        {/* Cost breakdown */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, marginBottom: 10 }}>
            {tc({ en: "Cost breakdown", hi: "लागत विवरण", bn: "খরচের বিবরণ" })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.ink }}>
              <span style={{ color: T.inkSoft }}>
                {tc({ en: "Feed (from ledger)", hi: "चारा (लेजर से)", bn: "খাদ্য (খাতা থেকে)" })}
              </span>
              <span style={{ fontWeight: 600 }}>₹{fmt(summary.feed_cost)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.ink }}>
              <span style={{ color: T.inkSoft }}>
                {tc({ en: "Other costs", hi: "अन्य लागत", bn: "অন্যান্য খরচ" })}
                {summary.cost_count > 0 ? ` (${summary.cost_count})` : ""}
              </span>
              <span style={{ fontWeight: 600 }}>₹{fmt(summary.other_costs)}</span>
            </div>
            <div style={{ height: 1, background: T.lineSoft }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: T.ink }}>
              <span>{tc({ en: "Total", hi: "कुल", bn: "মোট" })}</span>
              <span>₹{fmt(summary.total_costs)}</span>
            </div>
          </div>
          {summary.cost_per_bird_placed != null && (
            <div style={{ marginTop: 8, fontSize: 12, color: T.inkSoft }}>
              {tc({ en: "Cost/bird placed", hi: "प्रति पक्षी लागत", bn: "প্রতি পাখি খরচ" })}: ₹{fmt(summary.cost_per_bird_placed)}
              {summary.cost_per_bird_sold != null && ` · ${tc({ en: "per bird sold", hi: "प्रति बेचा", bn: "প্রতি বিক্রয়" })}: ₹${fmt(summary.cost_per_bird_sold)}`}
            </div>
          )}
        </Card>

        {/* Birds summary */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, marginBottom: 10 }}>
            {tc({ en: "Birds", hi: "पक्षी", bn: "পাখি" })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <SummaryTile label={tc({ en: "Placed", hi: "रखे", bn: "স্থাপিত" })} value={fmtInt(summary.placed_qty)} small />
            <SummaryTile label={tc({ en: "Sold", hi: "बेचे", bn: "বিক্রিত" })} value={fmtInt(summary.birds_sold)} accent="primary" small />
            <SummaryTile label={tc({ en: "Remaining", hi: "शेष", bn: "বাকি" })} value={fmtInt(summary.birds_remaining)} small />
          </div>
          {summary.live_weight_sold_kg > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: T.inkSoft }}>
              {tc({ en: "Live weight sold", hi: "बेचा लाइव वजन", bn: "বিক্রিত লাইভ ওজন" })}: {Number(summary.live_weight_sold_kg).toFixed(2)} kg
              {summary.revenue_per_kg != null && ` · ₹${fmt(summary.revenue_per_kg)}/kg`}
            </div>
          )}
          {summary.sale_count > 1 && (
            <div style={{ marginTop: 4, fontSize: 12, color: T.inkSoft }}>
              {summary.sale_count} {tc({ en: "sale transactions", hi: "बिक्री लेनदेन", bn: "বিক্রয় লেনদেন" })}
            </div>
          )}
        </Card>

        {/* Sales section */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
              {tc({ en: "Sales", hi: "बिक्री", bn: "বিক্রয়" })}
            </span>
            {isWritable && canManage && (
              <button onClick={() => setSaleOpen(true)}
                style={{ background: T.primary, border: "none", borderRadius: T.rMd,
                  padding: "6px 14px", cursor: "pointer", color: "#fff",
                  fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="Plus" size={14} color="#fff" />
                {tc({ en: "Add sale", hi: "बिक्री जोड़ें", bn: "বিক্রয় যোগ করুন" })}
              </button>
            )}
          </div>
          {sales === null
            ? <div style={{ padding: 20, display: "grid", placeItems: "center" }}><Spinner /></div>
            : sales.length === 0
              ? <Card><EmptyState icon="ShoppingCart"
                  title={tc({ en: "No sales yet", hi: "अभी कोई बिक्री नहीं", bn: "এখনো কোনো বিক্রয় নেই" })} /></Card>
              : <Card>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {sales.map((s) => (
                      <SaleRow key={s.id} row={s} tc={tc} canManage={isWritable && canManage}
                        onDelete={(r) => setDelTarget({ type: "sale", id: r.id,
                          label: `${fmtInt(r.birds_sold)} birds · ₹${fmt(r.net_revenue)}` })} />
                    ))}
                  </div>
                </Card>
          }
        </div>

        {/* Costs section */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
              {tc({ en: "Costs", hi: "लागत", bn: "খরচ" })}
            </span>
            {isWritable && canRecord && (
              <button onClick={() => setCostOpen(true)}
                style={{ background: T.orange, border: "none", borderRadius: T.rMd,
                  padding: "6px 14px", cursor: "pointer", color: "#fff",
                  fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="Plus" size={14} color="#fff" />
                {tc({ en: "Add cost", hi: "लागत जोड़ें", bn: "খরচ যোগ করুন" })}
              </button>
            )}
          </div>
          {costs === null
            ? <div style={{ padding: 20, display: "grid", placeItems: "center" }}><Spinner /></div>
            : costs.length === 0
              ? <Card><EmptyState icon="Receipt"
                  title={tc({ en: "No costs recorded", hi: "कोई लागत दर्ज नहीं", bn: "কোনো খরচ রেকর্ড হয়নি" })}
                  body={tc({ en: "Feed costs are automatically included from the feed ledger.", hi: "चारा लागत फ़ीड लेजर से स्वचालित रूप से जुड़ती है।", bn: "খাদ্য খরচ স্বয়ংক্রিয়ভাবে ফিড খাতা থেকে অন্তর্ভুক্ত হয়।" })} /></Card>
              : <Card>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {costs.map((c) => (
                      <CostRow key={c.id} row={c} tc={tc} canManage={isWritable && canManage}
                        onDelete={(r) => setDelTarget({ type: "cost", id: r.id,
                          label: `${r.description} · ₹${fmt(r.amount)}` })} />
                    ))}
                  </div>
                </Card>
          }
        </div>
      </div>

      {/* Sale bottom sheet */}
      <BottomSheet open={saleOpen} onClose={() => setSaleOpen(false)}
        title={tc({ en: "Record Sale", hi: "बिक्री दर्ज करें", bn: "বিক্রয় রেকর্ড করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *" })}
            value={sform.sale_date} onChange={v => setSform(f => ({ ...f, sale_date: v }))} type="date" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label={tc({ en: "Birds sold *", hi: "पक्षी बेचे *", bn: "বিক্রিত পাখি *" })}
              value={sform.birds_sold} onChange={v => setSform(f => ({ ...f, birds_sold: v }))} type="number" />
            <Input label={tc({ en: "Gross amount (₹) *", hi: "सकल राशि (₹) *", bn: "গ্রস পরিমাণ (₹) *" })}
              value={sform.gross_amount} onChange={v => setSform(f => ({ ...f, gross_amount: v }))} type="number" />
          </div>
          <Input label={tc({ en: "Buyer name", hi: "खरीदार का नाम", bn: "ক্রেতার নাম" })}
            value={sform.buyer_name} onChange={v => setSform(f => ({ ...f, buyer_name: v }))} />
          <Input label={tc({ en: "Live weight (kg)", hi: "लाइव वजन (kg)", bn: "লাইভ ওজন (kg)" })}
            value={sform.live_weight_kg} onChange={v => setSform(f => ({ ...f, live_weight_kg: v }))} type="number" />
          <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>
            {tc({ en: "Deductions (optional)", hi: "कटौती (वैकल्पिक)", bn: "কর্তন (ঐচ্ছিক)" })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <Input label={tc({ en: "Transport", hi: "परिवहन", bn: "পরিবহন" })}
              value={sform.transport_deduction} onChange={v => setSform(f => ({ ...f, transport_deduction: v }))} type="number" />
            <Input label={tc({ en: "Commission", hi: "कमीशन", bn: "কমিশন" })}
              value={sform.commission_deduction} onChange={v => setSform(f => ({ ...f, commission_deduction: v }))} type="number" />
            <Input label={tc({ en: "Other", hi: "अन्य", bn: "অন্যান্য" })}
              value={sform.other_deduction} onChange={v => setSform(f => ({ ...f, other_deduction: v }))} type="number" />
          </div>
          {sform.gross_amount && (Number(sform.transport_deduction) + Number(sform.commission_deduction) + Number(sform.other_deduction) > 0) && (
            <div style={{ fontSize: 13, color: T.primary, textAlign: "center", fontWeight: 700 }}>
              {tc({ en: "Net revenue", hi: "शुद्ध आय", bn: "নিট রাজস্ব" })}:{" "}
              ₹{fmt(Number(sform.gross_amount) - Number(sform.transport_deduction || 0) - Number(sform.commission_deduction || 0) - Number(sform.other_deduction || 0))}
            </div>
          )}
          <Input label={tc({ en: "Notes", hi: "नोट", bn: "নোট" })}
            value={sform.notes} onChange={v => setSform(f => ({ ...f, notes: v }))} />
          <Button full onClick={submitSale}
            disabled={!sform.sale_date || !sform.birds_sold || !sform.gross_amount || sbusy}>
            {sbusy ? tc({ en: "Saving…", hi: "सेव हो रहा है…", bn: "সেভ হচ্ছে…" })
                   : tc({ en: "Record sale", hi: "बिक्री दर्ज करें", bn: "বিক্রয় রেকর্ড করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Cost bottom sheet */}
      <BottomSheet open={costOpen} onClose={() => setCostOpen(false)}
        title={tc({ en: "Record Cost", hi: "लागत दर्ज करें", bn: "খরচ রেকর্ড করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *" })}
            value={cform.cost_date} onChange={v => setCform(f => ({ ...f, cost_date: v }))} type="date" />
          <Dropdown
            label={tc({ en: "Category *", hi: "श्रेणी *", bn: "বিভাগ *" })}
            value={cform.category}
            options={costCatOptions}
            onChange={v => setCform(f => ({ ...f, category: v }))} />
          <Input label={tc({ en: "Description *", hi: "विवरण *", bn: "বিবরণ *" })}
            value={cform.description} onChange={v => setCform(f => ({ ...f, description: v }))} />
          <Input label={tc({ en: "Amount (₹) *", hi: "राशि (₹) *", bn: "পরিমাণ (₹) *" })}
            value={cform.amount} onChange={v => setCform(f => ({ ...f, amount: v }))} type="number" />
          <Input label={tc({ en: "Supplier / vendor", hi: "आपूर्तिकर्ता", bn: "সরবরাহকারী" })}
            value={cform.supplier} onChange={v => setCform(f => ({ ...f, supplier: v }))} />
          <Input label={tc({ en: "Notes", hi: "नोट", bn: "নোট" })}
            value={cform.notes} onChange={v => setCform(f => ({ ...f, notes: v }))} />
          <Button full onClick={submitCost}
            disabled={!cform.cost_date || !cform.description.trim() || !cform.amount || cbusy}>
            {cbusy ? tc({ en: "Saving…", hi: "सेव हो रहा है…", bn: "সেভ হচ্ছে…" })
                   : tc({ en: "Record cost", hi: "लागत दर्ज करें", bn: "খরচ রেকর্ড করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Delete confirm */}
      <Dialog
        open={!!delTarget}
        title={tc({ en: "Remove?", hi: "हटाएं?", bn: "সরাবেন?" })}
        body={delTarget?.label || ""}
        onConfirm={confirmDelete}
        onCancel={() => setDelTarget(null)}
        confirmLabel={delBusy ? tc({ en: "Removing…", hi: "हटाया जा रहा है…", bn: "সরানো হচ্ছে…" }) : tc({ en: "Remove", hi: "हटाएं", bn: "সরান" })}
        destructive
      />
    </>
  );
}
