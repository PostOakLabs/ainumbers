#!/usr/bin/env node
/**
 * scripts/check-page-hash-refusal.mjs — PAGE-BUILDARTIFACT-HASH-REFUSAL-1, stage 1 advisory.
 *
 * A node page builds its artifact client-side and stamps execution_hash through an inline
 * copy of the shared canonicalizer. The kernel-side hash path (chaingraph/kernels/_hash.mjs)
 * NEVER throws on unhashable input: walkIJson refuses non-finite numbers, integers beyond
 * 2^53, nesting past MAX_DEPTH (512) and payloads over MAX_ELEMENTS (1,000,000) with a named
 * refusal, and the artifact carries execution_hash null plus a refusal reason. Most node
 * pages are NOT at that parity: their inline hash seam asserts I-JSON by throwing
 * ("OCG: integer exceeds 2^53; pass as string"), so an input a visitor can type into the
 * page's own JSON fields kills the run after the verdict has already painted, with no hash
 * and no export. Measured 2026-11-14 on origin/main and re-measured at row claim time
 * 2026-11-21 (origin/main e77be0c991): 677 node pages chaingraph/art-*.html, of which 257
 * carry the throwing assert generation; 7 carry a hash_refusal already, each a per-page
 * hand-typed walker (chaingraph/783-emv-mpm-qr-validator.html, 785, 845, 798, art-769 and
 * two more) with no SSOT and no byte enforcement. A second, older generation
 * (art-768-medicare-plan-comparison.html shape) neither throws nor refuses: it silently
 * hashes non-I-JSON input, which the shared canonicalizer exists to prevent.
 *
 * What this gate does, per scanned page:
 *   1. Extract every executable inline <script> block (same extraction as
 *      scripts/check-page-kernel-parity.mjs) and run them whole-block, byte for byte, in a
 *      browser-faithful node:vm context (the universal no-op DOM stub, WebCrypto, TextEncoder).
 *   2. Append a probe driver to the SAME script text so it shares the page's top-level
 *      lexical scope, then drive the page's own artifact-build entry (buildArtifact when the
 *      page declares one, else run) with a valid fixture preimage and with each unhashable
 *      shape: NaN, 1e300, 2^53+1 injected into policy_parameters, a 5000-deep nested value,
 *      and a 1,000,001-element array.
 *   3. A THROW on any shape is a FINDING (the measured defect). A drive that produces a
 *      truthy execution_hash on an unhashable shape is a FINDING (hashed_unhashable: the
 *      kernel refuses the same input, so the page hash can never verify). execution_hash
 *      null plus a hash_refusal object is a PASS. A page whose artifact hash does not
 *      change under injection is DOM-BOUND under the probe (its inputs come from page
 *      fields, so the injected preimage never reaches the artifact step): reported, never
 *      a finding, and its hash seam is NOT probed separately, because a page may legitimately
 *      guard at the artifact level while its raw seam still throws (the 783 shape).
 *
 * Baseline ratchet (same doctrine as scripts/copy-hallmarks-baseline.json): counts only go
 * down. --write-baseline records the current per-page finding counts. On a normal run, a
 * page PINNED in the baseline that now carries MORE findings than its pinned count is a
 * RED (exit 1) even though the gate is otherwise advisory: a page that was clean or
 * refusal-guarded must not regress to throwing. Pages with no baseline entry (legacy debt
 * and new pages) are reported, never red; folding them in is --write-baseline's job. The
 * blocking flip for the legacy throws themselves is a later row's decision after the
 * advisory window, per the row text.
 *
 * Stage 1 is ADVISORY about the estate: exit 0 whenever no pinned page regressed. Exit 2
 * is reserved for a usage error or a harness crash. It writes nothing into the repo tree
 * except --write-baseline's own file.
 *
 * SSOT: the never-throw helper this row registers is __ocgHashRefusal, a one-line pair in
 * scripts/inline-ssot-sync-manifest.json whose SSOT line lives in
 * chaingraph/kernels/fix-hash-scheme.mjs's OCG_BLOCK (id ocgHashRefusal, mode line). New
 * and changed pages carry it and call it BEFORE the hash seam; this gate is the advisory
 * check that the call site actually keeps the artifact step throw-free.
 *
 * Usage:
 *   node scripts/check-page-hash-refusal.mjs                        # estate scan, advisory
 *   node scripts/check-page-hash-refusal.mjs --changed origin/main  # only node pages changed vs <ref>
 *   node scripts/check-page-hash-refusal.mjs --write-baseline       # scan + write the baseline file
 *   node scripts/check-page-hash-refusal.mjs --json <file>          # machine-readable report
 *   node scripts/check-page-hash-refusal.mjs --self-test            # RED+GREEN mutation controls
 *   --root <dir>    directory holding chaingraph/ (default: this repo; selftests use a fixture)
 *   --baseline <f>  baseline file (default: <root>/scripts/page-hash-refusal-baseline.json)
 *
 * Node built-ins only; no network, no randomness, no chaingraph.json read.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '..');

const argv = process.argv.slice(2);
function argValue(flag) {
  const i = argv.indexOf(flag);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : null;
}
const ROOT = resolve(argValue('--root') || DEFAULT_ROOT);
const CHAINGRAPH = resolve(ROOT, 'chaingraph');
const BASELINE_ARG = argValue('--baseline');
const BASELINE_PATH = BASELINE_ARG ? resolve(BASELINE_ARG) : resolve(ROOT, 'scripts', 'page-hash-refusal-baseline.json');
const CHANGED_REF = argValue('--changed');
const WRITE_BASELINE = argv.includes('--write-baseline');
const SELF_TEST = argv.includes('--self-test');
const JSON_OUT_PATH = argValue('--json');
const VERBOSE = argv.includes('--verbose');
const LOAD_TIMEOUT_MS = 30000;
const LEG_TIMEOUT_MS = 15000;
const CONCURRENCY = 6;
const TOO_DEEP_DEPTH = 5000;   // far above MAX_DEPTH (512), far below real stack limits
const TOO_MANY_N = 1000001;    // one over MAX_ELEMENTS (1,000,000)

// ---------------------------------------------------------------- page selection

export function listEstatePages(rootDir) {
  const out = [];
  let entries;
  try { entries = readdirSync(resolve(rootDir, 'chaingraph')); } catch { return out; }
  // Two node-page naming generations: art-<n>-<slug>.html and the bare <n>-<slug>.html
  // generation that followed it (chaingraph/783-emv-mpm-qr-validator.html shape). Hub and
  // index html does not match either shape.
  for (const e of entries) if (/^(?:art-)?\d+.*\.html$/.test(e)) out.push(`chaingraph/${e}`);
  return out.sort();
}

/** art-*.html files added or modified vs <ref>, falling back to the full estate when the ref does not resolve. */
export function listChangedPages(rootDir, ref) {
  const fallback = () => ({ pages: listEstatePages(rootDir), fallback: true });
  if (!ref) return { pages: listEstatePages(rootDir), fallback: false };
  const r = spawnSync('git', ['-C', rootDir, 'diff', '--name-only', ref, '--', 'chaingraph'], { encoding: 'utf8', env: gitEnv() });
  if (r.status !== 0) return fallback();
  const pages = r.stdout.split('\n').map((s) => s.trim().replace(/\\/g, '/'))
    .filter((f) => /^chaingraph\/(?:art-)?\d+.*\.html$/.test(f));
  return { pages: pages.sort(), fallback: false };
}

