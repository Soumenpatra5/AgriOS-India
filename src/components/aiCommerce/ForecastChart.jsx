import { T } from "../../theme/ThemeProvider.jsx";
import { rupee } from "../../utils/format.js";
import { useApp } from "../../store/AppStore.jsx";

/* Price-forecast range bar: shows the seasonal band (low..high), the MSP floor,
   and the predicted point with its ±range — an inline SVG, no external libs. */
export default function ForecastChart({ low, high, msp, predicted, range, unit = "qtl" }) {
  const { tc } = useApp();
  const hasMsp = !!msp;
  const min = Math.min(low, hasMsp ? msp : low, range?.low ?? predicted) * 0.98;
  const max = Math.max(high, range?.high ?? predicted) * 1.02;
  const span = max - min || 1;
  const x = (v) => ((v - min) / span) * 100;
  const W = 100, H = 64;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ overflow: "visible" }}>
        {/* band */}
        <rect x={x(low)} y={20} width={x(high) - x(low)} height={14} rx={3}
          fill={T.primarySoft} />
        {/* predicted range */}
        {range && (
          <rect x={x(range.low)} y={22} width={x(range.high) - x(range.low)} height={10} rx={2}
            fill={T.primary} opacity="0.35" />
        )}
        {/* MSP floor line (only for MSP-backed crops) */}
        {hasMsp && <line x1={x(msp)} y1={14} x2={x(msp)} y2={40} stroke={T.orange} strokeWidth="0.6" strokeDasharray="2 2" />}
        {/* predicted marker */}
        <circle cx={x(predicted)} cy={27} r={3.2} fill={T.primary} stroke="#fff" strokeWidth="1" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T.inkFaint, marginTop: 2 }}>
        <span>Band {rupee(low)}</span>
        {hasMsp ? <span style={{ color: T.orange }}>MSP {rupee(msp)}</span> : <span>{tc({ en: "Market-driven", hi: "बाज़ार-आधारित", bn: "বাজার-নির্ভর" })}</span>}
        <span>{rupee(high)}</span>
      </div>
      <div style={{ textAlign: "center", marginTop: 6 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: T.primary, fontFamily: T.display }}>{rupee(predicted)}</span>
        <span style={{ fontSize: 12, color: T.inkSoft }}>/{unit}</span>
        {range && <span style={{ fontSize: 11, color: T.inkFaint, marginLeft: 6 }}>({rupee(range.low)}–{rupee(range.high)})</span>}
      </div>
    </div>
  );
}
