import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, EmptyState, Button, IconTile } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { seedLog } from "../../services/logistics/seedLog.js";
import { logisticsAnalytics } from "../../services/logistics/logisticsAnalytics.js";
import { compact } from "../../utils/format.js";

export default function LogisticsHub() {
  const { pop, push, toast, tc } = useApp();

  const MODULES = [
    { kind: "logShipments",   label: tc({en:"Shipments",hi:"शिपमेंट",bn:"শিপমেন্ট"}),    desc: tc({en:"Book & track deliveries",hi:"डिलीवरी बुक और ट्रैक करें",bn:"ডেলিভারি বুক ও ট্র্যাক করুন"}),     icon: "Package",       a: "primary" },
    { kind: "logFleet",       label: tc({en:"Fleet & Drivers",hi:"फ्लीट और ड्राइवर",bn:"ফ্লিট ও ড্রাইভার"}),desc: tc({en:"Provide transport services",hi:"परिवहन सेवाएँ प्रदान करें",bn:"পরিবহন পরিষেবা প্রদান করুন"}),icon: "Truck",         a: "blue"    },
    { kind: "logWarehouse",   label: tc({en:"Warehousing",hi:"भंडारण",bn:"গুদামজাতকরণ"}),  desc: tc({en:"Dry & cold storage",hi:"सूखा और शीत भंडारण",bn:"শুকনো ও হিমাগার"}),          icon: "Warehouse",     a: "orange"  },
    { kind: "logContracts",   label: tc({en:"Contract Farming",hi:"अनुबंध खेती",bn:"চুক্তি চাষ"}),desc: tc({en:"Digital buyer agreements",hi:"डिजिटल क्रेता समझौते",bn:"ডিজিটাল ক্রেতা চুক্তি"}), icon: "FileSignature", a: "primary" },
    { kind: "logAuctions",    label: tc({en:"Auctions",hi:"नीलामी",bn:"নিলাম"}),     desc: tc({en:"Forward & reverse bidding",hi:"फॉरवर्ड और रिवर्स बोली",bn:"ফরোয়ার্ড ও রিভার্স বিডিং"}),   icon: "Gavel",         a: "yellow"  },
    { kind: "logProcurement", label: tc({en:"Procurement",hi:"खरीद",bn:"সংগ্রহ"}),  desc: tc({en:"Tenders & purchase orders",hi:"निविदाएँ और खरीद आदेश",bn:"দরপত্র ও ক্রয় আদেশ"}),   icon: "ClipboardList", a: "blue"    },
    { kind: "logExport",      label: tc({en:"Export",hi:"निर्यात",bn:"রপ্তানি"}),       desc: tc({en:"Docs & compliance",hi:"दस्तावेज़ और अनुपालन",bn:"নথি ও সম্মতি"}),           icon: "Container",     a: "primary" },
    { kind: "logAnalytics",   label: tc({en:"Analytics",hi:"विश्लेषण",bn:"বিশ্লেষণ"}),    desc: tc({en:"Supply-chain KPIs",hi:"सप्लाई-चेन KPI",bn:"সাপ্লাই-চেইন KPI"}),           icon: "BarChart3",     a: "orange"  },
  ];
  const [seeding, setSeeding] = useState(false);
  const [hasData, setHasData] = useState(null);
  const [ov, setOv] = useState(null);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  useEffect(() => {
    seedLog.hasData().then(setHasData);
    logisticsAnalytics.overview().then(setOv);
  }, [tick]);

  const loadDemo = async () => {
    setSeeding(true);
    const r = await seedLog.load();
    setSeeding(false);
    toast(tc({en:`${r.shipments} shipments, ${r.vehicles} vehicles, ${r.warehouses} warehouses loaded`,hi:`${r.shipments} शिपमेंट, ${r.vehicles} वाहन, ${r.warehouses} गोदाम लोड हुए`,bn:`${r.shipments} শিপমেন্ট, ${r.vehicles} যানবাহন, ${r.warehouses} গুদাম লোড হয়েছে`}), "success");
    refresh();
  };

  const clearDemo = async () => { await seedLog.clear(); toast(tc({en:"Demo data cleared",hi:"डेमो डेटा साफ़ किया",bn:"ডেমো ডেটা মুছে ফেলা হয়েছে"}), "info"); refresh(); };

  return (
    <>
      <AppBar title={tc({en:"Logistics & Trade",hi:"लॉजिस्टिक्स और व्यापार",bn:"লজিস্টিক্স ও বাণিজ্য"})} onBack={pop} />
      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 16,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* hero summary */}
        {ov && hasData && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {[
              { label: tc({en:"Shipments",hi:"शिपमेंट",bn:"শিপমেন্ট"}), value: ov.shipments.total, icon: "Package", a: "primary" },
              { label: tc({en:"In Transit",hi:"रास्ते में",bn:"ট্রানজিটে"}), value: ov.shipments.active, icon: "Navigation", a: "orange" },
              { label: tc({en:"Revenue",hi:"राजस्व",bn:"রাজস্ব"}), value: compact(ov.shipments.revenue), icon: "IndianRupee", a: "primary" },
              { label: tc({en:"Warehouses",hi:"गोदाम",bn:"গুদাম"}), value: ov.warehouses.facilities, icon: "Warehouse", a: "blue" },
            ].map((s) => (
              <div key={s.label} style={{ flexShrink: 0, background: T.surface, border: `1px solid ${T.line}`,
                borderRadius: T.rMd, padding: "10px 14px", minWidth: 104 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name={s.icon} size={14} color={T.primary} />
                  <span style={{ fontSize: 17, fontWeight: 800, color: T.ink, fontFamily: T.display }}>{s.value}</span>
                </div>
                <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {hasData === false ? (
          <EmptyState icon="Truck" title={tc({en:"Logistics & Smart Commerce",hi:"लॉजिस्टिक्स और स्मार्ट कॉमर्स",bn:"লজিস্টিক্স ও স্মার্ট কমার্স"})}
            body={tc({en:"Transport, fleet, shipment tracking, warehousing, cold chain, contract farming, auctions, procurement and export — all in one place. Load demo data to explore.",hi:"परिवहन, फ्लीट, शिपमेंट ट्रैकिंग, भंडारण, कोल्ड चेन, अनुबंध खेती, नीलामी, खरीद और निर्यात — सब एक जगह। डेमो डेटा लोड करके देखें।",bn:"পরিবহন, ফ্লিট, শিপমেন্ট ট্র্যাকিং, গুদামজাতকরণ, কোল্ড চেইন, চুক্তি চাষ, নিলাম, সংগ্রহ ও রপ্তানি — সব এক জায়গায়। ডেমো ডেটা লোড করে দেখুন।"})}
            action={seeding ? tc({en:"Loading…",hi:"लोड हो रहा…",bn:"লোড হচ্ছে…"}) : tc({en:"Load demo data",hi:"डेमो डेटा लोड करें",bn:"ডেমো ডেটা লোড করুন"})} onAction={seeding ? undefined : loadDemo} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {MODULES.map((m) => (
              <Card key={m.kind} onClick={() => push({ kind: m.kind })} pad={13}>
                <IconTile name={m.icon} a={m.a} size={40} iconSize={20} />
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, marginTop: 9 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{m.desc}</div>
              </Card>
            ))}
          </div>
        )}

        {hasData && (
          <Button variant="soft" full icon="Trash2" onClick={clearDemo}>{tc({en:"Clear demo data",hi:"डेमो डेटा साफ़ करें",bn:"ডেমো ডেটা মুছুন"})}</Button>
        )}
      </div>
    </>
  );
}
