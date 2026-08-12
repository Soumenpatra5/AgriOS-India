import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Button, Chip } from "../../components/index.js";
import Icon from "../../components/Icon.jsx";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmService, FARM_TYPES } from "../../services/farm/farmService.js";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";

export default function FarmProfiles() {
  const { pop, toast, can } = useApp();
  const [farms, setFarms]   = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [tick, setTick]     = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "mixed", village: "", district: "", state: "", sizeAcres: "", ownerName: "" });
  const [delId, setDelId] = useState(null);

  useEffect(() => {
    farmService.getAll().then((list) => {
      setFarms(list);
      setActiveId(farmService.getActiveId() || list[0]?.id || null);
    });
  }, [tick]);

  const add = async () => {
    if (!form.name) return;
    const rec = await farmService.add(form);
    if (farms.length === 0) farmService.setActive(rec.id);
    setOpen(false);
    setForm({ name: "", type: "mixed", village: "", district: "", state: "", sizeAcres: "", ownerName: "" });
    refresh(); toast("Farm added", "success");
  };

  const activate = (id) => { farmService.setActive(id); setActiveId(id); toast("Active farm switched", "success"); };
  const handleDelete = async () => { await farmService.remove(delId); setDelId(null); refresh(); toast("Farm removed", "info"); };

  return (
    <>
      <AppBar title="Farm Profiles" onBack={pop} action={
        <button onClick={() => setOpen(true)}
          style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> Add Farm
        </button>
      } />

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {farms.length === 0
          ? <EmptyHint icon="House" text="Add your first farm — all records can then be organised per farm" />
          : farms.map((f) => (
            <RecordRow key={f.id} icon="House"
              title={f.name}
              badge={f.id === activeId ? <Pill>ACTIVE</Pill> : null}
              subtitle={`${farmService.typeLabel(f.type)}${f.sizeAcres ? ` · ${f.sizeAcres} acres` : ""}${f.village ? ` · ${f.village}` : ""}${f.district ? `, ${f.district}` : ""}`}
              onClick={f.id !== activeId ? () => activate(f.id) : undefined}
              right={f.id !== activeId ? (
                <span style={{ fontSize: 11.5, color: T.primary, fontWeight: 600, flexShrink: 0 }}>Set active</span>
              ) : null}
              onDelete={can("records.delete") ? () => setDelId(f.id) : undefined} />
          ))}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Add Farm">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Farm name" placeholder="e.g. Patra Agro Farm" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Dropdown label="Farm type" value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))}
            options={FARM_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
          <Input label="Owner name" placeholder="Optional" value={form.ownerName} onChange={(v) => setForm((f) => ({ ...f, ownerName: v }))} />
          <Input label="Village / Town" placeholder="" value={form.village} onChange={(v) => setForm((f) => ({ ...f, village: v }))} />
          <Input label="District" placeholder="" value={form.district} onChange={(v) => setForm((f) => ({ ...f, district: v }))} />
          <Input label="State" placeholder="" value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v }))} />
          <Input label="Total size (acres)" type="number" placeholder="0" value={form.sizeAcres} onChange={(v) => setForm((f) => ({ ...f, sizeAcres: v }))} />
          <Button full onClick={add} disabled={!form.name}>Add Farm</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delId} title="Delete farm?" onClose={() => setDelId(null)}
        actions={[
          { label: "Cancel", variant: "outline", onClick: () => setDelId(null) },
          { label: "Delete", variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>
          The farm profile will be removed. Records tagged to it are kept.
        </div>
      </Dialog>
    </>
  );
}
