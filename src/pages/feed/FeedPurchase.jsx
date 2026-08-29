/* Feed Purchase — records a feed purchase order (reuses orderService, the
   same purchase-order system as the rest of the CRM/ERP, kind:"purchase")
   and, on save, automatically stocks the feed into inventory: either
   restocking an existing feed item or creating a new one. No duplicate
   purchase-order or finance system. */
import { useEffect, useMemo, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Screen, Card } from "../../components/index.js";
import { Input, Dropdown } from "../../components/inputs.jsx";
import { Button } from "../../components/primitives.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { feedInventory, feedPurchase, FEED_TYPES, LIVESTOCK_TYPES } from "../../services/feed/feedService.js";
import { contactService } from "../../services/crm/contactService.js";
import { rupee } from "../../utils/format.js";

const num = (v) => (v === "" || v === null || v === undefined ? "" : v);
const n2 = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

export default function FeedPurchase() {
  const { pop, toast, tc } = useApp();
  const [suppliers, setSuppliers] = useState([]);
  const [existingItems, setExistingItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const [contactId, setContactId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [feedItemId, setFeedItemId] = useState("");
  const [feedName, setFeedName] = useState("");
  const [feedType, setFeedType] = useState("starter");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [unitPrice, setUnitPrice] = useState("");
  const [gst, setGst] = useState("");
  const [discount, setDiscount] = useState("");
  const [transportCost, setTransportCost] = useState("");
  const [otherCharges, setOtherCharges] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState("open");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [enterprise, setEnterprise] = useState("other");

  useEffect(() => {
    contactService.getSuppliers().then(setSuppliers);
    feedInventory.getAll().then(setExistingItems);
  }, []);

  const goodsValue = n2(quantity) * n2(unitPrice);
  const totalCost = goodsValue + n2(gst) - n2(discount) + n2(transportCost) + n2(otherCharges);
  const canSave = feedName.trim() && n2(quantity) > 0 && n2(unitPrice) > 0;

  const onSelectExisting = (id) => {
    setFeedItemId(id);
    const it = existingItems.find((i) => i.id === id);
    if (it) { setFeedName(it.name); setFeedType(it.feedType || "starter"); setUnit(it.unit || "kg"); }
  };

  const supplierOptions = [{ value: "", label: tc({ en: "Select supplier (optional)", hi: "आपूर्तिकर्ता चुनें (वैकल्पिक)", bn: "সরবরাহকারী বাছুন (ঐচ্ছিক)" }) }, ...suppliers.map((s) => ({ value: s.id, label: s.name || tc({ en: "Unnamed supplier", hi: "बिना नाम आपूर्तिकर्ता", bn: "নামহীন সরবরাহকারী" }) }))];
  const itemOptions = [{ value: "", label: tc({ en: "New feed item", hi: "नई चारा मद", bn: "নতুন খাদ্য আইটেম" }) }, ...existingItems.map((i) => ({ value: i.id, label: i.name }))];

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await feedPurchase.record({
        contactId: contactId || null, supplierName: contactId ? "" : supplierName,
        feedItemId: feedItemId || null, feedName, feedType,
        quantity: n2(quantity), unit, unitPrice: n2(unitPrice),
        gst: n2(gst), discount: n2(discount), transportCost: n2(transportCost), otherCharges: n2(otherCharges),
        invoiceNumber, purchaseDate, paymentStatus, paymentMethod, dueDate, storageLocation, enterprise,
      });
      toast(tc({ en: "Feed purchase recorded, inventory updated & posted to Farm Ledger", hi: "चारा खरीद दर्ज, स्टॉक अपडेट और खाता-बही में जोड़ा गया", bn: "খাদ্য ক্রয় লেখা হয়েছে, মজুত হালনাগাদ ও খাতায় যোগ হয়েছে" }), "success");
      pop();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppBar title={tc({ en: "Feed purchase", hi: "चारा खरीद", bn: "খাদ্য ক্রয়" })} onBack={pop} />
      <Screen gap={18}>
        <Card pad={14}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Dropdown label={tc({ en: "Supplier", hi: "आपूर्तिकर्ता", bn: "সরবরাহকারী" })} value={contactId} onChange={setContactId} options={supplierOptions} />
            {!contactId && <Input label={tc({ en: "Supplier name (if not in your contacts)", hi: "आपूर्तिकर्ता का नाम (यदि संपर्क में नहीं)", bn: "সরবরাহকারীর নাম (যদি পরিচিতিতে না থাকে)" })} value={supplierName} onChange={setSupplierName} placeholder={tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })} />}
            <Input label={tc({ en: "Invoice number (optional)", hi: "बिल नंबर (वैकल्पिक)", bn: "চালান নম্বর (ঐচ্ছিক)" })} value={invoiceNumber} onChange={setInvoiceNumber} />
            <Input label={tc({ en: "Purchase date", hi: "खरीद तिथि", bn: "ক্রয়ের তারিখ" })} type="date" value={purchaseDate} onChange={setPurchaseDate} />
          </div>
        </Card>

        <Card pad={14}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Dropdown label={tc({ en: "Feed item", hi: "चारा मद", bn: "খাদ্য আইটেম" })} value={feedItemId} onChange={onSelectExisting} options={itemOptions} />
            {!feedItemId && (
              <>
                <Input label={tc({ en: "Feed name", hi: "चारा नाम", bn: "খাদ্যের নাম" })} value={feedName} onChange={setFeedName} placeholder={tc({ en: "e.g. Broiler Starter Mix 50kg", hi: "उदा. ब्रॉयलर स्टार्टर मिक्स 50 किग्रा", bn: "যেমন ব্রয়লার স্টার্টার মিক্স ৫০ কেজি" })} />
                <Dropdown label={tc({ en: "Feed type", hi: "चारा प्रकार", bn: "খাদ্যের ধরন" })} value={feedType} onChange={setFeedType} options={FEED_TYPES.map((t) => ({ value: t.id, label: t.i18n ? tc(t.i18n) : t.label }))} />
              </>
            )}
            <Dropdown label={tc({ en: "Livestock (for ledger/cost tracking)", hi: "पशु (खाता/लागत हेतु)", bn: "প্রাণী (খাতা/ব্যয়ের জন্য)" })} value={enterprise} onChange={setEnterprise}
              options={LIVESTOCK_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label={tc({ en: "Quantity", hi: "मात्रा", bn: "পরিমাণ" })} value={num(quantity)} onChange={setQuantity} type="number" inputMode="decimal" />
              <Input label={tc({ en: "Unit", hi: "इकाई", bn: "একক" })} value={unit} onChange={setUnit} placeholder={tc({ en: "kg / bags", hi: "किग्रा / बोरी", bn: "কেজি / বস্তা" })} />
            </div>
            <Input label={tc({ en: "Unit price (₹)", hi: "इकाई मूल्य (₹)", bn: "একক মূল্য (₹)" })} value={num(unitPrice)} onChange={setUnitPrice} type="number" inputMode="decimal" prefix="₹" />
          </div>
        </Card>

        <Card pad={14}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label={tc({ en: "GST (₹, optional)", hi: "GST (₹, वैकल्पिक)", bn: "GST (₹, ঐচ্ছিক)" })} value={num(gst)} onChange={setGst} type="number" inputMode="decimal" prefix="₹" />
              <Input label={tc({ en: "Discount (₹, optional)", hi: "छूट (₹, वैकल्पिक)", bn: "ছাড় (₹, ঐচ্ছিক)" })} value={num(discount)} onChange={setDiscount} type="number" inputMode="decimal" prefix="₹" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label={tc({ en: "Transport cost (₹, optional)", hi: "परिवहन लागत (₹, वैकल्पिक)", bn: "পরিবহন ব্যয় (₹, ঐচ্ছিক)" })} value={num(transportCost)} onChange={setTransportCost} type="number" inputMode="decimal" prefix="₹" />
              <Input label={tc({ en: "Other charges (₹, optional)", hi: "अन्य शुल्क (₹, वैकल्पिक)", bn: "অন্যান্য চার্জ (₹, ঐচ্ছিক)" })} value={num(otherCharges)} onChange={setOtherCharges} type="number" inputMode="decimal" prefix="₹" />
            </div>
          </div>
        </Card>

        <Card pad={14}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Dropdown label={tc({ en: "Payment status", hi: "भुगतान स्थिति", bn: "পেমেন্টের অবস্থা" })} value={paymentStatus} onChange={setPaymentStatus}
              options={[{ value: "open", label: tc({ en: "Open / unpaid", hi: "बकाया / अवैतनिक", bn: "বকেয়া / অপরিশোধিত" }) }, { value: "paid", label: tc({ en: "Paid", hi: "भुगतान हुआ", bn: "পরিশোধিত" }) }, { value: "delivered", label: tc({ en: "Delivered", hi: "वितरित", bn: "সরবরাহকৃত" }) }]} />
            <Input label={tc({ en: "Payment method (optional)", hi: "भुगतान तरीका (वैकल्पिक)", bn: "পেমেন্ট পদ্ধতি (ঐচ্ছিক)" })} value={paymentMethod} onChange={setPaymentMethod} placeholder={tc({ en: "Cash / UPI / Bank transfer", hi: "नकद / UPI / बैंक ट्रांसफर", bn: "নগদ / UPI / ব্যাঙ্ক ট্রান্সফার" })} />
            <Input label={tc({ en: "Due date (optional)", hi: "देय तिथि (वैकल्पिक)", bn: "প্রদেয় তারিখ (ঐচ্ছিক)" })} type="date" value={dueDate} onChange={setDueDate} />
            <Input label={tc({ en: "Storage location (optional)", hi: "भंडारण स्थान (वैकल्पिक)", bn: "সংরক্ষণের স্থান (ঐচ্ছিক)" })} value={storageLocation} onChange={setStorageLocation} />
          </div>
        </Card>

        <Card pad={14} style={{ background: T.primarySoft, border: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.inkSoft }}>
            <span>{tc({ en: "Goods value", hi: "माल मूल्य", bn: "পণ্যের মূল্য" })}</span><span>{rupee(goodsValue)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{tc({ en: "Total cost", hi: "कुल लागत", bn: "মোট ব্যয়" })}</span>
            <span style={{ fontFamily: T.display, fontSize: 20, fontWeight: 800, color: T.primary }}>{rupee(totalCost)}</span>
          </div>
        </Card>

        <Button full onClick={save} disabled={!canSave || saving}>
          {saving ? "Saving…" : "Save purchase & update inventory"}
        </Button>
      </Screen>
    </>
  );
}
