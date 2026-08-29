import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Button, Chip } from "../../components/index.js";
import Icon from "../../components/Icon.jsx";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { inventoryService, ITEM_CATEGORIES } from "../../services/inventory/inventoryService.js";
import StatTile from "../../components/erp/StatTile.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";

export default function InventoryManager() {
  const { pop, toast, can, tc } = useApp();
  const [items, setItems]   = useState([]);
  const [alerts, setAlerts] = useState({ lowStock: [], expired: [], expiring: [] });
  const [catFilter, setCatFilter] = useState("all");
  const [tick, setTick]     = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "feed", qty: "", unit: "kg", minQty: "", unitPrice: "", expiryDate: "", supplierName: "" });
  const [moveTarget, setMoveTarget] = useState(null); // item
  const [moveForm, setMoveForm]     = useState({ kind: "in", qty: "", note: "" });
  const [delId, setDelId] = useState(null);

  useEffect(() => {
    inventoryService.getAll().then(setItems);
    inventoryService.alerts().then(setAlerts);
  }, [tick]);

  const list = catFilter === "all" ? items : items.filter((i) => i.category === catFilter);
  const alertCount = alerts.lowStock.length + alerts.expired.length + alerts.expiring.length;

  const add = async () => {
    if (!form.name) return;
    await inventoryService.addItem(form);
    setOpen(false);
    setForm({ name: "", category: "feed", qty: "", unit: "kg", minQty: "", unitPrice: "", expiryDate: "", supplierName: "" });
    refresh(); toast(tc({ en: "Item added", hi: "मद जोड़ी गई", bn: "আইটেম যোগ হয়েছে" }), "success");
  };

  const doMove = async () => {
    if (!moveForm.qty) return;
    await inventoryService.move(moveTarget.id, moveForm.kind, moveForm.qty, moveForm.note);
    setMoveTarget(null); setMoveForm({ kind: "in", qty: "", note: "" });
    refresh(); toast(moveForm.kind === "in" ? tc({ en: "Stock added", hi: "स्टॉक जोड़ा गया", bn: "মজুত যোগ হয়েছে" }) : tc({ en: "Stock issued", hi: "स्टॉक निकाला गया", bn: "মজুত বের করা হয়েছে" }), "success");
  };

  const handleDelete = async () => { await inventoryService.removeItem(delId); setDelId(null); refresh(); toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে ফেলা হয়েছে" }), "info"); };

  const itemBadge = (i) => {
    const today = new Date().toISOString().slice(0, 10);
    if (i.expiryDate && i.expiryDate < today) return <Pill fg={T.red} bg={T.redSoft}>EXPIRED</Pill>;
    if (i.minQty && Number(i.qty) <= Number(i.minQty)) return <Pill fg={T.orange} bg={T.orangeSoft}>LOW</Pill>;
    return null;
  };

  return (
    <>
      <AppBar title={tc({ en: "Inventory", hi: "स्टॉक", bn: "মজুত" })} onBack={pop} action={
        <button onClick={() => setOpen(true)}
          style={{ background: T.orange, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
        </button>
      } />

      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        <StatTile a="orange" label={tc({ en: "Items", hi: "मदें", bn: "আইটেম" })} value={items.length} />
        <StatTile a={alertCount > 0 ? "red" : "primary"} label={tc({ en: "Alerts", hi: "अलर्ट", bn: "সতর্কতা" })} value={alertCount} />
        <StatTile a="blue" label={tc({ en: "Low Stock", hi: "कम स्टॉक", bn: "কম মজুত" })} value={alerts.lowStock.length} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px", overflowX: "auto" }}>
        <Chip active={catFilter === "all"} onClick={() => setCatFilter("all")}>All</Chip>
        {ITEM_CATEGORIES.map((c) => (
          <Chip key={c.id} active={catFilter === c.id} onClick={() => setCatFilter(c.id)}>{c.label}</Chip>
        ))}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {list.length === 0
          ? <EmptyHint icon="Warehouse" text={tc({ en: "Add feed, medicine, seeds and other stock to track levels and expiry", hi: "स्तर और समय-सीमा देखने के लिए चारा, दवा, बीज और अन्य स्टॉक जोड़ें", bn: "স্তর ও মেয়াদ দেখতে খাদ্য, ওষুধ, বীজ ও অন্যান্য মজুত যোগ করুন" })} />
          : list.map((i) => (
            <RecordRow key={i.id}
              icon={inventoryService.categoryIcon(i.category)} iconColor={T.orange} iconBg={T.orangeSoft}
              title={i.name}
              badge={itemBadge(i)}
              subtitle={`${i.qty} ${i.unit || ""} in stock${i.minQty ? ` · min ${i.minQty}` : ""}${i.expiryDate ? ` · exp ${i.expiryDate}` : ""}${i.supplierName ? ` · ${i.supplierName}` : ""}`}
              right={
                <button onClick={(e) => { e.stopPropagation(); setMoveTarget(i); }}
                  style={{ background: T.primarySoft, color: T.primary, border: "none", borderRadius: 9,
                    padding: "6px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: T.body, flexShrink: 0 }}>
                  In / Out
                </button>
              }
              onDelete={can("records.delete") ? () => setDelId(i.id) : undefined} />
          ))}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={tc({ en: "Add Inventory Item", hi: "स्टॉक मद जोड़ें", bn: "মজুত আইটেম যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Item name", hi: "मद का नाम", bn: "আইটেমের নাম" })} placeholder={tc({ en: "e.g. Layer feed 50kg", hi: "उदा. लेयर फ़ीड 50 किग्रा", bn: "যেমন লেয়ার ফিড ৫০ কেজি" })} value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Dropdown label={tc({ en: "Category", hi: "श्रेणी", bn: "শ্রেণি" })} value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))}
            options={ITEM_CATEGORIES.map((c) => ({ value: c.id, label: c.i18n ? tc(c.i18n) : c.label }))} />
          <Input label={tc({ en: "Opening quantity", hi: "प्रारंभिक मात्रा", bn: "প্রারম্ভিক পরিমাণ" })} type="number" placeholder="0" value={form.qty} onChange={(v) => setForm((f) => ({ ...f, qty: v }))} />
          <Input label={tc({ en: "Unit", hi: "इकाई", bn: "একক" })} placeholder={tc({ en: "kg / L / bags / pcs", hi: "किग्रा / लीटर / बोरी / नग", bn: "কেজি / লিটার / বস্তা / পিস" })} value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} />
          <Input label={tc({ en: "Low-stock alert level", hi: "कम स्टॉक अलर्ट स्तर", bn: "কম মজুত সতর্কতার স্তর" })} type="number" placeholder="0" value={form.minQty} onChange={(v) => setForm((f) => ({ ...f, minQty: v }))} />
          <Input label={tc({ en: "Unit price (₹)", hi: "इकाई मूल्य (₹)", bn: "একক মূল্য (₹)" })} type="number" placeholder="0" value={form.unitPrice} onChange={(v) => setForm((f) => ({ ...f, unitPrice: v }))} />
          <Input label={tc({ en: "Expiry date (optional)", hi: "समय-सीमा तिथि (वैकल्पिक)", bn: "মেয়াদ শেষের তারিখ (ঐচ্ছিক)" })} type="date" value={form.expiryDate} onChange={(v) => setForm((f) => ({ ...f, expiryDate: v }))} />
          <Input label={tc({ en: "Supplier (optional)", hi: "आपूर्तिकर्ता (वैकल्पिक)", bn: "সরবরাহকারী (ঐচ্ছিক)" })} placeholder="" value={form.supplierName} onChange={(v) => setForm((f) => ({ ...f, supplierName: v }))} />
          <Button full onClick={add} disabled={!form.name}>{tc({ en: "Add Item", hi: "मद जोड़ें", bn: "আইটেম যোগ করুন" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!moveTarget} onClose={() => setMoveTarget(null)} title={moveTarget ? `Stock: ${moveTarget.name}` : ""}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: T.inkSoft }}>
            Current stock: <b style={{ color: T.ink }}>{moveTarget?.qty} {moveTarget?.unit}</b>
          </div>
          <Dropdown label={tc({ en: "Movement", hi: "आवाजाही", bn: "চলাচল" })} value={moveForm.kind} onChange={(v) => setMoveForm((f) => ({ ...f, kind: v }))}
            options={[{ value: "in", label: "Stock In (purchase/receive)" }, { value: "out", label: "Stock Out (use/issue)" }]} />
          <Input label={tc({ en: "Quantity", hi: "मात्रा", bn: "পরিমাণ" })} type="number" placeholder="0" value={moveForm.qty} onChange={(v) => setMoveForm((f) => ({ ...f, qty: v }))} />
          <Input label={tc({ en: "Note", hi: "टिप्पणी", bn: "মন্তব্য" })} placeholder={tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })} value={moveForm.note} onChange={(v) => setMoveForm((f) => ({ ...f, note: v }))} />
          <Button full onClick={doMove} disabled={!moveForm.qty}>{tc({ en: "Save Movement", hi: "आवाजाही सहेजें", bn: "চলাচল সংরক্ষণ" })}</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delId} title={tc({ en: "Delete item?", hi: "मद हटाएँ?", bn: "আইটেম মুছবেন?" })} onClose={() => setDelId(null)}
        actions={[
          { label: tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" }), variant: "outline", onClick: () => setDelId(null) },
          { label: tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" }), variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>{tc({ en: "The item and its stock history will be removed.", hi: "यह मद और इसका स्टॉक इतिहास हट जाएगा।", bn: "এই আইটেম ও এর মজুত ইতিহাস মুছে যাবে।" })}</div>
      </Dialog>
    </>
  );
}
