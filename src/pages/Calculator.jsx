import { useState, useMemo } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { rupee } from "../utils/format.js";

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const qty = (n) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/* Each calculator: fields (number inputs) + a compute() returning result rows.
   Rows with a null value are dropped, so "cost" rows appear only when a price
   is entered. Everything runs on-device — no network, no dependencies. */
export const CALCS = {
  emi: {
    icon: "Landmark", accent: "blue",
    title: { en: "Loan EMI", hi: "ऋण EMI", bn: "ঋণ EMI" },
    blurb: { en: "Estimate the monthly instalment on a farm loan.", hi: "खेती ऋण की मासिक किस्त का अनुमान लगाएँ।", bn: "কৃষি ঋণের মাসিক কিস্তি অনুমান করুন।" },
    fields: [
      { key: "P", label: { en: "Loan amount (₹)", hi: "ऋण राशि (₹)", bn: "ঋণের পরিমাণ (₹)" }, ph: "100000" },
      { key: "rate", label: { en: "Interest rate (% per year)", hi: "ब्याज दर (% प्रति वर्ष)", bn: "সুদের হার (% প্রতি বছর)" }, ph: "10" },
      { key: "months", label: { en: "Tenure (months)", hi: "अवधि (महीने)", bn: "মেয়াদ (মাস)" }, ph: "36" },
    ],
    compute: ({ P, rate, months }) => {
      if (P == null || months == null || months <= 0) return null;
      const r = (rate ?? 0) / 12 / 100;
      const emi = r > 0 ? (P * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1) : P / months;
      const total = emi * months;
      return [
        { label: { en: "Monthly EMI", hi: "मासिक EMI", bn: "মাসিক EMI" }, value: rupee(Math.round(emi)), primary: true },
        { label: { en: "Total payable", hi: "कुल भुगतान", bn: "মোট প্রদেয়" }, value: rupee(Math.round(total)) },
        { label: { en: "Total interest", hi: "कुल ब्याज", bn: "মোট সুদ" }, value: rupee(Math.round(total - P)) },
      ];
    },
  },

  profit: {
    icon: "TrendingUp", accent: "primary",
    title: { en: "Profit", hi: "मुनाफा", bn: "মুনাফা" },
    blurb: { en: "Revenue minus cost, with margin and per-acre profit.", hi: "आय में से लागत घटाकर मार्जिन और प्रति एकड़ मुनाफा।", bn: "আয় থেকে খরচ বাদ দিয়ে মার্জিন ও একর প্রতি মুনাফা।" },
    fields: [
      { key: "revenue", label: { en: "Total revenue (₹)", hi: "कुल आय (₹)", bn: "মোট আয় (₹)" }, ph: "80000" },
      { key: "cost", label: { en: "Total cost (₹)", hi: "कुल लागत (₹)", bn: "মোট খরচ (₹)" }, ph: "50000" },
      { key: "acres", label: { en: "Area (acres, optional)", hi: "क्षेत्रफल (एकड़, वैकल्पिक)", bn: "এলাকা (একর, ঐচ্ছিক)" }, ph: "2" },
    ],
    compute: ({ revenue, cost, acres }) => {
      if (revenue == null || cost == null) return null;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const rows = [
        { label: { en: "Profit", hi: "मुनाफा", bn: "মুনাফা" }, value: rupee(Math.round(profit)), primary: true, negative: profit < 0 },
        { label: { en: "Margin", hi: "मार्जिन", bn: "মার্জিন" }, value: `${margin.toFixed(1)}%` },
      ];
      if (acres && acres > 0) rows.push({ label: { en: "Profit / acre", hi: "प्रति एकड़ मुनाफा", bn: "একর প্রতি মুনাফা" }, value: rupee(Math.round(profit / acres)) });
      return rows;
    },
  },

  feed: {
    icon: "Package", accent: "orange",
    title: { en: "Feed cost", hi: "चारा खर्च", bn: "খাদ্য খরচ" },
    blurb: { en: "Total feed cost for your livestock over a period.", hi: "एक अवधि में पशुओं का कुल चारा खर्च।", bn: "একটি সময়কালে পশুদের মোট খাদ্য খরচ।" },
    fields: [
      { key: "animals", label: { en: "Number of animals", hi: "पशुओं की संख्या", bn: "পশুর সংখ্যা" }, ph: "10" },
      { key: "kg", label: { en: "Feed per animal / day (kg)", hi: "प्रति पशु/दिन चारा (kg)", bn: "প্রতি পশু/দিন খাদ্য (kg)" }, ph: "5" },
      { key: "price", label: { en: "Feed price (₹/kg)", hi: "चारा भाव (₹/kg)", bn: "খাদ্য দর (₹/kg)" }, ph: "25" },
      { key: "days", label: { en: "Number of days", hi: "दिनों की संख्या", bn: "দিনের সংখ্যা" }, ph: "30" },
    ],
    compute: ({ animals, kg, price, days }) => {
      if (animals == null || kg == null || price == null || days == null) return null;
      const perDay = animals * kg * price;
      return [
        { label: { en: "Total feed cost", hi: "कुल चारा खर्च", bn: "মোট খাদ্য খরচ" }, value: rupee(Math.round(perDay * days)), primary: true },
        { label: { en: "Cost per day", hi: "प्रतिदिन खर्च", bn: "দৈনিক খরচ" }, value: rupee(Math.round(perDay)) },
        { label: { en: "Total feed", hi: "कुल चारा", bn: "মোট খাদ্য" }, value: `${qty(animals * kg * days)} kg` },
      ];
    },
  },

  seed: {
    icon: "Sprout", accent: "yellow",
    title: { en: "Seed rate", hi: "बीज दर", bn: "বীজ হার" },
    blurb: { en: "How much seed you need for your field, and its cost.", hi: "खेत के लिए कितना बीज चाहिए और उसकी लागत।", bn: "আপনার জমির জন্য কত বীজ লাগবে ও তার খরচ।" },
    fields: [
      { key: "acres", label: { en: "Area (acres)", hi: "क्षेत्रफल (एकड़)", bn: "এলাকা (একর)" }, ph: "2" },
      { key: "rate", label: { en: "Seed rate (kg / acre)", hi: "बीज दर (kg / एकड़)", bn: "বীজ হার (kg / একর)" }, ph: "20" },
      { key: "price", label: { en: "Seed price (₹/kg, optional)", hi: "बीज भाव (₹/kg, वैकल्पिक)", bn: "বীজ দর (₹/kg, ঐচ্ছিক)" }, ph: "40" },
    ],
    compute: ({ acres, rate, price }) => {
      if (acres == null || rate == null) return null;
      const total = acres * rate;
      const rows = [{ label: { en: "Total seed needed", hi: "कुल बीज आवश्यक", bn: "মোট বীজ প্রয়োজন" }, value: `${qty(total)} kg`, primary: true }];
      if (price && price > 0) rows.push({ label: { en: "Total seed cost", hi: "कुल बीज लागत", bn: "মোট বীজ খরচ" }, value: rupee(Math.round(total * price)) });
      return rows;
    },
  },

  fert: {
    icon: "Leaf", accent: "primary",
    title: { en: "Fertilizer", hi: "खाद", bn: "সার" },
    blurb: { en: "Total fertilizer and number of bags for your field.", hi: "खेत के लिए कुल खाद और बोरों की संख्या।", bn: "আপনার জমির জন্য মোট সার ও বস্তার সংখ্যা।" },
    fields: [
      { key: "acres", label: { en: "Area (acres)", hi: "क्षेत्रफल (एकड़)", bn: "এলাকা (একর)" }, ph: "2" },
      { key: "dose", label: { en: "Dose (kg / acre)", hi: "मात्रा (kg / एकड़)", bn: "মাত্রা (kg / একর)" }, ph: "50" },
      { key: "bag", label: { en: "Bag size (kg)", hi: "बोरी का आकार (kg)", bn: "বস্তার আকার (kg)" }, ph: "50" },
      { key: "price", label: { en: "Price per bag (₹, optional)", hi: "प्रति बोरी भाव (₹, वैकल्पिक)", bn: "প্রতি বস্তা দর (₹, ঐচ্ছিক)" }, ph: "1350" },
    ],
    compute: ({ acres, dose, bag, price }) => {
      if (acres == null || dose == null) return null;
      const total = acres * dose;
      const bags = bag && bag > 0 ? total / bag : null;
      const rows = [{ label: { en: "Total fertilizer", hi: "कुल खाद", bn: "মোট সার" }, value: `${qty(total)} kg`, primary: true }];
      if (bags != null) rows.push({ label: { en: "Bags needed", hi: "आवश्यक बोरियाँ", bn: "প্রয়োজনীয় বস্তা" }, value: qty(Math.ceil(bags)) });
      if (bags != null && price && price > 0) rows.push({ label: { en: "Total cost", hi: "कुल लागत", bn: "মোট খরচ" }, value: rupee(Math.round(Math.ceil(bags) * price)) });
      return rows;
    },
  },

  yield: {
    icon: "BarChart3", accent: "red",
    title: { en: "Yield", hi: "उपज", bn: "ফলন" },
    blurb: { en: "Yield per acre from your total production, and its value.", hi: "कुल उत्पादन से प्रति एकड़ उपज और उसका मूल्य।", bn: "মোট উৎপাদন থেকে একর প্রতি ফলন ও তার মূল্য।" },
    fields: [
      { key: "prod", label: { en: "Total production (quintal)", hi: "कुल उत्पादन (क्विंटल)", bn: "মোট উৎপাদন (কুইন্টাল)" }, ph: "40" },
      { key: "acres", label: { en: "Area (acres)", hi: "क्षेत्रफल (एकड़)", bn: "এলাকা (একর)" }, ph: "2" },
      { key: "price", label: { en: "Price (₹/quintal, optional)", hi: "भाव (₹/क्विंटल, वैकल्पिक)", bn: "দর (₹/কুইন্টাল, ঐচ্ছিক)" }, ph: "2300" },
    ],
    compute: ({ prod, acres, price }) => {
      if (prod == null || acres == null || acres <= 0) return null;
      const perAcre = prod / acres;
      const rows = [{ label: { en: "Yield per acre", hi: "प्रति एकड़ उपज", bn: "একর প্রতি ফলন" }, value: `${qty(perAcre)} qtl`, primary: true }];
      if (price && price > 0) rows.push({ label: { en: "Total value", hi: "कुल मूल्य", bn: "মোট মূল্য" }, value: rupee(Math.round(prod * price)) });
      return rows;
    },
  },
};

