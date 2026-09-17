import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Spinner, BottomSheet, ErrorState,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { beeApi } from "../../services/bee/beeApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const today = () => new Date().toISOString().slice(0, 10);

const HIVE_TYPE_LABELS = {
  langstroth: { en: "Langstroth", hi: "लैंगस्ट्रोथ", bn: "ল্যাংস্ট্রথ" },
  top_bar:    { en: "Top Bar",    hi: "टॉप बार",      bn: "টপ বার" },
  warre:      { en: "Warré",      hi: "वारे",          bn: "ওয়ারে" },
  traditional: { en: "Traditional", hi: "पारंपरिक",    bn: "ঐতিহ্যবাহী" },
  other:      { en: "Other",      hi: "अन्य",          bn: "অন্যান্য" },
};

const STATUS_CFG = {
  active:     { fg: T.primary,  bg: T.primarySoft, label: { en: "Active",     hi: "सक्रिय",    bn: "সক্রিয়" } },
  queenless:  { fg: T.orange,   bg: "#fff3e8",     label: { en: "Queenless",  hi: "रानी रहित", bn: "রানীহীন" } },
  weak:       { fg: "#a0640a",  bg: "#fef3c7",     label: { en: "Weak",       hi: "कमजोर",     bn: "দুর্বল" } },
  dead:       { fg: T.red,      bg: T.redSoft,     label: { en: "Dead",       hi: "मृत",       bn: "মৃত" } },
  merged:     { fg: T.inkSoft,  bg: T.surface2,    label: { en: "Merged",     hi: "मर्ज",      bn: "মার্জড" } },
  archived:   { fg: T.inkFaint, bg: T.surface2,    label: { en: "Archived",   hi: "संग्रहित",  bn: "আর্কাইভড" } },
};

const STRENGTH_LABELS = ["", "Very weak", "Weak", "Moderate", "Strong", "Very strong"];

function MetricTile({ value, label, icon, accent }) {
  const fg = accent === "primary" ? T.primary : accent === "blue" ? T.blue : T.orange;
  const bg = accent === "primary" ? T.primarySoft : accent === "blue" ? T.blueSoft : "#fff3e8";
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, background: bg, borderRadius: T.rMd, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon name={icon} size={14} color={fg} />
        <span style={{ fontSize: 10.5, color: fg, fontWeight: 600, fontFamily: T.body }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: fg, fontFamily: T.display, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function HiveCard({ hive, tc, onPress }) {
  const cfg = STATUS_CFG[hive.current_status] || STATUS_CFG.active;
  const isTerminal = ["dead", "merged", "archived"].includes(hive.current_status);
  const lastStr = hive.last_colony_strength ? STRENGTH_LABELS[hive.last_colony_strength] : null;

  return (
    <Card pad={0}>
      <button
        onClick={onPress}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "13px 14px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left", fontFamily: T.body }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: cfg.bg, display: "grid", placeItems: "center" }}>
          <Icon name="Hexagon" size={20} color={cfg.fg} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: isTerminal ? T.inkSoft : T.ink }}>
              {hive.name}
            </span>
            <span style={{
              fontSize: 10.5, fontWeight: 700, fontFamily: T.body,
              color: cfg.fg, background: cfg.bg,
              borderRadius: 5, padding: "2px 7px",
            }}>
              {tc(cfg.label)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
            {hive.hive_type ? tc(HIVE_TYPE_LABELS[hive.hive_type] || { en: hive.hive_type }) : ""}
            {hive.apiary_name ? ` · ${hive.apiary_name}` : ""}
            {lastStr ? ` · ${lastStr}` : ""}
          </div>
          {hive.last_inspection_date && (
            <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 1 }}>
              {tc({ en: "Last inspection:", hi: "अंतिम निरीक्षण:", bn: "শেষ পরিদর্শন:" })} {hive.last_inspection_date}
            </div>
          )}
        </div>
        <Icon name="ChevronRight" size={16} color={T.line} />
      </button>
    </Card>
  );
}

