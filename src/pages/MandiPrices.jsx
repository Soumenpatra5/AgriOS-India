import { useState, useEffect } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Screen, Card, Chip, IconTile, Button } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { marketService } from "../services/market/marketService.js";
import { fetchLivePrice } from "../services/market/priceProxy.js";
import { rupee } from "../utils/format.js";

const cropName = (crop, lang) =>
  lang === "bn" ? (crop.bengali || crop.name) :
  lang === "hi" ? (crop.hindi || crop.name) : crop.name;

const catLabel = (cat, tc) => tc(cat.label);

const SEASON_LABEL = {
  kharif: { en: "Kharif", hi: "खरीफ", bn: "খারিফ" },
  rabi: { en: "Rabi", hi: "रबी", bn: "রবি" },
  zaid: { en: "Zaid", hi: "ज़ायद", bn: "জায়েদ" },
  "year-round": { en: "Year-round", hi: "साल भर", bn: "সারা বছর" },
};
const SEASON_COLOR = (T) => ({
  kharif: { bg: T.primarySoft, fg: T.primary },
  rabi: { bg: T.blueSoft, fg: T.blue },
  zaid: { bg: T.yellowSoft, fg: T.yellow },
  "year-round": { bg: T.surface2, fg: T.inkSoft },
});

export default function MandiPrices() {
  const { pop, toast, lang, tc } = useApp();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [bookmarks, setBookmarks] = useState(() => marketService.bookmarks());
  const [selected, setSelected] = useState(null);

  const results = query.trim()
    ? marketService.search(query)
    : activeCategory
      ? marketService.byCategory(activeCategory)
      : marketService.allCrops;

  const toggle = (id) => {
    marketService.toggleBookmark(id);
    setBookmarks(marketService.bookmarks());
    toast(bookmarks.includes(id) ? "Removed from watchlist" : "Added to watchlist", "success");
  };

  const seasonColors = SEASON_COLOR(T);

  return (
    <>
      <AppBar title={tc({ en: "Crop prices", hi: "फसल भाव", bn: "ফসলের দর" })} onBack={pop} />
      <Screen gap={14}>
        {/* disclaimer */}
        <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderRadius: T.rMd, background: T.yellowSoft }}>
          <Icon name="Info" size={16} style={{ color: T.yellow, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5 }}>
            {tc({ en: <><strong>MSP + seasonal band</strong> — not today's live mandi rate. Check <strong>eNAM</strong> or <strong>Agmarknet</strong> for today's price.</>,
              hi: <><strong>MSP + मौसमी सीमा</strong> — आज का लाइव मंडी भाव नहीं। आज का भाव <strong>eNAM</strong> या <strong>Agmarknet</strong> पर देखें।</>,
              bn: <><strong>MSP + মৌসুমি পরিসীমা</strong> — আজকের লাইভ মান্ডি দর নয়। আজকের দাম <strong>eNAM</strong> বা <strong>Agmarknet</strong>-এ দেখুন।</> })}
          </div>
        </div>

        {/* search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderRadius: T.pill,
          background: T.surface2, border: `1px solid ${query ? T.primary : "transparent"}`, transition: "border-color .18s" }}>
          <Icon name="Search" size={18} style={{ color: T.inkFaint }} />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setActiveCategory(null); }}
            placeholder={tc({ en: "Search crops (paddy, wheat, arhar…)", hi: "फसल खोजें (धान, गेहूँ, अरहर…)", bn: "ফসল খুঁজুন (ধান, গম, অড়হর…)" })}
            style={{ flex: 1, padding: "12px 0", border: "none", outline: "none", background: "transparent",
              fontFamily: T.body, fontSize: 14.5, color: T.ink }} />
          {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex" }}><Icon name="X" size={16} /></button>}
        </div>

        {/* category chips */}
        {!query && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            <Chip active={!activeCategory} onClick={() => setActiveCategory(null)}>{tc({ en: "All", hi: "सभी", bn: "সব" })}</Chip>
            {marketService.categories.map((c) => (
              <Chip key={c.id} active={c.id === activeCategory} onClick={() => setActiveCategory(c.id)}>
                {c.emoji || ""} {tc(c.label)}
              </Chip>
            ))}
          </div>
        )}

        {/* bookmarks strip */}
        {!query && !activeCategory && bookmarks.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="BookmarkCheck" size={15} /> Watchlist
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
              {marketService.bookmarkedCrops().map((c) => (
                <div key={c.id} onClick={() => setSelected(c)}
                  style={{ minWidth: 110, background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "10px 12px", cursor: "pointer" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{cropName(c, lang)}</div>
                  {c.msp ? (
                    <div style={{ fontSize: 12, color: T.primary, marginTop: 3 }}>MSP ₹{c.msp}</div>
                  ) : (
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 3 }}>{tc({ en: "No MSP", hi: "MSP नहीं", bn: "MSP নেই" })}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* results */}
        <Card pad={0}>
          {results.length === 0 && (
            <div style={{ padding: "28px 16px", textAlign: "center", color: T.inkSoft, fontSize: 13.5 }}>
              {tc({ en: `No crops found for "${query}"`, hi: `"${query}" के लिए कोई फसल नहीं मिली`, bn: `"${query}"-এর জন্য কোনো ফসল পাওয়া যায়নি` })}
            </div>
          )}
          {results.map((crop, i) => {
            const sc = seasonColors[crop.season] || seasonColors["year-round"];
            const isBookmarked = bookmarks.includes(crop.id);
            return (
              <div key={crop.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderTop: i ? `1px solid ${T.lineSoft}` : "none", cursor: "pointer" }}
                onClick={() => setSelected(crop)}>
                {crop.emoji ? (
                  <div style={{ width: 40, height: 40, borderRadius: 13, background: T.surface2, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 22 }}>
                    {crop.emoji}
                  </div>
                ) : (
                  <IconTile name={crop.icon} a={marketService.categories.find((c) => c.id === crop.category)?.accent || "primary"} size={40} iconSize={19} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{cropName(crop, lang)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: sc.fg, background: sc.bg, padding: "2px 7px", borderRadius: 6 }}>
                      {tc(SEASON_LABEL[crop.season])}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {crop.msp ? (
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, fontVariantNumeric: "tabular-nums" }}>
                      ₹{crop.msp.toLocaleString("en-IN")}<span style={{ fontSize: 10.5, color: T.inkFaint, fontWeight: 500 }}>/{crop.unit}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: T.inkSoft }}>{tc({ en: "No MSP", hi: "MSP नहीं", bn: "MSP নেই" })}</div>
                  )}
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 1 }}>
                    ₹{crop.bandLow.toLocaleString("en-IN")}–{crop.bandHigh.toLocaleString("en-IN")}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); toggle(crop.id); }} aria-label={isBookmarked ? "Remove from watchlist" : "Add to watchlist"}
                  style={{ background: "none", border: "none", cursor: "pointer", color: isBookmarked ? T.primary : T.inkFaint, display: "flex", padding: 4 }}>
                  <Icon name={isBookmarked ? "BookmarkCheck" : "BookmarkPlus"} size={18} />
                </button>
              </div>
            );
          })}
        </Card>

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          {tc({ en: "MSP: CACP / Govt. of India 2024-25 · Seasonal bands: historical typical range",
            hi: "MSP: CACP / भारत सरकार 2024-25 · मौसमी सीमा: ऐतिहासिक सामान्य सीमा",
            bn: "MSP: CACP / ভারত সরকার 2024-25 · মৌসুমি পরিসীমা: ঐতিহাসিক সাধারণ পরিসীমা" })}<br />
          {tc({ en: "For live mandi rates: enam.gov.in · agmarknet.nic.in",
            hi: "लाइव मंडी भाव: enam.gov.in · agmarknet.nic.in",
            bn: "লাইভ মান্ডি দর: enam.gov.in · agmarknet.nic.in" })}
        </div>
      </Screen>

      {/* Crop detail sheet */}
      {selected && <CropSheet crop={selected} onClose={() => setSelected(null)} bookmarks={bookmarks} onToggle={toggle} />}
    </>
  );
}

