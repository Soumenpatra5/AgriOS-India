import { useState, useEffect, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { T } from "../../theme/ThemeProvider.jsx";
import { useApp } from "../../store/AppStore.jsx";
import {
  AppBar, Card, Button, EmptyState, ErrorState, Spinner, IconTile, BottomSheet
} from "../../components/index.js";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { cropApi, FARM_ERROR } from "../../services/crop/cropApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const STATUS_LABEL = {
  fallow:     { en: "Fallow",      hi: "परती",       bn: "পতিত" },
  sowing:     { en: "Sowing",      hi: "बुवाई",       bn: "বপন" },
  growing:    { en: "Growing",     hi: "उगाई",        bn: "বেড়ে উঠছে" },
  ready:      { en: "Ready",       hi: "तैयार",        bn: "প্রস্তুত" },
  harvesting: { en: "Harvesting",  hi: "कटाई",        bn: "ফসল কাটা" },
  inactive:   { en: "Inactive",    hi: "निष्क्रिय",   bn: "নিষ্ক্রিয়" },
};
const STATUS_COLOR = {
  fallow: T.inkFaint, sowing: T.primary, growing: "#22c55e",
  ready: T.orange, harvesting: "#f97316", inactive: T.inkFaint,
};

function MetricTile({ label, value, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: T.surface2, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: T.display, color: T.ink }}>{value}</div>
      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function FieldCard({ field, tc, onTap }) {
  const statusLabel = tc(STATUS_LABEL[field.current_status] ?? { en: field.current_status });
  const statusColor = STATUS_COLOR[field.current_status] ?? T.inkSoft;
  return (
    <Card pad={0}>
      <button
        onClick={onTap}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 12px",
          background: "none", border: "none", cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
        <IconTile name="Sprout" accent="primary" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{field.name}</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
            {field.area ? `${field.area} ${field.area_unit} · ` : ""}
            {field.current_crop || tc({ en: "No crop set", hi: "फसल नहीं", bn: "ফসল নেই" })}
          </div>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: statusColor,
          background: `${statusColor}18`, borderRadius: 8, padding: "3px 8px" }}>
          {statusLabel}
        </span>
      </button>
    </Card>
  );
}

const CROP_TYPES = [
  "rice","wheat","maize","cotton","sugarcane","mustard","soybean",
  "chickpea","potato","onion","tomato","vegetables","pulses","oilseeds","fruit","other",
];
const AREA_UNITS = ["acres","bigha","hectare","guntha"];

