/* Dependency-free SVG charts for the weather dashboard. No chart library — keeps
   the bundle light for rural connections. Renders React/SVG elements only. */
import { T } from "../theme/ThemeProvider.jsx";
import { useApp } from "../store/AppStore.jsx";

/* Smooth-ish line chart with an optional area fill. `data` = [{ label, value }]. */
export function LineChart({ data = [], height = 120, color = T.blue, fill = true, unit = "" }) {
  const { tc } = useApp();
  if (data.length < 2) return null;
  const W = 320, H = height, padX = 8, padY = 18;
  const values = data.map((d) => d.value).filter((v) => v != null);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;

  const x = (i) => padX + (i * (W - padX * 2)) / (data.length - 1);
  const y = (v) => padY + (1 - (v - min) / span) * (H - padY * 2);

  const pts = data.map((d, i) => [x(i), y(d.value)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - padY} L${pts[0][0].toFixed(1)},${H - padY} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={tc({ en: "Trend chart", hi: "रुझान चार्ट", bn: "প্রবণতা চার্ট" })}>
      {fill && <path d={area} fill={color} opacity="0.12" />}
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          {(i === 0 || i === pts.length - 1 || data[i].peak) && (
            <>
              <circle cx={p[0]} cy={p[1]} r="2.6" fill={color} />
              <text x={p[0]} y={p[1] - 6} fontSize="9" fill={T.inkSoft} textAnchor="middle">
                {Math.round(data[i].value)}{unit}
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

/* Bar chart for rainfall / discrete data. `data` = [{ label, value }]. */
export function BarChart({ data = [], height = 100, color = T.blue, unit = "" }) {
  const { tc } = useApp();
  if (!data.length) return null;
  const W = 320, H = height, padX = 12, padY = 16;
  const max = Math.max(1, ...data.map(d => d.value ?? 0));
  const barW = Math.min(24, (W - padX * 2) / data.length - 4);
  const gap = (W - padX * 2 - barW * data.length) / Math.max(1, data.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={tc({ en: "Bar chart", hi: "बार चार्ट", bn: "বার চার্ট" })}>
      {data.map((d, i) => {
        const bh = Math.max(1, ((d.value ?? 0) / max) * (H - padY * 2));
        const bx = padX + i * (barW + gap);
        const by = H - padY - bh;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={barW} height={bh} rx={Math.min(4, barW / 2)} fill={color} opacity="0.75" />
            {d.value > 0 && (
              <text x={bx + barW / 2} y={by - 4} fontSize="8" fill={T.inkSoft} textAnchor="middle">
                {Math.round(d.value)}{unit}
              </text>
            )}
            {d.label && (
              <text x={bx + barW / 2} y={H - 3} fontSize="7.5" fill={T.inkFaint} textAnchor="middle">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
