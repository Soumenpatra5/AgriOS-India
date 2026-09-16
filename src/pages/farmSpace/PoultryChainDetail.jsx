import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet, Dialog, accent,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { poultryApi } from "../../services/poultry/poultryApi.js";

const SEVERITY_ACCENT = { urgent: "red", high: "orange", normal: "primary", low: "primary" };
const STATUS_ACCENT   = { active: "orange", resolved: "primary", cancelled: "faint" };

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

const CLOSING_OUTCOMES = ["recovered", "resolved", "deceased"];

export default function PoultryChainDetail({ chainId }) {
  const { tc, toast, pop } = useApp();
  const [space, setSpace]   = useState(null);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  /* Record outcome sheet */
  const [outcomeTask, setOutcomeTask]     = useState(null);
  const [outcomeValue, setOutcomeValue]   = useState("improved");
  const [outcomeNotes, setOutcomeNotes]   = useState("");
  const [outcomeAction, setOutcomeAction] = useState("no_action");
  const [recording, setRecording]         = useState(false);

  /* Cancel confirm dialog */
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async (spaceId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await poultryApi.chainDetail(spaceId, chainId);
      setData(result);
    } catch (err) {
      setError(err.message || tc({ en: "Could not load chain", hi: "चेन लोड नहीं हुई", bn: "চেইন লোড হয়নি" }));
    } finally {
      setLoading(false);
    }
  }, [chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sp = await farmSpaceService.active();
        if (cancelled) return;
        setSpace(sp);
        await load(sp.id);
      } catch {
        if (!cancelled) setError(tc({ en: "Could not load space", hi: "स्पेस लोड नहीं हुई", bn: "স্পেস লোড হয়নি" }));
      }
    })();
    return () => { cancelled = true; };
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const doRecordOutcome = async () => {
    if (!outcomeTask || recording || !space) return;
    setRecording(true);
    try {
      await poultryApi.recordOutcome(space.id, {
        chainId:          outcomeTask.chain_id || chainId,
        taskId:           outcomeTask.id,
        outcome:          outcomeValue,
        observationNotes: outcomeNotes.trim() || null,
        actionTaken:      outcomeAction || null,
        clientUuid:       crypto.randomUUID(),
      });
      setOutcomeTask(null);
      toast(tc({ en: "Outcome recorded", hi: "परिणाम दर्ज हुआ", bn: "ফলাফল রেকর্ড হয়েছে" }), "success");
      load(space.id);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setRecording(false); }
  };

  const doCancel = async () => {
    if (!space || cancelling) return;
    setCancelling(true);
    try {
      await poultryApi.cancelChain(space.id, chainId, null);
      setCancelOpen(false);
      toast(tc({ en: "Chain cancelled", hi: "चेन रद्द की गई", bn: "চেইন বাতিল হয়েছে" }), "success");
      pop();
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setCancelling(false); }
  };

  /* ── render states ──────────────────────────────────────────────────── */

  if (loading) return (
    <div>
      <AppBar title={tc({ en: "Follow-up Chain", hi: "फ़ॉलो-अप चेन", bn: "ফলো-আপ চেইন" })} onBack={pop} />
      <div style={{ padding: 40, display: "grid", placeItems: "center" }}><Spinner /></div>
    </div>
  );
  if (error || !data) return (
    <div>
      <AppBar title={tc({ en: "Follow-up Chain", hi: "फ़ॉलो-अप चेन", bn: "ফলো-আপ চেইন" })} onBack={pop} />
      <ErrorState body={error || tc({ en: "No data", hi: "कोई डेटा नहीं", bn: "কোনো ডেটা নেই" })}
        onRetry={space ? () => load(space.id) : undefined} />
    </div>
  );

  const { chain, tasks = [], outcomes = [], batch = null, sourceEvent = null } = data;
  const isActive     = chain.status === "active";
  const pendingTasks = tasks.filter(t => !["completed", "skipped", "cancelled"].includes(t.status));
  const doneTasks    = tasks.filter(t =>  ["completed", "skipped"].includes(t.status));
  const sevAccent    = SEVERITY_ACCENT[chain.severity]   || "primary";
  const stAccent     = STATUS_ACCENT[chain.status]       || "faint";

  return (
    <div>
      <AppBar title={tc({ en: "Follow-up Chain", hi: "फ़ॉलो-अप चेन", bn: "ফলো-আপ চেইন" })} onBack={pop} />

      {/* Breadcrumb: Poultry → Batch → Workflow → Follow-up Chain */}
      <div style={{
        padding: "7px 16px", display: "flex", alignItems: "center", gap: 4,
        flexWrap: "wrap", background: T.surface, borderBottom: `1px solid ${T.lineSoft}`,
        fontSize: 12, color: T.inkFaint,
      }}>
        <span>{tc({ en: "Poultry", hi: "पोल्ट्री", bn: "পোলট্রি" })}</span>
        <Icon name="ChevronRight" size={12} color={T.inkFaint} />
        <span>{batch ? batch.name : tc({ en: "Batch", hi: "बैच", bn: "ব্যাচ" })}</span>
        <Icon name="ChevronRight" size={12} color={T.inkFaint} />
        <span>{tc({ en: "Workflow", hi: "वर्कफ़्लो", bn: "ওয়ার্কফ্লো" })}</span>
        <Icon name="ChevronRight" size={12} color={T.inkFaint} />
        <span style={{ color: T.ink, fontWeight: 600 }}>
          {tc({ en: "Follow-up Chain", hi: "फ़ॉलो-अप चेन", bn: "ফলো-আপ চেইন" })}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 16px 32px" }}>

        {/* Chain header */}
        <Card style={{ borderLeft: `4px solid ${accent(sevAccent).fg}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                <Badge label={tc({ en: chain.severity || "—", hi: chain.severity || "—", bn: chain.severity || "—" })} a={sevAccent} />
                <Badge label={tc({ en: chain.status   || "—", hi: chain.status   || "—", bn: chain.status   || "—" })} a={stAccent} />
                {chain.chain_type && (
                  <span style={{ fontSize: 11.5, color: T.inkSoft }}>{chain.chain_type}</span>
                )}
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>
                {chain.title || tc({ en: "Follow-up chain", hi: "फ़ॉलो-अप चेन", bn: "ফলো-আপ চেইন" })}
              </div>
              {chain.source_type && (
                <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 4, display: "flex", alignItems: "flex-start", gap: 4 }}>
                  <Icon name="ArrowUpRight" size={12} color={T.inkFaint} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>
                    {sourceEvent?.title
                      ? sourceEvent.title
                      : tc({ en: `Source: ${chain.source_type}`, hi: `स्रोत: ${chain.source_type}`, bn: `উৎস: ${chain.source_type}` })}
                  </span>
                </div>
              )}
              {sourceEvent?.detail && (
                <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 2, paddingLeft: 16, lineHeight: 1.4 }}>
                  {sourceEvent.detail}
                </div>
              )}
              {/* Batch context: name, code, day */}
              {batch && (
                <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span>{batch.name}</span>
                  {batch.batch_code && <span>· {batch.batch_code}</span>}
                  {chain.batch_day != null && (
                    <span>· {tc({ en: `Day ${chain.batch_day}`, hi: `दिन ${chain.batch_day}`, bn: `দিন ${chain.batch_day}` })}</span>
                  )}
                </div>
              )}
              {chain.triggered_at && (
                <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 3 }}>
                  {tc({ en: "Triggered", hi: "शुरू हुआ", bn: "শুরু হয়েছে" })}
                  {" "}{chain.triggered_at.slice(0, 10)}
                </div>
              )}
            </div>
          </div>
          {chain.description && (
            <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 8, lineHeight: 1.5, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
              {chain.description}
            </div>
          )}
        </Card>

        {/* Pending follow-up tasks */}
        {pendingTasks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SectionHead label={tc({ en: "Follow-up Tasks", hi: "फ़ॉलो-अप कार्य", bn: "ফলো-আপ কাজ" })} />
            {pendingTasks.map(t => (
              <ChainTaskCard key={t.id} task={t} tc={tc} isActive={isActive}
                onRecord={() => { setOutcomeTask(t); setOutcomeValue("improved"); setOutcomeNotes(""); setOutcomeAction("no_action"); }}
              />
            ))}
          </div>
        )}

        {/* Completed / skipped tasks */}
        {doneTasks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SectionHead label={tc({ en: "Completed", hi: "पूर्ण", bn: "সম্পন্ন" })} color={T.inkFaint} />
            {doneTasks.map(t => (
              <ChainTaskCard key={t.id} task={t} tc={tc} isActive={false} onRecord={null} />
            ))}
          </div>
        )}

        {pendingTasks.length === 0 && doneTasks.length === 0 && (
          <EmptyState icon="List"
            title={tc({ en: "No tasks in this chain", hi: "इस चेन में कोई कार्य नहीं", bn: "এই চেইনে কোনো কাজ নেই" })} />
        )}

        {/* Outcomes timeline */}
        {outcomes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SectionHead label={tc({ en: "Outcome History", hi: "परिणाम इतिहास", bn: "ফলাফলের ইতিহাস" })} />
            {outcomes.map((o, i) => <OutcomeCard key={o.id || i} outcome={o} tc={tc} />)}
          </div>
        )}

        {/* Resolution banner */}
        {!isActive && chain.resolved_at && (
          <Card style={{ background: accent("primary").bg, border: "none" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Icon name="CheckCircle2" size={18} color={accent("primary").fg} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: accent("primary").fg }}>
                  {tc({ en: "Chain Resolved", hi: "चेन समाधान हुई", bn: "চেইন সমাধান হয়েছে" })}
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                  {chain.resolved_at.slice(0, 10)}
                  {chain.resolution_outcome ? ` · ${chain.resolution_outcome}` : ""}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Cancel chain */}
        {isActive && (
          <button onClick={() => setCancelOpen(true)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 16px", background: "transparent",
              border: `1.5px solid ${T.red}`, borderRadius: T.rMd,
              cursor: "pointer", fontFamily: T.body,
              fontSize: 14, fontWeight: 600, color: T.red,
            }}>
            <Icon name="XCircle" size={16} />
            {tc({ en: "Cancel Chain", hi: "चेन रद्द करें", bn: "চেইন বাতিল করুন" })}
          </button>
        )}
      </div>

      {/* Record outcome sheet */}
      <BottomSheet open={!!outcomeTask} onClose={() => setOutcomeTask(null)}
        title={tc({ en: "Record Outcome", hi: "परिणाम दर्ज करें", bn: "ফলাফল রেকর্ড করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          {outcomeTask && (
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{outcomeTask.title}</div>
          )}
          <Dropdown label={tc({ en: "Outcome *", hi: "परिणाम *", bn: "ফলাফল *" })}
            value={outcomeValue} onChange={v => setOutcomeValue(v)} options={OUTCOME_OPTIONS(tc)} />
          {CLOSING_OUTCOMES.includes(outcomeValue) && (
            <div style={{ fontSize: 12.5, color: T.primary, background: accent("primary").bg,
              padding: "7px 10px", borderRadius: T.rMd }}>
              {tc({ en: "This outcome will resolve the chain.",
                    hi: "यह परिणाम चेन को समाधान करेगा।",
                    bn: "এই ফলাফল চেইনটি সমাধান করবে।" })}
            </div>
          )}
          <Input label={tc({ en: "Observations", hi: "अवलोकन", bn: "পর্যবেক্ষণ" })}
            value={outcomeNotes} onChange={v => setOutcomeNotes(v)} />
          <Dropdown label={tc({ en: "Action taken", hi: "कदम उठाए गए", bn: "গৃহীত পদক্ষেপ" })}
            value={outcomeAction} onChange={v => setOutcomeAction(v)} options={ACTION_TAKEN_OPTIONS(tc)} />
          <Button full onClick={doRecordOutcome} disabled={recording}>
            {recording
              ? tc({ en: "Recording…", hi: "दर्ज हो रहा है…", bn: "রেকর্ড হচ্ছে…" })
              : tc({ en: "Record Outcome", hi: "परिणाम दर्ज करें", bn: "ফলাফল রেকর্ড করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Cancel confirm */}
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)}
        title={tc({ en: "Cancel Chain?", hi: "चेन रद्द करें?", bn: "চেইন বাতিল করবেন?" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5 }}>
            {tc({ en: "This will mark all pending tasks as cancelled. This cannot be undone.",
                  hi: "इससे सभी बाकी कार्य रद्द हो जाएंगे। यह वापस नहीं किया जा सकता।",
                  bn: "এটি সমস্ত মুলতুবি কাজ বাতিল করবে। এটি পূর্বাবস্থায় ফেরানো যাবে না।" })}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button full variant="outline" onClick={() => setCancelOpen(false)}>
              {tc({ en: "Keep", hi: "रखें", bn: "রাখুন" })}
            </Button>
            <Button full variant="danger" onClick={doCancel} disabled={cancelling}>
              {cancelling
                ? tc({ en: "Cancelling…", hi: "रद्द हो रहा है…", bn: "বাতিল হচ্ছে…" })
                : tc({ en: "Yes, Cancel", hi: "हाँ, रद्द करें", bn: "হ্যাঁ, বাতিল করুন" })}
            </Button>
          </div>
        </div>
      </Dialog>
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

function SectionHead({ label, color }) {
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

function ChainTaskCard({ task, tc, isActive, onRecord }) {
  const isDone    = ["completed", "skipped"].includes(task.status);
  const isBlocked = task.status === "blocked";
  const isOverdue = task.status === "overdue";

  return (
    <Card pad={0} style={{ opacity: isDone ? 0.6 : 1 }}>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ marginTop: 2, flexShrink: 0 }}>
            {isDone
              ? <Icon name="CheckCircle2" size={16} color={T.inkFaint} />
              : isOverdue
                ? <Icon name="AlertCircle" size={16} color={T.red} />
                : <Icon name="Circle" size={16} color={T.inkFaint} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: isDone ? T.inkSoft : T.ink,
              textDecoration: task.status === "skipped" ? "line-through" : "none", lineHeight: 1.35 }}>
              {task.title}
            </div>
            {(task.description || task.reason) && (
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3, lineHeight: 1.4 }}>
                {task.description || task.reason}
              </div>
            )}
            <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {task.scheduled_date && <span>{task.scheduled_date}</span>}
              {task.batch_day != null && <span>{tc({ en: `Day ${task.batch_day}`, hi: `दिन ${task.batch_day}`, bn: `দিন ${task.batch_day}` })}</span>}
              {task.status === "skipped" && task.skip_reason && <span style={{ fontStyle: "italic" }}>{task.skip_reason}</span>}
            </div>
            {isBlocked && (
              <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 3, fontStyle: "italic" }}>
                {tc({ en: "Blocked — prerequisite pending", hi: "ब्लॉक — पूर्व-कार्य बाकी", bn: "ব্লক — পূর্বশর্ত বাকি" })}
              </div>
            )}
          </div>
        </div>
        {isActive && !isDone && !isBlocked && onRecord && (
          <div style={{ marginTop: 10, paddingLeft: 24 }}>
            <Button size="sm" onClick={onRecord}>
              {tc({ en: "Record Outcome", hi: "परिणाम दर्ज करें", bn: "ফলাফল রেকর্ড করুন" })}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function OutcomeCard({ outcome, tc }) {
  const OUTCOME_COLOR = {
    improved: T.primary, recovered: T.primary, resolved: T.primary,
    same: T.inkSoft,
    worse: T.orange, deceased: T.red,
  };
  const color = OUTCOME_COLOR[outcome.outcome] || T.inkSoft;

  return (
    <Card style={{ borderLeft: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color, textTransform: "capitalize" }}>
            {outcome.outcome}
          </div>
          {outcome.observation_notes && (
            <div style={{ fontSize: 13, color: T.ink, marginTop: 4, lineHeight: 1.4 }}>
              {outcome.observation_notes}
            </div>
          )}
          {outcome.action_taken && (
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3, lineHeight: 1.4 }}>
              <strong>{tc({ en: "Action: ", hi: "कदम: ", bn: "পদক্ষেপ: " })}</strong>
              {outcome.action_taken}
            </div>
          )}
        </div>
        {outcome.recorded_at && (
          <span style={{ fontSize: 11.5, color: T.inkFaint, flexShrink: 0, marginTop: 1 }}>
            {outcome.recorded_at.slice(0, 10)}
          </span>
        )}
      </div>
    </Card>
  );
}
