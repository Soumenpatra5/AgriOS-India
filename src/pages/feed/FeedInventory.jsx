/* Feed Inventory — a filtered, feed-specific view over the app's single
   inventory store (inventoryService), not a parallel inventory system.
   Feed items are ordinary inventory records (category: "feed") with a few
   extra optional fields (feedType, brand, batchNumber, mfgDate,
   storageLocation) that only this screen's form writes. */
import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Button } from "../../components/index.js";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { feedInventory, FEED_TYPES } from "../../services/feed/feedService.js";
import { inventoryService } from "../../services/inventory/inventoryService.js";
import StatTile from "../../components/erp/StatTile.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";
import { rupee } from "../../utils/format.js";

const emptyForm = {
  name: "", feedType: "starter", brand: "", batchNumber: "", mfgDate: "", expiryDate: "",
  qty: "", unit: "kg", minQty: "", unitPrice: "", storageLocation: "", supplierName: "",
};

export default function FeedInventory() {
  const { pop, toast, tc } = useApp();
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState({ lowStock: [], expired: [], expiring: [] });
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveForm, setMoveForm] = useState({ kind: "in", qty: "", note: "" });
  const [delId, setDelId] = useState(null);

  useEffect(() => {
    feedInventory.getAll().then(setItems);
    feedInventory.alerts().then(setAlerts);
  }, [tick]);

  const alertCount = alerts.lowStock.length + alerts.expired.length + alerts.expiring.length;

  const add = async () => {
    if (!form.name) return;
    await feedInventory.add(form);
    setOpen(false); setForm(emptyForm);
    refresh(); toast(tc({ en: "Feed item added", hi: "चारा मद जोड़ी गई", bn: "খাদ্য আইটেম যোগ হয়েছে" }), "success");
  };

  const doMove = async () => {
    if (!moveForm.qty) return;
    await inventoryService.move(moveTarget.id, moveForm.kind, moveForm.qty, moveForm.note);
    setMoveTarget(null); setMoveForm({ kind: "in", qty: "", note: "" });
    refresh(); toast(moveForm.kind === "in" ? tc({ en: "Stock added", hi: "स्टॉक जोड़ा गया", bn: "মজুত যোগ হয়েছে" }) : tc({ en: "Stock issued", hi: "स्टॉक निकाला गया", bn: "মজুত বের করা হয়েছে" }), "success");
  };

  const handleDelete = async () => { await feedInventory.remove(delId); setDelId(null); refresh(); toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে ফেলা হয়েছে" }), "info"); };

  const itemBadge = (i) => {
    const today = new Date().toISOString().slice(0, 10);
    if (i.expiryDate && i.expiryDate < today) return <Pill fg={T.red} bg={T.redSoft}>EXPIRED</Pill>;
    if (i.minQty && Number(i.qty) <= Number(i.minQty)) return <Pill fg={T.orange} bg={T.orangeSoft}>LOW</Pill>;
    return null;
  };

  return (
    <>
      <AppBar title={tc({ en: "Feed inventory", hi: "चारा स्टॉक", bn: "খাদ্য মজুত" })} onBack={pop} action={
        <button onClick={() => setOpen(true)}
          style={{ background: T.orange, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> Add
        </button>
      } />

      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        <StatTile a="orange" label={tc({ en: "Feed items", hi: "चारा मद", bn: "খাদ্য আইটেম" })} value={items.length} />
        <StatTile a={alertCount > 0 ? "red" : "primary"} label={tc({ en: "Alerts", hi: "अलर्ट", bn: "সতর্কতা" })} value={alertCount} />
        <StatTile a="blue" label={tc({ en: "Low stock", hi: "कम स्टॉक", bn: "কম মজুত" })} value={alerts.lowStock.length} />
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {items.length === 0
          ? <EmptyHint icon="Package" text={tc({ en: "Add feed stock to track levels, expiry and cost per kg", hi: "स्तर, समय-सीमा और प्रति किग्रा लागत देखने के लिए चारा स्टॉक जोड़ें", bn: "স্তর, মেয়াদ ও প্রতি কেজি ব্যয় দেখতে খাদ্য মজুত যোগ করুন" })} />
          : items.map((i) => (
            <RecordRow key={i.id}
              icon="Package" iconColor={T.orange} iconBg={T.orangeSoft}
              title={i.name}
              badge={itemBadge(i)}
              subtitle={`${feedInventory.feedTypeLabel(i.feedType)} · ${i.qty} ${i.unit || ""} in stock${i.unitPrice ? ` · ${rupee(i.unitPrice)}/${i.unit || "kg"}` : ""}${i.expiryDate ? ` · exp ${i.expiryDate}` : ""}`}
              right={
                <button onClick={(e) => { e.stopPropagation(); setMoveTarget(i); }}
                  style={{ background: T.primarySoft, color: T.primary, border: "none", borderRadius: 9,
                    padding: "6px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: T.body, flexShrink: 0 }}>
                  In / Out
                </button>
              }
              onDelete={() => setDelId(i.id)} />
          ))}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={tc({ en: "Add Feed Item", hi: "चारा मद जोड़ें", bn: "খাদ্য আইটেম যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Feed name", hi: "चारा नाम", bn: "খাদ্যের নাম" })} placeholder={tc({ en: "e.g. Broiler Starter Mix 50kg", hi: "उदा. ब्रॉयलर स्टार्टर मिक्स 50 किग्रा", bn: "যেমন ব্রয়লার স্টার্টার মিক্স ৫০ কেজি" })} value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Dropdown label={tc({ en: "Feed type", hi: "चारा प्रकार", bn: "খাদ্যের ধরন" })} value={form.feedType} onChange={(v) => setForm((f) => ({ ...f, feedType: v }))}
            options={FEED_TYPES.map((t) => ({ value: t.id, label: t.i18n ? tc(t.i18n) : t.label }))} />
          <Input label={tc({ en: "Brand (optional)", hi: "ब्रांड (वैकल्पिक)", bn: "ব্র্যান্ড (ঐচ্ছিক)" })} value={form.brand} onChange={(v) => setForm((f) => ({ ...f, brand: v }))} />
          <Input label={tc({ en: "Batch number (optional)", hi: "बैच नंबर (वैकल्पिक)", bn: "ব্যাচ নম্বর (ঐচ্ছিক)" })} value={form.batchNumber} onChange={(v) => setForm((f) => ({ ...f, batchNumber: v }))} />
          <Input label={tc({ en: "Opening quantity", hi: "प्रारंभिक मात्रा", bn: "প্রারম্ভিক পরিমাণ" })} type="number" placeholder="0" value={form.qty} onChange={(v) => setForm((f) => ({ ...f, qty: v }))} />
          <Input label={tc({ en: "Unit", hi: "इकाई", bn: "একক" })} placeholder={tc({ en: "kg / bags", hi: "किग्रा / बोरी", bn: "কেজি / বস্তা" })} value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} />
          <Input label={tc({ en: "Low-stock alert level", hi: "कम स्टॉक अलर्ट स्तर", bn: "কম মজুত সতর্কতার স্তর" })} type="number" placeholder="0" value={form.minQty} onChange={(v) => setForm((f) => ({ ...f, minQty: v }))} />
          <Input label={tc({ en: "Cost per kg (₹)", hi: "प्रति किग्रा लागत (₹)", bn: "প্রতি কেজি ব্যয় (₹)" })} type="number" placeholder="0" value={form.unitPrice} onChange={(v) => setForm((f) => ({ ...f, unitPrice: v }))} />
          <Input label={tc({ en: "Manufacturing date (optional)", hi: "निर्माण तिथि (वैकल्पिक)", bn: "উৎপাদনের তারিখ (ঐচ্ছিক)" })} type="date" value={form.mfgDate} onChange={(v) => setForm((f) => ({ ...f, mfgDate: v }))} />
          <Input label={tc({ en: "Expiry date (optional)", hi: "समय-सीमा तिथि (वैकल्पिक)", bn: "মেয়াদ শেষের তারিখ (ঐচ্ছিক)" })} type="date" value={form.expiryDate} onChange={(v) => setForm((f) => ({ ...f, expiryDate: v }))} />
          <Input label={tc({ en: "Storage location (optional)", hi: "भंडारण स्थान (वैकल्पिक)", bn: "সংরক্ষণের স্থান (ঐচ্ছিক)" })} value={form.storageLocation} onChange={(v) => setForm((f) => ({ ...f, storageLocation: v }))} />
          <Input label={tc({ en: "Supplier (optional)", hi: "आपूर्तिकर्ता (वैकल्पिक)", bn: "সরবরাহকারী (ঐচ্ছিক)" })} value={form.supplierName} onChange={(v) => setForm((f) => ({ ...f, supplierName: v }))} />
          <Button full onClick={add} disabled={!form.name}>{tc({ en: "Add Feed Item", hi: "चारा मद जोड़ें", bn: "খাদ্য আইটেম যোগ করুন" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!moveTarget} onClose={() => setMoveTarget(null)} title={moveTarget ? `Stock: ${moveTarget.name}` : ""}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: T.inkSoft }}>
            Current stock: <b style={{ color: T.ink }}>{moveTarget?.qty} {moveTarget?.unit}</b>
          </div>
          <Dropdown label={tc({ en: "Movement", hi: "आवाजाही", bn: "চলাচল" })} value={moveForm.kind} onChange={(v) => setMoveForm((f) => ({ ...f, kind: v }))}
            options={[{ value: "in", label: tc({ en: "Stock In (purchase/receive)", hi: "स्टॉक आवक (खरीद/प्राप्ति)", bn: "মজুত আগমন (ক্রয়/গ্রহণ)" }) }, { value: "out", label: tc({ en: "Stock Out (consumption/issue)", hi: "स्टॉक जावक (खपत/निर्गम)", bn: "মজুত নির্গমন (ব্যবহার/বিতরণ)" }) }]} />
          <Input label={tc({ en: "Quantity", hi: "मात्रा", bn: "পরিমাণ" })} type="number" placeholder="0" value={moveForm.qty} onChange={(v) => setMoveForm((f) => ({ ...f, qty: v }))} />
          <Input label={tc({ en: "Note", hi: "टिप्पणी", bn: "মন্তব্য" })} placeholder={tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })} value={moveForm.note} onChange={(v) => setMoveForm((f) => ({ ...f, note: v }))} />
          <Button full onClick={doMove} disabled={!moveForm.qty}>{tc({ en: "Save Movement", hi: "आवाजाही सहेजें", bn: "চলাচল সংরক্ষণ" })}</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delId} title={tc({ en: "Delete feed item?", hi: "चारा मद हटाएँ?", bn: "খাদ্য আইটেম মুছবেন?" })} onClose={() => setDelId(null)}
        actions={[
          { label: "Cancel", variant: "outline", onClick: () => setDelId(null) },
          { label: "Delete", variant: "danger", onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>The item and its stock history will be removed.</div>
      </Dialog>
    </>
  );
}
