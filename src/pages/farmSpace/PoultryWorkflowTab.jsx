import { useState, useEffect, useCallback, useRef } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  Card, Button, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet, accent,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { poultryApi } from "../../services/poultry/poultryApi.js";
import { getPlanForDay, LIFECYCLE_MILESTONES, previewTasksForDay } from "../../config/poultryBatchPlan.js";

/* ── constants ──────────────────────────────────────────────────────────── */

const PRIORITY_ACCENT = { urgent: "red", high: "orange", normal: "primary", low: "faint" };

const PRIORITY_LABEL = {
  urgent: { en: "Urgent",  hi: "अत्यंत जरूरी", bn: "জরুরি",   ta: "அவசரம்",  te: "అత్యవసరం", mr: "अत्यंत तातडी", pa: "ਬਹੁਤ ਜ਼ਰੂਰੀ", or: "ଜରୁରୀ" },
  high:   { en: "High",    hi: "उच्च",          bn: "উচ্চ",     ta: "அதிக",    te: "అధిక",      mr: "उच्च",          pa: "ਉੱਚ",           or: "ଉଚ୍ଚ" },
  normal: { en: "Normal",  hi: "सामान्य",        bn: "সাধারণ",  ta: "சாதாரண",  te: "సాధారణ",    mr: "सामान्य",       pa: "ਸਾਧਾਰਨ",        or: "ସାଧାରଣ" },
  low:    { en: "Low",     hi: "कम",             bn: "কম",       ta: "குறைவு",  te: "తక్కువ",    mr: "कमी",           pa: "ਘੱਟ",           or: "କମ" },
};

const TASK_TYPE_LABEL = {
  monitoring_check: { en: "Monitoring",    hi: "निरीक्षण",       bn: "পর্যবেক্ষণ",  ta: "கண்காணிப்பு",     te: "పర్యవేక్షణ",   mr: "निरीक्षण",      pa: "ਨਿਗਰਾਨੀ",    or: "ନିରୀକ୍ଷଣ" },
  data_recording:   { en: "Record",        hi: "रिकॉर्ड",        bn: "রেকর্ড",       ta: "பதிவு",           te: "రికార్డ్",     mr: "नोंद",          pa: "ਰਿਕਾਰਡ",     or: "ରିକର୍ଡ" },
  physical_task:    { en: "Physical task", hi: "शारीरिक कार्य",  bn: "শারীরিক কাজ", ta: "உடல் பணி",        te: "శారీరక పని",   mr: "शारीरिक कार्य", pa: "ਸਰੀਰਕ ਕੰਮ",  or: "ଶାରୀରିକ କାର୍ଯ୍ୟ" },
  chain_followup:   { en: "Follow-up",     hi: "फ़ॉलो-अप",       bn: "ফলো-আপ",       ta: "தொடர்நடவடிக்கை", te: "ఫాలో-అప్",     mr: "पाठपुरावा",     pa: "ਫ਼ੌਲੋ-ਅੱਪ",  or: "ଫଲୋ-ଅପ" },
  incident_task:    { en: "Problem",       hi: "समस्या",         bn: "সমস্যা",       ta: "சிக்கல்",         te: "సమస్య",        mr: "समस्या",        pa: "ਸਮੱਸਿਆ",    or: "ସମସ୍ୟା" },
  reactive:         { en: "Alert",         hi: "अलर्ट",          bn: "সতর্কতা",      ta: "எச்சரிக்கை",      te: "హెచ్చరిక",     mr: "सतर्कता",       pa: "ਸੁਚੇਤ",      or: "ସତର୍କତା" },
  manual:           { en: "Manual",        hi: "मैन्युअल",       bn: "ম্যানুয়াল",   ta: "கைமுறை",          te: "మాన్యువల్",    mr: "मॅन्युअल",     pa: "ਮੈਨੁਅਲ",    or: "ମ୍ୟାନୁଅଲ" },
};

const SKIP_REASONS = (tc) => [
  { label: tc({ en: "Not applicable today",     hi: "आज लागू नहीं",          bn: "আজ প্রযোজ্য নয়",      ta: "இன்று பொருந்தாது",          te: "ఈరోజు వర్తించదు",             mr: "आज लागू नाही",    pa: "ਅੱਜ ਲਾਗੂ ਨਹੀਂ",               or: "ଆଜି ପ୍ରଯୋଜ୍ୟ ନୁହେ" }),        value: "Not applicable today" },
  { label: tc({ en: "Will complete later",      hi: "बाद में करूँगा",         bn: "পরে করব",               ta: "பின்னர் முடிப்பேன்",          te: "తర్వాత పూర్తి చేస్తాను",     mr: "नंतर करेन",       pa: "ਬਾਅਦ ਵਿੱਚ ਕਰਾਂਗਾ",            or: "ପରେ କରିବ" }),               value: "Will complete later" },
  { label: tc({ en: "Birds did not require it", hi: "पक्षियों को जरूरत नहीं", bn: "পাখির প্রয়োজন ছিল না", ta: "பறவைகளுக்கு தேவையில்லை",    te: "పక్షులకు అవసరం లేదు",        mr: "पक्ष्यांना गरज नव्हती", pa: "ਪੰਛੀਆਂ ਨੂੰ ਜ਼ਰੂਰਤ ਨਹੀਂ ਸੀ", or: "ପକ୍ଷୀଙ୍କ ଦରକାର ନଥିଲା" }), value: "Birds did not require it" },
  { label: tc({ en: "Manual override",          hi: "मैन्युअल ओवरराइड",      bn: "ম্যানুয়াল ওভাররাইড",   ta: "கைமுறை மேலெழுதல்",          te: "మాన్యువల్ ఓవర్‌రైడ్",       mr: "मॅन्युअल ओव्हरराइड", pa: "ਮੈਨੁਅਲ ਓਵਰਰਾਈਡ",           or: "ମ୍ୟାନୁଅଲ ଓଭର୍ରାଇଡ" }),   value: "Manual override" },
];

const OUTCOME_OPTIONS = (tc) => [
  { label: tc({ en: "Improved",  hi: "सुधार हुआ",    bn: "উন্নতি হয়েছে",  ta: "சீரானது",          te: "మెరుగైంది",        mr: "सुधारणा झाली",  pa: "ਸੁਧਾਰ ਹੋਇਆ",   or: "ଉନ୍ନତି ହୋଇଛି" }),  value: "improved" },
  { label: tc({ en: "Same",      hi: "वैसा ही",       bn: "একই আছে",        ta: "அப்படியே",         te: "అదే",              mr: "तसेच",           pa: "ਉਵੇਂ ਹੀ",      or: "ସେହି ଅଛି" }),       value: "same" },
  { label: tc({ en: "Worse",     hi: "खराब हुआ",      bn: "আরও খারাপ",      ta: "மோசமாகியது",       te: "మరింత దిగజారింది", mr: "आणखी वाईट",     pa: "ਹੋਰ ਖਰਾਬ",     or: "ଆହୁରି ଖରାପ" }),     value: "worse" },
  { label: tc({ en: "Recovered", hi: "ठीक हो गए",    bn: "সুস্থ হয়েছে",   ta: "குணமடைந்தது",      te: "కోలుకున్నారు",     mr: "बरे झाले",      pa: "ਠੀਕ ਹੋ ਗਏ",    or: "ସୁସ୍ଥ ହୋଇଛି" }),  value: "recovered" },
  { label: tc({ en: "Resolved",  hi: "समाधान हुआ",   bn: "সমাধান হয়েছে",  ta: "தீர்வு கிடைத்தது", te: "పరిష్కారమైంది",    mr: "निराकरण झाले",  pa: "ਹੱਲ ਹੋ ਗਿਆ",   or: "ସମାଧାନ ହୋଇଛି" }), value: "resolved" },
  { label: tc({ en: "Deceased",  hi: "मृत्यु हो गई", bn: "মৃত্যু হয়েছে",  ta: "மரணமடைந்தது",      te: "మరణించారు",        mr: "मृत्यू झाला",   pa: "ਮੌਤ ਹੋ ਗਈ",    or: "ମୃତ୍ୟୁ ହୋଇଛି" }), value: "deceased" },
];

