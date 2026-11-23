#!/usr/bin/env node
/**
 * scripts/codemods/page-null-proto.mjs — PAGE-NULLPROTO-CODEMOD-1.
 *
 * THE DEFECT (Muse lane #99, pin 728ce618c4). A node page inlines its own execution-hash
 * producer: an object literal `{ policy_parameters, output_payload }` is walked by a
 * page-local canonicalizer whose object accumulator is a plain `{}`. Assigning `o["__proto__"]`
 * on a `{}` target sets the PROTOTYPE, not an own member, so a JSON member literally named
 * "__proto__" (which JSON.parse delivers as an ordinary own enumerable key; RFC 8785 §3.2.3
 * knows no special member names) silently vanishes from the hash preimage. The kernel-side
 * SSOT (`chaingraph/kernels/_hash.mjs`) builds its preimage string directly from Object.keys
 * and INCLUDES the member, so a page hash can never be verified against the worker for such
 * artifacts. The fix is one line per file: the accumulator becomes `Object.create(null)`,
 * exactly how `_hash.mjs`'s own legacy `cgCanon` was repaired (JCS-CANON-FIX-1).
 *
 * (a) CENSUS. For every node page `chaingraph/{art-*,[0-9]*}.html` that pairs with a kernel
 *     and a fixtures file, find the page's own hash-producer statement (the top-level
 *     definition whose body hashes a `{ policy_parameters, output_payload }` preimage, one
 *     helper call deep at most), then RUN it in a browser-faithful node:vm context (same
 *     whole-block load, stub DOM and WebCrypto as scripts/check-page-kernel-parity.mjs, whose
 *     extractScripts/closureSource/splitStatements this script imports) on the FIRST fixture
 *     vector twice:
 *       clean leg — pageHash(pp), recorded for before/after byte-identity;
 *       proto leg — pageHash(pp with one added own "__proto__" member).
 *     and compare against kernel executionHash(pp) and executionHash(pp+member). Classification:
 *       DROP      — some seam's page hash is UNCHANGED by the added member while the kernel's
 *                   changes (the page provably drops the member), and a `{}`-accumulator
 *                   canonicalizer is attributed by name on that seam's path;
 *       KEEP      — every measured seam's hash moves with the member;
 *       NO-PATH   — no preimage seam, no runnable seam (load error / throws / no hash), or
 *                   no fixture output;
 *       AMBIGUOUS — drop-shaped insensitivity with no attributable `{}` accumulator;
 *       DROP (source-classified, flagged attr_source_only) — no seam runnable headlessly but
 *                   a seam's path applies a `{}`-accumulator canonicalizer directly to the
 *                   preimage. Never batched on this flag alone without an execution proof.
 *
 * (b) CODEMOD. `codemod --batch <k> --size <n>` recomputes the DROP roster (sorted, excluding
 *     chaingraph/art-789-stablecoin-admin-role-lint.html, held out of every batch), slices
 *     batch k, and edits ONLY inside the attributed canonicalizer definition spans
 *     (brace-matched, word-boundary name match):
 *       R1  /,\s*\{\}\)/g                                              -> `, Object.create(null))`
 *       R2  /(const|let|var)(\s+)(\w+)(\s*=\s*)\{\};/                  -> `$1$2$3$4Object.create(null);`
 *       R3  exact `Object.assign({}, params, output)`                  -> `Object.assign(Object.create(null), params, output)`
 *     It refuses on a dirty tree and logs one line per file with the rule and replacement
 *     count. A file whose applied count does not equal the count of `{}`-accumulator
 *     occurrences in its attributed spans (plus R3 occurrences) is an exception: it stops
 *     the run before further files are written.
 *
 * Node built-ins only; no network, no randomness. The census never writes into the repo tree
 * (its report goes to the path given by --json).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { extractScripts, closureSource, splitStatements, tokenize } from '../check-page-kernel-parity.mjs';
import { gitEnv } from '../_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '..', '..');
const PAGE_TIMEOUT_MS = 30000;
const SEAM_TIMEOUT_MS = 15000;
export const EXCLUDED_FROM_BATCHES = new Set(['chaingraph/art-789-stablecoin-admin-role-lint.html']);
const PROTO_MEMBER = '__proto__';
const PROTO_VALUE = { census_nullproto_sentinel: 'PAGE-NULLPROTO-CODEMOD-1' };

const CANON_NAMES = ['cgCanon', 'canon', '__canon', 'cn', 'canonicalize', '__ocgCanon'];
const JCS_HINT_RE = /__ocgCanonStr\s*\(|__ocgJcs\s*\(|jcsStringify\s*\(/;
// The R3 merge shape, in its defect form ({} target) and its fixed form (null-prototype target):
// attribution must survive the fix so the post-codemod census still finds the producer.
const MERGE_RE = /Object\.assign\(\s*(?:\{\}|Object\.create\(null\))\s*,\s*params,\s*output\)/;
const MERGE_DEFECT_RE = /Object\.assign\(\{\},\s*params,\s*output\)/;

// ── source scanning ──────────────────────────────────────────────────────────────────────────────

/**
 * Every balanced `{...}` span in src at EVERY nesting level, from the parity gate's tokenizer
 * (which already handles regex literals, template literals, strings and comments on this
 * estate). Returns [{ ob, cb }] ordered by ob.
 */
