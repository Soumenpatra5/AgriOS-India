import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Button } from "../../components/index.js";
import Icon from "../../components/Icon.jsx";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { deviceRegistry, DEVICE_TYPES, PROTOCOLS } from "../../services/iot/deviceRegistry.js";
import StatTile from "../../components/erp/StatTile.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";

export default function DeviceManager() {
  const { pop, toast, can } = useApp();
  const [readings, setReadings] = useState([]);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "temp", protocol: "Manual entry", location: "" });
  const [readTarget, setReadTarget] = useState(null);
  const [readValue, setReadValue]   = useState("");
  const [delId, setDelId] = useState(null);

  useEffect(() => { deviceRegistry.latestReadings().then(setReadings); }, [tick]);

  const add = async () => {
    if (!form.name) return;
    await deviceRegistry.register(form);
    setOpen(false); setForm({ name: "", type: "temp", protocol: "Manual entry", location: "" });
    refresh(); toast("Device registered", "success");
  };

  const record = async () => {
    if (!readValue) return;
    await deviceRegistry.recordTelemetry(readTarget.id, readValue);
    setReadTarget(null); setReadValue("");
    refresh(); toast("Reading saved", "success");
  };

  const handleDelete = async () => { await deviceRegistry.remove(delId); setDelId(null); refresh(); toast("Removed", "info"); };

  return (
    <>
      <AppBar title="IoT Devices" onBack={pop} action={
        <button onClick={() => setOpen(true)}
          style={{ background: T.yellow, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> Add
        </button>
      } />

      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        <StatTile a="yellow" label="Devices" value={readings.length} />
        <StatTile a="blue" label="With Readings" value={readings.filter((r) => r.latest).length} />
      </div>

      <div style={{ padding: "10px 16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: T.blueSoft, borderRadius: T.rLg, padding: "11px 14px",
          fontSize: 12, color: T.inkSoft, borderLeft: `4px solid ${T.blue}` }}>
          Readings are manual entry today. When live sensors (MQTT / LoRaWAN) are connected
          in a future phase, they will feed the same registry automatically.
        </div>

        {readings.length === 0
          ? <EmptyHint icon="Satellite" text="Register temperature, humidity, water and weight sensors" />
          : readings.map(({ device, latest }) => {
            const meta = deviceRegistry.typeMeta(device.type);
            return (
              <RecordRow key={device.id}
                icon={meta.icon} iconColor={T.yellow} iconBg={T.yellowSoft}
                title={device.name}
                badge={<Pill fg={T.blue} bg={T.blueSoft}>{device.protocol}</Pill>}
                subtitle={`${meta.label}${device.location ? ` · ${device.location}` : ""}${latest ? ` · Last: ${latest.value}${meta.unit} (${latest.date})` : " · No readings yet"}`}
                right={
                  <button onClick={(e) => { e.stopPropagation(); setReadTarget(device); }}
                    style={{ background: T.primarySoft, color: T.primary, border: "none", borderRadius: 9,
                      padding: "6px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: T.body, flexShrink: 0 }}>
                    Reading
                  </button>
                }
                onDelete={can("records.delete") ? () => setDelId(device.id) : undefined} />
            );
          })}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Register Device">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Device name" placeholder="e.g. Shed 1 thermometer" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Dropdown label="Type" value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))}
            options={DEVICE_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
          <Dropdown label="Connection" value={form.protocol} onChange={(v) => setForm((f) => ({ ...f, protocol: v }))}
            options={PROTOCOLS.map((p) => ({ value: p, label: p }))} />
          <Input label="Location" placeholder="e.g. Poultry shed 1" value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))} />
          <Button full onClick={add} disabled={!form.name}>Register</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!readTarget} onClose={() => setReadTarget(null)}
        title={readTarget ? `Reading: ${readTarget.name}` : ""}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={`Value (${deviceRegistry.typeMeta(readTarget?.type).unit || "number"})`}
            type="number" value={readValue} onChange={setReadValue} />
          <Button full onClick={record} disabled={!readValue}>Save Reading</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delId} title="Remove device?" onClose={() => setDelId(null)}
        actions={[
          { label: "Cancel", variant: "outline", onClick: () => setDelId(null) },
          { label: "Remove", variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>The device and its readings will be removed.</div>
      </Dialog>
    </>
  );
}
