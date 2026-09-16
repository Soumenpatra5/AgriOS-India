import { useState, useEffect, useCallback, useRef } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet, Dialog,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { poultryApi } from "../../services/poultry/poultryApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";
import PoultryWorkflowTab from "./PoultryWorkflowTab.jsx";

const today = () => new Date().toISOString().slice(0, 10);

const BATCH_STATUS = {
  draft:          { a: "faint",   label: { en: "Draft",        hi: "ड्राफ़्ट",      bn: "ড্রাফ্ট",       ta: "வரைவு",                             te: "డ్రాఫ్ట్",             mr: "मसुदा",     pa: "ਡਰਾਫਟ",       or: "ଡ୍ରାଫ୍ଟ" } },
  active:         { a: "primary", label: { en: "Active",       hi: "सक्रिय",       bn: "সক্রিয়",        ta: "செயல்படுகிறது",                     te: "యాక్టివ్",             mr: "सक्रिय",    pa: "ਸਕਿਰਿਆ",      or: "ସକ୍ରିୟ" } },
  harvesting:     { a: "orange",  label: { en: "Harvesting",   hi: "कटाई",         bn: "কর্তন",          ta: "அறுவடை",                            te: "కోత",                  mr: "कापणी",     pa: "ਵਾਢੀ",         or: "କ୍ଷୀର" } },
  partially_sold: { a: "orange",  label: { en: "Partial sale", hi: "आंशिक बिक्री", bn: "আংশিক বিক্রয়", ta: "பகுதி விற்பனை",                     te: "పాక్షిక అమ్మకం",      mr: "अंशतः विक्री", pa: "ਅੰਸ਼ਕ ਵਿਕਰੀ", or: "ଆଂଶିକ ବିକ୍ରୟ" } },
  completed:      { a: "blue",    label: { en: "Completed",    hi: "पूर्ण",         bn: "সম্পন্ন",        ta: "முடிந்தது",                          te: "పూర్తైంది",            mr: "पूर्ण",      pa: "ਮੁਕੰਮਲ",       or: "ସମ୍ପନ୍ନ" } },
  closed:         { a: "faint",   label: { en: "Closed",       hi: "बंद",           bn: "বন্ধ",           ta: "மூடப்பட்டது",                       te: "మూసివేయబడింది",        mr: "बंद",       pa: "ਬੰਦ",          or: "ବନ୍ଦ" } },
  archived:       { a: "faint",   label: { en: "Archived",     hi: "संग्रहित",      bn: "আর্কাইভড",      ta: "காப்பகப்படுத்தப்பட்டது",            te: "ఆర్కైవ్ చేయబడింది",   mr: "संग्रहित",  pa: "ਆਰਕਾਈਵ",      or: "ଆର୍କାଇଭ" } },
};

const TRANSITION_LABEL = {
  activate:         { en: "Activate",       hi: "सक्रिय करें",    bn: "সক্রিয় করুন",    ta: "செயல்படுத்து",           te: "యాక్టివేట్ చేయండి",       mr: "सक्रिय करा",             pa: "ਸਕਿਰਿਆ ਕਰੋ",         or: "ସକ୍ରିୟ କରନ୍ତୁ" },
  start_harvesting: { en: "Start harvest",  hi: "कटाई शुरू",      bn: "কর্তন শুরু",      ta: "அறுவடை தொடங்கு",         te: "కోత ప్రారంభించండి",        mr: "कापणी सुरू करा",         pa: "ਵਾਢੀ ਸ਼ੁਰੂ ਕਰੋ",       or: "କ୍ଷୀର ଆରମ୍ଭ" },
  partially_sold:   { en: "Partial sale",   hi: "आंशिक बिक्री",   bn: "আংশিক বিক্রয়",  ta: "பகுதி விற்பனை",           te: "పాక్షిక అమ్మకం",           mr: "अंशतः विक्री",           pa: "ਅੰਸ਼ਕ ਵਿਕਰੀ",         or: "ଆଂଶିକ ବିକ୍ରୟ" },
  complete:         { en: "Mark complete",  hi: "पूरा चिह्नित",   bn: "সম্পন্ন করুন",   ta: "முடிந்தது என்று குறி",   te: "పూర్తయిందని గుర్తించండి", mr: "पूर्ण म्हणून चिन्हांकित", pa: "ਮੁਕੰਮਲ ਵਜੋਂ ਚਿੰਨ੍ਹਿਤ", or: "ସମ୍ପନ୍ନ ଚିହ୍ନିତ" },
  close:            { en: "Close batch",    hi: "बैच बंद करें",   bn: "ব্যাচ বন্ধ",     ta: "தொகுப்பை மூடு",           te: "బ్యాచ్ మూసివేయండి",        mr: "बॅच बंद करा",            pa: "ਬੈਚ ਬੰਦ ਕਰੋ",          or: "ବ୍ୟାଚ୍ ବନ୍ଦ" },
  reopen:           { en: "Reopen",         hi: "फिर खोलें",      bn: "পুনরায় খুলুন",  ta: "மீண்டும் திற",            te: "తిరిగి తెరవండి",           mr: "पुन्हा उघडा",            pa: "ਮੁੜ ਖੋਲ੍ਹੋ",            or: "ପୁନୃଖୋଲ" },
  archive:          { en: "Archive",        hi: "संग्रहित करें",  bn: "আর্কাইভ করুন",  ta: "காப்பகப்படுத்து",         te: "ఆర్కైవ్ చేయండి",          mr: "संग्रहित करा",           pa: "ਆਰਕਾਈਵ ਕਰੋ",           or: "ଆର୍କାଇଭIVE" },
};

const TABS = ["workflow", "daily", "weights", "feed", "health"];
const TAB_LABEL = {
  workflow: { en: "Tasks",   hi: "कार्य",      bn: "কাজ",       ta: "பணிகள்",    te: "పనులు",    mr: "कार्ये",    pa: "ਕੰਮ",      or: "କାର୍ୟ" },
  daily:    { en: "Daily",   hi: "दैनिक",      bn: "দৈনিক",     ta: "தினசரி",    te: "రోజువారీ", mr: "दैनंदिन",  pa: "ਰੋਜ਼ਾਨਾ",   or: "ଦୈନିକ" },
  weights:  { en: "Weights", hi: "वजन",        bn: "ওজন",       ta: "எடை",        te: "బరువులు",  mr: "वजन",      pa: "ਭਾਰ",       or: "ଓଜନ" },
  feed:     { en: "Feed",    hi: "चारा",       bn: "খাদ্য",     ta: "தீவனம்",    te: "దాణా",     mr: "खाद्य",    pa: "ਚਾਰਾ",      or: "ଖାଦ୍ୟ" },
  health:   { en: "Health",  hi: "स्वास्थ्य",  bn: "স্বাস্থ্য", ta: "சுகாதாரம்", te: "ఆరోగ్యం",  mr: "आरोग्य",   pa: "ਸਿਹਤ",      or: "ସ୍ଵାସ୍ଥ୍ୟ" },
};

const HEALTH_TYPE_OPTIONS = (tc) => [
  { label: tc({ en: "Observation", hi: "अवलोकन",       bn: "পর্যবেক্ষণ",  ta: "கண்காணிப்பு",               te: "పరిశీలన",                     mr: "निरीक्षण",    pa: "ਨਿਰੀਖਣ",               or: "ପର୍ୟବେକ୍ଷଣ" }),     value: "observation" },
  { label: tc({ en: "Treatment",   hi: "उपचार",         bn: "চিকিৎসা",     ta: "சிகிச்சை",                  te: "చికిత్స",                      mr: "उपचार",       pa: "ਇਲਾਜ",                  or: "ଉପଜାର" }),   value: "treatment" },
  { label: tc({ en: "Vet visit",   hi: "पशु चिकित्सक", bn: "পশু চিকিৎসক", ta: "கால்நடை மருத்துவர் வருகை", te: "పశువైద్యుడి సందర్శన",          mr: "पशुवैद्य भेट", pa: "ਪਸ਼ੂ ਡਾਕਟਰ ਦੌਰਾ",       or: "ପଶୁଚିକିତ୍ସକ ଭେଟ" }), value: "vet_visit" },
  { label: tc({ en: "Outbreak",    hi: "प्रकोप",        bn: "প্রাদুর্ভাব", ta: "தொற்றுநோய்",               te: "వ్యాప్తి",                      mr: "उद्रेक",      pa: "ਫੈਲਾਅ",                 or: "ସଂକ୍ରମଣ" }), value: "outbreak" },
];

