import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, Spinner, BottomSheet, Dialog,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { pigApi } from "../../services/pig/pigApi.js";

const today = () => new Date().toISOString().slice(0, 10);

const TERMINAL = new Set(["sold", "deceased", "retired"]);

const STATUS_CFG = {
  piglet:   { label: { en: "Piglet",   hi: "सूअर का बच्चा", bn: "শূকরছানা"   }, fg: T.primary,  bg: T.primarySoft },
  grower:   { label: { en: "Grower",   hi: "बढ़ता",          bn: "বেড়ে ওঠা"   }, fg: T.orange,   bg: "#fff3e8"      },
  finisher: { label: { en: "Finisher", hi: "फिनिशर",         bn: "ফিনিশার"     }, fg: "#7a5a1a",  bg: "#f8f0d8"      },
  breeder:  { label: { en: "Breeder",  hi: "प्रजनक",         bn: "প্রজনকারী"   }, fg: "#9b59b6",  bg: "#f4eef9"      },
  sold:     { label: { en: "Sold",     hi: "बेचा",           bn: "বিক্রিত"     }, fg: "#6b6b6b",  bg: "#f0f0f0"      },
  deceased: { label: { en: "Deceased", hi: "मृत",            bn: "মৃত"          }, fg: "#6b6b6b",  bg: "#f0f0f0"      },
  retired:  { label: { en: "Retired",  hi: "सेवानिवृत्त",   bn: "অবসরপ্রাপ্ত" }, fg: "#6b6b6b",  bg: "#f0f0f0"      },
};

const SEX_LABEL = {
  boar:    { en: "Boar",    hi: "सांड",          bn: "বরাহ"        },
  sow:     { en: "Sow",     hi: "सुअरी",         bn: "শূকরী"       },
  gilt:    { en: "Gilt",    hi: "जवान सुअरी",    bn: "তরুণ শূকরী"  },
  barrow:  { en: "Barrow",  hi: "बधिया",         bn: "বন্ধ্যা নর"  },
  unknown: { en: "Unknown", hi: "अज्ञात",         bn: "অজানা"       },
};

const HEALTH_TYPE_LABEL = {
  observation:  { en: "Observation",  hi: "अवलोकन",    bn: "পর্যবেক্ষণ"  },
  vaccination:  { en: "Vaccination",  hi: "टीकाकरण",   bn: "টিকা"         },
  treatment:    { en: "Treatment",    hi: "उपचार",      bn: "চিকিৎসা"      },
  deworming:    { en: "Deworming",    hi: "कृमिनाशन",  bn: "কৃমিমুক্তি"   },
  vet_visit:    { en: "Vet visit",    hi: "पशु चिकित्सा", bn: "পশু চিকিৎসা" },
  other:        { en: "Other",        hi: "अन्य",       bn: "অন্যান্য"     },
};

const REPRO_TYPE_LABEL = {
  heat_observed:    { en: "Heat observed",    hi: "मद अवलोकन",      bn: "তাপ পর্যবেক্ষণ"   },
  mating:           { en: "Mating",           hi: "संभोग",           bn: "সঙ্গম"              },
  pregnancy_check:  { en: "Pregnancy check",  hi: "गर्भ परीक्षण",   bn: "গর্ভ পরীক্ষা"      },
  farrowing:        { en: "Farrowing",        hi: "प्रसव",           bn: "প্রসব"              },
  weaning:          { en: "Weaning",          hi: "दूध छुड़ाना",     bn: "দুধ ছাড়ানো"        },
  abortion:         { en: "Abortion",         hi: "गर्भपात",         bn: "গর্ভপাত"            },
  other:            { en: "Other",            hi: "अन्य",            bn: "অন্যান্য"           },
};

const FEED_TYPE_LABEL = {
  starter:      { en: "Starter",      hi: "स्टार्टर",      bn: "স্টার্টার"    },
  grower_feed:  { en: "Grower feed",  hi: "ग्रोअर चारा",   bn: "গ্রোয়ার খাদ্য" },
  finisher_feed:{ en: "Finisher feed",hi: "फिनिशर चारा",   bn: "ফিনিশার খাদ্য" },
  sow_feed:     { en: "Sow feed",     hi: "सुअरी चारा",    bn: "শূকরী খাদ্য"  },
  concentrate:  { en: "Concentrate",  hi: "सांद्रित चारा", bn: "ঘন খাদ্য"     },
  other:        { en: "Other",        hi: "अन्य",           bn: "অন্যান্য"     },
};

const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return String(d).slice(0, 10); }
};

const fmtAge = (dob) => {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 30)  return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
};

