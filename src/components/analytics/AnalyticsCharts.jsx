/**
 * AgriOS India — Desktop Visual Analytics & Charts Hub
 * Dependency-free, lightweight SVG charts engineered for rural low-latency connections
 * and high-resolution desktop displays.
 */
import { useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { useApp } from "../../store/AppStore.jsx";
import Icon from "../Icon.jsx";

/**
 * Pure calculation helper for SVG trend points
 */
export function computeTrendPoints(data = [], { width = 500, height = 150, padL = 28, padR = 24, padT = 24, padB = 26 } = {}) {
  if (!data || data.length < 2) return null;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const primValues = data.map((d) => Number(d.value) || 0);
  const hasSec = data.some((d) => d.secondaryValue != null);
  const secValues = hasSec ? data.map((d) => Number(d.secondaryValue) || 0) : [];
  const allValues = [...primValues, ...secValues];

  const min = Math.min(0, ...allValues);
  const max = Math.max(1, ...allValues);
  const span = max - min || 1;

  const getX = (i) => padL + (i * chartW) / (data.length - 1);
  const getY = (v) => padT + (1 - (v - min) / span) * chartH;

  const primPts = data.map((d, i) => [getX(i), getY(Number(d.value) || 0)]);
  const primLine = primPts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const primArea = `${primLine} L${primPts[primPts.length - 1][0].toFixed(1)},${height - padB} L${primPts[0][0].toFixed(1)},${height - padB} Z`;

  let secPts = [];
  let secLine = "";
  if (hasSec) {
    secPts = data.map((d, i) => [getX(i), getY(Number(d.secondaryValue) || 0)]);
    secLine = secPts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  }

  const total = primValues.reduce((s, v) => s + v, 0);
  const avg = total / primValues.length;
  const peak = Math.max(...primValues);

  return { primPts, primLine, primArea, secPts, secLine, min, max, span, total, avg, peak, getX, getY, chartW, chartH };
}

/**
 * Pure calculation helper for grouped bar metrics
 */
export function computeBarMetrics(items = [], { width = 460, height = 160, padL = 20, padR = 20, padT = 20, padB = 24 } = {}) {
  if (!items || !items.length) return null;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const maxVal = Math.max(1, ...items.flatMap((it) => [Number(it.primary) || 0, Number(it.secondary) || 0]));
  const groupW = chartW / items.length;
  const barW = Math.min(22, (groupW - 14) / 2);

  const bars = items.map((it, idx) => {
    const gx = padL + idx * groupW + groupW / 2;
    const pVal = Number(it.primary) || 0;
    const sVal = Number(it.secondary) || 0;

    const ph = Math.max(2, (pVal / maxVal) * chartH);
    const sh = Math.max(2, (sVal / maxVal) * chartH);

    const px = gx - barW - 2;
    const py = height - padB - ph;
    const sx = gx + 2;
    const sy = height - padB - sh;

    return { label: it.label, px, py, ph, sx, sy, sh, barW, gx, pVal, sVal };
  });

  return { maxVal, chartW, chartH, groupW, barW, bars };
}

/**
 * Pure calculation helper for category distribution percentages
 */
export function computeCategoryMeters(categories = []) {
  if (!categories || !categories.length) return [];
  const total = categories.reduce((s, c) => s + (Number(c.total) || 0), 0);
  return categories.map((c) => ({
    ...c,
    pct: total > 0 ? Math.round(((Number(c.total) || 0) / total) * 100) : (c.pct || 0),
  }));
}

/**
 * Interactive SVG trend chart supporting single or dual series (e.g. AM/PM milk yield, or Eggs & Feed)
 */
export function AnalyticsTrendChart({
  data = [],
  height = 150,
  primaryColor = T.primary,
  secondaryColor = T.blue,
  primaryLabel = "Series 1",
  secondaryLabel = "",
  unit = "",
  title = "",
}) {
  const { tc } = useApp();
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const metrics = computeTrendPoints(data, { width: 500, height, padL: 28, padR: 24, padT: 24, padB: 26 });
  if (!metrics) return null;

  const { primPts, primLine, primArea, secPts, secLine, max, span, avg, peak, getX, chartW, chartH } = metrics;
  const W = 500;
  const H = height;
  const padL = 28;
  const padR = 24;
  const padT = 24;
  const padB = 26;

  const activeItem = hoveredIdx !== null ? data[hoveredIdx] : data[data.length - 1];
  const activeX = hoveredIdx !== null ? getX(hoveredIdx) : getX(data.length - 1);

  return (
    <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, padding: "14px 18px", boxShadow: T.shadowSm }}>
      {/* Header & Stats Strip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
        <div>
          {title && <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{title}</div>}
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 4, fontSize: 11, color: T.inkSoft }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: primaryColor }} />
              {primaryLabel}
            </span>
            {secondaryLabel && (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: secondaryColor }} />
                {secondaryLabel}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: T.inkFaint, fontWeight: 600, textTransform: "uppercase" }}>
              {tc({ en: "Average", hi: "औसत", bn: "গড়" })}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
              {avg.toFixed(1)} {unit}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: T.inkFaint, fontWeight: 600, textTransform: "uppercase" }}>
              {tc({ en: "Peak", hi: "शीर्ष", bn: "সর্বোচ্চ" })}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: primaryColor }}>
              {peak.toFixed(1)} {unit}
            </div>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ position: "relative", width: "100%" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="none"
          role="img"
          aria-label={tc({ en: "Analytics trend chart", hi: "एनालिटिक्स रुझान चार्ट", bn: "অ্যানালিটিক্স ট্রেন্ড চার্ট" })}
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id={`grad-${primaryColor.replace("#", "")}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={primaryColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.5, 1].map((pct, idx) => {
            const gy = padT + pct * chartH;
            const val = max - pct * span;
            return (
              <g key={idx}>
                <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke={T.line} strokeDasharray="3 3" strokeWidth="1" />
                <text x={padL - 4} y={gy + 3} fontSize="8.5" fill={T.inkFaint} textAnchor="end">
                  {Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* Primary Area & Line */}
          <path d={primArea} fill={`url(#grad-${primaryColor.replace("#", "")})`} />
          <path d={primLine} fill="none" stroke={primaryColor} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />

          {/* Secondary Line if dual series */}
          {secondaryLabel && (
            <path d={secLine} fill="none" stroke={secondaryColor} strokeWidth="2" strokeDasharray="4 2" strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* Vertical tracking indicator */}
          <line
            x1={activeX}
            y1={padT}
            x2={activeX}
            y2={H - padB}
            stroke={T.inkFaint}
            strokeWidth="1.2"
            strokeDasharray="2 2"
          />

          {/* Hover points & Interactive targets */}
          {primPts.map((p, i) => (
            <g key={i}>
              <rect
                x={p[0] - chartW / (data.length * 2)}
                y={padT}
                width={chartW / data.length}
                height={chartH}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
              {(i === hoveredIdx || (hoveredIdx === null && i === data.length - 1)) && (
                <>
                  <circle cx={p[0]} cy={p[1]} r="4.5" fill="#fff" stroke={primaryColor} strokeWidth="2.5" />
                  {secondaryLabel && secPts[i] && (
                    <circle cx={secPts[i][0]} cy={secPts[i][1]} r="3.5" fill="#fff" stroke={secondaryColor} strokeWidth="2" />
                  )}
                </>
              )}
            </g>
          ))}

          {/* X-axis date labels */}
          {data.map((d, i) => {
            const step = Math.max(1, Math.floor(data.length / 6));
            if (i % step !== 0 && i !== data.length - 1) return null;
            return (
              <text key={i} x={getX(i)} y={H - 8} fontSize="9" fill={T.inkSoft} textAnchor="middle">
                {d.label || d.date}
              </text>
            );
          })}
        </svg>

        {/* Floating Tooltip Pill */}
        {activeItem && (
          <div
            style={{
              position: "absolute",
              top: 4,
              left: Math.min(Math.max(activeX - 45, 10), 380),
              background: T.ink,
              color: "#fff",
              padding: "4px 8px",
              borderRadius: 6,
              fontSize: 10.5,
              fontWeight: 600,
              pointerEvents: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              whiteSpace: "nowrap",
              zIndex: 5,
            }}
          >
            <span>{activeItem.date || activeItem.label}: </span>
            <span style={{ color: "#86efac" }}>{Number(activeItem.value || 0).toFixed(1)} {unit}</span>
            {secondaryLabel && activeItem.secondaryValue != null && (
              <span style={{ color: "#93c5fd", marginLeft: 6 }}>({Number(activeItem.secondaryValue).toFixed(1)} {unit})</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Grouped comparison bar chart (e.g. Month-on-Month Income vs Expense)
 */
export function AnalyticsBarComparison({
  items = [],
  height = 160,
  primaryLabel = "Income",
  secondaryLabel = "Expense",
  primaryColor = T.primary,
  secondaryColor = T.danger,
  unit: _unit = "₹",
  title = "",
}) {
  const { tc } = useApp();
  const metrics = computeBarMetrics(items, { width: 460, height, padL: 20, padR: 20, padT: 20, padB: 24 });
  if (!metrics) return null;

  const { bars, barW } = metrics;
  const W = 460;
  const H = height;

  return (
    <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, padding: "14px 18px", boxShadow: T.shadowSm }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        {title && <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{title}</div>}
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: T.inkSoft }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: primaryColor }} />
            {primaryLabel}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: secondaryColor }} />
            {secondaryLabel}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label={tc({ en: "Comparison bar chart", hi: "तुलना बार चार्ट", bn: "তুলনা বার চার্ট" })}
      >
        {bars.map((b, idx) => (
          <g key={idx}>
            {/* Primary bar */}
            <rect x={b.px} y={b.py} width={barW} height={b.ph} rx="3" fill={primaryColor} opacity="0.85" />
            {/* Secondary bar */}
            <rect x={b.sx} y={b.sy} width={barW} height={b.sh} rx="3" fill={secondaryColor} opacity="0.85" />

            {/* Group label */}
            <text x={b.gx} y={H - 8} fontSize="9.5" fill={T.inkMid} fontWeight="600" textAnchor="middle">
              {b.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * Visual category distribution breakdown with colored progress meters
 */
export function AnalyticsCategoryBreakdown({
  title = "Spending Breakdown",
  categories = [],
  totalAmount = 0,
  prefix = "₹",
  unit = "",
}) {
  const { tc: _tc } = useApp();
  const meters = computeCategoryMeters(categories);
  if (!meters.length) return null;

  return (
    <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, padding: "16px", boxShadow: T.shadowSm }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, display: "flex", alignItems: "center", gap: 7 }}>
          <Icon name="PieChart" size={16} color={T.primary} />
          {title}
        </div>
        {totalAmount > 0 && (
          <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, fontFamily: T.display }}>
            {prefix}{Number(totalAmount).toLocaleString("en-IN")}{unit ? ` ${unit}` : ""}
          </div>
        )}
      </div>

      {/* Stacked single meter */}
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: T.surface2, marginBottom: 14 }}>
        {meters.map((c, i) => {
          const colors = [T.primary, T.blue, T.orange, "#8b5cf6", "#ec4899", "#14b8a6", T.inkFaint];
          const barColor = colors[i % colors.length];
          return (
            <div
              key={c.categoryId || i}
              style={{
                width: `${c.pct || 0}%`,
                background: barColor,
                transition: "width 0.3s ease",
              }}
              title={`${c.label}: ${c.pct}% (${prefix}${c.total}${unit ? ` ${unit}` : ""})`}
            />
          );
        })}
      </div>

      {/* Individual category items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {meters.slice(0, 6).map((c, i) => {
          const colors = [T.primary, T.blue, T.orange, "#8b5cf6", "#ec4899", "#14b8a6", T.inkFaint];
          const dotColor = colors[i % colors.length];
          return (
            <div key={c.categoryId || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                <span style={{ color: T.ink, fontWeight: 600 }}>{c.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: T.inkSoft, fontSize: 11 }}>{c.pct}%</span>
                <span style={{ color: T.ink, fontWeight: 700 }}>{prefix}{Number(c.total).toLocaleString("en-IN")}{unit ? ` ${unit}` : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
