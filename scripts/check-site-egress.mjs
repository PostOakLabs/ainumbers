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
import { resolveChangedScope, isTouched } from './_changed-files-lib.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'site-egress-baseline.json');
const MODE = (process.argv.includes('--init') || process.argv.includes('--update')) ? 'update' : 'check';
// --changed <REF> (PREREQ-CHANGED-SCOPING-1, B7 of GATE-MANIFEST-DRAFT.md §1):
// scope the scan to files touched vs <REF>. Undeterminable diff falls back to
// a FULL scan (fail-open, safe-by-cost). Never combined with --init/--update.
const changedArgIdx = process.argv.indexOf('--changed');
const changedRef = changedArgIdx !== -1 ? process.argv[changedArgIdx + 1] : null;
const CHANGED = MODE === 'check'
  ? resolveChangedScope(changedRef, { gate: 'check-site-egress.mjs (B7)', failClosed: false })
  : null;

// GATESCOPE-PUBDIRS-1: scan scope is the shared manifest scripts/published-dirs.json
// (the same DISCOVER-1 pattern regen-sitemap.mjs / verify_repo.py already use)
// instead of a hand-maintained list here — generator and gate cannot scope-drift.
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'scripts', 'published-dirs.json'), 'utf8'));
const RECURSIVE_EXCLUDE = new Set(MANIFEST.recursiveExcludeSubdirs || []);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'worktrees']);

// Lawful exceptions — excluded from this scan entirely because a narrower,
// dedicated gate already covers them. Do not widen without a CONTRACT.md
// amendment (per the row this gate shipped from, EGRESS-SITE-1).
const ALLOWLIST_PATHS = ['ledger'];
// Root-level single-file exceptions (not a directory, so ALLOWLIST_PATHS'
// dir-only filter in walk() doesn't cover them).
const ALLOWLIST_FILES = ['mcp-playground.html'];

const SCAN_DIRS = [...MANIFEST.flatDirs, ...MANIFEST.recursiveDirs]
  .filter((d) => !ALLOWLIST_PATHS.includes(d));

