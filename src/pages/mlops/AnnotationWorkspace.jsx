import { useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import AnnotationCanvas from "../../components/mlops/AnnotationCanvas.jsx";
import { annotationService, ANNOTATION_TYPES } from "../../services/mlops/annotations/annotationService.js";
import { annotationQueue } from "../../services/mlops/annotations/annotationQueue.js";
import { galleryService } from "../../services/vision/galleryService.js";

const QUICK_LABELS = ["Healthy", "Disease", "Pest", "Deficiency", "Stress", "Unknown"];

export default function AnnotationWorkspace({ datasetId }) {
  const { pop, tc, toast } = useApp();
  const [imageUrl, setImageUrl] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [mode, setMode] = useState("bbox");
  const [currentLabel, setCurrentLabel] = useState("Disease");
  const [classificationLabels, setClassificationLabels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(0);

  const pickImage = async () => {
    try {
      const file = await galleryService.pickAndValidate();
      if (!file) return;
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
      setAnnotations([]);
    } catch (err) {
      toast(err.message, "info");
    }
  };

  const handleAnnotation = (ann) => {
    setAnnotations((prev) => [...prev, ann]);
  };

  const removeAnnotation = (idx) => {
    setAnnotations((prev) => prev.filter((_, i) => i !== idx));
  };

  const labelText = (l) => {
    const map = {
      Healthy: { en: "Healthy", hi: "स्वस्थ", bn: "সুস্থ" },
      Disease: { en: "Disease", hi: "रोग", bn: "রোগ" },
      Pest: { en: "Pest", hi: "कीट", bn: "পোকা" },
      Deficiency: { en: "Deficiency", hi: "कमी", bn: "ঘাটতি" },
      Stress: { en: "Stress", hi: "तनाव", bn: "চাপ" },
      Unknown: { en: "Unknown", hi: "अज्ञात", bn: "অজানা" },
    };
    return map[l] ? tc(map[l]) : l;
  };

  const toggleClassLabel = (label) => {
    setClassificationLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const save = async () => {
    if (!imageUrl) return;
    setSaving(true);
    try {
      const imageId = `img-${Date.now()}`;
      const entries = [];

      if (mode === "bbox" && annotations.length > 0) {
        for (const ann of annotations) {
          entries.push({ datasetId, imageId, imageUrl, type: ANNOTATION_TYPES.BOUNDING_BOX, labels: ann.labels, geometry: ann.geometry });
        }
      }
      if (mode === "classify" && classificationLabels.length > 0) {
        entries.push({ datasetId, imageId, imageUrl, type: ANNOTATION_TYPES.IMAGE_CLASSIFICATION, labels: classificationLabels, geometry: null });
      }
      if (mode === "multilabel" && classificationLabels.length > 0) {
        entries.push({ datasetId, imageId, imageUrl, type: ANNOTATION_TYPES.MULTI_LABEL, labels: classificationLabels, geometry: null });
      }

      const saved_ann = await annotationService.bulkSave(entries);
      for (const ann of saved_ann) {
        await annotationQueue.submit(ann.id);
      }
      setSaved((n) => n + entries.length);
      setAnnotations([]);
      setClassificationLabels([]);
      setImageUrl(null);
      setImageFile(null);
    } catch (err) {
      toast(tc({ en: "Save failed: ", hi: "सहेजना विफल: ", bn: "সংরক্ষণ ব্যর্থ হয়েছে: " }) + err.message, "info");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppBar title={tc({ en: "Annotation Workspace", hi: "एनोटेशन वर्कस्पेस", bn: "অ্যানোটেশন ওয়ার্কস্পেস" })} onBack={pop} />
      <div style={{ padding: "12px 16px 32px", animation: "ag-fade .22s var(--ag-ease)" }}>

        {saved > 0 && (
          <div style={{ background: "#dcfce7", border: "1px solid #22c55e", borderRadius: T.rMd,
            padding: "8px 14px", marginBottom: 12, fontSize: 13, color: "#166534", fontWeight: 600 }}>
            ✓ {saved} {saved !== 1
              ? tc({ en: "annotations submitted for review", hi: "एनोटेशन समीक्षा के लिए सबमिट किए गए", bn: "অ্যানোটেশন পর্যালোচনার জন্য জমা দেওয়া হয়েছে" })
              : tc({ en: "annotation submitted for review", hi: "एनोटेशन समीक्षा के लिए सबमिट किया गया", bn: "অ্যানোটেশন পর্যালোচনার জন্য জমা দেওয়া হয়েছে" })}
          </div>
        )}

        {/* Mode selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[
            { id: "bbox",      label: tc({ en: "Bounding Box", hi: "बाउंडिंग बॉक्स", bn: "বাউন্ডিং বক্স" }), icon: "Crosshair" },
            { id: "classify",  label: tc({ en: "Classify", hi: "वर्गीकृत करें", bn: "শ্রেণীবদ্ধ করুন" }),     icon: "Tag" },
            { id: "multilabel",label: tc({ en: "Multi-label", hi: "मल्टी-लेबल", bn: "মাল্টি-লেবেল" }),  icon: "ListFilter" },
          ].map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              flex: 1, padding: "8px 4px", borderRadius: T.rMd, fontSize: 11, cursor: "pointer", fontFamily: T.body,
              fontWeight: mode === m.id ? 700 : 400,
              border: `1.5px solid ${mode === m.id ? "var(--ag-primary)" : T.line}`,
              background: mode === m.id ? "var(--ag-primary-soft)" : T.surface,
              color: mode === m.id ? "var(--ag-primary)" : T.inkSoft,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            }}>
              <Icon name={m.icon} size={14} color={mode === m.id ? "var(--ag-primary)" : T.inkSoft} />
              {m.label}
            </button>
          ))}
        </div>

        {/* Image area */}
        {!imageUrl ? (
          <button onClick={pickImage} style={{
            width: "100%", aspectRatio: "4/3", border: `2px dashed ${T.line}`, borderRadius: T.rLg,
            background: T.surface, cursor: "pointer", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14,
          }}>
            <Icon name="Upload" size={28} color={T.inkFaint} />
            <span style={{ fontSize: 14, color: T.inkSoft, fontFamily: T.body }}>{tc({ en: "Tap to select image", hi: "छवि चुनने के लिए टैप करें", bn: "ছবি নির্বাচন করতে ট্যাপ করুন" })}</span>
          </button>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <AnnotationCanvas imageUrl={imageUrl} annotations={annotations}
              onAnnotation={mode === "bbox" ? handleAnnotation : null}
              mode={mode} label={currentLabel} />
          </div>
        )}

        {/* Label selector */}
        {mode === "bbox" && imageUrl && (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>{tc({ en: "Current Label", hi: "वर्तमान लेबल", bn: "বর্তমান লেবেল" })}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {QUICK_LABELS.map((l) => (
                <button key={l} onClick={() => setCurrentLabel(l)} style={{
                  padding: "5px 12px", borderRadius: 99, fontSize: 12, cursor: "pointer",
                  border: `1.5px solid ${currentLabel === l ? "var(--ag-primary)" : T.line}`,
                  background: currentLabel === l ? "var(--ag-primary-soft)" : T.surface,
                  color: currentLabel === l ? "var(--ag-primary)" : T.inkSoft,
                  fontWeight: currentLabel === l ? 600 : 400, fontFamily: T.body,
                }}>
                  {labelText(l)}
                </button>
              ))}
            </div>
          </>
        )}

        {(mode === "classify" || mode === "multilabel") && imageUrl && (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>{tc({ en: "Select Labels", hi: "लेबल चुनें", bn: "লেবেল নির্বাচন করুন" })}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {QUICK_LABELS.map((l) => (
                <button key={l} onClick={() => mode === "classify" ? setClassificationLabels([l]) : toggleClassLabel(l)}
                  style={{
                    padding: "5px 12px", borderRadius: 99, fontSize: 12, cursor: "pointer",
                    border: `1.5px solid ${classificationLabels.includes(l) ? "var(--ag-primary)" : T.line}`,
                    background: classificationLabels.includes(l) ? "var(--ag-primary-soft)" : T.surface,
                    color: classificationLabels.includes(l) ? "var(--ag-primary)" : T.inkSoft,
                    fontWeight: classificationLabels.includes(l) ? 600 : 400, fontFamily: T.body,
                  }}>
                  {labelText(l)}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Annotation list */}
        {mode === "bbox" && annotations.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>
              {annotations.length} {annotations.length !== 1
                ? tc({ en: "boxes", hi: "बॉक्स", bn: "বক্স" })
                : tc({ en: "box", hi: "बॉक्स", bn: "বক্স" })}
            </div>
            {annotations.map((ann, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "6px 10px", background: T.surface, borderRadius: T.rMd, border: `1px solid ${T.line}`, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: T.ink }}>{ann.labels[0] ? labelText(ann.labels[0]) : tc({ en: "unlabeled", hi: "अलेबल", bn: "লেবেলবিহীন" })}</span>
                <button onClick={() => removeAnnotation(i)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 2 }}>
                  <Icon name="X" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Save button */}
        {imageUrl && (
          <button onClick={save} disabled={saving}
            style={{ width: "100%", padding: "12px", borderRadius: T.rMd, border: "none",
              background: saving ? T.line : "var(--ag-primary)", color: "#fff",
              fontWeight: 700, cursor: saving ? "default" : "pointer", fontSize: 15, fontFamily: T.body }}>
            {saving
              ? tc({ en: "Saving…", hi: "सहेजा जा रहा है…", bn: "সংরক্ষণ করা হচ্ছে…" })
              : tc({ en: "Submit for Review", hi: "समीक्षा के लिए सबमिट करें", bn: "পর্যালোচনার জন্য জমা দিন" })}
          </button>
        )}

        {imageUrl && (
          <button onClick={pickImage} style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: T.rMd,
            border: `1px solid ${T.line}`, background: T.surface, color: T.ink,
            cursor: "pointer", fontSize: 14, fontFamily: T.body }}>
            {tc({ en: "Change Image", hi: "छवि बदलें", bn: "ছবি পরিবর্তন করুন" })}
          </button>
        )}
      </div>
    </>
  );
}
