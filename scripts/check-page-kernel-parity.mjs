#!/usr/bin/env node
/**
 * scripts/check-page-kernel-parity.mjs: PAGE-KERNEL-PARITY-GATE-1
 *
 * STAGE 1, ADVISORY. A node page inlines a copy of its kernel's compute() so it runs
 * client-side with zero network calls. The digest gates only prove the page DECLARES the
 * right kernel digest; none of them runs the inline code. For every kernel
 * chaingraph/kernels/<id>.kernel.mjs that has a fixtures file and a paired node page
 * chaingraph/<id>.html, this script runs the page's inline compute and the kernel's own
 * compute() over EVERY fixture vector's policy_parameters and compares the two. The page
 * is compared with the kernel's LIVE compute() output, never with the fixture's recorded
 * output_payload (a fixture may record async artifact-level fields compute() never emits).
 *
 * Page evaluation, two shapes, in node:vm:
 *   whole-block  every executable <script> block, byte for byte, in a browser-faithful
 *                context (atob, btoa, TextEncoder, TextDecoder, URL, structuredClone,
 *                WebCrypto, and a universal no-op DOM stub for window / document /
 *                navigator / location / storage).
 *   closure      `function compute(` plus its top-level dependency closure. Used when
 *                whole-block evaluation cannot run (top-level code needs a real DOM) and
 *                as a cross-check when both shapes ran.
 *   Where both shapes ran and they disagree with each other the page is HARNESS-SUSPECT
 *   (advisory), never MISMATCH.
 *
 * Page classes: MATCH, MISMATCH, FLAGS-ONLY, HARNESS-SUSPECT, UNEXTRACTABLE, NO-PAGE,
 * NO-FIXTURES. Also reported, never counted as MISMATCH: NONDETERMINISTIC (a side that
 * disagrees with itself) and LOAD-ERROR (the kernel could not be imported).
 *
 * ADVISORY: this script ALWAYS exits 0. Exit 2 is reserved for a usage error or a crash of
 * the harness itself. It writes nothing into the repo tree; a debt report is written only to
 * the path given by --json. Under CI the summary is also appended to $GITHUB_STEP_SUMMARY.
 *
 * Usage:
 *   node scripts/check-page-kernel-parity.mjs [--json <file>] [--write-baseline <file>]
 *        [--root <dir>] [--only <id,id>] [--verbose]
 *     --write-baseline  record the current MISMATCH (page, vector) pairs for a future blocking
 *                       stage; stage 1 never reads or enforces a baseline
 *     --root     directory holding chaingraph/ (default: this repo)
 *     --only     comma separated node ids
 *
 * Self-test: scripts/check-page-kernel-parity.selftest.mjs
 * Node built-ins only; no network, no randomness.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE_TIMEOUT_MS = 30000;
const KERNEL_TIMEOUT_MS = 120000;
const CONCURRENCY = 4;
const MARK = '\u0001RESULT\u0001';

// ---------------------------------------------------------------- canonical JSON helpers

const canon = (v) => Array.isArray(v) ? v.map(canon)
  : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => { if (v[k] !== undefined) o[k] = canon(v[k]); return o; }, {})
    : v;
const cstr = (v) => JSON.stringify(canon(v));
const trunc = (v, n = 120) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s === undefined ? 'undefined' : (s.length > n ? s.slice(0, n) + '...' : s); };

/** Split a result string into { env, payload, flags }. Unwraps the {output_payload, compliance_flags} envelope. */
function unwrap(str) {
  if (str === undefined || str === null) return { env: false, payload: undefined, flags: undefined, absent: true };
  const v = JSON.parse(str);
  if (v && typeof v === 'object' && !Array.isArray(v) && 'output_payload' in v) return { env: true, payload: v.output_payload, flags: v.compliance_flags };
  return { env: false, payload: v, flags: undefined };
}

