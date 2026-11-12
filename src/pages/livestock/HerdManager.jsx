import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Chip, Button } from "../../components/index.js";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { animalService, productionService, eventService } from "../../services/livestock/livestockService.js";
import StatTile from "../../components/erp/StatTile.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";
import { useResponsive } from "../../hooks/useResponsive.js";
import { triggerCSVDownload, filterHerdRecords } from "../../components/livestock/spreadsheetUtils.js";

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

  const { isDesktop } = useResponsive();
  const [searchQuery, setSearchQuery] = useState("");
  const filteredAnimals = filterHerdRecords(animals, searchQuery);

  const handleExportCSV = () => {
    if (tab === "Herd") {
      const headers = ["Tag #", "Name", "Gender", "Breed", "Age (Months)"];
      const rows = filteredAnimals.map((a, i) => [
        a.tagNo || `TAG-${String(i + 1).padStart(3, "0")}`,
        a.name,
        a.gender === "female" ? tc(female) : tc(male),
        breedLabel(a.breed),
        a.ageMonths || "-",
      ]);
      triggerCSVDownload(`${enterprise}-herd`, headers, rows);
    } else if (tab === "Weight Log") {
      const headers = ["Date", "Weight (kg)", "Animal ID", "Animal Name"];
      const rows = prods.map((p) => [
        p.date,
        p.weightKg,
        p.animalId || "-",
        animals.find((a) => a.id === p.animalId)?.name || "-",
      ]);
      triggerCSVDownload(`${enterprise}-weight-log`, headers, rows);
    } else if (tab === "Events") {
      const headers = ["Date", "Event Type", "Next Due Date", "Notes"];
      const rows = events.map((ev) => [
        ev.date,
        (() => { const et = eventTypes.find((t) => t.value === ev.type); return et ? tc(et.label) : ev.type; })(),
        ev.dueDate || "-",
        ev.note || "-",
      ]);
      triggerCSVDownload(`${enterprise}-events`, headers, rows);
    }
  };

  return (
    <>
      {isDesktop ? (
        /* Desktop Multi-Column Enterprise Spreadsheet */
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Top Header Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={pop}
                aria-label={tc({ en: "Back", hi: "पीछे", bn: "ফিরে যান" })}
                style={{
                  width: 36, height: 36, borderRadius: 10, border: `1px solid ${T.line}`,
                  background: T.surface, color: T.ink, cursor: "pointer", display: "grid", placeItems: "center"
                }}
              >
                <Icon name="ArrowLeft" size={18} />
              </button>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: fg }} />
                  {nTitle} {tc({ en: "Enterprise Workspace", hi: "उद्यम कार्यक्षेत्र", bn: "উদ্যোগ কর্মক্ষেত্র" })}
                </h1>
                <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 2 }}>
                  {tc({ en: "Multi-batch inventory, weight tracking & health registry", hi: "मल्टी-बैच इन्वेंट्री, वज़न ट्रैकिंग और स्वास्थ्य रजिस्टर", bn: "মাল্টি-ব্যাচ তালিকা, ওজন ট্র্যাকিং ও স্বাস্থ্য রেজিস্টার" })}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={handleExportCSV}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                  borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface,
                  color: T.ink, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: T.body
                }}
              >
                <Icon name="Download" size={15} />
                <span>{tc({ en: "Export CSV", hi: "CSV निर्यात करें", bn: "CSV রপ্তানি করুন" })}</span>
              </button>
              <button
                onClick={() => tab === "Herd" ? setAnimalOpen(true) : tab === "Weight Log" ? setProdOpen(true) : setEventOpen(true)}
                style={{
                  background: fg, border: "none", borderRadius: 10, padding: "8px 16px",
                  cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
                  fontFamily: T.body, fontSize: 13, fontWeight: 700
                }}
              >
                <Icon name="Plus" size={16} color="#fff" />
                <span>{tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}</span>
              </button>
            </div>
          </div>

          {/* Stat Summary Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div style={{ background: bg, border: `1px solid ${fg}20`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: fg }}>{tc({ en: `Total ${nPlural}`, hi: `कुल ${nPlural}`, bn: `মোট ${nPlural}` })}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: fg, marginTop: 4 }}>{animals.length}</div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>{tc(femalePlural)}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, marginTop: 4 }}>{animals.filter((a) => a.gender === "female").length}</div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>{tc(malePlural)}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, marginTop: 4 }}>{animals.filter((a) => a.gender === "male").length}</div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>{tc({ en: "Weight Logs", hi: "वज़न लॉग", bn: "ওজন লগ" })}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, marginTop: 4 }}>{prods.length}</div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>{tc({ en: "Health Events", hi: "स्वास्थ्य घटनाएँ", bn: "স্বাস্থ্য ঘটনা" })}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, marginTop: 4 }}>{events.length}</div>
            </div>
            <button
              onClick={() => push({ kind: "feedBatchList", props: { enterprise } })}
              style={{
                background: T.orangeSoft, border: `1px solid ${T.orange}40`, borderRadius: 12, padding: "12px 16px",
                display: "flex", flexDirection: "column", justifyContent: "center", cursor: "pointer", textAlign: "left"
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, display: "flex", alignItems: "center", gap: 5 }}>
                <Icon name="Package" size={14} /> {tc({ en: "Feed & FCR Batch", hi: "चारा और FCR बैच", bn: "খাদ্য ও FCR ব্যাচ" })}
              </div>
              <div style={{ fontSize: 11, color: T.orange, marginTop: 4 }}>
                {tc({ en: "Manage inventory →", hi: "इन्वेंट्री प्रबंधित करें →", bn: "তালিকা পরিচালনা করুন →" })}
              </div>
            </button>
          </div>

          {/* Spreadsheet Table Container */}
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
            {/* Table Toolbar */}
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {TABS.map((t) => (
                  <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{tc(t.label)}</Chip>
                ))}
              </div>
              {tab === "Herd" && (
                <div style={{ position: "relative", minWidth: 240 }}>
                  <Icon name="Search" size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.inkFaint }} />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={tc({ en: "Search herd…", hi: "झुंड में खोजें…", bn: "পালে খুঁজুন…" })}
                    style={{
                      width: "100%", padding: "7px 10px 7px 30px", borderRadius: 8, border: `1px solid ${T.line}`,
                      background: T.surface2, color: T.ink, fontSize: 13, fontFamily: T.body, outline: "none", boxSizing: "border-box"
                    }}
                  />
                </div>
              )}
            </div>

            {/* Desktop Structured Spreadsheet Tables */}
            <div style={{ overflowX: "auto" }}>
              {tab === "Herd" && (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, fontFamily: T.body }}>
                  <thead>
                    <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.line}`, color: T.inkSoft, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Tag #", hi: "टैग #", bn: "ট্যাগ #" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Name / ID", hi: "नाम / आईडी", bn: "নাম / আইডি" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Gender", hi: "लिंग", bn: "লিঙ্গ" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Breed", hi: "नस्ल", bn: "জাত" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Age", hi: "आयु", bn: "বয়স" })}</th>
                      <th style={{ padding: "10px 16px", textAlign: "right" }}>{tc({ en: "Actions", hi: "कार्रवाई", bn: "পদক্ষেপ" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnimals.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "36px", textAlign: "center", color: T.inkSoft }}>
                          {tc({ en: "No records found", hi: "कोई रिकॉर्ड नहीं मिला", bn: "কোনও রেকর্ড পাওয়া যায়নি" })}
                        </td>
                      </tr>
                    ) : (
                      filteredAnimals.map((a, i) => (
                        <tr key={a.id} style={{ borderBottom: `1px solid ${T.lineSoft || T.line}`, background: i % 2 === 0 ? "transparent" : T.surface2 + "40" }}>
                          <td style={{ padding: "11px 16px", fontWeight: 700, color: fg }}>{a.tagNo || `TAG-${String(i + 1).padStart(3, "0")}`}</td>
                          <td style={{ padding: "11px 16px", fontWeight: 600, color: T.ink }}>{a.name}</td>
                          <td style={{ padding: "11px 16px" }}>
                            <span style={{
                              padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700,
                              background: a.gender === "female" ? T.primarySoft : T.blueSoft,
                              color: a.gender === "female" ? T.primary : T.blue
                            }}>
                              {a.gender === "female" ? tc(female) : tc(male)}
                            </span>
                          </td>
                          <td style={{ padding: "11px 16px", color: T.ink }}>{breedLabel(a.breed)}</td>
                          <td style={{ padding: "11px 16px", color: T.inkSoft }}>{a.ageMonths ? `${a.ageMonths} ${tc({ en: "months", hi: "माह", bn: "মাস" })}` : "-"}</td>
                          <td style={{ padding: "11px 16px", textAlign: "right" }}>
                            <button
                              onClick={() => setDelTarget({ id: a.id, store: "animals" })}
                              aria-label={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
                              style={{ background: "none", border: "none", cursor: "pointer", color: T.red, padding: 4 }}
                            >
                              <Icon name="Trash2" size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {tab === "Weight Log" && (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, fontFamily: T.body }}>
                  <thead>
                    <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.line}`, color: T.inkSoft, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Weight", hi: "वज़न", bn: "ওজন" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Animal", hi: "पशु", bn: "প্রাণী" })}</th>
                      <th style={{ padding: "10px 16px", textAlign: "right" }}>{tc({ en: "Actions", hi: "कार्रवाई", bn: "পদক্ষেপ" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prods.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "36px", textAlign: "center", color: T.inkSoft }}>
                          {tc({ en: "No weight logs recorded", hi: "कोई वज़न लॉग दर्ज नहीं", bn: "কোনও ওজন লগ লিপিবদ্ধ নেই" })}
                        </td>
                      </tr>
                    ) : (
                      prods.map((p, i) => (
                        <tr key={p.id} style={{ borderBottom: `1px solid ${T.lineSoft || T.line}`, background: i % 2 === 0 ? "transparent" : T.surface2 + "40" }}>
                          <td style={{ padding: "11px 16px", color: T.inkSoft }}>{fmtDate(p.date, locale)}</td>
                          <td style={{ padding: "11px 16px", fontWeight: 700, color: fg }}>{p.weightKg} kg</td>
                          <td style={{ padding: "11px 16px", fontWeight: 600, color: T.ink }}>
                            {animals.find((a) => a.id === p.animalId)?.name || tc({ en: "General herd", hi: "सामान्य झुंड", bn: "সাধারণ পাল" })}
                          </td>
                          <td style={{ padding: "11px 16px", textAlign: "right" }}>
                            <button
                              onClick={() => setDelTarget({ id: p.id, store: "productions" })}
                              aria-label={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
                              style={{ background: "none", border: "none", cursor: "pointer", color: T.red, padding: 4 }}
                            >
                              <Icon name="Trash2" size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {tab === "Events" && (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, fontFamily: T.body }}>
                  <thead>
                    <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.line}`, color: T.inkSoft, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Event Type", hi: "घटना प्रकार", bn: "ঘটনার ধরন" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Next Due Date", hi: "अगली तिथि", bn: "পরবর্তী তারিখ" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Notes", hi: "टिप्पणी", bn: "মন্তব্য" })}</th>
                      <th style={{ padding: "10px 16px", textAlign: "right" }}>{tc({ en: "Actions", hi: "कार्रवाई", bn: "পদক্ষেপ" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "36px", textAlign: "center", color: T.inkSoft }}>
                          {tc({ en: "No events recorded", hi: "कोई घटना दर्ज नहीं", bn: "কোনও ঘটনা লিপিবদ্ধ নেই" })}
                        </td>
                      </tr>
                    ) : (
                      events.map((ev, i) => {
                        const et = eventTypes.find((t) => t.value === ev.type);
                        const isDue = ev.dueDate && ev.dueDate >= todayStr();
                        return (
                          <tr key={ev.id} style={{ borderBottom: `1px solid ${T.lineSoft || T.line}`, background: i % 2 === 0 ? "transparent" : T.surface2 + "40" }}>
                            <td style={{ padding: "11px 16px", color: T.inkSoft }}>{fmtDate(ev.date, locale)}</td>
                            <td style={{ padding: "11px 16px", fontWeight: 700, color: T.ink }}>{et ? tc(et.label) : ev.type}</td>
                            <td style={{ padding: "11px 16px" }}>
                              {ev.dueDate ? (
                                <span style={{
                                  padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700,
                                  background: isDue ? T.orangeSoft : T.surface2,
                                  color: isDue ? T.orange : T.inkSoft
                                }}>
                                  {fmtDate(ev.dueDate, locale)} {isDue ? `(${tc({ en: "due", hi: "बाकी", bn: "বাকি" })})` : ""}
                                </span>
                              ) : "-"}
                            </td>
                            <td style={{ padding: "11px 16px", color: T.inkSoft }}>{ev.note || "-"}</td>
                            <td style={{ padding: "11px 16px", textAlign: "right" }}>
                              <button
                                onClick={() => setDelTarget({ id: ev.id, store: "events" })}
                                aria-label={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
                                style={{ background: "none", border: "none", cursor: "pointer", color: T.red, padding: 4 }}
                              >
                                <Icon name="Trash2" size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Mobile Layout: 100% Untouched */
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
        </>
      )}

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
