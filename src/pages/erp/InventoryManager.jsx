import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Button, Chip } from "../../components/index.js";
import Icon from "../../components/Icon.jsx";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { inventoryService, ITEM_CATEGORIES } from "../../services/inventory/inventoryService.js";
import StatTile from "../../components/erp/StatTile.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";

export default function InventoryManager() {
  const { pop, toast, can } = useApp();
  const [items, setItems]   = useState([]);
  const [alerts, setAlerts] = useState({ lowStock: [], expired: [], expiring: [] });
  const [catFilter, setCatFilter] = useState("all");
  const [tick, setTick]     = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "feed", qty: "", unit: "kg", minQty: "", unitPrice: "", expiryDate: "", supplierName: "" });
  const [moveTarget, setMoveTarget] = useState(null); // item
  const [moveForm, setMoveForm]     = useState({ kind: "in", qty: "", note: "" });
  const [delId, setDelId] = useState(null);

  useEffect(() => {
    inventoryService.getAll().then(setItems);
    inventoryService.alerts().then(setAlerts);
  }, [tick]);

  const list = catFilter === "all" ? items : items.filter((i) => i.category === catFilter);
  const alertCount = alerts.lowStock.length + alerts.expired.length + alerts.expiring.length;

  const add = async () => {
    if (!form.name) return;
    await inventoryService.addItem(form);
    setOpen(false);
    setForm({ name: "", category: "feed", qty: "", unit: "kg", minQty: "", unitPrice: "", expiryDate: "", supplierName: "" });
    refresh(); toast("Item added", "success");
  };

  const doMove = async () => {
    if (!moveForm.qty) return;
    await inventoryService.move(moveTarget.id, moveForm.kind, moveForm.qty, moveForm.note);
    setMoveTarget(null); setMoveForm({ kind: "in", qty: "", note: "" });
    refresh(); toast(moveForm.kind === "in" ? "Stock added" : "Stock issued", "success");
  };

  const handleDelete = async () => { await inventoryService.removeItem(delId); setDelId(null); refresh(); toast("Deleted", "info"); };

  const itemBadge = (i) => {
    const today = new Date().toISOString().slice(0, 10);
    if (i.expiryDate && i.expiryDate < today) return <Pill fg={T.red} bg={T.redSoft}>EXPIRED</Pill>;
    if (i.minQty && Number(i.qty) <= Number(i.minQty)) return <Pill fg={T.orange} bg={T.orangeSoft}>LOW</Pill>;
    return null;
  };

  return (
    <>
      <AppBar title="Inventory" onBack={pop} action={
        <button onClick={() => setOpen(true)}
          style={{ background: T.orange, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> Add
        </button>
      } />

      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        <StatTile a="orange" label="Items" value={items.length} />
        <StatTile a={alertCount > 0 ? "red" : "primary"} label="Alerts" value={alertCount} />
        <StatTile a="blue" label="Low Stock" value={alerts.lowStock.length} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px", overflowX: "auto" }}>
        <Chip active={catFilter === "all"} onClick={() => setCatFilter("all")}>All</Chip>
        {ITEM_CATEGORIES.map((c) => (
          <Chip key={c.id} active={catFilter === c.id} onClick={() => setCatFilter(c.id)}>{c.label}</Chip>
        ))}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {list.length === 0
          ? <EmptyHint icon="Warehouse" text="Add feed, medicine, seeds and other stock to track levels and expiry" />
          : list.map((i) => (
            <RecordRow key={i.id}
              icon={inventoryService.categoryIcon(i.category)} iconColor={T.orange} iconBg={T.orangeSoft}
              title={i.name}
              badge={itemBadge(i)}
              subtitle={`${i.qty} ${i.unit || ""} in stock${i.minQty ? ` · min ${i.minQty}` : ""}${i.expiryDate ? ` · exp ${i.expiryDate}` : ""}${i.supplierName ? ` · ${i.supplierName}` : ""}`}
              right={
                <button onClick={(e) => { e.stopPropagation(); setMoveTarget(i); }}
                  style={{ background: T.primarySoft, color: T.primary, border: "none", borderRadius: 9,
                    padding: "6px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: T.body, flexShrink: 0 }}>
                  In / Out
                </button>
              }
              onDelete={can("records.delete") ? () => setDelId(i.id) : undefined} />
          ))}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Add Inventory Item">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Item name" placeholder="e.g. Layer feed 50kg" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Dropdown label="Category" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))}
            options={ITEM_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
          <Input label="Opening quantity" type="number" placeholder="0" value={form.qty} onChange={(v) => setForm((f) => ({ ...f, qty: v }))} />
          <Input label="Unit" placeholder="kg / L / bags / pcs" value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} />
          <Input label="Low-stock alert level" type="number" placeholder="0" value={form.minQty} onChange={(v) => setForm((f) => ({ ...f, minQty: v }))} />
          <Input label="Unit price (₹)" type="number" placeholder="0" value={form.unitPrice} onChange={(v) => setForm((f) => ({ ...f, unitPrice: v }))} />
          <Input label="Expiry date (optional)" type="date" value={form.expiryDate} onChange={(v) => setForm((f) => ({ ...f, expiryDate: v }))} />
          <Input label="Supplier (optional)" placeholder="" value={form.supplierName} onChange={(v) => setForm((f) => ({ ...f, supplierName: v }))} />
          <Button full onClick={add} disabled={!form.name}>Add Item</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!moveTarget} onClose={() => setMoveTarget(null)} title={moveTarget ? `Stock: ${moveTarget.name}` : ""}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: T.inkSoft }}>
            Current stock: <b style={{ color: T.ink }}>{moveTarget?.qty} {moveTarget?.unit}</b>
          </div>
          <Dropdown label="Movement" value={moveForm.kind} onChange={(v) => setMoveForm((f) => ({ ...f, kind: v }))}
            options={[{ value: "in", label: "Stock In (purchase/receive)" }, { value: "out", label: "Stock Out (use/issue)" }]} />
          <Input label="Quantity" type="number" placeholder="0" value={moveForm.qty} onChange={(v) => setMoveForm((f) => ({ ...f, qty: v }))} />
          <Input label="Note" placeholder="Optional" value={moveForm.note} onChange={(v) => setMoveForm((f) => ({ ...f, note: v }))} />
          <Button full onClick={doMove} disabled={!moveForm.qty}>Save Movement</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delId} title="Delete item?" onClose={() => setDelId(null)}
        actions={[
          { label: "Cancel", variant: "outline", onClick: () => setDelId(null) },
          { label: "Delete", variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>The item and its stock history will be removed.</div>
      </Dialog>
    </>
  );
}
