import { useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Screen, Card, Chip, IconTile } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { schemesService } from "../services/schemes/schemesService.js";
import { ELIGIBILITY_LABELS, ELIGIBILITY_COLORS } from "../services/schemes/eligibilityEngine.js";
import { profileMemory } from "../ai/memory/profileMemory.js";

const CATEGORY_LABELS = {
  income: {en:"Income support", hi:"आय सहायता", bn:"আয় সহায়তা"},
  insurance: {en:"Insurance", hi:"बीमा", bn:"বিমা"},
  credit: {en:"Credit", hi:"ऋण", bn:"ঋণ"},
  subsidy: {en:"Subsidy", hi:"सब्सिडी", bn:"ভর্তুকি"},
  advisory: {en:"Advisory", hi:"सलाह", bn:"পরামর্শ"},
};
const CATEGORIES = ["all", "income", "insurance", "credit", "subsidy", "advisory"];

export default function SchemeExplorer() {
  const { pop, push, toast, tc } = useApp();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [bookmarks, setBookmarks] = useState(() => schemesService.bookmarks());
  const [selected, setSelected] = useState(null);
  const [showOnlyBookmarked, setShowOnlyBookmarked] = useState(false);

  const profile = profileMemory.get();
  const hasProfile = profile.landSize || (profile.farmType || []).length > 0;

  const eligibilityResults = schemesService.findEligible();

  const displayed = eligibilityResults.filter(({ scheme }) => {
    if (query) return scheme.title.toLowerCase().includes(query.toLowerCase()) ||
      scheme.fullName.toLowerCase().includes(query.toLowerCase()) ||
      scheme.offer.toLowerCase().includes(query.toLowerCase());
    if (showOnlyBookmarked) return bookmarks.includes(scheme.id);
    if (activeCategory !== "all") return scheme.category === activeCategory;
    return true;
  });

  const toggleBookmark = (id) => {
    schemesService.toggleBookmark(id);
    setBookmarks(schemesService.bookmarks());
    toast(bookmarks.includes(id) ? tc({en:"Removed from saved", hi:"सहेजे गए से हटाया", bn:"সংরক্ষিত থেকে সরানো হয়েছে"}) : tc({en:"Saved scheme", hi:"योजना सहेजी गई", bn:"প্রকল্প সংরক্ষিত"}), "success");
  };

  const eligColors = ELIGIBILITY_COLORS(T);

  return (
    <>
      <AppBar title={tc({en:"Government schemes", hi:"सरकारी योजनाएँ", bn:"সরকারি প্রকল্প"})} onBack={pop} />
      <Screen gap={14}>
        {/* profile nudge */}
        {!hasProfile && (
          <button onClick={() => push({ kind: "chat", props: { agentId: "governmentAdvisor" } })}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: T.rLg, background: T.primarySoft, border: `1px solid ${T.primary}20`, cursor: "pointer", textAlign: "left", width: "100%" }}>
            <Icon name="Sparkles" size={20} style={{ color: T.primary, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.primary }}>{tc({en:"Get personalised scheme matches", hi:"व्यक्तिगत योजना मिलान पाएँ", bn:"ব্যক্তিগত প্রকল্প মিলান পান"})}</div>
              <div style={{ fontSize: 12.5, color: T.ink, marginTop: 1 }}>{tc({en:"Tell our AI your farm details and we'll check which schemes you qualify for.", hi:"हमारे AI को अपने खेत का विवरण बताएँ और हम जाँचेंगे कि आप किन योजनाओं के पात्र हैं।", bn:"আমাদের AI-কে আপনার খামারের বিবরণ জানান এবং আমরা দেখব কোন প্রকল্পের জন্য আপনি যোগ্য।"})}</div>
            </div>
            <Icon name="ChevronRight" size={16} style={{ color: T.primary, flexShrink: 0 }} />
          </button>
        )}

        {/* search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderRadius: T.pill,
          background: T.surface2, border: `1px solid ${query ? T.primary : "transparent"}`, transition: "border-color .18s" }}>
          <Icon name="Search" size={18} style={{ color: T.inkFaint }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tc({en:"Search schemes (PM-KISAN, insurance…)", hi:"योजनाएँ खोजें (PM-KISAN, बीमा…)", bn:"প্রকল্প খুঁজুন (PM-KISAN, বিমা…)"})}
            style={{ flex: 1, padding: "12px 0", border: "none", outline: "none", background: "transparent", fontFamily: T.body, fontSize: 14.5, color: T.ink }} />
          {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex" }}><Icon name="X" size={16} /></button>}
        </div>

        {/* filters */}
        {!query && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {CATEGORIES.map((c) => (
              <Chip key={c} active={activeCategory === c && !showOnlyBookmarked}
                onClick={() => { setActiveCategory(c); setShowOnlyBookmarked(false); }}>
                {c === "all" ? tc({en:"All", hi:"सभी", bn:"সব"}) : tc(CATEGORY_LABELS[c])}
              </Chip>
            ))}
            {bookmarks.length > 0 && (
              <Chip active={showOnlyBookmarked} icon="BookmarkCheck"
                onClick={() => setShowOnlyBookmarked((v) => !v)}>
                {tc({en:"Saved", hi:"सहेजे गए", bn:"সংরক্ষিত"})}
              </Chip>
            )}
          </div>
        )}

        {/* profile summary badge */}
        {hasProfile && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: T.rMd, background: T.surface2, fontSize: 12.5, color: T.inkSoft }}>
            <Icon name="User" size={14} />
            {tc({en:"Checking eligibility for:", hi:"पात्रता जाँच:", bn:"যোগ্যতা যাচাই:"})}
            {profile.landSize && <strong style={{ color: T.ink }}> {profile.landSize}</strong>}
            {(profile.farmType || []).length > 0 && <strong style={{ color: T.ink }}> · {profile.farmType.join(", ")}</strong>}
            {profile.location && <strong style={{ color: T.ink }}> · {profile.location}</strong>}
          </div>
        )}

        {/* scheme list */}
        {displayed.map(({ scheme, result }) => {
          const ec = eligColors[result.status] || eligColors.unknown;
          const isBookmarked = bookmarks.includes(scheme.id);
          return (
            <Card key={scheme.id} pad={14} onClick={() => setSelected({ scheme, result })}
              style={{ cursor: "pointer", position: "relative" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <IconTile name={scheme.icon} a={scheme.accent} size={44} iconSize={21} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700, color: T.ink }}>{scheme.title}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: ec.fg, background: ec.bg, padding: "2px 8px", borderRadius: 6 }}>
                      {ELIGIBILITY_LABELS[result.status]}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{scheme.fullName}</div>
                  <div style={{ fontSize: 13, color: T.ink, marginTop: 6, lineHeight: 1.45 }}>{scheme.offer}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); toggleBookmark(scheme.id); }} aria-label={tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ" })}
                  style={{ background: "none", border: "none", cursor: "pointer", color: isBookmarked ? T.primary : T.inkFaint, display: "flex", flexShrink: 0, padding: 4 }}>
                  <Icon name={isBookmarked ? "BookmarkCheck" : "BookmarkPlus"} size={18} />
                </button>
              </div>

              {/* reasons/missing pill row */}
              {result.missing?.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  <Icon name="AlertCircle" size={13} style={{ color: T.orange, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: T.inkSoft }}>{result.missing[0]}</span>
                </div>
              )}
            </Card>
          );
        })}

        {displayed.length === 0 && (
          <div style={{ textAlign: "center", padding: "36px 0", color: T.inkSoft, fontSize: 13.5 }}>
            {tc({en:`No schemes found${query ? ` for "${query}"` : ""}.`, hi:`कोई योजना नहीं मिली${query ? ` "${query}" के लिए` : ""}।`, bn:`কোনো প্রকল্প পাওয়া যায়নি${query ? ` "${query}" এর জন্য` : ""}।`})}
          </div>
        )}

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          {tc({en:"Eligibility based on your saved profile · Rules as of 2024-25", hi:"आपकी सहेजी गई प्रोफ़ाइल के आधार पर पात्रता · नियम 2024-25 के अनुसार", bn:"আপনার সংরক্ষিত প্রোফাইলের ভিত্তিতে যোগ্যতা · ২০২৪-২৫ এর নিয়ম অনুযায়ী"})}<br />
          {tc({en:"Always confirm at the official portal before applying", hi:"आवेदन से पहले हमेशा आधिकारिक पोर्टल पर पुष्टि करें", bn:"আবেদনের আগে সর্বদা সরকারি পোর্টালে নিশ্চিত করুন"})}
        </div>
      </Screen>

      {selected && (
        <SchemeSheet scheme={selected.scheme} result={selected.result}
          isBookmarked={bookmarks.includes(selected.scheme.id)}
          onBookmark={() => toggleBookmark(selected.scheme.id)}
          onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function SchemeSheet({ scheme, result, isBookmarked, onBookmark, onClose }) {
  const { tc } = useApp();
  const ec = ELIGIBILITY_COLORS(T)[result.status] || ELIGIBILITY_COLORS(T).unknown;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: T.scrim, display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "ag-fade .2s var(--ag-ease)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: T.surface, borderRadius: `${T.rXl} ${T.rXl} 0 0`, padding: "10px 20px 36px", maxHeight: "88vh", overflowY: "auto", animation: "ag-sheet .3s var(--ag-ease)" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: T.line, margin: "6px auto 16px" }} />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <IconTile name={scheme.icon} a={scheme.accent} size={52} iconSize={26} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700 }}>{scheme.title}</div>
            <div style={{ fontSize: 13, color: T.inkSoft }}>{scheme.fullName}</div>
            <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{scheme.ministry}</div>
          </div>
          <button onClick={onBookmark} style={{ background: isBookmarked ? T.primarySoft : T.surface2, border: "none", borderRadius: 12, padding: 10, cursor: "pointer", color: isBookmarked ? T.primary : T.inkFaint, display: "flex" }}>
            <Icon name={isBookmarked ? "BookmarkCheck" : "BookmarkPlus"} size={20} />
          </button>
        </div>

        {/* eligibility badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: T.rMd, background: ec.bg, marginBottom: 14 }}>
          <Icon name={result.status === "eligible" ? "BadgeCheck" : result.status === "partial" ? "BadgeAlert" : "AlertCircle"} size={18} style={{ color: ec.fg }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: ec.fg }}>{ELIGIBILITY_LABELS[result.status]}</span>
        </div>

        <SheetSection title={tc({en:"What you get", hi:"आपको क्या मिलेगा", bn:"আপনি কী পাবেন"})}>{scheme.offer}</SheetSection>

        {result.reasons?.length > 0 && (
          <SheetSection title={tc({en:"Why you qualify", hi:"आप क्यों पात्र हैं", bn:"আপনি কেন যোগ্য"})}>
            {result.reasons.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <Icon name="Check" size={14} style={{ color: T.primary, flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 13, color: T.ink }}>{r}</span>
              </div>
            ))}
          </SheetSection>
        )}

        {result.missing?.length > 0 && (
          <SheetSection title={tc({en:"What's still needed", hi:"अभी क्या चाहिए", bn:"এখনও কী প্রয়োজন"})}>
            {result.missing.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <Icon name="AlertCircle" size={14} style={{ color: T.orange, flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 13, color: T.ink }}>{m}</span>
              </div>
            ))}
          </SheetSection>
        )}

        <SheetSection title={tc({en:"Documents needed", hi:"आवश्यक दस्तावेज़", bn:"প্রয়োজনীয় নথি"})}>
          {scheme.documents.map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginTop: 5 }}>
              <Icon name="FileText" size={13} style={{ color: T.inkSoft, flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 13, color: T.ink }}>{d}</span>
            </div>
          ))}
        </SheetSection>

        <SheetSection title={tc({en:"How to apply", hi:"आवेदन कैसे करें", bn:"কীভাবে আবেদন করবেন"})}>{scheme.applyHow}</SheetSection>

        {scheme.excludes && <SheetSection title={tc({en:"Who does NOT qualify", hi:"कौन पात्र नहीं है", bn:"কারা যোগ্য নন"})}><span style={{ color: T.inkSoft }}>{scheme.excludes}</span></SheetSection>}

        <div style={{ marginTop: 18 }}>
          <a href={scheme.applyUrl} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", borderRadius: T.pill,
              background: T.primary, color: "#fff", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
            <Icon name="ExternalLink" size={17} /> {tc({en:"Apply at official portal", hi:"आधिकारिक पोर्टल पर आवेदन करें", bn:"সরকারি পোর্টালে আবেদন করুন"})}
          </a>
        </div>

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", marginTop: 14, lineHeight: 1.6 }}>
          {tc({en:"Rules as of 2024-25 — confirm with your local agriculture officer or official portal before applying.", hi:"नियम 2024-25 के अनुसार — आवेदन से पहले अपने स्थानीय कृषि अधिकारी या आधिकारिक पोर्टल से पुष्टि करें।", bn:"২০২৪-২৫ এর নিয়ম অনুযায়ী — আবেদনের আগে আপনার স্থানীয় কৃষি কর্মকর্তা বা সরকারি পোর্টালে নিশ্চিত করুন।"})}
        </div>
      </div>
    </div>
  );
}

function SheetSection({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}
