import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { dairyApi } from "../../services/dairy/dairyApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const today = () => new Date().toISOString().slice(0, 10);


/* Status colour tokens — dairy animals have ongoing lifecycle statuses. */
const STATUS_CFG = {
  heifer:   { label: { en: "Heifer",   hi: "बछिया",   bn: "হেফার"   }, fg: T.inkSoft,   bg: T.surface2 },
  milking:  { label: { en: "Milking",  hi: "दुधारू",   bn: "দুগ্ধবতী" }, fg: T.primary,   bg: T.primarySoft },
  dry:      { label: { en: "Dry",      hi: "शुष्क",    bn: "শুষ্ক"   }, fg: T.blue,      bg: T.blueSoft },
  sold:     { label: { en: "Sold",     hi: "बेचा",     bn: "বিক্রিত" }, fg: "#6b6b6b",   bg: "#f0f0f0" },
  deceased: { label: { en: "Deceased", hi: "मृत",      bn: "মৃত"     }, fg: "#6b6b6b",   bg: "#f0f0f0" },
  retired:  { label: { en: "Retired",  hi: "सेवानिवृत्त", bn: "অবসরপ্রাপ্ত" }, fg: "#6b6b6b", bg: "#f0f0f0" },
};

const FILTER_TABS = [
  { id: "",         label: { en: "All",     hi: "सभी",   bn: "সব"     } },
  { id: "milking",  label: { en: "Milking", hi: "दुधारू", bn: "দুগ্ধবতী" } },
  { id: "dry",      label: { en: "Dry",     hi: "शुष्क",  bn: "শুষ্ক"  } },
  { id: "heifer",   label: { en: "Heifer",  hi: "बछिया",  bn: "হেফার"  } },
];

const BREEDS = [
  { value: "HF / Holstein",  label: { en: "HF / Holstein",  hi: "एचएफ / होल्स्टीन", bn: "এইচএফ / হোলস্টেইন" } },
  { value: "Jersey",         label: { en: "Jersey",         hi: "जर्सी",            bn: "জার্সি"            } },
  { value: "Sahiwal",        label: { en: "Sahiwal",        hi: "साहीवाल",          bn: "সাহিওয়াল"         } },
  { value: "Gir",            label: { en: "Gir",            hi: "गिर",              bn: "গির"               } },
  { value: "Murrah Buffalo", label: { en: "Murrah Buffalo", hi: "मुर्रा भैंस",       bn: "মুররা মহিষ"        } },
  { value: "Surti Buffalo",  label: { en: "Surti Buffalo",  hi: "सुरती भैंस",        bn: "সুরতি মহিষ"        } },
  { value: "Mixed",          label: { en: "Mixed",          hi: "मिश्रित",          bn: "মিশ্র"             } },
  { value: "Other",          label: { en: "Other",          hi: "अन्य",             bn: "অন্যান্য"          } },
];

function StatusChip({ status, tc }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.heifer;
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, fontFamily: T.body,
      color: cfg.fg, background: cfg.bg,
      borderRadius: 5, padding: "2px 7px", letterSpacing: 0.3,
    }}>
      {tc(cfg.label)}
    </span>
  );
}

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

