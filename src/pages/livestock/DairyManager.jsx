import { useState, useEffect, useMemo } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, SectionHeader, Button } from "../../components/index.js";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { animalService, productionService, eventService } from "../../services/livestock/livestockService.js";
import { rupee } from "../../utils/format.js";

/* id drives state; label is display only. */
const TABS = [
  { id: "Animals",  label: { en: "Animals",  hi: "पशु",       bn: "প্রাণী"   } },
  { id: "Milk Log", label: { en: "Milk Log", hi: "दूध लॉग",   bn: "দুধ লগ"   } },
  { id: "Events",   label: { en: "Events",   hi: "घटनाएँ",    bn: "ঘটনা"     } },
];
const EVENT_LABELS = {
  vaccination:     { en: "Vaccination",     hi: "टीकाकरण",       bn: "টিকাকরণ"        },
  ai_breeding:     { en: "AI Breeding",     hi: "कृत्रिम गर्भाधान", bn: "কৃত্রিম প্রজনন" },
  pregnancy_check: { en: "Pregnancy Check", hi: "गर्भ जाँच",      bn: "গর্ভ পরীক্ষা"   },
  calving:         { en: "Calving",         hi: "बछड़ा जन्म",     bn: "বাছুর প্রসব"    },
  treatment:       { en: "Treatment",       hi: "उपचार",         bn: "চিকিৎসা"        },
  deworming:       { en: "Deworming",       hi: "कृमिनाशक",      bn: "কৃমিনাশক"       },
  other:           { en: "Other",           hi: "अन्य",          bn: "অন্যান্য"       },
};
/* value stays English — it is written to the animal record. */
const BREEDS = [
  { value: "HF / Holstein",  label: { en: "HF / Holstein",  hi: "एचएफ / होल्स्टीन", bn: "এইচএফ / হোলস্টেইন" } },
  { value: "Jersey",         label: { en: "Jersey",         hi: "जर्सी",            bn: "জার্সি"            } },
  { value: "Sahiwal",        label: { en: "Sahiwal",        hi: "साहीवाल",          bn: "সাহিওয়াল"         } },
  { value: "Gir",            label: { en: "Gir",            hi: "गिर",              bn: "গির"               } },
  { value: "Murrah Buffalo", label: { en: "Murrah Buffalo", hi: "मुर्रा भैंस",       bn: "মুররা মহিষ"        } },
  { value: "Surti Buffalo",  label: { en: "Surti Buffalo",  hi: "सुरती भैंस",        bn: "সুরতি মহিষ"        } },
  { value: "Mixed",          label: { en: "Mixed",          hi: "मिश्रित",          bn: "মিশ্র"             } },
  { value: "Other",          label: { en: "Other",          hi: "अन्य",             bn: "অন্যান্য"          } },
];
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = (d, locale = "en-IN") => new Date(d + "T12:00").toLocaleDateString(locale, { day: "numeric", month: "short" });