// ---------------------------------------------------------------- vm harness (parity-gate shape)

function extractScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs) || [])[1] || '';
    if (/json/i.test(type) || /module/i.test(type) || /\bsrc\s*=/i.test(attrs)) continue;
    if (m[2].trim()) out.push(m[2]);
  }
  return out;
}

function makeStub() {
  const target = function () {};
  const p = new Proxy(target, {
    get(_t, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'then') return undefined;
      if (k === 'length') return 0;
      if (typeof k === 'symbol') return undefined;
      return p;
    },
    apply() { return p; },
    construct() { return p; },
    set() { return true; },
  });
  return p;
}

function makeContext() {
  const stub = makeStub();
  const noop = () => 0;
  const sandbox = {
    window: stub, document: stub, navigator: stub, location: stub, localStorage: stub, sessionStorage: stub,
    history: stub, screen: stub, Event: stub, CustomEvent: stub, HTMLElement: stub, Node: stub, Blob: stub, FileReader: stub,
    MutationObserver: stub, IntersectionObserver: stub, ResizeObserver: stub, matchMedia: stub, getComputedStyle: stub, CSS: stub, Image: stub, DOMParser: stub, requestIdleCallback: () => 0,
    atob, btoa, TextEncoder, TextDecoder, URL, URLSearchParams, structuredClone, crypto: webcrypto,
    console: { log: noop, warn: noop, error: noop, info: noop, debug: noop },
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop, queueMicrotask: noop,
    alert: noop, performance: { now: () => 0 },
  };
  return vm.createContext(sandbox);
}

