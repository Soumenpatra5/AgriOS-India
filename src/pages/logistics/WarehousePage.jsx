import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Chip, Button, EmptyState } from "../../components/index.js";
import { BottomSheet } from "../../components/overlays.jsx";
import { Input, Dropdown } from "../../components/inputs.jsx";
import { useApp } from "../../store/AppStore.jsx";
import WarehouseCard from "../../components/logistics/WarehouseCard.jsx";
import CapacityBar, { tonnes } from "../../components/logistics/CapacityBar.jsx";
import TelemetryGauge from "../../components/logistics/TelemetryGauge.jsx";
import { warehouseService } from "../../services/logistics/warehouseService.js";
import { storageBookingService } from "../../services/logistics/storageBookingService.js";
import { telemetryService } from "../../services/logistics/telemetryService.js";
import { WAREHOUSE_TYPES, COMMODITIES, PLACES, placeById } from "../../services/logistics/constantsLog.js";
import { rupee } from "../../utils/format.js";

const EMPTY_WH = { name: "", type: "dry", place: "barasat", capacityKg: "", pricePerTonneMonth: "", ownerName: "" };
const EMPTY_BK = { commodity: "Potato", quantityKg: "", months: "1" };

export default function WarehousePage() {
  const { pop, toast, tc } = useApp();
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [mon, setMon] = useState(null);
  const [regOpen, setRegOpen] = useState(false);
  const [wh, setWh] = useState(EMPTY_WH);
  const [bk, setBk] = useState(EMPTY_BK);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  useEffect(() => { warehouseService.getAll().then(setList); }, [tick]);

  const openDetail = async (w) => {
    setDetail(w); setBk(EMPTY_BK);
    setMon(w.cold ? await warehouseService.monitoring(w.id) : null);
  };

  const register = async () => {
    if (!wh.name || !wh.capacityKg) { toast(tc({en:"Enter name and capacity", hi:"नाम और क्षमता दर्ज करें", bn:"নাম এবং ধারণক্ষমতা লিখুন"}), "error"); return; }
    const g = placeById(wh.place);
    await warehouseService.register({
      name: wh.name, type: wh.type, ownerName: wh.ownerName || "Me",
      village: g.name, district: g.name, state: "West Bengal", lat: g.lat, lon: g.lon,
      capacityKg: Number(wh.capacityKg) * 1000, pricePerTonneMonth: wh.pricePerTonneMonth,
    });
    toast(tc({en:"Warehouse registered", hi:"गोदाम पंजीकृत", bn:"গুদাম নিবন্ধিত"}), "success"); setWh(EMPTY_WH); setRegOpen(false); refresh();
  };

  const book = async () => {
    if (!bk.quantityKg) { toast(tc({en:"Enter quantity", hi:"मात्रा दर्ज करें", bn:"পরিমাণ লিখুন"}), "error"); return; }
    try {
      await storageBookingService.create({
        warehouseId: detail.id, commodity: bk.commodity,
        quantityKg: Number(bk.quantityKg) * 1000, months: bk.months,
      });
      toast(tc({en:"Storage booked", hi:"भंडारण बुक किया गया", bn:"স্টোরেজ বুক করা হয়েছে"}), "success");
      const fresh = await warehouseService.getById(detail.id);
      setDetail(fresh); setBk(EMPTY_BK); refresh();
    } catch (e) { toast(e.message, "error"); }
  };

  const simulate = async () => {
    await telemetryService.simulate(detail.id, "temperature", { base: 5, jitter: 2, count: 1 });
    await telemetryService.simulate(detail.id, "humidity", { base: 60, jitter: 6, count: 1 });
    setMon(await warehouseService.monitoring(detail.id));
    toast(tc({en:"Sensors refreshed", hi:"सेंसर रीफ्रेश किए गए", bn:"সেন্সর রিফ্রেশ করা হয়েছে"}), "info");
  };

  const shown = (list || []).filter((w) => filter === "all" ? true : filter === "cold" ? w.cold : w.type === filter);

  return (
    <>
      <AppBar title={tc({en:"Warehousing", hi:"गोदाम", bn:"গুদাম"})} onBack={pop}
        action={<Button size="sm" icon="Plus" onClick={() => setRegOpen(true)}>{tc({en:"List", hi:"सूचीबद्ध करें", bn:"তালিকাভুক্ত করুন"})}</Button>} />
      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 14,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>{tc({en:"All", hi:"सभी", bn:"সব"})}</Chip>
          <Chip active={filter === "cold"} onClick={() => setFilter("cold")} icon="Snowflake">{tc({en:"Cold", hi:"शीत", bn:"ঠান্ডা"})}</Chip>
          {WAREHOUSE_TYPES.map((w) => (
            <Chip key={w.id} active={filter === w.id} onClick={() => setFilter(w.id)} icon={w.icon}>{w.i18n ? tc(w.i18n) : w.label}</Chip>
          ))}
        </div>

        {list === null ? null : shown.length === 0 ? (
          <EmptyState icon="Warehouse" title={tc({en:"No facilities", hi:"कोई सुविधा नहीं", bn:"কোনো সুবিধা নেই"})}
            body={tc({en:"No warehouses in this filter. List your own storage to rent it out.", hi:"इस फ़िल्टर में कोई गोदाम नहीं है। किराए पर देने के लिए अपना स्वयं का भंडारण सूचीबद्ध करें।", bn:"এই ফিল্টারে কোনো গুদাম নেই। ভাড়া দিতে আপনার নিজের স্টোরেজ তালিকাভুক্ত করুন।"})} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shown.map((w) => <WarehouseCard key={w.id} warehouse={w} onClick={() => openDetail(w)} />)}
          </div>
        )}
      </div>

      {/* detail + booking */}
      <BottomSheet open={!!detail} onClose={() => setDetail(null)} title={detail?.name}>
        {detail && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 12.5, color: T.inkSoft }}>
              {detail.village} · {rupee(detail.pricePerTonneMonth)}/tonne·month
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>{tc({en:"Capacity", hi:"क्षमता", bn:"ধারণক্ষমতা"})}</div>
              <CapacityBar used={detail.allocatedKg} total={detail.capacityKg} />
            </div>

            {detail.cold && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>{tc({en:"Cold-chain monitoring", hi:"कोल्ड-चेन निगरानी", bn:"কোল্ড-চেইন পর্যবেক্ষণ"})}</span>
                  <button onClick={simulate} style={{ background: "none", border: "none", cursor: "pointer", color: T.blue, display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                    <Icon name="RefreshCw" size={13} /> {tc({en:"refresh", hi:"रीफ्रेश करें", bn:"রিফ্রেশ করুন"})}
                  </button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <TelemetryGauge kind="temperature" reading={mon?.temperature} breach={mon?.tempBreach} band={detail.tempBand} />
                  <TelemetryGauge kind="humidity" reading={mon?.humidity} breach={mon?.humidityBreach} band={detail.humidityBand} />
                </div>
              </div>
            )}

            <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 10 }}>{tc({en:"Book storage", hi:"भंडारण बुक करें", bn:"স্টোরেজ বুক করুন"})}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Dropdown label={tc({en:"Commodity", hi:"वस्तु", bn:"পণ্য"})} value={bk.commodity} onChange={(v) => setBk({ ...bk, commodity: v })}
                  options={COMMODITIES.map((c) => ({ value: c, label: c }))} />
                <Input label={tc({en:"Quantity (tonnes)", hi:"मात्रा (टन)", bn:"পরিমাণ (টন)"})} value={bk.quantityKg} onChange={(v) => setBk({ ...bk, quantityKg: v })} icon="Scale" type="number" />
                <Input label={tc({en:"Duration (months)", hi:"अवधि (महीने)", bn:"সময়কাল (মাস)"})} value={bk.months} onChange={(v) => setBk({ ...bk, months: v })} icon="Calendar" type="number" />
                <div style={{ fontSize: 12, color: T.inkSoft }}>
                  {tc({en:"Free capacity:", hi:"खाली क्षमता:", bn:"খালি ধারণক্ষমতা:"})} <b style={{ color: T.ink }}>{tonnes(warehouseService.availableKg(detail))} t</b>
                  {bk.quantityKg && Number(bk.months) ? <> · {tc({en:"est.", hi:"अनुमानित", bn:"আনুমানিক"})} <b style={{ color: T.ink }}>{rupee(Number(bk.quantityKg) * detail.pricePerTonneMonth * Number(bk.months))}</b></> : null}
                </div>
                <Button full icon="Check" onClick={book}>{tc({en:"Book storage", hi:"भंडारण बुक करें", bn:"স্টোরেজ বুক করুন"})}</Button>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* register warehouse */}
      <BottomSheet open={regOpen} onClose={() => setRegOpen(false)} title={tc({en:"List Storage Facility", hi:"भंडारण सुविधा सूचीबद्ध करें", bn:"স্টোরেজ সুবিধা তালিকাভুক্ত করুন"})}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({en:"Facility Name", hi:"सुविधा का नाम", bn:"সুবিধার নাম"})} value={wh.name} onChange={(v) => setWh({ ...wh, name: v })} icon="Warehouse" />
          <Dropdown label={tc({en:"Type", hi:"प्रकार", bn:"ধরন"})} value={wh.type} onChange={(v) => setWh({ ...wh, type: v })}
            options={WAREHOUSE_TYPES.map((w) => ({ value: w.id, label: w.i18n ? tc(w.i18n) : w.label }))} />
          <Dropdown label={tc({en:"Location", hi:"स्थान", bn:"অবস্থান"})} value={wh.place} onChange={(v) => setWh({ ...wh, place: v })}
            options={PLACES.map((p) => ({ value: p.id, label: p.i18n ? tc(p.i18n) : p.name }))} />
          <Input label={tc({en:"Capacity (tonnes)", hi:"क्षमता (टन)", bn:"ধারণক্ষমতা (টন)"})} value={wh.capacityKg} onChange={(v) => setWh({ ...wh, capacityKg: v })} icon="Boxes" type="number" />
          <Input label={tc({en:"Price (₹/tonne·month)", hi:"मूल्य (₹/टन·माह)", bn:"মূল্য (₹/টন·মাস)"})} value={wh.pricePerTonneMonth} onChange={(v) => setWh({ ...wh, pricePerTonneMonth: v })} icon="IndianRupee" type="number" />
          <Input label={tc({en:"Owner Name", hi:"मालिक का नाम", bn:"মালিকের নাম"})} value={wh.ownerName} onChange={(v) => setWh({ ...wh, ownerName: v })} icon="User" />
          <Button full icon="Check" onClick={register}>{tc({en:"Register facility", hi:"सुविधा पंजीकृत करें", bn:"সুবিধা নিবন্ধন করুন"})}</Button>
        </div>
      </BottomSheet>
    </>
  );
}
