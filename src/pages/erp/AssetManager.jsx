import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Button } from "../../components/index.js";
import Icon from "../../components/Icon.jsx";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { assetService, ASSET_CATEGORIES } from "../../services/assets/assetService.js";
import { rupee, compact } from "../../utils/format.js";
import StatTile from "../../components/erp/StatTile.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AssetManager() {
  const { pop, toast, can } = useApp();
  const [assets, setAssets] = useState([]);
  const [value, setValue]   = useState(0);
  const [due, setDue]       = useState([]);
  const [tick, setTick]     = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "machinery", purchasePrice: "", purchaseDate: "", note: "" });
  const [maintTarget, setMaintTarget] = useState(null);
  const [maintForm, setMaintForm]     = useState({ date: todayStr(), kind: "service", cost: "", note: "", nextDue: "" });
  const [delId, setDelId] = useState(null);

  useEffect(() => {
    assetService.farmAssets().then(setAssets); // exclude employee-assigned items
    assetService.totalValue().then(setValue);
    assetService.dueSoon().then(setDue);
  }, [tick]);

  const add = async () => {
    if (!form.name) return;
    await assetService.add(form);
    setOpen(false);
    setForm({ name: "", category: "machinery", purchasePrice: "", purchaseDate: "", note: "" });
    refresh(); toast("Asset added", "success");
  };

  const logMaint = async () => {
    await assetService.logMaintenance(maintTarget.id, maintForm);
    setMaintTarget(null); setMaintForm({ date: todayStr(), kind: "service", cost: "", note: "", nextDue: "" });
    refresh(); toast("Maintenance logged", "success");
  };

  const handleDelete = async () => { await assetService.remove(delId); setDelId(null); refresh(); toast("Deleted", "info"); };

  const dueIds = new Set(due.map((d) => d.asset.id));

  return (
    <>
      <AppBar title="Assets" onBack={pop} action={
        <button onClick={() => setOpen(true)}
          style={{ background: T.yellow, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> Add
        </button>
      } />

      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        <StatTile a="yellow" label="Assets" value={assets.length} />
        <StatTile a="primary" label="Total Value" value={compact(value)} />
        <StatTile a={due.length > 0 ? "red" : "blue"} label="Service Due" value={due.length} />
      </div>

      <div style={{ padding: "10px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {assets.length === 0
          ? <EmptyHint icon="Tractor" text="Register machinery, vehicles and buildings — track maintenance and value" />
          : assets.map((a) => (
            <RecordRow key={a.id}
              icon={assetService.categoryIcon(a.category)} iconColor={T.yellow} iconBg={T.yellowSoft}
              title={a.name}
              badge={dueIds.has(a.id) ? <Pill fg={T.red} bg={T.redSoft}>SERVICE DUE</Pill> : null}
              subtitle={`${assetService.categoryLabel(a.category)}${a.purchasePrice ? ` · ${rupee(Number(a.purchasePrice))}` : ""}${a.purchaseDate ? ` · bought ${a.purchaseDate}` : ""}`}
              right={
                <button onClick={(e) => { e.stopPropagation(); setMaintTarget(a); }}
                  style={{ background: T.blueSoft, color: T.blue, border: "none", borderRadius: 9,
                    padding: "6px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: T.body, flexShrink: 0 }}>
                  Service
                </button>
              }
              onDelete={can("records.delete") ? () => setDelId(a.id) : undefined} />
          ))}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Add Asset">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Asset name" placeholder="e.g. Mahindra 575 tractor" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Dropdown label="Category" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))}
            options={ASSET_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
          <Input label="Purchase price (₹)" type="number" placeholder="0" value={form.purchasePrice} onChange={(v) => setForm((f) => ({ ...f, purchasePrice: v }))} />
          <Input label="Purchase date" type="date" value={form.purchaseDate} onChange={(v) => setForm((f) => ({ ...f, purchaseDate: v }))} />
          <Input label="Notes" placeholder="Optional" value={form.note} onChange={(v) => setForm((f) => ({ ...f, note: v }))} />
          <Button full onClick={add} disabled={!form.name}>Add Asset</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!maintTarget} onClose={() => setMaintTarget(null)} title={maintTarget ? `Service: ${maintTarget.name}` : ""}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Date" type="date" value={maintForm.date} onChange={(v) => setMaintForm((f) => ({ ...f, date: v }))} />
          <Dropdown label="Type" value={maintForm.kind} onChange={(v) => setMaintForm((f) => ({ ...f, kind: v }))}
            options={[
              { value: "service", label: "Routine Service" },
              { value: "repair",  label: "Repair" },
              { value: "insurance", label: "Insurance Renewal" },
              { value: "other",   label: "Other" },
            ]} />
          <Input label="Cost (₹)" type="number" placeholder="0" value={maintForm.cost} onChange={(v) => setMaintForm((f) => ({ ...f, cost: v }))} />
          <Input label="Notes" placeholder="What was done…" value={maintForm.note} onChange={(v) => setMaintForm((f) => ({ ...f, note: v }))} />
          <Input label="Next service due" type="date" value={maintForm.nextDue} onChange={(v) => setMaintForm((f) => ({ ...f, nextDue: v }))} />
          <Button full onClick={logMaint}>Log Maintenance</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delId} title="Delete asset?" onClose={() => setDelId(null)}
        actions={[
          { label: "Cancel", variant: "outline", onClick: () => setDelId(null) },
          { label: "Delete", variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>The asset and its maintenance history will be removed.</div>
      </Dialog>
    </>
  );
}
