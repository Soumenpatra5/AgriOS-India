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
  const { pop, push, tc } = useApp();

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
  const livestockOptions = [{ value: "", label: tc({ en: "Livestock type (optional)", hi: "पशु प्रकार (वैकल्पिक)", bn: "প্রাণীর ধরন (ঐচ্ছিক)" }) }, ...LIVESTOCK_TYPES.map((t) => ({ value: t.id, label: t.i18n ? tc(t.i18n) : t.label }))];

  return (
    <>
      <AppBar title={tc({ en: "Feed calculator", hi: "चारा कैलकुलेटर", bn: "খাদ্য ক্যালকুলেটর" })} onBack={pop} action={
        <button onClick={() => push({ kind: "feedHub" })}
          style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: T.ink, fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          {tc({ en: "Feed Management", hi: "चारा प्रबंधन", bn: "খাদ্য ব্যবস্থাপনা" })}
        </button>
      } />
      <Screen gap={18}>
        <Card pad={14}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Dropdown label={tc({ en: "Livestock type", hi: "पशु प्रकार", bn: "প্রাণীর ধরন" })} value={livestockType} onChange={setLivestockType} options={livestockOptions} />
              <Input label={tc({ en: "Batch / pond (optional)", hi: "बैच / तालाब (वैकल्पिक)", bn: "ব্যাচ / পুকুর (ঐচ্ছিক)" })} value={batchLabel} onChange={setBatchLabel} placeholder={tc({ en: "e.g. Batch #001", hi: "उदा. बैच #001", bn: "যেমন ব্যাচ #০০১" })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label={tc({ en: "Number of animals", hi: "पशुओं की संख्या", bn: "প্রাণীর সংখ্যা" })} value={num(animalCount)} onChange={setAnimalCount} type="number" inputMode="decimal" placeholder={tc({ en: "e.g. 80", hi: "उदा. 80", bn: "যেমন 80" })} />
              <Input label={tc({ en: "Average body weight (kg, optional)", hi: "औसत वज़न (किग्रा, वैकल्पिक)", bn: "গড় ওজন (কেজি, ঐচ্ছিক)" })} value={num(avgWeight)} onChange={setAvgWeight} type="number" inputMode="decimal" placeholder={tc({ en: "e.g. 1.8", hi: "उदा. 1.8", bn: "যেমন 1.8" })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label={tc({ en: "Feed per animal / day (kg)", hi: "प्रति पशु / दिन चारा (किग्रा)", bn: "প্রতি প্রাণী / দিন খাদ্য (কেজি)" })} value={num(feedPerAnimalPerDay)} onChange={setFeedPerAnimalPerDay} type="number" inputMode="decimal" placeholder={tc({ en: "e.g. 1.5", hi: "उदा. 1.5", bn: "যেমন 1.5" })} />
              <Input label={tc({ en: "Feed price (₹/kg)", hi: "चारा मूल्य (₹/किग्रा)", bn: "খাদ্যের দাম (₹/কেজি)" })} value={num(feedPricePerKg)} onChange={setFeedPricePerKg} type="number" inputMode="decimal" prefix="₹" placeholder={tc({ en: "e.g. 36", hi: "उदा. 36", bn: "যেমন 36" })} />
            </div>
            <Input label={tc({ en: "Number of days", hi: "दिनों की संख्या", bn: "দিনের সংখ্যা" })} value={num(days)} onChange={setDays} type="number" inputMode="decimal" placeholder={tc({ en: "e.g. 45", hi: "उदा. 45", bn: "যেমন 45" })} />
          </div>
        </Card>

        {hasResult ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatBox label={tc({ en: "Total feed required", hi: "कुल आवश्यक चारा", bn: "মোট প্রয়োজনীয় খাদ্য" })} value={`${result.totalFeedRequired.toLocaleString("en-IN")} kg`} />
              <StatBox label={tc({ en: "Total feed cost", hi: "कुल चारा लागत", bn: "মোট খাদ্য ব্যয়" })} value={rupee(result.totalFeedCost)} fg={T.primary} />
              <StatBox label={tc({ en: "Daily feed cost", hi: "दैनिक चारा लागत", bn: "দৈনিক খাদ্য ব্যয়" })} value={rupee(result.dailyFeedCost)} sub={`${result.totalDailyFeed.toLocaleString("en-IN")} ${tc({ en: "kg/day", hi: "किग्रा/दिन", bn: "কেজি/দিন" })}`} />
              <StatBox label={tc({ en: "Feed cost / animal", hi: "प्रति पशु चारा लागत", bn: "প্রতি প্রাণীর খাদ্য ব্যয়" })} value={rupee(result.feedCostPerAnimal)} />
              <StatBox label={tc({ en: "Est. monthly feed cost", hi: "अनुमानित मासिक लागत", bn: "আনুমানিক মাসিক ব্যয়" })} value={rupee(result.estimatedMonthlyFeedCost)} sub={tc({ en: "at this daily rate", hi: "इसी दैनिक दर पर", bn: "এই দৈনিক হারে" })} />
              <StatBox label={tc({ en: "Production period cost", hi: "उत्पादन अवधि लागत", bn: "উৎপাদন সময়ের ব্যয়" })} value={rupee(result.estimatedProductionPeriodCost)} sub={tc({ en: `over ${n2(days)} days`, hi: `${n2(days)} दिनों में`, bn: `${n2(days)} দিনে` })} />
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", fontSize: 13, color: T.inkFaint, padding: "12px 0" }}>
            {tc({ en: "Enter animals, feed rate, price and days to see the result.", hi: "परिणाम देखने के लिए पशु, चारा दर, मूल्य और दिन भरें।", bn: "ফলাফল দেখতে প্রাণী, খাদ্যের হার, দাম ও দিন লিখুন।" })}
          </div>
        )}

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          {tc({ en: "Estimates for planning only. For inventory tracking, purchases, and per-batch FCR, use Feed Management.", hi: "केवल योजना के लिए अनुमान। स्टॉक, खरीद और बैच-वार FCR के लिए चारा प्रबंधन देखें।", bn: "কেবল পরিকল্পনার জন্য অনুমান। মজুত, ক্রয় ও ব্যাচভিত্তিক FCR-এর জন্য খাদ্য ব্যবস্থাপনা দেখুন।" })}
        </div>
      </Screen>
    </>
  );
}
