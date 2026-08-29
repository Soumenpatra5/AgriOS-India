#!/usr/bin/env node
/* Finds user-facing English strings that are not routed through tc()/t().

   Written because fixing screens one screenshot at a time kept missing
   things: a screen can have a translated app bar and still be almost
   entirely English, and a fully translated screen can still show English
   coming from a service constant it renders verbatim.

   Two passes:
     screens  — JSX attributes and text nodes holding a bare English string,
                across pages/, components/ and navigation/
     tables   — { id, label: "..." } rows anywhere with no i18n sibling, i.e.
                dropdown and chip text

   components/ was outside the sweep until an accessibility pass found twenty
   hardcoded English aria-labels there — including the app bar's back button,
   which is on nearly every screen. A shared component is the WORST place to
   leave an untranslated string, because one line reaches every screen at once;
   it was also the only place the scanner never looked.

   Heuristics, not a parser: it can over-report (icon names, CSS values are
   filtered, but not perfectly). Use it to rank work, not as a gate. It also
   UNDER-reports: it cannot see a string that reaches the DOM through a
   variable, so a count of zero for a file does not mean the file is done.

   src/admin/ is excluded. That panel is staff-only and stays English by
   decision, so counting it hid how much real farmer-facing debt was left.
   Pass --admin to count it anyway.

   Usage:  node scripts/i18n-scan.mjs [--full] [--admin]
*/

import fs from "node:fs";
import path from "node:path";

const ROOT = "src";
const FULL = process.argv.includes("--full");
const WITH_ADMIN = process.argv.includes("--admin");

/* Staff-only back office — English on purpose, not debt. */
const isAdmin = (p) => /[\\/]admin[\\/]/.test(p);

/* Attributes whose value the farmer actually reads. */
const TEXT_ATTRS = [
  "label", "title", "placeholder", "text", "sub", "body", "hint", "emptyText",
  /* Read out instead of shown. Easy to forget precisely because they are
     invisible, and the only thing a screen-reader user gets. */
  "aria-label", "alt",
  /* Dialog's button captions default to English if a caller omits them. */
  "confirmLabel", "cancelLabel",
];
/* Values that look like copy but are not: icon names, enum-ish tokens, units. */
const SKIP_VALUES = new Set([
  "button", "submit", "text", "date", "time", "number", "email", "tel", "password", "search",
  "none", "auto", "true", "false", "row", "column", "block", "flex", "grid", "center", "left", "right",
  "primary", "secondary", "outline", "ghost", "danger", "soft", "sm", "md", "lg", "in", "out",
]);
const looksLikeCopy = (v) =>
  /[A-Za-z]/.test(v) &&
  v.trim().length > 2 &&
  !SKIP_VALUES.has(v.toLowerCase()) &&
  !/^[a-z]+([A-Z][a-z]*)+$/.test(v) &&      // camelCase identifier
  !/^[a-z0-9_.-]+$/.test(v) &&              // kebab/snake/dotted token
  !/^#|^rgba?\(|^\d|px$|%$/.test(v);        // colour or dimension

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|__tests__|\.claude/.test(p)) walk(p, out);
    } else if (/\.(jsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const all = walk(ROOT);
const files = WITH_ADMIN ? all : all.filter((p) => !isAdmin(p));
const adminSkipped = all.length - files.length;

/* Anything that renders. A string in components/ or navigation/ is as visible
   as one in pages/ — more so, since it repeats on every screen that uses it. */
const isScreen = (p) => /[\\/](pages|components|navigation)[\\/]/.test(p);

const pageHits = [];
const componentHits = [];
const tableHits = [];

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const rel = file.replace(/\\/g, "/");
  const inPages = /[\\/]pages[\\/]/.test(file);
  const bucket = inPages ? pageHits : componentHits;

  if (isScreen(file)) {
    src.split("\n").forEach((line, i) => {
      if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;       // comment
      for (const attr of TEXT_ATTRS) {
        const re = new RegExp(`\\b${attr}="([^"]+)"`, "g");
        let m;
        while ((m = re.exec(line)) !== null) {
          if (looksLikeCopy(m[1])) bucket.push({ file: rel, line: i + 1, attr, value: m[1] });
        }
      }
      /* Bare JSX text nodes: >Some words< */
      const txt = line.match(/>\s*([A-Z][A-Za-z][^<>{}"]{3,})\s*</);
      if (txt && looksLikeCopy(txt[1]) && !/^\s*[A-Z_]+\s*$/.test(txt[1])) {
        bucket.push({ file: rel, line: i + 1, attr: "text-node", value: txt[1].trim() });
      }
    });
  }

  /* Label tables live in services AND in components (AdminNav's rows, a
     picker's options), so this pass runs over everything. */
  src.split("\n").forEach((line, i) => {
    if (!/\blabel:\s*"/.test(line)) return;
    if (/i18n:/.test(line)) return;
    const m = line.match(/\blabel:\s*"([^"]+)"/);
    if (m && looksLikeCopy(m[1])) tableHits.push({ file: rel, line: i + 1, value: m[1] });
  });
}

const byFile = (hits) => hits.reduce((acc, h) => { (acc[h.file] ||= []).push(h); return acc; }, {});

const pages = byFile(pageHits), components = byFile(componentHits), tables = byFile(tableHits);
const rank = (o) => Object.entries(o).sort((a, b) => b[1].length - a[1].length);

const section = (heading, hits, grouped) => {
  console.log(`\n${heading} — ${hits.length} across ${Object.keys(grouped).length} files`);
  for (const [f, list] of rank(grouped)) {
    console.log(`  ${String(list.length).padStart(4)}  ${f}`);
    if (FULL) list.forEach((h) => console.log(`         ${h.line}: ${h.attr} = ${JSON.stringify(h.value)}`));
  }
};

section("UNTRANSLATED UI STRINGS IN PAGES", pageHits, pages);
/* Reported separately because one string here costs more: a shared component
   repeats on every screen that renders it. */
section("UNTRANSLATED UI STRINGS IN SHARED COMPONENTS", componentHits, components);

console.log(`\nTABLE LABELS WITHOUT i18n — ${tableHits.length} across ${Object.keys(tables).length} files`);
for (const [f, hits] of rank(tables)) {
  console.log(`  ${String(hits.length).padStart(4)}  ${f}`);
  if (FULL) hits.forEach((h) => console.log(`         ${h.line}: ${JSON.stringify(h.value)}`));
}

console.log(`\nTOTAL: ${pageHits.length + componentHits.length + tableHits.length}`);
if (!WITH_ADMIN) {
  console.log(`(${adminSkipped} files under src/admin/ not scanned — staff-only, English by decision. Use --admin to include.)`);
}
