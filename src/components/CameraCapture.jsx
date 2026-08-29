/* CameraCapture — full-screen camera UI or gallery picker.
   Calls onCapture(file) with a validated File object; calls onCancel() to dismiss. */

import { useEffect, useRef, useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import { useApp } from "../store/AppStore.jsx";
import Icon from "./Icon.jsx";
import { cameraService, FACING } from "../services/vision/cameraService.js";
import { galleryService }         from "../services/vision/galleryService.js";

export default function CameraCapture({ onCapture, onCancel }) {
  const { tc } = useApp();
  const videoRef      = useRef(null);
  const [mode,        setMode]        = useState("choose"); // "choose" | "camera" | "preview"
  const [flash,       setFlash]       = useState(false);
  const [flashCap,    setFlashCap]    = useState(false);
  const [capturing,   setCapturing]   = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [preview,     setPreview]     = useState(null); // { file, url }
  const [error,       setError]       = useState("");

  useEffect(() => () => { cameraService.stop(); }, []);

  /* ── Camera ──────────────────────────────────────────────────────────────── */

  const startCamera = async () => {
    if (!cameraService.isSupported()) {
      setError("Camera not available on this device. Use gallery instead.");
      return;
    }
    setMode("camera");
    setError("");
    try {
      await cameraService.start(videoRef.current);
      setCameraReady(true);
      setFlashCap(!!(cameraService.getCapabilities().torch));
    } catch {
      setError("Camera permission denied. Please allow camera access and try again.");
      setMode("choose");
    }
  };

  const toggleFlash = async () => {
    const next = !flash;
    await cameraService.setFlash(next);
    setFlash(next);
  };

  const switchCam = () => cameraService.switchCamera(videoRef.current);

  const captureFrame = async () => {
    if (capturing || !cameraReady) return;
    setCapturing(true);
    try {
      const blob = await cameraService.capture(videoRef.current);
      const file = galleryService.blobToFile(blob);
      const url  = URL.createObjectURL(blob);
      await cameraService.stop();
      setCameraReady(false);
      setPreview({ file, url });
      setMode("preview");
    } catch (err) {
      setError("Capture failed: " + err.message);
    } finally {
      setCapturing(false);
    }
  };

  const handleTapFocus = (e) => {
    if (!cameraReady || !videoRef.current) return;
    cameraService.tapFocus(videoRef.current, e.clientX, e.clientY);
  };

  /* ── Gallery ─────────────────────────────────────────────────────────────── */

  const openGallery = async () => {
    const { file, valid, error: err } = await galleryService.pickAndValidate();
    if (!file) return;
    if (!valid) { setError(err); return; }
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    setMode("preview");
    setError("");
  };

  /* ── Preview ─────────────────────────────────────────────────────────────── */

  const confirmCapture = () => {
    if (!preview) return;
    onCapture(preview.file);
    URL.revokeObjectURL(preview.url);
    setPreview(null);
    setMode("choose");
  };

  const retake = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setMode("choose");
    setError("");
  };

  const cancel = () => {
    cameraService.stop();
    if (preview?.url) URL.revokeObjectURL(preview.url);
    onCancel?.();
  };

  /* ── Render ──────────────────────────────────────────────────────────────── */

  if (mode === "preview" && preview) {
    return (
      <div style={overlay}>
        <img src={preview.url} alt={tc({ en: "Preview", hi: "पूर्वावलोकन", bn: "প্রিভিউ" })}
          style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 12 }} />
        <div style={{ display: "flex", gap: 16, marginTop: 28 }}>
          <button onClick={retake}      style={btnSecondary}>{tc({ en: "Retake", hi: "फिर लें", bn: "আবার তুলুন" })}</button>
          <button onClick={confirmCapture} style={btnPrimary}>{tc({ en: "Use Photo", hi: "यह फ़ोटो लें", bn: "এই ছবি নিন" })}</button>
        </div>
        <button onClick={cancel} aria-label={tc({ en: "Close", hi: "बंद करें", bn: "বন্ধ করুন" })} style={closeBtn}>
          <Icon name="X" size={20} />
        </button>
      </div>
    );
  }

  if (mode === "camera") {
    return (
      <div style={{ ...overlay, padding: 0 }}>
        <video ref={videoRef} playsInline muted autoPlay onClick={handleTapFocus}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />

        {/* top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex",
          justifyContent: "space-between", padding: "20px",
          background: "linear-gradient(to bottom, rgba(0,0,0,.6), transparent)" }}>
          <button onClick={cancel} aria-label={tc({ en: "Close", hi: "बंद करें", bn: "বন্ধ করুন" })} style={camBtn}>
            <Icon name="X" size={22} />
          </button>
          {flashCap && (
            <button onClick={toggleFlash} aria-label={tc({ en: "Flash", hi: "फ़्लैश", bn: "ফ্ল্যাশ" })}
              style={{ ...camBtn, background: flash ? "rgba(255,220,0,.85)" : "rgba(0,0,0,.4)",
                color: flash ? "#000" : "#fff" }}>
              <Icon name="Zap" size={22} />
            </button>
          )}
        </div>

        {/* bottom bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0,
          display: "flex", alignItems: "center", justifyContent: "space-around",
          padding: "30px 40px calc(40px + env(safe-area-inset-bottom))",
          background: "linear-gradient(to top, rgba(0,0,0,.7), transparent)" }}>
          <button onClick={openGallery} aria-label={tc({ en: "Gallery", hi: "गैलरी", bn: "গ্যালারি" })} style={camBtn}>
            <Icon name="ImagePlus" size={26} />
          </button>
          <button onClick={captureFrame} disabled={capturing || !cameraReady} aria-label={tc({ en: "Take photo", hi: "फ़ोटो लें", bn: "ছবি তুলুন" })}
            style={{ width: 72, height: 72, borderRadius: "50%", border: "4px solid #fff",
              background: capturing ? "rgba(255,255,255,.5)" : "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: capturing ? "scale(.92)" : "scale(1)", transition: "transform .1s" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: capturing ? T.primary : "#e0e0e0" }} />
          </button>
          <button onClick={switchCam} aria-label={tc({ en: "Switch camera", hi: "कैमरा बदलें", bn: "ক্যামেরা বদলান" })} style={camBtn}>
            <Icon name="FlipHorizontal2" size={26} />
          </button>
        </div>
      </div>
    );
  }

  /* choose mode */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && (
        <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderRadius: 12,
          background: T.redSoft, border: `1px solid ${T.red}33` }}>
          <Icon name="AlertCircle" size={15} style={{ color: T.red, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: T.red }}>{error}</span>
        </div>
      )}

      <ChoiceRow icon="Camera" onClick={startCamera}
        label={tc({ en: "Take a photo", hi: "फ़ोटो लें", bn: "ছবি তুলুন" })}
        sub={tc({ en: "Use your camera", hi: "अपना कैमरा इस्तेमाल करें", bn: "আপনার ক্যামেরা ব্যবহার করুন" })} />
      {/* The format list stays as-is: they are file-format names, not words. */}
      <ChoiceRow icon="ImagePlus" onClick={openGallery} sub="JPEG, PNG, WEBP, HEIC"
        label={tc({ en: "Choose from gallery", hi: "गैलरी से चुनें", bn: "গ্যালারি থেকে বাছুন" })} />

      {onCancel && (
        <button onClick={cancel}
          style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft,
            fontFamily: T.body, fontSize: 14, padding: 10, marginTop: 4 }}>
          Cancel
        </button>
      )}
    </div>
  );
}

