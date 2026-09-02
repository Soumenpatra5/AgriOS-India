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
  documentService, categoriesFor, categoryOf, expiryState, onDocumentsChanged,
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

  const [query, setQuery] = useState("");
  const [trash, setTrash] = useState(null);      // deleted docs, loaded on demand
  const [showTrash, setShowTrash] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [chip, setChip] = useState("all");
  const [sort, setSort] = useState("recent");

  const refresh = () => Promise.all([
    documentService.list("owner").then(setDocs),
    documentService.listDeleted("owner").then(setTrash),
  ]);
  useEffect(() => {
    refresh();
    return onDocumentsChanged(refresh);
  }, []);

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

  /* Emptying the deleted list leaves the sheet with nothing to show, so it
     closes itself rather than sitting there stale over the restored document. */
  const closeTrashIfEmpty = async () => {
    const left = await documentService.listDeleted("owner");
    if (!left.length) setShowTrash(false);
  };

  const restore = async (id) => {
    const back = await documentService.restore(id);
    await refresh();
    await closeTrashIfEmpty();
    toast(back
      ? tc({ en: "Document restored", hi: "दस्तावेज़ वापस आ गया", bn: "নথি ফিরিয়ে আনা হয়েছে" })
      : tc({ en: "That document is no longer available.", hi: "वह दस्तावेज़ अब उपलब्ध नहीं है।", bn: "সেই নথি আর উপলব্ধ নেই।" }),
      back ? "success" : "error");
  };

  const destroy = async (id) => {
    await documentService.purge(id);
    await refresh();
    await closeTrashIfEmpty();
    toast(tc({ en: "Deleted permanently", hi: "स्थायी रूप से हटाया गया", bn: "স্থায়ীভাবে মুছে ফেলা হয়েছে" }), "info");
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
        {trash?.length > 0 && (
          <button onClick={() => setShowTrash(true)}
            style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px",
              borderRadius: T.pill, cursor: "pointer", fontFamily: T.body, fontSize: 12.5, fontWeight: 600,
              border: `1.5px solid ${T.line}`, background: T.surface, color: T.inkSoft }}>
            <Icon name="Trash2" size={13} />
            {tc({ en: "Deleted", hi: "हटाए गए", bn: "মুছে ফেলা" })} ({trash.length})
          </button>
        )}
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
          {tc({ en: "Files are stored privately on this device. They are not uploaded anywhere.",
                hi: "फ़ाइलें इसी डिवाइस पर निजी रूप से सहेजी जाती हैं। कहीं अपलोड नहीं होतीं।",
                bn: "ফাইল এই ডিভাইসেই ব্যক্তিগতভাবে সংরক্ষিত হয়। কোথাও আপলোড হয় না।" })}
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

      <BottomSheet open={showTrash} onClose={() => setShowTrash(false)}
        title={tc({ en: "Deleted documents", hi: "हटाए गए दस्तावेज़", bn: "মুছে ফেলা নথি" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "62vh", overflowY: "auto" }}>
          <div style={{ fontSize: 11.5, color: T.inkFaint, lineHeight: 1.5 }}>
            {tc({ en: "Deleted documents are kept for a while before their files are removed for good. Restore one to put it back exactly as it was.",
                  hi: "हटाए गए दस्तावेज़ कुछ समय रखे जाते हैं, फिर उनकी फ़ाइलें हमेशा के लिए मिट जाती हैं। वापस लाने पर दस्तावेज़ ज्यों का त्यों लौट आता है।",
                  bn: "মুছে ফেলা নথি কিছুদিন রাখা হয়, তারপর তাদের ফাইল চিরতরে মুছে যায়। ফেরালে নথিটি ঠিক আগের মতোই ফিরে আসে।" })}
          </div>

          {(trash || []).map((d) => {
            const cat = categoryOf(d.category);
            return (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px",
                background: T.surface2, borderRadius: T.rMd, border: `1px solid ${T.line}` }}>
                <Icon name={cat.icon} size={18} style={{ color: T.inkFaint, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft }}>
                    {tc(cat.i18n)}
                    {" · "}
                    {d.daysLeft === 1
                      ? tc({ en: "1 day left", hi: "1 दिन बचा", bn: "১ দিন বাকি" })
                      : tc({ en: `${d.daysLeft} days left`, hi: `${d.daysLeft} दिन बचे`, bn: `${d.daysLeft} দিন বাকি` })}
                  </div>
                </div>
                <button onClick={() => restore(d.id)}
                  style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: T.primary,
                    fontFamily: T.body, fontSize: 12.5, fontWeight: 700, padding: "4px 6px" }}>
                  {tc({ en: "Restore", hi: "वापस लाएँ", bn: "ফেরান" })}
                </button>
                <button onClick={() => setPurgeTarget(d)}
                  aria-label={tc({ en: "Delete permanently", hi: "स्थायी रूप से हटाएँ", bn: "স্থায়ীভাবে মুছুন" })}
                  style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 4 }}>
                  <Icon name="Trash2" size={15} />
                </button>
              </div>
            );
          })}

          {!trash?.length && (
            <div style={{ padding: "20px 0", textAlign: "center", color: T.inkFaint, fontSize: 13 }}>
              {tc({ en: "Nothing here.", hi: "यहाँ कुछ नहीं है।", bn: "এখানে কিছু নেই।" })}
            </div>
          )}
        </div>
      </BottomSheet>

      <Dialog open={!!purgeTarget} onClose={() => setPurgeTarget(null)}
        title={tc({ en: "Delete permanently?", hi: "स्थायी रूप से हटाएँ?", bn: "স্থায়ীভাবে মুছবেন?" })} icon="Trash2" danger
        body={purgeTarget ? tc({
          en: `${purgeTarget.title} and its file will be destroyed now. This cannot be undone.`,
          hi: `${purgeTarget.title} और इसकी फ़ाइल अभी मिटा दी जाएगी। इसे वापस नहीं किया जा सकता।`,
          bn: `${purgeTarget.title} ও তার ফাইল এখনই মুছে যাবে। এটি আর ফেরানো যাবে না।`,
        }) : ""}
        confirmLabel={tc({ en: "Delete permanently", hi: "स्थायी रूप से हटाएँ", bn: "স্থায়ীভাবে মুছুন" })}
        cancelLabel={tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" })}
        onConfirm={async () => { const t = purgeTarget; setPurgeTarget(null); await destroy(t.id); }} />

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
