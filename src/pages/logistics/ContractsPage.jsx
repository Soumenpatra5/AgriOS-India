import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, EmptyState } from "../../components/index.js";
import { BottomSheet } from "../../components/overlays.jsx";
import { Input, Dropdown } from "../../components/inputs.jsx";
import { useApp } from "../../store/AppStore.jsx";
import StatusPill from "../../components/logistics/StatusPill.jsx";
import CapacityBar from "../../components/logistics/CapacityBar.jsx";
import { contractService, CONTRACT_TEMPLATES } from "../../services/logistics/contractService.js";
import { CONTRACT_STATUS, COMMODITIES, QUALITY_GRADES } from "../../services/logistics/constantsLog.js";
import { rupee } from "../../utils/format.js";

const EMPTY = { title: "", buyerName: "", farmerName: "", commodity: "Paddy", quantityKg: "", pricePerKg: "", qualityGrade: "A / FAQ", deliveryDate: "", templateId: "seasonal" };

export default function ContractsPage() {
  const { pop, toast, tc } = useApp();
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [detail, setDetail] = useState(null);
  const [dispute, setDispute] = useState("");
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  useEffect(() => { contractService.getAll().then(setList); }, [tick]);

  const reloadDetail = async (id) => setDetail(await contractService.getById(id));

  const create = async () => {
    if (!form.title || !form.quantityKg || !form.pricePerKg) { toast(tc({en:"Fill title, quantity and price",hi:"शीर्षक, मात्रा और मूल्य भरें",bn:"শিরোনাম, পরিমাণ ও মূল্য পূরণ করুন"}), "error"); return; }
    await contractService.create(form);
    toast(tc({en:"Contract offered",hi:"अनुबंध की पेशकश की गई",bn:"চুক্তি প্রস্তাব করা হয়েছে"}), "success"); setForm(EMPTY); setOpen(false); refresh();
  };

  const toggle = async (i) => { await contractService.toggleMilestone(detail.id, i); await reloadDetail(detail.id); refresh(); };
  const accept = async () => { await contractService.accept(detail.id); await reloadDetail(detail.id); toast(tc({en:"Contract activated",hi:"अनुबंध सक्रिय किया गया",bn:"চুক্তি সক্রিয় হয়েছে"}), "success"); refresh(); };
  const inspect = async (status) => {
    await contractService.recordInspection(detail.id, status, ""); await reloadDetail(detail.id);
    const statusLabel = status === "passed" ? tc({en:"passed",hi:"पास",bn:"পাস"}) : tc({en:"failed",hi:"फेल",bn:"ব্যর্থ"});
    toast(tc({en:`Inspection ${status}`,hi:`निरीक्षण ${statusLabel}`,bn:`পরিদর্শন ${statusLabel}`}), "info"); refresh();
  };
  const raiseDispute = async () => {
    if (!dispute.trim()) return;
    await contractService.raiseDispute(detail.id, dispute.trim());
    await reloadDetail(detail.id); setDispute(""); toast(tc({en:"Dispute raised",hi:"विवाद दर्ज किया गया",bn:"বিরোধ উত্থাপিত হয়েছে"}), "info"); refresh();
  };

  return (
    <>
      <AppBar title={tc({en:"Contract Farming",hi:"अनुबंध खेती",bn:"চুক্তি চাষ"})} onBack={pop}
        action={<Button size="sm" icon="Plus" onClick={() => setOpen(true)}>{tc({en:"New",hi:"नई",bn:"নতুন"})}</Button>} />
      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 12,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {list === null ? null : list.length === 0 ? (
          <EmptyState icon="FileSignature" title={tc({en:"No contracts",hi:"कोई अनुबंध नहीं",bn:"কোনো চুক্তি নেই"})}
            body={tc({en:"Create a digital agreement between a buyer and a farmer with milestones, quality standards and payment terms.",hi:"मील के पत्थर, गुणवत्ता मानकों और भुगतान शर्तों के साथ खरीदार और किसान के बीच एक डिजिटल समझौता बनाएँ।",bn:"মাইলফলক, গুণমান মান ও পেমেন্ট শর্তাবলী সহ ক্রেতা ও কৃষকের মধ্যে একটি ডিজিটাল চুক্তি তৈরি করুন।"})}
            action={tc({en:"New contract",hi:"नया अनुबंध",bn:"নতুন চুক্তি"})} onAction={() => setOpen(true)} />
        ) : list.map((c) => (
          <Card key={c.id} pad={14} onClick={() => setDetail(c)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{c.title}</div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{c.buyerName} ↔ {c.farmerName}</div>
                <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 2 }}>
                  {c.commodity} · {(c.quantityKg / 1000).toLocaleString("en-IN")} t · {rupee(c.value)}
                </div>
              </div>
              <StatusPill status={c.status} map={CONTRACT_STATUS} />
            </div>
            <div style={{ marginTop: 10 }}>
              <CapacityBar used={contractService.progress(c)} total={100} showLabel={false} height={6} />
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>{contractService.progress(c)}% {tc({en:"complete",hi:"पूर्ण",bn:"সম্পন্ন"})}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* detail */}
      <BottomSheet open={!!detail} onClose={() => setDetail(null)} title={detail?.title}>
        {detail && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12.5, color: T.inkSoft }}>{detail.buyerName} ↔ {detail.farmerName}</div>
              <StatusPill status={detail.status} map={CONTRACT_STATUS} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: T.inkSoft }}>
              <span>{detail.commodity}</span><span>·</span>
              <span>{(detail.quantityKg / 1000).toLocaleString("en-IN")} t</span><span>·</span>
              <span>{rupee(detail.pricePerKg)}/kg</span><span>·</span>
              <span>{detail.qualityGrade}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>{tc({en:"Contract value",hi:"अनुबंध मूल्य",bn:"চুক্তির মূল্য"})} {rupee(detail.value)}</div>

            {detail.inspection && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: detail.inspection.status === "passed" ? T.primarySoft : T.redSoft,
                borderRadius: T.rMd, padding: "8px 12px" }}>
                <Icon name={detail.inspection.status === "passed" ? "CheckCircle2" : "XCircle"} size={16}
                  color={detail.inspection.status === "passed" ? T.primary : T.red} />
                <span style={{ fontSize: 12.5, color: T.ink }}>{tc({en:"Inspection",hi:"निरीक्षण",bn:"পরিদর্শন"})} {detail.inspection.status === "passed" ? tc({en:"passed",hi:"पास",bn:"পাস"}) : tc({en:"failed",hi:"फेल",bn:"ব্যর্থ"})}</span>
              </div>
            )}

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 8 }}>{tc({en:"Milestones",hi:"मील के पत्थर",bn:"মাইলফলক"})}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {detail.milestones.map((m, i) => (
                  <button key={i} onClick={() => toggle(i)} disabled={detail.status !== "active"}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none",
                      cursor: detail.status === "active" ? "pointer" : "default", padding: 0, textAlign: "left" }}>
                    <Icon name={m.done ? "CheckCircle2" : "Circle"} size={20} color={m.done ? T.primary : T.line} />
                    <span style={{ fontSize: 13, color: m.done ? T.inkSoft : T.ink, textDecoration: m.done ? "line-through" : "none" }}>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {detail.disputeNote && (
              <div style={{ background: T.redSoft, borderRadius: T.rMd, padding: "8px 12px", fontSize: 12, color: T.red }}>
                {tc({en:"Dispute:",hi:"विवाद:",bn:"বিরোধ:"})} {detail.disputeNote}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {detail.status === "offered" && <Button full icon="Check" onClick={accept}>{tc({en:"Accept & activate",hi:"स्वीकार करें और सक्रिय करें",bn:"গ্রহণ ও সক্রিয় করুন"})}</Button>}
              {detail.status === "active" && !detail.inspection && (
                <div style={{ display: "flex", gap: 8 }}>
                  <Button size="sm" variant="outline" icon="CheckCircle2" onClick={() => inspect("passed")}>{tc({en:"Inspection pass",hi:"निरीक्षण पास",bn:"পরিদর্শন পাস"})}</Button>
                  <Button size="sm" variant="outline" icon="XCircle" onClick={() => inspect("failed")}>{tc({en:"Fail",hi:"फेल",bn:"ব্যর্থ"})}</Button>
                </div>
              )}
              {["offered", "active"].includes(detail.status) && (
                <div style={{ display: "flex", gap: 8 }}>
                  <Input value={dispute} onChange={(v) => setDispute(v)} placeholder={tc({en:"Raise a dispute…",hi:"विवाद दर्ज करें…",bn:"বিরোধ উত্থাপন করুন…"})} icon="AlertTriangle" />
                  <Button variant="danger" icon="Send" onClick={raiseDispute}>{tc({en:"Dispute",hi:"विवाद",bn:"বিরোধ"})}</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* create */}
      <BottomSheet open={open} onClose={() => setOpen(false)} title={tc({en:"New Contract",hi:"नया अनुबंध",bn:"নতুন চুক্তি"})}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({en:"Title",hi:"शीर्षक",bn:"শিরোনাম"})} value={form.title} onChange={(v) => setForm({ ...form, title: v })} icon="FileSignature" />
          <Input label={tc({en:"Buyer",hi:"खरीदार",bn:"ক্রেতা"})} value={form.buyerName} onChange={(v) => setForm({ ...form, buyerName: v })} icon="Building2" />
          <Input label={tc({en:"Farmer / FPO",hi:"किसान / एफपीओ",bn:"কৃষক / এফপিও"})} value={form.farmerName} onChange={(v) => setForm({ ...form, farmerName: v })} icon="Sprout" />
          <Dropdown label={tc({en:"Commodity",hi:"जिंस",bn:"পণ্য"})} value={form.commodity} onChange={(v) => setForm({ ...form, commodity: v })}
            options={COMMODITIES.map((c) => ({ value: c, label: c }))} />
          <Input label={tc({en:"Quantity (kg)",hi:"मात्रा (किग्रा)",bn:"পরিমাণ (কেজি)"})} value={form.quantityKg} onChange={(v) => setForm({ ...form, quantityKg: v })} icon="Scale" type="number" />
          <Input label={tc({en:"Price (₹/kg)",hi:"मूल्य (₹/किग्रा)",bn:"মূল্য (₹/কেজি)"})} value={form.pricePerKg} onChange={(v) => setForm({ ...form, pricePerKg: v })} icon="IndianRupee" type="number" />
          <Dropdown label={tc({en:"Quality Grade",hi:"गुणवत्ता ग्रेड",bn:"গুণমান গ্রেড"})} value={form.qualityGrade} onChange={(v) => setForm({ ...form, qualityGrade: v })}
            options={QUALITY_GRADES.map((g) => ({ value: g, label: g }))} />
          <Dropdown label={tc({en:"Template",hi:"टेम्पलेट",bn:"টেমপ্লেট"})} value={form.templateId} onChange={(v) => setForm({ ...form, templateId: v })}
            options={CONTRACT_TEMPLATES.map((t) => ({ value: t.id, label: t.label }))} />
          <Input label={tc({en:"Delivery Date",hi:"डिलीवरी तिथि",bn:"ডেলিভারির তারিখ"})} value={form.deliveryDate} onChange={(v) => setForm({ ...form, deliveryDate: v })} icon="Calendar" type="date" />
          <Button full icon="Check" onClick={create}>{tc({en:"Create contract",hi:"अनुबंध बनाएँ",bn:"চুক্তি তৈরি করুন"})}</Button>
        </div>
      </BottomSheet>
    </>
  );
}
