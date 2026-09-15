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

const BATCH_STATUS = {
  draft:          { a: "faint",   label: { en: "Draft",        hi: "ड्राफ़्ट",      bn: "ড্রাফ্ট" } },
  active:         { a: "primary", label: { en: "Active",       hi: "सक्रिय",       bn: "সক্রিয়" } },
  harvesting:     { a: "orange",  label: { en: "Harvesting",   hi: "कटाई",         bn: "কর্তন" } },
  partially_sold: { a: "orange",  label: { en: "Partial sale", hi: "आंशिक बिक्री", bn: "আংশিক বিক্রয়" } },
  completed:      { a: "blue",    label: { en: "Completed",    hi: "पूर्ण",         bn: "সম্পন্ন" } },
  closed:         { a: "faint",   label: { en: "Closed",       hi: "बंद",           bn: "বন্ধ" } },
  archived:       { a: "faint",   label: { en: "Archived",     hi: "संग्रहित",      bn: "আর্কাইভড" } },
};

const TRANSITION_LABEL = {
  activate:         { en: "Activate",       hi: "सक्रिय करें",    bn: "সক্রিয় করুন" },
  start_harvesting: { en: "Start harvest",  hi: "कटाई शुरू",      bn: "কর্তন শুরু" },
  partially_sold:   { en: "Partial sale",   hi: "आंशिक बिक्री",   bn: "আংশিক বিক্রয়" },
  complete:         { en: "Mark complete",  hi: "पूरा चिह्नित",   bn: "সম্পন্ন করুন" },
  close:            { en: "Close batch",    hi: "बैच बंद करें",   bn: "ব্যাচ বন্ধ" },
  reopen:           { en: "Reopen",         hi: "फिर खोलें",      bn: "পুনরায় খুলুন" },
  archive:          { en: "Archive",        hi: "संग्रहित करें",  bn: "আর্কাইভ করুন" },
};

const TABS = ["daily", "weights", "feed", "health"];
const TAB_LABEL = {
  daily:   { en: "Daily",   hi: "दैनिक",  bn: "দৈনিক" },
  weights: { en: "Weights", hi: "वजन",    bn: "ওজন" },
  feed:    { en: "Feed",    hi: "चारा",   bn: "খাদ্য" },
  health:  { en: "Health",  hi: "स्वास्थ्य", bn: "স্বাস্থ্য" },
};

const HEALTH_TYPE_OPTIONS = (tc) => [
  { label: tc({ en: "Observation", hi: "अवलोकन",    bn: "পর্যবেক্ষণ" }), value: "observation" },
  { label: tc({ en: "Treatment",   hi: "उपचार",      bn: "চিকিৎসা" }),   value: "treatment" },
  { label: tc({ en: "Vet visit",   hi: "पशु चिकित्सक", bn: "পশু চিকিৎসক" }), value: "vet_visit" },
  { label: tc({ en: "Outbreak",    hi: "प्रकोप",     bn: "প্রাদুর্ভাব" }), value: "outbreak" },
];

const ROUTE_OPTIONS = (tc) => [
  { label: tc({ en: "Drinking water", hi: "पीने का पानी", bn: "পানীয় জল" }), value: "drinking_water" },
  { label: tc({ en: "Spray",          hi: "स्प्रे",       bn: "স্প্রে" }),     value: "spray" },
  { label: tc({ en: "Eye drop",       hi: "आई ड्रॉप",    bn: "চোখের ড্রপ" }), value: "eye_drop" },
  { label: tc({ en: "Injection",      hi: "इंजेक्शन",    bn: "ইনজেকশন" }),    value: "injection" },
];

const KIND_OPTIONS = (tc) => [
  { label: tc({ en: "Received (in)", hi: "प्राप्त", bn: "প্রাপ্ত" }), value: "in" },
  { label: tc({ en: "Adjustment",   hi: "समायोजन", bn: "সমন্বয়" }), value: "adjustment" },
];

