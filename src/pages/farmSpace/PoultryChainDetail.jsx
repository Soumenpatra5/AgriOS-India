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
  { label: tc({ en: "Improved",  hi: "सुधार हुआ",    bn: "উন্নতি হয়েছে",  ta: "மேம்பட்டது",           te: "మెరుగుపడింది",         mr: "सुधारणा झाली",   pa: "ਸੁਧਾਰ ਹੋਇਆ",         or: "ସୁଧାର" }),  value: "improved" },
  { label: tc({ en: "Same",      hi: "वैसा ही",       bn: "একই আছে",        ta: "அதே நிலையில்",         te: "అదే విధంగా",           mr: "तसेच आहे",        pa: "ਉਹੀ ਹੈ",            or: "ସେମିତି" }),      value: "same" },
  { label: tc({ en: "Worse",     hi: "खराब हुआ",      bn: "আরও খারাপ",      ta: "மோசமானது",             te: "మరింత అధ్వాన్నంగా",   mr: "बिघडले",          pa: "ਹੋਰ ਖਰਾਬ",          or: "ଖରାପ" }),     value: "worse" },
  { label: tc({ en: "Recovered", hi: "ठीक हो गए",    bn: "সুস্থ হয়েছে",  ta: "குணமடைந்தது",          te: "కోలుకుంది",            mr: "बरे झाले",        pa: "ਠੀਕ ਹੋ ਗਏ",         or: "ସୁସ୍ଥ ହେଲେ" }), value: "recovered" },
  { label: tc({ en: "Resolved",  hi: "समाधान हुआ",   bn: "সমাধান হয়েছে", ta: "தீர்க்கப்பட்டது",      te: "పరిష్కరించబడింది",     mr: "समाधान झाले",     pa: "ਸਮੱਸਿਆ ਹੱਲ ਹੋਈ",    or: "ସମାଧାନ" }), value: "resolved" },
  { label: tc({ en: "Deceased",  hi: "मृत्यु हो गई", bn: "মৃত্যু হয়েছে", ta: "மரணமடைந்தது",          te: "మరణించింది",           mr: "मृत्यू झाला",     pa: "ਮੌਤ ਹੋ ਗਈ",         or: "ମୃତ୍ୟୁ" }), value: "deceased" },
];

