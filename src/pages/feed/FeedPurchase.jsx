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
import { feedInventory, feedPurchase, FEED_TYPES } from "../../services/feed/feedService.js";
import { contactService } from "../../services/crm/contactService.js";
import { rupee } from "../../utils/format.js";

const num = (v) => (v === "" || v === null || v === undefined ? "" : v);
const n2 = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

export default function FeedPurchase() {
  const { pop, toast } = useApp();
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

  const supplierOptions = [{ value: "", label: "Select supplier (optional)" }, ...suppliers.map((s) => ({ value: s.id, label: s.name || "Unnamed supplier" }))];
  const itemOptions = [{ value: "", label: "New feed item" }, ...existingItems.map((i) => ({ value: i.id, label: i.name }))];

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await feedPurchase.record({
        contactId: contactId || null, supplierName: contactId ? "" : supplierName,
        feedItemId: feedItemId || null, feedName, feedType,
        quantity: n2(quantity), unit, unitPrice: n2(unitPrice),
        gst: n2(gst), discount: n2(discount), transportCost: n2(transportCost), otherCharges: n2(otherCharges),
        invoiceNumber, purchaseDate, paymentStatus, paymentMethod, dueDate, storageLocation,
      });
      toast("Feed purchase recorded and inventory updated", "success");
      pop();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppBar title="Feed purchase" onBack={pop} />
      <Screen gap={18}>
        <Card pad={14}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Dropdown label="Supplier" value={contactId} onChange={setContactId} options={supplierOptions} />
            {!contactId && <Input label="Supplier name (if not in your contacts)" value={supplierName} onChange={setSupplierName} placeholder="Optional" />}
            <Input label="Invoice number (optional)" value={invoiceNumber} onChange={setInvoiceNumber} />
            <Input label="Purchase date" type="date" value={purchaseDate} onChange={setPurchaseDate} />
          </div>
        </Card>

        <Card pad={14}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Dropdown label="Feed item" value={feedItemId} onChange={onSelectExisting} options={itemOptions} />
            {!feedItemId && (
              <>
                <Input label="Feed name" value={feedName} onChange={setFeedName} placeholder="e.g. Broiler Starter Mix 50kg" />
                <Dropdown label="Feed type" value={feedType} onChange={setFeedType} options={FEED_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
              </>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label="Quantity" value={num(quantity)} onChange={setQuantity} type="number" inputMode="decimal" />
              <Input label="Unit" value={unit} onChange={setUnit} placeholder="kg / bags" />
            </div>
            <Input label="Unit price (₹)" value={num(unitPrice)} onChange={setUnitPrice} type="number" inputMode="decimal" prefix="₹" />
          </div>
        </Card>

        <Card pad={14}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label="GST (₹, optional)" value={num(gst)} onChange={setGst} type="number" inputMode="decimal" prefix="₹" />
              <Input label="Discount (₹, optional)" value={num(discount)} onChange={setDiscount} type="number" inputMode="decimal" prefix="₹" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label="Transport cost (₹, optional)" value={num(transportCost)} onChange={setTransportCost} type="number" inputMode="decimal" prefix="₹" />
              <Input label="Other charges (₹, optional)" value={num(otherCharges)} onChange={setOtherCharges} type="number" inputMode="decimal" prefix="₹" />
            </div>
          </div>
        </Card>

        <Card pad={14}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Dropdown label="Payment status" value={paymentStatus} onChange={setPaymentStatus}
              options={[{ value: "open", label: "Open / unpaid" }, { value: "paid", label: "Paid" }, { value: "delivered", label: "Delivered" }]} />
            <Input label="Payment method (optional)" value={paymentMethod} onChange={setPaymentMethod} placeholder="Cash / UPI / Bank transfer" />
            <Input label="Due date (optional)" type="date" value={dueDate} onChange={setDueDate} />
            <Input label="Storage location (optional)" value={storageLocation} onChange={setStorageLocation} />
          </div>
        </Card>

        <Card pad={14} style={{ background: T.primarySoft, border: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.inkSoft }}>
            <span>Goods value</span><span>{rupee(goodsValue)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>Total cost</span>
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
