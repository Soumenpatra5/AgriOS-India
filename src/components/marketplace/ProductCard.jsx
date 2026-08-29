import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../Icon.jsx";
import { Card, accent } from "../primitives.jsx";
import { productService } from "../../services/marketplace/productService.js";
import { categoryMeta } from "../../services/marketplace/constantsMp.js";
import { rupee } from "../../utils/format.js";
import { useApp } from "../../store/AppStore.jsx";

/* Grid card for one listing. Icon-tile stands in for product photos until
   image upload exists (backend phase). */
export default function ProductCard({ product, onClick, wished, onToggleWish }) {
  const { tc } = useApp();
  const meta = categoryMeta(product.category);
  const c = accent(meta.accent);
  const available = productService.available(product);
  const out = available <= 0;
  const price = productService.unitPrice(product);
  const hasDiscount = product.discountPrice && product.discountPrice < product.price;

  return (
    <Card pad={0} onClick={onClick} style={{ overflow: "hidden", opacity: out ? 0.72 : 1 }}>
      <div style={{ position: "relative", background: c.bg, height: 96, display: "grid", placeItems: "center" }}>
        <Icon name={meta.icon} size={40} color={c.fg} strokeWidth={1.6} />
        {onToggleWish && (
          <button onClick={(e) => { e.stopPropagation(); onToggleWish(); }} aria-label={tc({ en: "Add to wishlist", hi: "इच्छा-सूची में जोड़ें", bn: "পছন্দের তালিকায় যোগ করুন" })}
            style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 10,
              background: T.surface, border: `1px solid ${T.line}`, cursor: "pointer",
              display: "grid", placeItems: "center" }}>
            <Icon name="Heart" size={15} color={wished ? T.red : T.inkFaint}
              style={{ fill: wished ? T.red : "none" }} />
          </button>
        )}
        {product.featured && !out && (
          <span style={{ position: "absolute", top: 8, left: 8, background: T.yellow, color: "#3b2f00",
            fontSize: 9.5, fontWeight: 800, padding: "3px 7px", borderRadius: 6 }}>FEATURED</span>
        )}
        {out && (
          <span style={{ position: "absolute", bottom: 8, left: 8, background: T.red, color: "#fff",
            fontSize: 9.5, fontWeight: 800, padding: "3px 7px", borderRadius: 6 }}>{tc({ en: "OUT OF STOCK", hi: "स्टॉक ख़त्म", bn: "স্টক শেষ" })}</span>
        )}
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, lineHeight: 1.3, minHeight: 34,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {product.name}
        </div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2, overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {product.sellerName || product.brand || meta.label}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums" }}>
            {rupee(price)}
          </span>
          {hasDiscount && (
            <span style={{ fontSize: 11, color: T.inkFaint, textDecoration: "line-through" }}>
              {rupee(product.price)}
            </span>
          )}
          <span style={{ fontSize: 10.5, color: T.inkFaint }}>/{product.unit}</span>
        </div>
      </div>
    </Card>
  );
}
