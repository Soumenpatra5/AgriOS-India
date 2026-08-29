import { useEffect, useState, useMemo, useCallback } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { Card, IconTile, SectionHeader, Chip } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { usePrefs } from "../customize/PreferencesProvider.jsx";
import { greetingKey, longDate, initials, rupee, compact } from "../utils/format.js";
import { weatherService } from "../services/weather/weatherService.js";
import { locationService } from "../services/location/locationService.js";
import { ledgerService } from "../services/ledger/ledgerService.js";
import { notificationService } from "../services/notifications/notificationService.js";
import { cropCalendarService } from "../services/calendar/cropCalendarService.js";
import { priceAlertService } from "../services/market/priceAlerts.js";
import {
  QUICK_ACTIONS, TASKS, SCHEMES, NEWS, CALCULATORS, AI_TOOLS,
} from "../constants/content.js";
import { accent } from "../components/primitives.jsx";
import OnboardingTour from "../components/OnboardingTour.jsx";
import { useLazySection } from "../hooks/useLazySection.js";
import { serviceHubService } from "../services/serviceHub/serviceHubService.js";
import { serviceById } from "../services/serviceHub/serviceRegistry.js";

const H_PAD = 16;

export default function Home() {
  const { t, tc, locale, user, push, switchTab, toast, can } = useApp();
  const { prefs } = usePrefs();
  // Dashboard widget visibility + order (Personalize → Dashboard). CSS `order`
  // reorders without moving JSX; `display:none` hides.
  const dash = prefs.dashboard;
  const wStyle = (id) => {
    const i = dash.order.indexOf(id);
    return { order: i === -1 ? 99 : i, display: dash.widgets[id] === false ? "none" : undefined };
  };
  const [tasks, setTasks] = useState(TASKS);
  const [calTick, setCalTick] = useState(0);
  const hasCrops  = useMemo(() => cropCalendarService.all().length > 0, [calTick]);
  const calTasks  = useMemo(() => cropCalendarService.upcomingTasks(7), [calTick]);
  const todayItems = useMemo(() => {
    const overdue = cropCalendarService.overdueTasks().length;
    const dueToday = cropCalendarService.upcomingTasks(0).length;
    const alerts = priceAlertService.getAll().filter((a) => a.enabled && !a.triggeredAt).length;
    return { overdue, dueToday, alerts };
  }, [calTick]);
  const farmerFallback = { en: "Farmer", hi: "किसान", bn: "কৃষক" };
  const name = (user?.name || tc(farmerFallback)).split(" ")[0];

  const openFeature = (title, desc, icon, a) => push({ kind: "feature", props: { title, desc, icon, a } });
  const openAI = (id) => {
    const x = AI_TOOLS.find((k) => k.id === id);
    push({ kind: "chat", props: { agentId: x?.agentId ?? null } });
  };

  // "My services" widget — favorites first, then farm-type suggestions to fill,
  // sourced from the same Service Hub the Services tab uses (no duplicate list).
  const myServices = useMemo(() => {
    const favs = serviceHubService.getFavorites().map(serviceById).filter(Boolean);
    const suggested = serviceHubService.suggestedFor(prefs, { excludeIds: favs.map((s) => s.id) });
    return [...favs, ...suggested].slice(0, 8);
  }, [prefs, calTick]);
  const openService = (s) => {
    serviceHubService.recordUse(s.id);
    push({ kind: s.kind, props: s.props });
  };

  const [monthNet, setMonthNet] = useState(0);
  const [monthIn, setMonthIn]   = useState(0);
  const [monthOut, setMonthOut] = useState(0);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    // The alerts aggregator pulls in the livestock/feed/inventory service graph,
    // so it is lazy-loaded here (not statically imported) to keep that ~240 KB
    // off the initial bundle — Home's first paint doesn't need it. Aggregate
    // once, then derive both the badge count and the opportunistic urgent-alert
    // notification from the same result.
    let alive = true;
    import("../services/alerts/farmAlertsService.js")
      .then(({ farmAlertsService }) =>
        farmAlertsService.getAll().then((all) => {
          if (alive) setAlertCount(all.length);
          return farmAlertsService.notifyHighPriority(undefined, all);
        }),
      )
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    ledgerService.currentMonthSummary().then(({ net, income, expense }) => {
      if (alive) { setMonthNet(net); setMonthIn(income); setMonthOut(expense); }
    });
    return () => { alive = false; };
  }, []);

  const [showNotifBanner, setShowNotifBanner] = useState(
    () => notificationService.isSupported() && !notificationService.hasPrompted()
  );

  const handleNotifAllow = async () => {
    const result = await notificationService.requestPermission();
    setShowNotifBanner(false);
    if (result === "granted") toast(tc({en:"Weather alerts enabled", hi:"मौसम अलर्ट चालू", bn:"আবহাওয়া সতর্কতা চালু হয়েছে"}), "success");
    else toast(tc({en:"Notifications blocked — enable in browser settings", hi:"सूचनाएँ ब्लॉक — ब्राउज़र सेटिंग्स में चालू करें", bn:"বিজ্ঞপ্তি ব্লক — ব্রাউজার সেটিংসে চালু করুন"}), "info");
  };

  const handleNotifDismiss = () => {
    notificationService.markPrompted();
    setShowNotifBanner(false);
  };

  const [installEvt, setInstallEvt] = useState(null);
  const [installDismissed, setInstallDismissed] = useState(() => localStorage.getItem("ag_pwa_dismissed") === "1");

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const handler = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installEvt) return;
    installEvt.prompt();
    const { outcome } = await installEvt.userChoice;
    setInstallEvt(null);
    if (outcome === "accepted") {
      toast(tc({ en: "AgriOS installed!", hi: "AgriOS इंस्टॉल हो गया!", bn: "AgriOS ইনস্টল হয়েছে!" }), "success");
      setInstallDismissed(true);
      localStorage.setItem("ag_pwa_dismissed", "1");
    }
  }, [installEvt, toast, tc]);

  const handleInstallDismiss = useCallback(() => {
    setInstallDismissed(true);
    localStorage.setItem("ag_pwa_dismissed", "1");
  }, []);

  return (
    <div style={{ paddingBottom: 24, animation: "ag-fade .25s var(--ag-ease)", display: "flex", flexDirection: "column" }}>
      {/* greeting */}
      <div style={{ order: -20, display: "flex", alignItems: "center", gap: 12, padding: `18px ${H_PAD}px 8px` }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(150deg, ${T.primary}, ${T.primaryDark})`, color: "#fff", display: "grid", placeItems: "center", fontFamily: T.display, fontWeight: 700, fontSize: 17 }}>
          {initials(user?.name || "Farmer")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>{longDate(locale)}</div>
          <div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700, color: T.ink }}>{t(greetingKey())}, {name}</div>
        </div>
        <button onClick={() => push({ kind: "alertsCenter" })}
          aria-label={tc({ en: "Alerts", hi: "अलर्ट", bn: "সতর্কতা" })}
          style={{ position: "relative", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 13, padding: 9, cursor: "pointer", color: T.ink, display: "flex" }}>
          <Icon name="Bell" size={20} />
          {alertCount > 0 && (
            <span style={{ position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, padding: "0 4px", boxSizing: "border-box",
              borderRadius: 9, background: T.red, color: "#fff", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", border: `2px solid ${T.surface}` }}>
              {alertCount > 9 ? "9+" : alertCount}
            </span>
          )}
        </button>
      </div>

      {/* weather */}
      <div style={{ padding: `6px ${H_PAD}px 0`, ...wStyle("weather") }}>
        <WeatherCard t={t} tc={tc} onOpen={() => push({ kind: "weather" })} />
      </div>

      {/* notification opt-in banner — shown once */}
      {showNotifBanner && (
        <div style={{ order: -10, padding: `10px ${H_PAD}px 0` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
            borderRadius: T.rLg, background: T.primarySoft, border: `1px solid ${T.primary}22` }}>
            <Icon name="BellRing" size={20} style={{ color: T.primary, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.primary }}>{tc({ en: "Enable weather alerts?", hi: "मौसम अलर्ट चालू करें?", bn: "আবহাওয়া সতর্কতা চালু করবেন?" })}</div>
              <div style={{ fontSize: 12, color: T.inkSoft }}>{tc({ en: "Get notified of storms and spray windows.", hi: "तूफान और स्प्रे समय की सूचना पाएँ।", bn: "ঝড় ও স্প্রে-র সময়ের বিজ্ঞপ্তি পান।" })}</div>
            </div>
            <button onClick={handleNotifAllow}
              style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 10,
                padding: "7px 12px", cursor: "pointer", fontFamily: T.body, fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>
              Allow
            </button>
            <button onClick={handleNotifDismiss} aria-label="Dismiss"
              style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 4, flexShrink: 0 }}>
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* PWA install banner */}
      {installEvt && !installDismissed && (
        <div style={{ order: -10, padding: `10px ${H_PAD}px 0` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
            borderRadius: T.rLg, background: T.blueSoft, border: `1px solid ${T.blue}22` }}>
            <Icon name="Download" size={20} style={{ color: T.blue, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.blue }}>{tc({ en: "Install AgriOS", hi: "AgriOS इंस्टॉल करें", bn: "AgriOS ইনস্টল করুন" })}</div>
              <div style={{ fontSize: 12, color: T.inkSoft }}>{tc({ en: "Add to home screen for offline access.", hi: "ऑफ़लाइन एक्सेस के लिए होम स्क्रीन पर जोड़ें।", bn: "অফলাইন অ্যাক্সেসের জন্য হোম স্ক্রিনে যোগ করুন।" })}</div>
            </div>
            <button onClick={handleInstall}
              style={{ background: T.blue, color: "#fff", border: "none", borderRadius: 10,
                padding: "7px 12px", cursor: "pointer", fontFamily: T.body, fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>
              {tc({ en: "Install", hi: "इंस्टॉल", bn: "ইনস্টল" })}
            </button>
            <button onClick={handleInstallDismiss} aria-label="Dismiss"
              style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 4, flexShrink: 0 }}>
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* today — needs attention */}
      <TodayCard items={todayItems} tc={tc} push={push} />

      {/* farm summary — finances gated by access role (M7) */}
      {can("finance.view") && (
      <div style={{ padding: `18px ${H_PAD}px 0`, ...wStyle("summary") }}>
        <SectionHeader title={t("farmSummary")} action={t("seeAll")} onAction={() => push({ kind: "farmLedger" })} />
        <div style={{ display: "flex", gap: 10 }}>
          <StatTile label={t("net")} value={compact(monthNet)} accentColor={T.primary} icon="TrendingUp" bg={T.primarySoft} />
          <StatTile label={t("income")} value={compact(monthIn)} accentColor={T.blue} icon="ArrowDownLeft" bg={T.blueSoft} />
          <StatTile label={t("expense")} value={compact(monthOut)} accentColor={T.orange} icon="ArrowUpRight" bg={T.orangeSoft} />
        </div>
      </div>
      )}

      {/* AI quick actions */}
      <div style={{ padding: `20px ${H_PAD}px 0`, ...wStyle("quickActions") }}>
        <SectionHeader title={t("aiQuick")} action={t("seeAll")} onAction={() => switchTab("ai")} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {QUICK_ACTIONS.map((q) => (
            <button key={q.id} onClick={() => openAI(q.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "grid", justifyItems: "center", gap: 7, padding: 0 }}>
              <IconTile name={q.icon} a={q.accent} size={54} iconSize={24} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textAlign: "center" }}>{tc(q.title)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* my services — favorites + farm-type suggestions (Service Hub) */}
      {myServices.length > 0 && (
        <div style={{ paddingTop: 20, ...wStyle("services") }}>
          <div style={{ padding: `0 ${H_PAD}px` }}>
            <SectionHeader title={tc({ en: "My services", hi: "मेरी सेवाएँ", bn: "আমার সেবা" })} action={t("seeAll")} onAction={() => switchTab("services")} />
          </div>
          <HScroll>
            {myServices.map((s) => (
              <button key={s.id} onClick={() => openService(s)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "grid", justifyItems: "center", gap: 7, padding: 0, minWidth: 72, scrollSnapAlign: "start" }}>
                <IconTile name={s.icon} a={s.accent} size={54} iconSize={24} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textAlign: "center", maxWidth: 76, lineHeight: 1.2 }}>{tc(s.title)}</span>
              </button>
            ))}
          </HScroll>
        </div>
      )}

      {/* tasks */}
      <div style={{ padding: `20px ${H_PAD}px 0`, ...wStyle("tasks") }}>
        <SectionHeader title={t("todayTasks")}
          action={hasCrops ? t("seeAll") : undefined}
          onAction={hasCrops ? () => push({ kind: "cropCalendar" }) : undefined} />
        {hasCrops ? (
          calTasks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13.5, color: T.inkFaint }}>
              No tasks due this week —{" "}
              <button onClick={() => push({ kind: "cropCalendar" })}
                style={{ background: "none", border: "none", cursor: "pointer",
                  color: T.primary, fontFamily: T.body, fontSize: 13.5, fontWeight: 600, padding: 0 }}>
                open calendar
              </button>
            </div>
          ) : (
            <Card pad={6}>
              {calTasks.map((tk, i) => (
                <div key={tk.taskKey} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                  <button onClick={() => {
                    if (tk.done) cropCalendarService.markUndone(tk.taskKey);
                    else cropCalendarService.markDone(tk.taskKey);
                    setCalTick((n) => n + 1);
                  }} aria-label="toggle"
                    style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, cursor: "pointer", display: "grid", placeItems: "center",
                      border: `1.5px solid ${tk.done ? T.primary : T.line}`, background: tk.done ? T.primary : "transparent", transition: "all .15s" }}>
                    {tk.done && <Icon name="Check" size={14} color="#fff" strokeWidth={3} />}
                  </button>
                  <span style={{ flex: 1, fontSize: 14, color: tk.done ? T.inkFaint : T.ink, textDecoration: tk.done ? "line-through" : "none" }}>
                    {tk.type.label}{tk.note ? ` — ${tk.note}` : ""}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft, background: T.surface2, padding: "3px 9px", borderRadius: 8 }}>{tk.cropName}</span>
                </div>
              ))}
            </Card>
          )
        ) : (
          <Card pad={6}>
            {tasks.map((tk, i) => (
              <div key={tk.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                <button onClick={() => setTasks(tasks.map((x) => x.id === tk.id ? { ...x, done: !x.done } : x))} aria-label="toggle"
                  style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, cursor: "pointer", display: "grid", placeItems: "center",
                    border: `1.5px solid ${tk.done ? T.primary : T.line}`, background: tk.done ? T.primary : "transparent", transition: "all .15s" }}>
                  {tk.done && <Icon name="Check" size={14} color="#fff" strokeWidth={3} />}
                </button>
                <span style={{ flex: 1, fontSize: 14, color: tk.done ? T.inkFaint : T.ink, textDecoration: tk.done ? "line-through" : "none" }}>{tc(tk.text)}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft, background: T.surface2, padding: "3px 9px", borderRadius: 8 }}>{tc(tk.tag)}</span>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* AI Diagnostics banner */}
      <div style={{ padding: `20px ${H_PAD}px 0`, ...wStyle("diagnostics") }}>
        <button onClick={() => push({ kind: "diagnosticsHome" })}
          style={{ width: "100%", padding: "16px 18px", borderRadius: T.rLg, cursor: "pointer",
            background: `linear-gradient(135deg, ${T.primary}, ${T.primaryDark})`,
            border: "none", fontFamily: T.body, textAlign: "left",
            display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,.2)",
            display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon name="Microscope" size={26} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{tc({ en: "AI Crop & Livestock Diagnostics", hi: "AI फसल और पशु निदान", bn: "AI ফসল ও পশু রোগ নির্ণয়" })}</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.78)", marginTop: 3 }}>
              {tc({ en: "Disease, pest & health analysis for crops and animals", hi: "फसल और पशुओं के रोग, कीट और स्वास्थ्य विश्लेषण", bn: "ফসল ও পশুর রোগ, পোকা ও স্বাস্থ্য বিশ্লেষণ" })}
            </div>
          </div>
          <Icon name="ChevronRight" size={20} color="rgba(255,255,255,.7)" />
        </button>
      </div>

      {/* schemes — horizontal */}
      <div style={{ paddingTop: 20, ...wStyle("schemes") }}>
        <div style={{ padding: `0 ${H_PAD}px` }}><SectionHeader title={t("schemes")} action={t("seeAll")} onAction={() => push({ kind: "schemeExplorer" })} /></div>
        <HScroll>
          {SCHEMES.map((s) => {
            const c = accent(s.accent);
            return (
              <div key={s.id} onClick={() => push({ kind: "schemeExplorer" })}
                style={{ minWidth: 210, background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: 15, cursor: "pointer" }}>
                <div style={{ display: "inline-flex", fontSize: 11, fontWeight: 700, color: c.fg, background: c.bg, padding: "4px 9px", borderRadius: 7 }}>{tc(s.tag)}</div>
                <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700, marginTop: 10 }}>{s.title}</div>
                <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3 }}>{tc(s.note)}</div>
              </div>
            );
          })}
        </HScroll>
      </div>

      {/* disease detection banner */}
      <div style={{ padding: `20px ${H_PAD}px 0`, ...wStyle("disease") }}>
        <div onClick={() => openAI("doctor")}
          style={{ display: "flex", alignItems: "center", gap: 14, borderRadius: T.rLg, padding: 16, cursor: "pointer",
            background: `linear-gradient(135deg, ${T.primary}, ${T.primaryDark})`, color: "#fff", boxShadow: T.shadowMd }}>
          <div style={{ width: 50, height: 50, borderRadius: 16, background: "rgba(255,255,255,.18)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon name="ScanLine" size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700 }}>{t("disease")}</div>
            <div style={{ fontSize: 12.5, opacity: .9, marginTop: 2 }}>{tc({ en: "Snap a photo, get an instant diagnosis.", hi: "फोटो खींचें, तुरंत निदान पाएँ।", bn: "ছবি তুলুন, তৎক্ষণাৎ রোগ নির্ণয় পান।" })}</div>
          </div>
          <Icon name="Camera" size={22} />
        </div>
      </div>

      {/* calculators (lazy) */}
      <LazyBlock><div style={{ padding: `20px ${H_PAD}px 0`, ...wStyle("calculators") }}>
        <SectionHeader title={t("calculators")} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {CALCULATORS.map((c) => (
            <button key={c.id} onClick={() => c.id === "seed" ? push({ kind: "cropPlanner" }) : c.id === "feed" ? push({ kind: "feedCalculator" }) : push({ kind: "calculator", props: { id: c.id } })}
              style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "14px 10px", cursor: "pointer", display: "grid", justifyItems: "center", gap: 8 }}>
              <IconTile name={c.icon} a={c.accent} size={42} iconSize={20} />
              <span style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{tc(c.title)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* news */}
      <div style={{ padding: `20px ${H_PAD}px 0`, ...wStyle("news") }}>
        <SectionHeader title={t("news")} />
        <Card pad={6}>
          {NEWS.map((n, i) => (
            <div key={n.id} onClick={() => openFeature(tc(n.tag), tc(n.title), "Newspaper", "blue")}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", cursor: "pointer", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.primary, marginBottom: 3 }}>{tc(n.tag)} · {tc(n.time)}</div>
                <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.4 }}>{tc(n.title)}</div>
              </div>
              <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint, flexShrink: 0 }} />
            </div>
          ))}
        </Card>
      </div>
      </LazyBlock>

      <OnboardingTour />
    </div>
  );
}

/* Live weather summary — real data via weatherService, tuned to the farmer's
   active location. Falls back gracefully when no location is set or offline. */
function WeatherCard({ t, tc, onOpen }) {
  const [loc, setLoc] = useState(() => locationService.getActive());
  const [st, setSt] = useState({ status: loc ? "loading" : "detecting", data: null, alert: null });

  useEffect(() => {
    let alive = true;
    if (!loc && locationService.supportsGPS()) {
      setSt({ status: "detecting", data: null, alert: null });
      locationService.currentPosition({ timeout: 8000 })
        .then((pos) => {
          if (!alive) return;
          const saved = locationService.add({ name: pos.name, lat: pos.lat, lon: pos.lon });
          setLoc(saved);
        })
        .catch(() => { if (alive) setSt({ status: "empty", data: null, alert: null }); });
    } else if (!loc) {
      setSt({ status: "empty", data: null, alert: null });
    }
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loc) return;
    let alive = true;
    setSt((prev) => ({ ...prev, status: "loading" }));
    weatherService.get({ lat: loc.lat, lon: loc.lon })
      .then(({ weather, alerts }) => { if (alive) setSt({ status: "ready", data: weather, alert: alerts[0] || null }); })
      .catch(() => { if (alive) setSt({ status: "error", data: null, alert: null }); });
    return () => { alive = false; };
  }, [loc]);

  const grad = "linear-gradient(135deg, #2E5670, #223F52)";

  if (st.status === "detecting") {
    return (
      <div style={{ borderRadius: T.rLg, padding: 18, color: "#fff", position: "relative", overflow: "hidden", background: grad, boxShadow: T.shadowMd }}>
        <div style={{ position: "absolute", right: -18, top: -18, opacity: .18 }}><Icon name="LocateFixed" size={130} /></div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="LocateFixed" size={24} style={{ animation: "ag-pulse 1.2s infinite" }} />
          <div>
            <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700 }}>{t("weather")}</div>
            <div style={{ fontSize: 12.5, opacity: .92, marginTop: 2 }}>{tc({ en: "Detecting your location…", hi: "आपका स्थान पता लगा रहे हैं…", bn: "আপনার অবস্থান সনাক্ত করা হচ্ছে…" })}</div>
          </div>
        </div>
      </div>
    );
  }

  if (st.status === "empty") {
    return (
      <div onClick={onOpen} style={{ borderRadius: T.rLg, padding: 18, cursor: "pointer", color: "#fff", position: "relative", overflow: "hidden", background: grad, boxShadow: T.shadowMd }}>
        <div style={{ position: "absolute", right: -18, top: -18, opacity: .18 }}><Icon name="CloudSun" size={130} /></div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="MapPin" size={24} />
          <div>
            <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700 }}>{t("weather")}</div>
            <div style={{ fontSize: 12.5, opacity: .92, marginTop: 2 }}>{tc({ en: "Set your location for a live forecast →", hi: "लाइव मौसम के लिए अपना स्थान सेट करें →", bn: "লাইভ আবহাওয়ার জন্য আপনার অবস্থান সেট করুন →" })}</div>
          </div>
        </div>
      </div>
    );
  }

  if (st.status === "loading") {
    return <div style={{ borderRadius: T.rLg, height: 132, background: grad, boxShadow: T.shadowMd, opacity: .55 }} />;
  }

  if (st.status === "error") {
    return (
      <div onClick={onOpen} style={{ borderRadius: T.rLg, padding: 18, cursor: "pointer", color: "#fff", background: grad, boxShadow: T.shadowMd, display: "flex", alignItems: "center", gap: 10 }}>
        <Icon name="CloudOff" size={22} />
        <span style={{ fontSize: 13.5 }}>{tc({ en: "Weather unavailable — tap to retry", hi: "मौसम उपलब्ध नहीं — फिर कोशिश करें", bn: "আবহাওয়া পাওয়া যায়নি — আবার চেষ্টা করুন" })}</span>
      </div>
    );
  }

  const c = st.data.current;
  return (
    <div onClick={onOpen} style={{ borderRadius: T.rLg, padding: 18, cursor: "pointer", color: "#fff", position: "relative", overflow: "hidden", background: grad, boxShadow: T.shadowMd }}>
      <div style={{ position: "absolute", right: -18, top: -18, opacity: .18 }}><Icon name={c.icon} size={130} /></div>
      <div style={{ display: "flex", alignItems: "flex-start", position: "relative" }}>
        <div>
          <div style={{ fontSize: 12.5, opacity: .9, fontWeight: 600 }}>{t("weather")} · {loc.name}</div>
          <div style={{ fontFamily: T.display, fontSize: 40, fontWeight: 800, lineHeight: 1.1, marginTop: 2 }}>{c.temp}°</div>
          <div style={{ fontSize: 13, opacity: .92 }}>{c.conditionI18n ? tc(c.conditionI18n) : c.condition} · {tc({en:`feels ${c.feelsLike}°`,hi:`अनुभव ${c.feelsLike}°`,bn:`অনুভূত ${c.feelsLike}°`})}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 12, opacity: .92, lineHeight: 1.8 }}>
          <div><Icon name="Droplets" size={12} style={{ verticalAlign: -1 }} /> {c.humidity}%</div>
          <div><Icon name="Wind" size={12} style={{ verticalAlign: -1 }} /> {c.windSpeed} km/h</div>
        </div>
      </div>
      {st.alert && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, padding: "9px 12px", borderRadius: 12, background: "rgba(255,255,255,.16)", fontSize: 12.5, position: "relative" }}>
          <Icon name={st.alert.icon} size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{tc(st.alert.titleI18n || {en:st.alert.title})} — {tc(st.alert.bodyI18n || {en:st.alert.body})}</span>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, accentColor, icon, bg }) {
  return (
    <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "13px 12px" }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: bg, color: accentColor, display: "grid", placeItems: "center", marginBottom: 9 }}>
        <Icon name={icon} size={16} strokeWidth={2.4} />
      </div>
      <div style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</div>
      <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: T.ink, marginTop: 1 }}>{value}</div>
    </div>
  );
}

function TodayCard({ items, tc, push }) {
  const { overdue, dueToday, alerts } = items;
  if (!overdue && !dueToday && !alerts) return null;

  const rows = [];
  if (overdue) rows.push({
    icon: "AlertCircle", color: T.red, bg: T.redSoft,
    label: tc({ en: `${overdue} overdue task${overdue > 1 ? "s" : ""}`, hi: `${overdue} विलंबित कार्य`, bn: `${overdue}টি বিলম্বিত কাজ` }),
    onClick: () => push({ kind: "cropCalendar" }),
  });
  if (dueToday) rows.push({
    icon: "Sprout", color: T.primary, bg: T.primarySoft,
    label: tc({ en: `${dueToday} task${dueToday > 1 ? "s" : ""} due today`, hi: `आज ${dueToday} कार्य देय`, bn: `আজ ${dueToday}টি কাজ` }),
    onClick: () => push({ kind: "cropCalendar" }),
  });
  if (alerts) rows.push({
    icon: "Bell", color: T.orange, bg: T.orangeSoft,
    label: tc({ en: `${alerts} price alert${alerts > 1 ? "s" : ""} active`, hi: `${alerts} मूल्य अलर्ट सक्रिय`, bn: `${alerts}টি মূল্য সতর্কতা সক্রিয়` }),
    onClick: () => push({ kind: "mandiPrices" }),
  });

  return (
    <div style={{ order: -8, padding: `12px ${H_PAD}px 0` }}>
      <Card pad={6}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 12px 5px" }}>
          <Icon name="Sun" size={15} style={{ color: T.orange }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: .3 }}>
            {tc({ en: "Needs attention", hi: "ध्यान चाहिए", bn: "মনোযোগ প্রয়োজন" })}
          </span>
        </div>
        {rows.map((r, i) => (
          <button key={i} onClick={r.onClick}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", cursor: "pointer",
              background: "none", border: "none", borderTop: `1px solid ${T.lineSoft}`, fontFamily: T.body }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: r.bg, color: r.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name={r.icon} size={16} />
            </div>
            <span style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 500, color: T.ink }}>{r.label}</span>
            <Icon name="ChevronRight" size={17} style={{ color: T.inkFaint }} />
          </button>
        ))}
      </Card>
    </div>
  );
}

function HScroll({ children }) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: `0 ${H_PAD}px 4px`, scrollSnapType: "x proximity" }}>
      {children}
    </div>
  );
}

function LazyBlock({ children }) {
  const { ref, visible } = useLazySection();
  return <div ref={ref}>{visible ? children : <div style={{ minHeight: 200 }} />}</div>;
}
