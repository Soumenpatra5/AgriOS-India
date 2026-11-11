import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, SearchBar, Chip, Card, SectionHeader, EmptyState, Button, IconTile } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import ProductCard from "../../components/marketplace/ProductCard.jsx";
import RatingStars from "../../components/marketplace/RatingStars.jsx";
import { productService } from "../../services/marketplace/productService.js";
import { sellerService } from "../../services/marketplace/sellerService.js";
import { cartService } from "../../services/marketplace/cartService.js";
import { wishlistService } from "../../services/marketplace/wishlistService.js";
import { reviewService } from "../../services/marketplace/reviewService.js";
import { seedMp } from "../../services/marketplace/seedMp.js";
import { PRODUCT_CATEGORIES } from "../../services/marketplace/constantsMp.js";
import { useResponsive } from "../../hooks/useResponsive.js";

const QUICK_LINKS = [
  { kind: "mpOrders",   label: {en:"My Orders",hi:"मेरे ऑर्डर",bn:"আমার অর্ডার"}, icon: "ClipboardList", a: "blue"    },
  { kind: "mpWishlist", label: {en:"Wishlist",hi:"इच्छा सूची",bn:"ইচ্ছা তালিকা"},  icon: "Heart",         a: "red"     },
  { kind: "mpSeller",   label: {en:"Sell",hi:"बेचें",bn:"বিক্রি"},      icon: "Store",         a: "primary" },
];

