import { useState, useEffect, useCallback, useRef } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  Card, Button, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet, accent,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { poultryApi } from "../../services/poultry/poultryApi.js";

/* ── constants ──────────────────────────────────────────────────────────── */

const PRIORITY_ACCENT = { urgent: "red", high: "orange", normal: "primary", low: "faint" };

const PRIORITY_LABEL = {
  urgent: { en: "Urgent",  hi: "अत्यंत जरूरी", bn: "জরুরি" },
  high:   { en: "High",    hi: "उच्च",          bn: "উচ্চ" },
  normal: { en: "Normal",  hi: "सामान्य",        bn: "সাধারণ" },
  low:    { en: "Low",     hi: "कम",             bn: "কম" },
};

const TASK_TYPE_LABEL = {
  monitoring_check: { en: "Monitoring",    hi: "निरीक्षण",       bn: "পর্যবেক্ষণ" },
  data_recording:   { en: "Record",        hi: "रिकॉर्ड",        bn: "রেকর্ড" },
  physical_task:    { en: "Physical task", hi: "शारीरिक कार्य",  bn: "শারীরিক কাজ" },
  chain_followup:   { en: "Follow-up",     hi: "फ़ॉलो-अप",       bn: "ফলো-আপ" },
  incident_task:    { en: "Problem",       hi: "समस्या",         bn: "সমস্যা" },
  reactive:         { en: "Alert",         hi: "अलर्ट",          bn: "সতর্কতা" },
  manual:           { en: "Manual",        hi: "मैन्युअल",       bn: "ম্যানুয়াল" },
};

const SKIP_REASONS = (tc) => [
  { label: tc({ en: "Not applicable today",     hi: "आज लागू नहीं",          bn: "আজ প্রযোজ্য নয়" }),        value: "Not applicable today" },
  { label: tc({ en: "Will complete later",      hi: "बाद में करूँगा",         bn: "পরে করব" }),               value: "Will complete later" },
  { label: tc({ en: "Birds did not require it", hi: "पक्षियों को जरूरत नहीं", bn: "পাখির প্রয়োজন ছিল না" }), value: "Birds did not require it" },
  { label: tc({ en: "Manual override",          hi: "मैन्युअल ओवरराइड",      bn: "ম্যানুয়াল ওভাররাইড" }),   value: "Manual override" },
];

const OUTCOME_OPTIONS = (tc) => [
  { label: tc({ en: "Improved",  hi: "सुधार हुआ",    bn: "উন্নতি হয়েছে" }),  value: "improved" },
  { label: tc({ en: "Same",      hi: "वैसा ही",       bn: "একই আছে" }),       value: "same" },
  { label: tc({ en: "Worse",     hi: "खराब हुआ",      bn: "আরও খারাপ" }),     value: "worse" },
  { label: tc({ en: "Recovered", hi: "ठीक हो गए",    bn: "সুস্থ হয়েছে" }),  value: "recovered" },
  { label: tc({ en: "Resolved",  hi: "समाधान हुआ",   bn: "সমাধান হয়েছে" }), value: "resolved" },
  { label: tc({ en: "Deceased",  hi: "मृत्यु हो गई", bn: "মৃত্যু হয়েছে" }), value: "deceased" },
];

const ACTION_TAKEN_OPTIONS = (tc) => [
  { label: tc({ en: "No action needed",   hi: "कोई कदम नहीं",        bn: "কোনো পদক্ষেপ নেই" }),    value: "no_action" },
  { label: tc({ en: "Repeat treatment",   hi: "उपचार दोहराएँ",       bn: "চিকিৎসা পুনরাবৃত্তি" }), value: "repeat_treatment" },
  { label: tc({ en: "New treatment",      hi: "नया उपचार",            bn: "নতুন চিকিৎসা" }),        value: "new_treatment" },
  { label: tc({ en: "Issue resolved",     hi: "समस्या हल हुई",       bn: "সমস্যা সমাধান" }),        value: "resolved" },
  { label: tc({ en: "Escalated to vet",  hi: "पशु चिकित्सक बुलाया", bn: "পশু চিকিৎসকে পাঠানো" }), value: "escalated" },
];


function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(iso).slice(0, 10); }
}

/* ── main component ──────────────────────────────────────────────────────── */

