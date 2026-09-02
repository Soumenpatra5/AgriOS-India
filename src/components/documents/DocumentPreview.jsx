/* Document preview (brief §8).

   Images render inline. PDFs render in an <object>, which falls back to its
   own children when the platform has no PDF plugin — that is the normal case
   in an Android WebView, so the fallback is a real Open action rather than an
   apology. Anything else shows file information and the same Open action.

   The file is resolved on demand, never when a list is drawn (§32): a cloud
   document is a URL, a device-stored one is base64 that has to become a blob
   URL first, and that blob is revoked on unmount so previews do not leak. */

import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../Icon.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { documentService } from "../../services/documents/documentService.js";
import { previewKind } from "../../services/documents/documentConfig.js";

export default function DocumentPreview({ doc, height = 260 }) {
  const { tc } = useApp();
  const [src, setSrc] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let revoke = null, alive = true;
    setState("loading"); setSrc(null);

    if (!doc || (!doc.fileKey && !doc.fileUrl && !doc.fileData)) { setState("none"); return undefined; }

    documentService.openable(doc).then((r) => {
      if (!alive) { r?.revoke?.(); return; }
      if (!r) { setState("error"); return; }
      revoke = r.revoke; setSrc(r.url); setState("ready");
    });

    return () => { alive = false; revoke?.(); };
  }, [doc]);

  const kind = previewKind(doc?.mimeType);

  const frame = (children) => (
    <div style={{ borderRadius: T.rLg, border: `1px solid ${T.line}`, background: T.surface2,
      overflow: "hidden", display: "grid", placeItems: "center", minHeight: height }}>
      {children}
    </div>
  );

  const message = (icon, text, tone = T.inkSoft) => frame(
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 24, color: tone, textAlign: "center" }}>
      <Icon name={icon} size={26} />
      <div style={{ fontSize: 12.5 }}>{text}</div>
    </div>
  );

  if (state === "none") {
    return message("FileQuestion", doc?.storage === "pending"
      ? tc({ en: "This file is waiting to upload — it was too large to keep on the device.",
             hi: "यह फ़ाइल अपलोड की प्रतीक्षा में है — डिवाइस पर रखने के लिए बहुत बड़ी थी।",
             bn: "এই ফাইলটি আপলোডের অপেক্ষায় — ডিভাইসে রাখার পক্ষে বড় ছিল।" })
      : tc({ en: "No file attached to this document.", hi: "इस दस्तावेज़ से कोई फ़ाइल नहीं जुड़ी।", bn: "এই নথিতে কোনও ফাইল যুক্ত নেই।" }));
  }
  if (state === "loading") return message("Loader", tc({ en: "Loading preview…", hi: "पूर्वावलोकन लोड हो रहा है…", bn: "প্রিভিউ লোড হচ্ছে…" }));
  if (state === "error")   return message("TriangleAlert", tc({ en: "This file could not be opened.", hi: "यह फ़ाइल खोली नहीं जा सकी।", bn: "এই ফাইলটি খোলা যায়নি।" }), T.red);

  if (kind === "image") {
    return frame(
      <img src={src} alt={doc.title || doc.fileName || ""}
        style={{ width: "100%", maxHeight: height * 1.6, objectFit: "contain", display: "block" }} />
    );
  }

  if (kind === "pdf") {
    return frame(
      <object data={src} type="application/pdf" style={{ width: "100%", height: height * 1.4, border: "none" }}>
        {/* Reached whenever the platform cannot render a PDF inline — the
            common case inside an Android WebView. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 24, textAlign: "center" }}>
          <Icon name="FileText" size={26} style={{ color: T.primary }} />
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>
            {tc({ en: "PDF preview isn't supported here.", hi: "यहाँ PDF पूर्वावलोकन समर्थित नहीं है।", bn: "এখানে PDF প্রিভিউ সমর্থিত নয়।" })}
          </div>
          <a href={src} target="_blank" rel="noopener noreferrer"
            style={{ color: T.primary, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            {tc({ en: "Open PDF", hi: "PDF खोलें", bn: "PDF খুলুন" })}
          </a>
        </div>
      </object>
    );
  }

  return message("FileText", `${doc.fileName || tc({ en: "File", hi: "फ़ाइल", bn: "ফাইল" })} · ${doc.mimeType || "—"}`);
}