// Appended to the page's own script text so the probe shares the page's top-level lexical
// bindings (let _pp/_result/_artifact are invisible to a separate vm script).
const DRIVER = `
globalThis.__hashProbe = {
  hasEntry: function () { return (typeof buildArtifact === 'function') || (typeof run === 'function'); },
  entryName: function () { return (typeof buildArtifact === 'function') ? 'buildArtifact' : (typeof run === 'function') ? 'run' : null; },
  injectable: function () {
    var ok = false;
    try { if (typeof _pp !== 'undefined') ok = true; } catch (e) {}
    try { if (typeof _result !== 'undefined') ok = true; } catch (e) {}
    return ok;
  },
  drive: async function (pp, out) {
    var entry = (typeof buildArtifact === 'function') ? buildArtifact : run;
    try { if (typeof _pp !== 'undefined') _pp = pp; } catch (e) {}
    try { if (typeof _result !== 'undefined') _result = { output_payload: out, compliance_flags: [] }; } catch (e) {}
    await entry();
    var art = null;
    try { if (typeof _artifact !== 'undefined' && _artifact) art = _artifact; } catch (e) {}
    if (!art) { try { if (typeof _lastArtifact !== 'undefined' && _lastArtifact) art = _lastArtifact; } catch (e) {} }
    if (!art) return { artifact: false };
    return {
      artifact: true,
      hash: art.execution_hash === undefined ? null : art.execution_hash,
      refusal: art.hash_refusal ? { reason: String(art.hash_refusal.reason || ''), detail: String(art.hash_refusal.detail || '') } : null,
    };
  },
};
`;

function withTimeout(p, ms, label) {
  let t;
  return Promise.race([
    p,
    new Promise((_res, rej) => { t = setTimeout(() => rej(new Error(`probe leg ${label} timed out after ${ms}ms`)), ms); }),
  ]).finally(() => clearTimeout(t));
}

// ---------------------------------------------------------------- unhashable shapes

const VALID_PP = { plan_year: 2026, amount_cents: 1000 };
const VALID_OUT = { valid_input: true, note: 'fixture preimage, PAGE-BUILDARTIFACT-HASH-REFUSAL-1' };

function deepValue(depth) {
  let v = { leaf: 1 };
  for (let i = 0; i < depth; i++) v = { n: v };
  return v;
}

// name → the junk value injected as policy_parameters.junk (deep/many wrap the whole pp instead)
export function unhashableShapes() {
  return [
    ['nonfinite_nan', (pp) => ({ ...pp, junk: NaN })],
    ['unsafe_1e300', (pp) => ({ ...pp, junk: 1e300 })],
    ['unsafe_2p53', (pp) => ({ ...pp, junk: 9007199254740993 })],
    ['too_deep', () => ({ junk: deepValue(TOO_DEEP_DEPTH) })],
    ['too_many', () => ({ junk: new Array(TOO_MANY_N).fill(0) })],
  ];
}

const REFUSAL_REASONS = new Set(['REFUSED_INPUT_UNSAFE_NUMBER', 'REFUSED_INPUT_HASH_LIMIT']);
const HEX64 = /^[0-9a-f]{64}$/;

