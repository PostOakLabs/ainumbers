#!/usr/bin/env node
/**
 * check-webmcp-wrapper-execute.mjs — WEBMCP-WRAPPER-OBJECT-PARAMS-1
 *
 * The wrapper-execute vm gate. check-deeplink-contract.mjs exercises the
 * deep-link and file-import readers on every registered WebMCP page but never
 * calls the REGISTERED TOOL's `execute` body — which is exactly why the
 * art-118 wrapper shipped applying `String()` to the object parameter `kdes`
 * ("[object Object]" into the control → the page's JSON.parse throws → a
 * synchronous alert → a real host's execute() promise never settles: the tab
 * wedges). This gate closes that door:
 *
 *   1. For every registered page (the SAME live adjudication the generator
 *      uses — deriveTargets + adjudicateTool, sweep gate re-verified), load
 *      the page in a node:vm context with the minimal-DOM harness and a
 *      CAPTURING `document.modelContext`, then run the page's inline scripts
 *      in document order so the generator-emitted registration executes.
 *   2. Take fixture 0's `policy_parameters` (chaingraph/kernels/fixtures/) and
 *      hand them to the registered tool's `execute(params)` — the wrapper path
 *      a real host drives, byte-for-byte the emitted body.
 *   3. Assert the call SETTLES with a result artifact whose `execution_hash`
 *      equals the fixture's golden_hash. A corrupted prefill (String(object),
 *      "[object Object]") cannot pass: the page's own JSON.parse throws or the
 *      hash is taken over the corrupted preimage.
 *
 * Scope: the generator-owned PREFILL registration set (adjudicateTool ok) —
 * the set the registration-freshness gate verifies byte-exact. Direct-mode
 * pages (mapping-incomplete fallback) pass params to the kernel function
 * directly and carry no form-prefill mapping lines, so the String() wedge
 * class cannot arise there; their parity is the direct-mode probe's job.
 *
 * RED-then-GREEN proof: scripts/check-webmcp-wrapper-execute.test.mjs (its
 * controls build the emitted block for a typeless object parameter with the
 * REAL emitter, prove the gate GREEN on it, then mutate the block back to the
 * legacy bare-`String()` line and prove the gate RED — the exact art-118
 * defect class — plus a never-settling execute control and the live art-118
 * wrapper-path golden reproduction).
 *
 * BASELINE + DOWNWARD RATCHET, exactly the check-deeplink-contract pattern:
 * pre-existing fixture/manifest/page divergences surfaced by the wrapper path
 * are baselined in scripts/webmcp-wrapper-execute-baseline.json with a reason
 * and WARN — they can never silence a NEW failure, and deleting a baseline
 * entry is always safe (it only makes the gate stricter). New pages and new
 * failure modes FAIL. Follow-up rows shrink this file to empty.
 *
 * Usage:
 *   node scripts/check-webmcp-wrapper-execute.mjs                 # gate (exit 1 on failure)
 *   node scripts/check-webmcp-wrapper-execute.mjs --only <tool>   # one page
 *   node scripts/check-webmcp-wrapper-execute.mjs --json          # one JSON line per clean page
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { deriveTargets, adjudicateTool } from './gen-webmcp-registrations.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const JSONMODE = process.argv.includes('--json');
const EXECUTE_TIMEOUT_MS = 15_000;

/* ── headless page harness (same execution model as check-deeplink-contract) ─*/

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

/**
 * The deeplink harness's sandbox PLUS a capturing document.modelContext: the
 * emitted registration does `const mc = document.modelContext ?? …` and calls
 * `mc.registerTool(tool)` — the capture is how the harness holds the SAME
 * function object a real host would receive.
 */