export default function CropDashboard() {
  const { pop, push, tc } = useApp();
  const [space, setSpace]       = useState(null);
  const [metrics, setMetrics]   = useState(null);
  const [fields, setFields]     = useState([]);
  const [state, setState]       = useState("loading");
  const [reason, setReason]     = useState(null);
  const [filter, setFilter]     = useState("active");
  const [showAdd, setShowAdd]   = useState(false);

  const [form, setForm]         = useState({
    name: "", cropType: "other", area: "", areaUnit: "acres",
    currentCrop: "", season: "", notes: "",
  });
  const [saving, setSaving]     = useState(false);
  const [formErr, setFormErr]   = useState(null);

  const load = useCallback(async () => {
    try {
      const sp = await farmSpaceService.active();
      if (!sp) { setState("error"); setReason(FARM_ERROR.NOT_FOUND); return; }
      setSpace(sp);
      const [m, f] = await Promise.all([
        cropApi.fieldMetrics(sp.id),
        cropApi.listFields(sp.id, { includeInactive: filter === "all" }),
      ]);
      setMetrics(m);
      setFields(f);
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const canManage  = space && farmSpaceService.can(space, "farm.crop.manage");
  const canFinance = space && farmSpaceService.can(space, "farm.crop.finance");

  const readyFields = fields.filter(f => f.current_status === "ready");

  const handleAddField = async () => {
    if (!form.name.trim()) { setFormErr(tc({ en: "Field name required", hi: "खेत का नाम ज़रूरी है", bn: "মাঠের নাম আবশ্যক" })); return; }
    setSaving(true); setFormErr(null);
    try {
      await cropApi.createField(space.id, {
        name: form.name.trim(), cropType: form.cropType,
        area: form.area ? Number(form.area) : undefined, areaUnit: form.areaUnit,
        currentCrop: form.currentCrop || undefined, season: form.season || undefined,
        notes: form.notes || undefined,
        clientUuid: `field-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setShowAdd(false);
      setForm({ name: "", cropType: "other", area: "", areaUnit: "acres", currentCrop: "", season: "", notes: "" });
      load();
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const title = tc({ en: "Crop & Fields", hi: "फसल और खेत", bn: "ফসল ও মাঠ" });

  if (state === "loading") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  }
  if (state === "error") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;
  }

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Metrics strip */}
        {metrics && (
          <div style={{ display: "flex", gap: 8 }}>
            <MetricTile
              label={tc({ en: "Active fields", hi: "सक्रिय खेत", bn: "সক্রিয় মাঠ" })}
              value={metrics.active_fields ?? 0} />
            <MetricTile
              label={tc({ en: "Growing", hi: "उगाई", bn: "বেড়ে উঠছে" })}
              value={metrics.growing_count ?? 0} />
            <MetricTile
              label={tc({ en: "Ready", hi: "तैयार", bn: "প্রস্তুত" })}
              value={metrics.ready_count ?? 0} />
          </div>
        )}

        {/* Ready-to-harvest alert */}
        {readyFields.length > 0 && (
          <div style={{ background: `${T.orange}18`, border: `1px solid ${T.orange}40`,
            borderRadius: 12, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <AlertTriangle size={18} style={{ color: T.orange, flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: T.ink }}>
              <strong>{readyFields.length}</strong>{" "}
              {tc({
                en: `field${readyFields.length > 1 ? "s" : ""} ready to harvest`,
                hi: `खेत कटाई के लिए तैयार`,
                bn: `মাঠ ফসল কাটার জন্য প্রস্তুত`,
              })}:{" "}
              {readyFields.map(f => f.name).join(", ")}
            </div>
          </div>
        )}

        {/* Finance summary (managers) */}
        {canFinance && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
                {tc({ en: "Finance", hi: "वित्त", bn: "অর্থ" })}
              </div>
              <Button size="sm" variant="soft" onClick={() => push({ kind: "cropFinance" })}>
                {tc({ en: "Details", hi: "विवरण", bn: "বিবরণ" })}
              </Button>
            </div>
          </Card>
        )}

        {/* Filter + add */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {["active","all"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                fontFamily: T.body, fontSize: 13, fontWeight: filter === f ? 700 : 400,
                background: filter === f ? T.primary : T.surface2,
                color: filter === f ? "#fff" : T.inkSoft }}>
              {f === "active"
                ? tc({ en: "Active", hi: "सक्रिय", bn: "সক্রিয়" })
                : tc({ en: "All", hi: "सभी", bn: "সব" })}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {canManage && (
            <Button size="sm" onClick={() => setShowAdd(true)}>
              + {tc({ en: "Add Field", hi: "खेत जोड़ें", bn: "মাঠ যোগ করুন" })}
            </Button>
          )}
        </div>

        {/* Field list */}
        {fields.length === 0 ? (
          <EmptyState icon="Sprout"
            title={tc({ en: "No fields yet", hi: "अभी कोई खेत नहीं", bn: "এখনও কোনও মাঠ নেই" })}
            body={canManage
              ? tc({ en: "Add your first field to start tracking.", hi: "ट्रैकिंग शुरू करने के लिए पहला खेत जोड़ें।", bn: "ট্র্যাকিং শুরু করতে প্রথম মাঠ যোগ করুন।" })
              : tc({ en: "No fields have been added yet.", hi: "अभी कोई खेत नहीं जोड़ा गया।", bn: "এখনও কোনও মাঠ যোগ করা হয়নি।" })} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fields.map(f => (
              <FieldCard key={f.id} field={f} tc={tc}
                onTap={() => push({ kind: "fieldDetail", props: { fieldId: f.id } })} />
            ))}
          </div>
        )}
      </div>

      {/* Add Field bottom sheet */}
      <BottomSheet open={showAdd} onClose={() => setShowAdd(false)}
        title={tc({ en: "Add Field", hi: "खेत जोड़ें", bn: "মাঠ যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
          <div>
            <label style={{ fontSize: 12, color: T.inkSoft }}>
              {tc({ en: "Field name *", hi: "खेत का नाम *", bn: "মাঠের নাম *" })}
            </label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={tc({ en: "e.g. North field", hi: "जैसे उत्तरी खेत", bn: "যেমন উত্তরের মাঠ" })}
              style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
                background: T.surface, color: T.ink, boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: T.inkSoft }}>
                {tc({ en: "Area", hi: "क्षेत्रफल", bn: "ক্ষেত্রফল" })}
              </label>
              <input type="number" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                placeholder="0"
                style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                  border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
                  background: T.surface, color: T.ink, boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: T.inkSoft }}>
                {tc({ en: "Unit", hi: "इकाई", bn: "একক" })}
              </label>
              <select value={form.areaUnit} onChange={e => setForm(f => ({ ...f, areaUnit: e.target.value }))}
                style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                  border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
                  background: T.surface, color: T.ink, boxSizing: "border-box" }}>
                {AREA_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: T.inkSoft }}>
              {tc({ en: "Crop type", hi: "फसल प्रकार", bn: "ফসলের ধরন" })}
            </label>
            <select value={form.cropType} onChange={e => setForm(f => ({ ...f, cropType: e.target.value }))}
              style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
                background: T.surface, color: T.ink, boxSizing: "border-box" }}>
              {CROP_TYPES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: T.inkSoft }}>
              {tc({ en: "Current crop name", hi: "वर्तमान फसल", bn: "বর্তমান ফসলের নাম" })}
            </label>
            <input value={form.currentCrop} onChange={e => setForm(f => ({ ...f, currentCrop: e.target.value }))}
              placeholder={tc({ en: "e.g. Basmati rice", hi: "जैसे बासमती चावल", bn: "যেমন বাসমতি ধান" })}
              style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
                background: T.surface, color: T.ink, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: T.inkSoft }}>
              {tc({ en: "Notes", hi: "नोट्स", bn: "নোট" })}
            </label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 10,
                border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14, resize: "none",
                background: T.surface, color: T.ink, boxSizing: "border-box" }} />
          </div>
          {formErr && <div style={{ color: "#ef4444", fontSize: 13 }}>{formErr}</div>}
          <Button full onClick={handleAddField} loading={saving}>
            {tc({ en: "Add field", hi: "खेत जोड़ें", bn: "মাঠ যোগ করুন" })}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
