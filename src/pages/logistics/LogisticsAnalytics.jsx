import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, SectionHeader, EmptyState } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import StatTile from "../../components/erp/StatTile.jsx";
import { logisticsAnalytics } from "../../services/logistics/logisticsAnalytics.js";
import { compact } from "../../utils/format.js";

export default function LogisticsAnalytics() {
  const { pop, tc } = useApp();
  const [ov, setOv] = useState(null);
  const [throughput, setThroughput] = useState([]);

  useEffect(() => {
    logisticsAnalytics.overview().then(setOv);
    logisticsAnalytics.commodityThroughput().then(setThroughput);
  }, []);

  if (!ov) return <><AppBar title={tc({en:"Analytics", hi:"विश्लेषण", bn:"বিশ্লেষণ"})} onBack={pop} /></>;

  const empty = ov.shipments.total === 0 && ov.warehouses.facilities === 0;
  const maxKg = Math.max(1, ...throughput.map((t) => t.kg));

  const group = (title, tiles) => (
    <div>
      <SectionHeader title={title} />
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {tiles.map((t) => <StatTile key={t.label} {...t} />)}
      </div>
    </div>
  );

  return (
    <>
      <AppBar title={tc({en:"Supply-Chain Analytics", hi:"आपूर्ति श्रृंखला विश्लेषण", bn:"সরবরাহ শৃঙ্খল বিশ্লেষণ"})} onBack={pop} />
      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 18,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {empty ? (
          <EmptyState icon="BarChart3" title={tc({en:"No data yet", hi:"अभी तक कोई डेटा नहीं", bn:"এখনও কোনো ডেটা নেই"})}
            body={tc({en:"Load demo data or create shipments, warehouses and trades to see supply-chain KPIs here.", hi:"आपूर्ति श्रृंखला KPI यहां देखने के लिए डेमो डेटा लोड करें या शिपमेंट, गोदाम और व्यापार बनाएं।", bn:"এখানে সরবরাহ শৃঙ্খল KPI দেখতে ডেমো ডেটা লোড করুন বা শিপমেন্ট, গুদাম ও বাণিজ্য তৈরি করুন।"})} />
        ) : (
          <>
            {group(tc({en:"Shipments", hi:"शिपमेंट", bn:"শিপমেন্ট"}), [
              { label: tc({en:"Total", hi:"कुल", bn:"মোট"}), value: ov.shipments.total, icon: "Package", a: "primary" },
              { label: tc({en:"Active", hi:"सक्रिय", bn:"সক্রিয়"}), value: ov.shipments.active, icon: "Navigation", a: "orange" },
              { label: tc({en:"Delivered", hi:"डिलीवर किया गया", bn:"ডেলিভার হয়েছে"}), value: ov.shipments.delivered, icon: "CheckCircle2", a: "primary" },
              { label: tc({en:"Revenue", hi:"राजस्व", bn:"রাজস্ব"}), value: compact(ov.shipments.revenue), icon: "IndianRupee", a: "blue" },
              { label: tc({en:"Total km", hi:"कुल किमी", bn:"মোট কিমি"}), value: ov.shipments.totalKm.toLocaleString("en-IN"), icon: "Route", a: "orange" },
            ])}

            {group(tc({en:"Fleet", hi:"बेड़ा", bn:"ফ্লিট"}), [
              { label: tc({en:"Vehicles", hi:"वाहन", bn:"গাড়ি"}), value: ov.fleet.vehicles, icon: "Truck", a: "blue" },
              { label: tc({en:"Available", hi:"उपलब्ध", bn:"উপলব্ধ"}), value: ov.fleet.available, icon: "Check", a: "primary" },
              { label: tc({en:"On Trip", hi:"यात्रा पर", bn:"যাত্রায়"}), value: ov.fleet.onTrip, icon: "Navigation", a: "orange" },
              { label: tc({en:"Drivers", hi:"चालक", bn:"চালক"}), value: ov.fleet.drivers, icon: "User", a: "primary" },
              { label: tc({en:"Doc Alerts", hi:"दस्तावेज़ अलर्ट", bn:"নথি সতর্কতা"}), value: ov.fleet.docAlerts, icon: "AlertTriangle", a: "red" },
            ])}

            {group(tc({en:"Warehousing", hi:"वेयरहाउसिंग", bn:"গুদামজাতকরণ"}), [
              { label: tc({en:"Facilities", hi:"सुविधाएं", bn:"সুবিধা"}), value: ov.warehouses.facilities, icon: "Warehouse", a: "orange" },
              { label: tc({en:"Cold", hi:"कोल्ड", bn:"কোল্ড"}), value: ov.warehouses.cold, icon: "Snowflake", a: "blue" },
              { label: tc({en:"Utilisation", hi:"उपयोग", bn:"ব্যবহার"}), value: `${ov.warehouses.utilisation}%`, icon: "Gauge", a: "primary" },
              { label: tc({en:"Capacity", hi:"क्षमता", bn:"ক্ষমতা"}), value: `${Math.round(ov.warehouses.capacityKg / 1000).toLocaleString("en-IN")}t`, icon: "Boxes", a: "yellow" },
            ])}

            {group(tc({en:"Trade", hi:"व्यापार", bn:"বাণিজ্য"}), [
              { label: tc({en:"Auctions", hi:"नीलामी", bn:"নিলাম"}), value: ov.trade.auctions, icon: "Gavel", a: "yellow" },
              { label: tc({en:"Live", hi:"लाइव", bn:"লাইভ"}), value: ov.trade.liveAuctions, icon: "Radio", a: "primary" },
              { label: tc({en:"Tenders", hi:"टेंडर", bn:"টেন্ডার"}), value: ov.trade.procurements, icon: "ClipboardList", a: "blue" },
              { label: tc({en:"Open", hi:"खुला", bn:"খোলা"}), value: ov.trade.openProcurements, icon: "Inbox", a: "orange" },
            ])}

            {throughput.length > 0 && (
              <div>
                <SectionHeader title={tc({en:"Delivered throughput by commodity", hi:"वस्तु के अनुसार डिलीवर किया गया थ्रूपुट", bn:"পণ্য অনুযায়ী ডেলিভার্ড থ্রুপুট"})} />
                <Card pad={14}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {throughput.map((t) => (
                      <div key={t.commodity}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: T.ink, fontWeight: 600 }}>{t.commodity}</span>
                          <span style={{ color: T.inkSoft }}>{(t.kg / 1000).toLocaleString("en-IN")} t</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 8, background: T.surface2, overflow: "hidden" }}>
                          <div style={{ width: `${(t.kg / maxKg) * 100}%`, height: "100%", background: T.primary, borderRadius: 8 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: T.surface2,
              borderRadius: T.rMd, padding: "10px 12px" }}>
              <Icon name="Info" size={15} color={T.inkSoft} style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: 1.5 }}>
                {tc({en:"Demand forecasting, price prediction and supply-chain risk detection are AI features planned for the backend phase.", hi:"मांग पूर्वानुमान, मूल्य भविष्यवाणी और आपूर्ति श्रृंखला जोखिम पहचान बैकएंड चरण के लिए योजनाबद्ध AI सुविधाएं हैं।", bn:"চাহিদা পূর্বাভাস, মূল্য পূর্বাভাস এবং সরবরাহ শৃঙ্খল ঝুঁকি সনাক্তকরণ ব্যাকএন্ড পর্যায়ের জন্য পরিকল্পিত AI বৈশিষ্ট্য।"})}
              </span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