// ---------------------------------------------------------------- per-page scan

/**
 * Scan ONE page's HTML. Returns:
 *   { cls, entry, findings: [{leg, kind, detail}], notes: [..] }
 * cls: probe-ok | dom-bound | undrivable | no-entry | load-error
 */
export async function scanPage(html, name = 'page') {
  const findings = [];
  const notes = [];
  const codes = extractScripts(html);
  if (!codes.length) return { cls: 'load-error', entry: null, findings, notes: ['no executable inline script blocks'] };
  const ctx = makeContext();
  try {
    vm.runInContext(codes.join('\n') + '\n' + DRIVER, ctx, { timeout: LOAD_TIMEOUT_MS, filename: `${name}#inline` });
  } catch (e) {
    return { cls: 'load-error', entry: null, findings, notes: [`page throws on load: ${String(e && e.message || e).slice(0, 140)}`] };
  }
  const probe = ctx.__hashProbe;
  if (!probe || probe.hasEntry() !== true) return { cls: 'no-entry', entry: null, findings, notes: ['no drivable buildArtifact/run entry'] };

  const entry = probe.entryName();
  if (probe.injectable() !== true) {
    // run()-shaped DOM-bound generation: inputs come from page fields, the injected
    // preimage cannot reach the artifact step headlessly. Report, never a finding.
    return { cls: 'dom-bound', entry, findings, notes: ['entry is DOM-bound (no injectable _pp/_result); unhashable legs not drivable headlessly'] };
  }

  const drive = (pp, out, leg) => withTimeout(probe.drive(pp, out), LEG_TIMEOUT_MS, leg);

  let validHash;
  try {
    const v = await drive(VALID_PP, VALID_OUT, 'valid');
    if (v.artifact !== true) return { cls: 'no-entry', entry, findings, notes: ['entry produced no artifact under the probe'] };
    validHash = v.hash === null ? null : String(v.hash);
    if (validHash !== null && !HEX64.test(validHash.replace(/^sha256:/, ''))) notes.push(`valid leg hash is not 64-hex (${validHash.slice(0, 24)})`);
  } catch (e) {
    // The valid fixture is hashable, so a hash-path refusal cannot fire on it: a throw
    // here is the entry reading probe state this harness does not provide (measured:
    // art-317-rhc-multiplier-reconciler.html reads a .verdict global), i.e. the page is
    // undrivable at artifact level headlessly. Reported, never a finding - the junk legs
    // only run after a healthy valid drive, so a throw THERE is genuinely input-caused.
    return { cls: 'undrivable', entry, findings, notes: [`valid drive threw on probe state: ${String(e && e.message || e).slice(0, 120)}`] };
  }

  for (const [shape, mk] of unhashableShapes()) {
    try {
      const r = await drive(mk(VALID_PP), VALID_OUT, shape);
      if (r.artifact !== true) { notes.push(`${shape}: no artifact produced`); continue; }
      const hash = r.hash === null ? null : String(r.hash);
      if (r.refusal && REFUSAL_REASONS.has(r.refusal.reason)) continue; // PASS: refused, no hash
      if (hash !== null) {
        // injection is proven to have reached the artifact step only when the hash MOVED
        if (validHash !== null && hash === validHash) { notes.push(`${shape}: hash unchanged under injection (dom-bound at drive level)`); continue; }
        findings.push({ leg: shape, kind: 'hashed_unhashable', detail: `execution_hash produced on ${shape}` });
      } else {
        findings.push({ leg: shape, kind: 'null_hash_no_refusal', detail: `execution_hash null with no hash_refusal on ${shape}` });
      }
    } catch (e) {
      findings.push({ leg: shape, kind: 'throw', detail: String(e && e.message || e).slice(0, 160) });
    }
  }
  return { cls: 'probe-ok', entry, findings, notes };
}

// ---------------------------------------------------------------- baseline

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return { pages: {} };
  try { return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')); } catch { return { pages: {} }; }
}

function pinnedCount(baseline, rel) {
  const e = baseline && baseline.pages && baseline.pages[rel];
  return e && typeof e.findings === 'number' ? e.findings : null;
}

