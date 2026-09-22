/* Batch History — complete, immutable timeline for one poultry batch.
   Queries buildTimeline() which returns every P1-P4 event, workflow task,
   incident, and follow-up outcome stored against this batch_id.
   Read-only view; closed batches are shown with a read-only banner. */

import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Chip, EmptyState, ErrorState, Spinner,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { poultryApi } from "../../services/poultry/poultryApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

/* ── event metadata ───────────────────────────────────────────────────────── */

const KIND = {
  placement:    { icon: "Bird",          color: () => T.primary,   label: { en: "Placement",     hi: "प्लेसमेंट",     bn: "স্থাপন",      ta: "ஸ்தாபனம்",         te: "ఉంచడం",          mr: "ठेवणे",       pa: "ਰੱਖਣਾ",            or: "ଆଗମନ" } },
  daily_record: { icon: "ClipboardList", color: () => T.primary,   label: { en: "Daily record",  hi: "दैनिक रिकॉर्ड",  bn: "দৈনিক রেকর্ড", ta: "தினசரி பதிவு",     te: "రోజువారీ నమోదు", mr: "दैनिक नोंद",   pa: "ਰੋਜ਼ਾਨਾ ਰਿਕਾਰਡ",   or: "ଦୈନିକ ରେକର୍ଡ" } },
  weight:       { icon: "Scale",         color: () => T.blue,      label: { en: "Weight",        hi: "वजन",           bn: "ওজন",          ta: "எடை",              te: "బరువు",          mr: "वजन",         pa: "ਭਾਰ",              or: "ଓଜନ" } },
  feed_log:     { icon: "Package",       color: () => T.orange,    label: { en: "Feed",          hi: "चारा",          bn: "খাদ্য",         ta: "தீவன பதிவு",       te: "దాణా లాగ్",      mr: "खाद्य नोंद",   pa: "ਖੁਰਾਕ ਲੌਗ",        or: "ଖାଦ୍ୟ ଲଗ" } },
  health_event: { icon: "Activity",      color: () => T.orange,    label: { en: "Health",        hi: "स्वास्थ्य",       bn: "স্বাস্থ্য",      ta: "சுகாதார நிகழ்வு",  te: "ఆరోగ్య సంఘటన",  mr: "आरोग्य घटना", pa: "ਸਿਹਤ ਘਟਨਾ",        or: "ସ୍ୱାସ୍ଥ୍ୟ ଘଟଣା" } },
  vaccination:  { icon: "Shield",        color: () => T.primary,   label: { en: "Vaccination",   hi: "टीकाकरण",       bn: "টিকা",          ta: "தடுப்பூசி",         te: "టీకా",           mr: "लस",          pa: "ਟੀਕਾ",             or: "ଟୀକା" } },
  task:         { icon: "CheckSquare",   color: (e) => e.status === "completed" ? T.primary : e.status === "skipped" ? T.inkFaint : T.orange, label: { en: "Task", hi: "कार्य", bn: "কাজ", ta: "பணி", te: "పని", mr: "कार्य", pa: "ਕੰਮ", or: "କାର୍ୟ" } },
  incident:     { icon: "AlertTriangle", color: (e) => e.severity === "high" ? T.error : T.orange, label: { en: "Incident", hi: "घटना", bn: "ঘটনা", ta: "சம்பவம்", te: "సంఘటన", mr: "घटना", pa: "ਘਟਨਾ", or: "ଘଟଣା" } },
  outcome:      { icon: "MessageSquare", color: () => T.primary,   label: { en: "Follow-up",    hi: "फ़ॉलो-अप",       bn: "ফলো-আপ",        ta: "முடிவு",           te: "ఫలితం",          mr: "निकाल",       pa: "ਨਤੀਜਾ",            or: "ଫଳ" } },
  closure:      { icon: "Lock",          color: () => T.inkSoft,   label: { en: "Batch closed",  hi: "बैच बंद",       bn: "ব্যাচ বন্ধ",    ta: "முடிவுரை",         te: "ముగింపు",        mr: "समाप्ती",      pa: "ਸਮਾਪਤੀ",           or: "ସମାପ୍ତି" } },
  sale:         { icon: "ShoppingCart",  color: () => T.primary,   label: { en: "Sale",          hi: "बिक्री",        bn: "বিক্রয়",        ta: "விற்பனை",          te: "అమ్మకం",         mr: "विक्री",      pa: "ਵਿਕਰੀ",            or: "ବିକ୍ରୟ" } },
  batch_cost:   { icon: "Receipt",       color: () => T.orange,    label: { en: "Cost",          hi: "लागत",          bn: "খরচ",           ta: "செலவு",            te: "ఖర్చు",          mr: "खर्च",        pa: "ਖਰਚ",              or: "ଖର୍ଚ" } },
};

