import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Card, Button, Input, Dropdown, SectionHeader } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { cartService } from "../../services/marketplace/cartService.js";
import { mpOrderService } from "../../services/marketplace/mpOrderService.js";
import { PAYMENT_METHODS } from "../../services/marketplace/constantsMp.js";
import { rupee } from "../../utils/format.js";
import { commerceEnabled } from "../../services/commerce/config.js";
import { commerceApi } from "../../services/commerce/commerceApi.js";
import { cartLinesToOrderItems, sellersInCart } from "../../services/commerce/mappers.js";
import { openCheckout } from "../../services/commerce/razorpayCheckout.js";

export default function CheckoutPage() {
  const { pop, push, toast, tc, user } = useApp();
  const [lines, setLines] = useState([]);
  const [address, setAddress] = useState(() => mpOrderService.getAddress() || {
    name: user?.name || "", phone: user?.phone || "", village: "", district: "", state: "", pin: "",
  });
  const [payment, setPayment] = useState("cod");
  const [placing, setPlacing] = useState(false);

  useEffect(() => { cartService.getLines().then(setLines); }, []);

  const valid = lines.filter((l) => !l.saved && !l.problem);
  const totals = cartService.totals(lines);
  const bySeller = {};
  valid.forEach((l) => { (bySeller[l.product.sellerName || "Seller"] ||= []).push(l); });
  const addressOk = address.name && address.phone && address.village;

  const placeOrder = async () => {
    if (placing) return;
    setPlacing(true);
    mpOrderService.saveAddress(address);
    try {
      // Server-backed checkout: create the order and pay via Razorpay. Server
      // orders are single-seller, so a mixed-seller cart is checked out one
      // seller at a time. Fulfilment is confirmed by the server webhook.
      if (commerceEnabled()) {
        if (sellersInCart(valid).length > 1) {
          toast(tc({en:"Please check out one seller at a time",hi:"कृपया एक बार में एक विक्रेता से चेकआउट करें",bn:"একবারে একজন বিক্রেতার সাথে চেকআউট করুন"}), "info");
          setPlacing(false);
          return;
        }
        const { payment: paymentHandle } = await commerceApi.createOrder({
          items: cartLinesToOrderItems(valid),
          deliveryAddr: address,
        });
        await openCheckout(paymentHandle, {
          description: tc({en:"Marketplace order",hi:"मार्केटप्लेस ऑर्डर",bn:"মার্কেটপ্লেস অর্ডার"}),
          prefill: { name: address.name, contact: address.phone },
          onSuccess: async () => {
            await cartService.clearActive();
            toast(tc({en:"Payment received — order confirmed",hi:"भुगतान प्राप्त — ऑर्डर पुष्ट",bn:"পেমেন্ট পাওয়া গেছে — অর্ডার নিশ্চিত"}), "success");
            pop(); pop();
            push({ kind: "mpOrders" });
          },
          onDismiss: () => {
            toast(tc({en:"Payment cancelled",hi:"भुगतान रद्द",bn:"পেমেন্ট বাতিল"}), "info");
            setPlacing(false);
          },
        });
        return; // stay on checkout until Razorpay resolves
      }

      const created = await mpOrderService.createFromCart(valid, { paymentMethod: payment, address });
      await cartService.clearActive();
      toast(tc({en:`${created.length} order${created.length > 1 ? "s" : ""} placed`,hi:`${created.length} ऑर्डर दिए गए`,bn:`${created.length}টি অর্ডার দেওয়া হয়েছে`}), "success");
      pop(); pop();                        // drop checkout + cart from the stack
      push({ kind: "mpOrders" });
    } catch (e) {
      toast(e?.message || tc({en:"Could not place the order",hi:"ऑर्डर नहीं दिया जा सका",bn:"অর্ডার দেওয়া যায়নি"}), "info");
      setPlacing(false);
    }
  };

  const set = (k) => (v) => setAddress((a) => ({ ...a, [k]: v }));

  return (
    <>
      <AppBar title={tc({en:"Checkout",hi:"चेकआउट",bn:"চেকআউট"})} onBack={pop} />
      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 12,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        <SectionHeader title={tc({en:"Delivery address",hi:"डिलीवरी पता",bn:"ডেলিভারি ঠিকানা"})} />
        <Card pad={14}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Input label={tc({en:"Full name",hi:"पूरा नाम",bn:"পুরো নাম"})} value={address.name} onChange={set("name")} placeholder={tc({en:"Your name",hi:"आपका नाम",bn:"আপনার নাম"})} />
            <Input label={tc({en:"Phone",hi:"फ़ोन",bn:"ফোন"})} type="tel" inputMode="numeric" value={address.phone} onChange={set("phone")} placeholder={tc({en:"10-digit mobile",hi:"10 अंकों का मोबाइल",bn:"10 সংখ্যার মোবাইল"})} maxLength={10} />
            <Input label={tc({en:"Village / Town",hi:"गाँव / शहर",bn:"গ্রাম / শহর"})} value={address.village} onChange={set("village")} placeholder={tc({en:"Village or town",hi:"गाँव या शहर",bn:"গ্রাম বা শহর"})} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label={tc({en:"District",hi:"जिला",bn:"জেলা"})} value={address.district} onChange={set("district")} placeholder={tc({en:"District",hi:"जिला",bn:"জেলা"})} />
              <Input label={tc({en:"PIN code",hi:"पिन कोड",bn:"পিন কোড"})} inputMode="numeric" value={address.pin} onChange={set("pin")} placeholder={tc({en:"6 digits",hi:"6 अंक",bn:"6 সংখ্যা"})} maxLength={6} />
            </div>
          </div>
        </Card>

        <SectionHeader title={tc({en:"Payment",hi:"भुगतान",bn:"পেমেন্ট"})} />
        <Card pad={14}>
          <Dropdown label={tc({en:"Payment method",hi:"भुगतान विधि",bn:"পেমেন্ট পদ্ধতি"})} value={payment} onChange={setPayment}
            options={PAYMENT_METHODS.map((m) => ({ value: m.id, label: m.label }))} />
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 10, lineHeight: 1.5 }}>
            {tc({en:"Online payment collection arrives with the shared backend phase — for now payment is settled directly with the seller on delivery and recorded here.",hi:"ऑनलाइन भुगतान साझा बैकएंड चरण के साथ आएगा — अभी भुगतान डिलीवरी पर विक्रेता के साथ सीधे तय किया जाता है।",bn:"অনলাইন পেমেন্ট শেয়ার্ড ব্যাকএন্ড পর্বের সাথে আসবে — এখন পেমেন্ট ডেলিভারিতে বিক্রেতার সাথে সরাসরি নিষ্পত্তি করা হয়।"})}
          </div>
        </Card>

        <SectionHeader title={tc({en:"Order summary",hi:"ऑर्डर सारांश",bn:"অর্ডার সারাংশ"})} />
        {Object.entries(bySeller).map(([sellerName, group]) => (
          <Card key={sellerName} pad={14}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.primary, marginBottom: 8 }}>{sellerName}</div>
            {group.map((l) => (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0", color: T.inkSoft }}>
                <span>{l.product.name} × {l.qty}</span>
                <b style={{ color: T.ink }}>{rupee(l.lineTotal)}</b>
              </div>
            ))}
          </Card>
        ))}

        <Card pad={14}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800 }}>
            <span>{tc({en:"Total",hi:"कुल",bn:"মোট"})}</span><span>{rupee(totals.total)}</span>
          </div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4 }}>
            {tc({en:`${valid.length} item${valid.length !== 1 ? "s" : ""} · one order per seller`,hi:`${valid.length} आइटम · प्रति विक्रेता एक ऑर्डर`,bn:`${valid.length}টি আইটেম · প্রতি বিক্রেতা একটি অর্ডার`})}
          </div>
        </Card>

        <Button full size="lg" disabled={!addressOk || valid.length === 0 || placing} onClick={placeOrder}>
          {placing ? tc({en:"Placing order…",hi:"ऑर्डर दिया जा रहा है…",bn:"অর্ডার দেওয়া হচ্ছে…"}) : `${tc({en:"Place Order",hi:"ऑर्डर दें",bn:"অর্ডার দিন"})} · ${rupee(totals.total)}`}
        </Button>
        {!addressOk && (
          <div style={{ fontSize: 12, color: T.inkFaint, textAlign: "center" }}>
            {tc({en:"Fill name, phone and village to place the order.",hi:"ऑर्डर देने के लिए नाम, फ़ोन और गाँव भरें।",bn:"অর্ডার দিতে নাম, ফোন এবং গ্রাম পূরণ করুন।"})}
          </div>
        )}
      </div>
    </>
  );
}
