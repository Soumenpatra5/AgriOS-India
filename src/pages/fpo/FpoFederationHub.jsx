import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, EmptyState } from "../../components/index.js";
import { BottomSheet } from "../../components/overlays.jsx";
import { Input } from "../../components/inputs.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { federationService } from "../../services/fpo/federationService.js";
import { enamOndcService } from "../../services/commerce/enamOndcService.js";
import { rupee } from "../../utils/format.js";

export default function FpoFederationHub() {
  const { pop, toast, tc } = useApp();
  const [tab, setTab] = useState("pools"); // pools | tankers | enam
  const [clusters, setClusters] = useState([]);
  const [pools, setPools] = useState([]);
  const [tankers, setTankers] = useState([]);
  const [enamLots, setEnamLots] = useState([]);
  const [seeding, setSeeding] = useState(false);
  const [tick, setTick] = useState(0);

  // Modals & Forms
  const [contribModal, setContribModal] = useState(false);
  const [selectedPool, setSelectedPool] = useState(null);
  const [contribForm, setContribForm] = useState({
    farmerName: "",
    village: "",
    volume: "",
    fat: "",
    snf: "",
    moisture: "",
  });

  const [pickupModal, setPickupModal] = useState(false);
  const [selectedTanker, setSelectedTanker] = useState(null);
  const [selectedStopIdx, setSelectedStopIdx] = useState(null);
  const [pickupForm, setPickupForm] = useState({ actualVolumeL: "", tempC: "4.2" });

  const [becknModal, setBecknModal] = useState(false);
  const [bidModal, setBidModal] = useState(false);
  const [selectedLot, setSelectedLot] = useState(null);
  const [bidForm, setBidForm] = useState({ buyerName: "", bidPrice: "" });

  const refresh = () => setTick((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [cList, pList, tList, eList] = await Promise.all([
        federationService.getAllClusters(),
        federationService.getPools(),
        federationService.getTankers(),
        enamOndcService.getEnamLots(),
      ]);
      if (!cancelled) {
        setClusters(cList);
        setPools(pList);
        setTankers(tList);
        setEnamLots(eList);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tick]);

  const activeCluster = clusters[0] || null;

  // Actions
  const handleLoadDemo = async () => {
    setSeeding(true);
    await federationService.seedDemoData();
    const cList = await federationService.getAllClusters();
    if (cList[0]) {
      await enamOndcService.seedDemoLots(cList[0].id);
    }
    setSeeding(false);
    toast(tc({
      en: "FPO federation & Mandi e-NAM demo loaded",
      hi: "एफपीओ फेडरेशन और ई-नाम डेमो लोड किया गया",
      bn: "এফপিও ফেডারেশন এবং ই-নাম ডেমো লোড হয়েছে",
    }), "success");
    refresh();
  };

  const handleClearDemo = async () => {
    await federationService.clearDemoData();
    await enamOndcService.clearDemoLots();
    toast(tc({
      en: "Demo data cleared",
      hi: "डेमो डेटा हटाया गया",
      bn: "ডেমো ডেটা মুছে ফেলা হয়েছে",
    }), "info");
    refresh();
  };

  const handleAddContribution = async () => {
    if (!contribForm.farmerName || !contribForm.volume) {
      toast(tc({
        en: "Enter farmer name and quantity",
        hi: "किसान का नाम और मात्रा दर्ज करें",
        bn: "কৃষকের নাম এবং পরিমাণ লিখুন",
      }), "error");
      return;
    }
    try {
      await federationService.addContribution(selectedPool.id, {
        farmerName: contribForm.farmerName,
        village: contribForm.village,
        volume: Number(contribForm.volume),
        fat: contribForm.fat ? Number(contribForm.fat) : undefined,
        snf: contribForm.snf ? Number(contribForm.snf) : undefined,
        moisture: contribForm.moisture ? Number(contribForm.moisture) : undefined,
      });
      toast(tc({
        en: "Contribution recorded in pool",
        hi: "पूल में योगदान दर्ज किया गया",
        bn: "পুলে সংগ্রহ নথিভুক্ত হয়েছে",
      }), "success");
      setContribModal(false);
      setContribForm({ farmerName: "", village: "", volume: "", fat: "", snf: "", moisture: "" });
      refresh();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const handleConfirmPickup = async () => {
    if (!pickupForm.actualVolumeL) {
      toast(tc({
        en: "Enter actual collected volume",
        hi: "वास्तविक एकत्रित मात्रा दर्ज करें",
        bn: "আসল সংগৃহীত পরিমাণ লিখুন",
      }), "error");
      return;
    }
    try {
      await federationService.recordStopPickup(selectedTanker.id, selectedStopIdx, {
        actualVolumeL: Number(pickupForm.actualVolumeL),
        tempC: Number(pickupForm.tempC),
        qualityPassed: true,
      });
      toast(tc({
        en: "Tanker stop pickup confirmed",
        hi: "टैंकर पिकअप की पुष्टि की गई",
        bn: "ট্যাঙ্কার সংগ্রহ নিশ্চিত করা হয়েছে",
      }), "success");
      setPickupModal(false);
      refresh();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const handleSubmitBid = async () => {
    if (!bidForm.buyerName || !bidForm.bidPrice) {
      toast(tc({
        en: "Enter buyer name and bid price",
        hi: "क्रेता का नाम और बोली मूल्य दर्ज करें",
        bn: "ক্রেতার নাম এবং দর লিখুন",
      }), "error");
      return;
    }
    try {
      await enamOndcService.submitBid(selectedLot.id, {
        buyerName: bidForm.buyerName,
        bidPrice: Number(bidForm.bidPrice),
      });
      toast(tc({
        en: "Mandi bid placed successfully",
        hi: "मंडी बोली सफलतापूर्वक लगाई गई",
        bn: "মান্ডি দর সফলভাবে জমা হয়েছে",
      }), "success");
      setBidModal(false);
      setBidForm({ buyerName: "", bidPrice: "" });
      refresh();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const handleAwardLot = async (lot) => {
    try {
      const awarded = await enamOndcService.awardLot(lot.id, {
        buyerName: lot.awardedTo || lot.bids?.[lot.bids.length - 1]?.buyerName || "Winning Buyer",
        finalPrice: lot.pricing?.currentHighestBid,
      });
      toast(tc({
        en: `Lot awarded! Gate pass: ${awarded.gatePassNumber}`,
        hi: `लॉट आवंटित! गेट पास: ${awarded.gatePassNumber}`,
        bn: `লট বরাদ্দ হয়েছে! গেট পাস: ${awarded.gatePassNumber}`,
      }), "success");
      refresh();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const totalPooledMilk = pools
    .filter((p) => p.commodity === "milk")
    .reduce((s, p) => s + (p.totalVolume || 0), 0);

  const totalPooledCrop = pools
    .filter((p) => p.commodity !== "milk")
    .reduce((s, p) => s + (p.totalVolume || 0), 0);

  const hasData = clusters.length > 0 || pools.length > 0 || tankers.length > 0;

  return (
    <>
      <AppBar
        title={tc({
          en: "FPO Federation Hub",
          hi: "एफपीओ फेडरेशन हब",
          bn: "এফপিও সমবায় হাব",
        })}
        onBack={pop}
        action={
          hasData ? (
            <Button size="sm" variant="soft" icon="RefreshCw" onClick={refresh}>
              {tc({ en: "Refresh", hi: "रिफ्रेश", bn: "রিফ্রেশ" })}
            </Button>
          ) : null
        }
      />

      <div style={{ padding: "8px 16px 36px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* FPO Profile Banner */}
        {activeCluster && (
          <Card pad={14} style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(59,130,246,0.08))" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="Users" size={17} color={T.primary} />
                  <span style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{activeCluster.name}</span>
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>
                  {activeCluster.district}, {activeCluster.state} · {tc({ en: "Reg", hi: "पंजीकरण", bn: "নিবন্ধন" })}: {activeCluster.regNumber || "WB-FPO-01"}
                </div>
              </div>
              <span style={{
                background: "rgba(34,197,94,0.18)",
                color: T.primary,
                fontWeight: 700,
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: T.rSm,
              }}>
                {activeCluster.memberCount} {tc({ en: "Farms", hi: "फार्म", bn: "খামার" })}
              </span>
            </div>
          </Card>
        )}

        {/* Top KPI Metrics Bar */}
        {hasData && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            <div style={{ flex: 1, minWidth: 96, background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rMd, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: T.inkSoft }}>{tc({ en: "Milk Pooled", hi: "दूध संकलित", bn: "দুধ সংগৃহীত" })}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginTop: 2 }}>{totalPooledMilk} L</div>
            </div>
            <div style={{ flex: 1, minWidth: 96, background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rMd, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: T.inkSoft }}>{tc({ en: "Crops Pooled", hi: "फसल संकलित", bn: "ফসল সংগৃহীত" })}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginTop: 2 }}>{totalPooledCrop} Q</div>
            </div>
            <div style={{ flex: 1, minWidth: 96, background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rMd, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: T.inkSoft }}>{tc({ en: "Tankers", hi: "टैंकर", bn: "ট্যাঙ্কার" })}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginTop: 2 }}>{tankers.length}</div>
            </div>
            <div style={{ flex: 1, minWidth: 96, background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rMd, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: T.inkSoft }}>{tc({ en: "e-NAM Lots", hi: "ई-नाम लॉट", bn: "ই-নাম লট" })}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginTop: 2 }}>{enamLots.length}</div>
            </div>
          </div>
        )}

        {/* Tab Controls */}
        <div style={{ display: "flex", gap: 6, background: T.surfaceAlt, padding: 4, borderRadius: T.rMd }}>
          {[
            { id: "pools", label: tc({ en: "Yield Pooling", hi: "उत्पादन संकलन", bn: "যৌথ সংগ্রহ" }), icon: "Milk" },
            { id: "tankers", label: tc({ en: "Tanker Routes", hi: "टैंकर रूट", bn: "দুগ্ধ ট্যাঙ্কার" }), icon: "Truck" },
            { id: "enam", label: tc({ en: "Mandi e-NAM & ONDC", hi: "ई-नाम व ओएनडीसी", bn: "ই-নাম ও ONDC" }), icon: "Globe" },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "9px 6px",
                  fontSize: 12.5,
                  fontWeight: active ? 700 : 500,
                  color: active ? T.primary : T.inkSoft,
                  background: active ? T.surface : "transparent",
                  border: "none",
                  borderRadius: T.rSm,
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  cursor: "pointer",
                }}
              >
                <Icon name={t.icon} size={14} color={active ? T.primary : T.inkSoft} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Empty state when no data */}
        {!hasData ? (
          <EmptyState
            icon="Users"
            title={tc({
              en: "FPO Cooperative Federation Hub",
              hi: "एफपीओ सहकारी फेडरेशन हब",
              bn: "এফপিও সমবায় ফেডারেশন হাব",
            })}
            body={tc({
              en: "Pool daily milk and harvest yields across multiple member farm spaces, schedule shared insulated tankers, and dispatch bulk trade lots directly to Mandi e-NAM and ONDC buyers.",
              hi: "कई सदस्य फार्मों से दैनिक दूध और फसल संकलित करें, साझा इंसुलेटेड टैंकर शेड्यूल करें, और ई-नाम तथा ओएनडीसी क्रेताओं को सीधे थोक लॉट भेजें।",
              bn: "একাধিক সদস্য খামারের দুধ ও ফসল একসাথে যৌথ পুলে সংগ্রহ করুন, কোল্ড-চেইন দুগ্ধ ট্যাঙ্কার শিডিউল করুন এবং সরাসরি মান্ডি ই-নাম ও ONDC ক্রেতাদের জন্য বাল্ক লট বরাদ্দ করুন।",
            })}
            action={seeding ? tc({ en: "Loading…", hi: "लोड हो रहा…", bn: "লোড হচ্ছে…" }) : tc({ en: "Load FPO Demo", hi: "एफपीओ डेमो लोड करें", bn: "এফপিও ডেমো লোড করুন" })}
            onAction={seeding ? undefined : handleLoadDemo}
          />
        ) : (
          <>
            {/* TAB 1: YIELD POOLING */}
            {tab === "pools" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pools.map((p) => {
                  const target = p.targetVolume || 1;
                  const pct = Math.min(100, Math.round(((p.totalVolume || 0) / target) * 100));
                  return (
                    <Card key={p.id} pad={14}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>
                            {p.commodity === "milk"
                              ? tc({ en: "Daily Bulk Milk Pool", hi: "दैनिक थोक दूध पूल", bn: "দৈনিক যৌথ দুধ সংগ্রহ" })
                              : `${p.commodity.toUpperCase()} ${tc({ en: "Harvest Pool", hi: "फसल पूल", bn: "ফসল পুল" })}`}
                          </div>
                          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                            {tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })}: {p.date} · {p.contributions?.length || 0} {tc({ en: "farms contributing", hi: "फार्मों का योगदान", bn: "খামারের অবদান" })}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: T.rSm,
                          background: p.status === "collecting" ? "rgba(59,130,246,0.12)" : "rgba(34,197,94,0.15)",
                          color: p.status === "collecting" ? "#2563eb" : T.primary,
                        }}>
                          {p.status}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: T.ink }}>
                          <span>{p.totalVolume} {p.unit}</span>
                          <span style={{ color: T.inkSoft }}>{tc({ en: "Target", hi: "लक्ष्य", bn: "লক্ষ্য" })}: {p.targetVolume} {p.unit} ({pct}%)</span>
                        </div>
                        <div style={{ width: "100%", height: 7, background: T.line, borderRadius: 4, marginTop: 4, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: T.primary, transition: "width .3s ease" }} />
                        </div>
                      </div>

                      {/* Quality parameters */}
                      <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 12, color: T.inkSoft }}>
                        {p.avgFat !== null && (
                          <div>
                            <span style={{ fontWeight: 700, color: T.ink }}>{p.avgFat}%</span> {tc({ en: "Avg FAT", hi: "औसत फैट", bn: "গড় ফ্যাট" })}
                          </div>
                        )}
                        {p.avgSnf !== null && (
                          <div>
                            <span style={{ fontWeight: 700, color: T.ink }}>{p.avgSnf}%</span> {tc({ en: "Avg SNF", hi: "औसत एसएनएफ", bn: "গড় এসএনএফ" })}
                          </div>
                        )}
                        {p.avgMoisture !== null && (
                          <div>
                            <span style={{ fontWeight: 700, color: T.ink }}>{p.avgMoisture}%</span> {tc({ en: "Avg Moisture", hi: "औसत नमी", bn: "গড় আর্দ্রতা" })}
                          </div>
                        )}
                      </div>

                      {/* Member list breakdown */}
                      {p.contributions?.length > 0 && (
                        <div style={{ marginTop: 12, borderTop: `1px solid ${T.line}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                          {p.contributions.map((c) => (
                            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                              <span style={{ color: T.ink }}>
                                <strong>{c.farmerName}</strong> {c.village ? `(${c.village})` : ""}
                              </span>
                              <span style={{ color: T.inkSoft }}>
                                {c.volume} {c.unit} {c.fat ? `· ${c.fat}% FAT` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ marginTop: 12 }}>
                        <Button
                          size="sm"
                          variant="soft"
                          icon="Plus"
                          full
                          onClick={() => {
                            setSelectedPool(p);
                            setContribModal(true);
                          }}
                        >
                          {tc({ en: "Add Farm Contribution", hi: "फार्म योगदान जोड़ें", bn: "খামারের সংগ্রহ যোগ করুন" })}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* TAB 2: TANKER ROUTES & LOGISTICS */}
            {tab === "tankers" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {tankers.map((t) => {
                  const cap = t.capacityL || 5000;
                  const pct = Math.min(100, Math.round(((t.collectedVolume || 0) / cap) * 100));
                  return (
                    <Card key={t.id} pad={14}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Icon name="Truck" size={16} color={T.primary} />
                            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{t.tankerNumber}</span>
                          </div>
                          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                            {tc({ en: "Driver", hi: "चालक", bn: "চালক" })}: {t.driverName} ({t.driverPhone})
                          </div>
                        </div>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: T.rSm,
                          background: t.status === "completed" ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
                          color: t.status === "completed" ? T.primary : "#ca8a04",
                        }}>
                          {t.status}
                        </span>
                      </div>

                      {/* Capacity and Temp */}
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                        <span>
                          {tc({ en: "Collected", hi: "एकत्रित", bn: "সংগৃহীত" })}: <strong>{t.collectedVolume} L</strong> / {cap} L ({pct}%)
                        </span>
                        <span style={{ color: "#2563eb", fontWeight: 700, background: "rgba(37,99,235,0.08)", padding: "2px 6px", borderRadius: 4 }}>
                          ❄ {t.temperatureC}°C {tc({ en: "Chilled", hi: "शीत", bn: "শীতল" })}
                        </span>
                      </div>

                      <div style={{ width: "100%", height: 6, background: T.line, borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "#2563eb", transition: "width .3s ease" }} />
                      </div>

                      {/* Route Stops */}
                      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>
                          {tc({ en: "Route Stop Checkpoints", hi: "रूट स्टॉप चेकपॉइंट", bn: "রুট স্টপ চেকপয়েন্ট" })}
                        </div>
                        {t.stops?.map((s, idx) => (
                          <div key={idx} style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "6px 8px",
                            background: s.status === "collected" ? "rgba(34,197,94,0.05)" : T.surfaceAlt,
                            borderRadius: T.rSm,
                            fontSize: 12,
                          }}>
                            <div>
                              <div style={{ fontWeight: 600, color: T.ink }}>{s.farmName} ({s.village})</div>
                              <div style={{ fontSize: 11, color: T.inkSoft }}>
                                {tc({ en: "Expected", hi: "अपेक्षित", bn: "প্রত্যাশিত" })}: {s.expectedVolumeL} L
                                {s.status === "collected" && ` · ${tc({ en: "Picked up", hi: "उठाया", bn: "নেওয়া হয়েছে" })}: ${s.actualVolumeL} L (${s.tempC}°C)`}
                              </div>
                            </div>
                            {s.status === "collected" ? (
                              <span style={{ color: T.primary, fontWeight: 700, fontSize: 11 }}>✓ {tc({ en: "Done", hi: "पूर्ण", bn: "সম্পন্ন" })}</span>
                            ) : (
                              <Button
                                size="sm"
                                variant="soft"
                                onClick={() => {
                                  setSelectedTanker(t);
                                  setSelectedStopIdx(idx);
                                  setPickupForm({ actualVolumeL: String(s.expectedVolumeL), tempC: "4.2" });
                                  setPickupModal(true);
                                }}
                              >
                                {tc({ en: "Pickup", hi: "पिकअप", bn: "পিকআপ" })}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* TAB 3: MANDI E-NAM & ONDC COMMERCE */}
            {tab === "enam" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
                    {tc({ en: "e-NAM APMC & ONDC Catalog Lots", hi: "ई-नाम एपीएमसी एवं ओएनडीसी लॉट", bn: "ই-নাম APMC ও ONDC ক্যাটালগ লট" })}
                  </div>
                  <Button
                    size="sm"
                    variant="soft"
                    icon="FileCode"
                    onClick={() => setBecknModal(true)}
                  >
                    {tc({ en: "ONDC Beckn JSON", hi: "ओएनडीसी बेकन JSON", bn: "ONDC বেকন JSON" })}
                  </Button>
                </div>

                {enamLots.map((l) => (
                  <Card key={l.id} pad={14}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>
                          {l.commodity?.name} · {l.commodity?.variety}
                        </div>
                        <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                          {l.apmcMandi?.name} ({l.enamLotId})
                        </div>
                      </div>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: T.rSm,
                        background: l.status === "awarded" ? "rgba(34,197,94,0.15)" : "rgba(59,130,246,0.12)",
                        color: l.status === "awarded" ? T.primary : "#2563eb",
                      }}>
                        {l.status}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10, fontSize: 12 }}>
                      <div style={{ background: T.surfaceAlt, padding: "6px 8px", borderRadius: 4 }}>
                        <div style={{ color: T.inkSoft }}>{tc({ en: "Lot Quantity", hi: "लॉट मात्रा", bn: "লট পরিমাণ" })}</div>
                        <div style={{ fontWeight: 700, color: T.ink, marginTop: 2 }}>
                          {l.metrics?.quantity} {l.metrics?.unit}
                        </div>
                      </div>
                      <div style={{ background: T.surfaceAlt, padding: "6px 8px", borderRadius: 4 }}>
                        <div style={{ color: T.inkSoft }}>{tc({ en: "MSP / Base Price", hi: "एमएसपी / आधार मूल्य", bn: "MSP / ন্যূনতম দর" })}</div>
                        <div style={{ fontWeight: 700, color: T.ink, marginTop: 2 }}>
                          {rupee(l.pricing?.reservePricePerUnit)} / {l.metrics?.unit}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                      <span>
                        {tc({ en: "Current Highest Bid", hi: "वर्तमान उच्चतम बोली", bn: "বর্তমান সর্বোচ্চ দর" })}:{" "}
                        <strong style={{ color: T.primary, fontSize: 14 }}>{rupee(l.pricing?.currentHighestBid)}</strong>
                      </span>
                      {l.commodity?.grade && (
                        <span style={{ fontSize: 11, color: T.inkSoft }}>{l.commodity.grade}</span>
                      )}
                    </div>

                    {l.awardedTo && (
                      <div style={{
                        marginTop: 10,
                        padding: "6px 8px",
                        background: "rgba(34,197,94,0.08)",
                        borderRadius: 4,
                        fontSize: 12,
                        color: T.primary,
                        fontWeight: 600,
                      }}>
                        ✓ {tc({ en: "Awarded to", hi: "आवंटित", bn: "বরাদ্দকৃত" })}: {l.awardedTo} ({tc({ en: "Gate Pass", hi: "गेट पास", bn: "গেট পাস" })}: {l.gatePassNumber})
                      </div>
                    )}

                    {l.status !== "awarded" && (
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <Button
                          size="sm"
                          variant="soft"
                          style={{ flex: 1 }}
                          icon="TrendingUp"
                          onClick={() => {
                            setSelectedLot(l);
                            setBidForm({
                              buyerName: "",
                              bidPrice: String(Number(l.pricing?.currentHighestBid || l.pricing?.reservePricePerUnit) + 50),
                            });
                            setBidModal(true);
                          }}
                        >
                          {tc({ en: "Place Bid", hi: "बोली लगाएं", bn: "দর দিন" })}
                        </Button>
                        <Button
                          size="sm"
                          style={{ flex: 1 }}
                          icon="Check"
                          onClick={() => handleAwardLot(l)}
                        >
                          {tc({ en: "Award Lot", hi: "लॉट आवंटित करें", bn: "লট বরাদ্দ করুন" })}
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Clear Demo Button */}
            <div style={{ marginTop: 14 }}>
              <Button variant="soft" full icon="Trash2" onClick={handleClearDemo}>
                {tc({ en: "Clear Demo Data", hi: "डेमो डेटा हटाएं", bn: "ডেমো ডেটা মুছুন" })}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* MODAL 1: ADD CONTRIBUTION */}
      {contribModal && (
        <BottomSheet
          title={tc({ en: "Record Farm Contribution", hi: "फार्म योगदान दर्ज करें", bn: "খামারের সংগ্রহ নথিভুক্ত করুন" })}
          onClose={() => setContribModal(false)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              label={tc({ en: "Farmer Name", hi: "किसान का नाम", bn: "কৃষকের নাম" })}
              value={contribForm.farmerName}
              onChange={(v) => setContribForm({ ...contribForm, farmerName: v })}
              placeholder="e.g. Ramesh Ghosh"
            />
            <Input
              label={tc({ en: "Village / Location", hi: "गाँव / स्थान", bn: "গ্রাম / স্থান" })}
              value={contribForm.village}
              onChange={(v) => setContribForm({ ...contribForm, village: v })}
              placeholder="e.g. Hanskhali"
            />
            <Input
              label={`${tc({ en: "Quantity", hi: "मात्रा", bn: "পরিমাণ" })} (${selectedPool?.unit || "L"})`}
              type="number"
              value={contribForm.volume}
              onChange={(v) => setContribForm({ ...contribForm, volume: v })}
              placeholder="0"
            />
            {selectedPool?.commodity === "milk" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Input
                  label={`${tc({ en: "FAT", hi: "फैट", bn: "ফ্যাট" })} %`}
                  type="number"
                  value={contribForm.fat}
                  onChange={(v) => setContribForm({ ...contribForm, fat: v })}
                  placeholder="4.5"
                />
                <Input
                  label={`${tc({ en: "SNF", hi: "एसएनएफ", bn: "এসএনএফ" })} %`}
                  type="number"
                  value={contribForm.snf}
                  onChange={(v) => setContribForm({ ...contribForm, snf: v })}
                  placeholder="8.8"
                />
              </div>
            ) : (
              <Input
                label={`${tc({ en: "Moisture", hi: "नमी", bn: "আর্দ্রতা" })} %`}
                type="number"
                value={contribForm.moisture}
                onChange={(v) => setContribForm({ ...contribForm, moisture: v })}
                placeholder="13.0"
              />
            )}
            <Button full onClick={handleAddContribution}>
              {tc({ en: "Save to Pool", hi: "पूल में सहेजें", bn: "পুলে জমা দিন" })}
            </Button>
          </div>
        </BottomSheet>
      )}

      {/* MODAL 2: TANKER STOP PICKUP */}
      {pickupModal && (
        <BottomSheet
          title={tc({ en: "Confirm Tanker Route Pickup", hi: "टैंकर पिकअप की पुष्टि करें", bn: "ট্যাঙ্কার সংগ্রহ নিশ্চিত করুন" })}
          onClose={() => setPickupModal(false)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              label={`${tc({ en: "Actual Volume Picked Up", hi: "वास्तविक एकत्रित मात्रा", bn: "আসল সংগৃহীত পরিমাণ" })} (L)`}
              type="number"
              value={pickupForm.actualVolumeL}
              onChange={(v) => setPickupForm({ ...pickupForm, actualVolumeL: v })}
            />
            <Input
              label={`${tc({ en: "Chilled Temperature", hi: "शीत तापमान", bn: "শীতল তাপমাত্রা" })} (°C)`}
              type="number"
              value={pickupForm.tempC}
              onChange={(v) => setPickupForm({ ...pickupForm, tempC: v })}
            />
            <Button full onClick={handleConfirmPickup}>
              {tc({ en: "Confirm & Update Route", hi: "पुष्टि करें और रूट अपडेट करें", bn: "নিশ্চিত করে রুট আপডেট করুন" })}
            </Button>
          </div>
        </BottomSheet>
      )}

      {/* MODAL 3: PLACE BID */}
      {bidModal && (
        <BottomSheet
          title={tc({ en: "Simulate Mandi Trader Bid", hi: "मंडी व्यापारी बोली दर्ज करें", bn: "মান্ডি ব্যবসায়ী দর জমা দিন" })}
          onClose={() => setBidModal(false)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              label={tc({ en: "Trader / Institutional Buyer Name", hi: "क्रेता का नाम", bn: "ক্রেতার নাম" })}
              value={bidForm.buyerName}
              onChange={(v) => setBidForm({ ...bidForm, buyerName: v })}
              placeholder="e.g. ITC Agri / Amul / Local Miller"
            />
            <Input
              label={`${tc({ en: "Bid Price", hi: "बोली मूल्य", bn: "দর" })} (₹ / ${selectedLot?.metrics?.unit})`}
              type="number"
              value={bidForm.bidPrice}
              onChange={(v) => setBidForm({ ...bidForm, bidPrice: v })}
            />
            <Button full onClick={handleSubmitBid}>
              {tc({ en: "Submit Bid", hi: "बोली जमा करें", bn: "দর জমা দিন" })}
            </Button>
          </div>
        </BottomSheet>
      )}

      {/* MODAL 4: ONDC BECKN JSON PREVIEW */}
      {becknModal && (
        <BottomSheet
          title="ONDC Beckn Protocol v1.2.0"
          onClose={() => setBecknModal(false)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: T.inkSoft }}>
              {tc({
                en: "Generated Beckn schema compliant with ONDC open agriculture discovery standard:",
                hi: "ओएनडीसी ओपन कृषि खोज मानक के अनुरूप तैयार बेकन स्कीमा:",
                bn: "ONDC ওপেন এগ্রিকালচার স্ট্যান্ডার্ড অনুযায়ী তৈরি বেকন স্কিমা:",
              })}
            </div>
            <pre style={{
              background: T.surfaceAlt,
              padding: 10,
              borderRadius: T.rSm,
              fontSize: 11,
              maxHeight: 280,
              overflowY: "auto",
              fontFamily: "monospace",
            }}>
              {JSON.stringify(
                enamOndcService.generateBecknCatalog(activeCluster || { name: "AgriOS FPO" }, enamLots),
                null,
                2
              )}
            </pre>
            <Button
              variant="soft"
              full
              icon="Copy"
              onClick={() => {
                const text = JSON.stringify(
                  enamOndcService.generateBecknCatalog(activeCluster || { name: "AgriOS FPO" }, enamLots),
                  null,
                  2
                );
                navigator.clipboard?.writeText(text);
                toast(tc({ en: "Copied to clipboard", hi: "क्लिपबोर्ड पर कॉपी किया", bn: "ক্লিপবোর্ডে কপি হয়েছে" }), "success");
              }}
            >
              {tc({ en: "Copy Beckn JSON", hi: "JSON कॉपी करें", bn: "JSON কপি করুন" })}
            </Button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
