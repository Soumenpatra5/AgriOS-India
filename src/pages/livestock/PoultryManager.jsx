import { useState, useEffect, useMemo } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, SectionHeader, Button } from "../../components/index.js";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { animalService, productionService, eventService } from "../../services/livestock/livestockService.js";
import { rupee } from "../../utils/format.js";

/* id drives state and the render branches; label is display only. Translating
   the value itself would silently break every `tab === "Flocks"` check. */
const TABS = [
  { id: "Flocks",     label: { en: "Flocks",     hi: "झुंड",     bn: "ঝাঁক"     } },
  { id: "Production", label: { en: "Production", hi: "उत्पादन",  bn: "উৎপাদন"   } },
  { id: "Events",     label: { en: "Events",     hi: "घटनाएँ",   bn: "ঘটনা"     } },
];
const EVENT_LABELS = {
  vaccination: { en: "Vaccination", hi: "टीकाकरण",   bn: "টিকাকরণ"  },
  deworming:   { en: "Deworming",   hi: "कृमिनाशक",  bn: "কৃমিনাশক" },
  treatment:   { en: "Treatment",   hi: "उपचार",     bn: "চিকিৎসা"  },
  sale:        { en: "Sale",        hi: "बिक्री",     bn: "বিক্রয়"   },
  purchase:    { en: "Purchase",    hi: "खरीद",      bn: "ক্রয়"     },
  other:       { en: "Other",       hi: "अन्य",      bn: "অন্যান্য" },
};
/* value is what gets stored and shown on the flock card, so it stays the
   English canonical; label is transliterated because a Bengali-only reader
   cannot read a Latin-script breed name. */
const BREEDS = [
  { value: "Broiler",      label: { en: "Broiler",      hi: "ब्रॉयलर",  bn: "ব্রয়লার"  } },
  { value: "Layer",        label: { en: "Layer",        hi: "लेयर",     bn: "লেয়ার"    } },
  { value: "Desi/Country", label: { en: "Desi/Country", hi: "देसी",     bn: "দেশি"      } },
  { value: "Kadaknath",    label: { en: "Kadaknath",    hi: "कड़कनाथ",  bn: "কড়কনাথ"  } },
  { value: "Aseel",        label: { en: "Aseel",        hi: "असील",     bn: "আসিল"     } },
  { value: "Other",        label: { en: "Other",        hi: "अन्य",     bn: "অন্যান্য" } },
];
const breedLabel = (v, tc) => { const b = BREEDS.find((x) => x.value === v); return b ? tc(b.label) : v; };
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = (d, locale = "en-IN") => new Date(d + "T12:00").toLocaleDateString(locale, { day: "numeric", month: "short" });

