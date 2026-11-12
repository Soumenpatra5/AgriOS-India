import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, Button } from "../../components/index.js";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { animalService, productionService, eventService } from "../../services/livestock/livestockService.js";
import { rupee } from "../../utils/format.js";
import { useResponsive } from "../../hooks/useResponsive.js";
import { triggerCSVDownload, calculatePondSummary } from "../../components/livestock/spreadsheetUtils.js";

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

  const pondOptions = [{ value: "", label: tc({ en: "Select pond…", hi: "तालाब चुनें…", bn: "পুকুর বাছুন…" }) }, ...ponds.map((p) => ({ value: p.id, label: p.name }))];

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

  const { isDesktop } = useResponsive();
  const [searchQuery, setSearchQuery] = useState("");
  const pondSummary = calculatePondSummary(ponds);
  const filteredPonds = searchQuery.trim()
    ? ponds.filter((p) => (p.name || "").toLowerCase().includes(searchQuery.trim().toLowerCase()) || (p.species || "").toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : ponds;

  const handleExportCSV = () => {
    if (tab === "Ponds") {
      const headers = ["Pond Name", "Species", "Water Area (Acres)", "Stocked Count", "Stocking Date"];
      const rows = filteredPonds.map((p) => [
        p.name,
        p.species ? speciesLabel(p.species) : "-",
        p.sizeAcres || "-",
        p.stockingCount || "-",
        p.stockingDate || "-",
      ]);
      triggerCSVDownload("aquaculture-ponds", headers, rows);
    } else if (tab === "Feed Log") {
      const headers = ["Date", "Pond", "Feed (kg)", "Water Quality"];
      const rows = prods.map((p) => [
        p.date,
        ponds.find((x) => x.id === p.pondId)?.name || "-",
        p.feedKg || "-",
        p.waterQuality || "-",
      ]);
      triggerCSVDownload("aquaculture-feed-log", headers, rows);
    } else if (tab === "Harvests") {
      const headers = ["Date", "Type", "Weight (kg)", "Price/kg", "Total Value", "Notes"];
      const rows = events.map((ev) => [
        ev.date,
        ev.type,
        ev.weightKg || "-",
        ev.pricePerKg || "-",
        ev.weightKg && ev.pricePerKg ? Number(ev.weightKg) * Number(ev.pricePerKg) : "-",
        ev.note || "-",
      ]);
      triggerCSVDownload("aquaculture-harvests", headers, rows);
    }
  };

  return (
    <>
      {isDesktop ? (
        /* Desktop Multi-Column Aquaculture Spreadsheet Workspace */
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
                  <Icon name="Fish" size={22} color={T.blue} />
                  {tc({ en: "Fish & Aquaculture Workspace", hi: "मछली एवं जलकृषि कार्यक्षेत्र", bn: "মাছ ও মৎস্যচাষ কর্মক্ষেত্র" })}
                </h1>
                <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 2 }}>
                  {tc({ en: "Pond inventories, water health & harvest analytics", hi: "तालाब सूची, जल स्वास्थ्य और कटाई विश्लेषण", bn: "পুকুর তালিকা, জল স্বাস্থ্য ও আহরণ বিশ্লেষণ" })}
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
                onClick={() => tab === "Ponds" ? setPondOpen(true) : tab === "Feed Log" ? setProdOpen(true) : setEventOpen(true)}
                style={{
                  background: T.blue, border: "none", borderRadius: 10, padding: "8px 16px",
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
            <div style={{ background: T.blueSoft, border: `1px solid ${T.blue}20`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.blue }}>{tc({ en: "Total Ponds", hi: "कुल तालाब", bn: "পুকুর সংখ্যা" })}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.blue, marginTop: 4 }}>{ponds.length}</div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>{tc({ en: "Total Water Area", hi: "कुल जल क्षेत्र", bn: "মোট জলসীমা" })}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, marginTop: 4 }}>{pondSummary.totalAcres} {tc({ en: "acres", hi: "एकड़", bn: "একর" })}</div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>{tc({ en: "Fingerlings Stocked", hi: "कुल संचित मत्स्य", bn: "মোট মজুত পোনা" })}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, marginTop: 4 }}>{pondSummary.totalStocked.toLocaleString("en-IN")}</div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>{tc({ en: "Feed Logs", hi: "चारा लॉग", bn: "খাদ্য লগ" })}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, marginTop: 4 }}>{prods.length}</div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>{tc({ en: "Harvests", hi: "कटाई", bn: "আহরণ" })}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, marginTop: 4 }}>{events.filter((e) => e.type === "harvest").length}</div>
            </div>
            <button
              onClick={() => push({ kind: "feedBatchList", props: { enterprise: "fish" } })}
              style={{
                background: T.blueSoft, border: `1px solid ${T.blue}40`, borderRadius: 12, padding: "12px 16px",
                display: "flex", flexDirection: "column", justifyContent: "center", cursor: "pointer", textAlign: "left"
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, display: "flex", alignItems: "center", gap: 5 }}>
                <Icon name="Package" size={14} /> {tc({ en: "Feed & FCR Pond", hi: "चारा और FCR तालाब", bn: "খাদ্য ও FCR পুকুর" })}
              </div>
              <div style={{ fontSize: 11, color: T.blue, marginTop: 4 }}>
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
              {tab === "Ponds" && (
                <div style={{ position: "relative", minWidth: 240 }}>
                  <Icon name="Search" size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.inkFaint }} />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={tc({ en: "Search ponds…", hi: "तालाब में खोजें…", bn: "পুকুরে খুঁজুন…" })}
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
              {tab === "Ponds" && (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, fontFamily: T.body }}>
                  <thead>
                    <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.line}`, color: T.inkSoft, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Pond Name", hi: "तालाब का नाम", bn: "পুকুরের নাম" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Species", hi: "प्रजाति", bn: "প্রজাতি" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Water Area", hi: "क्षेत्रफल", bn: "আয়তন" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Stocked Count", hi: "संचित संख्या", bn: "মজুত সংখ্যা" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Stocking Date", hi: "संचय तिथि", bn: "মজুত তারিখ" })}</th>
                      <th style={{ padding: "10px 16px", textAlign: "right" }}>{tc({ en: "Actions", hi: "कार्रवाई", bn: "পদক্ষেপ" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPonds.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "36px", textAlign: "center", color: T.inkSoft }}>
                          {tc({ en: "No ponds recorded", hi: "कोई तालाब दर्ज नहीं", bn: "কোনও পুকুর নথিভুক্ত নেই" })}
                        </td>
                      </tr>
                    ) : (
                      filteredPonds.map((p, i) => (
                        <tr key={p.id} style={{ borderBottom: `1px solid ${T.lineSoft || T.line}`, background: i % 2 === 0 ? "transparent" : T.surface2 + "40" }}>
                          <td style={{ padding: "11px 16px", fontWeight: 700, color: T.blue }}>{p.name}</td>
                          <td style={{ padding: "11px 16px", color: T.ink }}>
                            {p.species ? speciesLabel(p.species) : tc({ en: "Mixed species", hi: "मिश्रित प्रजाति", bn: "মিশ্র প্রজাতি" })}
                          </td>
                          <td style={{ padding: "11px 16px", color: T.inkSoft }}>
                            {p.sizeAcres ? `${p.sizeAcres} ${tc({ en: "acres", hi: "एकड़", bn: "একর" })}` : "-"}
                          </td>
                          <td style={{ padding: "11px 16px", fontWeight: 600, color: T.ink }}>
                            {p.stockingCount ? Number(p.stockingCount).toLocaleString("en-IN") : "-"}
                          </td>
                          <td style={{ padding: "11px 16px", color: T.inkSoft }}>{p.stockingDate || "-"}</td>
                          <td style={{ padding: "11px 16px", textAlign: "right" }}>
                            <button
                              onClick={() => { setDelId(p.id); setDelStore("animals"); }}
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

              {tab === "Feed Log" && (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, fontFamily: T.body }}>
                  <thead>
                    <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.line}`, color: T.inkSoft, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Pond", hi: "तालाब", bn: "পুকুর" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Feed (kg)", hi: "चारा (किग्रा)", bn: "খাদ্য (কেজি)" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Water Quality", hi: "जल गुणवत्ता", bn: "জলের মান" })}</th>
                      <th style={{ padding: "10px 16px", textAlign: "right" }}>{tc({ en: "Actions", hi: "कार्रवाई", bn: "পদক্ষেপ" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prods.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "36px", textAlign: "center", color: T.inkSoft }}>
                          {tc({ en: "No feed logs recorded", hi: "कोई चारा लॉग दर्ज नहीं", bn: "কোনও খাদ্য লগ লিপিবদ্ধ নেই" })}
                        </td>
                      </tr>
                    ) : (
                      prods.map((p, i) => (
                        <tr key={p.id} style={{ borderBottom: `1px solid ${T.lineSoft || T.line}`, background: i % 2 === 0 ? "transparent" : T.surface2 + "40" }}>
                          <td style={{ padding: "11px 16px", color: T.inkSoft }}>{fmtDate(p.date, locale)}</td>
                          <td style={{ padding: "11px 16px", fontWeight: 600, color: T.ink }}>
                            {ponds.find((x) => x.id === p.pondId)?.name || "-"}
                          </td>
                          <td style={{ padding: "11px 16px", fontWeight: 700, color: T.blue }}>{p.feedKg} kg</td>
                          <td style={{ padding: "11px 16px" }}>
                            <span style={{
                              padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700,
                              background: p.waterQuality === "good" ? T.primarySoft : T.orangeSoft,
                              color: p.waterQuality === "good" ? T.primary : T.orange,
                              textTransform: "capitalize"
                            }}>
                              {p.waterQuality}
                            </span>
                          </td>
                          <td style={{ padding: "11px 16px", textAlign: "right" }}>
                            <button
                              onClick={() => { setDelId(p.id); setDelStore("productions"); }}
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

              {tab === "Harvests" && (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, fontFamily: T.body }}>
                  <thead>
                    <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.line}`, color: T.inkSoft, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Type", hi: "प्रकार", bn: "ধরন" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Weight", hi: "वज़न", bn: "ওজন" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Price / kg", hi: "मूल्य / किग्रा", bn: "দর / কেজি" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Total Value", hi: "अनुमानित मूल्य", bn: "আনুমানিক মূল্য" })}</th>
                      <th style={{ padding: "10px 16px" }}>{tc({ en: "Notes", hi: "टिप्पणी", bn: "মন্তব্য" })}</th>
                      <th style={{ padding: "10px 16px", textAlign: "right" }}>{tc({ en: "Actions", hi: "कार्रवाई", bn: "পদক্ষেপ" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "36px", textAlign: "center", color: T.inkSoft }}>
                          {tc({ en: "No events recorded", hi: "कोई कटाई या घटना दर्ज नहीं", bn: "কোনও আহরণ বা ঘটনা নথিভুক্ত নেই" })}
                        </td>
                      </tr>
                    ) : (
                      events.map((ev, i) => (
                        <tr key={ev.id} style={{ borderBottom: `1px solid ${T.lineSoft || T.line}`, background: i % 2 === 0 ? "transparent" : T.surface2 + "40" }}>
                          <td style={{ padding: "11px 16px", color: T.inkSoft }}>{fmtDate(ev.date, locale)}</td>
                          <td style={{ padding: "11px 16px", fontWeight: 700, color: T.ink, textTransform: "capitalize" }}>
                            {ev.type.replace(/_/g, " ")}
                          </td>
                          <td style={{ padding: "11px 16px", fontWeight: 600, color: T.blue }}>
                            {ev.weightKg ? `${ev.weightKg} kg` : "-"}
                          </td>
                          <td style={{ padding: "11px 16px", color: T.ink }}>
                            {ev.pricePerKg ? rupee(ev.pricePerKg) : "-"}
                          </td>
                          <td style={{ padding: "11px 16px", fontWeight: 700, color: T.primary }}>
                            {ev.weightKg && ev.pricePerKg ? rupee(Number(ev.weightKg) * Number(ev.pricePerKg)) : "-"}
                          </td>
                          <td style={{ padding: "11px 16px", color: T.inkSoft }}>{ev.note || "-"}</td>
                          <td style={{ padding: "11px 16px", textAlign: "right" }}>
                            <button
                              onClick={() => { setDelId(ev.id); setDelStore("events"); }}
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
            </div>
          </div>
        </div>
      ) : (
        /* Mobile Layout: 100% Untouched */
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
        </>
      )}

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
