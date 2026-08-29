import { useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card, BottomSheet, EmptyState } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { storage } from "../utils/storage.js";
import Restricted from "../components/Restricted.jsx";

const KEY = "docs:list";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const DOC_TYPES = [
  { id: "land",      label: { en: "Land record", hi: "भूमि रिकॉर्ड", bn: "জমির রেকর্ড" }, icon: "Map" },
  { id: "kcc",       label: { en: "Kisan Credit Card", hi: "किसान क्रेडिट कार्ड", bn: "কিষান ক্রেডিট কার্ড" }, icon: "CreditCard" },
  { id: "insurance", label: { en: "Crop insurance", hi: "फसल बीमा", bn: "ফসল বীমা" }, icon: "ShieldCheck" },
  { id: "soil",      label: { en: "Soil health card", hi: "मृदा स्वास्थ्य कार्ड", bn: "মাটি স্বাস্থ্য কার্ড" }, icon: "FlaskConical" },
  { id: "bank",      label: { en: "Bank passbook", hi: "बैंक पासबुक", bn: "ব্যাংক পাসবই" }, icon: "Building2" },
  { id: "other",     label: { en: "Other", hi: "अन्य", bn: "অন্যান্য" }, icon: "FileText" },
];
const typeOf = (id) => DOC_TYPES.find((d) => d.id === id) || DOC_TYPES[5];

export default function Documents() {
  const { pop, tc, toast, can } = useApp();
  const [docs, setDocs] = useState(() => storage.get(KEY, []));
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("land");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const save = (list) => { storage.set(KEY, list); setDocs(list); };

  const add = () => {
    if (!title.trim()) return;
    save([{ id: uid(), type, title: title.trim(), note: note.trim(), ts: Date.now() }, ...docs]);
    setOpen(false); setTitle(""); setNote(""); setType("land");
    toast(tc({ en: "Document saved", hi: "दस्तावेज़ सहेजा गया", bn: "নথি সংরক্ষিত হয়েছে" }), "success");
  };
  const remove = (id) => { save(docs.filter((d) => d.id !== id)); };

  if (!can("profile.manage")) return (
    <>
      <AppBar title={tc({ en: "Documents", hi: "दस्तावेज़", bn: "নথিপত্র" })} onBack={pop} />
      <Restricted tc={tc} />
    </>
  );

  return (
    <>
      <AppBar title={tc({ en: "Documents", hi: "दस्तावेज़", bn: "নথিপত্র" })} onBack={pop}
        action={
          <button onClick={() => setOpen(true)} style={{ background: T.primary, color: T.onPrimary, border: "none", borderRadius: 12, padding: 8, cursor: "pointer", display: "flex" }}>
            <Icon name="Plus" size={19} />
          </button>
        } />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 12, animation: "ag-fade .25s var(--ag-ease)" }}>
        {docs.length === 0 ? (
          <div style={{ paddingTop: 30 }}>
            <EmptyState icon="FolderOpen" title={tc({ en: "No documents yet", hi: "अभी कोई दस्तावेज़ नहीं", bn: "এখনও কোনো নথি নেই" })}
              body={tc({ en: "Keep track of your land records, KCC, insurance and more. Tap + to add one.", hi: "अपने भूमि रिकॉर्ड, KCC, बीमा आदि का हिसाब रखें। जोड़ने के लिए + दबाएँ।", bn: "আপনার জমির রেকর্ড, KCC, বীমা ইত্যাদির হিসাব রাখুন। যোগ করতে + চাপুন।" })} />
          </div>
        ) : (
          docs.map((d) => {
            const ty = typeOf(d.type);
            return (
              <Card key={d.id} style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: T.primarySoft, color: T.primary, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon name={ty.icon} size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft }}>{tc(ty.label)}{d.note ? ` · ${d.note}` : ""}</div>
                </div>
                <button onClick={() => remove(d.id)} aria-label="delete" style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 4 }}>
                  <Icon name="Trash2" size={18} />
                </button>
              </Card>
            );
          })
        )}
        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          {tc({ en: "Notes are stored privately on your device.", hi: "नोट्स आपके डिवाइस पर निजी रूप से सहेजे जाते हैं।", bn: "নোট আপনার ডিভাইসে ব্যক্তিগতভাবে সংরক্ষিত।" })}
        </div>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={tc({ en: "Add document", hi: "दस्तावेज़ जोड़ें", bn: "নথি যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DOC_TYPES.map((d) => {
              const on = type === d.id;
              return (
                <button key={d.id} onClick={() => setType(d.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: T.pill, cursor: "pointer", fontFamily: T.body,
                    fontSize: 12.5, fontWeight: 600, border: `1.5px solid ${on ? T.primary : T.line}`, background: on ? T.primarySoft : T.surface, color: on ? T.primary : T.inkSoft }}>
                  <Icon name={d.icon} size={14} /> {tc(d.label)}
                </button>
              );
            })}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tc({ en: "Title (e.g. Plot no. 42 record)", hi: "शीर्षक (जैसे प्लॉट नं. 42)", bn: "শিরোনাম (যেমন প্লট নং ৪২)" })}
            style={{ width: "100%", padding: "12px 14px", borderRadius: T.rMd, border: `1px solid ${T.line}`, background: T.surface2, color: T.ink, fontFamily: T.body, fontSize: 14.5, outline: "none", boxSizing: "border-box" }} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tc({ en: "Note (number, expiry, where kept…)", hi: "नोट (नंबर, समाप्ति, कहाँ रखा…)", bn: "নোট (নম্বর, মেয়াদ, কোথায় রাখা…)" })}
            style={{ width: "100%", padding: "12px 14px", borderRadius: T.rMd, border: `1px solid ${T.line}`, background: T.surface2, color: T.ink, fontFamily: T.body, fontSize: 14.5, outline: "none", boxSizing: "border-box" }} />
          <button onClick={add} disabled={!title.trim()}
            style={{ width: "100%", padding: "13px", borderRadius: T.pill, border: "none", background: T.primary, color: T.onPrimary, fontFamily: T.body, fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: title.trim() ? 1 : .4 }}>
            {tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ" })}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
