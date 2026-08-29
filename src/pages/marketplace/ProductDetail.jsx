import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, IconTile, SectionHeader, Divider } from "../../components/index.js";
import { accent } from "../../components/primitives.jsx";
import { useApp } from "../../store/AppStore.jsx";
import RatingStars from "../../components/marketplace/RatingStars.jsx";
import { Pill } from "../../components/erp/RecordList.jsx";
import { productService } from "../../services/marketplace/productService.js";
import { sellerService } from "../../services/marketplace/sellerService.js";
import { cartService } from "../../services/marketplace/cartService.js";
import { wishlistService } from "../../services/marketplace/wishlistService.js";
import { reviewService } from "../../services/marketplace/reviewService.js";
import { categoryMeta } from "../../services/marketplace/constantsMp.js";
import { rupee } from "../../utils/format.js";

export default function ProductDetail({ id }) {
  const { pop, push, toast, tc } = useApp();
  const [p, setP] = useState(null);
  const [seller, setSeller] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ avg: 0, count: 0 });
  const [wished, setWished] = useState(false);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    productService.getById(id).then(async (prod) => {
      setP(prod);
      if (!prod) return;
      sellerService.getById(prod.sellerId).then(setSeller);
      reviewService.forProduct(id).then(setReviews);
      reviewService.productStats(id).then(setStats);
      wishlistService.has("product", id).then(setWished);
    });
  }, [id]);

  if (!p) return <><AppBar title={tc({ en: "Product", hi: "उत्पाद", bn: "পণ্য" })} onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkFaint, fontSize: 13 }}>{tc({ en: "Product not found.", hi: "उत्पाद नहीं मिला।", bn: "পণ্য পাওয়া যায়নি।" })}</div></>;

  const meta = categoryMeta(p.category);
  const c = accent(meta.accent);
  const available = productService.available(p);
  const out = available <= 0;
  const price = productService.unitPrice(p, qty);
  const hasDiscount = p.discountPrice && p.discountPrice < p.price;

  const addToCart = async (goToCart = false) => {
    await cartService.addToCart(p.id, qty);
    toast(tc({ en: `Added ${qty} × ${p.name}`, hi: `${qty} × ${p.name} जोड़ा गया`, bn: `${qty} × ${p.name} যোগ করা হয়েছে` }), "success");
    if (goToCart) push({ kind: "mpCart" });
  };

  const stepBtn = (d) => (
    <button onClick={() => setQty((n) => Math.min(Math.max(1, n + d), available || 1))}
      style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.line}`,
        background: T.surface, color: T.ink, cursor: "pointer", display: "grid", placeItems: "center" }}>
      <Icon name={d > 0 ? "Plus" : "Minus"} size={15} />
    </button>
  );

  return (
    <>
      <AppBar title={meta.label} onBack={pop} action={
        <button onClick={async () => { const on = await wishlistService.toggle("product", p.id); setWished(on); toast(on ? tc({ en: "Added to wishlist", hi: "विशलिस्ट में जोड़ा गया", bn: "উইশলিস্টে যোগ করা হয়েছে" }) : tc({ en: "Removed", hi: "हटाया गया", bn: "সরানো হয়েছে" }), "info"); }}
          aria-label={tc({ en: "Add to wishlist", hi: "इच्छा-सूची में जोड़ें", bn: "পছন্দের তালিকায় যোগ করুন" })} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8, cursor: "pointer", display: "flex" }}>
          <Icon name="Heart" size={19} color={wished ? T.red : T.ink} style={{ fill: wished ? T.red : "none" }} />
        </button>
      } />

      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 14,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* hero */}
        <div style={{ background: c.bg, borderRadius: T.rLg, height: 150, display: "grid", placeItems: "center", position: "relative" }}>
          <Icon name={meta.icon} size={64} color={c.fg} strokeWidth={1.4} />
          {p.featured && <span style={{ position: "absolute", top: 12, left: 12, background: T.yellow, color: "#3b2f00", fontSize: 10, fontWeight: 800, padding: "4px 8px", borderRadius: 7 }}>{tc({ en: "FEATURED", hi: "विशेष", bn: "বৈশিষ্ট্যযুক্ত" })}</span>}
        </div>

        {/* title + price */}
        <div>
          <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>{p.name}</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3 }}>
            {p.brand ? `${p.brand} · ` : ""}{meta.label}
          </div>
          <div style={{ marginTop: 6 }}><RatingStars value={stats.avg} count={stats.count} /></div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
            <span style={{ fontFamily: T.display, fontSize: 26, fontWeight: 800, color: T.ink }}>{rupee(price)}</span>
            {hasDiscount && <span style={{ fontSize: 14, color: T.inkFaint, textDecoration: "line-through" }}>{rupee(p.price)}</span>}
            <span style={{ fontSize: 12.5, color: T.inkSoft }}>/{p.unit}</span>
            {out
              ? <Pill fg={T.red} bg={T.redSoft}>{tc({ en: "OUT OF STOCK", hi: "स्टॉक में नहीं", bn: "স্টক নেই" })}</Pill>
              : available <= (p.lowStockAt || 0)
                ? <Pill fg={T.orange} bg={T.orangeSoft}>{tc({ en: `ONLY ${available} LEFT`, hi: `केवल ${available} बचा`, bn: `মাত্র ${available} বাকি` })}</Pill>
                : <Pill fg={T.primary} bg={T.primarySoft}>{tc({ en: "IN STOCK", hi: "स्टॉक में है", bn: "স্টকে আছে" })}</Pill>}
          </div>
        </div>

        {/* bulk pricing */}
        {(p.bulkPrices || []).length > 0 && (
          <Card pad={13}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{tc({ en: "Bulk pricing", hi: "थोक मूल्य", bn: "পাইকারি দাম" })}</div>
            {p.bulkPrices.map((b, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: T.inkSoft, padding: "3px 0" }}>
                <span>{b.minQty}+ {p.unit}</span><b style={{ color: T.ink }}>{rupee(b.price)}/{p.unit}</b>
              </div>
            ))}
          </Card>
        )}

        {/* seller */}
        {seller && (
          <Card pad={13} onClick={() => push({ kind: "mpStore", props: { sellerId: seller.id } })}
            style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <IconTile name={seller.icon || "Store"} a={seller.accent || "primary"} size={40} iconSize={19} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                {seller.name}
                {seller.verificationStatus === "verified" && <Icon name="BadgeCheck" size={15} color={T.blue} />}
              </div>
              <div style={{ fontSize: 11.5, color: T.inkSoft }}>
                {sellerService.typeLabel(seller.type)}{seller.village ? ` · ${seller.village}` : ""}
              </div>
            </div>
            <Icon name="ChevronRight" size={17} color={T.inkFaint} />
          </Card>
        )}

        {/* description + specs */}
        {p.description && <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.6 }}>{p.description}</div>}
        {p.specs && Object.keys(p.specs).length > 0 && (
          <Card pad={13}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{tc({ en: "Specifications", hi: "विशेषताएं", bn: "বৈশিষ্ট্য" })}</div>
            {Object.entries(p.specs).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}>
                <span style={{ color: T.inkSoft }}>{k}</span><span style={{ color: T.ink, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </Card>
        )}

        {/* qty + actions */}
        {!out && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.inkSoft }}>{tc({ en: "Quantity", hi: "मात्रा", bn: "পরিমাণ" })}</span>
              {stepBtn(-1)}
              <span style={{ fontSize: 16, fontWeight: 800, minWidth: 28, textAlign: "center" }}>{qty}</span>
              {stepBtn(1)}
              <span style={{ marginLeft: "auto", fontSize: 13.5, fontWeight: 700 }}>{rupee(price * qty)}</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="soft" full icon="ShoppingCart" onClick={() => addToCart(false)}>{tc({ en: "Add to Cart", hi: "कार्ट में डालें", bn: "কার্টে যোগ করুন" })}</Button>
              <Button full onClick={() => addToCart(true)}>{tc({ en: "Buy Now", hi: "अभी खरीदें", bn: "এখনই কিনুন" })}</Button>
            </div>
          </>
        )}

        {/* reviews */}
        <Divider my={4} />
        <SectionHeader title={tc({ en: `Reviews (${stats.count})`, hi: `समीक्षाएं (${stats.count})`, bn: `রিভিউ (${stats.count})` })} />
        {reviews.length === 0 ? (
          <div style={{ fontSize: 12.5, color: T.inkFaint, textAlign: "center", padding: "8px 0 16px" }}>
            {tc({ en: "No reviews yet — reviews unlock after a delivered order.", hi: "अभी तक कोई समीक्षा नहीं — डिलीवर हुए ऑर्डर के बाद समीक्षा उपलब्ध होगी।", bn: "এখনও কোনো রিভিউ নেই — ডেলিভারি হওয়া অর্ডারের পর রিভিউ আনলক হবে।" })}
          </div>
        ) : reviews.map((r) => (
          <Card key={r.id} pad={13}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <RatingStars value={r.rating} size={12} />
              <span style={{ fontSize: 12, fontWeight: 700 }}>{r.author}</span>
              {r.verified && <Pill fg={T.primary} bg={T.primarySoft}>{tc({ en: "VERIFIED", hi: "सत्यापित", bn: "যাচাইকৃত" })}</Pill>}
            </div>
            {r.text && <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 6, lineHeight: 1.5 }}>{r.text}</div>}
          </Card>
        ))}
      </div>
    </>
  );
}
