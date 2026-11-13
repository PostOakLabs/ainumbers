// @ts-nocheck: plain CLI utility script, never meant to be type-checked; it lives under
// chaingraph/kernels/ so tsc --checkJs sweeps it, same as lint-forbidden-hash.mjs.
// lint-caller-key-lookup.mjs: KERNEL-CALLER-KEY-LOOKUP-LINT-1.
//
// Three review escapes shipped through merged kernels because a caller-supplied value was used
// as a KEY into a plain object, or was coerced to a string before a type check:
//   A  computed member access TABLE[expr] on a plain object literal that is not guarded by
//      Object.hasOwn / hasOwnProperty.call (and is not a Map, Set or Object.create(null)).
//      "constructor", "__proto__" and "toString" resolve through the prototype chain.
//   B  enum validation by truthiness: if (!TABLE[value]) / TABLE[value] ? ... / TABLE[value] && ...
//      on a plain object, with no own-key test on the same line.
//   C  a string helper that coerces with String(v) before an emptiness test (.trim(), === '',
//      .length) without a typeof v === 'string' check, so false, {} and ["x"] pass as text.
//
// The scan is a zero-dependency source heuristic over the whole kernel file (helpers outside
// compute() are in scope because compute() calls them). Comments are blanked and string
// contents are masked before matching, so prose and literals never trip a pattern.
//
// Policy: existing kernels are ADVISORY against scripts/caller-key-lookup-baseline.json (counts
// only go down; a count above baseline prints a WARN, exit 0). A kernel with no baseline entry
// (a newly added kernel) is BLOCKING on any hit. The baseline is never edited by a PR that adds
// a kernel; it is rewritten only with --write-baseline, by a row that burns debt down.
//
// Usage:
//   node chaingraph/kernels/lint-caller-key-lookup.mjs              fleet scan vs baseline
//   node chaingraph/kernels/lint-caller-key-lookup.mjs --only <id>  one kernel (kernel-preflight)
//   node chaingraph/kernels/lint-caller-key-lookup.mjs --self-test  red and green case per pattern
//   node chaingraph/kernels/lint-caller-key-lookup.mjs --write-baseline

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const KERNELS_DIR = HERE;
const BASELINE_PATH = resolve(REPO, 'scripts', 'caller-key-lookup-baseline.json');
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

// Blank comments and mask string/template contents, preserving offsets and newlines.
// Returns { code } (comments blanked, strings intact) and { masked } (strings also masked).
function prepare(src) {
  let code = '';
  let masked = '';
  const n = src.length;
  let i = 0;
  const push = (c, m) => { code += c; masked += m; };
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') { push(' ', ' '); i++; }
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        const keep = src[i] === '\n' ? '\n' : ' ';
        push(keep, keep); i++;
      }
      if (i < n) { push(' ', ' '); push(' ', ' '); i += 2; }
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c;
      push(c, c); i++;
      while (i < n && src[i] !== q) {
        if (src[i] === '\\' && i + 1 < n) { push(src[i], 'x'); i++; }
        const ch = src[i];
        push(ch, ch === '\n' ? '\n' : 'x');
        i++;
      }
      if (i < n) { push(q, q); i++; }
      continue;
    }
    push(c, c); i++;
  }
  return { code, masked };
}

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

