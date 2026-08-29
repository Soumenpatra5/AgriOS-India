/* Attachment picker for the Add/Edit document sheets (brief §1, §2, §26).

   Three ways in, because a farmer photographing a land deed in a field and one
   attaching a PDF a bank emailed them are different situations:
     Camera  — capture="environment" opens the rear camera directly
     Gallery — an image-only picker
     File    — everything accepted, for PDFs

   Validation runs the moment a file is chosen, so a bad file is refused before
   the farmer fills in the rest of the form and taps Save. */

import { useRef, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../Icon.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { validateFile, REJECT } from "../../services/documents/fileValidation.js";
import { acceptAttr, MAX_DOCUMENT_SIZE_MB } from "../../services/documents/documentConfig.js";

const kb = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

function reasonText(tc, r) {
  switch (r?.reason) {
    case REJECT.EMPTY:
      return tc({ en: "That file is empty.", hi: "यह फ़ाइल खाली है।", bn: "এই ফাইলটি খালি।" });
    case REJECT.TOO_LARGE:
      return tc({
        en: `Too large — the limit is ${r.limitMb} MB.`,
        hi: `बहुत बड़ी — सीमा ${r.limitMb} MB है।`,
        bn: `খুব বড় — সীমা ${r.limitMb} MB।`,
      });
    case REJECT.BAD_EXTENSION:
    case REJECT.BAD_MIME:
      return tc({
        en: "Only PDF, JPG, PNG and WEBP files can be attached.",
        hi: "केवल PDF, JPG, PNG और WEBP फ़ाइलें जोड़ी जा सकती हैं।",
        bn: "শুধু PDF, JPG, PNG ও WEBP ফাইল যোগ করা যায়।",
      });
    case REJECT.CONTENT_MISMATCH:
      return tc({
        en: "This file's contents don't match its name. It may be damaged or renamed.",
        hi: "इस फ़ाइल की सामग्री उसके नाम से मेल नहीं खाती। यह खराब या नाम-बदली हो सकती है।",
        bn: "এই ফাইলের ভিতরের তথ্য তার নামের সঙ্গে মিলছে না। এটি নষ্ট বা নাম-বদলানো হতে পারে।",
      });
    default:
      return tc({
        en: "That file could not be read.",
        hi: "यह फ़ाइल पढ़ी नहीं जा सकी।",
        bn: "ফাইলটি পড়া যায়নি।",
      });
  }
}

function Btn({ icon, label, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "10px 8px", borderRadius: T.rMd, cursor: disabled ? "default" : "pointer",
        border: `1px solid ${T.line}`, background: T.surface2, color: T.ink,
        fontFamily: T.body, fontSize: 12.5, fontWeight: 600, opacity: disabled ? .5 : 1 }}>
      <Icon name={icon} size={15} /> {label}
    </button>
  );
}

export default function FilePicker({ file, onPick, progress = null, disabled = false, hint = "" }) {
  const { tc } = useApp();
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const camera = useRef(null), gallery = useRef(null), any = useRef(null);

  const choose = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after a rejection
    if (!picked) return;
    setError(null); setChecking(true);
    try {
      const result = await validateFile(picked);
      if (!result.ok) { setError(result); onPick(null); return; }
      onPick(picked, result);
    } finally { setChecking(false); }
  };

  const uploading = progress !== null && progress < 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft }}>
        {tc({ en: "Attachment", hi: "संलग्नक", bn: "সংযুক্তি" })}
      </div>

      {!file ? (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn icon="Camera" label={tc({ en: "Camera", hi: "कैमरा", bn: "ক্যামেরা" })} onClick={() => camera.current?.click()} disabled={disabled || checking} />
            <Btn icon="Image" label={tc({ en: "Gallery", hi: "गैलरी", bn: "গ্যালারি" })} onClick={() => gallery.current?.click()} disabled={disabled || checking} />
            <Btn icon="Paperclip" label={tc({ en: "File", hi: "फ़ाइल", bn: "ফাইল" })} onClick={() => any.current?.click()} disabled={disabled || checking} />
          </div>
          <div style={{ fontSize: 11, color: T.inkFaint }}>
            {hint || tc({
              en: `PDF, JPG, PNG or WEBP · up to ${MAX_DOCUMENT_SIZE_MB} MB · optional`,
              hi: `PDF, JPG, PNG या WEBP · ${MAX_DOCUMENT_SIZE_MB} MB तक · वैकल्पिक`,
              bn: `PDF, JPG, PNG বা WEBP · ${MAX_DOCUMENT_SIZE_MB} MB পর্যন্ত · ঐচ্ছিক`,
            })}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
          background: T.surface2, borderRadius: T.rMd, border: `1px solid ${T.line}` }}>
          <Icon name={file.type === "application/pdf" ? "FileText" : "Image"} size={18} style={{ color: T.primary, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
            <div style={{ fontSize: 11.5, color: T.inkSoft }}>
              {kb(file.size)}
              {uploading && ` · ${tc({ en: "Uploading", hi: "अपलोड हो रहा है", bn: "আপলোড হচ্ছে" })} ${progress}%`}
              {progress === 100 && ` · ${tc({ en: "Ready", hi: "तैयार", bn: "প্রস্তুত" })}`}
            </div>
            {uploading && (
              <div style={{ height: 3, background: T.line, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: T.primary, transition: "width .2s linear" }} />
              </div>
            )}
          </div>
          {!disabled && (
            <button type="button" onClick={() => { setError(null); onPick(null); }}
              aria-label={tc({ en: "Remove file", hi: "फ़ाइल हटाएँ", bn: "ফাইল সরান" })}
              style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 4 }}>
              <Icon name="X" size={16} />
            </button>
          )}
        </div>
      )}

      {checking && (
        <div style={{ fontSize: 11.5, color: T.inkSoft }}>
          {tc({ en: "Checking file…", hi: "फ़ाइल जाँची जा रही है…", bn: "ফাইল যাচাই করা হচ্ছে…" })}
        </div>
      )}
      {error && (
        <div style={{ fontSize: 11.5, color: T.red, display: "flex", gap: 6, alignItems: "flex-start" }}>
          <Icon name="TriangleAlert" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{reasonText(tc, error)}</span>
        </div>
      )}

      <input ref={camera}  type="file" accept="image/*" capture="environment" onChange={choose} style={{ display: "none" }} />
      <input ref={gallery} type="file" accept="image/*" onChange={choose} style={{ display: "none" }} />
      <input ref={any}     type="file" accept={acceptAttr()} onChange={choose} style={{ display: "none" }} />
    </div>
  );
}
