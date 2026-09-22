import { useState, useEffect, useCallback, useRef } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { beeApi } from "../../services/bee/beeApi.js";

const today = () => new Date().toISOString().slice(0, 10);

const fmt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtKg = (v) => v != null ? `${Number(v).toFixed(2)} kg` : "—";
const fmtRs = (v) => v != null ? `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—";

const HIVE_STATUS_OPTS = [
  { value: "active",    label: { en: "Active",    hi: "सक्रिय",      bn: "সক্রিয়"    } },
  { value: "queenless", label: { en: "Queenless", hi: "रानी रहित",   bn: "রানী নেই"  } },
  { value: "weak",      label: { en: "Weak",      hi: "कमज़ोर",       bn: "দুর্বল"     } },
  { value: "dead",      label: { en: "Dead",      hi: "मृत",         bn: "মৃত"        } },
  { value: "merged",    label: { en: "Merged",    hi: "विलय हुआ",    bn: "মিলিত"     } },
  { value: "archived",  label: { en: "Archived",  hi: "संग्रहीत",     bn: "আর্কাইভ"   } },
];

const STATUS_CFG = {
  active:     { fg: T.primary, bg: T.primarySoft },
  queenless:  { fg: T.red,     bg: T.redSoft     },
  weak:       { fg: T.orange,  bg: "#fff3e8"     },
  dead:       { fg: T.inkSoft, bg: T.surface2    },
  merged:     { fg: T.inkSoft, bg: T.surface2    },
  archived:   { fg: T.inkSoft, bg: T.surface2    },
};

const PRODUCT_TYPE_OPTS = [
  { value: "honey",       label: { en: "Honey",       hi: "शहद",       bn: "মধু"       } },
  { value: "beeswax",     label: { en: "Beeswax",     hi: "मोम",        bn: "মোম"       } },
  { value: "propolis",    label: { en: "Propolis",    hi: "प्रोपोलिस",  bn: "প্রপোলিস"  } },
  { value: "pollen",      label: { en: "Pollen",      hi: "पराग",      bn: "পরাগ"       } },
  { value: "royal_jelly", label: { en: "Royal Jelly", hi: "रॉयल जेली", bn: "রয়্যাল জেলি" } },
  { value: "other",       label: { en: "Other",       hi: "अन्य",      bn: "অন্যান্য"    } },
];

const TREATMENT_TYPE_OPTS = [
  { value: "oxalic_acid",  label: "Oxalic acid" },
  { value: "formic_acid",  label: "Formic acid" },
  { value: "amitraz",      label: "Amitraz"     },
  { value: "antibiotic",   label: "Antibiotic"  },
  { value: "other",        label: "Other"       },
];

const VARROA_OPTS = [
  { value: "low",         label: { en: "Low",         hi: "कम",         bn: "কম"       } },
  { value: "moderate",    label: { en: "Moderate",    hi: "मध्यम",      bn: "মাঝারি"   } },
  { value: "high",        label: { en: "High",        hi: "उच्च",       bn: "বেশি"     } },
  { value: "not_checked", label: { en: "Not checked", hi: "जाँच नहीं",  bn: "পরীক্ষা হয়নি" } },
];

const QUEEN_STATUS_OPTS = [
  { value: "present",     label: { en: "Present",    hi: "मौजूद",      bn: "আছে"       } },
  { value: "absent",      label: { en: "Absent",     hi: "अनुपस्थित",   bn: "নেই"       } },
  { value: "superseded",  label: { en: "Superseded", hi: "प्रतिस्थापित", bn: "প্রতিস্থাপিত" } },
  { value: "unknown",     label: { en: "Unknown",    hi: "अज्ञात",      bn: "অজানা"     } },
];

const STRENGTH_LABEL = { 1: "1 – Very weak", 2: "2 – Weak", 3: "3 – Average", 4: "4 – Strong", 5: "5 – Very strong" };

function SectionHeader({ title, onAdd, canAdd }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "14px 16px 6px" }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, fontFamily: T.body,
        textTransform: "uppercase", letterSpacing: 0.8 }}>
        {title}
      </span>
      {canAdd && (
        <button onClick={onAdd} style={{ background: "none", border: "none", cursor: "pointer",
          color: T.primary, fontFamily: T.body, fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="Plus" size={14} color={T.primary} />
          {tc => tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
        </button>
      )}
    </div>
  );
}

function RecordRow({ icon, iconColor, title, subtitle, onDelete, canDelete }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px",
      borderBottom: `1px solid ${T.line}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: T.surface2,
        display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name={icon} size={16} color={iconColor || T.inkSoft} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, fontFamily: T.body }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2, fontFamily: T.body }}>{subtitle}</div>}
      </div>
      {canDelete && (
        <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer",
          padding: 4, flexShrink: 0 }}>
          <Icon name="Trash2" size={15} color={T.red} />
        </button>
      )}
    </div>
  );
}

