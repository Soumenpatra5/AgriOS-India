import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, Button, EmptyState, IconTile } from "../../components/index.js";
import { BottomSheet, Dialog } from "../../components/overlays.jsx";
import { Input, Dropdown } from "../../components/inputs.jsx";
import { useApp } from "../../store/AppStore.jsx";
import StatTile from "../../components/erp/StatTile.jsx";
import { EmptyHint } from "../../components/erp/RecordList.jsx";
import VehicleCard from "../../components/logistics/VehicleCard.jsx";
import DriverCard from "../../components/logistics/DriverCard.jsx";
import ShipmentCard from "../../components/logistics/ShipmentCard.jsx";
import { transportService } from "../../services/logistics/transportService.js";
import { fleetService } from "../../services/logistics/fleetService.js";
import { driverService } from "../../services/logistics/driverService.js";
import { shipmentService } from "../../services/logistics/shipmentService.js";
import { PROVIDER_TYPES, VEHICLE_CATEGORIES, SHIPMENT_STATUS } from "../../services/logistics/constantsLog.js";
import { rupee, compact } from "../../utils/format.js";

const EMPTY_VEH = { category: "truck", regNumber: "", model: "", insuranceExpiry: "", fitnessExpiry: "", permitExpiry: "" };
const EMPTY_DRV = { name: "", phone: "", licenseNumber: "", licenseExpiry: "", languages: "" };

