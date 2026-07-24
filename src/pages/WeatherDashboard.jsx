import { useCallback, useEffect, useRef, useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Screen, Card, EmptyState, ErrorState, Button } from "../components/index.js";
import { LineChart, BarChart } from "../components/chart.jsx";
import { Skeleton } from "../components/feedback.jsx";
import { useApp } from "../store/AppStore.jsx";
import { weatherService } from "../services/weather/weatherService.js";
import { locationService } from "../services/location/locationService.js";
import { computeConfidence, confidencePercent } from "../services/weather/confidence.js";

const SEV = {
  critical: { bg: "#7f1d1d", fg: "#fca5a5" },
  danger: { bg: T.redSoft, fg: T.red },
  warn: { bg: T.orangeSoft, fg: T.orange },
  good: { bg: T.primarySoft, fg: T.primary },
  info: { bg: T.blueSoft, fg: T.blue },
};

const CAT_ICON = {
  spraying: "SprayCan", fertilizer: "Beaker", harvest: "Wheat", sowing: "Sprout",
  irrigation: "Droplets", livestock: "PawPrint", fishPond: "Fish", beekeeping: "Bug",
};
const CAT_LABEL = {
  spraying: { en: "Spraying", hi: "छिड़काव", bn: "স্প্রে" },
  fertilizer: { en: "Fertilizer", hi: "उर्वरक", bn: "সার" },
  harvest: { en: "Harvest", hi: "कटाई", bn: "ফসল কাটা" },
  sowing: { en: "Sowing", hi: "बुआई", bn: "বপন" },
  irrigation: { en: "Irrigation", hi: "सिंचाई", bn: "সেচ" },
  livestock: { en: "Livestock", hi: "पशुधन", bn: "পশুসম্পদ" },
  fishPond: { en: "Fish Pond", hi: "मछली तालाब", bn: "মাছের পুকুর" },
  beekeeping: { en: "Beekeeping", hi: "मधुमक्खी पालन", bn: "মৌমাছি পালন" },
};

const hourLabel = (t, locale) =>
  new Date(t).toLocaleTimeString(locale, { hour: "numeric", hour12: true }).replace(" ", "");
const dayLabel = (t, locale, i, tc) =>
  i === 0 ? tc({ en: "Today", hi: "आज", bn: "আজ" }) : new Date(t).toLocaleDateString(locale, { weekday: "short" });
const windDirLabel = (deg) => {
  if (deg == null) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
};
const moonPhase = (date) => {
  const d = new Date(date);
  const ref = new Date(2000, 0, 6, 18, 14); // known new moon
  const diff = (d - ref) / (1000 * 60 * 60 * 24);
  const phase = ((diff % 29.53) + 29.53) % 29.53;
  if (phase < 1.85) return { en: "New Moon", hi: "अमावस्या", bn: "অমাবস্যা", icon: "🌑" };
  if (phase < 7.38) return { en: "Waxing Crescent", hi: "शुक्ल पक्ष", bn: "শুক্লপক্ষ", icon: "🌒" };
  if (phase < 9.23) return { en: "First Quarter", hi: "प्रथम चतुर्थी", bn: "প্রথম চতুর্থী", icon: "🌓" };
  if (phase < 14.77) return { en: "Waxing Gibbous", hi: "शुक्ल पक्ष", bn: "শুক্লপক্ষ", icon: "🌔" };
  if (phase < 16.61) return { en: "Full Moon", hi: "पूर्णिमा", bn: "পূর্ণিমা", icon: "🌕" };
  if (phase < 22.15) return { en: "Waning Gibbous", hi: "कृष्ण पक्ष", bn: "কৃষ্ণপক্ষ", icon: "🌖" };
  if (phase < 24.0) return { en: "Last Quarter", hi: "अंतिम चतुर्थी", bn: "শেষ চতুর্থী", icon: "🌗" };
  return { en: "Waning Crescent", hi: "कृष्ण पक्ष", bn: "কৃষ্ণপক্ষ", icon: "🌘" };
};

