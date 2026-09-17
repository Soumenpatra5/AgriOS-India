import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, Spinner, BottomSheet,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { fishApi } from "../../services/fish/fishApi.js";

const today = () => new Date().toISOString().slice(0, 10);

const TERMINAL = new Set(["harvested", "inactive"]);

const HEALTH_TYPE_LABEL = {
  observation:     { en: "Observation",     hi: "अवलोकन",     bn: "পর্যবেক্ষণ"   },
  disease:         { en: "Disease",         hi: "रोग",         bn: "রোগ"           },
  treatment:       { en: "Treatment",       hi: "उपचार",       bn: "চিকিৎসা"       },
  water_treatment: { en: "Water treatment", hi: "जल उपचार",   bn: "জল চিকিৎসা"   },
  other:           { en: "Other",           hi: "अन्य",        bn: "অন্যান্য"      },
};

const FEED_TYPE_LABEL = {
  pellet:         { en: "Pellet",         hi: "दाना",       bn: "পেলেট"           },
  rice_bran:      { en: "Rice bran",      hi: "चावल भूसी",  bn: "ধানের কুঁড়া"   },
  mustard_cake:   { en: "Mustard cake",   hi: "सरसों खल्ली",bn: "সরিষার খৈল"     },
  groundnut_cake: { en: "Groundnut cake", hi: "मूंगफली खल्ली",bn: "চিনাবাদামের খৈল" },
  soybean_meal:   { en: "Soybean meal",   hi: "सोयाबीन चारा",bn: "সয়াবিন খাবার"  },
  kitchen_waste:  { en: "Kitchen waste",  hi: "रसोई कचरा",  bn: "রান্নাঘরের বর্জ্য" },
  other:          { en: "Other",          hi: "अन्य",        bn: "অন্যান্য"        },
};

const MORT_REASON_LABEL = {
  disease:          { en: "Disease",          hi: "रोग",           bn: "রোগ"             },
  oxygen_depletion: { en: "O₂ depletion",     hi: "ऑक्सीजन कमी",   bn: "অক্সিজেন হ্রাস" },
  predation:        { en: "Predation",        hi: "शिकार",          bn: "শিকার"           },
  stress:           { en: "Stress",           hi: "तनाव",           bn: "চাপ"             },
  unknown:          { en: "Unknown",          hi: "अज्ञात",          bn: "অজানা"           },
  other:            { en: "Other",            hi: "अन्य",            bn: "অন্যান্য"        },
};

const KIND_ICON = {
  water_quality:    "Droplets",
  feed_record:      "Package",
  health_event:     "HeartPulse",
  mortality_record: "Skull",
  harvest_record:   "Scissors",
};

const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return String(d).slice(0, 10); }
};

const TABS = [
  { id: "overview", label: { en: "Overview", hi: "अवलोकन",  bn: "সংক্ষেপ" } },
  { id: "events",   label: { en: "Events",   hi: "घटनाएँ",  bn: "ঘটনা"    } },
  { id: "history",  label: { en: "History",  hi: "इतिहास",  bn: "ইতিহাস"  } },
];