// CONTRACT §A10.1 — docs/ MAY fetch these two same-origin, repo-generated
// static JSON files via GET; nothing else. Stripped from the scanned body
// before PATTERNS runs so the lawful calls never register as a hit, while
// any OTHER fetch/pattern added to docs/ still fails like anywhere else.
const DOCS_ALLOWED_FETCH = [
  /fetch\s*\(\s*['"`]\.\/catalog\.json['"`]/g,
  /fetch\s*\(\s*['"`]\.\/openapi\.json['"`]/g,
];

const PATTERNS = [
  [/\bfetch\s*\(/g, 'fetch('],
  [/\bXMLHttpRequest\b/g, 'XMLHttpRequest'],
  [/new\s+WebSocket\s*\(/g, 'new WebSocket('],
  [/\bEventSource\s*\(/g, 'EventSource('],
  [/navigator\s*\.\s*sendBeacon\b/g, 'navigator.sendBeacon'],
  [/\bimport\s*\(\s*['"`]https?:/g, "import('http...')"],
  [/\bnew\s+Worker\s*\(/g, 'new Worker('],
  [/\bnew\s+SharedWorker\s*\(/g, 'new SharedWorker('],
  [/navigator\s*\.\s*serviceWorker\b/g, 'navigator.serviceWorker'],
  [/\bimportScripts\s*\(/g, 'importScripts('],
  [/\bnew\s+RTCPeerConnection\s*\(/g, 'new RTCPeerConnection('],
  [/\bnew\s+Image\s*\(/g, 'new Image('],
];

// Non-Google-Fonts, non-same-origin external resource tags — same "no
// lawful reason to reference one" posture as externalScripts (NET-3/NET-5).
// ainumbers.co (and its subdomains, e.g. mcp./anchor.) is excluded because
// an absolute self-referencing URL (<link rel="canonical">, JSON-LD, OG
// tags) is not egress — it is same-origin content written with a full URL.
const LAWFUL_RESOURCE_HOST_RE = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|([a-z0-9-]+\.)?ainumbers\.co)$/i;
// img/iframe/video/object always fetch their src on load — any external host
// there is a hit. <link> is different: most rel values (canonical, me,
// alternate, license, author...) are metadata only and fetch nothing, so
// only the rel values below actually cause the browser to make a request.
const EXTERNAL_SRC_RE = /<(img|iframe|video|object)\b[^>]*\s(?:src|data)\s*=\s*["'](?:https?:)?\/\/([^"'/]+)[^"']*["']/gi;
const LINK_TAG_RE = /<link\b[^>]*>/gi;
const FETCHING_LINK_RELS = new Set(['stylesheet', 'preconnect', 'prefetch', 'dns-prefetch', 'preload', 'icon', 'shortcut icon', 'manifest', 'modulepreload']);

function externalResourceHits(html) {
  let n = 0;
  for (const m of html.matchAll(EXTERNAL_SRC_RE)) {
    if (!LAWFUL_RESOURCE_HOST_RE.test(m[1])) n++;
  }
  for (const tag of html.matchAll(LINK_TAG_RE)) {
    const relM = tag[0].match(/\brel\s*=\s*["']([^"']+)["']/i);
    const hrefM = tag[0].match(/\bhref\s*=\s*["'](?:https?:)?\/\/([^"'/]+)[^"']*["']/i);
    if (!relM || !hrefM) continue;
    const rels = relM[1].toLowerCase().split(/\s+/);
    if (!rels.some((r) => FETCHING_LINK_RELS.has(r))) continue;
    if (!LAWFUL_RESOURCE_HOST_RE.test(hrefM[1])) n++;
  }
  return n;
}

function walk(dirAbs, dirRel, out = []) {
  for (const e of readdirSync(dirAbs, { withFileTypes: true })) {
    if (ALLOWLIST_PATHS.includes(e.name) && dirAbs === ROOT) continue;
    const rel = dirRel ? `${dirRel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || RECURSIVE_EXCLUDE.has(rel)) continue;
      walk(join(dirAbs, e.name), rel, out);
    } else if (e.isFile() && e.name.endsWith('.html')) {
      out.push(join(dirAbs, e.name));
    }
  }
  return out;
}

function rootHtmlFiles() {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.html') && !ALLOWLIST_FILES.includes(e.name))
    .map(e => join(ROOT, e.name));
}

let files = [
  ...rootHtmlFiles(),
  ...SCAN_DIRS.flatMap(d => existsSync(join(ROOT, d)) ? walk(join(ROOT, d), d) : []),
];
if (CHANGED) files = files.filter(f => isTouched(f.slice(ROOT.length + 1), CHANGED));

// found[rel] = { pattern: count }
const found = {};
// external <script src="http...">, tracked separately (no legitimate reason
// to reference one — CONTRACT §0 requires inline JS only).
const externalScripts = {};
// external non-script resource tags (img/link/iframe/video/object), same
// posture — a page that reaches an outside host on load leaks the visit.
const externalResources = {};

for (const abs of files) {
  const rel = abs.slice(ROOT.length + 1).replace(/\\/g, '/');
  const html = readFileSync(abs, 'utf-8');

  const ext = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'](https?:)?\/\/[^"']+["']/gi)];
  if (ext.length) externalScripts[rel] = ext.length;

  const extResN = externalResourceHits(html);
  if (extResN) externalResources[rel] = extResN;

  const scriptBlocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  let body = scriptBlocks.join('\n');
  if (rel.startsWith('docs/')) {
    for (const re of DOCS_ALLOWED_FETCH) body = body.replace(re, '/* A10-allowed-fetch */');
  }
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
    externalResources,
  }, null, 2) + '\n');
  const total = Object.values(found).reduce((s, p) => s + Object.values(p).reduce((a, b) => a + b, 0), 0);
  console.log(`check-site-egress: baseline written — ${Object.keys(found).length} file(s), ${total} pattern hit(s), ${Object.keys(externalScripts).length} external <script src> file(s), ${Object.keys(externalResources).length} external resource-tag file(s).`);
  process.exit(0);
}

let baseline = { files: {}, externalScripts: {}, externalResources: {} };
if (existsSync(BASELINE)) baseline = JSON.parse(readFileSync(BASELINE, 'utf-8'));
const baseFiles = baseline.files || {};
const baseExt = baseline.externalScripts || {};
const baseRes = baseline.externalResources || {};

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
for (const [rel, n] of Object.entries(externalResources)) {
  const baseN = baseRes[rel] || 0;
  if (n > baseN) newViolations.push(`${rel}: external <img/link/iframe/video/object> — ${n} occurrence(s), baseline allows ${baseN}`);
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

// Untouched files were never re-scanned in a --changed run — only claim
// "no longer matches" for a baseline entry this run actually scanned.
const healedFiles = Object.keys(baseFiles).filter(f => !found[f] && (!CHANGED || isTouched(f, CHANGED)));
const healedExt = Object.keys(baseExt).filter(f => !externalScripts[f] && (!CHANGED || isTouched(f, CHANGED)));
const healedRes = Object.keys(baseRes).filter(f => !externalResources[f] && (!CHANGED || isTouched(f, CHANGED)));
if (healedFiles.length || healedExt.length || healedRes.length) {
  console.warn(`check-site-egress: ${healedFiles.length + healedExt.length + healedRes.length} baselined file(s) no longer match — prune with --update.`);
}

const totalBaselined = Object.values(baseFiles).reduce((s, p) => s + Object.values(p).reduce((a, b) => a + b, 0), 0);
console.log(`check-site-egress: 0 new violations across ${files.length} scanned file(s)${CHANGED ? ' (touched-scope)' : ''} (${totalBaselined} baseline-shielded hit(s) in ${Object.keys(baseFiles).length} file(s); ${[...ALLOWLIST_PATHS, ...ALLOWLIST_FILES].join(', ')} excluded per lawful exception).`);
