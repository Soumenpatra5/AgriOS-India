/* Feed Calculator — upgrades the original 4-field Feed Cost calculator
   (src/pages/Calculator.jsx CALCS.feed, still intact and reachable
   elsewhere) with livestock type, batch/pond label, and body weight, while
   preserving the exact original formula:
     Total Feed = animals x feed/animal/day x days
     Total Feed Cost = Total Feed x price/kg
   Body weight and batch label are descriptive context only in Phase 1 —
   they aren't required to get a result, matching the "keep the simple
   workflow" rule the rest of this app's calculators follow. */
import { useMemo, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen, Card } from "../../components/index.js";
import { Input, Dropdown } from "../../components/inputs.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { computeFeedCost, LIVESTOCK_TYPES } from "../../services/feed/feedService.js";
import { rupee } from "../../utils/format.js";

const num = (v) => (v === "" || v === null || v === undefined ? "" : v);
const n2 = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

function StatBox({ label, value, sub, fg }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "13px 12px" }}>
      <div style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</div>
      <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: fg || T.ink, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function FeedCalculator() {
  const { pop, push } = useApp();

  const [livestockType, setLivestockType] = useState("");
  const [batchLabel, setBatchLabel] = useState("");
  const [animalCount, setAnimalCount] = useState("");
  const [avgWeight, setAvgWeight] = useState("");
  const [feedPerAnimalPerDay, setFeedPerAnimalPerDay] = useState("");
  const [feedPricePerKg, setFeedPricePerKg] = useState("");
  const [days, setDays] = useState("");

  const result = useMemo(() => computeFeedCost({
    animalCount: n2(animalCount), feedPerAnimalPerDay: n2(feedPerAnimalPerDay),
    feedPricePerKg: n2(feedPricePerKg), days: n2(days),
  }), [animalCount, feedPerAnimalPerDay, feedPricePerKg, days]);

  const hasResult = n2(animalCount) > 0 && n2(feedPerAnimalPerDay) > 0 && n2(feedPricePerKg) > 0 && n2(days) > 0;
  const livestockOptions = [{ value: "", label: "Livestock type (optional)" }, ...LIVESTOCK_TYPES.map((t) => ({ value: t.id, label: t.label }))];

  return (
    <>
      <AppBar title="Feed calculator" onBack={pop} action={
        <button onClick={() => push({ kind: "feedHub" })}
          style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: T.ink, fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          Feed Management
        </button>
      } />
      <Screen gap={18}>
        <Card pad={14}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Dropdown label="Livestock type" value={livestockType} onChange={setLivestockType} options={livestockOptions} />
              <Input label="Batch / pond (optional)" value={batchLabel} onChange={setBatchLabel} placeholder="e.g. Batch #001" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label="Number of animals" value={num(animalCount)} onChange={setAnimalCount} type="number" inputMode="decimal" placeholder="e.g. 80" />
              <Input label="Average body weight (kg, optional)" value={num(avgWeight)} onChange={setAvgWeight} type="number" inputMode="decimal" placeholder="e.g. 1.8" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label="Feed per animal / day (kg)" value={num(feedPerAnimalPerDay)} onChange={setFeedPerAnimalPerDay} type="number" inputMode="decimal" placeholder="e.g. 1.5" />
              <Input label="Feed price (₹/kg)" value={num(feedPricePerKg)} onChange={setFeedPricePerKg} type="number" inputMode="decimal" prefix="₹" placeholder="e.g. 36" />
            </div>
            <Input label="Number of days" value={num(days)} onChange={setDays} type="number" inputMode="decimal" placeholder="e.g. 45" />
          </div>
        </Card>

        {hasResult ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatBox label="Total feed required" value={`${result.totalFeedRequired.toLocaleString("en-IN")} kg`} />
              <StatBox label="Total feed cost" value={rupee(result.totalFeedCost)} fg={T.primary} />
              <StatBox label="Daily feed cost" value={rupee(result.dailyFeedCost)} sub={`${result.totalDailyFeed.toLocaleString("en-IN")} kg/day`} />
              <StatBox label="Feed cost / animal" value={rupee(result.feedCostPerAnimal)} />
              <StatBox label="Est. monthly feed cost" value={rupee(result.estimatedMonthlyFeedCost)} sub="at this daily rate" />
              <StatBox label="Production period cost" value={rupee(result.estimatedProductionPeriodCost)} sub={`over ${n2(days)} days`} />
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", fontSize: 13, color: T.inkFaint, padding: "12px 0" }}>
            Enter animals, feed rate, price and days to see the result.
          </div>
        )}

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          Estimates for planning only. For inventory tracking, purchases, and per-batch FCR, use Feed Management.
        </div>
      </Screen>
    </>
  );
}
