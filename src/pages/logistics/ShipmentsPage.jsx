import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Chip, Button, EmptyState } from "../../components/index.js";
import { BottomSheet } from "../../components/overlays.jsx";
import { Input, Dropdown } from "../../components/inputs.jsx";
import { useApp } from "../../store/AppStore.jsx";
import ShipmentCard from "../../components/logistics/ShipmentCard.jsx";
import { shipmentService } from "../../services/logistics/shipmentService.js";
import { COMMODITIES, PLACES, PAYMENT_TERMS, placeById } from "../../services/logistics/constantsLog.js";
import { routingService } from "../../services/logistics/routingService.js";
import { rupee } from "../../utils/format.js";

const EMPTY = { commodity: "Paddy", quantityKg: "", pickup: "barasat", drop: "kolkata", price: "", paymentTerm: "onDelivery", notes: "" };

export default function ShipmentsPage() {
  const { pop, push, toast, tc } = useApp();
  const FILTERS = [
    { id: "all", label: tc({en:"All", hi:"सभी", bn:"সব"}) },
    { id: "pending", label: tc({en:"Pending", hi:"लंबित", bn:"মুলতুবি"}) },
    { id: "active", label: tc({en:"Active", hi:"सक्रिय", bn:"সক্রিয়"}) },
    { id: "delivered", label: tc({en:"Delivered", hi:"वितरित", bn:"ডেলিভারি সম্পন্ন"}) },
  ];
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  useEffect(() => { shipmentService.getAll().then(setList); }, [tick]);

  const est = routingService.estimate(placeById(form.pickup), placeById(form.drop));

  const create = async () => {
    if (!form.quantityKg || !form.price) { toast(tc({en:"Enter quantity and price", hi:"मात्रा और मूल्य दर्ज करें", bn:"পরিমাণ এবং মূল্য লিখুন"}), "error"); return; }
    if (form.pickup === form.drop) { toast(tc({en:"Pickup and drop must differ", hi:"पिकअप और ड्रॉप अलग होने चाहिए", bn:"পিকআপ এবং ড্রপ ভিন্ন হতে হবে"}), "error"); return; }
    await shipmentService.create({
      commodity: form.commodity, quantityKg: form.quantityKg,
      pickup: placeById(form.pickup), drop: placeById(form.drop),
      price: form.price, paymentTerm: form.paymentTerm, notes: form.notes,
    });
    toast(tc({en:"Shipment created", hi:"शिपमेंट बनाई गई", bn:"শিপমেন্ট তৈরি করা হয়েছে"}), "success");
    setForm(EMPTY); setOpen(false); refresh();
  };

  const shown = (list || []).filter((s) => {
    if (filter === "all") return true;
    if (filter === "active") return ["assigned", "picked_up", "in_transit"].includes(s.status);
    if (filter === "delivered") return s.status === "delivered";
    return s.status === filter;
  });

  return (
    <>
      <AppBar title={tc({en:"Shipments", hi:"शिपमेंट", bn:"শিপমেন্ট"})} onBack={pop} action={<Button size="sm" icon="Plus" onClick={() => setOpen(true)}>{tc({en:"New", hi:"नया", bn:"নতুন"})}</Button>} />
      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 14,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {FILTERS.map((f) => (
            <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>
          ))}
        </div>

        {list === null ? null : shown.length === 0 ? (
          <EmptyState icon="Package" title={tc({en:"No shipments", hi:"कोई शिपमेंट नहीं", bn:"কোনো শিপমেন্ট নেই"})}
            body={filter === "all" ? tc({en:"Create a shipment to move produce to market or a buyer.", hi:"बाजार या खरीदार तक उपज पहुंचाने के लिए एक शिपमेंट बनाएं।", bn:"বাজার বা ক্রেতার কাছে ফসল পৌঁছাতে একটি শিপমেন্ট তৈরি করুন।"}) : tc({en:"No shipments in this filter.", hi:"इस फ़िल्टर में कोई शिपमेंट नहीं है।", bn:"এই ফিল্টারে কোনো শিপমেন্ট নেই।"})}
            action={filter === "all" ? tc({en:"New shipment", hi:"नई शिपमेंट", bn:"নতুন শিপমেন্ট"}) : undefined} onAction={filter === "all" ? () => setOpen(true) : undefined} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shown.map((s) => (
              <ShipmentCard key={s.id} shipment={s} onClick={() => push({ kind: "logShipmentDetail", props: { shipmentId: s.id } })} />
            ))}
          </div>
        )}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={tc({en:"New Shipment", hi:"नई शिपमेंट", bn:"নতুন শিপমেন্ট"})}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label={tc({en:"Commodity", hi:"वस्तु", bn:"পণ্য"})} value={form.commodity} onChange={(v) => setForm({ ...form, commodity: v })}
            options={COMMODITIES.map((c) => ({ value: c, label: c }))} />
          <Input label={tc({en:"Quantity (kg)", hi:"मात्रा (किग्रा)", bn:"পরিমাণ (কেজি)"})} value={form.quantityKg} onChange={(v) => setForm({ ...form, quantityKg: v })} icon="Scale" type="number" />
          <Dropdown label={tc({en:"Pickup", hi:"पिकअप", bn:"পিকআপ"})} value={form.pickup} onChange={(v) => setForm({ ...form, pickup: v })}
            options={PLACES.map((p) => ({ value: p.id, label: p.i18n ? tc(p.i18n) : p.name }))} />
          <Dropdown label={tc({en:"Drop", hi:"ड्रॉप", bn:"ড্রপ"})} value={form.drop} onChange={(v) => setForm({ ...form, drop: v })}
            options={PLACES.map((p) => ({ value: p.id, label: p.i18n ? tc(p.i18n) : p.name }))} />
          <div style={{ background: T.surface2, borderRadius: T.rMd, padding: "10px 14px", fontSize: 12, color: T.inkSoft }}>
            {tc({en:"Est. distance", hi:"अनुमानित दूरी", bn:"আনুমানিক দূরত্ব"})} <b style={{ color: T.ink }}>{est.distanceKm} km</b> · {tc({en:"ETA", hi:"ईटीए", bn:"পৌঁছানোর সময়"})} <b style={{ color: T.ink }}>{Math.round(est.etaMinutes / 60 * 10) / 10} h</b> · {tc({en:"fuel", hi:"ईंधन", bn:"জ্বালানি"})} ~<b style={{ color: T.ink }}>{rupee(est.fuelCost)}</b>
          </div>
          <Input label={tc({en:"Offered Price (₹)", hi:"प्रस्तावित मूल्य (₹)", bn:"প্রস্তাবিত মূল্য (₹)"})} value={form.price} onChange={(v) => setForm({ ...form, price: v })} icon="IndianRupee" type="number" />
          <Dropdown label={tc({en:"Payment Term", hi:"भुगतान शर्त", bn:"পেমেন্ট শর্ত"})} value={form.paymentTerm} onChange={(v) => setForm({ ...form, paymentTerm: v })}
            options={PAYMENT_TERMS.map((p) => ({ value: p.id, label: p.label }))} />
          <Input label={tc({en:"Notes (optional)", hi:"नोट (वैकल्पिक)", bn:"নোট (ঐচ্ছিক)"})} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} icon="FileText" />
          <div style={{ fontSize: 11, color: T.inkFaint, lineHeight: 1.5 }}>
            {tc({en:"No money is collected in-app — payment settles directly with the transporter.", hi:"ऐप में कोई पैसा एकत्र नहीं किया जाता — भुगतान सीधे परिवहनकर्ता के साथ होता है।", bn:"অ্যাপে কোনো টাকা সংগ্রহ করা হয় না — পেমেন্ট সরাসরি পরিবহনকারীর সাথে নিষ্পত্তি হয়।"})}
          </div>
          <Button full icon="Check" onClick={create}>{tc({en:"Create Shipment", hi:"शिपमेंट बनाएं", bn:"শিপমেন্ট তৈরি করুন"})}</Button>
        </div>
      </BottomSheet>
    </>
  );
}
