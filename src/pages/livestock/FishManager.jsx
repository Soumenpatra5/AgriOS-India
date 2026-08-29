import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, Button } from "../../components/index.js";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { animalService, productionService, eventService } from "../../services/livestock/livestockService.js";
import { rupee } from "../../utils/format.js";

const TABS = [
  { id: "Ponds",    label: { en: "Ponds",    hi: "तालाब",    bn: "পুকুর"     } },
  { id: "Feed Log", label: { en: "Feed Log", hi: "चारा लॉग", bn: "খাদ্য লগ"  } },
  { id: "Harvests", label: { en: "Harvests", hi: "कटाई",     bn: "আহরণ"      } },
];
const EVENT_LABELS = {
  harvest:   { en: "Harvest",            hi: "कटाई",           bn: "আহরণ"            },
  treatment: { en: "Treatment / Lime",   hi: "उपचार / चूना",   bn: "চিকিৎসা / চুন"   },
  restocking:{ en: "Restocking",         hi: "पुनः संचय",      bn: "পুনঃমজুত"        },
  other:     { en: "Other",              hi: "अन्य",           bn: "অন্যান্য"        },
};
/* value stays English — written to the pond record. */
const SPECIES = [
  { value: "Rohu",        label: { en: "Rohu",        hi: "रोहू",        bn: "রুই"        } },
  { value: "Katla",       label: { en: "Katla",       hi: "कतला",        bn: "কাতলা"      } },
  { value: "Mrigal",      label: { en: "Mrigal",      hi: "मृगल",        bn: "মৃগেল"      } },
  { value: "Common Carp", label: { en: "Common Carp", hi: "कॉमन कार्प",  bn: "কমন কার্প"  } },
  { value: "Pangasius",   label: { en: "Pangasius",   hi: "पंगेसियस",    bn: "প্যাঙ্গাস"  } },
  { value: "Tilapia",     label: { en: "Tilapia",     hi: "तिलापिया",    bn: "তেলাপিয়া"  } },
  { value: "Catfish",     label: { en: "Catfish",     hi: "मांगुर",      bn: "মাগুর"      } },
  { value: "Prawn",       label: { en: "Prawn",       hi: "झींगा",       bn: "চিংড়ি"     } },
  { value: "Other",       label: { en: "Other",       hi: "अन्य",        bn: "অন্যান্য"   } },
];
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = (d, locale = "en-IN") => new Date(d + "T12:00").toLocaleDateString(locale, { day: "numeric", month: "short" });

