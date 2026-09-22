import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, EmptyState, IconTile, Chip } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import RatingStars from "../../components/marketplace/RatingStars.jsx";
import { providerService } from "../../services/svcMarketplace/providerService.js";
import { svcCatalogService } from "../../services/svcMarketplace/svcCatalogService.js";
import { svcReviewService } from "../../services/svcMarketplace/svcReviewService.js";
import { categoryMeta } from "../../services/svcMarketplace/constantsSvc.js";
import { rupee } from "../../utils/format.js";
import { accent } from "../../components/primitives.jsx";

export default function ProviderProfile({ providerId }) {
  const { pop, push, tc } = useApp();
  const [prov, setProv] = useState(null);
  const [services, setServices] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ avg: 0, count: 0 });
  const [tab, setTab] = useState("services");

  useEffect(() => {
    providerService.getById(providerId).then(setProv);
    svcCatalogService.byProvider(providerId).then((all) =>
      setServices(all.filter((s) => s.status === "published")));
    svcReviewService.forProvider(providerId).then(setReviews);
    svcReviewService.providerStats(providerId).then(setStats);
  }, [providerId]);

  if (!prov) return null;
  const c = accent(prov.accent || "primary");

  return (
    <>
      <AppBar title={tc({en:"Provider",hi:"प्रदाता",bn:"প্রদানকারী"})} onBack={pop} />
      <div style={{ animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* header */}
        <div style={{ background: `linear-gradient(135deg, ${c.fg}22, ${c.fg}08)`,
          padding: "28px 20px 20px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", padding: 14, borderRadius: 18, background: c.bg }}>
            <Icon name={prov.icon || "Handshake"} size={36} color={c.fg} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {prov.name}
            {prov.verificationStatus === "verified" && <Icon name="BadgeCheck" size={16} color={T.blue} />}
          </div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3 }}>{prov.tagline}</div>
          <div style={{ marginTop: 6 }}>
            <RatingStars value={prov.rating || 0} count={prov.reviewCount ?? 0} size={13} />
          </div>
          <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 4 }}>
            {prov.completedBookings || 0} {tc({en:"bookings",hi:"बुकिंग",bn:"বুকিং"})} · {prov.village}, {prov.district}
          </div>
        </div>

        <div style={{ padding: "12px 16px 32px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* info chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {prov.specializations?.map((s) => {
              const m = categoryMeta(s);
              return <Chip key={s} icon={m.icon}>{m.label}</Chip>;
            })}
          </div>

          {prov.languages?.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.inkSoft }}>
              <Icon name="Languages" size={14} /> {prov.languages.join(", ")}
            </div>
          )}

          {prov.workingHours && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.inkSoft }}>
              <Icon name="Clock" size={14} /> {prov.workingHours.start} – {prov.workingHours.end}
            </div>
          )}

          {/* tabs */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <Chip active={tab === "services"} onClick={() => setTab("services")}>{tc({en:"Services",hi:"सेवाएं",bn:"পরিষেবা"})} ({services.length})</Chip>
            <Chip active={tab === "reviews"} onClick={() => setTab("reviews")}>{tc({en:"Reviews",hi:"समीक्षाएं",bn:"পর্যালোচনা"})} ({stats.count})</Chip>
          </div>

          {tab === "services" && (
            services.length === 0 ? (
              <EmptyState icon="Handshake" title={tc({en:"No services listed",hi:"कोई सेवा सूचीबद्ध नहीं है",bn:"কোনো পরিষেবা তালিকাভুক্ত নেই"})} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {services.map((svc) => {
                  const meta = categoryMeta(svc.category);
                  return (
                    <Card key={svc.id} pad={14} onClick={() => push({ kind: "svcDetail", props: { serviceId: svc.id } })}>
                      <div style={{ display: "flex", gap: 12 }}>
                        <IconTile name={meta.icon} a={meta.accent} size={38} iconSize={18} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{svc.title}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginTop: 4 }}>
                            {svc.price > 0 ? rupee(svc.price) : tc({en:"Free",hi:"मुफ्त",bn:"বিনামূল্যে"})}
                            <span style={{ fontSize: 10.5, color: T.inkFaint, fontWeight: 500, marginLeft: 4 }}>
                              {svc.duration > 0 ? `${svc.duration} ${tc({en:"min",hi:"मिनट",bn:"মিনিট"})}` : ""}
                            </span>
                          </div>
                        </div>
                        <Icon name="ChevronRight" size={16} color={T.inkFaint} />
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
          )}

          {tab === "reviews" && (
            reviews.length === 0 ? (
              <EmptyState icon="Star" title={tc({en:"No reviews yet",hi:"अभी तक कोई समीक्षा नहीं",bn:"এখনো কোনো পর্যালোচনা নেই"})} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stats.count > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: T.ink }}>{stats.avg}</span>
                    <RatingStars value={stats.avg} size={15} />
                  </div>
                )}
                {reviews.map((r) => (
                  <Card key={r.id} pad={12}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <RatingStars value={r.rating} size={12} />
                      {r.verified && <span style={{ fontSize: 10, color: T.primary, fontWeight: 700 }}>{tc({en:"Verified",hi:"सत्यापित",bn:"যাচাইকৃত"})}</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: T.ink }}>{r.text}</div>
                    <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 4 }}>— {r.author}</div>
                  </Card>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
