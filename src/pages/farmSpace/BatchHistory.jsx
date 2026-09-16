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
  placement:    { icon: "Bird",          color: () => T.primary,   label: { en: "Placement",     hi: "प्लेसमेंट",     bn: "স্থাপন" } },
  daily_record: { icon: "ClipboardList", color: () => T.primary,   label: { en: "Daily record",  hi: "दैनिक रिकॉर्ड",  bn: "দৈনিক রেকর্ড" } },
  weight:       { icon: "Scale",         color: () => T.blue,      label: { en: "Weight",        hi: "वजन",           bn: "ওজন" } },
  feed_log:     { icon: "Package",       color: () => T.orange,    label: { en: "Feed",          hi: "चारा",          bn: "খাদ্য" } },
  health_event: { icon: "Activity",      color: () => T.orange,    label: { en: "Health",        hi: "स्वास्थ्य",       bn: "স্বাস্থ্য" } },
  vaccination:  { icon: "Shield",        color: () => T.primary,   label: { en: "Vaccination",   hi: "टीकाकरण",       bn: "টিকা" } },
  task:         { icon: "CheckSquare",   color: (e) => e.status === "completed" ? T.primary : e.status === "skipped" ? T.inkFaint : T.orange, label: { en: "Task", hi: "कार्य", bn: "কাজ" } },
  incident:     { icon: "AlertTriangle", color: (e) => e.severity === "high" ? T.error : T.orange, label: { en: "Incident", hi: "घटना", bn: "ঘটনা" } },
  outcome:      { icon: "MessageSquare", color: () => T.primary,   label: { en: "Follow-up",    hi: "फ़ॉलो-अप",       bn: "ফলো-আপ" } },
  closure:      { icon: "Lock",          color: () => T.inkSoft,   label: { en: "Batch closed",  hi: "बैच बंद",       bn: "ব্যাচ বন্ধ" } },
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
          {tc({ en: "Batch started", hi: "बैच शुरू", bn: "ব্যাচ শুরু" })}
          {ev.placed_qty ? ` · ${Number(ev.placed_qty).toLocaleString("en-IN")} ${tc({ en: "birds placed", hi: "पक्षी", bn: "পাখি" })}` : ""}
        </span>
      );
    case "daily_record": {
      const parts = [];
      if (ev.mortality != null && ev.mortality > 0) parts.push(`${tc({ en: "Mort", hi: "मृत्यु", bn: "মৃত্যু" })}: ${ev.mortality}`);
      if (ev.culls != null && ev.culls > 0) parts.push(`${tc({ en: "Culls", hi: "कुल", bn: "বাদ" })}: ${ev.culls}`);
      if (ev.temp_c != null) parts.push(`${ev.temp_c}°C`);
      if (ev.remarks) parts.push(ev.remarks);
      return <span>{parts.length ? parts.join(" · ") : tc({ en: "Recorded", hi: "दर्ज", bn: "রেকর্ড" })}</span>;
    }
    case "weight":
      return (
        <span>
          {ev.average_weight_g != null ? `${ev.average_weight_g} g` : "—"}
          {ev.sample_count ? ` (${tc({ en: "sample", hi: "नमूना", bn: "নমুনা" })}: ${ev.sample_count})` : ""}
        </span>
      );
    case "feed_log": {
      const kindLabel = ev.kind === "consumed"
        ? tc({ en: "Consumed", hi: "खपत", bn: "খাওয়া" })
        : tc({ en: "Received", hi: "प्राप्त", bn: "প্রাপ্ত" });
      return <span>{kindLabel}: {ev.quantity_kg != null ? `${ev.quantity_kg} kg` : "—"}</span>;
    }
    case "health_event":
      return (
        <span>
          {ev.health_type && <strong style={{ textTransform: "capitalize" }}>{ev.health_type.replace(/_/g, " ")} — </strong>}
          {ev.title || tc({ en: "Event recorded", hi: "घटना दर्ज", bn: "ঘটনা রেকর্ড" })}
          {ev.medicine ? ` · ${ev.medicine}` : ""}
        </span>
      );
    case "vaccination":
      return (
        <span>
          {ev.vaccine_name || tc({ en: "Vaccine", hi: "टीका", bn: "টিকা" })}
          {ev.route ? ` · ${ev.route.replace(/_/g, " ")}` : ""}
        </span>
      );
    case "task":
      return (
        <span>
          {ev.title || ev.template_id || tc({ en: "Task", hi: "कार्य", bn: "কাজ" })}
          {ev.status ? <span style={{ marginLeft: 4, fontSize: 11, color: T.inkSoft }}>
            [{ev.status}]
          </span> : null}
        </span>
      );
    case "incident":
      return (
        <span>
          <strong style={{ textTransform: "capitalize" }}>{ev.severity}</strong>
          {" — "}{ev.description || tc({ en: "Incident reported", hi: "घटना", bn: "ঘটনা" })}
          {ev.status && ev.status !== "open" ? ` [${ev.status}]` : ""}
        </span>
      );
    case "outcome":
      return (
        <span>
          {ev.action_taken || ev.notes || tc({ en: "Outcome recorded", hi: "परिणाम", bn: "ফলাফল" })}
        </span>
      );
    case "closure":
      return (
        <span>
          {tc({ en: "Batch marked", hi: "बैच", bn: "ব্যাচ" })} {ev.status}
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
    ? tc({ en: "Day 0 — Placement", hi: "दिन 0 — प्लेसमेंट", bn: "দিন 0 — স্থাপন" })
    : dayNum != null
      ? `${tc({ en: "Day", hi: "दिन", bn: "দিন" })} ${dayNum} — ${date}`
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
  }, [batchId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const title = data?.batch?.name
    ? `${data.batch.name} — ${tc({ en: "History", hi: "इतिहास", bn: "ইতিহাস" })}`
    : tc({ en: "Batch History", hi: "बैच इतिहास", bn: "ব্যাচ ইতিহাস" });

  if (state === "loading") return (
    <>
      <AppBar title={tc({ en: "Batch History", hi: "बैच इतिहास", bn: "ব্যাচ ইতিহাস" })} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div>
    </>
  );

  if (state === "error") return (
    <>
      <AppBar title={tc({ en: "Batch History", hi: "बैच इतिहास", bn: "ব্যাচ ইতিহাস" })} onBack={pop} />
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
                {tc({ en: "Read-only history", hi: "केवल पढ़ने योग्य", bn: "শুধু পড়ার যোগ্য" })}
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: T.inkSoft }}>{tc({ en: "Placement", hi: "प्लेसमेंट", bn: "স্থাপন" })}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{(batch.placement_date || "").slice(0, 10) || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.inkSoft }}>{tc({ en: "Events recorded", hi: "घटनाएं", bn: "ঘটনা" })}</div>
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
                ? tc({ en: "Newest first", hi: "नवीनतम पहले", bn: "নতুন আগে" })
                : tc({ en: "Oldest first", hi: "पुरानी पहले", bn: "পুরানো আগে" })}
            </button>
          </div>
        )}

        {/* Timeline */}
        {displayDays.length === 0 ? (
          <EmptyState
            icon="ClipboardList"
            title={tc({ en: "No records yet", hi: "अभी कोई रिकॉर्ड नहीं", bn: "এখনও কোনো রেকর্ড নেই" })}
            body={tc({ en: "Records will appear here as they are logged on the batch.",
                        hi: "रिकॉर्ड यहाँ दिखेंगे जैसे ही वे बैच में दर्ज होंगे।",
                        bn: "ব্যাচে রেকর্ড করা হলে এখানে দেখাবে।" })}
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
