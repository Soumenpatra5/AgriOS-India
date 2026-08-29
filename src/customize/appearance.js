/* Appearance application — maps appearance prefs onto CSS variables on the
   document root. Because the whole app is themed through --ag-* tokens, changing
   these variables restyles every screen at once (no per-component code). */

/* Accent presets — per-theme primary/dark so they read well in light & dark. */
/* label stays English — it is the stored value, the text in CSV exports and
   the key reports group on. i18n is what the UI shows. */
export const ACCENTS = {
  green:  { label: "Green",  light: { p: "#12894E", d: "#0C6A3C" }, dark: { p: "#37C878", d: "#2AAA64" }, i18n: { en: "Green", hi: "हरा", bn: "সবুজ" } },
  teal:   { label: "Teal",   light: { p: "#0E8F86", d: "#0A6E67" }, dark: { p: "#2FD4C4", d: "#22A99C" }, i18n: { en: "Teal", hi: "नीला-हरा", bn: "নীলাভ সবুজ" } },
  blue:   { label: "Blue",   light: { p: "#2563EB", d: "#1D4ED8" }, dark: { p: "#6C9BFF", d: "#4E82F0" }, i18n: { en: "Blue", hi: "नीला", bn: "নীল" } },
  indigo: { label: "Indigo", light: { p: "#6D28D9", d: "#5B21B6" }, dark: { p: "#A78BFA", d: "#8B6DF0" }, i18n: { en: "Indigo", hi: "इंडिगो", bn: "ইন্ডিগো" } },
  orange: { label: "Orange", light: { p: "#EA7A17", d: "#C2610F" }, dark: { p: "#F6A24E", d: "#E0842E" }, i18n: { en: "Orange", hi: "नारंगी", bn: "কমলা" } },
  rose:   { label: "Rose",   light: { p: "#E11D5C", d: "#BE123C" }, dark: { p: "#FB7199", d: "#F0507B" }, i18n: { en: "Rose", hi: "गुलाबी", bn: "গোলাপি" } },
};

/* Card-style presets → the --ag-card-* vars the Card primitive consumes. */
export const CARD_STYLES = {
  rounded:  { label: "Rounded",  radius: "var(--ag-r-lg)", shadow: "none",              border: "1px solid var(--ag-line)", bg: "var(--ag-surface)", backdrop: "none", i18n: { en: "Rounded", hi: "गोल", bn: "গোলাকার" } },
  flat:     { label: "Flat",     radius: "var(--ag-r-md)", shadow: "none",              border: "1px solid var(--ag-line)", bg: "var(--ag-surface)", backdrop: "none", i18n: { en: "Flat", hi: "सपाट", bn: "সমতল" } },
  material: { label: "Material", radius: "var(--ag-r-md)", shadow: "var(--ag-shadow-md)", border: "none",                    bg: "var(--ag-surface)", backdrop: "none", i18n: { en: "Material", hi: "मटीरियल", bn: "ম্যাটেরিয়াল" } },
  glass:    { label: "Glass",    radius: "var(--ag-r-lg)", shadow: "var(--ag-shadow-sm)", border: "1px solid color-mix(in srgb, var(--ag-ink) 12%, transparent)", bg: "color-mix(in srgb, var(--ag-surface) 72%, transparent)", backdrop: "blur(12px) saturate(1.2)", i18n: { en: "Glass", hi: "कांच", bn: "কাচ" } },
};

export const DISPLAY_SIZES = {
  compact:     { label: "Compact",     zoom: 0.92, i18n: { en: "Compact", hi: "सघन", bn: "ঘন" } },
  comfortable: { label: "Comfortable", zoom: 1.0, i18n: { en: "Comfortable", hi: "आरामदायक", bn: "আরামদায়ক" } },
  spacious:    { label: "Spacious",    zoom: 1.08, i18n: { en: "Spacious", hi: "विस्तृत", bn: "প্রশস্ত" } },
};

/* Apply the appearance prefs for the currently resolved theme (light|dark). */
export function applyAppearance(appearance, resolvedTheme = "light") {
  const root = document.documentElement;
  const a = appearance || {};

  // Accent
  const accent = ACCENTS[a.accent] || ACCENTS.green;
  const tone = accent[resolvedTheme] || accent.light;
  root.style.setProperty("--ag-primary", tone.p);
  root.style.setProperty("--ag-primary-dark", tone.d);
  root.style.setProperty("--ag-primary-soft", `color-mix(in srgb, ${tone.p} ${resolvedTheme === "dark" ? "22%" : "14%"}, var(--ag-bg))`);

  // Card style
  const card = CARD_STYLES[a.cardStyle] || CARD_STYLES.rounded;
  root.style.setProperty("--ag-card-radius", card.radius);
  root.style.setProperty("--ag-card-shadow", card.shadow);
  root.style.setProperty("--ag-card-border", card.border);
  root.style.setProperty("--ag-card-bg", card.bg);
  root.style.setProperty("--ag-card-backdrop", card.backdrop);

  // Display size (whole-UI scale — pragmatic app-wide lever given px-based styles)
  const size = DISPLAY_SIZES[a.displaySize] || DISPLAY_SIZES.comfortable;
  root.style.setProperty("--ag-zoom", String(size.zoom));

  // High contrast
  root.dataset.contrast = a.highContrast ? "high" : "normal";
}
