// @ts-nocheck — plain CLI utility script, never meant to be type-checked; only
// swept into tsc --checkJs's program because it lives under chaingraph/kernels/
// and this edit makes it "touched" (JSDOC-CHECKJS-PREFLIGHT-1's own path filter,
// landed 2026-08-16, watches the whole directory, not just *.kernel.mjs). Without
// this it fails on bare node:fs/process usage — a directory-wide @types/node gap
// (SO #47's exemption only reaches chaingraph/kernels/__proptests__/), same as
// vm-parity-gate.mjs's header note.
// lint-cgcanon-twin.mjs — cgCanon TWIN-PARITY GATE (SPECGATE-HYGIENE-1, 2026-09-01; audit
// HASH-3 from research/AUDIT-PUBLIC-FULLSWEEP-2026-09-01.md).
//
// THE CLAIM GATED: §18 zkVM guests cannot import, so the kernels below carry a deliberate
// inline copy ("twin") of the canonicalizer instead of importing `chaingraph/kernels/_hash.mjs`:
//
//     const _cgCanon = (v) => Array.isArray(v) ? v.map(_cgCanon) : ... : v;
//
// The twin's byte/semantic identity with the single source of truth (`_hash.mjs` cgCanon) was
// VOWED at each inline site but had NO mechanical gate — a future edit to any copy would drift
// silently (the consistent-but-wrong class). This gate closes that:
//
//   1. DISCOVER every kernel carrying an inline `_cgCanon` DECLARATION, from disk (SO #34
//      independent derivation — no pinned list; a 13th twin added tomorrow is covered
//      automatically).
//   2. EXECUTE the twin and the canonical cgCanon over the same canon-stressing fixture set
//      (nested arrays-of-objects, unicode/surrogate code-point key sorts, the ECMAScript
//      Number->String productions, key-order and escaping traps) and compare the JSON outputs
//      BYTE-FOR-BYTE.
//
// SECURITY RIDER (SO #34): the twin is artifact text — ⛔ never eval'd/imported into the GATE
// process. Each twin runs in a THROWAWAY CHILD node process fed its source on stdin
// (`--input-type=module`); the child has no network, no repo writes, and its only output is one
// marked stdout line. The canonical reference side imports `_hash.mjs` (first-party SSOT) in the
// gate process — the gate never validates the artifact's claim ABOUT ITSELF; it recomputes both
// sides over shared fixtures.
//
// READ-SIDE ONLY: zero kernel bytes are edited by this gate. The red-then-green mutation
// controls (SO #34c) live in `lint-cgcanon-twin.test.mjs` and mutate an extracted twin IN MEMORY.
//
// AUDIT LINKAGE: the full-sweep audit vowed the twin set {art-191/192/193/194/199/200/206/336/
// 476/501/502/609}. art-501's mention is COMMENT-ONLY (it inlines `_hagate.mjs` twins, a
// different module, out of this gate's scope) — reported below as an informational delta, never
// silently dropped. Discovery remains the enforcement surface.
//
// Zero-dependency. Wired into scripts/preflight.mjs next to lint-forbidden-hash.
// Usage:
//   node chaingraph/kernels/lint-cgcanon-twin.mjs            exit 1 on any twin drift

import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cgCanon } from './_hash.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// The twin declaration the gate looks for. All current twins are `const _cgCanon = <expr>;`
// (arrow or function-expression form, single- or multi-line); the scanner below extracts
// <expr> with string/comment-aware bracket balancing.
const TWIN_NAME = '_cgCanon';

// The audit's vowed twin set (research/AUDIT-PUBLIC-FULLSWEEP-2026-09-01.md HASH-3), quoted for
// the informational delta report only — enforcement is DISCOVERY, never this list.
const AUDIT_VOWED = [
  'art-191', 'art-192', 'art-193', 'art-194', 'art-199', 'art-200',
  'art-206', 'art-336', 'art-476', 'art-501', 'art-502', 'art-609',
];

