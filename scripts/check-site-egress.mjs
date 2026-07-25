#!/usr/bin/env node
// scripts/check-site-egress.mjs — EGRESS-SITE-1.
//
// CONTRACT.md §A4.7 confesses the gap this closes: "there is no site-repo
// static gate that scans tool pages for fetch(" — the browser-side zero-egress
// constraint (CONTRACT §0) was carried only by policy + the per-page CSP tag
// (scripts/check-csp-consistency.mjs), never by a scan of the JS itself. This
// is that scan: it greps tools/, guides/, chaingraph/, and the root pages for
// network-capable JS API references and fails on anything new.
//
// Lawful exceptions are carved out by ALLOWLIST_PATHS / ALLOWLIST_FILES, not
// scanned here at all because each already has its own narrower, more
// precise gate:
//   - ledger/                CONTRACT §A7 — permits exactly anchor.ainumbers.co,
//                             enforced by scripts/check-ledger-hermetic.mjs.
//   - mcp-playground.html     CONTRACT §A8 — permits exactly mcp.ainumbers.co,
//                             enforced by scripts/check-playground-hermetic.mjs.
//                             SI-6 has not shipped the page yet; the entry is
//                             a no-op until it exists.
//
// Baseline-shielded (same pattern as check-csp-consistency.mjs /
// copy-hallmarks): a hit in scripts/site-egress-baseline.json is a KNOWN,
// reviewed, inert reference (vendored-library dead code, sample text inside a
// template literal shown to the user, WASM glue whose fetch path is
// unreachable because the binary is embedded) — it does not fail the gate,
// but it also does not get bigger. A NEW file/pattern not in the baseline
// fails. Counts only go down. Flags: --init / --update regenerate the
// baseline from current state.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'site-egress-baseline.json');
const MODE = (process.argv.includes('--init') || process.argv.includes('--update')) ? 'update' : 'check';

const SCAN_DIRS = ['tools', 'guides', 'chaingraph'];
const SKIP_DIRS = new Set(['.git', 'node_modules', 'worktrees']);

// Lawful exceptions — excluded from this scan entirely because a narrower,
// dedicated gate already covers them. Do not widen without a CONTRACT.md
// amendment (per the row this gate shipped from, EGRESS-SITE-1).
const ALLOWLIST_PATHS = ['ledger'];
// Root-level single-file exceptions (not a directory, so ALLOWLIST_PATHS'
// dir-only filter in walk() doesn't cover them).
const ALLOWLIST_FILES = ['mcp-playground.html'];

const PATTERNS = [
  [/\bfetch\s*\(/g, 'fetch('],
  [/new\s+XMLHttpRequest\b/g, 'XMLHttpRequest'],
  [/new\s+WebSocket\s*\(/g, 'new WebSocket('],
  [/\bEventSource\s*\(/g, 'EventSource('],
  [/navigator\s*\.\s*sendBeacon\b/g, 'navigator.sendBeacon'],
  [/\bimport\s*\(\s*['"`]https?:/g, "import('http...')"],
];

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (ALLOWLIST_PATHS.includes(e.name) && dir === ROOT) continue;
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), out); }
    else if (e.isFile() && e.name.endsWith('.html')) out.push(join(dir, e.name));
  }
  return out;
}

function rootHtmlFiles() {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.html') && !ALLOWLIST_FILES.includes(e.name))
    .map(e => join(ROOT, e.name));
}

const files = [
  ...rootHtmlFiles(),
  ...SCAN_DIRS.flatMap(d => existsSync(join(ROOT, d)) ? walk(join(ROOT, d)) : []),
];

// found[rel] = { pattern: count }
const found = {};
// external <script src="http...">, tracked separately (no legitimate reason
// to reference one — CONTRACT §0 requires inline JS only).
const externalScripts = {};

for (const abs of files) {
  const rel = abs.slice(ROOT.length + 1).replace(/\\/g, '/');
  const html = readFileSync(abs, 'utf-8');

  const ext = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'](https?:)?\/\/[^"']+["']/gi)];
  if (ext.length) externalScripts[rel] = ext.length;

  const scriptBlocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const body = scriptBlocks.join('\n');
  for (const [re, label] of PATTERNS) {
    const n = (body.match(re) || []).length;
    if (n > 0) {
      found[rel] = found[rel] || {};
      found[rel][label] = n;
    }
  }
}

if (MODE === 'update') {
  writeFileSync(BASELINE, JSON.stringify({
    generated: 'check-site-egress.mjs --update',
    note: 'Each entry is a reviewed, inert textual match (dead vendored-library code, sample text inside a template literal, unreachable WASM glue) — NOT a lawful live network call. A file/pattern here still runs through preflight; it just does not fail until the count goes UP.',
    files: found,
    externalScripts,
  }, null, 2) + '\n');
  const total = Object.values(found).reduce((s, p) => s + Object.values(p).reduce((a, b) => a + b, 0), 0);
  console.log(`check-site-egress: baseline written — ${Object.keys(found).length} file(s), ${total} pattern hit(s), ${Object.keys(externalScripts).length} external <script src> file(s).`);
  process.exit(0);
}

let baseline = { files: {}, externalScripts: {} };
if (existsSync(BASELINE)) baseline = JSON.parse(readFileSync(BASELINE, 'utf-8'));
const baseFiles = baseline.files || {};
const baseExt = baseline.externalScripts || {};

const newViolations = [];
for (const [rel, patterns] of Object.entries(found)) {
  const baseP = baseFiles[rel] || {};
  for (const [label, n] of Object.entries(patterns)) {
    const baseN = baseP[label] || 0;
    if (n > baseN) newViolations.push(`${rel}: "${label}" — ${n} occurrence(s), baseline allows ${baseN}`);
  }
}
for (const [rel, n] of Object.entries(externalScripts)) {
  const baseN = baseExt[rel] || 0;
  if (n > baseN) newViolations.push(`${rel}: external <script src> — ${n} occurrence(s), baseline allows ${baseN}`);
}

if (newViolations.length) {
  console.error(`check-site-egress FAILED: ${newViolations.length} new network-capable reference(s) not in the baseline:\n`);
  newViolations.forEach(v => console.error(`  ${v}`));
  console.error('\nCONTRACT §0 requires zero network calls after page load on every tools/guides/chaingraph page.');
  console.error('If this is genuinely dead/inert code (vendored library, sample text, unreachable WASM path), review it, then run:');
  console.error('  node scripts/check-site-egress.mjs --update');
  console.error('If it is a REAL live network call, remove it — this gate does not accept new egress.');
  process.exit(1);
}

const healedFiles = Object.keys(baseFiles).filter(f => !found[f]);
const healedExt = Object.keys(baseExt).filter(f => !externalScripts[f]);
if (healedFiles.length || healedExt.length) {
  console.warn(`check-site-egress: ${healedFiles.length + healedExt.length} baselined file(s) no longer match — prune with --update.`);
}

const totalBaselined = Object.values(baseFiles).reduce((s, p) => s + Object.values(p).reduce((a, b) => a + b, 0), 0);
console.log(`check-site-egress: 0 new violations across ${files.length} scanned file(s) (${totalBaselined} baseline-shielded hit(s) in ${Object.keys(baseFiles).length} file(s); ${[...ALLOWLIST_PATHS, ...ALLOWLIST_FILES].join(', ')} excluded per lawful exception).`);