export default function PoultryBatchDetail({ batchId }) {
  const { pop, tc, toast } = useApp();
  const [space, setSpace]     = useState(null);
  const [batch, setBatch]     = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [state, setState]     = useState("loading");
  const [reason, setReason]   = useState(null);

  /* Tab state */
  const [tab, setTab] = useState("daily");

  /* Tab data */
  const [daily, setDaily]             = useState(null);
  const [weights, setWeights]         = useState(null);
  const [feed, setFeed]               = useState(null);
  const [health, setHealth]           = useState(null);
  const [vaccinations, setVaccinations] = useState(null);
  const [tabLoading, setTabLoading]   = useState(false);

  /* Transition */
  const [transitioning, setTransitioning] = useState(false);

  /* Daily sheet */
  const [dailyOpen, setDailyOpen]   = useState(false);
  const [dform, setDform] = useState({ record_date: today(), mortality: "", culls: "", note: "" });
  const [dbusy, setDbusy] = useState(false);

  /* Weight sheet */
  const [weightOpen, setWeightOpen] = useState(false);
  const [wform, setWform] = useState({ weighed_at: today(), total_weight_g: "", sample_count: "" });
  const [wbusy, setWbusy] = useState(false);

  /* Feed sheet */
  const [feedOpen, setFeedOpen]   = useState(false);
  const [fform, setFform] = useState({ logged_at: today(), qty_kg: "", kind: "in", note: "" });
  const [fbusy, setFbusy] = useState(false);

  /* Health event sheet */
  const [healthOpen, setHealthOpen] = useState(false);
  const [hform, setHform] = useState({ event_date: today(), type: "observation", title: "", medicine: "", dose: "", note: "" });
  const [hbusy, setHbusy] = useState(false);

  /* Vaccination sheet */
  const [vaccOpen, setVaccOpen] = useState(false);
  const [vform, setVform] = useState({ given_at: today(), vaccine_name: "", route: "drinking_water", dose: "", batch_lot: "", note: "" });
  const [vbusy, setVbusy] = useState(false);

  /* Delete confirm */
  const [delTarget, setDelTarget] = useState(null); // { type, id, label }

  const canRecord = space && farmSpaceService.can(space, "farm.poultry.record");
  const canManage = space && farmSpaceService.can(space, "farm.poultry.manage");

  const loadBatch = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const [b, m] = await Promise.all([
        poultryApi.getBatch(active.id, batchId),
        poultryApi.metrics(active.id, batchId),
      ]);
      setBatch(b);
      setMetrics(m);
      setState("ready");
    } catch (err) {
      if (state !== "ready") { setReason(err?.reason || FARM_ERROR.FAILED); setState("error"); }
    }
  }, [batchId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadBatch(); }, [loadBatch]);

  /* Load tab data on first switch to that tab */
  useEffect(() => {
    if (!space || !batch) return;
    const sid = space.id;
    const bid = batch.id;
    if (tab === "daily" && daily === null) {
      setTabLoading(true);
      poultryApi.listDaily(sid, bid).then(d => { setDaily(d || []); setTabLoading(false); })
        .catch(() => { setDaily([]); setTabLoading(false); });
    }
    if (tab === "weights" && weights === null) {
      setTabLoading(true);
      poultryApi.listWeights(sid, bid).then(d => { setWeights(d || []); setTabLoading(false); })
        .catch(() => { setWeights([]); setTabLoading(false); });
    }
    if (tab === "feed" && feed === null) {
      setTabLoading(true);
      poultryApi.listFeed(sid, bid).then(d => { setFeed(d || []); setTabLoading(false); })
        .catch(() => { setFeed([]); setTabLoading(false); });
    }
    if (tab === "health" && (health === null || vaccinations === null)) {
      setTabLoading(true);
      Promise.all([
        poultryApi.listHealth(sid, bid),
        poultryApi.listVaccinations(sid, bid),
      ]).then(([h, v]) => { setHealth(h || []); setVaccinations(v || []); setTabLoading(false); })
        .catch(() => { setHealth([]); setVaccinations([]); setTabLoading(false); });
    }
  }, [tab, space, batch]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Transition */
  const doTransition = async (transition) => {
    setTransitioning(true);
    try {
      await poultryApi.setBatchStatus(space.id, batch.id, transition);
      toast(tc({ en: "Status updated", hi: "स्थिति अपडेट हुई", bn: "স্ট্যাটাস আপডেট হয়েছে" }), "success");
      loadBatch();
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setTransitioning(false); }
  };

  /* Daily submit */
  const submitDaily = async () => {
    if (!dform.record_date) return;
    setDbusy(true);
    try {
      await poultryApi.upsertDaily(space.id, {
        batchId: batch.id,
        record_date: dform.record_date,
        mortality: dform.mortality ? Number(dform.mortality) : 0,
        culls: dform.culls ? Number(dform.culls) : 0,
        note: dform.note.trim() || null,
      });
      setDailyOpen(false);
      setDform({ record_date: today(), mortality: "", culls: "", note: "" });
      toast(tc({ en: "Record saved", hi: "रिकॉर्ड सेव हुआ", bn: "রেকর্ড সেভ হয়েছে" }), "success");
      setDaily(null); // force re-fetch
      loadBatch();
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setDbusy(false); }
  };

  /* Weight submit */
  const submitWeight = async () => {
    if (!wform.total_weight_g || !wform.sample_count) return;
    setWbusy(true);
    try {
      await poultryApi.addWeight(space.id, {
        batchId: batch.id,
        weighed_at: wform.weighed_at,
        total_weight_g: Number(wform.total_weight_g),
        sample_count: Number(wform.sample_count),
      });
      setWeightOpen(false);
      setWform({ weighed_at: today(), total_weight_g: "", sample_count: "" });
      toast(tc({ en: "Weight logged", hi: "वजन दर्ज हुआ", bn: "ওজন লগ হয়েছে" }), "success");
      setWeights(null);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setWbusy(false); }
  };

  /* Feed submit */
  const submitFeed = async () => {
    if (!fform.qty_kg) return;
    setFbusy(true);
    try {
      await poultryApi.addFeed(space.id, {
        batchId: batch.id,
        logged_at: fform.logged_at,
        qty_kg: Number(fform.qty_kg),
        kind: fform.kind,
        note: fform.note.trim() || null,
      });
      setFeedOpen(false);
      setFform({ logged_at: today(), qty_kg: "", kind: "in", note: "" });
      toast(tc({ en: "Feed logged", hi: "चारा दर्ज हुआ", bn: "খাদ্য লগ হয়েছে" }), "success");
      setFeed(null);
      loadBatch();
    } catch (err) {
      const msg = err.details?.available_kg != null
        ? tc({ en: `Only ${err.details.available_kg} kg available`,
                hi: `केवल ${err.details.available_kg} kg उपलब्ध`,
                bn: `মাত্র ${err.details.available_kg} kg পাওয়া যাচ্ছে` })
        : err.message;
      toast(msg || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setFbusy(false); }
  };

  /* Health event submit */
  const submitHealth = async () => {
    if (!hform.title.trim()) return;
    setHbusy(true);
    try {
      await poultryApi.addHealth(space.id, {
        batchId: batch.id,
        event_date: hform.event_date,
        type: hform.type,
        title: hform.title.trim(),
        medicine: hform.medicine.trim() || null,
        dose: hform.dose.trim() || null,
        note: hform.note.trim() || null,
      });
      setHealthOpen(false);
      setHform({ event_date: today(), type: "observation", title: "", medicine: "", dose: "", note: "" });
      toast(tc({ en: "Health event saved", hi: "स्वास्थ्य घटना सेव हुई", bn: "স্বাস্থ্য ইভেন্ট সেভ হয়েছে" }), "success");
      setHealth(null); setVaccinations(null);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setHbusy(false); }
  };

  /* Vaccination submit */
  const submitVacc = async () => {
    if (!vform.vaccine_name.trim()) return;
    setVbusy(true);
    try {
      await poultryApi.addVaccination(space.id, {
        batchId: batch.id,
        given_at: vform.given_at,
        vaccine_name: vform.vaccine_name.trim(),
        route: vform.route,
        dose: vform.dose.trim() || null,
        batch_lot: vform.batch_lot.trim() || null,
        note: vform.note.trim() || null,
      });
      setVaccOpen(false);
      setVform({ given_at: today(), vaccine_name: "", route: "drinking_water", dose: "", batch_lot: "", note: "" });
      toast(tc({ en: "Vaccination recorded", hi: "टीकाकरण दर्ज हुआ", bn: "টিকাদান রেকর্ড হয়েছে" }), "success");
      setHealth(null); setVaccinations(null);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setVbusy(false); }
  };

  /* Delete */
  const confirmDelete = async () => {
    if (!delTarget) return;
    try {
      if (delTarget.type === "daily")        await poultryApi.deleteDaily(space.id, batch.id, delTarget.id);
      if (delTarget.type === "weight")       await poultryApi.deleteWeight(space.id, delTarget.id);
      if (delTarget.type === "feed")         await poultryApi.deleteFeed(space.id, delTarget.id);
      if (delTarget.type === "health")       await poultryApi.deleteHealth(space.id, delTarget.id);
      if (delTarget.type === "vaccination")  await poultryApi.deleteVaccination(space.id, delTarget.id);
      toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে গেছে" }), "success");
      if (delTarget.type === "daily")       { setDaily(null); loadBatch(); }
      if (delTarget.type === "weight")        setWeights(null);
      if (delTarget.type === "feed")        { setFeed(null); loadBatch(); }
      if (delTarget.type === "health" || delTarget.type === "vaccination") { setHealth(null); setVaccinations(null); }
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setDelTarget(null); }
  };

  /* ── render states ───────────────────────────────────────────────────── */

  if (state === "loading") return (
    <>
      <AppBar title={tc({ en: "Batch", hi: "बैच", bn: "ব্যাচ" })} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div>
    </>
  );
  if (state === "error") return (
    <>
      <AppBar title={tc({ en: "Batch", hi: "बैच", bn: "ব্যাচ" })} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={loadBatch} /></div>
    </>
  );

  const statusMeta = BATCH_STATUS[batch.status] || BATCH_STATUS.draft;
  const transitions = batch.allowed_transitions || [];
  const liveBirds = metrics?.live_birds ?? batch.live_birds ?? batch.placed_qty;
  const fcr = metrics?.fcr;
  const adg = metrics?.avg_daily_gain_g;
  const totalFeed = metrics?.total_feed_kg;

  return (
    <>
      <AppBar title={batch.name} onBack={pop} />

      <div style={{ padding: "4px 16px 100px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Status + transitions */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <Chip accent={statusMeta.a}>{tc(statusMeta.label)}</Chip>
            {batch.shed_name && (
              <span style={{ fontSize: 12.5, color: T.inkSoft }}>{batch.shed_name}</span>
            )}
          </div>
          {canManage && transitions.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {transitions.map(t => (
                <button key={t} onClick={() => doTransition(t)} disabled={transitioning}
                  style={{ background: T.surface2, border: "none", borderRadius: T.rMd,
                    padding: "7px 14px", fontFamily: T.body, fontSize: 13, fontWeight: 600,
                    color: T.ink, cursor: "pointer", opacity: transitioning ? 0.6 : 1 }}>
                  {tc(TRANSITION_LABEL[t] || { en: t, hi: t, bn: t })}
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <MetricTile label={tc({ en: "Live birds", hi: "जीवित पक्षी", bn: "জীবিত পাখি" })}
            value={liveBirds.toLocaleString("en-IN")} accent="primary" />
          <MetricTile label={tc({ en: "Age (days)", hi: "उम्र (दिन)", bn: "বয়স (দিন)" })}
            value={batch.age_days ?? "—"} />
          {fcr != null && (
            <MetricTile label="FCR" value={fcr.toFixed(2)} accent={fcr <= (batch.target_fcr || 1.8) ? "primary" : "orange"} />
          )}
          {adg != null && (
            <MetricTile label={tc({ en: "ADG (g/day)", hi: "ADG (g/दिन)", bn: "ADG (g/দিন)" })}
              value={adg.toFixed(1)} />
          )}
          {totalFeed != null && (
            <MetricTile label={tc({ en: "Feed used (kg)", hi: "चारा (kg)", bn: "খাদ্য (kg)" })}
              value={totalFeed.toFixed(1)} />
          )}
          {batch.expected_harvest_date && (
            <MetricTile label={tc({ en: "Target harvest", hi: "लक्ष्य कटाई", bn: "লক্ষ্য কর্তন" })}
              value={batch.expected_harvest_date} />
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: T.surface2, borderRadius: T.rMd, padding: 3, gap: 3 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "7px 4px", border: "none", cursor: "pointer", fontFamily: T.body,
              fontSize: 13, fontWeight: 600, borderRadius: T.rMd - 2,
              background: tab === t ? T.surface : "transparent",
              color: tab === t ? T.ink : T.inkSoft,
              boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.08)" : "none",
            }}>
              {tc(TAB_LABEL[t])}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tabLoading
          ? <div style={{ padding: 40, display: "grid", placeItems: "center" }}><Spinner /></div>
          : <>
              {tab === "daily" && (
                <DailyTab rows={daily || []} tc={tc} canRecord={canRecord} canManage={canManage}
                  onAdd={() => setDailyOpen(true)}
                  onDelete={r => setDelTarget({ type: "daily", id: r.record_date, label: r.record_date })}
                />
              )}
              {tab === "weights" && (
                <WeightsTab rows={weights || []} tc={tc} canRecord={canRecord} canManage={canManage}
                  onAdd={() => setWeightOpen(true)}
                  onDelete={r => setDelTarget({ type: "weight", id: r.id, label: r.weighed_at })}
                />
              )}
              {tab === "feed" && (
                <FeedTab rows={feed || []} tc={tc} canRecord={canRecord} canManage={canManage}
                  onAdd={() => setFeedOpen(true)}
                  onDelete={r => setDelTarget({ type: "feed", id: r.id, label: r.logged_at })}
                />
              )}
              {tab === "health" && (
                <HealthTab
                  healthRows={health || []} vaccRows={vaccinations || []} tc={tc}
                  canRecord={canRecord} canManage={canManage}
                  onAddHealth={() => setHealthOpen(true)}
                  onAddVacc={() => setVaccOpen(true)}
                  onDeleteHealth={r => setDelTarget({ type: "health", id: r.id, label: r.title })}
                  onDeleteVacc={r => setDelTarget({ type: "vaccination", id: r.id, label: r.vaccine_name })}
                />
              )}
            </>
        }
      </div>

      {/* Daily record sheet */}
      <BottomSheet open={dailyOpen} onClose={() => setDailyOpen(false)}
        title={tc({ en: "Daily Record", hi: "दैनिक रिकॉर्ड", bn: "দৈনিক রেকর্ড" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *" })}
            value={dform.record_date} onChange={v => setDform(f => ({ ...f, record_date: v }))} type="date" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label={tc({ en: "Mortality", hi: "मृत्यु", bn: "মৃত্যু" })}
              value={dform.mortality} onChange={v => setDform(f => ({ ...f, mortality: v }))} type="number" />
            <Input label={tc({ en: "Culls", hi: "कल्स", bn: "কালস" })}
              value={dform.culls} onChange={v => setDform(f => ({ ...f, culls: v }))} type="number" />
          </div>
          <Input label={tc({ en: "Note", hi: "नोट", bn: "নোট" })}
            value={dform.note} onChange={v => setDform(f => ({ ...f, note: v }))} />
          <Button full onClick={submitDaily} disabled={!dform.record_date || dbusy}>
            {dbusy ? tc({ en: "Saving…", hi: "सेव हो रहा है…", bn: "সেভ হচ্ছে…" })
                   : tc({ en: "Save record", hi: "रिकॉर्ड सेव करें", bn: "রেকর্ড সেভ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Weight sheet */}
      <BottomSheet open={weightOpen} onClose={() => setWeightOpen(false)}
        title={tc({ en: "Add Weight", hi: "वजन जोड़ें", bn: "ওজন যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *" })}
            value={wform.weighed_at} onChange={v => setWform(f => ({ ...f, weighed_at: v }))} type="date" />
          <Input label={tc({ en: "Total weight (g) *", hi: "कुल वजन (g) *", bn: "মোট ওজন (g) *" })}
            value={wform.total_weight_g} onChange={v => setWform(f => ({ ...f, total_weight_g: v }))} type="number" />
          <Input label={tc({ en: "Sample count (birds weighed) *", hi: "नमूना गिनती *", bn: "নমুনা গণনা *" })}
            value={wform.sample_count} onChange={v => setWform(f => ({ ...f, sample_count: v }))} type="number" />
          {wform.total_weight_g && wform.sample_count && Number(wform.sample_count) > 0 && (
            <div style={{ fontSize: 13, color: T.inkSoft, textAlign: "center" }}>
              {tc({ en: "Avg", hi: "औसत", bn: "গড়" })}: {(Number(wform.total_weight_g) / Number(wform.sample_count)).toFixed(1)} g
            </div>
          )}
          <Button full onClick={submitWeight} disabled={!wform.total_weight_g || !wform.sample_count || wbusy}>
            {wbusy ? tc({ en: "Logging…", hi: "दर्ज हो रहा है…", bn: "লগ হচ্ছে…" })
                   : tc({ en: "Log weight", hi: "वजन दर्ज करें", bn: "ওজন লগ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Feed sheet */}
      <BottomSheet open={feedOpen} onClose={() => setFeedOpen(false)}
        title={tc({ en: "Add Feed", hi: "चारा जोड़ें", bn: "খাদ্য যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *" })}
            value={fform.logged_at} onChange={v => setFform(f => ({ ...f, logged_at: v }))} type="date" />
          <Input label={tc({ en: "Quantity (kg) *", hi: "मात्रा (kg) *", bn: "পরিমাণ (kg) *" })}
            value={fform.qty_kg} onChange={v => setFform(f => ({ ...f, qty_kg: v }))} type="number" />
          <Dropdown label={tc({ en: "Type", hi: "प्रकार", bn: "ধরন" })}
            value={fform.kind} onChange={v => setFform(f => ({ ...f, kind: v }))}
            options={KIND_OPTIONS(tc)} />
          <Input label={tc({ en: "Note", hi: "नोट", bn: "নোট" })}
            value={fform.note} onChange={v => setFform(f => ({ ...f, note: v }))} />
          <Button full onClick={submitFeed} disabled={!fform.qty_kg || fbusy}>
            {fbusy ? tc({ en: "Logging…", hi: "दर्ज हो रहा है…", bn: "লগ হচ্ছে…" })
                   : tc({ en: "Log feed", hi: "चारा दर्ज करें", bn: "খাদ্য লগ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Health event sheet */}
      <BottomSheet open={healthOpen} onClose={() => setHealthOpen(false)}
        title={tc({ en: "Health Event", hi: "स्वास्थ्य घटना", bn: "স্বাস্থ্য ইভেন্ট" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *" })}
            value={hform.event_date} onChange={v => setHform(f => ({ ...f, event_date: v }))} type="date" />
          <Dropdown label={tc({ en: "Type *", hi: "प्रकार *", bn: "ধরন *" })}
            value={hform.type} onChange={v => setHform(f => ({ ...f, type: v }))}
            options={HEALTH_TYPE_OPTIONS(tc)} />
          <Input label={tc({ en: "Title *", hi: "शीर्षक *", bn: "শিরোনাম *" })}
            value={hform.title} onChange={v => setHform(f => ({ ...f, title: v }))} />
          {(hform.type === "treatment" || hform.type === "vet_visit") && (
            <Input label={tc({ en: "Medicine / Drug", hi: "दवा", bn: "ওষুধ" })}
              value={hform.medicine} onChange={v => setHform(f => ({ ...f, medicine: v }))} />
          )}
          {(hform.type === "treatment" || hform.type === "vet_visit") && (
            <Input label={tc({ en: "Dose", hi: "खुराक", bn: "ডোজ" })}
              value={hform.dose} onChange={v => setHform(f => ({ ...f, dose: v }))} />
          )}
          <Input label={tc({ en: "Note", hi: "नोट", bn: "নোট" })}
            value={hform.note} onChange={v => setHform(f => ({ ...f, note: v }))} />
          <Button full onClick={submitHealth} disabled={!hform.title.trim() || hbusy}>
            {hbusy ? tc({ en: "Saving…", hi: "सेव हो रहा है…", bn: "সেভ হচ্ছে…" })
                   : tc({ en: "Save event", hi: "घटना सेव करें", bn: "ইভেন্ট সেভ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Vaccination sheet */}
      <BottomSheet open={vaccOpen} onClose={() => setVaccOpen(false)}
        title={tc({ en: "Add Vaccination", hi: "टीकाकरण जोड़ें", bn: "টিকাদান যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *" })}
            value={vform.given_at} onChange={v => setVform(f => ({ ...f, given_at: v }))} type="date" />
          <Input label={tc({ en: "Vaccine name *", hi: "वैक्सीन का नाम *", bn: "ভ্যাকসিনের নাম *" })}
            value={vform.vaccine_name} onChange={v => setVform(f => ({ ...f, vaccine_name: v }))} />
          <Dropdown label={tc({ en: "Route *", hi: "मार्ग *", bn: "পথ *" })}
            value={vform.route} onChange={v => setVform(f => ({ ...f, route: v }))}
            options={ROUTE_OPTIONS(tc)} />
          <Input label={tc({ en: "Dose / Dilution", hi: "खुराक / तनुता", bn: "ডোজ / তনুতা" })}
            value={vform.dose} onChange={v => setVform(f => ({ ...f, dose: v }))} />
          <Input label={tc({ en: "Batch / Lot no.", hi: "बैच / लॉट नं.", bn: "ব্যাচ / লট নং" })}
            value={vform.batch_lot} onChange={v => setVform(f => ({ ...f, batch_lot: v }))} />
          <Input label={tc({ en: "Note", hi: "नोट", bn: "নোট" })}
            value={vform.note} onChange={v => setVform(f => ({ ...f, note: v }))} />
          <Button full onClick={submitVacc} disabled={!vform.vaccine_name.trim() || vbusy}>
            {vbusy ? tc({ en: "Recording…", hi: "दर्ज हो रहा है…", bn: "রেকর্ড হচ্ছে…" })
                   : tc({ en: "Record vaccination", hi: "टीकाकरण दर्ज करें", bn: "টিকাদান রেকর্ড করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Delete confirm */}
      <Dialog
        open={!!delTarget}
        title={tc({ en: "Delete?", hi: "हटाएँ?", bn: "মুছবেন?" })}
        body={delTarget?.label}
        actions={[
          { label: tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" }), onClick: () => setDelTarget(null) },
          { label: tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" }), onClick: confirmDelete, destructive: true },
        ]}
      />
    </>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function MetricTile({ label, value, accent }) {
  const color = accent === "primary" ? T.primary : accent === "orange" ? T.orange : T.ink;
  return (
    <Card style={{ padding: "12px 14px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: T.display, color }}>{value}</div>
      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{label}</div>
    </Card>
  );
}

function AddRow({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      padding: "10px", background: T.surface2, border: `1.5px dashed ${T.border}`,
      borderRadius: T.rMd, cursor: "pointer", fontFamily: T.body,
      fontSize: 13.5, fontWeight: 600, color: T.primary,
    }}>
      <Icon name="Plus" size={15} /> {label}
    </button>
  );
}

function RowCard({ left, right, onDelete }) {
  return (
    <Card pad={0}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>{left}</div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>{right}</div>
        {onDelete && (
          <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer",
            padding: 4, color: T.inkFaint, flexShrink: 0 }}>
            <Icon name="Trash2" size={15} />
          </button>
        )}
      </div>
    </Card>
  );
}

function DailyTab({ rows, tc, canRecord, canManage, onAdd, onDelete }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {canRecord && (
        <AddRow label={tc({ en: "Add daily record", hi: "दैनिक रिकॉर्ड जोड़ें", bn: "দৈনিক রেকর্ড যোগ করুন" })} onClick={onAdd} />
      )}
      {rows.length === 0
        ? <EmptyState icon="CalendarDays"
            title={tc({ en: "No records yet", hi: "अभी कोई रिकॉर्ड नहीं", bn: "এখনও কোনো রেকর্ড নেই" })} />
        : rows.map(r => (
            <RowCard key={r.record_date}
              left={<>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{r.record_date}</div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                  {tc({ en: "Mortality", hi: "मृत्यु", bn: "মৃত্যু" })}: {r.mortality ?? 0}
                  {" · "}
                  {tc({ en: "Culls", hi: "कल्स", bn: "কালস" })}: {r.culls ?? 0}
                </div>
                {r.note && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{r.note}</div>}
              </>}
              right={<>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                  {(r.opening_birds ?? "—")} → {(r.closing_birds ?? "—")}
                </div>
                <div style={{ fontSize: 11, color: T.inkSoft }}>
                  {tc({ en: "birds", hi: "पक्षी", bn: "পাখি" })}
                </div>
              </>}
              onDelete={canManage ? () => onDelete(r) : null}
            />
          ))
      }
    </div>
  );
}

function WeightsTab({ rows, tc, canRecord, canManage, onAdd, onDelete }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {canRecord && (
        <AddRow label={tc({ en: "Add weight sample", hi: "वजन नमूना जोड़ें", bn: "ওজন নমুনা যোগ করুন" })} onClick={onAdd} />
      )}
      {rows.length === 0
        ? <EmptyState icon="Scale"
            title={tc({ en: "No weights logged", hi: "कोई वजन दर्ज नहीं", bn: "কোনো ওজন লগ নেই" })} />
        : rows.map(r => (
            <RowCard key={r.id}
              left={<>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{r.weighed_at}</div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                  {r.sample_count} {tc({ en: "birds weighed", hi: "पक्षी तौले", bn: "পাখি ওজন করা" })}
                </div>
              </>}
              right={<>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.primary }}>
                  {r.average_weight_g ? `${r.average_weight_g.toFixed(0)} g` : "—"}
                </div>
                <div style={{ fontSize: 11, color: T.inkSoft }}>
                  {tc({ en: "avg / bird", hi: "औसत / पक्षी", bn: "গড় / পাখি" })}
                </div>
              </>}
              onDelete={canManage ? () => onDelete(r) : null}
            />
          ))
      }
    </div>
  );
}

function FeedTab({ rows, tc, canRecord, canManage, onAdd, onDelete }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {canRecord && (
        <AddRow label={tc({ en: "Log feed", hi: "चारा दर्ज करें", bn: "খাদ্য লগ করুন" })} onClick={onAdd} />
      )}
      {rows.length === 0
        ? <EmptyState icon="Wheat"
            title={tc({ en: "No feed logged", hi: "कोई चारा दर्ज नहीं", bn: "কোনো খাদ্য লগ নেই" })} />
        : rows.map(r => (
            <RowCard key={r.id}
              left={<>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{r.logged_at}</div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                  {r.kind === "in"
                    ? tc({ en: "Received", hi: "प्राप्त", bn: "প্রাপ্ত" })
                    : tc({ en: "Adjustment", hi: "समायोजन", bn: "সমন্বয়" })}
                  {r.note ? ` · ${r.note}` : ""}
                </div>
              </>}
              right={<>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.orange }}>
                  {r.qty_kg} kg
                </div>
              </>}
              onDelete={canManage ? () => onDelete(r) : null}
            />
          ))
      }
    </div>
  );
}

const HEALTH_TYPE_ACCENT = { observation: "faint", treatment: "primary", vet_visit: "blue", outbreak: "orange" };
const HEALTH_TYPE_LABEL  = {
  observation: { en: "Observation", hi: "अवलोकन",    bn: "পর্যবেক্ষণ" },
  treatment:   { en: "Treatment",   hi: "उपचार",      bn: "চিকিৎসা" },
  vet_visit:   { en: "Vet visit",   hi: "पशु चिकित्सक", bn: "পশু চিকিৎসক" },
  outbreak:    { en: "Outbreak",    hi: "प्रकोप",     bn: "প্রাদুর্ভাব" },
};
const ROUTE_LABEL = {
  drinking_water: { en: "Drinking water", hi: "पीने का पानी", bn: "পানীয় জল" },
  spray:          { en: "Spray",          hi: "स्प्रे",       bn: "স্প্রে" },
  eye_drop:       { en: "Eye drop",       hi: "आई ड्रॉप",    bn: "চোখের ড্রপ" },
  injection:      { en: "Injection",      hi: "इंजेक्शन",    bn: "ইনজেকশন" },
};

function HealthTab({ healthRows, vaccRows, tc, canRecord, canManage, onAddHealth, onAddVacc, onDeleteHealth, onDeleteVacc }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Health events section */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {tc({ en: "Health Events", hi: "स्वास्थ्य घटनाएँ", bn: "স্বাস্থ্য ইভেন্ট" })}
          </span>
        </div>
        {canRecord && (
          <AddRow label={tc({ en: "Add health event", hi: "स्वास्थ्य घटना जोड़ें", bn: "স্বাস্থ্য ইভেন্ট যোগ করুন" })} onClick={onAddHealth} />
        )}
        {healthRows.length === 0
          ? <EmptyState icon="Stethoscope"
              title={tc({ en: "No health events", hi: "कोई स्वास्थ्य घटना नहीं", bn: "কোনো স্বাস্থ্য ইভেন্ট নেই" })} />
          : healthRows.map(r => (
              <RowCard key={r.id}
                left={<>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Chip accent={HEALTH_TYPE_ACCENT[r.type] || "faint"} style={{ fontSize: 11 }}>
                      {tc(HEALTH_TYPE_LABEL[r.type] || { en: r.type, hi: r.type, bn: r.type })}
                    </Chip>
                    <span style={{ fontSize: 12.5, color: T.inkSoft }}>{r.event_date}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginTop: 4 }}>{r.title}</div>
                  {r.medicine && (
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                      {tc({ en: "Medicine", hi: "दवा", bn: "ওষুধ" })}: {r.medicine}
                      {r.dose ? ` — ${r.dose}` : ""}
                    </div>
                  )}
                  {r.note && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{r.note}</div>}
                </>}
                right={null}
                onDelete={canManage ? () => onDeleteHealth(r) : null}
              />
            ))
        }
      </div>

      {/* Vaccinations section */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {tc({ en: "Vaccinations", hi: "टीकाकरण", bn: "টিকাদান" })}
          </span>
        </div>
        {canRecord && (
          <AddRow label={tc({ en: "Record vaccination", hi: "टीकाकरण दर्ज करें", bn: "টিকাদান রেকর্ড করুন" })} onClick={onAddVacc} />
        )}
        {vaccRows.length === 0
          ? <EmptyState icon="Syringe"
              title={tc({ en: "No vaccinations recorded", hi: "कोई टीकाकरण दर्ज नहीं", bn: "কোনো টিকাদান নেই" })} />
          : vaccRows.map(r => (
              <RowCard key={r.id}
                left={<>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{r.vaccine_name}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                    {r.given_at}
                    {r.route ? ` · ${tc(ROUTE_LABEL[r.route] || { en: r.route, hi: r.route, bn: r.route })}` : ""}
                    {r.dose ? ` · ${r.dose}` : ""}
                  </div>
                  {r.batch_lot && <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 1 }}>Lot: {r.batch_lot}</div>}
                  {r.note && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{r.note}</div>}
                </>}
                right={null}
                onDelete={canManage ? () => onDeleteVacc(r) : null}
              />
            ))
        }
      </div>
    </div>
  );
}