function StatusChip({ status, tc }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.piglet;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: T.body,
      color: cfg.fg, background: cfg.bg, borderRadius: 5, padding: "2px 7px", letterSpacing: 0.3 }}>
      {tc(cfg.label)}
    </span>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 8, paddingBlock: 6, borderBottom: `1px solid ${T.line}` }}>
      <span style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body, minWidth: 110 }}>{label}</span>
      <span style={{ fontSize: 12, color: T.ink, fontFamily: T.body, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function PigAnimalDetail({ animalId, spaceId }) {
  const { pop, tc, toast } = useApp();

  const [space,   setSpace]   = useState(null);
  const [animal,  setAnimal]  = useState(null);
  const [weights, setWeights] = useState([]);
  const [history, setHistory] = useState(null);
  const [tab,     setTab]     = useState("overview");
  const [state,   setState]   = useState("loading");

  /* ── edit animal ── */
  const [editOpen, setEditOpen] = useState(false);
  const [eform,    setEform]    = useState({});
  const [ebusy,    setEbusy]    = useState(false);

  /* ── set status ── */
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus,  setNewStatus]  = useState("");
  const [sbusy,      setSbusy]      = useState(false);

  /* ── add weight ── */
  const [weightOpen, setWeightOpen] = useState(false);
  const blankWform = () => ({ weighDate: today(), weightKg: "", notes: "", clientUuid: crypto.randomUUID() });
  const [wform, setWform] = useState(blankWform);
  const [wbusy, setWbusy] = useState(false);

  /* ── delete weight ── */
  const [deleteWeightId,   setDeleteWeightId]   = useState(null);
  const [deleteWeightBusy, setDeleteWeightBusy] = useState(false);

  /* ── add health ── */
  const [healthOpen, setHealthOpen] = useState(false);
  const blankHform = () => ({
    eventDate: today(), eventType: "vaccination", title: "", medicine: "",
    dose: "", vetName: "", nextDueDate: "", notes: "", clientUuid: crypto.randomUUID(),
  });
  const [hform, setHform] = useState(blankHform);
  const [hbusy, setHbusy] = useState(false);

  /* ── add repro ── */
  const [reproOpen, setReproOpen] = useState(false);
  const blankRform = () => ({
    eventDate: today(), eventType: "mating", boarName: "", pregnancyResult: "",
    litterSize: "", liveBorn: "", stillBorn: "", weanedCount: "", notes: "",
    clientUuid: crypto.randomUUID(),
  });
  const [rform, setRform] = useState(blankRform);
  const [rbusy, setRbusy] = useState(false);

  /* ── add feed ── */
  const [feedOpen, setFeedOpen] = useState(false);
  const blankFform = () => ({
    feedDate: today(), feedType: "grower_feed", quantityKg: "", notes: "",
    clientUuid: crypto.randomUUID(),
  });
  const [fform, setFform] = useState(blankFform);
  const [fbusy, setFbusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [spc, { animal: a, history: hist }, wRecs] = await Promise.all([
        farmSpaceService.active(),
        pigApi.animalHistory(spaceId, { animalId, limit: 100 }),
        pigApi.listWeight(spaceId, { animalId, limit: 100 }),
      ]);
      setSpace(spc);
      setAnimal(a);
      setHistory(hist);
      setWeights(wRecs || []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [spaceId, animalId]);

  useEffect(() => { load(); }, [load]);

  const canManage = space && farmSpaceService.can(space, "farm.pig.manage");
  const canRecord = space && farmSpaceService.can(space, "farm.pig.record");
  const isTerminal = animal && TERMINAL.has(animal.current_status);

  /* ── save handlers ── */
  const saveEdit = async () => {
    setEbusy(true);
    try {
      const updated = await pigApi.updateAnimal(spaceId, { animalId, ...eform });
      setAnimal(updated);
      setEditOpen(false);
      toast(tc({ en: "Saved", hi: "सहेजा गया", bn: "সংরক্ষিত" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Save failed", hi: "सहेजने में विफल", bn: "সংরক্ষণ ব্যর্থ" }), "error");
    } finally { setEbusy(false); }
  };

  const saveStatus = async () => {
    setSbusy(true);
    try {
      const updated = await pigApi.setStatus(spaceId, { animalId, status: newStatus });
      setAnimal(updated);
      setStatusOpen(false);
      toast(tc({ en: "Status updated", hi: "स्थिति अपडेट हुई", bn: "স্ট্যাটাস আপডেট হয়েছে" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Update failed", hi: "अपडेट विफल", bn: "আপডেট ব্যর্থ" }), "error");
    } finally { setSbusy(false); }
  };

  const addWeight = async () => {
    if (!wform.weightKg || parseFloat(wform.weightKg) <= 0) return;
    setWbusy(true);
    try {
      const rec = await pigApi.addWeight(spaceId, { animalId, weighDate: wform.weighDate, weightKg: parseFloat(wform.weightKg), notes: wform.notes || null, clientUuid: wform.clientUuid });
      setWeights((prev) => [rec, ...prev]);
      setHistory((prev) => prev ? [{ ...rec, event_date: rec.weigh_date, kind: "weight_record" }, ...prev] : prev);
      setWeightOpen(false);
      setWform(blankWform());
      toast(tc({ en: "Weight recorded", hi: "वज़न दर्ज हुआ", bn: "ওজন নথিভুক্ত হয়েছে" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setWbusy(false); }
  };

  const deleteWeight = async () => {
    if (!deleteWeightId) return;
    setDeleteWeightBusy(true);
    try {
      await pigApi.deleteWeight(spaceId, { weightId: deleteWeightId });
      setWeights((prev) => prev.filter((w) => w.id !== deleteWeightId));
      setHistory((prev) => prev ? prev.filter((e) => !(e.kind === "weight_record" && e.id === deleteWeightId)) : prev);
      setDeleteWeightId(null);
    } catch (err) {
      toast(err.message || tc({ en: "Delete failed", hi: "हटाना विफल", bn: "মুছে ফেলা ব্যর্থ" }), "error");
    } finally { setDeleteWeightBusy(false); }
  };

  const addHealth = async () => {
    if (!hform.title.trim()) return;
    setHbusy(true);
    try {
      const rec = await pigApi.addHealth(spaceId, {
        animalId, eventDate: hform.eventDate, eventType: hform.eventType,
        title: hform.title.trim(), medicine: hform.medicine || null, dose: hform.dose || null,
        vetName: hform.vetName || null, nextDueDate: hform.nextDueDate || null,
        notes: hform.notes || null, clientUuid: hform.clientUuid,
      });
      setHistory((prev) => prev ? [{ ...rec, kind: "health_event" }, ...prev] : prev);
      setHealthOpen(false);
      setHform(blankHform());
      toast(tc({ en: "Health event added", hi: "स्वास्थ्य घटना जोड़ी गई", bn: "স্বাস্থ্য ঘটনা যোগ হয়েছে" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setHbusy(false); }
  };

  const addRepro = async () => {
    setRbusy(true);
    try {
      const rec = await pigApi.addRepro(spaceId, {
        animalId, eventDate: rform.eventDate, eventType: rform.eventType,
        boarName: rform.boarName || null,
        pregnancyResult: rform.pregnancyResult || null,
        litterSize: rform.litterSize ? parseInt(rform.litterSize) : null,
        liveBorn: rform.liveBorn ? parseInt(rform.liveBorn) : null,
        stillBorn: rform.stillBorn ? parseInt(rform.stillBorn) : null,
        weanedCount: rform.weanedCount ? parseInt(rform.weanedCount) : null,
        notes: rform.notes || null, clientUuid: rform.clientUuid,
      });
      setHistory((prev) => prev ? [{ ...rec, kind: "repro_event" }, ...prev] : prev);
      setReproOpen(false);
      setRform(blankRform());
      toast(tc({ en: "Repro event added", hi: "प्रजनन घटना जोड़ी गई", bn: "প্রজনন ঘটনা যোগ হয়েছে" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setRbusy(false); }
  };

  const addFeed = async () => {
    setFbusy(true);
    try {
      const rec = await pigApi.addFeed(spaceId, {
        animalId, feedDate: fform.feedDate, feedType: fform.feedType,
        quantityKg: fform.quantityKg ? parseFloat(fform.quantityKg) : null,
        notes: fform.notes || null, clientUuid: fform.clientUuid,
      });
      setHistory((prev) => prev ? [{ ...rec, event_date: rec.feed_date, kind: "feed_record" }, ...prev] : prev);
      setFeedOpen(false);
      setFform(blankFform());
      toast(tc({ en: "Feed record added", hi: "चारा रिकॉर्ड जोड़ा गया", bn: "খাদ্য রেকর্ড যোগ হয়েছে" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setFbusy(false); }
  };

  const bar = (
    <AppBar
      title={animal?.name || tc({ en: "Animal detail", hi: "पशु विवरण", bn: "প্রাণী বিবরণ" })}
      onBack={pop}
      action={canManage && !isTerminal && (
        <button onClick={() => { setEform({ name: animal.name, breed: animal.breed || "", tagId: animal.tag_id || "", dob: animal.dob || "", notes: animal.notes || "" }); setEditOpen(true); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 8px" }}>
          <Icon name="Edit2" size={18} color={T.inkSoft} />
        </button>
      )}
    />
  );

  if (state === "loading") return <>{bar}<div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error" || !animal) return (
    <>{bar}
      <div style={{ padding: 40, textAlign: "center", color: T.inkSoft, fontFamily: T.body }}>
        {tc({ en: "Animal not found.", hi: "पशु नहीं मिला।", bn: "প্রাণী পাওয়া যায়নি।" })}
      </div>
    </>
  );

  const cfg  = STATUS_CFG[animal.current_status] || STATUS_CFG.piglet;
  const age  = fmtAge(animal.dob);
  const lastWeight = weights[0];

  return (
    <>
      {bar}

      {/* Animal header card */}
      <div style={{ margin: "10px 16px 0", background: cfg.bg, borderRadius: T.rMd, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: T.surface,
            display: "grid", placeItems: "center", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
            <Icon name="PiggyBank" size={24} color={cfg.fg} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 17, color: T.ink, fontFamily: T.display }}>{animal.name}</span>
              <StatusChip status={animal.current_status} tc={tc} />
            </div>
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3, fontFamily: T.body }}>
              {tc(SEX_LABEL[animal.sex] || SEX_LABEL.unknown)}
              {animal.breed ? ` · ${animal.breed}` : ""}
              {age ? ` · ${age}` : ""}
              {animal.tag_id ? ` · #${animal.tag_id}` : ""}
            </div>
          </div>
        </div>

        {/* Last weight quick-stat */}
        {lastWeight && (
          <div style={{ marginTop: 10, background: T.surface, borderRadius: T.rSm, padding: "8px 12px",
            display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="Weight" size={14} color={T.blue} />
            <span style={{ fontSize: 13, color: T.ink, fontFamily: T.body }}>
              <strong>{Number(lastWeight.weight_kg).toFixed(1)} kg</strong>
              <span style={{ color: T.inkSoft }}> · {fmtDate(lastWeight.weigh_date)}</span>
            </span>
          </div>
        )}

        {/* Terminal banner */}
        {isTerminal && (
          <div style={{ marginTop: 8, background: "#f0f0f0", borderRadius: T.rSm, padding: "6px 10px",
            display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="Lock" size={13} color="#6b6b6b" />
            <span style={{ fontSize: 11.5, color: "#6b6b6b", fontFamily: T.body }}>
              {tc({ en: "This animal is archived — records are read-only.", hi: "यह पशु संग्रहीत है — रिकॉर्ड केवल पढ़े जा सकते हैं।", bn: "এই প্রাণীটি আর্কাইভ করা হয়েছে — রেকর্ড শুধুমাত্র পড়া যাবে।" })}
            </span>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px", overflowX: "auto" }}>
        {[
          { id: "overview", label: { en: "Overview", hi: "सारांश",  bn: "সারসংক্ষেপ" } },
          { id: "weight",   label: { en: "Weight",   hi: "वज़न",    bn: "ওজন"          } },
          { id: "history",  label: { en: "History",  hi: "इतिहास", bn: "ইতিহাস"       } },
        ].map((t) => (
          <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{tc(t.label)}</Chip>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === "overview" && (
        <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 10 }}>
          <Card>
            <div style={{ padding: "4px 0 8px" }}>
              <InfoRow label={tc({ en: "Breed",            hi: "नस्ल",         bn: "জাত"             })} value={animal.breed} />
              <InfoRow label={tc({ en: "Sex",              hi: "लिंग",          bn: "লিঙ্গ"           })} value={tc(SEX_LABEL[animal.sex] || SEX_LABEL.unknown)} />
              <InfoRow label={tc({ en: "Date of birth",    hi: "जन्म तिथि",    bn: "জন্ম তারিখ"     })} value={fmtDate(animal.dob)} />
              <InfoRow label={tc({ en: "Acquired",         hi: "प्राप्ति तिथि", bn: "অধিগ্রহণ তারিখ" })} value={fmtDate(animal.acquisition_date)} />
              <InfoRow label={tc({ en: "Source",           hi: "स्रोत",         bn: "উৎস"             })} value={animal.acquisition_source} />
              <InfoRow label={tc({ en: "Tag / Ear no.",    hi: "टैग / कान नंबर", bn: "ট্যাগ / কান নম্বর" })} value={animal.tag_id} />
              {animal.notes && (
                <div style={{ paddingTop: 8 }}>
                  <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: T.body, marginBottom: 4 }}>
                    {tc({ en: "Notes", hi: "टिप्पणी", bn: "মন্তব্য" })}
                  </div>
                  <div style={{ fontSize: 13, color: T.ink, fontFamily: T.body, lineHeight: 1.5 }}>{animal.notes}</div>
                </div>
              )}
            </div>
          </Card>

          {/* Status change button */}
          {canManage && !isTerminal && (
            <Button
              variant="outline"
              onClick={() => { setNewStatus(animal.current_status); setStatusOpen(true); }}>
              {tc({ en: "Change Status", hi: "स्थिति बदलें", bn: "স্ট্যাটাস পরিবর্তন করুন" })}
            </Button>
          )}

          {/* Quick-add record buttons */}
          {canRecord && !isTerminal && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <QuickAddBtn icon="Weight"    label={tc({ en: "+ Weight",  hi: "+ वज़न",   bn: "+ ওজন"    })} onClick={() => { setWform(blankWform()); setWeightOpen(true); }} />
              <QuickAddBtn icon="Heart"     label={tc({ en: "+ Health",  hi: "+ स्वास्थ्य", bn: "+ স্বাস্থ্য" })} onClick={() => { setHform(blankHform()); setHealthOpen(true); }} />
              <QuickAddBtn icon="Baby"      label={tc({ en: "+ Repro",   hi: "+ प्रजनन",  bn: "+ প্রজনন" })} onClick={() => { setRform(blankRform()); setReproOpen(true); }} />
              <QuickAddBtn icon="Wheat"     label={tc({ en: "+ Feed",    hi: "+ चारा",    bn: "+ খাদ্য"  })} onClick={() => { setFform(blankFform()); setFeedOpen(true); }} />
            </div>
          )}
        </div>
      )}

      {/* ── Weight tab ── */}
      {tab === "weight" && (
        <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
          {canRecord && !isTerminal && (
            <Button full onClick={() => { setWform(blankWform()); setWeightOpen(true); }}>
              {tc({ en: "+ Log Weight", hi: "+ वज़न दर्ज करें", bn: "+ ওজন লিখুন" })}
            </Button>
          )}
          {weights.length === 0 ? (
            <EmptyState icon="Weight"
              title={tc({ en: "No weight records", hi: "कोई वज़न रिकॉर्ड नहीं", bn: "কোনো ওজন রেকর্ড নেই" })}
              body={tc({ en: "Log weights to track growth.", hi: "विकास ट्रैक करने के लिए वज़न दर्ज करें।", bn: "বৃদ্ধি ট্র্যাক করতে ওজন লিখুন।" })} />
          ) : (
            weights.map((w) => (
              <Card key={w.id} pad={0}>
                <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: T.blueSoft,
                    display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon name="Weight" size={16} color={T.blue} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: T.display }}>
                      {Number(w.weight_kg).toFixed(1)} kg
                    </div>
                    <div style={{ fontSize: 11.5, color: T.inkSoft, fontFamily: T.body }}>{fmtDate(w.weigh_date)}</div>
                    {w.notes && <div style={{ fontSize: 11.5, color: T.inkSoft, fontFamily: T.body, marginTop: 2 }}>{w.notes}</div>}
                  </div>
                  {canRecord && !isTerminal && (
                    <button onClick={() => setDeleteWeightId(w.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                      <Icon name="Trash2" size={15} color={T.inkFaint} />
                    </button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── History tab ── */}
      {tab === "history" && (
        <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Quick-add row on history tab too */}
          {canRecord && !isTerminal && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 4 }}>
              <QuickAddBtn icon="Heart"  label={tc({ en: "+ Health", hi: "+ स्वास्थ्य", bn: "+ স্বাস্থ্য" })} onClick={() => { setHform(blankHform()); setHealthOpen(true); }} />
              <QuickAddBtn icon="Baby"   label={tc({ en: "+ Repro",  hi: "+ प्रजनन",   bn: "+ প্রজনন"  })} onClick={() => { setRform(blankRform()); setReproOpen(true); }} />
              <QuickAddBtn icon="Wheat"  label={tc({ en: "+ Feed",   hi: "+ चारा",     bn: "+ খাদ্য"  })} onClick={() => { setFform(blankFform()); setFeedOpen(true); }} />
            </div>
          )}

          {!history || history.length === 0 ? (
            <EmptyState icon="Clock"
              title={tc({ en: "No events yet", hi: "अभी कोई घटना नहीं", bn: "এখনো কোনো ঘটনা নেই" })}
              body={tc({ en: "Health, repro and feed events appear here.", hi: "स्वास्थ्य, प्रजनन और चारा घटनाएँ यहाँ दिखेंगी।", bn: "স্বাস্থ্য, প্রজনন এবং খাদ্য ঘটনা এখানে দেখাবে।" })} />
          ) : (
            history.map((evt) => <HistoryRow key={`${evt.kind}-${evt.id}`} evt={evt} tc={tc} />)
          )}
        </div>
      )}

      {/* ── Dialogs & sheets ── */}

      {/* Delete weight confirm */}
      <Dialog
        open={!!deleteWeightId}
        title={tc({ en: "Delete weight record?", hi: "वज़न रिकॉर्ड हटाएँ?", bn: "ওজন রেকর্ড মুছবেন?" })}
        body={tc({ en: "This cannot be undone.", hi: "यह पूर्ववत नहीं होगा।", bn: "এটি পূর্বাবস্থায় ফেরানো যাবে না।" })}
        actions={[
          { label: tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" }), onClick: () => setDeleteWeightId(null) },
          { label: deleteWeightBusy ? "…" : tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" }), danger: true, onClick: deleteWeight, disabled: deleteWeightBusy },
        ]} />

      {/* Edit animal */}
      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)}
        title={tc({ en: "Edit Animal", hi: "पशु संपादित करें", bn: "প্রাণী সম্পাদনা করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Name", hi: "नाम", bn: "নাম" })} value={eform.name || ""}
            onChange={(v) => setEform((f) => ({ ...f, name: v }))} />
          <Input label={tc({ en: "Breed", hi: "नस्ल", bn: "জাত" })} value={eform.breed || ""}
            placeholder={tc({ en: "e.g. Yorkshire", hi: "उदा. यॉर्कशायर", bn: "যেমন ইয়র্কশায়ার" })}
            onChange={(v) => setEform((f) => ({ ...f, breed: v }))} />
          <Input label={tc({ en: "Tag / Ear no.", hi: "टैग / कान नंबर", bn: "ট্যাগ / কান নম্বর" })}
            value={eform.tagId || ""} onChange={(v) => setEform((f) => ({ ...f, tagId: v }))} />
          <Input label={tc({ en: "Date of birth", hi: "जन्म तिथि", bn: "জন্ম তারিখ" })}
            type="date" value={eform.dob || ""} onChange={(v) => setEform((f) => ({ ...f, dob: v }))} />
          <Input label={tc({ en: "Notes", hi: "टिप्पणी", bn: "মন্তব্য" })} value={eform.notes || ""}
            onChange={(v) => setEform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={saveEdit} disabled={ebusy}>
            {ebusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Set status */}
      <BottomSheet open={statusOpen} onClose={() => setStatusOpen(false)}
        title={tc({ en: "Change Status", hi: "स्थिति बदलें", bn: "স্ট্যাটাস পরিবর্তন করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label={tc({ en: "New status", hi: "नई स्थिति", bn: "নতুন স্ট্যাটাস" })}
            value={newStatus}
            onChange={setNewStatus}
            options={[
              { value: "piglet",   label: tc({ en: "Piglet",   hi: "सूअर का बच्चा", bn: "শূকরছানা"   }) },
              { value: "grower",   label: tc({ en: "Grower",   hi: "बढ़ता",          bn: "বেড়ে ওঠা"   }) },
              { value: "finisher", label: tc({ en: "Finisher", hi: "फिनिशर",         bn: "ফিনিশার"    }) },
              { value: "breeder",  label: tc({ en: "Breeder",  hi: "प्रजनक",         bn: "প্রজনকারী"  }) },
              { value: "sold",     label: tc({ en: "Sold",     hi: "बेचा",           bn: "বিক্রিত"    }) },
              { value: "deceased", label: tc({ en: "Deceased", hi: "मृत",            bn: "মৃত"          }) },
              { value: "retired",  label: tc({ en: "Retired",  hi: "सेवानिवृत्त",   bn: "অবসরপ্রাপ্ত" }) },
            ]} />
          {TERMINAL.has(newStatus) && (
            <div style={{ background: "#fff3e8", borderRadius: T.rSm, padding: "8px 12px",
              display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="AlertTriangle" size={13} color={T.orange} />
              <span style={{ fontSize: 12, color: T.orange, fontFamily: T.body }}>
                {tc({ en: "Terminal status — records will become read-only.", hi: "टर्मिनल स्थिति — रिकॉर्ड केवल पढ़ने योग्य हो जाएंगे।", bn: "চূড়ান্ত স্ট্যাটাস — রেকর্ড পড়ার মাত্র হবে।" })}
              </span>
            </div>
          )}
          <Button full onClick={saveStatus} disabled={sbusy || newStatus === animal.current_status}>
            {sbusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Update", hi: "अपडेट करें", bn: "আপডেট করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Add weight */}
      <BottomSheet open={weightOpen} onClose={() => setWeightOpen(false)}
        title={tc({ en: "Log Weight", hi: "वज़न दर्ज करें", bn: "ওজন লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date"
            value={wform.weighDate} onChange={(v) => setWform((f) => ({ ...f, weighDate: v }))} />
          <Input label={tc({ en: "Weight (kg)", hi: "वज़न (किलो)", bn: "ওজন (কেজি)" })} type="number"
            placeholder="e.g. 45.5" value={wform.weightKg}
            onChange={(v) => setWform((f) => ({ ...f, weightKg: v }))} />
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={wform.notes} onChange={(v) => setWform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addWeight} disabled={wbusy || !wform.weightKg}>
            {wbusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save Weight", hi: "वज़न सहेजें", bn: "ওজন সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Add health event */}
      <BottomSheet open={healthOpen} onClose={() => setHealthOpen(false)}
        title={tc({ en: "Log Health Event", hi: "स्वास्थ्य घटना दर्ज करें", bn: "স্বাস্থ্য ঘটনা লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date"
            value={hform.eventDate} onChange={(v) => setHform((f) => ({ ...f, eventDate: v }))} />
          <Dropdown label={tc({ en: "Event type", hi: "घटना प्रकार", bn: "ঘটনার ধরন" })}
            value={hform.eventType} onChange={(v) => setHform((f) => ({ ...f, eventType: v }))}
            options={Object.entries(HEALTH_TYPE_LABEL).map(([k, l]) => ({ value: k, label: tc(l) }))} />
          <Input label={tc({ en: "Title / Diagnosis", hi: "शीर्षक / निदान", bn: "শিরোনাম / রোগনির্ণয়" })}
            placeholder={tc({ en: "e.g. FMD vaccination", hi: "उदा. खुरपका-मुँहपका टीका", bn: "যেমন FMD টিকা" })}
            value={hform.title} onChange={(v) => setHform((f) => ({ ...f, title: v }))} />
          <Input label={tc({ en: "Medicine (optional)", hi: "दवाई (वैकल्पिक)", bn: "ওষুধ (ঐচ্ছিক)" })}
            value={hform.medicine} onChange={(v) => setHform((f) => ({ ...f, medicine: v }))} />
          <Input label={tc({ en: "Dose (optional)", hi: "खुराक (वैकल्पिक)", bn: "মাত্রা (ঐচ্ছিক)" })}
            value={hform.dose} onChange={(v) => setHform((f) => ({ ...f, dose: v }))} />
          <Input label={tc({ en: "Next due date (optional)", hi: "अगली तारीख (वैकल्पिक)", bn: "পরবর্তী তারিখ (ঐচ্ছিক)" })}
            type="date" value={hform.nextDueDate} onChange={(v) => setHform((f) => ({ ...f, nextDueDate: v }))} />
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={hform.notes} onChange={(v) => setHform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addHealth} disabled={hbusy || !hform.title.trim()}>
            {hbusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save Event", hi: "घटना सहेजें", bn: "ঘটনা সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Add repro event */}
      <BottomSheet open={reproOpen} onClose={() => setReproOpen(false)}
        title={tc({ en: "Log Repro Event", hi: "प्रजनन घटना दर्ज करें", bn: "প্রজনন ঘটনা লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date"
            value={rform.eventDate} onChange={(v) => setRform((f) => ({ ...f, eventDate: v }))} />
          <Dropdown label={tc({ en: "Event type", hi: "घटना प्रकार", bn: "ঘটনার ধরন" })}
            value={rform.eventType} onChange={(v) => setRform((f) => ({ ...f, eventType: v }))}
            options={Object.entries(REPRO_TYPE_LABEL).map(([k, l]) => ({ value: k, label: tc(l) }))} />
          <Input label={tc({ en: "Boar name (optional)", hi: "सांड का नाम (वैकल्पिक)", bn: "বরাহের নাম (ঐচ্ছিক)" })}
            value={rform.boarName} onChange={(v) => setRform((f) => ({ ...f, boarName: v }))} />
          {rform.eventType === "pregnancy_check" && (
            <Dropdown label={tc({ en: "Pregnancy result", hi: "गर्भ परिणाम", bn: "গর্ভের ফলাফল" })}
              value={rform.pregnancyResult} onChange={(v) => setRform((f) => ({ ...f, pregnancyResult: v }))}
              options={[
                { value: "",             label: tc({ en: "— not recorded —",  hi: "— दर्ज नहीं —",   bn: "— নথিভুক্ত নয় —"  }) },
                { value: "positive",     label: tc({ en: "Positive",          hi: "सकारात्मक",        bn: "পজিটিভ"            }) },
                { value: "negative",     label: tc({ en: "Negative",          hi: "नकारात्मक",        bn: "নেগেটিভ"           }) },
                { value: "inconclusive", label: tc({ en: "Inconclusive",      hi: "अनिश्चित",         bn: "অনিশ্চিত"          }) },
              ]} />
          )}
          {rform.eventType === "farrowing" && (
            <>
              <Input label={tc({ en: "Litter size (total born)", hi: "कुल पैदा हुए", bn: "মোট জন্মানো" })}
                type="number" placeholder="e.g. 10"
                value={rform.litterSize} onChange={(v) => setRform((f) => ({ ...f, litterSize: v }))} />
              <Input label={tc({ en: "Live born", hi: "जीवित पैदा हुए", bn: "জীবিত জন্মানো" })}
                type="number" placeholder="e.g. 9"
                value={rform.liveBorn} onChange={(v) => setRform((f) => ({ ...f, liveBorn: v }))} />
              <Input label={tc({ en: "Still born", hi: "मृत जन्म", bn: "মৃত জন্মানো" })}
                type="number" placeholder="e.g. 1"
                value={rform.stillBorn} onChange={(v) => setRform((f) => ({ ...f, stillBorn: v }))} />
              <Input label={tc({ en: "Weaned count (optional)", hi: "दूध छुड़ाए (वैकल्पिक)", bn: "দুধ ছাড়ানো (ঐচ্ছিক)" })}
                type="number" placeholder="e.g. 8"
                value={rform.weanedCount} onChange={(v) => setRform((f) => ({ ...f, weanedCount: v }))} />
            </>
          )}
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={rform.notes} onChange={(v) => setRform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addRepro} disabled={rbusy}>
            {rbusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save Event", hi: "घटना सहेजें", bn: "ঘটনা সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Add feed record */}
      <BottomSheet open={feedOpen} onClose={() => setFeedOpen(false)}
        title={tc({ en: "Log Feed", hi: "चारा दर्ज करें", bn: "খাদ্য লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date"
            value={fform.feedDate} onChange={(v) => setFform((f) => ({ ...f, feedDate: v }))} />
          <Dropdown label={tc({ en: "Feed type", hi: "चारा प्रकार", bn: "খাদ্যের ধরন" })}
            value={fform.feedType} onChange={(v) => setFform((f) => ({ ...f, feedType: v }))}
            options={Object.entries(FEED_TYPE_LABEL).map(([k, l]) => ({ value: k, label: tc(l) }))} />
          <Input label={tc({ en: "Quantity kg (optional)", hi: "मात्रा किलो (वैकल्पिक)", bn: "পরিমাণ কেজি (ঐচ্ছিক)" })}
            type="number" placeholder="e.g. 2.5"
            value={fform.quantityKg} onChange={(v) => setFform((f) => ({ ...f, quantityKg: v }))} />
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={fform.notes} onChange={(v) => setFform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addFeed} disabled={fbusy}>
            {fbusy ? tc({ en: "Saving…", hi: "सहेज रहे हैं…", bn: "সংরক্ষণ হচ্ছে…" }) : tc({ en: "Save Feed", hi: "चारा सहेजें", bn: "খাদ্য সংরক্ষণ করুন" })}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

function QuickAddBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 5, background: T.surface2,
        border: `1px solid ${T.line}`, borderRadius: 20, padding: "6px 12px",
        fontSize: 12.5, fontWeight: 600, fontFamily: T.body, color: T.inkSoft,
        cursor: "pointer" }}>
      <Icon name={icon} size={13} color={T.inkSoft} />
      {label}
    </button>
  );
}

const KIND_ICON  = { weight_record: "Weight", health_event: "Heart", repro_event: "Baby", feed_record: "Wheat" };
const KIND_COLOR = { weight_record: T.blue, health_event: T.red, repro_event: "#9b59b6", feed_record: "#5a6e1a" };
const KIND_BG    = { weight_record: T.blueSoft, health_event: T.redSoft, repro_event: "#f4eef9", feed_record: "#eef4d2" };

function HistoryRow({ evt, tc }) {
  const REPRO_TYPE_LABEL_local = {
    heat_observed: { en: "Heat", hi: "मद", bn: "তাপ" },
    mating: { en: "Mating", hi: "संभोग", bn: "সঙ্গম" },
    pregnancy_check: { en: "Preg. check", hi: "गर्भ जांच", bn: "গর্ভ পরীক্ষা" },
    farrowing: { en: "Farrowing", hi: "प्रसव", bn: "প্রসব" },
    weaning: { en: "Weaning", hi: "दूध छुड़ाना", bn: "দুধ ছাড়ানো" },
    abortion: { en: "Abortion", hi: "गर्भपात", bn: "গর্ভপাত" },
    other: { en: "Other", hi: "अन्य", bn: "অন্যান্য" },
  };

  const icon  = KIND_ICON[evt.kind]  || "Circle";
  const color = KIND_COLOR[evt.kind] || T.inkSoft;
  const bg    = KIND_BG[evt.kind]    || T.surface2;

  let title = "";
  let sub = "";

  if (evt.kind === "weight_record") {
    title = `${Number(evt.weight_kg).toFixed(1)} kg`;
    sub = tc({ en: "Weight", hi: "वज़न", bn: "ওজন" });
  } else if (evt.kind === "health_event") {
    title = evt.title;
    const typeL = HEALTH_TYPE_LABEL[evt.event_type];
    sub = typeL ? tc(typeL) : evt.event_type;
    if (evt.medicine) sub += ` · ${evt.medicine}`;
  } else if (evt.kind === "repro_event") {
    const typeL = REPRO_TYPE_LABEL_local[evt.event_type];
    title = typeL ? tc(typeL) : evt.event_type;
    if (evt.event_type === "farrowing" && evt.litter_size) {
      sub = `${tc({ en: "Litter", hi: "कूड़ा", bn: "একসঙ্গে জন্মানো" })}: ${evt.litter_size} (${tc({ en: "live", hi: "जीवित", bn: "জীবিত" })}: ${evt.live_born ?? "?"})`;
    } else if (evt.event_type === "pregnancy_check" && evt.pregnancy_result) {
      sub = evt.pregnancy_result;
    } else if (evt.boar_name) {
      sub = `Boar: ${evt.boar_name}`;
    }
  } else if (evt.kind === "feed_record") {
    const typeL = FEED_TYPE_LABEL[evt.feed_type];
    title = typeL ? tc(typeL) : evt.feed_type;
    sub = evt.quantity_kg ? `${Number(evt.quantity_kg).toFixed(1)} kg` : "";
  }

  return (
    <Card pad={0}>
      <div style={{ display: "flex", alignItems: "center", padding: "11px 14px", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: bg,
          display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon name={icon} size={15} color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, fontFamily: T.body }}>{title}</div>
          {sub && <div style={{ fontSize: 11.5, color: T.inkSoft, fontFamily: T.body, marginTop: 1 }}>{sub}</div>}
          {evt.notes && <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: T.body, marginTop: 1 }}>{evt.notes}</div>}
        </div>
        <span style={{ fontSize: 11, color: T.inkFaint, fontFamily: T.body, flexShrink: 0 }}>
          {fmtDate(evt.event_date)}
        </span>
      </div>
    </Card>
  );
}