const ACTION_TAKEN_OPTIONS = (tc) => [
  { label: tc({ en: "No action needed",   hi: "कोई कदम नहीं",        bn: "কোনো পদক্ষেপ নেই",    ta: "எந்த நடவடிக்கையும் இல்லை",              te: "ఏ చర్యా అవసరం లేదు",          mr: "कोणती कृती नाही",        pa: "ਕੋਈ ਕਾਰਵਾਈ ਨਹੀਂ",       or: "କୋଣସି ପଦକ୍ଷେପ ନାହିଁ" }),    value: "no_action" },
  { label: tc({ en: "Repeat treatment",   hi: "उपचार दोहराएँ",       bn: "চিকিৎসা পুনরাবৃত্তি", ta: "சிகிச்சை மீண்டும் செய்",               te: "చికిత్స మళ్ళీ చేయండి",       mr: "उपचार पुन्हा करा",        pa: "ਇਲਾਜ ਦੁਹਰਾਓ",            or: "ଚିକିତ୍ସା ପୁନର୍ଦୋହରାଓ" }), value: "repeat_treatment" },
  { label: tc({ en: "New treatment",      hi: "नया उपचार",            bn: "নতুন চিকিৎসা",         ta: "புதிய சிகிச்சை",                        te: "కొత్త చికిత్స",               mr: "नवीन उपचार",              pa: "ਨਵਾਂ ਇਲਾਜ",               or: "ନୂଆ ଚିକିତ୍ସା" }),        value: "new_treatment" },
  { label: tc({ en: "Issue resolved",     hi: "समस्या हल हुई",       bn: "সমস্যা সমাধান",        ta: "சிக்கல் தீர்ந்தது",                     te: "సమస్య పరిష్కారమైంది",        mr: "समस्या सुटली",            pa: "ਸਮੱਸਿਆ ਹੱਲ ਹੋਈ",         or: "ସମସ୍ୟା ସମାଧାନ" }),        value: "resolved" },
  { label: tc({ en: "Escalated to vet",  hi: "पशु चिकित्सक बुलाया", bn: "পশু চিকিৎসকে পাঠানো",  ta: "கால்நடை மருத்துவரிடம் அனுப்பினோம்",  te: "పశువైద్యుడికి పంపారు",       mr: "पशुवैद्याकडे पाठवले",    pa: "ਪਸ਼ੂ ਡਾਕਟਰ ਕੋਲ ਭੇਜਿਆ",  or: "ପଶୁ ଡାକ୍ତରଙ୍କ ପାଖକୁ ପଠାଇଲା" }), value: "escalated" },
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
      setError(err.message || tc({ en: "Could not load workflow", hi: "वर्कफ़्लो लोड नहीं हुआ", bn: "ওয়ার্কফ্লো লোড হয়নি", ta: "வொர்க்ஃப்ளோ ஏற்றமுடியவில்லை", te: "వర్క్‌ఫ్లో లోడ్ కాలేదు", mr: "वर्कफ्लो लोड झाला नाही", pa: "ਵਰਕਫਲੋ ਲੋਡ ਨਹੀਂ ਹੋਇਆ", or: "ୱର୍କଫ୍ଲୋ ଲୋଡ ହୋଇନାହିଁ" }));
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
      toast(tc({ en: "Task completed", hi: "कार्य पूरा हुआ", bn: "কাজ সম্পন্ন হয়েছে", ta: "பணி முடிந்தது", te: "పని పూర్తైంది", mr: "कार्य पूर्ण झाले", pa: "ਕੰਮ ਪੂਰਾ ਹੋਇਆ", or: "କାର୍ଯ୍ୟ ସମ୍ପୂର୍ଣ ହୋଇଛି" }), "success");
      load(true);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ", ta: "தோல்வி", te: "విఫలమైంది", mr: "अयशस्वी", pa: "ਅਸਫਲ", or: "ବିଫଳ" }), "error");
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
      toast(tc({ en: "Task skipped", hi: "कार्य छोड़ा गया", bn: "কাজ এড়িয়ে যাওয়া হয়েছে", ta: "பணி தவிர்க்கப்பட்டது", te: "పని దాటవేయబడింది", mr: "कार्य वगळले", pa: "ਕੰਮ ਛੱਡਿਆ ਗਿਆ", or: "କାର୍ଯ୍ୟ ଛାଡ଼ି ଦିଆ ହୋଇଛି" }), "success");
      load(true);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ", ta: "தோல்வி", te: "విఫలమైంది", mr: "अयशस्वी", pa: "ਅਸਫਲ", or: "ବିଫଳ" }), "error");
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
      toast(tc({ en: "Outcome recorded", hi: "परिणाम दर्ज हुआ", bn: "ফলাফল রেকর্ড হয়েছে", ta: "முடிவு பதிவாகியது", te: "ఫలితం రికార్డ్ అయింది", mr: "परिणाम नोंदवला", pa: "ਨਤੀਜਾ ਦਰਜ ਹੋਇਆ", or: "ଫଳାଫଳ ରେକର୍ଡ ହୋଇଛି" }), "success");
      load(true);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ", ta: "தோல்வி", te: "విఫలమైంది", mr: "अयशस्वी", pa: "ਅਸਫਲ", or: "ବିଫଳ" }), "error");
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
        toast(tc({ en: "Problem reported", hi: "समस्या दर्ज हुई", bn: "সমস্যা রিপোর্ট হয়েছে", ta: "சிக்கல் தெரிவிக்கப்பட்டது", te: "సమస్య నివేదించబడింది", mr: "समस्या नोंदवली गेली", pa: "ਸਮੱਸਿਆ ਦਰਜ ਹੋਈ", or: "ସମସ୍ୟା ରିପୋର୍ଟ ହୋଇଛି" }), "success");
      }
      load(true);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব्यर्थ", ta: "தோல்வி", te: "విఫలమైంది", mr: "अयशस्वी", pa: "ਅਸਫਲ", or: "ବିଫଳ" }), "error");
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
  const phase = getPlanForDay(summary.batchDay ?? 0);
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

      {/* Daily briefing card (phase name, focus, milestones, refresh) */}
      <DailyBriefingCard
        phase={phase} batchDay={summary.batchDay} date={summary.date}
        tc={tc} refreshing={refreshing} onRefresh={() => load(true)}
      />

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <StatPill label={tc({ en: "Done",    hi: "पूरे",      bn: "সম্পন্ন",   ta: "முடிந்தது",   te: "పూర్తైంది",        mr: "झाले",         pa: "ਹੋ ਗਿਆ",    or: "ସମ୍ପୂର୍ଣ" })} value={completedCount} color={T.primary} />
        <StatPill label={tc({ en: "Pending", hi: "बाकी",      bn: "বাকি",       ta: "நிலுவை",     te: "పెండింగ్",        mr: "प्रलंबित",     pa: "ਬਾਕੀ",      or: "ବାକି" })}    value={pendingCount}   color={T.inkSoft} />
        <StatPill label={tc({ en: "Overdue", hi: "विलंबित",   bn: "বিলম্বিত",  ta: "தாமதமான",    te: "గడువు మించిన",    mr: "विलंबित",      pa: "ਵਿਲੰਬਿਤ",   or: "ବିଳମ୍ବିତ" })} value={overdueCount}
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
        <TaskSection label={tc({ en: "Overdue", hi: "विलंबित", bn: "বিলম্বিত", ta: "தாமதமான", te: "గడువు మించిన", mr: "विलंबित", pa: "ਵਿਲੰਬਿਤ", or: "ବିଳମ୍ବିତ" })} labelColor={T.red}
          tasks={s.overdue.tasks} tc={tc} canRecord={canRecord} canManage={canManage}
          phase={phase}
          onComplete={openComplete} onSkip={openSkip} onOutcome={openOutcome} onViewChain={viewChain}
        />
      )}

      {/* Today's pending tasks (recommendation already shown above; excluded here) */}
      {todayTasks.length > 0 && (
        <TaskSection label={tc({ en: "Today", hi: "आज", bn: "আজ", ta: "இன்று", te: "ఈరోజు", mr: "आज", pa: "ਅੱਜ", or: "ଆଜି" })}
          tasks={todayTasks} tc={tc} canRecord={canRecord} canManage={canManage}
          phase={phase}
          onComplete={openComplete} onSkip={openSkip} onOutcome={openOutcome} onViewChain={viewChain}
        />
      )}

      {overdueCount === 0 && pendingCount === 0 && (
        <EmptyState icon="CheckCircle2"
          title={tc({ en: "All tasks done for today!", hi: "आज सभी कार्य पूरे!", bn: "আজকের সব কাজ শেষ!", ta: "இன்றைய அனைத்து பணிகளும் முடிந்தன!", te: "ఈరోజు పనులన్నీ పూర్తయ్యాయి!", mr: "आजची सर्व कामे पूर्ण!", pa: "ਅੱਜ ਦੇ ਸਾਰੇ ਕੰਮ ਪੂਰੇ!", or: "ଆଜିର ସମସ୍ତ କାର୍ଯ୍ୟ ସମ୍ପୂର୍ଣ!" })} />
      )}

      {/* Cautions for today's phase */}
      {phase.cautions?.length > 0 && (
        <CautionsCard cautions={phase.cautions} tc={tc} />
      )}

      {/* Watch-for triggers */}
      {phase.watchFor?.length > 0 && (
        <WatchForCard
          items={phase.watchFor} tc={tc}
          onReport={(hint) => { setIncidentDesc(tc(hint)); setIncidentOpen(true); }}
        />
      )}

      {/* Tomorrow preview */}
      <TomorrowPreviewCard
        batchDay={summary.batchDay ?? 0}
        poultryType={batch.poultry_type}
        tc={tc}
      />

      {/* 7-day timeline */}
      <SevenDayTimeline
        batchDay={summary.batchDay ?? 0}
        poultryType={batch.poultry_type}
        tc={tc}
      />

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
          {tc({ en: "Report a Problem", hi: "समस्या रिपोर्ट करें", bn: "সমস্যা রিপোর্ট করুন", ta: "சிக்கலை தெரிவி", te: "సమస్య నివేదించండి", mr: "समस्या कळवा", pa: "ਸਮੱਸਿਆ ਦੱਸੋ", or: "ସମସ୍ୟା ଜଣାନ୍ତୁ" })}
        </button>
      )}

      {/* ── Sheets ─────────────────────────────────────────────────────── */}

      {/* Complete task */}
      <BottomSheet open={!!completeTask} onClose={() => setCompleteTask(null)}
        title={tc({ en: "Complete Task", hi: "कार्य पूरा करें", bn: "কাজ সম্পন্ন করুন", ta: "பணியை முடி", te: "పని పూర్తి చేయండి", mr: "कार्य पूर्ण करा", pa: "ਕੰਮ ਪੂਰਾ ਕਰੋ", or: "କାର୍ଯ୍ୟ ସମ୍ପୂର୍ଣ କରନ୍ତୁ" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          {completeTask && (
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{completeTask.title}</div>
          )}
          <Input label={tc({ en: "Notes (optional)", hi: "नोट (वैकल्पिक)", bn: "নোট (ঐচ্ছিক)", ta: "குறிப்புகள் (விரும்பினால்)", te: "నోట్స్ (ఐచ్ఛికం)", mr: "नोट्स (पर्यायी)", pa: "ਨੋਟਸ (ਵਿਕਲਪਿਕ)", or: "ନୋଟ (ଐଚ୍ଛିକ)" })}
            value={completeNotes} onChange={v => setCompleteNotes(v)} />
          <Button full onClick={doComplete} disabled={completing}>
            {completing
              ? tc({ en: "Completing…", hi: "पूरा हो रहा है…", bn: "সম্পন্ন হচ্ছে…", ta: "முடிக்கிறது…", te: "పూర్తి అవుతోంది…", mr: "पूर्ण होत आहे…", pa: "ਪੂਰਾ ਹੋ ਰਿਹਾ ਹੈ…", or: "ସମ୍ପୂର୍ଣ ହେଉଛି…" })
              : tc({ en: "Mark Complete", hi: "पूरा चिह्नित करें", bn: "সম্পন্ন করুন", ta: "முடிந்ததாக குறி", te: "పూర్తి అని గుర్తించండి", mr: "पूर्ण म्हणून चिन्हांकित करा", pa: "ਪੂਰਾ ਦੱਸੋ", or: "ସମ୍ପୂର୍ଣ ଚିହ୍ନିତ କରନ୍ତୁ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Skip task */}
      <BottomSheet open={!!skipTask} onClose={() => setSkipTask(null)}
        title={tc({ en: "Skip Task", hi: "कार्य छोड़ें", bn: "কাজ এড়িয়ে যান", ta: "பணியை தவிர்", te: "పని దాటవేయండి", mr: "कार्य वगळा", pa: "ਕੰਮ ਛੱਡੋ", or: "କାର୍ଯ୍ୟ ଛାଡ଼ନ୍ତୁ" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          {skipTask && (
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{skipTask.title}</div>
          )}
          <Dropdown label={tc({ en: "Reason *", hi: "कारण *", bn: "কারণ *", ta: "காரணம் *", te: "కారణం *", mr: "कारण *", pa: "ਕਾਰਨ *", or: "କାରଣ *" })}
            value={skipReason} onChange={v => setSkipReason(v)} options={SKIP_REASONS(tc)} />
          <Input label={tc({ en: "Notes (optional)", hi: "नोट (वैकल्पिक)", bn: "নোট (ঐচ্ছিক)", ta: "குறிப்புகள் (விரும்பினால்)", te: "నోట్స్ (ఐచ్ఛికం)", mr: "नोट्स (पर्यायी)", pa: "ਨੋਟਸ (ਵਿਕਲਪਿਕ)", or: "ନୋଟ (ଐଚ୍ଛିକ)" })}
            value={skipNotes} onChange={v => setSkipNotes(v)} />
          <Button full variant="soft" onClick={doSkip} disabled={skipping}>
            {skipping
              ? tc({ en: "Skipping…", hi: "छोड़ा जा रहा है…", bn: "এড়িয়ে যাওয়া হচ্ছে…", ta: "தவிர்க்கிறது…", te: "దాటవేస్తోంది…", mr: "वगळत आहे…", pa: "ਛੱਡਿਆ ਜਾ ਰਿਹਾ ਹੈ…", or: "ଛାଡ଼ୁଛି…" })
              : tc({ en: "Skip Task", hi: "कार्य छोड़ें", bn: "কাজ এড়িয়ে যান", ta: "பணியை தவிர்", te: "పని దాటవేయండి", mr: "कार्य वगळा", pa: "ਕੰਮ ਛੱਡੋ", or: "କାର୍ଯ୍ୟ ଛାଡ଼ନ୍ତୁ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Record outcome (chain_followup) */}
      <BottomSheet open={!!outcomeTask} onClose={() => setOutcomeTask(null)}
        title={tc({ en: "Record Outcome", hi: "परिणाम दर्ज करें", bn: "ফলাফল রেকর্ড করুন", ta: "முடிவை பதிவு செய்", te: "ఫలితం నమోదు చేయండి", mr: "परिणाम नोंदवा", pa: "ਨਤੀਜਾ ਦਰਜ ਕਰੋ", or: "ଫଳାଫଳ ରେକର୍ଡ କରନ୍ତୁ" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          {outcomeTask && (
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{outcomeTask.title}</div>
          )}
          <Dropdown label={tc({ en: "Outcome *", hi: "परिणाम *", bn: "ফলাফল *", ta: "முடிவு *", te: "ఫలితం *", mr: "परिणाम *", pa: "ਨਤੀਜਾ *", or: "ଫଳାଫଳ *" })}
            value={outcomeValue} onChange={v => setOutcomeValue(v)} options={OUTCOME_OPTIONS(tc)} />
          <Input label={tc({ en: "Observations", hi: "अवलोकन", bn: "পর্যবেক্ষণ", ta: "கவனிப்புகள்", te: "పరిశీలనలు", mr: "निरीक्षणे", pa: "ਨਿਰੀਖਣ", or: "ପର୍ଯ୍ୟବେକ୍ଷଣ" })}
            value={outcomeNotes} onChange={v => setOutcomeNotes(v)} />
          <Dropdown label={tc({ en: "Action taken", hi: "कदम उठाए गए", bn: "গৃহীত পদক্ষেপ", ta: "நடவடிக்கை எடுக்கப்பட்டது", te: "తీసుకున్న చర్య", mr: "केलेली कृती", pa: "ਕੀਤੀ ਕਾਰਵਾਈ", or: "ନିଆଯାଇଥିବା ପଦକ୍ଷେପ" })}
            value={outcomeAction} onChange={v => setOutcomeAction(v)} options={ACTION_TAKEN_OPTIONS(tc)} />
          <Button full onClick={doRecordOutcome} disabled={recordingOutcome}>
            {recordingOutcome
              ? tc({ en: "Recording…", hi: "दर्ज हो रहा है…", bn: "রেকর্ড হচ্ছে…", ta: "பதிவு செய்கிறது…", te: "రికార్డ్ అవుతోంది…", mr: "नोंदवत आहे…", pa: "ਦਰਜ ਹੋ ਰਿਹਾ ਹੈ…", or: "ରେକର୍ଡ ହେଉଛି…" })
              : tc({ en: "Record Outcome", hi: "परिणाम दर्ज करें", bn: "ফলাফল রেকর্ড করুন", ta: "முடிவை பதிவு செய்", te: "ఫలితం నమోదు చేయండి", mr: "परिणाम नोंदवा", pa: "ਨਤੀਜਾ ਦਰਜ ਕਰੋ", or: "ଫଳାଫଳ ରେକର୍ଡ କରନ୍ତୁ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Report incident */}
      <BottomSheet open={incidentOpen} onClose={() => setIncidentOpen(false)}
        title={tc({ en: "Report a Problem", hi: "समस्या रिपोर्ट करें", bn: "সমস্যা রিপোর্ট করুন", ta: "சிக்கலை தெரிவி", te: "సమస్య నివేదించండి", mr: "समस्या कळवा", pa: "ਸਮੱਸਿਆ ਦੱਸੋ", or: "ସମସ୍ୟା ଜଣାନ୍ତୁ" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5 }}>
            {tc({ en: "Describe what you're seeing with the birds, water, feed, or environment.",
                  hi: "पक्षियों, पानी, चारे या वातावरण में जो देख रहे हैं, वह बताएँ।",
                  bn: "পাখি, পানি, খাদ্য বা পরিবেশে যা দেখছেন তা বর্ণনা করুন।",
                  ta: "பறவைகள், தண்ணீர், தீவனம் அல்லது சூழலில் என்ன பார்க்கிறீர்கள் என்று விவரிக்கவும்.",
                  te: "పక్షులు, నీరు, మేత లేదా పర్యావరణంతో మీరు ఏమి చూస్తున్నారో వివరించండి.",
                  mr: "पक्षी, पाणी, चारा किंवा वातावरणात आपण काय पाहत आहात ते सांगा.",
                  pa: "ਪੰਛੀਆਂ, ਪਾਣੀ, ਚਾਰੇ ਜਾਂ ਵਾਤਾਵਰਣ ਬਾਰੇ ਜੋ ਦੇਖ ਰਹੇ ਹੋ ਉਹ ਦੱਸੋ.",
                  or: "ପକ୍ଷୀ, ଜଳ, ଖାଦ୍ୟ ବା ପରିବେଶ ବିଷୟରେ ଆପଣ ଯାହା ଦେଖୁଛନ୍ତି ତାହା ବର୍ଣ୍ଣନା କରନ୍ତୁ." })}
          </div>
          <Input label={tc({ en: "Description *", hi: "विवरण *", bn: "বিবরণ *", ta: "விவரம் *", te: "వివరణ *", mr: "वर्णन *", pa: "ਵੇਰਵਾ *", or: "ବିବରଣ *" })}
            value={incidentDesc} onChange={v => setIncidentDesc(v)} />
          <Button full onClick={doReportIncident} disabled={!incidentDesc.trim() || reporting}>
            {reporting
              ? tc({ en: "Reporting…", hi: "रिपोर्ट हो रहा है…", bn: "রিপোর্ট হচ্ছে…", ta: "தெரிவிக்கிறது…", te: "నివేదిస్తోంది…", mr: "नोंदवत आहे…", pa: "ਦੱਸਿਆ ਜਾ ਰਿਹਾ ਹੈ…", or: "ରିପୋର୍ଟ ହେଉଛି…" })
              : tc({ en: "Report Problem", hi: "समस्या रिपोर्ट करें", bn: "সমস্যা রিপোর্ট করুন", ta: "சிக்கலை தெரிவி", te: "సమస్య నివేదించండి", mr: "समस्या नोंदवा", pa: "ਸਮੱਸਿਆ ਦੱਸੋ", or: "ସମସ୍ୟା ରିପୋର୍ଟ କରନ୍ତୁ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Problem guidance (full incident context) */}
      <BottomSheet open={!!incidentResult} onClose={() => setIncidentResult(null)}
        title={tc({ en: "Problem Guidance", hi: "समस्या मार्गदर्शन", bn: "সমস্যা নির্দেশিকা", ta: "சிக்கல் வழிகாட்டுதல்", te: "సమస్య మార్గదర్శకం", mr: "समस्या मार्गदर्शन", pa: "ਸਮੱਸਿਆ ਮਾਰਗਦਰਸ਼ਨ", or: "ସମସ୍ୟା ମାର୍ଗଦର୍ଶନ" })}>
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
            {tc({ en: "Next Action", hi: "अगला कार्य", bn: "পরবর্তী কাজ", ta: "அடுத்த செயல்", te: "తదుపరి చర్య", mr: "पुढील कार्य", pa: "ਅਗਲਾ ਕੰਮ", or: "ପରବର୍ତ୍ତୀ କାର୍ଯ୍ୟ" })}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>{task.title}</div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 3, lineHeight: 1.4 }}>{reason}</div>
          {isOverdue && (
            <div style={{ marginTop: 4, fontSize: 12, color: T.red, fontWeight: 600 }}>
              {tc({ en: "Overdue", hi: "विलंबित", bn: "বিলম্বিত", ta: "தாமதமான", te: "గడువు మించిన", mr: "विलंबित", pa: "ਵਿਲੰਬਿਤ", or: "ବିଳମ୍ବିତ" })}
              {task.scheduled_date ? ` · ${fmtDate(task.scheduled_date)}` : ""}
            </div>
          )}
          {isChain && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
              <Icon name="Link2" size={12} color={T.inkSoft} />
              <span style={{ fontSize: 12, color: T.inkSoft }}>
                {tc({ en: "Follow-up chain", hi: "फ़ॉलो-अप चेन", bn: "ফলো-আপ চেইন", ta: "தொடர் சங்கிலி", te: "ఫాలో-అప్ చైన్", mr: "पाठपुरावा साखळी", pa: "ਫ਼ੌਲੋ-ਅੱਪ ਚੇਨ", or: "ଫଲୋ-ଅପ ଚେନ" })}
              </span>
            </div>
          )}
          {isBlocked && (
            <div style={{ marginTop: 6, fontSize: 12, color: T.inkFaint, fontStyle: "italic" }}>
              {tc({ en: "Blocked — complete the prerequisite task first",
                    hi: "ब्लॉक — पहले आवश्यक कार्य पूरा करें",
                    bn: "ব্লক — আগে পূর্বশর্ত কাজ শেষ করুন",
                    ta: "தடுக்கப்பட்டது — முதலில் முன்நிபந்தனை பணியை முடி",
                    te: "బ్లాక్ — ముందు అవసరమైన పని చేయండి",
                    mr: "अडलेले — आधी पूर्वअट कार्य पूर्ण करा",
                    pa: "ਰੋਕਿਆ — ਪਹਿਲਾਂ ਪੂਰਵ-ਸ਼ਰਤ ਕੰਮ ਕਰੋ",
                    or: "ଅବରୁଦ୍ଧ — ପ୍ରଥମେ ପୂର୍ବ-ଶର୍ତ ଅନ୍ତର୍ଭୁକ୍ତ କରନ୍ତୁ" })}
            </div>
          )}
        </div>
      </div>
      {!isBlocked && (canRecord || canManage) && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {canRecord && (
            isChain
              ? <Button size="sm" onClick={onOutcome}>
                  {tc({ en: "Record Outcome", hi: "परिणाम दर्ज करें", bn: "ফলাফল রেকর্ড করুন", ta: "முடிவை பதிவு செய்", te: "ఫలితం నమోదు చేయండి", mr: "परिणाम नोंदवा", pa: "ਨਤੀਜਾ ਦਰਜ ਕਰੋ", or: "ଫଳାଫଳ ରେକର୍ଡ କରନ୍ତୁ" })}
                </Button>
              : <Button size="sm" onClick={onComplete}>
                  {tc({ en: "Complete", hi: "पूरा करें", bn: "সম্পন্ন করুন", ta: "முடி", te: "పూర్తి చేయండి", mr: "पूर्ण करा", pa: "ਪੂਰਾ ਕਰੋ", or: "ସମ୍ପୂର୍ଣ କରନ୍ତୁ" })}
                </Button>
          )}
          {canManage && !isChain && (
            <Button size="sm" variant="ghost" onClick={onSkip}>
              {tc({ en: "Skip", hi: "छोड़ें", bn: "এড়িয়ে যান", ta: "தவிர்", te: "దాటవేయండి", mr: "वगळा", pa: "ਛੱਡੋ", or: "ଛାଡ଼ନ୍ତୁ" })}
            </Button>
          )}
          {isChain && task.chain_id && (
            <Button size="sm" variant="ghost" onClick={onViewChain}>
              {tc({ en: "View Chain", hi: "चेन देखें", bn: "চেইন দেখুন", ta: "சங்கிலியை காண்", te: "చైన్ చూడండి", mr: "साखळी पहा", pa: "ਚੇਨ ਦੇਖੋ", or: "ଚେନ ଦେଖନ୍ତୁ" })}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function TaskSection({ label, labelColor, tasks, tc, canRecord, canManage, phase, onComplete, onSkip, onOutcome, onViewChain }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SectionLabel label={label} color={labelColor} />
      {tasks.map(t => (
        <TaskCard key={t.id} task={t} tc={tc}
          canRecord={canRecord} canManage={canManage}
          isMandatory={phase?.mandatory?.includes(t.template_id)}
          onComplete={() => onComplete(t)} onSkip={() => onSkip(t)}
          onOutcome={() => onOutcome(t)} onViewChain={() => onViewChain(t)}
        />
      ))}
    </div>
  );
}

function TaskCard({ task, tc, canRecord, canManage, isMandatory, onComplete, onSkip, onOutcome, onViewChain }) {
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
              {isMandatory && (
                <Badge label={tc({ en: "Required", hi: "अनिवार्य", bn: "আবশ্যক", ta: "அவசியம்", te: "అవసరం", mr: "अनिवार्य", pa: "ਲਾਜ਼ਮੀ", or: "ଆବଶ୍ୟକ" })} a="primary" />
              )}
              {isChain && <Icon name="Link2" size={12} color={T.inkSoft} />}
              {isOverdue && (
                <span style={{ fontSize: 11, fontWeight: 700, color: T.red }}>
                  {tc({ en: "OVERDUE", hi: "विलंबित", bn: "বিলম্বিত", ta: "தாமதம்", te: "గడువు మించింది", mr: "विलंबित", pa: "ਵਿਲੰਬਿਤ", or: "ବିଳମ୍ବ" })}
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
              {task.batch_day != null ? ` · ${tc({ en: `Day ${task.batch_day}`, hi: `दिन ${task.batch_day}`, bn: `দিন ${task.batch_day}`, ta: `நாள் ${task.batch_day}`, te: `రోజు ${task.batch_day}`, mr: `दिवस ${task.batch_day}`, pa: `ਦਿਨ ${task.batch_day}`, or: `ଦିନ ${task.batch_day}` })}` : ""}
            </div>
            {/* Blocked message */}
            {isBlocked && (
              <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 4, fontStyle: "italic" }}>
                {tc({ en: "Blocked — complete the prerequisite task first",
                      hi: "ब्लॉक — पहले पूर्व-कार्य पूरा करें",
                      bn: "ব্লক — আগে পূর্বশর্ত কাজ করুন",
                      ta: "தடுக்கப்பட்டது — முதலில் முன்னோட்ட பணியை முடி",
                      te: "బ్లాక్ — ముందు పూర్వ-కార్య పూర్తి చేయండి",
                      mr: "अडलेले — आधी पूर्वकार्य पूर्ण करा",
                      pa: "ਰੋਕਿਆ — ਪਹਿਲਾਂ ਪੂਰਵ-ਕੰਮ ਕਰੋ",
                      or: "ଅବରୁଦ୍ଧ — ପ୍ରଥମ ପୂର୍ବ-କାର୍ଯ୍ୟ ଶେଷ କରନ୍ତୁ" })}
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
                    {tc({ en: "Record Outcome", hi: "परिणाम दर्ज करें", bn: "ফলাফল রেকর্ড করুন", ta: "முடிவை பதிவு செய்", te: "ఫలితం నమోదు చేయండి", mr: "परिणाम नोंदवा", pa: "ਨਤੀਜਾ ਦਰਜ ਕਰੋ", or: "ଫଳାଫଳ ରେକର୍ଡ କରନ୍ତୁ" })}
                  </Button>
                : <Button size="sm" onClick={onComplete}>
                    {tc({ en: "Done", hi: "पूरा", bn: "সম্পন্ন", ta: "முடிந்தது", te: "పూర్తైంది", mr: "झाले", pa: "ਹੋ ਗਿਆ", or: "ହୋଇଛି" })}
                  </Button>
            )}
            {canManage && !isChain && (
              <Button size="sm" variant="ghost" onClick={onSkip}>
                {tc({ en: "Skip", hi: "छोड़ें", bn: "এড়িয়ে যান", ta: "தவிர்", te: "దాటవేయండి", mr: "वगळा", pa: "ਛੱਡੋ", or: "ଛାଡ଼ନ୍ତୁ" })}
              </Button>
            )}
            {isChain && task.chain_id && (
              <Button size="sm" variant="ghost" onClick={onViewChain}>
                {tc({ en: "Details", hi: "विवरण", bn: "বিস্তারিত", ta: "விவரங்கள்", te: "వివరాలు", mr: "तपशील", pa: "ਵੇਰਵੇ", or: "ବିବରଣ" })}
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
        <SectionLabel label={tc({ en: "Attention Needed", hi: "ध्यान चाहिए", bn: "মনোযোগ প্রয়োজন", ta: "கவனம் தேவை", te: "శ్రద్ధ అవసరం", mr: "लक्ष द्यावे", pa: "ਧਿਆਨ ਦਿਓ", or: "ଧ୍ୟାନ ଦରକାର" })} color={T.orange} />
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
                {tc({ en: "Follow-up chain", hi: "फ़ॉलो-अप चेन", bn: "ফলো-আপ চেইন", ta: "தொடர் சங்கிலி", te: "ఫాలో-అప్ చైన్", mr: "पाठपुरावा साखळी", pa: "ਫ਼ੌਲੋ-ਅੱਪ ਚੇਨ", or: "ଫଲୋ-ଅପ ଚେନ" })}
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
                {tc({ en: "Open Incident", hi: "खुली घटना", bn: "খোলা ঘটনা", ta: "திறந்த சம்பவம்", te: "తెరిచిన సంఘటన", mr: "उघडी घटना", pa: "ਖੁੱਲ੍ਹੀ ਘਟਨਾ", or: "ଖୋଲା ଘଟଣା" })}
                {" · "}{inc.severity}
              </span>
            </div>
            <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.4 }}>
              {(inc.description || "").slice(0, 140)}{(inc.description || "").length > 140 ? "…" : ""}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              {inc.batch_day != null && (
                <div style={{ fontSize: 12, color: T.inkSoft }}>
                  {tc({ en: `Day ${inc.batch_day}`, hi: `दिन ${inc.batch_day}`, bn: `দিন ${inc.batch_day}`, ta: `நாள் ${inc.batch_day}`, te: `రోజు ${inc.batch_day}`, mr: `दिवस ${inc.batch_day}`, pa: `ਦਿਨ ${inc.batch_day}`, or: `ଦିନ ${inc.batch_day}` })}
                </div>
              )}
              {hasGuidance && (
                <button onClick={() => onViewGuidance(inc)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0,
                    fontSize: 12, fontWeight: 600, color: T.primary, fontFamily: T.body,
                    display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                  <Icon name="BookOpen" size={12} color={T.primary} />
                  {tc({ en: "View guidance", hi: "मार्गदर्शन देखें", bn: "নির্দেশিকা দেখুন", ta: "வழிகாட்டுதலை காண்", te: "మార్గదర్శకం చూడండి", mr: "मार्गदर्शन पहा", pa: "ਮਾਰਗਦਰਸ਼ਨ ਦੇਖੋ", or: "ମାର୍ଗଦର୍ଶନ ଦେଖନ୍ତୁ" })}
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
        <SectionLabel label={tc({ en: "Upcoming (7 days)", hi: "आगामी (7 दिन)", bn: "আসন্ন (৭ দিন)", ta: "வருகின்றவை (7 நாட்கள்)", te: "రాబోయే (7 రోజులు)", mr: "येणारे (7 दिवस)", pa: "ਆਉਣ ਵਾਲੇ (7 ਦਿਨ)", or: "ଆସନ୍ତା (7 ଦିନ)" })} />
        {tasks.length > 3 && (
          <button onClick={() => setExpanded(!expanded)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.primary, padding: 0 }}>
            {expanded
              ? tc({ en: "Less", hi: "कम", bn: "কম", ta: "குறைவாக", te: "తక్కువ", mr: "कमी", pa: "ਘੱਟ", or: "କମ" })
              : tc({ en: `+${tasks.length - 3} more`, hi: `+${tasks.length - 3} और`, bn: `+${tasks.length - 3} আরও`, ta: `+${tasks.length - 3} மேலும்`, te: `+${tasks.length - 3} ఇంకా`, mr: `+${tasks.length - 3} अधिक`, pa: `+${tasks.length - 3} ਹੋਰ`, or: `+${tasks.length - 3} ଅଧିକ` })}
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
          ? tc({ en: "Completed today", hi: "आज पूरे", bn: "আজ সম্পন্ন", ta: "இன்று முடிந்தவை", te: "ఈరోజు పూర్తయింది", mr: "आज पूर्ण झाले", pa: "ਅੱਜ ਪੂਰੇ", or: "ଆଜି ସମ୍ପୂର୍ଣ" })
          : tc({ en: `${tasks.length} completed today`, hi: `${tasks.length} आज पूरे`, bn: `${tasks.length} আজ সম্পন্ন`, ta: `${tasks.length} இன்று முடிந்தவை`, te: `${tasks.length} ఈరోజు పూర్తయింది`, mr: `${tasks.length} आज पूर्ण`, pa: `${tasks.length} ਅੱਜ ਪੂਰੇ`, or: `${tasks.length} ଆଜି ସମ୍ପୂର୍ଣ` })}
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
    ? tc({ en: "Urgent", hi: "अत्यावश्यक", bn: "জরুরি", ta: "அவசரம்", te: "అత్యవసరం", mr: "अत्यंत तातडी", pa: "ਬਹੁਤ ਜ਼ਰੂਰੀ", or: "ଜରୁରୀ" })
    : incident.severity === "high"
      ? tc({ en: "High", hi: "गंभीर", bn: "গুরুতর", ta: "அதிக", te: "అధిక", mr: "उच्च", pa: "ਉੱਚ", or: "ଉଚ୍ଚ" })
      : tc({ en: "Normal", hi: "सामान्य", bn: "সাধারণ", ta: "சாதாரண", te: "సాధారణ", mr: "सामान्य", pa: "ਸਾਧਾਰਨ", or: "ସାଧାରଣ" });

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
              ? ` · ${tc({ en: `Day ${incident.batch_day}`, hi: `दिन ${incident.batch_day}`, bn: `দিন ${incident.batch_day}`, ta: `நாள் ${incident.batch_day}`, te: `రోజు ${incident.batch_day}`, mr: `दिवस ${incident.batch_day}`, pa: `ਦਿਨ ${incident.batch_day}`, or: `ଦିନ ${incident.batch_day}` })}`
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
              {tc({ en: "Follow-up chain created", hi: "फ़ॉलो-अप चेन बनाई गई", bn: "ফলো-আপ চেইন তৈরি হয়েছে", ta: "தொடர் சங்கிலி உருவானது", te: "ఫాలో-అప్ చైన్ సృష్టించబడింది", mr: "पाठपुरावा साखळी तयार झाली", pa: "ਫ਼ੌਲੋ-ਅੱਪ ਚੇਨ ਬਣੀ", or: "ଫଲୋ-ଅପ ଚେନ ତିଆରି ହୋଇଛି" })}
            </div>
            <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
              {tc({ en: "Tap to view tasks and track progress", hi: "कार्य देखने और प्रगति ट्रैक करने के लिए टैप करें",
                    bn: "কাজ দেখতে এবং অগ্রগতি ট্র্যাক করতে ট্যাপ করুন",
                    ta: "பணிகளை காண மற்றும் முன்னேற்றத்தை கண்காணிக்க தட்டவும்",
                    te: "పనులు చూడటానికి మరియు పురోగతిని ట్రాక్ చేయడానికి నొక్కండి",
                    mr: "कार्ये पाहण्यासाठी आणि प्रगती ट्रॅक करण्यासाठी टॅप करा",
                    pa: "ਕੰਮ ਦੇਖਣ ਅਤੇ ਤਰੱਕੀ ਟਰੈਕ ਕਰਨ ਲਈ ਟੈਪ ਕਰੋ",
                    or: "କାର୍ଯ୍ୟ ଦେଖିବା ଏବଂ ଅଗ୍ରଗତି ଟ୍ରାକ କରିବା ପାଇଁ ଟ୍ୟାପ୍ କରନ୍ତୁ" })}
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
        <ResponseBlock title={tc({ en: "Check these now",   hi: "अभी जाँचें",        bn: "এখনই পরীক্ষা করুন", ta: "இப்போது இவற்றை சரிபார்க்கவும்", te: "వీటిని ఇప్పుడు తనిఖీ చేయండి", mr: "आत्ता हे तपासा", pa: "ਹੁਣੇ ਜਾਂਚੋ", or: "ଏବେ ଏଗୁଡ଼ିକ ଯାଞ୍ଚ କରନ୍ତୁ" })}
          items={response.checks} icon="Search" />
      )}
      {response.actions?.length > 0 && (
        <ResponseBlock title={tc({ en: "Take these actions", hi: "ये कदम उठाएँ",     bn: "এই পদক্ষেপ নিন", ta: "இந்த நடவடிக்கைகளை எடுக்கவும்", te: "ఈ చర్యలు తీసుకోండి", mr: "या कृती करा", pa: "ਇਹ ਕਾਰਵਾਈਆਂ ਕਰੋ", or: "ଏହି ପଦକ୍ଷେପ ନିଅନ୍ତୁ" })}
          items={response.actions} icon="Zap" color={T.primary} />
      )}
      {response.explanations?.length > 0 && (
        <ResponseBlock title={tc({ en: "Why this happens",  hi: "ऐसा क्यों होता है", bn: "এটি কেন হয়", ta: "இது ஏன் நடக்கிறது", te: "ఇది ఎందుకు జరుగుతుంది", mr: "हे का होते", pa: "ਅਜਿਹਾ ਕਿਉਂ ਹੁੰਦਾ ਹੈ", or: "ଏହା କାହିଁକି ହୁଏ" })}
          items={response.explanations} icon="Info" />
      )}
      {response.what_to_record && (
        <div style={{ fontSize: 13, color: T.ink, background: T.surface2,
          padding: "10px 12px", borderRadius: T.rMd, lineHeight: 1.5 }}>
          <strong>{tc({ en: "Record: ", hi: "दर्ज करें: ", bn: "রেকর্ড করুন: ", ta: "ரெகார்ட் செய்யுங்கள்: ", te: "రికార్డ్ చేయండి: ", mr: "नोंद करा: ", pa: "ਦਰਜ ਕਰੋ: ", or: "ରେକର୍ଡ କରନ୍ତୁ: " })}</strong>
          {response.what_to_record}
        </div>
      )}
      {response.escalate_if && (
        <div style={{ fontSize: 12.5, color: T.red, background: T.surface2,
          padding: "8px 12px", borderRadius: T.rMd, lineHeight: 1.5 }}>
          <strong>{tc({ en: "Escalate if: ", hi: "जब विशेषज्ञ को बुलाएँ: ", bn: "বিশেষজ্ঞ ডাকুন যদি: ", ta: "நிபுணரை அழை, இதனால்: ", te: "ఎస్కలేట్ చేయండి, ఇది ఉంటే: ", mr: "तज्ञ बोलवा, जर: ", pa: "ਮਾਹਰ ਨੂੰ ਬੁਲਾਓ, ਜੇ: ", or: "ବିଶେଷଜ୍ଞ ଡାକନ୍ତୁ, ଯଦି: " })}</strong>
          {response.escalate_if}
        </div>
      )}
      <Button full onClick={onClose}>
        {tc({ en: "Got it, I'll act on this", hi: "समझ गया, कदम उठाऊँगा", bn: "বুঝলাম, পদক্ষেপ নেব", ta: "புரிந்தது, நடவடிக்கை எடுக்கிறேன்", te: "అర్థమైంది, చర్య తీసుకుంటాను", mr: "समजले, उपाययोजना करतो", pa: "ਸਮਝ ਗਿਆ, ਕਦਮ ਚੁੱਕਾਂਗਾ", or: "ବୁଝିଲି, ପଦକ୍ଷେପ ନେବି" })}
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

/* ── Batch Operating Plan components ─────────────────────────────────────── */

function DailyBriefingCard({ phase, batchDay, date, tc, refreshing, onRefresh }) {
  return (
    <Card style={{ background: T.surface2, borderRadius: T.rMd, padding: 0, overflow: "hidden" }}>
      {/* Header row */}
      <div style={{ padding: "12px 14px 8px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.primary, textTransform: "uppercase",
            letterSpacing: "0.05em", marginBottom: 2 }}>
            {tc(phase.label)}
          </div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.4 }}>
            {tc(phase.focus)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
          <button onClick={onRefresh} disabled={refreshing} aria-label="Refresh"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4,
              color: T.primary, opacity: refreshing ? 0.4 : 1, lineHeight: 0 }}>
            <Icon name="RefreshCw" size={16} />
          </button>
          <span style={{ fontSize: 11.5, color: T.inkFaint }}>
            {tc({ en: `Day ${batchDay ?? "—"}`, hi: `दिन ${batchDay ?? "—"}`, bn: `দিন ${batchDay ?? "—"}`, ta: `நாள் ${batchDay ?? "—"}`, te: `రోజు ${batchDay ?? "—"}`, mr: `दिवस ${batchDay ?? "—"}`, pa: `ਦਿਨ ${batchDay ?? "—"}`, or: `ଦିନ ${batchDay ?? "—"}` })}
            {date ? ` · ${date}` : ""}
          </span>
        </div>
      </div>
      {/* Milestone strip */}
      <MilestoneStrip batchDay={batchDay ?? 0} tc={tc} />
    </Card>
  );
}

function MilestoneStrip({ batchDay, tc }) {
  return (
    <div style={{ display: "flex", overflowX: "auto", gap: 0, padding: "0 14px 10px",
      scrollbarWidth: "none" }}>
      {LIFECYCLE_MILESTONES.map((m, i) => {
        const isPast    = batchDay > m.day;
        const isCurrent = batchDay === m.day;
        const color     = isCurrent ? T.primary : isPast ? T.inkFaint : T.inkSoft;
        return (
          <div key={m.day} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {i > 0 && (
              <div style={{ width: 20, height: 1, background: isPast ? T.primary : T.lineSoft,
                opacity: isPast ? 0.5 : 0.3 }} />
            )}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "0 4px" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%",
                background: isCurrent ? T.primary : isPast ? T.surface2 : T.surface2,
                border: `1.5px solid ${isCurrent ? T.primary : isPast ? T.inkFaint : T.lineSoft}`,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={m.icon} size={13} color={color} />
              </div>
              <span style={{ fontSize: 10, color, whiteSpace: "nowrap", fontWeight: isCurrent ? 700 : 400 }}>
                {tc(m.label)}
              </span>
              <span style={{ fontSize: 9.5, color: T.inkFaint }}>
                {tc({ en: `d${m.day}`, hi: `दि${m.day}`, bn: `দি${m.day}`, ta: `நா${m.day}`, te: `రో${m.day}`, mr: `दि${m.day}`, pa: `ਦਿ${m.day}`, or: `ଦ${m.day}` })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CautionsCard({ cautions, tc }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? cautions : cautions.slice(0, 2);
  return (
    <Card pad={0} style={{ borderLeft: `3px solid ${T.orange}` }}>
      <div style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="AlertCircle" size={14} color={T.orange} />
            <SectionLabel label={tc({ en: "Cautions for today", hi: "आज की सावधानियाँ", bn: "আজকের সতর্কতা", ta: "இன்றைய எச்சரிக்கைகள்", te: "ఈరోజు జాగ్రత్తలు", mr: "आजच्या सावधगिरी", pa: "ਅੱਜ ਦੀਆਂ ਸਾਵਧਾਨੀਆਂ", or: "ଆଜିର ସତର୍କତା" })} color={T.orange} />
          </div>
          {cautions.length > 2 && (
            <button onClick={() => setExpanded(v => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12,
                color: T.primary, padding: 0, fontFamily: T.body }}>
              {expanded
                ? tc({ en: "Less", hi: "कम", bn: "কম", ta: "குறைவாக", te: "తక్కువ", mr: "कमी", pa: "ਘੱਟ", or: "କମ" })
                : tc({ en: `+${cautions.length - 2} more`, hi: `+${cautions.length - 2} और`, bn: `+${cautions.length - 2} আরও`, ta: `+${cautions.length - 2} மேலும்`, te: `+${cautions.length - 2} ఇంకా`, mr: `+${cautions.length - 2} अधिक`, pa: `+${cautions.length - 2} ਹੋਰ`, or: `+${cautions.length - 2} ଅଧିକ` })}
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {shown.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ color: T.orange, fontSize: 13, flexShrink: 0, marginTop: 1 }}>•</span>
              <span style={{ fontSize: 13, color: T.ink, lineHeight: 1.45 }}>{tc(c)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function WatchForCard({ items, tc, onReport }) {
  return (
    <Card pad={0} style={{ borderLeft: `3px solid ${T.red}` }}>
      <div style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Icon name="Eye" size={14} color={T.red} />
          <SectionLabel label={tc({ en: "Watch for", hi: "ध्यान रखें", bn: "লক্ষ্য রাখুন", ta: "கவனிக்கவும்", te: "చూడండి", mr: "लक्ष ठेवा", pa: "ਧਿਆਨ ਦਿਓ", or: "ଧ୍ୟାନ ଦିଅ" })} color={T.red} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flex: 1 }}>
                <span style={{ color: T.red, fontSize: 13, flexShrink: 0, marginTop: 1 }}>⚑</span>
                <span style={{ fontSize: 13, color: T.ink, lineHeight: 1.45 }}>{tc(item)}</span>
              </div>
              {item.incidentHint && (
                <button onClick={() => onReport(item.incidentHint)}
                  style={{ background: "none", border: `1px solid ${T.red}`, borderRadius: T.rMd,
                    cursor: "pointer", padding: "3px 8px", fontSize: 11.5, fontWeight: 600,
                    color: T.red, fontFamily: T.body, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {tc({ en: "Report", hi: "रिपोर्ट", bn: "রিপোর্ট", ta: "தெரிவி", te: "నివేదించండి", mr: "नोंदवा", pa: "ਦੱਸੋ", or: "ରିପୋର୍ଟ" })}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function TomorrowPreviewCard({ batchDay, poultryType, tc }) {
  const tomorrowDay = batchDay + 1;
  const tasks = previewTasksForDay(tomorrowDay, poultryType || "broiler");
  if (tasks.length === 0) return null;
  const CATEGORY_COLOR = { milestone: T.primary, feed: T.orange, weight: T.primary, biosecurity: T.inkSoft, daily_ops: T.inkFaint };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="Sunrise" size={14} color={T.inkSoft} />
        <SectionLabel label={tc({ en: `Tomorrow (Day ${tomorrowDay})`, hi: `कल (दिन ${tomorrowDay})`, bn: `আগামীকাল (দিন ${tomorrowDay})`, ta: `நாளை (நாள் ${tomorrowDay})`, te: `రేపు (రోజు ${tomorrowDay})`, mr: `उद्या (दिवस ${tomorrowDay})`, pa: `ਕੱਲ੍ਹ (ਦਿਨ ${tomorrowDay})`, or: `ଆସିଲ (ଦିନ ${tomorrowDay})` })} />
      </div>
      {tasks.map(t => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8,
          padding: "7px 12px", background: T.surface2, borderRadius: T.rMd }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%",
            background: CATEGORY_COLOR[t.category] || T.inkFaint, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: T.inkSoft, flex: 1 }}>{tc(t.title)}</span>
        </div>
      ))}
    </div>
  );
}

function SevenDayTimeline({ batchDay, poultryType, tc }) {
  const [expanded, setExpanded] = useState(false);
  const pType = poultryType || "broiler";
  const days = Array.from({ length: 7 }, (_, i) => batchDay + 1 + i);
  const rows = days.map(d => ({ day: d, tasks: previewTasksForDay(d, pType) }));
  const CATEGORY_ICON = { milestone: "Star", feed: "Wheat", weight: "Scale", biosecurity: "Shield", daily_ops: "Activity" };
  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 0",
          fontSize: 13, color: T.primary, textAlign: "left", fontFamily: T.body,
          display: "flex", alignItems: "center", gap: 5 }}>
        <Icon name="CalendarDays" size={14} color={T.primary} />
        {tc({ en: "Show 7-day plan", hi: "7-दिन योजना देखें", bn: "৭-দিনের পরিকল্পনা দেখুন", ta: "7 நாள் திட்டம் காட்டு", te: "7 రోజుల ప్లాన్ చూపండి", mr: "7-दिवस योजना पहा", pa: "7-ਦਿਨ ਯੋਜਨਾ ਦਿਖਾਓ", or: "7-ଦିନ ଯୋଜନା ଦେଖନ୍ତୁ" })}
      </button>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="CalendarDays" size={14} color={T.inkSoft} />
          <SectionLabel label={tc({ en: "Next 7 days", hi: "अगले 7 दिन", bn: "আগামী ৭ দিন", ta: "அடுத்த 7 நாட்கள்", te: "తర్వాత 7 రోజులు", mr: "पुढील 7 दिवस", pa: "ਅਗਲੇ 7 ਦਿਨ", or: "ଆଗାମୀ 7 ଦିନ" })} />
        </div>
        <button onClick={() => setExpanded(false)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12,
            color: T.primary, padding: 0, fontFamily: T.body }}>
          {tc({ en: "Hide", hi: "छिपाएँ", bn: "লুকান", ta: "மறை", te: "దాచు", mr: "लपवा", pa: "ਲੁਕਾਓ", or: "ଲୁଚାନ୍ତୁ" })}
        </button>
      </div>
      {rows.map(({ day, tasks }) => (
        <div key={day} style={{ display: "flex", gap: 10, padding: "8px 12px",
          background: T.surface2, borderRadius: T.rMd, alignItems: "flex-start" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, minWidth: 36, flexShrink: 0, paddingTop: 2 }}>
            {tc({ en: `D${day}`, hi: `दि${day}`, bn: `দি${day}`, ta: `நா${day}`, te: `రో${day}`, mr: `दि${day}`, pa: `ਦਿ${day}`, or: `ଦ${day}` })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1 }}>
            {tasks.length === 0
              ? <span style={{ fontSize: 12, color: T.inkFaint }}>—</span>
              : tasks.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 4,
                  padding: "2px 7px", background: T.surface2, borderRadius: 999,
                  border: `1px solid ${T.lineSoft}` }}>
                  <Icon name={CATEGORY_ICON[t.category] || "Circle"} size={10} color={T.inkFaint} />
                  <span style={{ fontSize: 11.5, color: T.inkSoft }}>{tc(t.title)}</span>
                </div>
              ))
            }
          </div>
        </div>
      ))}
    </div>
  );
}
