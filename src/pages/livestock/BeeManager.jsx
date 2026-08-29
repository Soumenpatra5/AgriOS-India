import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, Button } from "../../components/index.js";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { animalService, productionService, eventService } from "../../services/livestock/livestockService.js";
import { rupee } from "../../utils/format.js";

const TABS = [
  { id: "Hives",       label: { en: "Hives",       hi: "छत्ते",     bn: "মৌচাক"    } },
  { id: "Honey Log",   label: { en: "Honey Log",   hi: "शहद लॉग",   bn: "মধু লগ"   } },
  { id: "Inspections", label: { en: "Inspections", hi: "निरीक्षण",  bn: "পরিদর্শন" } },
];
const EVENT_LABELS = {
  inspection: { en: "Hive Inspection",        hi: "छत्ता निरीक्षण",   bn: "মৌচাক পরিদর্শন"  },
  treatment:  { en: "Treatment / Medication", hi: "उपचार / दवा",      bn: "চিকিৎসা / ওষুধ"  },
  supering:   { en: "Supering (add box)",     hi: "सुपरिंग (बॉक्स)",  bn: "সুপারিং (বাক্স)" },
  splitting:  { en: "Colony Splitting",       hi: "कॉलोनी विभाजन",    bn: "কলোনি বিভাজন"    },
  requeening: { en: "Re-queening",            hi: "रानी बदलना",       bn: "রানি বদল"        },
  other:      { en: "Other",                  hi: "अन्य",             bn: "অন্যান্য"        },
};
const QUEEN_LABELS = {
  present: { en: "Queen Present", hi: "रानी मौजूद", bn: "রানি আছে"     },
  absent:  { en: "Queen Absent",  hi: "रानी नहीं",  bn: "রানি নেই"     },
  unknown: { en: "Not Checked",   hi: "जाँच नहीं",  bn: "পরীক্ষা হয়নি" },
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = (d, locale = "en-IN") => new Date(d + "T12:00").toLocaleDateString(locale, { day: "numeric", month: "short" });

export default function BeeManager() {
  const { pop, toast, tc, locale } = useApp();
  const [tab, setTab]       = useState("Hives");
  const [hives, setHives]   = useState([]);
  const [prods, setProds]   = useState([]);
  const [events, setEvents] = useState([]);
  const [tick, setTick]     = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [hiveOpen, setHiveOpen] = useState(false);
  const [hiveForm, setHiveForm] = useState({ name: "", location: "", colonyStrength: "strong", installedDate: todayStr() });

  const [prodOpen, setProdOpen] = useState(false);
  const [prodForm, setProdForm] = useState({ date: todayStr(), honeyKg: "", hiveId: "", pricePerKg: "" });

  const [eventOpen, setEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ date: todayStr(), type: "inspection", note: "", queenStatus: "present" });

  const [delId, setDelId]     = useState(null);
  const [delStore, setDelStore] = useState(null);

  useEffect(() => {
    animalService.getAll("bee").then(setHives);
    productionService.getForEnterprise("bee", 60).then(setProds);
    eventService.getForEnterprise("bee").then(setEvents);
  }, [tick]);

  const totalHoney = prods.reduce((s, p) => s + (Number(p.honeyKg) || 0), 0);
  const hiveOptions = [{ value: "", label: "All hives" }, ...hives.map((h) => ({ value: h.id, label: h.name }))];

  const addHive = async () => {
    if (!hiveForm.name) return;
    await animalService.add({ ...hiveForm, enterprise: "bee" });
    setHiveOpen(false); setHiveForm({ name: "", location: "", colonyStrength: "strong", installedDate: todayStr() });
    refresh(); toast(tc({ en: "Hive added", hi: "छत्ता जोड़ा गया", bn: "মৌচাক যোগ হয়েছে" }), "success");
  };

  const addProd = async () => {
    if (!prodForm.honeyKg) return;
    await productionService.add({ ...prodForm, enterprise: "bee", quantity: Number(prodForm.honeyKg) });
    setProdOpen(false); setProdForm({ date: todayStr(), honeyKg: "", hiveId: "", pricePerKg: "" });
    refresh(); toast(tc({ en: "Honey harvest logged", hi: "शहद कटाई दर्ज हुई", bn: "মধু আহরণ লেখা হয়েছে" }), "success");
  };

  const addEvent = async () => {
    await eventService.add({ ...eventForm, enterprise: "bee" });
    setEventOpen(false); setEventForm({ date: todayStr(), type: "inspection", note: "", queenStatus: "present" });
    refresh(); toast(tc({ en: "Event saved", hi: "घटना सहेजी गई", bn: "ঘটনা সংরক্ষিত" }), "success");
  };

  const handleDelete = async () => {
    if (delStore === "animals")     await animalService.remove(delId);
    if (delStore === "productions") await productionService.remove(delId);
    if (delStore === "events")      await eventService.remove(delId);
    setDelId(null); setDelStore(null); refresh(); toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে ফেলা হয়েছে" }), "info");
  };

  const strengthColor = { strong: T.primary, medium: T.orange, weak: T.red };

  return (
    <>
      <AppBar title={tc({ en: "Beekeeping", hi: "मधुमक्खी पालन", bn: "মৌমাছি পালন" })} onBack={pop} action={
        <button onClick={() => tab === "Hives" ? setHiveOpen(true) : tab === "Honey Log" ? setProdOpen(true) : setEventOpen(true)}
          style={{ background: T.yellow, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
        </button>
      } />

      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        {[
          { label: tc({ en: "Hives", hi: "छत्ते", bn: "মৌচাক" }), value: hives.length },
          { label: tc({ en: "Total Honey (kg)", hi: "कुल शहद (किग्रा)", bn: "মোট মধু (কেজি)" }), value: totalHoney.toFixed(1) },
          { label: tc({ en: "Inspections", hi: "निरीक्षण", bn: "পরিদর্শন" }), value: events.filter((e) => e.type === "inspection").length },
        ].map((s) => (
          <div key={s.label} style={{ flexShrink: 0, background: T.yellowSoft, borderRadius: T.rMd, padding: "10px 14px", minWidth: 100 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.yellow, fontFamily: T.display }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px" }}>
        {TABS.map((t) => <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{tc(t.label)}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {tab === "Hives" && (
          hives.length === 0
            ? <EmptyHint icon="Bug" text={tc({ en: "Register your bee boxes to start tracking", hi: "ट्रैकिंग शुरू करने के लिए अपने बॉक्स दर्ज करें", bn: "ট্র্যাকিং শুরু করতে আপনার বাক্স নথিভুক্ত করুন" })} />
            : hives.map((h) => (
              <Card key={h.id} pad={14}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: T.yellowSoft, display: "grid", placeItems: "center" }}>
                      <Icon name="Bug" size={20} color={T.yellow} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{h.name}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>
                        {h.location || "No location"}
                        <span style={{ marginLeft: 6, background: h.colonyStrength === "strong" ? T.primarySoft : h.colonyStrength === "medium" ? T.orangeSoft : T.redSoft,
                          color: strengthColor[h.colonyStrength] || T.primary,
                          borderRadius: 5, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>
                          {h.colonyStrength}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setDelId(h.id); setDelStore("animals"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                    <Icon name="Trash2" size={15} />
                  </button>
                </div>
              </Card>
            ))
        )}

        {tab === "Honey Log" && (
          prods.length === 0
            ? <EmptyHint icon="Droplets" text={tc({ en: "Log each honey harvest to track your yield", hi: "उपज देखने के लिए हर शहद कटाई दर्ज करें", bn: "ফলন দেখতে প্রতিটি মধু আহরণ লিখুন" })} />
            : prods.slice(0, 30).map((p) => (
              <Card key={p.id} pad={12}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(p.date, locale)}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft }}>
                      🍯 {p.honeyKg} kg
                      {p.pricePerKg ? ` · ${rupee(p.pricePerKg)}/kg` : ""}
                      {p.hiveId ? ` · ${hives.find((h) => h.id === p.hiveId)?.name || ""}` : ""}
                    </div>
                  </div>
                  <button onClick={() => { setDelId(p.id); setDelStore("productions"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                    <Icon name="Trash2" size={15} />
                  </button>
                </div>
              </Card>
            ))
        )}

        {tab === "Inspections" && (
          events.length === 0
            ? <EmptyHint icon="Search" text={tc({ en: "Log hive inspections to monitor colony health", hi: "कॉलोनी स्वास्थ्य के लिए निरीक्षण दर्ज करें", bn: "কলোনির স্বাস্থ্য দেখতে পরিদর্শন লিখুন" })} />
            : events.slice(0, 30).map((ev) => (
              <Card key={ev.id} pad={12}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{ev.type.replace(/_/g, " ")}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft }}>
                      {fmtDate(ev.date, locale)}
                      {ev.queenStatus ? ` · ${QUEEN_LABELS[ev.queenStatus] ? tc(QUEEN_LABELS[ev.queenStatus]) : ev.queenStatus}` : ""}
                      {ev.note ? ` · ${ev.note}` : ""}
                    </div>
                  </div>
                  <button onClick={() => { setDelId(ev.id); setDelStore("events"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                    <Icon name="Trash2" size={15} />
                  </button>
                </div>
              </Card>
            ))
        )}
      </div>

      <BottomSheet open={hiveOpen} onClose={() => setHiveOpen(false)} title={tc({ en: "Add Hive", hi: "छत्ता जोड़ें", bn: "মৌচাক যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Hive name / number", hi: "छत्ता नाम / नंबर", bn: "মৌচাকের নাম / নম্বর" })} placeholder={tc({ en: "e.g. Box 1", hi: "उदा. बॉक्स 1", bn: "যেমন বাক্স ১" })} value={hiveForm.name} onChange={(v) => setHiveForm((f) => ({ ...f, name: v }))} />
          <Input label={tc({ en: "Location", hi: "स्थान", bn: "অবস্থান" })} placeholder={tc({ en: "e.g. Mango orchard", hi: "उदा. आम का बाग", bn: "যেমন আমবাগান" })} value={hiveForm.location} onChange={(v) => setHiveForm((f) => ({ ...f, location: v }))} />
          <Dropdown label={tc({ en: "Colony strength", hi: "कॉलोनी ताकत", bn: "কলোনির শক্তি" })} value={hiveForm.colonyStrength} onChange={(v) => setHiveForm((f) => ({ ...f, colonyStrength: v }))}
            options={[{ value: "strong", label: tc({ en: "Strong", hi: "मज़बूत", bn: "শক্তিশালী" }) }, { value: "medium", label: tc({ en: "Medium", hi: "मध्यम", bn: "মাঝারি" }) }, { value: "weak", label: tc({ en: "Weak", hi: "कमज़ोर", bn: "দুর্বল" }) }]} />
          <Input label={tc({ en: "Installation date", hi: "स्थापना तिथि", bn: "স্থাপনের তারিখ" })} type="date" value={hiveForm.installedDate} onChange={(v) => setHiveForm((f) => ({ ...f, installedDate: v }))} />
          <Button full onClick={addHive} disabled={!hiveForm.name}>{tc({ en: "Add Hive", hi: "छत्ता जोड़ें", bn: "মৌচাক যোগ করুন" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={prodOpen} onClose={() => setProdOpen(false)} title={tc({ en: "Log Honey Harvest", hi: "शहद कटाई दर्ज करें", bn: "মধু আহরণ লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date" value={prodForm.date} onChange={(v) => setProdForm((f) => ({ ...f, date: v }))} />
          <Dropdown label={tc({ en: "Hive (optional)", hi: "छत्ता (वैकल्पिक)", bn: "মৌচাক (ঐচ্ছিক)" })} value={prodForm.hiveId} onChange={(v) => setProdForm((f) => ({ ...f, hiveId: v }))} options={hiveOptions} />
          <Input label={tc({ en: "Honey collected (kg)", hi: "एकत्र शहद (किग्रा)", bn: "সংগৃহীত মধু (কেজি)" })} type="number" placeholder="0" value={prodForm.honeyKg} onChange={(v) => setProdForm((f) => ({ ...f, honeyKg: v }))} />
          <Input label={tc({ en: "Sale price (₹/kg)", hi: "विक्रय मूल्य (₹/किग्रा)", bn: "বিক্রয় মূল্য (₹/কেজি)" })} type="number" placeholder="0" value={prodForm.pricePerKg} onChange={(v) => setProdForm((f) => ({ ...f, pricePerKg: v }))} />
          <Button full onClick={addProd} disabled={!prodForm.honeyKg}>{tc({ en: "Save Harvest", hi: "कटाई सहेजें", bn: "আহরণ সংরক্ষণ" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={eventOpen} onClose={() => setEventOpen(false)} title={tc({ en: "Add Inspection / Event", hi: "निरीक्षण / घटना जोड़ें", bn: "পরিদর্শন / ঘটনা যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date" value={eventForm.date} onChange={(v) => setEventForm((f) => ({ ...f, date: v }))} />
          <Dropdown label={tc({ en: "Type", hi: "प्रकार", bn: "ধরন" })} value={eventForm.type} onChange={(v) => setEventForm((f) => ({ ...f, type: v }))}
            options={[
              { value: "inspection",   label: tc(EVENT_LABELS.inspection) },
              { value: "treatment",    label: tc(EVENT_LABELS.treatment) },
              { value: "supering",     label: tc(EVENT_LABELS.supering) },
              { value: "splitting",    label: tc(EVENT_LABELS.splitting) },
              { value: "requeening",   label: tc(EVENT_LABELS.requeening) },
              { value: "other",        label: tc(EVENT_LABELS.other) },
            ]} />
          <Dropdown label={tc({ en: "Queen status", hi: "रानी स्थिति", bn: "রানির অবস্থা" })} value={eventForm.queenStatus} onChange={(v) => setEventForm((f) => ({ ...f, queenStatus: v }))}
            options={[{ value: "present", label: tc(QUEEN_LABELS.present) }, { value: "absent", label: tc(QUEEN_LABELS.absent) }, { value: "unknown", label: tc(QUEEN_LABELS.unknown) }]} />
          <Input label={tc({ en: "Notes", hi: "टिप्पणी", bn: "মন্তব্য" })} placeholder={tc({ en: "Observations…", hi: "अवलोकन…", bn: "পর্যবেক্ষণ…" })} value={eventForm.note} onChange={(v) => setEventForm((f) => ({ ...f, note: v }))} />
          <Button full onClick={addEvent}>{tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ" })}</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delId} title={tc({ en: "Delete?", hi: "हटाएँ?", bn: "মুছবেন?" })} onClose={() => { setDelId(null); setDelStore(null); }}
        actions={[
          { label: tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" }), variant: "outline", onClick: () => { setDelId(null); setDelStore(null); } },
          { label: tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" }), variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>{tc({ en: "This record will be permanently removed.", hi: "यह रिकॉर्ड स्थायी रूप से हट जाएगा।", bn: "এই রেকর্ড স্থায়ীভাবে মুছে যাবে।" })}</div>
      </Dialog>
    </>
  );
}

function EmptyHint({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: T.inkFaint }}>
      <Icon name={icon} size={36} color={T.line} />
      <div style={{ marginTop: 12, fontSize: 13 }}>{text}</div>
    </div>
  );
}
