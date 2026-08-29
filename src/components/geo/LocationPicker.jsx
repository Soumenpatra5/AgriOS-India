/* State / UT and District selection.

   A native <select> is fine for seven options and unusable for 768, so these
   open the existing BottomSheet with a search field — the pattern the app
   already uses for language, and mobile-first by default.

   District depends on State: disabled until a state is chosen, and cleared
   whenever the state changes. The cascade lives in onStateChange here rather
   than in each screen, so no caller can forget it. */

import { useEffect, useMemo, useRef, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../Icon.jsx";
import { BottomSheet } from "../overlays.jsx";
import { useApp } from "../../store/AppStore.jsx";
import {
  states, districtsOf, getState, getDistrict,
  searchStates, searchDistricts, stats,
} from "../../services/geo/geoService.js";

/* ------------------------------------------------------------------ the field

   Looks like the app's Dropdown so the forms it replaces do not visually
   change, but it is a button that opens a sheet. */
function SelectField({ label, valueText, placeholder, disabled, onOpen, onClear }) {
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      {label && <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft, marginBottom: 7 }}>{label}</div>}
      <div style={{ position: "relative" }}>
        <button type="button" onClick={disabled ? undefined : onOpen} disabled={disabled}
          aria-haspopup="dialog"
          style={{
            width: "100%", textAlign: "left", padding: "12px 14px", paddingRight: valueText && !disabled ? 66 : 42,
            borderRadius: T.rMd, border: `1px solid ${T.line}`,
            background: disabled ? T.surface2 : T.surface,
            color: disabled ? T.inkFaint : (valueText ? T.ink : T.inkFaint),
            fontFamily: T.body, fontSize: 14.5, cursor: disabled ? "not-allowed" : "pointer",
            overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", boxSizing: "border-box",
          }}>
          {valueText || placeholder}
        </button>
        {valueText && !disabled && (
          <button type="button" onClick={onClear}
            aria-label="clear"
            style={{ position: "absolute", right: 36, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 4 }}>
            <Icon name="X" size={15} />
          </button>
        )}
        <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T.inkSoft, display: "flex" }}>
          <Icon name="ChevronDown" size={18} />
        </span>
      </div>
    </label>
  );
}

/* ------------------------------------------------------------------ the sheet */
function PickSheet({ open, onClose, title, items, selectedId, onSelect, searchPlaceholder, emptyText, footnote }) {
  const { tc } = useApp();
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  /* A stale query from the last open would silently hide most of the list. */
  useEffect(() => { if (open) setQ(""); }, [open]);

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <Icon name="Search" size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.inkFaint }} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder} aria-label={searchPlaceholder}
            style={{ width: "100%", padding: "11px 14px 11px 34px", borderRadius: T.rMd,
              border: `1px solid ${T.line}`, background: T.surface2, color: T.ink,
              fontFamily: T.body, fontSize: 14.5, outline: "none", boxSizing: "border-box" }} />
        </div>

        <div role="listbox" aria-label={title}
          style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "52vh", overflowY: "auto" }}>
          {items(q).map((it) => {
            const on = it.id === selectedId;
            return (
              <button key={it.id} type="button" role="option" aria-selected={on}
                onClick={() => { onSelect(it); onClose(); }}
                style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                  /* 44px+ tall: a comfortable touch target, not a dense list row. */
                  padding: "12px 14px", borderRadius: T.rMd, cursor: "pointer", fontFamily: T.body,
                  border: `1.5px solid ${on ? T.primary : T.line}`,
                  background: on ? T.primarySoft : T.surface,
                  color: on ? T.primary : T.ink, fontSize: 14.5, fontWeight: on ? 700 : 500 }}>
                <span style={{ flex: 1, minWidth: 0 }}>{it.name}</span>
                {it.type === "ut" && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: T.inkFaint }}>
                    {tc({ en: "UT", hi: "केंद्र शासित", bn: "কেন্দ্রশাসিত" })}
                  </span>
                )}
                {on && <Icon name="Check" size={16} />}
              </button>
            );
          })}

          {items(q).length === 0 && (
            <div style={{ padding: "22px 0", textAlign: "center", color: T.inkFaint, fontSize: 13 }}>
              {emptyText}
            </div>
          )}
        </div>

        {footnote && (
          <div style={{ fontSize: 11, color: T.inkFaint, lineHeight: 1.5, paddingTop: 2 }}>{footnote}</div>
        )}
      </div>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------- exported

   value:    { stateId, districtId }
   onChange: receives the whole next value, already cascaded. */