/** First differing JSON path between two values, or null when equal. */
export function firstDiff(a, b, path = '$') {
  if (cstr(a) === cstr(b)) return null;
  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  if (isObj(a) && isObj(b)) {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const d = firstDiff(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = firstDiff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
  }
  return { path, page: trunc(a), kernel: trunc(b) };
}

// ---------------------------------------------------------------- kernel side (child process)

/** Child-process mode: import a kernel, run compute() twice per vector, print one marked JSON line. */
async function kernelWorker(kpath) {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const vectors = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const out = [];
  let loadError = null;
  let compute = null;
  try {
    const mod = await import(pathToFileURL(kpath).href);
    compute = mod.compute;
    if (typeof compute !== 'function') throw new Error('no compute() export');
  } catch (e) { loadError = String(e && e.message || e).slice(0, 200); }
  if (!loadError) {
    for (const v of vectors) {
      const one = async () => { const r = await compute(JSON.parse(JSON.stringify(v.policy_parameters || {}))); return r === undefined ? null : JSON.stringify(r); };
      try { const a = await one(); const b = await one(); out.push({ name: v.name, a, b }); }
      catch (e) { out.push({ name: v.name, err: String(e && e.message || e).slice(0, 160) }); }
    }
  }
  process.stdout.write(MARK + JSON.stringify({ loadError, out }) + '\n');
  process.exit(0);
}

function runKernel(kpath, vectors) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--kernel-worker', kpath], { stdio: ['pipe', 'pipe', 'ignore'] });
    let buf = '';
    let done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(timer); res(r); } };
    const timer = setTimeout(() => { child.kill(); finish({ loadError: 'kernel timeout', out: [] }); }, KERNEL_TIMEOUT_MS);
    child.stdout.on('data', (d) => { buf += d; });
    child.on('error', (e) => finish({ loadError: String(e.message), out: [] }));
    child.on('close', () => {
      const i = buf.lastIndexOf(MARK);
      if (i < 0) return finish({ loadError: 'kernel worker produced no result', out: [] });
      try { finish(JSON.parse(buf.slice(i + MARK.length).split('\n')[0])); } catch { finish({ loadError: 'kernel worker output unreadable', out: [] }); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(vectors.map((v) => ({ name: v.name, policy_parameters: v.policy_parameters }))));
  });
}

// ---------------------------------------------------------------- page side: script extraction

/** Executable inline <script> block bodies, in order. JSON blocks, module blocks and src scripts are skipped. */
export function extractScripts(html) {
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

// ---------------------------------------------------------------- page side: tokenizer and top-level closure

const KW_BEFORE_REGEX = new Set(['return', 'typeof', 'do', 'else', 'in', 'of', 'delete', 'void', 'new', 'throw', 'yield', 'await', 'case']);

function scanTemplate(src, i) {
  const n = src.length;
  let j = i + 1;
  while (j < n && src[j] !== '`') {
    if (src[j] === '\\') { j += 2; continue; }
    if (src[j] === '$' && src[j + 1] === '{') {
      let depth = 1;
      j += 2;
      while (j < n && depth > 0) {
        if (src[j] === '`') { j = scanTemplate(src, j); continue; }
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        j++;
      }
      continue;
    }
    j++;
  }
  return j + 1;
}

export function tokenize(src) {
  const T = [];
  const n = src.length;
  let i = 0;
  let prev = null;
  const push = (t, a, b) => { const tok = { t, s: src.slice(a, b), a, b }; T.push(tok); prev = tok; i = b; };
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') j++; j++; } push('str', i, Math.min(j + 1, n)); continue; }
    if (c === '`') { push('tpl', i, Math.min(scanTemplate(src, i), n)); continue; }
    if (/[A-Za-z_$]/.test(c)) { let j = i + 1; while (j < n && /[\w$]/.test(src[j])) j++; push('id', i, j); continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) { let j = i + 1; while (j < n && /[\w.]/.test(src[j])) j++; push('num', i, j); continue; }
    if (c === '/') {
      const isRegex = !prev || (prev.t === 'p' && !')]}'.includes(prev.s)) || (prev.t === 'id' && KW_BEFORE_REGEX.has(prev.s));
      if (isRegex) {
        let j = i + 1;
        let cls = false;
        while (j < n && src[j] !== '\n') {
          if (src[j] === '\\') { j += 2; continue; }
          if (src[j] === '[') cls = true;
          else if (src[j] === ']') cls = false;
          else if (src[j] === '/' && !cls) break;
          j++;
        }
        j++;
        while (j < n && /[a-z]/.test(src[j])) j++;
        push('re', i, Math.min(j, n));
        continue;
      }
    }
    const two = src.slice(i, i + 2);
    if (two === '++' || two === '--' || two === '=>') { push('p', i, i + 2); continue; }
    push('p', i, i + 1);
  }
  return T;
}

