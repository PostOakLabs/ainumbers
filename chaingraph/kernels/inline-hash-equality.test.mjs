// AUD-C3-2 gate — inline executionHashLocal ≡ _hash.mjs::executionHash.
// Run:  node chaingraph/kernels/inline-hash-equality.test.mjs
// Exits non-zero on any divergence (CI gate; wired into scripts/preflight.mjs).
//
// WHY: ~43 per-artifact HTML files (chaingraph/art-1xx.html, kernel-vm.html,
// tools/kernel-vm-widget.html) each carry an INLINE `executionHashLocal(pp, op)`
// copy of the canonical `executionHash` in chaingraph/kernels/_hash.mjs — the
// browser tool has no module loader, so the canonicalizer is inlined at author
// time. A silent byte-drift in any inline copy would make that tool emit an
// execution_hash the Worker/verifier would reject (or worse, silently disagree).
// This gate pins every inline copy to the single source of truth forever:
// AUD-C3 proved them byte-identical on valid I-JSON vectors; this keeps them so.
//
// SELF-PROVING: on every run the gate also feeds a DELIBERATELY-DIVERGED inline
// snippet through the SAME comparator and asserts it is flagged. If extraction
// ever silently returns nothing (comparator goes blind), the self-check fails —
// so a green result can never be a false negative.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { executionHash } from './_hash.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..'); // chaingraph/kernels -> repo/

// ── extract a top-level function definition by brace matching ─────────────────
function extractFn(src, sigRe) {
  const m = src.match(sigRe);
  if (!m) return null;
  let i = src.indexOf('{', m.index);
  if (i < 0) return null;
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}

// Build the inline hasher from an HTML file's own cgCanon + executionHashLocal.
// Returns an async (pp, op) => hex, or null when the file has no inline copy.
function buildInlineHasher(html) {
  const cg = extractFn(html, /function\s+cgCanon\s*\(/);
  const ai = extractFn(html, /function\s+assertIJson\s*\(/);
  const eh = extractFn(html, /async\s+function\s+executionHashLocal\s*\(/);
  if (!eh) return null;              // no inline copy in this file
  // executionHashLocal may reference assertIJson (the I-JSON guard matching _hash.mjs) and/or
  // cgCanon; include whichever helpers the file defines so the extracted fn resolves standalone.
  const body = `${cg || ''}\n${ai || ''}\n${eh}\nreturn executionHashLocal;`;
  return new Function(body)();       // eslint-disable-line no-new-func
}

// ── shared bakeoff vectors (valid I-JSON: numbers, strings, arrays, nesting, unicode) ──
const VECTORS = [
  [{}, {}],
  [{ b: 1, a: 2 }, { z: [3, 2, 1], y: 'x' }],
  [{ nested: { d: 4, c: { e: 5, a: 1 } } }, { arr: [{ q: 1, p: 2 }], flag: true }],
  [{ unicode: 'café', 'ключ': 9 }, { neg: -3.5, zero: 0, big: 9007199254740991 }],
  [{ mixed: [1, 'two', null, false, { k: 'v' }] }, { empty: [], nul: null }],
  [{ verdict: 'CONFORMANT', draws: [1.25, 2.5, 3.75] }, { total: 7.5, ok: true }],
];

async function compareHasher(hasher, label) {
  const rows = [];
  for (const [pp, op] of VECTORS) {
    const inline = await hasher(pp, op);
    const canon = await executionHash(pp, op);
    if (inline !== canon) rows.push({ label, pp, inline, canon });
  }
  return rows;
}

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

console.log('— AUD-C3-2: inline executionHashLocal ≡ _hash.mjs::executionHash —\n');

// ── 1. enumerate every canonical file that carries an inline copy ─────────────
const targets = [];
const cgDir = join(REPO, 'chaingraph');
for (const f of readdirSync(cgDir)) {
  if (/^art-1\d\d[-.].*\.html$/.test(f)) targets.push(join('chaingraph', f));
}
targets.push(join('chaingraph', 'kernel-vm.html'));
// NOTE: tools/kernel-vm-widget.html is deliberately NOT gated here. It is a FLATTENED single-file
// bundle of the whole chaingraph/vm/*.mjs graph (VM-1b), so it carries TWO cgCanon/executionHash
// copies — the VM-side one from kernel-vm.mjs's determinism prelude AND the page's own native-side
// executionHashLocal — and this gate's single-copy extraction can't disambiguate them. Its
// native-side hash helper is generated from the SAME template as chaingraph/kernel-vm.html (gated
// above), and its VM-vs-native execution_hash agreement is already proven byte-for-byte by
// chaingraph/kernels/vm-parity-gate.mjs (619/619). Gating the flattened bundle here adds no
// coverage and only mis-extracts. See chaingraph/vm/scripts/gen-kernel-vm-widget.mjs.

let withInline = 0, comparisons = 0;
const allMismatches = [];
for (const rel of targets) {
  let html;
  try { html = readFileSync(join(REPO, rel), 'utf8'); } catch { continue; }
  const hasher = buildInlineHasher(html);
  if (!hasher) continue;
  withInline++;
  const rows = await compareHasher(hasher, rel);
  comparisons += VECTORS.length;
  if (rows.length) allMismatches.push(...rows);
}

// Guard against extraction going blind (0 files -> vacuously green).
ok(withInline >= 40, `inline copies located: ${withInline} (expected ≥ 40)`);
ok(allMismatches.length === 0, `${comparisons} vector comparisons across ${withInline} files, ${allMismatches.length} mismatches`);
if (allMismatches.length) {
  for (const m of allMismatches.slice(0, 8)) {
    console.log(`     DRIFT ${m.label}: inline=${m.inline.slice(0, 16)}… canon=${m.canon.slice(0, 16)}…`);
  }
}

// ── 2. self-proving: a deliberately-diverged inline copy MUST be flagged ──────
// This copy drops the recursive key-sort (canon bug) — so its hash differs from
// canonical on any multi-key object. If the comparator fails to catch it, the
// gate is blind and this check fails, forbidding a false-negative green.
const DIVERGED_HTML = `
  function cgCanon(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(cgCanon);
    const out = {};
    for (const k of Object.keys(v)) out[k] = cgCanon(v[k]); // BUG: no .sort()
    return out;
  }
  async function executionHashLocal(pp, outputPayload) {
    const obj = cgCanon({ policy_parameters: pp, output_payload: outputPayload });
    const s = JSON.stringify(obj);
    const buf = new TextEncoder().encode(s);
    const dig = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(dig)).map(b => b.toString(16).padStart(2,'0')).join('');
  }`;
const divergedHasher = buildInlineHasher(DIVERGED_HTML);
const divergedRows = divergedHasher ? await compareHasher(divergedHasher, '<diverged-fixture>') : [];
ok(divergedHasher !== null, 'self-test: diverged fixture is extractable');
ok(divergedRows.length > 0, `self-test: comparator flags the diverged fixture (${divergedRows.length} mismatches caught)`);

console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
