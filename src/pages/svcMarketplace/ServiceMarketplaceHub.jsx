import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, SearchBar, Chip, Card, SectionHeader, EmptyState, Button, IconTile } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import ProviderCard from "../../components/svcMarketplace/ProviderCard.jsx";
import RatingStars from "../../components/marketplace/RatingStars.jsx";
import { svcCatalogService } from "../../services/svcMarketplace/svcCatalogService.js";
import { providerService } from "../../services/svcMarketplace/providerService.js";
import { svcReviewService } from "../../services/svcMarketplace/svcReviewService.js";
import { seedSvc } from "../../services/svcMarketplace/seedSvc.js";
import { SERVICE_CATEGORIES, categoryMeta } from "../../services/svcMarketplace/constantsSvc.js";
import { rupee } from "../../utils/format.js";
import { accent } from "../../components/primitives.jsx";

export default function ServiceMarketplaceHub({ category: initCat = "all" } = {}) {
  const { pop, push, toast, tc } = useApp();
  const QUICK_LINKS = [
    { kind: "svcMyBookings",  label: tc({en:"My Bookings", hi:"मेरी बुकिंग", bn:"আমার বুকিং"}), icon: "CalendarClock", a: "blue"    },
    { kind: "svcProviderDash",label: tc({en:"Provide",     hi:"सेवा प्रदान करें", bn:"পরিষেবা প্রদান করুন"}),     icon: "Handshake",     a: "primary" },
  ];
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(initCat);
  const [services, setServices] = useState(null);
  const [providers, setProviders] = useState([]);
  const [seeding, setSeeding] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  useEffect(() => {
    svcCatalogService.search({ q, category: cat }).then(setServices);
  }, [q, cat, tick]);

  useEffect(() => {
    providerService.getAll().then(setProviders);
  }, [tick]);

  const loadDemo = async () => {
    setSeeding(true);
    const r = await seedSvc.load();
    setSeeding(false);
    toast(`${r.services} ${tc({en:"services from", hi:"सेवाएं", bn:"পরিষেবা"})} ${r.providers} ${tc({en:"providers loaded", hi:"प्रदाताओं से लोड की गईं", bn:"প্রদানকারীর কাছ থেকে লোড হয়েছে"})}`, "success");
    refresh();
  };

  const featured = (services || []).filter((s) => s.featured);
  const empty = services && services.length === 0 && q === "" && cat === "all";

  return (
    <>
      <AppBar title={cat === "all"
        ? tc({en:"Service Marketplace", hi:"सेवा बाज़ार", bn:"পরিষেবা বাজার"})
        : (categoryMeta(cat)?.label || tc({en:"Service Marketplace", hi:"सेवा बाज़ार", bn:"পরিষেবা বাজার"}))} onBack={pop} />

      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 16,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* quick links */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {QUICK_LINKS.map((l) => (
            <Card key={l.kind} onClick={() => push({ kind: l.kind })} pad={11}
              style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconTile name={l.icon} a={l.a} size={32} iconSize={16} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{l.label}</span>
            </Card>
          ))}
        </div>

        <SearchBar value={q} onChange={setQ} placeholder={tc({en:"Search vet, drone, machinery…", hi:"पशु चिकित्सक, ड्रोन, मशीनरी खोजें…", bn:"পশু চিকিৎসক, ড্রোন, যন্ত্রপাতি খুঁজুন…"})} />

        <div style={{ display: "flex", gap: 8, overflowX: "auto", margin: "-4px 0", paddingBottom: 4 }}>
          <Chip active={cat === "all"} onClick={() => setCat("all")}>{tc({en:"All", hi:"सभी", bn:"সকল"})}</Chip>
          {SERVICE_CATEGORIES.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} icon={c.icon}>{c.label}</Chip>
          ))}
        </div>

        {services === null ? null : empty ? (
          <EmptyState icon="Handshake" title={tc({en:"No services yet", hi:"अभी कोई सेवा नहीं", bn:"এখনও কোনো পরিষেবা নেই"})}
            body={tc({en:"Load demo data to explore veterinary, drone, machinery, and other agricultural services. Become a provider to offer your own services.", hi:"पशु चिकित्सा, ड्रोन, मशीनरी और अन्य कृषि सेवाओं को देखने के लिए डेमो डेटा लोड करें। अपनी सेवाएं देने के लिए प्रदाता बनें।", bn:"পশুচিকিৎসা, ড্রোন, যন্ত্রপাতি এবং অন্যান্য কৃষি পরিষেবা দেখতে ডেমো ডেটা লোড করুন। আপনার নিজস্ব পরিষেবা দিতে একজন প্রদানকারী হন।"})}
            action={seeding ? tc({en:"Loading…", hi:"लोड हो रहा है…", bn:"লোড হচ্ছে…"}) : tc({en:"Load demo data", hi:"डेमो डेटा लोड करें", bn:"ডেমো ডেটা লোড করুন"})} onAction={seeding ? undefined : loadDemo} />
        ) : (
          <>
            {/* providers strip */}
            {providers.length > 0 && cat === "all" && !q && (
              <div>
                <SectionHeader title={tc({en:"Service Providers", hi:"सेवा प्रदाता", bn:"পরিষেবা প্রদানকারী"})} />
                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                  {providers.map((p) => (
                    <div key={p.id} style={{ minWidth: 155, flexShrink: 0 }}>
                      <ProviderCard provider={p} onClick={() => push({ kind: "svcProvider", props: { providerId: p.id } })} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* featured strip */}
            {featured.length > 0 && !q && (
              <div>
                <SectionHeader title={tc({en:"Featured Services", hi:"चुनिंदा सेवाएं", bn:"বৈশিষ্ট্যযুক্ত পরিষেবা"})} />
                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                  {featured.slice(0, 6).map((svc) => {
                    const meta = categoryMeta(svc.category);
                    const c = accent(meta.accent);
                    return (
                      <Card key={svc.id} pad={12} onClick={() => push({ kind: "svcDetail", props: { serviceId: svc.id } })}
                        style={{ minWidth: 200, flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <IconTile name={meta.icon} a={meta.accent} size={30} iconSize={15} />
                          <span style={{ fontSize: 10.5, color: c.fg, fontWeight: 700, background: c.bg,
                            padding: "2px 7px", borderRadius: 6 }}>{meta.label}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>{svc.title}</div>
                        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{svc.providerName}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginTop: 6 }}>
                          {svc.price > 0 ? rupee(svc.price) : tc({en:"Free", hi:"मुफ़्त", bn:"বিনামূল্যে"})}{svc.pricingType !== "fixed" ? `/${svc.pricingType.replace("per", "").toLowerCase()}` : ""}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* all services */}
            <div>
              <SectionHeader title={cat === "all" ? tc({en:"All Services", hi:"सभी सेवाएं", bn:"সকল পরিষেবা"}) : (SERVICE_CATEGORIES.find((c) => c.id === cat)?.label || tc({en:"Services", hi:"सेवाएं", bn:"পরিষেবা"}))} />
              {services.length === 0 ? (
                <EmptyState icon="SearchX" title={tc({en:"Nothing found", hi:"कुछ नहीं मिला", bn:"কিছু পাওয়া যায়নি"})}
                  body={q ? `${tc({en:"No services match", hi:"कोई सेवा मेल नहीं खाती", bn:"কোনো পরিষেবা মেলেনি"})} "${q}".` : tc({en:"No services in this category yet.", hi:"इस श्रेणी में अभी कोई सेवा नहीं है।", bn:"এই বিভাগে এখনও কোনো পরিষেবা নেই।"})} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {services.map((svc) => {
                    const meta = categoryMeta(svc.category);
                    return (
                      <Card key={svc.id} pad={14} onClick={() => push({ kind: "svcDetail", props: { serviceId: svc.id } })}>
                        <div style={{ display: "flex", gap: 12 }}>
                          <IconTile name={meta.icon} a={meta.accent} size={42} iconSize={20} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{svc.title}</div>
                            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 1 }}>{svc.providerName}</div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 5 }}>
                              <span style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>
                                {svc.price > 0 ? rupee(svc.price) : tc({en:"Free", hi:"मुफ़्त", bn:"বিনামূল্যে"})}
                              </span>
                              <span style={{ fontSize: 10.5, color: T.inkFaint }}>
                                {svc.pricingType !== "fixed" ? `/${svc.pricingType.replace("per", "").toLowerCase()}` : ""}
                                {svc.duration > 0 ? ` · ${svc.duration} min` : ""}
                              </span>
                            </div>
                          </div>
                          <Icon name="ChevronRight" size={16} color={T.inkFaint} />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            <Button variant="soft" full icon="Trash2" onClick={async () => { await seedSvc.clear(); refresh(); toast(tc({en:"Demo data cleared", hi:"डेमो डेटा साफ़ किया गया", bn:"ডেমো ডেটা মুছে ফেলা হয়েছে"}), "info"); }}
              style={{ display: (services || []).some((s) => s.demo) ? "inline-flex" : "none" }}>
              {tc({en:"Clear demo data", hi:"डेमो डेटा साफ़ करें", bn:"ডেমো ডেটা সাফ করুন"})}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
