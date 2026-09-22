import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, Button, IconTile, Dropdown } from "../../components/index.js";
import { BottomSheet, Dialog } from "../../components/overlays.jsx";
import { Input } from "../../components/inputs.jsx";
import { useApp } from "../../store/AppStore.jsx";
import StatTile from "../../components/erp/StatTile.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";
import RatingStars from "../../components/marketplace/RatingStars.jsx";
import { providerService } from "../../services/svcMarketplace/providerService.js";
import { svcCatalogService } from "../../services/svcMarketplace/svcCatalogService.js";
import { bookingService } from "../../services/svcMarketplace/bookingService.js";
import { availabilityService } from "../../services/svcMarketplace/availabilityService.js";
import { svcReviewService } from "../../services/svcMarketplace/svcReviewService.js";
import { SERVICE_CATEGORIES, PROVIDER_TYPES, PRICING_TYPES, BOOKING_STATUS, LANGUAGES, categoryMeta } from "../../services/svcMarketplace/constantsSvc.js";
import { rupee } from "../../utils/format.js";

const EMPTY_SVC = { title: "", category: "vet", pricingType: "fixed", price: "", duration: "", description: "" };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_LABELS = {
  Sunday: {en:"Sunday", hi:"रविवार", bn:"রবিবার"},
  Monday: {en:"Monday", hi:"सोमवार", bn:"সোমবার"},
  Tuesday: {en:"Tuesday", hi:"मंगलवार", bn:"মঙ্গলবার"},
  Wednesday: {en:"Wednesday", hi:"बुधवार", bn:"বুধবার"},
  Thursday: {en:"Thursday", hi:"गुरुवार", bn:"বৃহস্পতিবার"},
  Friday: {en:"Friday", hi:"शुक्रवार", bn:"শুক্রবার"},
  Saturday: {en:"Saturday", hi:"शनिवार", bn:"শনিবার"},
};