const BATCH_STATUS_CHIP = {
  draft:          "faint",
  active:         "primary",
  harvesting:     "orange",
  partially_sold: "orange",
  completed:      "blue",
  closed:         "faint",
  archived:       "faint",
};

const CLOSED_STATUSES = new Set(["completed", "closed", "archived"]);

/* ── helper: group timeline by date, inject synthetic events ──────────────── */

function buildDays(batch, timeline) {
  const byDate = {};

  // Synthetic placement event always appears first
  // Normalise to date-only — API may return full ISO timestamp ("2026-09-16T00:00:00.000Z")
  const pd = (batch.placement_date || "").slice(0, 10);
  byDate[pd] = [{ event_kind: "placement", event_date: pd, placed_qty: batch.placed_qty, name: batch.name }];

  for (const ev of timeline) {
    const d = ev.event_date;
    if (!d) continue;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(ev);
  }

  // Synthetic closure event if batch is closed/completed/archived
  if (CLOSED_STATUSES.has(batch.status) && batch.closed_at) {
    const cd = batch.closed_at.slice(0, 10);
    if (!byDate[cd]) byDate[cd] = [];
    byDate[cd].push({ event_kind: "closure", event_date: cd, status: batch.status });
  }

  return Object.keys(byDate).sort().map((date) => ({ date, events: byDate[date] }));
}

/* ── event body renderers ─────────────────────────────────────────────────── */

