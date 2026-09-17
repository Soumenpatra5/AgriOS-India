import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { useApp } from "../../store/AppStore.jsx";
import {
  AppBar, Card, Button, EmptyState, ErrorState, Spinner, BottomSheet
} from "../../components/index.js";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { cropApi, FARM_ERROR } from "../../services/crop/cropApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const EVENT_ICON = { sowing: "Wheat", activity: "Activity", harvest: "Package" };
const EVENT_LABEL = {
  sowing:   { en: "Sowing",    hi: "बुवाई",     bn: "বপন" },
  activity: { en: "Activity",  hi: "गतिविधि",   bn: "কার্যকলাপ" },
  harvest:  { en: "Harvest",   hi: "कटाई",       bn: "ফসল কাটা" },
};
const STATUS_OPTIONS = ["fallow","sowing","growing","ready","harvesting","inactive"];
const ACTIVITY_TYPES = ["irrigation","spray_pesticide","spray_fertilizer","weeding","land_prep","thinning","other"];

export default function FieldDetail({ fieldId }) {
  const { pop, tc } = useApp();
  const [space, setSpace]     = useState(null);
  const [detail, setDetail]   = useState(null);
  const [history, setHistory] = useState([]);
  const [state, setState]     = useState("loading");
  const [reason, setReason]   = useState(null);
  const [tab, setTab]         = useState("history");

  /* Add-sowing form */
  const [showSow, setShowSow]   = useState(false);
  const [sow, setSow]           = useState({ sowingDate: "", crop: "", variety: "", seedKg: "", method: "", notes: "" });
  const [sowSaving, setSowSaving] = useState(false);
  const [sowErr, setSowErr]     = useState(null);

  /* Add-activity form */
  const [showAct, setShowAct]   = useState(false);
  const [act, setAct]           = useState({ activityDate: "", activityType: "other", description: "", quantity: "", unit: "", cost: "", notes: "" });
  const [actSaving, setActSaving] = useState(false);
  const [actErr, setActErr]     = useState(null);

  /* Add-harvest form */
  const [showHarv, setShowHarv]  = useState(false);
  const [harv, setHarv]          = useState({ harvestDate: "", crop: "", quantity: "", unit: "kg", qualityGrade: "", notes: "" });
  const [harvSaving, setHarvSaving] = useState(false);
  const [harvErr, setHarvErr]    = useState(null);

  /* Status change */
  const [showStatus, setShowStatus] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const sp = await farmSpaceService.active();
      if (!sp) { setState("error"); setReason(FARM_ERROR.NOT_FOUND); return; }
      setSpace(sp);
      const [d, h] = await Promise.all([
        cropApi.getField(sp.id, { fieldId }),
        cropApi.fieldHistory(sp.id, { fieldId }),
      ]);
      setDetail(d);
      setHistory(h.history || []);
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, [fieldId]);

  useEffect(() => { load(); }, [load]);

  const canRecord  = space && farmSpaceService.can(space, "farm.crop.record");
  const canManage  = space && farmSpaceService.can(space, "farm.crop.manage");

  const handleAddSowing = async () => {
    if (!sow.sowingDate) { setSowErr(tc({ en: "Date required", hi: "तारीख ज़रूरी है", bn: "তারিখ আবশ্যক" })); return; }
    if (!sow.crop.trim()) { setSowErr(tc({ en: "Crop required", hi: "फसल ज़रूरी है", bn: "ফসল আবশ্যক" })); return; }
    setSowSaving(true); setSowErr(null);
    try {
      await cropApi.addSowing(space.id, {
        fieldId, sowingDate: sow.sowingDate, crop: sow.crop.trim(),
        variety: sow.variety || undefined, seedKg: sow.seedKg ? Number(sow.seedKg) : undefined,
        method: sow.method || undefined, notes: sow.notes || undefined,
        clientUuid: `sow-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setShowSow(false);
      setSow({ sowingDate: "", crop: "", variety: "", seedKg: "", method: "", notes: "" });
      load();
    } catch (err) { setSowErr(err.message); } finally { setSowSaving(false); }
  };

  const handleAddActivity = async () => {
    if (!act.activityDate) { setActErr(tc({ en: "Date required", hi: "तारीख ज़रूरी है", bn: "তারিখ আবশ্যক" })); return; }
    setActSaving(true); setActErr(null);
    try {
      await cropApi.addActivity(space.id, {
        fieldId, activityDate: act.activityDate, activityType: act.activityType,
        description: act.description || undefined, quantity: act.quantity ? Number(act.quantity) : undefined,
        unit: act.unit || undefined, cost: act.cost ? Number(act.cost) : undefined,
        notes: act.notes || undefined,
        clientUuid: `act-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setShowAct(false);
      setAct({ activityDate: "", activityType: "other", description: "", quantity: "", unit: "", cost: "", notes: "" });
      load();
    } catch (err) { setActErr(err.message); } finally { setActSaving(false); }
  };

  const handleAddHarvest = async () => {
    if (!harv.harvestDate) { setHarvErr(tc({ en: "Date required", hi: "तारीख ज़रूरी है", bn: "তারিখ আবশ্যক" })); return; }
    if (!harv.crop.trim()) { setHarvErr(tc({ en: "Crop required", hi: "फसल ज़रूरी है", bn: "ফসল আবশ্যক" })); return; }
    if (!harv.quantity || Number(harv.quantity) <= 0) { setHarvErr(tc({ en: "Quantity > 0 required", hi: "मात्रा 0 से अधिक होनी चाहिए", bn: "পরিমাণ 0 এর বেশি হতে হবে" })); return; }
    setHarvSaving(true); setHarvErr(null);
    try {
      await cropApi.addHarvest(space.id, {
        fieldId, harvestDate: harv.harvestDate, crop: harv.crop.trim(),
        quantity: Number(harv.quantity), unit: harv.unit || "kg",
        qualityGrade: harv.qualityGrade || undefined, notes: harv.notes || undefined,
        clientUuid: `harv-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setShowHarv(false);
      setHarv({ harvestDate: "", crop: "", quantity: "", unit: "kg", qualityGrade: "", notes: "" });
      load();
    } catch (err) { setHarvErr(err.message); } finally { setHarvSaving(false); }
  };

  const handleSetStatus = async (status) => {
    setStatusSaving(true);
    try {
      await cropApi.setStatus(space.id, { fieldId, status });
      setShowStatus(false);
      load();
    } catch (err) { alert(err.message); } finally { setStatusSaving(false); }
  };

  const title = detail?.name ?? tc({ en: "Field", hi: "खेत", bn: "মাঠ" });

  if (state === "loading") return <><AppBar title={title} onBack={pop} />
    <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error") return <><AppBar title={title} onBack={pop} />
    <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Field info card */}
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: T.inkSoft }}>
                {tc({ en: "Status", hi: "स्थिति", bn: "অবস্থা" })}
              </span>
              {canManage && (
                <button onClick={() => setShowStatus(true)}
                  style={{ fontSize: 12, color: T.primary, background: "none", border: "none", cursor: "pointer", fontFamily: T.body }}>
                  {tc({ en: "Change", hi: "बदलें", bn: "পরিবর্তন করুন" })}
                </button>
              )}
            </div>
            <span style={{ fontWeight: 600, fontSize: 14, color: T.ink, textTransform: "capitalize" }}>
              {detail.current_status}
            </span>
            {detail.area && (
              <div style={{ fontSize: 13, color: T.inkSoft }}>
                {detail.area} {detail.area_unit} · {detail.crop_type}
              </div>
            )}
            {detail.current_crop && (
              <div style={{ fontSize: 13, color: T.inkSoft }}>
                {tc({ en: "Crop", hi: "फसल", bn: "ফসল" })}: {detail.current_crop}
                {detail.season ? ` (${detail.season})` : ""}
              </div>
            )}
            {detail.last_sowing && (
              <div style={{ fontSize: 13, color: T.inkSoft }}>
                {tc({ en: "Last sown", hi: "अंतिम बुवाई", bn: "সর্বশেষ বপন" })}: {detail.last_sowing.sowing_date} — {detail.last_sowing.crop}
              </div>
            )}
          </div>
        </Card>

        {/* Action row */}
        {canRecord && detail.current_status !== "inactive" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button size="sm" variant="soft" onClick={() => setShowSow(true)}>
              + {tc({ en: "Sowing", hi: "बुवाई", bn: "বপন" })}
            </Button>
            <Button size="sm" variant="soft" onClick={() => setShowAct(true)}>
              + {tc({ en: "Activity", hi: "गतिविधि", bn: "কার্যকলাপ" })}
            </Button>
            <Button size="sm" variant="soft" onClick={() => setShowHarv(true)}>
              + {tc({ en: "Harvest", hi: "कटाई", bn: "ফসল কাটা" })}
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          {["history"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                fontFamily: T.body, fontSize: 13, fontWeight: tab === t ? 700 : 400,
                background: tab === t ? T.primary : T.surface2,
                color: tab === t ? "#fff" : T.inkSoft }}>
              {tc({ en: "History", hi: "इतिहास", bn: "ইতিহাস" })}
            </button>
          ))}
        </div>

        {/* History */}
        {history.length === 0 ? (
          <EmptyState icon="Activity"
            title={tc({ en: "No history yet", hi: "अभी कोई इतिहास नहीं", bn: "এখনও কোনও ইতিহাস নেই" })} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((ev, i) => (
              <Card key={ev.id ?? i} pad={12}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, textTransform: "capitalize" }}>
                      {tc(EVENT_LABEL[ev.event_kind] ?? { en: ev.event_kind })}
                      {ev.crop ? ` — ${ev.crop}` : ""}
                      {ev.activity_type ? ` — ${ev.activity_type.replace(/_/g," ")}` : ""}
                    </div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{ev.event_date}</div>
                    {ev.quantity && <div style={{ fontSize: 12, color: T.inkSoft }}>{ev.quantity} {ev.unit ?? ""}</div>}
                    {ev.description && <div style={{ fontSize: 12, color: T.inkSoft }}>{ev.description}</div>}
                    {ev.notes && <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 2 }}>{ev.notes}</div>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Status change bottom sheet */}
      <BottomSheet open={showStatus} onClose={() => setShowStatus(false)}
        title={tc({ en: "Change status", hi: "स्थिति बदलें", bn: "অবস্থা পরিবর্তন করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
          {STATUS_OPTIONS.map(s => (
            <button key={s} disabled={s === detail.current_status || statusSaving}
              onClick={() => handleSetStatus(s)}
              style={{ width: "100%", textAlign: "left", padding: "11px 14px", borderRadius: 10,
                border: `1px solid ${s === detail.current_status ? T.primary : T.border}`,
                background: s === detail.current_status ? `${T.primary}18` : T.surface,
                fontFamily: T.body, fontSize: 14, color: T.ink, cursor: s === detail.current_status ? "default" : "pointer",
                textTransform: "capitalize" }}>
              {s}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Add sowing bottom sheet */}
      <BottomSheet open={showSow} onClose={() => setShowSow(false)}
        title={tc({ en: "Record sowing", hi: "बुवाई दर्ज करें", bn: "বপন রেকর্ড করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
          {[
            { key: "sowingDate", label: { en: "Sowing date *", hi: "बुवाई तारीख *", bn: "বপনের তারিখ *" }, type: "date" },
            { key: "crop",       label: { en: "Crop *",        hi: "फसल *",         bn: "ফসল *" } },
            { key: "variety",    label: { en: "Variety",       hi: "किस्म",          bn: "জাত" } },
            { key: "seedKg",     label: { en: "Seed (kg)",     hi: "बीज (किग्रा)",   bn: "বীজ (কেজি)" }, type: "number" },
            { key: "notes",      label: { en: "Notes",         hi: "नोट्स",          bn: "নোট" } },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: T.inkSoft }}>{tc(label)}</label>
              <input type={type || "text"} value={sow[key]}
                onChange={e => setSow(s => ({ ...s, [key]: e.target.value }))}
                style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                  border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
                  background: T.surface, color: T.ink, boxSizing: "border-box" }} />
            </div>
          ))}
          {sowErr && <div style={{ color: "#ef4444", fontSize: 13 }}>{sowErr}</div>}
          <Button full onClick={handleAddSowing} loading={sowSaving}>
            {tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Add activity bottom sheet */}
      <BottomSheet open={showAct} onClose={() => setShowAct(false)}
        title={tc({ en: "Record activity", hi: "गतिविधि दर्ज करें", bn: "কার্যকলাপ রেকর্ড করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
          <div>
            <label style={{ fontSize: 12, color: T.inkSoft }}>{tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *" })}</label>
            <input type="date" value={act.activityDate}
              onChange={e => setAct(a => ({ ...a, activityDate: e.target.value }))}
              style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
                background: T.surface, color: T.ink, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: T.inkSoft }}>{tc({ en: "Activity type", hi: "गतिविधि प्रकार", bn: "কার্যকলাপের ধরন" })}</label>
            <select value={act.activityType}
              onChange={e => setAct(a => ({ ...a, activityType: e.target.value }))}
              style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
                background: T.surface, color: T.ink, boxSizing: "border-box" }}>
              {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
            </select>
          </div>
          {[
            { key: "description", label: { en: "Description", hi: "विवरण", bn: "বিবরণ" } },
            { key: "quantity",    label: { en: "Quantity",    hi: "मात्रा", bn: "পরিমাণ" }, type: "number" },
            { key: "unit",        label: { en: "Unit",        hi: "इकाई",  bn: "একক" } },
            { key: "cost",        label: { en: "Cost (₹)",    hi: "लागत (₹)", bn: "খরচ (₹)" }, type: "number" },
            { key: "notes",       label: { en: "Notes",       hi: "नोट्स", bn: "নোট" } },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: T.inkSoft }}>{tc(label)}</label>
              <input type={type || "text"} value={act[key]}
                onChange={e => setAct(a => ({ ...a, [key]: e.target.value }))}
                style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                  border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
                  background: T.surface, color: T.ink, boxSizing: "border-box" }} />
            </div>
          ))}
          {actErr && <div style={{ color: "#ef4444", fontSize: 13 }}>{actErr}</div>}
          <Button full onClick={handleAddActivity} loading={actSaving}>
            {tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Add harvest bottom sheet */}
      <BottomSheet open={showHarv} onClose={() => setShowHarv(false)}
        title={tc({ en: "Record harvest", hi: "कटाई दर्ज करें", bn: "ফসল কাটা রেকর্ড করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
          {[
            { key: "harvestDate",  label: { en: "Date *",          hi: "तारीख *",           bn: "তারিখ *" },          type: "date" },
            { key: "crop",         label: { en: "Crop *",          hi: "फसल *",             bn: "ফসল *" } },
            { key: "quantity",     label: { en: "Quantity *",      hi: "मात्रा *",           bn: "পরিমাণ *" },         type: "number" },
            { key: "unit",         label: { en: "Unit",            hi: "इकाई",               bn: "একক" } },
            { key: "qualityGrade", label: { en: "Quality grade",   hi: "गुणवत्ता श्रेणी",    bn: "মানমাত্রা" } },
            { key: "notes",        label: { en: "Notes",           hi: "नोट्स",              bn: "নোট" } },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: T.inkSoft }}>{tc(label)}</label>
              <input type={type || "text"} value={harv[key]}
                onChange={e => setHarv(h => ({ ...h, [key]: e.target.value }))}
                style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                  border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
                  background: T.surface, color: T.ink, boxSizing: "border-box" }} />
            </div>
          ))}
          {harvErr && <div style={{ color: "#ef4444", fontSize: 13 }}>{harvErr}</div>}
          <Button full onClick={handleAddHarvest} loading={harvSaving}>
            {tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