export default function FishManager() {
  const { pop, push, toast, tc, locale } = useApp();
  const speciesLabel = (v) => { const x = SPECIES.find((y) => y.value === v); return x ? tc(x.label) : v; };
  const [tab, setTab]       = useState("Ponds");
  const [ponds, setPonds]   = useState([]);
  const [prods, setProds]   = useState([]);
  const [events, setEvents] = useState([]);
  const [tick, setTick]     = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [pondOpen, setPondOpen] = useState(false);
  const [pondForm, setPondForm] = useState({ name: "", species: "", sizeAcres: "", stockingCount: "", stockingDate: todayStr() });

  const [prodOpen, setProdOpen] = useState(false);
  const [prodForm, setProdForm] = useState({ date: todayStr(), feedKg: "", pondId: "", waterQuality: "good" });

  const [eventOpen, setEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ date: todayStr(), type: "harvest", weightKg: "", pricePerKg: "", note: "" });

  const [delId, setDelId]     = useState(null);
  const [delStore, setDelStore] = useState(null);

  useEffect(() => {
    animalService.getAll("fish").then(setPonds);
    productionService.getForEnterprise("fish", 60).then(setProds);
    eventService.getForEnterprise("fish").then(setEvents);
  }, [tick]);

  const pondOptions = [{ value: "", label: "Select pond…" }, ...ponds.map((p) => ({ value: p.id, label: p.name }))];

  const addPond = async () => {
    if (!pondForm.name) return;
    await animalService.add({ ...pondForm, enterprise: "fish" });
    setPondOpen(false); setPondForm({ name: "", species: "", sizeAcres: "", stockingCount: "", stockingDate: todayStr() });
    refresh(); toast(tc({ en: "Pond added", hi: "तालाब जोड़ा गया", bn: "পুকুর যোগ হয়েছে" }), "success");
  };

  const addProd = async () => {
    if (!prodForm.feedKg) return;
    await productionService.add({ ...prodForm, enterprise: "fish", quantity: Number(prodForm.feedKg) });
    setProdOpen(false); setProdForm({ date: todayStr(), feedKg: "", pondId: "", waterQuality: "good" });
    refresh(); toast(tc({ en: "Feed log saved", hi: "चारा लॉग सहेजा गया", bn: "খাদ্য লগ সংরক্ষিত" }), "success");
  };

  const addEvent = async () => {
    if (!eventForm.type) return;
    await eventService.add({ ...eventForm, enterprise: "fish" });
    setEventOpen(false); setEventForm({ date: todayStr(), type: "harvest", weightKg: "", pricePerKg: "", note: "" });
    refresh(); toast(tc({ en: "Event saved", hi: "घटना सहेजी गई", bn: "ঘটনা সংরক্ষিত" }), "success");
  };

  const handleDelete = async () => {
    if (delStore === "animals")     await animalService.remove(delId);
    if (delStore === "productions") await productionService.remove(delId);
    if (delStore === "events")      await eventService.remove(delId);
    setDelId(null); setDelStore(null); refresh(); toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে ফেলা হয়েছে" }), "info");
  };

  return (
    <>
      <AppBar title={tc({ en: "Fish / Aquaculture", hi: "मछली / जलकृषि", bn: "মাছ / মৎস্যচাষ" })} onBack={pop} action={
        <button onClick={() => tab === "Ponds" ? setPondOpen(true) : tab === "Feed Log" ? setProdOpen(true) : setEventOpen(true)}
          style={{ background: T.blue, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
        </button>
      } />

      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        {[
          { label: tc({ en: "Ponds", hi: "तालाब", bn: "পুকুর" }), value: ponds.length },
          { label: tc({ en: "Feed Logs", hi: "चारा लॉग", bn: "খাদ্য লগ" }), value: prods.length },
          { label: tc({ en: "Harvests", hi: "कटाई", bn: "আহরণ" }), value: events.filter((e) => e.type === "harvest").length },
        ].map((s) => (
          <div key={s.label} style={{ flexShrink: 0, background: T.blueSoft, borderRadius: T.rMd, padding: "10px 14px", minWidth: 90 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.blue, fontFamily: T.display }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "6px 16px 0" }}>
        <button onClick={() => push({ kind: "feedBatchList", props: { enterprise: "fish" } })}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: T.blueSoft,
            border: "none", borderRadius: T.rMd, padding: "10px 12px", cursor: "pointer", color: T.blue,
            fontFamily: T.body, fontSize: 12.5, fontWeight: 600 }}>
          <Icon name="Package" size={15} /> {tc({ en: "Feed & FCR for this pond", hi: "इस तालाब के लिए चारा और FCR", bn: "এই পুকুরের খাদ্য ও FCR" })} <Icon name="ChevronRight" size={15} style={{ marginLeft: "auto" }} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px" }}>
        {TABS.map((t) => <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{tc(t.label)}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {tab === "Ponds" && (
          ponds.length === 0
            ? <EmptyHint icon="Fish" text={tc({ en: "Add your first pond or tank to start tracking", hi: "ट्रैकिंग शुरू करने के लिए पहला तालाब जोड़ें", bn: "ট্র্যাকিং শুরু করতে প্রথম পুকুর যোগ করুন" })} />
            : ponds.map((p) => (
              <Card key={p.id} pad={14}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: T.blueSoft, display: "grid", placeItems: "center" }}>
                      <Icon name="Fish" size={20} color={T.blue} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>
                        {p.species ? speciesLabel(p.species) : tc({ en: "Mixed species", hi: "मिश्रित प्रजाति", bn: "মিশ্র প্রজাতি" })}{p.sizeAcres ? ` · ${p.sizeAcres} ${tc({ en: "acres", hi: "एकड़", bn: "একর" })}` : ""}
                        {p.stockingCount ? ` · ${Number(p.stockingCount).toLocaleString("en-IN")} ${tc({ en: "stocked", hi: "संचित", bn: "মজুত" })}` : ""}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setDelId(p.id); setDelStore("animals"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                    <Icon name="Trash2" size={15} />
                  </button>
                </div>
              </Card>
            ))
        )}

        {tab === "Feed Log" && (
          prods.length === 0
            ? <EmptyHint icon="Package" text={tc({ en: "Log daily feed to calculate FCR and costs", hi: "FCR और लागत के लिए रोज़ चारा दर्ज करें", bn: "FCR ও খরচের জন্য প্রতিদিনের খাদ্য লিখুন" })} />
            : prods.slice(0, 30).map((p) => (
              <Card key={p.id} pad={12}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(p.date, locale)}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft }}>
                      🌾 {p.feedKg} kg feed · Water: {p.waterQuality}
                      {p.pondId ? ` · ${ponds.find((x) => x.id === p.pondId)?.name || ""}` : ""}
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

        {tab === "Harvests" && (
          events.length === 0
            ? <EmptyHint icon="ShoppingBag" text={tc({ en: "Log harvests, treatments and other events", hi: "कटाई, उपचार और अन्य घटनाएँ दर्ज करें", bn: "আহরণ, চিকিৎসা ও অন্যান্য ঘটনা লিখুন" })} />
            : events.slice(0, 30).map((ev) => (
              <Card key={ev.id} pad={12}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{ev.type.replace(/_/g, " ")}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft }}>
                      {fmtDate(ev.date, locale)}
                      {ev.weightKg ? ` · ${ev.weightKg} kg` : ""}
                      {ev.pricePerKg ? ` · ${rupee(ev.pricePerKg)}/kg` : ""}
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

      <BottomSheet open={pondOpen} onClose={() => setPondOpen(false)} title={tc({ en: "Add Pond / Tank", hi: "तालाब जोड़ें", bn: "পুকুর যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Pond name", hi: "तालाब का नाम", bn: "পুকুরের নাম" })} placeholder={tc({ en: "e.g. Pond 1", hi: "उदा. तालाब 1", bn: "যেমন পুকুর ১" })} value={pondForm.name} onChange={(v) => setPondForm((f) => ({ ...f, name: v }))} />
          <Dropdown label={tc({ en: "Species", hi: "प्रजाति", bn: "প্রজাতি" })} value={pondForm.species} onChange={(v) => setPondForm((f) => ({ ...f, species: v }))}
            options={[{ value: "", label: tc({ en: "Select species…", hi: "प्रजाति चुनें…", bn: "প্রজাতি বাছুন…" }) }, ...SPECIES.map((x) => ({ value: x.value, label: tc(x.label) }))]} />
          <Input label={tc({ en: "Size (acres)", hi: "आकार (एकड़)", bn: "আকার (একর)" })} type="number" placeholder="0" value={pondForm.sizeAcres} onChange={(v) => setPondForm((f) => ({ ...f, sizeAcres: v }))} />
          <Input label={tc({ en: "Stocking count", hi: "संचय संख्या", bn: "মজুত সংখ্যা" })} type="number" placeholder="0" value={pondForm.stockingCount} onChange={(v) => setPondForm((f) => ({ ...f, stockingCount: v }))} />
          <Input label={tc({ en: "Stocking date", hi: "संचय तिथि", bn: "মজুত তারিখ" })} type="date" value={pondForm.stockingDate} onChange={(v) => setPondForm((f) => ({ ...f, stockingDate: v }))} />
          <Button full onClick={addPond} disabled={!pondForm.name}>{tc({ en: "Add Pond", hi: "तालाब जोड़ें", bn: "পুকুর যোগ করুন" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={prodOpen} onClose={() => setProdOpen(false)} title={tc({ en: "Log Daily Feed", hi: "दैनिक चारा दर्ज करें", bn: "প্রতিদিনের খাদ্য লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date" value={prodForm.date} onChange={(v) => setProdForm((f) => ({ ...f, date: v }))} />
          <Dropdown label={tc({ en: "Pond", hi: "तालाब", bn: "পুকুর" })} value={prodForm.pondId} onChange={(v) => setProdForm((f) => ({ ...f, pondId: v }))} options={pondOptions} />
          <Input label={tc({ en: "Feed given (kg)", hi: "दिया गया चारा (किग्रा)", bn: "দেওয়া খাদ্য (কেজি)" })} type="number" placeholder="0" value={prodForm.feedKg} onChange={(v) => setProdForm((f) => ({ ...f, feedKg: v }))} />
          <Dropdown label={tc({ en: "Water quality", hi: "जल गुणवत्ता", bn: "জলের গুণমান" })} value={prodForm.waterQuality} onChange={(v) => setProdForm((f) => ({ ...f, waterQuality: v }))}
            options={[{ value: "good", label: tc({ en: "Good", hi: "अच्छा", bn: "ভালো" }) }, { value: "fair", label: tc({ en: "Fair", hi: "ठीक", bn: "মাঝারি" }) }, { value: "poor", label: tc({ en: "Poor", hi: "खराब", bn: "খারাপ" }) }]} />
          <Button full onClick={addProd} disabled={!prodForm.feedKg}>{tc({ en: "Save Log", hi: "सहेजें", bn: "সংরক্ষণ" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={eventOpen} onClose={() => setEventOpen(false)} title={tc({ en: "Add Event", hi: "घटना जोड़ें", bn: "ঘটনা যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date" value={eventForm.date} onChange={(v) => setEventForm((f) => ({ ...f, date: v }))} />
          <Dropdown label={tc({ en: "Type", hi: "प्रकार", bn: "ধরন" })} value={eventForm.type} onChange={(v) => setEventForm((f) => ({ ...f, type: v }))}
            options={[
              { value: "harvest",   label: tc(EVENT_LABELS.harvest) },
              { value: "treatment", label: tc(EVENT_LABELS.treatment) },
              { value: "restocking",label: tc(EVENT_LABELS.restocking) },
              { value: "other",     label: tc(EVENT_LABELS.other) },
            ]} />
          <Input label={tc({ en: "Weight harvested (kg)", hi: "कटाई वज़न (किग्रा)", bn: "আহরিত ওজন (কেজি)" })} type="number" placeholder="0" value={eventForm.weightKg} onChange={(v) => setEventForm((f) => ({ ...f, weightKg: v }))} />
          <Input label={tc({ en: "Sale price (₹/kg)", hi: "विक्रय मूल्य (₹/किग्रा)", bn: "বিক্রয় মূল্য (₹/কেজি)" })} type="number" placeholder="0" value={eventForm.pricePerKg} onChange={(v) => setEventForm((f) => ({ ...f, pricePerKg: v }))} />
          <Input label={tc({ en: "Notes", hi: "टिप्पणी", bn: "মন্তব্য" })} placeholder={tc({ en: "Details…", hi: "विवरण…", bn: "বিবরণ…" })} value={eventForm.note} onChange={(v) => setEventForm((f) => ({ ...f, note: v }))} />
          <Button full onClick={addEvent}>{tc({ en: "Save Event", hi: "घटना सहेजें", bn: "ঘটনা সংরক্ষণ" })}</Button>
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
