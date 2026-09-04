/* Loads the Indic webfonts only for the language that needs them.

   index.html used to request all four families (Manrope, Inter, Noto
   Devanagari, Noto Bengali) at four weights each in one render-blocking
   stylesheet — up to ~587KB of font files at startup, most of it for
   scripts the current user never reads. The Latin UI families stay in the
   head; the Noto families arrive here, after the language is known.

   display=swap on Google's CSS means text renders immediately in the
   system's own Devanagari/Bengali fonts and upgrades when the webfont
   lands — a brief face swap on first hi/bn boot, in exchange for every
   boot in every language being lighter. */

const FONT_URLS = {
  hi: "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap",
  bn: "https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap",
};

const loaded = new Set();

export function ensureLangFonts(lang) {
  const url = FONT_URLS[lang];
  if (!url || loaded.has(lang) || typeof document === "undefined") return;
  loaded.add(lang);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}
