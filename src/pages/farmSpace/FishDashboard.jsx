import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { fishApi } from "../../services/fish/fishApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const today = () => new Date().toISOString().slice(0, 10);

const POND_TYPE_CFG = {
  earthen:  { label: { en: "Earthen",  hi: "मिट्टी",   bn: "মাটি"    }, fg: "#7a5a1a", bg: "#f8f0d8" },
  cement:   { label: { en: "Cement",   hi: "सीमेंट",   bn: "সিমেন্ট" }, fg: T.inkSoft, bg: T.surface2 },
  tank:     { label: { en: "Tank",     hi: "टंकी",     bn: "ট্যাংক"  }, fg: T.blue,   bg: T.blueSoft },
  cage:     { label: { en: "Cage",     hi: "पिंजरा",   bn: "খাঁচা"   }, fg: T.primary, bg: T.primarySoft },
  other:    { label: { en: "Other",    hi: "अन्य",     bn: "অন্যান্য" }, fg: T.inkSoft, bg: T.surface2 },
};

function MetricTile({ value, label, icon, accent }) {
  const fg = accent === "primary" ? T.primary : accent === "blue" ? T.blue : T.orange;
  const bg = accent === "primary" ? T.primarySoft : accent === "blue" ? T.blueSoft : "#fff3e8";
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, background: bg, borderRadius: T.rMd, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon name={icon} size={14} color={fg} />
        <span style={{ fontSize: 10.5, color: fg, fontWeight: 600, fontFamily: T.body }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: fg, fontFamily: T.display, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function PondCard({ pond, tc, onPress }) {
  const cfg = POND_TYPE_CFG[pond.pond_type] || POND_TYPE_CFG.other;
  const status = pond.current_status;
  const isTerminal = status === "harvested" || status === "inactive";

  return (
    <Card pad={0}>
      <button
        onClick={onPress}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "13px 14px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left", fontFamily: T.body }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: cfg.bg, display: "grid", placeItems: "center" }}>
          <Icon name="Fish" size={20} color={cfg.fg} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: isTerminal ? T.inkSoft : T.ink }}>
              {pond.name}
            </span>
            <span style={{
              fontSize: 10.5, fontWeight: 700, fontFamily: T.body,
              color: cfg.fg, background: cfg.bg,
              borderRadius: 5, padding: "2px 7px", letterSpacing: 0.3,
            }}>
              {tc(cfg.label)}
            </span>
            {isTerminal && (
              <span style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, background: T.surface2,
                borderRadius: 5, padding: "1px 6px" }}>
                {tc({ en: status, hi: status === "harvested" ? "काटा गया" : "निष्क्रिय", bn: status === "harvested" ? "কাটা হয়েছে" : "নিষ্ক্রিয়" })}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
            {pond.species || tc({ en: "Species not set", hi: "प्रजाति नहीं", bn: "প্রজাতি নেই" })}
            {pond.area_sqm ? ` · ${pond.area_sqm} m²` : ""}
            {pond.total_mortality > 0 ? ` · ${pond.total_mortality} ${tc({ en: "died", hi: "मृत", bn: "মৃত" })}` : ""}
          </div>
          {pond.last_water_check && (
            <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 1 }}>
              {tc({ en: "Last water check:", hi: "अंतिम जल जाँच:", bn: "শেষ জল পরীক্ষা:" })} {pond.last_water_check}
            </div>
          )}
        </div>
        <Icon name="ChevronRight" size={16} color={T.line} />
      </button>
    </Card>
  );
}