export default function Calculator({ id = "emi" }) {
  const { pop, tc } = useApp();
  const calc = CALCS[id] || CALCS.emi;
  const [vals, setVals] = useState({});

  const results = useMemo(() => {
    const parsed = {};
    for (const f of calc.fields) parsed[f.key] = num(vals[f.key]);
    return calc.compute(parsed);
  }, [vals, calc]);

  return (
    <>
      <AppBar title={tc(calc.title)} onBack={pop} />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 16, animation: "ag-fade .25s var(--ag-ease)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: `var(--ag-${calc.accent}-soft, ${T.primarySoft})`, color: `var(--ag-${calc.accent}, ${T.primary})`, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon name={calc.icon} size={24} />
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5 }}>{tc(calc.blurb)}</div>
        </div>

        <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {calc.fields.map((f) => (
            <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft }}>{tc(f.label)}</label>
              <input type="number" inputMode="decimal" value={vals[f.key] ?? ""} placeholder={f.ph}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                style={{ width: "100%", padding: "12px 14px", borderRadius: T.rMd, border: `1px solid ${T.line}`,
                  background: T.surface2, color: T.ink, fontFamily: T.body, fontSize: 15, outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
        </Card>

        {results ? (
          <Card style={{ display: "flex", flexDirection: "column", gap: 2, background: T.primarySoft, border: "none" }}>
            {results.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
                padding: r.primary ? "4px 0 10px" : "8px 0", borderTop: i && !results[i - 1].primary ? `1px solid ${T.primary}22` : "none" }}>
                <span style={{ fontSize: r.primary ? 14 : 13, fontWeight: r.primary ? 700 : 500, color: r.primary ? T.primary : T.inkSoft }}>{tc(r.label)}</span>
                <span style={{ fontFamily: T.display, fontSize: r.primary ? 24 : 15, fontWeight: r.primary ? 800 : 700,
                  color: r.negative ? T.red : r.primary ? T.primary : T.ink }}>{r.value}</span>
              </div>
            ))}
          </Card>
        ) : (
          <div style={{ textAlign: "center", fontSize: 13, color: T.inkFaint, padding: "12px 0" }}>
            {tc({ en: "Enter values above to see the result.", hi: "परिणाम देखने के लिए ऊपर मान भरें।", bn: "ফলাফল দেখতে উপরে মান লিখুন।" })}
          </div>
        )}

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6, padding: "0 8px" }}>
          {tc({ en: "Estimates for planning only. Actual figures vary by variety, market and conditions.",
            hi: "केवल योजना के लिए अनुमान। वास्तविक आँकड़े किस्म, बाज़ार और परिस्थितियों पर निर्भर करते हैं।",
            bn: "শুধু পরিকল্পনার জন্য অনুমান। প্রকৃত সংখ্যা জাত, বাজার ও পরিস্থিতি অনুযায়ী পরিবর্তিত হয়।" })}
        </div>
      </div>
    </>
  );
}
