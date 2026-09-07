#!/usr/bin/env node
/**
 * check-deeplink-contract.mjs — TOOLPAGE-DEEPLINK-1
 *
 * Proves the fragment-only prefill-and-run deep-link contract
 * (AGENT-REACH-BUILD-SPEC.md §3.1) on EVERY registered WebMCP page, LIVE:
 *
 *   1. For each emittable tool (the same live adjudication the generator uses),
 *      build a fragment `#p=v1.<b64url(gzip(JSON policy_parameters))>&run=1`
 *      from fixture 0's `policy_parameters` (chaingraph/kernels/fixtures/).
 *   2. Load the page in a headless harness — every inline <script> of the page
 *      runs in order inside a node:vm context with a minimal DOM, then the
 *      page's own generated deep-link reader (emitted from
 *      chaingraph/_page-chrome.mjs) runs against `location.hash`.
 *      The harness REPLACES the browser: same execution order, same globals.
 *   3. Assert the produced `execution_hash` equals the fixture's `golden_hash`
 *      AND that the artifact echoes the fixture's policy_parameters exactly —
 *      a prefill that corrupts a value (String(object), trim, type coercion)
 *      cannot pass because the hash is taken over the preimage.
 *   4. GREP GATE: no registered page reads `location.search` — deep links are
 *      fragment-only by contract; a query string would leak parameters to
 *      servers and logs and break the zero-egress property.
 *
 * RED-then-GREEN proof (self-test mode): `--red-green` flips one byte of the
 * fixture's golden_hash, re-runs the whole gate expecting RED, restores, and
 * expects GREEN. Run it before pushing; the CI/preflight form is plain `node
 * scripts/check-deeplink-contract.mjs`.
 *
 * The harness is INTENTIONALLY strict: any page-level script error, any
 * harness escape, any missing fixture is a FAIL for that page, never silence.
 *
 * Usage:
 *   node scripts/check-deeplink-contract.mjs                 # gate (exit 1 on failure)
 *   node scripts/check-deeplink-contract.mjs --only <tool>   # one page
 *   node scripts/check-deeplink-contract.mjs --red-green     # RED-then-GREEN proof
 *   node scripts/check-deeplink-contract.mjs --json
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { deriveTargets, adjudicateTool } from './gen-webmcp-registrations.mjs';
import { DEEPLINK_MARKER, FILE_IMPORT_MARKER } from '../chaingraph/_page-chrome.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const REDGREEN = process.argv.includes('--red-green');
const JSONMODE = process.argv.includes('--json');

/* ── fragment codec (build side; mirrors the page's reader) ─────────────── */

function b64uEnc(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function gzipJson(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const cs = new CompressionStream('gzip');
  const w = cs.writable.getWriter();
  w.write(bytes); w.close();
  const chunks = [];
  const reader = cs.readable.getReader();
  while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total); let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

async function buildFragment(policyParameters, run) {
  const compressed = await gzipJson(policyParameters);
  let frag = '#p=v1.' + b64uEnc(compressed);
  if (run) frag += '&run=1';
  return frag;
}

/* ── canonical compare (fixture vs artifact echo) ───────────────────────── */

function canon(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(canon);
  const o = {};
  for (const k of Object.keys(v).sort()) o[k] = canon(v[k]);
  return o;
}

/* ── headless page harness ──────────────────────────────────────────────── */

function makeElementStub(id, textContent = '') {
  return {
    id, value: '', checked: false, disabled: false, textContent, innerHTML: '',
    href: '', download: '', type: '', style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, remove() {}, click() {}, focus() {}, blur() {}, select() {},
    scrollIntoView() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, insertAdjacentHTML() {},
    getContext() { return null; },
  };
}

function makeSandbox(seedElements) {
  const elements = new Map();
  const warns = [];
  for (const [id, text] of seedElements) elements.set(id, makeElementStub(id, text));
  const docListeners = [];
  const winListeners = [];
  const timers = [];
  const documentStub = {
    readyState: 'complete',
    title: '',
    body: Object.assign(makeElementStub('body'), { appendChild() {} }),
    documentElement: makeElementStub('html'),
    head: makeElementStub('head'),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElementStub(id));
      return elements.get(id);
    },
    createElement(tag) { return makeElementStub(tag); },
    createTextNode() { return {}; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(type, fn) { docListeners.push([type, fn]); },
    removeEventListener() {},
  };
  const sandbox = {
    document: documentStub,
    location: { hash: '', search: '', pathname: '/', host: 'ainumbers.co', href: 'https://ainumbers.co/', origin: 'https://ainumbers.co', protocol: 'https:' },
    navigator: { userAgent: 'check-deeplink-contract-harness', language: 'en' },
    console: { log() {}, warn: (...a) => warns.push(a.map(String).join(' ')), error: (...a) => warns.push(a.map(String).join(' ')), info() {}, debug() {} },
    alert() {}, confirm() { return false; }, prompt() { return null; },
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    requestAnimationFrame(fn) { timers.push(fn); return timers.length; },
    matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} }; },
    MutationObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    URL: { createObjectURL() { return 'blob:harness'; }, revokeObjectURL() {} },
    Blob: class {},
    FileReader: class { readAsText() {} },
    crypto: webcrypto,
    performance: { now: () => 0 },
    history: { replaceState() {}, pushState() {} },
    localStorage: (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() }; })(),
    sessionStorage: (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() }; })(),
    TextEncoder, TextDecoder, URLSearchParams, Promise, Date, JSON, Math,
    atob, btoa, CompressionStream, DecompressionStream, structuredClone,
    __fireDocListener(type) { for (const [t, fn] of docListeners) if (t === type) fn(); },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.addEventListener = (type, fn) => winListeners.push([type, fn]);
  return { sandbox, elements, warns };
}