const BLOCK_HEADS = new Set(['function', 'class', 'if', 'for', 'while', 'try', 'switch']);
const OPEN = '([{';
const CLOSE = ')]}';

/** Split source into top-level statements: { start, end, names:Set, ids:Set }. Best effort. */
export function splitStatements(src) {
  const T = tokenize(src);
  const stmts = [];
  let i = 0;
  while (i < T.length) {
    const head = T[i];
    const startIdx = i;
    const isAsyncFn = head.s === 'async' && T[i + 1] && T[i + 1].s === 'function';
    const block = head.t === 'id' && (BLOCK_HEADS.has(head.s) || isAsyncFn) || head.s === '{';
    let depth = 0;
    let j = i;
    let end = -1;
    for (; j < T.length; j++) {
      const t = T[j];
      if (t.t === 'p' && OPEN.includes(t.s)) depth++;
      else if (t.t === 'p' && CLOSE.includes(t.s)) {
        depth--;
        if (depth === 0 && t.s === '}' && block) {
          const nx = T[j + 1];
          const cont = nx && nx.t === 'id' && ((head.s === 'if' && nx.s === 'else') || (head.s === 'try' && (nx.s === 'catch' || nx.s === 'finally')) || (head.s === 'do' && nx.s === 'while'));
          // `if (...) stmt;` without braces is not handled; the head test below keeps it simple.
          if (!cont) { end = j; break; }
        }
      } else if (depth === 0 && t.t === 'p' && t.s === ';') { end = j; break; }
      if (depth === 0 && !block) {
        const nx = T[j + 1];
        if (!nx) { end = j; break; }
        const newline = src.slice(t.b, nx.a).includes('\n');
        const curContinues = t.t === 'p' && !')]}'.includes(t.s) && t.s !== '++' && t.s !== '--';
        const nextContinues = nx.t === 'p' && !'{}'.includes(nx.s) && nx.s !== ';' && nx.s !== '++' && nx.s !== '--' || (nx.t === 'id' && (nx.s === 'in' || nx.s === 'instanceof' || nx.s === 'of'));
        if (newline && !curContinues && !nextContinues) { end = j; break; }
      }
    }
    if (end < 0) end = T.length - 1;
    const names = new Set();
    const ids = new Set();
    for (let k = startIdx; k <= end; k++) {
      if (T[k].t === 'id') ids.add(T[k].s);
      else if (T[k].t === 'tpl') for (const m of T[k].s.matchAll(/[A-Za-z_$][\w$]*/g)) ids.add(m[0]);
    }
    let h = startIdx;
    if (T[h].s === 'async') h++;
    if (T[h] && (T[h].s === 'function' || T[h].s === 'class')) {
      h++;
      if (T[h] && T[h].s === '*') h++;
      if (T[h] && T[h].t === 'id') names.add(T[h].s);
    } else if (T[h] && (T[h].s === 'const' || T[h].s === 'let' || T[h].s === 'var')) {
      let d = 0;
      let expectName = true;
      for (let k = h + 1; k <= end; k++) {
        const t = T[k];
        if (t.t === 'p' && OPEN.includes(t.s)) { d++; continue; }
        if (t.t === 'p' && CLOSE.includes(t.s)) { d--; continue; }
        if (d === 0 && t.s === '=') expectName = false;
        else if (d === 0 && t.s === ',') expectName = true;
        else if (t.t === 'id' && expectName && d >= 0 && !['const', 'let', 'var'].includes(t.s)) { names.add(t.s); if (d === 0) expectName = false; }
      }
    }
    stmts.push({ start: T[startIdx].a, end: T[end].b, names, ids });
    i = end + 1;
  }
  return stmts;
}

const HASHISH = /hash|digest|keccak|sha\d|crc|checksum/i;
const isComputeName = (n) => /^compute[\w$]*$/i.test(n) && !HASHISH.test(n);