export default function PoultryManager() {
  const { pop, push, toast, tc, locale } = useApp();
  const [tab, setTab]         = useState("Flocks");
  const [flocks, setFlocks]   = useState([]);
  const [prods, setProds]     = useState([]);
  const [events, setEvents]   = useState([]);
  const [tick, setTick]       = useState(0);
  const refresh = () => setTick((n) => n + 1);

  // Add flock sheet
  const [flockOpen, setFlockOpen] = useState(false);
  const [flockForm, setFlockForm] = useState({ name: "", breed: "", count: "", ageWeeks: "", purpose: "layer" });

  // Add production sheet
  const [prodOpen, setProdOpen]   = useState(false);
  const [prodForm, setProdForm]   = useState({ date: todayStr(), eggs: "", mortality: "", feedKg: "", flockId: "" });

  // Add event sheet
  const [eventOpen, setEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ date: todayStr(), type: "vaccination", note: "", dueDate: "" });

  // Delete
  const [delId, setDelId]     = useState(null);
  const [delStore, setDelStore] = useState(null);

  useEffect(() => {
    animalService.getAll("poultry").then(setFlocks);
    productionService.getForEnterprise("poultry", 60).then(setProds);
    eventService.getForEnterprise("poultry").then(setEvents);
  }, [tick]);

  const totalBirds = useMemo(() => flocks.reduce((s, f) => s + (Number(f.count) || 0), 0), [flocks]);
  const monthEggs  = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    return prods.filter((p) => p.date.startsWith(prefix)).reduce((s, p) => s + (Number(p.eggs) || 0), 0);
  }, [prods]);

  const addFlock = async () => {
    if (!flockForm.name || !flockForm.count) return;
    await animalService.add({ ...flockForm, enterprise: "poultry" });
    setFlockOpen(false); setFlockForm({ name: "", breed: "", count: "", ageWeeks: "", purpose: "layer" });
    refresh(); toast(tc({ en: "Flock added", hi: "झुंड जोड़ा गया", bn: "ঝাঁক যোগ হয়েছে" }), "success");
  };

  const addProd = async () => {
    if (!prodForm.date) return;
    await productionService.add({ ...prodForm, enterprise: "poultry", quantity: Number(prodForm.eggs) || 0 });
    setProdOpen(false); setProdForm({ date: todayStr(), eggs: "", mortality: "", feedKg: "", flockId: "" });
    refresh(); toast(tc({ en: "Production logged", hi: "उत्पादन दर्ज हुआ", bn: "উৎপাদন লেখা হয়েছে" }), "success");
  };

  const addEvent = async () => {
    if (!eventForm.type) return;
    await eventService.add({ ...eventForm, enterprise: "poultry" });
    setEventOpen(false); setEventForm({ date: todayStr(), type: "vaccination", note: "", dueDate: "" });
    refresh(); toast(tc({ en: "Event saved", hi: "घटना सहेजी गई", bn: "ঘটনা সংরক্ষিত" }), "success");
  };

  const handleDelete = async () => {
    if (delStore === "animals")     await animalService.remove(delId);
    if (delStore === "productions") await productionService.remove(delId);
    if (delStore === "events")      await eventService.remove(delId);
    setDelId(null); setDelStore(null); refresh(); toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে ফেলা হয়েছে" }), "info");
  };

  const flockOptions = [{ value: "", label: tc({ en: "All flocks", hi: "सभी झुंड", bn: "সব ঝাঁক" }) }, ...flocks.map((f) => ({ value: f.id, label: f.name }))];

  return (
    <>
      <AppBar title={tc({ en: "Poultry", hi: "मुर्गी पालन", bn: "হাঁস-মুরগি" })} onBack={pop} action={
        <button onClick={() => tab === "Flocks" ? setFlockOpen(true) : tab === "Production" ? setProdOpen(true) : setEventOpen(true)}
          style={{ background: T.orange, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
        </button>
      } />

      {/* Summary strip */}
      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        {[
          { label: tc({ en: "Total Birds", hi: "कुल पक्षी", bn: "মোট পাখি" }), value: totalBirds, icon: "Bird" },
          { label: tc({ en: "Eggs This Month", hi: "इस माह अंडे", bn: "এ মাসের ডিম" }), value: monthEggs.toLocaleString("en-IN"), icon: "Egg" },
          { label: tc({ en: "Flocks", hi: "झुंड", bn: "ঝাঁক" }), value: flocks.length, icon: "Layers" },
        ].map((s) => (
          <div key={s.label} style={{ flexShrink: 0, background: T.orangeSoft, borderRadius: T.rMd,
            padding: "10px 14px", minWidth: 100 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.orange, fontFamily: T.display }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "6px 16px 0" }}>
        <button onClick={() => push({ kind: "feedBatchList", props: { enterprise: "poultry" } })}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: T.orangeSoft,
            border: "none", borderRadius: T.rMd, padding: "10px 12px", cursor: "pointer", color: T.orange,
            fontFamily: T.body, fontSize: 12.5, fontWeight: 600 }}>
          <Icon name="Package" size={15} /> {tc({ en: "Feed & FCR for this flock", hi: "इस झुंड के लिए चारा और FCR", bn: "এই ঝাঁকের খাদ্য ও FCR" })} <Icon name="ChevronRight" size={15} style={{ marginLeft: "auto" }} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px", overflowX: "auto" }}>
        {TABS.map((t) => <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{tc(t.label)}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* FLOCKS */}
        {tab === "Flocks" && (
          flocks.length === 0
            ? <EmptyHint icon="Bird" text={tc({ en: "Add your first flock to start tracking", hi: "ट्रैकिंग शुरू करने के लिए पहला झुंड जोड़ें", bn: "ট্র্যাকিং শুরু করতে প্রথম ঝাঁক যোগ করুন" })} />
            : flocks.map((f) => (
              <Card key={f.id} pad={14}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: T.orangeSoft,
                      display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <Icon name="Bird" size={20} color={T.orange} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>{f.name}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>
                        {f.breed ? breedLabel(f.breed, tc) : tc({ en: "Unknown breed", hi: "अज्ञात नस्ल", bn: "অজানা জাত" })} · {f.count} {tc({ en: "birds", hi: "पक्षी", bn: "পাখি" })} · {f.purpose === "layer" ? tc({ en: "Layer", hi: "लेयर", bn: "লেয়ার" }) : tc({ en: "Broiler", hi: "ब्रॉयलर", bn: "ব্রয়লার" })}
                        {f.ageWeeks ? ` · ${f.ageWeeks}${tc({ en: "w old", hi: " सप्ताह", bn: " সপ্তাহ" })}` : ""}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setDelId(f.id); setDelStore("animals"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                    <Icon name="Trash2" size={15} />
                  </button>
                </div>
              </Card>
            ))
        )}

        {/* PRODUCTION */}
        {tab === "Production" && (
          prods.length === 0
            ? <EmptyHint icon="Egg" text={tc({ en: "Log daily egg production to track performance", hi: "प्रदर्शन देखने के लिए रोज़ अंडा उत्पादन दर्ज करें", bn: "কর্মক্ষমতা দেখতে প্রতিদিনের ডিম উৎপাদন লিখুন" })} />
            : prods.slice(0, 30).map((p) => (
              <Card key={p.id} pad={12}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: T.ink }}>{fmtDate(p.date, locale)}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                      🥚 {p.eggs || 0} {tc({ en: "eggs", hi: "अंडे", bn: "ডিম" })}
                      {p.mortality > 0 && ` · ☠ ${p.mortality} ${tc({ en: "mortality", hi: "मृत्यु", bn: "মৃত্যু" })}`}
                      {p.feedKg > 0 && ` · 🌾 ${p.feedKg} ${tc({ en: "kg feed", hi: "किग्रा चारा", bn: "কেজি খাদ্য" })}`}
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

        {/* EVENTS */}
        {tab === "Events" && (
          events.length === 0
            ? <EmptyHint icon="Syringe" text={tc({ en: "Log vaccinations and health events here", hi: "यहाँ टीकाकरण और स्वास्थ्य घटनाएँ दर्ज करें", bn: "এখানে টিকা ও স্বাস্থ্য ঘটনা লিখুন" })} />
            : events.slice(0, 30).map((ev) => (
              <Card key={ev.id} pad={12}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: T.ink, textTransform: "capitalize" }}>
                      {EVENT_LABELS[ev.type] ? tc(EVENT_LABELS[ev.type]) : ev.type.replace(/_/g, " ")}
                    </div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                      {fmtDate(ev.date, locale)}{ev.dueDate ? ` · ${tc({ en: "Due", hi: "अगली तिथि", bn: "পরবর্তী তারিখ" })}: ${fmtDate(ev.dueDate, locale)}` : ""}
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

      {/* Add Flock Sheet */}
      <BottomSheet open={flockOpen} onClose={() => setFlockOpen(false)} title={tc({ en: "Add Flock", hi: "झुंड जोड़ें", bn: "ঝাঁক যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Flock name", hi: "झुंड का नाम", bn: "ঝাঁকের নাম" })} placeholder={tc({ en: "e.g. Batch A", hi: "उदा. बैच A", bn: "যেমন ব্যাচ A" })} value={flockForm.name}
            onChange={(v) => setFlockForm((f) => ({ ...f, name: v }))} />
          <Dropdown label={tc({ en: "Breed", hi: "नस्ल", bn: "জাত" })} value={flockForm.breed} onChange={(v) => setFlockForm((f) => ({ ...f, breed: v }))}
            options={[{ value: "", label: tc({ en: "Select breed…", hi: "नस्ल चुनें…", bn: "জাত বাছুন…" }) }, ...BREEDS.map((b) => ({ value: b.value, label: tc(b.label) }))]} />
          <Input label={tc({ en: "Number of birds", hi: "पक्षियों की संख्या", bn: "পাখির সংখ্যা" })} type="number" placeholder="0" value={flockForm.count}
            onChange={(v) => setFlockForm((f) => ({ ...f, count: v }))} />
          <Input label={tc({ en: "Age (weeks)", hi: "आयु (सप्ताह)", bn: "বয়স (সপ্তাহ)" })} type="number" placeholder="0" value={flockForm.ageWeeks}
            onChange={(v) => setFlockForm((f) => ({ ...f, ageWeeks: v }))} />
          <Dropdown label={tc({ en: "Purpose", hi: "उद्देश्य", bn: "উদ্দেশ্য" })} value={flockForm.purpose} onChange={(v) => setFlockForm((f) => ({ ...f, purpose: v }))}
            options={[{ value: "layer", label: tc({ en: "Layer (eggs)", hi: "लेयर (अंडे)", bn: "লেয়ার (ডিম)" }) }, { value: "broiler", label: tc({ en: "Broiler (meat)", hi: "ब्रॉयलर (मांस)", bn: "ব্রয়লার (মাংস)" }) }]} />
          <Button full onClick={addFlock} disabled={!flockForm.name || !flockForm.count}>{tc({ en: "Add Flock", hi: "झुंड जोड़ें", bn: "ঝাঁক যোগ করুন" })}</Button>
        </div>
      </BottomSheet>

      {/* Add Production Sheet */}
      <BottomSheet open={prodOpen} onClose={() => setProdOpen(false)} title={tc({ en: "Log Production", hi: "उत्पादन दर्ज करें", bn: "উৎপাদন লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date" value={prodForm.date}
            onChange={(v) => setProdForm((f) => ({ ...f, date: v }))} />
          <Dropdown label={tc({ en: "Flock (optional)", hi: "झुंड (वैकल्पिक)", bn: "ঝাঁক (ঐচ্ছিক)" })} value={prodForm.flockId}
            onChange={(v) => setProdForm((f) => ({ ...f, flockId: v }))} options={flockOptions} />
          <Input label={tc({ en: "Eggs collected", hi: "एकत्र अंडे", bn: "সংগৃহীত ডিম" })} type="number" placeholder="0" value={prodForm.eggs}
            onChange={(v) => setProdForm((f) => ({ ...f, eggs: v }))} />
          <Input label={tc({ en: "Mortality", hi: "मृत्यु", bn: "মৃত্যু" })} type="number" placeholder="0" value={prodForm.mortality}
            onChange={(v) => setProdForm((f) => ({ ...f, mortality: v }))} />
          <Input label={tc({ en: "Feed given (kg)", hi: "दिया गया चारा (किग्रा)", bn: "দেওয়া খাদ্য (কেজি)" })} type="number" placeholder="0" value={prodForm.feedKg}
            onChange={(v) => setProdForm((f) => ({ ...f, feedKg: v }))} />
          <Button full onClick={addProd} disabled={!prodForm.date}>{tc({ en: "Save Log", hi: "सहेजें", bn: "সংরক্ষণ" })}</Button>
        </div>
      </BottomSheet>

      {/* Add Event Sheet */}
      <BottomSheet open={eventOpen} onClose={() => setEventOpen(false)} title={tc({ en: "Add Event", hi: "घटना जोड़ें", bn: "ঘটনা যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date" value={eventForm.date}
            onChange={(v) => setEventForm((f) => ({ ...f, date: v }))} />
          <Dropdown label={tc({ en: "Event type", hi: "घटना प्रकार", bn: "ঘটনার ধরন" })} value={eventForm.type}
            onChange={(v) => setEventForm((f) => ({ ...f, type: v }))}
            options={[
              { value: "vaccination", label: tc(EVENT_LABELS.vaccination) },
              { value: "deworming",   label: tc(EVENT_LABELS.deworming) },
              { value: "treatment",   label: tc(EVENT_LABELS.treatment) },
              { value: "sale",        label: tc(EVENT_LABELS.sale) },
              { value: "purchase",    label: tc(EVENT_LABELS.purchase) },
              { value: "other",       label: tc(EVENT_LABELS.other) },
            ]} />
          <Input label={tc({ en: "Notes", hi: "टिप्पणी", bn: "মন্তব্য" })} placeholder={tc({ en: "Details…", hi: "विवरण…", bn: "বিবরণ…" })} value={eventForm.note}
            onChange={(v) => setEventForm((f) => ({ ...f, note: v }))} />
          <Input label={tc({ en: "Next due date (optional)", hi: "अगली तिथि (वैकल्पिक)", bn: "পরবর্তী তারিখ (ঐচ্ছিক)" })} type="date" value={eventForm.dueDate}
            onChange={(v) => setEventForm((f) => ({ ...f, dueDate: v }))} />
          <Button full onClick={addEvent}>{tc({ en: "Save Event", hi: "घटना सहेजें", bn: "ঘটনা সংরক্ষণ" })}</Button>
        </div>
      </BottomSheet>

      {/* Delete confirm */}
      <Dialog open={!!delId} title={tc({ en: "Delete?", hi: "हटाएँ?", bn: "মুছবেন?" })} onClose={() => { setDelId(null); setDelStore(null); }}
        actions={[
          { label: tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" }),  variant: "outline", onClick: () => { setDelId(null); setDelStore(null); } },
          { label: tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" }),  variant: "danger",  onClick: handleDelete },
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