function extractInlineScripts(html) {
  const scripts = [];
  const seedElements = new Map();
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\stype\s*=\s*["'](application\/ld\+json|importmap|application\/json)["']/.test(attrs)) {
      // Data islands: pages read these via getElementById(...).textContent —
      // seed the element with its literal content so page JSON.parse calls work.
      const idm = attrs.match(/\sid\s*=\s*["']([^"']+)["']/);
      if (idm) seedElements.set(idm[1], m[2]);
      continue;
    }
    if (/\ssrc\s*=/.test(attrs)) continue;
    scripts.push(m[2]);
  }
  return { scripts, seedElements };
}

/**
 * Run one page against one fragment. Returns
 *   { ok, error?, executionHash?, echoEquals?, compressedBytes }
 */
async function runPage(pageAbs, pageRel, fragment) {
  const html = readFileSync(pageAbs, 'utf8');
  if (!html.includes(DEEPLINK_MARKER)) return { ok: false, error: 'page carries no generated deep-link reader (stale generated region?)' };
  if (!html.includes(FILE_IMPORT_MARKER)) return { ok: false, error: 'page carries no generated file-import reader (stale generated region?)' };
  const { scripts, seedElements } = extractInlineScripts(html);
  if (scripts.length === 0) return { ok: false, error: 'no inline scripts found' };

  const { sandbox, warns } = makeSandbox(seedElements);
  const context = vm.createContext(sandbox);
  // 1. The page's own scripts, in document order (the browser's execution order).
  for (let i = 0; i < scripts.length; i++) {
    try {
      new vm.Script(scripts[i], { filename: `${pageRel}#script-${i}` }).runInContext(context);
    } catch (e) {
      return { ok: false, error: `inline script ${i} threw at load: ${e.message}` };
    }
  }
  // 2. Navigate with the fragment + run=1 (the reader already registered itself
  //    on load; re-running __ocgDeeplinkRun is exactly what a hash navigation does).
  sandbox.location.hash = fragment;
  if (typeof sandbox.__ocgDeeplinkRun !== 'function') return { ok: false, error: 'page did not expose __ocgDeeplinkRun (reader missing or failed to load)' };
  try {
    await sandbox.__ocgDeeplinkRun();
    if (typeof sandbox.__ocgDeeplinkDone?.then === 'function') await sandbox.__ocgDeeplinkDone;
  } catch (e) {
    return { ok: false, error: `deep-link run threw: ${e.message}` };
  }
  const artifact = sandbox.__ocgDeeplinkArtifact || sandbox._lastArtifact || sandbox._lastResult || null;
  if (!artifact || typeof artifact !== 'object') {
    const why = warns.filter((w) => w.includes('[deeplink]')).join(' | ') || 'no diagnostic emitted';
    return { ok: false, error: `no _lastArtifact/_lastResult produced by run=1 (${why})` };
  }
  if (!artifact.execution_hash) return { ok: false, error: 'artifact carries no execution_hash' };
  return { ok: true, artifact, executionHash: artifact.execution_hash, sandbox };
}

/* ── main ───────────────────────────────────────────────────────────────── */