export default function LocationPicker({
  value = {}, onChange, disabled = false, showDistrict = true, labels = true,
  gps = false,
}) {
  const { tc } = useApp();
  const [openWhich, setOpenWhich] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  const { stateId = "", districtId = "" } = value;
  const state = getState(stateId);
  const district = getDistrict(districtId);

  const districtCount = useMemo(() => districtsOf(stateId).length, [stateId]);
  const ds = stats();

  const setState = (s) => {
    /* Cascade. Changing the state always clears the district — keeping it
       would leave a pair like West Bengal / Cuttack, which is the exact
       corruption this component exists to prevent. */
    if (s?.id === stateId) return;
    onChange?.({ ...value, stateId: s?.id || "", districtId: "" });
  };

  /* GPS proposes; the farmer disposes. Nothing here writes to `value` — a
     wrong administrative location silently mis-targets schemes and mandi
     prices, so it must never be applied without a tap. */
  const locate = async () => {
    setLocating(true); setGpsError(null); setSuggestion(null);
    try {
      const [{ locationService }, { reverseAdmin }, geo] = await Promise.all([
        import("../../services/location/locationService.js"),
        import("../../services/location/geocoding.js"),
        import("../../services/geo/geoService.js"),
      ]);
      const pos = await locationService.currentPosition();
      const admin = await reverseAdmin(pos.lat, pos.lon);
      const s = admin && geo.suggestFrom(admin);
      if (!s) {
        setGpsError(tc({
          en: "Couldn't work out your district from that position.",
          hi: "उस स्थान से आपका ज़िला पता नहीं चल सका।",
          bn: "সেই অবস্থান থেকে আপনার জেলা বোঝা যায়নি।",
        }));
        return;
      }
      /* Already what they have — nothing to offer. */
      if (s.stateId === stateId && s.districtId === districtId) return;
      setSuggestion(s);
    } catch (e) {
      setGpsError(String(e?.message || e));
    } finally {
      setLocating(false);
    }
  };

  const caveat = ds.verified ? null : tc({
    en: "District lists are provisional and may be out of date.",
    hi: "ज़िलों की सूची अस्थायी है और पुरानी हो सकती है।",
    bn: "জেলার তালিকা প্রাথমিক এবং পুরনো হতে পারে।",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SelectField
        label={labels ? tc({ en: "State / UT", hi: "राज्य / केंद्र शासित प्रदेश", bn: "রাজ্য / কেন্দ্রশাসিত অঞ্চল" }) : null}
        valueText={state?.name || ""}
        placeholder={tc({ en: "Select state", hi: "राज्य चुनें", bn: "রাজ্য বাছুন" })}
        disabled={disabled}
        onOpen={() => setOpenWhich("state")}
        onClear={() => onChange?.({ ...value, stateId: "", districtId: "" })}
      />

      {showDistrict && (
        <SelectField
          label={labels ? tc({ en: "District", hi: "ज़िला", bn: "জেলা" }) : null}
          valueText={district?.name || ""}
          placeholder={stateId
            ? tc({ en: "Select district", hi: "ज़िला चुनें", bn: "জেলা বাছুন" })
            : tc({ en: "Select state first", hi: "पहले राज्य चुनें", bn: "আগে রাজ্য বাছুন" })}
          disabled={disabled || !stateId}
          onOpen={() => setOpenWhich("district")}
          onClear={() => onChange?.({ ...value, districtId: "" })}
        />
      )}

      {gps && !disabled && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!suggestion && (
            <button type="button" onClick={locate} disabled={locating}
              style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6,
                background: "none", border: "none", cursor: locating ? "default" : "pointer",
                color: T.primary, fontFamily: T.body, fontSize: 12.5, fontWeight: 600, padding: "2px 0" }}>
              <Icon name="LocateFixed" size={14} />
              {locating
                ? tc({ en: "Finding you…", hi: "आपका स्थान खोजा जा रहा है…", bn: "আপনার অবস্থান খোঁজা হচ্ছে…" })
                : tc({ en: "Use my location", hi: "मेरा स्थान इस्तेमाल करें", bn: "আমার অবস্থান ব্যবহার করুন" })}
            </button>
          )}

          {suggestion && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px",
              background: T.surface2, border: `1px solid ${T.line}`, borderRadius: T.rMd }}>
              <Icon name="MapPin" size={16} style={{ color: T.primary, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: T.inkSoft }}>
                  {tc({ en: "Suggested location", hi: "सुझाया गया स्थान", bn: "প্রস্তাবিত অবস্থান" })}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>
                  {[suggestion.districtName, suggestion.stateName].filter(Boolean).join(", ")}
                </div>
                {!suggestion.exact && (
                  <div style={{ fontSize: 11, color: T.orange, marginTop: 2 }}>
                    {tc({ en: "Close match — please check.", hi: "मिलता-जुलता — कृपया जाँच लें।", bn: "কাছাকাছি মিল — দয়া করে দেখে নিন।" })}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setSuggestion(null)}
                aria-label={tc({ en: "Dismiss suggestion", hi: "सुझाव हटाएँ", bn: "প্রস্তাব সরান" })}
                style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 4 }}>
                <Icon name="X" size={15} />
              </button>
              <button type="button"
                onClick={() => {
                  onChange?.({ ...value, stateId: suggestion.stateId, districtId: suggestion.districtId });
                  setSuggestion(null);
                }}
                style={{ flexShrink: 0, background: T.primary, color: T.onPrimary, border: "none",
                  borderRadius: T.pill, padding: "7px 13px", cursor: "pointer",
                  fontFamily: T.body, fontSize: 12.5, fontWeight: 700 }}>
                {tc({ en: "Use", hi: "लगाएँ", bn: "ব্যবহার" })}
              </button>
            </div>
          )}

          {gpsError && (
            <div style={{ fontSize: 11.5, color: T.red, display: "flex", gap: 6, alignItems: "flex-start" }}>
              <Icon name="TriangleAlert" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{gpsError}</span>
            </div>
          )}
        </div>
      )}

      <PickSheet
        open={openWhich === "state"} onClose={() => setOpenWhich(null)}
        title={tc({ en: "Select state / UT", hi: "राज्य / केंद्र शासित प्रदेश चुनें", bn: "রাজ্য / কেন্দ্রশাসিত অঞ্চল বাছুন" })}
        searchPlaceholder={tc({ en: "Search states…", hi: "राज्य खोजें…", bn: "রাজ্য খুঁজুন…" })}
        emptyText={tc({ en: "No states found.", hi: "कोई राज्य नहीं मिला।", bn: "কোনও রাজ্য পাওয়া যায়নি।" })}
        items={(q) => (q ? searchStates(q) : states())}
        selectedId={stateId}
        onSelect={setState}
      />

      <PickSheet
        open={openWhich === "district"} onClose={() => setOpenWhich(null)}
        title={state
          ? tc({ en: `Districts of ${state.name}`, hi: `${state.name} के ज़िले`, bn: `${state.name}-এর জেলা` })
          : tc({ en: "District", hi: "ज़िला", bn: "জেলা" })}
        searchPlaceholder={tc({ en: "Search districts…", hi: "ज़िला खोजें…", bn: "জেলা খুঁজুন…" })}
        emptyText={districtCount === 0
          ? tc({ en: "No districts listed for this state.", hi: "इस राज्य के लिए कोई ज़िला सूचीबद्ध नहीं।", bn: "এই রাজ্যের জন্য কোনও জেলা তালিকাভুক্ত নেই।" })
          : tc({ en: "No districts found.", hi: "कोई ज़िला नहीं मिला।", bn: "কোনও জেলা পাওয়া যায়নি।" })}
        items={(q) => (q ? searchDistricts(stateId, q) : districtsOf(stateId))}
        selectedId={districtId}
        onSelect={(d) => onChange?.({ ...value, districtId: d.id })}
        footnote={caveat}
      />
    </div>
  );
}