/** Closure source for a top-level function `name`: its statement plus every top-level declaration it reaches. */
export function closureSource(src, name) {
  const stmts = splitStatements(src);
  const declBy = new Map();
  stmts.forEach((s, idx) => { for (const nm of s.names) if (!declBy.has(nm)) declBy.set(nm, idx); });
  if (!declBy.has(name)) return null;
  const need = new Set();
  const queue = [declBy.get(name)];
  while (queue.length) {
    const idx = queue.pop();
    if (need.has(idx)) continue;
    need.add(idx);
    for (const id of stmts[idx].ids) if (declBy.has(id) && !need.has(declBy.get(id))) queue.push(declBy.get(id));
  }
  return [...need].sort((a, b) => a - b).map((i) => src.slice(stmts[i].start, stmts[i].end)).join('\n');
}

/** Names of top-level compute-like functions declared in the source (function declarations and const/let/var). */
function topLevelComputeNames(src) {
  const names = [];
  for (const s of splitStatements(src)) for (const n of s.names) if (isComputeName(n)) names.push(n);
  return [...new Set(names)].sort((a, b) => (a === 'compute' ? -1 : b === 'compute' ? 1 : 0));
}

// ---------------------------------------------------------------- page side: vm context

/** A universal no-op DOM stub: every property read, call and construction yields the stub itself. */
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

/** Run one vector through ctx.__fn twice. Returns { out, out2, err } where out is a JSON string or undefined. */
function callPage(ctx, pp) {
  const runOnce = () => {
    ctx.__vin = JSON.stringify(pp || {});
    return vm.runInContext('(function(){ var r = __fn(JSON.parse(__vin)); if (r && typeof r.then === "function") return "__PROMISE__"; return r === undefined ? undefined : JSON.stringify(r); })()', ctx, { timeout: PAGE_TIMEOUT_MS });
  };
  try { return { out: runOnce(), out2: runOnce() }; } catch (e) {
    const msg = String(e && e.message || e).slice(0, 160);
    return { err: msg, timeout: /timed out/i.test(msg) };
  }
}

const keysOf = (str) => { try { const u = unwrap(str); return u.payload && typeof u.payload === 'object' && !Array.isArray(u.payload) ? Object.keys(u.payload) : []; } catch { return []; } };

function kernelShaped(outStr, refKeys) {
  if (!outStr || outStr === '__PROMISE__' || !refKeys.length) return false;
  const got = new Set(keysOf(outStr));
  const shared = refKeys.filter((k) => got.has(k)).length;
  return shared >= Math.min(3, refKeys.length) && shared >= refKeys.length / 2;
}

/**
 * Evaluate one shape (list of code strings run in order) over every vector.
 * Returns { ok:false, why } or { ok:true, fn, runs:[{out,out2,err}], threw:boolean }.
 */
function evalShape(codes, candidates, vectors, refKeys) {
  const ctx = makeContext();
  try { codes.forEach((c, i) => vm.runInContext(c, ctx, { timeout: PAGE_TIMEOUT_MS, filename: `page-script-${i}.js` })); }
  catch (e) { return { ok: false, why: `page throws on load: ${String(e && e.message || e).slice(0, 100)}` }; }
  const names = [...candidates];
  try {
    const props = Array.from(vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx));
    for (const p of props) if (isComputeName(p) && !names.includes(p)) names.push(p);
  } catch { /* candidates from the source scan only */ }
  names.sort((a, b) => (a === 'compute' ? -1 : b === 'compute' ? 1 : 0));
  let sawFn = false;
  for (const name of names) {
    let ok = false;
    try { ok = vm.runInContext(`typeof ${name} === "function" && ${name}.length <= 1`, ctx); } catch { ok = false; }
    if (!ok) continue;
    sawFn = true;
    vm.runInContext(`__fn = ${name}`, ctx);
    let shaped = false;
    let allThrew = true;
    for (const v of vectors.slice(0, 3)) {
      const r = callPage(ctx, v.policy_parameters);
      if (r.timeout) return { ok: false, why: 'page compute timed out' };
      if (r.err) continue;
      allThrew = false;
      if (r.out === '__PROMISE__') break;
      shaped = kernelShaped(r.out, refKeys);
      break;
    }
    if (!shaped && !(allThrew && name === 'compute')) continue;
    const runs = [];
    for (const v of vectors) {
      const r = callPage(ctx, v.policy_parameters);
      if (r.timeout) return { ok: false, why: 'page compute timed out' };
      runs.push(r);
    }
    return { ok: true, fn: name, runs, threw: runs.some((r) => r.err) };
  }
  return { ok: false, why: sawFn ? 'compute output is not kernel-shaped (hash helper or DOM handler)' : 'no runnable compute function' };
}