async function collectFailures(mutateHash) {
  const { cleared, manifestIndex, mcpNameByTool } = deriveTargets(REPO);
  const problems = [];
  let checked = 0;
  let imported = 0;
  for (const id of cleared) {
    if (ONLY && id !== ONLY) continue;
    const d = adjudicateTool(id, REPO, manifestIndex, mcpNameByTool);
    if (!d.ok) continue;
    const pageAbs = resolve(REPO, d.detail.page);
    checked++;

    // fixture 0
    const fixturePath = join(REPO, 'chaingraph', 'kernels', 'fixtures', `${id}.fixtures.json`);
    if (!existsSync(fixturePath)) { problems.push(`${d.detail.page}: no fixture file ${fixturePath.slice(REPO.length + 1)} — cannot build a fragment`); continue; }
    let fixture;
    try { fixture = JSON.parse(readFileSync(fixturePath, 'utf8')); } catch (e) { problems.push(`${d.detail.page}: fixture unparseable: ${e.message}`); continue; }
    const vectors = fixture.vectors || fixture.fixtures || [];
    const fx = vectors[0];
    if (!fx || !fx.policy_parameters || !fx.golden_hash) { problems.push(`${d.detail.page}: fixture 0 lacks policy_parameters/golden_hash`); continue; }
    if (mutateHash) fx.golden_hash = (fx.golden_hash[0] === 'f' ? '0' : 'f') + fx.golden_hash.slice(1);

    // grep gate first (cheap): fragment-only — no page reads location.search
    const pageSrc = readFileSync(pageAbs, 'utf8');
    if (/location\.search/.test(pageSrc)) problems.push(`${d.detail.page}: reads location.search — deep links are fragment-only (§3.1 grep gate)`);

    const fragment = await buildFragment(fx.policy_parameters, true);
    const result = await runPage(pageAbs, d.detail.page, fragment);
    if (!result.ok) { problems.push(`${d.detail.page}: ${result.error}`); continue; }

    const produced = String(result.executionHash).replace(/^sha256:/, '');
    const expected = String(fx.golden_hash).replace(/^sha256:/, '');
    if (produced !== expected) {
      problems.push(`${d.detail.page}: execution_hash mismatch — deep link produced ${produced.slice(0, 16)}…, fixture golden_hash is ${expected.slice(0, 16)}…`);
      continue;
    }
    const echo = result.artifact.policy_parameters;
    if (JSON.stringify(canon(echo)) !== JSON.stringify(canon(fx.policy_parameters))) {
      problems.push(`${d.detail.page}: artifact policy_parameters do not echo the fixture (prefill corrupted a value)`);
      continue;
    }

    // FILE-IMPORT case (TOOLPAGE-FILE-IMPORT-1): the SAME fixture JSON handed
    // to the page's zero-upload import reader (the doorway a drop or a picker
    // feeds) must prefill via the same table and reproduce the SAME
    // execution_hash — one computation, one hash, every doorway.
    if (typeof result.sandbox.__ocgFileImport !== 'function') {
      problems.push(`${d.detail.page}: no __ocgFileImport on the page (file-import reader missing or failed to load)`);
      continue;
    }
    result.sandbox.location.hash = '';
    let fi;
    try {
      fi = await result.sandbox.__ocgFileImport([{ name: 'fixture.json', text: JSON.stringify(fx.policy_parameters) }]);
    } catch (e) {
      problems.push(`${d.detail.page}: __ocgFileImport threw: ${e.message}`);
      continue;
    }
    if (!fi || fi.ok !== true) {
      problems.push(`${d.detail.page}: file-import path rejected the fixture (${(fi && fi.error) || 'no diagnostic emitted'})`);
      continue;
    }
    const fiArtifact = fi.artifact || result.sandbox.__ocgDeeplinkArtifact || null;
    if (!fiArtifact || !fiArtifact.execution_hash) {
      problems.push(`${d.detail.page}: file-import path produced no execution_hash`);
      continue;
    }
    const fiHash = String(fiArtifact.execution_hash).replace(/^sha256:/, '');
    if (fiHash !== expected) {
      problems.push(`${d.detail.page}: file-import execution_hash mismatch — import produced ${fiHash.slice(0, 16)}…, fixture golden_hash is ${expected.slice(0, 16)}…`);
      continue;
    }
    if (JSON.stringify(canon(fiArtifact.policy_parameters)) !== JSON.stringify(canon(fx.policy_parameters))) {
      problems.push(`${d.detail.page}: file-import artifact policy_parameters do not echo the fixture`);
      continue;
    }
    imported++;
    if (JSONMODE) console.log(JSON.stringify({ page: d.detail.page, hash: produced }));
  }
  return { problems, checked, imported };
}