// ---------------------------------------------------------------- main

// A page's top-level code may kick off an async chain (run() at load, promise
// continuations) that rejects later under the stub DOM, OUTSIDE any try/catch
// this module holds: the continuation runs on the host event loop and surfaces
// as a process-level rejection that would otherwise kill the whole scan
// (measured: art-758-hdhp-ppo-break-even.html renders stub-DOM values in a
// microtask). Swallow and count; leg timeouts bound the drive legs.
let pageAsyncNoise = 0;
process.on('unhandledRejection', () => { pageAsyncNoise++; });

async function main() {
  const sel = CHANGED_REF ? listChangedPages(ROOT, CHANGED_REF) : { pages: listEstatePages(ROOT), fallback: false };
  const pages = sel.pages;
  if (sel.fallback) console.log(`check-page-hash-refusal: --changed ref did not resolve, falling back to the FULL estate scan (${pages.length} pages)`);

  const results = new Map();
  let idx = 0;
  async function worker() {
    while (idx < pages.length) {
      const rel = pages[idx++];
      const abs = resolve(ROOT, rel);
      let html;
      try { html = readFileSync(abs, 'utf8'); } catch { results.set(rel, { cls: 'load-error', entry: null, findings: [], notes: ['unreadable'] }); continue; }
      results.set(rel, await scanPage(html, rel));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(pages.length, 1)) }, worker));

  const counts = { pages: pages.length, probeOk: 0, domBound: 0, undrivable: 0, noEntry: 0, loadError: 0, findings: 0 };
  const byCls = { 'probe-ok': 'probeOk', 'dom-bound': 'domBound', 'undrivable': 'undrivable', 'no-entry': 'noEntry', 'load-error': 'loadError' };
  const redLines = [];
  const baseline = WRITE_BASELINE ? { pages: {} } : loadBaseline();

  for (const rel of pages) {
    const r = results.get(rel);
    counts[byCls[r.cls]] = (counts[byCls[r.cls]] || 0) + 1;
    counts.findings += r.findings.length;
    const pin = pinnedCount(baseline, rel);
    if (pin !== null && r.findings.length > pin) {
      redLines.push(`${rel}: ${r.findings.length} finding(s) vs pinned ${pin} (ratchet, counts only go down): ${r.findings.map((f) => `${f.kind}:${f.leg}`).join(', ')}`);
    }
    if (r.findings.length && (VERBOSE || r.cls === 'probe-ok')) {
      for (const f of r.findings) console.log(`  FINDING ${rel} ${f.kind}:${f.leg} ${f.detail}`);
    }
    for (const n of r.notes) if (VERBOSE) console.log(`  note ${rel} ${n}`);
    if (WRITE_BASELINE && r.findings.length) baseline.pages[rel] = { findings: r.findings.length, kinds: r.findings.map((f) => `${f.kind}:${f.leg}`) };
  }

  const classes = `probe-ok ${counts.probeOk}, dom-bound ${counts.domBound}, undrivable ${counts.undrivable}, no-entry ${counts.noEntry}, load-error ${counts.loadError}`;
  if (WRITE_BASELINE) {
    mkdirSync(dirname(BASELINE_PATH), { recursive: true });
    const banner = {
      _comment: 'PAGE-BUILDARTIFACT-HASH-REFUSAL-1 baseline: per-node-page finding counts for scripts/check-page-hash-refusal.mjs. Counts only go down (ratchet): a page pinned here that carries MORE findings on a later run is a RED. Pages absent from this map are reported, never red; --write-baseline folds them in. Stage 1 is advisory about the legacy throws themselves; the blocking flip is a later row.',
      generatedAt: new Date().toISOString(),
      totals: { pages: counts.pages, findings: counts.findings },
      pages: Object.fromEntries(Object.entries(baseline.pages).sort(([a], [b]) => (a < b ? -1 : 1))),
    };
    writeFileSync(BASELINE_PATH, JSON.stringify(banner, null, 2) + '\n');
    console.log(`check-page-hash-refusal: baseline written ${BASELINE_PATH} (${counts.pages} pages, ${counts.findings} findings across ${Object.keys(baseline.pages).length} pages)`);
  }

  console.log(`check-page-hash-refusal: ${counts.pages} page(s) scanned (${CHANGED_REF ? 'changed vs ' + CHANGED_REF : 'estate'}) [${classes}], ${counts.findings} finding(s)${pageAsyncNoise ? `, ${pageAsyncNoise} page async rejection(s) swallowed under the stub DOM` : ''}. Stage 1 advisory: throws and hashed-unhashable results are findings; execution_hash null + hash_refusal passes; the baseline ratchet (pinned counts only go down) is the one hard red.`);

  if (JSON_OUT_PATH) {
    const report = { totals: counts, pages: Object.fromEntries([...results.entries()].map(([rel, r]) => [rel, { cls: r.cls, entry: r.entry, findings: r.findings, notes: r.notes }])) };
    mkdirSync(dirname(resolve(JSON_OUT_PATH)), { recursive: true });
    writeFileSync(JSON_OUT_PATH, JSON.stringify(report, null, 1));
  }

  if (redLines.length) {
    console.error(`check-page-hash-refusal: RATCHET RED - ${redLines.length} pinned page(s) regressed:\n  ` + redLines.join('\n  '));
    process.exit(1);
  }
  process.exit(0);
}

