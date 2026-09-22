import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, EmptyState, Button } from "../../components/index.js";
import { BottomSheet, Dialog } from "../../components/overlays.jsx";
import { Input } from "../../components/inputs.jsx";
import { Pill } from "../../components/erp/RecordList.jsx";
import { useApp } from "../../store/AppStore.jsx";
import RatingStars from "../../components/marketplace/RatingStars.jsx";
import TimeSlotPicker from "../../components/svcMarketplace/TimeSlotPicker.jsx";
import { bookingService } from "../../services/svcMarketplace/bookingService.js";
import { availabilityService } from "../../services/svcMarketplace/availabilityService.js";
import { svcReviewService } from "../../services/svcMarketplace/svcReviewService.js";
import { BOOKING_STATUS } from "../../services/svcMarketplace/constantsSvc.js";
import { rupee } from "../../utils/format.js";

const FILTERS = [
  { id: "all",       label: {en:"All", hi:"सभी", bn:"সব"} },
  { id: "upcoming",  label: {en:"Upcoming", hi:"आगामी", bn:"আসন্ন"} },
  { id: "completed", label: {en:"Completed", hi:"पूर्ण", bn:"সম্পন্ন"} },
  { id: "cancelled", label: {en:"Cancelled", hi:"रद्द", bn:"বাতিল"} },
];

