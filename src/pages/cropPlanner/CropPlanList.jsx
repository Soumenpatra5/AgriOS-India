import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen, Chip } from "../../components/index.js";
import { Dialog } from "../../components/overlays.jsx";
import { Button } from "../../components/primitives.jsx";
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

const MAX_COMPARE = 4;

export default function CropPlanList() {
  const { pop, push, toast } = useApp();
  const [plans, setPlans] = useState(null);
  const [filter, setFilter] = useState("all");
  const [delTarget, setDelTarget] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState([]);

  const refresh = () => cropPlanService.getAll().then(setPlans);
  useEffect(() => { refresh(); }, []);

  if (plans === null) {
    return (<><AppBar title="Crop plans" onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>Loading…</div></>);
  }

  const visible = filter === "all" ? plans : plans.filter((p) => p.status === filter);

  const toggleSelect = (id) => setSelected((sel) =>
    sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < MAX_COMPARE ? [...sel, id] : sel);

  const exitCompare = () => { setCompareMode(false); setSelected([]); };
  const goCompare = () => {
    if (selected.length < 2) { toast("Select at least 2 plans to compare", "info"); return; }
    push({ kind: "cropPlanCompare", props: { ids: selected } });
    exitCompare();
  };

  return (
    <>
      <AppBar title="Crop plans" onBack={pop} action={
        compareMode ? (
          <button onClick={exitCompare} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "8px 13px", cursor: "pointer", color: T.ink, fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
            Cancel
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setCompareMode(true)} disabled={plans.length < 2}
              style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8, cursor: plans.length < 2 ? "default" : "pointer",
                opacity: plans.length < 2 ? .5 : 1, color: T.ink, display: "flex" }} aria-label="Compare plans">
              <Icon name="GitCompare" size={16} />
            </button>
            <button onClick={() => push({ kind: "cropPlanner" })}
              style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
                cursor: "pointer", color: "#fff", fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
              + New
            </button>
          </div>
        )
      } />
      <Screen gap={16}>
        {compareMode && (
          <div style={{ fontSize: 12.5, color: T.inkSoft, background: T.surface2, borderRadius: T.rMd, padding: "10px 12px" }}>
            Select 2–{MAX_COMPARE} plans to compare ({selected.length} selected)
          </div>
        )}

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
              const isSelected = selected.includes(p.id);
              return (
                <RecordRow key={p.id} icon={compareMode ? (isSelected ? "CheckCircle2" : "Circle") : "Sprout"}
                  iconColor={compareMode && isSelected ? T.primary : undefined}
                  title={p.cropName || "Unnamed crop"}
                  subtitle={`${p.areaValue || p.areaAcres} ${p.areaUnit || "acre"} · ${rupee(p.computed?.totalCost || 0)}`}
                  badge={<Pill fg={sc.fg} bg={sc.bg}>{cropPlanService.statusLabel(p.status)}</Pill>}
                  onClick={() => compareMode ? toggleSelect(p.id) : push({ kind: "cropPlanDetail", props: { id: p.id } })}
                  onDelete={compareMode ? undefined : () => setDelTarget(p)} />
              );
            })}
          </div>
        )}

        {compareMode && (
          <Button full disabled={selected.length < 2} onClick={goCompare} icon="GitCompare">
            Compare {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
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