// ---------------------------------------------------------------- self-test (GATE-SELFTEST-META-1)

/** The live SSOT __ocgHashRefusal line, extracted from fix-hash-scheme.mjs's OCG_BLOCK. */
export function ssotHashRefusalLine(rootDir = ROOT) {
  const src = readFileSync(resolve(rootDir, 'chaingraph', 'kernels', 'fix-hash-scheme.mjs'), 'utf8');
  const i = src.indexOf('function __ocgHashRefusal(');
  if (i === -1) throw new Error('SSOT __ocgHashRefusal line not found in fix-hash-scheme.mjs');
  let depth = 0, end = -1, started = false;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) { end = j + 1; break; } }
  }
  if (end === -1) throw new Error('SSOT __ocgHashRefusal line is unbalanced');
  return src.slice(i, end);
}

const PAGE_TMPL = (guard) => `<!doctype html><html><head><title>fx</title></head><body>
<script>
let _pp = null, _result = null, _artifact = null;
function __ocgJcs(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v)){var s='[';for(var i=0;i<v.length;i++){if(i)s+=',';var e=v[i];s+=(e===undefined||typeof e==='function'||typeof e==='symbol')?'null':__ocgJcs(e);}return s+']';}var ks=Object.keys(v).sort(),o='{',f=true;for(var i=0;i<ks.length;i++){var k=ks[i],w=v[k];if(w===undefined||typeof w==='function'||typeof w==='symbol')continue;if(!f)o+=',';f=false;o+=JSON.stringify(k)+':'+__ocgJcs(w);}return o+'}';}
function __ocgAssertIJson(v){if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('OCG: non-finite number is not I-JSON');if(Number.isInteger(v)&&!Number.isSafeInteger(v))throw new Error('OCG: integer exceeds 2^53; pass as string');}else if(Array.isArray(v)){v.forEach(__ocgAssertIJson);}else if(v&&typeof v==='object'){for(const k of Object.keys(v))__ocgAssertIJson(v[k]);}}
function __ocgCanonStr(x){__ocgAssertIJson(x);return __ocgJcs(x);}
__OCG_HASH_REFUSAL_LINE__
async function sha256(obj){const b=new TextEncoder().encode(__ocgCanonStr(obj));const h=await crypto.subtle.digest('SHA-256',b);return Array.from(new Uint8Array(h)).map(function(x){return x.toString(16).padStart(2,'0');}).join('');}
async function buildArtifact(){
  const pre = { policy_parameters: _pp, output_payload: _result.output_payload };
${guard
    ? `  const refusal = __ocgHashRefusal(pre);
  const hash = refusal === null ? await sha256(pre) : null;
  _artifact = { execution_hash: hash, hash_refusal: refusal === null ? undefined : { reason: refusal.reason, detail: refusal.detail } };`
    : `  const hash = await sha256(pre);
  _artifact = { execution_hash: hash, hash_refusal: undefined };`}
}
</script></body></html>`;

