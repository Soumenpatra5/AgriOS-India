#!/usr/bin/env node
/* Finds translation strings written in the wrong script.

   A `bn:` value containing a Devanagari letter (or a `hi:` value containing a
   Bengali one) is always a slip — a character typed or pasted from the wrong
   keyboard. It is invisible in review because the surrounding text looks
   right, and it renders as a wrong glyph mid-word to the one audience that
   would notice.

   The danda (U+0964) and double danda (U+0965) sit in the Devanagari block but
   are shared punctuation, used in Bengali too, so they are not flagged.

   A line that legitimately mixes scripts — naming languages in their own
   script, for instance — opts out with a "mixed-script-ok" comment on that
   line or the one above it, like an eslint-disable-next-line. It is rare
   enough to be worth spelling out at the call site.

   Usage:  node scripts/check-scripts.mjs        (exit 1 if anything is found)
*/

import fs from "node:fs";
import path from "node:path";

const DEV_LO = 0x0900, DEV_HI = 0x097f;
const BEN_LO = 0x0980, BEN_HI = 0x09ff;
const SHARED = new Set([0x0964, 0x0965]); // danda, double danda

const strayDevanagari = (s) =>
  [...s].filter((ch) => {
    const c = ch.codePointAt(0);
    return c >= DEV_LO && c <= DEV_HI && !SHARED.has(c);
  });

const strayBengali = (s) =>
  [...s].filter((ch) => {
    const c = ch.codePointAt(0);
    return c >= BEN_LO && c <= BEN_HI;
  });

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|\.claude|dist/.test(p)) walk(p, out);
    } else if (/\.(jsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const findings = [];
for (const file of walk("src")) {
  const rel = file.replace(/\\/g, "/");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    /* Opt-out on this line or the one above, like eslint-disable-next-line. */
    if (line.includes("mixed-script-ok") || (lines[i - 1] || "").includes("mixed-script-ok")) return;
    for (const m of line.matchAll(/\bbn:\s*"([^"]*)"/g)) {
      const stray = strayDevanagari(m[1]);
      if (stray.length) findings.push({ rel, line: i + 1, lang: "bn", stray, text: m[1] });
    }
    for (const m of line.matchAll(/\bhi:\s*"([^"]*)"/g)) {
      const stray = strayBengali(m[1]);
      if (stray.length) findings.push({ rel, line: i + 1, lang: "hi", stray, text: m[1] });
    }
  });
}

if (!findings.length) {
  console.log("No mixed-script translation strings.");
  process.exit(0);
}

console.log(`Mixed-script translation strings — ${findings.length}\n`);
for (const f of findings) {
  const wrong = f.lang === "bn" ? "Devanagari" : "Bengali";
  console.log(`  ${f.rel}:${f.line}`);
  console.log(`    ${f.lang}: "${f.text}"`);
  console.log(`    stray ${wrong}: ${f.stray.map((c) => `${c} (U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")})`).join(", ")}\n`);
}
process.exit(1);