export function balancedSpans(src) {
  const T = tokenize(src);
  const spans = [];
  const stack = [];
  for (const t of T) {
    if (t.t !== 'p') continue;
    if (t.s === '{') stack.push(t.a);
    else if (t.s === '}') {
      const ob = stack.pop();
      if (ob !== undefined) spans.push({ ob, cb: t.b - 1 });
    }
  }
  spans.sort((a, b) => a.ob - b.ob);
  return spans;
}

/** `{}`-accumulator occurrences inside a canonicalizer definition span (R1 + R2). */
export function accumulatorHits(span) {
  const hits = [];
  let m;
  const r1 = /,\s*\{\}\)/g;
  while ((m = r1.exec(span))) hits.push({ rule: 'R1', start: m.index });
  const r2 = /(?:const|let|var)(\s+)(\w+)(\s*=\s*)\{\};/g;
  while ((m = r2.exec(span))) hits.push({ rule: 'R2', start: m.index });
  hits.sort((a, b) => a.start - b.start);
  return hits;
}

/** Word-boundary canonicalizer definitions: [{ name, defStart, defEnd, span }]. */
export function canonDefs(src) {
  const byOb = new Map(balancedSpans(src).map((s) => [s.ob, s.cb]));
  const out = [];
  for (const name of CANON_NAMES) {
    const re = new RegExp('\\b(?:async\\s+)?function\\s+' + name + '\\s*\\(|\\b(?:const|let|var)\\s+' + name + '\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>', 'g');
    let m;
    while ((m = re.exec(src))) {
      const ob = src.indexOf('{', m.index + m[0].length - 1);
      if (ob < 0) continue;
      const cb = byOb.get(ob);
      if (cb === undefined) continue;
      out.push({ name, defStart: m.index, defEnd: cb, span: src.slice(m.index, cb + 1) });
    }
  }
  return out;
}

/** Index of the `}` matching the `{` at openIdx. -1 when unbalanced. */
export function braceMatchAt(src, openIdx) {
  for (const s of balancedSpans(src)) if (s.ob === openIdx) return s.cb;
  return -1;
}

/** Parameter count of the first function-ish declaration in a statement body. -1 when none. */
export function paramCount(body) {
  const fm = /(?:async\s+)?function\s*[A-Za-z_$][\w$]*\s*\([^)]*\)|(?:async\s*)?\([^)]*\)\s*=>|(?:async\s*)?[A-Za-z_$][\w$]*\s*=>/.exec(body);
  if (!fm) return -1;
  const seg = fm[0];
  if (/=>\s*$/.test(seg) && !seg.includes('(')) return 1;
  if (!seg.includes('(')) return -1;
  const inner = seg.slice(seg.indexOf('(') + 1, seg.lastIndexOf(')'));
  if (!inner.trim()) return 0;
  return inner.split(',').length;
}

/**
 * Seam analysis over a page's joined script text. A SEAM is a top-level statement containing
 * a `{ policy_parameters: ..., output_payload: ... }` literal at the literal's top level.
 * Each seam: { name, params, kind, attributed } where kind is 'canon-drop' (a `{}`-accumulator
 * canonicalizer is called on the seam's path, one helper level deep at most), 'jcs', or
 * 'other'; attributed lists the dropping canonicalizer names.
 */
