import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Button } from "../../components/index.js";
import Icon from "../../components/Icon.jsx";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { assetService, ASSET_CATEGORIES } from "../../services/assets/assetService.js";
import { rupee, compact } from "../../utils/format.js";
import StatTile from "../../components/erp/StatTile.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AssetManager() {
  const { pop, toast, can, tc } = useApp();
  const [assets, setAssets] = useState([]);
  const [value, setValue]   = useState(0);
  const [due, setDue]       = useState([]);
  const [tick, setTick]     = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "machinery", purchasePrice: "", purchaseDate: "", note: "" });
  const [maintTarget, setMaintTarget] = useState(null);
  const [maintForm, setMaintForm]     = useState({ date: todayStr(), kind: "service", cost: "", note: "", nextDue: "" });
  const [delId, setDelId] = useState(null);

  useEffect(() => {
    assetService.farmAssets().then(setAssets); // exclude employee-assigned items
    assetService.totalValue().then(setValue);
    assetService.dueSoon().then(setDue);
  }, [tick]);

  const add = async () => {
    if (!form.name) return;
    await assetService.add(form);
    setOpen(false);
    setForm({ name: "", category: "machinery", purchasePrice: "", purchaseDate: "", note: "" });
    refresh(); toast(tc({ en: "Asset added", hi: "संपत्ति जोड़ी गई", bn: "সম্পদ যোগ হয়েছে" }), "success");
  };

  const logMaint = async () => {
    await assetService.logMaintenance(maintTarget.id, maintForm);
    setMaintTarget(null); setMaintForm({ date: todayStr(), kind: "service", cost: "", note: "", nextDue: "" });
    refresh(); toast(tc({ en: "Maintenance logged", hi: "रखरखाव दर्ज हुआ", bn: "রক্ষণাবেক্ষণ লেখা হয়েছে" }), "success");
  };

  const handleDelete = async () => { await assetService.remove(delId); setDelId(null); refresh(); toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে ফেলা হয়েছে" }), "info"); };

  const dueIds = new Set(due.map((d) => d.asset.id));

  return (
    <>
      <AppBar title={tc({ en: "Assets", hi: "संपत्ति", bn: "সম্পদ" })} onBack={pop} action={
        <button onClick={() => setOpen(true)}
          style={{ background: T.yellow, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
        </button>
      } />

      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        <StatTile a="yellow" label={tc({ en: "Assets", hi: "संपत्ति", bn: "সম্পদ" })} value={assets.length} />
        <StatTile a="primary" label={tc({ en: "Total Value", hi: "कुल मूल्य", bn: "মোট মূল্য" })} value={compact(value)} />
        <StatTile a={due.length > 0 ? "red" : "blue"} label={tc({ en: "Service Due", hi: "सर्विस बाकी", bn: "সার্ভিস বাকি" })} value={due.length} />
      </div>

      <div style={{ padding: "10px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {assets.length === 0
          ? <EmptyHint icon="Tractor" text={tc({ en: "Register machinery, vehicles and buildings — track maintenance and value", hi: "मशीनरी, वाहन और भवन दर्ज करें — रखरखाव और मूल्य देखें", bn: "যন্ত্রপাতি, যানবাহন ও ভবন নথিভুক্ত করুন — রক্ষণাবেক্ষণ ও মূল্য দেখুন" })} />
          : assets.map((a) => (
            <RecordRow key={a.id}
              icon={assetService.categoryIcon(a.category)} iconColor={T.yellow} iconBg={T.yellowSoft}
              title={a.name}
              badge={dueIds.has(a.id) ? <Pill fg={T.red} bg={T.redSoft}>{tc({ en: "SERVICE DUE", hi: "सर्विस बाकी", bn: "সার্ভিস বাকি" })}</Pill> : null}
              subtitle={`${assetService.categoryLabel(a.category)}${a.purchasePrice ? ` · ${rupee(Number(a.purchasePrice))}` : ""}${a.purchaseDate ? ` · bought ${a.purchaseDate}` : ""}`}
              right={
                <button onClick={(e) => { e.stopPropagation(); setMaintTarget(a); }}
                  style={{ background: T.blueSoft, color: T.blue, border: "none", borderRadius: 9,
                    padding: "6px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: T.body, flexShrink: 0 }}>
                  Service
                </button>
              }
              onDelete={can("records.delete") ? () => setDelId(a.id) : undefined} />
          ))}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={tc({ en: "Add Asset", hi: "संपत्ति जोड़ें", bn: "সম্পদ যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Asset name", hi: "संपत्ति का नाम", bn: "সম্পদের নাম" })} placeholder={tc({ en: "e.g. Mahindra 575 tractor", hi: "उदा. महिंद्रा 575 ट्रैक्टर", bn: "যেমন মাহিন্দ্রা ৫৭৫ ট্রাক্টর" })} value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Dropdown label={tc({ en: "Category", hi: "श्रेणी", bn: "শ্রেণি" })} value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))}
            options={ASSET_CATEGORIES.map((c) => ({ value: c.id, label: c.i18n ? tc(c.i18n) : c.label }))} />
          <Input label={tc({ en: "Purchase price (₹)", hi: "खरीद मूल्य (₹)", bn: "ক্রয় মূল্য (₹)" })} type="number" placeholder="0" value={form.purchasePrice} onChange={(v) => setForm((f) => ({ ...f, purchasePrice: v }))} />
          <Input label={tc({ en: "Purchase date", hi: "खरीद तिथि", bn: "ক্রয়ের তারিখ" })} type="date" value={form.purchaseDate} onChange={(v) => setForm((f) => ({ ...f, purchaseDate: v }))} />
          <Input label={tc({ en: "Notes", hi: "टिप्पणी", bn: "মন্তব্য" })} placeholder={tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })} value={form.note} onChange={(v) => setForm((f) => ({ ...f, note: v }))} />
          <Button full onClick={add} disabled={!form.name}>{tc({ en: "Add Asset", hi: "संपत्ति जोड़ें", bn: "সম্পদ যোগ করুন" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!maintTarget} onClose={() => setMaintTarget(null)} title={maintTarget ? `Service: ${maintTarget.name}` : ""}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Date" type="date" value={maintForm.date} onChange={(v) => setMaintForm((f) => ({ ...f, date: v }))} />
          <Dropdown label={tc({ en: "Type", hi: "प्रकार", bn: "ধরন" })} value={maintForm.kind} onChange={(v) => setMaintForm((f) => ({ ...f, kind: v }))}
            options={[
              { value: "service",   label: tc({ en: "Routine Service", hi: "नियमित सर्विस", bn: "নিয়মিত সার্ভিস" }) },
              { value: "repair",    label: tc({ en: "Repair", hi: "मरम्मत", bn: "মেরামত" }) },
              { value: "insurance", label: tc({ en: "Insurance Renewal", hi: "बीमा नवीनीकरण", bn: "বিমা নবায়ন" }) },
              { value: "other",     label: tc({ en: "Other", hi: "अन्य", bn: "অন্যান্য" }) },
            ]} />
          <Input label={tc({ en: "Cost (₹)", hi: "लागत (₹)", bn: "ব্যয় (₹)" })} type="number" placeholder="0" value={maintForm.cost} onChange={(v) => setMaintForm((f) => ({ ...f, cost: v }))} />
          <Input label={tc({ en: "Notes", hi: "टिप्पणी", bn: "মন্তব্য" })} placeholder={tc({ en: "What was done…", hi: "क्या किया गया…", bn: "কী করা হয়েছে…" })} value={maintForm.note} onChange={(v) => setMaintForm((f) => ({ ...f, note: v }))} />
          <Input label={tc({ en: "Next service due", hi: "अगली सर्विस", bn: "পরবর্তী সার্ভিস" })} type="date" value={maintForm.nextDue} onChange={(v) => setMaintForm((f) => ({ ...f, nextDue: v }))} />
          <Button full onClick={logMaint}>{tc({ en: "Log Maintenance", hi: "रखरखाव दर्ज करें", bn: "রক্ষণাবেক্ষণ লিখুন" })}</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delId} title={tc({ en: "Delete asset?", hi: "संपत्ति हटाएँ?", bn: "সম্পদ মুছবেন?" })} onClose={() => setDelId(null)}
        actions={[
          { label: tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" }), variant: "outline", onClick: () => setDelId(null) },
          { label: tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" }), variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>{tc({ en: "The asset and its maintenance history will be removed.", hi: "यह संपत्ति और इसका रखरखाव इतिहास हट जाएगा।", bn: "এই সম্পদ ও এর রক্ষণাবেক্ষণ ইতিহাস মুছে যাবে।" })}</div>
      </Dialog>
    </>
  );
}
