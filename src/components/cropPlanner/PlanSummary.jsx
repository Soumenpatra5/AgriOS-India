/* Shared cultivation-cost + profitability summary, used by both the live
   CropPlanner calculator and the read-only CropPlanDetail view so the two
   screens can't drift out of sync with each other's layout. */
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../Icon.jsx";
import { Card } from "../primitives.jsx";
import { rupee } from "../../utils/format.js";

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

function StatBox({ label, value, sub, fg }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "13px 12px" }}>
      <div style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</div>
      <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: fg || T.ink, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13.5 }}>
      <span style={{ color: T.inkSoft }}>{label}</span>
      <span style={{ color: T.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{rupee(value)}</span>
    </div>
  );
}

export default function PlanSummary({ plan, showProfitability }) {
  const roi = plan.profit.roiPct;
  const roiColor = roi === null ? T.ink : roi >= 0 ? T.primary : T.red;

  return (
    <>
      <Section title="Cultivation cost summary" icon="Calculator">
        <Card pad={14}>
          <SummaryRow label="Seed cost" value={plan.seed.totalSeedCost} />
          {plan.fertilizer.total > 0 && <SummaryRow label="Fertilizer cost" value={plan.fertilizer.total} />}
          {plan.protection.total > 0 && <SummaryRow label="Crop protection cost" value={plan.protection.total} />}
          {plan.organic.total > 0 && <SummaryRow label="Organic input cost" value={plan.organic.total} />}
          {plan.irrigation.total > 0 && <SummaryRow label="Irrigation cost" value={plan.irrigation.total} />}
          {plan.labour.total > 0 && <SummaryRow label="Labour cost" value={plan.labour.total} />}
          {plan.machinery.total > 0 && <SummaryRow label="Machinery cost" value={plan.machinery.total} />}
          {plan.other.total > 0 && <SummaryRow label="Other cost" value={plan.other.total} />}
          <div style={{ height: 1, background: T.lineSoft, margin: "10px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>Total cultivation cost</span>
            <span style={{ fontFamily: T.display, fontSize: 19, fontWeight: 800, color: T.primary }}>{rupee(plan.totalCost)}</span>
          </div>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <StatBox label="Cost / acre" value={rupee(plan.costPerAcre)} />
          <StatBox label="Cost / hectare" value={rupee(plan.costPerHectare)} />
        </div>
      </Section>

      {showProfitability && (
        <Section title="Estimated profitability" icon="TrendingUp">
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginBottom: 10, display: "flex", gap: 6 }}>
            <Icon name="Info" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            Planning estimate only — not a guaranteed yield, price, or profit.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <StatBox label="Estimated yield" value={`${plan.yield.totalYield.toLocaleString("en-IN")}`} sub="total, this area" />
            <StatBox label="Estimated revenue" value={rupee(plan.revenue.total)} />
            <StatBox label="Estimated profit" value={rupee(plan.profit.gross)} fg={plan.profit.gross >= 0 ? T.primary : T.red} />
            <StatBox label="ROI" value={roi === null ? "—" : `${roi}%`} fg={roiColor} />
            <StatBox label="Cost / kg (or unit)" value={plan.costPerKg === null ? "—" : rupee(plan.costPerKg)} />
            <StatBox label="Break-even price" value={plan.breakEven.breakEvenPrice === null ? "—" : rupee(plan.breakEven.breakEvenPrice)} sub="₹ needed / unit to cover cost" />
          </div>
        </Section>
      )}
    </>
  );
}
