import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Chip } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { vaccinationService } from "../../services/livestock/vaccinationService.js";
import StatTile from "../../components/erp/StatTile.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";

/* id drives state; label is display only. */
const TABS = [
  { id: "Upcoming", label: { en: "Upcoming", hi: "आगामी",  bn: "আসন্ন"   } },
  { id: "Missed",   label: { en: "Missed",   hi: "छूटे",    bn: "বাদ পড়া" } },
  { id: "History",  label: { en: "History",  hi: "इतिहास",  bn: "ইতিহাস"  } },
];
const fmtDate = (d, locale = "en-IN") => d ? new Date(d + "T12:00").toLocaleDateString(locale, { day: "numeric", month: "short" }) : "";

export default function VaccinationCalendar() {
  const { pop, push, tc, locale } = useApp();
  const [tab, setTab]           = useState("Upcoming");
  const [upcoming, setUpcoming] = useState([]);
  const [missed, setMissed]     = useState([]);
  const [history, setHistory]   = useState([]);

  useEffect(() => {
    vaccinationService.upcoming(60).then(setUpcoming);
    vaccinationService.missed().then(setMissed);
    vaccinationService.allHealth().then(setHistory);
  }, []);

  const list = tab === "Upcoming" ? upcoming : tab === "Missed" ? missed : history.slice(0, 50);

  const typeLabel = (t) => t.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

  return (
    <>
      <AppBar title={tc({ en: "Vaccination Calendar", hi: "टीकाकरण कैलेंडर", bn: "টিকাকরণ ক্যালেন্ডার" })} onBack={pop} />

      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        <StatTile a="blue" label={tc({ en: "Upcoming (60d)", hi: "आगामी (60 दिन)", bn: "আসন্ন (৬০ দিন)" })} value={upcoming.length} />
        <StatTile a={missed.length > 0 ? "red" : "primary"} label={tc({ en: "Missed", hi: "छूटे", bn: "বাদ পড়া" })} value={missed.length} />
        <StatTile a="primary" label={tc({ en: "Total Records", hi: "कुल रिकॉर्ड", bn: "মোট রেকর্ড" })} value={history.length} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px" }}>
        {TABS.map((t) => (
          <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {tc(t.label)}{t.id === "Missed" && missed.length > 0 ? ` (${missed.length})` : ""}
          </Chip>
        ))}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {list.length === 0
          ? <EmptyHint icon="Syringe"
              text={tab === "Upcoming" ? tc({ en: "No vaccinations due in the next 60 days — log health events with a due date in each livestock module", hi: "अगले 60 दिनों में कोई टीकाकरण नहीं — हर पशुधन मॉड्यूल में नियत तिथि के साथ स्वास्थ्य घटनाएँ दर्ज करें", bn: "পরবর্তী ৬০ দিনে কোনও টিকা নেই — প্রতিটি পশুসম্পদ মডিউলে নির্ধারিত তারিখসহ স্বাস্থ্য ঘটনা লিখুন" })
                : tab === "Missed" ? tc({ en: "Nothing missed — well done!", hi: "कुछ नहीं छूटा — बढ़िया!", bn: "কিছু বাদ পড়েনি — চমৎকার!" })
                : tc({ en: "Health events logged in any livestock module appear here", hi: "किसी भी पशुधन मॉड्यूल में दर्ज स्वास्थ्य घटनाएँ यहाँ दिखती हैं", bn: "যেকোনো পশুসম্পদ মডিউলে লেখা স্বাস্থ্য ঘটনা এখানে দেখা যায়" })} />
          : list.map((ev) => (
            <RecordRow key={ev.id}
              icon={ev.enterpriseIcon || "Syringe"}
              iconColor={tab === "Missed" ? T.red : T.blue}
              iconBg={tab === "Missed" ? T.redSoft : T.blueSoft}
              title={`${typeLabel(ev.type)} — ${ev.enterpriseI18n ? tc(ev.enterpriseI18n) : ev.enterpriseLabel}`}
              badge={tab === "Upcoming" ? <Pill fg={T.blue} bg={T.blueSoft}>{tc({ en: "due", hi: "बाकी", bn: "বাকি" })} {fmtDate(ev.dueDate, locale)}</Pill>
                : tab === "Missed" ? <Pill fg={T.red} bg={T.redSoft}>{tc({ en: "missed", hi: "छूटा", bn: "বাদ" })} {fmtDate(ev.dueDate, locale)}</Pill> : null}
              subtitle={`${tc({ en: "Logged", hi: "दर्ज", bn: "লেখা" })} ${fmtDate(ev.date, locale)}${ev.note ? ` · ${ev.note}` : ""}`} />
          ))}

        {tab === "Missed" && missed.length > 0 && (
          <div style={{ background: T.redSoft, borderRadius: T.rLg, padding: "12px 14px",
            borderLeft: `4px solid ${T.red}`, fontSize: 12.5, color: T.inkSoft }}>
            {tc({ en: "Open the livestock module and log the vaccination once done — it clears from this list automatically.", hi: "टीका लगने पर पशुधन मॉड्यूल में दर्ज करें — यह सूची से अपने आप हट जाएगा।", bn: "টিকা দেওয়ার পর পশুসম্পদ মডিউলে লিখুন — এটি তালিকা থেকে নিজেই সরে যাবে।" })}
          </div>
        )}
      </div>
    </>
  );
}
