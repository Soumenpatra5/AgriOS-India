import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { Card, IconTile, SectionHeader } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";

/* Lazy: most farmers work alone, so the Farm Space code should not be part
   of the Home bundle they always load. */
const FarmSpaceCard = lazy(() => import("../components/farmSpace/FarmSpaceCard.jsx"));
import { usePrefs } from "../customize/PreferencesProvider.jsx";
import { greetingKey, longDate, initials, compact } from "../utils/format.js";
import { weatherService } from "../services/weather/weatherService.js";
import { locationService } from "../services/location/locationService.js";
import { ledgerService } from "../services/ledger/ledgerService.js";
import { cropCalendarService } from "../services/calendar/cropCalendarService.js";
import {
  QUICK_ACTIONS, NEWS, CALCULATORS, AI_TOOLS,
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

  // Crop-calendar tasks are the local-first (device) task source; taskService is
  // the ERP task store. Both are real — Home shows what genuinely needs action,
  // never a demo list. The counts drive both "Needs attention" and "At a glance".
  const calCounts = useMemo(() => ({
    overdue: cropCalendarService.overdueTasks().length,
    today: cropCalendarService.upcomingTasks(0).length,
  }), []);

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
  }, [prefs]);
  const openService = (s) => {
    serviceHubService.recordUse(s.id);
    push({ kind: s.kind, props: s.props });
  };

  const [ledger, setLedger] = useState({ income: 0, expense: 0, loaded: false });
  const [taskCounts, setTaskCounts] = useState({ overdue: 0, today: 0, open: 0 });
  const [alerts, setAlerts] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [topSchemes, setTopSchemes] = useState([]);

  // Eligibility-scored government schemes (real), best matches first. The
  // schemes service pulls in the eligibility engine + scheme catalogue, so it
  // is dynamically imported (like farmAlertsService below) to keep that weight
  // off Home's initial bundle. Falls back to catalogue order for an empty
  // profile — never fabricated.
  useEffect(() => {
    let alive = true;
    import("../services/schemes/schemesService.js")
      .then(({ schemesService }) => { if (alive) setTopSchemes(schemesService.findEligible().slice(0, 3)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    // The alerts aggregator pulls in the livestock/feed/inventory service graph,
    // so it is lazy-loaded here (not statically imported) to keep that ~240 KB
    // off the initial bundle. Aggregate once, then derive the badge count, the
    // "needs attention" rows, and the opportunistic urgent notification all from
    // the same result — no duplicate fetch.
    let alive = true;
    import("../services/alerts/farmAlertsService.js")
      .then(({ farmAlertsService }) =>
        farmAlertsService.getAll().then((all) => {
          if (alive) { setAlertCount(all.length); setAlerts(all); }
          return farmAlertsService.notifyHighPriority(undefined, all);
        }),
      )
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    ledgerService.currentMonthSummary().then(({ income, expense }) => {
      if (alive) setLedger({ income, expense, loaded: true });
    }).catch(() => { if (alive) setLedger((p) => ({ ...p, loaded: true })); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    // taskService pulls in the ERP db graph — dynamic-import it so that weight
    // stays off Home's initial bundle (same rationale as the alerts import).
    let alive = true;
    import("../services/tasks/taskService.js")
      .then(({ taskService }) => taskService.buckets())
      .then((b) => {
        if (!alive) return;
        setTaskCounts({
          overdue: b.overdue.length,
          today: b.today.length,
          open: b.overdue.length + b.today.length + b.upcoming.length,
        });
      }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Combined, real "needs action" figures across both task sources.
  const overdue = calCounts.overdue + taskCounts.overdue;
  const dueToday = calCounts.today + taskCounts.today;
  const openTasks = taskCounts.open + cropCalendarService.upcomingTasks(3650).length + calCounts.overdue;

  const [showNotifBanner, setShowNotifBanner] = useState(false);

  useEffect(() => {
    let alive = true;
    import("../services/notifications/notificationService.js")
      .then(({ notificationService }) => {
        if (!alive) return;
        if (notificationService.isSupported() && !notificationService.hasPrompted()) {
          setShowNotifBanner(true);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const handleNotifAllow = async () => {
    let result = "denied";
    try {
      const { notificationService } = await import("../services/notifications/notificationService.js");
      result = await notificationService.requestPermission();
    } catch { /* no-op */ }
    setShowNotifBanner(false);
    if (result === "granted") toast(tc({en:"Weather alerts enabled", hi:"मौसम अलर्ट चालू", bn:"আবহাওয়া সতর্কতা চালু হয়েছে"}), "success");
    else toast(tc({en:"Notifications blocked — enable in browser settings", hi:"सूचनाएँ ब्लॉक — ब्राउज़र सेटिंग्स में चालू करें", bn:"বিজ্ঞপ্তি ব্লক — ব্রাউজার সেটিংসে চালু করুন"}), "info");
  };

  const handleNotifDismiss = async () => {
    try {
      const { notificationService } = await import("../services/notifications/notificationService.js");
      notificationService.markPrompted();
    } catch { /* no-op */ }
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
              {tc({ en: "Allow", hi: "अनुमति", bn: "অনুমতি" })}
            </button>
            <button onClick={handleNotifDismiss} aria-label={tc({ en: "Dismiss", hi: "हटाएँ", bn: "সরান" })}
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
            <button onClick={handleInstallDismiss} aria-label={tc({ en: "Dismiss", hi: "हटाएँ", bn: "সরান" })}
              style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 4, flexShrink: 0 }}>
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 1. weather — a core daily farming signal, kept prominent near the top */}
      <div style={{ padding: `6px ${H_PAD}px 0`, ...wStyle("weather") }}>
        <WeatherCard t={t} tc={tc} onOpen={() => push({ kind: "weather" })} />
      </div>

      {/* 2. my farm space — renders nothing unless the farmer is in one */}
      <div style={wStyle("farmSpace")}>
        <Suspense fallback={null}><FarmSpaceCard /></Suspense>
      </div>

      {/* 3. needs attention — real, actionable; positive empty state otherwise */}
      <div style={wStyle("attention")}>
        <NeedsAttention overdue={overdue} dueToday={dueToday} alerts={alerts} tc={tc} push={push} />
      </div>

      {/* 4. today at a glance — compact metrics with meaningful empty states */}
      <div style={{ padding: `18px ${H_PAD}px 0`, ...wStyle("glance") }}>
        <SectionHeader
          title={tc({ en: "Today at a glance", hi: "आज एक नज़र में", bn: "আজ এক নজরে" })}
          action={can("finance.view") ? t("seeAll") : undefined}
          onAction={can("finance.view") ? () => push({ kind: "farmLedger" }) : undefined} />
        <div style={{ display: "flex", gap: 10 }}>
          <GlanceTile
            label={tc({ en: "Tasks due", hi: "बकाया काम", bn: "বাকি কাজ" })}
            value={overdue + dueToday}
            empty={openTasks === 0}
            emptyLabel={tc({ en: "No tasks", hi: "कोई काम नहीं", bn: "কাজ নেই" })}
            icon="ListChecks" accentColor={T.primary} bg={T.primarySoft}
            onClick={() => push({ kind: "cropCalendar" })} />
          {can("finance.view") && (
            <>
              <GlanceTile
                label={t("income")}
                value={ledger.income > 0 ? compact(ledger.income) : null}
                empty={ledger.income <= 0}
                emptyLabel={tc({ en: "None yet", hi: "अभी नहीं", bn: "এখনও নেই" })}
                icon="ArrowDownLeft" accentColor={T.blue} bg={T.blueSoft}
                onClick={() => push({ kind: "farmLedger" })} />
              <GlanceTile
                label={t("expense")}
                value={ledger.expense > 0 ? compact(ledger.expense) : null}
                empty={ledger.expense <= 0}
                emptyLabel={tc({ en: "None yet", hi: "अभी नहीं", bn: "এখনও নেই" })}
                icon="ArrowUpRight" accentColor={T.orange} bg={T.orangeSoft}
                onClick={() => push({ kind: "farmLedger" })} />
            </>
          )}
        </div>
      </div>

      {/* 5. quick actions — slim AI fast-access row */}
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

      {/* 6. my farm / services — favorites + farm-type suggestions (Service Hub) */}
      {myServices.length > 0 && (
        <div style={{ paddingTop: 20, ...wStyle("services") }}>
          <div style={{ padding: `0 ${H_PAD}px` }}>
            <SectionHeader title={tc({ en: "My farm", hi: "मेरा खेत", bn: "আমার খামার" })} action={t("seeAll")} onAction={() => switchTab("services")} />
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

      {/* 7. AI Farm Assistant — one compact section (replaces the two big banners) */}
      <div style={{ padding: `20px ${H_PAD}px 0`, ...wStyle("aiAssistant") }}>
        <AIAssistantCard tc={tc} switchTab={switchTab} openAI={openAI} push={push} />
      </div>

      {/* 8. government schemes — real eligibility-scored, best matches first */}
      <div style={{ paddingTop: 20, ...wStyle("schemes") }}>
        <div style={{ padding: `0 ${H_PAD}px` }}>
          <SectionHeader title={t("schemes")} action={t("seeAll")} onAction={() => push({ kind: "schemeExplorer" })} />
        </div>
        <HScroll>
          {topSchemes.map(({ scheme, result }) => (
            <SchemeCard key={scheme.id} scheme={scheme} result={result} tc={tc}
              onOpen={() => push({ kind: "schemeExplorer", props: { schemeId: scheme.id } })} />
          ))}
        </HScroll>
      </div>

      {/* 9. latest news (lazy, lower priority)
           NEWS is still the static constant from constants/content.js — kept
           deliberately structured (id/tag/title/time) so a real news service
           can replace the source later without touching this markup. */}
      <LazyBlock style={{ padding: `20px ${H_PAD}px 0`, ...wStyle("news") }}>
        <SectionHeader title={t("news")} />
        <Card pad={6}>
          {NEWS.slice(0, 3).map((n, i) => (
            <button key={n.id} onClick={() => openFeature(tc(n.tag), tc(n.title), "Newspaper", "blue")}
              style={{ width: "100%", textAlign: "left", background: "none", fontFamily: T.body,
                display: "flex", alignItems: "center", gap: 12, padding: "12px", cursor: "pointer",
                border: "none", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.primary, marginBottom: 3 }}>{tc(n.tag)} · {tc(n.time)}</div>
                <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.4 }}>{tc(n.title)}</div>
              </div>
              <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint, flexShrink: 0 }} />
            </button>
          ))}
        </Card>
      </LazyBlock>

      {/* 10. calculators (lazy, last — kept for the farmers who use them) */}
      <LazyBlock style={{ padding: `20px ${H_PAD}px 0`, ...wStyle("calculators") }}>
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
      <button onClick={onOpen} aria-label={t("weather")}
        style={{ width: "100%", textAlign: "left", fontFamily: T.body, borderRadius: T.rLg, padding: 18, cursor: "pointer", color: "#fff", position: "relative", overflow: "hidden", background: grad, boxShadow: T.shadowMd, border: "none" }}>
        <div style={{ position: "absolute", right: -18, top: -18, opacity: .18 }}><Icon name="CloudSun" size={130} /></div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="MapPin" size={24} />
          <div>
            <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700 }}>{t("weather")}</div>
            <div style={{ fontSize: 12.5, opacity: .92, marginTop: 2 }}>{tc({ en: "Set your location for a live forecast →", hi: "लाइव मौसम के लिए अपना स्थान सेट करें →", bn: "লাইভ আবহাওয়ার জন্য আপনার অবস্থান সেট করুন →" })}</div>
          </div>
        </div>
      </button>
    );
  }

  if (st.status === "loading") {
    return <div style={{ borderRadius: T.rLg, height: 132, background: grad, boxShadow: T.shadowMd, opacity: .55 }} />;
  }

  if (st.status === "error") {
    return (
      <button onClick={onOpen}
        style={{ width: "100%", textAlign: "left", fontFamily: T.body, borderRadius: T.rLg, padding: 18, cursor: "pointer", color: "#fff", background: grad, boxShadow: T.shadowMd, display: "flex", alignItems: "center", gap: 10, border: "none" }}>
        <Icon name="CloudOff" size={22} />
        <span style={{ fontSize: 13.5 }}>{tc({ en: "Weather unavailable — tap to retry", hi: "मौसम उपलब्ध नहीं — फिर कोशिश करें", bn: "আবহাওয়া পাওয়া যায়নি — আবার চেষ্টা করুন" })}</span>
      </button>
    );
  }

  const c = st.data.current;
  return (
    <button onClick={onOpen} aria-label={`${t("weather")} ${loc.name} ${c.temp}°`}
      style={{ width: "100%", textAlign: "left", fontFamily: T.body, borderRadius: T.rLg, padding: 18, cursor: "pointer", color: "#fff", position: "relative", overflow: "hidden", background: grad, boxShadow: T.shadowMd, border: "none" }}>
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
    </button>
  );
}

/* Compact metric tile with a real empty state — never a meaningless ₹0. */
function GlanceTile({ label, value, empty, emptyLabel, accentColor, icon, bg, onClick }) {
  return (
    <button onClick={onClick}
      style={{ flex: 1, minWidth: 0, textAlign: "left", fontFamily: T.body, cursor: onClick ? "pointer" : "default",
        background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "13px 12px" }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: bg, color: accentColor, display: "grid", placeItems: "center", marginBottom: 9 }}>
        <Icon name={icon} size={16} strokeWidth={2.4} />
      </div>
      <div style={{ fontSize: 11.5, color: T.inkSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      {empty ? (
        <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkFaint, marginTop: 3 }}>{emptyLabel}</div>
      ) : (
        <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: T.ink, marginTop: 1 }}>{value}</div>
      )}
    </button>
  );
}

/* One consolidated, compact AI section — replaces the two large gradient
   banners (diagnostics + disease). Reuses the existing AI handlers/routes. */
function AIAssistantCard({ tc, switchTab, openAI, push }) {
  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <button onClick={() => switchTab("ai")}
        style={{ width: "100%", textAlign: "left", cursor: "pointer", fontFamily: T.body, border: "none",
          background: `linear-gradient(135deg, ${T.primary}, ${T.primaryDark})`, color: "#fff",
          display: "flex", alignItems: "center", gap: 13, padding: "15px 16px" }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(255,255,255,.2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon name="Bot" size={24} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700 }}>{tc({ en: "AI Farm Assistant", hi: "AI फार्म सहायक", bn: "AI ফার্ম সহায়ক" })}</div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.82)", marginTop: 2 }}>
            {tc({ en: "Crop & livestock advice, disease & health analysis", hi: "फसल-पशु सलाह, रोग व स्वास्थ्य विश्लेषण", bn: "ফসল-পশু পরামর্শ, রোগ ও স্বাস্থ্য বিশ্লেষণ" })}
          </div>
        </div>
        <Icon name="ChevronRight" size={20} color="rgba(255,255,255,.8)" />
      </button>
      <div style={{ display: "flex", gap: 0 }}>
        <button onClick={() => openAI("doctor")}
          style={{ flex: 1, minWidth: 0, background: T.surface, border: "none", borderTop: `1px solid ${T.lineSoft}`, cursor: "pointer",
            fontFamily: T.body, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 10px", color: T.ink }}>
          <Icon name="ScanLine" size={18} style={{ color: T.primary, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tc({ en: "Disease detection", hi: "रोग पहचान", bn: "রোগ শনাক্ত" })}</span>
        </button>
        <button onClick={() => push({ kind: "diagnosticsHome" })}
          style={{ flex: 1, minWidth: 0, background: T.surface, border: "none", borderTop: `1px solid ${T.lineSoft}`, borderLeft: `1px solid ${T.lineSoft}`, cursor: "pointer",
            fontFamily: T.body, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 10px", color: T.ink }}>
          <Icon name="Microscope" size={18} style={{ color: T.primary, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tc({ en: "Diagnostics", hi: "निदान", bn: "রোগ নির্ণয়" })}</span>
        </button>
      </div>
    </Card>
  );
}

/* Government scheme card with a real eligibility indicator from the engine.
   "unlikely" and "unknown" share the neutral "check eligibility" chip. */
const ELIGIBILITY = {
  eligible: { a: "primary", label: { en: "Eligible", hi: "पात्र", bn: "যোগ্য" } },
  partial:  { a: "yellow",  label: { en: "May qualify", hi: "संभव पात्रता", bn: "যোগ্য হতে পারেন" } },
};
const ELIG_DEFAULT = { a: "blue", label: { en: "Check eligibility", hi: "पात्रता जाँचें", bn: "যোগ্যতা যাচাই" } };
function SchemeCard({ scheme, result, tc, onOpen }) {
  const e = ELIGIBILITY[result?.status] || ELIG_DEFAULT;
  const c = accent(e.a);
  return (
    <button onClick={onOpen}
      style={{ minWidth: 210, maxWidth: 240, textAlign: "left", fontFamily: T.body, cursor: "pointer",
        background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: 15, scrollSnapAlign: "start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconTile name={scheme.icon || "Landmark"} a={e.a} size={34} iconSize={17} />
        <div style={{ fontSize: 10.5, fontWeight: 700, color: c.fg, background: c.bg, padding: "3px 8px", borderRadius: 7 }}>{tc(e.label)}</div>
      </div>
      <div style={{ fontFamily: T.display, fontSize: 15.5, fontWeight: 700, marginTop: 10, color: T.ink }}>{scheme.title}</div>
      <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{scheme.offer}</div>
    </button>
  );
}

/* Needs attention — real overdue/today task counts + top farm alerts. Shows a
   positive empty state rather than empty cards when nothing is urgent. */
function NeedsAttention({ overdue, dueToday, alerts, tc, push }) {
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
  // Top 2 highest-severity farm alerts (already severity-sorted), each routing
  // to its own screen. Deduped against the count rows above by simply taking
  // the alert list as-is — these are inventory/feed/health, not task counts.
  for (const a of (alerts || []).slice(0, 2)) {
    const sev = a.severity === "high" ? { color: T.red, bg: T.redSoft } : a.severity === "medium" ? { color: T.orange, bg: T.orangeSoft } : { color: T.blue, bg: T.blueSoft };
    rows.push({
      icon: a.severity === "high" ? "AlertTriangle" : "Info", color: sev.color, bg: sev.bg,
      label: a.title, onClick: a.kind ? () => push({ kind: a.kind, props: a.props }) : undefined,
    });
  }

  return (
    <div style={{ padding: `12px ${H_PAD}px 0` }}>
      <Card pad={6}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 12px 5px" }}>
          <Icon name="Sun" size={15} style={{ color: T.orange }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: .3 }}>
            {tc({ en: "Needs attention", hi: "ध्यान चाहिए", bn: "মনোযোগ প্রয়োজন" })}
          </span>
        </div>
        {rows.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderTop: `1px solid ${T.lineSoft}` }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: T.primarySoft, color: T.primary, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="CheckCircle2" size={17} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{tc({ en: "You're all caught up", hi: "सब कुछ पूरा है", bn: "সব কিছু গুছিয়ে গেছে" })}</div>
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{tc({ en: "No urgent farm actions right now.", hi: "अभी कोई ज़रूरी काम नहीं।", bn: "এখন কোনো জরুরি কাজ নেই।" })}</div>
            </div>
          </div>
        ) : rows.map((r, i) => (
          <button key={i} onClick={r.onClick} disabled={!r.onClick}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", cursor: r.onClick ? "pointer" : "default",
              background: "none", border: "none", borderTop: `1px solid ${T.lineSoft}`, fontFamily: T.body }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: r.bg, color: r.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name={r.icon} size={16} />
            </div>
            <span style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 500, color: T.ink, overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
            {r.onClick && <Icon name="ChevronRight" size={17} style={{ color: T.inkFaint, flexShrink: 0 }} />}
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

function LazyBlock({ children, style }) {
  const { ref, visible } = useLazySection();
  return <div ref={ref} style={style}>{visible ? children : <div style={{ minHeight: 160 }} />}</div>;
}
