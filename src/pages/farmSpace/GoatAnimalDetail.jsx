import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet, Dialog,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { goatApi } from "../../services/goat/goatApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const today = () => new Date().toISOString().slice(0, 10);

const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return String(d).slice(0, 10); }
};

const fmtDateShort = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
  catch { return String(d).slice(0, 10); }
};

const toDateInput = (d) => {
  if (!d) return "";
  try { return new Date(d).toISOString().slice(0, 10); }
  catch { return ""; }
};

const TERMINAL = new Set(["sold", "deceased", "retired"]);

const STATUS_CFG = {
  kid:      { label: { en: "Kid",      hi: "बच्चा",      bn: "বাচ্চা"      }, fg: T.primary,   bg: T.primarySoft },
  grower:   { label: { en: "Grower",   hi: "बढ़ता",       bn: "বেড়ে ওঠা"   }, fg: T.orange,    bg: "#fff3e8"     },
  milking:  { label: { en: "Milking",  hi: "दुधारू",      bn: "দুগ্ধবতী"    }, fg: T.blue,      bg: T.blueSoft   },
  dry:      { label: { en: "Dry",      hi: "शुष्क",       bn: "শুষ্ক"       }, fg: T.inkSoft,   bg: T.surface2   },
  breeding: { label: { en: "Breeding", hi: "प्रजनन",      bn: "প্রজনন"      }, fg: "#9b59b6",   bg: "#f4eef9"    },
  sold:     { label: { en: "Sold",     hi: "बेचा",        bn: "বিক্রিত"     }, fg: "#6b6b6b",   bg: "#f0f0f0"    },
  deceased: { label: { en: "Deceased", hi: "मृत",         bn: "মৃত"         }, fg: "#6b6b6b",   bg: "#f0f0f0"    },
  retired:  { label: { en: "Retired",  hi: "सेवानिवृत्त", bn: "অবসরপ্রাপ্ত" }, fg: "#6b6b6b",   bg: "#f0f0f0"    },
};

const ALL_STATUSES = [
  { value: "kid",      label: { en: "Kid",      hi: "बच्चा",      bn: "বাচ্চা"      } },
  { value: "grower",   label: { en: "Grower",   hi: "बढ़ता",       bn: "বেড়ে ওঠা"   } },
  { value: "milking",  label: { en: "Milking",  hi: "दुधारू",      bn: "দুগ্ধবতী"    } },
  { value: "dry",      label: { en: "Dry",      hi: "शुष्क",       bn: "শুষ্ক"       } },
  { value: "breeding", label: { en: "Breeding", hi: "प्रजनन",      bn: "প্রজনন"      } },
  { value: "sold",     label: { en: "Sold",     hi: "बेचा",        bn: "বিক্রিত"     } },
  { value: "deceased", label: { en: "Deceased", hi: "मृत",         bn: "মৃত"         } },
  { value: "retired",  label: { en: "Retired",  hi: "सेवानिवृत्त", bn: "অবসরপ্রাপ্ত" } },
];

const REPRO_EVENT_TYPES = [
  { value: "heat_observed",   label: { en: "Heat observed",   hi: "गर्मी देखी",     bn: "তাপ দেখা গেছে"  } },
  { value: "mating",          label: { en: "Mating",          hi: "संभोग",          bn: "মিলন"            } },
  { value: "pregnancy_check", label: { en: "Pregnancy check", hi: "गर्भ जाँच",       bn: "গর্ভ পরীক্ষা"  } },
  { value: "kidding",         label: { en: "Kidding",         hi: "ब्याना",          bn: "বাচ্চা দেওয়া"  } },
  { value: "weaning",         label: { en: "Weaning",         hi: "दूध छुड़ाना",     bn: "দুধ ছাড়ানো"    } },
  { value: "abortion",        label: { en: "Abortion",        hi: "गर्भपात",         bn: "গর্ভপাত"        } },
  { value: "other",           label: { en: "Other",           hi: "अन्य",            bn: "অন্যান্য"       } },
];

const PREG_RESULT_OPTIONS = [
  { value: "positive",     label: { en: "Positive",     hi: "सकारात्मक", bn: "ইতিবাচক" } },
  { value: "negative",     label: { en: "Negative",     hi: "नकारात्मक", bn: "নেতিবাচক" } },
  { value: "inconclusive", label: { en: "Inconclusive", hi: "अनिर्णायक", bn: "অনিশ্চিত"  } },
];

const KID_SEX_OPTIONS = [
  { value: "",       label: { en: "Not specified", hi: "अज्ञात", bn: "অজ্ঞাত"  } },
  { value: "male",   label: { en: "Male",          hi: "नर",     bn: "পুরুষ"   } },
  { value: "female", label: { en: "Female",        hi: "मादा",   bn: "মহিলা"   } },
];

const KID_ALIVE_OPTIONS = [
  { value: "",    label: { en: "Not specified", hi: "अज्ञात", bn: "অজ্ঞাত" } },
  { value: "yes", label: { en: "Yes",           hi: "हाँ",    bn: "হ্যাঁ"   } },
  { value: "no",  label: { en: "No",            hi: "नहीं",   bn: "না"      } },
];

const HEALTH_EVENT_TYPES = [
  { value: "observation", label: { en: "Observation",  hi: "अवलोकन",    bn: "পর্যবেক্ষণ" } },
  { value: "vaccination", label: { en: "Vaccination",  hi: "टीकाकरण",   bn: "টিকাকরণ"    } },
  { value: "treatment",   label: { en: "Treatment",    hi: "उपचार",      bn: "চিকিৎসা"    } },
  { value: "deworming",   label: { en: "Deworming",    hi: "कृमिनाशक",  bn: "কৃমিনাশক"   } },
  { value: "vet_visit",   label: { en: "Vet visit",    hi: "पशु चिकित्सा", bn: "পশুচিকিৎসা" } },
  { value: "other",       label: { en: "Other",        hi: "अन्य",       bn: "অন্যান্য"   } },
];

const FEED_TYPE_OPTIONS = [
  { value: "concentrate", label: { en: "Concentrate", hi: "सांद्र चारा",  bn: "ঘন খাদ্য"   } },
  { value: "fodder",      label: { en: "Fodder",      hi: "हरा चारा",     bn: "সবুজ ঘাস"   } },
  { value: "browse",      label: { en: "Browse",      hi: "पत्ती-चारा",   bn: "পাতা-ঘাস"   } },
  { value: "silage",      label: { en: "Silage",      hi: "साइलेज",       bn: "সাইলেজ"     } },
  { value: "mineral",     label: { en: "Mineral mix", hi: "खनिज मिश्रण", bn: "খনিজ মিশ্রণ" } },
  { value: "other",       label: { en: "Other",       hi: "अन्य",         bn: "অন্যান্য"   } },
];

const HISTORY_KIND_CFG = {
  milk_record:   { icon: "Droplets", color: T.blue },
  weight_record: { icon: "Scale",    color: T.primary },
  repro_event:   { icon: "Heart",    color: "#e05" },
  health_event:  { icon: "Syringe",  color: T.orange },
  feed_record:   { icon: "Wheat",    color: "#7c5a1e" },
};

const KIND_LABEL = {
  milk_record:   { en: "Milk record",        hi: "दूध रिकॉर्ड",    bn: "দুধ রেকর্ড"    },
  weight_record: { en: "Weight record",      hi: "वजन रिकॉर्ड",    bn: "ওজন রেকর্ড"    },
  repro_event:   { en: "Reproductive event", hi: "प्रजनन घटना",   bn: "প্রজনন ঘটনা"   },
  health_event:  { en: "Health event",       hi: "स्वास्थ्य घटना",  bn: "স্বাস্থ্য ঘটনা" },
  feed_record:   { en: "Feed record",        hi: "आहार रिकॉर्ड",   bn: "খাদ্য রেকর্ড"  },
};