export default function FishDashboard() {
  const { pop, push, tc, toast } = useApp();

  const [space,   setSpace]   = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [ponds,   setPonds]   = useState([]);
  const [filter,  setFilter]  = useState("active");
  const [state,   setState]   = useState("loading");
  const [reason,  setReason]  = useState(null);

  const [finSummary, setFinSummary] = useState(null);
  const [finState,   setFinState]   = useState("idle");

  const [addOpen, setAddOpen] = useState(false);
  const blankForm = () => ({
    name: "", pondType: "earthen", cultureType: "polyculture",
    species: "", areaSqm: "", depthM: "",
    stockingDate: today(), stockingCount: "", stockingSizeCm: "", notes: "",
  });
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const [m, list] = await Promise.all([
        fishApi.pondMetrics(active.id),
        fishApi.listPonds(active.id, { includeTerminal: true }),
      ]);
      setMetrics(m);
      setPonds(list || []);
      setState("ready");
      if (farmSpaceService.can(active, "farm.fish.finance")) {
        setFinState("loading");
        fishApi.financeSummary(active.id)
          .then((d) => { setFinSummary(d); setFinState("ready"); })
          .catch(() => setFinState("error"));
      }
    } catch (err) {
      if (state !== "ready") { setReason(err?.reason || FARM_ERROR.FAILED); setState("error"); }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const canManage  = space && farmSpaceService.can(space, "farm.fish.manage");
  const canFinance = space && farmSpaceService.can(space, "farm.fish.finance");

  const filtered = filter === "active"
    ? ponds.filter((p) => p.current_status === "active")
    : ponds;

  const addPond = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const pond = await fishApi.createPond(space.id, {
        name: form.name.trim(),
        pondType: form.pondType,
        cultureType: form.cultureType,
        species: form.species || null,
        areaSqm: form.areaSqm ? parseFloat(form.areaSqm) : null,
        depthM: form.depthM ? parseFloat(form.depthM) : null,
        stockingDate: form.stockingDate || null,
        stockingCount: form.stockingCount ? parseInt(form.stockingCount, 10) : null,
        stockingSizeCm: form.stockingSizeCm ? parseFloat(form.stockingSizeCm) : null,
        notes: form.notes || null,
      });
      setPonds((prev) => [pond, ...prev]);
      setAddOpen(false);
      setForm(blankForm());
      toast(tc({ en: "Pond added", hi: "तालाब जोड़ा गया", bn: "পুকুর যোগ হয়েছে" }), "success");
      fishApi.pondMetrics(space.id).then(setMetrics).catch(() => {});
    } catch (err) {
      toast(err.message || tc({ en: "Failed to add pond", hi: "तालाब नहीं जोड़ा", bn: "পুকুর যোগ করা যায়নি" }), "error");
    } finally {
      setBusy(false);
    }
  };

  const bar = (
    <AppBar
      title={tc({ en: "Fish & Aquaculture", hi: "मत्स्य पालन", bn: "মৎস্য পালন" })}
      onBack={pop}
      action={canManage && (
        <button
          onClick={() => setAddOpen(true)}
          style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" />
          {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
        </button>
      )}
    />
  );

  if (state === "loading") return <>{bar}<div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error")   return <>{bar}<div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;

  return (
    <>
      {bar}

      {/* Metrics strip */}
      {metrics && (
        <div style={{ display: "flex", gap: 8, padding: "10px 16px 0" }}>
          <MetricTile
            value={metrics.total_ponds}
            label={tc({ en: "Active ponds", hi: "सक्रिय तालाब", bn: "সক্রিয় পুকুর" })}
            icon="Fish" accent="primary" />
          <MetricTile
            value={`${Number(metrics.month_feed_kg).toFixed(0)} kg`}
            label={tc({ en: "Feed this month", hi: "इस माह चारा", bn: "এ মাসে খাবার" })}
            icon="Package" accent="blue" />
          <MetricTile
            value={metrics.harvest_due_count}
            label={tc({ en: "Harvest due", hi: "कटाई देय", bn: "ফসল দেয়" })}
            icon="Scissors" accent="orange" />
        </div>
      )}

      {/* Water check overdue alert */}
      {metrics?.water_check_overdue > 0 && (
        <div style={{ margin: "8px 16px 0", background: T.redSoft, borderRadius: T.rMd,
          padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="Droplets" size={15} color={T.red} />
          <span style={{ fontSize: 12.5, color: T.red, fontWeight: 600, fontFamily: T.body }}>
            {tc({
              en: `${metrics.water_check_overdue} pond${metrics.water_check_overdue > 1 ? "s" : ""} without a water check in 7+ days`,
              hi: `${metrics.water_check_overdue} तालाब में 7+ दिन से जल जाँच नहीं`,
              bn: `${metrics.water_check_overdue}টি পুকুরে ৭+ দিন জল পরীক্ষা হয়নি`,
            })}
          </span>
        </div>
      )}

      {/* Finance summary card */}
      {canFinance && (
        <div style={{ margin: "10px 16px 0" }}>
          <button
            onClick={() => push({ kind: "fishFinance" })}
            style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`,
              borderRadius: T.rMd, padding: "12px 14px", cursor: "pointer",
              textAlign: "left", display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, fontFamily: T.body,
                textTransform: "uppercase", letterSpacing: 0.8 }}>
                {tc({ en: "Finance · this month", hi: "वित्त · इस माह", bn: "অর্থ · এই মাস" })}
              </span>
              <Icon name="ChevronRight" size={15} color={T.inkFaint} />
            </div>
            {finState === "loading" && <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}><Spinner size={16} /></div>}
            {finState === "error"   && <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>{tc({ en: "Finance unavailable", hi: "वित्त उपलब्ध नहीं", bn: "অর্থ পাওয়া যাচ্ছে না" })}</div>}
            {finState === "ready" && finSummary && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: tc({ en: "Revenue", hi: "आय",        bn: "রাজস্ব"  }), value: `₹${Number(finSummary.total_revenue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: T.primary },
                  { label: tc({ en: "Costs",   hi: "लागत",      bn: "খরচ"     }), value: `₹${Number(finSummary.total_costs).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,   color: T.orange  },
                  { label: tc({ en: "Net P&L", hi: "शुद्ध लाभ", bn: "নিট লাভ" }), value: `₹${Number(finSummary.net_profit).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,   color: finSummary.net_profit >= 0 ? T.primary : T.red },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: T.surface2, borderRadius: T.rSm, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: T.inkFaint, fontWeight: 600, fontFamily: T.body, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: T.display }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </button>
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px", overflowX: "auto" }}>
        <Chip active={filter === "active"} onClick={() => setFilter("active")}>
          {tc({ en: "Active", hi: "सक्रिय", bn: "সক্রিয়" })}
        </Chip>
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          {tc({ en: "All ponds", hi: "सभी तालाब", bn: "সব পুকুর" })}
        </Chip>
      </div>

      {/* Pond list */}
      <div style={{ padding: "6px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="Fish"
            title={tc({ en: "No ponds", hi: "कोई तालाब नहीं", bn: "কোনো পুকুর নেই" })}
            body={canManage
              ? tc({ en: "Tap + Add to register your first pond.", hi: "पहला तालाब जोड़ने के लिए + जोड़ें दबाएँ।", bn: "প্রথম পুকুর যোগ করতে + যোগ চাপুন।" })
              : tc({ en: "No ponds yet.", hi: "अभी कोई तालाब नहीं।", bn: "এখনো কোনো পুকুর নেই।" })}
          />
        ) : (
          filtered.map((pond) => (
            <PondCard key={pond.id} pond={pond} tc={tc} onPress={() =>
              push({ kind: "fishPondDetail", props: { pondId: pond.id, spaceId: space.id } })
            } />
          ))
        )}
      </div>

      {/* Add pond sheet */}
      <BottomSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={tc({ en: "Add Pond", hi: "तालाब जोड़ें", bn: "পুকুর যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            label={tc({ en: "Pond name / ID", hi: "तालाब का नाम / आईडी", bn: "পুকুরের নাম / আইডি" })}
            placeholder={tc({ en: "e.g. North Pond 1", hi: "उदा. उत्तर तालाब 1", bn: "যেমন উত্তর পুকুর ১" })}
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Dropdown
            label={tc({ en: "Pond type", hi: "तालाब प्रकार", bn: "পুকুরের ধরন" })}
            value={form.pondType}
            onChange={(v) => setForm((f) => ({ ...f, pondType: v }))}
            options={[
              { value: "earthen", label: tc({ en: "Earthen",          hi: "मिट्टी",   bn: "মাটি"    }) },
              { value: "cement",  label: tc({ en: "Cement / lined",   hi: "सीमेंट",   bn: "সিমেন্ট" }) },
              { value: "tank",    label: tc({ en: "Tank / RCC",       hi: "टंकी",     bn: "ট্যাংক"  }) },
              { value: "cage",    label: tc({ en: "Cage / net pen",   hi: "पिंजरा",   bn: "খাঁচা"   }) },
              { value: "other",   label: tc({ en: "Other",            hi: "अन्य",     bn: "অন্যান্য" }) },
            ]} />
          <Dropdown
            label={tc({ en: "Culture type", hi: "संवर्धन प्रकार", bn: "চাষের ধরন" })}
            value={form.cultureType}
            onChange={(v) => setForm((f) => ({ ...f, cultureType: v }))}
            options={[
              { value: "polyculture",  label: tc({ en: "Polyculture",  hi: "पॉलीकल्चर",  bn: "পলিকালচার"  }) },
              { value: "monoculture",  label: tc({ en: "Monoculture",  hi: "मोनोकल्चर",  bn: "মনোকালচার"  }) },
              { value: "composite",    label: tc({ en: "Composite",    hi: "कम्पोजिट",   bn: "কম্পোজিট"   }) },
            ]} />
          <Input
            label={tc({ en: "Species (optional)", hi: "प्रजाति (वैकल्पिक)", bn: "প্রজাতি (ঐচ্ছিক)" })}
            placeholder={tc({ en: "e.g. Rohu + Catla + Mrigal", hi: "उदा. रोहू + कतला + मृगल", bn: "যেমন রুই + কাতলা + মৃগেল" })}
            value={form.species}
            onChange={(v) => setForm((f) => ({ ...f, species: v }))} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Input
                label={tc({ en: "Area (m²)", hi: "क्षेत्रफल (m²)", bn: "ক্ষেত্রফল (m²)" })}
                type="number" placeholder="e.g. 2000"
                value={form.areaSqm}
                onChange={(v) => setForm((f) => ({ ...f, areaSqm: v }))} />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label={tc({ en: "Depth (m)", hi: "गहराई (m)", bn: "গভীরতা (m)" })}
                type="number" placeholder="e.g. 1.5"
                value={form.depthM}
                onChange={(v) => setForm((f) => ({ ...f, depthM: v }))} />
            </div>
          </div>
          <Input
            label={tc({ en: "Stocking date", hi: "स्टॉकिंग तिथि", bn: "মজুদের তারিখ" })}
            type="date"
            value={form.stockingDate}
            onChange={(v) => setForm((f) => ({ ...f, stockingDate: v }))} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Input
                label={tc({ en: "Stocking count", hi: "मछली की संख्या", bn: "মাছের সংখ্যা" })}
                type="number" placeholder="e.g. 1000"
                value={form.stockingCount}
                onChange={(v) => setForm((f) => ({ ...f, stockingCount: v }))} />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label={tc({ en: "Fingerling size (cm)", hi: "अंगुलिका आकार (cm)", bn: "পোনার আকার (cm)" })}
                type="number" placeholder="e.g. 8.5"
                value={form.stockingSizeCm}
                onChange={(v) => setForm((f) => ({ ...f, stockingSizeCm: v }))} />
            </div>
          </div>
          <Input
            label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            placeholder={tc({ en: "Any notes about this pond", hi: "इस तालाब के बारे में टिप्पणी", bn: "এই পুকুর সম্পর্কে মন্তব্য" })}
            value={form.notes}
            onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addPond} disabled={!form.name.trim() || busy}>
            {busy
              ? tc({ en: "Adding…", hi: "जोड़ा जा रहा है…", bn: "যোগ হচ্ছে…" })
              : tc({ en: "Add Pond", hi: "तालाब जोड़ें", bn: "পুকুর যোগ করুন" })}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