function EventBody({ ev, tc }) {
  switch (ev.event_kind) {
    case "placement":
      return (
        <span>
          {tc({ en: "Batch started", hi: "बैच शुरू", bn: "ব্যাচ শুরু", ta: "தொகுப்பு தொடங்கியது", te: "బ్యాచ్ ప్రారంభమైంది", mr: "बॅच सुरू झाला", pa: "ਬੈਚ ਸ਼ੁਰੂ ਹੋਇਆ", or: "ବ୍ୟାଚ ଆରମ୍ଭ ହେଲା" })}
          {ev.placed_qty ? ` · ${Number(ev.placed_qty).toLocaleString("en-IN")} ${tc({ en: "birds placed", hi: "पक्षी", bn: "পাখি", ta: "பறவைகள் வைக்கப்பட்டன", te: "పక్షులు ఉంచబడ్డాయి", mr: "पक्षी ठेवले", pa: "ਪੰਛੀ ਰੱਖੇ ਗਏ", or: "ପକ୍ଷୀ ରଖାଗଲା" })}` : ""}
        </span>
      );
    case "daily_record": {
      const parts = [];
      if (ev.mortality != null && ev.mortality > 0) parts.push(`${tc({ en: "Mort", hi: "मृत्यु", bn: "মৃত্যু", ta: "மரண.", te: "మరణం", mr: "मृत्यू", pa: "ਮੌਤ", or: "ମୃତ୍ୟୁ" })}: ${ev.mortality}`);
      if (ev.culls != null && ev.culls > 0) parts.push(`${tc({ en: "Culls", hi: "कुल", bn: "বাদ", ta: "நீக்கல்", te: "తొలగింపు", mr: "काढणे", pa: "ਕੱਢੇ", or: "ବାତିଲ" })}: ${ev.culls}`);
      if (ev.temp_c != null) parts.push(`${ev.temp_c}°C`);
      if (ev.remarks) parts.push(ev.remarks);
      return <span>{parts.length ? parts.join(" · ") : tc({ en: "Recorded", hi: "दर्ज", bn: "রেকর্ড", ta: "பதிவு செய்யப்பட்டது", te: "నమోదు చేయబడింది", mr: "नोंद झाली", pa: "ਦਰਜ ਕੀਤਾ", or: "ରେକର୍ଡ ହେଲା" })}</span>;
    }
    case "weight":
      return (
        <span>
          {ev.average_weight_g != null ? `${ev.average_weight_g} g` : "—"}
          {ev.sample_count ? ` (${tc({ en: "sample", hi: "नमूना", bn: "নমুনা", ta: "மாதிரி", te: "నమూనా", mr: "नमुना", pa: "ਨਮੂਨਾ", or: "ନମୁନା" })}: ${ev.sample_count})` : ""}
        </span>
      );
    case "feed_log": {
      const kindLabel = ev.kind === "consumed"
        ? tc({ en: "Consumed", hi: "खपत", bn: "খাওয়া", ta: "உட்கொண்டது", te: "వినియోగించబడింది", mr: "खाल्ले", pa: "ਖਾਧਾ", or: "ଖାଇଲା" })
        : tc({ en: "Received", hi: "प्राप्त", bn: "প্রাপ্ত", ta: "ஸ்வீகரிக்கப்பட்டது", te: "స్వీకరించబడింది", mr: "प्राप्त झाले", pa: "ਪ੍ਰਾਪਤ ਹੋਇਆ", or: "ପ୍ରାପ୍ତ ହେଲା" });
      return <span>{kindLabel}: {ev.quantity_kg != null ? `${ev.quantity_kg} kg` : "—"}</span>;
    }
    case "health_event":
      return (
        <span>
          {ev.health_type && <strong style={{ textTransform: "capitalize" }}>{ev.health_type.replace(/_/g, " ")} — </strong>}
          {ev.title || tc({ en: "Event recorded", hi: "घटना दर्ज", bn: "ঘটনা রেকর্ড", ta: "நிகழ்வு பதிவு செய்யப்பட்டது", te: "సంఘటన నమోదు చేయబడింది", mr: "घटना नोंद झाली", pa: "ਘਟਨਾ ਦਰਜ ਕੀਤੀ", or: "ଘଟଣା ରେକର୍ଡ ହେଲା" })}
          {ev.medicine ? ` · ${ev.medicine}` : ""}
        </span>
      );
    case "vaccination":
      return (
        <span>
          {ev.vaccine_name || tc({ en: "Vaccine", hi: "टीका", bn: "টিকা", ta: "தடுப்பூசி", te: "వ్యాక్సిన్", mr: "लस", pa: "ਟੀਕਾ", or: "ଟୀକା" })}
          {ev.route ? ` · ${ev.route.replace(/_/g, " ")}` : ""}
        </span>
      );
    case "task":
      return (
        <span>
          {ev.title || ev.template_id || tc({ en: "Task", hi: "कार्य", bn: "কাজ", ta: "பணி", te: "పని", mr: "कार्य", pa: "ਕੰਮ", or: "କାର୍ୟ" })}
          {ev.status ? <span style={{ marginLeft: 4, fontSize: 11, color: T.inkSoft }}>
            [{ev.status}]
          </span> : null}
        </span>
      );
    case "incident":
      return (
        <span>
          <strong style={{ textTransform: "capitalize" }}>{ev.severity}</strong>
          {" — "}{ev.description || tc({ en: "Incident reported", hi: "घटना", bn: "ঘটনা", ta: "சம்பவம் புகாரளிக்கப்பட்டது", te: "సంఘటన నివేదించబడింది", mr: "घटना नोंद", pa: "ਘਟਨਾ ਦਰਜ", or: "ଘଟଣା ଜଣାଇଲା" })}
          {ev.status && ev.status !== "open" ? ` [${ev.status}]` : ""}
        </span>
      );
    case "outcome":
      return (
        <span>
          {ev.action_taken || ev.notes || tc({ en: "Outcome recorded", hi: "परिणाम", bn: "ফলাফল", ta: "முடிவு பதிவு செய்யப்பட்டது", te: "ఫలితం నమోదు చేయబడింది", mr: "निकाल नोंद झाला", pa: "ਨਤੀਜਾ ਦਰਜ ਕੀਤਾ", or: "ଫଳ ରେକର୍ଡ ହେଲା" })}
        </span>
      );
    case "closure":
      return (
        <span>
          {tc({ en: "Batch marked", hi: "बैच", bn: "ব্যাচ", ta: "தொகுப்பு குறிக்கப்பட்டது", te: "బ్యాచ్ గుర్తించబడింది", mr: "बॅच चिन्हांकित", pa: "ਬੈਚ ਚਿੰਨ੍ਹਿਤ", or: "ବ୍ୟାଚ ଚିହ୍ନିତ" })} {ev.status}
        </span>
      );
    case "sale": {
      const net = ev.net_revenue != null ? Number(ev.net_revenue) : Number(ev.gross_amount ?? 0);
      return (
        <span>
          {ev.birds_sold != null ? `${Number(ev.birds_sold).toLocaleString("en-IN")} ${tc({ en: "birds", hi: "पक्षी", bn: "পাখি", ta: "பறவைகள்", te: "పక్షులు", mr: "पक्षी", pa: "ਪੰਛੀ", or: "ପକ୍ଷୀ" })}` : ""}
          {net > 0 ? ` · ₹${net.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
          {ev.buyer_name ? ` · ${ev.buyer_name}` : ""}
        </span>
      );
    }
    case "batch_cost":
      return (
        <span>
          {ev.description || ev.category}
          {ev.amount != null ? ` · ₹${Number(ev.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
        </span>
      );
    default:
      return <span>{ev.event_kind}</span>;
  }
}

/* ── sub-components ──────────────────────────────────────────────────────── */

function EventRow({ ev, tc }) {
  const meta = KIND[ev.event_kind] || KIND.daily_record;
  const color = typeof meta.color === "function" ? meta.color(ev) : meta.color;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        display: "grid", placeItems: "center",
        background: `${color}18`,
      }}>
        <Icon name={meta.icon} size={15} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: T.inkSoft, marginBottom: 2 }}>
          {tc(meta.label)}
        </div>
        <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.4 }}>
          <EventBody ev={ev} tc={tc} />
        </div>
      </div>
    </div>
  );
}

