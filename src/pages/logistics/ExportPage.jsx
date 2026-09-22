import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, EmptyState } from "../../components/index.js";
import { BottomSheet } from "../../components/overlays.jsx";
import { Input, Dropdown } from "../../components/inputs.jsx";
import { useApp } from "../../store/AppStore.jsx";
import StatusPill from "../../components/logistics/StatusPill.jsx";
import CapacityBar from "../../components/logistics/CapacityBar.jsx";
import { exportService } from "../../services/logistics/exportService.js";
import { EXPORT_STATUS, COMMODITIES } from "../../services/logistics/constantsLog.js";

const EMPTY = { buyerName: "", destinationCountry: "", commodity: "Mango", quantityKg: "", value: "" };

export default function ExportPage() {
  const { pop, toast, tc } = useApp();
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [detail, setDetail] = useState(null);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  useEffect(() => { exportService.getAll().then(setList); }, [tick]);

  const reload = async (id) => setDetail(await exportService.getById(id));

  const create = async () => {
    if (!form.buyerName || !form.destinationCountry) { toast(tc({en:"Enter buyer and destination", hi:"खरीदार और गंतव्य दर्ज करें", bn:"ক্রেতা ও গন্তব্য লিখুন"}), "error"); return; }
    await exportService.create(form);
    toast(tc({en:"Export order created", hi:"निर्यात ऑर्डर बनाया गया", bn:"রপ্তানি অর্ডার তৈরি হয়েছে"}), "success"); setForm(EMPTY); setOpen(false); refresh();
  };

  const toggleDoc = async (name) => { await exportService.toggleDoc(detail.id, name); await reload(detail.id); refresh(); };
  const advance = async (status) => { await exportService.setStatus(detail.id, status); await reload(detail.id); toast(tc({en:"Status updated", hi:"स्थिति अपडेट की गई", bn:"স্ট্যাটাস আপডেট হয়েছে"}), "success"); refresh(); };

  return (
    <>
      <AppBar title={tc({en:"Export", hi:"निर्यात", bn:"রপ্তানি"})} onBack={pop}
        action={<Button size="sm" icon="Plus" onClick={() => setOpen(true)}>{tc({en:"New", hi:"नया", bn:"নতুন"})}</Button>} />
      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 10,
        animation: "ag-fade .25s var(--ag-ease)" }}>
        {list === null ? null : list.length === 0 ? (
          <EmptyState icon="Container" title={tc({en:"No export orders", hi:"कोई निर्यात ऑर्डर नहीं", bn:"কোনো রপ্তানি অর্ডার নেই"})}
            body={tc({en:"Create an export order, complete the document checklist, and track compliance to shipment. Customs & port integration is planned for a later phase.", hi:"एक निर्यात ऑर्डर बनाएं, दस्तावेज़ चेकलिस्ट पूरी करें, और शिपमेंट तक अनुपालन को ट्रैक करें। सीमा शुल्क और बंदरगाह एकीकरण बाद के चरण में योजनाबद्ध है।", bn:"একটি রপ্তানি অর্ডার তৈরি করুন, নথি চেকলিস্ট সম্পূর্ণ করুন এবং শিপমেন্ট পর্যন্ত কমপ্লায়েন্স ট্র্যাক করুন। কাস্টমস ও বন্দর ইন্টিগ্রেশন পরবর্তী পর্যায়ে পরিকল্পিত।"})}
            action={tc({en:"New export order", hi:"नया निर्यात ऑर्डर", bn:"নতুন রপ্তানি অর্ডার"})} onAction={() => setOpen(true)} />
        ) : list.map((o) => {
          const comp = exportService.compliance(o);
          return (
            <Card key={o.id} pad={14} onClick={() => setDetail(o)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{o.commodity} → {o.destinationCountry}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{o.buyerName} · {(o.quantityKg / 1000).toLocaleString("en-IN")} t</div>
                  <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 2 }}>${o.value.toLocaleString("en-US")} · via {o.portOfLoading}</div>
                </div>
                <StatusPill status={o.status} map={EXPORT_STATUS} />
              </div>
              <div style={{ marginTop: 10 }}>
                <CapacityBar used={comp.done} total={comp.total} showLabel={false} height={6} />
                <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>{tc({en:"Docs", hi:"दस्तावेज़", bn:"নথি"})} {comp.done}/{comp.total} · {comp.percent}% {tc({en:"ready", hi:"तैयार", bn:"প্রস্তুত"})}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* detail */}
      <BottomSheet open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.commodity} → ${detail.destinationCountry}` : ""}>
        {detail && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12.5, color: T.inkSoft }}>{detail.buyerName} · ${detail.value.toLocaleString("en-US")}</span>
              <StatusPill status={detail.status} map={EXPORT_STATUS} />
            </div>
            {detail.containerNo && (
              <div style={{ fontSize: 12.5, color: T.inkSoft }}>{tc({en:"Container", hi:"कंटेनर", bn:"কনটেইনার"})} <b style={{ color: T.ink }}>{detail.containerNo}</b> · {tc({en:"Port", hi:"बंदरगाह", bn:"বন্দর"})} {detail.portOfLoading}</div>
            )}

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 8 }}>{tc({en:"Document checklist", hi:"दस्तावेज़ चेकलिस्ट", bn:"নথি চেকলিস্ট"})}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(detail.docs).map(([name, done]) => (
                  <button key={name} onClick={() => toggleDoc(name)}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                    <Icon name={done ? "CheckCircle2" : "Circle"} size={19} color={done ? T.primary : T.line} />
                    <span style={{ fontSize: 13, color: done ? T.inkSoft : T.ink }}>{name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {detail.status === "documented" && <Button size="sm" variant="outline" icon="ShieldCheck" onClick={() => advance("cleared")}>{tc({en:"Mark cleared", hi:"क्लियर के रूप में चिह्नित करें", bn:"ক্লিয়ার হিসেবে চিহ্নিত করুন"})}</Button>}
              {detail.status === "cleared" && <Button size="sm" variant="outline" icon="Container" onClick={() => advance("shipped")}>{tc({en:"Mark shipped", hi:"भेजा गया चिह्नित करें", bn:"পাঠানো হয়েছে চিহ্নিত করুন"})}</Button>}
              {detail.status === "shipped" && <Button size="sm" variant="outline" icon="CheckCircle2" onClick={() => advance("delivered")}>{tc({en:"Mark delivered", hi:"डिलीवर के रूप में चिह्नित करें", bn:"ডেলিভার হিসেবে চিহ্নিত করুন"})}</Button>}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* create */}
      <BottomSheet open={open} onClose={() => setOpen(false)} title={tc({en:"New Export Order", hi:"नया निर्यात ऑर्डर", bn:"নতুন রপ্তানি অর্ডার"})}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({en:"Buyer", hi:"खरीदार", bn:"ক্রেতা"})} value={form.buyerName} onChange={(v) => setForm({ ...form, buyerName: v })} icon="Building2" />
          <Input label={tc({en:"Destination Country", hi:"गंतव्य देश", bn:"গন্তব্য দেশ"})} value={form.destinationCountry} onChange={(v) => setForm({ ...form, destinationCountry: v })} icon="MapPin" />
          <Dropdown label={tc({en:"Commodity", hi:"वस्तु", bn:"পণ্য"})} value={form.commodity} onChange={(v) => setForm({ ...form, commodity: v })}
            options={COMMODITIES.map((c) => ({ value: c, label: c }))} />
          <Input label={tc({en:"Quantity (kg)", hi:"मात्रा (किग्रा)", bn:"পরিমাণ (কেজি)"})} value={form.quantityKg} onChange={(v) => setForm({ ...form, quantityKg: v })} icon="Scale" type="number" />
          <Input label={tc({en:"Order Value (USD)", hi:"ऑर्डर मूल्य (USD)", bn:"অর্ডার মূল্য (USD)"})} value={form.value} onChange={(v) => setForm({ ...form, value: v })} icon="IndianRupee" type="number" />
          <Button full icon="Check" onClick={create}>{tc({en:"Create order", hi:"ऑर्डर बनाएं", bn:"অর্ডার তৈরি করুন"})}</Button>
        </div>
      </BottomSheet>
    </>
  );
}
