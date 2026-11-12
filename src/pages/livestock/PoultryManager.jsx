import { useState, useEffect, useMemo } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, Button } from "../../components/index.js";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { animalService, productionService, eventService } from "../../services/livestock/livestockService.js";
import { useResponsive } from "../../hooks/useResponsive.js";
import { downloadCsv } from "../../utils/exportCsv.js";
import { printReport } from "../../utils/printReport.js";
import { AnalyticsTrendChart, AnalyticsCategoryBreakdown } from "../../components/analytics/AnalyticsCharts.jsx";

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
  const { isDesktop } = useResponsive(768);
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

  const poultryTrendData = useMemo(() => {
    if (!prods.length) return [];
    const sorted = [...prods].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const slice = sorted.slice(-14);
    return slice.map((p) => ({
      date: p.date ? p.date.slice(5) : "",
      label: p.date ? p.date.slice(5) : "",
      value: Number(p.eggs) || 0,
      secondaryValue: Number(p.feedKg) || 0,
    }));
  }, [prods]);

  const flockBreakdown = useMemo(() => {
    if (!flocks.length) return [];
    const counts = {};
    flocks.forEach((f) => {
      const key = f.purpose || "other";
      counts[key] = (counts[key] || 0) + (Number(f.count) || 0);
    });
    const labels = {
      layer: { en: "Layer", hi: "लेयर", bn: "লেয়ার" },
      broiler: { en: "Broiler", hi: "ब्रॉयलर", bn: "ব্রয়লার" },
      breeder: { en: "Breeder", hi: "प्रजनक", bn: "প্রজননকারী" },
      other: { en: "Other", hi: "अन्य", bn: "অন্যান্য" },
    };
    return Object.entries(counts).map(([k, count]) => ({
      categoryId: k,
      label: tc(labels[k] || { en: k, hi: k, bn: k }),
      total: count,
    }));
  }, [flocks, tc]);

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

  const handleExportCsv = () => {
    if (tab === "Flocks") {
      if (!flocks.length) { toast(tc({ en: "No flocks to export", hi: "निर्यात के लिए कोई झुंड नहीं", bn: "রপ্তানির জন্য কোনো ঝাঁক নেই" }), "info"); return; }
      const rows = flocks.map((f) => ({
        Flock_Name: f.name,
        Breed: f.breed || "",
        Bird_Count: f.count || 0,
        Purpose: f.purpose || "",
        Age_Weeks: f.ageWeeks || 0,
      }));
      downloadCsv(rows, `agrios-poultry-flocks-${todayStr()}.csv`);
    } else if (tab === "Production") {
      if (!prods.length) { toast(tc({ en: "No production logs to export", hi: "निर्यात के लिए कोई उत्पादन नहीं", bn: "রপ্তানির জন্য কোনো উৎপাদন নেই" }), "info"); return; }
      const rows = prods.map((p) => ({
        Date: p.date,
        Eggs_Collected: p.eggs || 0,
        Mortality: p.mortality || 0,
        Feed_Intake_Kg: p.feedKg || 0,
      }));
      downloadCsv(rows, `agrios-poultry-production-${todayStr()}.csv`);
    } else {
      if (!events.length) { toast(tc({ en: "No events to export", hi: "निर्यात के लिए कोई घटना नहीं", bn: "রপ্তানির জন্য কোনো ঘটনা নেই" }), "info"); return; }
      const rows = events.map((ev) => ({
        Date: ev.date,
        Type: ev.type,
        DueDate: ev.dueDate || "",
        Notes: ev.note || "",
      }));
      downloadCsv(rows, `agrios-poultry-events-${todayStr()}.csv`);
    }
    toast(tc({ en: "CSV downloaded", hi: "CSV डाउनलोड हुई", bn: "CSV ডাউনলোড হয়েছে" }), "success");
  };

  const handlePrint = () => {
    let title = tc({ en: "Poultry Management", hi: "मुर्गी पालन प्रबंधन", bn: "হাঁস-মুরগি ব্যবস্থাপনা" });
    let columns;
    let rows;
    const summaryList = [
      { label: tc({ en: "Total Birds", hi: "कुल पक्षी", bn: "মোট পাখি" }), value: String(totalBirds) },
      { label: tc({ en: "Eggs This Month", hi: "इस माह अंडे", bn: "এ মাসের ডিম" }), value: monthEggs.toLocaleString("en-IN") },
    ];

    if (tab === "Flocks") {
      if (!flocks.length) { toast(tc({ en: "No flocks to print", hi: "प्रिंट के लिए कोई झुंड नहीं", bn: "প্রিন্ট করার কোনো ঝাঁক নেই" }), "info"); return; }
      title = `${title} — ${tc({ en: "Flocks Roster", hi: "झुंड सूची", bn: "ঝাঁকের তালিকা" })}`;
      columns = [
        { header: tc({ en: "Flock Name", hi: "झुंड का नाम", bn: "ঝাঁকের নাম" }), key: "name" },
        { header: tc({ en: "Breed", hi: "नस्ल", bn: "জাত" }), key: "breed" },
        { header: tc({ en: "Bird Count", hi: "पक्षियों की संख्या", bn: "পাখির সংখ্যা" }), key: "count", align: "right" },
        { header: tc({ en: "Purpose", hi: "उद्देश्य", bn: "উদ্দেশ্য" }), key: "purpose" },
        { header: tc({ en: "Age", hi: "आयु", bn: "বয়স" }), key: "age" },
      ];
      rows = flocks.map((f) => ({
        name: f.name,
        breed: f.breed ? breedLabel(f.breed, tc) : "—",
        count: `${f.count || 0} ${tc({ en: "birds", hi: "पक्षी", bn: "পাখি" })}`,
        purpose: f.purpose === "layer" ? tc({ en: "Layer", hi: "लेयर", bn: "লেয়ার" }) : tc({ en: "Broiler", hi: "ब्रॉयलर", bn: "ব্রয়লার" }),
        age: f.ageWeeks ? `${f.ageWeeks} ${tc({ en: "weeks", hi: "सप्ताह", bn: "সপ্তাহ" })}` : "—",
      }));
    } else if (tab === "Production") {
      if (!prods.length) { toast(tc({ en: "No production logs to print", hi: "प्रिंट के लिए कोई उत्पादन नहीं", bn: "প্রিন্ট করার কোনো উৎপাদন নেই" }), "info"); return; }
      title = `${title} — ${tc({ en: "Egg Production Log", hi: "अंडा उत्पादन लॉग", bn: "ডিম উৎপাদন লগ" })}`;
      columns = [
        { header: tc({ en: "Date", hi: "तारीख", bn: "তারিখ" }), key: "date" },
        { header: tc({ en: "Eggs Collected", hi: "अंडे एकत्रित", bn: "সংগৃহীত ডিম" }), key: "eggs", align: "right" },
        { header: tc({ en: "Mortality", hi: "मृत्यु दर", bn: "মৃত্যু" }), key: "mortality", align: "right" },
        { header: tc({ en: "Feed Intake", hi: "चारा खपत", bn: "খাদ্য গ্রহণ" }), key: "feed", align: "right" },
      ];
      rows = prods.slice(0, 50).map((p) => ({
        date: fmtDate(p.date, locale),
        eggs: `${p.eggs || 0} ${tc({ en: "eggs", hi: "अंडे", bn: "ডিম" })}`,
        mortality: p.mortality > 0 ? `${p.mortality} ${tc({ en: "birds", hi: "पक्षी", bn: "পাখি" })}` : "0",
        feed: p.feedKg > 0 ? `${p.feedKg} kg` : "—",
      }));
    } else {
      if (!events.length) { toast(tc({ en: "No events to print", hi: "प्रिंट के लिए कोई घटना नहीं", bn: "প্রিন্ট করার কোনো ঘটনা নেই" }), "info"); return; }
      title = `${title} — ${tc({ en: "Health & Events Log", hi: "स्वास्थ्य और घटनाएँ", bn: "স্বাস্থ্য ও ঘটনার লগ" })}`;
      columns = [
        { header: tc({ en: "Event", hi: "घटना", bn: "ঘটনা" }), key: "type" },
        { header: tc({ en: "Date", hi: "तारीख", bn: "তারিখ" }), key: "date" },
        { header: tc({ en: "Due Date", hi: "अगली तिथि", bn: "পরবর্তী তারিখ" }), key: "due" },
        { header: tc({ en: "Notes", hi: "विवरण", bn: "নোট" }), key: "notes" },
      ];
      rows = events.slice(0, 50).map((ev) => ({
        type: EVENT_LABELS[ev.type] ? tc(EVENT_LABELS[ev.type]) : ev.type,
        date: fmtDate(ev.date, locale),
        due: ev.dueDate ? fmtDate(ev.dueDate, locale) : "—",
        notes: ev.note || "—",
      }));
    }

    const ok = printReport({
      title,
      subtitle: `${tc({ en: "Generated for Flock Operations", hi: "झुंड संचालन के लिए तैयार", bn: "ঝাঁক পরিচালনার জন্য প্রস্তুত" })}`,
      columns,
      rows,
      summary: summaryList,
    });
    if (!ok) {
      toast(tc({ en: "Unable to open print preview. Please check pop-up settings.", hi: "प्रिंट विंडो नहीं खुल सकी। पॉप-अप जांचें।", bn: "প্রিন্ট উইন্ডো খোলা যায়নি। পপ-আপ সেটিংস দেখুন।" }), "error");
    }
  };

  const flockOptions = [{ value: "", label: tc({ en: "All flocks", hi: "सभी झुंड", bn: "সব ঝাঁক" }) }, ...flocks.map((f) => ({ value: f.id, label: f.name }))];

  return (
    <>
      <AppBar title={tc({ en: "Poultry", hi: "मुर्गी पालन", bn: "হাঁস-মুরগি" })} onBack={pop} action={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isDesktop && (
            <>
              <button
                onClick={handleExportCsv}
                aria-label={tc({ en: "Export CSV", hi: "CSV निर्यात करें", bn: "CSV ডাউনলোড করুন" })}
                style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "8px 12px",
                  cursor: "pointer", color: T.ink, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, fontFamily: T.body }}>
                <Icon name="Download" size={15} /> {tc({ en: "Export CSV", hi: "CSV निर्यात", bn: "CSV ডাউনলোড" })}
              </button>
              <button
                onClick={handlePrint}
                aria-label={tc({ en: "Print Report", hi: "रिपोर्ट प्रिंट करें", bn: "রিপোর্ট প্রিন্ট করুন" })}
                style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "8px 12px",
                  cursor: "pointer", color: T.ink, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, fontFamily: T.body }}>
                <Icon name="Printer" size={15} /> {tc({ en: "Print", hi: "प्रिंट", bn: "প্রিন্ট" })}
              </button>
            </>
          )}
          <button onClick={() => tab === "Flocks" ? setFlockOpen(true) : tab === "Production" ? setProdOpen(true) : setEventOpen(true)}
            style={{ background: T.orange, border: "none", borderRadius: 12, padding: "8px 13px",
              cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
              fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
            <Icon name="Plus" size={15} color="#fff" /> {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
          </button>
        </div>
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

      {/* ── Desktop Spreadsheet Table View (Screen >= 768px) ── */}
      {isDesktop ? (
        <div style={{ padding: "12px 16px 32px" }}>
          {tab === "Flocks" && flocks.length > 0 && flockBreakdown.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <AnalyticsCategoryBreakdown
                title={tc({ en: "Flock Purpose Distribution", hi: "झुंड उद्देश्य वितरण", bn: "ঝাঁকের উদ্দেশ্য বণ্টন" })}
                categories={flockBreakdown}
                totalAmount={totalBirds}
                prefix=""
                unit={tc({ en: "birds", hi: "पक्षी", bn: "পাখি" })}
              />
            </div>
          )}

          {tab === "Production" && poultryTrendData.length >= 2 && (
            <div style={{ marginBottom: 16 }}>
              <AnalyticsTrendChart
                data={poultryTrendData}
                height={150}
                title={tc({ en: "14-Day Egg Production & Feed Intake Trend", hi: "14-दिवसीय अंडा उत्पादन एवं दाना खपत रुझान", bn: "১৪ দিনের ডিম উৎপাদন ও খাদ্য গ্রহণের ট্রেন্ড" })}
                primaryLabel={tc({ en: "Eggs Collected", hi: "एकत्रित अंडे", bn: "সংগৃহীত ডিম" })}
                secondaryLabel={tc({ en: "Feed (kg)", hi: "दाना (किग्रा)", bn: "খাদ্য (কেজি)" })}
                primaryColor={T.orange}
                secondaryColor={T.primary}
                unit={tc({ en: "eggs", hi: "अंडे", bn: "ডিম" })}
              />
            </div>
          )}

          <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.line}`, overflow: "hidden", boxShadow: T.shadowSm }}>
            {tab === "Flocks" && (
              flocks.length === 0 ? (
                <div style={{ padding: "40px 16px" }}>
                  <EmptyHint icon="Bird" text={tc({ en: "Add your first flock to start tracking", hi: "ट्रैकिंग शुरू करने के लिए पहला झुंड जोड़ें", bn: "ট্র্যাকিং শুরু করতে প্রথম ঝাঁক যোগ করুন" })} />
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, fontFamily: T.body }}>
                    <thead>
                      <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.line}`, color: T.inkSoft, fontSize: 12, fontWeight: 700 }}>
                        <th style={{ padding: "12px 16px" }}>{tc({ en: "Flock Name", hi: "झुंड का नाम", bn: "ঝাঁকের নাম" })}</th>
                        <th style={{ padding: "12px 16px" }}>{tc({ en: "Breed", hi: "नस्ल", bn: "জাত" })}</th>
                        <th style={{ padding: "12px 16px" }}>{tc({ en: "Bird Count", hi: "पक्षियों की संख्या", bn: "পাখির সংখ্যা" })}</th>
                        <th style={{ padding: "12px 16px" }}>{tc({ en: "Purpose", hi: "उद्देश्य", bn: "উদ্দেশ্য" })}</th>
                        <th style={{ padding: "12px 16px" }}>{tc({ en: "Age", hi: "आयु", bn: "বয়স" })}</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>{tc({ en: "Actions", hi: "कार्रवाई", bn: "পদক্ষেপ" })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flocks.map((f) => (
                        <tr key={f.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: T.ink }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: T.orangeSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
                                <Icon name="Bird" size={16} color={T.orange} />
                              </div>
                              {f.name}
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", color: T.inkMid }}>
                            {f.breed ? breedLabel(f.breed, tc) : tc({ en: "Unknown breed", hi: "अज्ञात नस्ल", bn: "অজানা জাত" })}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: T.ink }}>
                            {f.count} {tc({ en: "birds", hi: "पक्षी", bn: "পাখি" })}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{
                              background: f.purpose === "layer" ? T.primarySoft : T.orangeSoft,
                              color: f.purpose === "layer" ? T.primary : T.orange,
                              borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700
                            }}>
                              {f.purpose === "layer" ? tc({ en: "Layer", hi: "लेयर", bn: "লেয়ার" }) : tc({ en: "Broiler", hi: "ब्रॉयलर", bn: "ব্রয়লার" })}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", color: T.inkSoft }}>
                            {f.ageWeeks ? `${f.ageWeeks} ${tc({ en: "weeks", hi: "सप्ताह", bn: "সপ্তাহ" })}` : "—"}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right" }}>
                            <button
                              onClick={() => { setDelId(f.id); setDelStore("animals"); }}
                              title={tc({ en: "Delete", hi: "हटाएं", bn: "মুছুন" })}
                              style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 6, borderRadius: 6 }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = T.danger; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = T.inkFaint; }}
                            >
                              <Icon name="Trash2" size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {tab === "Production" && (
              prods.length === 0 ? (
                <div style={{ padding: "40px 16px" }}>
                  <EmptyHint icon="Egg" text={tc({ en: "Log daily egg production to track performance", hi: "प्रदर्शन देखने के लिए रोज़ अंडा उत्पादन दर्ज करें", bn: "কর্মক্ষমতা দেখতে প্রতিদিনের ডিম উৎপাদন লিখুন" })} />
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, fontFamily: T.body }}>
                    <thead>
                      <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.line}`, color: T.inkSoft, fontSize: 12, fontWeight: 700 }}>
                        <th style={{ padding: "12px 16px" }}>{tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })}</th>
                        <th style={{ padding: "12px 16px" }}>{tc({ en: "Eggs Collected", hi: "अंडे एकत्रित", bn: "সংগৃহীত ডিম" })}</th>
                        <th style={{ padding: "12px 16px" }}>{tc({ en: "Mortality", hi: "मृत्यु दर", bn: "মৃত্যু" })}</th>
                        <th style={{ padding: "12px 16px" }}>{tc({ en: "Feed Intake", hi: "चारा खपत", bn: "খাদ্য গ্রহণ" })}</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>{tc({ en: "Actions", hi: "कार्रवाई", bn: "পদক্ষেপ" })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prods.map((p) => (
                        <tr key={p.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: T.ink }}>
                            {fmtDate(p.date, locale)}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: T.ink }}>
                            🥚 {p.eggs || 0} {tc({ en: "eggs", hi: "अंडे", bn: "ডিম" })}
                          </td>
                          <td style={{ padding: "12px 16px", color: p.mortality > 0 ? T.danger : T.inkSoft, fontWeight: p.mortality > 0 ? 600 : 400 }}>
                            {p.mortality > 0 ? `☠ ${p.mortality} ${tc({ en: "birds", hi: "पक्षी", bn: "পাখি" })}` : "0"}
                          </td>
                          <td style={{ padding: "12px 16px", color: T.inkMid }}>
                            {p.feedKg > 0 ? `🌾 ${p.feedKg} kg` : "—"}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right" }}>
                            <button
                              onClick={() => { setDelId(p.id); setDelStore("productions"); }}
                              title={tc({ en: "Delete", hi: "हटाएं", bn: "মুছুন" })}
                              style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 6, borderRadius: 6 }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = T.danger; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = T.inkFaint; }}
                            >
                              <Icon name="Trash2" size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {tab === "Events" && (
              events.length === 0 ? (
                <div style={{ padding: "40px 16px" }}>
                  <EmptyHint icon="Syringe" text={tc({ en: "Log vaccinations and health events here", hi: "यहाँ टीकाकरण और स्वास्थ्य घटनाएँ दर्ज करें", bn: "এখানে টিকা ও স্বাস্থ্য ঘটনা লিখুন" })} />
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, fontFamily: T.body }}>
                    <thead>
                      <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.line}`, color: T.inkSoft, fontSize: 12, fontWeight: 700 }}>
                        <th style={{ padding: "12px 16px" }}>{tc({ en: "Event", hi: "घटना", bn: "ঘটনা" })}</th>
                        <th style={{ padding: "12px 16px" }}>{tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })}</th>
                        <th style={{ padding: "12px 16px" }}>{tc({ en: "Due Date", hi: "अगली तिथि", bn: "পরবর্তী তারিখ" })}</th>
                        <th style={{ padding: "12px 16px" }}>{tc({ en: "Notes", hi: "विवरण", bn: "নোট" })}</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>{tc({ en: "Actions", hi: "कार्रवाई", bn: "পদক্ষেপ" })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev) => (
                        <tr key={ev.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: T.ink, textTransform: "capitalize" }}>
                            {EVENT_LABELS[ev.type] ? tc(EVENT_LABELS[ev.type]) : ev.type.replace(/_/g, " ")}
                          </td>
                          <td style={{ padding: "12px 16px", color: T.inkMid }}>
                            {fmtDate(ev.date, locale)}
                          </td>
                          <td style={{ padding: "12px 16px", color: ev.dueDate ? T.primary : T.inkFaint, fontWeight: ev.dueDate ? 600 : 400 }}>
                            {ev.dueDate ? fmtDate(ev.dueDate, locale) : "—"}
                          </td>
                          <td style={{ padding: "12px 16px", color: T.inkSoft, maxWidth: 260 }}>
                            {ev.note || "—"}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right" }}>
                            <button
                              onClick={() => { setDelId(ev.id); setDelStore("events"); }}
                              title={tc({ en: "Delete", hi: "हटाएं", bn: "মুছুন" })}
                              style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 6, borderRadius: 6 }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = T.danger; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = T.inkFaint; }}
                            >
                              <Icon name="Trash2" size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        /* Mobile Card View (< 768px) - 100% Unchanged */
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
      )}

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
