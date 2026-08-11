import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen, Card, Chip } from "../../components/index.js";
import { Dropdown } from "../../components/inputs.jsx";
import { Button } from "../../components/primitives.jsx";
import { Dialog } from "../../components/overlays.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { cropPlanService, CROP_PLAN_STATUSES } from "../../services/cropPlanner/cropPlanService.js";
import PlanSummary from "../../components/cropPlanner/PlanSummary.jsx";
import { rupee } from "../../utils/format.js";

const LEDGER_BUCKETS = [
  { key: "seed", label: "Seed" }, { key: "fertilizer", label: "Fertilizer" },
  { key: "protection", label: "Crop protection" }, { key: "organic", label: "Organic inputs" },
  { key: "irrigation", label: "Irrigation" }, { key: "labour", label: "Labour" },
  { key: "machinery", label: "Machinery" }, { key: "other", label: "Other costs" },
];

function Section({ title, icon, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: T.inkSoft,
        textTransform: "uppercase", letterSpacing: .4, marginBottom: 10, padding: "0 2px" }}>
        {icon && <Icon name={icon} size={14} />} {title}
      </div>
      {children}
    </div>
  );
}

function bucketAmount(computed, key) {
  if (key === "seed") return computed.seed.totalSeedCost;
  if (key === "irrigation") return computed.irrigation.total;
  return computed[key]?.total || 0;
}

export default function CropPlanDetail({ id }) {
  const { pop, push, toast } = useApp();
  const [plan, setPlan] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [delOpen, setDelOpen] = useState(false);
  const [checkingInventory, setCheckingInventory] = useState(false);

  const refresh = () => cropPlanService.getById(id).then(setPlan);
  useEffect(() => { refresh(); }, [id]);

  if (!plan) {
    return (<><AppBar title="Crop plan" onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>Loading…</div></>);
  }

  const checkInventory = async () => {
    setCheckingInventory(true);
    try {
      const lines = await cropPlanService.reconcileInventory(plan, plan.farmId);
      setInventory(lines);
    } finally {
      setCheckingInventory(false);
    }
  };

  const requestPurchase = async (line) => {
    await cropPlanService.createPurchaseRequest({ item: line.label, qty: line.shortfall, unit: line.unit, rate: line.purchaseCost / line.shortfall || 0 });
    toast(`Purchase request created for ${line.label}`, "success");
  };

  const postBucket = async (key) => {
    const res = await cropPlanService.postBucketToLedger(plan, key);
    if (res.posted) { toast("Posted to Farm Ledger", "success"); refresh(); }
    else if (res.alreadyPosted) toast("Already posted", "info");
    else toast("Nothing to post for this bucket", "info");
  };

  const statusOptions = CROP_PLAN_STATUSES.map((s) => ({ value: s.id, label: s.label }));

  return (
    <>
      <AppBar title={plan.cropName || "Crop plan"} onBack={pop} action={
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => push({ kind: "cropPlanner", props: { planId: plan.id } })} aria-label="Edit"
            style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8, cursor: "pointer", color: T.ink, display: "flex" }}>
            <Icon name="Pencil" size={16} />
          </button>
          <button onClick={() => setDelOpen(true)} aria-label="Delete"
            style={{ background: T.redSoft, border: "none", borderRadius: 12, padding: 8, cursor: "pointer", color: T.red, display: "flex" }}>
            <Icon name="Trash2" size={16} />
          </button>
        </div>
      } />

      <Screen gap={20}>
        <Card pad={14}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700 }}>{plan.cropName}{plan.variety ? ` — ${plan.variety}` : ""}</div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3 }}>{plan.areaValue || plan.areaAcres} {plan.areaUnit || "acre"} · {plan.season || "season not set"}</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Dropdown value={plan.status} options={statusOptions}
              onChange={async (v) => { await cropPlanService.setStatus(plan.id, v); refresh(); }} />
          </div>
          {plan.notes && <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 10, lineHeight: 1.5 }}>{plan.notes}</div>}
        </Card>

        <PlanSummary plan={plan.computed} showProfitability={plan.yieldPerAcre > 0 || plan.sellingPrice > 0} />

        <Section title="Inventory check" icon="Boxes">
          {inventory === null ? (
            <Button variant="outline" full onClick={checkInventory} disabled={checkingInventory} icon="Search">
              {checkingInventory ? "Checking…" : "Check inventory for this plan"}
            </Button>
          ) : inventory.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.inkFaint }}>No seed/fertilizer/protection/organic inputs to check.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {inventory.map((line, i) => (
                <Card key={i} pad={12}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{line.label}</span>
                    <span style={{ fontSize: 12, color: T.inkSoft }}>Required: {line.required.toLocaleString("en-IN")} {line.unit}</span>
                  </div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>
                    Available: {line.available === null ? "no matching inventory item" : `${line.available.toLocaleString("en-IN")} ${line.unit}`}
                  </div>
                  {line.shortfall > 0 ? (
                    <>
                      <div style={{ fontSize: 12.5, color: T.red, fontWeight: 600, marginTop: 4 }}>
                        Shortfall: {line.shortfall.toLocaleString("en-IN")} {line.unit}{line.purchaseCost > 0 ? ` · est. ${rupee(line.purchaseCost)}` : ""}
                      </div>
                      <Button size="sm" variant="soft" style={{ marginTop: 8 }} onClick={() => requestPurchase(line)} icon="ShoppingCart">
                        Create purchase request
                      </Button>
                    </>
                  ) : (
                    <div style={{ fontSize: 12.5, color: T.primary, fontWeight: 600, marginTop: 4 }}>Fully in stock</div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </Section>

        <Section title="Post costs to Farm Ledger" icon="Receipt">
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginBottom: 10 }}>
            Posts each cost bucket as an expense in Farm Ledger, tagged to the Crop enterprise. Each bucket can only be posted once.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {LEDGER_BUCKETS.map(({ key, label }) => {
              const amount = bucketAmount(plan.computed, key);
              const posted = !!plan.postedCategories?.[key];
              if (amount <= 0) return null;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px",
                  background: T.surface2, borderRadius: T.rMd }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 11.5, color: T.inkSoft }}>{rupee(amount)}</div>
                  </div>
                  {posted ? (
                    <Chip icon="Check">Posted</Chip>
                  ) : (
                    <Button size="sm" variant="soft" onClick={() => postBucket(key)}>Post</Button>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      </Screen>

      <Dialog open={delOpen} onClose={() => setDelOpen(false)}
        title="Delete crop plan?" icon="Trash2" danger
        body="This cannot be undone. Ledger entries already posted from this plan will not be removed."
        confirmLabel="Delete" cancelLabel="Cancel"
        onConfirm={async () => { await cropPlanService.remove(plan.id); toast("Crop plan deleted", "info"); pop(); }} />
    </>
  );
}