export default function DairyDashboard() {
  const { pop, push, tc, toast } = useApp();

  const [space, setSpace]     = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [animals, setAnimals] = useState([]);
  const [filter, setFilter]   = useState("");
  const [state, setState]     = useState("loading");
  const [reason, setReason]   = useState(null);

  /* Finance summary — non-blocking, only for users with farm.dairy.finance */
  const [finSummary, setFinSummary] = useState(null);
  const [finState,   setFinState]   = useState("idle");

  /* 30-day milk history — non-blocking, shown to all farm.dairy.view users */
  const [milkHistory, setMilkHistory] = useState(null);

  /* Add animal sheet */
  const [addOpen, setAddOpen]   = useState(false);
  const [aform, setAform] = useState({
    name: "", species: "cow", breed: "", tagId: "", dob: "",
    acquisitionDate: today(), acquisitionSource: "", currentStatus: "heifer", notes: "",
  });
  const [abusy, setAbusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const [m, list] = await Promise.all([
        dairyApi.herdMetrics(active.id),
        dairyApi.listAnimals(active.id, { includeTerminal: false }),
      ]);
      setMetrics(m);
      setAnimals(list || []);
      setState("ready");
      /* Non-blocking finance fetch — failure never breaks the dashboard. */
      if (farmSpaceService.can(active, "farm.dairy.finance")) {
        setFinState("loading");
        dairyApi.financeSummary(active.id)
          .then((d) => { setFinSummary(d); setFinState("ready"); })
          .catch(() => setFinState("error"));
      }
      /* Non-blocking 30-day milk history for production chart (all dairy.view users). */
      {
        const d = new Date();
        d.setDate(d.getDate() - 29);
        const fromDate = d.toISOString().slice(0, 10);
        const toDate   = new Date().toISOString().slice(0, 10);
        dairyApi.listMilk(active.id, { fromDate, toDate, limit: 300 })
          .then(records => setMilkHistory(records || []))
          .catch(() => setMilkHistory([]));
      }
    } catch (err) {
      if (state !== "ready") { setReason(err?.reason || FARM_ERROR.FAILED); setState("error"); }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const canManage  = space && farmSpaceService.can(space, "farm.dairy.manage");
  const canRecord  = space && farmSpaceService.can(space, "farm.dairy.record");
  const canFinance = space && farmSpaceService.can(space, "farm.dairy.finance");

  const filtered = filter
    ? animals.filter((a) => a.current_status === filter)
    : animals;

  const addAnimal = async () => {
    if (!aform.name.trim()) return;
    setAbusy(true);
    try {
      const animal = await dairyApi.createAnimal(space.id, {
        name: aform.name.trim(),
        species: aform.species,
        breed: aform.breed || null,
        tagId: aform.tagId || null,
        dob: aform.dob || null,
        acquisitionDate: aform.acquisitionDate || null,
        acquisitionSource: aform.acquisitionSource || null,
        currentStatus: aform.currentStatus,
        notes: aform.notes || null,
      });
      setAnimals((prev) => [animal, ...prev]);
      setAddOpen(false);
      setAform({ name: "", species: "cow", breed: "", tagId: "", dob: "",
        acquisitionDate: today(), acquisitionSource: "", currentStatus: "heifer", notes: "" });
      toast(tc({ en: "Animal added", hi: "पशु जोड़ा गया", bn: "প্রাণী যোগ হয়েছে" }), "success");
      /* Refresh metrics */
      dairyApi.herdMetrics(space.id).then(setMetrics).catch(() => {});
    } catch (err) {
      toast(err.message || tc({ en: "Failed to add animal", hi: "पशु नहीं जोड़ा जा सका", bn: "প্রাণী যোগ করা যায়নি" }), "error");
    } finally {
      setAbusy(false);
    }
  };

  const bar = (
    <AppBar
      title={tc({ en: "Dairy Herd", hi: "डेयरी पशु", bn: "ডেয়ারি পাল" })}
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
            value={Object.values(metrics.status_counts || {}).reduce((s, n) => s + n, 0)}
            label={tc({ en: "Animals", hi: "पशु", bn: "প্রাণী" })}
            icon="Milk" accent="primary" />
          <MetricTile
            value={metrics.today_milk_kg != null ? `${Number(metrics.today_milk_kg).toFixed(1)} kg` : "—"}
            label={tc({ en: "Today milk", hi: "आज दूध", bn: "আজ দুধ" })}
            icon="Droplets" accent="blue" />
          <MetricTile
            value={metrics.month_milk_kg != null ? `${Number(metrics.month_milk_kg).toFixed(0)} kg` : "—"}
            label={tc({ en: "This month", hi: "इस माह", bn: "এ মাসে" })}
            icon="TrendingUp" accent="orange" />
        </div>
      )}

      {/* Health overdue alert */}
      {metrics?.health_overdue_count > 0 && (
        <div style={{ margin: "8px 16px 0", background: T.redSoft, borderRadius: T.rMd,
          padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="AlertTriangle" size={15} color={T.red} />
          <span style={{ fontSize: 12.5, color: T.red, fontWeight: 600, fontFamily: T.body }}>
            {tc({
              en: `${metrics.health_overdue_count} health event${metrics.health_overdue_count > 1 ? "s" : ""} overdue`,
              hi: `${metrics.health_overdue_count} स्वास्थ्य घटना अतिदेय`,
              bn: `${metrics.health_overdue_count}টি স্বাস্থ্য ঘটনার মেয়াদ পেরিয়েছে`,
            })}
          </span>
        </div>
      )}

      {/* Health due alert */}
      {metrics?.health_due_in_14_days > 0 && (
        <div style={{ margin: "8px 16px 0", background: "#fff3e8", borderRadius: T.rMd,
          padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="Bell" size={15} color={T.orange} />
          <span style={{ fontSize: 12.5, color: T.orange, fontWeight: 600, fontFamily: T.body }}>
            {tc({
              en: `${metrics.health_due_in_14_days} health event${metrics.health_due_in_14_days > 1 ? "s" : ""} due in 14 days`,
              hi: `14 दिन में ${metrics.health_due_in_14_days} स्वास्थ्य घटना देय`,
              bn: `14 দিনে ${metrics.health_due_in_14_days}টি স্বাস্থ্য ঘটনা দেয়`,
            })}
          </span>
        </div>
      )}

      {/* 30-day milk production chart — visible to all dairy.view users; Record button for canRecord */}
      {milkHistory !== null && (
        <MilkProductionCard
          milkHistory={milkHistory}
          canRecord={canRecord}
          tc={tc}
          onRecord={() => push({ kind: "dairyMilkEntry", props: { spaceId: space.id } })}
        />
      )}

      {/* Finance summary card — visible to farm.dairy.finance only */}
      {canFinance && (
        <div style={{ margin: "10px 16px 0" }}>
          <button
            onClick={() => push({ kind: "dairyFinance" })}
            style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`,
              borderRadius: T.rMd, padding: "12px 14px", cursor: "pointer",
              textAlign: "left", display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, fontFamily: T.body,
                textTransform: "uppercase", letterSpacing: 0.8 }}>
                {tc({ en: "Finance · this month", hi: "वित्त · इस माह", bn: "অর্থ · এই মাস" })}
              </span>
              <Icon name="ChevronRight" size={15} color={T.inkFaint} />
            </div>
            {finState === "loading" && (
              <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
                <Spinner size={16} />
              </div>
            )}
            {finState === "error" && (
              <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>
                {tc({ en: "Finance unavailable", hi: "वित्त उपलब्ध नहीं", bn: "অর্থ পাওয়া যাচ্ছে না" })}
              </div>
            )}
            {finState === "ready" && finSummary && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: tc({ en: "Revenue", hi: "आय", bn: "রাজস্ব" }),
                    value: `₹${Number(finSummary.total_revenue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
                    color: T.primary },
                  { label: tc({ en: "Costs", hi: "लागत", bn: "খরচ" }),
                    value: `₹${Number(finSummary.total_costs).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
                    color: T.orange },
                  { label: tc({ en: "Net P&L", hi: "शुद्ध लाभ", bn: "নিট লাভ" }),
                    value: `₹${Number(finSummary.net_profit).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
                    color: finSummary.net_profit >= 0 ? T.primary : T.red },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: T.surface2, borderRadius: T.rSm, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: T.inkFaint, fontWeight: 600,
                      fontFamily: T.body, marginBottom: 3 }}>{label}</div>
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
        {FILTER_TABS.map((ft) => (
          <Chip key={ft.id} active={filter === ft.id} onClick={() => setFilter(ft.id)}>
            {tc(ft.label)}
          </Chip>
        ))}
      </div>

      {/* Animal list */}
      <div style={{ padding: "6px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="Milk"
            title={tc({ en: "No animals", hi: "कोई पशु नहीं", bn: "কোনো প্রাণী নেই" })}
            body={canManage
              ? tc({ en: "Tap + Add to register your first cow or buffalo.", hi: "पहली गाय या भैंस जोड़ने के लिए + जोड़ें दबाएँ।", bn: "প্রথম গরু বা মহিষ নিবন্ধন করতে + যোগ চাপুন।" })
              : tc({ en: "The herd is empty.", hi: "झुंड खाली है।", bn: "পাল খালি।" })}
          />
        ) : (
          filtered.map((animal) => (
            <AnimalCard key={animal.id} animal={animal} tc={tc} onPress={() =>
              push({ kind: "dairyAnimalDetail", props: { animalId: animal.id, spaceId: space.id } })
            } />
          ))
        )}
      </div>


      {/* Add animal sheet */}
      <BottomSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={tc({ en: "Add Animal", hi: "पशु जोड़ें", bn: "প্রাণী যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            label={tc({ en: "Name / ID", hi: "नाम / आईडी", bn: "নাম / আইডি" })}
            placeholder={tc({ en: "e.g. Lakshmi", hi: "उदा. लक्ष्मी", bn: "যেমন লক্ষ্মী" })}
            value={aform.name}
            onChange={(v) => setAform((f) => ({ ...f, name: v }))} />
          <Dropdown
            label={tc({ en: "Species", hi: "प्रजाति", bn: "প্রজাতি" })}
            value={aform.species}
            onChange={(v) => setAform((f) => ({ ...f, species: v }))}
            options={[
              { value: "cow",     label: tc({ en: "Cow",     hi: "गाय",  bn: "গরু"   }) },
              { value: "buffalo", label: tc({ en: "Buffalo", hi: "भैंस", bn: "মহিষ" }) },
            ]} />
          <Dropdown
            label={tc({ en: "Breed (optional)", hi: "नस्ल (वैकल्पिक)", bn: "জাত (ঐচ্ছিক)" })}
            value={aform.breed}
            onChange={(v) => setAform((f) => ({ ...f, breed: v }))}
            options={[
              { value: "", label: tc({ en: "Unknown / Mixed", hi: "अज्ञात / मिश्रित", bn: "অজানা / মিশ্র" }) },
              ...BREEDS.map((b) => ({ value: b.value, label: tc(b.label) })),
            ]} />
          <Input
            label={tc({ en: "Tag / Ear number (optional)", hi: "टैग / कान नंबर (वैकल्पिक)", bn: "ট্যাগ / কান নম্বর (ঐচ্ছিক)" })}
            placeholder={tc({ en: "e.g. 042", hi: "उदा. 042", bn: "যেমন 042" })}
            value={aform.tagId}
            onChange={(v) => setAform((f) => ({ ...f, tagId: v }))} />
          <Dropdown
            label={tc({ en: "Current status", hi: "वर्तमान स्थिति", bn: "বর্তমান অবস্থা" })}
            value={aform.currentStatus}
            onChange={(v) => setAform((f) => ({ ...f, currentStatus: v }))}
            options={[
              { value: "heifer",  label: tc({ en: "Heifer",  hi: "बछिया",  bn: "হেফার"   }) },
              { value: "milking", label: tc({ en: "Milking", hi: "दुधारू",  bn: "দুগ্ধবতী" }) },
              { value: "dry",     label: tc({ en: "Dry",     hi: "शुष्क",   bn: "শুষ্ক"   }) },
            ]} />
          <Input
            label={tc({ en: "Date of birth (optional)", hi: "जन्म तिथि (वैकल्पिक)", bn: "জন্ম তারিখ (ঐচ্ছিক)" })}
            type="date"
            value={aform.dob}
            onChange={(v) => setAform((f) => ({ ...f, dob: v }))} />
          <Input
            label={tc({ en: "Acquisition date", hi: "प्राप्ति तिथि", bn: "অধিগ্রহণের তারিখ" })}
            type="date"
            value={aform.acquisitionDate}
            onChange={(v) => setAform((f) => ({ ...f, acquisitionDate: v }))} />
          <Input
            label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            placeholder={tc({ en: "Any notes about this animal", hi: "इस पशु के बारे में टिप्पणी", bn: "এই প্রাণী সম্পর্কে মন্তব্য" })}
            value={aform.notes}
            onChange={(v) => setAform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addAnimal} disabled={!aform.name.trim() || abusy}>
            {abusy
              ? tc({ en: "Adding…", hi: "जोड़ा जा रहा है…", bn: "যোগ হচ্ছে…" })
              : tc({ en: "Add Animal", hi: "पशु जोड़ें", bn: "প্রাণী যোগ করুন" })}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

/* ── 30-day milk production chart ──────────────────────────────────────── */

function MilkProductionCard({ milkHistory, canRecord, tc, onRecord }) {
  const todayISO = new Date().toISOString().slice(0, 10);

  /* Build ordered 30-day array (oldest → newest). */
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  /* Aggregate: sum am + pm per record_date. */
  const byDate = {};
  for (const r of milkHistory) {
    const key = (r.record_date || "").slice(0, 10);
    byDate[key] = (byDate[key] || 0) + (Number(r.am_yield_kg) || 0) + (Number(r.pm_yield_kg) || 0);
  }

  const values  = days.map(d => byDate[d] || 0);
  const maxVal  = Math.max(...values, 1);
  const hasData = values.some(v => v > 0);
  const todayKg = byDate[todayISO] || 0;

  /* SVG bar chart constants. */
  const VW = 300; const VH = 56;
  const slotW = VW / 30;
  const barW  = Math.max(slotW - 1.5, 1);

  return (
    <div style={{ margin: "10px 16px 0", background: T.surface,
      border: `1px solid ${T.line}`, borderRadius: T.rMd, padding: "12px 14px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint,
            fontFamily: T.body, textTransform: "uppercase", letterSpacing: 0.8 }}>
            {tc({ en: "Production · 30 days", hi: "उत्पादन · 30 दिन", bn: "উৎপাদন · ৩০ দিন" })}
          </span>
          {todayKg > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: T.primary, fontFamily: T.body }}>
              {todayKg.toFixed(1)} kg {tc({ en: "today", hi: "आज", bn: "আজ" })}
            </span>
          )}
        </div>
        {canRecord && (
          <button onClick={onRecord}
            style={{ background: T.primarySoft, color: T.primary, border: "none",
              borderRadius: T.rSm, padding: "5px 12px", fontSize: 12, fontWeight: 700,
              fontFamily: T.body, cursor: "pointer" }}>
            {tc({ en: "Record", hi: "दर्ज करें", bn: "লিখুন" })}
          </button>
        )}
      </div>

      {/* Chart or empty state */}
      {hasData ? (
        <div>
          <svg viewBox={`0 0 ${VW} ${VH}`}
            style={{ width: "100%", height: VH, display: "block", overflow: "visible" }}
            aria-label={tc({ en: "30-day milk production chart", hi: "30 दिन दूध उत्पादन चार्ट", bn: "৩০ দিনের দুধ উৎপাদন চার্ট" })}>
            {values.map((v, i) => {
              const barH   = Math.max((v / maxVal) * (VH - 4), v > 0 ? 3 : 0);
              const x      = i * slotW;
              const isLast = i === 29;
              return (
                <rect key={i}
                  x={x + (slotW - barW) / 2} y={VH - barH}
                  width={barW} height={barH}
                  fill={isLast ? T.primary : T.primarySoft}
                  rx={1.5} />
              );
            })}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between",
            marginTop: 4, padding: "0 1px" }}>
            <span style={{ fontSize: 9.5, color: T.inkFaint, fontFamily: T.body }}>
              {days[0].slice(5).replace("-", "/")}
            </span>
            <span style={{ fontSize: 9.5, color: T.inkFaint, fontFamily: T.body }}>
              {tc({ en: "kg/day", hi: "कि.ग्रा./दिन", bn: "কেজি/দিন" })}
            </span>
            <span style={{ fontSize: 9.5, color: T.inkFaint, fontFamily: T.body }}>
              {tc({ en: "today", hi: "आज", bn: "আজ" })}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8,
          padding: "4px 0", color: T.inkSoft }}>
          <Icon name="Droplets" size={14} color={T.inkSoft} />
          <span style={{ fontSize: 12, fontFamily: T.body }}>
            {tc({ en: "No milk records in the last 30 days",
                  hi: "पिछले 30 दिनों में कोई दूध रिकॉर्ड नहीं",
                  bn: "গত ৩০ দিনে কোনো দুধের রেকর্ড নেই" })}
          </span>
        </div>
      )}
    </div>
  );
}

function AnimalCard({ animal, tc, onPress }) {
  const cfg = STATUS_CFG[animal.current_status] || STATUS_CFG.heifer;
  const speciesLabel = animal.species === "buffalo"
    ? tc({ en: "Buffalo", hi: "भैंस", bn: "মহিষ" })
    : tc({ en: "Cow", hi: "गाय", bn: "গরু" });

  return (
    <Card pad={0}>
      <button
        onClick={onPress}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px",
          background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: T.body }}>
        {/* Avatar */}
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: cfg.bg, display: "grid", placeItems: "center" }}>
          <Icon name="Milk" size={20} color={cfg.fg} />
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>{animal.name}</span>
            <StatusChip status={animal.current_status} tc={tc} />
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
            {speciesLabel}
            {animal.breed ? ` · ${animal.breed}` : ""}
            {animal.tag_id ? ` · #${animal.tag_id}` : ""}
          </div>
        </div>
        <Icon name="ChevronRight" size={16} color={T.line} />
      </button>
    </Card>
  );
}

