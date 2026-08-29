/* Experiment comparison — the screen ExperimentList's "Compare →" has always
   pushed. The kind was never registered and no page existed, so the button
   pushed a blank screen. Follows CropPlanCompare: one scrollable table, the
   metric column pinned, differing values called out. */

import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen, Card } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";

const STATUS_COLOR = {
  completed: "primary",
  running:   "blue",
  failed:    "red",
  created:   "inkSoft",
};

/* Every key present on any of the experiments, so a value missing from one run
   shows as a gap rather than silently dropping the whole row. */
function unionKeys(list, field) {
  const keys = new Set();
  list.forEach((e) => Object.keys(e?.[field] || {}).forEach((k) => keys.add(k)));
  return [...keys].sort();
}

const show = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("en-IN") : v.toString();
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/* A row is only interesting if the runs disagree — that is what a comparison is
   for, so those get emphasised and identical rows stay quiet. */
const differs = (vals) => new Set(vals.map((v) => JSON.stringify(v ?? null))).size > 1;

export default function ExperimentComparison({ experiments = [] }) {
  const { pop, tc } = useApp();
  const title = tc({ en: "Compare experiments", hi: "प्रयोगों की तुलना", bn: "পরীক্ষার তুলনা" });

  if (!experiments.length) {
    return (
      <>
        <AppBar title={title} onBack={pop} />
        <Screen>
          <Card pad={20}>
            <div style={{ textAlign: "center", color: T.inkSoft, fontSize: 13 }}>
              {tc({ en: "Nothing to compare — pick at least two experiments.",
                    hi: "तुलना के लिए कुछ नहीं — कम से कम दो प्रयोग चुनें।",
                    bn: "তুলনা করার কিছু নেই — অন্তত দুটি পরীক্ষা বাছুন।" })}
            </div>
          </Card>
        </Screen>
      </>
    );
  }

  const metricKeys = unionKeys(experiments, "finalMetrics");
  const hyperKeys  = unionKeys(experiments, "hyperparams");
  const paramKeys  = unionKeys(experiments, "params");

  const cell = { padding: "9px 12px", fontSize: 12.5, borderBottom: `1px solid ${T.lineSoft}`, whiteSpace: "nowrap" };
  const headCell = { ...cell, fontWeight: 700, color: T.inkSoft, background: T.surface2, textAlign: "left" };
  const stickyCol = { position: "sticky", left: 0, background: T.bg, zIndex: 1 };

  const Section = ({ label, keys, field }) => {
    if (!keys.length) return null;
    return (
      <>
        <tr>
          <th colSpan={experiments.length + 1}
            style={{ ...headCell, position: "sticky", left: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: .4 }}>
            {label}
          </th>
        </tr>
        {keys.map((k) => {
          const vals = experiments.map((e) => e?.[field]?.[k]);
          const hot = differs(vals);
          return (
            <tr key={`${field}:${k}`}>
              <td style={{ ...cell, ...stickyCol, color: T.inkSoft }}>{k}</td>
              {vals.map((v, i) => (
                <td key={i} style={{ ...cell, textAlign: "right",
                  color: hot ? T.ink : T.inkSoft, fontWeight: hot ? 700 : 400 }}>
                  {show(v)}
                </td>
              ))}
            </tr>
          );
        })}
      </>
    );
  };

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <Screen gap={14}>
        <Card pad={13} style={{ background: T.surface2, border: "none" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <Icon name="Info" size={16} color={T.inkSoft} />
            <div style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: 1.5 }}>
              {tc({ en: "Values that differ between runs are highlighted. A dash means the run did not record that key.",
                    hi: "जिन मानों में अंतर है वे हाइलाइट किए गए हैं। डैश का अर्थ है उस रन में वह मान दर्ज नहीं हुआ।",
                    bn: "রানগুলির মধ্যে যেসব মান আলাদা সেগুলি হাইলাইট করা। ড্যাশ মানে ওই রানে সেই মান রেকর্ড হয়নি।" })}
            </div>
          </div>
        </Card>

        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 150 + experiments.length * 130 }}>
            <thead>
              <tr>
                <th style={{ ...headCell, ...stickyCol, background: T.surface2 }}>
                  {tc({ en: "Field", hi: "मद", bn: "ক্ষেত্র" })}
                </th>
                {experiments.map((e) => (
                  <th key={e.id} style={{ ...headCell, textAlign: "right", color: T.ink }}>{e.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...cell, ...stickyCol, color: T.inkSoft }}>
                  {tc({ en: "Status", hi: "स्थिति", bn: "অবস্থা" })}
                </td>
                {experiments.map((e) => {
                  const col = T[STATUS_COLOR[e.status] || "inkSoft"] || T.inkSoft;
                  return (
                    <td key={e.id} style={{ ...cell, textAlign: "right" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: col,
                        background: `${col}18`, padding: "3px 9px", borderRadius: 999 }}>{e.status}</span>
                    </td>
                  );
                })}
              </tr>

              <Section label={tc({ en: "Results", hi: "परिणाम", bn: "ফলাফল" })} keys={metricKeys} field="finalMetrics" />
              <Section label={tc({ en: "Hyperparameters", hi: "हाइपरपैरामीटर", bn: "হাইপারপ্যারামিটার" })} keys={hyperKeys} field="hyperparams" />
              <Section label={tc({ en: "Parameters", hi: "पैरामीटर", bn: "প্যারামিটার" })} keys={paramKeys} field="params" />
            </tbody>
          </table>
        </div>

        {!metricKeys.length && (
          <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
            {tc({ en: "None of these runs has recorded final metrics yet, so only their inputs can be compared.",
                  hi: "इनमें से किसी रन ने अभी अंतिम मीट्रिक दर्ज नहीं किए, इसलिए केवल इनपुट की तुलना हो सकती है।",
                  bn: "এই রানগুলির কোনওটিই এখনও চূড়ান্ত মেট্রিক রেকর্ড করেনি, তাই কেবল ইনপুট তুলনা করা যাবে।" })}
          </div>
        )}
      </Screen>
    </>
  );
}