export default function HiveDetail({ hiveId, spaceId }) {
  const { tc, pop, push, toast } = useApp();

  const [state,       setState]       = useState("loading");
  const [hive,        setHive]        = useState(null);
  const [space,       setSpace]       = useState(null);
  const [tab,         setTab]         = useState("overview");

  const [inspections, setInspections] = useState([]);
  const [harvests,    setHarvests]    = useState([]);
  const [treatments,  setTreatments]  = useState([]);

  const [addInspOpen,  setAddInspOpen]  = useState(false);
  const [addHarvOpen,  setAddHarvOpen]  = useState(false);
  const [addTreatOpen, setAddTreatOpen] = useState(false);
  const [statusOpen,   setStatusOpen]   = useState(false);
  const [busy,         setBusy]         = useState(false);

  const inspUuid  = useRef(crypto.randomUUID());
  const harvUuid  = useRef(crypto.randomUUID());
  const treatUuid = useRef(crypto.randomUUID());

  const blankInsp = () => ({
    inspectionDate: today(), colonyStrength: "3", queenStatus: "present",
    honeyFrames: "", broodFrames: "", varroaLevel: "not_checked",
    sawQueen: false, eggsPresent: false, diseaseSigns: "", actionTaken: "",
    nextInspection: "", notes: "",
  });
  const blankHarv = () => ({
    harvestDate: today(), productType: "honey",
    quantityKg: "", qualityGrade: "", notes: "",
  });
  const blankTreat = () => ({
    treatmentDate: today(), treatmentType: "oxalic_acid",
    productName: "", dose: "", target: "varroa", notes: "",
  });
  const blankStatus = () => ({ status: hive?.current_status || "active", notes: "" });

  const [inspForm,  setInspForm]  = useState(blankInsp);
  const [harvForm,  setHarvForm]  = useState(blankHarv);
  const [treatForm, setTreatForm] = useState(blankTreat);
  const [statusForm, setStatusForm] = useState({ status: "active", notes: "" });

  const [deleteInspId,  setDeleteInspId]  = useState(null);
  const [deleteHarvId,  setDeleteHarvId]  = useState(null);
  const [deleteTreatId, setDeleteTreatId] = useState(null);

  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      setSpace(active);
      const [hiveData, history] = await Promise.all([
        beeApi.getHive(active.id, { hiveId }),
        beeApi.hiveHistory(active.id, { hiveId }),
      ]);
      setHive(hiveData);
      setInspections(history.inspections || []);
      setHarvests(history.harvests || []);
      setTreatments(history.treatments || []);
      setStatusForm({ status: hiveData.current_status, notes: "" });
      setState("ready");
    } catch (err) {
      setState("error");
    }
  }, [hiveId]);

  useEffect(() => { load(); }, [load]);

  const canRecord = space && farmSpaceService.can(space, "farm.bee.record");
  const canManage = space && farmSpaceService.can(space, "farm.bee.manage");
  const isTerminal = hive && ["dead","merged","archived"].includes(hive.current_status);

  /* ── add inspection ──────────────────────────────────────────────────────── */
  const saveInspection = async () => {
    setBusy(true);
    try {
      const row = await beeApi.addInspection(space.id, {
        hiveId,
        inspectionDate: inspForm.inspectionDate,
        colonyStrength: inspForm.colonyStrength ? parseInt(inspForm.colonyStrength, 10) : null,
        queenStatus:    inspForm.queenStatus || null,
        honeyFrames:    inspForm.honeyFrames  ? parseFloat(inspForm.honeyFrames)  : null,
        broodFrames:    inspForm.broodFrames  ? parseFloat(inspForm.broodFrames)  : null,
        varroaLevel:    inspForm.varroaLevel  || null,
        sawQueen:       inspForm.sawQueen,
        eggsPresent:    inspForm.eggsPresent,
        diseaseSigns:   inspForm.diseaseSigns  || null,
        actionTaken:    inspForm.actionTaken   || null,
        nextInspection: inspForm.nextInspection || null,
        notes:          inspForm.notes         || null,
        clientUuid:     inspUuid.current,
      });
      inspUuid.current = crypto.randomUUID();
      setInspections((prev) => [row, ...prev]);
      setAddInspOpen(false);
      setInspForm(blankInsp());
      toast(tc({ en: "Inspection saved", hi: "निरीक्षण सहेजा गया", bn: "পরিদর্শন সংরক্ষিত" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setBusy(false); }
  };

  /* ── add harvest ─────────────────────────────────────────────────────────── */
  const saveHarvest = async () => {
    if (!harvForm.quantityKg || parseFloat(harvForm.quantityKg) <= 0) {
      toast(tc({ en: "Quantity must be > 0", hi: "मात्रा > 0 चाहिए", bn: "পরিমাণ > 0 হতে হবে" }), "error");
      return;
    }
    setBusy(true);
    try {
      const row = await beeApi.addHarvest(space.id, {
        hiveId,
        harvestDate:  harvForm.harvestDate,
        productType:  harvForm.productType,
        quantityKg:   parseFloat(harvForm.quantityKg),
        qualityGrade: harvForm.qualityGrade || null,
        notes:        harvForm.notes        || null,
        clientUuid:   harvUuid.current,
      });
      harvUuid.current = crypto.randomUUID();
      setHarvests((prev) => [row, ...prev]);
      setAddHarvOpen(false);
      setHarvForm(blankHarv());
      toast(tc({ en: "Harvest recorded", hi: "फसल दर्ज की गई", bn: "ফসল রেকর্ড হয়েছে" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setBusy(false); }
  };

  /* ── add treatment ───────────────────────────────────────────────────────── */
  const saveTreatment = async () => {
    setBusy(true);
    try {
      const row = await beeApi.addTreatment(space.id, {
        hiveId,
        treatmentDate: treatForm.treatmentDate,
        treatmentType: treatForm.treatmentType,
        productName:   treatForm.productName  || null,
        dose:          treatForm.dose         || null,
        target:        treatForm.target       || null,
        notes:         treatForm.notes        || null,
        clientUuid:    treatUuid.current,
      });
      treatUuid.current = crypto.randomUUID();
      setTreatments((prev) => [row, ...prev]);
      setAddTreatOpen(false);
      setTreatForm(blankTreat());
      toast(tc({ en: "Treatment recorded", hi: "उपचार दर्ज किया गया", bn: "চিকিৎসা রেকর্ড হয়েছে" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setBusy(false); }
  };

  /* ── set hive status ─────────────────────────────────────────────────────── */
  const saveStatus = async () => {
    setBusy(true);
    try {
      const updated = await beeApi.setStatus(space.id, {
        hiveId, status: statusForm.status, notes: statusForm.notes || null,
      });
      setHive(updated);
      setStatusOpen(false);
      toast(tc({ en: "Status updated", hi: "स्थिति अपडेट हुई", bn: "স্ট্যাটাস আপডেট হয়েছে" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setBusy(false); }
  };

  /* ── deletes ─────────────────────────────────────────────────────────────── */
  const doDeleteInspection = async (id) => {
    try {
      await beeApi.deleteInspection(space.id, { inspectionId: id });
      setInspections((prev) => prev.filter((r) => r.id !== id));
      setDeleteInspId(null);
      toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে ফেলা হয়েছে" }), "success");
    } catch (err) { toast(err.message, "error"); }
  };

  const doDeleteHarvest = async (id) => {
    try {
      await beeApi.deleteHarvest(space.id, { harvestId: id });
      setHarvests((prev) => prev.filter((r) => r.id !== id));
      setDeleteHarvId(null);
      toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে ফেলা হয়েছে" }), "success");
    } catch (err) { toast(err.message, "error"); }
  };

  const doDeleteTreatment = async (id) => {
    try {
      await beeApi.deleteTreatment(space.id, { treatmentId: id });
      setTreatments((prev) => prev.filter((r) => r.id !== id));
      setDeleteTreatId(null);
      toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে ফেলা হয়েছে" }), "success");
    } catch (err) { toast(err.message, "error"); }
  };

  const bar = (
    <AppBar
      title={hive?.name || tc({ en: "Hive", hi: "पेटी", bn: "মৌচাক" })}
      onBack={pop}
      action={canManage && hive && (
        <button
          onClick={() => setStatusOpen(true)}
          style={{ background: T.surface2, border: "none", borderRadius: 10, padding: "7px 11px",
            cursor: "pointer", fontSize: 12, fontWeight: 600, color: T.inkSoft, fontFamily: T.body }}>
          {tc({ en: "Status", hi: "स्थिति", bn: "স্ট্যাটাস" })}
        </button>
      )}
    />
  );

  if (state === "loading") return <>{bar}<div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error")   return <>{bar}<div style={{ padding: 20 }}><ErrorState body={tc({ en: "Could not load hive", hi: "पेटी लोड नहीं हुई", bn: "মৌচাক লোড হয়নি" })} onRetry={load} /></div></>;

  const stCfg = STATUS_CFG[hive.current_status] || STATUS_CFG.active;

  return (
    <>
      {bar}

      {/* Status badge */}
      <div style={{ padding: "8px 16px 0", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: stCfg.fg, background: stCfg.bg,
          borderRadius: 8, padding: "3px 10px", fontFamily: T.body }}>
          {tc((HIVE_STATUS_OPTS.find(s => s.value === hive.current_status) || HIVE_STATUS_OPTS[0]).label)}
        </span>
        {hive.hive_type && (
          <span style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>
            {hive.hive_type.replace("_", " ")}
          </span>
        )}
        {hive.queen_year && (
          <span style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>
            · {tc({ en: "Queen", hi: "रानी", bn: "রানী" })} {hive.queen_year}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "10px 16px 0", borderBottom: `1px solid ${T.line}` }}>
        {["overview","inspections","harvests","treatments"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? T.primary : "none",
            color: tab === t ? "#fff" : T.inkSoft,
            border: "none", borderRadius: 8, padding: "6px 12px",
            cursor: "pointer", fontFamily: T.body, fontSize: 12.5, fontWeight: 600,
          }}>
            {tc({
              overview:    { en: "Overview",    hi: "अवलोकन",    bn: "সারসংক্ষেপ" },
              inspections: { en: "Inspections", hi: "निरीक्षण",  bn: "পরিদর্শন"   },
              harvests:    { en: "Harvests",    hi: "फसल",       bn: "ফসল"         },
              treatments:  { en: "Treatments",  hi: "उपचार",     bn: "চিকিৎসা"     },
            }[t])}
          </button>
        ))}
      </div>

      {/* ── Overview ────────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div style={{ padding: "12px 16px" }}>
          <Card>
            {[
              [tc({ en: "Installation date", hi: "स्थापना तिथि", bn: "স্থাপনার তারিখ" }), fmt(hive.installation_date)],
              [tc({ en: "Source", hi: "स्रोत", bn: "উৎস" }), hive.source || "—"],
              [tc({ en: "Queen year", hi: "रानी वर्ष", bn: "রানীর বছর" }), hive.queen_year || "—"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between",
                padding: "9px 0", borderBottom: `1px solid ${T.line}`,
                fontSize: 13, fontFamily: T.body }}>
                <span style={{ color: T.inkSoft }}>{k}</span>
                <span style={{ color: T.ink, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            {hive.notes && (
              <div style={{ padding: "9px 0", fontSize: 13, color: T.inkSoft, fontFamily: T.body }}>
                {hive.notes}
              </div>
            )}
          </Card>

          {hive.last_inspection && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, fontFamily: T.body,
                textTransform: "uppercase", letterSpacing: 0.8, padding: "14px 0 6px" }}>
                {tc({ en: "Last inspection", hi: "अंतिम निरीक्षण", bn: "শেষ পরিদর্শন" })}
              </div>
              <Card>
                {[
                  [tc({ en: "Date", hi: "तारीख", bn: "তারিখ" }), fmt(hive.last_inspection.inspection_date)],
                  [tc({ en: "Colony strength", hi: "कॉलोनी शक्ति", bn: "কলোনির শক্তি" }),
                    hive.last_inspection.colony_strength ? STRENGTH_LABEL[hive.last_inspection.colony_strength] : "—"],
                  [tc({ en: "Queen status", hi: "रानी स्थिति", bn: "রানীর অবস্থা" }), hive.last_inspection.queen_status || "—"],
                  [tc({ en: "Varroa", hi: "वारोआ", bn: "ভ্যারোয়া" }), hive.last_inspection.varroa_level || "—"],
                  [tc({ en: "Honey frames", hi: "शहद फ्रेम", bn: "মধু ফ্রেম" }), hive.last_inspection.honey_frames ?? "—"],
                  [tc({ en: "Brood frames", hi: "ब्रूड फ्रेम", bn: "ব্রুড ফ্রেম" }), hive.last_inspection.brood_frames ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between",
                    padding: "8px 0", borderBottom: `1px solid ${T.line}`,
                    fontSize: 13, fontFamily: T.body }}>
                    <span style={{ color: T.inkSoft }}>{k}</span>
                    <span style={{ color: T.ink, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── Inspections ─────────────────────────────────────────────────────── */}
      {tab === "inspections" && (
        <>
          {!isTerminal && canRecord && (
            <div style={{ padding: "12px 16px 0" }}>
              <Button label={tc({ en: "+ Add Inspection", hi: "+ निरीक्षण जोड़ें", bn: "+ পরিদর্শন যোগ" })}
                onPress={() => setAddInspOpen(true)} fullWidth />
            </div>
          )}
          <div style={{ padding: "8px 0" }}>
            {inspections.length === 0 ? (
              <EmptyState icon="Search" title={tc({ en: "No inspections yet", hi: "कोई निरीक्षण नहीं", bn: "পরিদর্শন নেই" })} />
            ) : inspections.map((r) => (
              <RecordRow
                key={r.id}
                icon="Search"
                iconColor={T.primary}
                title={`${fmt(r.inspection_date)} — ${r.colony_strength ? STRENGTH_LABEL[r.colony_strength] : "—"}`}
                subtitle={[r.queen_status, r.varroa_level !== "not_checked" && `Varroa: ${r.varroa_level}`,
                  r.disease_signs && `Signs: ${r.disease_signs}`].filter(Boolean).join(" · ")}
                canDelete={canManage}
                onDelete={() => setDeleteInspId(r.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Harvests ────────────────────────────────────────────────────────── */}
      {tab === "harvests" && (
        <>
          {!isTerminal && canRecord && (
            <div style={{ padding: "12px 16px 0" }}>
              <Button label={tc({ en: "+ Record Harvest", hi: "+ फसल दर्ज करें", bn: "+ ফসল রেকর্ড করুন" })}
                onPress={() => setAddHarvOpen(true)} fullWidth />
            </div>
          )}
          <div style={{ padding: "8px 0" }}>
            {harvests.length === 0 ? (
              <EmptyState icon="Droplets" title={tc({ en: "No harvests yet", hi: "कोई फसल नहीं", bn: "ফসল নেই" })} />
            ) : harvests.map((r) => (
              <RecordRow
                key={r.id}
                icon="Droplets"
                iconColor={T.orange}
                title={`${fmt(r.harvest_date)} — ${fmtKg(r.quantity_kg)}`}
                subtitle={[r.product_type?.replace("_", " "), r.quality_grade && `Grade: ${r.quality_grade}`,
                  r.notes].filter(Boolean).join(" · ")}
                canDelete={canManage}
                onDelete={() => setDeleteHarvId(r.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Treatments ──────────────────────────────────────────────────────── */}
      {tab === "treatments" && (
        <>
          {!isTerminal && canRecord && (
            <div style={{ padding: "12px 16px 0" }}>
              <Button label={tc({ en: "+ Add Treatment", hi: "+ उपचार जोड़ें", bn: "+ চিকিৎসা যোগ" })}
                onPress={() => setAddTreatOpen(true)} fullWidth />
            </div>
          )}
          <div style={{ padding: "8px 0" }}>
            {treatments.length === 0 ? (
              <EmptyState icon="Syringe" title={tc({ en: "No treatments yet", hi: "कोई उपचार नहीं", bn: "চিকিৎসা নেই" })} />
            ) : treatments.map((r) => (
              <RecordRow
                key={r.id}
                icon="Syringe"
                iconColor={T.red}
                title={`${fmt(r.treatment_date)} — ${r.treatment_type?.replace("_", " ")}`}
                subtitle={[r.product_name, r.dose && `Dose: ${r.dose}`,
                  r.target && `Target: ${r.target}`].filter(Boolean).join(" · ")}
                canDelete={canManage}
                onDelete={() => setDeleteTreatId(r.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Add Inspection Sheet ─────────────────────────────────────────────── */}
      <BottomSheet open={addInspOpen} onClose={() => { setAddInspOpen(false); setInspForm(blankInsp()); }}>
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, fontFamily: T.display, marginBottom: 16 }}>
            {tc({ en: "Add Inspection", hi: "निरीक्षण जोड़ें", bn: "পরিদর্শন যোগ করুন" })}
          </div>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *" })} type="date"
            value={inspForm.inspectionDate}
            onChange={(v) => setInspForm((f) => ({ ...f, inspectionDate: v }))} />
          <Dropdown
            label={tc({ en: "Colony strength", hi: "कॉलोनी शक्ति", bn: "কলোনির শক্তি" })}
            value={inspForm.colonyStrength}
            onChange={(v) => setInspForm((f) => ({ ...f, colonyStrength: v }))}
            options={[1,2,3,4,5].map(n => ({ value: String(n), label: STRENGTH_LABEL[n] }))} />
          <Dropdown
            label={tc({ en: "Queen status", hi: "रानी स्थिति", bn: "রানীর অবস্থা" })}
            value={inspForm.queenStatus}
            onChange={(v) => setInspForm((f) => ({ ...f, queenStatus: v }))}
            options={QUEEN_STATUS_OPTS.map(o => ({ value: o.value, label: tc(o.label) }))} />
          <Dropdown
            label={tc({ en: "Varroa level", hi: "वारोआ स्तर", bn: "ভ্যারোয়া স্তর" })}
            value={inspForm.varroaLevel}
            onChange={(v) => setInspForm((f) => ({ ...f, varroaLevel: v }))}
            options={VARROA_OPTS.map(o => ({ value: o.value, label: tc(o.label) }))} />
          <Input label={tc({ en: "Honey frames", hi: "शहद फ्रेम", bn: "মধু ফ্রেম" })} type="number"
            value={inspForm.honeyFrames}
            onChange={(v) => setInspForm((f) => ({ ...f, honeyFrames: v }))} />
          <Input label={tc({ en: "Brood frames", hi: "ब्रूड फ्रेम", bn: "ব্রুড ফ্রেম" })} type="number"
            value={inspForm.broodFrames}
            onChange={(v) => setInspForm((f) => ({ ...f, broodFrames: v }))} />
          <Input label={tc({ en: "Disease signs", hi: "रोग के लक्षण", bn: "রোগের লক্ষণ" })}
            value={inspForm.diseaseSigns}
            onChange={(v) => setInspForm((f) => ({ ...f, diseaseSigns: v }))} />
          <Input label={tc({ en: "Action taken", hi: "की गई कार्रवाई", bn: "গৃহীত পদক্ষেপ" })}
            value={inspForm.actionTaken}
            onChange={(v) => setInspForm((f) => ({ ...f, actionTaken: v }))} />
          <Input label={tc({ en: "Next inspection date", hi: "अगली निरीक्षण तारीख", bn: "পরবর্তী পরিদর্শনের তারিখ" })} type="date"
            value={inspForm.nextInspection}
            onChange={(v) => setInspForm((f) => ({ ...f, nextInspection: v }))} />
          <Input label={tc({ en: "Notes", hi: "नोट्स", bn: "নোট" })} multiline
            value={inspForm.notes}
            onChange={(v) => setInspForm((f) => ({ ...f, notes: v }))} />
          <Button label={busy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ" })}
            onPress={saveInspection} disabled={busy} fullWidth />
        </div>
      </BottomSheet>

      {/* ── Add Harvest Sheet ─────────────────────────────────────────────────── */}
      <BottomSheet open={addHarvOpen} onClose={() => { setAddHarvOpen(false); setHarvForm(blankHarv()); }}>
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, fontFamily: T.display, marginBottom: 16 }}>
            {tc({ en: "Record Harvest", hi: "फसल दर्ज करें", bn: "ফসল রেকর্ড করুন" })}
          </div>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *" })} type="date"
            value={harvForm.harvestDate}
            onChange={(v) => setHarvForm((f) => ({ ...f, harvestDate: v }))} />
          <Dropdown
            label={tc({ en: "Product type", hi: "उत्पाद प्रकार", bn: "পণ্যের ধরন" })}
            value={harvForm.productType}
            onChange={(v) => setHarvForm((f) => ({ ...f, productType: v }))}
            options={PRODUCT_TYPE_OPTS.map(o => ({ value: o.value, label: tc(o.label) }))} />
          <Input label={tc({ en: "Quantity (kg) *", hi: "मात्रा (kg) *", bn: "পরিমাণ (kg) *" })} type="number"
            value={harvForm.quantityKg}
            onChange={(v) => setHarvForm((f) => ({ ...f, quantityKg: v }))} />
          <Input label={tc({ en: "Quality grade", hi: "गुणवत्ता ग्रेड", bn: "গুণমান গ্রেড" })}
            value={harvForm.qualityGrade}
            onChange={(v) => setHarvForm((f) => ({ ...f, qualityGrade: v }))}
            placeholder="A / B / mixed" />
          <Input label={tc({ en: "Notes", hi: "नोट्स", bn: "নোট" })} multiline
            value={harvForm.notes}
            onChange={(v) => setHarvForm((f) => ({ ...f, notes: v }))} />
          <Button label={busy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ" })}
            onPress={saveHarvest} disabled={busy || !harvForm.quantityKg} fullWidth />
        </div>
      </BottomSheet>

      {/* ── Add Treatment Sheet ───────────────────────────────────────────────── */}
      <BottomSheet open={addTreatOpen} onClose={() => { setAddTreatOpen(false); setTreatForm(blankTreat()); }}>
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, fontFamily: T.display, marginBottom: 16 }}>
            {tc({ en: "Add Treatment", hi: "उपचार जोड़ें", bn: "চিকিৎসা যোগ করুন" })}
          </div>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *" })} type="date"
            value={treatForm.treatmentDate}
            onChange={(v) => setTreatForm((f) => ({ ...f, treatmentDate: v }))} />
          <Dropdown
            label={tc({ en: "Treatment type", hi: "उपचार प्रकार", bn: "চিকিৎসার ধরন" })}
            value={treatForm.treatmentType}
            onChange={(v) => setTreatForm((f) => ({ ...f, treatmentType: v }))}
            options={TREATMENT_TYPE_OPTS} />
          <Input label={tc({ en: "Product name", hi: "उत्पाद का नाम", bn: "পণ্যের নাম" })}
            value={treatForm.productName}
            onChange={(v) => setTreatForm((f) => ({ ...f, productName: v }))} />
          <Input label={tc({ en: "Dose", hi: "खुराक", bn: "ডোজ" })}
            value={treatForm.dose}
            onChange={(v) => setTreatForm((f) => ({ ...f, dose: v }))} />
          <Input label={tc({ en: "Target pest / disease", hi: "लक्ष्य कीट / रोग", bn: "লক্ষ্য পোকা / রোগ" })}
            value={treatForm.target}
            onChange={(v) => setTreatForm((f) => ({ ...f, target: v }))}
            placeholder="varroa / nosema / EFB" />
          <Input label={tc({ en: "Notes", hi: "नोट्स", bn: "নোট" })} multiline
            value={treatForm.notes}
            onChange={(v) => setTreatForm((f) => ({ ...f, notes: v }))} />
          <Button label={busy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ" })}
            onPress={saveTreatment} disabled={busy} fullWidth />
        </div>
      </BottomSheet>

      {/* ── Set Status Sheet ──────────────────────────────────────────────────── */}
      <BottomSheet open={statusOpen} onClose={() => setStatusOpen(false)}>
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, fontFamily: T.display, marginBottom: 16 }}>
            {tc({ en: "Change Status", hi: "स्थिति बदलें", bn: "স্ট্যাটাস পরিবর্তন করুন" })}
          </div>
          <Dropdown
            label={tc({ en: "New status", hi: "नई स्थिति", bn: "নতুন স্ট্যাটাস" })}
            value={statusForm.status}
            onChange={(v) => setStatusForm((f) => ({ ...f, status: v }))}
            options={HIVE_STATUS_OPTS.map(o => ({ value: o.value, label: tc(o.label) }))} />
          <Input label={tc({ en: "Notes (reason)", hi: "नोट्स (कारण)", bn: "নোট (কারণ)" })} multiline
            value={statusForm.notes}
            onChange={(v) => setStatusForm((f) => ({ ...f, notes: v }))} />
          <Button label={busy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ" })}
            onPress={saveStatus} disabled={busy} fullWidth />
        </div>
      </BottomSheet>

      {/* ── Confirm delete modals ─────────────────────────────────────────────── */}
      <BottomSheet open={!!deleteInspId} onClose={() => setDeleteInspId(null)}>
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontFamily: T.body, fontSize: 14, marginBottom: 16 }}>
            {tc({ en: "Delete this inspection record?", hi: "यह निरीक्षण हटाएँ?", bn: "এই পরিদর্শন মুছবেন?" })}
          </div>
          <Button label={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })} onPress={() => doDeleteInspection(deleteInspId)} fullWidth danger />
        </div>
      </BottomSheet>
      <BottomSheet open={!!deleteHarvId} onClose={() => setDeleteHarvId(null)}>
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontFamily: T.body, fontSize: 14, marginBottom: 16 }}>
            {tc({ en: "Delete this harvest record?", hi: "यह फसल रिकॉर्ड हटाएँ?", bn: "এই ফসলের রেকর্ড মুছবেন?" })}
          </div>
          <Button label={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })} onPress={() => doDeleteHarvest(deleteHarvId)} fullWidth danger />
        </div>
      </BottomSheet>
      <BottomSheet open={!!deleteTreatId} onClose={() => setDeleteTreatId(null)}>
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontFamily: T.body, fontSize: 14, marginBottom: 16 }}>
            {tc({ en: "Delete this treatment record?", hi: "यह उपचार रिकॉर्ड हटाएँ?", bn: "এই চিকিৎসার রেকর্ড মুছবেন?" })}
          </div>
          <Button label={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })} onPress={() => doDeleteTreatment(deleteTreatId)} fullWidth danger />
        </div>
      </BottomSheet>
    </>
  );
}
