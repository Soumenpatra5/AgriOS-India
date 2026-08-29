import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, Button } from "../../components/index.js";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { animalService, productionService, eventService } from "../../services/livestock/livestockService.js";
import StatTile from "../../components/erp/StatTile.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";

/* id drives state and the render branches; label is display only. */
const TABS = [
  { id: "Herd",       label: { en: "Herd",       hi: "झुंड",       bn: "পাল"        } },
  { id: "Weight Log", label: { en: "Weight Log", hi: "वज़न लॉग",   bn: "ওজন লগ"     } },
  { id: "Events",     label: { en: "Events",     hi: "घटनाएँ",     bn: "ঘটনা"       } },
];
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = (d, locale = "en-IN") => new Date(d + "T12:00").toLocaleDateString(locale, { day: "numeric", month: "short" });

const FG = { primary: T.primary, blue: T.blue, orange: T.orange, red: T.red, yellow: T.yellow };
const BG = { primary: T.primarySoft, blue: T.blueSoft, orange: T.orangeSoft, red: T.redSoft, yellow: T.yellowSoft };

/* Generic ruminant/monogastric herd manager. Goat, Pig and Sheep use this
   with a config — identical workflows, zero duplicated screens. */
export default function HerdManager({ config }) {
  const { enterprise, title, noun, nounPlural, icon, accent, breeds,
          female, male, femalePlural, malePlural, eventTypes } = config;
  const { pop, push, toast, tc, locale } = useApp();
  /* Localise the nouns once, then interpolate them into each language's own
     template below — word order differs, so the sentence cannot be built by
     concatenating a translated noun onto an English frame. */
  const nTitle = tc(title), nNoun = tc(noun), nPlural = tc(nounPlural);
  /* Records store the English breed value; show the reader's script. */
  const breedLabel = (v) => {
    const b = breeds.find((x) => x.value === v);
    return b ? tc(b.label) : (v || tc({ en: "Mixed", hi: "मिश्रित", bn: "মিশ্র" }));
  };
  const fg = FG[accent] || T.primary;
  const bg = BG[accent] || T.primarySoft;

  const [tab, setTab]       = useState("Herd");
  const [animals, setAnimals] = useState([]);
  const [prods, setProds]   = useState([]);
  const [events, setEvents] = useState([]);
  const [tick, setTick]     = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [animalOpen, setAnimalOpen] = useState(false);
  const [animalForm, setAnimalForm] = useState({ name: "", breed: "", gender: "female", ageMonths: "", tagNo: "" });
  const [prodOpen, setProdOpen]     = useState(false);
  const [prodForm, setProdForm]     = useState({ date: todayStr(), weightKg: "", animalId: "" });
  const [eventOpen, setEventOpen]   = useState(false);
  const [eventForm, setEventForm]   = useState({ date: todayStr(), type: eventTypes[0].value, note: "", dueDate: "" });
  const [delTarget, setDelTarget]   = useState(null); // {id, store}

  useEffect(() => {
    animalService.getAll(enterprise).then(setAnimals);
    productionService.getForEnterprise(enterprise, 60).then(setProds);
    eventService.getForEnterprise(enterprise).then(setEvents);
  }, [tick, enterprise]);

  const animalOptions = [
    { value: "", label: tc({ en: `Select ${nNoun.toLowerCase()}…`, hi: `${nNoun} चुनें…`, bn: `${nNoun} বাছুন…` }) },
    ...animals.map((a) => ({ value: a.id, label: a.name }))];

  const addAnimal = async () => {
    if (!animalForm.name) return;
    await animalService.add({ ...animalForm, enterprise });
    setAnimalOpen(false); setAnimalForm({ name: "", breed: "", gender: "female", ageMonths: "", tagNo: "" });
    refresh(); toast(tc({ en: `${nNoun} added`, hi: `${nNoun} जोड़ा गया`, bn: `${nNoun} যোগ হয়েছে` }), "success");
  };
  const addProd = async () => {
    if (!prodForm.weightKg) return;
    await productionService.add({ ...prodForm, enterprise, quantity: Number(prodForm.weightKg) });
    setProdOpen(false); setProdForm({ date: todayStr(), weightKg: "", animalId: "" });
    refresh(); toast(tc({ en: "Weight logged", hi: "वज़न दर्ज हुआ", bn: "ওজন লেখা হয়েছে" }), "success");
  };
  const addEvent = async () => {
    await eventService.add({ ...eventForm, enterprise });
    setEventOpen(false); setEventForm({ date: todayStr(), type: eventTypes[0].value, note: "", dueDate: "" });
    refresh(); toast(tc({ en: "Event saved", hi: "घटना सहेजी गई", bn: "ঘটনা সংরক্ষিত" }), "success");
  };
  const handleDelete = async () => {
    const { id, store } = delTarget;
    if (store === "animals")     await animalService.remove(id);
    if (store === "productions") await productionService.remove(id);
    if (store === "events")      await eventService.remove(id);
    setDelTarget(null); refresh(); toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে ফেলা হয়েছে" }), "info");
  };

  return (
    <>
      <AppBar title={nTitle} onBack={pop} action={
        <button onClick={() => tab === "Herd" ? setAnimalOpen(true) : tab === "Weight Log" ? setProdOpen(true) : setEventOpen(true)}
          style={{ background: fg, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
        </button>
      } />

      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        <StatTile a={accent} label={tc({ en: `Total ${nPlural}`, hi: `कुल ${nPlural}`, bn: `মোট ${nPlural}` })} value={animals.length} />
        <StatTile a={accent} label={tc(femalePlural)} value={animals.filter((a) => a.gender === "female").length} />
        <StatTile a={accent} label={tc(malePlural)} value={animals.filter((a) => a.gender === "male").length} />
      </div>

      <div style={{ padding: "6px 16px 0" }}>
        <button onClick={() => push({ kind: "feedBatchList", props: { enterprise } })}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: T.orangeSoft,
            border: "none", borderRadius: T.rMd, padding: "10px 12px", cursor: "pointer", color: T.orange,
            fontFamily: T.body, fontSize: 12.5, fontWeight: 600 }}>
          <Icon name="Package" size={15} /> {tc({ en: "Feed & FCR for this batch", hi: "इस बैच के लिए चारा और FCR", bn: "এই ব্যাচের খাদ্য ও FCR" })} <Icon name="ChevronRight" size={15} style={{ marginLeft: "auto" }} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px" }}>
        {TABS.map((t) => <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{tc(t.label)}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {tab === "Herd" && (animals.length === 0
          ? <EmptyHint icon={icon} text={tc({ en: `Add ${nPlural.toLowerCase()} to your herd register`, hi: `अपने रजिस्टर में ${nPlural} जोड़ें`, bn: `আপনার রেজিস্টারে ${nPlural} যোগ করুন` })} />
          : animals.map((a) => (
            <RecordRow key={a.id} icon={icon} iconColor={fg} iconBg={bg}
              title={a.name}
              subtitle={`${a.gender === "female" ? tc(female) : tc(male)} · ${breedLabel(a.breed)}${a.ageMonths ? ` · ${a.ageMonths}${tc({ en: "m", hi: " माह", bn: " মাস" })}` : ""}${a.tagNo ? ` · #${a.tagNo}` : ""}`}
              onDelete={() => setDelTarget({ id: a.id, store: "animals" })} />
          )))}

        {tab === "Weight Log" && (prods.length === 0
          ? <EmptyHint icon="Scale" text={tc({ en: "Track weight gain to monitor growth", hi: "वृद्धि देखने के लिए वज़न दर्ज करें", bn: "বৃদ্ধি দেখতে ওজন লিখুন" })} />
          : prods.slice(0, 30).map((p) => (
            <RecordRow key={p.id} icon="Scale" iconColor={fg} iconBg={bg}
              title={`${p.weightKg} kg`}
              subtitle={`${fmtDate(p.date, locale)}${p.animalId ? ` · ${animals.find((a) => a.id === p.animalId)?.name || ""}` : ""}`}
              onDelete={() => setDelTarget({ id: p.id, store: "productions" })} />
          )))}

        {tab === "Events" && (events.length === 0
          ? <EmptyHint icon="Syringe" text={tc({ en: "Log vaccinations, breeding and health events", hi: "टीकाकरण, प्रजनन और स्वास्थ्य घटनाएँ दर्ज करें", bn: "টিকা, প্রজনন ও স্বাস্থ্য ঘটনা লিখুন" })} />
          : events.slice(0, 30).map((ev) => (
            <RecordRow key={ev.id} icon="Syringe" iconColor={fg} iconBg={bg}
              title={(() => { const et = eventTypes.find((t) => t.value === ev.type); return et ? tc(et.label) : ev.type; })()}
              subtitle={`${fmtDate(ev.date, locale)}${ev.dueDate ? ` · ${tc({ en: "Due", hi: "अगली तिथि", bn: "পরবর্তী তারিখ" })} ${fmtDate(ev.dueDate, locale)}` : ""}${ev.note ? ` · ${ev.note}` : ""}`}
              badge={ev.dueDate && ev.dueDate >= todayStr() ? <Pill fg={T.orange} bg={T.orangeSoft}>{tc({ en: "due", hi: "बाकी", bn: "বাকি" })}</Pill> : null}
              onDelete={() => setDelTarget({ id: ev.id, store: "events" })} />
          )))}
      </div>

      <BottomSheet open={animalOpen} onClose={() => setAnimalOpen(false)} title={tc({ en: `Add ${nNoun}`, hi: `${nNoun} जोड़ें`, bn: `${nNoun} যোগ করুন` })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Name / ID", hi: "नाम / आईडी", bn: "নাম / আইডি" })} placeholder={tc({ en: "e.g. Kali", hi: "उदा. काली", bn: "যেমন কালী" })} value={animalForm.name} onChange={(v) => setAnimalForm((f) => ({ ...f, name: v }))} />
          <Dropdown label={tc({ en: "Gender", hi: "लिंग", bn: "লিঙ্গ" })} value={animalForm.gender} onChange={(v) => setAnimalForm((f) => ({ ...f, gender: v }))}
            options={[{ value: "female", label: `${tc(female)} (${tc({ en: "Female", hi: "मादा", bn: "স্ত্রী" })})` }, { value: "male", label: `${tc(male)} (${tc({ en: "Male", hi: "नर", bn: "পুরুষ" })})` }]} />
          <Dropdown label={tc({ en: "Breed", hi: "नस्ल", bn: "জাত" })} value={animalForm.breed} onChange={(v) => setAnimalForm((f) => ({ ...f, breed: v }))}
            options={[{ value: "", label: tc({ en: "Select breed…", hi: "नस्ल चुनें…", bn: "জাত বাছুন…" }) }, ...breeds.map((b) => ({ value: b.value, label: tc(b.label) }))]} />
          <Input label={tc({ en: "Age (months)", hi: "आयु (माह)", bn: "বয়স (মাস)" })} type="number" placeholder="0" value={animalForm.ageMonths} onChange={(v) => setAnimalForm((f) => ({ ...f, ageMonths: v }))} />
          <Input label={tc({ en: "Tag number", hi: "टैग नंबर", bn: "ট্যাগ নম্বর" })} placeholder={tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })} value={animalForm.tagNo} onChange={(v) => setAnimalForm((f) => ({ ...f, tagNo: v }))} />
          <Button full onClick={addAnimal} disabled={!animalForm.name}>{tc({ en: `Add ${nNoun}`, hi: `${nNoun} जोड़ें`, bn: `${nNoun} যোগ করুন` })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={prodOpen} onClose={() => setProdOpen(false)} title={tc({ en: "Log Weight", hi: "वज़न दर्ज करें", bn: "ওজন লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label={nNoun} value={prodForm.animalId} onChange={(v) => setProdForm((f) => ({ ...f, animalId: v }))} options={animalOptions} />
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date" value={prodForm.date} onChange={(v) => setProdForm((f) => ({ ...f, date: v }))} />
          <Input label={tc({ en: "Weight (kg)", hi: "वज़न (किग्रा)", bn: "ওজন (কেজি)" })} type="number" placeholder="0" value={prodForm.weightKg} onChange={(v) => setProdForm((f) => ({ ...f, weightKg: v }))} />
          <Button full onClick={addProd} disabled={!prodForm.weightKg}>{tc({ en: "Save Weight", hi: "वज़न सहेजें", bn: "ওজন সংরক্ষণ" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={eventOpen} onClose={() => setEventOpen(false)} title={tc({ en: "Add Event", hi: "घटना जोड़ें", bn: "ঘটনা যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date" value={eventForm.date} onChange={(v) => setEventForm((f) => ({ ...f, date: v }))} />
          <Dropdown label={tc({ en: "Event type", hi: "घटना प्रकार", bn: "ঘটনার ধরন" })} value={eventForm.type} onChange={(v) => setEventForm((f) => ({ ...f, type: v }))} options={eventTypes.map((e) => ({ value: e.value, label: tc(e.label) }))} />
          <Input label={tc({ en: "Notes", hi: "टिप्पणी", bn: "মন্তব্য" })} placeholder={tc({ en: "Details…", hi: "विवरण…", bn: "বিবরণ…" })} value={eventForm.note} onChange={(v) => setEventForm((f) => ({ ...f, note: v }))} />
          <Input label={tc({ en: "Next due date", hi: "अगली तिथि", bn: "পরবর্তী তারিখ" })} type="date" value={eventForm.dueDate} onChange={(v) => setEventForm((f) => ({ ...f, dueDate: v }))} />
          <Button full onClick={addEvent}>{tc({ en: "Save Event", hi: "घटना सहेजें", bn: "ঘটনা সংরক্ষণ" })}</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delTarget} title={tc({ en: "Delete?", hi: "हटाएँ?", bn: "মুছবেন?" })} onClose={() => setDelTarget(null)}
        actions={[
          { label: tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" }), variant: "outline", onClick: () => setDelTarget(null) },
          { label: tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" }), variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>{tc({ en: "This record will be permanently removed.", hi: "यह रिकॉर्ड स्थायी रूप से हट जाएगा।", bn: "এই রেকর্ড স্থায়ীভাবে মুছে যাবে।" })}</div>
      </Dialog>
    </>
  );
}