const sameRuns = (a, b) => a.runs.every((r, i) => {
  const o = b.runs[i];
  if (r.err || o.err) return !!r.err === !!o.err;
  return cstrOrNull(r.out) === cstrOrNull(o.out);
});
const cstrOrNull = (s) => { if (s === undefined) return 'undefined'; try { const u = unwrap(s); return cstr({ p: u.payload, f: u.flags, e: u.env }); } catch { return String(s); } };

// ---------------------------------------------------------------- classification of one page

/**
 * Pure over its arguments so the selftest can drive it. `kernelRes` is the worker result
 * ({ loadError, out:[{name,a,b,err}] }), `vectors` the fixture vectors.
 */
export function analyzePage({ id, html, vectors, kernelRes }) {
  const res = { id, state: null, vectors_run: 0, mismatches: [], flags_only: [], note: '', shape: null, kernel_errors: 0, kernel_nondeterministic: 0, kernel_fixture_drift: 0 };
  if (kernelRes.loadError) { res.state = 'LOAD-ERROR'; res.note = kernelRes.loadError; return res; }
  const scripts = extractScripts(html);
  if (!scripts.length) { res.state = 'UNEXTRACTABLE'; res.note = 'no executable script block'; return res; }
  // Reference keys for the kernel-shaped check: the first fixture payload, else the first live kernel output.
  let refKeys = [];
  for (const v of vectors) { if (v.output_payload && typeof v.output_payload === 'object') { refKeys = Object.keys(v.output_payload); break; } }
  if (!refKeys.length) for (const k of kernelRes.out) if (k.a) { refKeys = keysOf(k.a); break; }
  const joined = scripts.join('\n');
  const candidates = topLevelComputeNames(joined);

  const whole = evalShape(scripts, candidates, vectors, refKeys);
  let closure = { ok: false, why: 'not attempted' };
  const csrcName = candidates.includes('compute') ? 'compute' : candidates[0];
  let csrc = null;
  try { if (csrcName) csrc = closureSource(joined, csrcName); } catch { csrc = null; }
  if (csrc) closure = evalShape([csrc], [csrcName], vectors, refKeys);
  else if (!whole.ok) closure = { ok: false, why: 'no top-level compute to extract' };

  let use;
  const clean = (s) => s.ok && !s.threw;
  if (whole.ok) {
    // A shape that throws on a vector did not "run" (the closure drops init code on purpose), so a clean
    // whole-block run stands alone; two clean runs that disagree, or a throwing whole-block beside a clean
    // closure, mean the harness cannot tell which shape is faithful.
    const disagree = closure.ok && (clean(whole) ? (clean(closure) && !sameRuns(whole, closure)) : clean(closure));
    if (disagree) {
      res.state = 'HARNESS-SUSPECT';
      res.note = 'whole-block and closure evaluation disagree';
      return res;
    }
    use = whole; res.shape = 'whole-block';
  } else if (closure.ok) { use = closure; res.shape = 'closure'; }
  else { res.state = 'UNEXTRACTABLE'; res.note = whole.why; return res; }

  const kByName = new Map(kernelRes.out.map((k) => [k.name, k]));
  let selfDisagree = false;
  vectors.forEach((v, i) => {
    const run = use.runs[i];
    const k = kByName.get(v.name);
    if (!k) return;
    if (k.err) { res.kernel_errors++; return; }
    if (k.a !== k.b) { res.kernel_nondeterministic++; return; }
    if (!run.err && run.out !== run.out2) { selfDisagree = true; return; }
    const kn = unwrap(k.a);
    if (v.output_payload !== undefined && cstr(kn.payload) !== cstr(v.output_payload)) res.kernel_fixture_drift++;
    res.vectors_run++;
    if (run.err) { res.mismatches.push({ vector: v.name, path: '(page threw)', page: run.err, kernel: trunc(kn.payload) }); return; }
    const pg = unwrap(run.out);
    const d = firstDiff(pg.payload, kn.payload);
    if (d) { res.mismatches.push({ vector: v.name, path: d.path, page: d.page, kernel: d.kernel }); return; }
    if (pg.env && kn.env && cstr(pg.flags) !== cstr(kn.flags)) res.flags_only.push({ vector: v.name, page: trunc(pg.flags), kernel: trunc(kn.flags) });
  });
  if (selfDisagree) { res.state = 'NONDETERMINISTIC'; res.note = 'page output differs between two runs'; return res; }
  if (res.kernel_nondeterministic && !res.vectors_run) { res.state = 'NONDETERMINISTIC'; res.note = 'kernel output differs between two runs'; return res; }
  if (!res.vectors_run) { res.state = 'NO-FIXTURES'; res.note = 'no comparable vector'; return res; }
  res.state = res.mismatches.length ? 'MISMATCH' : res.flags_only.length ? 'FLAGS-ONLY' : 'MATCH';
  return res;
}