function ChoiceRow({ icon, label, sub, onClick }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
        background: T.surface, border: `1.5px solid ${T.line}`, borderRadius: T.rLg,
        cursor: "pointer", fontFamily: T.body, textAlign: "left", width: "100%" }}>
      <div style={{ width: 44, height: 44, borderRadius: 13, background: T.primarySoft,
        display: "grid", placeItems: "center", color: T.primary, flexShrink: 0 }}>
        <Icon name={icon} size={22} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{label}</div>
        <div style={{ fontSize: 12.5, color: T.inkSoft }}>{sub}</div>
      </div>
      <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint, marginLeft: "auto" }} />
    </button>
  );
}

const overlay = {
  position: "fixed", inset: 0, zIndex: 200,
  background: "#000",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  padding: 24,
};

const closeBtn = {
  position: "absolute", top: 20, right: 20,
  background: "rgba(0,0,0,.5)", border: "none", borderRadius: 999,
  padding: 10, cursor: "pointer", color: "#fff", display: "flex",
};

const camBtn = {
  background: "rgba(0,0,0,.4)", border: "none", borderRadius: 999,
  padding: 10, cursor: "pointer", color: "#fff", display: "flex",
};

const btnPrimary = {
  background: T.primary, border: "none", borderRadius: 16,
  padding: "14px 32px", cursor: "pointer", color: "#fff",
  fontFamily: T.body, fontSize: 15, fontWeight: 600,
};

const btnSecondary = {
  background: "rgba(255,255,255,.15)", border: "none", borderRadius: 16,
  padding: "14px 32px", cursor: "pointer", color: "#fff",
  fontFamily: T.body, fontSize: 15, fontWeight: 600,
};