// Canon-stressing fixtures (SPECGATE-HYGIENE-1): each targets a way a "consistent-but-wrong"
// copy could drift while still looking right on trivial input.
//   - { b: 1, a: 2 }                          — the key-order trap (a constant-digest twin that
//                                               skips .sort() differs here byte-for-byte)
//   - { b:1, a:{d:[3,1,2],c:null}, A:'z' }    — art-476's own embedded self-check shape
//   - nested arrays-of-objects                — recursion depth + array-order preservation
//   - unicode keys (BMP + astral surrogate)   — code-unit sort parity incl. surrogate pairs
//   - number productions                      — 1e21/1e-7/-0/subnormal/max: the ECMAScript
//                                               Number->String production both sides inherit
//   - escaping / empty containers / bare top-level scalars — edge shapes
const FIXTURES = Object.freeze([
  { b: 1, a: 2 },
  { b: 1, a: { d: [3, 1, 2], c: null }, A: 'z' },
  { list: [{ z: 1, a: { y: [[{ k: 'v' }]] } }, { m: null, b: true }], n: 0 },
  { 'Ω': 1, 'é': 2, '中': 3, 'a': 4, 'Z': 5, '_': 6, 'z': 7 },
  { 'π': 'π', '😀': '😀', 'ä': 'ä' },
  { num: [0, -0, 0.1, 1e21, 1e-7, 5e-324, 1.7976931348623157e308, 9007199254740991, -1.5e300, 123456789.123456] },
  { e: {}, empty: [], nil: null, t: true, f: false, s: 'quote"and\'mix\\slash', uni: 'naïve—café' },
  [[[[['deep']]]]],
  {}, [], '', 0, null, true,
]);

// ── Extraction ──────────────────────────────────────────────────────────────────────────────
// Skips '…' / "…" / `…` literals (with ${…} nesting) and // / /* */ comments; tracks
// ( ) [ ] { } depth; the declaration ends at the first `;` at depth 0. Returns the initializer
// EXPRESSION text (everything between `=` and the terminating `;`), or null when the source has
// no `_cgCanon` declaration (comment mentions don't match the declaration shape).
export function extractCgCanon(source) {
  const m = source.match(/(?:const|let|var)\s+_cgCanon\s*=/);
  if (!m) return null;
  let i = m.index + m[0].length;
  const n = source.length;
  let depth = 0;
  while (i < n) {
    const c = source[i];
    if (c === "'" || c === '"' || c === '`') { i = skipStringLike(source, i); continue; }
    if (c === '/' && source[i + 1] === '/') { const e = source.indexOf('\n', i); i = e < 0 ? n : e; continue; }
    if (c === '/' && source[i + 1] === '*') { const e = source.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ';' && depth === 0) return source.slice(m.index + m[0].length, i).trim();
    i++;
  }
  throw new Error(`${TWIN_NAME} declaration never terminates (unbalanced source?)`);
}

function skipStringLike(src, start) {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (quote === '`' && c === '$' && src[i + 1] === '{') { // template ${ … } — balance braces
      let d = 1; i += 2;
      while (i < src.length && d > 0) {
        if (src[i] === '{') d++;
        else if (src[i] === '}') d--;
        else if (src[i] === "'" || src[i] === '"' || src[i] === '`') { i = skipStringLike(src, i); continue; }
        i++;
      }
      continue;
    }
    if (c === quote) return i + 1;
    i++;
  }
  throw new Error('unterminated string literal while scanning twin');
}

// ── Discovery ───────────────────────────────────────────────────────────────────────────────
export function discoverTwins() {
  const twins = [];
  for (const f of readdirSync(HERE).sort()) {
    if (!f.endsWith('.kernel.mjs')) continue;
    const src = readFileSync(join(HERE, f), 'utf8');
    const expr = extractCgCanon(src);
    if (expr) twins.push({ file: f, expr });
  }
  return twins;
}

// ── Execution + comparison ──────────────────────────────────────────────────────────────────
// Canonical reference side: cgCanon over the shared fixtures, IN the gate process (first-party
// SSOT import). Returns the byte-exact JSON string per fixture.
export function expectedOutputs() {
  return FIXTURES.map((f) => JSON.stringify(cgCanon(f)));
}