export default function MarketplaceHub({ category = "all" } = {}) {
  const { pop, push, toast, tc } = useApp();
  const { isDesktop } = useResponsive(768);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(category);
  const [list, setList] = useState(null);           // null = loading
  const [sellers, setSellers] = useState([]);
  const [sellerRatings, setSellerRatings] = useState({});
  const [cartCount, setCartCount] = useState(0);
  const [wishedIds, setWishedIds] = useState(new Set());
  const [seeding, setSeeding] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  useEffect(() => {
    productService.search({ q, category: cat }).then(setList);
  }, [q, cat, tick]);

  useEffect(() => {
    sellerService.getAll().then(async (all) => {
      setSellers(all);
      const entries = await Promise.all(all.map(async (s) => [s.id, await reviewService.sellerStats(s.id)]));
      setSellerRatings(Object.fromEntries(entries));
    });
    cartService.count().then(setCartCount);
    wishlistService.products().then((w) => setWishedIds(new Set(w.map((x) => x.refId))));
  }, [tick]);

  const toggleWish = async (p) => {
    const on = await wishlistService.toggle("product", p.id);
    toast(on ? tc({en:"Added to wishlist",hi:"इच्छा सूची में जोड़ा गया",bn:"ইচ্ছা তালিকায় যোগ করা হয়েছে"}) : tc({en:"Removed from wishlist",hi:"इच्छा सूची से हटाया गया",bn:"ইচ্ছা তালিকা থেকে সরানো হয়েছে"}), "info");
    refresh();
  };

  const loadDemo = async () => {
    setSeeding(true);
    const r = await seedMp.load();
    setSeeding(false);
    toast(tc({en:`${r.products} products from ${r.sellers} sellers loaded`,hi:`${r.sellers} विक्रेताओं के ${r.products} उत्पाद लोड हुए`,bn:`${r.sellers} বিক্রেতার ${r.products}টি পণ্য লোড হয়েছে`}), "success");
    refresh();
  };

  const featured = (list || []).filter((p) => p.featured);
  const empty = list && list.length === 0 && q === "" && cat === "all";

  return (
    <>
      <AppBar title={tc({en:"Marketplace",hi:"बाज़ार",bn:"বাজার"})} onBack={pop} action={
        <button onClick={() => push({ kind: "mpCart" })} aria-label={tc({en:"Cart",hi:"कार्ट",bn:"কার্ট"})}
          style={{ position: "relative", background: T.surface, border: `1px solid ${T.line}`,
            borderRadius: 12, padding: 8, cursor: "pointer", color: T.ink, display: "flex" }}>
          <Icon name="ShoppingCart" size={19} />
          {cartCount > 0 && (
            <span style={{ position: "absolute", top: -5, right: -5, minWidth: 17, height: 17,
              borderRadius: 9, background: T.red, color: "#fff", fontSize: 10, fontWeight: 800,
              display: "grid", placeItems: "center", padding: "0 4px" }}>{cartCount}</span>
          )}
        </button>
      } />

      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 16,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* quick links */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {QUICK_LINKS.map((l) => (
            <Card key={l.kind} onClick={() => push({ kind: l.kind })} pad={11}
              style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconTile name={l.icon} a={l.a} size={32} iconSize={16} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{tc(l.label)}</span>
            </Card>
          ))}
        </div>

        <SearchBar value={q} onChange={setQ} placeholder={tc({en:"Search seeds, feed, equipment…",hi:"बीज, चारा, उपकरण खोजें…",bn:"বীজ, খাদ্য, সরঞ্জাম খুঁজুন…"})} />

        <div style={{ display: "flex", gap: 8, overflowX: "auto", margin: "-4px 0", paddingBottom: 4 }}>
          <Chip active={cat === "all"} onClick={() => setCat("all")}>{tc({en:"All",hi:"सभी",bn:"সব"})}</Chip>
          {PRODUCT_CATEGORIES.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} icon={c.icon}>{c.label}</Chip>
          ))}
        </div>

        {list === null ? null : empty ? (
          <EmptyState icon="ShoppingBag" title={tc({en:"The marketplace is empty",hi:"बाज़ार खाली है",bn:"বাজার খালি"})}
            body={tc({en:"Load demo sellers and products to explore, or open Sell to list your own produce. Real multi-device buying and selling arrives with the shared backend phase.",hi:"एक्सप्लोर करने के लिए डेमो विक्रेता और उत्पाद लोड करें, या अपनी उपज बेचने के लिए बेचें खोलें।",bn:"অন্বেষণ করতে ডেমো বিক্রেতা ও পণ্য লোড করুন, অথবা আপনার ফসল তালিকাভুক্ত করতে বিক্রি খুলুন।"})}
            action={seeding ? tc({en:"Loading…",hi:"लोड हो रहा है…",bn:"লোড হচ্ছে…"}) : tc({en:"Load demo data",hi:"डेमो डेटा लोड करें",bn:"ডেমো ডেটা লোড করুন"})} onAction={seeding ? undefined : loadDemo} />
        ) : (
          <>
            {/* stores strip */}
            {sellers.length > 0 && cat === "all" && !q && (
              <div>
                <SectionHeader title={tc({en:"Stores",hi:"स्टोर",bn:"স্টোর"})} />
                <div style={{ display: isDesktop ? "grid" : "flex", gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(180px, 1fr))" : undefined, gap: 10, overflowX: isDesktop ? "visible" : "auto", paddingBottom: 4 }}>
                  {sellers.map((s) => (
                    <Card key={s.id} onClick={() => push({ kind: "mpStore", props: { sellerId: s.id } })}
                      pad={12} style={{ minWidth: isDesktop ? undefined : 150, flexShrink: isDesktop ? undefined : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <IconTile name={s.icon || "Store"} a={s.accent || "primary"} size={34} iconSize={17} />
                        {s.verificationStatus === "verified" && <Icon name="BadgeCheck" size={15} color={T.blue} />}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, marginTop: 8,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                      <div style={{ marginTop: 3 }}>
                        <RatingStars value={sellerRatings[s.id]?.avg || 0} count={sellerRatings[s.id]?.count ?? 0} size={11} />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* featured strip */}
            {featured.length > 0 && !q && (
              <div>
                <SectionHeader title={tc({en:"Featured",hi:"विशेष",bn:"বিশেষ"})} />
                <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "1fr 1fr", gap: 12 }}>
                  {featured.slice(0, isDesktop ? 4 : 2).map((p) => (
                    <ProductCard key={p.id} product={p} wished={wishedIds.has(p.id)}
                      onToggleWish={() => toggleWish(p)}
                      onClick={() => push({ kind: "mpProduct", props: { id: p.id } })} />
                  ))}
                </div>
              </div>
            )}

            {/* all products */}
            <div>
              <SectionHeader title={cat === "all" ? tc({en:"All Products",hi:"सभी उत्पाद",bn:"সব পণ্য"}) : (PRODUCT_CATEGORIES.find((c) => c.id === cat)?.label || tc({en:"Products",hi:"उत्पाद",bn:"পণ্য"}))} />
              {list.length === 0 ? (
                <EmptyState icon="SearchX" title={tc({en:"Nothing found",hi:"कुछ नहीं मिला",bn:"কিছু পাওয়া যায়নি"})}
                  body={q ? tc({en:`No products match "${q}".`,hi:`"${q}" से मेल खाने वाला कोई उत्पाद नहीं।`,bn:`"${q}" এর সাথে মেলে এমন কোনো পণ্য নেই।`}) : tc({en:"No products in this category yet.",hi:"इस श्रेणी में अभी कोई उत्पाद नहीं है।",bn:"এই বিভাগে এখনও কোনো পণ্য নেই।"})} />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "1fr 1fr", gap: 12 }}>
                  {list.map((p) => (
                    <ProductCard key={p.id} product={p} wished={wishedIds.has(p.id)}
                      onToggleWish={() => toggleWish(p)}
                      onClick={() => push({ kind: "mpProduct", props: { id: p.id } })} />
                  ))}
                </div>
              )}
            </div>

            <Button variant="soft" full icon="Trash2" onClick={async () => { await seedMp.clear(); refresh(); toast(tc({en:"Demo data cleared",hi:"डेमो डेटा हटाया गया",bn:"ডেমো ডেটা মুছে ফেলা হয়েছে"}), "info"); }}
              style={{ display: (list || []).some((p) => p.demo) ? "inline-flex" : "none" }}>
              {tc({en:"Clear demo data",hi:"डेमो डेटा हटाएं",bn:"ডেমো ডেটা মুছুন"})}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