export default function ProviderDashboard() {
  const { pop, toast, tc } = useApp();
  const [provider, setProvider] = useState(undefined);
  const [tab, setTab] = useState("services");
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, completed: 0, earnings: 0 });
  const [reviews, setReviews] = useState([]);
  const [avail, setAvail] = useState([]);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [regOpen, setRegOpen] = useState(false);
  const [reg, setReg] = useState({ name: "", type: "individual", tagline: "", village: "", district: "", phone: "" });
  const [regLangs, setRegLangs] = useState(["Bengali"]);
  const [regSpecs, setRegSpecs] = useState(["vet"]);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_SVC);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);

  const [availDay, setAvailDay] = useState(null);
  const [availSlots, setAvailSlots] = useState([]);

  useEffect(() => {
    providerService.getMine().then((p) => {
      setProvider(p || null);
      if (!p) return;
      svcCatalogService.byProvider(p.id).then(setServices);
      bookingService.byProvider(p.id).then(setBookings);
      bookingService.providerSummary(p.id).then(setSummary);
      svcReviewService.forProvider(p.id).then(setReviews);
      availabilityService.getForProvider(p.id).then(setAvail);
    });
  }, [tick]);

  const handleRegister = async () => {
    if (!reg.name) { toast(tc({en:"Enter your name", hi:"अपना नाम दर्ज करें", bn:"আপনার নাম লিখুন"}), "error"); return; }
    await providerService.register({ ...reg, specializations: regSpecs, languages: regLangs });
    toast(tc({en:"Provider profile created!", hi:"प्रदाता प्रोफ़ाइल बन गई!", bn:"প্রোভাইডার প্রোফাইল তৈরি হয়েছে!"}), "success");
    refresh();
  };

  const handleSaveSvc = async () => {
    if (!form.title || !form.price) { toast(tc({en:"Fill title and price", hi:"शीर्षक और मूल्य भरें", bn:"শিরোনাম ও মূল্য পূরণ করুন"}), "error"); return; }
    if (editId) {
      await svcCatalogService.update(editId, form);
      toast(tc({en:"Service updated", hi:"सेवा अपडेट की गई", bn:"পরিষেবা আপডেট হয়েছে"}), "success");
    } else {
      await svcCatalogService.add({ ...form, providerId: provider.id, providerName: provider.name, status: "draft" });
      toast(tc({en:"Service added as draft", hi:"सेवा ड्राफ्ट के रूप में जोड़ी गई", bn:"পরিষেবা খসড়া হিসেবে যোগ হয়েছে"}), "success");
    }
    setFormOpen(false); setForm(EMPTY_SVC); setEditId(null); refresh();
  };

  const togglePublish = async (svc) => {
    const next = svc.status === "published" ? "draft" : "published";
    await svcCatalogService.setStatus(svc.id, next);
    toast(next === "published" ? tc({en:"Service live!", hi:"सेवा लाइव है!", bn:"পরিষেবা লাইভ!"}) : tc({en:"Unpublished", hi:"अप्रकाशित", bn:"অপ্রকাশিত"}), "info");
    refresh();
  };

  const handleDelete = async () => {
    await svcCatalogService.remove(delId);
    setDelId(null); toast(tc({en:"Service deleted", hi:"सेवा हटाई गई", bn:"পরিষেবা মুছে ফেলা হয়েছে"}), "info"); refresh();
  };

  const advanceBooking = async (b) => {
    const next = bookingService.nextStatus(b.status);
    if (!next) return;
    await bookingService.setStatus(b.id, next);
    toast(`${tc({en:"Booking →", hi:"बुकिंग →", bn:"বুকিং →"})} ${next}`, "success");
    refresh();
  };

  const openAvailEdit = (dayIdx) => {
    const existing = avail.find((a) => a.dayOfWeek === dayIdx);
    setAvailDay(dayIdx);
    setAvailSlots(existing?.slots?.map((s) => `${s.start}-${s.end}`) || []);
  };

  const addSlot = () => {
    setAvailSlots([...availSlots, "09:00-10:00"]);
  };

  const saveAvail = async () => {
    const slots = availSlots.filter(Boolean).map((s) => {
      const [start, end] = s.split("-");
      return { start: start.trim(), end: end.trim() };
    });
    await availabilityService.setForDay(provider.id, availDay, slots, 15);
    toast(`${tc(DAY_LABELS[DAYS[availDay]])} ${tc({en:"availability saved", hi:"उपलब्धता सहेजी गई", bn:"উপলব্ধতা সংরক্ষিত হয়েছে"})}`, "success");
    setAvailDay(null); refresh();
  };

  /* ---------- loading ---------- */
  if (provider === undefined) return <><AppBar title={tc({en:"Provide Services", hi:"सेवाएँ प्रदान करें", bn:"পরিষেবা প্রদান করুন"})} onBack={pop} /></>;

  /* ---------- onboarding ---------- */
  if (provider === null) {
    return (
      <>
        <AppBar title={tc({en:"Provide Services", hi:"सेवाएँ प्रदान करें", bn:"পরিষেবা প্রদান করুন"})} onBack={pop} />
        <div style={{ padding: "12px 16px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: `linear-gradient(135deg, ${T.blue}, ${T.primary})`,
            borderRadius: 16, padding: 20, color: "#fff", textAlign: "center" }}>
            <Icon name="Handshake" size={40} color="#fff" />
            <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 800, marginTop: 10 }}>{tc({en:"Become a Service Provider", hi:"सेवा प्रदाता बनें", bn:"সার্ভিস প্রোভাইডার হন"})}</div>
            <div style={{ fontSize: 12.5, opacity: .88, marginTop: 6, lineHeight: 1.5 }}>
              {tc({en:"Offer veterinary, agronomist, drone, machinery, and other services to farmers nearby.", hi:"आस-पास के किसानों को पशु चिकित्सा, कृषि विशेषज्ञ, ड्रोन, मशीनरी और अन्य सेवाएँ प्रदान करें।", bn:"কাছাকাছি কৃষকদের পশুচিকিৎসা, কৃষিবিদ, ড্রোন, যন্ত্রপাতি এবং অন্যান্য পরিষেবা প্রদান করুন।"})}
            </div>
          </div>

          {[
            { icon: "Stethoscope", title: tc({en:"List your services", hi:"अपनी सेवाएँ सूचीबद्ध करें", bn:"আপনার পরিষেবা তালিকাভুক্ত করুন"}), desc: tc({en:"Set pricing, availability, and service details", hi:"मूल्य, उपलब्धता और सेवा विवरण सेट करें", bn:"মূল্য, উপলব্ধতা এবং পরিষেবার বিবরণ নির্ধারণ করুন"}) },
            { icon: "CalendarClock", title: tc({en:"Manage bookings", hi:"बुकिंग प्रबंधित करें", bn:"বুকিং পরিচালনা করুন"}), desc: tc({en:"Accept, track, and complete service requests", hi:"सेवा अनुरोध स्वीकार करें, ट्रैक करें और पूरा करें", bn:"পরিষেবা অনুরোধ গ্রহণ, ট্র্যাক এবং সম্পন্ন করুন"}) },
            { icon: "Star", title: tc({en:"Build reputation", hi:"प्रतिष्ठा बनाएँ", bn:"সুনাম তৈরি করুন"}), desc: tc({en:"Earn verified reviews from satisfied farmers", hi:"संतुष्ट किसानों से सत्यापित समीक्षाएँ अर्जित करें", bn:"সন্তুষ্ট কৃষকদের কাছ থেকে যাচাইকৃত রিভিউ অর্জন করুন"}) },
          ].map((f) => (
            <Card key={f.title} pad={14}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <IconTile name={f.icon} a="blue" size={38} iconSize={18} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{f.title}</div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft }}>{f.desc}</div>
                </div>
              </div>
            </Card>
          ))}

          <Button full icon="Handshake" onClick={() => setRegOpen(true)}>{tc({en:"Create Provider Profile", hi:"प्रदाता प्रोफ़ाइल बनाएँ", bn:"প্রোভাইডার প্রোফাইল তৈরি করুন"})}</Button>
        </div>

        <BottomSheet open={regOpen} onClose={() => setRegOpen(false)} title={tc({en:"Provider Registration", hi:"प्रदाता पंजीकरण", bn:"প্রোভাইডার নিবন্ধন"})}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label={tc({en:"Name / Business Name", hi:"नाम / व्यवसाय का नाम", bn:"নাম / ব্যবসার নাম"})} value={reg.name} onChange={(v) => setReg({ ...reg, name: v })} icon="User" />
            <Dropdown label={tc({en:"Provider Type", hi:"प्रदाता प्रकार", bn:"প্রোভাইডারের ধরন"})} value={reg.type} onChange={(v) => setReg({ ...reg, type: v })}
              options={PROVIDER_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
            <Input label={tc({en:"Tagline", hi:"टैगलाइन", bn:"ট্যাগলাইন"})} value={reg.tagline} onChange={(v) => setReg({ ...reg, tagline: v })} icon="FileText" placeholder={tc({en:"Short description…", hi:"संक्षिप्त विवरण…", bn:"সংক্ষিপ্ত বিবরণ…"})} />
            <Input label={tc({en:"Village", hi:"गाँव", bn:"গ্রাম"})} value={reg.village} onChange={(v) => setReg({ ...reg, village: v })} icon="MapPin" />
            <Input label={tc({en:"District", hi:"ज़िला", bn:"জেলা"})} value={reg.district} onChange={(v) => setReg({ ...reg, district: v })} icon="Map" />
            <Input label={tc({en:"Phone", hi:"फ़ोन", bn:"ফোন"})} value={reg.phone} onChange={(v) => setReg({ ...reg, phone: v })} icon="Phone" />

            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{tc({en:"Specializations", hi:"विशेषज्ञता", bn:"বিশেষত্ব"})}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SERVICE_CATEGORIES.map((c) => (
                  <Chip key={c.id} active={regSpecs.includes(c.id)} icon={c.icon}
                    onClick={() => setRegSpecs(regSpecs.includes(c.id) ? regSpecs.filter((s) => s !== c.id) : [...regSpecs, c.id])}>
                    {c.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{tc({en:"Languages", hi:"भाषाएँ", bn:"ভাষা"})}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {LANGUAGES.map((l) => (
                  <Chip key={l} active={regLangs.includes(l)}
                    onClick={() => setRegLangs(regLangs.includes(l) ? regLangs.filter((x) => x !== l) : [...regLangs, l])}>
                    {l}
                  </Chip>
                ))}
              </div>
            </div>

            <Button full icon="Check" onClick={handleRegister}>{tc({en:"Register", hi:"पंजीकरण करें", bn:"নিবন্ধন করুন"})}</Button>
          </div>
        </BottomSheet>
      </>
    );
  }

  /* ---------- dashboard ---------- */
  return (
    <>
      <AppBar title={tc({en:"Provider Dashboard", hi:"प्रदाता डैशबोर्ड", bn:"প্রোভাইডার ড্যাশবোর্ড"})} onBack={pop} />
      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 14,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatTile label={tc({en:"Total Bookings", hi:"कुल बुकिंग", bn:"মোট বুকিং"})} value={summary.total} a="blue" />
          <StatTile label={tc({en:"Active", hi:"सक्रिय", bn:"সক্রিয়"})} value={summary.active} a="orange" />
          <StatTile label={tc({en:"Completed", hi:"पूर्ण", bn:"সম্পন্ন"})} value={summary.completed} a="primary" />
          <StatTile label={tc({en:"Earnings", hi:"कमाई", bn:"আয়"})} value={rupee(summary.earnings)} a="primary" />
        </div>

        {/* tabs */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {["services", "bookings", "availability", "reviews"].map((t) => (
            <Chip key={t} active={tab === t} onClick={() => setTab(t)}>
              {t === "services" ? tc({en:"My Services", hi:"मेरी सेवाएँ", bn:"আমার পরিষেবা"}) : t === "bookings" ? tc({en:"Bookings", hi:"बुकिंग", bn:"বুকিং"}) : t === "availability" ? tc({en:"Availability", hi:"उपलब्धता", bn:"উপলব্ধতা"}) : tc({en:"Reviews", hi:"समीक्षाएँ", bn:"রিভিউ"})}
            </Chip>
          ))}
        </div>

        {/* -------- services tab -------- */}
        {tab === "services" && (
          <>
            <Button variant="soft" full icon="Plus" onClick={() => { setForm(EMPTY_SVC); setEditId(null); setFormOpen(true); }}>
              {tc({en:"Add Service", hi:"सेवा जोड़ें", bn:"পরিষেবা যোগ করুন"})}
            </Button>
            {services.length === 0 ? (
              <EmptyHint icon="Handshake" text={tc({en:"No services yet — add your first listing.", hi:"अभी तक कोई सेवा नहीं — अपनी पहली सूची जोड़ें।", bn:"এখনো কোনো পরিষেবা নেই — আপনার প্রথম তালিকা যোগ করুন।"})} />
            ) : services.map((svc) => {
              const meta = categoryMeta(svc.category);
              const st = svc.status === "published" ? { label: tc({en:"Live", hi:"लाइव", bn:"লাইভ"}), a: "primary" } : { label: tc({en:"Draft", hi:"ड्राफ्ट", bn:"খসড়া"}), a: "yellow" };
              return (
                <RecordRow key={svc.id} icon={meta.icon} accent={meta.accent}
                  title={svc.title} subtitle={`${rupee(svc.price)} · ${PRICING_TYPES.find((p) => p.id === svc.pricingType)?.label || svc.pricingType}`}
                  trailing={<Pill label={st.label} a={st.a} />}
                  onClick={() => { setForm({ title: svc.title, category: svc.category, pricingType: svc.pricingType, price: svc.price, duration: svc.duration || "", description: svc.description || "" }); setEditId(svc.id); setFormOpen(true); }}
                  actions={[
                    { label: svc.status === "published" ? tc({en:"Unpublish", hi:"अप्रकाशित करें", bn:"অপ্রকাশিত করুন"}) : tc({en:"Publish", hi:"प्रकाशित करें", bn:"প্রকাশ করুন"}), onClick: () => togglePublish(svc) },
                    { label: tc({en:"Delete", hi:"हटाएँ", bn:"মুছে ফেলুন"}), danger: true, onClick: () => setDelId(svc.id) },
                  ]} />
              );
            })}
          </>
        )}

        {/* -------- bookings tab -------- */}
        {tab === "bookings" && (
          bookings.length === 0 ? (
            <EmptyHint icon="CalendarClock" text={tc({en:"No incoming bookings yet.", hi:"अभी तक कोई नई बुकिंग नहीं।", bn:"এখনো কোনো নতুন বুকিং নেই।"})} />
          ) : bookings.map((b) => {
            const st = BOOKING_STATUS[b.status] || { label: b.status, a: "yellow" };
            const next = bookingService.nextStatus(b.status);
            return (
              <Card key={b.id} pad={14}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{b.serviceName}</div>
                    <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                      {b.date} · {b.startTime}–{b.endTime}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginTop: 4 }}>{rupee(b.price)}</div>
                  </div>
                  <Pill label={st.label} a={st.a} />
                </div>
                {b.notes && <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 6 }}>{tc({en:"Notes:", hi:"टिप्पणियाँ:", bn:"নোট:"})} {b.notes}</div>}
                {next && (
                  <Button variant="soft" full icon="ChevronRight" style={{ marginTop: 10 }}
                    onClick={() => advanceBooking(b)}>
                    {tc({en:"Mark as", hi:"इस रूप में चिह्नित करें", bn:"চিহ্নিত করুন"})} {next.replace("_", " ")}
                  </Button>
                )}
              </Card>
            );
          })
        )}

        {/* -------- availability tab -------- */}
        {tab === "availability" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {DAYS.map((day, i) => {
              const dayAvail = avail.find((a) => a.dayOfWeek === i);
              const slotCount = dayAvail?.slots?.length || 0;
              return (
                <Card key={i} pad={14} onClick={() => openAvailEdit(i)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{tc(DAY_LABELS[day])}</div>
                      <div style={{ fontSize: 11, color: T.inkSoft }}>
                        {slotCount > 0 ? `${slotCount} ${tc({en:"slots", hi:"स्लॉट", bn:"স্লট"})} · ${dayAvail.slots[0].start}–${dayAvail.slots[slotCount - 1].end}` : tc({en:"No availability set", hi:"कोई उपलब्धता निर्धारित नहीं", bn:"কোনো উপলব্ধতা নির্ধারিত নেই"})}
                      </div>
                    </div>
                    <Icon name="ChevronRight" size={16} color={T.inkFaint} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* -------- reviews tab -------- */}
        {tab === "reviews" && (
          reviews.length === 0 ? (
            <EmptyHint icon="Star" text={tc({en:"No reviews yet.", hi:"अभी तक कोई समीक्षा नहीं।", bn:"এখনো কোনো রিভিউ নেই।"})} />
          ) : reviews.map((r) => (
            <Card key={r.id} pad={12}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <RatingStars value={r.rating} size={12} />
                {r.verified && <span style={{ fontSize: 10, color: T.primary, fontWeight: 700 }}>{tc({en:"Verified", hi:"सत्यापित", bn:"যাচাইকৃত"})}</span>}
              </div>
              <div style={{ fontSize: 12.5, color: T.ink }}>{r.text}</div>
              <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 4 }}>— {r.author}</div>
            </Card>
          ))
        )}
      </div>

      {/* service add/edit sheet */}
      <BottomSheet open={formOpen} onClose={() => setFormOpen(false)} title={editId ? tc({en:"Edit Service", hi:"सेवा संपादित करें", bn:"পরিষেবা সম্পাদনা করুন"}) : tc({en:"Add Service", hi:"सेवा जोड़ें", bn:"পরিষেবা যোগ করুন"})}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({en:"Service Title", hi:"सेवा शीर्षक", bn:"পরিষেবার শিরোনাম"})} value={form.title} onChange={(v) => setForm({ ...form, title: v })} icon="FileText" />
          <Dropdown label={tc({en:"Category", hi:"श्रेणी", bn:"বিভাগ"})} value={form.category} onChange={(v) => setForm({ ...form, category: v })}
            options={SERVICE_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
          <Dropdown label={tc({en:"Pricing Type", hi:"मूल्य निर्धारण प्रकार", bn:"মূল্য নির্ধারণের ধরন"})} value={form.pricingType} onChange={(v) => setForm({ ...form, pricingType: v })}
            options={PRICING_TYPES.map((p) => ({ value: p.id, label: p.label }))} />
          <Input label={tc({en:"Price (₹)", hi:"मूल्य (₹)", bn:"মূল্য (₹)"})} value={form.price} onChange={(v) => setForm({ ...form, price: v })} icon="Banknote" type="number" />
          <Input label={tc({en:"Duration (minutes)", hi:"अवधि (मिनट)", bn:"সময়কাল (মিনিট)"})} value={form.duration} onChange={(v) => setForm({ ...form, duration: v })} icon="Clock" type="number" />
          <Input label={tc({en:"Description", hi:"विवरण", bn:"বিবরণ"})} value={form.description} onChange={(v) => setForm({ ...form, description: v })} icon="FileText" />
          <Button full icon="Check" onClick={handleSaveSvc}>{editId ? tc({en:"Update", hi:"अपडेट करें", bn:"আপডেট করুন"}) : tc({en:"Add Service", hi:"सेवा जोड़ें", bn:"পরিষেবা যোগ করুন"})}</Button>
        </div>
      </BottomSheet>

      {/* delete confirm */}
      <Dialog open={!!delId} onClose={() => setDelId(null)} title={tc({en:"Delete Service?", hi:"सेवा हटाएँ?", bn:"পরিষেবা মুছবেন?"})} icon="Trash2" danger
        body={tc({en:"This service listing will be permanently removed.", hi:"यह सेवा सूची स्थायी रूप से हटा दी जाएगी।", bn:"এই পরিষেবা তালিকাটি স্থায়ীভাবে মুছে ফেলা হবে।"})}
        confirmLabel={tc({en:"Delete", hi:"हटाएँ", bn:"মুছে ফেলুন"})} onConfirm={handleDelete} />

      {/* availability edit sheet */}
      <BottomSheet open={availDay !== null} onClose={() => setAvailDay(null)} title={availDay !== null ? `${tc(DAY_LABELS[DAYS[availDay]])} ${tc({en:"Slots", hi:"स्लॉट", bn:"স্লট"})}` : ""}>
        {availDay !== null && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, color: T.inkSoft }}>
              {tc({en:"Enter time slots as start-end (e.g., 09:00-10:00). One slot per row.", hi:"समय स्लॉट प्रारंभ-अंत के रूप में दर्ज करें (जैसे, 09:00-10:00)। प्रति पंक्ति एक स्लॉट।", bn:"সময় স্লট শুরু-শেষ আকারে লিখুন (যেমন, 09:00-10:00)। প্রতি সারিতে একটি স্লট।"})}
            </div>
            {availSlots.map((slot, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Input value={slot} onChange={(v) => {
                  const updated = [...availSlots];
                  updated[i] = v;
                  setAvailSlots(updated);
                }} placeholder="09:00-10:00" />
                <button onClick={() => setAvailSlots(availSlots.filter((_, j) => j !== i))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.red, padding: 6 }}>
                  <Icon name="X" size={16} />
                </button>
              </div>
            ))}
            <Button variant="soft" full icon="Plus" onClick={addSlot}>{tc({en:"Add Slot", hi:"स्लॉट जोड़ें", bn:"স্লট যোগ করুন"})}</Button>
            <Button full icon="Check" onClick={saveAvail}>{tc({en:"Save", hi:"सहेजें", bn:"সংরক্ষণ করুন"})} {tc(DAY_LABELS[DAYS[availDay]])}</Button>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
