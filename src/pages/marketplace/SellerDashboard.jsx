import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, Button, BottomSheet, Dialog, Input, Dropdown } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import StatTile from "../../components/erp/StatTile.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";
import { accent } from "../../components/primitives.jsx";
import { sellerService } from "../../services/marketplace/sellerService.js";
import { productService } from "../../services/marketplace/productService.js";
import { mpOrderService } from "../../services/marketplace/mpOrderService.js";
import { PRODUCT_CATEGORIES, UNITS, SELLER_TYPES, ORDER_STATUS, PRODUCT_STATUS } from "../../services/marketplace/constantsMp.js";
import { rupee, compact } from "../../utils/format.js";

const EMPTY_PRODUCT = { name: "", category: "seeds", brand: "", unit: "kg", price: "", discountPrice: "", stock: "", lowStockAt: "", description: "" };

export default function SellerDashboard() {
  const { pop, push, toast, tc } = useApp();
  const [store, setStore] = useState(undefined);    // undefined = loading, null = no store
  const [tab, setTab] = useState("listings");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({ orders: 0, active: 0, revenue: 0 });
  const [lowStock, setLowStock] = useState([]);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [regOpen, setRegOpen] = useState(false);
  const [reg, setReg] = useState({ name: "", type: "farmer", village: "", district: "", tagline: "", gstin: "" });
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);

  useEffect(() => {
    sellerService.getMine().then((s) => {
      setStore(s || null);
      if (!s) return;
      productService.bySeller(s.id).then(setProducts);
      mpOrderService.bySeller(s.id).then(setOrders);
      mpOrderService.sellerSummary(s.id).then(setSummary);
      productService.lowStock(s.id).then(setLowStock);
    });
  }, [tick]);

  /* ---------- no store yet: onboarding ---------- */
  if (store === undefined) return <><AppBar title={tc({ en: "Sell on AgriOS", hi: "AgriOS पर बेचें", bn: "AgriOS-এ বিক্রি করুন" })} onBack={pop} /></>;
  if (store === null) {
    const onboardCards = [
      ["Package", tc({ en: "List your products", hi: "अपने उत्पाद सूचीबद्ध करें", bn: "আপনার পণ্য তালিকাভুক্ত করুন" }), tc({ en: "Add produce or inputs with price and stock", hi: "मूल्य और स्टॉक के साथ उपज या इनपुट जोड़ें", bn: "দাম ও স্টক সহ ফসল বা উপকরণ যোগ করুন" })],
      ["ClipboardList", tc({ en: "Receive orders", hi: "ऑर्डर प्राप्त करें", bn: "অর্ডার পান" }), tc({ en: "Track each order from pending to delivered", hi: "प्रत्येक ऑर्डर को लंबित से डिलीवर तक ट्रैक करें", bn: "প্রতিটি অর্ডার মুলতুবি থেকে ডেলিভারি পর্যন্ত ট্র্যাক করুন" })],
      ["BadgeCheck", tc({ en: "Get verified", hi: "सत्यापित हों", bn: "যাচাইকৃত হন" }), tc({ en: "KYC & GST verification arrives with the backend phase", hi: "KYC और GST सत्यापन बैकएंड चरण के साथ आएगा", bn: "KYC ও GST যাচাইকরণ ব্যাকএন্ড পর্যায়ে আসবে" })],
    ];
    return (
      <>
        <AppBar title={tc({ en: "Sell on AgriOS", hi: "AgriOS पर बेचें", bn: "AgriOS-এ বিক্রি করুন" })} onBack={pop} />
        <div style={{ padding: "12px 16px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.primaryDark})`,
            borderRadius: T.rLg, padding: 20, color: "#fff", textAlign: "center" }}>
            <Icon name="Store" size={40} color="#fff" />
            <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 800, marginTop: 10 }}>{tc({ en: "Open your store", hi: "अपनी दुकान खोलें", bn: "আপনার দোকান খুলুন" })}</div>
            <div style={{ fontSize: 12.5, opacity: .88, marginTop: 6, lineHeight: 1.5 }}>
              {tc({ en: "Sell produce, seeds, feed and equipment to farmers. Free to start — list products in under a minute.", hi: "किसानों को उपज, बीज, चारा और उपकरण बेचें। मुफ्त में शुरू करें — एक मिनट से भी कम समय में उत्पाद सूचीबद्ध करें।", bn: "কৃষকদের কাছে ফসল, বীজ, খাদ্য ও সরঞ্জাম বিক্রি করুন। বিনামূল্যে শুরু করুন — এক মিনিটেরও কম সময়ে পণ্য তালিকাভুক্ত করুন।" })}
            </div>
          </div>
          {onboardCards.map(([icon, title, desc]) => (
            <Card key={title} pad={13} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: T.primarySoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name={icon} size={18} color={T.primary} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{title}</div>
                <div style={{ fontSize: 12, color: T.inkSoft }}>{desc}</div>
              </div>
            </Card>
          ))}
          <Button full size="lg" onClick={() => setRegOpen(true)}>{tc({ en: "Create my store", hi: "अपनी दुकान बनाएं", bn: "আমার দোকান তৈরি করুন" })}</Button>
        </div>

        <BottomSheet open={regOpen} onClose={() => setRegOpen(false)} title={tc({ en: "Create store", hi: "दुकान बनाएं", bn: "দোকান তৈরি করুন" })}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label={tc({ en: "Store name", hi: "दुकान का नाम", bn: "দোকানের নাম" })} placeholder={tc({ en: "e.g. Hazari Agro Farm", hi: "उदा. हजारी एग्रो फार्म", bn: "যেমন হাজারি অ্যাগ্রো ফার্ম" })} value={reg.name} onChange={(v) => setReg((f) => ({ ...f, name: v }))} />
            <Dropdown label={tc({ en: "Seller type", hi: "विक्रेता प्रकार", bn: "বিক্রেতার ধরন" })} value={reg.type} onChange={(v) => setReg((f) => ({ ...f, type: v }))}
              options={SELLER_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
            <Input label={tc({ en: "Village / Town", hi: "गांव / कस्बा", bn: "গ্রাম / শহর" })} value={reg.village} onChange={(v) => setReg((f) => ({ ...f, village: v }))} />
            <Input label={tc({ en: "District", hi: "जिला", bn: "জেলা" })} value={reg.district} onChange={(v) => setReg((f) => ({ ...f, district: v }))} />
            <Input label={tc({ en: "Tagline (optional)", hi: "टैगलाइन (वैकल्पिक)", bn: "ট্যাগলাইন (ঐচ্ছিক)" })} placeholder={tc({ en: "What you're known for", hi: "आप किस लिए जाने जाते हैं", bn: "আপনি কীসের জন্য পরিচিত" })} value={reg.tagline} onChange={(v) => setReg((f) => ({ ...f, tagline: v }))} />
            <Input label={tc({ en: "GSTIN (optional)", hi: "GSTIN (वैकल्पिक)", bn: "GSTIN (ঐচ্ছিক)" })} placeholder={tc({ en: "For businesses", hi: "व्यवसायों के लिए", bn: "ব্যবসার জন্য" })} value={reg.gstin} onChange={(v) => setReg((f) => ({ ...f, gstin: v }))} />
            <Button full disabled={!reg.name || !reg.village} onClick={async () => {
              await sellerService.register(reg);
              setRegOpen(false); refresh(); toast(tc({ en: "Store created — add your first product", hi: "दुकान बन गई — अपना पहला उत्पाद जोड़ें", bn: "দোকান তৈরি হয়েছে — আপনার প্রথম পণ্য যোগ করুন" }), "success");
            }}>{tc({ en: "Create store", hi: "दुकान बनाएं", bn: "দোকান তৈরি করুন" })}</Button>
          </div>
        </BottomSheet>
      </>
    );
  }

  /* ---------- store dashboard ---------- */
  const saveProduct = async () => {
    if (!form.name || !form.price) return;
    if (editId) {
      await productService.update(editId, {
        ...form, price: Number(form.price),
        discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
        stock: Number(form.stock) || 0, lowStockAt: Number(form.lowStockAt) || 0,
      });
      toast(tc({ en: "Product updated", hi: "उत्पाद अपडेट किया गया", bn: "পণ্য আপডেট হয়েছে" }), "success");
    } else {
      await productService.add({ ...form, sellerId: store.id, sellerName: store.name });
      toast(tc({ en: "Product saved as draft — publish it to go live", hi: "उत्पाद ड्राफ्ट के रूप में सहेजा गया — लाइव करने के लिए प्रकाशित करें", bn: "পণ্য খসড়া হিসেবে সংরক্ষিত — লাইভ করতে প্রকাশ করুন" }), "success");
    }
    setFormOpen(false); setForm(EMPTY_PRODUCT); setEditId(null); refresh();
  };

  const statusPill = (s) => {
    const meta = PRODUCT_STATUS[s] || { label: s, a: "primary" };
    const c = accent(meta.a);
    return <Pill fg={c.fg} bg={c.bg}>{meta.label.toUpperCase()}</Pill>;
  };

  const orderPill = (s) => {
    const meta = ORDER_STATUS[s] || { label: s, a: "primary" };
    const c = accent(meta.a);
    return <Pill fg={c.fg} bg={c.bg}>{meta.label.toUpperCase()}</Pill>;
  };

  return (
    <>
      <AppBar title={store.name} onBack={pop} action={tab === "listings" ? (
        <button onClick={() => { setForm(EMPTY_PRODUCT); setEditId(null); setFormOpen(true); }}
          style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ করুন" })}
        </button>
      ) : undefined} />

      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        <StatTile a="primary" label={tc({ en: "Revenue", hi: "राजस्व", bn: "আয়" })} value={compact(summary.revenue)} />
        <StatTile a="blue" label={tc({ en: "Active orders", hi: "सक्रिय ऑर्डर", bn: "সক্রিয় অর্ডার" })} value={summary.active} />
        <StatTile a="orange" label={tc({ en: "Listings", hi: "सूचियां", bn: "তালিকা" })} value={products.length} />
        <StatTile a={lowStock.length ? "red" : "primary"} label={tc({ en: "Low stock", hi: "कम स्टॉक", bn: "কম স্টক" })} value={lowStock.length} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px" }}>
        {[["listings", tc({ en: "Listings", hi: "सूचियां", bn: "তালিকা" })], ["orders", tc({ en: `Orders (${summary.active})`, hi: `ऑर्डर (${summary.active})`, bn: `অর্ডার (${summary.active})` })], ["store", tc({ en: "Store", hi: "दुकान", bn: "দোকান" })]].map(([id, label]) => (
          <Chip key={id} active={tab === id} onClick={() => setTab(id)}>{label}</Chip>
        ))}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* ---- listings ---- */}
        {tab === "listings" && (products.length === 0
          ? <EmptyHint icon="Package" text={tc({ en: "Add your first product — it starts as a draft and goes live when you publish it", hi: "अपना पहला उत्पाद जोड़ें — यह ड्राफ्ट के रूप में शुरू होता है और प्रकाशित करने पर लाइव हो जाता है", bn: "আপনার প্রথম পণ্য যোগ করুন — এটি খসড়া হিসেবে শুরু হয় এবং প্রকাশ করলে লাইভ হয়" })} />
          : products.map((p) => (
            <RecordRow key={p.id}
              icon={productService.categoryIcon(p.category)}
              iconColor={accent(PRODUCT_CATEGORIES.find((c) => c.id === p.category)?.accent || "primary").fg}
              iconBg={accent(PRODUCT_CATEGORIES.find((c) => c.id === p.category)?.accent || "primary").bg}
              title={p.name} badge={statusPill(p.status)}
              subtitle={`${rupee(productService.unitPrice(p))}/${p.unit} · ${productService.available(p)} ${tc({en:"available",hi:"उपलब्ध",bn:"উপলব্ধ"})}${p.reserved ? ` · ${p.reserved} ${tc({en:"reserved",hi:"आरक्षित",bn:"সংরক্ষিত"})}` : ""}`}
              onClick={() => {
                setForm({ name: p.name, category: p.category, brand: p.brand || "", unit: p.unit,
                  price: String(p.price), discountPrice: p.discountPrice ? String(p.discountPrice) : "",
                  stock: String(p.stock), lowStockAt: String(p.lowStockAt || ""), description: p.description || "" });
                setEditId(p.id); setFormOpen(true);
              }}
              right={
                <button onClick={async (e) => {
                  e.stopPropagation();
                  await productService.setStatus(p.id, p.status === "published" ? "draft" : "published");
                  refresh(); toast(p.status === "published" ? tc({ en: "Listing taken offline", hi: "सूची ऑफलाइन कर दी गई", bn: "তালিকা অফলাইন করা হয়েছে" }) : tc({ en: "Listing is live", hi: "सूची लाइव है", bn: "তালিকা লাইভ" }), "success");
                }}
                  style={{ background: p.status === "published" ? T.surface2 : T.primarySoft,
                    color: p.status === "published" ? T.inkSoft : T.primary, border: "none", borderRadius: 9,
                    padding: "6px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: T.body, flexShrink: 0 }}>
                  {p.status === "published" ? tc({ en: "Unpublish", hi: "अप्रकाशित करें", bn: "অপ্রকাশিত করুন" }) : tc({ en: "Publish", hi: "प्रकाशित करें", bn: "প্রকাশ করুন" })}
                </button>
              }
              onDelete={() => setDelId(p.id)} />
          )))}

        {/* ---- orders ---- */}
        {tab === "orders" && (orders.length === 0
          ? <EmptyHint icon="ClipboardList" text={tc({ en: "Orders from buyers will appear here", hi: "खरीदारों के ऑर्डर यहां दिखाई देंगे", bn: "ক্রেতাদের অর্ডার এখানে দেখা যাবে" })} />
          : orders.map((o) => {
            const next = mpOrderService.nextStatus(o.status);
            return (
              <Card key={o.id} pad={13}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>#{o.id.slice(-6).toUpperCase()}</span>
                  {orderPill(o.status)}
                  <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 13.5 }}>{rupee(o.total)}</span>
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 5 }}>
                  {o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}
                </div>
                {o.address && (
                  <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 3 }}>
                    <Icon name="MapPin" size={11} style={{ verticalAlign: -1 }} /> {o.address.name} · {o.address.village}{o.address.district ? `, ${o.address.district}` : ""} · {o.address.phone}
                  </div>
                )}
                {next && (
                  <div style={{ marginTop: 10 }}>
                    <Button size="sm" variant="soft" icon="ArrowRight" onClick={async () => {
                      await mpOrderService.setStatus(o.id, next);
                      refresh(); toast(tc({ en: `Order marked ${ORDER_STATUS[next].label.toLowerCase()}`, hi: `ऑर्डर को ${ORDER_STATUS[next].label} चिह्नित किया गया`, bn: `অর্ডার ${ORDER_STATUS[next].label} হিসেবে চিহ্নিত হয়েছে` }), "success");
                    }}>
                      {tc({ en: `Mark ${ORDER_STATUS[next].label}`, hi: `${ORDER_STATUS[next].label} चिह्नित करें`, bn: `${ORDER_STATUS[next].label} চিহ্নিত করুন` })}
                    </Button>
                  </div>
                )}
              </Card>
            );
          }))}

        {/* ---- store settings ---- */}
        {tab === "store" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Card pad={13} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Icon name={store.verificationStatus === "verified" ? "BadgeCheck" : "BadgeAlert"} size={20}
                color={store.verificationStatus === "verified" ? T.blue : T.orange} />
              <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.5 }}>
                {tc({ en: "Verification", hi: "सत्यापन", bn: "যাচাইকরণ" })}: <b style={{ color: T.ink }}>{store.verificationStatus}</b> · KYC: <b style={{ color: T.ink }}>{store.kycStatus?.replace("_", " ")}</b><br />
                {tc({ en: "Real KYC / GST verification opens with the shared backend phase.", hi: "वास्तविक KYC / GST सत्यापन साझा बैकएंड चरण के साथ शुरू होगा।", bn: "প্রকৃত KYC / GST যাচাইকরণ শেয়ার্ড ব্যাকএন্ড পর্যায়ে চালু হবে।" })}
              </div>
            </Card>
            <StoreEditForm store={store} onSaved={() => { refresh(); toast(tc({ en: "Store updated", hi: "दुकान अपडेट की गई", bn: "দোকান আপডেট হয়েছে" }), "success"); }} />
          </div>
        )}
      </div>

      {/* product form */}
      <BottomSheet open={formOpen} onClose={() => { setFormOpen(false); setEditId(null); }}
        title={editId ? tc({ en: "Edit product", hi: "उत्पाद संपादित करें", bn: "পণ্য সম্পাদনা করুন" }) : tc({ en: "Add product", hi: "उत्पाद जोड़ें", bn: "পণ্য যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Product name", hi: "उत्पाद का नाम", bn: "পণ্যের নাম" })} placeholder={tc({ en: "e.g. Swarna Paddy Seed 10kg", hi: "उदा. स्वर्णा धान बीज 10 किग्रा", bn: "যেমন স্বর্ণা ধান বীজ ১০ কেজি" })} value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Dropdown label={tc({ en: "Category", hi: "श्रेणी", bn: "বিভাগ" })} value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))}
            options={PRODUCT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
          <Input label={tc({ en: "Brand (optional)", hi: "ब्रांड (वैकल्पिक)", bn: "ব্র্যান্ড (ঐচ্ছিক)" })} value={form.brand} onChange={(v) => setForm((f) => ({ ...f, brand: v }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Dropdown label={tc({ en: "Unit", hi: "इकाई", bn: "একক" })} value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))}
              options={UNITS.map((u) => ({ value: u, label: u }))} />
            <Input label={tc({ en: "Price (₹)", hi: "मूल्य (₹)", bn: "দাম (₹)" })} type="number" placeholder="0" value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label={tc({ en: "Offer price (optional)", hi: "ऑफर मूल्य (वैकल्पिक)", bn: "অফার দাম (ঐচ্ছিক)" })} type="number" placeholder="0" value={form.discountPrice} onChange={(v) => setForm((f) => ({ ...f, discountPrice: v }))} />
            <Input label={tc({ en: "Stock", hi: "स्टॉक", bn: "স্টক" })} type="number" placeholder="0" value={form.stock} onChange={(v) => setForm((f) => ({ ...f, stock: v }))} />
          </div>
          <Input label={tc({ en: "Low-stock alert level", hi: "कम स्टॉक चेतावनी स्तर", bn: "কম স্টক সতর্কতা স্তর" })} type="number" placeholder="0" value={form.lowStockAt} onChange={(v) => setForm((f) => ({ ...f, lowStockAt: v }))} />
          <Input label={tc({ en: "Description", hi: "विवरण", bn: "বিবরণ" })} placeholder={tc({ en: "Variety, grade, packing…", hi: "किस्म, ग्रेड, पैकिंग…", bn: "জাত, গ্রেড, প্যাকিং…" })} value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
          <Button full onClick={saveProduct} disabled={!form.name || !form.price}>
            {editId ? tc({ en: "Save changes", hi: "परिवर्तन सहेजें", bn: "পরিবর্তন সংরক্ষণ করুন" }) : tc({ en: "Add product", hi: "उत्पाद जोड़ें", bn: "পণ্য যোগ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delId} onClose={() => setDelId(null)} danger icon="Trash2"
        title={tc({ en: "Delete listing?", hi: "सूची हटाएं?", bn: "তালিকা মুছবেন?" })} body={tc({ en: "The product will be removed from the marketplace.", hi: "उत्पाद बाज़ार से हटा दिया जाएगा।", bn: "পণ্যটি বাজার থেকে সরিয়ে দেওয়া হবে।" })}
        confirmLabel={tc({ en: "Delete", hi: "हटाएं", bn: "মুছুন" })} onConfirm={async () => { await productService.remove(delId); setDelId(null); refresh(); toast(tc({ en: "Deleted", hi: "हटा दिया गया", bn: "মুছে ফেলা হয়েছে" }), "info"); }} />
    </>
  );
}

function StoreEditForm({ store, onSaved }) {
  const { tc } = useApp();
  const [f, setF] = useState({ name: store.name, tagline: store.tagline || "", village: store.village || "",
    district: store.district || "", gstin: store.gstin || "", description: store.description || "" });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Card pad={14}>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <Input label={tc({ en: "Store name", hi: "दुकान का नाम", bn: "দোকানের নাম" })} value={f.name} onChange={set("name")} />
        <Input label={tc({ en: "Tagline", hi: "टैगलाइन", bn: "ট্যাগলাইন" })} value={f.tagline} onChange={set("tagline")} />
        <Input label={tc({ en: "Village / Town", hi: "गांव / कस्बा", bn: "গ্রাম / শহর" })} value={f.village} onChange={set("village")} />
        <Input label={tc({ en: "District", hi: "जिला", bn: "জেলা" })} value={f.district} onChange={set("district")} />
        <Input label={tc({ en: "GSTIN", hi: "GSTIN", bn: "GSTIN" })} value={f.gstin} onChange={set("gstin")} />
        <Input label={tc({ en: "About the store", hi: "दुकान के बारे में", bn: "দোকান সম্পর্কে" })} value={f.description} onChange={set("description")} />
        <Button full disabled={!f.name} onClick={async () => {
          await sellerService.update(store.id, { ...f, kycStatus: f.gstin ? "submitted" : store.kycStatus });
          onSaved();
        }}>{tc({ en: "Save store", hi: "दुकान सहेजें", bn: "দোকান সংরক্ষণ করুন" })}</Button>
      </div>
    </Card>
  );
}