function CropSheet({ crop, onClose, bookmarks, onToggle }) {
  const { lang, tc } = useApp();
  const sc = SEASON_COLOR(T)[crop.season] || SEASON_COLOR(T)["year-round"];
  const isBookmarked = bookmarks.includes(crop.id);

  // Live mandi rate (data.gov.in / Agmarknet). Silently absent until the feed
  // is configured server-side; the MSP + seasonal band below always render.
  const [live, setLive] = useState({ status: "loading" });
  useEffect(() => {
    const ctrl = new AbortController();
    fetchLivePrice(crop, { signal: ctrl.signal })
      .then((r) => setLive(r && r.live && r.modal ? { status: "ok", data: r } : { status: "none" }))
      .catch(() => setLive({ status: "none" }));
    return () => ctrl.abort();
  }, [crop]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: T.scrim, display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "ag-fade .2s var(--ag-ease)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: T.surface, borderRadius: `${T.rXl} ${T.rXl} 0 0`, padding: "10px 20px 36px", maxHeight: "80vh", overflowY: "auto", animation: "ag-sheet .3s var(--ag-ease)" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: T.line, margin: "6px auto 16px" }} />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700 }}>{cropName(crop, lang)}</div>
          </div>
          <button onClick={() => onToggle(crop.id)}
            style={{ background: isBookmarked ? T.primarySoft : T.surface2, border: "none", borderRadius: 12, padding: 10, cursor: "pointer", color: isBookmarked ? T.primary : T.inkFaint, display: "flex" }}>
            <Icon name={isBookmarked ? "BookmarkCheck" : "BookmarkPlus"} size={20} />
          </button>
        </div>

        <span style={{ display: "inline-flex", fontSize: 12, fontWeight: 700, color: sc.fg, background: sc.bg, padding: "4px 10px", borderRadius: 7, marginBottom: 16 }}>
          {tc(SEASON_LABEL[crop.season])} · {tc({ en: "per", hi: "प्रति", bn: "প্রতি" })} {crop.unit}
        </span>

        {/* Live mandi rate (data.gov.in / Agmarknet) — shown only when available */}
        {live.status === "loading" && (
          <div style={{ background: T.surface2, borderRadius: T.rLg, padding: 14, marginBottom: 12, fontSize: 12.5, color: T.inkSoft, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="RefreshCw" size={14} style={{ color: T.inkFaint }} />
            {tc({ en: "Checking today's mandi rate…", hi: "आज का मंडी भाव देख रहे हैं…", bn: "আজকের মান্ডি দর দেখা হচ্ছে…" })}
          </div>
        )}
        {live.status === "ok" && (
          <div style={{ background: T.blueSoft, borderRadius: T.rLg, padding: 14, marginBottom: 12, border: `1px solid ${T.blue}22` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.blue, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.blue }}>{tc({ en: "LIVE MANDI RATE", hi: "लाइव मंडी भाव", bn: "লাইভ মান্ডি দর" })}</span>
            </div>
            <div style={{ fontFamily: T.display, fontSize: 28, fontWeight: 800, color: T.ink }}>
              ₹{live.data.modal.toLocaleString("en-IN")}<span style={{ fontSize: 14, fontWeight: 500, color: T.inkSoft }}>/{live.data.unit}</span>
            </div>
            {(live.data.min || live.data.max) && (
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>
                {tc({ en: "Range", hi: "सीमा", bn: "পরিসীমা" })} ₹{(live.data.min ?? live.data.modal).toLocaleString("en-IN")} – ₹{(live.data.max ?? live.data.modal).toLocaleString("en-IN")}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 6, lineHeight: 1.5 }}>
              {[live.data.market, live.data.district, live.data.state].filter(Boolean).join(", ")}
              {live.data.date ? ` · ${live.data.date}` : ""}<br />{live.data.source}
            </div>
          </div>
        )}

        {/* MSP */}
        <div style={{ background: T.primarySoft, borderRadius: T.rLg, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 4 }}>{tc({ en: "GOVERNMENT MSP (2024-25)", hi: "सरकारी MSP (2024-25)", bn: "সরকারি MSP (2024-25)" })}</div>
          {crop.msp ? (
            <div style={{ fontFamily: T.display, fontSize: 28, fontWeight: 800, color: T.primary }}>₹{crop.msp.toLocaleString("en-IN")}<span style={{ fontSize: 14, fontWeight: 500, color: T.inkSoft }}>/{crop.unit}</span></div>
          ) : (
            <div style={{ fontSize: 15, fontWeight: 600, color: T.inkSoft }}>{tc({ en: "No MSP declared — market-determined price", hi: "MSP घोषित नहीं — बाज़ार निर्धारित मूल्य", bn: "MSP ঘোষিত নয় — বাজার নির্ধারিত মূল্য" })}</div>
          )}
        </div>

        {/* Seasonal band */}
        <div style={{ background: T.surface2, borderRadius: T.rLg, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 4 }}>{tc({ en: "TYPICAL SEASONAL BAND", hi: "सामान्य मौसमी सीमा", bn: "সাধারণ মৌসুমি পরিসীমা" })}</div>
          <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.ink }}>
            ₹{crop.bandLow.toLocaleString("en-IN")} – ₹{crop.bandHigh.toLocaleString("en-IN")}
            <span style={{ fontSize: 13, fontWeight: 500, color: T.inkSoft }}>/{crop.unit}</span>
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>{tc({ en: "Historical range · not a guarantee", hi: "ऐतिहासिक सीमा · गारंटी नहीं", bn: "ঐতিহাসিক পরিসীমা · গ্যারান্টি নয়" })}</div>
        </div>

        {/* selling tip */}
        {crop.note && (
          <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: T.rMd, background: T.blueSoft, marginBottom: 14 }}>
            <Icon name="Lightbulb" size={16} style={{ color: T.blue, flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>{crop.note}</div>
          </div>
        )}

        <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.6, marginBottom: 18 }}>
          {tc({ en: "For today's actual mandi rate, check your local mandi board, the eNAM app, or Agmarknet.",
            hi: "आज के असली मंडी भाव के लिए अपने स्थानीय मंडी बोर्ड, eNAM ऐप या Agmarknet देखें।",
            bn: "আজকের আসল মান্ডি দরের জন্য আপনার স্থানীয় মান্ডি বোর্ড, eNAM অ্যাপ বা Agmarknet দেখুন।" })}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <a href="https://enam.gov.in" target="_blank" rel="noreferrer" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 0", borderRadius: T.pill, background: T.primarySoft, color: T.primary, fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}>
            <Icon name="ExternalLink" size={15} /> eNAM
          </a>
          <a href="https://agmarknet.gov.in" target="_blank" rel="noreferrer" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 0", borderRadius: T.pill, background: T.surface2, color: T.ink, fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}>
            <Icon name="ExternalLink" size={15} /> Agmarknet
          </a>
        </div>
      </div>
    </div>
  );
}