export function deriveIsPregnant(historyEvents) {
  const repro = historyEvents
    .filter((e) => e.kind === "repro_event")
    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
  for (const ev of repro) {
    if (ev.event_type === "kidding" || ev.event_type === "abortion") return false;
    if (ev.event_type === "pregnancy_check") {
      if (ev.pregnancy_result === "positive") return true;
      if (ev.pregnancy_result === "negative") return false;
    }
  }
  return false;
}

function StatusChip({ status, tc }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.kid;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: T.body,
      color: cfg.fg, background: cfg.bg, borderRadius: 6, padding: "3px 8px" }}>
      {tc(cfg.label)}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 0", borderBottom: `1px solid ${T.line}` }}>
      <span style={{ fontSize: 13, color: T.inkSoft, fontFamily: T.body }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: T.body }}>{value || "—"}</span>
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function GoatAnimalDetail({ animalId, spaceId }) {
  const { pop, tc, toast } = useApp();

  const [space, setSpace]     = useState(null);
  const [animal, setAnimal]   = useState(null);
  const [history, setHistory] = useState([]);
  const [weights, setWeights] = useState([]);
  const [tab, setTab]         = useState("overview");
  const [state, setState]     = useState("loading");
  const [reason, setReason]   = useState(null);

  /* Milk sheet */
  const [milkOpen, setMilkOpen] = useState(false);
  const [mform, setMform] = useState({ recordDate: today(), amYieldKg: "", pmYieldKg: "", fatPct: "", remarks: "" });
  const [mbusy, setMbusy] = useState(false);
  const [delMilkId, setDelMilkId] = useState(null);
  const [delMilkBusy, setDelMilkBusy] = useState(false);

  /* Weight sheet */
  const [weightOpen, setWeightOpen] = useState(false);
  const [wform, setWform] = useState({ weighDate: today(), weightKg: "", notes: "" });
  const [wbusy, setWbusy] = useState(false);
  const [delWeightId, setDelWeightId] = useState(null);
  const [delWeightBusy, setDelWeightBusy] = useState(false);

  /* Status sheet */
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus, setNewStatus]   = useState("");
  const [sBusy, setSBusy]           = useState(false);

  /* Edit animal sheet */
  const [editOpen, setEditOpen] = useState(false);
  const [eform, setEform]       = useState({});
  const [ebusy, setEbusy]       = useState(false);

  /* Repro sheet */
  const [reproOpen, setReproOpen] = useState(false);
  const [editReproId, setEditReproId] = useState(null);
  const [rform, setRform] = useState({
    eventDate: today(), eventType: "heat_observed",
    buckName: "", pregnancyResult: "",
    kidCount: "", kidSex: "", kidAlive: "", notes: "",
  });
  const [rbusy, setRbusy] = useState(false);
  const [delReproId, setDelReproId] = useState(null);
  const [delReproBusy, setDelReproBusy] = useState(false);

  /* Health sheet */
  const [healthOpen, setHealthOpen] = useState(false);
  const [editHealthId, setEditHealthId] = useState(null);
  const [hform, setHform] = useState({
    eventDate: today(), eventType: "observation", title: "",
    medicine: "", dose: "", vetName: "", nextDueDate: "", isZoonotic: false, notes: "",
  });
  const [hbusy, setHbusy] = useState(false);
  const [delHealthId, setDelHealthId] = useState(null);
  const [delHealthBusy, setDelHealthBusy] = useState(false);

  /* Feed sheet */
  const [feedOpen, setFeedOpen] = useState(false);
  const [editFeedId, setEditFeedId] = useState(null);
  const [fform, setFform] = useState({
    feedDate: today(), feedType: "concentrate", quantityKg: "", notes: "",
  });
  const [fbusy, setFbusy] = useState(false);
  const [delFeedId, setDelFeedId] = useState(null);
  const [delFeedBusy, setDelFeedBusy] = useState(false);

  const refreshHistory = useCallback(() => {
    goatApi.animalHistory(spaceId || space?.id, animalId)
      .then((h) => setHistory(h?.history || []))
      .catch(() => {});
  }, [animalId, spaceId, space?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    try {
      const sid = spaceId;
      const active = sid
        ? (await farmSpaceService.spaces()).find((s) => s.id === sid) || await farmSpaceService.active()
        : await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const [aData, hData, wData] = await Promise.all([
        goatApi.getAnimal(active.id, animalId),
        goatApi.animalHistory(active.id, animalId),
        goatApi.listWeight(active.id, animalId),
      ]);
      setAnimal(aData);
      setHistory(hData?.history || []);
      setWeights(wData || []);
      setEform({
        name: aData.name, species: aData.species, sex: aData.sex || "unknown",
        breed: aData.breed || "", tagId: aData.tag_id || "", notes: aData.notes || "",
      });
      setState("ready");
    } catch (err) {
      if (state !== "ready") { setReason(err?.reason || FARM_ERROR.FAILED); setState("error"); }
    }
  }, [animalId, spaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const canManage  = space && farmSpaceService.can(space, "farm.goat.manage");
  const canRecord  = space && farmSpaceService.can(space, "farm.goat.record");
  const isTerminal = animal && TERMINAL.has(animal.current_status);
  const isPregnant = !isTerminal && deriveIsPregnant(history);

  /* ── Milk ── */
  const saveMilk = async () => {
    if (!mform.recordDate) return;
    setMbusy(true);
    try {
      await goatApi.upsertMilk(space.id, {
        animalId,
        recordDate: mform.recordDate,
        amYieldKg:  parseFloat(mform.amYieldKg) || 0,
        pmYieldKg:  parseFloat(mform.pmYieldKg) || 0,
        fatPct:     mform.fatPct ? parseFloat(mform.fatPct) : null,
        remarks:    mform.remarks || null,
      });
      toast(tc({ en: "Milk record saved", hi: "दूध रिकॉर्ड सहेजा", bn: "দুধ রেকর্ড সংরক্ষিত" }), "success");
      setMilkOpen(false);
      setMform({ recordDate: today(), amYieldKg: "", pmYieldKg: "", fatPct: "", remarks: "" });
      refreshHistory();
    } catch (err) {
      toast(err.message || tc({ en: "Save failed", hi: "सहेजा नहीं जा सका", bn: "সংরক্ষণ ব্যর্থ" }), "error");
    } finally { setMbusy(false); }
  };

  const confirmDeleteMilk = async () => {
    setDelMilkBusy(true);
    try {
      await goatApi.deleteMilk(space.id, delMilkId);
      setHistory((prev) => prev.filter((e) => !(e.kind === "milk_record" && e.id === delMilkId)));
      setDelMilkId(null);
      toast(tc({ en: "Record deleted", hi: "रिकॉर्ड हटाया गया", bn: "রেকর্ড মুছে গেছে" }), "info");
    } catch (err) {
      toast(err.message || tc({ en: "Delete failed", hi: "हटाया नहीं जा सका", bn: "মুছতে ব্যর্থ" }), "error");
    } finally { setDelMilkBusy(false); }
  };

  /* ── Weight ── */
  const saveWeight = async () => {
    if (!wform.weighDate || !wform.weightKg) return;
    setWbusy(true);
    try {
      const rec = await goatApi.addWeight(space.id, {
        animalId,
        weighDate: wform.weighDate,
        weightKg:  parseFloat(wform.weightKg),
        notes:     wform.notes || null,
      });
      setWeights((prev) => [rec, ...prev].sort((a, b) =>
        new Date(b.weigh_date) - new Date(a.weigh_date)));
      toast(tc({ en: "Weight recorded", hi: "वजन दर्ज हुआ", bn: "ওজন রেকর্ড হয়েছে" }), "success");
      setWeightOpen(false);
      setWform({ weighDate: today(), weightKg: "", notes: "" });
      refreshHistory();
    } catch (err) {
      toast(err.message || tc({ en: "Save failed", hi: "सहेजा नहीं जा सका", bn: "সংরক্ষণ ব্যর্থ" }), "error");
    } finally { setWbusy(false); }
  };

  const confirmDeleteWeight = async () => {
    setDelWeightBusy(true);
    try {
      await goatApi.deleteWeight(space.id, delWeightId);
      setWeights((prev) => prev.filter((r) => r.id !== delWeightId));
      setHistory((prev) => prev.filter((e) => !(e.kind === "weight_record" && e.id === delWeightId)));
      setDelWeightId(null);
      toast(tc({ en: "Record deleted", hi: "रिकॉर्ड हटाया गया", bn: "রেকর্ড মুছে গেছে" }), "info");
    } catch (err) {
      toast(err.message || tc({ en: "Delete failed", hi: "हटाया नहीं जा सका", bn: "মুছতে ব্যর্থ" }), "error");
    } finally { setDelWeightBusy(false); }
  };

  /* ── Status ── */
  const applyStatus = async () => {
    if (!newStatus) return;
    setSBusy(true);
    try {
      const updated = await goatApi.setStatus(space.id, animalId, newStatus);
      setAnimal((a) => ({ ...a, current_status: updated.current_status }));
      setStatusOpen(false);
      toast(tc({ en: "Status updated", hi: "स्थिति अपडेट हो गई", bn: "অবস্থা আপডেট হয়েছে" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Update failed", hi: "अपडेट नहीं हो सका", bn: "আপডেট ব্যর্থ" }), "error");
    } finally { setSBusy(false); }
  };

  /* ── Edit animal ── */
  const saveEdit = async () => {
    setEbusy(true);
    try {
      const updated = await goatApi.updateAnimal(space.id, {
        animalId, name: eform.name.trim(), species: eform.species,
        sex: eform.sex, breed: eform.breed || null,
        tagId: eform.tagId || null, notes: eform.notes || null,
      });
      setAnimal((a) => ({ ...a, ...updated }));
      setEditOpen(false);
      toast(tc({ en: "Animal updated", hi: "पशु अपडेट हो गया", bn: "প্রাণী আপডেট হয়েছে" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Update failed", hi: "अपडेट नहीं हो सका", bn: "আপডেট ব্যর্থ" }), "error");
    } finally { setEbusy(false); }
  };

  /* ── Repro ── */
  const resetRform = () => setRform({
    eventDate: today(), eventType: "heat_observed",
    buckName: "", pregnancyResult: "", kidCount: "", kidSex: "", kidAlive: "", notes: "",
  });

  const openEditRepro = (ev) => {
    setRform({
      eventDate:       toDateInput(ev.event_date),
      eventType:       ev.event_type        || "heat_observed",
      buckName:        ev.buck_name         || "",
      pregnancyResult: ev.pregnancy_result  || "",
      kidCount:        ev.kid_count != null ? String(ev.kid_count) : "",
      kidSex:          ev.kid_sex           || "",
      kidAlive:        ev.kid_alive === true ? "yes" : ev.kid_alive === false ? "no" : "",
      notes:           ev.notes             || "",
    });
    setEditReproId(ev.id);
    setReproOpen(true);
  };

  const saveRepro = async () => {
    if (!rform.eventDate) return;
    setRbusy(true);
    try {
      if (editReproId) {
        await goatApi.updateRepro(space.id, {
          eventId:         editReproId,
          eventDate:       rform.eventDate,
          eventType:       rform.eventType,
          buckName:        rform.buckName        || null,
          pregnancyResult: rform.pregnancyResult || null,
          kidCount:        rform.eventType === "kidding" && rform.kidCount
                             ? parseInt(rform.kidCount, 10) : null,
          kidSex:          rform.eventType === "kidding" ? (rform.kidSex || null) : null,
          kidAlive:        rform.eventType === "kidding"
                             ? (rform.kidAlive === "yes" ? true : rform.kidAlive === "no" ? false : null)
                             : null,
          notes:           rform.notes || null,
        });
        toast(tc({ en: "Event updated", hi: "घटना अपडेट हुई", bn: "ঘটনা আপডেট হয়েছে" }), "success");
        setReproOpen(false);
        setEditReproId(null);
        resetRform();
        refreshHistory();
      } else {
        const payload = {
          animalId,
          eventDate: rform.eventDate,
          eventType: rform.eventType,
          notes:     rform.notes || null,
        };
        if (rform.buckName)        payload.buckName        = rform.buckName;
        if (rform.pregnancyResult) payload.pregnancyResult = rform.pregnancyResult;
        if (rform.eventType === "kidding") {
          payload.kidCount = rform.kidCount ? parseInt(rform.kidCount, 10) : null;
          payload.kidSex   = rform.kidSex   || null;
          payload.kidAlive = rform.kidAlive === "yes" ? true : rform.kidAlive === "no" ? false : null;
        }
        await goatApi.addRepro(space.id, payload);
        toast(tc({ en: "Event recorded", hi: "घटना दर्ज हुई", bn: "ঘটনা রেকর্ড হয়েছে" }), "success");
        setReproOpen(false);
        resetRform();
        refreshHistory();
      }
    } catch (err) {
      toast(err.message || tc({ en: "Save failed", hi: "सहेजा नहीं जा सका", bn: "সংরক্ষণ ব্যর্থ" }), "error");
    } finally { setRbusy(false); }
  };

  const confirmDeleteRepro = async () => {
    setDelReproBusy(true);
    try {
      await goatApi.deleteRepro(space.id, delReproId);
      setHistory((prev) => prev.filter((e) => !(e.kind === "repro_event" && e.id === delReproId)));
      setDelReproId(null);
      toast(tc({ en: "Event deleted", hi: "घटना हटाई गई", bn: "ঘটনা মুছে গেছে" }), "info");
    } catch (err) {
      toast(err.message || tc({ en: "Delete failed", hi: "हटाया नहीं जा सका", bn: "মুছতে ব্যর্থ" }), "error");
    } finally { setDelReproBusy(false); }
  };

  /* ── Health ── */
  const resetHform = () => setHform({
    eventDate: today(), eventType: "observation", title: "",
    medicine: "", dose: "", vetName: "", nextDueDate: "", isZoonotic: false, notes: "",
  });

  const openEditHealth = (ev) => {
    setHform({
      eventDate:   toDateInput(ev.event_date),
      eventType:   ev.event_type || "observation",
      title:       ev.title      || "",
      medicine:    ev.medicine   || "",
      dose:        ev.dose       || "",
      vetName:     ev.vet_name   || "",
      nextDueDate: toDateInput(ev.next_due_date),
      isZoonotic:  ev.is_zoonotic_concern || false,
      notes:       ev.notes      || "",
    });
    setEditHealthId(ev.id);
    setHealthOpen(true);
  };

  const saveHealth = async () => {
    if (!hform.eventDate || !hform.title.trim()) return;
    setHbusy(true);
    try {
      if (editHealthId) {
        await goatApi.updateHealth(space.id, {
          eventId: editHealthId,
          eventDate: hform.eventDate, eventType: hform.eventType,
          title: hform.title.trim(), medicine: hform.medicine || null,
          dose: hform.dose || null, vetName: hform.vetName || null,
          nextDueDate: hform.nextDueDate || null,
          isZoonoticConcern: hform.isZoonotic, notes: hform.notes || null,
        });
        toast(tc({ en: "Event updated", hi: "घटना अपडेट हुई", bn: "ঘটনা আপডেট হয়েছে" }), "success");
        setHealthOpen(false);
        setEditHealthId(null);
        resetHform();
      } else {
        await goatApi.addHealth(space.id, {
          animalId,
          eventDate: hform.eventDate, eventType: hform.eventType,
          title: hform.title.trim(), medicine: hform.medicine || null,
          dose: hform.dose || null, vetName: hform.vetName || null,
          nextDueDate: hform.nextDueDate || null,
          isZoonoticConcern: hform.isZoonotic, notes: hform.notes || null,
        });
        toast(tc({ en: "Health event saved", hi: "स्वास्थ्य घटना दर्ज", bn: "স্বাস্থ্য ঘটনা সংরক্ষিত" }), "success");
        setHealthOpen(false);
        resetHform();
      }
      refreshHistory();
    } catch (err) {
      toast(err.message || tc({ en: "Save failed", hi: "सहेजा नहीं जा सका", bn: "সংরক্ষণ ব্যর্থ" }), "error");
    } finally { setHbusy(false); }
  };

  const confirmDeleteHealth = async () => {
    setDelHealthBusy(true);
    try {
      await goatApi.deleteHealth(space.id, delHealthId);
      setHistory((prev) => prev.filter((e) => !(e.kind === "health_event" && e.id === delHealthId)));
      setDelHealthId(null);
      toast(tc({ en: "Event deleted", hi: "घटना हटाई गई", bn: "ঘটনা মুছে গেছে" }), "info");
    } catch (err) {
      toast(err.message || tc({ en: "Delete failed", hi: "हटाया नहीं जा सका", bn: "মুছতে ব্যর্থ" }), "error");
    } finally { setDelHealthBusy(false); }
  };

  /* ── Feed ── */
  const resetFform = () => setFform({ feedDate: today(), feedType: "concentrate", quantityKg: "", notes: "" });

  const openEditFeed = (ev) => {
    setFform({
      feedDate:   toDateInput(ev.event_date),
      feedType:   ev.feed_type    || "concentrate",
      quantityKg: ev.quantity_kg != null ? String(ev.quantity_kg) : "",
      notes:      ev.notes        || "",
    });
    setEditFeedId(ev.id);
    setFeedOpen(true);
  };

  const saveFeed = async () => {
    if (!fform.feedDate) return;
    setFbusy(true);
    try {
      if (editFeedId) {
        await goatApi.updateFeed(space.id, {
          feedId: editFeedId, feedDate: fform.feedDate, feedType: fform.feedType,
          quantityKg: fform.quantityKg ? parseFloat(fform.quantityKg) : null,
          notes: fform.notes || null,
        });
        toast(tc({ en: "Feed record updated", hi: "आहार रिकॉर्ड अपडेट हुआ", bn: "খাদ্য রেকর্ড আপডেট হয়েছে" }), "success");
        setFeedOpen(false);
        setEditFeedId(null);
        resetFform();
      } else {
        await goatApi.addFeed(space.id, {
          animalId, feedDate: fform.feedDate, feedType: fform.feedType,
          quantityKg: fform.quantityKg ? parseFloat(fform.quantityKg) : null,
          notes: fform.notes || null,
        });
        toast(tc({ en: "Feed record saved", hi: "आहार रिकॉर्ड दर्ज", bn: "খাদ্য রেকর্ড সংরক্ষিত" }), "success");
        setFeedOpen(false);
        resetFform();
      }
      refreshHistory();
    } catch (err) {
      toast(err.message || tc({ en: "Save failed", hi: "सहेजा नहीं जा सका", bn: "সংরক্ষণ ব্যর্থ" }), "error");
    } finally { setFbusy(false); }
  };

  const confirmDeleteFeed = async () => {
    setDelFeedBusy(true);
    try {
      await goatApi.deleteFeed(space.id, delFeedId);
      setHistory((prev) => prev.filter((e) => !(e.kind === "feed_record" && e.id === delFeedId)));
      setDelFeedId(null);
      toast(tc({ en: "Record deleted", hi: "रिकॉर्ड हटाया गया", bn: "রেকর্ড মুছে গেছে" }), "info");
    } catch (err) {
      toast(err.message || tc({ en: "Delete failed", hi: "हटाया नहीं जा सका", bn: "মুছতে ব্যর্থ" }), "error");
    } finally { setDelFeedBusy(false); }
  };

  /* ── AppBar ── */
  const bar = (
    <AppBar
      title={animal?.name || tc({ en: "Animal", hi: "पशु", bn: "প্রাণী" })}
      onBack={pop}
      action={canManage && !isTerminal && (
        <button
          onClick={() => setEditOpen(true)}
          style={{ background: "none", border: "none", cursor: "pointer",
            color: T.inkSoft, padding: "6px 8px", display: "flex", alignItems: "center" }}>
          <Icon name="Pencil" size={18} />
        </button>
      )}
    />
  );

  if (state === "loading") return <>{bar}<div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error")   return <>{bar}<div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;
  if (!animal) return null;

  const cfg = STATUS_CFG[animal.current_status] || STATUS_CFG.kid;
  const lastWeight = weights[0] ?? animal.last_weight ?? null;
  const milkHistory = history.filter((e) => e.kind === "milk_record");

  return (
    <>
      {bar}

      {/* Profile header card */}
      <div style={{ padding: "10px 16px 0" }}>
        <Card elevated>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 54, height: 54, borderRadius: 16, flexShrink: 0,
              background: cfg.bg, display: "grid", placeItems: "center" }}>
              <Icon name="Beef" size={26} color={cfg.fg} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: T.ink }}>{animal.name}</span>
                <StatusChip status={animal.current_status} tc={tc} />
                {isPregnant && (
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: T.body,
                    color: "#b8860b", background: "#fff8e1", borderRadius: 6, padding: "3px 8px" }}>
                    {tc({ en: "Pregnant", hi: "गर्भवती", bn: "গর্ভবতী" })}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>
                {animal.species === "sheep"
                  ? tc({ en: "Sheep", hi: "भेड़", bn: "ভেড়া" })
                  : tc({ en: "Goat",  hi: "बकरी", bn: "ছাগল" })}
                {animal.sex && animal.sex !== "unknown" ? ` · ${tc({
                  en: animal.sex === "male" ? "Male" : "Female",
                  hi: animal.sex === "male" ? "नर" : "मादा",
                  bn: animal.sex === "male" ? "পুরুষ" : "মাদি",
                })}` : ""}
                {animal.breed  ? ` · ${animal.breed}`   : ""}
                {animal.tag_id ? ` · #${animal.tag_id}` : ""}
              </div>
            </div>
          </div>

          {/* Terminal banner */}
          {isTerminal && (
            <div style={{ marginTop: 10, background: "#f5f5f5", borderRadius: T.rSm,
              padding: "7px 10px", fontSize: 12, color: "#6b6b6b", fontFamily: T.body }}>
              <Icon name="Lock" size={12} />
              {" "}{tc({ en: "This animal is terminal — records are read-only.",
                         hi: "यह पशु टर्मिनल स्थिति में है — रिकॉर्ड केवल पढ़ने के लिए।",
                         bn: "এই প্রাণীটি চূড়ান্ত অবস্থায় — রেকর্ড শুধু পড়ার যোগ্য।" })}
            </div>
          )}

          {/* Change status */}
          {canManage && !isTerminal && (
            <button
              onClick={() => { setNewStatus(animal.current_status); setStatusOpen(true); }}
              style={{ marginTop: 10, width: "100%", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 6, background: T.surface2, border: "none",
                borderRadius: T.rSm, padding: "8px 0", cursor: "pointer",
                fontFamily: T.body, fontSize: 12.5, color: T.ink, fontWeight: 600 }}>
              <Icon name="RefreshCw" size={13} />
              {tc({ en: "Change status", hi: "स्थिति बदलें", bn: "অবস্থা পরিবর্তন করুন" })}
            </button>
          )}
        </Card>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px", overflowX: "auto" }}>
        {[
          { id: "overview", label: { en: "Overview", hi: "सारांश", bn: "সংক্ষিপ্ত" } },
          { id: "weight",   label: { en: "Weight",   hi: "वजन",    bn: "ওজন"       } },
          { id: "history",  label: { en: "History",  hi: "इतिहास", bn: "ইতিহাস"   } },
        ].map((t) => (
          <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {tc(t.label)}
          </Chip>
        ))}
      </div>

      {/* Tab bodies */}
      <div style={{ padding: "6px 16px 32px" }}>

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Info rows */}
            <Card>
              <InfoRow label={tc({ en: "Date of birth",     hi: "जन्म तिथि",   bn: "জন্ম তারিখ"    })} value={fmtDate(animal.dob)} />
              <InfoRow label={tc({ en: "Acquired",          hi: "प्राप्ति",     bn: "অধিগ্রহণ"      })} value={fmtDate(animal.acquisition_date)} />
              {animal.acquisition_source && (
                <InfoRow label={tc({ en: "Source",          hi: "स्रोत",        bn: "উৎস"           })} value={animal.acquisition_source} />
              )}
              {animal.notes && (
                <div style={{ paddingTop: 8, fontSize: 13, color: T.inkSoft, fontFamily: T.body }}>
                  {animal.notes}
                </div>
              )}
            </Card>

            {/* Quick tiles: last weight + recent milk */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, background: T.primarySoft, borderRadius: T.rMd, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Icon name="Scale" size={14} color={T.primary} />
                  <span style={{ fontSize: 10.5, color: T.primary, fontWeight: 600, fontFamily: T.body }}>
                    {tc({ en: "Last weight", hi: "अंतिम वजन", bn: "শেষ ওজন" })}
                  </span>
                </div>
                {lastWeight ? (
                  <>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.primary, fontFamily: T.display }}>
                      {Number(lastWeight.weight_kg).toFixed(1)} kg
                    </div>
                    <div style={{ fontSize: 10, color: T.primary, fontFamily: T.body, opacity: 0.7, marginTop: 2 }}>
                      {fmtDateShort(lastWeight.weigh_date)}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: T.primary, fontFamily: T.body, opacity: 0.7 }}>—</div>
                )}
              </div>
              <div style={{ flex: 1, background: T.blueSoft, borderRadius: T.rMd, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Icon name="Droplets" size={14} color={T.blue} />
                  <span style={{ fontSize: 10.5, color: T.blue, fontWeight: 600, fontFamily: T.body }}>
                    {tc({ en: "Last milk", hi: "अंतिम दूध", bn: "শেষ দুধ" })}
                  </span>
                </div>
                {milkHistory.length > 0 ? (
                  <>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.blue, fontFamily: T.display }}>
                      {Number(milkHistory[0].total_yield_kg ?? 0).toFixed(1)} kg
                    </div>
                    <div style={{ fontSize: 10, color: T.blue, fontFamily: T.body, opacity: 0.7, marginTop: 2 }}>
                      {fmtDateShort(milkHistory[0].event_date)}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: T.blue, fontFamily: T.body, opacity: 0.7 }}>—</div>
                )}
              </div>
            </div>

            {/* Quick-add buttons */}
            {canRecord && !isTerminal && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setMilkOpen(true)}
                  style={{ flex: 1, background: T.surface, border: `1px solid ${T.line}`,
                    borderRadius: T.rMd, padding: "10px 0", cursor: "pointer",
                    fontFamily: T.body, fontSize: 12.5, fontWeight: 600, color: T.ink,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Icon name="Droplets" size={14} color={T.blue} />
                  {tc({ en: "Log milk", hi: "दूध दर्ज", bn: "দুধ লিখুন" })}
                </button>
                <button
                  onClick={() => setWeightOpen(true)}
                  style={{ flex: 1, background: T.surface, border: `1px solid ${T.line}`,
                    borderRadius: T.rMd, padding: "10px 0", cursor: "pointer",
                    fontFamily: T.body, fontSize: 12.5, fontWeight: 600, color: T.ink,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Icon name="Scale" size={14} color={T.primary} />
                  {tc({ en: "Weigh", hi: "वजन", bn: "ওজন" })}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Weight ── */}
        {tab === "weight" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canRecord && !isTerminal && (
              <button
                onClick={() => setWeightOpen(true)}
                style={{ width: "100%", background: T.primarySoft, color: T.primary,
                  border: "none", borderRadius: T.rMd, padding: "10px 0", cursor: "pointer",
                  fontFamily: T.body, fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icon name="Plus" size={15} color={T.primary} />
                {tc({ en: "Add weight", hi: "वजन जोड़ें", bn: "ওজন যোগ করুন" })}
              </button>
            )}
            {weights.length === 0 ? (
              <EmptyState icon="Scale"
                title={tc({ en: "No weight records", hi: "कोई वजन रिकॉर्ड नहीं", bn: "কোনো ওজন রেকর্ড নেই" })}
                body={canRecord && !isTerminal
                  ? tc({ en: "Tap Add weight to start tracking.", hi: "ट्रैक करने के लिए वजन जोड़ें दबाएँ।", bn: "ট্র্যাক শুরু করতে ওজন যোগ করুন চাপুন।" })
                  : ""} />
            ) : (
              weights.map((w) => (
                <Card key={w.id} pad={0}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: T.primarySoft, display: "grid", placeItems: "center" }}>
                      <Icon name="Scale" size={17} color={T.primary} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, fontFamily: T.display }}>
                        {Number(w.weight_kg).toFixed(1)} kg
                      </div>
                      <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body, marginTop: 1 }}>
                        {fmtDate(w.weigh_date)}{w.notes ? ` · ${w.notes}` : ""}
                      </div>
                    </div>
                    {(canRecord || canManage) && !isTerminal && (
                      <button
                        onClick={() => setDelWeightId(w.id)}
                        style={{ background: "none", border: "none", cursor: "pointer",
                          padding: "4px 6px", color: T.inkFaint }}>
                        <Icon name="Trash2" size={15} />
                      </button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* ── History ── */}
        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Add buttons row */}
            {canRecord && !isTerminal && (
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                {[
                  { icon: "Droplets",  label: { en: "Milk",   hi: "दूध",        bn: "দুধ"   }, onClick: () => setMilkOpen(true) },
                  { icon: "Heart",     label: { en: "Repro",  hi: "प्रजनन",      bn: "প্রজনন" }, onClick: () => { resetRform(); setReproOpen(true); } },
                  { icon: "Syringe",   label: { en: "Health", hi: "स्वास्थ्य",   bn: "স্বাস্থ্য" }, onClick: () => { resetHform(); setHealthOpen(true); } },
                  { icon: "Wheat",     label: { en: "Feed",   hi: "आहार",        bn: "খাদ্য"  }, onClick: () => { resetFform(); setFeedOpen(true); } },
                ].map(({ icon, label, onClick }) => (
                  <button key={icon} onClick={onClick}
                    style={{ display: "flex", alignItems: "center", gap: 5,
                      background: T.surface2, border: `1px solid ${T.line}`,
                      borderRadius: T.rMd, padding: "6px 12px", cursor: "pointer",
                      fontFamily: T.body, fontSize: 12, fontWeight: 600, color: T.ink,
                      whiteSpace: "nowrap" }}>
                    <Icon name={icon} size={13} />
                    {tc(label)}
                  </button>
                ))}
              </div>
            )}

            {history.length === 0 ? (
              <EmptyState icon="Activity"
                title={tc({ en: "No history yet", hi: "अभी कोई इतिहास नहीं", bn: "এখনও কোনো ইতিহাস নেই" })}
                body={tc({ en: "Events will appear here as they are recorded.", hi: "दर्ज होते ही घटनाएँ यहाँ दिखेंगी।", bn: "রেকর্ড হওয়ার সাথে সাথে ঘটনাগুলো এখানে দেখাবে।" })} />
            ) : (
              history.map((ev) => (
                <HistoryCard
                  key={`${ev.kind}-${ev.id}`}
                  ev={ev}
                  tc={tc}
                  fmtDate={fmtDate}
                  canRecord={canRecord || canManage}
                  isTerminal={isTerminal}
                  onEdit={() => {
                    if (ev.kind === "repro_event")  { openEditRepro(ev);  }
                    if (ev.kind === "health_event") { openEditHealth(ev); }
                    if (ev.kind === "feed_record")  { openEditFeed(ev);   }
                  }}
                  onDelete={() => {
                    if (ev.kind === "milk_record")   setDelMilkId(ev.id);
                    if (ev.kind === "weight_record") setDelWeightId(ev.id);
                    if (ev.kind === "repro_event")   setDelReproId(ev.id);
                    if (ev.kind === "health_event")  setDelHealthId(ev.id);
                    if (ev.kind === "feed_record")   setDelFeedId(ev.id);
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Milk sheet ── */}
      <BottomSheet open={milkOpen} onClose={() => setMilkOpen(false)}
        title={tc({ en: "Log Milk", hi: "दूध दर्ज करें", bn: "দুধ লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date"
            value={mform.recordDate} onChange={(v) => setMform((f) => ({ ...f, recordDate: v }))} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Input label={tc({ en: "AM (kg)", hi: "सुबह (kg)", bn: "সকাল (kg)" })}
                type="number" placeholder="0" value={mform.amYieldKg}
                onChange={(v) => setMform((f) => ({ ...f, amYieldKg: v }))} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label={tc({ en: "PM (kg)", hi: "शाम (kg)", bn: "বিকাল (kg)" })}
                type="number" placeholder="0" value={mform.pmYieldKg}
                onChange={(v) => setMform((f) => ({ ...f, pmYieldKg: v }))} />
            </div>
          </div>
          <Input label={tc({ en: "Fat % (optional)", hi: "वसा % (वैकल्पिक)", bn: "ফ্যাট % (ঐচ্ছিক)" })}
            type="number" value={mform.fatPct} onChange={(v) => setMform((f) => ({ ...f, fatPct: v }))} />
          <Input label={tc({ en: "Remarks (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={mform.remarks} onChange={(v) => setMform((f) => ({ ...f, remarks: v }))} />
          <Button full onClick={saveMilk} disabled={!mform.recordDate || mbusy}>
            {mbusy ? tc({ en: "Saving…", hi: "सहेजा जा रहा है…", bn: "সংরক্ষণ হচ্ছে…" })
                   : tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* ── Weight sheet ── */}
      <BottomSheet open={weightOpen} onClose={() => setWeightOpen(false)}
        title={tc({ en: "Record Weight", hi: "वजन दर्ज करें", bn: "ওজন রেকর্ড করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date"
            value={wform.weighDate} onChange={(v) => setWform((f) => ({ ...f, weighDate: v }))} />
          <Input label={tc({ en: "Weight (kg)", hi: "वजन (किलो)", bn: "ওজন (কেজি)" })}
            type="number" placeholder="0.0" value={wform.weightKg}
            onChange={(v) => setWform((f) => ({ ...f, weightKg: v }))} />
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={wform.notes} onChange={(v) => setWform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={saveWeight} disabled={!wform.weighDate || !wform.weightKg || wbusy}>
            {wbusy ? tc({ en: "Saving…", hi: "सहेजा जा रहा है…", bn: "সংরক্ষণ হচ্ছে…" })
                   : tc({ en: "Save weight", hi: "वजन सहेजें", bn: "ওজন সংরক্ষণ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* ── Status sheet ── */}
      <BottomSheet open={statusOpen} onClose={() => setStatusOpen(false)}
        title={tc({ en: "Change status", hi: "स्थिति बदलें", bn: "অবস্থা পরিবর্তন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label={tc({ en: "New status", hi: "नई स्थिति", bn: "নতুন অবস্থা" })}
            value={newStatus} onChange={setNewStatus}
            options={ALL_STATUSES.map((s) => ({ value: s.value, label: tc(s.label) }))} />
          {["sold", "deceased", "retired"].includes(newStatus) && (
            <div style={{ background: "#fff3e8", borderRadius: T.rSm, padding: "8px 12px",
              fontSize: 12.5, color: T.orange, fontFamily: T.body }}>
              {tc({ en: "⚠ Terminal status — no further records can be added after this.",
                    hi: "⚠ टर्मिनल स्थिति — इसके बाद कोई रिकॉर्ड नहीं जोड़ा जा सकता।",
                    bn: "⚠ চূড়ান্ত অবস্থা — এর পরে আর কোনো রেকর্ড যোগ করা যাবে না।" })}
            </div>
          )}
          <Button full onClick={applyStatus} disabled={!newStatus || newStatus === animal.current_status || sBusy}>
            {sBusy ? tc({ en: "Updating…", hi: "अपडेट हो रहा है…", bn: "আপডেট হচ্ছে…" })
                   : tc({ en: "Apply", hi: "लागू करें", bn: "প্রয়োগ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* ── Edit animal sheet ── */}
      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)}
        title={tc({ en: "Edit Animal", hi: "पशु संपादन", bn: "প্রাণী সম্পাদন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Name", hi: "नाम", bn: "নাম" })}
            value={eform.name} onChange={(v) => setEform((f) => ({ ...f, name: v }))} />
          <Dropdown label={tc({ en: "Species", hi: "प्रजाति", bn: "প্রজাতি" })}
            value={eform.species} onChange={(v) => setEform((f) => ({ ...f, species: v }))}
            options={[
              { value: "goat",  label: tc({ en: "Goat",  hi: "बकरी", bn: "ছাগল" }) },
              { value: "sheep", label: tc({ en: "Sheep", hi: "भेड़",  bn: "ভেড়া" }) },
            ]} />
          <Dropdown label={tc({ en: "Sex", hi: "लिंग", bn: "লিঙ্গ" })}
            value={eform.sex} onChange={(v) => setEform((f) => ({ ...f, sex: v }))}
            options={[
              { value: "female",  label: tc({ en: "Female",  hi: "मादा",   bn: "মাদি"   }) },
              { value: "male",    label: tc({ en: "Male",    hi: "नर",     bn: "পুরুষ"  }) },
              { value: "unknown", label: tc({ en: "Unknown", hi: "अज्ञात", bn: "অজানা"  }) },
            ]} />
          <Input label={tc({ en: "Breed (optional)", hi: "नस्ल (वैकल्पिक)", bn: "জাত (ঐচ্ছিক)" })}
            value={eform.breed} onChange={(v) => setEform((f) => ({ ...f, breed: v }))} />
          <Input label={tc({ en: "Tag number (optional)", hi: "टैग नंबर (वैकल्पिक)", bn: "ট্যাগ নম্বর (ঐচ্ছিক)" })}
            value={eform.tagId} onChange={(v) => setEform((f) => ({ ...f, tagId: v }))} />
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={eform.notes} onChange={(v) => setEform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={saveEdit} disabled={!eform.name?.trim() || ebusy}>
            {ebusy ? tc({ en: "Saving…", hi: "सहेजा जा रहा है…", bn: "সংরক্ষণ হচ্ছে…" })
                   : tc({ en: "Save changes", hi: "बदलाव सहेजें", bn: "পরিবর্তন সংরক্ষণ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* ── Repro sheet ── */}
      <BottomSheet
        open={reproOpen}
        onClose={() => { setReproOpen(false); resetRform(); setEditReproId(null); }}
        title={editReproId
          ? tc({ en: "Edit Repro Event", hi: "प्रजनन घटना संपादन", bn: "প্রজনন ঘটনা সম্পাদন" })
          : tc({ en: "Log Repro Event", hi: "प्रजनन घटना दर्ज करें", bn: "প্রজনন ঘটনা লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date"
            value={rform.eventDate} onChange={(v) => setRform((f) => ({ ...f, eventDate: v }))} />
          <Dropdown label={tc({ en: "Event type", hi: "घटना प्रकार", bn: "ঘটনার ধরন" })}
            value={rform.eventType}
            onChange={(v) => setRform((f) => ({ ...f, eventType: v, buckName: "", pregnancyResult: "" }))}
            options={REPRO_EVENT_TYPES.map((t) => ({ value: t.value, label: tc(t.label) }))} />
          {rform.eventType === "mating" && (
            <Input label={tc({ en: "Buck name (optional)", hi: "बकरे का नाम (वैकल्पिक)", bn: "পাঁঠার নাম (ঐচ্ছিক)" })}
              value={rform.buckName} onChange={(v) => setRform((f) => ({ ...f, buckName: v }))} />
          )}
          {rform.eventType === "pregnancy_check" && (
            <Dropdown label={tc({ en: "Result", hi: "परिणाम", bn: "ফলাফল" })}
              value={rform.pregnancyResult}
              onChange={(v) => setRform((f) => ({ ...f, pregnancyResult: v }))}
              options={[
                { value: "", label: tc({ en: "Select result", hi: "परिणाम चुनें", bn: "ফলাফল বেছে নিন" }) },
                ...PREG_RESULT_OPTIONS.map((o) => ({ value: o.value, label: tc(o.label) })),
              ]} />
          )}
          {rform.eventType === "kidding" && (<>
            <Input label={tc({ en: "Number of kids", hi: "बच्चों की संख्या", bn: "বাচ্চার সংখ্যা" })}
              type="number" placeholder="1" value={rform.kidCount}
              onChange={(v) => setRform((f) => ({ ...f, kidCount: v }))} />
            <Dropdown label={tc({ en: "Kid sex", hi: "बच्चे का लिंग", bn: "বাচ্চার লিঙ্গ" })}
              value={rform.kidSex}
              onChange={(v) => setRform((f) => ({ ...f, kidSex: v }))}
              options={KID_SEX_OPTIONS.map((o) => ({ value: o.value, label: tc(o.label) }))} />
            <Dropdown label={tc({ en: "Kid alive?", hi: "बच्चा जीवित है?", bn: "বাচ্চা কি জীবিত?" })}
              value={rform.kidAlive}
              onChange={(v) => setRform((f) => ({ ...f, kidAlive: v }))}
              options={KID_ALIVE_OPTIONS.map((o) => ({ value: o.value, label: tc(o.label) }))} />
          </>)}
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={rform.notes} onChange={(v) => setRform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={saveRepro}
            disabled={!rform.eventDate || rbusy || (rform.eventType === "pregnancy_check" && !rform.pregnancyResult)}>
            {rbusy ? tc({ en: "Saving…", hi: "सहेजा जा रहा है…", bn: "সংরক্ষণ হচ্ছে…" })
                   : tc({ en: "Save event", hi: "घटना सहेजें", bn: "ঘটনা সংরক্ষণ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* ── Health sheet ── */}
      <BottomSheet
        open={healthOpen}
        onClose={() => { setHealthOpen(false); resetHform(); setEditHealthId(null); }}
        title={editHealthId
          ? tc({ en: "Edit Health Event", hi: "स्वास्थ्य घटना संपादन", bn: "স্বাস্থ্য ঘটনা সম্পাদন" })
          : tc({ en: "Log Health Event", hi: "स्वास्थ्य घटना दर्ज करें", bn: "স্বাস্থ্য ঘটনা লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date"
            value={hform.eventDate} onChange={(v) => setHform((f) => ({ ...f, eventDate: v }))} />
          <Dropdown label={tc({ en: "Event type", hi: "घटना प्रकार", bn: "ঘটনার ধরন" })}
            value={hform.eventType} onChange={(v) => setHform((f) => ({ ...f, eventType: v }))}
            options={HEALTH_EVENT_TYPES.map((o) => ({ value: o.value, label: tc(o.label) }))} />
          <Input label={tc({ en: "Title / description", hi: "शीर्षक / विवरण", bn: "শিরোনাম / বিবরণ" })}
            placeholder={tc({ en: "e.g. PPR vaccine dose 1", hi: "जैसे PPR वैक्सीन खुराक 1", bn: "যেমন PPR ভ্যাকসিন ডোজ ১" })}
            value={hform.title} onChange={(v) => setHform((f) => ({ ...f, title: v }))} />
          {["vaccination","treatment","deworming"].includes(hform.eventType) && (
            <Input label={tc({ en: "Medicine / vaccine", hi: "दवा / वैक्सीन", bn: "ওষুধ / ভ্যাকসিন" })}
              value={hform.medicine} onChange={(v) => setHform((f) => ({ ...f, medicine: v }))} />
          )}
          {["vaccination","treatment","deworming"].includes(hform.eventType) && (
            <Input label={tc({ en: "Dose (optional)", hi: "खुराक (वैकल्पिक)", bn: "ডোজ (ঐচ্ছিক)" })}
              placeholder={tc({ en: "e.g. 2 ml IM", hi: "जैसे 2 मिली IM", bn: "যেমন ২ মিলি IM" })}
              value={hform.dose} onChange={(v) => setHform((f) => ({ ...f, dose: v }))} />
          )}
          {["vet_visit","treatment"].includes(hform.eventType) && (
            <Input label={tc({ en: "Vet name (optional)", hi: "पशु चिकित्सक (वैकल्पिक)", bn: "পশুচিকিৎসকের নাম (ঐচ্ছিক)" })}
              value={hform.vetName} onChange={(v) => setHform((f) => ({ ...f, vetName: v }))} />
          )}
          {["vaccination","deworming"].includes(hform.eventType) && (
            <Input label={tc({ en: "Next due date (optional)", hi: "अगली देय तिथि (वैकल्पिक)", bn: "পরবর্তী নির্ধারিত তারিখ (ঐচ্ছিক)" })}
              type="date" value={hform.nextDueDate}
              onChange={(v) => setHform((f) => ({ ...f, nextDueDate: v }))} />
          )}
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={hform.notes} onChange={(v) => setHform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={saveHealth} disabled={!hform.eventDate || !hform.title.trim() || hbusy}>
            {hbusy ? tc({ en: "Saving…", hi: "सहेजा जा रहा है…", bn: "সংরক্ষণ হচ্ছে…" })
                   : tc({ en: "Save event", hi: "घटना सहेजें", bn: "ঘটনা সংরক্ষণ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* ── Feed sheet ── */}
      <BottomSheet
        open={feedOpen}
        onClose={() => { setFeedOpen(false); resetFform(); setEditFeedId(null); }}
        title={editFeedId
          ? tc({ en: "Edit Feed Record", hi: "आहार रिकॉर्ड संपादन", bn: "খাদ্য রেকর্ড সম্পাদন" })
          : tc({ en: "Log Feed", hi: "आहार दर्ज करें", bn: "খাদ্য লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date"
            value={fform.feedDate} onChange={(v) => setFform((f) => ({ ...f, feedDate: v }))} />
          <Dropdown label={tc({ en: "Feed type", hi: "आहार प्रकार", bn: "খাদ্যের ধরন" })}
            value={fform.feedType} onChange={(v) => setFform((f) => ({ ...f, feedType: v }))}
            options={FEED_TYPE_OPTIONS.map((o) => ({ value: o.value, label: tc(o.label) }))} />
          <Input label={tc({ en: "Quantity (kg, optional)", hi: "मात्रा (किलो, वैकल्पिक)", bn: "পরিমাণ (কেজি, ঐচ্ছিক)" })}
            type="number" placeholder="0.0" value={fform.quantityKg}
            onChange={(v) => setFform((f) => ({ ...f, quantityKg: v }))} />
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={fform.notes} onChange={(v) => setFform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={saveFeed} disabled={!fform.feedDate || fbusy}>
            {fbusy ? tc({ en: "Saving…", hi: "सहेजा जा रहा है…", bn: "সংরক্ষণ হচ্ছে…" })
                   : tc({ en: "Save feed record", hi: "आहार सहेजें", bn: "খাদ্য সংরক্ষণ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* ── Delete confirmations ── */}
      {[
        { open: !!delMilkId,   onClose: () => setDelMilkId(null),   busy: delMilkBusy,   onConfirm: confirmDeleteMilk,
          title: { en: "Delete milk record?", hi: "दूध रिकॉर्ड हटाएँ?", bn: "দুধ রেকর্ড মুছবেন?" } },
        { open: !!delWeightId, onClose: () => setDelWeightId(null), busy: delWeightBusy, onConfirm: confirmDeleteWeight,
          title: { en: "Delete weight record?", hi: "वजन रिकॉर्ड हटाएँ?", bn: "ওজন রেকর্ড মুছবেন?" } },
        { open: !!delReproId,  onClose: () => setDelReproId(null),  busy: delReproBusy,  onConfirm: confirmDeleteRepro,
          title: { en: "Delete repro event?", hi: "प्रजनन घटना हटाएँ?", bn: "প্রজনন ঘটনা মুছবেন?" } },
        { open: !!delHealthId, onClose: () => setDelHealthId(null), busy: delHealthBusy, onConfirm: confirmDeleteHealth,
          title: { en: "Delete health event?", hi: "स्वास्थ्य घटना हटाएँ?", bn: "স্বাস্থ্য ঘটনা মুছবেন?" } },
        { open: !!delFeedId,   onClose: () => setDelFeedId(null),   busy: delFeedBusy,   onConfirm: confirmDeleteFeed,
          title: { en: "Delete feed record?", hi: "आहार रिकॉर्ड हटाएँ?", bn: "খাদ্য রেকর্ড মুছবেন?" } },
      ].map(({ open, onClose, busy, onConfirm, title }) => (
        <Dialog key={tc(title)} open={open} title={tc(title)} onClose={onClose}
          actions={[
            { label: tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" }), variant: "outline", onClick: onClose },
            { label: busy ? "…" : tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" }), variant: "danger", onClick: onConfirm },
          ]}>
          <div style={{ fontSize: 14, color: T.inkSoft }}>
            {tc({ en: "This record will be soft-deleted.", hi: "यह रिकॉर्ड हटा दिया जाएगा।", bn: "এই রেকর্ড মুছে যাবে।" })}
          </div>
        </Dialog>
      ))}
    </>
  );
}

/* ── History card ─────────────────────────────────────────────────────────── */

function HistoryCard({ ev, tc, fmtDate, canRecord, isTerminal, onEdit, onDelete }) {
  const cfg = HISTORY_KIND_CFG[ev.kind] || { icon: "Activity", color: T.inkSoft };
  const kindLabel = tc(KIND_LABEL[ev.kind] || { en: ev.kind, hi: ev.kind, bn: ev.kind });

  let detail = "";
  if (ev.kind === "milk_record")
    detail = `${Number(ev.total_yield_kg ?? 0).toFixed(1)} kg${ev.fat_pct ? ` · Fat ${ev.fat_pct}%` : ""}`;
  if (ev.kind === "weight_record")
    detail = `${Number(ev.weight_kg ?? 0).toFixed(1)} kg`;
  if (ev.kind === "repro_event") {
    const typeLabel = tc(REPRO_EVENT_TYPES.find((t) => t.value === ev.event_type)?.label
      || { en: ev.event_type, hi: ev.event_type, bn: ev.event_type });
    detail = typeLabel;
    if (ev.pregnancy_result) detail += ` · ${ev.pregnancy_result}`;
    if (ev.kid_count) detail += ` · ${ev.kid_count} kid${ev.kid_count > 1 ? "s" : ""}`;
  }
  if (ev.kind === "health_event") {
    detail = ev.title || "";
    if (ev.medicine) detail += ` · ${ev.medicine}`;
    if (ev.next_due_date)
      detail += ` · ${tc({ en: "Due", hi: "देय", bn: "দেয়" })} ${fmtDate(ev.next_due_date)}`;
  }
  if (ev.kind === "feed_record") {
    const ftLabel = tc(FEED_TYPE_OPTIONS.find((f) => f.value === ev.feed_type)?.label
      || { en: ev.feed_type, hi: ev.feed_type, bn: ev.feed_type });
    detail = ftLabel;
    if (ev.quantity_kg) detail += ` · ${Number(ev.quantity_kg).toFixed(1)} kg`;
  }

  const canEdit   = canRecord && !isTerminal && ["repro_event","health_event","feed_record"].includes(ev.kind);
  const canDelete = canRecord && !isTerminal;

  return (
    <Card pad={0}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: `${cfg.color}18`, display: "grid", placeItems: "center" }}>
          <Icon name={cfg.icon} size={16} color={cfg.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: T.inkFaint, fontWeight: 600, fontFamily: T.body,
              textTransform: "uppercase", letterSpacing: 0.5 }}>{kindLabel}</span>
            <span style={{ fontSize: 11, color: T.inkFaint, fontFamily: T.body }}>{fmtDate(ev.event_date)}</span>
          </div>
          {detail && (
            <div style={{ fontSize: 13, color: T.ink, fontWeight: 600, fontFamily: T.body, marginTop: 2 }}>
              {detail}
            </div>
          )}
          {ev.notes && (
            <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body, marginTop: 1 }}>{ev.notes}</div>
          )}
        </div>
        {(canEdit || canDelete) && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {canEdit && (
              <button onClick={onEdit}
                style={{ background: "none", border: "none", cursor: "pointer",
                  padding: "4px 5px", color: T.inkFaint }}>
                <Icon name="Pencil" size={14} />
              </button>
            )}
            {canDelete && (
              <button onClick={onDelete}
                style={{ background: "none", border: "none", cursor: "pointer",
                  padding: "4px 5px", color: T.inkFaint }}>
                <Icon name="Trash2" size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