/** Baseline document for a future blocking stage: MISMATCH (page, vector) pairs only. Written ONLY by --write-baseline. */
export function buildBaseline(results) {
  const pages = {};
  let total = 0;
  for (const r of results.filter((x) => x.state === 'MISMATCH').sort((a, b) => a.id.localeCompare(b.id))) {
    const vs = [...new Set(r.mismatches.map((m) => m.vector))].sort();
    pages[r.id] = { vectors: vs, count: vs.length };
    total += vs.length;
  }
  return { pages, total_pairs: total };
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const a = { json: null, baseline: null, root: resolve(HERE, '..'), only: null, verbose: false };
  const need = (i) => { if (argv[i] === undefined) { console.error('usage: missing value for a flag'); process.exit(2); } return argv[i]; };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') a.json = need(++i);
    else if (argv[i] === '--write-baseline') a.baseline = need(++i);
    else if (argv[i] === '--root') a.root = resolve(need(++i));
    else if (argv[i] === '--only') a.only = new Set(need(++i).split(',').filter(Boolean));
    else if (argv[i] === '--verbose') a.verbose = true;
    else { console.error(`usage: check-page-kernel-parity.mjs [--json <file>] [--write-baseline <file>] [--root <dir>] [--only <id,id>] [--verbose] (unknown arg ${argv[i]})`); process.exit(2); }
  }
  return a;
}