export function makeExecuteSandbox(seedElements) {
  const elements = new Map();
  const warns = [];
  for (const [id, text] of seedElements) elements.set(id, makeElementStub(id, text));
  const registered = [];
  const docListeners = [];
  const documentStub = {
    readyState: 'complete',
    title: '',
    body: Object.assign(makeElementStub('body'), { appendChild() {} }),
    documentElement: makeElementStub('html'),
    head: makeElementStub('head'),
    modelContext: {
      registerTool(tool) { registered.push(tool); },
    },
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
    navigator: { userAgent: 'check-webmcp-wrapper-execute-harness', language: 'en' },
    console: { log() {}, warn: (...a) => warns.push(a.map(String).join(' ')), error: (...a) => warns.push(a.map(String).join(' ')), info() {}, debug() {} },
    alert() {}, confirm() { return false; }, prompt() { return null; },
    setTimeout(fn) { return 0; },
    clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    requestAnimationFrame() { return 0; },
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
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.addEventListener = () => {};
  return { sandbox, elements, warns, registered };
}

export function extractInlineScripts(html) {
  const scripts = [];
  const seedElements = new Map();
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\stype\s*=\s*["'](application\/ld\+json|importmap|application\/json)["']/.test(attrs)) {
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
 * Pure verdict on one execute() outcome. `result` is { ok, error?, toolName?,
 * returned?, executionHash? } from runWrapperExecute; `expectedHash` is the
 * fixture golden (sha256: prefix optional). Returns { ok, problem? }.
 */
export function judgeExecute(result, expectedHash) {
  if (!result.ok) return { ok: false, problem: result.error };
  const returned = result.returned;
  if (!returned || typeof returned !== 'object') {
    return { ok: false, problem: `execute() did not settle with a result artifact (returned ${returned === undefined ? 'undefined' : returned === null ? 'null' : typeof returned}) — the wedge class: the page's own param-assembly aborted, so a real host's promise never carries a result` };
  }
  if (returned && typeof returned === 'object' && typeof returned.error === 'string') {
    return { ok: false, problem: `execute() returned a structured error (${returned.error}: ${String(returned.detail ?? '').slice(0, 200)}) — the wrapper path aborted inside the page` };
  }
  if (!returned.execution_hash) {
    return { ok: false, problem: 'execute() result carries no execution_hash' };
  }
  const produced = String(returned.execution_hash).replace(/^sha256:/, '');
  const expected = String(expectedHash).replace(/^sha256:/, '');
  if (produced !== expected) {
    return { ok: false, problem: `execute() execution_hash mismatch — wrapper path produced ${produced.slice(0, 16)}…, fixture golden_hash is ${expected.slice(0, 16)}…` };
  }
  return { ok: true };
}

/**
 * Load one page, run its inline scripts in order, and drive the registered
 * tool's execute(params). Returns
 *   { ok, error?, toolName?, returned?, executionHash?, sandbox? }
 * (ok=false only for HARNESS failures — no registration captured, script threw
 * at load, execute exceeded the timeout; per-call verdicts are judgeExecute's).
 */
export async function runWrapperExecute(pageAbs, pageRel, params) {
  const html = readFileSync(pageAbs, 'utf8');
  const { scripts, seedElements } = extractInlineScripts(html);
  if (scripts.length === 0) return { ok: false, error: 'no inline scripts found' };
  const { sandbox, warns, registered } = makeExecuteSandbox(seedElements);
  const context = vm.createContext(sandbox);
  for (let i = 0; i < scripts.length; i++) {
    try {
      new vm.Script(scripts[i], { filename: `${pageRel}#script-${i}` }).runInContext(context);
    } catch (e) {
      return { ok: false, error: `inline script ${i} threw at load: ${e.message}` };
    }
  }
  if (registered.length === 0) {
    const why = warns.filter((w) => w.length).join(' | ') || 'no diagnostic emitted';
    return { ok: false, error: `page registered no WebMCP tool (modelContext capture empty — registration block missing or feature-detect failed; ${why})` };
  }
  return await new Promise((resolveOutcome) => {
    const timer = setTimeout(() => resolveOutcome({ ok: false, error: `execute() did not settle within ${EXECUTE_TIMEOUT_MS}ms — a wedging wrapper blocks its host forever` }), EXECUTE_TIMEOUT_MS);
    timer.unref?.();
    (async () => {
      let returned;
      try {
        returned = await registered[0].execute(params);
      } catch (e) {
        return { ok: false, error: `execute() threw: ${e.message}`, returned: undefined };
      }
      return { ok: true, returned };
    })().then((r) => {
      clearTimeout(timer);
      if (!r.ok) return resolveOutcome(r);
      resolveOutcome({ ok: true, toolName: registered[0].name, returned: r.returned, executionHash: r.returned?.execution_hash, sandbox });
    });
  });
}

/* ── BASELINE + DOWNWARD RATCHET (check-deeplink-contract pattern) ───────── */
const BASELINE_PATH = join(HERE, 'webmcp-wrapper-execute-baseline.json');

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Map();
  const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return new Map(Object.entries(parsed));
}

function classify(problem) {
  if (problem.includes('did not settle with a result artifact')) return 'no-result-artifact';
  if (problem.includes('structured error')) return 'execute-error';
  if (problem.includes('execution_hash mismatch')) return 'hash-mismatch';
  if (problem.includes('carries no execution_hash')) return 'result-without-hash';
  if (problem.includes('execute() threw')) return 'execute-throw';
  if (problem.includes('threw at load')) return 'harness-load';
  if (problem.includes('registered no WebMCP tool')) return 'no-registration';
  return 'other';
}

/* ── main ─────────────────────────────────────────────────────────────────── */

async function collectFailures() {
  const { cleared, manifestIndex, mcpNameByTool } = deriveTargets(REPO);
  const problems = [];
  let checked = 0;
  for (const id of cleared) {
    if (ONLY && id !== ONLY) continue;
    const d = adjudicateTool(id, REPO, manifestIndex, mcpNameByTool);
    if (!d.ok) continue;
    const pageAbs = resolve(REPO, d.detail.page);
    checked++;
    const fixturePath = join(REPO, 'chaingraph', 'kernels', 'fixtures', `${id}.fixtures.json`);
    if (!existsSync(fixturePath)) { problems.push(`${d.detail.page}: no fixture file chaingraph/kernels/fixtures/${id}.fixtures.json — cannot drive the wrapper`); continue; }
    let fixture;
    try { fixture = JSON.parse(readFileSync(fixturePath, 'utf8')); } catch (e) { problems.push(`${d.detail.page}: fixture unparseable: ${e.message}`); continue; }
    const vectors = fixture.vectors || fixture.fixtures || [];
    const fx = vectors[0];
    if (!fx || !fx.policy_parameters || !fx.golden_hash) { problems.push(`${d.detail.page}: fixture 0 lacks policy_parameters/golden_hash`); continue; }

    const result = await runWrapperExecute(pageAbs, d.detail.page, fx.policy_parameters);
    const verdict = judgeExecute(result, fx.golden_hash);
    if (!verdict.ok) {
      problems.push(`${d.detail.page}: ${verdict.problem}`);
      continue;
    }
    if (JSONMODE) console.log(JSON.stringify({ page: d.detail.page, tool: result.toolName, hash: String(result.executionHash).replace(/^sha256:/, '') }));
  }
  return { problems, checked };
}

async function main() {
  const baseline = loadBaseline();
  const { problems, checked } = await collectFailures();
  const fresh = [];
  const warned = [];
  for (const p of problems) {
    const page = p.slice(0, p.indexOf(':'));
    if (baseline.has(page)) warned.push(p);
    else fresh.push(p);
  }
  if (fresh.length) {
    console.error(`✗ check-webmcp-wrapper-execute FAILED (${fresh.length} NEW problem(s) over ${checked} registered page(s); ${warned.length} baselined WARN):`);
    fresh.forEach((p) => console.error('    ' + p));
    console.error('  Pre-existing wrapper-path divergences belong in scripts/webmcp-wrapper-execute-baseline.json with a reason — never silence, never a fix-forward.');
    process.exit(1);
  }
  console.log(`✓ check-webmcp-wrapper-execute clean — ${checked} registered WebMCP page(s): fixture-0 policy_parameters driven through the registered tool's execute() body settles and reproduces the fixture execution_hash on the wrapper path (WEBMCP-WRAPPER-OBJECT-PARAMS-1). ${warned.length} page(s) WARN on the documented baseline (downward ratchet — follow-up rows shrink it).`);
  warned.forEach((p) => console.log('  WARN ' + p));
  process.exit(0);
}

const invokedAsMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsMain) main().catch((e) => { console.error('✗ harness exception:', e); process.exit(1); });
