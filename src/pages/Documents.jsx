/* The farmer's own documents — land records, KCC, insurance, soil card…

   This screen used to keep a list of titles in localStorage with no files at
   all. It now runs on the shared document service, the same one the workforce
   module uses, so a land record and a worker's ID proof are stored, synced,
   expiry-tracked and audited by one implementation. */

import { useEffect, useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card, BottomSheet, EmptyState } from "../components/index.js";
import { Dialog } from "../components/overlays.jsx";
import { useApp } from "../store/AppStore.jsx";
import Restricted from "../components/Restricted.jsx";
import FilePicker from "../components/documents/FilePicker.jsx";
import {
  documentService, categoriesFor, categoryOf, expiryState,
} from "../services/documents/documentService.js";
import { findDuplicate } from "../services/documents/fileValidation.js";
import { filterDocuments, facets } from "../services/documents/documentSearch.js";
import { isPending } from "../services/documents/uploadQueue.js";

const fileSize = (n) => (!n ? "" : n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

const EXPIRY_TONE = {
  expired:       (T) => ({ fg: T.red, bg: T.redSoft }),
  expiring_soon: (T) => ({ fg: T.orange, bg: T.orangeSoft }),
};

const blank = { category: "land", title: "", note: "", number: "", issueDate: "", expiryDate: "" };

export default function Documents() {
  const { pop, push, tc, toast, can } = useApp();
  const [docs, setDocs] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [delTarget, setDelTarget] = useState(null);

  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("all");
  const [sort, setSort] = useState("recent");

  const refresh = () => documentService.list("owner").then(setDocs);
  useEffect(() => { refresh(); }, []);

  /* Filtering happens over the already-loaded list rather than the store: the
     screen holds metadata only (§32), and a farmer's list is tens of rows. */
  const counts = facets(docs || []);
  const visible = filterDocuments(docs || [], {
    query, sort,
    expiry: chip === "expired" ? "expired" : chip === "expiring" ? "expiring_soon" : "",
    hasFile: chip === "nofile" ? false : null,
  });

  const CHIPS = [
    { id: "all",      label: tc({ en: "All", hi: "सभी", bn: "সব" }), n: counts.total },
    { id: "expired",  label: tc({ en: "Expired", hi: "समय-समाप्त", bn: "মেয়াদ শেষ" }), n: counts.expired },
    { id: "expiring", label: tc({ en: "Expiring", hi: "जल्द समाप्त", bn: "শীঘ্রই শেষ" }), n: counts.expiringSoon },
    { id: "nofile",   label: tc({ en: "No file", hi: "फ़ाइल नहीं", bn: "ফাইল নেই" }), n: counts.total - counts.withFile },
  ].filter((c) => c.id === "all" || c.n > 0);

  const canView = can("documents.view") || can("profile.manage");
  if (!canView) return (
    <>
      <AppBar title={tc({ en: "Documents", hi: "दस्तावेज़", bn: "নথিপত্র" })} onBack={pop} />
      <Restricted tc={tc} />
    </>
  );

  const close = () => { setOpen(false); setForm(blank); setFile(null); setProgress(null); };

  const save = async () => {
    if (!form.title.trim() && !file) return;
    setBusy(true);
    if (file) setProgress(0);
    try {
      await documentService.add(
        { subjectType: "owner", ...form, title: form.title.trim(), note: form.note.trim() },
        file,
        { onProgress: setProgress },
      );
      close();
      await refresh();
      toast(tc({ en: "Document saved", hi: "दस्तावेज़ सहेजा गया", bn: "নথি সংরক্ষিত হয়েছে" }), "success");
    } catch (err) {
      /* Keep the sheet and the typed values so nothing the farmer entered is
         lost to a failed upload. */
      toast(tc({ en: "Could not save the document. Please try again.",
                 hi: "दस्तावेज़ सहेजा नहीं जा सका। कृपया फिर कोशिश करें।",
                 bn: "নথি সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।" }), "error");
      console.error("[documents] save failed", err);
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  const confirmDelete = async () => {
    await documentService.remove(delTarget.id);
    setDelTarget(null);
    await refresh();
    toast(tc({ en: "Document deleted", hi: "दस्तावेज़ हटाया गया", bn: "নথি মুছে ফেলা হয়েছে" }), "info");
  };

  const dup = file && docs ? findDuplicate(docs, file) : null;

  return (
    <>
      <AppBar title={tc({ en: "Documents", hi: "दस्तावेज़", bn: "নথিপত্র" })} onBack={pop}
        action={can("documents.upload") || can("profile.manage") ? (
          <button onClick={() => setOpen(true)} aria-label={tc({ en: "Add document", hi: "दस्तावेज़ जोड़ें", bn: "নথি যোগ করুন" })}
            style={{ background: T.primary, color: T.onPrimary, border: "none", borderRadius: 12, padding: 8, cursor: "pointer", display: "flex" }}>
            <Icon name="Plus" size={19} />
          </button>
        ) : null} />

      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 12, animation: "ag-fade .25s var(--ag-ease)" }}>
        {docs === null ? (
          <div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>
            {tc({ en: "Loading…", hi: "लोड हो रहा है…", bn: "লোড হচ্ছে…" })}
          </div>
        ) : docs.length === 0 ? (
          <div style={{ paddingTop: 30 }}>
            <EmptyState icon="FolderOpen" title={tc({ en: "No documents yet", hi: "अभी कोई दस्तावेज़ नहीं", bn: "এখনও কোনো নথি নেই" })}
              body={tc({ en: "Keep track of your land records, KCC, insurance and more. Tap + to add one.", hi: "अपने भूमि रिकॉर्ड, KCC, बीमा आदि का हिसाब रखें। जोड़ने के लिए + दबाएँ।", bn: "আপনার জমির রেকর্ড, KCC, বীমা ইত্যাদির হিসাব রাখুন। যোগ করতে + চাপুন।" })} />
          </div>
        ) : (
          <>
            {/* Search and filters appear only once there is enough to sift
                through — on a list of three they are just clutter. */}
            {docs.length > 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ position: "relative" }}>
                  <Icon name="Search" size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.inkFaint }} />
                  <input value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder={tc({ en: "Search documents…", hi: "दस्तावेज़ खोजें…", bn: "নথি খুঁজুন…" })}
                    style={{ ...fieldStyle, paddingLeft: 34 }} />
                  {query && (
                    <button onClick={() => setQuery("")} aria-label={tc({ en: "Clear search", hi: "खोज साफ़ करें", bn: "খোঁজ মুছুন" })}
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 4 }}>
                      <Icon name="X" size={15} />
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
                  {CHIPS.map((c) => (
                    <button key={c.id} onClick={() => setChip(c.id)}
                      style={{ flexShrink: 0, padding: "7px 12px", borderRadius: T.pill, cursor: "pointer", fontFamily: T.body, fontSize: 12.5, fontWeight: 600,
                        border: `1.5px solid ${chip === c.id ? T.primary : T.line}`, background: chip === c.id ? T.primarySoft : T.surface, color: chip === c.id ? T.primary : T.inkSoft }}>
                      {c.label} {c.n > 0 ? `(${c.n})` : ""}
                    </button>
                  ))}
                  <button onClick={() => setSort((s) => (s === "recent" ? "expiry" : s === "expiry" ? "title" : "recent"))}
                    style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: T.pill, cursor: "pointer",
                      fontFamily: T.body, fontSize: 12.5, fontWeight: 600, border: `1.5px solid ${T.line}`, background: T.surface, color: T.inkSoft }}>
                    <Icon name="ArrowUpDown" size={13} />
                    {{ recent: tc({ en: "Recent", hi: "हाल के", bn: "সাম্প্রতিক" }),
                       expiry: tc({ en: "Expiry", hi: "समय-सीमा", bn: "মেয়াদ" }),
                       title:  tc({ en: "Name", hi: "नाम", bn: "নাম" }) }[sort]}
                  </button>
                </div>
              </div>
            )}

            {visible.length === 0 && (
              <div style={{ padding: "30px 0", textAlign: "center", color: T.inkFaint, fontSize: 13 }}>
                {tc({ en: "No documents match that.", hi: "इससे कोई दस्तावेज़ मेल नहीं खाता।", bn: "এর সঙ্গে কোনও নথি মেলেনি।" })}
              </div>
            )}

            {visible.map((d) => {
            const cat = categoryOf(d.category);
            const state = expiryState(d);
            const tone = EXPIRY_TONE[state]?.(T);
            return (
              <Card key={d.id} style={{ display: "flex", alignItems: "center", gap: 13, cursor: "pointer" }}
                onClick={() => push({ kind: "documentDetail", props: { id: d.id } })}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: T.primarySoft, color: T.primary, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon name={cat.icon} size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {tc(cat.i18n)}
                    {d.fileName ? ` · ${d.fileName}` : ""}
                    {d.size ? ` · ${fileSize(d.size)}` : ""}
                    {d.note ? ` · ${d.note}` : ""}
                  </div>
                  {tone && (
                    <span style={{ display: "inline-block", marginTop: 4, padding: "2px 7px", borderRadius: T.pill,
                      fontSize: 10.5, fontWeight: 700, color: tone.fg, background: tone.bg }}>
                      {state === "expired"
                        ? tc({ en: "Expired", hi: "समय-समाप्त", bn: "মেয়াদ শেষ" })
                        : tc({ en: "Expiring soon", hi: "जल्द समाप्त", bn: "শীঘ্রই মেয়াদ শেষ" })}
                    </span>
                  )}
                </div>
                {isPending(d)
                  ? <Icon name="CloudUpload" size={15} style={{ color: T.orange, flexShrink: 0 }}
                      aria-label={tc({ en: "Waiting to upload", hi: "अपलोड की प्रतीक्षा", bn: "আপলোডের অপেক্ষায়" })} />
                  : d.fileName
                    ? <Icon name="Paperclip" size={15} style={{ color: T.inkFaint, flexShrink: 0 }} />
                    : <Icon name="ChevronRight" size={16} style={{ color: T.inkFaint, flexShrink: 0 }} />}
              </Card>
            );
            })}
          </>
        )}

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          {tc({ en: "Files are stored privately — in your own cloud folder when online, on this device otherwise.",
                hi: "फ़ाइलें निजी रूप से सहेजी जाती हैं — ऑनलाइन होने पर आपके अपने क्लाउड फ़ोल्डर में, वरना इसी डिवाइस पर।",
                bn: "ফাইল ব্যক্তিগতভাবে সংরক্ষিত হয় — অনলাইনে থাকলে আপনার নিজের ক্লাউড ফোল্ডারে, নাহলে এই ডিভাইসে।" })}
        </div>
      </div>

      <BottomSheet open={open} onClose={busy ? undefined : close} title={tc({ en: "Add document", hi: "दस्तावेज़ जोड़ें", bn: "নথি যোগ করুন" })}>
        {/* Scrolls rather than growing: the sheet now holds a picker and dates
            as well as the original three fields (§26). */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "62vh", overflowY: "auto", paddingBottom: 4 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {categoriesFor("owner").map((c) => {
              const on = form.category === c.id;
              return (
                <button key={c.id} onClick={() => setForm((f) => ({ ...f, category: c.id }))} disabled={busy}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: T.pill, cursor: "pointer", fontFamily: T.body,
                    fontSize: 12.5, fontWeight: 600, border: `1.5px solid ${on ? T.primary : T.line}`, background: on ? T.primarySoft : T.surface, color: on ? T.primary : T.inkSoft }}>
                  <Icon name={c.icon} size={14} /> {tc(c.i18n)}
                </button>
              );
            })}
          </div>

          <Field value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} disabled={busy}
            placeholder={tc({ en: "Title (e.g. Plot no. 42 record)", hi: "शीर्षक (जैसे प्लॉट नं. 42)", bn: "শিরোনাম (যেমন প্লট নং ৪২)" })} />
          <Field value={form.note} onChange={(v) => setForm((f) => ({ ...f, note: v }))} disabled={busy}
            placeholder={tc({ en: "Note (number, where kept…)", hi: "नोट (नंबर, कहाँ रखा…)", bn: "নোট (নম্বর, কোথায় রাখা…)" })} />

          <div style={{ display: "flex", gap: 10 }}>
            <DateField label={tc({ en: "Issue date", hi: "जारी तिथि", bn: "প্রদানের তারিখ" })}
              value={form.issueDate} onChange={(v) => setForm((f) => ({ ...f, issueDate: v }))} disabled={busy} />
            <DateField label={tc({ en: "Expiry date", hi: "समय-सीमा", bn: "মেয়াদ শেষ" })}
              value={form.expiryDate} onChange={(v) => setForm((f) => ({ ...f, expiryDate: v }))} disabled={busy} />
          </div>

          <FilePicker file={file} onPick={setFile} progress={progress} disabled={busy} />

          {dup && (
            <div style={{ fontSize: 11.5, color: T.orange, display: "flex", gap: 6 }}>
              <Icon name="Info" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{tc({ en: `You already have a file named "${dup.fileName}" of the same size.`,
                          hi: `आपके पास इसी नाम और आकार की फ़ाइल "${dup.fileName}" पहले से है।`,
                          bn: `একই নাম ও আকারের "${dup.fileName}" ফাইল আপনার কাছে আগে থেকেই আছে।` })}</span>
            </div>
          )}

          <button onClick={save} disabled={busy || (!form.title.trim() && !file)}
            style={{ width: "100%", padding: "13px", borderRadius: T.pill, border: "none", background: T.primary, color: T.onPrimary,
              fontFamily: T.body, fontSize: 15, fontWeight: 600, cursor: busy ? "default" : "pointer",
              opacity: busy || (!form.title.trim() && !file) ? .5 : 1 }}>
            {busy
              ? (progress !== null && progress < 100
                  ? `${tc({ en: "Uploading", hi: "अपलोड हो रहा है", bn: "আপলোড হচ্ছে" })} ${progress}%`
                  : tc({ en: "Saving…", hi: "सहेजा जा रहा है…", bn: "সংরক্ষণ হচ্ছে…" }))
              : tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ" })}
          </button>
        </div>
      </BottomSheet>

      <Dialog open={!!delTarget} onClose={() => setDelTarget(null)}
        title={tc({ en: "Delete this document?", hi: "यह दस्तावेज़ हटाएँ?", bn: "এই নথি মুছবেন?" })} icon="Trash2" danger
        body={delTarget ? tc({
          en: `${delTarget.title} — the record and its file will be removed from this list.`,
          hi: `${delTarget.title} — रिकॉर्ड और उसकी फ़ाइल इस सूची से हट जाएँगे।`,
          bn: `${delTarget.title} — রেকর্ড ও তার ফাইল এই তালিকা থেকে সরে যাবে।`,
        }) : ""}
        confirmLabel={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
        cancelLabel={tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" })}
        onConfirm={confirmDelete} />
    </>
  );
}

const fieldStyle = {
  width: "100%", padding: "12px 14px", borderRadius: T.rMd, border: `1px solid ${T.line}`,
  background: T.surface2, color: T.ink, fontFamily: T.body, fontSize: 14.5, outline: "none", boxSizing: "border-box",
};

function Field({ value, onChange, placeholder, disabled }) {
  return <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={fieldStyle} />;
}

function DateField({ label, value, onChange, disabled }) {
  return (
    <label style={{ flex: 1, display: "block" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft, marginBottom: 7 }}>{label}</div>
      <input type="date" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={fieldStyle} />
    </label>
  );
}