async function main() {
  // Page code runs async work at load (a rejected promise inside the vm context); that is a page
  // property, never a harness crash.
  process.on('unhandledRejection', () => {});
  const args = parseArgs(process.argv.slice(2));
  const cdir = join(args.root, 'chaingraph');
  const kdir = join(cdir, 'kernels');
  if (!existsSync(kdir)) { console.error(`kernels dir not found: ${kdir}`); process.exit(2); }
  let ids = readdirSync(kdir).filter((f) => f.endsWith('.kernel.mjs')).map((f) => f.replace(/\.kernel\.mjs$/, '')).sort();
  if (args.only) ids = ids.filter((i) => args.only.has(i));

  const results = [];
  const queue = [];
  for (const id of ids) {
    const fpath = join(kdir, 'fixtures', `${id}.fixtures.json`);
    const ppath = join(cdir, `${id}.html`);
    let doc = null;
    try { doc = JSON.parse(readFileSync(fpath, 'utf8')); } catch { doc = null; }
    if (!doc || !Array.isArray(doc.vectors) || !doc.vectors.length) { results.push({ id, state: 'NO-FIXTURES', vectors_run: 0, mismatches: [], flags_only: [], note: 'no fixture vectors' }); continue; }
    if (!existsSync(ppath)) { results.push({ id, state: 'NO-PAGE', vectors_run: 0, mismatches: [], flags_only: [], note: '' }); continue; }
    queue.push({ id, vectors: doc.vectors, ppath, kpath: join(kdir, `${id}.kernel.mjs`) });
  }
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < queue.length) {
      const job = queue[next++];
      const kernelRes = await runKernel(job.kpath, job.vectors);
      let r;
      try { r = analyzePage({ id: job.id, html: readFileSync(job.ppath, 'utf8'), vectors: job.vectors, kernelRes }); }
      catch (e) { r = { id: job.id, state: 'UNEXTRACTABLE', vectors_run: 0, mismatches: [], flags_only: [], note: `harness error: ${String(e && e.message || e).slice(0, 100)}` }; }
      results.push(r);
    }
  }));
  results.sort((a, b) => a.id.localeCompare(b.id));

  const count = (s) => results.filter((r) => r.state === s).length;
  const totals = {
    pages_checked: results.filter((r) => !['NO-PAGE', 'NO-FIXTURES'].includes(r.state)).length,
    MATCH: count('MATCH'), MISMATCH: count('MISMATCH'), FLAGS_ONLY: count('FLAGS-ONLY'), HARNESS_SUSPECT: count('HARNESS-SUSPECT'),
    UNEXTRACTABLE: count('UNEXTRACTABLE'), NO_PAGE: count('NO-PAGE'), NO_FIXTURES: count('NO-FIXTURES'),
    NONDETERMINISTIC: count('NONDETERMINISTIC'), LOAD_ERROR: count('LOAD-ERROR'),
    vectors_run: results.reduce((n, r) => n + (r.vectors_run || 0), 0),
    vectors_mismatching: results.reduce((n, r) => n + new Set((r.mismatches || []).map((m) => m.vector)).size, 0),
  };
  const lines = [];
  for (const r of results) {
    if (!args.verbose && (r.state === 'MATCH' || r.state === 'NO-PAGE' || r.state === 'NO-FIXTURES')) continue;
    let detail = r.note || '';
    if (r.state === 'MISMATCH') { const m = r.mismatches[0]; detail = `${new Set(r.mismatches.map((x) => x.vector)).size}/${r.vectors_run} vector(s); first ${m.vector} at ${m.path} page=${m.page} kernel=${m.kernel}`; }
    else if (r.state === 'FLAGS-ONLY') detail = `${r.flags_only.length}/${r.vectors_run} vector(s); first ${r.flags_only[0].vector} page=${r.flags_only[0].page} kernel=${r.flags_only[0].kernel}`;
    lines.push(`${r.state.padEnd(15)} ${r.id}  ${detail}`);
  }
  const summary = [
    'page-kernel-parity (stage 1, ADVISORY, always exit 0)',
    ...lines,
    `pages checked: ${totals.pages_checked}  vectors run: ${totals.vectors_run}  vectors mismatching: ${totals.vectors_mismatching}`,
    `MATCH: ${totals.MATCH}  MISMATCH: ${totals.MISMATCH}  FLAGS-ONLY: ${totals.FLAGS_ONLY}  HARNESS-SUSPECT: ${totals.HARNESS_SUSPECT}  UNEXTRACTABLE: ${totals.UNEXTRACTABLE}  NO-PAGE: ${totals.NO_PAGE}  NO-FIXTURES: ${totals.NO_FIXTURES}  (NONDETERMINISTIC: ${totals.NONDETERMINISTIC}  LOAD-ERROR: ${totals.LOAD_ERROR})`,
  ].join('\n');
  console.log(summary);
  if (args.json) {
    mkdirSync(dirname(resolve(args.json)), { recursive: true });
    writeFileSync(args.json, JSON.stringify({ stage: 1, advisory: true, totals, pages: results }, null, 2) + '\n');
  }
  // Stage 2 groundwork: record the current MISMATCH pairs. Stage 1 never reads this file back.
  if (args.baseline) {
    mkdirSync(dirname(resolve(args.baseline)), { recursive: true });
    writeFileSync(args.baseline, JSON.stringify(buildBaseline(results), null, 2) + '\n');
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, '```\n' + summary + '\n```\n'); } catch { /* summary is best effort */ }
  }
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--kernel-worker') kernelWorker(resolve(process.argv[3])).catch(() => process.exit(0));
  else main().catch((e) => { console.error(`harness crash: ${e && e.stack || e}`); process.exit(2); });
}
