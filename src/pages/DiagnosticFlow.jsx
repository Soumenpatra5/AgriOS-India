import { useRef, useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Button } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import CameraCapture from "../components/CameraCapture.jsx";
import SymptomChecklist from "../components/SymptomChecklist.jsx";
import { domainRegistry } from "../services/diagnostics/domainRegistry.js";
import { orchestrator } from "../services/diagnostics/orchestrator.js";
import { consentService } from "../services/diagnostics/consentService.js";

const STEPS_I18N = [
  {en:"Species", hi:"प्रजाति", bn:"প্রজাতি"},
  {en:"Photo", hi:"फोटो", bn:"ছবি"},
  {en:"Symptoms", hi:"लक्षण", bn:"লক্ষণ"},
  {en:"Analyze", hi:"विश्लेषण", bn:"বিশ্লেষণ"},
];

export default function DiagnosticFlow({ domainId }) {
  const { pop, push, toast, lang, tc } = useApp();
  const domain = domainRegistry.get(domainId);

  const [step,           setStep]           = useState(0); // 0-3
  const [species,        setSpecies]        = useState("");
  const [imageFile,      setImageFile]      = useState(null);
  const [imagePreview,   setImagePreview]   = useState(null);
  const [cameraOpen,     setCameraOpen]     = useState(false);
  const [answers,        setAnswers]        = useState({});
  const [notes,          setNotes]          = useState("");
  const [analyzing,      setAnalyzing]      = useState(false);
  const previewUrlRef    = useRef(null);

  if (!domain) return null;

  // Ensure consent before proceeding to Step 2+
  const grantConsent = () => {
    consentService.grantAll();
  };

  const handleCapture = (file) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setImageFile(file);
    setImagePreview(url);
    setCameraOpen(false);
  };

  const removeImage = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setImageFile(null);
    setImagePreview(null);
  };

  const canProceed = () => {
    if (step === 0) return true;             // species is optional
    if (step === 1) return true;             // image is optional (text-only ok)
    if (step === 2) return true;             // symptoms are optional
    return false;
  };

  const next = () => {
    if (step < STEPS_I18N.length - 2) { setStep((s) => s + 1); return; }
    runAnalysis();
  };

  const runAnalysis = async () => {
    grantConsent();
    setAnalyzing(true);
    setStep(3);
    try {
      const record = await orchestrator.analyze({
        domainId,
        imageFile,
        symptoms:        answers,
        species,
        additionalNotes: notes,
        lang,
      });
      if (record.queued) {
        toast(tc({en:"You're offline — saved. We'll analyze it and add it to your history when you reconnect.", hi:"आप ऑफ़लाइन हैं — सहेजा गया। दोबारा कनेक्ट होने पर विश्लेषण कर इतिहास में जोड़ देंगे।", bn:"আপনি অফলাইন — সংরক্ষিত। পুনরায় সংযুক্ত হলে বিশ্লেষণ করে ইতিহাসে যোগ করা হবে।"}), "info");
        pop();
        return;
      }
      push({ kind: "diagnosticResult", props: { record } });
    } catch (err) {
      toast(tc({en:"Diagnosis failed — please try again", hi:"निदान विफल — पुनः प्रयास करें", bn:"রোগ নির্ণয় ব্যর্থ — আবার চেষ্টা করুন"}), "error");
      setStep(2);
    } finally {
      setAnalyzing(false);
    }
  };

  /* ── Render ──────────────────────────────────────────────────────────────── */

  return (
    <>
      {cameraOpen && (
        <CameraCapture onCapture={handleCapture} onCancel={() => setCameraOpen(false)} />
      )}

      <AppBar title={domain.name} onBack={analyzing ? undefined : pop} />

      <div style={{ padding: "16px 16px 100px", animation: "ag-fade .22s var(--ag-ease)" }}>

        {/* Step indicator */}
        <StepBar steps={STEPS_I18N.map(s => tc(s))} current={step} />

        {/* ── Step 0: Species ──────────────────────────────────────────────── */}
        {step === 0 && (
          <StepSection title={tc({en:"Select Species / Crop", hi:"प्रजाति / फसल चुनें", bn:"প্রজাতি / ফসল নির্বাচন করুন"})} subtitle={tc({en:"Choose what you want to diagnose", hi:"निदान करने के लिए चुनें", bn:"রোগ নির্ণয়ের জন্য নির্বাচন করুন"})}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {domain.species.map((sp) => (
                <button key={sp} onClick={() => setSpecies(species === sp ? "" : sp)}
                  style={{
                    padding: "12px 16px", borderRadius: T.rLg, cursor: "pointer",
                    fontFamily: T.body, fontSize: 14, textAlign: "left",
                    border: `1.5px solid ${species === sp ? "var(--ag-primary)" : T.line}`,
                    background: species === sp ? "var(--ag-primary-soft)" : T.surface,
                    color: species === sp ? "var(--ag-primary)" : T.ink,
                    fontWeight: species === sp ? 600 : 400,
                  }}>
                  {sp}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: T.inkFaint, marginTop: 12 }}>
              {tc({en:"Optional — skip if unsure", hi:"वैकल्पिक — अनिश्चित हों तो छोड़ दें", bn:"ঐচ্ছিক — নিশ্চিত না হলে এড়িয়ে যান"})}
            </p>
          </StepSection>
        )}

        {/* ── Step 1: Photo ────────────────────────────────────────────────── */}
        {step === 1 && (
          <StepSection title={tc({en:"Attach a Photo", hi:"फोटो जोड़ें", bn:"ছবি সংযুক্ত করুন"})} subtitle={tc({en:"A clear photo significantly improves accuracy", hi:"स्पष्ट फोटो सटीकता बहुत बढ़ाती है", bn:"স্পষ্ট ছবি নির্ভুলতা অনেক বাড়ায়"})}>
            {imagePreview ? (
              <div style={{ position: "relative" }}>
                <img src={imagePreview} alt="Captured" style={{ width: "100%", borderRadius: T.rLg, maxHeight: 260, objectFit: "cover" }} />
                <button onClick={removeImage} style={{ position: "absolute", top: 8, right: 8,
                  background: "rgba(0,0,0,.6)", border: "none", borderRadius: 999,
                  padding: 8, cursor: "pointer", color: "#fff", display: "flex" }}>
                  <Icon name="X" size={16} />
                </button>
                <button onClick={() => setCameraOpen(true)}
                  style={{ position: "absolute", bottom: 8, right: 8,
                    background: "rgba(0,0,0,.6)", border: "none", borderRadius: 12,
                    padding: "7px 12px", cursor: "pointer", color: "#fff",
                    display: "flex", gap: 6, alignItems: "center", fontSize: 12, fontFamily: T.body }}>
                  <Icon name="Camera" size={14} /> {tc({en:"Retake", hi:"फिर से लें", bn:"আবার তুলুন"})}
                </button>
              </div>
            ) : (
              <button onClick={() => setCameraOpen(true)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                  padding: "36px 20px", borderRadius: T.rLg, cursor: "pointer",
                  background: T.surface, border: `2px dashed ${T.line}`, width: "100%" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--ag-primary-soft)",
                  display: "grid", placeItems: "center" }}>
                  <Icon name="ImagePlus" size={26} style={{ color: "var(--ag-primary)" }} />
                </div>
                <div style={{ fontFamily: T.body }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{tc({en:"Take or choose a photo", hi:"फोटो लें या चुनें", bn:"ছবি তুলুন বা বাছুন"})}</div>
                  <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 4 }}>{tc({en:"Camera or gallery — JPEG, PNG, WEBP", hi:"कैमरा या गैलरी — JPEG, PNG, WEBP", bn:"ক্যামেরা বা গ্যালারি — JPEG, PNG, WEBP"})}</div>
                </div>
              </button>
            )}
            <p style={{ fontSize: 12, color: T.inkFaint, marginTop: 10 }}>
              {tc({en:"Skip to proceed without a photo (text-based diagnosis only)", hi:"फोटो के बिना आगे बढ़ें (केवल टेक्स्ट निदान)", bn:"ছবি ছাড়া এগিয়ে যান (শুধু টেক্সট রোগ নির্ণয়)"})}
            </p>
          </StepSection>
        )}

        {/* ── Step 2: Symptoms ─────────────────────────────────────────────── */}
        {step === 2 && (
          <StepSection title={tc({en:"Describe Symptoms", hi:"लक्षण बताएँ", bn:"লক্ষণ বর্ণনা করুন"})} subtitle={tc({en:"Select what you observe", hi:"जो आप देखते हैं वह चुनें", bn:"আপনি যা দেখছেন তা নির্বাচন করুন"})}>
            <SymptomChecklist symptoms={domain.symptoms} answers={answers} onChange={setAnswers} />

            <div style={{ marginTop: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>
                {tc({en:"Any other details?", hi:"कोई अन्य विवरण?", bn:"অন্য কোনো বিবরণ?"})}
              </label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={tc({en:"E.g. started after rain, only in one corner, animals from new batch…", hi:"जैसे बारिश के बाद शुरू हुआ, केवल एक कोने में, नए बैच के जानवर…", bn:"যেমন বৃষ্টির পরে শুরু হয়েছে, শুধু এক কোণায়, নতুন ব্যাচের পশু…"})}
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: T.rMd,
                  border: `1px solid ${T.line}`, background: T.surface, color: T.ink,
                  fontFamily: T.body, fontSize: 14, resize: "none", boxSizing: "border-box", outline: "none" }} />
            </div>
          </StepSection>
        )}

        {/* ── Step 3: Analyzing ────────────────────────────────────────────── */}
        {step === 3 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, margin: "0 auto 20px",
              background: "var(--ag-primary-soft)", display: "grid", placeItems: "center",
              animation: "ag-blink 1.4s infinite" }}>
              <Icon name="Microscope" size={34} style={{ color: "var(--ag-primary)" }} />
            </div>
            <div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700, color: T.ink, marginBottom: 8 }}>
              {tc({en:"Analyzing…", hi:"विश्लेषण हो रहा है…", bn:"বিশ্লেষণ হচ্ছে…"})}
            </div>
            <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.6 }}>
              {tc({en:"AI is reviewing your image and symptoms.", hi:"AI आपकी छवि और लक्षणों की समीक्षा कर रहा है।", bn:"AI আপনার ছবি ও লক্ষণ পর্যালোচনা করছে।"})}<br />
              {tc({en:"Gathering weather, farm, and knowledge context.", hi:"मौसम, खेत और ज्ञान संदर्भ एकत्र कर रहा है।", bn:"আবহাওয়া, খামার ও জ্ঞান প্রসঙ্গ সংগ্রহ করছে।"})}
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {step < 3 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 25,
          display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 460, background: T.bg,
            borderTop: `1px solid ${T.lineSoft}`,
            padding: "12px 16px calc(16px + env(safe-area-inset-bottom))",
            display: "flex", gap: 10 }}>
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)}
                style={{ flex: "0 0 auto", background: T.surface, border: `1px solid ${T.line}`,
                  borderRadius: T.rLg, padding: "12px 20px", cursor: "pointer",
                  fontFamily: T.body, fontSize: 14.5, color: T.ink }}>
                {tc({en:"Back", hi:"पीछे", bn:"পিছনে"})}
              </button>
            )}
            <Button full onClick={next}>
              {step === STEPS_I18N.length - 2 ? tc({en:"Start Diagnosis", hi:"निदान शुरू करें", bn:"রোগ নির্ণয় শুরু করুন"}) : tc({en:"Continue", hi:"आगे बढ़ें", bn:"এগিয়ে যান"})}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function StepBar({ steps, current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 28 }}>
      {steps.map((label, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? "1 1 0" : "0 0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              background: i < current ? "var(--ag-primary)" : i === current ? "var(--ag-primary)" : T.line,
              display: "grid", placeItems: "center",
              border: i === current ? `2px solid var(--ag-primary)` : "none",
            }}>
              {i < current
                ? <Icon name="Check" size={12} style={{ color: "#fff" }} />
                : <span style={{ fontSize: 11, fontWeight: 700,
                    color: i === current ? "#fff" : T.inkFaint }}>{i + 1}</span>}
            </div>
            <span style={{ fontSize: 11, fontWeight: i === current ? 700 : 400,
              color: i === current ? "var(--ag-primary)" : T.inkFaint,
              whiteSpace: "nowrap" }}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 1, background: i < current ? "var(--ag-primary)" : T.line, margin: "0 6px" }} />
          )}
        </div>
      ))}
    </div>
  );
}

function StepSection({ title, subtitle, children }) {
  return (
    <div>
      <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 20 }}>{subtitle}</div>}
      {children}
    </div>
  );
}
