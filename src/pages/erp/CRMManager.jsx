import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Button, Chip, Card } from "../../components/index.js";
import Icon from "../../components/Icon.jsx";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { contactService, CONTACT_TYPES } from "../../services/crm/contactService.js";
import { orderService } from "../../services/crm/orderService.js";
import { rupee, compact } from "../../utils/format.js";
import StatTile from "../../components/erp/StatTile.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";

/* id drives state and the render branches; label is display only. */
const TABS = [
  { id: "Customers", label: { en: "Customers", hi: "ग्राहक",         bn: "ক্রেতা"          } },
  { id: "Suppliers", label: { en: "Suppliers", hi: "आपूर्तिकर्ता",    bn: "সরবরাহকারী"     } },
  { id: "Orders",    label: { en: "Orders",    hi: "ऑर्डर",          bn: "অর্ডার"          } },
];
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function CRMManager() {
  const { pop, toast, can, tc } = useApp();
  const [tab, setTab]         = useState("Customers");
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders]   = useState([]);
  const [summary, setSummary] = useState(null);
  const [tick, setTick]       = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", type: "customer", phone: "", village: "", gst: "" });
  const [orderOpen, setOrderOpen]     = useState(false);
  const [orderForm, setOrderForm]     = useState({ kind: "sale", contactId: "", item: "", qty: "", unit: "kg", rate: "", date: todayStr() });
  const [payTarget, setPayTarget]     = useState(null);
  const [payAmount, setPayAmount]     = useState("");
  const [delTarget, setDelTarget]     = useState(null); // {id, kind}

  useEffect(() => {
    contactService.getCustomers().then(setCustomers);
    contactService.getSuppliers().then(setSuppliers);
    orderService.getAll().then(setOrders);
    orderService.summary().then(setSummary);
  }, [tick]);

  const allContacts = [...customers, ...suppliers];
  const contactName = (id) => allContacts.find((c) => c.id === id)?.name || "—";

  const addContact = async () => {
    if (!contactForm.name) return;
    await contactService.add(contactForm);
    setContactOpen(false); setContactForm({ name: "", type: "customer", phone: "", village: "", gst: "" });
    refresh(); toast(tc({ en: "Contact added", hi: "संपर्क जोड़ा गया", bn: "পরিচিতি যোগ হয়েছে" }), "success");
  };

  const addOrder = async () => {
    if (!orderForm.item || !orderForm.qty || !orderForm.rate) return;
    await orderService.add(orderForm);
    setOrderOpen(false); setOrderForm({ kind: "sale", contactId: "", item: "", qty: "", unit: "kg", rate: "", date: todayStr() });
    refresh(); toast(tc({ en: "Order created", hi: "ऑर्डर बनाया गया", bn: "অর্ডার তৈরি হয়েছে" }), "success");
  };

  const recordPay = async () => {
    if (!payAmount) return;
    await orderService.recordPayment(payTarget.id, payAmount);
    setPayTarget(null); setPayAmount("");
    refresh(); toast(tc({ en: "Payment recorded", hi: "भुगतान दर्ज हुआ", bn: "পেমেন্ট লেখা হয়েছে" }), "success");
  };

  const handleDelete = async () => {
    if (delTarget.kind === "contact") await contactService.remove(delTarget.id);
    else await orderService.remove(delTarget.id);
    setDelTarget(null); refresh(); toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে ফেলা হয়েছে" }), "info");
  };

  const orderBadge = (o) => {
    if (o.status === "paid") return <Pill>PAID</Pill>;
    const due = o.amount - (o.paidAmount || 0);
    if (due > 0 && o.paidAmount > 0) return <Pill fg={T.orange} bg={T.orangeSoft}>PART PAID</Pill>;
    return <Pill fg={T.blue} bg={T.blueSoft}>OPEN</Pill>;
  };

  const contactRows = (list, emptyText) => list.length === 0
    ? <EmptyHint icon="Handshake" text={emptyText} />
    : list.map((c) => (
      <RecordRow key={c.id} icon={contactService.isSupplier(c) ? "Truck" : "Contact"}
        iconColor={T.primary} iconBg={T.primarySoft}
        title={c.name}
        badge={<Pill fg={T.blue} bg={T.blueSoft}>{(() => { const ct = CONTACT_TYPES.find((x) => x.id === c.type); return ct?.i18n ? tc(ct.i18n) : contactService.typeLabel(c.type); })()}</Pill>}
        subtitle={`${c.phone || tc({ en: "No phone", hi: "फ़ोन नहीं", bn: "ফোন নেই" })}${c.village ? ` · ${c.village}` : ""}${c.gst ? ` · GST ${c.gst}` : ""}`}
        onDelete={can("records.delete") ? () => setDelTarget({ id: c.id, kind: "contact" }) : undefined} />
    ));

  return (
    <>
      <AppBar title={tc({ en: "CRM & Orders", hi: "ग्राहक और ऑर्डर", bn: "ক্রেতা ও অর্ডার" })} onBack={pop} action={
        <button onClick={() => tab === "Orders" ? setOrderOpen(true) : setContactOpen(true)}
          style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
        </button>
      } />

      {summary && (
        <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
          <StatTile a="primary" label={tc({ en: "Sales", hi: "बिक्री", bn: "বিক্রয়" })} value={compact(summary.salesTotal)} />
          <StatTile a={summary.salesDue > 0 ? "orange" : "blue"} label={tc({ en: "To Collect", hi: "वसूली बाकी", bn: "আদায় বাকি" })} value={compact(summary.salesDue)} />
          <StatTile a="red" label={tc({ en: "To Pay", hi: "भुगतान बाकी", bn: "পরিশোধ বাকি" })} value={compact(summary.purchaseDue)} />
          <StatTile a="blue" label={tc({ en: "Open Orders", hi: "खुले ऑर्डर", bn: "খোলা অর্ডার" })} value={summary.openOrders} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px" }}>
        {TABS.map((t) => <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{tc(t.label)}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {tab === "Customers" && contactRows(customers, tc({ en: "Add buyers, wholesalers and retailers you sell to", hi: "जिन्हें आप बेचते हैं वे खरीदार, थोक और फुटकर विक्रेता जोड़ें", bn: "যাদের কাছে বিক্রি করেন সেই ক্রেতা, পাইকার ও খুচরা বিক্রেতা যোগ করুন" }))}
        {tab === "Suppliers" && contactRows(suppliers, tc({ en: "Add suppliers and vendors you purchase from", hi: "जिनसे आप खरीदते हैं वे आपूर्तिकर्ता और विक्रेता जोड़ें", bn: "যাদের থেকে কেনেন সেই সরবরাহকারী ও বিক্রেতা যোগ করুন" }))}

        {tab === "Orders" && (orders.length === 0
          ? <EmptyHint icon="Receipt" text={tc({ en: "Create sales and purchase orders with payment tracking", hi: "भुगतान ट्रैकिंग के साथ बिक्री और खरीद ऑर्डर बनाएँ", bn: "পেমেন্ট ট্র্যাকিংসহ বিক্রয় ও ক্রয় অর্ডার তৈরি করুন" })} />
          : orders.map((o) => {
            const due = o.amount - (o.paidAmount || 0);
            return (
              <Card key={o.id} pad={13}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: o.kind === "sale" ? T.primarySoft : T.orangeSoft,
                    display: "grid", placeItems: "center" }}>
                    <Icon name={o.kind === "sale" ? "ArrowUpRight" : "ArrowDownLeft"} size={20}
                      color={o.kind === "sale" ? T.primary : T.orange} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {o.item} — {rupee(o.amount)}
                      {orderBadge(o)}
                    </div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                      {o.kind === "sale" ? "Sale to" : "Purchase from"} {contactName(o.contactId)} · {o.qty} {o.unit} @ {rupee(Number(o.rate))} · {o.date}
                      {due > 0 && <span style={{ color: T.orange }}> · Due {rupee(due)}</span>}
                    </div>
                  </div>
                  {due > 0 && (
                    <button onClick={() => { setPayTarget(o); setPayAmount(String(due)); }}
                      style={{ background: T.primarySoft, color: T.primary, border: "none", borderRadius: 9,
                        padding: "6px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: T.body, flexShrink: 0 }}>
                      Payment
                    </button>
                  )}
                  {can("records.delete") && (
                  <button onClick={() => setDelTarget({ id: o.id, kind: "order" })}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4, flexShrink: 0 }}>
                    <Icon name="Trash2" size={15} />
                  </button>
                  )}
                </div>
              </Card>
            );
          }))}
      </div>

      <BottomSheet open={contactOpen} onClose={() => setContactOpen(false)} title={tc({ en: "Add Contact", hi: "संपर्क जोड़ें", bn: "পরিচিতি যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Name", hi: "नाम", bn: "নাম" })} placeholder={tc({ en: "e.g. Barasat Traders", hi: "उदा. बारासात ट्रेडर्स", bn: "যেমন বারাসাত ট্রেডার্স" })} value={contactForm.name} onChange={(v) => setContactForm((f) => ({ ...f, name: v }))} />
          <Dropdown label={tc({ en: "Type", hi: "प्रकार", bn: "ধরন" })} value={contactForm.type} onChange={(v) => setContactForm((f) => ({ ...f, type: v }))}
            options={CONTACT_TYPES.map((t) => ({ value: t.id, label: t.i18n ? tc(t.i18n) : t.label }))} />
          <Input label={tc({ en: "Phone", hi: "फ़ोन", bn: "ফোন" })} placeholder={tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })} value={contactForm.phone} onChange={(v) => setContactForm((f) => ({ ...f, phone: v }))} />
          <Input label={tc({ en: "Village / Town", hi: "गाँव / शहर", bn: "গ্রাম / শহর" })} placeholder={tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })} value={contactForm.village} onChange={(v) => setContactForm((f) => ({ ...f, village: v }))} />
          <Input label={tc({ en: "GST number", hi: "GST नंबर", bn: "GST নম্বর" })} placeholder={tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })} value={contactForm.gst} onChange={(v) => setContactForm((f) => ({ ...f, gst: v }))} />
          <Button full onClick={addContact} disabled={!contactForm.name}>{tc({ en: "Add Contact", hi: "संपर्क जोड़ें", bn: "পরিচিতি যোগ করুন" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={orderOpen} onClose={() => setOrderOpen(false)} title={tc({ en: "New Order", hi: "नया ऑर्डर", bn: "নতুন অর্ডার" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label={tc({ en: "Order type", hi: "ऑर्डर प्रकार", bn: "অর্ডারের ধরন" })} value={orderForm.kind} onChange={(v) => setOrderForm((f) => ({ ...f, kind: v }))}
            options={[{ value: "sale", label: tc({ en: "Sale (you sell)", hi: "बिक्री (आप बेचते हैं)", bn: "বিক্রয় (আপনি বেচেন)" }) }, { value: "purchase", label: tc({ en: "Purchase (you buy)", hi: "खरीद (आप खरीदते हैं)", bn: "ক্রয় (আপনি কেনেন)" }) }]} />
          <Dropdown label={tc({ en: "Contact", hi: "संपर्क", bn: "পরিচিতি" })} value={orderForm.contactId} onChange={(v) => setOrderForm((f) => ({ ...f, contactId: v }))}
            options={[{ value: "", label: tc({ en: "Select contact…", hi: "संपर्क चुनें…", bn: "পরিচিতি বাছুন…" }) },
              ...(orderForm.kind === "sale" ? customers : suppliers).map((c) => ({ value: c.id, label: c.name }))]} />
          <Input label={tc({ en: "Item", hi: "वस्तु", bn: "পণ্য" })} placeholder={tc({ en: "e.g. Paddy / Eggs / Feed", hi: "उदा. धान / अंडे / चारा", bn: "যেমন ধান / ডিম / খাদ্য" })} value={orderForm.item} onChange={(v) => setOrderForm((f) => ({ ...f, item: v }))} />
          <Input label={tc({ en: "Quantity", hi: "मात्रा", bn: "পরিমাণ" })} type="number" placeholder="0" value={orderForm.qty} onChange={(v) => setOrderForm((f) => ({ ...f, qty: v }))} />
          <Input label={tc({ en: "Unit", hi: "इकाई", bn: "একক" })} placeholder={tc({ en: "kg / qtl / pcs / L", hi: "किग्रा / क्विंटल / नग / लीटर", bn: "কেজি / কুইন্টাল / পিস / লিটার" })} value={orderForm.unit} onChange={(v) => setOrderForm((f) => ({ ...f, unit: v }))} />
          <Input label={tc({ en: "Rate (₹ per unit)", hi: "दर (₹ प्रति इकाई)", bn: "দর (₹ প্রতি একক)" })} type="number" placeholder="0" value={orderForm.rate} onChange={(v) => setOrderForm((f) => ({ ...f, rate: v }))} />
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date" value={orderForm.date} onChange={(v) => setOrderForm((f) => ({ ...f, date: v }))} />
          {orderForm.qty && orderForm.rate && (
            <div style={{ fontSize: 13, color: T.primary, fontWeight: 700 }}>
              Total: {rupee((Number(orderForm.qty) || 0) * (Number(orderForm.rate) || 0))}
            </div>
          )}
          <Button full onClick={addOrder} disabled={!orderForm.item || !orderForm.qty || !orderForm.rate}>{tc({ en: "Create Order", hi: "ऑर्डर बनाएँ", bn: "অর্ডার তৈরি করুন" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!payTarget} onClose={() => setPayTarget(null)} title={tc({ en: "Record Payment", hi: "भुगतान दर्ज करें", bn: "পেমেন্ট লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: T.inkSoft }}>
            {payTarget?.item} — total {rupee(payTarget?.amount || 0)}, paid {rupee(payTarget?.paidAmount || 0)}
          </div>
          <Input label={tc({ en: "Amount received / paid (₹)", hi: "प्राप्त / भुगतान राशि (₹)", bn: "প্রাপ্ত / প্রদত্ত পরিমাণ (₹)" })} type="number" value={payAmount} onChange={setPayAmount} />
          <Button full onClick={recordPay} disabled={!payAmount}>{tc({ en: "Record Payment", hi: "भुगतान दर्ज करें", bn: "পেমেন্ট লিখুন" })}</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delTarget} title={tc({ en: "Delete?", hi: "हटाएँ?", bn: "মুছবেন?" })} onClose={() => setDelTarget(null)}
        actions={[
          { label: "Cancel", variant: "outline", onClick: () => setDelTarget(null) },
          { label: "Delete", variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>{tc({ en: "This record will be permanently removed.", hi: "यह रिकॉर्ड स्थायी रूप से हट जाएगा।", bn: "এই রেকর্ড স্থায়ীভাবে মুছে যাবে।" })}</div>
      </Dialog>
    </>
  );
}