export default function BeeDashboard() {
  const { pop, tc, toast } = useApp();

  const [space,   setSpace]   = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [hives,   setHives]   = useState([]);
  const [filter,  setFilter]  = useState("active");
  const [state,   setState]   = useState("loading");
  const [reason,  setReason]  = useState(null);

  const [finSummary, setFinSummary] = useState(null);
  const [finState,   setFinState]   = useState("idle");

  const [addOpen, setAddOpen] = useState(false);
  const blankForm = () => ({ name: "", hiveType: "langstroth", installationDate: today(), notes: "" });
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const [m, list] = await Promise.all([
        beeApi.hiveMetrics(active.id),
        beeApi.listHives(active.id, { includeTerminal: true }),
      ]);
      setMetrics(m);
      setHives(list || []);
      setState("ready");
      if (farmSpaceService.can(active, "farm.bee.finance")) {
        setFinState("loading");
        const now = new Date();
        const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const to   = now.toISOString().slice(0, 10);
        beeApi.financeSummary(active.id, { fromDate: from, toDate: to })
          .then((d) => { setFinSummary(d); setFinState("ready"); })
          .catch(() => setFinState("error"));
      }
    } catch (err) {
      if (state !== "ready") { setReason(err?.reason || FARM_ERROR.FAILED); setState("error"); }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const canManage  = space && farmSpaceService.can(space, "farm.bee.manage");
  const canFinance = space && farmSpaceService.can(space, "farm.bee.finance");

  const nonTerminal = hives.filter((h) => !["dead", "merged", "archived"].includes(h.current_status));
  const displayed = filter === "active" ? nonTerminal : hives;

  const addHive = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const hive = await beeApi.createHive(space.id, {
        name: form.name.trim(),
        hiveType: form.hiveType,
        installationDate: form.installationDate || null,
        notes: form.notes || null,
      });
      setHives((prev) => [hive, ...prev]);
      setAddOpen(false);
      setForm(blankForm());
      toast(tc({ en: "Hive added", hi: "छत्ता जोड़ा गया", bn: "মৌচাক যোগ হয়েছে" }), "success");
      beeApi.hiveMetrics(space.id).then(setMetrics).catch(() => {});
    } catch (err) {
      toast(err.message || tc({ en: "Failed to add hive", hi: "छत्ता नहीं जोड़ा", bn: "মৌচাক যোগ করা যায়নি" }), "error");
    } finally {
      setBusy(false);
    }
  };

  const bar = (
    <AppBar
      title={tc({ en: "Beekeeping", hi: "मधुमक्खी पालन", bn: "মৌমাছি পালন" })}
      onBack={pop}
      action={canManage && (
        <button
          onClick={() => setAddOpen(true)}
          style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" />
          {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
        </button>
      )}
    />
  );

  if (state === "loading") return <>{bar}<div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error")   return <>{bar}<div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;

  return (
    <>
      {bar}

      {/* Metrics strip */}
      {metrics && (
        <div style={{ display: "flex", gap: 8, padding: "10px 16px 0" }}>
          <MetricTile
            value={metrics.active_hives}
            label={tc({ en: "Active hives", hi: "सक्रिय छत्ते", bn: "সক্রিয় মৌচাক" })}
            icon="Hexagon" accent="primary" />
          <MetricTile
            value={`${Number(metrics.month_honey_kg || 0).toFixed(1)} kg`}
            label={tc({ en: "Honey this month", hi: "इस माह मधु", bn: "এ মাসে মধু" })}
            icon="Droplets" accent="blue" />
          <MetricTile
            value={metrics.inspected_last_14d}
            label={tc({ en: "Inspected 14d", hi: "14 दिन में जाँच", bn: "১৪দি. পরিদর্শন" })}
            icon="ClipboardCheck" accent="orange" />
        </div>
      )}

      {/* Alerts: queenless or weak hives */}
      {metrics && (metrics.queenless_count > 0 || metrics.weak_count > 0) && (
        <div style={{ margin: "8px 16px 0", background: "#fff3e8", borderRadius: T.rMd,
          padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="AlertTriangle" size={15} color={T.orange} />
          <span style={{ fontSize: 12.5, color: T.orange, fontWeight: 600, fontFamily: T.body }}>
            {[
              metrics.queenless_count > 0 && tc({
                en: `${metrics.queenless_count} queenless`,
                hi: `${metrics.queenless_count} रानी रहित`,
                bn: `${metrics.queenless_count}টি রানীহীন`,
              }),
              metrics.weak_count > 0 && tc({
                en: `${metrics.weak_count} weak`,
                hi: `${metrics.weak_count} कमजोर`,
                bn: `${metrics.weak_count}টি দুর্বল`,
              }),
            ].filter(Boolean).join(" · ")}
          </span>
        </div>
      )}

      {/* Finance summary */}
      {canFinance && (
        <div style={{ margin: "10px 16px 0" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.line}`,
            borderRadius: T.rMd, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, fontFamily: T.body,
                textTransform: "uppercase", letterSpacing: 0.8 }}>
                {tc({ en: "Finance · this month", hi: "वित्त · इस माह", bn: "অর্থ · এই মাস" })}
              </span>
            </div>
            {finState === "loading" && <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}><Spinner size={16} /></div>}
            {finState === "error"   && <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>{tc({ en: "Finance unavailable", hi: "वित्त उपलब्ध नहीं", bn: "অর্থ পাওয়া যাচ্ছে না" })}</div>}
            {finState === "ready" && finSummary && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: tc({ en: "Revenue", hi: "आय",    bn: "রাজস্ব" }), value: `₹${Number(finSummary.total_revenue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: T.primary },
                  { label: tc({ en: "Costs",   hi: "लागत",  bn: "খরচ"   }), value: `₹${Number(finSummary.total_costs).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,   color: T.orange },
                  { label: tc({ en: "Profit",  hi: "लाभ",   bn: "লাভ"   }), value: `₹${Number(finSummary.net_profit).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,   color: finSummary.net_profit >= 0 ? T.primary : T.red },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10.5, color: T.inkFaint, fontFamily: T.body, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: T.display }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 0, padding: "12px 16px 6px", borderBottom: `1px solid ${T.line}` }}>
        {[
          { id: "active", label: tc({ en: `Active (${nonTerminal.length})`, hi: `सक्रिय (${nonTerminal.length})`, bn: `সক্রিয় (${nonTerminal.length})` }) },
          { id: "all",    label: tc({ en: `All (${hives.length})`,          hi: `सभी (${hives.length})`,          bn: `সব (${hives.length})` }) },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            style={{
              padding: "5px 14px", border: "none", cursor: "pointer",
              background: filter === t.id ? T.primarySoft : "transparent",
              color: filter === t.id ? T.primary : T.inkSoft,
              borderRadius: 20, fontSize: 12.5, fontWeight: filter === t.id ? 700 : 500,
              fontFamily: T.body,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Hive list */}
      <div style={{ padding: "10px 16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        {displayed.length === 0 && (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <Icon name="Hexagon" size={36} color={T.line} />
            <div style={{ marginTop: 8, color: T.inkSoft, fontFamily: T.body, fontSize: 13 }}>
              {filter === "active"
                ? tc({ en: "No active hives", hi: "कोई सक्रिय छत्ता नहीं", bn: "কোনো সক্রিয় মৌচাক নেই" })
                : tc({ en: "No hives yet", hi: "अभी कोई छत्ता नहीं", bn: "এখনো কোনো মৌচাক নেই" })}
            </div>
            {canManage && filter === "active" && (
              <Button
                style={{ marginTop: 12 }}
                onPress={() => setAddOpen(true)}
                label={tc({ en: "Add first hive", hi: "पहला छत्ता जोड़ें", bn: "প্রথম মৌচাক যোগ করুন" })} />
            )}
          </div>
        )}
        {displayed.map((h) => (
          <HiveCard key={h.id} hive={h} tc={tc} onPress={() => {}} />
        ))}
      </div>

      {/* Add Hive sheet */}
      <BottomSheet open={addOpen} onClose={() => { setAddOpen(false); setForm(blankForm()); }}
        title={tc({ en: "Add Hive", hi: "छत्ता जोड़ें", bn: "মৌচাক যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body, display: "block", marginBottom: 4 }}>
              {tc({ en: "Hive name / number *", hi: "छत्ते का नाम / नंबर *", bn: "মৌচাকের নাম / নম্বর *" })}
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={tc({ en: "e.g. Hive A1", hi: "जैसे छत्ता A1", bn: "যেমন মৌচাক A1" })}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `1px solid ${T.line}`,
                borderRadius: T.rSm, fontFamily: T.body, fontSize: 14, background: T.surface, color: T.ink }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body, display: "block", marginBottom: 4 }}>
              {tc({ en: "Hive type", hi: "छत्ते का प्रकार", bn: "মৌচাকের ধরন" })}
            </label>
            <select
              value={form.hiveType}
              onChange={(e) => setForm((f) => ({ ...f, hiveType: e.target.value }))}
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.line}`,
                borderRadius: T.rSm, fontFamily: T.body, fontSize: 14, background: T.surface, color: T.ink }}>
              {Object.entries(HIVE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{tc(v)}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body, display: "block", marginBottom: 4 }}>
              {tc({ en: "Installation date", hi: "स्थापना तारीख", bn: "স্থাপনার তারিখ" })}
            </label>
            <input
              type="date"
              value={form.installationDate}
              onChange={(e) => setForm((f) => ({ ...f, installationDate: e.target.value }))}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `1px solid ${T.line}`,
                borderRadius: T.rSm, fontFamily: T.body, fontSize: 14, background: T.surface, color: T.ink }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body, display: "block", marginBottom: 4 }}>
              {tc({ en: "Notes", hi: "टिप्पणी", bn: "মন্তব্য" })}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `1px solid ${T.line}`,
                borderRadius: T.rSm, fontFamily: T.body, fontSize: 14, background: T.surface, color: T.ink, resize: "none" }} />
          </div>

          <Button
            label={busy ? tc({ en: "Adding…", hi: "जोड़ा जा रहा है…", bn: "যোগ হচ্ছে…" }) : tc({ en: "Add Hive", hi: "छत्ता जोड़ें", bn: "মৌচাক যোগ করুন" })}
            disabled={busy || !form.name.trim()}
            onPress={addHive} />
        </div>
      </BottomSheet>
    </>
  );
}