const ACTION_TAKEN_OPTIONS = (tc) => [
  { label: tc({ en: "No action needed",  hi: "कोई कदम नहीं",        bn: "কোনো পদক্ষেপ নেই",    ta: "நடவடிக்கை தேவையில்லை",                    te: "చర్య అవసరం లేదు",              mr: "कोणतीही कारवाई नाही",      pa: "ਕੋਈ ਕਾਰਵਾਈ ਦੀ ਲੋੜ ਨਹੀਂ",   or: "କୌଣସି ପଦକ୍ଷେପ ନାହି" }),     value: "no_action" },
  { label: tc({ en: "Repeat treatment",  hi: "उपचार दोहराएँ",       bn: "চিকিৎসা পুনরাবৃত্তি", ta: "சிகிச்சை மீண்டும் செய்",                 te: "చికిత్స పునరావృతం చేయండి",   mr: "उपचार पुन्हा करा",          pa: "ਇਲਾਜ ਦੁਹਰਾਓ",               or: "ଉପଜାର ପୁନରାବୃତ୍ତି" }), value: "repeat_treatment" },
  { label: tc({ en: "New treatment",     hi: "नया उपचार",            bn: "নতুন চিকিৎসা",         ta: "புதிய சிகிச்சை",                         te: "కొత్త చికిత్స",               mr: "नवीन उपचार",                pa: "ਨਵਾਂ ਇਲਾਜ",                 or: "ନୂଆ ଉପଜାର" }),     value: "new_treatment" },
  { label: tc({ en: "Issue resolved",    hi: "समस्या हल हुई",       bn: "সমস্যা সমাধান",        ta: "சிக்கல் தீர்ந்தது",                      te: "సమస్య పరిష్కారమైంది",        mr: "समस्या सुटली",              pa: "ਸਮੱਸਿਆ ਹੱਲ ਹੋਈ",            or: "ସମସ୍ୟା ସମାଧାନ" }), value: "resolved" },
  { label: tc({ en: "Escalated to vet", hi: "पशु चिकित्सक बुलाया", bn: "পশু চিকিৎসকে পাঠানো", ta: "கால்நடை மருத்துவருக்கு அனுப்பப்பட்டது", te: "పశువైద్యుడికి పంపబడింది",    mr: "पशुवैद्यकाकडे पाठवले",     pa: "ਪਸ਼ੂ ਡਾਕਟਰ ਕੋਲ ਭੇਜਿਆ",      or: "ପଶୁଚିକିତ୍ସକକୁ ପଠାଇଲା" }),    value: "escalated" },
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
      setError(err.message || tc({ en: "Could not load chain", hi: "चेन लोड नहीं हुई", bn: "চেইন লোড হয়নি", ta: "சங்கிலி ஏற்றமுடியவில்லை", te: "చైన్ లోడ్ కాలేదు", mr: "साखळी लोड झाली नाही", pa: "ਚੇਨ ਲੋਡ ਨਹੀਂ ਹੋਈ", or: "ଚେନ୍ ଲୋଡ ହେଲାନି" }));
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
        if (!cancelled) setError(tc({ en: "Could not load space", hi: "स्पेस लोड नहीं हुई", bn: "স্পেস লোড হয়নি", ta: "இடம் ஏற்றமுடியவில்லை", te: "స్పేస్ లోడ్ కాలేదు", mr: "स्पेस लोड झाला नाही", pa: "ਸਪੇਸ ਲੋਡ ਨਹੀਂ ਹੋਈ", or: "ସ୍ପେସ୍ ଲୋଡ ହେଲାନି" }));
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
      toast(tc({ en: "Outcome recorded", hi: "परिणाम दर्ज हुआ", bn: "ফলাফল রেকর্ড হয়েছে", ta: "முடிவு பதிவாயிற்று", te: "ఫలితం నమోదైంది", mr: "निकाल नोंदवला", pa: "ਨਤੀਜਾ ਦਰਜ ਹੋਇਆ", or: "ଫଳାଫଳ ନଥିଭୁକ୍ତ" }), "success");
      load(space.id);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ", ta: "தோல்வி", te: "విఫలమైంది", mr: "अयशस्वी", pa: "ਅਸਫਲ", or: "ବିଫଳ" }), "error");
    } finally { setRecording(false); }
  };

  const doCancel = async () => {
    if (!space || cancelling) return;
    setCancelling(true);
    try {
      await poultryApi.cancelChain(space.id, chainId, null);
      setCancelOpen(false);
      toast(tc({ en: "Chain cancelled", hi: "चेन रद्द की गई", bn: "চেইন বাতিল হয়েছে", ta: "சங்கிலி ரத்துசெய்யப்பட்டது", te: "చైన్ రద్దు చేయబడింది", mr: "साखळी रद्द झाली", pa: "ਚੇਨ ਰੱਦ ਕੀਤੀ ਗਈ", or: "ଚେନ୍ ରଦ୍ଦ" }), "success");
      pop();
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ", ta: "தோல்வி", te: "విఫలమైంది", mr: "अयशस्वी", pa: "ਅਸਫਲ", or: "ବିଫଳ" }), "error");
    } finally { setCancelling(false); }
  };

  /* ── render states ──────────────────────────────────────────────────── */

  if (loading) return (
    <div>
      <AppBar title={tc({ en: "Follow-up Chain", hi: "फ़ॉलो-अप चेन", bn: "ফলো-আপ চেইন", ta: "பின்தொடர் சங்கிலி", te: "ఫాలో-అప్ చైన్", mr: "फॉलो-अप साखळी", pa: "ਫਾਲੋ-ਅੱਪ ਚੇਨ", or: "ଫଲୋ-ଅପ୍ ଚେନ୍" })} onBack={pop} />
      <div style={{ padding: 40, display: "grid", placeItems: "center" }}><Spinner /></div>
    </div>
  );
  if (error || !data) return (
    <div>
      <AppBar title={tc({ en: "Follow-up Chain", hi: "फ़ॉलो-अप चेन", bn: "ফলো-আপ চেইন", ta: "பின்தொடர் சங்கிலி", te: "ఫాలో-అప్ చైన్", mr: "फॉलो-अप साखळी", pa: "ਫਾਲੋ-ਅੱਪ ਚੇਨ", or: "ଫଲୋ-ଅପ୍ ଚେନ୍" })} onBack={pop} />
      <ErrorState body={error || tc({ en: "No data", hi: "कोई डेटा नहीं", bn: "কোনো ডেটা নেই", ta: "தரவு இல்லை", te: "డేటా లేదు", mr: "कोणताही डेटा नाही", pa: "ਕੋਈ ਡੇਟਾ ਨਹੀਂ", or: "କୌଣସି ଡେଟା ନାହି" })}
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
      <AppBar title={tc({ en: "Follow-up Chain", hi: "फ़ॉलो-अप चेन", bn: "ফলো-আপ চেইন", ta: "பின்தொடர் சங்கிலி", te: "ఫాలో-అప్ చైన్", mr: "फॉलो-अप साखळी", pa: "ਫਾਲੋ-ਅੱਪ ਚੇਨ", or: "ଫଲୋ-ଅପ୍ ଚେନ୍" })} onBack={pop} />

      {/* Breadcrumb: Poultry → Batch → Workflow → Follow-up Chain */}
      <div style={{
        padding: "7px 16px", display: "flex", alignItems: "center", gap: 4,
        flexWrap: "wrap", background: T.surface, borderBottom: `1px solid ${T.lineSoft}`,
        fontSize: 12, color: T.inkFaint,
      }}>
        <span>{tc({ en: "Poultry", hi: "पोल्ट्री", bn: "পোলট্রি", ta: "கோழிப்பண்ணை", te: "పోల్ట్రీ", mr: "कुक्कुटपालन", pa: "ਪੋਲਟਰੀ", or: "କୁକ୍କୁଟ" })}</span>
        <Icon name="ChevronRight" size={12} color={T.inkFaint} />
        <span>{batch ? batch.name : tc({ en: "Batch", hi: "बैच", bn: "ব্যাচ", ta: "தொகுப்பு", te: "బ్యాచ్", mr: "बॅच", pa: "ਬੈਚ", or: "ବ୍ୟାଚ୍" })}</span>
        <Icon name="ChevronRight" size={12} color={T.inkFaint} />
        <span>{tc({ en: "Workflow", hi: "वर्कफ़्लो", bn: "ওয়ার্কফ্লো", ta: "பணிப்பாய்வு", te: "వర్క్‌ఫ్లో", mr: "कार्यप्रवाह", pa: "ਵਰਕਫਲੋ", or: "କାର୍ୟପ୍ରଵାହ" })}</span>
        <Icon name="ChevronRight" size={12} color={T.inkFaint} />
        <span style={{ color: T.ink, fontWeight: 600 }}>
          {tc({ en: "Follow-up Chain", hi: "फ़ॉलो-अप चेन", bn: "ফলো-আপ চেইন", ta: "பின்தொடர் சங்கிலி", te: "ఫాలో-అప్ చైన్", mr: "फॉलो-अप साखळी", pa: "ਫਾਲੋ-ਅੱਪ ਚੇਨ", or: "ଫଲୋ-ଅପ୍ ଚେନ୍" })}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 16px 32px" }}>

        {/* Chain header */}
        <Card style={{ borderLeft: `4px solid ${accent(sevAccent).fg}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                <Badge label={tc({ en: chain.severity || "—", hi: chain.severity || "—", bn: chain.severity || "—", ta: chain.severity || "—", te: chain.severity || "—", mr: chain.severity || "—", pa: chain.severity || "—", or: chain.severity || "—" })} a={sevAccent} />
                <Badge label={tc({ en: chain.status   || "—", hi: chain.status   || "—", bn: chain.status   || "—", ta: chain.status   || "—", te: chain.status   || "—", mr: chain.status   || "—", pa: chain.status   || "—", or: chain.status   || "—" })} a={stAccent} />
                {chain.chain_type && (
                  <span style={{ fontSize: 11.5, color: T.inkSoft }}>{chain.chain_type}</span>
                )}
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>
                {chain.title || tc({ en: "Follow-up chain", hi: "फ़ॉलो-अप चेन", bn: "ফলো-আপ চেইন", ta: "பின்தொடர் சங்கிலி", te: "ఫాలో-అప్ చైన్", mr: "फॉलो-अप साखळी", pa: "ਫਾਲੋ-ਅੱਪ ਚੇਨ", or: "ଫଲୋ-ଅପ୍ ଚେନ୍" })}
              </div>
              {chain.source_type && (
                <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 4, display: "flex", alignItems: "flex-start", gap: 4 }}>
                  <Icon name="ArrowUpRight" size={12} color={T.inkFaint} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>
                    {sourceEvent?.title
                      ? sourceEvent.title
                      : tc({ en: `Source: ${chain.source_type}`, hi: `स्रोत: ${chain.source_type}`, bn: `উৎস: ${chain.source_type}`, ta: `மூலம்: ${chain.source_type}`, te: `మూలం: ${chain.source_type}`, mr: `स्रोत: ${chain.source_type}`, pa: `ਸਰੋਤ: ${chain.source_type}`, or: `ଉତ୍ସ: ${chain.source_type}` })}
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
                    <span>· {tc({ en: `Day ${chain.batch_day}`, hi: `दिन ${chain.batch_day}`, bn: `দিন ${chain.batch_day}`, ta: `நாள் ${chain.batch_day}`, te: `రోజు ${chain.batch_day}`, mr: `दिवस ${chain.batch_day}`, pa: `ਦਿਨ ${chain.batch_day}`, or: `ଦିନ ${chain.batch_day}` })}</span>
                  )}
                </div>
              )}
              {chain.triggered_at && (
                <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 3 }}>
                  {tc({ en: "Triggered", hi: "शुरू हुआ", bn: "শুরু হয়েছে", ta: "தூண்டப்பட்டது", te: "ట్రిగ్గర్ అయింది", mr: "सुरू झाले", pa: "ਸ਼ੁਰੂ ਹੋਇਆ", or: "ସକ୍ରିୟ ହେଲା" })}
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
            <SectionHead label={tc({ en: "Follow-up Tasks", hi: "फ़ॉलो-अप कार्य", bn: "ফলো-আপ কাজ", ta: "பின்தொடர் பணிகள்", te: "ఫాలో-అప్ పనులు", mr: "फॉलो-अप कार्ये", pa: "ਫਾਲੋ-ਅੱਪ ਕੰਮ", or: "ଫଲୋ-ଅପ୍ କାର୍ୟ" })} />
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
            <SectionHead label={tc({ en: "Completed", hi: "पूर्ण", bn: "সম্পন্ন", ta: "முடிந்தது", te: "పూర్తయింది", mr: "पूर्ण", pa: "ਮੁਕੰਮਲ", or: "ସମ୍ପନ୍ନ" })} color={T.inkFaint} />
            {doneTasks.map(t => (
              <ChainTaskCard key={t.id} task={t} tc={tc} isActive={false} onRecord={null} />
            ))}
          </div>
        )}

        {pendingTasks.length === 0 && doneTasks.length === 0 && (
          <EmptyState icon="List"
            title={tc({ en: "No tasks in this chain", hi: "इस चेन में कोई कार्य नहीं", bn: "এই চেইনে কোনো কাজ নেই", ta: "இந்த சங்கிலியில் பணிகள் இல்லை", te: "ఈ చైన్‌లో పనులు లేవు", mr: "या साखळीत कार्ये नाहीत", pa: "ਇਸ ਚੇਨ ਵਿੱਚ ਕੋਈ ਕੰਮ ਨਹੀਂ", or: "ଏହି ଚେନ୍ର କୌଣସି କାର୍ୟ ନାହି" })} />
        )}

        {/* Outcomes timeline */}
        {outcomes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SectionHead label={tc({ en: "Outcome History", hi: "परिणाम इतिहास", bn: "ফলাফলের ইতিহাস", ta: "முடிவு வரலாறு", te: "ఫలిత చరిత్ర", mr: "निकाल इतिहास", pa: "ਨਤੀਜੇ ਦਾ ਇਤਿਹਾਸ", or: "ଫଳାଫଳ ଇତିହାସ" })} />
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
                  {tc({ en: "Chain Resolved", hi: "चेन समाधान हुई", bn: "চেইন সমাধান হয়েছে", ta: "சங்கிலி தீர்க்கப்பட்டது", te: "చైన్ పరిష్కరించబడింది", mr: "साखळी निराकरण झाली", pa: "ਚੇਨ ਹੱਲ ਹੋਈ", or: "ଚେନ୍ ସମାଧାନ" })}
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
            {tc({ en: "Cancel Chain", hi: "चेन रद्द करें", bn: "চেইন বাতিল করুন", ta: "சங்கிலியை ரத்துசெய்", te: "చైన్ రద్దు చేయండి", mr: "साखळी रद्द करा", pa: "ਚੇਨ ਰੱਦ ਕਰੋ", or: "ଚେନ୍ ରଦ୍ଦ କରନ୍ତୁ" })}
          </button>
        )}
      </div>

      {/* Record outcome sheet */}
      <BottomSheet open={!!outcomeTask} onClose={() => setOutcomeTask(null)}
        title={tc({ en: "Record Outcome", hi: "परिणाम दर्ज करें", bn: "ফলাফল রেকর্ড করুন", ta: "முடிவை பதிவு செய்", te: "ఫలితం రికార్డు చేయండి", mr: "निकाल नोंदवा", pa: "ਨਤੀਜਾ ਦਰਜ ਕਰੋ", or: "ଫଳାଫଳ ନଥିଭୁକ୍ତ କରନ୍ତୁ" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          {outcomeTask && (
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{outcomeTask.title}</div>
          )}
          <Dropdown label={tc({ en: "Outcome *", hi: "परिणाम *", bn: "ফলাফল *", ta: "முடிவு *", te: "ఫలితం *", mr: "निकाल *", pa: "ਨਤੀਜਾ *", or: "ଫଳାଫଳ *" })}
            value={outcomeValue} onChange={v => setOutcomeValue(v)} options={OUTCOME_OPTIONS(tc)} />
          {CLOSING_OUTCOMES.includes(outcomeValue) && (
            <div style={{ fontSize: 12.5, color: T.primary, background: accent("primary").bg,
              padding: "7px 10px", borderRadius: T.rMd }}>
              {tc({ en: "This outcome will resolve the chain.",
                    hi: "यह परिणाम चेन को समाधान करेगा।",
                    bn: "এই ফলাফল চেইনটি সমাধান করবে।",
                    ta: "இந்த முடிவு சங்கிலியை தீர்க்கும்.",
                    te: "ఈ ఫలితం చైన్‌ను పరిష్కరిస్తుంది.",
                    mr: "हा निकाल साखळी सोडवेल.",
                    pa: "ਇਹ ਨਤੀਜਾ ਚੇਨ ਨੂੰ ਹੱਲ ਕਰੇਗਾ.",
                    or: "ଏହି ଫଳାଫଳ ଚେନ୍ ସମାଧାନ କରିବ" })}
            </div>
          )}
          <Input label={tc({ en: "Observations", hi: "अवलोकन", bn: "পর্যবেক্ষণ", ta: "கண்காணிப்புகள்", te: "పరిశీలనలు", mr: "निरीक्षणे", pa: "ਨਿਰੀਖਣ", or: "ପର୍ୟବେକ୍ଷଣ" })}
            value={outcomeNotes} onChange={v => setOutcomeNotes(v)} />
          <Dropdown label={tc({ en: "Action taken", hi: "कदम उठाए गए", bn: "গৃহীত পদক্ষেপ", ta: "எடுத்த நடவடிக்கை", te: "తీసుకున్న చర్య", mr: "केलेली कारवाई", pa: "ਕੀਤੀ ਕਾਰਵਾਈ", or: "ଗ୍ରହଣ କରାୟା ପଦକ୍ଷେପ" })}
            value={outcomeAction} onChange={v => setOutcomeAction(v)} options={ACTION_TAKEN_OPTIONS(tc)} />
          <Button full onClick={doRecordOutcome} disabled={recording}>
            {recording
              ? tc({ en: "Recording…", hi: "दर्ज हो रहा है…", bn: "রেকর্ড হচ্ছে…", ta: "பதிவு செய்கிறது…", te: "రికార్డు అవుతోంది…", mr: "नोंदवत आहे…", pa: "ਰਿਕਾਰਡ ਹੋ ਰਿਹਾ ਹੈ…", or: "ନଥିଭୁକ୍ତ ହେଉଛି…" })
              : tc({ en: "Record Outcome", hi: "परिणाम दर्ज करें", bn: "ফলাফল রেকর্ড করুন", ta: "முடிவை பதிவு செய்", te: "ఫలితం రికార్డు చేయండి", mr: "निकाल नोंदवा", pa: "ਨਤੀਜਾ ਦਰਜ ਕਰੋ", or: "ଫଳାଫଳ ନଥିଭୁକ୍ତ କରନ୍ତୁ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Cancel confirm */}
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)}
        title={tc({ en: "Cancel Chain?", hi: "चेन रद्द करें?", bn: "চেইন বাতিল করবেন?", ta: "சங்கிலியை ரத்துசெய்யவா?", te: "చైన్ రద్దు చేయాలా?", mr: "साखळी रद्द करायची?", pa: "ਚੇਨ ਰੱਦ ਕਰਨੀ?", or: "ଚେନ୍ ରଦ୍ଦ କରନ୍ତୁQ" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5 }}>
            {tc({ en: "This will mark all pending tasks as cancelled. This cannot be undone.",
                  hi: "इससे सभी बाकी कार्य रद्द हो जाएंगे। यह वापस नहीं किया जा सकता।",
                  bn: "এটি সমস্ত মুলতুবি কাজ বাতিল করবে। এটি পূর্বাবস্থায় ফেরানো যাবে না।",
                  ta: "அனைத்து நிலுவை பணிகளும் ரத்தாகும். இதை மாற்ற முடியாது.",
                  te: "అన్ని పెండింగ్ పనులు రద్దు అవుతాయి. ఇది తిరిగి చేయడం సాధ్యం కాదు.",
                  mr: "सर्व प्रलंबित कार्ये रद्द होतील. हे पूर्ववत करता येत नाही.",
                  pa: "ਸਾਰੇ ਲੰਬਿਤ ਕੰਮ ਰੱਦ ਕੀਤੇ ਜਾਣਗੇ। ਇਸਨੂੰ ਵਾਪਸ ਨਹੀਂ ਕੀਤਾ ਜਾ ਸਕਦਾ।",
                  or: "ଚେନ୍ ରଦ୍ଦ କରନ୍ତୁWARN" })}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button full variant="outline" onClick={() => setCancelOpen(false)}>
              {tc({ en: "Keep", hi: "रखें", bn: "রাখুন", ta: "வைத்திரு", te: "ఉంచండి", mr: "ठेवा", pa: "ਰੱਖੋ", or: "ରାଖନ୍ତୁ" })}
            </Button>
            <Button full variant="danger" onClick={doCancel} disabled={cancelling}>
              {cancelling
                ? tc({ en: "Cancelling…", hi: "रद्द हो रहा है…", bn: "বাতিল হচ্ছে…", ta: "ரத்துசெய்கிறது…", te: "రద్దు అవుతోంది…", mr: "रद्द होत आहे…", pa: "ਰੱਦ ਹੋ ਰਿਹਾ ਹੈ…", or: "ରଦ୍ଦ ହେଉଛି…" })
                : tc({ en: "Yes, Cancel", hi: "हाँ, रद्द करें", bn: "হ্যাঁ, বাতিল করুন", ta: "ஆம், ரத்துசெய்", te: "అవును, రద్దు చేయండి", mr: "होय, रद्द करा", pa: "ਹਾਂ, ਰੱਦ ਕਰੋ", or: "ହଁ, ରଦ୍ଦ କରନ୍ତୁ" })}
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
              {task.batch_day != null && <span>{tc({ en: `Day ${task.batch_day}`, hi: `दिन ${task.batch_day}`, bn: `দিন ${task.batch_day}`, ta: `நாள் ${task.batch_day}`, te: `రోజు ${task.batch_day}`, mr: `दिवस ${task.batch_day}`, pa: `ਦਿਨ ${task.batch_day}`, or: `ଦିନ ${task.batch_day}` })}</span>}
              {task.status === "skipped" && task.skip_reason && <span style={{ fontStyle: "italic" }}>{task.skip_reason}</span>}
            </div>
            {isBlocked && (
              <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 3, fontStyle: "italic" }}>
                {tc({ en: "Blocked — prerequisite pending", hi: "ब्लॉक — पूर्व-कार्य बाकी", bn: "ব্লক — পূর্বশর্ত বাকি", ta: "தடைசெய்யப்பட்டது — முன்நிபந்தனை நிலுவையில்", te: "బ్లాక్ — ముందస్తు అవసరం పెండింగ్‌లో", mr: "अवरोधित — पूर्व-आवश्यकता प्रलंबित", pa: "ਬਲਾਕ — ਪੂਰਵ-ਸ਼ਰਤ ਬਾਕੀ", or: "ବ୍ଲକ — ପୂର୍ବଶର୍ତ ବାକି" })}
              </div>
            )}
          </div>
        </div>
        {isActive && !isDone && !isBlocked && onRecord && (
          <div style={{ marginTop: 10, paddingLeft: 24 }}>
            <Button size="sm" onClick={onRecord}>
              {tc({ en: "Record Outcome", hi: "परिणाम दर्ज करें", bn: "ফলাফল রেকর্ড করুন", ta: "முடிவை பதிவு செய்", te: "ఫలితం రికార్డు చేయండి", mr: "निकाल नोंदवा", pa: "ਨਤੀਜਾ ਦਰਜ ਕਰੋ", or: "ଫଳାଫଳ ନଥିଭୁକ୍ତ କରନ୍ତୁ" })}
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
              <strong>{tc({ en: "Action: ", hi: "कदम: ", bn: "পদক্ষেপ: ", ta: "நடவடிக்கை: ", te: "చర్య: ", mr: "कारवाई: ", pa: "ਕਾਰਵਾਈ: ", or: "କାର୍ୟ: " })}</strong>
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