export default function PoultryWorkflowTab({ space, batch, canRecord, canManage }) {
  const { tc, toast, push } = useApp();
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);

  /* Complete task sheet */
  const [completeTask, setCompleteTask] = useState(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [completing, setCompleting]       = useState(false);
  const completingRef = useRef(false);

  /* Skip task sheet */
  const [skipTask, setSkipTask]     = useState(null);
  const [skipReason, setSkipReason] = useState("Not applicable today");
  const [skipNotes, setSkipNotes]   = useState("");
  const [skipping, setSkipping]     = useState(false);

  /* Record outcome sheet (chain_followup tasks) */
  const [outcomeTask, setOutcomeTask]   = useState(null);
  const [outcomeValue, setOutcomeValue] = useState("improved");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [outcomeAction, setOutcomeAction] = useState("no_action");
  const [recordingOutcome, setRecordingOutcome] = useState(false);

  /* Incident report sheet */
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentDesc, setIncidentDesc] = useState("");
  const [reporting, setReporting]       = useState(false);

  /* Incident result sheet (full incident context after reporting) */
  const [incidentResult, setIncidentResult] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await poultryApi.dailySummary(space.id, batch.id);
      setSummary(data);
    } catch (err) {
      setError(err.message || tc({ en: "Could not load workflow", hi: "वर्कफ़्लो लोड नहीं हुआ", bn: "ওয়ার্কফ্লো লোড হয়নি" }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [space.id, batch.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const openComplete = (task) => { setCompleteTask(task); setCompleteNotes(""); };
  const openSkip     = (task) => { setSkipTask(task); setSkipReason("Not applicable today"); setSkipNotes(""); };
  const openOutcome  = (task) => { setOutcomeTask(task); setOutcomeValue("improved"); setOutcomeNotes(""); setOutcomeAction("no_action"); };
  const viewChain    = (task) => push({ kind: "poultryChainDetail", props: { chainId: task.chain_id } });

  const doComplete = async () => {
    if (!completeTask || completingRef.current) return;
    completingRef.current = true;
    setCompleting(true);
    try {
      await poultryApi.completeTask(space.id, {
        taskId: completeTask.id,
        notes: completeNotes.trim() || null,
        clientUuid: crypto.randomUUID(),
      });
      setCompleteTask(null);
      toast(tc({ en: "Task completed", hi: "कार्य पूरा हुआ", bn: "কাজ সম্পন্ন হয়েছে" }), "success");
      load(true);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { completingRef.current = false; setCompleting(false); }
  };

  const doSkip = async () => {
    if (!skipTask || skipping) return;
    setSkipping(true);
    try {
      await poultryApi.skipTask(space.id, {
        taskId: skipTask.id,
        reason: skipReason,
        notes: skipNotes.trim() || null,
        clientUuid: crypto.randomUUID(),
      });
      setSkipTask(null);
      toast(tc({ en: "Task skipped", hi: "कार्य छोड़ा गया", bn: "কাজ এড়িয়ে যাওয়া হয়েছে" }), "success");
      load(true);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setSkipping(false); }
  };

  const doRecordOutcome = async () => {
    if (!outcomeTask || recordingOutcome) return;
    setRecordingOutcome(true);
    try {
      await poultryApi.recordOutcome(space.id, {
        chainId: outcomeTask.chain_id,
        taskId:  outcomeTask.id,
        outcome: outcomeValue,
        observationNotes: outcomeNotes.trim() || null,
        actionTaken:      outcomeAction.trim() || null,
        clientUuid:       crypto.randomUUID(),
      });
      setOutcomeTask(null);
      toast(tc({ en: "Outcome recorded", hi: "परिणाम दर्ज हुआ", bn: "ফলাফল রেকর্ড হয়েছে" }), "success");
      load(true);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setRecordingOutcome(false); }
  };

  const doReportIncident = async () => {
    if (!incidentDesc.trim() || reporting) return;
    setReporting(true);
    try {
      const result = await poultryApi.reportIncident(space.id, {
        batchId:     batch.id,
        description: incidentDesc.trim(),
        clientUuid:  crypto.randomUUID(),
      });
      setIncidentOpen(false);
      setIncidentDesc("");
      if (result?.guided_response) {
        setIncidentResult({
          id:             result.id,
          severity:       result.severity,
          description:    result.description,
          chain_id:       result.chain_id || null,
          guided_response: result.guided_response,
          batch_day:      result.batch_day,
        });
      } else {
        toast(tc({ en: "Problem reported", hi: "समस्या दर्ज हुई", bn: "সমস্যা রিপোর্ট হয়েছে" }), "success");
      }
      load(true);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব्यर्थ" }), "error");
    } finally { setReporting(false); }
  };

  /* ── render states ──────────────────────────────────────────────────── */

  if (loading) return (
    <div style={{ padding: 40, display: "grid", placeItems: "center" }}><Spinner /></div>
  );
  if (error) return (
    <ErrorState body={error} onRetry={() => load()} />
  );
  if (!summary) return null;

  const { summary: s } = summary;
  const overdueCount   = s.overdue.tasks.length;
  const pendingCount   = s.pending.tasks.length;
  const completedCount = s.completed.tasks.length;
  const chainCount     = s.attention.active_chains.length;
  const incidentCount  = s.attention.open_incidents.length;
  /* Exclude the recommended task from the "Today" list — it's already prominent above */
  const recTaskId   = s.recommendation?.task?.id;
  const todayTasks  = s.pending.tasks.filter(t => t.id !== recTaskId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Day + refresh row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12.5, color: T.inkSoft }}>
          {tc({ en: `Day ${summary.batchDay ?? "—"}`, hi: `दिन ${summary.batchDay ?? "—"}`, bn: `দিন ${summary.batchDay ?? "—"}` })}
          {" · "}{summary.date}
        </span>
        <button onClick={() => load(true)} disabled={refreshing} aria-label="Refresh"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4,
            color: T.primary, opacity: refreshing ? 0.4 : 1, lineHeight: 0 }}>
          <Icon name="RefreshCw" size={16} />
        </button>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <StatPill label={tc({ en: "Done",    hi: "पूरे",      bn: "সম্পন্ন" })} value={completedCount} color={T.primary} />
        <StatPill label={tc({ en: "Pending", hi: "बाकी",      bn: "বাকি" })}    value={pendingCount}   color={T.inkSoft} />
        <StatPill label={tc({ en: "Overdue", hi: "विलंबित",   bn: "বিলম্বিত" })} value={overdueCount}
          color={overdueCount > 0 ? T.red : T.inkFaint} />
      </div>

      {/* Next recommended action */}
      {s.recommendation?.task && (
        <RecommendationCard
          task={s.recommendation.task} reason={s.recommendation.reason}
          tc={tc} canRecord={canRecord} canManage={canManage}
          onComplete={() => openComplete(s.recommendation.task)}
          onSkip={() => openSkip(s.recommendation.task)}
          onOutcome={() => openOutcome(s.recommendation.task)}
          onViewChain={() => viewChain(s.recommendation.task)}
        />
      )}

      {/* Overdue tasks */}
      {overdueCount > 0 && (
        <TaskSection label={tc({ en: "Overdue", hi: "विलंबित", bn: "বিলম্বিত" })} labelColor={T.red}
          tasks={s.overdue.tasks} tc={tc} canRecord={canRecord} canManage={canManage}
          onComplete={openComplete} onSkip={openSkip} onOutcome={openOutcome} onViewChain={viewChain}
        />
      )}

      {/* Today's pending tasks (recommendation already shown above; excluded here) */}
      {todayTasks.length > 0 && (
        <TaskSection label={tc({ en: "Today", hi: "आज", bn: "আজ" })}
          tasks={todayTasks} tc={tc} canRecord={canRecord} canManage={canManage}
          onComplete={openComplete} onSkip={openSkip} onOutcome={openOutcome} onViewChain={viewChain}
        />
      )}

      {overdueCount === 0 && pendingCount === 0 && (
        <EmptyState icon="CheckCircle2"
          title={tc({ en: "All tasks done for today!", hi: "आज सभी कार्य पूरे!", bn: "আজকের সব কাজ শেষ!" })} />
      )}

      {/* Attention needed */}
      {(chainCount > 0 || incidentCount > 0) && (
        <AttentionSection
          chains={s.attention.active_chains} incidents={s.attention.open_incidents}
          tc={tc}
          onViewChain={c => push({ kind: "poultryChainDetail", props: { chainId: c.id } })}
          onViewGuidance={inc => setIncidentResult({
            id:             inc.id,
            severity:       inc.severity,
            description:    inc.description,
            chain_id:       inc.chain_id || null,
            guided_response: inc.guided_response,
            batch_day:      inc.batch_day,
          })}
        />
      )}

      {/* Upcoming (next 7 days) */}
      {s.upcoming.tasks.length > 0 && (
        <UpcomingSection tasks={s.upcoming.tasks} tc={tc} />
      )}

      {/* Completed today (collapsed) */}
      {completedCount > 0 && (
        <CompletedSection tasks={s.completed.tasks} tc={tc} />
      )}

      {/* Report a Problem */}
      {canRecord && (
        <button onClick={() => { setIncidentOpen(true); setIncidentDesc(""); }}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px 16px", background: "transparent",
            border: `1.5px solid ${T.red}`, borderRadius: T.rMd,
            cursor: "pointer", fontFamily: T.body,
            fontSize: 14, fontWeight: 600, color: T.red,
          }}>
          <Icon name="AlertTriangle" size={16} />
          {tc({ en: "Report a Problem", hi: "समस्या रिपोर्ट करें", bn: "সমস্যা রিপোর্ট করুন" })}
        </button>
      )}

      {/* ── Sheets ─────────────────────────────────────────────────────── */}

      {/* Complete task */}
      <BottomSheet open={!!completeTask} onClose={() => setCompleteTask(null)}
        title={tc({ en: "Complete Task", hi: "कार्य पूरा करें", bn: "কাজ সম্পন্ন করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          {completeTask && (
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{completeTask.title}</div>
          )}
          <Input label={tc({ en: "Notes (optional)", hi: "नोट (वैकल्पिक)", bn: "নোট (ঐচ্ছিক)" })}
            value={completeNotes} onChange={v => setCompleteNotes(v)} />
          <Button full onClick={doComplete} disabled={completing}>
            {completing
              ? tc({ en: "Completing…", hi: "पूरा हो रहा है…", bn: "সম্পন্ন হচ্ছে…" })
              : tc({ en: "Mark Complete", hi: "पूरा चिह्नित करें", bn: "সম্পন্ন করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Skip task */}
      <BottomSheet open={!!skipTask} onClose={() => setSkipTask(null)}
        title={tc({ en: "Skip Task", hi: "कार्य छोड़ें", bn: "কাজ এড়িয়ে যান" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          {skipTask && (
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{skipTask.title}</div>
          )}
          <Dropdown label={tc({ en: "Reason *", hi: "कारण *", bn: "কারণ *" })}
            value={skipReason} onChange={v => setSkipReason(v)} options={SKIP_REASONS(tc)} />
          <Input label={tc({ en: "Notes (optional)", hi: "नोट (वैकल्पिक)", bn: "নোট (ঐচ্ছিক)" })}
            value={skipNotes} onChange={v => setSkipNotes(v)} />
          <Button full variant="soft" onClick={doSkip} disabled={skipping}>
            {skipping
              ? tc({ en: "Skipping…", hi: "छोड़ा जा रहा है…", bn: "এড়িয়ে যাওয়া হচ্ছে…" })
              : tc({ en: "Skip Task", hi: "कार्य छोड़ें", bn: "কাজ এড়িয়ে যান" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Record outcome (chain_followup) */}
      <BottomSheet open={!!outcomeTask} onClose={() => setOutcomeTask(null)}
        title={tc({ en: "Record Outcome", hi: "परिणाम दर्ज करें", bn: "ফলাফল রেকর্ড করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          {outcomeTask && (
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{outcomeTask.title}</div>
          )}
          <Dropdown label={tc({ en: "Outcome *", hi: "परिणाम *", bn: "ফলাফল *" })}
            value={outcomeValue} onChange={v => setOutcomeValue(v)} options={OUTCOME_OPTIONS(tc)} />
          <Input label={tc({ en: "Observations", hi: "अवलोकन", bn: "পর্যবেক্ষণ" })}
            value={outcomeNotes} onChange={v => setOutcomeNotes(v)} />
          <Dropdown label={tc({ en: "Action taken", hi: "कदम उठाए गए", bn: "গৃহীত পদক্ষেপ" })}
            value={outcomeAction} onChange={v => setOutcomeAction(v)} options={ACTION_TAKEN_OPTIONS(tc)} />
          <Button full onClick={doRecordOutcome} disabled={recordingOutcome}>
            {recordingOutcome
              ? tc({ en: "Recording…", hi: "दर्ज हो रहा है…", bn: "রেকর্ড হচ্ছে…" })
              : tc({ en: "Record Outcome", hi: "परिणाम दर्ज करें", bn: "ফলাফল রেকর্ড করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Report incident */}
      <BottomSheet open={incidentOpen} onClose={() => setIncidentOpen(false)}
        title={tc({ en: "Report a Problem", hi: "समस्या रिपोर्ट करें", bn: "সমস্যা রিপোর্ট করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5 }}>
            {tc({ en: "Describe what you're seeing with the birds, water, feed, or environment.",
                  hi: "पक्षियों, पानी, चारे या वातावरण में जो देख रहे हैं, वह बताएँ।",
                  bn: "পাখি, পানি, খাদ্য বা পরিবেশে যা দেখছেন তা বর্ণনা করুন।" })}
          </div>
          <Input label={tc({ en: "Description *", hi: "विवरण *", bn: "বিবরণ *" })}
            value={incidentDesc} onChange={v => setIncidentDesc(v)} />
          <Button full onClick={doReportIncident} disabled={!incidentDesc.trim() || reporting}>
            {reporting
              ? tc({ en: "Reporting…", hi: "रिपोर्ट हो रहा है…", bn: "রিপোর্ট হচ্ছে…" })
              : tc({ en: "Report Problem", hi: "समस्या रिपोर्ट करें", bn: "সমস্যা রিপোর্ট করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Problem guidance (full incident context) */}
      <BottomSheet open={!!incidentResult} onClose={() => setIncidentResult(null)}
        title={tc({ en: "Problem Guidance", hi: "समस्या मार्गदर्शन", bn: "সমস্যা নির্দেশিকা" })}>
        {incidentResult && (
          <GuidedResponseContent
            incident={incidentResult}
            tc={tc}
            onClose={() => setIncidentResult(null)}
            onViewChain={chainId => {
              setIncidentResult(null);
              push({ kind: "poultryChainDetail", props: { chainId } });
            }}
          />
        )}
      </BottomSheet>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function Badge({ label, a = "primary" }) {
  const { bg, fg } = accent(a);
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 999,
      background: bg, color: fg,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.03em", whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function SectionLabel({ label, color }) {
  return (
    <span style={{
      fontSize: 12.5, fontWeight: 700,
      color: color || T.inkSoft,
      textTransform: "uppercase", letterSpacing: "0.06em",
    }}>
      {label}
    </span>
  );
}

function StatPill({ label, value, color }) {
  return (
    <Card style={{ padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: T.display, color }}>{value}</div>
      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{label}</div>
    </Card>
  );
}

function RecommendationCard({ task, reason, tc, canRecord, canManage, onComplete, onSkip, onOutcome, onViewChain }) {
  const isChain   = task.task_type === "chain_followup";
  const isBlocked = task.status === "blocked";
  const isOverdue = task.status === "overdue";
  const { fg: prColor } = accent(PRIORITY_ACCENT[task.priority] || "primary");

  return (
    <Card style={{ borderLeft: `4px solid ${prColor}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Icon name="Sparkles" size={16} color={T.primary} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            {tc({ en: "Next Action", hi: "अगला कार्य", bn: "পরবর্তী কাজ" })}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>{task.title}</div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 3, lineHeight: 1.4 }}>{reason}</div>
          {isOverdue && (
            <div style={{ marginTop: 4, fontSize: 12, color: T.red, fontWeight: 600 }}>
              {tc({ en: "Overdue", hi: "विलंबित", bn: "বিলম্বিত" })}
              {task.scheduled_date ? ` · ${fmtDate(task.scheduled_date)}` : ""}
            </div>
          )}
          {isChain && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
              <Icon name="Link2" size={12} color={T.inkSoft} />
              <span style={{ fontSize: 12, color: T.inkSoft }}>
                {tc({ en: "Follow-up chain", hi: "फ़ॉलो-अप चेन", bn: "ফলো-আপ চেইন" })}
              </span>
            </div>
          )}
          {isBlocked && (
            <div style={{ marginTop: 6, fontSize: 12, color: T.inkFaint, fontStyle: "italic" }}>
              {tc({ en: "Blocked — complete the prerequisite task first",
                    hi: "ब्लॉक — पहले आवश्यक कार्य पूरा करें",
                    bn: "ব্লক — আগে পূর্বশর্ত কাজ শেষ করুন" })}
            </div>
          )}
        </div>
      </div>
      {!isBlocked && (canRecord || canManage) && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {canRecord && (
            isChain
              ? <Button size="sm" onClick={onOutcome}>
                  {tc({ en: "Record Outcome", hi: "परिणाम दर्ज करें", bn: "ফলাফল রেকর্ড করুন" })}
                </Button>
              : <Button size="sm" onClick={onComplete}>
                  {tc({ en: "Complete", hi: "पूरा करें", bn: "সম্পন্ন করুন" })}
                </Button>
          )}
          {canManage && !isChain && (
            <Button size="sm" variant="ghost" onClick={onSkip}>
              {tc({ en: "Skip", hi: "छोड़ें", bn: "এড়িয়ে যান" })}
            </Button>
          )}
          {isChain && task.chain_id && (
            <Button size="sm" variant="ghost" onClick={onViewChain}>
              {tc({ en: "View Chain", hi: "चेन देखें", bn: "চেইন দেখুন" })}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function TaskSection({ label, labelColor, tasks, tc, canRecord, canManage, onComplete, onSkip, onOutcome, onViewChain }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SectionLabel label={label} color={labelColor} />
      {tasks.map(t => (
        <TaskCard key={t.id} task={t} tc={tc}
          canRecord={canRecord} canManage={canManage}
          onComplete={() => onComplete(t)} onSkip={() => onSkip(t)}
          onOutcome={() => onOutcome(t)} onViewChain={() => onViewChain(t)}
        />
      ))}
    </div>
  );
}

function TaskCard({ task, tc, canRecord, canManage, onComplete, onSkip, onOutcome, onViewChain }) {
  const isChain   = task.task_type === "chain_followup";
  const isBlocked = task.status === "blocked";
  const isOverdue = task.status === "overdue";
  const isDone    = ["completed", "skipped"].includes(task.status);
  const typeLabel = tc(TASK_TYPE_LABEL[task.task_type] || { en: task.task_type, hi: task.task_type, bn: task.task_type });
  const prLabel   = tc(PRIORITY_LABEL[task.priority]  || { en: task.priority,  hi: task.priority,  bn: task.priority });
  const prAccent  = PRIORITY_ACCENT[task.priority] || "primary";

  return (
    <Card pad={0} style={{ opacity: isDone ? 0.55 : 1 }}>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          {/* Priority stripe */}
          <div style={{ width: 3, borderRadius: 2, alignSelf: "stretch", flexShrink: 0,
            background: accent(prAccent).fg }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badges row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginBottom: 5 }}>
              <Badge label={prLabel} a={prAccent} />
              <span style={{ fontSize: 11.5, color: T.inkSoft }}>{typeLabel}</span>
              {isChain && <Icon name="Link2" size={12} color={T.inkSoft} />}
              {isOverdue && (
                <span style={{ fontSize: 11, fontWeight: 700, color: T.red }}>
                  {tc({ en: "OVERDUE", hi: "विलंबित", bn: "বিলম্বিত" })}
                </span>
              )}
            </div>
            {/* Title */}
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, lineHeight: 1.35 }}>
              {task.title}
            </div>
            {/* Description / reason */}
            {(task.description || task.reason) && (
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3, lineHeight: 1.4 }}>
                {task.description || task.reason}
              </div>
            )}
            {/* Date + batch day */}
            <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 4 }}>
              {fmtDate(task.scheduled_date)}
              {task.batch_day != null ? ` · ${tc({ en: `Day ${task.batch_day}`, hi: `दिन ${task.batch_day}`, bn: `দিন ${task.batch_day}` })}` : ""}
            </div>
            {/* Blocked message */}
            {isBlocked && (
              <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 4, fontStyle: "italic" }}>
                {tc({ en: "Blocked — complete the prerequisite task first",
                      hi: "ब्लॉक — पहले पूर्व-कार्य पूरा करें",
                      bn: "ব্লক — আগে পূর্বশর্ত কাজ করুন" })}
              </div>
            )}
          </div>
        </div>
        {/* Action buttons */}
        {!isDone && !isBlocked && (canRecord || canManage) && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, paddingLeft: 11 }}>
            {canRecord && (
              isChain
                ? <Button size="sm" onClick={onOutcome}>
                    {tc({ en: "Record Outcome", hi: "परिणाम दर्ज करें", bn: "ফলাফল রেকর্ড করুন" })}
                  </Button>
                : <Button size="sm" onClick={onComplete}>
                    {tc({ en: "Done", hi: "पूरा", bn: "সম্পন্ন" })}
                  </Button>
            )}
            {canManage && !isChain && (
              <Button size="sm" variant="ghost" onClick={onSkip}>
                {tc({ en: "Skip", hi: "छोड़ें", bn: "এड়িয়ে যান" })}
              </Button>
            )}
            {isChain && task.chain_id && (
              <Button size="sm" variant="ghost" onClick={onViewChain}>
                {tc({ en: "Details", hi: "विवरण", bn: "বিস্তারিত" })}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function AttentionSection({ chains, incidents, tc, onViewChain, onViewGuidance }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="AlertCircle" size={14} color={T.orange} />
        <SectionLabel label={tc({ en: "Attention Needed", hi: "ध्यान चाहिए", bn: "মনোযোগ প্রয়োজন" })} color={T.orange} />
      </div>
      {chains.map(c => (
        <Card key={c.id} onClick={() => onViewChain(c)} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Icon name="Link2" size={14} color={accent(PRIORITY_ACCENT[c.severity] || "primary").fg} />
                <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{c.title}</span>
              </div>
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 3 }}>
                {tc({ en: "Follow-up chain", hi: "फ़ॉलो-अप चेन", bn: "ফলো-আপ চেইন" })}
                {c.triggered_at ? ` · ${fmtDate(c.triggered_at)}` : ""}
              </div>
            </div>
            <Icon name="ChevronRight" size={16} color={T.inkFaint} style={{ flexShrink: 0 }} />
          </div>
        </Card>
      ))}
      {incidents.map(inc => {
        const sColor = inc.severity === "urgent" ? T.red : T.orange;
        const hasGuidance = !!inc.guided_response;
        return (
          <Card key={inc.id} style={{ borderLeft: `3px solid ${sColor}` }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
              <Icon name="AlertTriangle" size={13} color={sColor} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: sColor, textTransform: "uppercase" }}>
                {tc({ en: "Open Incident", hi: "खुली घटना", bn: "খোলা ঘটনা" })}
                {" · "}{inc.severity}
              </span>
            </div>
            <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.4 }}>
              {(inc.description || "").slice(0, 140)}{(inc.description || "").length > 140 ? "…" : ""}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              {inc.batch_day != null && (
                <div style={{ fontSize: 12, color: T.inkSoft }}>
                  {tc({ en: `Day ${inc.batch_day}`, hi: `दिन ${inc.batch_day}`, bn: `দিন ${inc.batch_day}` })}
                </div>
              )}
              {hasGuidance && (
                <button onClick={() => onViewGuidance(inc)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0,
                    fontSize: 12, fontWeight: 600, color: T.primary, fontFamily: T.body,
                    display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                  <Icon name="BookOpen" size={12} color={T.primary} />
                  {tc({ en: "View guidance", hi: "मार्गदर्शन देखें", bn: "নির্দেশিকা দেখুন" })}
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function UpcomingSection({ tasks, tc }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? tasks : tasks.slice(0, 3);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <SectionLabel label={tc({ en: "Upcoming (7 days)", hi: "आगामी (7 दिन)", bn: "আসন্ন (৭ দিন)" })} />
        {tasks.length > 3 && (
          <button onClick={() => setExpanded(!expanded)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.primary, padding: 0 }}>
            {expanded
              ? tc({ en: "Less", hi: "कम", bn: "কম" })
              : tc({ en: `+${tasks.length - 3} more`, hi: `+${tasks.length - 3} और`, bn: `+${tasks.length - 3} আরও` })}
          </button>
        )}
      </div>
      {shown.map(t => {
        const { fg } = accent(PRIORITY_ACCENT[t.priority] || "primary");
        return (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", background: T.surface2, borderRadius: T.rMd }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: fg, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13.5, color: T.ink }}>{t.title}</span>
            <span style={{ fontSize: 12, color: T.inkSoft, flexShrink: 0 }}>{fmtDate(t.scheduled_date)}</span>
          </div>
        );
      })}
    </div>
  );
}

function CompletedSection({ tasks, tc }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button onClick={() => setExpanded(v => !v)}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13,
          color: T.inkSoft, textAlign: "left", padding: "4px 0",
          display: "flex", alignItems: "center", gap: 5 }}>
        <Icon name="CheckCircle2" size={14} color={T.inkFaint} />
        {expanded
          ? tc({ en: "Completed today", hi: "आज पूरे", bn: "আজ সম্পন্ন" })
          : tc({ en: `${tasks.length} completed today`, hi: `${tasks.length} आज पूरे`, bn: `${tasks.length} আজ সম্পন্ন` })}
        <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={14} color={T.inkFaint} />
      </button>
      {expanded && tasks.map(t => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", background: T.surface2, borderRadius: T.rMd, opacity: 0.65 }}>
          <Icon name="Check" size={14} color={T.inkFaint} />
          <span style={{ fontSize: 13.5, color: T.inkSoft, flex: 1, textDecoration: "line-through" }}>
            {t.title}
          </span>
        </div>
      ))}
    </div>
  );
}

function GuidedResponseContent({ incident, tc, onClose, onViewChain }) {
  const response = incident.guided_response || {};
  const sColor = incident.severity === "urgent" ? T.red : incident.severity === "high" ? T.orange : T.inkSoft;
  const severityLabel = incident.severity === "urgent"
    ? tc({ en: "Urgent", hi: "अत्यावश्यक", bn: "জরুরি" })
    : incident.severity === "high"
      ? tc({ en: "High", hi: "गंभीर", bn: "গুরুতর" })
      : tc({ en: "Normal", hi: "सामान्य", bn: "সাধারণ" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0 8px" }}>

      {/* What was reported + severity badge */}
      <div style={{ background: T.surface2, borderRadius: T.rMd, padding: "10px 12px",
        borderLeft: `3px solid ${sColor}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Icon name="AlertTriangle" size={13} color={sColor} />
          <span style={{ fontSize: 11, fontWeight: 700, color: sColor, textTransform: "uppercase",
            letterSpacing: "0.05em" }}>
            {severityLabel}
            {incident.batch_day != null
              ? ` · ${tc({ en: `Day ${incident.batch_day}`, hi: `दिन ${incident.batch_day}`, bn: `দিন ${incident.batch_day}` })}`
              : ""}
          </span>
        </div>
        <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}>
          {incident.description}
        </div>
      </div>

      {/* Follow-up chain link (high/urgent only) */}
      {incident.chain_id && (
        <button onClick={() => onViewChain(incident.chain_id)}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
            padding: "10px 12px", background: T.surface2, borderRadius: T.rMd,
            border: `1px solid ${T.lineSoft}`, cursor: "pointer", textAlign: "left",
            fontFamily: T.body }}>
          <Icon name="Link2" size={14} color={T.primary} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.primary }}>
              {tc({ en: "Follow-up chain created", hi: "फ़ॉलो-अप चेन बनाई गई", bn: "ফলো-আপ চেইন তৈরি হয়েছে" })}
            </div>
            <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
              {tc({ en: "Tap to view tasks and track progress", hi: "कार्य देखने और प्रगति ट्रैक करने के लिए टैप करें",
                    bn: "কাজ দেখতে এবং অগ্রগতি ট্র্যাক করতে ট্যাপ করুন" })}
            </div>
          </div>
          <Icon name="ChevronRight" size={16} color={T.inkFaint} style={{ flexShrink: 0 }} />
        </button>
      )}

      {response.disclaimer && (
        <div style={{ fontSize: 12.5, color: T.orange, background: T.surface2,
          padding: "8px 12px", borderRadius: T.rMd, lineHeight: 1.5 }}>
          {response.disclaimer}
        </div>
      )}
      {response.checks?.length > 0 && (
        <ResponseBlock title={tc({ en: "Check these now",   hi: "अभी जाँचें",        bn: "এখনই পরীক্ষা করুন" })}
          items={response.checks} icon="Search" />
      )}
      {response.actions?.length > 0 && (
        <ResponseBlock title={tc({ en: "Take these actions", hi: "ये कदम उठाएँ",     bn: "এই পদক্ষেপ নিন" })}
          items={response.actions} icon="Zap" color={T.primary} />
      )}
      {response.explanations?.length > 0 && (
        <ResponseBlock title={tc({ en: "Why this happens",  hi: "ऐसा क्यों होता है", bn: "এটি কেন হয়" })}
          items={response.explanations} icon="Info" />
      )}
      {response.what_to_record && (
        <div style={{ fontSize: 13, color: T.ink, background: T.surface2,
          padding: "10px 12px", borderRadius: T.rMd, lineHeight: 1.5 }}>
          <strong>{tc({ en: "Record: ", hi: "दर्ज करें: ", bn: "রেকর্ড করুন: " })}</strong>
          {response.what_to_record}
        </div>
      )}
      {response.escalate_if && (
        <div style={{ fontSize: 12.5, color: T.red, background: T.surface2,
          padding: "8px 12px", borderRadius: T.rMd, lineHeight: 1.5 }}>
          <strong>{tc({ en: "Escalate if: ", hi: "जब विशेषज्ञ को बुलाएँ: ", bn: "বিশেষজ্ঞ ডাকুন যদি: " })}</strong>
          {response.escalate_if}
        </div>
      )}
      <Button full onClick={onClose}>
        {tc({ en: "Got it, I'll act on this", hi: "समझ गया, कदम उठाऊँगा", bn: "বুঝলাম, পদক্ষেপ নেব" })}
      </Button>
    </div>
  );
}

function ResponseBlock({ title, items, icon, color }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Icon name={icon} size={13} color={color || T.inkSoft} />
        <span style={{ fontSize: 12, fontWeight: 700, color: color || T.inkSoft,
          textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {title}
        </span>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "3px 0" }}>
          <span style={{ fontSize: 12, color: T.inkSoft, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
          <span style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}