// Names bound to a plain object literal: const X = {...} or const X = Object.freeze({...}).
function plainObjectNames(masked) {
  const names = new Set();
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:Object\.freeze\(\s*)?\{/g;
  let m;
  while ((m = re.exec(masked))) names.add(m[1]);
  return names;
}

function isOwnGuarded(masked, name) {
  const esc = name.replace(/\$/g, '\\$');
  return new RegExp(`Object\\.hasOwn\\(\\s*${esc}\\b|hasOwnProperty\\.call\\(\\s*${esc}\\b|\\b${esc}\\.hasOwnProperty\\(`).test(masked);
}

const LOOP_VARS = new Set(['i', 'j', 'k', 'n', 'm', 'idx', 'index', 'ix', 'len']);

function isCallerDerivedExpr(expr) {
  const e = expr.trim();
  if (!e) return false;
  if (/^['"`]/.test(e)) return false;          // string literal key
  if (/^-?\d/.test(e)) return false;           // numeric literal
  if (/^[\d\s+\-*/%()]+$/.test(e)) return false;
  if (LOOP_VARS.has(e)) return false;
  return /[A-Za-z_$]/.test(e);
}

export function findCallerKeyLookups(src) {
  const { code, masked } = prepare(src);
  const hits = [];
  const objs = plainObjectNames(masked);
  const flaggedA = new Set();
  const lines = masked.split('\n');

  // A and B: computed access on a plain object literal.
  for (const name of objs) {
    const esc = name.replace(/\$/g, '\\$');
    const re = new RegExp(`(?<![\\w$.])${esc}\\[([^\\]\\n]+)\\]`, 'g');
    let m;
    while ((m = re.exec(masked))) {
      if (!isCallerDerivedExpr(m[1])) continue;
      const line = lineOf(masked, m.index);
      const text = lines[line - 1];
      const ownOnLine = new RegExp(`Object\\.hasOwn\\(\\s*${esc}\\b|hasOwnProperty\\.call\\(\\s*${esc}\\b`).test(text);
      const before = text.slice(0, m.index - masked.lastIndexOf('\n', m.index - 1) - 1);
      const after = text.slice(before.length + m[0].length);
      const truthy = /!\s*$/.test(before) || /^\s*(\?|&&|\|\|)/.test(after) || /(\bif|\bwhile|&&|\|\|)\s*\(?\s*$/.test(before);
      if (truthy && !ownOnLine) {
        hits.push({ pattern: 'B', line, token: m[0], note: 'enum validated by truthiness of a plain-object lookup' });
        continue;
      }
      if (!isOwnGuarded(masked, name)) {
        const key = `${line}:${m.index}`;
        if (!flaggedA.has(key)) {
          flaggedA.add(key);
          hits.push({ pattern: 'A', line, token: m[0], note: 'caller-derived key into an unguarded plain object' });
        }
      }
    }
  }

  // C: string helper coercing with String(param) before an emptiness test, no typeof check.
  const fnRes = [
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g,
    /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\{/g,
  ];
  for (const re of fnRes) {
    let m;
    while ((m = re.exec(masked))) {
      const open = m.index + m[0].length - 1;
      let depth = 0; let end = open;
      for (let i = open; i < masked.length; i++) {
        if (masked[i] === '{') depth++;
        else if (masked[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      const bodyMasked = masked.slice(open, end + 1);
      const bodyCode = code.slice(open, end + 1);
      const params = m[2].split(',').map((p) => p.trim().replace(/=.*$/, '').trim()).filter((p) => /^[A-Za-z_$][\w$]*$/.test(p));
      for (const p of params) {
        const pe = p.replace(/\$/g, '\\$');
        if (!new RegExp(`\\bString\\(\\s*${pe}\\s*\\)`).test(bodyMasked)) continue;
        const empt = /\.trim\(\)|===\s*(''|"")|\.length\b/.test(bodyCode);
        const typed = new RegExp(`typeof\\s+${pe}\\s*(?:===|!==|==|!=)\\s*['"]string['"]`).test(bodyCode);
        if (empt && !typed) {
          hits.push({ pattern: 'C', line: lineOf(masked, m.index), token: `${m[1]}(${p})`, note: 'String() coercion before emptiness test without typeof check' });
        }
      }
    }
  }
  return hits.sort((a, b) => a.line - b.line);
}

const countBy = (hits) => {
  const c = { A: 0, B: 0, C: 0 };
  for (const h of hits) c[h.pattern]++;
  return c;
};
const total = (c) => c.A + c.B + c.C;

// ---- self-test: one red and one green case per pattern (GATE-SELFTEST-META-1) ----
const CASES = [
  { name: 'A red: unguarded TABLE[caller key]', pattern: 'A', red: true,
    src: "const FUND_FROM = { reserve: 1 };\nfunction compute(pp) { const f = FUND_FROM[pp.funded_from]; return f; }\n" },
  { name: 'A green: guarded by Object.hasOwn', pattern: 'A', red: false,
    src: "const FUND_FROM = { reserve: 1 };\nfunction compute(pp) { const f = Object.hasOwn(FUND_FROM, pp.k) ? FUND_FROM[pp.k] : null; return f; }\n" },
  { name: 'A green: Map and Object.create(null) are not plain literals', pattern: 'A', red: false,
    src: "const T = new Map([['a', 1]]);\nconst U = Object.create(null);\nfunction compute(pp) { return [T.get(pp.k), U[pp.k]]; }\n" },
  { name: 'B red: enum check by truthiness', pattern: 'B', red: true,
    src: "const ALLOWED = { yes: true, no: true };\nfunction compute(pp) { if (!ALLOWED[pp.answer]) return null; return 1; }\n" },
  { name: 'B green: own-key test on the same line', pattern: 'B', red: false,
    src: "const ALLOWED = { yes: true, no: true };\nfunction compute(pp) { if (!Object.hasOwn(ALLOWED, pp.answer) || !ALLOWED[pp.answer]) return null; return 1; }\n" },
  { name: 'C red: String(v) before trim test, no typeof', pattern: 'C', red: true,
    src: "function str(v) { const s = String(v); return s.trim() === '' ? null : s; }\n" },
  { name: 'C green: typeof string check first', pattern: 'C', red: false,
    src: "function str(v) { if (typeof v !== 'string') return null; const s = String(v); return s.trim() === '' ? null : s; }\n" },
  { name: 'comment and string mentions never trip', pattern: 'A', red: false,
    src: "const T = { a: 1 };\n// T[pp.x] in a comment\nconst s = 'T[pp.x]';\nfunction compute(pp) { return T.a; }\n" },
];

export function runSelfTest() {
  let bad = 0;
  for (const c of CASES) {
    const got = findCallerKeyLookups(c.src).filter((h) => h.pattern === c.pattern).length;
    const ok = c.red ? got > 0 : got === 0;
    console.log(`${ok ? '✓' : '✗'} ${c.name}${ok ? '' : ` (hits=${got})`}`);
    if (!ok) bad++;
  }
  return bad;
}

function scanFleet() {
  const out = {};
  for (const f of readdirSync(KERNELS_DIR).filter((x) => x.endsWith('.kernel.mjs')).sort()) {
    const id = f.replace(/\.kernel\.mjs$/, '');
    const hits = findCallerKeyLookups(readFileSync(resolve(KERNELS_DIR, f), 'utf8'));
    out[id] = { hits, counts: countBy(hits) };
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) {
    const bad = runSelfTest();
    console.log(bad ? `✗ lint-caller-key-lookup self-test: ${bad} case(s) wrong` : `✓ lint-caller-key-lookup self-test: ${CASES.length} cases (red and green per pattern)`);
    process.exit(bad ? 1 : 0);
  }
  const fleet = scanFleet();
  if (argv.includes('--write-baseline')) {
    const kernels = {};
    for (const [id, r] of Object.entries(fleet)) if (total(r.counts)) kernels[id] = r.counts;
    writeFileSync(BASELINE_PATH, JSON.stringify({ note: 'KERNEL-CALLER-KEY-LOOKUP-LINT-1: per-kernel hit counts for existing kernels; counts only go down; a kernel absent here must be clean', kernels }, null, 2) + '\n');
    console.log(`wrote baseline: ${Object.keys(kernels).length} kernels with hits`);
    process.exit(0);
  }
  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).kernels : {};
  const oi = argv.indexOf('--only');
  const only = oi !== -1 ? argv[oi + 1] : null;
  if (only && !fleet[only]) { console.error(`✗ no kernel ${only}`); process.exit(2); }
  let blocking = 0; let warn = 0; let sum = 0; let kernelsWithHits = 0;
  for (const [id, r] of Object.entries(fleet)) {
    if (only && id !== only) continue;
    const t = total(r.counts);
    if (!t) continue;
    sum += t; kernelsWithHits++;
    const base = baseline[id];
    if (!base) {
      blocking++;
      console.log(`✗ ${id}: ${t} caller-key lookup hit(s) in a kernel with no baseline entry (new kernels must be clean)`);
      for (const h of r.hits) console.log(`    line ${h.line} [${h.pattern}] ${h.token}: ${h.note}`);
    } else if (total(r.counts) > total(base) || r.counts.A > base.A || r.counts.B > base.B || r.counts.C > base.C) {
      warn++;
      console.log(`! ADVISORY ${id}: hits ${JSON.stringify(r.counts)} exceed baseline ${JSON.stringify(base)}`);
    }
  }
  const stale = Object.keys(baseline).filter((id) => !fleet[id]);
  console.log(`${blocking ? '✗' : '✓'} caller-key lookup: ${sum} hit(s) in ${kernelsWithHits} kernel(s); ${blocking} blocking (new), ${warn} advisory (existing above baseline)${stale.length ? `; ${stale.length} baseline entr${stale.length === 1 ? 'y' : 'ies'} for removed kernels` : ''}`);
  process.exit(blocking ? 1 : 0);
}

if (IS_MAIN) main();
