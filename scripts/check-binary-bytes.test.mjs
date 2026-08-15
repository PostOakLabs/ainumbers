#!/usr/bin/env node
/**
 * scripts/check-binary-bytes.test.mjs — fixture proof for BINARY-BYTE-GATE-1.
 *
 * A gate never seen red is not a gate (SO #34c). This file is the control:
 * every claim check-binary-bytes.mjs makes is exercised against an in-memory
 * fixture, positive and negative, plus a mutation control on the allowlist
 * ratchet itself.
 *
 * What it proves:
 *   1. POSITIVE — a NUL inside a JS string literal (the exact shape
 *      DISE-SEG-T-2 shipped in tools/582) is detected, with the right byte
 *      offset, line and column.
 *   2. POSITIVE — the other stray-control shapes: a raw 0x08 where a `\b`
 *      regex anchor lost its backslash (the tools/56 finding), VT, FF, ESC,
 *      DEL, and a WTF-8 lone surrogate.
 *   3. NEGATIVE, and the one that matters most — LEGITIMATE NON-ASCII IS NOT
 *      REJECTED. Real emoji, em-dashes, curly quotes, ellipses, CJK, RTL
 *      marks, combining accents and astral-plane codepoints all read clean.
 *      A gate that reds on `—` or `✅` is worse than no gate.
 *   4. NEGATIVE — TAB, LF and CR read clean; CRLF line endings read clean.
 *   5. RATCHET — allowlist behaviour: a shielded byte within cap passes, one
 *      over cap fails, an unlisted byte value in a listed file fails, an
 *      unlisted file with any hit fails, and an entry with no written
 *      `reason` fails on that ground alone.
 *   6. MUTATION — flip one thing at a time and require the verdict to move
 *      (verify a checker by mutation, not by reading it: SO #34).
 *   7. The live allowlist on disk is well-formed: every entry carries a
 *      non-empty reason and a bytes object.
 *
 * Every fixture builds its control bytes at runtime, via String.fromCharCode()
 * or Buffer.from([...]), and never as a raw byte in this source — so this test
 * file is itself clean under the gate it tests. (Writing the escape sequence
 * for NUL into this very comment is what put a raw NUL in this file during
 * authoring, and the gate caught it: the failure class is that easy to hit.)
 *
 * Usage: node scripts/check-binary-bytes.test.mjs
 * Exit 0 = all assertions passed. Exit 1 = a fixture assertion failed.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanBuffer, evaluate, isDisallowedByte, scannedFiles, SURROGATE_KEY, EXCLUDED_FILES } from './check-binary-bytes.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log(`✓ ${msg}`); }
  else { failures++; console.log(`✗ ${msg}`); }
}
const buf = (s) => Buffer.from(s, 'utf8');
const NUL = String.fromCharCode(0);

// ── 1. POSITIVE: the proven shape — a NUL inside a JS string literal ───────
// Reconstructs what DISE-SEG-T-2 landed in tools/582: a NUL adjacent to a
// string delimiter, which parses as valid JS and passes check_tools.js.
const nulFixture =
  '<!doctype html>\n' +
  '<script>\n' +
  `  const label = '${NUL}Coverage';\n` +
  '</script>\n';
const nulHits = scanBuffer(buf(nulFixture));
assert(nulHits.length === 1, 'NUL inside a JS string literal is detected (1 hit)');
assert(nulHits[0].key === '0x00' && nulHits[0].label.startsWith('0x00 NUL'), 'the hit is reported as 0x00 NUL');
assert(nulHits[0].line === 3, `the hit names the right line (got ${nulHits[0].line}, expected 3)`);
assert(nulHits[0].column === 18, `the hit names the right column (got ${nulHits[0].column}, expected 18)`);
assert(nulHits[0].offset === nulFixture.indexOf(NUL), `the hit names the right byte offset (got ${nulHits[0].offset}, expected ${nulFixture.indexOf(NUL)})`);
assert(!nulHits[0].context.includes(NUL) && nulHits[0].context.includes('«0x00»'), 'the printed context ESCAPES the control byte rather than emitting it (a report that is itself binary is the bug this gate exists to catch)');

// ── 2. POSITIVE: the other stray-control shapes ───────────────────────────
// The tools/56 finding: a `\b` regex word-boundary anchor whose backslash was
// lost, leaving a raw backspace that silently kills the anchor.
const bsFixture = `check: c => !/"chainId"\\s*:\\s*(1|137|56)${String.fromCharCode(8)}/.test(c),\n`;
const bsHits = scanBuffer(buf(bsFixture));
assert(bsHits.length === 1 && bsHits[0].key === '0x08', 'raw 0x08 (a `\\b` anchor that lost its backslash) is detected');
assert(bsHits[0].label.includes('backslash'), 'the 0x08 report names the likely cause (a lost backslash), so the reader knows what to fix');

for (const [code, name] of [[0x0b, 'VT'], [0x0c, 'FF'], [0x1b, 'ESC'], [0x7f, 'DEL'], [0x01, 'SOH'], [0x1a, 'SUB']]) {
  const hits = scanBuffer(buf(`before${String.fromCharCode(code)}after`));
  assert(hits.length === 1 && hits[0].byte === code, `${name} (0x${code.toString(16).padStart(2, '0')}) is detected`);
}

// WTF-8 lone surrogate: ED A0 80 encodes U+D800, which well-formed UTF-8
// never emits. Built as raw bytes because no JS string can hold it after a
// utf8 round-trip — which is exactly why the gate reads bytes, not strings.
const surrogate = Buffer.concat([buf('ok '), Buffer.from([0xed, 0xa0, 0x80]), buf(' ok')]);
const surrHits = scanBuffer(surrogate);
assert(surrHits.length === 1 && surrHits[0].key === SURROGATE_KEY, 'a WTF-8 lone surrogate (ED A0 80) is detected');

// A well-formed 3-byte UTF-8 sequence that also starts with 0xED must NOT trip
// the surrogate check — U+D7FF (ED 9F BF) is legal and sits just below the range.
assert(scanBuffer(Buffer.from([0xed, 0x9f, 0xbf])).length === 0, 'U+D7FF (ED 9F BF), the legal codepoint just below the surrogate block, is NOT flagged');

// ── 3. NEGATIVE: legitimate non-ASCII is never rejected ───────────────────
// This is the assertion the row cares about most: "a gate that reds on — or ✅
// is worse than no gate." Correctness is structural — every byte of a
// multi-byte UTF-8 sequence is >= 0x80 — but structure is a claim, so prove it.
const legitimate = [
  ['em-dash and en-dash', 'ranges 2020–2024 — and an aside'],
  ['typographic quotes and ellipsis', '“quoted” and ‘single’ and … an ellipsis, plus a curly apostrophe: don’t'],
  ['functional UI emoji', '✅ PASS · ❌ FAIL · ⚠️ WARN · 🔒 All inputs are processed locally'],
  ['astral-plane emoji', '🚀 📊 🧩 👨‍👩‍👧‍👦 🇬🇧 🏳️‍🌈'],
  ['board-row glyphs', '⛔⛔ ⚠ ⭐ ⇒ ✓ ◐ ⧗ ⏸ ⊙ ☐'],
  ['CJK and Cyrillic', '日本語 中文 한국어 Русский'],
  ['RTL and bidi text', 'العربية עברית'],
  ['combining accents and symbols', 'café naïve résumé € £ ¥ ½ × ÷ ° µ'],
  ['currency and math in tool copy', 'APRC ≤ 3.5% ± 0.1 → €1 234,56'],
];
for (const [label, text] of legitimate) {
  const hits = scanBuffer(buf(text));
  assert(hits.length === 0, `NOT rejected: ${label}`);
}
// Byte-level restatement of the same claim: no UTF-8 continuation or lead byte
// can ever satisfy isDisallowedByte, for any byte value at all.
let anyHighByteDisallowed = false;
for (let b = 0x80; b <= 0xff; b++) if (isDisallowedByte(b)) anyHighByteDisallowed = true;
assert(!anyHighByteDisallowed, 'no byte >= 0x80 is disallowed — a multi-byte UTF-8 sequence cannot trip this gate for ANY codepoint');

// The CONTRACT §1.3 PII banner, verbatim, is clean (it carries an em-dash and a
// lock emoji and appears on every one of ~544 tool pages).
assert(scanBuffer(buf('🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.')).length === 0, 'NOT rejected: the CONTRACT §1.3 PII banner verbatim (em-dash + lock emoji, on every tool page)');

// ── 4. NEGATIVE: the three legal control bytes ────────────────────────────
assert(scanBuffer(buf('a\tb\nc\r\nd\n')).length === 0, 'NOT rejected: TAB, LF, CR, and CRLF line endings');
assert(scanBuffer(buf('')).length === 0, 'NOT rejected: an empty file');

// Line/column accounting survives CRLF and tabs.
const multi = 'l1\r\n\tl2\r\n' + NUL + 'l3\r\n';
const mh = scanBuffer(buf(multi));
assert(mh.length === 1 && mh[0].line === 3 && mh[0].column === 1, `line/column accounting is correct across CRLF and tabs (got line ${mh[0]?.line} col ${mh[0]?.column}, expected 3/1)`);

// ── 5. RATCHET: allowlist behaviour ───────────────────────────────────────
const hit = (key, n = 1) => Array.from({ length: n }, (_, i) => ({ key, label: `${key} FIXTURE`, offset: i, line: 1, column: i + 1, context: 'x' }));

{
  const { failures: f } = evaluate({ 'tools/x.html': hit('0x00', 2) }, { 'tools/x.html': { reason: 'deliberate', bytes: { '0x00': 2 } } });
  assert(f.length === 0, 'ratchet: a shielded byte AT its cap passes');
}
{
  const { failures: f } = evaluate({ 'tools/x.html': hit('0x00', 3) }, { 'tools/x.html': { reason: 'deliberate', bytes: { '0x00': 2 } } });
  assert(f.length === 1, 'ratchet: one byte OVER the cap fails (the counts-only-go-down property)');
  assert(f[0].includes('allowed 2') && f[0].includes('3 ×'), 'the over-cap failure quotes both the found count and the cap');
}
{
  const { improvements } = evaluate({ 'tools/x.html': hit('0x00', 1) }, { 'tools/x.html': { reason: 'deliberate', bytes: { '0x00': 2 } } });
  assert(improvements.some((i) => i.includes('2 -> 1')), 'ratchet: UNDER the cap reports an improvement so the entry gets tightened');
}
{
  const { failures: f } = evaluate({ 'tools/x.html': hit('0x1b') }, { 'tools/x.html': { reason: 'deliberate', bytes: { '0x00': 9 } } });
  assert(f.length === 1 && f[0].includes('0x1b'), 'a listed file carrying a byte value that is NOT listed still fails on that value (an allowlist entry is per-byte, never a blanket file exemption)');
}
{
  const { failures: f } = evaluate({ 'tools/unlisted.html': hit('0x00') }, {});
  assert(f.length === 1, 'a file absent from the allowlist must be clean — any hit fails');
}
{
  const { failures: f } = evaluate({}, { 'tools/x.html': { bytes: { '0x00': 1 } } });
  assert(f.length === 1 && f[0].includes('reason'), 'an allowlist entry with NO written reason fails on that ground alone');
}
{
  const { failures: f } = evaluate({}, { 'tools/x.html': { reason: '   ', bytes: { '0x00': 1 } } });
  assert(f.length === 1 && f[0].includes('reason'), 'a whitespace-only reason does not count as a written reason');
}
{
  const { improvements } = evaluate({}, { 'tools/x.html': { reason: 'deliberate', bytes: { '0x00': 1 } } });
  assert(improvements.some((i) => i.includes('clean')), 'a now-clean allowlisted file is reported as droppable');
}
{
  const { failures: f, improvements } = evaluate({}, { _README: { reason: 'inert comment block', bytes: {} } });
  assert(f.length === 0 && improvements.length === 0, 'an underscore-prefixed key is an inert comment block, not a file path');
}

// ── 6. MUTATION: flip one fact at a time, require the verdict to move ─────
// Code-reviewing a checker is the same self-consistent-checker shape one level
// up (SO #34). Mutate the input and require the answer to change.
{
  const clean = 'const label = "Coverage";';
  assert(scanBuffer(buf(clean)).length === 0, 'mutation control: the fixture WITHOUT the injected byte is clean');
  for (let pos of [0, 6, clean.length]) {
    const mutated = clean.slice(0, pos) + NUL + clean.slice(pos);
    const h = scanBuffer(buf(mutated));
    assert(h.length === 1 && h[0].offset === pos, `mutation: injecting a NUL at offset ${pos} is caught AT that offset`);
  }
}
{
  // Mutating the allowed byte VALUE (not the count) must flip the verdict.
  const hits = { 'tools/x.html': hit('0x00') };
  assert(evaluate(hits, { 'tools/x.html': { reason: 'r', bytes: { '0x00': 1 } } }).failures.length === 0, 'mutation: allowlist keyed to the right byte passes');
  assert(evaluate(hits, { 'tools/x.html': { reason: 'r', bytes: { '0x08': 1 } } }).failures.length === 1, 'mutation: same count under a DIFFERENT byte key fails — the key binds');
  assert(evaluate(hits, { 'tools/y.html': { reason: 'r', bytes: { '0x00': 1 } } }).failures.length === 1, 'mutation: same entry under a DIFFERENT file path fails — the path binds');
}

// ── 7. The live allowlist on disk is well-formed ──────────────────────────
{
  const live = JSON.parse(readFileSync(resolve(REPO, 'scripts', 'binary-byte-allowlist.json'), 'utf8'));
  const entries = Object.entries(live).filter(([k]) => !k.startsWith('_'));
  assert(entries.length > 0, `the live allowlist has entries (${entries.length})`);
  assert(entries.every(([, e]) => typeof e.reason === 'string' && e.reason.trim().length > 40), 'every live allowlist entry carries a substantive written reason, not a placeholder');
  assert(entries.every(([, e]) => e.bytes && Object.keys(e.bytes).length > 0), 'every live allowlist entry names at least one specific byte value');
  assert(entries.every(([, e]) => Object.keys(e.bytes).every((k) => /^0x[0-9a-f]{2}$/.test(k) || k === SURROGATE_KEY)), 'every allowlisted byte key is a canonical lowercase hex byte or the lone-surrogate key');
}

// ── 8. The scanned set is real and excludes the payload blob ──────────────
{
  // Compare REPO-RELATIVE paths: the repo itself commonly lives under
  // AINumbers/.wt/<branch>/ during a WU, so an absolute-path match on '.wt'
  // would flag the checkout the gate is legitimately scanning.
  const files = scannedFiles(REPO).map((p) => relative(REPO, p).replace(/\\/g, '/'));
  assert(files.length > 500, `the scanned set is non-trivial (${files.length} files) — an empty set would make this gate vacuously green`);
  assert(files.some((f) => /^tools\/\d+.*\.html$/.test(f)), 'the scanned set includes tools/*.html');
  assert(files.some((f) => /^guides\/.*\.html$/.test(f)), 'the scanned set includes guides/*.html');
  assert(files.some((f) => /^chaingraph\/kernels\/.*\.mjs$/.test(f)), 'the scanned set reaches chaingraph/**/*.mjs recursively');
  assert(files.some((f) => /^manifests\/.*\.json$/.test(f)), 'the scanned set includes manifests/*.json');
  assert(files.includes('index.html'), 'the scanned set includes root *.html');
  assert(files.some((f) => /^scripts\/check-binary-bytes\.mjs$/.test(f)), 'the scanned set includes scripts/*.mjs — the gate scans its own source');
  assert(!files.some((f) => /^tools\/.+\/.+$/.test(f)), 'a non-recursive rule stays non-recursive (tools/ is one level, never a subtree)');
  for (const ex of EXCLUDED_FILES) {
    assert(!files.includes(ex), `the generated base64 payload blob ${ex} is excluded from the scanned set`);
  }
  assert(!files.some((f) => /^(\.wt|worktrees|node_modules|\.git)\//.test(f)), 'sibling worktrees, node_modules and .git are never walked');
}

if (failures > 0) {
  console.log(`\n❌ ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('\n✅ all fixture assertions passed');
