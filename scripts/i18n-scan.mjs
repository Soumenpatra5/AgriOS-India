#!/usr/bin/env node
/* Finds user-facing English strings that are not routed through tc()/t().

   Written because fixing screens one screenshot at a time kept missing
   things: a screen can have a translated app bar and still be almost
   entirely English, and a fully translated screen can still show English
   coming from a service constant it renders verbatim.

   Two passes:
     pages    — JSX attributes and text nodes holding a bare English string
     tables   — { id, label: "..." } rows in services/ and constants/ with
                no i18n sibling, i.e. dropdown and chip text

   Heuristics, not a parser: it can over-report (icon names, CSS values are
   filtered, but not perfectly). Use it to rank work, not as a gate.

   Usage:  node scripts/i18n-scan.mjs [--full]
*/

import fs from "node:fs";
import path from "node:path";

const ROOT = "src";
const FULL = process.argv.includes("--full");

/* Attributes whose value the farmer actually reads. */
const TEXT_ATTRS = ["label", "title", "placeholder", "text", "sub", "body", "aria-label", "emptyText", "hint"];
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

const files = walk(ROOT);
const pageHits = [];
const tableHits = [];

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const isPage = /[\\/]pages[\\/]/.test(file);
  const rel = file.replace(/\\/g, "/");

  if (isPage) {
    src.split("\n").forEach((line, i) => {
      if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;       // comment
      for (const attr of TEXT_ATTRS) {
        const re = new RegExp(`\\b${attr}="([^"]+)"`, "g");
        let m;
        while ((m = re.exec(line)) !== null) {
          if (looksLikeCopy(m[1])) pageHits.push({ file: rel, line: i + 1, attr, value: m[1] });
        }
      }
      /* Bare JSX text nodes: >Some words< */
      const txt = line.match(/>\s*([A-Z][A-Za-z][^<>{}"]{3,})\s*</);
      if (txt && looksLikeCopy(txt[1]) && !/^\s*[A-Z_]+\s*$/.test(txt[1])) {
        pageHits.push({ file: rel, line: i + 1, attr: "text-node", value: txt[1].trim() });
      }
    });
  } else {
    /* Service/constant tables: a row with a label but no i18n sibling. */
    src.split("\n").forEach((line, i) => {
      if (!/\blabel:\s*"/.test(line)) return;
      if (/i18n:/.test(line)) return;
      const m = line.match(/\blabel:\s*"([^"]+)"/);
      if (m && looksLikeCopy(m[1])) tableHits.push({ file: rel, line: i + 1, value: m[1] });
    });
  }
}

const byFile = (hits) => hits.reduce((acc, h) => { (acc[h.file] ||= []).push(h); return acc; }, {});

const pages = byFile(pageHits), tables = byFile(tableHits);
const rank = (o) => Object.entries(o).sort((a, b) => b[1].length - a[1].length);

console.log(`\nUNTRANSLATED UI STRINGS IN PAGES — ${pageHits.length} across ${Object.keys(pages).length} files`);
for (const [f, hits] of rank(pages)) {
  console.log(`  ${String(hits.length).padStart(4)}  ${f}`);
  if (FULL) hits.forEach((h) => console.log(`         ${h.line}: ${h.attr} = ${JSON.stringify(h.value)}`));
}

console.log(`\nTABLE LABELS WITHOUT i18n — ${tableHits.length} across ${Object.keys(tables).length} files`);
for (const [f, hits] of rank(tables)) {
  console.log(`  ${String(hits.length).padStart(4)}  ${f}`);
  if (FULL) hits.forEach((h) => console.log(`         ${h.line}: ${JSON.stringify(h.value)}`));
}

console.log(`\nTOTAL: ${pageHits.length + tableHits.length}`);
