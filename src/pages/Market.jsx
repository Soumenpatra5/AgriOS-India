import { useState, useMemo } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card, SectionHeader, IconTile } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { MARKET_SECTIONS } from "../constants/content.js";
import { marketService } from "../services/market/marketService.js";
import { priceAlertService } from "../services/market/priceAlerts.js";
import { localCropName } from "../services/market/cropData.js";

const TOP_CROPS = ["paddy", "wheat", "mustard", "arhar", "potato", "milk"];

const cropName = localCropName;

export default function Market() {
  const { t, tc, lang, push } = useApp();
  const alerts = useMemo(() => priceAlertService.getAll().filter((a) => a.enabled && !a.triggeredAt), []);
  const open = (title, icon, a) => push({ kind: "feature", props: { title, desc: tc({ en: "Browse and connect — arriving in a later phase.", hi: "ब्राउज़ और कनेक्ट — अगले चरण में आ रहा है।", bn: "ব্রাউজ ও সংযোগ — পরবর্তী ধাপে আসছে।" }), icon, a } });

  const topCrops = TOP_CROPS.map((id) => marketService.allCrops.find((c) => c.id === id)).filter(Boolean);

  return (
    <>
      <AppBar title={t("marketTitle")} large action={
        <button onClick={() => push({ kind: "mandiPrices" })} aria-label={tc({ en: "Search prices", hi: "भाव खोजें", bn: "দর খুঁজুন" })} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8, cursor: "pointer", color: T.ink, display: "flex" }}>
          <Icon name="Search" size={19} />
        </button>
      } />
      <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 20, animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* MSP price strip */}
        <div>
          <SectionHeader title={t("prices")} action={t("seeAll")} onAction={() => push({ kind: "mandiPrices" })} />
          <Card pad={6}>
            {topCrops.map((p, i) => (
              <div key={p.id} onClick={() => push({ kind: "mandiPrices" })}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderTop: i ? `1px solid ${T.lineSoft}` : "none", cursor: "pointer" }}>
                {p.emoji ? (
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: T.surface2, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 20 }}>{p.emoji}</div>
                ) : (
                  <IconTile name={p.icon} a={marketService.categories.find((c) => c.id === p.category)?.accent || "primary"} size={38} iconSize={18} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{cropName(p, lang)}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft }}>{tc({ en: "MSP / seasonal band", hi: "MSP / मौसमी सीमा", bn: "MSP / মৌসুমি পরিসীমা" })}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {p.msp ? (
                    <div style={{ fontSize: 14.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      ₹{p.msp.toLocaleString("en-IN")}<span style={{ fontSize: 11, color: T.inkFaint, fontWeight: 500 }}>/{p.unit}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12.5, color: T.inkSoft }}>{tc({ en: "Market price", hi: "बाज़ार भाव", bn: "বাজার দর" })}</div>
                  )}
                  <div style={{ fontSize: 11, color: T.inkSoft }}>
                    ₹{p.bandLow.toLocaleString("en-IN")}–{p.bandHigh.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            ))}
          </Card>
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 6, paddingLeft: 2 }}>
            {tc({ en: <>MSP 2024-25 · seasonal bands · <strong>not today's live rate</strong></>,
              hi: <>MSP 2024-25 · मौसमी सीमा · <strong>आज का लाइव भाव नहीं</strong></>,
              bn: <>MSP 2024-25 · মৌসুমি পরিসীমা · <strong>আজকের লাইভ দর নয়</strong></> })}
          </div>
        </div>

        {/* price alerts summary */}
        {alerts.length > 0 && (
          <Card pad={14} onClick={() => push({ kind: "mandiPrices" })}
            style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: T.orangeSoft, color: T.orange, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="Bell" size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{tc({ en: "Price Alerts", hi: "मूल्य अलर्ट", bn: "মূল্য সতর্কতা" })}</div>
              <div style={{ fontSize: 12, color: T.inkSoft }}>
                {tc({ en: `${alerts.length} active alert${alerts.length > 1 ? "s" : ""}`, hi: `${alerts.length} सक्रिय अलर्ट`, bn: `${alerts.length}টি সক্রিয় সতর্কতা` })}
              </div>
            </div>
            <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
          </Card>
        )}

        {/* market sections grid */}
        <div>
          <SectionHeader title={t("marketTitle")} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {MARKET_SECTIONS.map((s) => {
              const go = {
                prices:      () => push({ kind: "mandiPrices" }),
                marketplace: () => push({ kind: "marketplace" }),
                sellers:     () => push({ kind: "marketplace" }),
                equipment:   () => push({ kind: "marketplace", props: { category: "equipment" } }),
                seeds:       () => push({ kind: "marketplace", props: { category: "seeds" } }),
                feed:        () => push({ kind: "marketplace", props: { category: "feed" } }),
                medicine:    () => push({ kind: "marketplace", props: { category: "medicine" } }),
              }[s.id];
              return (
                <Card key={s.id}
                  onClick={() => go ? go() : open(tc(s.title), s.icon, s.accent)}
                  pad={15} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <IconTile name={s.icon} a={s.accent} size={44} iconSize={21} />
                  <div style={{ fontFamily: T.display, fontSize: 14.5, fontWeight: 700, lineHeight: 1.2 }}>{tc(s.title)}</div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
