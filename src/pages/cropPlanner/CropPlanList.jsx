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
  const { pop, push, toast, tc } = useApp();
  const [plans, setPlans] = useState(null);
  const [filter, setFilter] = useState("all");
  const [delTarget, setDelTarget] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState([]);

  const refresh = () => cropPlanService.getAll().then(setPlans);
  useEffect(() => { refresh(); }, []);

  if (plans === null) {
    return (<><AppBar title={tc({ en: "Crop plans", hi: "फ़सल योजनाएँ", bn: "ফসল পরিকল্পনা" })} onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>{tc({ en: "Loading…", hi: "लोड हो रहा है…", bn: "লোড হচ্ছে…" })}</div></>);
  }

  const visible = filter === "all" ? plans : plans.filter((p) => p.status === filter);

  const toggleSelect = (id) => setSelected((sel) =>
    sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < MAX_COMPARE ? [...sel, id] : sel);

  const exitCompare = () => { setCompareMode(false); setSelected([]); };
  const goCompare = () => {
    if (selected.length < 2) { toast(tc({ en: "Select at least 2 plans to compare", hi: "तुलना के लिए कम से कम 2 योजनाएँ चुनें", bn: "তুলনার জন্য অন্তত ২টি পরিকল্পনা বাছুন" }), "info"); return; }
    push({ kind: "cropPlanCompare", props: { ids: selected } });
    exitCompare();
  };

  return (
    <>
      <AppBar title={tc({ en: "Crop plans", hi: "फ़सल योजनाएँ", bn: "ফসল পরিকল্পনা" })} onBack={pop} action={
        compareMode ? (
          <button onClick={exitCompare} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "8px 13px", cursor: "pointer", color: T.ink, fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
            {tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" })}
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setCompareMode(true)} disabled={plans.length < 2}
              style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8, cursor: plans.length < 2 ? "default" : "pointer",
                opacity: plans.length < 2 ? .5 : 1, color: T.ink, display: "flex" }} aria-label={tc({ en: "Compare plans", hi: "योजनाओं की तुलना करें", bn: "পরিকল্পনার তুলনা করুন" })}>
              <Icon name="GitCompare" size={16} />
            </button>
            <button onClick={() => push({ kind: "cropPlanner" })}
              style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
                cursor: "pointer", color: "#fff", fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
              {tc({ en: "+ New", hi: "+ नई", bn: "+ নতুন" })}
            </button>
          </div>
        )
      } />
      <Screen gap={16}>
        {compareMode && (
          <div style={{ fontSize: 12.5, color: T.inkSoft, background: T.surface2, borderRadius: T.rMd, padding: "10px 12px" }}>
            {tc({ en: `Select 2–${MAX_COMPARE} plans to compare (${selected.length} selected)`,
                  hi: `तुलना के लिए 2–${MAX_COMPARE} योजनाएँ चुनें (${selected.length} चुनी गईं)`,
                  bn: `তুলনার জন্য ২–${MAX_COMPARE}টি পরিকল্পনা বাছুন (${selected.length}টি বাছাই করা হয়েছে)` })}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>{tc({ en: "All", hi: "सभी", bn: "সব" })}</Chip>
          {CROP_PLAN_STATUSES.map((s) => (
            <Chip key={s.id} active={filter === s.id} onClick={() => setFilter(s.id)}>{s.i18n ? tc(s.i18n) : s.label}</Chip>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyHint icon="Sprout" text={plans.length === 0
              ? tc({ en: "No crop plans yet — tap + New to create one.", hi: "अभी कोई फ़सल योजना नहीं — बनाने के लिए + नई दबाएँ।", bn: "এখনও কোনও ফসল পরিকল্পনা নেই — তৈরি করতে + নতুন চাপুন।" })
              : tc({ en: "No plans with this status.", hi: "इस स्थिति की कोई योजना नहीं।", bn: "এই অবস্থার কোনও পরিকল্পনা নেই।" })} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visible.map((p) => {
              const sc = STATUS_COLOR[p.status] || STATUS_COLOR.draft;
              const isSelected = selected.includes(p.id);
              return (
                <RecordRow key={p.id} icon={compareMode ? (isSelected ? "CheckCircle2" : "Circle") : "Sprout"}
                  iconColor={compareMode && isSelected ? T.primary : undefined}
                  title={p.cropName || tc({ en: "Unnamed crop", hi: "बिना नाम की फ़सल", bn: "নামহীন ফসল" })}
                  subtitle={`${p.areaValue || p.areaAcres} ${p.areaUnit || tc({ en: "acre", hi: "एकड़", bn: "একর" })} · ${rupee(p.computed?.totalCost || 0)}`}
                  badge={<Pill fg={sc.fg} bg={sc.bg}>{tc(cropPlanService.statusI18n(p.status))}</Pill>}
                  onClick={() => compareMode ? toggleSelect(p.id) : push({ kind: "cropPlanDetail", props: { id: p.id } })}
                  onDelete={compareMode ? undefined : () => setDelTarget(p)} />
              );
            })}
          </div>
        )}

        {compareMode && (
          <Button full disabled={selected.length < 2} onClick={goCompare} icon="GitCompare">
            {tc({ en: "Compare", hi: "तुलना करें", bn: "তুলনা করুন" })} {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
        )}
      </Screen>

      <Dialog open={!!delTarget} onClose={() => setDelTarget(null)}
        title={tc({ en: "Delete crop plan?", hi: "फ़सल योजना हटाएँ?", bn: "ফসল পরিকল্পনা মুছবেন?" })} icon="Trash2" danger
        body={delTarget ? tc({
          en: `${delTarget.cropName || "Unnamed crop"} — this cannot be undone.`,
          hi: `${delTarget.cropName || "बिना नाम की फ़सल"} — इसे वापस नहीं किया जा सकता।`,
          bn: `${delTarget.cropName || "নামহীন ফসল"} — এটি আর ফেরানো যাবে না।`,
        }) : ""}
        confirmLabel={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })} cancelLabel={tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" })}
        onConfirm={async () => { await cropPlanService.remove(delTarget.id); setDelTarget(null); refresh(); toast(tc({ en: "Crop plan deleted", hi: "फ़सल योजना हटाई गई", bn: "ফসল পরিকল্পনা মুছে ফেলা হয়েছে" }), "info"); }} />
    </>
  );
}