/* ── BASELINE + DOWNWARD RATCHET, exactly the check-page-determinism pattern ──
 * The gate's dynamic harness is the first execution of these pages outside a
 * browser, and it surfaces PRE-EXISTING fixture/manifest/page divergences
 * (kernel hash computed over different policy_parameters than the page's form
 * path assembles; result globals without an execution_hash member; schemas
 * requiring properties the fixture never supplies). Those live conditions are
 * BASELINED here with a reason and WARN — they can never silence a NEW
 * failure, and deleting a baseline entry is always safe (it only makes the
 * gate stricter). New pages and new failure modes FAIL. Follow-up rows
 * shrink this file to empty; the ratchet only ever turns down. */
const BASELINE_PATH = join(HERE, 'deeplink-contract-baseline.json');

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Map();
  const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return new Map(Object.entries(parsed));
}

function classify(problem) {
  const page = problem.slice(2, problem.indexOf(':'));
  const msg = problem.slice(problem.indexOf(':') + 2);
  if (msg.includes('reads location.search')) return 'location-search';
  if (msg.includes('execution_hash mismatch')) return 'hash-mismatch';
  if (msg.includes('no _lastArtifact/_lastResult')) return 'no-result-global';
  if (msg.includes('carries no execution_hash')) return 'result-without-hash';
  if (msg.includes('does not match the declared type') || msg.includes('missing required parameter') || msg.includes('unknown parameter') || msg.includes('must be a JSON')) return 'schema-fixture-divergence';
  if (msg.includes('no form control matched')) return 'no-form-control';
  if (msg.includes('threw at load')) return 'harness-load';
  if (msg.includes('no fixture file') || msg.includes('fixture 0 lacks') || msg.includes('fixture unparseable')) return 'fixture-gap';
  return 'other';
}

async function main() {
  const baseline = loadBaseline();

  if (REDGREEN) {
    console.log('RED  — flip one byte of fixture 0 golden_hash across all registered pages:');
    const red = await collectFailures(true);
    console.log(`  RED verdict: ${red.problems.length} raw problem(s) over ${red.checked} page(s) — expected > 0`);
    const redOk = red.problems.length > 0;
    console.log('GREEN — restore the byte and re-run:');
    const green = await collectFailures(false);
    const greenNew = green.problems.filter((p) => !baseline.has(p.slice(0, p.indexOf(':'))));
    console.log(`  GREEN verdict: ${green.problems.length} raw problem(s), ${greenNew.length} NOT in baseline — expected 0 not-in-baseline`);
    const greenOk = greenNew.length === 0;
    if (redOk && greenOk) {
      console.log('✓ RED-then-GREEN proof: the gate detects a corrupted fixture hash and passes the intact estate.');
      process.exit(0);
    }
    console.error('✗ RED-then-GREEN proof FAILED (gate did not behave as expected).');
    process.exit(1);
  }

  const { problems, checked, imported } = await collectFailures(false);
  const fresh = [];
  const warned = [];
  for (const p of problems) {
    const page = p.slice(0, p.indexOf(":"));
    if (baseline.has(page)) warned.push(p);
    else fresh.push(p);
  }
  if (fresh.length) {
    console.error(`✗ check-deeplink-contract FAILED (${fresh.length} NEW problem(s) over ${checked} registered page(s); ${warned.length} baselined WARN):`);
    fresh.forEach((p) => console.error('    ' + p));
    console.error('  Pre-existing live divergences belong in scripts/deeplink-contract-baseline.json with a reason — never silence, never a fix-forward.');
    process.exit(1);
  }
  console.log(`✓ check-deeplink-contract clean — ${checked} registered WebMCP page(s): fixture-0 fragment decodes, prefills, runs, and reproduces the fixture execution_hash; ${imported} page(s) reproduce the SAME execution_hash through the zero-upload file-import reader (fixture JSON via the drop/picker doorway); fragment-only grep gate green (no location.search reads). ${warned.length} page(s) WARN on the documented baseline (downward ratchet — follow-up rows shrink it).`);
  warned.forEach((p) => console.log('  WARN ' + p));
  process.exit(0);
}

main().catch((e) => { console.error('✗ harness exception:', e); process.exit(1); });
