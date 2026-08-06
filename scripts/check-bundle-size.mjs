/* Bundle budget guard — run after `vite build`, from CI or locally.

   Enforces two invariants on the INITIAL payload (the JS chunks the browser
   preloads for first paint, per dist/index.html):

   1. No Firebase/Firestore chunk is on the eager path. Firebase (~900kB) must
      stay lazy — see the Phase 16 split. A stray eager import (e.g. importing
      from the ai/index barrel in an eager screen) silently drags it back in.
   2. Total initial JS stays under BUDGET_KB.

   Fails the build (exit 1) with a clear message if either is violated. */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const BUDGET_KB = 450;
const FORBIDDEN = /^(fb-|config-)/; // firebase auth/core/firestore/messaging + config

const html = readFileSync(join(DIST, "index.html"), "utf8");
const files = [...new Set([...html.matchAll(/assets\/([A-Za-z0-9_.-]+\.js)/g)].map((m) => m[1]))];

if (!files.length) {
  console.error("✗ No JS chunks found in dist/index.html — did the build run?");
  process.exit(1);
}

let totalBytes = 0;
const rows = [];
for (const f of files) {
  const bytes = statSync(join(DIST, "assets", f)).size;
  totalBytes += bytes;
  rows.push({ f, kb: bytes / 1024 });
}

rows.sort((a, b) => b.kb - a.kb);
console.log("Initial (preloaded) JS chunks:");
for (const { f, kb } of rows) console.log(`  ${kb.toFixed(1).padStart(8)} KB  ${f}`);
const totalKb = totalBytes / 1024;
console.log(`  ${"-".repeat(30)}`);
console.log(`  ${totalKb.toFixed(1).padStart(8)} KB  TOTAL`);

let failed = false;

const leaked = files.filter((f) => FORBIDDEN.test(f));
if (leaked.length) {
  console.error(`\n✗ Firebase/config chunk on the eager path: ${leaked.join(", ")}`);
  console.error("  Firebase must load lazily. An eager screen likely imports it");
  console.error("  (often via the ai/index barrel). Import the specific module instead.");
  failed = true;
}

if (totalKb > BUDGET_KB) {
  console.error(`\n✗ Initial JS ${totalKb.toFixed(1)} KB exceeds budget ${BUDGET_KB} KB (+${(totalKb - BUDGET_KB).toFixed(1)} KB).`);
  failed = true;
}

if (failed) process.exit(1);
console.log(`\n✓ Initial JS ${totalKb.toFixed(1)} KB within budget ${BUDGET_KB} KB, no Firebase on the eager path.`);
