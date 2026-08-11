/* Feed batch list — the FCR/consumption tracking unit. Optionally filtered
   to one enterprise when opened from a livestock manager page. */
import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Screen, Chip } from "../../components/index.js";
import { BottomSheet, Input, Dropdown } from "../../components/index.js";
import { Button } from "../../components/primitives.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { feedBatchService, BATCH_STATUSES } from "../../services/feed/feedBatchService.js";
import { LIVESTOCK_TYPES } from "../../services/feed/feedService.js";

const emptyForm = { enterprise: "poultry", label: "", initialCount: "", initialWeight: "", startDate: new Date().toISOString().slice(0, 10), targetFCR: "" };

export default function FeedBatchList({ enterprise } = {}) {
  const { pop, push, toast } = useApp();
  const [batches, setBatches] = useState(null);
  const [filter, setFilter] = useState(enterprise || "all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, enterprise: enterprise || "poultry" });

  const refresh = () => feedBatchService.getAll().then(setBatches);
  useEffect(() => { refresh(); }, []);

  if (batches === null) {
    return (<><AppBar title="Feed batches" onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>Loading…</div></>);
  }

  const visible = filter === "all" ? batches : batches.filter((b) => b.enterprise === filter);

  const save = async () => {
    if (!form.label.trim()) return;
    const b = await feedBatchService.add({
      ...form, initialCount: Number(form.initialCount) || 0, initialWeight: Number(form.initialWeight) || 0,
      targetFCR: form.targetFCR === "" ? null : Number(form.targetFCR),
    });
    setOpen(false); setForm({ ...emptyForm, enterprise: enterprise || "poultry" });
    refresh(); toast("Batch created", "success");
    push({ kind: "feedBatchDetail", props: { id: b.id } });
  };

  const enterpriseOptions = LIVESTOCK_TYPES.map((t) => ({ value: t.id, label: t.label }));

  return (
    <>
      <AppBar title="Feed batches" onBack={pop} action={
        <button onClick={() => setOpen(true)}
          style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          + New batch
        </button>
      } />
      <Screen gap={16}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
          {LIVESTOCK_TYPES.map((t) => (
            <Chip key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)}>{t.label}</Chip>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyHint icon="Layers" text="No feed batches yet — create one to start tracking FCR and feed cost." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visible.map((b) => (
              <RecordRow key={b.id} icon="Layers"
                title={b.label || "Unnamed batch"}
                subtitle={`${LIVESTOCK_TYPES.find((t) => t.id === b.enterprise)?.label || b.enterprise} · ${b.initialCount || 0} initial${b.currentCount != null ? ` · ${b.currentCount} current` : ""}`}
                badge={<Pill fg={b.status === "active" ? T.primary : T.inkSoft} bg={b.status === "active" ? T.primarySoft : T.surface2}>
                  {BATCH_STATUSES.find((s) => s.id === b.status)?.label || b.status}
                </Pill>}
                onClick={() => push({ kind: "feedBatchDetail", props: { id: b.id } })} />
            ))}
          </div>
        )}
      </Screen>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="New Feed Batch">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label="Livestock type" value={form.enterprise} onChange={(v) => setForm((f) => ({ ...f, enterprise: v }))} options={enterpriseOptions} />
          <Input label="Batch / pond label" value={form.label} onChange={(v) => setForm((f) => ({ ...f, label: v }))} placeholder="e.g. Batch #001" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Initial count" type="number" value={form.initialCount} onChange={(v) => setForm((f) => ({ ...f, initialCount: v }))} />
            <Input label="Initial avg weight (kg)" type="number" value={form.initialWeight} onChange={(v) => setForm((f) => ({ ...f, initialWeight: v }))} placeholder="0" />
          </div>
          <Input label="Start date" type="date" value={form.startDate} onChange={(v) => setForm((f) => ({ ...f, startDate: v }))} />
          <Input label="Target FCR (optional)" type="number" value={form.targetFCR} onChange={(v) => setForm((f) => ({ ...f, targetFCR: v }))} placeholder="You set this — not a built-in default" />
          <Button full onClick={save} disabled={!form.label.trim()}>Create batch</Button>
        </div>
      </BottomSheet>
    </>
  );
}