async function selfTest() {
  let failed = 0;
  const assert = (cond, label) => {
    if (!cond) { console.error(`check-page-hash-refusal self-test: FAIL ${label}`); failed++; return; }
    console.log(`check-page-hash-refusal self-test: ok ${label}`);
  };

  // Phase 1, in-process scanPage mutation controls on planted pages.
  const line = ssotHashRefusalLine();
  const green = await scanPage(PAGE_TMPL(true).replace('__OCG_HASH_REFUSAL_LINE__', line), 'fx-green');
  assert(green.cls === 'probe-ok' && green.findings.length === 0, `GREEN: refusal-guarded page passes (cls=${green.cls}, findings=${green.findings.length})`);

  const red = await scanPage(PAGE_TMPL(false).replace('__OCG_HASH_REFUSAL_LINE__', line), 'fx-red');
  const redThrows = red.findings.filter((f) => f.kind === 'throw');
  assert(red.cls === 'probe-ok' && redThrows.length >= 2, `RED: unguarded page throws on the number shapes (${redThrows.map((f) => f.leg).join(',')})`);
  assert(redThrows.some((f) => /2\^53|exceeds/.test(f.detail)), `RED: the quoted OCG 2^53 throw text is the finding detail`);

  // An entry that reads probe state the harness does not provide is UNDRIVABLE, never a
  // finding: the valid fixture is hashable, so a hash-path refusal cannot fire on it.
  const undrivableHtml = PAGE_TMPL(false).replace('__OCG_HASH_REFUSAL_LINE__', line)
    .replace('const pre = { policy_parameters: _pp, output_payload: _result.output_payload };',
      'const pre = { policy_parameters: _pp, output_payload: _result.output_payload, extra: _res.verdict };');
  const und = await scanPage(undrivableHtml, 'fx-undrivable');
  assert(und.cls === 'undrivable' && und.findings.length === 0, `UNDRIVABLE: probe-state noise is reported, not a finding (cls=${und.cls})`);

  // Phase 2, subprocess ratchet control: a pinned page that regresses is the one hard red.
  const { mkdtempSync, rmSync, writeFileSync: wSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const fx = mkdtempSync(join(tmpdir(), 'page-hash-refusal-selftest-'));
  try {
    mkdirSync(join(fx, 'chaingraph'), { recursive: true });
    mkdirSync(join(fx, 'scripts'), { recursive: true });
    const redHtml = PAGE_TMPL(false).replace('__OCG_HASH_REFUSAL_LINE__', line);
    wSync(join(fx, 'chaingraph', 'art-99-selftest-fixture.html'), redHtml);
    const baselinePath = join(fx, 'scripts', 'page-hash-refusal-baseline.json');
    wSync(baselinePath, JSON.stringify({ pages: { 'chaingraph/art-99-selftest-fixture.html': { findings: 0 } } }));
    const run = (extra) => {
      const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--root', fx, '--baseline', baselinePath, ...extra], { encoding: 'utf8' });
      return r.status;
    };
    assert(run([]) === 1, 'RATCHET RED: a pinned-at-0 page carrying findings exits 1');
    wSync(baselinePath, JSON.stringify({ pages: {} }));
    assert(run([]) === 0, 'ADVISORY: the same page unpinned is reported, exit 0');
    assert(run(['--changed', 'nosuchref']) === 0, 'FALLBACK: an unresolvable --changed ref falls back to the estate scan, exit 0');
  } finally {
    rmSync(fx, { recursive: true, force: true });
  }

  if (failed) { console.error(`check-page-hash-refusal self-test: ${failed} control(s) FAILED`); process.exit(1); }
  console.log('check-page-hash-refusal self-test: OK - RED and GREEN mutation controls, ratchet red, advisory green, changed-ref fallback.');
  process.exit(0);
}

if (SELF_TEST) { await selfTest(); } else { await main(); }