export default function MyBookingsPage() {
  const { pop, push, toast, tc } = useApp();
  const [bookings, setBookings] = useState(null);
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [reschedule, setReschedule] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState(null);
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [rescheduleStart, setRescheduleStart] = useState(null);
  const [rescheduleEnd, setRescheduleEnd] = useState(null);
  const [reviewSheet, setReviewSheet] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  useEffect(() => { bookingService.getAll().then(setBookings); }, [tick]);

  const filtered = (bookings || []).filter((b) => {
    if (filter === "upcoming") return ["pending", "confirmed", "in_progress"].includes(b.status);
    if (filter === "completed") return b.status === "completed";
    if (filter === "cancelled") return ["cancelled", "no_show"].includes(b.status);
    return true;
  });

  const handleCancel = async (b) => {
    await bookingService.cancel(b.id);
    toast(tc({en:"Booking cancelled", hi:"बुकिंग रद्द की गई", bn:"বুকিং বাতিল হয়েছে"}), "info");
    setCancelConfirm(null); setDetail(null); refresh();
  };

  const openReschedule = (b) => {
    setReschedule(b); setRescheduleDate(null); setRescheduleSlots([]);
    setRescheduleStart(null); setRescheduleEnd(null); setDetail(null);
  };

  const pickRescheduleDate = async (d) => {
    setRescheduleDate(d);
    const dateStr = d.toISOString().slice(0, 10);
    const slots = await availabilityService.getAvailableSlots(reschedule.providerId, dateStr);
    setRescheduleSlots(slots);
    setRescheduleStart(null); setRescheduleEnd(null);
  };

  const confirmReschedule = async () => {
    if (!rescheduleDate || !rescheduleStart) { toast(tc({en:"Pick date and time", hi:"दिनांक और समय चुनें", bn:"তারিখ ও সময় নির্বাচন করুন"}), "error"); return; }
    try {
      await bookingService.reschedule(reschedule.id, rescheduleDate.toISOString().slice(0, 10), rescheduleStart, rescheduleEnd);
      toast(tc({en:"Booking rescheduled", hi:"बुकिंग पुनर्निर्धारित की गई", bn:"বুকিং পুনঃনির্ধারণ হয়েছে"}), "success");
      setReschedule(null); refresh();
    } catch (e) { toast(e.message, "error"); }
  };

  const submitReview = async () => {
    if (!reviewRating) { toast(tc({en:"Select a rating", hi:"रेटिंग चुनें", bn:"একটি রেটিং নির্বাচন করুন"}), "error"); return; }
    await svcReviewService.add({
      serviceId: reviewSheet.serviceId, providerId: reviewSheet.providerId,
      rating: reviewRating, text: reviewText,
    });
    toast(tc({en:"Review submitted", hi:"समीक्षा सबमिट की गई", bn:"রিভিউ জমা হয়েছে"}), "success");
    setReviewSheet(null); setReviewRating(0); setReviewText(""); refresh();
  };

  const nextDays = [];
  for (let i = 0; i < 14; i++) { const d = new Date(); d.setDate(d.getDate() + i); nextDays.push(d); }

  return (
    <>
      <AppBar title={tc({en:"My Bookings", hi:"मेरी बुकिंग", bn:"আমার বুকিং"})} onBack={pop} />
      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 14,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {FILTERS.map((f) => (
            <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{tc(f.label)}</Chip>
          ))}
        </div>

        {bookings === null ? null : filtered.length === 0 ? (
          <EmptyState icon="CalendarClock" title={tc({en:"No bookings", hi:"कोई बुकिंग नहीं", bn:"কোনো বুকিং নেই"})}
            body={filter === "all" ? tc({en:"Browse the Service Marketplace to book your first service.", hi:"अपनी पहली सेवा बुक करने के लिए सेवा बाज़ार ब्राउज़ करें।", bn:"আপনার প্রথম পরিষেবা বুক করতে সার্ভিস মার্কেটপ্লেস ব্রাউজ করুন।"}) : `${tc({en:"No", hi:"कोई", bn:"কোনো"})} ${tc(FILTERS.find(x=>x.id===filter)?.label || {en:filter,hi:filter,bn:filter})} ${tc({en:"bookings.", hi:"बुकिंग नहीं।", bn:"বুকিং নেই।"})}`} />
        ) : (
          filtered.map((b) => {
            const st = BOOKING_STATUS[b.status] || { label: b.status, a: "yellow" };
            return (
              <Card key={b.id} pad={14} onClick={() => setDetail(b)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{b.serviceName}</div>
                    <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{b.providerName}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: T.inkSoft }}>
                      <Icon name="Calendar" size={13} /> {b.date}
                      <Icon name="Clock" size={13} style={{ marginLeft: 4 }} /> {b.startTime}–{b.endTime}
                    </div>
                  </div>
                  <Pill label={st.label} a={st.a} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginTop: 8 }}>{rupee(b.price)}</div>
              </Card>
            );
          })
        )}
      </div>

      {/* detail sheet */}
      <BottomSheet open={!!detail} onClose={() => setDetail(null)} title={tc({en:"Booking Details", hi:"बुकिंग विवरण", bn:"বুকিং বিবরণ"})}>
        {detail && (() => {
          const st = BOOKING_STATUS[detail.status] || { label: detail.status, a: "yellow" };
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 4px" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{detail.serviceName}</div>
              <div style={{ fontSize: 13, color: T.inkSoft }}>{detail.providerName}</div>
              <Pill label={st.label} a={st.a} />
              <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: T.inkSoft }}>
                <span><Icon name="Calendar" size={13} /> {detail.date}</span>
                <span><Icon name="Clock" size={13} /> {detail.startTime}–{detail.endTime}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>{rupee(detail.price)}</div>
              {detail.notes && <div style={{ fontSize: 12, color: T.inkSoft }}>{tc({en:"Notes:", hi:"टिप्पणियाँ:", bn:"নোট:"})} {detail.notes}</div>}
              {detail.location && <div style={{ fontSize: 12, color: T.inkSoft }}>{tc({en:"Location:", hi:"स्थान:", bn:"অবস্থান:"})} {detail.location}</div>}

              {/* timeline */}
              {detail.timeline?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{tc({en:"Timeline", hi:"समयरेखा", bn:"টাইমলাইন"})}</div>
                  {detail.timeline.map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, fontSize: 11.5, color: T.inkSoft, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, textTransform: "capitalize" }}>{t.status}</span>
                      <span>{new Date(t.at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                {bookingService.canReschedule(detail) && (
                  <Button variant="soft" full icon="CalendarClock" onClick={() => openReschedule(detail)}>{tc({en:"Reschedule", hi:"पुनर्निर्धारित करें", bn:"পুনঃনির্ধারণ করুন"})}</Button>
                )}
                {bookingService.canCancel(detail) && (
                  <Button variant="soft" full icon="X" style={{ color: T.red }}
                    onClick={() => setCancelConfirm(detail)}>{tc({en:"Cancel", hi:"रद्द करें", bn:"বাতিল করুন"})}</Button>
                )}
                {detail.status === "completed" && (
                  <Button variant="soft" full icon="Star"
                    onClick={() => { setReviewSheet(detail); setDetail(null); }}>{tc({en:"Review", hi:"समीक्षा करें", bn:"রিভিউ করুন"})}</Button>
                )}
              </div>
            </div>
          );
        })()}
      </BottomSheet>

      {/* cancel confirm */}
      <Dialog open={!!cancelConfirm} onClose={() => setCancelConfirm(null)}
        title={tc({en:"Cancel Booking?", hi:"बुकिंग रद्द करें?", bn:"বুকিং বাতিল করবেন?"})} icon="X" danger
        body={`${tc({en:"Cancel", hi:"रद्द करें", bn:"বাতিল করুন"})} ${cancelConfirm?.serviceName} ${tc({en:"on", hi:"तारीख", bn:"তারিখে"})} ${cancelConfirm?.date}?`}
        confirmLabel={tc({en:"Yes, Cancel", hi:"हाँ, रद्द करें", bn:"হ্যাঁ, বাতিল করুন"})} onConfirm={() => handleCancel(cancelConfirm)} />

      {/* reschedule sheet */}
      <BottomSheet open={!!reschedule} onClose={() => setReschedule(null)} title={tc({en:"Reschedule Booking", hi:"बुकिंग पुनर्निर्धारित करें", bn:"বুকিং পুনঃনির্ধারণ করুন"})}>
        {reschedule && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 4px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{reschedule.serviceName}</div>
            <div style={{ fontSize: 12, color: T.inkSoft }}>{tc({en:"Current:", hi:"वर्तमान:", bn:"বর্তমান:"})} {reschedule.date} {tc({en:"at", hi:"समय", bn:"সময়"})} {reschedule.startTime}</div>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{tc({en:"New Date", hi:"नई तारीख", bn:"নতুন তারিখ"})}</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {nextDays.map((d) => {
                const active = rescheduleDate && d.toDateString() === rescheduleDate.toDateString();
                return (
                  <button key={d.toISOString()} onClick={() => pickRescheduleDate(d)}
                    style={{ padding: "8px 12px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                      border: `1.5px solid ${active ? T.primary : T.line}`,
                      background: active ? T.primarySoft : T.surface, color: active ? T.primary : T.ink,
                      cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>
                    {d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}
                  </button>
                );
              })}
            </div>

            {rescheduleDate && (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{tc({en:"New Time", hi:"नया समय", bn:"নতুন সময়"})}</div>
                <TimeSlotPicker slots={rescheduleSlots} selected={rescheduleStart}
                  onSelect={(s, e) => { setRescheduleStart(s); setRescheduleEnd(e); }} />
              </>
            )}

            <Button full icon="CalendarClock" disabled={!rescheduleDate || !rescheduleStart}
              onClick={confirmReschedule}>{tc({en:"Confirm Reschedule", hi:"पुनर्निर्धारण की पुष्टि करें", bn:"পুনঃনির্ধারণ নিশ্চিত করুন"})}</Button>
          </div>
        )}
      </BottomSheet>

      {/* review sheet */}
      <BottomSheet open={!!reviewSheet} onClose={() => setReviewSheet(null)} title={tc({en:"Write a Review", hi:"समीक्षा लिखें", bn:"রিভিউ লিখুন"})}>
        {reviewSheet && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 4px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{reviewSheet.serviceName}</div>
            <RatingStars value={reviewRating} size={24} onChange={setReviewRating} />
            <Input label={tc({en:"Your review (optional)", hi:"आपकी समीक्षा (वैकल्पिक)", bn:"আপনার রিভিউ (ঐচ্ছিক)"})} value={reviewText}
              onChange={(v) => setReviewText(v)} placeholder={tc({en:"How was the service?", hi:"सेवा कैसी थी?", bn:"পরিষেবাটি কেমন ছিল?"})} />
            <Button full icon="Send" onClick={submitReview}>{tc({en:"Submit Review", hi:"समीक्षा सबमिट करें", bn:"রিভিউ জমা দিন"})}</Button>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