export default function DairyManager() {
  const { pop, push, toast, tc, locale } = useApp();
  const breedLabel = (v) => { const b = BREEDS.find((x) => x.value === v); return b ? tc(b.label) : v; };
  const [tab, setTab]       = useState("Animals");
  const [animals, setAnimals] = useState([]);
  const [prods, setProds]   = useState([]);
  const [events, setEvents] = useState([]);
  const [tick, setTick]     = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [animalOpen, setAnimalOpen] = useState(false);
  const [animalForm, setAnimalForm] = useState({ name: "", breed: "", type: "cow", tagNo: "", lactationStatus: "lactating" });

  const [prodOpen, setProdOpen] = useState(false);
  const [prodForm, setProdForm] = useState({ date: todayStr(), amLitres: "", pmLitres: "", animalId: "", salePrice: "" });

  const [eventOpen, setEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ date: todayStr(), type: "vaccination", note: "", dueDate: "" });

  const [delId, setDelId]     = useState(null);
  const [delStore, setDelStore] = useState(null);

  useEffect(() => {
    animalService.getAll("dairy").then(setAnimals);
    productionService.getForEnterprise("dairy", 60).then(setProds);
    eventService.getForEnterprise("dairy").then(setEvents);
  }, [tick]);

  const totalAnimals = animals.length;
  const monthMilk = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    return prods.filter((p) => p.date.startsWith(prefix))
      .reduce((s, p) => s + (Number(p.amLitres) || 0) + (Number(p.pmLitres) || 0), 0);
  }, [prods]);

  const animalOptions = [{ value: "", label: tc({ en: "All animals", hi: "सभी पशु", bn: "সব প্রাণী" }) }, ...animals.map((a) => ({ value: a.id, label: `${a.name} (${a.type})` }))];

  const addAnimal = async () => {
    if (!animalForm.name) return;
    await animalService.add({ ...animalForm, enterprise: "dairy" });
    setAnimalOpen(false); setAnimalForm({ name: "", breed: "", type: "cow", tagNo: "", lactationStatus: "lactating" });
    refresh(); toast(tc({ en: "Animal added", hi: "पशु जोड़ा गया", bn: "প্রাণী যোগ হয়েছে" }), "success");
  };

  const addProd = async () => {
    if (!prodForm.date) return;
    const total = (Number(prodForm.amLitres) || 0) + (Number(prodForm.pmLitres) || 0);
    await productionService.add({ ...prodForm, enterprise: "dairy", quantity: total });
    setProdOpen(false); setProdForm({ date: todayStr(), amLitres: "", pmLitres: "", animalId: "", salePrice: "" });
    refresh(); toast(tc({ en: "Milk log saved", hi: "दूध लॉग सहेजा गया", bn: "দুধ লগ সংরক্ষিত" }), "success");
  };

  const addEvent = async () => {
    await eventService.add({ ...eventForm, enterprise: "dairy" });
    setEventOpen(false); setEventForm({ date: todayStr(), type: "vaccination", note: "", dueDate: "" });
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
      <AppBar title={tc({ en: "Dairy", hi: "डेयरी", bn: "ডেয়ারি" })} onBack={pop} action={
        <button onClick={() => tab === "Animals" ? setAnimalOpen(true) : tab === "Milk Log" ? setProdOpen(true) : setEventOpen(true)}
          style={{ background: T.blue, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
        </button>
      } />

      {/* Summary strip */}
      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        {[
          { label: tc({ en: "Animals", hi: "पशु", bn: "প্রাণী" }), value: totalAnimals },
          { label: tc({ en: "Milk This Month (L)", hi: "इस माह दूध (L)", bn: "এ মাসের দুধ (L)" }), value: monthMilk.toFixed(1) },
          { label: tc({ en: "Events", hi: "घटनाएँ", bn: "ঘটনা" }), value: events.length },
        ].map((s) => (
          <div key={s.label} style={{ flexShrink: 0, background: T.blueSoft, borderRadius: T.rMd, padding: "10px 14px", minWidth: 100 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.blue, fontFamily: T.display }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "6px 16px 0" }}>
        <button onClick={() => push({ kind: "feedBatchList", props: { enterprise: "dairy" } })}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: T.blueSoft,
            border: "none", borderRadius: T.rMd, padding: "10px 12px", cursor: "pointer", color: T.blue,
            fontFamily: T.body, fontSize: 12.5, fontWeight: 600 }}>
          <Icon name="Package" size={15} /> {tc({ en: "Feed & FCR for this herd", hi: "इस झुंड के लिए चारा और FCR", bn: "এই পালের খাদ্য ও FCR" })} <Icon name="ChevronRight" size={15} style={{ marginLeft: "auto" }} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px" }}>
        {TABS.map((t) => <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{tc(t.label)}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {tab === "Animals" && (
          animals.length === 0
            ? <EmptyHint icon="Milk" text={tc({ en: "Add your first cow or buffalo to start tracking", hi: "ट्रैकिंग शुरू करने के लिए पहली गाय या भैंस जोड़ें", bn: "ট্র্যাকিং শুরু করতে প্রথম গরু বা মহিষ যোগ করুন" })} />
            : animals.map((a) => (
              <Card key={a.id} pad={14}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: T.blueSoft, display: "grid", placeItems: "center" }}>
                      <Icon name="Milk" size={20} color={T.blue} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>
                        {a.type === "cow" ? tc({ en: "Cow", hi: "गाय", bn: "গরু" }) : tc({ en: "Buffalo", hi: "भैंस", bn: "মহিষ" })} · {a.breed ? breedLabel(a.breed) : tc({ en: "Unknown breed", hi: "अज्ञात नस्ल", bn: "অজানা জাত" })}
                        {a.tagNo ? ` · ${tc({ en: "Tag", hi: "टैग", bn: "ট্যাগ" })} #${a.tagNo}` : ""}
                        <span style={{ marginLeft: 6, background: a.lactationStatus === "lactating" ? T.primarySoft : T.surface2,
                          color: a.lactationStatus === "lactating" ? T.primary : T.inkSoft,
                          borderRadius: 5, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>
                          {a.lactationStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setDelId(a.id); setDelStore("animals"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                    <Icon name="Trash2" size={15} />
                  </button>
                </div>
              </Card>
            ))
        )}

        {tab === "Milk Log" && (
          prods.length === 0
            ? <EmptyHint icon="Milk" text={tc({ en: "Log morning and evening milk to track yield", hi: "उपज देखने के लिए सुबह-शाम का दूध दर्ज करें", bn: "ফলন দেখতে সকাল-সন্ধ্যার দুধ লিখুন" })} />
            : prods.slice(0, 30).map((p) => {
              const total = (Number(p.amLitres) || 0) + (Number(p.pmLitres) || 0);
              return (
                <Card key={p.id} pad={12}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(p.date, locale)}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                        🌅 {p.amLitres || 0}L {tc({ en: "AM", hi: "सुबह", bn: "সকাল" })} · 🌆 {p.pmLitres || 0}L {tc({ en: "PM", hi: "शाम", bn: "সন্ধ্যা" })} · {tc({ en: "Total", hi: "कुल", bn: "মোট" })}: {total.toFixed(1)}L
                        {p.salePrice > 0 && ` · ${rupee(p.salePrice)}/L`}
                      </div>
                    </div>
                    <button onClick={() => { setDelId(p.id); setDelStore("productions"); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                      <Icon name="Trash2" size={15} />
                    </button>
                  </div>
                </Card>
              );
            })
        )}

        {tab === "Events" && (
          events.length === 0
            ? <EmptyHint icon="Syringe" text={tc({ en: "Log vaccinations, AI, and health events", hi: "टीकाकरण, गर्भाधान और स्वास्थ्य घटनाएँ दर्ज करें", bn: "টিকা, প্রজনন ও স্বাস্থ্য ঘটনা লিখুন" })} />
            : events.slice(0, 30).map((ev) => (
              <Card key={ev.id} pad={12}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{EVENT_LABELS[ev.type] ? tc(EVENT_LABELS[ev.type]) : ev.type.replace(/_/g, " ")}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                      {fmtDate(ev.date, locale)}{ev.note ? ` · ${ev.note}` : ""}
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

      <BottomSheet open={animalOpen} onClose={() => setAnimalOpen(false)} title={tc({ en: "Add Animal", hi: "पशु जोड़ें", bn: "প্রাণী যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Name / ID", hi: "नाम / आईडी", bn: "নাম / আইডি" })} placeholder={tc({ en: "e.g. Lakshmi", hi: "उदा. लक्ष्मी", bn: "যেমন লক্ষ্মী" })} value={animalForm.name} onChange={(v) => setAnimalForm((f) => ({ ...f, name: v }))} />
          <Dropdown label={tc({ en: "Type", hi: "प्रकार", bn: "ধরন" })} value={animalForm.type} onChange={(v) => setAnimalForm((f) => ({ ...f, type: v }))}
            options={[{ value: "cow", label: tc({ en: "Cow", hi: "गाय", bn: "গরু" }) }, { value: "buffalo", label: tc({ en: "Buffalo", hi: "भैंस", bn: "মহিষ" }) }]} />
          <Dropdown label={tc({ en: "Breed", hi: "नस्ल", bn: "জাত" })} value={animalForm.breed} onChange={(v) => setAnimalForm((f) => ({ ...f, breed: v }))}
            options={[{ value: "", label: tc({ en: "Select breed…", hi: "नस्ल चुनें…", bn: "জাত বাছুন…" }) }, ...BREEDS.map((b) => ({ value: b.value, label: tc(b.label) }))]} />
          <Input label={tc({ en: "Tag / Ear number", hi: "टैग / कान नंबर", bn: "ট্যাগ / কান নম্বর" })} placeholder={tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })} value={animalForm.tagNo} onChange={(v) => setAnimalForm((f) => ({ ...f, tagNo: v }))} />
          <Dropdown label={tc({ en: "Status", hi: "स्थिति", bn: "অবস্থা" })} value={animalForm.lactationStatus} onChange={(v) => setAnimalForm((f) => ({ ...f, lactationStatus: v }))}
            options={[{ value: "lactating", label: tc({ en: "Lactating", hi: "दुधारू", bn: "দুগ্ধবতী" }) }, { value: "dry", label: tc({ en: "Dry", hi: "शुष्क", bn: "শুষ্ক" }) }, { value: "pregnant", label: tc({ en: "Pregnant", hi: "गर्भवती", bn: "গর্ভবতী" }) }]} />
          <Button full onClick={addAnimal} disabled={!animalForm.name}>{tc({ en: "Add Animal", hi: "पशु जोड़ें", bn: "প্রাণী যোগ করুন" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={prodOpen} onClose={() => setProdOpen(false)} title={tc({ en: "Log Milk Production", hi: "दूध उत्पादन दर्ज करें", bn: "দুধ উৎপাদন লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date" value={prodForm.date} onChange={(v) => setProdForm((f) => ({ ...f, date: v }))} />
          <Dropdown label={tc({ en: "Animal (optional)", hi: "पशु (वैकल्पिक)", bn: "প্রাণী (ঐচ্ছিক)" })} value={prodForm.animalId} onChange={(v) => setProdForm((f) => ({ ...f, animalId: v }))} options={animalOptions} />
          <Input label={tc({ en: "Morning milk (litres)", hi: "सुबह का दूध (लीटर)", bn: "সকালের দুধ (লিটার)" })} type="number" placeholder="0" value={prodForm.amLitres} onChange={(v) => setProdForm((f) => ({ ...f, amLitres: v }))} />
          <Input label={tc({ en: "Evening milk (litres)", hi: "शाम का दूध (लीटर)", bn: "সন্ধ্যার দুধ (লিটার)" })} type="number" placeholder="0" value={prodForm.pmLitres} onChange={(v) => setProdForm((f) => ({ ...f, pmLitres: v }))} />
          <Input label={tc({ en: "Sale price (₹/L)", hi: "विक्रय मूल्य (₹/L)", bn: "বিক্রয় মূল্য (₹/L)" })} type="number" placeholder="0" value={prodForm.salePrice} onChange={(v) => setProdForm((f) => ({ ...f, salePrice: v }))} />
          <Button full onClick={addProd}>{tc({ en: "Save Log", hi: "सहेजें", bn: "সংরক্ষণ" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={eventOpen} onClose={() => setEventOpen(false)} title={tc({ en: "Add Event", hi: "घटना जोड़ें", bn: "ঘটনা যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date" value={eventForm.date} onChange={(v) => setEventForm((f) => ({ ...f, date: v }))} />
          <Dropdown label={tc({ en: "Event type", hi: "घटना प्रकार", bn: "ঘটনার ধরন" })} value={eventForm.type} onChange={(v) => setEventForm((f) => ({ ...f, type: v }))}
            options={[
              { value: "vaccination", label: tc(EVENT_LABELS.vaccination) },
              { value: "ai_breeding", label: tc(EVENT_LABELS.ai_breeding) },
              { value: "pregnancy_check", label: tc(EVENT_LABELS.pregnancy_check) },
              { value: "calving", label: tc(EVENT_LABELS.calving) },
              { value: "treatment", label: tc(EVENT_LABELS.treatment) },
              { value: "deworming", label: tc(EVENT_LABELS.deworming) },
              { value: "other", label: tc(EVENT_LABELS.other) },
            ]} />
          <Input label={tc({ en: "Notes", hi: "टिप्पणी", bn: "মন্তব্য" })} placeholder={tc({ en: "Details…", hi: "विवरण…", bn: "বিবরণ…" })} value={eventForm.note} onChange={(v) => setEventForm((f) => ({ ...f, note: v }))} />
          <Input label={tc({ en: "Next due date", hi: "अगली तिथि", bn: "পরবর্তী তারিখ" })} type="date" value={eventForm.dueDate} onChange={(v) => setEventForm((f) => ({ ...f, dueDate: v }))} />
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