function DayCard({ date, events, placementDate, tc }) {
  const dayNum = placementDate
    ? Math.round((Date.parse(date) - Date.parse(placementDate)) / 86400000)
    : null;
  const label = dayNum === 0
    ? tc({ en: "Day 0 — Placement", hi: "दिन 0 — प्लेसमेंट", bn: "দিন 0 — স্থাপন", ta: "நாள் 0 — ஸ்தாபனம்", te: "రోజు 0 — ఉంచడం", mr: "दिवस 0 — ठेवणे", pa: "ਦਿਨ 0 — ਰੱਖਣਾ", or: "ଦିନ 0 — ଆଗମନ" })
    : dayNum != null
      ? `${tc({ en: "Day", hi: "दिन", bn: "দিন", ta: "நாள்", te: "రోజు", mr: "दिवस", pa: "ਦਿਨ", or: "ଦିନ" })} ${dayNum} — ${date}`
      : date;

  return (
    <div>
      <div style={{
        fontSize: 11.5, fontWeight: 700, color: T.inkSoft,
        textTransform: "uppercase", letterSpacing: 0.5,
        marginBottom: 8, paddingLeft: 2,
      }}>
        {label}
      </div>
      <Card pad={12}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {events.map((ev, i) => (
            <EventRow key={`${ev.event_kind}-${i}`} ev={ev} tc={tc} />
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ── main component ──────────────────────────────────────────────────────── */

export default function BatchHistory({ batchId }) {
  const { pop, tc } = useApp();
  const [space, setSpace]       = useState(null);
  const [data, setData]         = useState(null); // { batch, timeline }
  const [state, setState]       = useState("loading");
  const [reason, setReason]     = useState(null);
  const [newestFirst, setNewest] = useState(true);

  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const result = await poultryApi.timeline(active.id, batchId);
      setData(result);
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, [batchId]);  

  useEffect(() => { load(); }, [load]);

  const title = data?.batch?.name
    ? `${data.batch.name} — ${tc({ en: "History", hi: "इतिहास", bn: "ইতিহাস", ta: "வரலாறு", te: "చరిత్ర", mr: "इतिहास", pa: "ਇਤਿਹਾਸ", or: "ଇତିହାସ" })}`
    : tc({ en: "Batch History", hi: "बैच इतिहास", bn: "ব্যাচ ইতিহাস", ta: "தொகுப்பு வரலாறு", te: "బ్యాచ్ చరిత్ర", mr: "बॅच इतिहास", pa: "ਬੈਚ ਇਤਿਹਾਸ", or: "ବ୍ୟାଚ ଇତିହାସ" });

  if (state === "loading") return (
    <>
      <AppBar title={tc({ en: "Batch History", hi: "बैच इतिहास", bn: "ব্যাচ ইতিহাস", ta: "தொகுப்பு வரலாறு", te: "బ్యాచ్ చరిత్ర", mr: "बॅच इतिहास", pa: "ਬੈਚ ਇਤਿਹਾਸ", or: "ବ୍ୟାଚ ଇତିହାସ" })} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div>
    </>
  );

  if (state === "error") return (
    <>
      <AppBar title={tc({ en: "Batch History", hi: "बैच इतिहास", bn: "ব্যাচ ইতিহাস", ta: "தொகுப்பு வரலாறு", te: "బ్యాచ్ చరిత్ర", mr: "बॅच इतिहास", pa: "ਬੈਚ ਇਤਿਹਾਸ", or: "ବ୍ୟାଚ ଇତିହାସ" })} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div>
    </>
  );

  const { batch, timeline } = data;
  const days = buildDays(batch, timeline);
  const displayDays = newestFirst ? [...days].reverse() : days;
  const isClosed = CLOSED_STATUSES.has(batch.status);
  const totalEvents = timeline.length;

  return (
    <>
      <AppBar title={title} onBack={pop} />

      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Batch summary header */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <Chip accent={BATCH_STATUS_CHIP[batch.status] || "faint"}>
              {batch.status}
            </Chip>
            {isClosed && (
              <span style={{ fontSize: 12, color: T.inkSoft, display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="Lock" size={12} color={T.inkSoft} />
                {tc({ en: "Read-only history", hi: "केवल पढ़ने योग्य", bn: "শুধু পড়ার যোগ্য", ta: "படிக்க மட்டும் வரலாறு", te: "చదవడానికి మాత్రమే చరిత్ర", mr: "फक्त वाचण्याचा इतिहास", pa: "ਸਿਰਫ਼ ਪੜ੍ਹਨ ਯੋਗ ਇਤਿਹਾਸ", or: "କେବଳ ପଢ଼ିବା ଇତିହାସ" })}
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: T.inkSoft }}>{tc({ en: "Placement", hi: "प्लेसमेंट", bn: "স্থাপন", ta: "ஸ்தாபனம்", te: "ఉంచడం", mr: "ठेवणे", pa: "ਰੱਖਣਾ", or: "ଆଗମନ" })}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{(batch.placement_date || "").slice(0, 10) || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.inkSoft }}>{tc({ en: "Events recorded", hi: "घटनाएं", bn: "ঘটনা", ta: "பதிவு செய்யப்பட்ட நிகழ்வுகள்", te: "నమోదు చేయబడిన సంఘటనలు", mr: "नोंद झालेल्या घटना", pa: "ਦਰਜ ਕੀਤੀਆਂ ਘਟਨਾਵਾਂ", or: "ରେକର୍ଡ ହୋଇଥିବା ଘଟଣା" })}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{totalEvents}</div>
            </div>
          </div>
        </Card>

        {/* Sort toggle */}
        {days.length > 1 && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setNewest(n => !n)}
              style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: T.rMd,
                padding: "5px 12px", fontSize: 12, fontWeight: 600, color: T.inkSoft,
                cursor: "pointer", fontFamily: T.body, display: "flex", alignItems: "center", gap: 5 }}>
              <Icon name={newestFirst ? "ArrowDownNarrowWide" : "ArrowUpNarrowWide"} size={13} />
              {newestFirst
                ? tc({ en: "Newest first", hi: "नवीनतम पहले", bn: "নতুন আগে", ta: "புதியது முதலில்", te: "కొత్తది ముందు", mr: "नवीन आधी", pa: "ਨਵਾਂ ਪਹਿਲਾਂ", or: "ନୂଆ ପ୍ରଥମ" })
                : tc({ en: "Oldest first", hi: "पुरानी पहले", bn: "পুরানো আগে", ta: "பழையது முதலில்", te: "పాతది ముందు", mr: "जुने आधी", pa: "ਪੁਰਾਣਾ ਪਹਿਲਾਂ", or: "ପୁରୁଣା ପ୍ରଥମ" })}
            </button>
          </div>
        )}

        {/* Timeline */}
        {displayDays.length === 0 ? (
          <EmptyState
            icon="ClipboardList"
            title={tc({ en: "No records yet", hi: "अभी कोई रिकॉर्ड नहीं", bn: "এখনও কোনো রেকর্ড নেই", ta: "இன்னும் பதிவுகள் இல்லை", te: "ఇంకా రికార్డులు లేవు", mr: "अजून नोंद नाही", pa: "ਅਜੇ ਕੋਈ ਰਿਕਾਰਡ ਨਹੀਂ", or: "ଏପର୍ଯ୍ୟନ୍ତ ରେକର୍ଡ ନାହିଁ" })}
            body={tc({ en: "Records will appear here as they are logged on the batch.",
                        hi: "रिकॉर्ड यहाँ दिखेंगे जैसे ही वे बैच में दर्ज होंगे।",
                        bn: "ব্যাচে রেকর্ড করা হলে এখানে দেখাবে।",
                        ta: "பதிவுகள் தொகுப்பில் சேர்க்கப்படும்போது இங்கே தோன்றும்.",
                        te: "బ్యాచ్‌లో నమోదు చేసిన తర్వాత రికార్డులు ఇక్కడ కనిపిస్తాయి.",
                        mr: "रेकॉर्ड बॅचमध्ये नोंद झाल्यावर इथे दिसतील.",
                        pa: "ਰਿਕਾਰਡ ਬੈਚ ਵਿੱਚ ਦਰਜ ਹੋਣ 'ਤੇ ਇੱਥੇ ਦਿਖਾਈ ਦੇਣਗੇ।",
                        or: "ବ୍ୟାଚରେ ଲଗ ହେଲେ ରେକର୍ଡ ଏଠାରେ ଦେଖାଯିବ।" })}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {displayDays.map(({ date, events }) => (
              <DayCard
                key={date} date={date} events={events}
                placementDate={batch.placement_date} tc={tc}
              />
            ))}
          </div>
        )}

      </div>
    </>
  );
}
