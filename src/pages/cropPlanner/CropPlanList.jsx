import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Screen, Chip } from "../../components/index.js";
import { Dialog } from "../../components/overlays.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { cropPlanService, CROP_PLAN_STATUSES } from "../../services/cropPlanner/cropPlanService.js";
import { rupee } from "../../utils/format.js";

const STATUS_COLOR = {
  draft:       { fg: T.inkSoft, bg: T.surface2 },
  planned:     { fg: T.blue,    bg: T.blueSoft },
  approved:    { fg: T.primary, bg: T.primarySoft },
  in_progress: { fg: T.orange,  bg: T.orangeSoft },
  harvested:   { fg: T.primary, bg: T.primarySoft },
  completed:   { fg: T.primary, bg: T.primarySoft },
  cancelled:   { fg: T.red,     bg: T.redSoft },
};

export default function CropPlanList() {
  const { pop, push, toast } = useApp();
  const [plans, setPlans] = useState(null);
  const [filter, setFilter] = useState("all");
  const [delTarget, setDelTarget] = useState(null);

  const refresh = () => cropPlanService.getAll().then(setPlans);
  useEffect(() => { refresh(); }, []);

  if (plans === null) {
    return (<><AppBar title="Crop plans" onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>Loading…</div></>);
  }

  const visible = filter === "all" ? plans : plans.filter((p) => p.status === filter);

  return (
    <>
      <AppBar title="Crop plans" onBack={pop} action={
        <button onClick={() => push({ kind: "cropPlanner" })}
          style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          + New
        </button>
      } />
      <Screen gap={16}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
          {CROP_PLAN_STATUSES.map((s) => (
            <Chip key={s.id} active={filter === s.id} onClick={() => setFilter(s.id)}>{s.label}</Chip>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyHint icon="Sprout" text={plans.length === 0 ? "No crop plans yet — tap + New to create one." : "No plans with this status."} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visible.map((p) => {
              const sc = STATUS_COLOR[p.status] || STATUS_COLOR.draft;
              return (
                <RecordRow key={p.id} icon="Sprout"
                  title={p.cropName || "Unnamed crop"}
                  subtitle={`${p.areaValue || p.areaAcres} ${p.areaUnit || "acre"} · ${rupee(p.computed?.totalCost || 0)}`}
                  badge={<Pill fg={sc.fg} bg={sc.bg}>{cropPlanService.statusLabel(p.status)}</Pill>}
                  onClick={() => push({ kind: "cropPlanDetail", props: { id: p.id } })}
                  onDelete={() => setDelTarget(p)} />
              );
            })}
          </div>
        )}
      </Screen>

      <Dialog open={!!delTarget} onClose={() => setDelTarget(null)}
        title="Delete crop plan?" icon="Trash2" danger
        body={delTarget ? `${delTarget.cropName || "Unnamed crop"} — this cannot be undone.` : ""}
        confirmLabel="Delete" cancelLabel="Cancel"
        onConfirm={async () => { await cropPlanService.remove(delTarget.id); setDelTarget(null); refresh(); toast("Crop plan deleted", "info"); }} />
    </>
  );
}