export default function FishPondDetail({ pondId, spaceId }) {
  const { pop, tc, toast } = useApp();

  const [space,   setSpace]   = useState(null);
  const [pond,    setPond]    = useState(null);
  const [history, setHistory] = useState([]);
  const [water,   setWater]   = useState([]);
  const [feed,    setFeed]    = useState([]);
  const [health,  setHealth]  = useState([]);
  const [mort,    setMort]    = useState([]);
  const [harvest, setHarvest] = useState([]);
  const [tab,     setTab]     = useState("overview");
  const [state,   setState]   = useState("loading");

  // Add water sheet
  const [waterOpen, setWaterOpen] = useState(false);
  const blankWater = () => ({ eventDate: today(), ph: "", dissolvedOxygenPpm: "", temperatureC: "", ammoniaPpm: "", notes: "" });
  const [wform, setWform] = useState(blankWater);
  const [wbusy, setWbusy] = useState(false);

  // Add feed sheet
  const [feedOpen, setFeedOpen] = useState(false);
  const blankFeed = () => ({ feedDate: today(), feedType: "pellet", quantityKg: "", notes: "" });
  const [fform, setFform] = useState(blankFeed);
  const [fbusy, setFbusy] = useState(false);

  // Add health sheet
  const [healthOpen, setHealthOpen] = useState(false);
  const blankHealth = () => ({ eventDate: today(), eventType: "observation", title: "", medicine: "", dose: "", notes: "" });
  const [hform, setHform] = useState(blankHealth);
  const [hbusy, setHbusy] = useState(false);

  // Add mortality sheet
  const [mortOpen, setMortOpen] = useState(false);
  const blankMort = () => ({ eventDate: today(), count: "", reason: "", notes: "" });
  const [mform, setMform] = useState(blankMort);
  const [mbusy, setMbusy] = useState(false);

  // Add harvest sheet
  const [harvestOpen, setHarvestOpen] = useState(false);
  const blankHarvest = () => ({ harvestDate: today(), harvestType: "partial", weightKg: "", count: "", avgWeightG: "", pricePerKg: "", notes: "" });
  const [hvform, setHvform] = useState(blankHarvest);
  const [hvbusy, setHvbusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      setSpace(active);
      const [p, hist, w, f, h, m, hv] = await Promise.all([
        fishApi.getPond(spaceId || active.id, pondId),
        fishApi.pondHistory(spaceId || active.id, { pondId }),
        fishApi.listWater(spaceId || active.id, { pondId }),
        fishApi.listFeed(spaceId || active.id, { pondId }),
        fishApi.listHealth(spaceId || active.id, { pondId }),
        fishApi.listMortality(spaceId || active.id, { pondId }),
        fishApi.listHarvest(spaceId || active.id, { pondId }),
      ]);
      setPond(p);
      setHistory(hist?.history || []);
      setWater(w || []);
      setFeed(f || []);
      setHealth(h || []);
      setMort(m || []);
      setHarvest(hv || []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [pondId, spaceId]);

  useEffect(() => { load(); }, [load]);

  const sid = spaceId || space?.id;
  const isTerminal = pond ? TERMINAL.has(pond.current_status) : false;
  const canRecord  = space && farmSpaceService.can(space, "farm.fish.record");

  /* ── add water ──────────────────────────────────────────────────────────── */
  const addWater = async () => {
    setWbusy(true);
    try {
      const rec = await fishApi.addWater(sid, {
        pondId, eventDate: wform.eventDate,
        ph: wform.ph ? parseFloat(wform.ph) : null,
        dissolvedOxygenPpm: wform.dissolvedOxygenPpm ? parseFloat(wform.dissolvedOxygenPpm) : null,
        temperatureC: wform.temperatureC ? parseFloat(wform.temperatureC) : null,
        ammoniaPpm: wform.ammoniaPpm ? parseFloat(wform.ammoniaPpm) : null,
        notes: wform.notes || null,
      });
      setWater((prev) => [rec, ...prev]);
      setWaterOpen(false); setWform(blankWater());
      toast(tc({ en: "Water check saved", hi: "जल जाँच सहेजी", bn: "জল পরীক্ষা সংরক্ষিত" }), "success");
    } catch (err) {
      toast(err.message, "error");
    } finally { setWbusy(false); }
  };

  /* ── add feed ───────────────────────────────────────────────────────────── */
  const addFeed = async () => {
    setFbusy(true);
    try {
      const rec = await fishApi.addFeed(sid, {
        pondId, feedDate: fform.feedDate, feedType: fform.feedType,
        quantityKg: fform.quantityKg ? parseFloat(fform.quantityKg) : null,
        notes: fform.notes || null,
      });
      setFeed((prev) => [rec, ...prev]);
      setFeedOpen(false); setFform(blankFeed());
      toast(tc({ en: "Feed recorded", hi: "चारा दर्ज", bn: "খাবার নথিভুক্ত" }), "success");
    } catch (err) {
      toast(err.message, "error");
    } finally { setFbusy(false); }
  };

  /* ── add health ─────────────────────────────────────────────────────────── */
  const addHealth = async () => {
    if (!hform.title.trim()) return;
    setHbusy(true);
    try {
      const rec = await fishApi.addHealth(sid, {
        pondId, eventDate: hform.eventDate, eventType: hform.eventType,
        title: hform.title.trim(),
        medicine: hform.medicine || null, dose: hform.dose || null,
        notes: hform.notes || null,
      });
      setHealth((prev) => [rec, ...prev]);
      setHealthOpen(false); setHform(blankHealth());
      toast(tc({ en: "Health event saved", hi: "स्वास्थ्य घटना सहेजी", bn: "স্বাস্থ্য ঘটনা সংরক্ষিত" }), "success");
    } catch (err) {
      toast(err.message, "error");
    } finally { setHbusy(false); }
  };

  /* ── add mortality ──────────────────────────────────────────────────────── */
  const addMort = async () => {
    if (!mform.count || parseInt(mform.count, 10) <= 0) return;
    setMbusy(true);
    try {
      const rec = await fishApi.addMortality(sid, {
        pondId, eventDate: mform.eventDate,
        count: parseInt(mform.count, 10),
        reason: mform.reason || null,
        notes: mform.notes || null,
      });
      setMort((prev) => [rec, ...prev]);
      setMortOpen(false); setMform(blankMort());
      toast(tc({ en: "Mortality recorded", hi: "मृत्यु दर्ज", bn: "মৃত্যু নথিভুক্ত" }), "success");
    } catch (err) {
      toast(err.message, "error");
    } finally { setMbusy(false); }
  };

  /* ── add harvest ────────────────────────────────────────────────────────── */
  const addHarvest = async () => {
    setHvbusy(true);
    try {
      const rec = await fishApi.addHarvest(sid, {
        pondId, harvestDate: hvform.harvestDate, harvestType: hvform.harvestType,
        weightKg: hvform.weightKg ? parseFloat(hvform.weightKg) : null,
        count: hvform.count ? parseInt(hvform.count, 10) : null,
        avgWeightG: hvform.avgWeightG ? parseFloat(hvform.avgWeightG) : null,
        pricePerKg: hvform.pricePerKg ? parseFloat(hvform.pricePerKg) : null,
        notes: hvform.notes || null,
      });
      setHarvest((prev) => [rec, ...prev]);
      setHarvestOpen(false); setHvform(blankHarvest());
      toast(tc({ en: "Harvest recorded", hi: "कटाई दर्ज", bn: "ফসল নথিভুক্ত" }), "success");
    } catch (err) {
      toast(err.message, "error");
    } finally { setHvbusy(false); }
  };

  const bar = (
    <AppBar
      title={pond?.name || tc({ en: "Pond Detail", hi: "तालाब विवरण", bn: "পুকুর বিবরণ" })}
      onBack={pop}
    />
  );

  if (state === "loading") return <>{bar}<div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error" || !pond) return <>{bar}<div style={{ padding: 20, textAlign: "center", color: T.inkSoft, fontFamily: T.body }}>
    {tc({ en: "Pond not found", hi: "तालाब नहीं मिला", bn: "পুকুর পাওয়া যায়নি" })}
  </div></>;

  return (
    <>
      {bar}

      {/* Terminal banner */}
      {isTerminal && (
        <div style={{ margin: "8px 16px 0", background: T.surface2, borderRadius: T.rMd,
          padding: "8px 12px", display: "flex", gap: 8, alignItems: "center" }}>
          <Icon name="Lock" size={14} color={T.inkSoft} />
          <span style={{ fontSize: 12.5, color: T.inkSoft, fontFamily: T.body }}>
            {tc({ en: `Pond is ${pond.current_status} — no new records can be added.`,
                  hi: `तालाब ${pond.current_status === "harvested" ? "काटा गया" : "निष्क्रिय"} है — नया रिकॉर्ड नहीं जोड़ा जा सकता।`,
                  bn: `পুকুর ${pond.current_status === "harvested" ? "কাটা হয়েছে" : "নিষ্ক্রিয়"} — কোনো নতুন রেকর্ড যোগ করা যাবে না।` })}
          </span>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, padding: "10px 16px 0", borderBottom: `1px solid ${T.line}`, marginBottom: 0 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: "8px 0", fontFamily: T.body, fontSize: 13,
              fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? T.primary : T.inkSoft,
              background: "none", border: "none", borderBottom: tab === t.id ? `2px solid ${T.primary}` : "2px solid transparent",
              cursor: "pointer" }}>
            {tc(t.label)}
          </button>
        ))}
      </div>

      {/* ── Overview tab ────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div style={{ padding: "14px 16px 32px", display: "flex", flexDirection: "column", gap: 10 }}>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: tc({ en: "Pond type",     hi: "तालाब प्रकार",    bn: "পুকুরের ধরন" }), value: pond.pond_type   },
                { label: tc({ en: "Culture",       hi: "संवर्धन",         bn: "চাষ"          }), value: pond.culture_type },
                { label: tc({ en: "Status",        hi: "स्थिति",          bn: "অবস্থা"        }), value: pond.current_status },
                { label: tc({ en: "Species",       hi: "प्रजाति",         bn: "প্রজাতি"       }), value: pond.species || "—" },
                { label: tc({ en: "Area",          hi: "क्षेत्रफल",       bn: "ক্ষেত্রফল"     }), value: pond.area_sqm ? `${pond.area_sqm} m²` : "—" },
                { label: tc({ en: "Depth",         hi: "गहराई",           bn: "গভীরতা"        }), value: pond.depth_m ? `${pond.depth_m} m` : "—" },
                { label: tc({ en: "Stocked on",    hi: "स्टॉकिंग तिथि",   bn: "মজুদের তারিখ"  }), value: pond.stocking_date ? fmtDate(pond.stocking_date) : "—" },
                { label: tc({ en: "Stocked count", hi: "मछली संख्या",     bn: "মাছের সংখ্যা"  }), value: pond.stocking_count ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: T.surface2, borderRadius: T.rSm, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: T.inkFaint, fontFamily: T.body, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: T.body }}>{value}</div>
                </div>
              ))}
            </div>
          </Card>

          {pond.last_water_quality && (
            <Card>
              <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: T.body, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
                {tc({ en: "Latest water check", hi: "अंतिम जल जाँच", bn: "সর্বশেষ জল পরীক্ষা" })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[
                  { label: "pH", value: pond.last_water_quality.ph ?? "—" },
                  { label: tc({ en: "DO (ppm)", hi: "DO (ppm)", bn: "DO (ppm)" }), value: pond.last_water_quality.dissolved_oxygen_ppm ?? "—" },
                  { label: tc({ en: "Temp (°C)", hi: "तापमान (°C)", bn: "তাপমাত্রা (°C)" }), value: pond.last_water_quality.temperature_c ?? "—" },
                  { label: tc({ en: "NH₃ (ppm)", hi: "NH₃ (ppm)", bn: "NH₃ (ppm)" }), value: pond.last_water_quality.ammonia_ppm ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: T.blueSoft, borderRadius: T.rSm, padding: "6px 8px" }}>
                    <div style={{ fontSize: 10, color: T.blue, fontFamily: T.body }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.blue, fontFamily: T.display }}>{String(value)}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 6, fontFamily: T.body }}>
                {fmtDate(pond.last_water_quality.event_date)}
              </div>
            </Card>
          )}

          {pond.notes && (
            <Card>
              <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>{pond.notes}</div>
            </Card>
          )}
        </div>
      )}

      {/* ── Events tab ──────────────────────────────────────────────────────── */}
      {tab === "events" && (
        <div style={{ padding: "14px 16px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Water quality */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase",
                letterSpacing: 0.6, fontFamily: T.body }}>
                {tc({ en: "Water quality", hi: "जल गुणवत्ता", bn: "জলের গুণমান" })}
              </span>
              {canRecord && !isTerminal && (
                <button onClick={() => setWaterOpen(true)}
                  style={{ background: "none", border: "none", color: T.primary, fontSize: 12.5,
                    fontWeight: 600, cursor: "pointer", fontFamily: T.body }}>+ {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}</button>
              )}
            </div>
            {water.length === 0 ? (
              <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>
                {tc({ en: "No water checks yet", hi: "अभी कोई जल जाँच नहीं", bn: "এখনো কোনো জল পরীক্ষা নেই" })}
              </div>
            ) : water.map((r) => (
              <Card key={r.id} pad={10}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, fontFamily: T.body }}>
                    {tc({ en: "Water check", hi: "जल जाँच", bn: "জল পরীক্ষা" })} · {fmtDate(r.event_date)}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4, fontFamily: T.body }}>
                  {r.ph != null    ? `pH ${r.ph}` : ""}
                  {r.dissolved_oxygen_ppm != null ? ` · DO ${r.dissolved_oxygen_ppm}` : ""}
                  {r.temperature_c != null ? ` · ${r.temperature_c}°C` : ""}
                  {r.ammonia_ppm != null ? ` · NH₃ ${r.ammonia_ppm}` : ""}
                </div>
                {r.notes && <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 2, fontFamily: T.body }}>{r.notes}</div>}
              </Card>
            ))}
          </section>

          {/* Feed */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase",
                letterSpacing: 0.6, fontFamily: T.body }}>
                {tc({ en: "Feed", hi: "चारा", bn: "খাবার" })}
              </span>
              {canRecord && !isTerminal && (
                <button onClick={() => setFeedOpen(true)}
                  style={{ background: "none", border: "none", color: T.primary, fontSize: 12.5,
                    fontWeight: 600, cursor: "pointer", fontFamily: T.body }}>+ {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}</button>
              )}
            </div>
            {feed.length === 0 ? (
              <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>
                {tc({ en: "No feed records", hi: "कोई चारा रिकॉर्ड नहीं", bn: "কোনো খাবারের রেকর্ড নেই" })}
              </div>
            ) : feed.map((r) => (
              <Card key={r.id} pad={10}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, fontFamily: T.body }}>
                    {tc(FEED_TYPE_LABEL[r.feed_type] || { en: r.feed_type, hi: r.feed_type, bn: r.feed_type })}
                  </span>
                  <span style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>{fmtDate(r.feed_date)}</span>
                </div>
                {r.quantity_kg != null && (
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2, fontFamily: T.body }}>
                    {r.quantity_kg} kg
                  </div>
                )}
              </Card>
            ))}
          </section>

          {/* Health events */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase",
                letterSpacing: 0.6, fontFamily: T.body }}>
                {tc({ en: "Health events", hi: "स्वास्थ्य घटनाएँ", bn: "স্বাস্থ্য ঘটনা" })}
              </span>
              {canRecord && !isTerminal && (
                <button onClick={() => setHealthOpen(true)}
                  style={{ background: "none", border: "none", color: T.primary, fontSize: 12.5,
                    fontWeight: 600, cursor: "pointer", fontFamily: T.body }}>+ {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}</button>
              )}
            </div>
            {health.length === 0 ? (
              <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>
                {tc({ en: "No health events", hi: "कोई स्वास्थ्य घटना नहीं", bn: "কোনো স্বাস্থ্য ঘটনা নেই" })}
              </div>
            ) : health.map((r) => (
              <Card key={r.id} pad={10}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, fontFamily: T.body }}>{r.title}</span>
                  <span style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>{fmtDate(r.event_date)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2, fontFamily: T.body }}>
                  {tc(HEALTH_TYPE_LABEL[r.event_type] || { en: r.event_type, hi: r.event_type, bn: r.event_type })}
                  {r.medicine ? ` · ${r.medicine}` : ""}
                  {r.dose ? ` (${r.dose})` : ""}
                </div>
              </Card>
            ))}
          </section>

          {/* Mortality */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase",
                letterSpacing: 0.6, fontFamily: T.body }}>
                {tc({ en: "Mortality", hi: "मृत्यु", bn: "মৃত্যু" })}
              </span>
              {canRecord && !isTerminal && (
                <button onClick={() => setMortOpen(true)}
                  style={{ background: "none", border: "none", color: T.primary, fontSize: 12.5,
                    fontWeight: 600, cursor: "pointer", fontFamily: T.body }}>+ {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}</button>
              )}
            </div>
            {mort.length === 0 ? (
              <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>
                {tc({ en: "No mortality records", hi: "कोई मृत्यु रिकॉर्ड नहीं", bn: "কোনো মৃত্যুর রেকর্ড নেই" })}
              </div>
            ) : mort.map((r) => (
              <Card key={r.id} pad={10}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.red, fontFamily: T.body }}>
                    {r.count} {tc({ en: "fish died", hi: "मछली मरी", bn: "মাছ মৃত" })}
                  </span>
                  <span style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>{fmtDate(r.event_date)}</span>
                </div>
                {r.reason && (
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2, fontFamily: T.body }}>
                    {tc(MORT_REASON_LABEL[r.reason] || { en: r.reason, hi: r.reason, bn: r.reason })}
                  </div>
                )}
              </Card>
            ))}
          </section>

          {/* Harvest */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase",
                letterSpacing: 0.6, fontFamily: T.body }}>
                {tc({ en: "Harvests", hi: "कटाई", bn: "ফসল" })}
              </span>
              {canRecord && !isTerminal && (
                <button onClick={() => setHarvestOpen(true)}
                  style={{ background: "none", border: "none", color: T.primary, fontSize: 12.5,
                    fontWeight: 600, cursor: "pointer", fontFamily: T.body }}>+ {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}</button>
              )}
            </div>
            {harvest.length === 0 ? (
              <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>
                {tc({ en: "No harvest records", hi: "कोई कटाई रिकॉर्ड नहीं", bn: "কোনো ফসলের রেকর্ড নেই" })}
              </div>
            ) : harvest.map((r) => (
              <Card key={r.id} pad={10}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.primary, fontFamily: T.body }}>
                    {r.harvest_type === "full"
                      ? tc({ en: "Full harvest", hi: "पूर्ण कटाई", bn: "সম্পূর্ণ ফসল" })
                      : tc({ en: "Partial harvest", hi: "आंशिक कटाई", bn: "আংশিক ফসল" })}
                  </span>
                  <span style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>{fmtDate(r.harvest_date)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2, fontFamily: T.body }}>
                  {r.weight_kg != null ? `${r.weight_kg} kg` : ""}
                  {r.count != null ? ` · ${r.count} fish` : ""}
                  {r.price_per_kg != null ? ` · ₹${r.price_per_kg}/kg` : ""}
                </div>
              </Card>
            ))}
          </section>
        </div>
      )}

      {/* ── History tab ─────────────────────────────────────────────────────── */}
      {tab === "history" && (
        <div style={{ padding: "14px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
          {history.length === 0 ? (
            <EmptyState icon="Fish" title={tc({ en: "No history yet", hi: "अभी कोई इतिहास नहीं", bn: "এখনো কোনো ইতিহাস নেই" })} />
          ) : history.map((h, i) => {
            const icon = KIND_ICON[h.kind] || "Circle";
            return (
              <Card key={h.id || i} pad={10}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: T.surface2,
                    flexShrink: 0, display: "grid", placeItems: "center" }}>
                    <Icon name={icon} size={14} color={T.inkSoft} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, fontFamily: T.body }}>
                      {h.kind === "water_quality"    && tc({ en: "Water quality check", hi: "जल गुणवत्ता जाँच", bn: "জলের গুণমান পরীক্ষা" })}
                      {h.kind === "feed_record"      && `${tc({ en: "Feed", hi: "चारा", bn: "খাবার" })}: ${tc(FEED_TYPE_LABEL[h.feed_type] || { en: h.feed_type, hi: h.feed_type, bn: h.feed_type })} ${h.quantity_kg != null ? `(${h.quantity_kg} kg)` : ""}`}
                      {h.kind === "health_event"     && `${h.title}`}
                      {h.kind === "mortality_record" && `${h.count} ${tc({ en: "fish died", hi: "मछली मरी", bn: "মাছ মৃত" })}`}
                      {h.kind === "harvest_record"   && `${tc({ en: "Harvest", hi: "कटाई", bn: "ফসল" })}: ${h.harvest_type} ${h.weight_kg != null ? `(${h.weight_kg} kg)` : ""}`}
                    </div>
                    <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 2, fontFamily: T.body }}>
                      {fmtDate(h.event_date)}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Add water sheet ─────────────────────────────────────────────────── */}
      <BottomSheet open={waterOpen} onClose={() => setWaterOpen(false)}
        title={tc({ en: "Record water check", hi: "जल जाँच दर्ज करें", bn: "জল পরীক্ষা নথিভুক্ত করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तिथि", bn: "তারিখ" })} type="date" value={wform.eventDate}
            onChange={(v) => setWform((f) => ({ ...f, eventDate: v }))} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><Input label="pH" type="number" placeholder="7.0–8.5" value={wform.ph}
              onChange={(v) => setWform((f) => ({ ...f, ph: v }))} /></div>
            <div style={{ flex: 1 }}><Input label="DO (ppm)" type="number" placeholder="≥5" value={wform.dissolvedOxygenPpm}
              onChange={(v) => setWform((f) => ({ ...f, dissolvedOxygenPpm: v }))} /></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><Input label={tc({ en: "Temp (°C)", hi: "तापमान", bn: "তাপমাত্রা" })} type="number" value={wform.temperatureC}
              onChange={(v) => setWform((f) => ({ ...f, temperatureC: v }))} /></div>
            <div style={{ flex: 1 }}><Input label="NH₃ (ppm)" type="number" placeholder="<0.05" value={wform.ammoniaPpm}
              onChange={(v) => setWform((f) => ({ ...f, ammoniaPpm: v }))} /></div>
          </div>
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })} value={wform.notes}
            onChange={(v) => setWform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addWater} disabled={wbusy}>
            {wbusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save water check", hi: "जल जाँच सहेजें", bn: "জল পরীক্ষা সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* ── Add feed sheet ───────────────────────────────────────────────────── */}
      <BottomSheet open={feedOpen} onClose={() => setFeedOpen(false)}
        title={tc({ en: "Record feeding", hi: "चारा दर्ज करें", bn: "খাবার নথিভুক্ত করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तिथि", bn: "তারিখ" })} type="date" value={fform.feedDate}
            onChange={(v) => setFform((f) => ({ ...f, feedDate: v }))} />
          <Dropdown label={tc({ en: "Feed type", hi: "चारा प्रकार", bn: "খাবারের ধরন" })} value={fform.feedType}
            onChange={(v) => setFform((f) => ({ ...f, feedType: v }))}
            options={Object.entries(FEED_TYPE_LABEL).map(([value, label]) => ({ value, label: tc(label) }))} />
          <Input label={tc({ en: "Quantity (kg)", hi: "मात्रा (kg)", bn: "পরিমাণ (kg)" })} type="number" value={fform.quantityKg}
            onChange={(v) => setFform((f) => ({ ...f, quantityKg: v }))} />
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })} value={fform.notes}
            onChange={(v) => setFform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addFeed} disabled={fbusy}>
            {fbusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Record feed", hi: "चारा दर्ज करें", bn: "খাবার নথিভুক্ত করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* ── Add health sheet ─────────────────────────────────────────────────── */}
      <BottomSheet open={healthOpen} onClose={() => setHealthOpen(false)}
        title={tc({ en: "Add health event", hi: "स्वास्थ्य घटना जोड़ें", bn: "স্বাস্থ্য ঘটনা যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तिथि", bn: "তারিখ" })} type="date" value={hform.eventDate}
            onChange={(v) => setHform((f) => ({ ...f, eventDate: v }))} />
          <Dropdown label={tc({ en: "Event type", hi: "घटना प्रकार", bn: "ঘটনার ধরন" })} value={hform.eventType}
            onChange={(v) => setHform((f) => ({ ...f, eventType: v }))}
            options={Object.entries(HEALTH_TYPE_LABEL).map(([value, label]) => ({ value, label: tc(label) }))} />
          <Input label={tc({ en: "Title", hi: "शीर्षक", bn: "শিরোনাম" })}
            placeholder={tc({ en: "e.g. Observed white spots on fins", hi: "उदा. पंखों पर सफेद धब्बे", bn: "যেমন পাখনায় সাদা দাগ দেখা গেছে" })}
            value={hform.title} onChange={(v) => setHform((f) => ({ ...f, title: v }))} />
          <Input label={tc({ en: "Medicine (optional)", hi: "दवा (वैकल्पिक)", bn: "ওষুধ (ঐচ্ছিক)" })} value={hform.medicine}
            onChange={(v) => setHform((f) => ({ ...f, medicine: v }))} />
          <Input label={tc({ en: "Dose (optional)", hi: "खुराक (वैकल्पिक)", bn: "মাত্রা (ঐচ্ছিক)" })} value={hform.dose}
            onChange={(v) => setHform((f) => ({ ...f, dose: v }))} />
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })} value={hform.notes}
            onChange={(v) => setHform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addHealth} disabled={!hform.title.trim() || hbusy}>
            {hbusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save event", hi: "घटना सहेजें", bn: "ঘটনা সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* ── Add mortality sheet ──────────────────────────────────────────────── */}
      <BottomSheet open={mortOpen} onClose={() => setMortOpen(false)}
        title={tc({ en: "Record mortality", hi: "मृत्यु दर्ज करें", bn: "মৃত্যু নথিভুক্ত করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तिथि", bn: "তারিখ" })} type="date" value={mform.eventDate}
            onChange={(v) => setMform((f) => ({ ...f, eventDate: v }))} />
          <Input label={tc({ en: "Count", hi: "संख्या", bn: "সংখ্যা" })} type="number" placeholder="e.g. 5" value={mform.count}
            onChange={(v) => setMform((f) => ({ ...f, count: v }))} />
          <Dropdown label={tc({ en: "Reason (optional)", hi: "कारण (वैकल्पिक)", bn: "কারণ (ঐচ্ছিক)" })} value={mform.reason}
            onChange={(v) => setMform((f) => ({ ...f, reason: v }))}
            options={[
              { value: "", label: tc({ en: "Unknown / unspecified", hi: "अज्ञात / अनिर्दिष्ट", bn: "অজানা / অনির্দিষ্ট" }) },
              ...Object.entries(MORT_REASON_LABEL).map(([value, label]) => ({ value, label: tc(label) })),
            ]} />
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })} value={mform.notes}
            onChange={(v) => setMform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addMort} disabled={!mform.count || mbusy}>
            {mbusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Record mortality", hi: "मृत्यु दर्ज करें", bn: "মৃত্যু নথিভুক্ত করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* ── Add harvest sheet ────────────────────────────────────────────────── */}
      <BottomSheet open={harvestOpen} onClose={() => setHarvestOpen(false)}
        title={tc({ en: "Record harvest", hi: "कटाई दर्ज करें", bn: "ফসল নথিভুক্ত করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तिथि", bn: "তারিখ" })} type="date" value={hvform.harvestDate}
            onChange={(v) => setHvform((f) => ({ ...f, harvestDate: v }))} />
          <Dropdown label={tc({ en: "Harvest type", hi: "कटाई प्रकार", bn: "ফসলের ধরন" })} value={hvform.harvestType}
            onChange={(v) => setHvform((f) => ({ ...f, harvestType: v }))}
            options={[
              { value: "partial", label: tc({ en: "Partial harvest", hi: "आंशिक कटाई", bn: "আংশিক ফসল" }) },
              { value: "full",    label: tc({ en: "Full harvest",    hi: "पूर्ण कटाई", bn: "সম্পূর্ণ ফসল" }) },
            ]} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Input label={tc({ en: "Weight (kg)", hi: "वजन (kg)", bn: "ওজন (kg)" })} type="number" value={hvform.weightKg}
                onChange={(v) => setHvform((f) => ({ ...f, weightKg: v }))} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label={tc({ en: "Count", hi: "संख्या", bn: "সংখ্যা" })} type="number" value={hvform.count}
                onChange={(v) => setHvform((f) => ({ ...f, count: v }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Input label={tc({ en: "Avg wt (g)", hi: "औसत वजन (g)", bn: "গড় ওজন (g)" })} type="number" value={hvform.avgWeightG}
                onChange={(v) => setHvform((f) => ({ ...f, avgWeightG: v }))} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label={tc({ en: "Price/kg (₹)", hi: "कीमत/kg (₹)", bn: "মূল্য/kg (₹)" })} type="number" value={hvform.pricePerKg}
                onChange={(v) => setHvform((f) => ({ ...f, pricePerKg: v }))} />
            </div>
          </div>
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })} value={hvform.notes}
            onChange={(v) => setHvform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addHarvest} disabled={hvbusy}>
            {hvbusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Record harvest", hi: "कटाई दर्ज करें", bn: "ফসল নথিভুক্ত করুন" })}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
