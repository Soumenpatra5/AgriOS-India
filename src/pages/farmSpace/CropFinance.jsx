import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { useApp } from "../../store/AppStore.jsx";
import {
  AppBar, Card, Button, EmptyState, ErrorState, Spinner, BottomSheet
} from "../../components/index.js";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { cropApi, FARM_ERROR } from "../../services/crop/cropApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const COST_CATS = ["seeds","fertilizer","pesticide","irrigation","labour","equipment","transport","other"];

function fmt(n) { return Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

function SummaryRow({ label, value, positive }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0",
      borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 13.5, color: T.inkSoft }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700,
        color: positive === undefined ? T.ink : positive ? "#22c55e" : "#ef4444" }}>
        ₹{fmt(value)}
      </span>
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function CropFinance() {
  const { pop, tc } = useApp();
  const [space, setSpace]       = useState(null);
  const [summary, setSummary]   = useState(null);
  const [sales, setSales]       = useState([]);
  const [costs, setCosts]       = useState([]);
  const [state, setState]       = useState("loading");
  const [reason, setReason]     = useState(null);
  const [tab, setTab]           = useState("summary");
  const [from, setFrom]         = useState(monthStart());
  const [to, setTo]             = useState(today());

  /* Add-sale form */
  const [showSale, setShowSale] = useState(false);
  const [sale, setSale]         = useState({ saleDate: "", crop: "", quantity: "", unit: "kg", unitPrice: "", amount: "", buyer: "", notes: "" });
  const [saleSaving, setSaleSaving] = useState(false);
  const [saleErr, setSaleErr]   = useState(null);

  /* Add-cost form */
  const [showCost, setShowCost] = useState(false);
  const [cost, setCost]         = useState({ costDate: "", category: "other", description: "", amount: "", notes: "" });
  const [costSaving, setCostSaving] = useState(false);
  const [costErr, setCostErr]   = useState(null);

  const load = useCallback(async () => {
    try {
      const sp = await farmSpaceService.active();
      if (!sp) { setState("error"); setReason(FARM_ERROR.NOT_FOUND); return; }
      setSpace(sp);
      const [s, sa, co] = await Promise.all([
        cropApi.financeSummary(sp.id, { fromDate: from, toDate: to }),
        cropApi.listSales(sp.id, { fromDate: from, toDate: to }),
        cropApi.listCosts(sp.id, { fromDate: from, toDate: to }),
      ]);
      setSummary(s);
      setSales(sa);
      setCosts(co);
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const handleAddSale = async () => {
    if (!sale.saleDate) { setSaleErr(tc({ en: "Date required", hi: "तारीख ज़रूरी है", bn: "তারিখ আবশ্যক" })); return; }
    if (!sale.crop.trim()) { setSaleErr(tc({ en: "Crop required", hi: "फसल ज़रूरी है", bn: "ফসল আবশ্যক" })); return; }
    if (!sale.amount || Number(sale.amount) <= 0) { setSaleErr(tc({ en: "Amount > 0 required", hi: "राशि 0 से अधिक होनी चाहिए", bn: "পরিমাণ 0 এর বেশি হতে হবে" })); return; }
    setSaleSaving(true); setSaleErr(null);
    try {
      await cropApi.addSale(space.id, {
        saleDate: sale.saleDate, crop: sale.crop.trim(), amount: Number(sale.amount),
        quantity: sale.quantity ? Number(sale.quantity) : undefined, unit: sale.unit || undefined,
        unitPrice: sale.unitPrice ? Number(sale.unitPrice) : undefined,
        buyer: sale.buyer || undefined, notes: sale.notes || undefined,
        clientUuid: `sale-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setShowSale(false);
      setSale({ saleDate: "", crop: "", quantity: "", unit: "kg", unitPrice: "", amount: "", buyer: "", notes: "" });
      load();
    } catch (err) { setSaleErr(err.message); } finally { setSaleSaving(false); }
  };

  const handleAddCost = async () => {
    if (!cost.costDate) { setCostErr(tc({ en: "Date required", hi: "तारीख ज़रूरी है", bn: "তারিখ আবশ্যক" })); return; }
    if (!cost.description.trim()) { setCostErr(tc({ en: "Description required", hi: "विवरण ज़रूरी है", bn: "বিবরণ আবশ্যক" })); return; }
    if (!cost.amount || Number(cost.amount) <= 0) { setCostErr(tc({ en: "Amount > 0 required", hi: "राशि 0 से अधिक होनी चाहिए", bn: "পরিমাণ 0 এর বেশি হতে হবে" })); return; }
    setCostSaving(true); setCostErr(null);
    try {
      await cropApi.addCost(space.id, {
        costDate: cost.costDate, category: cost.category,
        description: cost.description.trim(), amount: Number(cost.amount),
        notes: cost.notes || undefined,
        clientUuid: `cost-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setShowCost(false);
      setCost({ costDate: "", category: "other", description: "", amount: "", notes: "" });
      load();
    } catch (err) { setCostErr(err.message); } finally { setCostSaving(false); }
  };

  const handleDeleteSale = async (saleId) => {
    if (!window.confirm(tc({ en: "Delete this sale?", hi: "इस बिक्री को हटाएं?", bn: "এই বিক্রয় মুছবেন?" }))) return;
    try { await cropApi.deleteSale(space.id, { saleId }); load(); } catch (err) { alert(err.message); }
  };
  const handleDeleteCost = async (costId) => {
    if (!window.confirm(tc({ en: "Delete this cost?", hi: "इस लागत को हटाएं?", bn: "এই খরচ মুছবেন?" }))) return;
    try { await cropApi.deleteCost(space.id, { costId }); load(); } catch (err) { alert(err.message); }
  };

  const title = tc({ en: "Crop Finance", hi: "फसल वित्त", bn: "ফসল অর্থ" });

  if (state === "loading") return <><AppBar title={title} onBack={pop} />
    <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error") return <><AppBar title={title} onBack={pop} />
    <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Date range selector */}
        <Card>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          {["summary","sales","costs"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                fontFamily: T.body, fontSize: 13, fontWeight: tab === t ? 700 : 400,
                background: tab === t ? T.primary : T.surface2,
                color: tab === t ? "#fff" : T.inkSoft }}>
              {t === "summary" ? tc({ en: "Summary", hi: "सारांश", bn: "সারসংক্ষেপ" })
               : t === "sales" ? tc({ en: "Sales", hi: "बिक्री", bn: "বিক্রয়" })
               : tc({ en: "Costs", hi: "लागत", bn: "খরচ" })}
            </button>
          ))}
        </div>

        {/* Summary tab */}
        {tab === "summary" && summary && (
          <Card>
            <SummaryRow label={tc({ en: "Total revenue", hi: "कुल राजस्व", bn: "মোট রাজস্ব" })} value={summary.total_revenue} positive />
            <SummaryRow label={tc({ en: "Total costs",   hi: "कुल लागत",   bn: "মোট খরচ" })} value={summary.total_costs} />
            <SummaryRow label={tc({ en: "Net profit",    hi: "शुद्ध लाभ",  bn: "নিট মুনাফা" })} value={summary.net_profit}
              positive={summary.net_profit >= 0} />
            {Object.keys(summary.sales_by_crop ?? {}).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 6 }}>
                  {tc({ en: "Revenue by crop", hi: "फसल अनुसार राजस्व", bn: "ফসল অনুসারে রাজস্ব" })}
                </div>
                {Object.entries(summary.sales_by_crop).map(([crop, total]) => (
                  <div key={crop} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0",
                    fontSize: 13, borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ textTransform: "capitalize" }}>{crop}</span>
                    <span style={{ color: "#22c55e", fontWeight: 600 }}>₹{fmt(total)}</span>
                  </div>
                ))}
              </div>
            )}
            {Object.keys(summary.cost_breakdown ?? {}).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 6 }}>
                  {tc({ en: "Cost breakdown", hi: "लागत विवरण", bn: "খরচের বিশ্লেষণ" })}
                </div>
                {Object.entries(summary.cost_breakdown).map(([cat, total]) => (
                  <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0",
                    fontSize: 13, borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ textTransform: "capitalize" }}>{cat}</span>
                    <span style={{ color: "#ef4444", fontWeight: 600 }}>₹{fmt(total)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Sales tab */}
        {tab === "sales" && (
          <>
            <Button size="sm" onClick={() => setShowSale(true)}>
              + {tc({ en: "Add sale", hi: "बिक्री जोड़ें", bn: "বিক্রয় যোগ করুন" })}
            </Button>
            {sales.length === 0
              ? <EmptyState icon="TrendingUp" title={tc({ en: "No sales yet", hi: "अभी कोई बिक्री नहीं", bn: "এখনও কোনও বিক্রয় নেই" })} />
              : sales.map(s => (
                <Card key={s.id} pad={12}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: T.ink, textTransform: "capitalize" }}>
                        {s.crop} {s.quantity ? `· ${s.quantity} ${s.unit ?? ""}` : ""}
                      </div>
                      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                        {s.sale_date}{s.buyer ? ` · ${s.buyer}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#22c55e" }}>₹{fmt(s.amount)}</div>
                      <button onClick={() => handleDeleteSale(s.id)}
                        style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none",
                          cursor: "pointer", fontFamily: T.body, marginTop: 4 }}>
                        {tc({ en: "Delete", hi: "हटाएं", bn: "মুছুন" })}
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
          </>
        )}

        {/* Costs tab */}
        {tab === "costs" && (
          <>
            <Button size="sm" onClick={() => setShowCost(true)}>
              + {tc({ en: "Add cost", hi: "लागत जोड़ें", bn: "খরচ যোগ করুন" })}
            </Button>
            {costs.length === 0
              ? <EmptyState icon="Receipt" title={tc({ en: "No costs yet", hi: "अभी कोई लागत नहीं", bn: "এখনও কোনও খরচ নেই" })} />
              : costs.map(c => (
                <Card key={c.id} pad={12}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: T.ink }}>{c.description}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2, textTransform: "capitalize" }}>
                        {c.cost_date} · {c.category}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#ef4444" }}>₹{fmt(c.amount)}</div>
                      <button onClick={() => handleDeleteCost(c.id)}
                        style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none",
                          cursor: "pointer", fontFamily: T.body, marginTop: 4 }}>
                        {tc({ en: "Delete", hi: "हटाएं", bn: "মুছুন" })}
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
          </>
        )}
      </div>

      {/* Add sale bottom sheet */}
      <BottomSheet open={showSale} onClose={() => setShowSale(false)}
        title={tc({ en: "Add sale", hi: "बिक्री जोड़ें", bn: "বিক্রয় যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
          {[
            { key: "saleDate", label: { en: "Date *",     hi: "तारीख *",  bn: "তারিখ *" }, type: "date" },
            { key: "crop",     label: { en: "Crop *",     hi: "फसल *",    bn: "ফসল *" } },
            { key: "amount",   label: { en: "Amount * (₹)", hi: "राशि * (₹)", bn: "পরিমাণ * (₹)" }, type: "number" },
            { key: "quantity", label: { en: "Quantity",   hi: "मात्रा",   bn: "পরিমাণ" }, type: "number" },
            { key: "unit",     label: { en: "Unit",       hi: "इकाई",     bn: "একক" } },
            { key: "unitPrice",label: { en: "Unit price (₹)", hi: "प्रति इकाई मूल्य (₹)", bn: "প্রতি একক দাম (₹)" }, type: "number" },
            { key: "buyer",    label: { en: "Buyer",      hi: "खरीदार",   bn: "ক্রেতা" } },
            { key: "notes",    label: { en: "Notes",      hi: "नोट्स",    bn: "নোট" } },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: T.inkSoft }}>{tc(label)}</label>
              <input type={type || "text"} value={sale[key]}
                onChange={e => setSale(s => ({ ...s, [key]: e.target.value }))}
                style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                  border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
                  background: T.surface, color: T.ink, boxSizing: "border-box" }} />
            </div>
          ))}
          {saleErr && <div style={{ color: "#ef4444", fontSize: 13 }}>{saleErr}</div>}
          <Button full onClick={handleAddSale} loading={saleSaving}>
            {tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Add cost bottom sheet */}
      <BottomSheet open={showCost} onClose={() => setShowCost(false)}
        title={tc({ en: "Add cost", hi: "लागत जोड़ें", bn: "খরচ যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
          <div>
            <label style={{ fontSize: 12, color: T.inkSoft }}>{tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *" })}</label>
            <input type="date" value={cost.costDate}
              onChange={e => setCost(c => ({ ...c, costDate: e.target.value }))}
              style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
                background: T.surface, color: T.ink, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: T.inkSoft }}>{tc({ en: "Category", hi: "श्रेणी", bn: "বিভাগ" })}</label>
            <select value={cost.category} onChange={e => setCost(c => ({ ...c, category: e.target.value }))}
              style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
                background: T.surface, color: T.ink, boxSizing: "border-box" }}>
              {COST_CATS.map(cat => <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
            </select>
          </div>
          {[
            { key: "description", label: { en: "Description *", hi: "विवरण *", bn: "বিবরণ *" } },
            { key: "amount",      label: { en: "Amount * (₹)",  hi: "राशि * (₹)", bn: "পরিমাণ * (₹)" }, type: "number" },
            { key: "notes",       label: { en: "Notes",          hi: "नोट्स",    bn: "নোট" } },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: T.inkSoft }}>{tc(label)}</label>
              <input type={type || "text"} value={cost[key]}
                onChange={e => setCost(c => ({ ...c, [key]: e.target.value }))}
                style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                  border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
                  background: T.surface, color: T.ink, boxSizing: "border-box" }} />
            </div>
          ))}
          {costErr && <div style={{ color: "#ef4444", fontSize: 13 }}>{costErr}</div>}
          <Button full onClick={handleAddCost} loading={costSaving}>
            {tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
