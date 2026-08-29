#!/usr/bin/env node
// scripts/check-csp-consistency.mjs — FOOTER-1 rider (SSOT-CHROME-1 §C3),
// extended by CSP-CONTRACT-1 (CONTRACT.md §0 baseline CSP requirement).
// Every static page's <meta http-equiv="Content-Security-Policy"> content must
// match one of a small closed set of named canonical profiles, AND every page
// MUST carry a CSP tag at all. This is a CHECKER only — CSP tags are still
// hand-authored per page; it just catches drift and absence. Baseline-shielded
// (mirrors dead-link-check.mjs) on BOTH axes: a drifted or missing-CSP file
// NOT in the baseline -> FAIL (recurrence guard); a baselined file that now
// matches a canonical profile, or a baselined missing file that now has a
// tag -> WARN (prune). Counts only go down.
// Flags: --init / --update regenerate the baseline from current state.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSkipDir } from './_walk-skip-dirs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'csp-consistency-baseline.json');
const MODE = (process.argv.includes('--init') || process.argv.includes('--update')) ? 'update' : 'check';

const SCAN_DIRS = ['tools', 'chaingraph', 'guides'];

// Named canonical profiles (2026-07-14 survey: these two cover ~88% of the
// 834-file estate already; everything else is legacy drift, baselined below).
const PROFILES = {
  CSP_STANDARD: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';`,
  CSP_WASM_VM: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'none'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';`,
  // CSP-CONTRACT-1: Orchestrated Workflow Runner (CONTRACT §5.3) + ChainGraph
  // chain pages (CONTRACT §A3.1) — the sole permitted relaxation is
  // frame-src 'self' for the same-origin composer bridge iframe. No worker
  // usage in this bridge, so worker-src stays 'none' (same as CSP_STANDARD).
  CSP_COMPOSER: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'self'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';`,
};
const CANONICAL_VALUES = new Set(Object.values(PROFILES));

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!isSkipDir(e.name)) walk(join(dir, e.name), out); }
    else if (e.isFile() && e.name.endsWith('.html')) out.push(join(dir, e.name));
  }
  return out;
}

function cspOf(html) {
  const m = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i);
  return m ? m[1] : null;
}

let baseline = {};
if (MODE === 'check' && existsSync(BASELINE)) {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf-8'));
}

function rootHtmlFiles() {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.html'))
    .map(e => join(ROOT, e.name));
}

const files = [
  ...rootHtmlFiles(),
  ...SCAN_DIRS.flatMap(d => existsSync(join(ROOT, d)) ? walk(join(ROOT, d)) : []),
];
const drifted = {}; // rel path -> csp content
const missing = [];

for (const abs of files) {
  const rel = abs.slice(ROOT.length + 1).replace(/\\/g, '/');
  const html = readFileSync(abs, 'utf-8');
  const csp = cspOf(html);
  if (csp == null) { missing.push(rel); continue; }
  if (!CANONICAL_VALUES.has(csp)) drifted[rel] = csp;
}

if (MODE === 'update') {
  writeFileSync(BASELINE, JSON.stringify({ generated: 'check-csp-consistency.mjs --update', files: drifted, missing }, null, 2) + '\n');
  console.log(`csp-consistency: baseline written — ${Object.keys(drifted).length} drifted file(s), ${missing.length} missing-CSP file(s).`);
  process.exit(0);
}

const baselineFiles = baseline.files || {};
const baselineMissing = new Set(baseline.missing || []);
const newDrift = Object.keys(drifted).filter(f => !(f in baselineFiles));
const healed = Object.keys(baselineFiles).filter(f => !(f in drifted));
const newMissing = missing.filter(f => !baselineMissing.has(f));
const healedMissing = [...baselineMissing].filter(f => !missing.includes(f));

if (newDrift.length || newMissing.length) {
  if (newDrift.length) {
    console.error(`check-csp-consistency: ${newDrift.length} file(s) have a NEW CSP value not matching a canonical profile and not in the baseline:`);
    newDrift.slice(0, 20).forEach(f => console.error(`  ${f}`));
    console.error('Either match CSP_STANDARD/CSP_WASM_VM/CSP_COMPOSER in scripts/check-csp-consistency.mjs, or run --update after a deliberate CSP change (review the diff).');
  }
  if (newMissing.length) {
    console.error(`check-csp-consistency: ${newMissing.length} file(s) have NO <meta http-equiv="Content-Security-Policy"> tag and are not in the baseline:`);
    newMissing.slice(0, 20).forEach(f => console.error(`  ${f}`));
    console.error('CONTRACT.md §0 requires a baseline CSP on every page. Add a canonical profile tag (see RESEARCH-CSP-MISSING-2026-07-14.md for the page->profile mapping), or run --update after a deliberate, reviewed exception.');
  }
  process.exit(1);
}

if (healed.length) {
  console.warn(`check-csp-consistency: ${healed.length} baselined file(s) now match a canonical profile — prune with --update.`);
}
if (healedMissing.length) {
  console.warn(`check-csp-consistency: ${healedMissing.length} baselined missing-CSP file(s) now carry a tag — prune with --update.`);
}

console.log(`check-csp-consistency: 0 new drift, 0 new missing-CSP (${Object.keys(drifted).length} drift-baselined, ${missing.length} missing-baselined).`);