export function analyzeSeams(joined) {
  const defs = canonDefs(joined);
  const dropDefSpans = [];
  for (const d of defs) if (accumulatorHits(d.span).length > 0) dropDefSpans.push(d);
  const stmts = splitStatements(joined);
  const seams = [];
  for (const site of balancedSpans(joined)) {
    const lit = joined.slice(site.ob, site.cb + 1);
    const inner = lit.slice(1, -1);
    if (!/\bpolicy_parameters\b/.test(inner) || !/\boutput_payload\b/.test(inner)) continue;
    // A PREIMAGE literal, not an artifact literal: artifact envelopes carry envelope keys the
    // hash preimage never has.
    if (/@(?:context|audit_signature)|chaingraph_version|compliance_flags\s*:|tool_version\s*:|generated_at\s*:/.test(inner)) continue;
    // Callee hijack: when the literal is passed STRAIGHT into a 1-arg local hash helper whose
    // body ends in a digest (the `sha256({...})` shape), the helper — not the enclosing
    // business function — is the page's hash producer.
    const cal = joined.slice(0, site.ob).match(/\b([A-Za-z_$][\w$]*)\s*\(\s*$/);
    if (cal && !CANON_NAMES.includes(cal[1])) {
      const cst = stmts.find((s) => s.names.has(cal[1]));
      if (cst && !seams.some((s) => s.stmtStart === cst.start)) {
        const cbody = joined.slice(cst.start, cst.end);
        if (/subtle\.digest/.test(cbody) && paramCount(cbody) === 1) {
          const cAttrs = dropDefSpans.filter((d) => new RegExp('\\b' + d.name + '\\s*\\(').test(cbody)).map((d) => d.name);
          if (MERGE_RE.test(cbody)) cAttrs.push('merge');
          seams.push({
            name: cal[1], stmtStart: cst.start, stmtEnd: cst.end, params: 1,
            kind: cAttrs.length ? 'canon-drop' : (JCS_HINT_RE.test(cbody) ? 'jcs' : 'other'),
            attributed: cAttrs,
          });
          continue;
        }
      }
    }
    const st = stmts.find((s) => s.start <= site.ob && site.cb < s.end);
    if (!st) continue;
    if (seams.some((s) => s.stmtStart === st.start)) continue;
    let name = null;
    for (const nm of st.names) { name = nm; break; }
    const body = joined.slice(st.start, st.end);
    const params = paramCount(body);
    const attributed = dropDefSpans.filter((d) => new RegExp('\\b' + d.name + '\\s*\\(').test(body)).map((d) => d.name);
    if (MERGE_RE.test(body)) attributed.push('merge');
    let kind = attributed.length ? 'canon-drop' : (JCS_HINT_RE.test(body) ? 'jcs' : 'other');
    if (kind === 'other') {
      // one helper level: scan callee top-level statements for the canon/jcs application
      const calleeRe = /\b([A-Za-z_$][\w$]*)\s*\(/g;
      let cm;
      const tried = new Set();
      while ((cm = calleeRe.exec(body))) {
        const cn = cm[1];
        if (tried.has(cn)) continue;
        tried.add(cn);
        if (CANON_NAMES.includes(cn)) continue;
        const cst = stmts.find((s) => s.names.has(cn) && s.start !== st.start);
        if (!cst) continue;
        const cbody = joined.slice(cst.start, cst.end);
        const cAttrs = dropDefSpans.filter((d) => new RegExp('\\b' + d.name + '\\s*\\(').test(cbody)).map((d) => d.name);
        if (MERGE_RE.test(cbody)) cAttrs.push('merge');
        if (cAttrs.length) { attributed.push(...cAttrs); kind = 'canon-drop'; break; }
        if (JCS_HINT_RE.test(cbody)) { kind = 'jcs'; break; }
      }
    }
    seams.push({ name, stmtStart: st.start, stmtEnd: st.end, params, kind, attributed });
  }
  // Synthetic seam for the R3 merge shape: a statement that builds the preimage by the exact
  // flat `Object.assign({}, params, output)` and digests it carries no wrapper literal, but it
  // IS the page's hash producer (params: 2 -> driven as (pp, op)).
  for (const st of stmts) {
    if (seams.some((s) => s.stmtStart === st.start)) continue;
    const body = joined.slice(st.start, st.end);
    if (!MERGE_RE.test(body) || !/subtle\.digest/.test(body)) continue;
    let name = null;
    for (const nm of st.names) { name = nm; break; }
    seams.push({ name, stmtStart: st.start, stmtEnd: st.end, params: paramCount(body), kind: 'canon-drop', attributed: ['merge'] });
  }
  return { seams, dropDefSpans };
}

// ── vm execution ─────────────────────────────────────────────────────────────────────────────────

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

const pickHash = (o) => {
  if (typeof o === 'string') return o;
  if (o && typeof o === 'object') {
    if (typeof o.execution_hash === 'string') return o.execution_hash;
    if (typeof o.hash === 'string') return o.hash; // {hash, refusal} generation (HASH-REFUSAL-GUARDS shape)
  }
  return null;
};

/**
 * Build a caller for one seam: whole-block loads the page's scripts (all top-level definitions
 * live, exactly as in a browser); when that load throws, fall back to a fresh context holding
 * only the producer's closureSource. call(pp, op) invokes the producer with the seam's own
 * argument shape and resolves the hash from the return value (hex string / artifact object) or
 * the page's artifact globals.
 */
export function buildSeamRunner(scripts, seam) {
  if (!seam.name) return { loadError: 'unnamed seam statement' };
  const code = scripts.join('\n');
  let ctx = makeContext();
  let loadError = null;
  try {
    vm.runInContext(code, ctx, { timeout: PAGE_TIMEOUT_MS, filename: 'page#inline' });
  } catch (e) {
    loadError = String(e && e.message || e).slice(0, 140);
    let closure = null;
    try { closure = closureSource(code, seam.name); } catch { closure = null; }
    if (!closure) return { loadError };
    ctx = makeContext();
    try {
      vm.runInContext(closure, ctx, { timeout: PAGE_TIMEOUT_MS, filename: 'page#closure' });
      loadError = null;
    } catch (e2) {
      return { loadError: `closure: ${String(e2 && e2.message || e2).slice(0, 100)}` };
    }
  }
  try { vm.runInContext('globalThis.__pnpAsync = (fn) => fn();', ctx); } catch { /* unreachable */ }
  const marker = '__pnpSeamOut';
  const argExpr = seam.params === 0 ? '()'
    : seam.params === 1 ? '({ policy_parameters: __pp, output_payload: __op })'
    : seam.params === 2 ? '(__pp, __op)'
    : '(__pp, __op, [])';
  return {
    loadError: null,
    async call(pp, op) {
      // Inject via JSON.parse, NEVER an object literal: a literal's "__proto__" key sets the
      // prototype, which would silently strip the very member this census adds (JSON.parse
      // delivers it as an ordinary own enumerable key, exactly like a browser JSON field).
      vm.runInContext(`__pp = JSON.parse(${JSON.stringify(JSON.stringify(pp ?? null))}); __op = JSON.parse(${JSON.stringify(JSON.stringify(op ?? null))});`, ctx);
      for (const g of ['_artifact', '_lastArtifact', '_lastResult']) {
        try { vm.runInContext(`try { ${g} = undefined; } catch (e) {}`, ctx); } catch { /* non-assignable */ }
      }
      let threw = null;
      const legExpr = `(async () => { try { ${marker} = await ${seam.name}${argExpr}; } catch (e) { ${marker} = undefined; __pnpSeamErr = String(e && e.message || e).slice(0, 150); } })()`;
      try {
        vm.runInContext(`var ${marker}; var __pnpSeamErr = null;`, ctx);
        const pr = vm.runInContext(legExpr, ctx, { filename: 'page#seam' });
        await Promise.race([
          Promise.resolve(pr).catch(() => {}),
          new Promise((_res, rej) => setTimeout(() => rej(new Error('seam timed out')), SEAM_TIMEOUT_MS)),
        ]);
      } catch (e) {
        threw = String(e && e.message || e).slice(0, 160);
        if (/timed out/i.test(threw)) throw new Error(`seam timed out: ${threw}`);
      }
      threw = String(vm.runInContext('__pnpSeamErr', ctx) || '') || threw;
      const out = vm.runInContext(`typeof ${marker} === "undefined" ? null : ${marker}`, ctx);
      let hash = pickHash(out);
      if (hash === null) {
        for (const g of ['_artifact', '_lastArtifact', '_lastResult']) {
          let gv = null;
          try { gv = vm.runInContext(`typeof ${g} === "undefined" ? null : ${g}`, ctx); } catch { gv = null; }
          const h = pickHash(gv);
          if (h !== null) { hash = h; break; }
        }
      }
      if (hash === null && threw) throw new Error(`seam threw: ${threw}`);
      if (hash === null) return { hash: null };
      return { hash: String(hash).replace(/^sha256:/, '') };
    },
  };
}

// ── census ───────────────────────────────────────────────────────────────────────────────────────

/** pp for the proto leg: deep clone plus ONE own "__proto__" member with an object value. */
export function withProtoMember(pp) {
  const base = JSON.stringify(pp ?? {});
  const member = ',"' + PROTO_MEMBER + '":' + JSON.stringify(PROTO_VALUE);
  const s = base === '{}' ? '{' + member.slice(1) : base.slice(0, -1) + member;
  return JSON.parse(s + '}');
}

export async function censusPage({ id, html, vector, kernelExecutionHash }) {
  const res = { id, cls: null, mechanism: null, seams: 0, clean_hash: null, proto_hash: null,
    kernel_clean: null, kernel_proto: null, clean_parity: null, note: '', attr_source_only: false };
  const scripts = extractScripts(html);
  if (!scripts.length) { res.cls = 'NO-PATH'; res.note = 'no executable script block'; return res; }
  const joined = scripts.join('\n');
  const analysis = analyzeSeams(joined);
  res.seams = analysis.seams.length;
  if (!analysis.seams.length) { res.cls = 'NO-PATH'; res.note = 'no {policy_parameters,output_payload} preimage seam'; return res; }

  const pp = vector.policy_parameters ?? {};
  if (vector.output_payload === undefined) { res.cls = 'NO-PATH'; res.note = 'first fixture vector has no output_payload'; return res; }
  const op = vector.output_payload;
  const pp2 = withProtoMember(pp);

  let kernelClean = null;
  let kernelProto = null;
  try {
    kernelClean = await kernelExecutionHash(pp, op);
    kernelProto = await kernelExecutionHash(pp2, op);
  } catch (e) {
    res.cls = 'NO-PATH'; res.note = `kernel executionHash refused input: ${String(e && e.message || e).slice(0, 100)}`;
    return res;
  }
  res.kernel_clean = kernelClean;
  res.kernel_proto = kernelProto;

  const notes = [];
  let ranAny = false;
  let anyBothLegs = false;
  let firstClean = null;
  let firstProto = null;
  let attributed = [];
  let dropSeams = 0;
  for (const seam of analysis.seams.slice(0, 6)) {
    let runner;
    try { runner = buildSeamRunner(scripts, seam); } catch { continue; }
    if (runner.loadError) { notes.push(`${seam.name || 'seam'}: load ${runner.loadError.slice(0, 80)}`); continue; }
    let h1 = null;
    try { h1 = await runner.call(pp, op); } catch (e) { notes.push(`${seam.name}: clean ${String(e.message || e).slice(0, 90)}`); continue; }
    if (h1.hash === null) { notes.push(`${seam.name}: clean leg produced no hash`); continue; }
    ranAny = true;
    if (firstClean === null) firstClean = h1.hash;
    let h2 = null;
    try { h2 = await runner.call(pp2, op); } catch (e) { notes.push(`${seam.name}: proto ${String(e.message || e).slice(0, 90)}`); continue; }
    if (h2.hash === null) { notes.push(`${seam.name}: proto leg produced no hash`); continue; }
    anyBothLegs = true;
    if (firstProto === null) firstProto = h2.hash;
    if (h2.hash === h1.hash) {
      // page hash insensitive to the added member through THIS seam
      if (seam.attributed.length) { dropSeams++; if (!attributed.length) attributed = seam.attributed; }
    }
  }
  res.clean_hash = firstClean;
  res.proto_hash = firstProto;
  res.clean_parity = firstClean !== null ? firstClean === kernelClean : null;

  if (!ranAny) {
    const attributedSeam = analysis.seams.find((s) => s.kind === 'canon-drop' && s.attributed.length);
    if (attributedSeam) {
      res.cls = 'DROP'; res.mechanism = attributedSeam.attributed[0]; res.attr_source_only = true;
      res.note = `source-classified (no seam runnable headlessly: ${notes.join('; ').slice(0, 120)})`;
      return res;
    }
    res.cls = 'NO-PATH'; res.note = notes.join('; ').slice(0, 180) || 'no seam runnable headlessly';
    return res;
  }
  if (!anyBothLegs) {
    if (attributed.length || analysis.seams.some((s) => s.kind === 'canon-drop' && s.attributed.length)) {
      res.cls = 'DROP'; res.mechanism = (attributed[0] || analysis.seams.find((s) => s.kind === 'canon-drop').attributed[0]);
      res.attr_source_only = true;
      res.note = `source-classified (proto leg failed: ${notes.join('; ').slice(0, 120)})`;
      return res;
    }
    res.cls = 'NO-PATH'; res.note = notes.join('; ').slice(0, 180) || 'proto leg failed';
    return res;
  }
  if (kernelProto === kernelClean) { res.cls = 'KEEP'; res.note = 'kernel unchanged by the member'; return res; }
  if (dropSeams > 0) {
    if (attributed.length) { res.cls = 'DROP'; res.mechanism = attributed[0]; return res; }
    res.cls = 'AMBIGUOUS'; res.note = 'page hash unchanged by the member but no {}-accumulator canonicalizer attributed';
    return res;
  }
  res.cls = 'KEEP';
  return res;
}

/** The census over every paired node page under <root>/chaingraph. */
export async function runCensus({ root = DEFAULT_ROOT, only = null } = {}) {
  const cg = join(root, 'chaingraph');
  const kdir = join(cg, 'kernels');
  const fdir = join(kdir, 'fixtures');
  const pages = readdirSync(cg).filter((f) => f.endsWith('.html') && (/^art-/.test(f) || /^[0-9]/.test(f))).sort();
  const kernelIds = new Set(readdirSync(kdir).filter((f) => f.endsWith('.kernel.mjs')).map((f) => f.replace(/\.kernel\.mjs$/, '')));
  const fixtureIds = new Set(existsSync(fdir) ? readdirSync(fdir).filter((f) => f.endsWith('.fixtures.json')).map((f) => f.replace(/\.fixtures\.json$/, '')) : []);
  const { executionHash } = await import(pathToFileURL(join(kdir, '_hash.mjs')).href);

  const out = [];
  for (const f of pages) {
    if (only && !only.has(f)) continue;
    const id = f.replace(/\.html$/, '');
    const rel = `chaingraph/${f}`;
    if (!kernelIds.has(id) || !fixtureIds.has(id)) {
      out.push({ id, rel, cls: 'NO-PATH', mechanism: null, seams: 0, clean_hash: null, proto_hash: null,
        kernel_clean: null, kernel_proto: null, clean_parity: null, attr_source_only: false,
        note: kernelIds.has(id) ? 'no fixture vectors' : 'no kernel file' });
      continue;
    }
    let doc = null;
    try { doc = JSON.parse(readFileSync(join(fdir, `${id}.fixtures.json`), 'utf8')); } catch { doc = null; }
    const vector = doc && Array.isArray(doc.vectors) && doc.vectors.length ? doc.vectors[0] : null;
    if (!vector) {
      out.push({ id, rel, cls: 'NO-PATH', mechanism: null, seams: 0, clean_hash: null, proto_hash: null,
        kernel_clean: null, kernel_proto: null, clean_parity: null, attr_source_only: false,
        note: 'unreadable or empty fixtures file' });
      continue;
    }
    const html = readFileSync(join(cg, f), 'utf8');
    try {
      out.push(await censusPage({ id, html, vector, kernelExecutionHash: executionHash }));
      out[out.length - 1].rel = rel;
    } catch (err) {
      out.push({ id, rel, cls: 'NO-PATH', mechanism: null, seams: 0, clean_hash: null, proto_hash: null,
        kernel_clean: null, kernel_proto: null, clean_parity: null, attr_source_only: false,
        note: `harness: ${String(err && err.message || err).slice(0, 120)}` });
    }
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  const by = (c) => out.filter((r) => r.cls === c);
  const mech = {};
  for (const r of by('DROP')) mech[r.mechanism || '(none)'] = (mech[r.mechanism || '(none)'] || 0) + 1;
  const summary = {
    pages_scanned: out.length,
    DROP: by('DROP').length,
    KEEP: by('KEEP').length,
    NO_PATH: by('NO-PATH').length,
    AMBIGUOUS: by('AMBIGUOUS').length,
    drop_mechanisms: mech,
    drop_source_classified: by('DROP').filter((r) => r.attr_source_only).length,
    clean_parity_true: out.filter((r) => r.clean_parity === true).length,
  };
  return { summary, pages: out, root };
}

// ── codemod ──────────────────────────────────────────────────────────────────────────────────────

export function planBatchEdits(dropRoster, batch, size) {
  const roster = dropRoster.filter((r) => !EXCLUDED_FROM_BATCHES.has(r)).sort();
  const start = (batch - 1) * size;
  return { roster, slice: roster.slice(start, start + size), batches: Math.ceil(roster.length / size) };
}

/**
 * Apply R1/R2 inside the attributed canonicalizer definition spans and R3 file-wide.
 * Spans are edited in DESCENDING defStart order so earlier offsets stay valid.
 */
export function applyCodemodToSource(src, dropDefSpans, attributedNames) {
  let out = src;
  const applied = [];
  const spans = dropDefSpans.filter((d) => attributedNames.includes(d.name)).sort((a, b) => b.defStart - a.defStart);
  for (const d of spans) {
    const hits = accumulatorHits(d.span);
    if (!hits.length) continue;
    let span = d.span;
    let count = 0;
    span = span.replace(/,\s*\{\}\)/g, () => { count++; return ', Object.create(null))'; });
    span = span.replace(/(const|let|var)(\s+)(\w+)(\s*=\s*)\{\};/g, (mm, kw, s1, s2, s3) => { count++; return `${kw}${s1}${s2}${s3}Object.create(null);`; });
    out = out.slice(0, d.defStart) + span + out.slice(d.defEnd + 1);
    applied.push({ rule: `${d.name}:R1R2`, count });
  }
  const r3re = /Object\.assign\(\{\},\s*params,\s*output\)/g;
  const r3count = (out.match(r3re) || []).length;
  if (r3count > 0) {
    out = out.replace(/Object\.assign\(\{\},\s*params,\s*output\)/g, 'Object.assign(Object.create(null), params, output)');
    applied.push({ rule: 'R3:Object.assign', count: r3count });
  }
  return { src: out, applied };
}

/** Expected replacement count for one file before editing (spans + R3). */
export function expectedReplacementCount(src, dropDefSpans, attributedNames) {
  let n = 0;
  for (const d of dropDefSpans) if (attributedNames.includes(d.name)) n += accumulatorHits(d.span).length;
  n += (src.match(/Object\.assign\(\{\},\s*params,\s*output\)/g) || []).length;
  return n;
}

function assertCleanTree(root) {
  const r = spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8', env: gitEnv() });
  if (r.error) throw new Error(`git status failed: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`git status exited ${r.status}: ${String(r.stderr || '').slice(0, 200)}`);
  const dirty = String(r.stdout || '').split('\n').filter((l) => l.trim());
  if (dirty.length) throw new Error(`dirty tree — refusing (${dirty.length} entries). Commit or clean first.`);
}

/** Attributed canonicalizer names for one page's source: union over its drop-kind seams. */
export function attributedNamesFor(joined) {
  const analysis = analyzeSeams(joined);
  const names = [];
  for (const s of analysis.seams) for (const n of s.attributed) if (!names.includes(n)) names.push(n);
  return { analysis, names };
}

/**
 * File-space edit plan for one page: attribution comes from the joined scripts, but the
 * definition spans are recomputed over the FULL FILE so splice offsets align with the text
 * being written back. Mixing the two coordinate spaces corrupts the file mid-word.
 */
export function editPlanFor(src) {
  const joined = extractScripts(src).join('\n');
  const { names } = attributedNamesFor(joined);
  const dropDefSpans = canonDefs(src).filter((d) => accumulatorHits(d.span).length > 0);
  return { names, dropDefSpans };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const a = { mode: argv[0] === 'codemod' ? 'codemod' : argv[0] === '--self-test' ? 'selftest' : 'census',
    json: null, batch: null, size: null, root: DEFAULT_ROOT, only: null, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const need = () => { const v = argv[++i]; if (v === undefined) { console.error(`missing value for ${arg}`); process.exit(2); } return v; };
    if (arg === '--json') a.json = need();
    else if (arg === '--batch') a.batch = Number(need());
    else if (arg === '--size') a.size = Number(need());
    else if (arg === '--root') a.root = resolve(need());
    else if (arg === '--only') a.only = new Set(need().split(',').filter(Boolean));
    else if (arg === '--verbose') a.verbose = true;
    else if (arg === 'census' || arg === 'codemod' || arg === '--self-test') { /* mode */ }
    else { console.error(`usage: page-null-proto.mjs census [--json <f>] [--only <files>] [--root <dir>] | codemod --batch <k> --size <n> [--root <dir>] | --self-test (unknown arg ${arg})`); process.exit(2); }
  }
  return a;
}

async function main() {
  process.on('unhandledRejection', () => {});
  const args = parseArgs(process.argv.slice(2));

  if (args.mode === 'selftest') {
    const mod = await import(pathToFileURL(join(HERE, 'page-null-proto.selftest.mjs')).href);
    process.exit(await mod.selfTest());
  }

  if (args.mode === 'census') {
    const t0 = Date.now();
    const { summary, pages } = await runCensus({ root: args.root, only: args.only });
    console.log('page null-proto census (PAGE-NULLPROTO-CODEMOD-1)');
    console.log(`  scanned ${summary.pages_scanned} | DROP ${summary.DROP} | KEEP ${summary.KEEP} | NO-PATH ${summary.NO_PATH} | AMBIGUOUS ${summary.AMBIGUOUS}`);
    console.log(`  drop mechanisms: ${JSON.stringify(summary.drop_mechanisms)} (source-classified ${summary.drop_source_classified})`);
    console.log(`  clean parity vs kernel: ${summary.clean_parity_true}/${summary.pages_scanned}`);
    if (args.verbose) {
      for (const r of pages) {
        if (r.cls === 'KEEP' && !r.note) continue;
        console.log(`  ${r.cls.padEnd(9)} ${r.rel}  mech=${r.mechanism || '-'} seams=${r.seams} clean_parity=${r.clean_parity}${r.note ? '  ' + r.note.slice(0, 110) : ''}`);
      }
    }
    if (args.json) {
      mkdirSync(dirname(resolve(args.json)), { recursive: true });
      writeFileSync(args.json, JSON.stringify({ row: 'PAGE-NULLPROTO-CODEMOD-1', at: new Date().toISOString(), summary, pages }, null, 2) + '\n');
      console.log(`  report: ${args.json}`);
    }
    console.log(`  (${Math.round((Date.now() - t0) / 1000)}s)`);
    process.exit(0);
  }

  if (args.mode === 'codemod') {
    if (!args.batch || !args.size) { console.error('codemod requires --batch <k> --size <n>'); process.exit(2); }
    try {
      assertCleanTree(args.root);
    } catch (e) {
      console.error(`REFUSED: ${String(e && e.message || e)}`);
      process.exit(1);
    }
    const { pages } = await runCensus({ root: args.root });
    const drops = pages.filter((r) => r.cls === 'DROP' && !r.attr_source_only).map((r) => r.rel);
    const { slice, batches } = planBatchEdits(drops, args.batch, args.size);
    console.log(`roster: ${drops.length} execution-proven DROP page(s) (${batches} batch(es) of ${args.size}); batch ${args.batch} edits ${slice.length} file(s)`);
    if (!slice.length) { console.log('batch out of range — nothing to do'); process.exit(0); }
    let edited = 0;
    for (const rel of slice) {
      const abs = join(args.root, rel);
      const src = readFileSync(abs, 'utf8');
      const { names, dropDefSpans } = editPlanFor(src);
      const expected = expectedReplacementCount(src, dropDefSpans, names);
      const { src: next, applied } = applyCodemodToSource(src, dropDefSpans, names);
      const total = applied.reduce((n, a) => n + a.count, 0);
      if (total === 0 || total !== expected) {
        console.error(`EXCEPTION ${rel}: applied ${total} replacement(s), expected ${expected} — stopping the run.`);
        console.error(`  applied: ${JSON.stringify(applied)}`);
        process.exit(1);
      }
      writeFileSync(abs, next);
      edited++;
      console.log(`  ${rel}: ${applied.map((a) => `${a.rule} x${a.count}`).join(', ')} (${total} replacement${total === 1 ? '' : 's'})`);
    }
    console.log(`edited ${edited} file(s). Re-run the census on this batch before committing.`);
    process.exit(0);
  }
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  main().catch((e) => { console.error(`harness crash: ${e && e.stack || e}`); process.exit(2); });
}