const ROUTE_OPTIONS = (tc) => [
  { label: tc({ en: "Drinking water", hi: "पीने का पानी", bn: "পানীয় জল",    ta: "குடிநீர்",    te: "తాగు నీరు",      mr: "पिण्याचे पाणी", pa: "ਪੀਣ ਵਾਲਾ ਪਾਣੀ",      or: "ପାନୀୟ ଜଳ" }),  value: "drinking_water" },
  { label: tc({ en: "Spray",          hi: "स्प्रे",       bn: "স্প্রে",        ta: "தெளிப்பு",    te: "స్ప్రే",         mr: "स्प्रे",        pa: "ਸਪ੍ਰੇ",               or: "ସ୍ପ୍ରେ" }),   value: "spray" },
  { label: tc({ en: "Eye drop",       hi: "आई ड्रॉप",    bn: "চোখের ড্রপ",   ta: "கண் சொட்டு", te: "కంటి చుక్కలు",  mr: "आय ड्रॉप",      pa: "ਅੱਖਾਂ ਦੀਆਂ ਬੂੰਦਾਂ",   or: "ଆଖିଜଳ" }),  value: "eye_drop" },
  { label: tc({ en: "Injection",      hi: "इंजेक्शन",    bn: "ইনজেকশন",      ta: "ஊசி",          te: "ఇంజెక్షన్",     mr: "इंजेक्शन",      pa: "ਟੀਕਾ",                or: "ଇନ୍ଜେକ୍ସନ୍" }), value: "injection" },
];

const KIND_OPTIONS = (tc) => [
  { label: tc({ en: "Received (in)",  hi: "प्राप्त",  bn: "প্রাপ্ত", ta: "ஸ்வீகரிக்கப்பட்டது", te: "స్వీకరించబడింది",  mr: "प्राप्त", pa: "ਪ੍ਰਾਪਤ",    or: "ପ୍ରାପ୍ତ" }),  value: "received" },
  { label: tc({ en: "Consumed (out)", hi: "खपत",      bn: "খাওয়া",  ta: "உபயோகிக்கப்பட்டது",  te: "వినియోగించబడింది", mr: "खपत",     pa: "ਖਰਚ ਕੀਤਾ", or: "ଖରଚ" }), value: "consumed" },
];

