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

const TABS = ["Customers", "Suppliers", "Orders"];
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function CRMManager() {
  const { pop, toast, can } = useApp();
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
    refresh(); toast("Contact added", "success");
  };

  const addOrder = async () => {
    if (!orderForm.item || !orderForm.qty || !orderForm.rate) return;
    await orderService.add(orderForm);
    setOrderOpen(false); setOrderForm({ kind: "sale", contactId: "", item: "", qty: "", unit: "kg", rate: "", date: todayStr() });
    refresh(); toast("Order created", "success");
  };

  const recordPay = async () => {
    if (!payAmount) return;
    await orderService.recordPayment(payTarget.id, payAmount);
    setPayTarget(null); setPayAmount("");
    refresh(); toast("Payment recorded", "success");
  };

  const handleDelete = async () => {
    if (delTarget.kind === "contact") await contactService.remove(delTarget.id);
    else await orderService.remove(delTarget.id);
    setDelTarget(null); refresh(); toast("Deleted", "info");
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
        badge={<Pill fg={T.blue} bg={T.blueSoft}>{contactService.typeLabel(c.type)}</Pill>}
        subtitle={`${c.phone || "No phone"}${c.village ? ` · ${c.village}` : ""}${c.gst ? ` · GST ${c.gst}` : ""}`}
        onDelete={can("records.delete") ? () => setDelTarget({ id: c.id, kind: "contact" }) : undefined} />
    ));

  return (
    <>
      <AppBar title="CRM & Orders" onBack={pop} action={
        <button onClick={() => tab === "Orders" ? setOrderOpen(true) : setContactOpen(true)}
          style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> Add
        </button>
      } />

      {summary && (
        <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
          <StatTile a="primary" label="Sales" value={compact(summary.salesTotal)} />
          <StatTile a={summary.salesDue > 0 ? "orange" : "blue"} label="To Collect" value={compact(summary.salesDue)} />
          <StatTile a="red" label="To Pay" value={compact(summary.purchaseDue)} />
          <StatTile a="blue" label="Open Orders" value={summary.openOrders} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px" }}>
        {TABS.map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {tab === "Customers" && contactRows(customers, "Add buyers, wholesalers and retailers you sell to")}
        {tab === "Suppliers" && contactRows(suppliers, "Add suppliers and vendors you purchase from")}

        {tab === "Orders" && (orders.length === 0
          ? <EmptyHint icon="Receipt" text="Create sales and purchase orders with payment tracking" />
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

      <BottomSheet open={contactOpen} onClose={() => setContactOpen(false)} title="Add Contact">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Name" placeholder="e.g. Barasat Traders" value={contactForm.name} onChange={(v) => setContactForm((f) => ({ ...f, name: v }))} />
          <Dropdown label="Type" value={contactForm.type} onChange={(v) => setContactForm((f) => ({ ...f, type: v }))}
            options={CONTACT_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
          <Input label="Phone" placeholder="Optional" value={contactForm.phone} onChange={(v) => setContactForm((f) => ({ ...f, phone: v }))} />
          <Input label="Village / Town" placeholder="Optional" value={contactForm.village} onChange={(v) => setContactForm((f) => ({ ...f, village: v }))} />
          <Input label="GST number" placeholder="Optional" value={contactForm.gst} onChange={(v) => setContactForm((f) => ({ ...f, gst: v }))} />
          <Button full onClick={addContact} disabled={!contactForm.name}>Add Contact</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={orderOpen} onClose={() => setOrderOpen(false)} title="New Order">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label="Order type" value={orderForm.kind} onChange={(v) => setOrderForm((f) => ({ ...f, kind: v }))}
            options={[{ value: "sale", label: "Sale (you sell)" }, { value: "purchase", label: "Purchase (you buy)" }]} />
          <Dropdown label="Contact" value={orderForm.contactId} onChange={(v) => setOrderForm((f) => ({ ...f, contactId: v }))}
            options={[{ value: "", label: "Select contact…" },
              ...(orderForm.kind === "sale" ? customers : suppliers).map((c) => ({ value: c.id, label: c.name }))]} />
          <Input label="Item" placeholder="e.g. Paddy / Eggs / Feed" value={orderForm.item} onChange={(v) => setOrderForm((f) => ({ ...f, item: v }))} />
          <Input label="Quantity" type="number" placeholder="0" value={orderForm.qty} onChange={(v) => setOrderForm((f) => ({ ...f, qty: v }))} />
          <Input label="Unit" placeholder="kg / qtl / pcs / L" value={orderForm.unit} onChange={(v) => setOrderForm((f) => ({ ...f, unit: v }))} />
          <Input label="Rate (₹ per unit)" type="number" placeholder="0" value={orderForm.rate} onChange={(v) => setOrderForm((f) => ({ ...f, rate: v }))} />
          <Input label="Date" type="date" value={orderForm.date} onChange={(v) => setOrderForm((f) => ({ ...f, date: v }))} />
          {orderForm.qty && orderForm.rate && (
            <div style={{ fontSize: 13, color: T.primary, fontWeight: 700 }}>
              Total: {rupee((Number(orderForm.qty) || 0) * (Number(orderForm.rate) || 0))}
            </div>
          )}
          <Button full onClick={addOrder} disabled={!orderForm.item || !orderForm.qty || !orderForm.rate}>Create Order</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!payTarget} onClose={() => setPayTarget(null)} title="Record Payment">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: T.inkSoft }}>
            {payTarget?.item} — total {rupee(payTarget?.amount || 0)}, paid {rupee(payTarget?.paidAmount || 0)}
          </div>
          <Input label="Amount received / paid (₹)" type="number" value={payAmount} onChange={setPayAmount} />
          <Button full onClick={recordPay} disabled={!payAmount}>Record Payment</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delTarget} title="Delete?" onClose={() => setDelTarget(null)}
        actions={[
          { label: "Cancel", variant: "outline", onClick: () => setDelTarget(null) },
          { label: "Delete", variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>This record will be permanently removed.</div>
      </Dialog>
    </>
  );
}
