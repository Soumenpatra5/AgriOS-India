/* Design tokens — the single source of truth for the AgriOS India design system.
   Colors are exposed as CSS variables by ThemeProvider; the JS palette here is
   for the rare place that needs a raw value (e.g. canvas, meta theme-color). */

export const palette = {
  light: {
    bg: "#F4F7F1",
    surface: "#FFFFFF",
    surface2: "#EEF3EA",
    elevated: "#FFFFFF",
    ink: "#12211A",
    inkSoft: "#5C6F64",
    inkFaint: "#8A9A90",
    line: "#E2E8DD",
    lineSoft: "#EDF1EA",
    primary: "#12894E",
    primaryDark: "#0C6A3C",
    primarySoft: "#E1F2E8",
    onPrimary: "#FFFFFF",
    blue: "#2563EB", blueSoft: "#E5EDFD",
    orange: "#EA7A17", orangeSoft: "#FCEEDD",
    red: "#D64430", redSoft: "#FBE9E5",
    yellow: "#C9930B", yellowSoft: "#FBF2D8",
    scrim: "rgba(14,24,18,.40)",
    shadowSm: "0 1px 2px rgba(18,40,26,.04)",
    shadowMd: "0 1px 3px rgba(18,40,26,.05)",
    shadowLg: "0 4px 16px rgba(18,40,26,.07)",
  },
  dark: {
    bg: "#0D1411",
    surface: "#151F1A",
    surface2: "#1D2A23",
    elevated: "#1B2620",
    ink: "#E9F1EB",
    inkSoft: "#9FB2A7",
    inkFaint: "#6E8177",
    line: "#26332B",
    lineSoft: "#1F2A24",
    primary: "#37C878",
    primaryDark: "#2AAA64",
    primarySoft: "#123324",
    onPrimary: "#052012",
    blue: "#6C9BFF", blueSoft: "#182338",
    orange: "#F6A24E", orangeSoft: "#332217",
    red: "#F0715C", redSoft: "#341C18",
    yellow: "#E7BC4E", yellowSoft: "#302913",
    scrim: "rgba(0,0,0,.55)",
    shadowSm: "0 1px 2px rgba(0,0,0,.25)",
    shadowMd: "0 1px 3px rgba(0,0,0,.3)",
    shadowLg: "0 4px 16px rgba(0,0,0,.4)",
  },
};

export const radius = { sm: 9, md: 12, lg: 16, xl: 22, pill: 999 };
export const space = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, xxl: 32 };
export const type = {
  display: "'Manrope','Noto Sans Devanagari','Noto Sans Bengali',system-ui,sans-serif",
  body: "'Inter','Noto Sans Devanagari','Noto Sans Bengali',system-ui,sans-serif",
};
export const dur = { fast: 140, base: 240, slow: 380 };
export const ease = "cubic-bezier(.4,0,.2,1)";