export default function WeatherDashboard() {
  const { pop, push, locale, toast, tc } = useApp();
  const [loc, setLoc] = useState(() => locationService.getActive());
  const [state, setState] = useState({ status: "idle", data: null, alerts: [], advice: [], stale: false });
  const [gpsBusy, setGpsBusy] = useState(false);
  const pullRef = useRef(null);

  const load = useCallback(async (location, force = false) => {
    if (!location) { setState({ status: "empty" }); return; }
    setState(s => ({ ...s, status: "loading" }));
    try {
      const { weather, alerts, advice, stale } = await weatherService.get({ lat: location.lat, lon: location.lon, force });
      setState({ status: "ready", data: weather, alerts, advice, stale });
    } catch {
      setState(s => s.data ? { ...s, status: "ready", stale: true } : { status: "error" });
    }
  }, []);

  useEffect(() => { load(loc); }, [loc, load]);

  // Background refresh on visibility change
  useEffect(() => {
    if (!loc) return;
    return weatherService.setupBackgroundRefresh(() => load(loc, true));
  }, [loc, load]);

  const useGPS = async () => {
    setGpsBusy(true);
    try {
      const pos = await locationService.currentPosition();
      const farm = locationService.add({ name: pos.name, lat: pos.lat, lon: pos.lon });
      setLoc(farm);
      toast(tc({ en: "Location set", hi: "स्थान सेट हो गया", bn: "অবস্থান সেট হয়েছে" }), "success");
    } catch (e) {
      toast(e.message || tc({ en: "Couldn't get your location", hi: "आपका स्थान नहीं मिल सका", bn: "আপনার অবস্থান পাওয়া যায়নি" }), "error");
    } finally { setGpsBusy(false); }
  };

  // Pull-to-refresh
  const onTouchStart = (e) => { pullRef.current = { y: e.touches[0].clientY, scrollTop: e.currentTarget.scrollTop }; };
  const onTouchEnd = (e) => {
    if (!pullRef.current) return;
    const dy = e.changedTouches[0].clientY - pullRef.current.y;
    if (pullRef.current.scrollTop <= 0 && dy > 70) load(loc, true);
    pullRef.current = null;
  };

  const { status, data, alerts, advice, stale } = state;

  return (
    <>
      <AppBar
        title={tc({ en: "Weather", hi: "मौसम", bn: "আবহাওয়া" })}
        onBack={pop}
        action={
          <button onClick={() => load(loc, true)} aria-label="Refresh"
            disabled={status === "loading"}
            style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8, cursor: "pointer", color: T.ink, display: "flex", opacity: status === "loading" ? 0.5 : 1 }}>
            <Icon name="RefreshCw" size={18} style={status === "loading" ? { animation: "ag-spin .7s linear infinite" } : undefined} />
          </button>
        }
      />
      <Screen gap={16} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* Location switcher */}
        <button onClick={() => push({ kind: "farmLocations" })}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: T.ink, padding: "0 2px" }}>
          <Icon name="MapPin" size={16} style={{ color: T.primary }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{loc?.name || tc({ en: "No location set", hi: "कोई स्थान सेट नहीं", bn: "কোনো অবস্থান সেট নেই" })}</span>
          <Icon name="ChevronDown" size={15} style={{ color: T.inkFaint }} />
        </button>

        {/* Skeleton loader */}
        {status === "loading" && !data && <WeatherSkeleton />}

        {status === "empty" && (
          <EmptyState icon="MapPin"
            title={tc({ en: "Set your location", hi: "अपना स्थान सेट करें", bn: "আপনার অবস্থান সেট করুন" })}
            body={tc({ en: "Weather and alerts are tailored to your farm. Use GPS or pick a place.", hi: "मौसम और अलर्ट आपके खेत के अनुसार हैं। GPS या स्थान चुनें।", bn: "আবহাওয়া ও সতর্কতা আপনার খামারের জন্য। GPS বা স্থান বেছে নিন।" })}
            action={gpsBusy ? tc({ en: "Locating…", hi: "खोज रहा है…", bn: "খুঁজছে…" }) : tc({ en: "Use my location", hi: "मेरा स्थान उपयोग करें", bn: "আমার অবস্থান ব্যবহার করুন" })}
            onAction={useGPS} />
        )}

        {status === "error" && (
          <ErrorState
            title={tc({ en: "Couldn't load weather", hi: "मौसम लोड नहीं हो सका", bn: "আবহাওয়া লোড হয়নি" })}
            body={tc({ en: "Check your connection and try again.", hi: "अपना कनेक्शन जाँचें और पुनः प्रयास करें।", bn: "আপনার সংযোগ পরীক্ষা করুন ও আবার চেষ্টা করুন।" })}
            onRetry={() => load(loc, true)} />
        )}

        {data && (
          <>
            {stale && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.inkSoft, padding: "0 2px" }}>
                <Icon name="CloudOff" size={14} /> {tc({ en: "Showing last saved forecast (offline)", hi: "अंतिम सहेजा गया पूर्वानुमान (ऑफ़लाइन)", bn: "শেষ সংরক্ষিত পূর্বাভাস (অফলাইন)" })}
              </div>
            )}

            {/* Current conditions hero */}
            <CurrentHero cur={data.current} today={data.daily?.[0]} locName={loc?.name} tc={tc} />

            {/* Severe weather alerts */}
            {alerts.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <SectionLabel icon="AlertTriangle" text={tc({ en: "Weather Alerts", hi: "मौसम अलर्ट", bn: "আবহাওয়া সতর্কতা" })} />
                {alerts.map(a => {
                  const c = SEV[a.severity] || SEV.info;
                  const isCrit = a.severity === "critical";
                  return (
                    <div key={a.id} style={{ display: "flex", gap: 12, padding: 14, borderRadius: T.rLg,
                      background: isCrit ? c.bg : c.bg,
                      border: isCrit ? `2px solid ${c.fg}` : "none" }}>
                      <div style={{ color: c.fg, flexShrink: 0, marginTop: 1 }}><Icon name={a.icon} size={20} /></div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: isCrit ? c.fg : c.fg }}>{tc(a.titleI18n || { en: a.title })}</div>
                        <div style={{ fontSize: 13, color: isCrit ? "#fde2e2" : T.ink, marginTop: 2, lineHeight: 1.45 }}>{tc(a.bodyI18n || { en: a.body })}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Farm advice */}
            {advice.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <SectionLabel icon="Lightbulb" text={tc({ en: "Farm Recommendations", hi: "खेती सलाह", bn: "কৃষি পরামর্শ" })} />
                {advice.map(a => {
                  const c = SEV[a.severity] || SEV.info;
                  return (
                    <Card key={a.id} pad={14}>
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: c.bg, color: c.fg,
                          display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <Icon name={CAT_ICON[a.category] || a.icon} size={18} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: c.fg, letterSpacing: 0.5 }}>
                              {tc(CAT_LABEL[a.category] || { en: a.category })}
                            </span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{tc(a.title)}</div>
                          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3, lineHeight: 1.5 }}>{tc(a.body)}</div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Hourly — next 48 hours */}
            {data.hourly?.length > 0 && (
              <Card pad={14}>
                <SectionLabel icon="Clock" text={tc({ en: "Next 48 Hours", hi: "अगले 48 घंटे", bn: "পরবর্তী ৪৮ ঘণ্টা" })} />
                <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4, marginTop: 8, scrollbarWidth: "none" }}>
                  {data.hourly.filter((_, i) => i % 2 === 0).map((h, i) => (
                    <div key={i} style={{ display: "grid", justifyItems: "center", gap: 4, minWidth: 48 }}>
                      <span style={{ fontSize: 11, color: T.inkSoft }}>{hourLabel(h.time, locale)}</span>
                      <Icon name={h.icon} size={18} style={{ color: T.blue }} />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{h.temp}°</span>
                      {h.precipProb != null && (
                        <span style={{ fontSize: 10, color: T.blue, display: "flex", alignItems: "center", gap: 2 }}>
                          <Icon name="Droplets" size={9} />{h.precipProb}%
                        </span>
                      )}
                      <span style={{ fontSize: 9.5, color: T.inkFaint }}>{h.windSpeed}<span style={{ fontSize: 8 }}>km/h</span></span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8 }}>
                  <LineChart data={data.hourly.map(h => ({ value: h.temp }))} color={T.orange} unit="°" height={80} />
                </div>
              </Card>
            )}

            {/* 10-day forecast */}
            {data.daily?.length > 0 && (
              <Card pad={6}>
                <div style={{ padding: "10px 12px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <SectionLabel icon="CalendarDays" text={tc({ en: "10-Day Forecast", hi: "10 दिन का पूर्वानुमान", bn: "১০ দিনের পূর্বাভাস" })} />
                  {data.model && (
                    <span style={{ fontSize: 10, color: T.inkFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {data.model === "ecmwf_ifs025" ? "ECMWF" : "GFS"}
                    </span>
                  )}
                </div>
                {data.daily.map((d, i) => {
                  const conf = computeConfidence(data.model, i);
                  const pct = confidencePercent(data.model, i);
                  return (
                    <div key={d.date} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                      <span style={{ width: 42, fontSize: 12.5, fontWeight: 600, color: T.ink, flexShrink: 0 }}>{dayLabel(d.date, locale, i, tc)}</span>
                      <Icon name={d.icon} size={18} style={{ color: T.blue, flexShrink: 0 }} />
                      <span style={{ width: 36, fontSize: 11, color: T.blue, display: "flex", alignItems: "center", gap: 2 }}>
                        <Icon name="Droplets" size={10} />{d.precipProb ?? 0}%
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{d.tempMax}°</span>
                      <span style={{ fontSize: 12.5, color: T.inkFaint, fontVariantNumeric: "tabular-nums" }}>{d.tempMin}°</span>
                      <span style={{ fontSize: 10, color: T.inkFaint, display: "flex", alignItems: "center", gap: 2, marginLeft: "auto" }}>
                        <Icon name="Wind" size={10} />{d.windMax}
                      </span>
                      {d.uvMax != null && (
                        <span style={{ fontSize: 10, color: d.uvMax >= 8 ? T.orange : T.inkFaint }}>
                          UV{d.uvMax}
                        </span>
                      )}
                      <ConfidencePill level={conf} pct={pct} tc={tc} />
                    </div>
                  );
                })}
              </Card>
            )}

            {/* Charts */}
            {data.hourly?.length > 4 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <SectionLabel icon="BarChart3" text={tc({ en: "Weather Charts", hi: "मौसम चार्ट", bn: "আবহাওয়া চার্ট" })} />
                <Card pad={14}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>{tc({ en: "Temperature (48h)", hi: "तापमान (48 घंटे)", bn: "তাপমাত্রা (৪৮ ঘণ্টা)" })}</div>
                  <LineChart data={data.hourly.map(h => ({ value: h.temp }))} color={T.orange} unit="°" height={80} />
                </Card>
                {data.daily?.length > 1 && (
                  <Card pad={14}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>{tc({ en: "Rainfall (10-day)", hi: "वर्षा (10 दिन)", bn: "বৃষ্টিপাত (১০ দিন)" })}</div>
                    <BarChart data={data.daily.map((d, i) => ({ label: dayLabel(d.date, locale, i, tc), value: d.precipSum }))} color={T.blue} unit="mm" height={90} />
                  </Card>
                )}
                <Card pad={14}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>{tc({ en: "Humidity (48h)", hi: "आर्द्रता (48 घंटे)", bn: "আর্দ্রতা (৪৮ ঘণ্টা)" })}</div>
                  <LineChart data={data.hourly.filter(h => h.humidity != null).map(h => ({ value: h.humidity }))} color={T.primary} unit="%" height={70} />
                </Card>
                <Card pad={14}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>{tc({ en: "Wind Speed (48h)", hi: "हवा गति (48 घंटे)", bn: "বাতাসের গতি (৪৮ ঘণ্টা)" })}</div>
                  <LineChart data={data.hourly.map(h => ({ value: h.windSpeed }))} color={T.inkSoft} unit="" height={70} />
                </Card>
              </div>
            )}

            <Button variant="soft" icon="Compass" full onClick={() => push({ kind: "nearby" })}>
              {tc({ en: "Find services near me", hi: "मेरे पास सेवाएँ खोजें", bn: "আমার কাছে পরিষেবা খুঁজুন" })}
            </Button>

            {/* Attribution */}
            <div style={{ fontSize: 11, color: T.inkFaint, textAlign: "center", lineHeight: 1.6, paddingBottom: 8 }}>
              <div>
                {tc({ en: "Forecast model", hi: "पूर्वानुमान मॉडल", bn: "পূর্বাভাস মডেল" })}: <strong>{data.model === "ecmwf_ifs025" ? "ECMWF IFS" : data.model || "GFS"}</strong>
                {" · "}{tc({ en: "Provider", hi: "प्रदाता", bn: "প্রদানকারী" })}: Open-Meteo
              </div>
              <div>
                {tc({ en: "Updated", hi: "अपडेट", bn: "আপডেট" })} {new Date(data.updatedAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}
                {stale && ` · ${tc({ en: "cached", hi: "कैश्ड", bn: "ক্যাশড" })}`}
              </div>
            </div>
          </>
        )}
      </Screen>
    </>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function CurrentHero({ cur, today, locName, tc }) {
  const todayData = today || {};
  const moon = moonPhase(new Date());
  const sunriseTime = todayData.sunrise?.split("T")[1]?.slice(0, 5) || "";
  const sunsetTime = todayData.sunset?.split("T")[1]?.slice(0, 5) || "";

  return (
    <div style={{ borderRadius: T.rLg, padding: 20, color: "#fff", position: "relative", overflow: "hidden",
      background: cur.isDay ? "linear-gradient(135deg, #1a6fa0, #1a4971)" : "linear-gradient(135deg, #1e2d4d, #111827)",
      boxShadow: T.shadowMd }}>
      <div style={{ position: "absolute", right: -20, top: -20, opacity: 0.12 }}><Icon name={cur.icon} size={140} /></div>
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 12.5, opacity: 0.9, fontWeight: 600 }}>{locName}</div>
        <div style={{ fontFamily: T.display, fontSize: 54, fontWeight: 800, lineHeight: 1.05, marginTop: 4 }}>{cur.temp}°</div>
        <div style={{ fontSize: 14, opacity: 0.95 }}>{cur.condition} · {tc({ en: `feels ${cur.feelsLike}°`, hi: `अनुभव ${cur.feelsLike}°`, bn: `অনুভূত ${cur.feelsLike}°` })}</div>

        {/* Primary metrics row */}
        <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 12, opacity: 0.92, flexWrap: "wrap" }}>
          <MetricPill icon="Droplets" value={`${cur.humidity ?? "—"}%`} label={tc({ en: "Humidity", hi: "आर्द्रता", bn: "আর্দ্রতা" })} />
          <MetricPill icon="Wind" value={`${cur.windSpeed}`} label={`km/h ${windDirLabel(cur.windDir)}`} />
          {cur.windGust > 0 && <MetricPill icon="Wind" value={`${cur.windGust}`} label={tc({ en: "Gust", hi: "झोंका", bn: "ঝাপটা" })} />}
          {cur.pressure && <MetricPill icon="Gauge" value={`${cur.pressure}`} label="hPa" />}
        </div>

        {/* Secondary metrics row */}
        <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, opacity: 0.85, flexWrap: "wrap" }}>
          {cur.dewPoint != null && <MetricPill icon="Thermometer" value={`${cur.dewPoint}°`} label={tc({ en: "Dew Point", hi: "ओसांक", bn: "শিশিরাঙ্ক" })} />}
          {cur.cloudCover != null && <MetricPill icon="Cloud" value={`${cur.cloudCover}%`} label={tc({ en: "Cloud", hi: "बादल", bn: "মেঘ" })} />}
          {todayData.uvMax != null && <MetricPill icon="Sun" value={todayData.uvMax} label={`UV${todayData.uvMax >= 8 ? " ⚠" : ""}`} />}
        </div>

        {/* Sun & Moon row */}
        <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11.5, opacity: 0.8 }}>
          {sunriseTime && <span>☀️ ↑{sunriseTime}</span>}
          {sunsetTime && <span>🌅 ↓{sunsetTime}</span>}
          <span>{moon.icon} {tc(moon)}</span>
        </div>
      </div>
    </div>
  );
}

function MetricPill({ icon, value, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Icon name={icon} size={12} style={{ verticalAlign: -1 }} /> {value} <span style={{ opacity: 0.7 }}>{label}</span>
    </span>
  );
}

function ConfidencePill({ level, pct, tc }) {
  const colors = {
    high: { bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
    medium: { bg: "rgba(251,191,36,0.15)", fg: "#f59e0b" },
    low: { bg: "rgba(239,68,68,0.12)", fg: "#ef4444" },
  };
  const c = colors[level] || colors.low;
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99,
      background: c.bg, color: c.fg, whiteSpace: "nowrap" }}>
      {pct}%
    </span>
  );
}

function SectionLabel({ icon, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, color: T.inkSoft }}>
      <Icon name={icon} size={15} />
      <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{text}</span>
    </div>
  );
}

function WeatherSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "ag-fade .3s var(--ag-ease)" }}>
      <Skeleton w="100%" h={180} r={T.rLg} />
      <Skeleton w="100%" h={60} r={T.rLg} />
      <Skeleton w="100%" h={140} r={T.rLg} />
      <Skeleton w="100%" h={200} r={T.rLg} />
    </div>
  );
}
