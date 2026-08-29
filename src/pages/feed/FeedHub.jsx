/* Feed Management hub — landing page for the feed submodules. */
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";

const TILES = [
  { kind: "feedCalculator", label: { en: "Feed Calculator", hi: "चारा कैलकुलेटर", bn: "খাদ্য ক্যালকুলেটর" }, icon: "Calculator", a: "yellow", desc: { en: "Quick feed cost estimate", hi: "त्वरित चारा लागत अनुमान", bn: "দ্রুত খাদ্য ব্যয় অনুমান" } },
  { kind: "feedInventory",  label: { en: "Feed Inventory", hi: "चारा स्टॉक", bn: "খাদ্য মজুত" },  icon: "Package",    a: "orange", desc: { en: "Stock, expiry, low-stock alerts", hi: "स्टॉक, समय-सीमा, कम स्टॉक अलर्ट", bn: "মজুত, মেয়াদ, কম মজুত সতর্কতা" } },
  { kind: "feedPurchase",   label: { en: "Feed Purchase", hi: "चारा खरीद", bn: "খাদ্য ক্রয়" },   icon: "ShoppingCart", a: "primary", desc: { en: "Record a purchase & restock", hi: "खरीद दर्ज करें और स्टॉक भरें", bn: "ক্রয় লিখুন ও মজুত পূরণ করুন" } },
  { kind: "feedBatchList",  label: { en: "Feed Batches & FCR", hi: "चारा बैच और FCR", bn: "খাদ্য ব্যাচ ও FCR" }, icon: "Layers",   a: "red", desc: { en: "Batch-wise consumption & feed conversion ratio", hi: "बैच-वार खपत और चारा रूपांतरण अनुपात", bn: "ব্যাচভিত্তিক ব্যবহার ও খাদ্য রূপান্তর অনুপাত" } },
  { kind: "feedWastage",    label: { en: "Feed Wastage", hi: "चारा बर्बादी", bn: "খাদ্য অপচয়" },    icon: "AlertTriangle", a: "red", desc: { en: "Spoilage, spillage & damaged stock", hi: "खराबी, छलकाव और क्षतिग्रस्त स्टॉक", bn: "নষ্ট, ছিটকে পড়া ও ক্ষতিগ্রস্ত মজুত" } },
  { kind: "feedDashboard",  label: { en: "Feed Cost Analytics", hi: "चारा लागत विश्लेषण", bn: "খাদ্য ব্যয় বিশ্লেষণ" }, icon: "BarChart3", a: "blue", desc: { en: "Cost trends, FCR & livestock comparison, alerts", hi: "लागत रुझान, FCR और पशु तुलना, अलर्ट", bn: "ব্যয়ের ধারা, FCR ও প্রাণী তুলনা, সতর্কতা" } },
  { kind: "feedReports",    label: { en: "Feed Reports", hi: "चारा रिपोर्ट", bn: "খাদ্য রিপোর্ট" },    icon: "FileText",   a: "blue", desc: { en: "Cost, inventory, FCR, wastage, purchase & supplier reports", hi: "लागत, स्टॉक, FCR, बर्बादी, खरीद और आपूर्तिकर्ता रिपोर्ट", bn: "ব্যয়, মজুত, FCR, অপচয়, ক্রয় ও সরবরাহকারী রিপোর্ট" } },
];

const FG = { primary: T.primary, orange: T.orange, yellow: T.yellow, red: T.red, blue: T.blue };
const BG = { primary: T.primarySoft, orange: T.orangeSoft, yellow: T.yellowSoft, red: T.redSoft, blue: T.blueSoft };

export default function FeedHub() {
  const { pop, push, tc } = useApp();
  return (
    <>
      <AppBar title={tc({ en: "Feed Management", hi: "चारा प्रबंधन", bn: "খাদ্য ব্যবস্থাপনা" })} onBack={pop} />
      <Screen gap={16}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {TILES.map((t) => (
            <button key={t.kind} onClick={() => push({ kind: t.kind })}
              style={{ display: "flex", alignItems: "center", gap: 12, background: T.surface,
                border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: 14, cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, background: BG[t.a], color: FG[t.a],
                display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name={t.icon} size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{tc(t.label)}</div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{tc(t.desc)}</div>
              </div>
              <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
            </button>
          ))}
        </div>
      </Screen>
    </>
  );
}
