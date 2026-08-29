/* One document in full — preview, metadata and actions (brief §10).

   Reached from the Documents list. Works for either subject: a farmer's land
   record and a worker's ID proof are the same record shape, so this screen
   serves both. */

import { useEffect, useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card } from "../components/index.js";
import { Button } from "../components/primitives.jsx";
import { Dialog } from "../components/overlays.jsx";
import { useApp } from "../store/AppStore.jsx";
import DocumentPreview from "../components/documents/DocumentPreview.jsx";
import FilePicker from "../components/documents/FilePicker.jsx";
import {
  documentService, categoryOf, expiryState,
} from "../services/documents/documentService.js";

const fileSize = (n) => (!n ? "—" : n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "7px 0", fontSize: 13.5 }}>
      <span style={{ color: T.inkSoft, flexShrink: 0 }}>{label}</span>
      <span style={{ color: T.ink, fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

export default function DocumentDetail({ id }) {
  const { pop, tc, toast, can } = useApp();
  const [doc, setDoc] = useState(null);
  const [missing, setMissing] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [newFile, setNewFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const refresh = () => documentService.getById(id).then((d) => { setDoc(d); if (!d) setMissing(true); });
  useEffect(() => { refresh(); }, [id]);

  if (missing) return (
    <>
      <AppBar title={tc({ en: "Document", hi: "दस्तावेज़", bn: "নথি" })} onBack={pop} />
      <div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>
        {tc({ en: "This document is no longer available.", hi: "यह दस्तावेज़ अब उपलब्ध नहीं है।", bn: "এই নথি আর উপলব্ধ নেই।" })}
      </div>
    </>
  );
  if (!doc) return (
    <>
      <AppBar title={tc({ en: "Document", hi: "दस्तावेज़", bn: "নথি" })} onBack={pop} />
      <div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>
        {tc({ en: "Loading…", hi: "लोड हो रहा है…", bn: "লোড হচ্ছে…" })}
      </div>
    </>
  );

  const cat = categoryOf(doc.category);
  const state = expiryState(doc);
  const hasFile = !!(doc.fileUrl || doc.fileData);
  const mayDownload = can("documents.download") || can("profile.manage");

  /* Download resolves the file only when asked, and logs the access. A blob
     URL made for a device-stored file is revoked once the click is done. */
  const download = async () => {
    const opened = await documentService.openable(doc);
    if (!opened) {
      toast(tc({ en: "This file could not be opened.", hi: "यह फ़ाइल खोली नहीं जा सकी।", bn: "এই ফাইলটি খোলা যায়নি।" }), "error");
      return;
    }
    documentService.logDownload(doc);
    const a = document.createElement("a");
    a.href = opened.url;
    a.download = doc.fileName || doc.title || "document";
    a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => opened.revoke?.(), 30000);
  };

  const doReplace = async () => {
    if (!newFile) return;
    setBusy(true); setProgress(0);
    try {
      await documentService.replaceFile(id, newFile, { onProgress: setProgress });
      setReplacing(false); setNewFile(null);
      await refresh();
      toast(tc({ en: "File replaced", hi: "फ़ाइल बदल दी गई", bn: "ফাইল বদলানো হয়েছে" }), "success");
    } catch (err) {
      toast(tc({ en: "Could not replace the file. The original is unchanged.",
                 hi: "फ़ाइल बदली नहीं जा सकी। मूल फ़ाइल जस की तस है।",
                 bn: "ফাইল বদলানো যায়নি। আসলটি অপরিবর্তিত আছে।" }), "error");
      console.error("[documents] replace failed", err);
    } finally { setBusy(false); setProgress(null); }
  };

  return (
    <>
      <AppBar title={doc.title || tc({ en: "Document", hi: "दस्तावेज़", bn: "নথি" })} onBack={pop} />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        <DocumentPreview doc={doc} />

        {state !== "valid" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", borderRadius: T.rMd,
            background: state === "expired" ? T.redSoft : T.orangeSoft, color: state === "expired" ? T.red : T.orange, fontSize: 12.5, fontWeight: 600 }}>
            <Icon name="TriangleAlert" size={15} />
            {state === "expired"
              ? tc({ en: `Expired on ${doc.expiryDate}`, hi: `${doc.expiryDate} को समाप्त`, bn: `${doc.expiryDate}-এ মেয়াদ শেষ` })
              : tc({ en: `Expires on ${doc.expiryDate}`, hi: `${doc.expiryDate} को समाप्त होगा`, bn: `${doc.expiryDate}-এ মেয়াদ শেষ হবে` })}
          </div>
        )}

        <Card pad={14}>
          <Row label={tc({ en: "Type", hi: "प्रकार", bn: "ধরন" })} value={tc(cat.i18n)} />
          <Row label={tc({ en: "Note", hi: "नोट", bn: "নোট" })} value={doc.note} />
          <Row label={tc({ en: "Number", hi: "संख्या", bn: "নম্বর" })} value={doc.number} />
          <Row label={tc({ en: "File name", hi: "फ़ाइल नाम", bn: "ফাইলের নাম" })} value={doc.fileName} />
          <Row label={tc({ en: "File type", hi: "फ़ाइल प्रकार", bn: "ফাইলের ধরন" })} value={doc.mimeType} />
          <Row label={tc({ en: "File size", hi: "फ़ाइल आकार", bn: "ফাইলের আকার" })} value={doc.size ? fileSize(doc.size) : ""} />
          <Row label={tc({ en: "Issue date", hi: "जारी तिथि", bn: "প্রদানের তারিখ" })} value={doc.issueDate} />
          <Row label={tc({ en: "Expiry date", hi: "समय-सीमा", bn: "মেয়াদ শেষ" })} value={doc.expiryDate} />
          <Row label={tc({ en: "Uploaded", hi: "अपलोड", bn: "আপলোড" })} value={doc.uploadDate} />
          <Row label={tc({ en: "Status", hi: "स्थिति", bn: "অবস্থা" })}
            value={doc.status === "verified"
              ? tc({ en: "Verified", hi: "सत्यापित", bn: "যাচাইকৃত" })
              : tc({ en: "Uploaded", hi: "अपलोड किया", bn: "আপলোড করা" })} />
          <Row label={tc({ en: "Stored", hi: "संग्रहण", bn: "সংরক্ষণ" })}
            value={{
              cloud:   tc({ en: "Private cloud folder", hi: "निजी क्लाउड फ़ोल्डर", bn: "ব্যক্তিগত ক্লাউড ফোল্ডার" }),
              local:   tc({ en: "This device", hi: "इसी डिवाइस पर", bn: "এই ডিভাইসে" }),
              pending: tc({ en: "Waiting to upload", hi: "अपलोड की प्रतीक्षा", bn: "আপলোডের অপেক্ষায়" }),
              none:    tc({ en: "No file attached", hi: "कोई फ़ाइल नहीं", bn: "কোনও ফাইল নেই" }),
            }[doc.storage] || doc.storage} />
          {doc.replacedAt && (
            <Row label={tc({ en: "Replaced", hi: "बदला गया", bn: "বদলানো হয়েছে" })}
              value={`${doc.replacedAt.slice(0, 10)}${doc.previousFileName ? ` (${doc.previousFileName})` : ""}`} />
          )}
        </Card>

        {replacing ? (
          <Card pad={14} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FilePicker file={newFile} onPick={setNewFile} progress={progress} disabled={busy}
              hint={tc({ en: "The current file is kept until the new one is safely stored.",
                         hi: "नई फ़ाइल सुरक्षित सहेजे जाने तक मौजूदा फ़ाइल बनी रहती है।",
                         bn: "নতুন ফাইল নিরাপদে সংরক্ষিত না হওয়া পর্যন্ত বর্তমান ফাইলটি থাকে।" })} />
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="outline" full disabled={busy} onClick={() => { setReplacing(false); setNewFile(null); }}>
                {tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" })}
              </Button>
              <Button full disabled={!newFile || busy} onClick={doReplace}>
                {busy
                  ? `${tc({ en: "Uploading", hi: "अपलोड हो रहा है", bn: "আপলোড হচ্ছে" })} ${progress ?? 0}%`
                  : tc({ en: "Replace file", hi: "फ़ाइल बदलें", bn: "ফাইল বদলান" })}
              </Button>
            </div>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {hasFile && mayDownload && (
              <Button full variant="outline" icon="Download" onClick={download}>
                {tc({ en: "Download", hi: "डाउनलोड करें", bn: "ডাউনলোড করুন" })}
              </Button>
            )}
            {(can("documents.upload") || can("profile.manage")) && (
              <Button full variant="outline" icon="RefreshCw" onClick={() => setReplacing(true)}>
                {hasFile
                  ? tc({ en: "Replace file", hi: "फ़ाइल बदलें", bn: "ফাইল বদলান" })
                  : tc({ en: "Attach a file", hi: "फ़ाइल जोड़ें", bn: "ফাইল যোগ করুন" })}
              </Button>
            )}
            {(can("documents.delete") || can("records.delete")) && (
              <Button full variant="outline" danger icon="Trash2" onClick={() => setDelOpen(true)}>
                {tc({ en: "Delete document", hi: "दस्तावेज़ हटाएँ", bn: "নথি মুছুন" })}
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={delOpen} onClose={() => setDelOpen(false)}
        title={tc({ en: "Delete this document?", hi: "यह दस्तावेज़ हटाएँ?", bn: "এই নথি মুছবেন?" })} icon="Trash2" danger
        body={tc({ en: "It will be removed from your documents. This cannot be undone from the app.",
                   hi: "यह आपके दस्तावेज़ों से हट जाएगा। ऐप से इसे वापस नहीं किया जा सकता।",
                   bn: "এটি আপনার নথি থেকে সরে যাবে। অ্যাপ থেকে এটি আর ফেরানো যাবে না।" })}
        confirmLabel={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
        cancelLabel={tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" })}
        onConfirm={async () => {
          await documentService.remove(id);
          setDelOpen(false);
          toast(tc({ en: "Document deleted", hi: "दस्तावेज़ हटाया गया", bn: "নথি মুছে ফেলা হয়েছে" }), "info");
          pop();
        }} />
    </>
  );
}