export default function FleetDashboard() {
  const { pop, push, toast, tc } = useApp();
  const [provider, setProvider] = useState(undefined);
  const [tab, setTab] = useState("vehicles");
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [mine, setMine] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, delivered: 0, earnings: 0 });
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  // registration
  const [reg, setReg] = useState({ name: "", type: "fleet", tagline: "", village: "", district: "", phone: "" });
  const [regOpen, setRegOpen] = useState(false);

  // vehicle / driver / assign sheets
  const [vehForm, setVehForm] = useState(EMPTY_VEH);
  const [vehOpen, setVehOpen] = useState(false);
  const [delVeh, setDelVeh] = useState(null);
  const [drvForm, setDrvForm] = useState(EMPTY_DRV);
  const [drvOpen, setDrvOpen] = useState(false);
  const [assignFor, setAssignFor] = useState(null);
  const [assignSel, setAssignSel] = useState({ vehicleId: "", driverId: "" });

  useEffect(() => {
    transportService.getMine().then((p) => {
      setProvider(p || null);
      if (!p) return;
      fleetService.byProvider(p.id).then(setVehicles);
      driverService.byProvider(p.id).then(setDrivers);
      shipmentService.unassigned().then(setJobs);
      shipmentService.byProvider(p.id).then(setMine);
      shipmentService.providerSummary(p.id).then(setSummary);
    });
  }, [tick]);

  const doRegister = async () => {
    if (!reg.name) { toast(tc({en:"Enter a business name", hi:"व्यवसाय का नाम दर्ज करें", bn:"ব্যবসার নাম লিখুন"}), "error"); return; }
    await transportService.register(reg);
    toast(tc({en:"Transport profile created!", hi:"परिवहन प्रोफ़ाइल बनाई गई!", bn:"পরিবহন প্রোফাইল তৈরি হয়েছে!"}), "success"); refresh();
  };

  const addVehicle = async () => {
    if (!vehForm.regNumber) { toast(tc({en:"Enter registration number", hi:"पंजीकरण संख्या दर्ज करें", bn:"রেজিস্ট্রেশন নম্বর লিখুন"}), "error"); return; }
    await fleetService.register({
      providerId: provider.id, providerName: provider.name,
      category: vehForm.category, regNumber: vehForm.regNumber, model: vehForm.model,
      documents: { insuranceExpiry: vehForm.insuranceExpiry, fitnessExpiry: vehForm.fitnessExpiry, permitExpiry: vehForm.permitExpiry },
    });
    toast(tc({en:"Vehicle added", hi:"वाहन जोड़ा गया", bn:"গাড়ি যোগ করা হয়েছে"}), "success"); setVehForm(EMPTY_VEH); setVehOpen(false); refresh();
  };

  const addDriver = async () => {
    if (!drvForm.name) { toast(tc({en:"Enter driver name", hi:"चालक का नाम दर्ज करें", bn:"চালকের নাম লিখুন"}), "error"); return; }
    await driverService.register({
      providerId: provider.id, providerName: provider.name,
      name: drvForm.name, phone: drvForm.phone, licenseNumber: drvForm.licenseNumber,
      licenseExpiry: drvForm.licenseExpiry,
      languages: drvForm.languages ? drvForm.languages.split(",").map((s) => s.trim()).filter(Boolean) : [],
    });
    toast(tc({en:"Driver added", hi:"चालक जोड़ा गया", bn:"চালক যোগ করা হয়েছে"}), "success"); setDrvForm(EMPTY_DRV); setDrvOpen(false); refresh();
  };

  const doAssign = async () => {
    if (!assignSel.vehicleId || !assignSel.driverId) { toast(tc({en:"Pick a vehicle and driver", hi:"वाहन और चालक चुनें", bn:"গাড়ি ও চালক নির্বাচন করুন"}), "error"); return; }
    try {
      await shipmentService.assign(assignFor.id, { providerId: provider.id, ...assignSel });
      toast(tc({en:"Shipment assigned", hi:"शिपमेंट सौंपी गई", bn:"শিপমেন্ট বরাদ্দ হয়েছে"}), "success");
    } catch (e) { toast(e.message, "error"); }
    setAssignFor(null); setAssignSel({ vehicleId: "", driverId: "" }); refresh();
  };

  const advanceJob = async (s) => {
    const next = shipmentService.nextStatus(s.status);
    if (!next) return;
    if (next === "delivered") { await shipmentService.confirmDelivery(s.id, { receivedBy: "Recipient" }); }
    else await shipmentService.setStatus(s.id, next);
    toast(`${tc({en:"Marked", hi:"चिह्नित किया गया", bn:"চিহ্নিত হয়েছে"})} ${SHIPMENT_STATUS[next]?.label}`, "success"); refresh();
  };

  // ---- onboarding ----
  if (provider === undefined) return <><AppBar title={tc({en:"Fleet & Drivers", hi:"बेड़ा और चालक", bn:"ফ্লিট ও চালক"})} onBack={pop} /></>;
  if (provider === null) {
    return (
      <>
        <AppBar title={tc({en:"Fleet & Drivers", hi:"बेड़ा और चालक", bn:"ফ্লিট ও চালক"})} onBack={pop} />
        <div style={{ padding: "8px 16px 32px", animation: "ag-fade .25s var(--ag-ease)" }}>
          <Card pad={18} style={{ textAlign: "center" }}>
            <IconTile name="Truck" a="blue" size={56} iconSize={28} style={{ margin: "0 auto" }} />
            <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, marginTop: 12 }}>{tc({en:"Become a Transport Provider", hi:"परिवहन प्रदाता बनें", bn:"পরিবহন প্রদানকারী হন"})}</div>
            <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6, lineHeight: 1.5 }}>
              {tc({en:"Register your fleet, add drivers, accept shipment jobs from farmers and buyers, and track deliveries.", hi:"अपना बेड़ा पंजीकृत करें, चालक जोड़ें, किसानों और खरीदारों से शिपमेंट जॉब स्वीकार करें, और डिलीवरी ट्रैक करें।", bn:"আপনার ফ্লিট নিবন্ধন করুন, চালক যোগ করুন, কৃষক ও ক্রেতাদের কাছ থেকে শিপমেন্ট জব গ্রহণ করুন এবং ডেলিভারি ট্র্যাক করুন।"})}
            </div>
          </Card>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {[
              ["Truck", tc({en:"Register your fleet", hi:"अपना बेड़ा पंजीकृत करें", bn:"আপনার ফ্লিট নিবন্ধন করুন"}), tc({en:"Add vehicles with documents & capacity", hi:"दस्तावेज़ों और क्षमता के साथ वाहन जोड़ें", bn:"নথি ও ক্ষমতাসহ গাড়ি যোগ করুন"})],
              ["User", tc({en:"Manage drivers", hi:"चालकों का प्रबंधन करें", bn:"চালক পরিচালনা করুন"}), tc({en:"License & identity verification, ratings", hi:"लाइसेंस और पहचान सत्यापन, रेटिंग", bn:"লাইসেন্স ও পরিচয় যাচাই, রেটিং"})],
              ["Package", tc({en:"Accept jobs", hi:"जॉब स्वीकार करें", bn:"জব গ্রহণ করুন"}), tc({en:"Assign vehicles and track to delivery", hi:"वाहन सौंपें और डिलीवरी तक ट्रैक करें", bn:"গাড়ি বরাদ্দ করুন এবং ডেলিভারি পর্যন্ত ট্র্যাক করুন"})],
            ].map(([icon, title, desc]) => (
              <Card key={title} pad={13}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <IconTile name={icon} a="primary" size={38} iconSize={19} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{title}</div>
                    <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 1 }}>{desc}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Button full icon="Plus" onClick={() => setRegOpen(true)} style={{ marginTop: 16 }}>{tc({en:"Create Transport Profile", hi:"परिवहन प्रोफ़ाइल बनाएं", bn:"পরিবহন প্রোফাইল তৈরি করুন"})}</Button>
        </div>

        <BottomSheet open={regOpen} onClose={() => setRegOpen(false)} title={tc({en:"Transport Registration", hi:"परिवहन पंजीकरण", bn:"পরিবহন নিবন্ধন"})}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label={tc({en:"Business Name", hi:"व्यवसाय का नाम", bn:"ব্যবসার নাম"})} value={reg.name} onChange={(v) => setReg({ ...reg, name: v })} icon="Truck" />
            <Dropdown label={tc({en:"Provider Type", hi:"प्रदाता प्रकार", bn:"প্রদানকারীর ধরন"})} value={reg.type} onChange={(v) => setReg({ ...reg, type: v })}
              options={PROVIDER_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
            <Input label={tc({en:"Tagline", hi:"टैगलाइन", bn:"ট্যাগলাইন"})} value={reg.tagline} onChange={(v) => setReg({ ...reg, tagline: v })} icon="FileText" placeholder={tc({en:"Short description…", hi:"संक्षिप्त विवरण…", bn:"সংক্ষিপ্ত বিবরণ…"})} />
            <Input label={tc({en:"Village", hi:"गांव", bn:"গ্রাম"})} value={reg.village} onChange={(v) => setReg({ ...reg, village: v })} icon="MapPin" />
            <Input label={tc({en:"District", hi:"जिला", bn:"জেলা"})} value={reg.district} onChange={(v) => setReg({ ...reg, district: v })} icon="Map" />
            <Input label={tc({en:"Phone", hi:"फोन", bn:"ফোন"})} value={reg.phone} onChange={(v) => setReg({ ...reg, phone: v })} icon="Phone" />
            <Button full icon="Check" onClick={doRegister}>{tc({en:"Register", hi:"पंजीकरण करें", bn:"নিবন্ধন করুন"})}</Button>
          </div>
        </BottomSheet>
      </>
    );
  }

  // ---- dashboard ----
  const TABS = [
    { id: "vehicles", label: tc({en:"Vehicles", hi:"वाहन", bn:"গাড়ি"}) },
    { id: "drivers", label: tc({en:"Drivers", hi:"चालक", bn:"চালক"}) },
    { id: "jobs", label: tc({en:"Jobs", hi:"जॉब", bn:"জব"}) },
  ];

  return (
    <>
      <AppBar title={provider.name} onBack={pop} />
      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 14,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          <StatTile label={tc({en:"Vehicles", hi:"वाहन", bn:"গাড়ি"})} value={vehicles.length} icon="Truck" a="blue" />
          <StatTile label={tc({en:"Drivers", hi:"चालक", bn:"চালক"})} value={drivers.length} icon="User" a="primary" />
          <StatTile label={tc({en:"Active Jobs", hi:"सक्रिय जॉब", bn:"সক্রিয় জব"})} value={summary.active} icon="Navigation" a="orange" />
          <StatTile label={tc({en:"Earnings", hi:"कमाई", bn:"আয়"})} value={compact(summary.earnings)} icon="IndianRupee" a="primary" />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {TABS.map((tb) => (
            <Chip key={tb.id} active={tab === tb.id} onClick={() => setTab(tb.id)}>{tb.label}</Chip>
          ))}
        </div>

        {tab === "vehicles" && (
          <>
            <Button variant="soft" full icon="Plus" onClick={() => setVehOpen(true)}>{tc({en:"Add Vehicle", hi:"वाहन जोड़ें", bn:"গাড়ি যোগ করুন"})}</Button>
            {vehicles.length === 0 ? <EmptyHint icon="Truck" text={tc({en:"No vehicles yet.", hi:"अभी तक कोई वाहन नहीं।", bn:"এখনও কোনো গাড়ি নেই।"})} /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} onDelete={() => setDelVeh(v)} />)}
              </div>
            )}
          </>
        )}

        {tab === "drivers" && (
          <>
            <Button variant="soft" full icon="Plus" onClick={() => setDrvOpen(true)}>{tc({en:"Add Driver", hi:"चालक जोड़ें", bn:"চালক যোগ করুন"})}</Button>
            {drivers.length === 0 ? <EmptyHint icon="User" text={tc({en:"No drivers yet.", hi:"अभी तक कोई चालक नहीं।", bn:"এখনও কোনো চালক নেই।"})} /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {drivers.map((d) => (
                  <div key={d.id}>
                    <DriverCard driver={d} />
                    {!(d.licenseVerified && d.identityVerified) && (
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        {!d.licenseVerified && (
                          <Button size="sm" variant="outline" icon="ShieldCheck"
                            onClick={async () => { await driverService.verify(d.id, "license"); toast(tc({en:"License verified", hi:"लाइसेंस सत्यापित", bn:"লাইসেন্স যাচাইকৃত"}), "success"); refresh(); }}>{tc({en:"License", hi:"लाइसेंस", bn:"লাইসেন্স"})}</Button>
                        )}
                        {!d.identityVerified && (
                          <Button size="sm" variant="outline" icon="UserCheck"
                            onClick={async () => { await driverService.verify(d.id, "identity"); toast(tc({en:"Identity verified", hi:"पहचान सत्यापित", bn:"পরিচয় যাচাইকৃত"}), "success"); refresh(); }}>{tc({en:"Identity", hi:"पहचान", bn:"পরিচয়"})}</Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "jobs" && (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft }}>{tc({en:"Open jobs (unassigned)", hi:"खुले जॉब (असौंपे गए)", bn:"খোলা জব (অ-বরাদ্দকৃত)"})}</div>
            {jobs.length === 0 ? <EmptyHint icon="Inbox" text={tc({en:"No open jobs right now.", hi:"अभी कोई खुला जॉब नहीं है।", bn:"এখন কোনো খোলা জব নেই।"})} /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {jobs.map((s) => (
                  <div key={s.id}>
                    <ShipmentCard shipment={s} onClick={() => push({ kind: "logShipmentDetail", props: { shipmentId: s.id } })} />
                    <Button size="sm" variant="soft" icon="Check" onClick={() => { setAssignFor(s); setAssignSel({ vehicleId: "", driverId: "" }); }}
                      style={{ marginTop: 6 }}>{tc({en:"Accept & assign", hi:"स्वीकार करें और सौंपें", bn:"গ্রহণ করুন ও বরাদ্দ করুন"})}</Button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, marginTop: 6 }}>{tc({en:"My shipments", hi:"मेरी शिपमेंट", bn:"আমার শিপমেন্ট"})}</div>
            {mine.length === 0 ? <EmptyHint icon="Package" text={tc({en:"No assigned shipments.", hi:"कोई सौंपी गई शिपमेंट नहीं।", bn:"কোনো বরাদ্দকৃত শিপমেন্ট নেই।"})} /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {mine.map((s) => (
                  <div key={s.id}>
                    <ShipmentCard shipment={s} onClick={() => push({ kind: "logShipmentDetail", props: { shipmentId: s.id } })} />
                    {shipmentService.nextStatus(s.status) && (
                      <Button size="sm" variant="outline" icon="ArrowRight" onClick={() => advanceJob(s)} style={{ marginTop: 6 }}>
                        {tc({en:"Mark", hi:"चिह्नित करें", bn:"চিহ্নিত করুন"})} {SHIPMENT_STATUS[shipmentService.nextStatus(s.status)]?.label}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* add vehicle */}
      <BottomSheet open={vehOpen} onClose={() => setVehOpen(false)} title={tc({en:"Add Vehicle", hi:"वाहन जोड़ें", bn:"গাড়ি যোগ করুন"})}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label={tc({en:"Category", hi:"श्रेणी", bn:"বিভাগ"})} value={vehForm.category} onChange={(v) => setVehForm({ ...vehForm, category: v })}
            options={VEHICLE_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
          <Input label={tc({en:"Registration Number", hi:"पंजीकरण संख्या", bn:"রেজিস্ট্রেশন নম্বর"})} value={vehForm.regNumber} onChange={(v) => setVehForm({ ...vehForm, regNumber: v })} icon="Truck" placeholder="WB-00-XX-0000" />
          <Input label={tc({en:"Model (optional)", hi:"मॉडल (वैकल्पिक)", bn:"মডেল (ঐচ্ছিক)"})} value={vehForm.model} onChange={(v) => setVehForm({ ...vehForm, model: v })} icon="FileText" />
          <Input label={tc({en:"Insurance Expiry", hi:"बीमा समाप्ति", bn:"বীমা মেয়াদোত্তীর্ণ"})} value={vehForm.insuranceExpiry} onChange={(v) => setVehForm({ ...vehForm, insuranceExpiry: v })} icon="Calendar" type="date" />
          <Input label={tc({en:"Fitness Expiry", hi:"फिटनेस समाप्ति", bn:"ফিটনেস মেয়াদোত্তীর্ণ"})} value={vehForm.fitnessExpiry} onChange={(v) => setVehForm({ ...vehForm, fitnessExpiry: v })} icon="Calendar" type="date" />
          <Input label={tc({en:"Permit Expiry", hi:"परमिट समाप्ति", bn:"পারমিট মেয়াদোত্তীর্ণ"})} value={vehForm.permitExpiry} onChange={(v) => setVehForm({ ...vehForm, permitExpiry: v })} icon="Calendar" type="date" />
          <Button full icon="Check" onClick={addVehicle}>{tc({en:"Add Vehicle", hi:"वाहन जोड़ें", bn:"গাড়ি যোগ করুন"})}</Button>
        </div>
      </BottomSheet>

      {/* add driver */}
      <BottomSheet open={drvOpen} onClose={() => setDrvOpen(false)} title={tc({en:"Add Driver", hi:"चालक जोड़ें", bn:"চালক যোগ করুন"})}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({en:"Name", hi:"नाम", bn:"নাম"})} value={drvForm.name} onChange={(v) => setDrvForm({ ...drvForm, name: v })} icon="User" />
          <Input label={tc({en:"Phone", hi:"फोन", bn:"ফোন"})} value={drvForm.phone} onChange={(v) => setDrvForm({ ...drvForm, phone: v })} icon="Phone" />
          <Input label={tc({en:"License Number", hi:"लाइसेंस संख्या", bn:"লাইসেন্স নম্বর"})} value={drvForm.licenseNumber} onChange={(v) => setDrvForm({ ...drvForm, licenseNumber: v })} icon="CreditCard" />
          <Input label={tc({en:"License Expiry", hi:"लाइसेंस समाप्ति", bn:"লাইসেন্স মেয়াদোত্তীর্ণ"})} value={drvForm.licenseExpiry} onChange={(v) => setDrvForm({ ...drvForm, licenseExpiry: v })} icon="Calendar" type="date" />
          <Input label={tc({en:"Languages (comma-sep)", hi:"भाषाएं (कॉमा से अलग)", bn:"ভাষা (কমা দিয়ে পৃথক)"})} value={drvForm.languages} onChange={(v) => setDrvForm({ ...drvForm, languages: v })} icon="Languages" placeholder={tc({ en: "Bengali, Hindi", hi: "बंगाली, हिन्दी", bn: "বাংলা, হিন্দি" })} />
          <Button full icon="Check" onClick={addDriver}>{tc({en:"Add Driver", hi:"चालक जोड़ें", bn:"চালক যোগ করুন"})}</Button>
        </div>
      </BottomSheet>

      {/* assign */}
      <BottomSheet open={!!assignFor} onClose={() => setAssignFor(null)} title={tc({en:"Assign Shipment", hi:"शिपमेंट सौंपें", bn:"শিপমেন্ট বরাদ্দ করুন"})}>
        {assignFor && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: T.inkSoft }}>
              {assignFor.commodity} · {(assignFor.quantityKg / 1000).toLocaleString("en-IN")} t · {assignFor.pickup?.name} → {assignFor.drop?.name}
            </div>
            <Dropdown label={tc({en:"Vehicle", hi:"वाहन", bn:"গাড়ি"})} value={assignSel.vehicleId} onChange={(v) => setAssignSel({ ...assignSel, vehicleId: v })}
              options={[{ value: "", label: tc({en:"Select vehicle…", hi:"वाहन चुनें…", bn:"গাড়ি নির্বাচন করুন…"}) }, ...vehicles.filter((v) => v.available).map((v) => ({ value: v.id, label: `${v.regNumber} · ${(v.capacityKg / 1000)}t` }))]} />
            <Dropdown label={tc({en:"Driver", hi:"चालक", bn:"চালক"})} value={assignSel.driverId} onChange={(v) => setAssignSel({ ...assignSel, driverId: v })}
              options={[{ value: "", label: tc({en:"Select driver…", hi:"चालक चुनें…", bn:"চালক নির্বাচন করুন…"}) }, ...drivers.filter((d) => d.status === "available").map((d) => ({ value: d.id, label: d.name }))]} />
            <Button full icon="Check" onClick={doAssign}>{tc({en:"Confirm assignment", hi:"असाइनमेंट की पुष्टि करें", bn:"বরাদ্দ নিশ্চিত করুন"})}</Button>
          </div>
        )}
      </BottomSheet>

      <Dialog open={!!delVeh} onClose={() => setDelVeh(null)} title={tc({en:"Remove vehicle?", hi:"वाहन हटाएं?", bn:"গাড়ি সরাবেন?"})} icon="Trash2" danger
        body={tc({en:"This vehicle will be removed from your fleet.", hi:"यह वाहन आपके बेड़े से हटा दिया जाएगा।", bn:"এই গাড়িটি আপনার ফ্লিট থেকে সরিয়ে দেওয়া হবে।"})}
        confirmLabel={tc({en:"Remove", hi:"हटाएं", bn:"সরান"})}
        onConfirm={async () => { await fleetService.remove(delVeh.id); toast(tc({en:"Vehicle removed", hi:"वाहन हटाया गया", bn:"গাড়ি সরানো হয়েছে"}), "info"); refresh(); }} />
    </>
  );
}