// Twin side: a throwaway CHILD node process (source via stdin, `--input-type=module`) — the
// artifact text never executes inside the gate process (SO #34 security rider).
function twinOutputsViaChild(expr) {
  const childSource = [
    `const FIXTURES = ${JSON.stringify(FIXTURES)};`,
    `const _cgCanon = ${expr};`,
    'const outs = FIXTURES.map((f) => JSON.stringify(_cgCanon(f)));',
    'console.log("__CGCANON_TWIN__" + JSON.stringify(outs));',
    '',
  ].join('\n');
  const r = spawnSync(process.execPath, ['--input-type=module'], {
    input: childSource, encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024,
  });
  if (r.error) throw new Error(`child failed to launch: ${r.error.message}`);
  if (r.status !== 0) {
    throw new Error(`twin child exited ${r.status}: ${(r.stderr || r.stdout || '').trim().slice(-400)}`);
  }
  const line = (r.stdout || '').split('\n').find((l) => l.startsWith('__CGCANON_TWIN__'));
  if (!line) throw new Error(`twin child produced no result line (stdout head: ${(r.stdout || '').slice(0, 200)})`);
  return JSON.parse(line.slice('__CGCANON_TWIN__'.length));
}

// Full comparison for one twin expression. Returns { ok, detail } — detail names the first
// differing fixture index with both byte strings truncated for the report.
export function runTwinComparison(expr) {
  let twinOuts;
  try { twinOuts = twinOutputsViaChild(expr); }
  catch (e) { return { ok: false, detail: `twin could not execute: ${e.message}` }; }
  const expected = expectedOutputs();
  if (!Array.isArray(twinOuts) || twinOuts.length !== expected.length) {
    return { ok: false, detail: `twin returned ${Array.isArray(twinOuts) ? twinOuts.length : 'non-array'} outputs, expected ${expected.length}` };
  }
  for (let i = 0; i < expected.length; i++) {
    if (twinOuts[i] !== expected[i]) {
      return {
        ok: false,
        detail: `BYTE DRIFT at fixture ${i} (${JSON.stringify(FIXTURES[i]).slice(0, 80)}): twin=${JSON.stringify(twinOuts[i]).slice(0, 160)} vs cgCanon=${JSON.stringify(expected[i]).slice(0, 160)}`,
      };
    }
  }
  return { ok: true, detail: `${expected.length}/${expected.length} fixtures byte-identical` };
}

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────
function main() {  const twins = discoverTwins();
  console.log(`cgCanon twin-parity · ${twins.length} inline twin(s) discovered on disk\n`);
  if (twins.length === 0) {
    console.error('✗ no inline _cgCanon twin found — discovery is broken or the twins were removed; either way this gate must not pass silently');
    process.exitCode = 1;
    return;
  }

  // Informational delta vs the audit's vowed set (discovery is the enforcement surface; this
  // only keeps the audit linkage visible — art-501 is comment-only, its inlined twins are
  // _hagate.mjs twins, a different module out of scope here).
  const vowedMissing = AUDIT_VOWED.filter((id) => !twins.some((t) => t.file.startsWith(id)));
  if (vowedMissing.length) {
    console.log(`ℹ audit-vowed set delta (informational): ${vowedMissing.join(', ')} carry no inline _cgCanon declaration on disk`);
  }

  let errs = 0;
  for (const { file, expr } of twins) {
    const { ok, detail } = runTwinComparison(expr);
    if (ok) console.log(`✓ ${file}  (${detail})`);
    else { console.error(`✗ ${file}  (${detail})`); errs++; }
  }

  console.log();
  console.log(errs
    ? `✗ ${errs} cgCanon twin drift(s) — an inline canonicalizer diverged from _hash.mjs; fix the twin or re-inline from the SSOT`
    : `✓ every inline _cgCanon twin is byte-for-byte semantically identical to _hash.mjs cgCanon over ${FIXTURES.length} canon-stressing fixtures`);
  process.exitCode = errs ? 1 : 0;
}

// Run as CLI unless imported (the selftest imports the exports; standard pathToFileURL idiom,
// Windows-shape safe).
const IS_MAIN = (() => {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch { return false; }
})();
if (IS_MAIN) main();

export { FIXTURES as canonicalFixtures };