export default function PoultryBatchDetail({ batchId }) {
  const { pop, push, tc, toast } = useApp();
  const [space, setSpace]     = useState(null);
  const [batch, setBatch]     = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [state, setState]     = useState("loading");
  const [reason, setReason]   = useState(null);

  /* Tab state */
  const [tab, setTab] = useState("daily");

  /* Tab data */
  const [daily, setDaily]             = useState(null);
  const [weights, setWeights]         = useState(null);
  const [feed, setFeed]               = useState(null);
  const [health, setHealth]           = useState(null);
  const [vaccinations, setVaccinations] = useState(null);
  const [tabLoading, setTabLoading]   = useState(false);

  /* Transition */
  const [transitioning, setTransitioning] = useState(false);

  /* Daily sheet */
  const [dailyOpen, setDailyOpen]   = useState(false);
  const [dform, setDform] = useState({ record_date: today(), mortality: "", culls: "", note: "" });
  const [dbusy, setDbusy] = useState(false);

  /* Weight sheet */
  const [weightOpen, setWeightOpen] = useState(false);
  const [wform, setWform] = useState({ weighed_at: today(), total_weight_g: "", sample_count: "" });
  const [wbusy, setWbusy] = useState(false);
  const wbusyRef = useRef(false); // ref guard prevents duplicate submissions on rapid taps

  /* Feed sheet */
  const [feedOpen, setFeedOpen]   = useState(false);
  const [fform, setFform] = useState({ logged_at: today(), qty_kg: "", kind: "received", note: "" });
  const [fbusy, setFbusy] = useState(false);

  /* Health event sheet */
  const [healthOpen, setHealthOpen] = useState(false);
  const [hform, setHform] = useState({ event_date: today(), type: "observation", title: "", medicine: "", dose: "", note: "" });
  const [hbusy, setHbusy] = useState(false);

  /* Vaccination sheet */
  const [vaccOpen, setVaccOpen] = useState(false);
  const [vform, setVform] = useState({ given_at: today(), vaccine_name: "", route: "drinking_water", dose: "", batch_lot: "", note: "" });
  const [vbusy, setVbusy] = useState(false);

  /* Delete confirm */
  const [delTarget, setDelTarget] = useState(null); // { type, id, label }

  const canRecord = space && farmSpaceService.can(space, "farm.poultry.record");
  const canManage = space && farmSpaceService.can(space, "farm.poultry.manage");

  const loadBatch = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const [b, m] = await Promise.all([
        poultryApi.getBatch(active.id, batchId),
        poultryApi.metrics(active.id, batchId),
      ]);
      setBatch(b);
      setMetrics(m);
      setState("ready");
    } catch (err) {
      if (state !== "ready") { setReason(err?.reason || FARM_ERROR.FAILED); setState("error"); }
    }
  }, [batchId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadBatch(); }, [loadBatch]);

  /* Load tab data on first switch to that tab */
  useEffect(() => {
    if (!space || !batch) return;
    const sid = space.id;
    const bid = batch.id;
    if (tab === "daily" && daily === null) {
      setTabLoading(true);
      poultryApi.listDaily(sid, bid).then(d => { setDaily(d || []); setTabLoading(false); })
        .catch(() => { setDaily([]); setTabLoading(false); });
    }
    if (tab === "weights" && weights === null) {
      setTabLoading(true);
      poultryApi.listWeights(sid, bid).then(d => { setWeights(d || []); setTabLoading(false); })
        .catch(() => { setWeights([]); setTabLoading(false); });
    }
    if (tab === "feed" && feed === null) {
      setTabLoading(true);
      poultryApi.listFeed(sid, bid).then(d => { setFeed(d || []); setTabLoading(false); })
        .catch(() => { setFeed([]); setTabLoading(false); });
    }
    if (tab === "health" && (health === null || vaccinations === null)) {
      setTabLoading(true);
      Promise.all([
        poultryApi.listHealth(sid, bid),
        poultryApi.listVaccinations(sid, bid),
      ]).then(([h, v]) => { setHealth(h || []); setVaccinations(v || []); setTabLoading(false); })
        .catch(() => { setHealth([]); setVaccinations([]); setTabLoading(false); });
    }
  }, [tab, space, batch]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Transition */
  const doTransition = async (transition) => {
    setTransitioning(true);
    try {
      await poultryApi.setBatchStatus(space.id, batch.id, transition);
      toast(tc({ en: "Status updated", hi: "स्थिति अपडेट हुई", bn: "স্ট্যাটাস আপডেট হয়েছে", ta: "நிலை புதுப்பிக்கப்பட்டது", te: "స్థితి నవీకరించబడింది", mr: "स्थिती अपडेट झाली", pa: "ਸਥਿਤੀ ਅੱਪਡੇਟ ਹੋਈ", or: "ସ୍ଥିତି ଆପଡେଟ" }), "success");
      loadBatch();
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ", ta: "தோல்வி", te: "విఫలమైంది", mr: "अयशस्वी", pa: "ਅਸਫਲ", or: "ବିଫଳ" }), "error");
    } finally { setTransitioning(false); }
  };

  /* Daily submit */
  const submitDaily = async () => {
    if (!dform.record_date) return;
    setDbusy(true);
    try {
      await poultryApi.upsertDaily(space.id, {
        batchId: batch.id,
        record_date: dform.record_date,
        mortality: dform.mortality ? Number(dform.mortality) : 0,
        culls: dform.culls ? Number(dform.culls) : 0,
        note: dform.note.trim() || null,
      });
      setDailyOpen(false);
      setDform({ record_date: today(), mortality: "", culls: "", note: "" });
      toast(tc({ en: "Record saved", hi: "रिकॉर्ड सेव हुआ", bn: "রেকর্ড সেভ হয়েছে", ta: "பதிவு சேமிக்கப்பட்டது", te: "రికార్డు సేవ్ అయింది", mr: "रेकॉर्ड सेव्ह झाला", pa: "ਰਿਕਾਰਡ ਸੇਵ ਹੋਇਆ", or: "ରେକର୍ଡ ସେଭ ହେଲା" }), "success");
      setDaily(null); // force re-fetch
      loadBatch();
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ", ta: "தோல்வி", te: "విఫలమైంది", mr: "अयशस्वी", pa: "ਅਸਫਲ", or: "ବିଫଳ" }), "error");
    } finally { setDbusy(false); }
  };

  /* Weight submit */
  const submitWeight = async () => {
    if (!wform.total_weight_g || !wform.sample_count) return;
    if (wbusyRef.current) return; // block rapid double-taps before React re-renders disabled state
    if (!wform.weighed_at || !/^\d{4}-\d{2}-\d{2}$/.test(wform.weighed_at)) {
      toast(tc({ en: "Enter a valid weighing date", hi: "वैध तारीख दर्ज करें", bn: "বৈধ তারিখ দিন", ta: "சரியான தேதி உள்ளிடவும்", te: "చెల్లుబాటు అయ్యే తేదీ నమోదు చేయండి", mr: "वैध तारीख प्रविष्ट करा", pa: "ਸਹੀ ਤਾਰੀਖ ਦਰਜ ਕਰੋ", or: "ସଠିକ ତାରିଖ ଦିଅନ୍ତୁ" }), "error");
      return;
    }
    wbusyRef.current = true;
    setWbusy(true);
    try {
      await poultryApi.addWeight(space.id, {
        batchId: batch.id,
        weigh_date: wform.weighed_at,           // server field: weigh_date (YYYY-MM-DD)
        total_sample_weight_g: Number(wform.total_weight_g), // server field: total_sample_weight_g
        sample_count: Number(wform.sample_count),
      });
      setWeightOpen(false);
      setWform({ weighed_at: today(), total_weight_g: "", sample_count: "" });
      toast(tc({ en: "Weight logged", hi: "वजन दर्ज हुआ", bn: "ওজন লগ হয়েছে", ta: "எடை பதிவாயிற்று", te: "బరువు నమోదైంది", mr: "वजन नोंदवले", pa: "ਭਾਰ ਦਰਜ ਹੋਇਆ", or: "ଓଜନ ନଥିଭୁକ୍ତ" }), "success");
      setWeights(null);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ", ta: "தோல்வி", te: "విఫలమైంది", mr: "अयशस्वी", pa: "ਅਸਫਲ", or: "ବିଫଳ" }), "error");
    } finally { wbusyRef.current = false; setWbusy(false); }
  };

  /* Feed submit */
  const submitFeed = async () => {
    if (!fform.qty_kg) return;
    setFbusy(true);
    try {
      await poultryApi.addFeed(space.id, {
        batchId:     batch.id,
        log_date:    fform.logged_at,
        quantity_kg: Number(fform.qty_kg),
        kind:        fform.kind,
        notes:       fform.note.trim() || null,
      });
      setFeedOpen(false);
      setFform({ logged_at: today(), qty_kg: "", kind: "received", note: "" });
      toast(tc({ en: "Feed logged", hi: "चारा दर्ज हुआ", bn: "খাদ্য লগ হয়েছে", ta: "தீவனம் பதிவாயிற்று", te: "దాణా నమోదైంది", mr: "खाद्य नोंदवले", pa: "ਚਾਰਾ ਦਰਜ ਹੋਇਆ", or: "ଖାଦ୍ୟ ନଥିଭୁକ୍ତ" }), "success");
      setFeed(null);
      loadBatch();
    } catch (err) {
      const msg = err.details?.available_kg != null
        ? tc({ en: `Only ${err.details.available_kg} kg available`,
                hi: `केवल ${err.details.available_kg} kg उपलब्ध`,
                bn: `মাত্র ${err.details.available_kg} kg পাওয়া যাচ্ছে` })
        : err.message;
      toast(msg || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ", ta: "தோல்வி", te: "విఫలమైంది", mr: "अयशस्वी", pa: "ਅਸਫਲ", or: "ବିଫଳ" }), "error");
    } finally { setFbusy(false); }
  };

  /* Health event submit */
  const submitHealth = async () => {
    if (!hform.title.trim()) return;
    setHbusy(true);
    try {
      await poultryApi.addHealth(space.id, {
        batchId: batch.id,
        event_date: hform.event_date,
        type: hform.type,
        title: hform.title.trim(),
        medicine: hform.medicine.trim() || null,
        dose: hform.dose.trim() || null,
        note: hform.note.trim() || null,
      });
      setHealthOpen(false);
      setHform({ event_date: today(), type: "observation", title: "", medicine: "", dose: "", note: "" });
      toast(tc({ en: "Health event saved", hi: "स्वास्थ्य घटना सेव हुई", bn: "স্বাস্থ্য ইভেন্ট সেভ হয়েছে", ta: "சுகாதார நிகழ்வு சேமிக்கப்பட்டது", te: "ఆరోగ్య సంఘటన సేవ్ అయింది", mr: "आरोग्य घटना सेव्ह झाली", pa: "ਸਿਹਤ ਘਟਨਾ ਸੇਵ ਹੋਈ", or: "ସ୍ଵାସ୍ଥ୍ୟSAVED" }), "success");
      setHealth(null); setVaccinations(null);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ", ta: "தோல்வி", te: "విఫలమైంది", mr: "अयशस्वी", pa: "ਅਸਫਲ", or: "ବିଫଳ" }), "error");
    } finally { setHbusy(false); }
  };

  /* Vaccination submit */
  const submitVacc = async () => {
    if (!vform.vaccine_name.trim()) return;
    setVbusy(true);
    try {
      await poultryApi.addVaccination(space.id, {
        batchId: batch.id,
        given_at: vform.given_at,
        vaccine_name: vform.vaccine_name.trim(),
        route: vform.route,
        dose: vform.dose.trim() || null,
        batch_lot: vform.batch_lot.trim() || null,
        note: vform.note.trim() || null,
      });
      setVaccOpen(false);
      setVform({ given_at: today(), vaccine_name: "", route: "drinking_water", dose: "", batch_lot: "", note: "" });
      toast(tc({ en: "Vaccination recorded", hi: "टीकाकरण दर्ज हुआ", bn: "টিকাদান রেকর্ড হয়েছে", ta: "தடுப்பூசி பதிவாயிற்று", te: "టీకా నమోదైంది", mr: "लसीकरण नोंदवले", pa: "ਟੀਕਾਕਰਨ ਦਰਜ ਹੋਇਆ", or: "ଟିକା ନଥିଭୁକ୍ତ" }), "success");
      setHealth(null); setVaccinations(null);
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ", ta: "தோல்வி", te: "విఫలమైంది", mr: "अयशस्वी", pa: "ਅਸਫਲ", or: "ବିଫଳ" }), "error");
    } finally { setVbusy(false); }
  };

  /* Delete */
  const confirmDelete = async () => {
    if (!delTarget) return;
    try {
      if (delTarget.type === "daily")        await poultryApi.deleteDaily(space.id, batch.id, delTarget.id);
      if (delTarget.type === "weight")       await poultryApi.deleteWeight(space.id, delTarget.id);
      if (delTarget.type === "feed")         await poultryApi.deleteFeed(space.id, delTarget.id);
      if (delTarget.type === "health")       await poultryApi.deleteHealth(space.id, delTarget.id);
      if (delTarget.type === "vaccination")  await poultryApi.deleteVaccination(space.id, delTarget.id);
      toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে গেছে", ta: "நீக்கப்பட்டது", te: "తొలగించబడింది", mr: "हटवले", pa: "ਮਿਟਾਇਆ", or: "ମୁଛା ଦିଅନ୍ତୁD" }), "success");
      if (delTarget.type === "daily")       { setDaily(null); loadBatch(); }
      if (delTarget.type === "weight")        setWeights(null);
      if (delTarget.type === "feed")        { setFeed(null); loadBatch(); }
      if (delTarget.type === "health" || delTarget.type === "vaccination") { setHealth(null); setVaccinations(null); }
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ", ta: "தோல்வி", te: "విఫలమైంది", mr: "अयशस्वी", pa: "ਅਸਫਲ", or: "ବିଫଳ" }), "error");
    } finally { setDelTarget(null); }
  };

  /* ── render states ───────────────────────────────────────────────────── */

  if (state === "loading") return (
    <>
      <AppBar title={tc({ en: "Batch", hi: "बैच", bn: "ব্যাচ", ta: "தொகுப்பு", te: "బ్యాచ్", mr: "बॅच", pa: "ਬੈਚ", or: "ବ୍ୟାଚ୍" })} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div>
    </>
  );
  if (state === "error") return (
    <>
      <AppBar title={tc({ en: "Batch", hi: "बैच", bn: "ব্যাচ", ta: "தொகுப்பு", te: "బ్యాచ్", mr: "बॅच", pa: "ਬੈਚ", or: "ବ୍ୟାଚ୍" })} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={loadBatch} /></div>
    </>
  );

  const statusMeta = BATCH_STATUS[batch.status] || BATCH_STATUS.draft;
  const transitions = batch.allowed_transitions || [];
  const liveBirds = metrics?.live_birds ?? batch.live_birds ?? batch.placed_qty;
  const fcr = metrics?.fcr;
  const adg = metrics?.avg_daily_gain_g;
  const totalFeed = metrics?.total_feed_kg;

  return (
    <>
      <AppBar title={batch.name} onBack={pop}
        action={
          <div style={{ display: "flex", gap: 2 }}>
            <button
              onClick={() => push({ kind: "poultryBatchFinance", props: { batchId: batch.id } })}
              title={tc({ en: "Finance", hi: "वित्त", bn: "অর্থ", ta: "நிதி", te: "ఫైనాన్స్", mr: "वित्त", pa: "ਵਿੱਤ", or: "ବିତ୍ତ" })}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6,
                color: T.inkSoft, display: "flex", alignItems: "center" }}>
              <Icon name="CircleDollarSign" size={20} />
            </button>
            <button
              onClick={() => push({ kind: "poultryBatchHistory", props: { batchId: batch.id } })}
              title={tc({ en: "View history", hi: "इतिहास देखें", bn: "ইতিহাস দেখুন", ta: "வரலாறு காண்", te: "చరిత్ర చూడండి", mr: "इतिहास पहा", pa: "ਇਤਿਹਾਸ ਦੇਖੋ", or: "ଇତିହାସ ଦେଖନ୍ତୁ" })}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6,
                color: T.inkSoft, display: "flex", alignItems: "center" }}>
              <Icon name="History" size={20} />
            </button>
          </div>
        }
      />

      <div style={{ padding: "4px 16px 100px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Status + transitions */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <Chip accent={statusMeta.a}>{tc(statusMeta.label)}</Chip>
            {batch.shed_name && (
              <span style={{ fontSize: 12.5, color: T.inkSoft }}>{batch.shed_name}</span>
            )}
          </div>
          {canManage && transitions.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {transitions.map(t => (
                <button key={t} onClick={() => doTransition(t)} disabled={transitioning}
                  style={{ background: T.surface2, border: "none", borderRadius: T.rMd,
                    padding: "7px 14px", fontFamily: T.body, fontSize: 13, fontWeight: 600,
                    color: T.ink, cursor: "pointer", opacity: transitioning ? 0.6 : 1 }}>
                  {tc(TRANSITION_LABEL[t] || { en: t, hi: t, bn: t })}
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <MetricTile label={tc({ en: "Live birds", hi: "जीवित पक्षी", bn: "জীবিত পাখি", ta: "உயிரோடிருக்கும் பறவைகள்", te: "సజీవ పక్షులు", mr: "जिवंत पक्षी", pa: "ਜਿਉਂਦੇ ਪੰਛੀ", or: "ଜୀଵନ୍ତ ପକ୍ଷୀ" })}
            value={liveBirds.toLocaleString("en-IN")} accent="primary" />
          <MetricTile label={tc({ en: "Age (days)", hi: "उम्र (दिन)", bn: "বয়স (দিন)", ta: "வயது (நாட்கள்)", te: "వయస్సు (రోజులు)", mr: "वय (दिवस)", pa: "ਉਮਰ (ਦਿਨ)", or: "ବୟସ (ଦିନ)" })}
            value={batch.age_days ?? "—"} />
          {fcr != null && (
            <MetricTile label="FCR" value={fcr.toFixed(2)} accent={fcr <= (batch.target_fcr || 1.8) ? "primary" : "orange"} />
          )}
          {adg != null && (
            <MetricTile label={tc({ en: "ADG (g/day)", hi: "ADG (g/दिन)", bn: "ADG (g/দিন)", ta: "ADG (g/நாள்)", te: "ADG (g/రోజు)", mr: "ADG (g/दिवस)", pa: "ADG (g/ਦਿਨ)", or: "ADG (g/ଦିନ)" })}
              value={adg.toFixed(1)} />
          )}
          {totalFeed != null && (
            <MetricTile label={tc({ en: "Feed used (kg)", hi: "चारा (kg)", bn: "খাদ্য (kg)", ta: "தீவனம் (kg)", te: "దాణా (kg)", mr: "खाद्य (kg)", pa: "ਚਾਰਾ (kg)", or: "ଖାଦ୍ୟ (kg)" })}
              value={totalFeed.toFixed(1)} />
          )}
          {batch.expected_harvest_date && (
            <MetricTile label={tc({ en: "Target harvest", hi: "लक्ष्य कटाई", bn: "লক্ষ্য কর্তন", ta: "இலக்கு அறுவடை", te: "లక్ష్య కోత", mr: "लक्ष्य कापणी", pa: "ਟੀਚਾ ਵਾਢੀ", or: "ଲକ୍ଷ୍ୟ କ୍ଷୀର" })}
              value={batch.expected_harvest_date} />
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: T.surface2, borderRadius: T.rMd, padding: 3, gap: 3 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "7px 4px", border: "none", cursor: "pointer", fontFamily: T.body,
              fontSize: 13, fontWeight: 600, borderRadius: T.rMd - 2,
              background: tab === t ? T.surface : "transparent",
              color: tab === t ? T.ink : T.inkSoft,
              boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.08)" : "none",
            }}>
              {tc(TAB_LABEL[t])}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "workflow" && (
          <div style={{ padding: "16px 16px 0" }}>
            <PoultryWorkflowTab space={space} batch={batch}
              canRecord={canRecord} canManage={canManage} />
          </div>
        )}
        {tabLoading
          ? <div style={{ padding: 40, display: "grid", placeItems: "center" }}><Spinner /></div>
          : <>
              {tab === "daily" && (
                <DailyTab rows={daily || []} tc={tc} canRecord={canRecord} canManage={canManage}
                  onAdd={() => setDailyOpen(true)}
                  onDelete={r => setDelTarget({ type: "daily", id: r.record_date, label: r.record_date })}
                />
              )}
              {tab === "weights" && (
                <WeightsTab rows={weights || []} tc={tc} canRecord={canRecord} canManage={canManage}
                  onAdd={() => setWeightOpen(true)}
                  onDelete={r => setDelTarget({ type: "weight", id: r.id, label: r.weighed_at })}
                />
              )}
              {tab === "feed" && (
                <FeedTab rows={feed || []} tc={tc} canRecord={canRecord} canManage={canManage}
                  onAdd={() => setFeedOpen(true)}
                  onDelete={r => setDelTarget({ type: "feed", id: r.id, label: r.logged_at })}
                />
              )}
              {tab === "health" && (
                <HealthTab
                  healthRows={health || []} vaccRows={vaccinations || []} tc={tc}
                  canRecord={canRecord} canManage={canManage}
                  onAddHealth={() => setHealthOpen(true)}
                  onAddVacc={() => setVaccOpen(true)}
                  onDeleteHealth={r => setDelTarget({ type: "health", id: r.id, label: r.title })}
                  onDeleteVacc={r => setDelTarget({ type: "vaccination", id: r.id, label: r.vaccine_name })}
                />
              )}
            </>
        }
      </div>

      {/* Daily record sheet */}
      <BottomSheet open={dailyOpen} onClose={() => setDailyOpen(false)}
        title={tc({ en: "Daily Record", hi: "दैनिक रिकॉर्ड", bn: "দৈনিক রেকর্ড", ta: "தினசரி பதிவு", te: "రోజువారీ రికార్డు", mr: "दैनंदिन रेकॉर्ड", pa: "ਰੋਜ਼ਾਨਾ ਰਿਕਾਰਡ", or: "ଦୈନିକ ରେକର୍ଡ" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *", ta: "தேதி *", te: "తేదీ *", mr: "तारीख *", pa: "ਤਾਰੀਖ *", or: "ତାରିଖ *" })}
            value={dform.record_date} onChange={v => setDform(f => ({ ...f, record_date: v }))} type="date" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label={tc({ en: "Mortality", hi: "मृत्यु", bn: "মৃত্যু", ta: "இறப்பு", te: "మరణాలు", mr: "मृत्यू", pa: "ਮੌਤ", or: "ମୃତ୍ୟୁ" })}
              value={dform.mortality} onChange={v => setDform(f => ({ ...f, mortality: v }))} type="number" />
            <Input label={tc({ en: "Culls", hi: "कल्स", bn: "কালস", ta: "நீக்கல்கள்", te: "కల్స్", mr: "कल्स", pa: "ਕੱਲਸ", or: "କଲ୍ସ୍" })}
              value={dform.culls} onChange={v => setDform(f => ({ ...f, culls: v }))} type="number" />
          </div>
          <Input label={tc({ en: "Note", hi: "नोट", bn: "নোট", ta: "குறிப்பு", te: "నోట్", mr: "नोट", pa: "ਨੋਟ", or: "ନୋଟ୍" })}
            value={dform.note} onChange={v => setDform(f => ({ ...f, note: v }))} />
          <Button full onClick={submitDaily} disabled={!dform.record_date || dbusy}>
            {dbusy ? tc({ en: "Saving…", hi: "सेव हो रहा है…", bn: "সেভ হচ্ছে…", ta: "சேமிக்கிறது…", te: "సేవ్ అవుతోంది…", mr: "सेव्ह होत आहे…", pa: "ਸੇਵ ਹੋ ਰਿਹਾ ਹੈ…", or: "ସେଭ ହେଉଛି…" })
                   : tc({ en: "Save record", hi: "रिकॉर्ड सेव करें", bn: "রেকর্ড সেভ করুন", ta: "பதிவை சேமி", te: "రికార్డు సేవ్ చేయండి", mr: "रेकॉर्ड सेव्ह करा", pa: "ਰਿਕਾਰਡ ਸੇਵ ਕਰੋ", or: "ରେକର୍ଡ ସେଭ କରନ୍ତୁ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Weight sheet */}
      <BottomSheet open={weightOpen} onClose={() => setWeightOpen(false)}
        title={tc({ en: "Add Weight", hi: "वजन जोड़ें", bn: "ওজন যোগ করুন", ta: "எடை சேர்", te: "బరువు జోడించండి", mr: "वजन जोडा", pa: "ਭਾਰ ਜੋੜੋ", or: "ଓଜନ ଯୋଗ କରନ୍ତୁ" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *", ta: "தேதி *", te: "తేదీ *", mr: "तारीख *", pa: "ਤਾਰੀਖ *", or: "ତାରିଖ *" })}
            value={wform.weighed_at} onChange={v => setWform(f => ({ ...f, weighed_at: v }))} type="date" />
          <Input label={tc({ en: "Total weight (g) *", hi: "कुल वजन (g) *", bn: "মোট ওজন (g) *", ta: "மொத்த எடை (g) *", te: "మొత్తం బరువు (g) *", mr: "एकूण वजन (g) *", pa: "ਕੁੱਲ ਭਾਰ (g) *", or: "ମୋଟ ଓଜନ (g) *" })}
            value={wform.total_weight_g} onChange={v => setWform(f => ({ ...f, total_weight_g: v }))} type="number" />
          <Input label={tc({ en: "Sample count (birds weighed) *", hi: "नमूना गिनती *", bn: "নমুনা গণনা *", ta: "மாதிரி எண்ணிக்கை *", te: "నమూనా సంఖ్య *", mr: "नमुना संख्या *", pa: "ਨਮੂਨਾ ਗਿਣਤੀ *", or: "ନମୁନା ସଂଖ୍ୟା *" })}
            value={wform.sample_count} onChange={v => setWform(f => ({ ...f, sample_count: v }))} type="number" />
          {wform.total_weight_g && wform.sample_count && Number(wform.sample_count) > 0 && (
            <div style={{ fontSize: 13, color: T.inkSoft, textAlign: "center" }}>
              {tc({ en: "Avg", hi: "औसत", bn: "গড়", ta: "சராசரி", te: "సగటు", mr: "सरासरी", pa: "ਔਸਤ", or: "ସରାସରି" })}: {(Number(wform.total_weight_g) / Number(wform.sample_count)).toFixed(1)} g
            </div>
          )}
          <Button full onClick={submitWeight} disabled={!wform.total_weight_g || !wform.sample_count || wbusy}>
            {wbusy ? tc({ en: "Logging…", hi: "दर्ज हो रहा है…", bn: "লগ হচ্ছে…", ta: "நிவேதிக்கிறது…", te: "లాగ్ అవుతోంది…", mr: "नोंदवत आहे…", pa: "ਦਰਜ ਹੋ ਰਿਹਾ ਹੈ…", or: "ନଥିଭୁକ୍ତ ହେଉଛି…" })
                   : tc({ en: "Log weight", hi: "वजन दर्ज करें", bn: "ওজন লগ করুন", ta: "எடையை நிவேதி", te: "బరువు లాగ్ చేయండి", mr: "वजन नोंदवा", pa: "ਭਾਰ ਦਰਜ ਕਰੋ", or: "ଓଜନ ନଥିଭୁକ୍ତ କରନ୍ତୁ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Feed sheet */}
      <BottomSheet open={feedOpen} onClose={() => setFeedOpen(false)}
        title={tc({ en: "Add Feed", hi: "चारा जोड़ें", bn: "খাদ্য যোগ করুন", ta: "தீவனம் சேர்", te: "దాణా జోడించండి", mr: "खाद्य जोडा", pa: "ਚਾਰਾ ਜੋੜੋ", or: "ଖାଦ୍ୟ ଯୋଗ କରନ୍ତୁ" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *", ta: "தேதி *", te: "తేదీ *", mr: "तारीख *", pa: "ਤਾਰੀਖ *", or: "ତାରିଖ *" })}
            value={fform.logged_at} onChange={v => setFform(f => ({ ...f, logged_at: v }))} type="date" />
          <Input label={tc({ en: "Quantity (kg) *", hi: "मात्रा (kg) *", bn: "পরিমাণ (kg) *", ta: "அளவு (kg) *", te: "పరిమాణం (kg) *", mr: "प्रमाण (kg) *", pa: "ਮਾਤਰਾ (kg) *", or: "ପରିମାଣ (kg) *" })}
            value={fform.qty_kg} onChange={v => setFform(f => ({ ...f, qty_kg: v }))} type="number" />
          <Dropdown label={tc({ en: "Type", hi: "प्रकार", bn: "ধরন", ta: "வகை", te: "రకం", mr: "प्रकार", pa: "ਕਿਸਮ", or: "ପ୍ରକାର" })}
            value={fform.kind} onChange={v => setFform(f => ({ ...f, kind: v }))}
            options={KIND_OPTIONS(tc)} />
          <Input label={tc({ en: "Note", hi: "नोट", bn: "নোট", ta: "குறிப்பு", te: "నోట్", mr: "नोट", pa: "ਨੋਟ", or: "ନୋଟ୍" })}
            value={fform.note} onChange={v => setFform(f => ({ ...f, note: v }))} />
          <Button full onClick={submitFeed} disabled={!fform.qty_kg || fbusy}>
            {fbusy ? tc({ en: "Logging…", hi: "दर्ज हो रहा है…", bn: "লগ হচ্ছে…", ta: "நிவேதிக்கிறது…", te: "లాగ్ అవుతోంది…", mr: "नोंदवत आहे…", pa: "ਦਰਜ ਹੋ ਰਿਹਾ ਹੈ…", or: "ନଥିଭୁକ୍ତ ହେଉଛି…" })
                   : tc({ en: "Log feed", hi: "चारा दर्ज करें", bn: "খাদ্য লগ করুন", ta: "தீவனம் நிவேதி", te: "దాణా లాగ్ చేయండి", mr: "खाद्य नोंदवा", pa: "ਚਾਰਾ ਦਰਜ ਕਰੋ", or: "ଖାଦ୍ୟ ନଥିଭୁକ୍ତ କରନ୍ତୁ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Health event sheet */}
      <BottomSheet open={healthOpen} onClose={() => setHealthOpen(false)}
        title={tc({ en: "Health Event", hi: "स्वास्थ्य घटना", bn: "স্বাস্থ্য ইভেন্ট", ta: "சுகாதார நிகழ்வு", te: "ఆరోగ్య సంఘటన", mr: "आरोग्य घटना", pa: "ਸਿਹਤ ਘਟਨਾ", or: "ସ୍ଵାସ୍ଥ୍ୟEVT" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *", ta: "தேதி *", te: "తేదీ *", mr: "तारीख *", pa: "ਤਾਰੀਖ *", or: "ତାରିଖ *" })}
            value={hform.event_date} onChange={v => setHform(f => ({ ...f, event_date: v }))} type="date" />
          <Dropdown label={tc({ en: "Type *", hi: "प्रकार *", bn: "ধরন *", ta: "வகை *", te: "రకం *", mr: "प्रकार *", pa: "ਕਿਸਮ *", or: "ପ୍ରକାରSTAR" })}
            value={hform.type} onChange={v => setHform(f => ({ ...f, type: v }))}
            options={HEALTH_TYPE_OPTIONS(tc)} />
          <Input label={tc({ en: "Title *", hi: "शीर्षक *", bn: "শিরোনাম *", ta: "தலைப்பு *", te: "శీర్షిక *", mr: "शीर्षक *", pa: "ਸਿਰਲੇਖ *", or: "ଶିରୋନାମ *" })}
            value={hform.title} onChange={v => setHform(f => ({ ...f, title: v }))} />
          {(hform.type === "treatment" || hform.type === "vet_visit") && (
            <Input label={tc({ en: "Medicine / Drug", hi: "दवा", bn: "ওষুধ", ta: "மருந்து", te: "మందు", mr: "औषध", pa: "ਦਵਾਈ", or: "ଔଷଧ" })}
              value={hform.medicine} onChange={v => setHform(f => ({ ...f, medicine: v }))} />
          )}
          {(hform.type === "treatment" || hform.type === "vet_visit") && (
            <Input label={tc({ en: "Dose", hi: "खुराक", bn: "ডোজ", ta: "மருந்தளவு", te: "మోతాదు", mr: "डोस", pa: "ਖੁਰਾਕ", or: "ଡୋଜ୍" })}
              value={hform.dose} onChange={v => setHform(f => ({ ...f, dose: v }))} />
          )}
          <Input label={tc({ en: "Note", hi: "नोट", bn: "নোট", ta: "குறிப்பு", te: "నోట్", mr: "नोट", pa: "ਨੋਟ", or: "ନୋଟ୍" })}
            value={hform.note} onChange={v => setHform(f => ({ ...f, note: v }))} />
          <Button full onClick={submitHealth} disabled={!hform.title.trim() || hbusy}>
            {hbusy ? tc({ en: "Saving…", hi: "सेव हो रहा है…", bn: "সেভ হচ্ছে…", ta: "சேமிக்கிறது…", te: "సేవ్ అవుతోంది…", mr: "सेव्ह होत आहे…", pa: "ਸੇਵ ਹੋ ਰਿਹਾ ਹੈ…", or: "ସେଭ ହେଉଛି…" })
                   : tc({ en: "Save event", hi: "घटना सेव करें", bn: "ইভেন্ট সেভ করুন", ta: "நிகழ்வை சேமி", te: "సంఘటన సేవ్ చేయండి", mr: "घटना सेव्ह करा", pa: "ਘਟਨਾ ਸੇਵ ਕਰੋ", or: "ଘଟନା ସେଭ କରନ୍ତୁ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Vaccination sheet */}
      <BottomSheet open={vaccOpen} onClose={() => setVaccOpen(false)}
        title={tc({ en: "Add Vaccination", hi: "टीकाकरण जोड़ें", bn: "টিকাদান যোগ করুন", ta: "தடுப்பூசி சேர்", te: "టీకా జోడించండి", mr: "लसीकरण जोडा", pa: "ਟੀਕਾਕਰਨ ਜੋੜੋ", or: "ଟିକା ଯୋଗ କରନ୍ତୁ" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <Input label={tc({ en: "Date *", hi: "तारीख *", bn: "তারিখ *", ta: "தேதி *", te: "తేదీ *", mr: "तारीख *", pa: "ਤਾਰੀਖ *", or: "ତାରିଖ *" })}
            value={vform.given_at} onChange={v => setVform(f => ({ ...f, given_at: v }))} type="date" />
          <Input label={tc({ en: "Vaccine name *", hi: "वैक्सीन का नाम *", bn: "ভ্যাকসিনের নাম *", ta: "தடுப்பூசி பெயர் *", te: "వ్యాక్సిన్ పేరు *", mr: "लस नाव *", pa: "ਵੈਕਸੀਨ ਦਾ ਨਾਮ *", or: "ଟିକା ନାମ *" })}
            value={vform.vaccine_name} onChange={v => setVform(f => ({ ...f, vaccine_name: v }))} />
          <Dropdown label={tc({ en: "Route *", hi: "मार्ग *", bn: "পথ *", ta: "வழி *", te: "మార్గం *", mr: "मार्ग *", pa: "ਰੂਟ *", or: "ମାର୍ଗ *" })}
            value={vform.route} onChange={v => setVform(f => ({ ...f, route: v }))}
            options={ROUTE_OPTIONS(tc)} />
          <Input label={tc({ en: "Dose / Dilution", hi: "खुराक / तनुता", bn: "ডোজ / তনুতা", ta: "மருந்தளவு / நீர்த்தல்", te: "మోతాదు / విరళీకరణ", mr: "डोस / तनुता", pa: "ਖੁਰਾਕ / ਪਤਲਾਪਣ", or: "ଡୋଜ୍DIL" })}
            value={vform.dose} onChange={v => setVform(f => ({ ...f, dose: v }))} />
          <Input label={tc({ en: "Batch / Lot no.", hi: "बैच / लॉट नं.", bn: "ব্যাচ / লট নং", ta: "தொகுப்பு / நிறை எண்.", te: "బ్యాచ్ / లాట్ నం.", mr: "बॅच / लॉट क्र.", pa: "ਬੈਚ / ਲਾਟ ਨੰ.", or: "ବ୍ୟାଚ୍LOT" })}
            value={vform.batch_lot} onChange={v => setVform(f => ({ ...f, batch_lot: v }))} />
          <Input label={tc({ en: "Note", hi: "नोट", bn: "নোট", ta: "குறிப்பு", te: "నోట్", mr: "नोट", pa: "ਨੋਟ", or: "ନୋଟ୍" })}
            value={vform.note} onChange={v => setVform(f => ({ ...f, note: v }))} />
          <Button full onClick={submitVacc} disabled={!vform.vaccine_name.trim() || vbusy}>
            {vbusy ? tc({ en: "Recording…", hi: "दर्ज हो रहा है…", bn: "রেকর্ড হচ্ছে…", ta: "பதிவு செய்கிறது…", te: "రికార్డు అవుతోంది…", mr: "नोंदवत आहे…", pa: "ਰਿਕਾਰਡ ਹੋ ਰਿਹਾ ਹੈ…", or: "ନଥିଭୁକ୍ତ ହେଉଛି…" })
                   : tc({ en: "Record vaccination", hi: "टीकाकरण दर्ज करें", bn: "টিকাদান রেকর্ড করুন", ta: "தடுப்பூசி பதிவு செய்", te: "టీకా రికార్డు చేయండి", mr: "लसीकरण नोंदवा", pa: "ਟੀਕਾਕਰਨ ਦਰਜ ਕਰੋ", or: "ଟିକା ନଥିଭୁକ୍ତ କରନ୍ତୁ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Delete confirm */}
      <Dialog
        open={!!delTarget}
        title={tc({ en: "Delete?", hi: "हटाएँ?", bn: "মুছবেন?", ta: "நீக்கவா?", te: "తొలగించాలా?", mr: "हटवायचे?", pa: "ਮਿਟਾਉਣਾ?", or: "ମୁଛା?" })}
        body={delTarget?.label}
        actions={[
          { label: tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল", ta: "ரத்து", te: "రద్దు", mr: "रद्द करा", pa: "ਰੱਦ ਕਰੋ", or: "ରଦ୍ଦ କରନ୍ତୁ" }), onClick: () => setDelTarget(null) },
          { label: tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন", ta: "நீக்கு", te: "తొలగించు", mr: "हटवा", pa: "ਮਿਟਾਓ", or: "ମୁଛା ଦିଅନ୍ତୁ" }), onClick: confirmDelete, destructive: true },
        ]}
      />
    </>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function MetricTile({ label, value, accent }) {
  const color = accent === "primary" ? T.primary : accent === "orange" ? T.orange : T.ink;
  return (
    <Card style={{ padding: "12px 14px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: T.display, color }}>{value}</div>
      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{label}</div>
    </Card>
  );
}

function AddRow({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      padding: "10px", background: T.surface2, border: `1.5px dashed ${T.border}`,
      borderRadius: T.rMd, cursor: "pointer", fontFamily: T.body,
      fontSize: 13.5, fontWeight: 600, color: T.primary,
    }}>
      <Icon name="Plus" size={15} /> {label}
    </button>
  );
}

function RowCard({ left, right, onDelete }) {
  return (
    <Card pad={0}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>{left}</div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>{right}</div>
        {onDelete && (
          <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer",
            padding: 4, color: T.inkFaint, flexShrink: 0 }}>
            <Icon name="Trash2" size={15} />
          </button>
        )}
      </div>
    </Card>
  );
}

function DailyTab({ rows, tc, canRecord, canManage, onAdd, onDelete }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {canRecord && (
        <AddRow label={tc({ en: "Add daily record", hi: "दैनिक रिकॉर्ड जोड़ें", bn: "দৈনিক রেকর্ড যোগ করুন", ta: "தினசரி பதிவு சேர்", te: "రోజువారీ రికార్టు జోడించండి", mr: "दैनंदिन रेकॉर्ड जोडा", pa: "ਰੋਜ਼ਾਨਾ ਰਿਕਾਰਡ ਜੋੜੋ", or: "ଦୈନିକ ରେକର୍ଡ ଯୋଗ କରନ୍ତୁ" })} onClick={onAdd} />
      )}
      {rows.length === 0
        ? <EmptyState icon="CalendarDays"
            title={tc({ en: "No records yet", hi: "अभी कोई रिकॉर्ड नहीं", bn: "এখনও কোনো রেকর্ড নেই", ta: "இன்னும் பதிவுகள் இல்லை", te: "ఇంకా రికార్డులు లేవు", mr: "अजून रेकॉर्ड नाहीत", pa: "ਅਜੇ ਕੋਈ ਰਿਕਾਰਡ ਨਹੀਂ", or: "ଆଠି କୌଣସି ରେକର୍ଡ ନାହି" })} />
        : rows.map(r => (
            <RowCard key={r.record_date}
              left={<>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{r.record_date}</div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                  {tc({ en: "Mortality", hi: "मृत्यु", bn: "মৃত্যু", ta: "இறப்பு", te: "మరణాలు", mr: "मृत्यू", pa: "ਮੌਤ", or: "ମୃତ୍ୟୁ" })}: {r.mortality ?? 0}
                  {" · "}
                  {tc({ en: "Culls", hi: "कल्स", bn: "কালস", ta: "நீக்கல்கள்", te: "కల్స్", mr: "कल्स", pa: "ਕੱਲਸ", or: "କଲ୍ସ୍" })}: {r.culls ?? 0}
                </div>
                {r.note && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{r.note}</div>}
              </>}
              right={<>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                  {(r.opening_birds ?? "—")} → {(r.closing_birds ?? "—")}
                </div>
                <div style={{ fontSize: 11, color: T.inkSoft }}>
                  {tc({ en: "birds", hi: "पक्षी", bn: "পাখি", ta: "பறவைகள்", te: "పక్షులు", mr: "पक्षी", pa: "ਪੰਛੀ", or: "ପକ୍ଷୀ" })}
                </div>
              </>}
              onDelete={canManage ? () => onDelete(r) : null}
            />
          ))
      }
    </div>
  );
}

function WeightsTab({ rows, tc, canRecord, canManage, onAdd, onDelete }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {canRecord && (
        <AddRow label={tc({ en: "Add weight sample", hi: "वजन नमूना जोड़ें", bn: "ওজন নমুনা যোগ করুন", ta: "எடை மாதிரி சேர்", te: "బరువు నమూనా జోడించండి", mr: "वजन नमुना जोडा", pa: "ਭਾਰ ਨਮੂਨਾ ਜੋੜੋ", or: "ଓଜନ ନମୁନା ଯୋଗ କରନ୍ତୁ" })} onClick={onAdd} />
      )}
      {rows.length === 0
        ? <EmptyState icon="Scale"
            title={tc({ en: "No weights logged", hi: "कोई वजन दर्ज नहीं", bn: "কোনো ওজন লগ নেই", ta: "எடை பதிவுகள் இல்லை", te: "బరువులు నమోదు కాలేదు", mr: "वजन नोंदवले नाही", pa: "ਕੋਈ ਭਾਰ ਦਰਜ ਨਹੀਂ", or: "କୌଣସି ଓଜନ ନଥିଭୁକ୍ତ ନାହି" })} />
        : rows.map(r => (
            <RowCard key={r.id}
              left={<>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{r.weighed_at}</div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                  {r.sample_count} {tc({ en: "birds weighed", hi: "पक्षी तौले", bn: "পাখি ওজন করা", ta: "பறவைகள் தூக்கப்பட்டன", te: "పక్షులు తూచబడ్డాయి", mr: "पक्षी तोललेले", pa: "ਪੰਛੀ ਤੋਲੇ", or: "ପକ୍ଷୀ ଓଜନ ହେଲା" })}
                </div>
              </>}
              right={<>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.primary }}>
                  {r.average_weight_g != null && !Number.isNaN(Number(r.average_weight_g)) ? `${Number(r.average_weight_g).toFixed(0)} g` : "—"}
                </div>
                <div style={{ fontSize: 11, color: T.inkSoft }}>
                  {tc({ en: "avg / bird", hi: "औसत / पक्षी", bn: "গড় / পাখি", ta: "சராசரி / பறவை", te: "సగటు / పక్షి", mr: "सरासरी / पक्षी", pa: "ਔਸਤ / ਪੰਛੀ", or: "ସରାସରିBIRD" })}
                </div>
              </>}
              onDelete={canManage ? () => onDelete(r) : null}
            />
          ))
      }
    </div>
  );
}

function FeedTab({ rows, tc, canRecord, canManage, onAdd, onDelete }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {canRecord && (
        <AddRow label={tc({ en: "Log feed", hi: "चारा दर्ज करें", bn: "খাদ্য লগ করুন", ta: "தீவனம் நிவேதி", te: "దాణా లాగ్ చేయండి", mr: "खाद्य नोंदवा", pa: "ਚਾਰਾ ਦਰਜ ਕਰੋ", or: "ଖାଦ୍ୟ ନଥିଭୁକ୍ତ କରନ୍ତୁ" })} onClick={onAdd} />
      )}
      {rows.length === 0
        ? <EmptyState icon="Wheat"
            title={tc({ en: "No feed logged", hi: "कोई चारा दर्ज नहीं", bn: "কোনো খাদ্য লগ নেই", ta: "தீவனம் பதிவுகள் இல்லை", te: "దాణా నమోదు కాలేదు", mr: "खाद्य नोंदवले नाही", pa: "ਕੋਈ ਚਾਰਾ ਦਰਜ ਨਹੀਂ", or: "କୌଣସି ଖାଦ୍ୟ ନଥିଭୁକ୍ତ ନାହି" })} />
        : rows.map(r => (
            <RowCard key={r.id}
              left={<>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{r.logged_at}</div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                  {r.kind === "in"
                    ? tc({ en: "Received", hi: "प्राप्त", bn: "প্রাপ্ত", ta: "ஸ்வீகரிக்கப்பட்டது", te: "స్వీకరించబడింది", mr: "प्राप्त", pa: "ਪ੍ਰਾਪਤ", or: "ପ୍ରାପ୍ତ" })
                    : tc({ en: "Adjustment", hi: "समायोजन", bn: "সমন্বয়", ta: "சரிசெய்தல்", te: "సర్దుబాటు", mr: "समायोजन", pa: "ਸਮਾਯੋਜਨ", or: "ସମାୟଜନ" })}
                  {r.note ? ` · ${r.note}` : ""}
                </div>
              </>}
              right={<>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.orange }}>
                  {r.qty_kg} kg
                </div>
              </>}
              onDelete={canManage ? () => onDelete(r) : null}
            />
          ))
      }
    </div>
  );
}

const HEALTH_TYPE_ACCENT = { observation: "faint", treatment: "primary", vet_visit: "blue", outbreak: "orange" };
const HEALTH_TYPE_LABEL  = {
  observation: { en: "Observation", hi: "अवलोकन",       bn: "পর্যবেক্ষণ",  ta: "கண்காணிப்பு",               te: "పరిశీలన",                     mr: "निरीक्षण",     pa: "ਨਿਰੀਖਣ",               or: "ପର୍ୟବେକ୍ଷଣ" },
  treatment:   { en: "Treatment",   hi: "उपचार",         bn: "চিকিৎসা",     ta: "சிகிச்சை",                  te: "చికిత్స",                      mr: "उपचार",        pa: "ਇਲਾਜ",                  or: "ଉପଜାର" },
  vet_visit:   { en: "Vet visit",   hi: "पशु चिकित्सक", bn: "পশু চিকিৎসক", ta: "கால்நடை மருத்துவர் வருகை", te: "పశువైద్యుడి సందర్శన",          mr: "पशुवैद्य भेट", pa: "ਪਸ਼ੂ ਡਾਕਟਰ ਦੌਰਾ",       or: "ପଶୁଚିକିତ୍ସକ ଭେଟ" },
  outbreak:    { en: "Outbreak",    hi: "प्रकोप",        bn: "প্রাদুর্ভাব", ta: "தொற்றுநோய்",               te: "వ్యాప్తి",                      mr: "उद्रेक",       pa: "ਫੈਲਾਅ",                 or: "ସଂକ୍ରମଣ" },
};
const ROUTE_LABEL = {
  drinking_water: { en: "Drinking water", hi: "पीने का पानी", bn: "পানীয় জল",    ta: "குடிநீர்",    te: "తాగు నీరు",      mr: "पिण्याचे पाणी", pa: "ਪੀਣ ਵਾਲਾ ਪਾਣੀ",      or: "ପାନୀୟ ଜଳ" },
  spray:          { en: "Spray",          hi: "स्प्रे",       bn: "স্প্রে",        ta: "தெளிப்பு",    te: "స్ప్రే",         mr: "स्प्रे",        pa: "ਸਪ੍ਰੇ",               or: "ସ୍ପ୍ରେ" },
  eye_drop:       { en: "Eye drop",       hi: "आई ड्रॉप",    bn: "চোখের ড্রপ",   ta: "கண் சொட்டு", te: "కంటి చుక్కలు",  mr: "आय ड्रॉप",      pa: "ਅੱਖਾਂ ਦੀਆਂ ਬੂੰਦਾਂ",   or: "ଆଖିଜଳ" },
  injection:      { en: "Injection",      hi: "इंजेक्शन",    bn: "ইনজেকশন",      ta: "ஊசி",          te: "ఇంజెక్షన్",     mr: "इंजेक्शन",      pa: "ਟੀਕਾ",                or: "ଇନ୍ଜେକ୍ସନ୍" },
};

function HealthTab({ healthRows, vaccRows, tc, canRecord, canManage, onAddHealth, onAddVacc, onDeleteHealth, onDeleteVacc }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Health events section */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {tc({ en: "Health Events", hi: "स्वास्थ्य घटनाएँ", bn: "স্বাস্থ্য ইভেন্ট", ta: "சுகாதார நிகழ்வுகள்", te: "ఆరోగ్య సంఘటనలు", mr: "आरोग्य घटना", pa: "ਸਿਹਤ ਘਟਨਾਵਾਂ", or: "ସ୍ଵାସ୍ଥ୍ୟEVTS" })}
          </span>
        </div>
        {canRecord && (
          <AddRow label={tc({ en: "Add health event", hi: "स्वास्थ्य घटना जोड़ें", bn: "স্বাস্থ্য ইভেন্ট যোগ করুন", ta: "சுகாதார நிகழ்வு சேர்", te: "ఆరోగ్య సంఘటన జోడించండి", mr: "आरोग्य घटना जोडा", pa: "ਸਿਹਤ ਘਟਨਾ ਜੋੜੋ", or: "ସ୍ଵାସ୍ଥ୍ୟ ଘଟନା ଯୋଗ କରନ୍ତୁ" })} onClick={onAddHealth} />
        )}
        {healthRows.length === 0
          ? <EmptyState icon="Stethoscope"
              title={tc({ en: "No health events", hi: "कोई स्वास्थ्य घटना नहीं", bn: "কোনো স্বাস্থ্য ইভেন্ট নেই", ta: "சுகாதார நிகழ்வுகள் இல்லை", te: "ఆరోగ్య సంఘటనలు లేవు", mr: "कोणती आरोग्य घटना नाही", pa: "ਕੋਈ ਸਿਹਤ ਘਟਨਾਵਾਂ ਨਹੀਂ", or: "କୌଣସି ସ୍ଵାସ୍ଥ୍ୟ ଘଟନା ନାହି" })} />
          : healthRows.map(r => (
              <RowCard key={r.id}
                left={<>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Chip accent={HEALTH_TYPE_ACCENT[r.type] || "faint"} style={{ fontSize: 11 }}>
                      {tc(HEALTH_TYPE_LABEL[r.type] || { en: r.type, hi: r.type, bn: r.type })}
                    </Chip>
                    <span style={{ fontSize: 12.5, color: T.inkSoft }}>{r.event_date}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginTop: 4 }}>{r.title}</div>
                  {r.medicine && (
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                      {tc({ en: "Medicine", hi: "दवा", bn: "ওষুধ", ta: "மருந்து", te: "మందు", mr: "औषध", pa: "ਦਵਾਈ", or: "ଔଷଧ" })}: {r.medicine}
                      {r.dose ? ` — ${r.dose}` : ""}
                    </div>
                  )}
                  {r.note && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{r.note}</div>}
                </>}
                right={null}
                onDelete={canManage ? () => onDeleteHealth(r) : null}
              />
            ))
        }
      </div>

      {/* Vaccinations section */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {tc({ en: "Vaccinations", hi: "टीकाकरण", bn: "টিকাদান", ta: "தடுப்பூசிகள்", te: "టీకాలు", mr: "लसीकरणे", pa: "ਟੀਕਾਕਰਨ", or: "ଟିକାକରଣଗୁଡିକ" })}
          </span>
        </div>
        {canRecord && (
          <AddRow label={tc({ en: "Record vaccination", hi: "टीकाकरण दर्ज करें", bn: "টিকাদান রেকর্ড করুন", ta: "தடுப்பூசி பதிவு செய்", te: "టీకా రికార్డు చేయండి", mr: "लसीकरण नोंदवा", pa: "ਟੀਕਾਕਰਨ ਦਰਜ ਕਰੋ", or: "ଟିକା ନଥିଭୁକ୍ତ କରନ୍ତୁ" })} onClick={onAddVacc} />
        )}
        {vaccRows.length === 0
          ? <EmptyState icon="Syringe"
              title={tc({ en: "No vaccinations recorded", hi: "कोई टीकाकरण दर्ज नहीं", bn: "কোনো টিকাদান নেই", ta: "தடுப்பூசிகள் பதிவில்லை", te: "టీకాలు నమోదు కాలేదు", mr: "लसीकरणे नोंदवली नाहीत", pa: "ਕੋਈ ਟੀਕਾਕਰਨ ਦਰਜ ਨਹੀਂ", or: "କୌଣସି ଟିକାକରଣ ନଥିଭୁକ୍ତ" })} />
          : vaccRows.map(r => (
              <RowCard key={r.id}
                left={<>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{r.vaccine_name}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                    {r.given_at}
                    {r.route ? ` · ${tc(ROUTE_LABEL[r.route] || { en: r.route, hi: r.route, bn: r.route })}` : ""}
                    {r.dose ? ` · ${r.dose}` : ""}
                  </div>
                  {r.batch_lot && <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 1 }}>Lot: {r.batch_lot}</div>}
                  {r.note && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{r.note}</div>}
                </>}
                right={null}
                onDelete={canManage ? () => onDeleteVacc(r) : null}
              />
            ))
        }
      </div>
    </div>
  );
}
