/**
 * AgriOS India — Desktop Satellite Geo-Mapping & Weather Radar
 * Lightweight, dependency-free vector satellite grid and field telemetry hub
 * engineered for desktop workstations and rural low-latency connections.
 */
import { useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { useApp } from "../../store/AppStore.jsx";
import Icon from "../Icon.jsx";

/**
 * Pure helper to estimate Normalized Difference Vegetation Index (NDVI)
 * based on crop presence and soil condition.
 */
export function calculateNDVIIndex(currentCrop, soilType = "") {
  if (!currentCrop) {
    return { score: 0.18, label: "Fallow / Bare Soil", level: "low", color: "#94a3b8" };
  }
  const crop = currentCrop.toLowerCase();
  let base = 0.65;
  if (crop.includes("paddy") || crop.includes("rice")) base = 0.82;
  else if (crop.includes("wheat") || crop.includes("corn") || crop.includes("maize")) base = 0.78;
  else if (crop.includes("mustard") || crop.includes("oilseed")) base = 0.72;
  else if (crop.includes("pulse") || crop.includes("gram") || crop.includes("lentil")) base = 0.68;

  if (soilType.toLowerCase().includes("alluvial") || soilType.toLowerCase().includes("loam")) base += 0.06;
  if (soilType.toLowerCase().includes("sandy")) base -= 0.05;

  const score = Math.min(0.95, Math.max(0.15, Number(base.toFixed(2))));
  if (score >= 0.75) return { score, label: "Dense / High Vigour", level: "high", color: "#16a34a" };
  if (score >= 0.5) return { score, label: "Moderate Vegetative", level: "moderate", color: "#84cc16" };
  return { score, label: "Sparse Vegetation", level: "sparse", color: "#eab308" };
}

/**
 * Pure helper to compute spray & field work risk from precipitation & wind
 */
export function computePrecipitationRisk(rainProb = 0, windSpeedKph = 0) {
  const prob = Number(rainProb) || 0;
  const wind = Number(windSpeedKph) || 0;

  if (prob > 60 || wind > 25) {
    return { status: "poor", label: "Spray Not Recommended", color: T.danger, icon: "AlertTriangle" };
  }
  if (prob > 30 || wind > 18) {
    return { status: "moderate", label: "Caution / Borderline Window", color: T.orange, icon: "AlertCircle" };
  }
  return { status: "ideal", label: "Optimal Spray Window", color: T.primary, icon: "CheckCircle2" };
}

/**
 * Pure helper to compute deterministic polygon coordinates for field rendering
 */
export function computeFieldGeometry(parcels = [], width = 500, height = 320) {
  if (!parcels || !parcels.length) return [];
  const pad = 24;
  const availW = width - pad * 2;
  const availH = height - pad * 2;

  const cols = Math.min(3, Math.ceil(Math.sqrt(parcels.length)));
  const rows = Math.ceil(parcels.length / cols);
  const cellW = availW / cols;
  const cellH = availH / rows;

  return parcels.map((p, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x0 = pad + col * cellW + 6;
    const y0 = pad + row * cellH + 6;
    const w = cellW - 12;
    const h = cellH - 12;

    // Subtly angle polygon vertices to simulate natural agrarian field plot borders
    const p1 = [x0 + 4, y0 + 3];
    const p2 = [x0 + w - 3, y0 + 6];
    const p3 = [x0 + w - 5, y0 + h - 4];
    const p4 = [x0 + 2, y0 + h - 2];
    const path = `M${p1.join(",")} L${p2.join(",")} L${p3.join(",")} L${p4.join(",")} Z`;
    const cx = x0 + w / 2;
    const cy = y0 + h / 2;

    return { ...p, path, cx, cy, x0, y0, w, h };
  });
}

/**
 * Interactive Desktop Satellite Field Map Canvas
 */
export function SatelliteFieldMap({
  parcels = [],
  selectedId = null,
  onSelectParcel = () => {},
  farmCoords = { lat: 22.5726, lon: 88.3639 },
}) {
  const { tc } = useApp();
  const [hoveredId, setHoveredId] = useState(null);

  const W = 520;
  const H = 340;
  const geometries = computeFieldGeometry(parcels, W, H);
  const activeParcel = parcels.find((p) => p.id === (hoveredId || selectedId)) || parcels[0];
  const ndvi = activeParcel ? calculateNDVIIndex(activeParcel.currentCrop, activeParcel.soilType) : null;

  return (
    <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.line}`, overflow: "hidden", boxShadow: T.shadowSm, display: "flex", flexDirection: "column" }}>
      {/* Satellite Canvas Top Control Strip */}
      <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: T.surface2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
            {tc({ en: "Satellite Telemetry & Field Geometry", hi: "उपग्रह टेलीमेट्री एवं खेत ज्यामिति", bn: "স্যাটেলাইট টেলিমেট্রি ও জমির ক্ষেত্রফল" })}
          </span>
        </div>
        <div style={{ fontSize: 11, color: T.inkSoft, fontFamily: T.display, display: "flex", gap: 12 }}>
          <span>LAT: {farmCoords.lat.toFixed(4)}°N</span>
          <span>LON: {farmCoords.lon.toFixed(4)}°E</span>
        </div>
      </div>

      {/* SVG Satellite Grid Canvas */}
      <div style={{ position: "relative", width: "100%", background: "#0b1523" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          role="img"
          aria-label={tc({ en: "Satellite field map", hi: "उपग्रह खेत का नक्शा", bn: "স্যাটেলাইট জমির মানচিত্র" })}
          style={{ display: "block" }}
        >
          <defs>
            {/* Satellite topographic grid pattern */}
            <pattern id="sat-grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
            {/* Field textures */}
            <linearGradient id="crop-healthy" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#15803d" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#166534" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="crop-fallow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#854d0e" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#713f12" stopOpacity="0.7" />
            </linearGradient>
          </defs>

          {/* Background Satellite Grid */}
          <rect width={W} height={H} fill="#0d1b2a" />
          <rect width={W} height={H} fill="url(#sat-grid)" />

          {/* Center Crosshair Marker */}
          <circle cx={W / 2} cy={H / 2} r="60" fill="none" stroke="rgba(34,197,94,0.15)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={W / 2 - 12} y1={H / 2} x2={W / 2 + 12} y2={H / 2} stroke="rgba(34,197,94,0.3)" strokeWidth="1.5" />
          <line x1={W / 2} y1={H / 2 - 12} x2={W / 2} y2={H / 2 + 12} stroke="rgba(34,197,94,0.3)" strokeWidth="1.5" />

          {/* Render Field Polygons */}
          {geometries.map((g) => {
            const isSel = g.id === selectedId;
            const isHov = g.id === hoveredId;
            const hasCrop = Boolean(g.currentCrop);

            return (
              <g
                key={g.id}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredId(g.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onSelectParcel(g.id)}
              >
                {/* Parcel Boundary Polygon */}
                <path
                  d={g.path}
                  fill={hasCrop ? "url(#crop-healthy)" : "url(#crop-fallow)"}
                  stroke={isSel ? "#86efac" : isHov ? "#facc15" : "rgba(255,255,255,0.4)"}
                  strokeWidth={isSel ? "2.6" : isHov ? "2" : "1.2"}
                  style={{ transition: "all 0.2s ease" }}
                />

                {/* Plot Label */}
                <text
                  x={g.cx}
                  y={g.cy - 4}
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="700"
                  textAnchor="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {g.name}
                </text>
                <text
                  x={g.cx}
                  y={g.cy + 9}
                  fill="rgba(255,255,255,0.75)"
                  fontSize="8.5"
                  fontWeight="600"
                  textAnchor="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {g.areaAcres} ac · {g.currentCrop || tc({ en: "Fallow", hi: "परती", bn: "পতিত" })}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Telemetry HUD */}
        {activeParcel && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              right: 12,
              background: "rgba(15, 23, 42, 0.88)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: "10px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              color: "#fff",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#86efac", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="MapPin" size={14} color="#86efac" />
                {activeParcel.name} ({activeParcel.areaAcres} {tc({ en: "acres", hi: "एकड़", bn: "একর" })})
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                {activeParcel.soilType || "Standard Soil"} · {activeParcel.waterSource || "Borewell"}
              </div>
            </div>

            {ndvi && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", fontWeight: 700 }}>
                    {tc({ en: "Vegetation Index (NDVI)", hi: "वनस्पति सूचकांक (NDVI)", bn: "উদ্ভিদ সূচক (NDVI)" })}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: ndvi.color }}>
                    {ndvi.score.toFixed(2)} — {ndvi.label}
                  </div>
                </div>
                <div style={{ width: 36, height: 6, background: "rgba(255,255,255,0.2)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.round(ndvi.score * 100)}%`, height: "100%", background: ndvi.color }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Weather & Precipitation Radar Visualizer Card for Desktop
 */
export function WeatherRadarCard({
  rainProbability = 15,
  windSpeedKph = 12,
  windDirection = "NE",
  tempC = 28,
  humidity = 64,
  title = "",
}) {
  const { tc } = useApp();
  const risk = computePrecipitationRisk(rainProbability, windSpeedKph);

  return (
    <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.line}`, padding: "16px", boxShadow: T.shadowSm }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, display: "flex", alignItems: "center", gap: 7 }}>
          <Icon name="CloudRain" size={16} color={T.primary} />
          {title || tc({ en: "Precipitation & Wind Telemetry", hi: "वर्षा एवं वायु टेलीमेट्री", bn: "বৃষ্টিপাত ও বায়ু টেলিমেট্রি" })}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 9px",
            borderRadius: 6,
            background: `${risk.color}18`,
            color: risk.color,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Icon name={risk.icon} size={13} color={risk.color} />
          {risk.label}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 6 }}>
        <div style={{ background: T.surface2, padding: "10px 12px", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 600 }}>{tc({ en: "Rain Prob.", hi: "वर्षा संभावना", bn: "বৃষ্টির সম্ভাবনা" })}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: rainProbability > 40 ? T.danger : T.ink, marginTop: 2 }}>{rainProbability}%</div>
        </div>
        <div style={{ background: T.surface2, padding: "10px 12px", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 600 }}>{tc({ en: "Wind Speed", hi: "हवा की गति", bn: "বাতাসের গতি" })}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginTop: 2 }}>{windSpeedKph} <span style={{ fontSize: 10 }}>km/h</span></div>
        </div>
        <div style={{ background: T.surface2, padding: "10px 12px", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 600 }}>{tc({ en: "Direction", hi: "दिशा", bn: "দিক" })}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginTop: 2 }}>{windDirection}</div>
        </div>
        <div style={{ background: T.surface2, padding: "10px 12px", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 600 }}>{tc({ en: "Humidity", hi: "आर्द्रता", bn: "আর্দ্রতা" })}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginTop: 2 }}>{humidity}%</div>
        </div>
      </div>
    </div>
  );
}
