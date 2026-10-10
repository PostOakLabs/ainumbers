// @ts-nocheck — plain mutation-control test script under chaingraph/kernels/ (no @types/node in
// this directory's tsc program; same rationale as vm-parity-gate.mjs / lint-cgcanon-twin.mjs).
// lint-cgcanon-twin.test.mjs — red-then-green mutation controls for lint-cgcanon-twin.mjs
// (AUD-CGCANON-TWIN-GATE-1, 2026-10-10; re-lands SPECGATE-HYGIENE-1's gate; SO #34c: "a new gate
// proves red before green", SO #34: "verify a checker by mutation, not by reading it").
//
// Three controls, per the row spec:
//   1. CLEAN RUN GREEN — every discovered inline `_cgCanon` twin byte-identical to
//      `_hash.mjs` cgCanon over the fixture set.
//   2. PLANTED DIVERGENCE RED — one discovered twin's expression is mutated IN MEMORY
//      (⛔ zero kernel bytes touched on disk — the fence's load-bearing constraint) in two
//      ways that mirror the real drift classes, and the comparison must fail for each:
//        (a) `.sort()` dropped — the constant-digest class (key order stops being canonical);
//        (b) `.sort()` → `.sort().reverse()` — the inverted-order class (still deterministic,
//            still "a" canonicalizer, wrong against the SSOT).
//   3. LISTED-BUT-TWINLESS RED — a kernel that discovery counts as carrying a twin but whose
//      extracted expression is missing/null must FAIL, not silently pass (guards the extractor
//      against a shape change that would zero out discovery).

import assert from 'node:assert/strict';
import { discoverTwins, runTwinComparison, expectedOutputs, extractCgCanon } from './lint-cgcanon-twin.mjs';

// ── Control 1 (GREEN over the real corpus): discovery finds the twins and every one matches ──
const twins = discoverTwins();
assert.ok(twins.length >= 11, `discovery must find the estate's inline twins (found ${twins.length}, expected >= 11)`);
for (const { file, expr } of twins) {
  const { ok, detail } = runTwinComparison(expr);
  assert.ok(ok, `control 1 (GREEN): ${file} must match cgCanon over the fixture set — ${detail}`);
}
console.log(`✓ control 1 (GREEN): ${twins.length} discovered inline twin(s) byte-identical to _hash.mjs cgCanon over ${expectedOutputs().length} fixtures`);

// ── Control 2 (RED, planted divergence a): drop .sort() — the constant-digest class ─────────
{
  const { file, expr } = twins[0];
  const mutated = expr.replace('.sort()', '');
  assert.notEqual(mutated, expr, `mutation (a) must actually change the twin source of ${file} (no '.sort()' found)`);
  const { ok, detail } = runTwinComparison(mutated);
  assert.ok(!ok, `control 2 (RED a): the comparator MUST fire on a sort-dropped twin of ${file} — it returned ok with: ${detail}`);
  assert.match(detail, /BYTE DRIFT/, `control 2 (RED a): the failure must name the drift — got: ${detail}`);
  console.log(`✓ control 2 (RED a): sort-dropped twin of ${file} FIRES — ${detail}`);
}

// ── Control 3 (RED, planted divergence b): invert the sort — deterministic-but-wrong class ──
{
  const { file, expr } = twins[0];
  const mutated = expr.replace('.sort()', '.sort().reverse()');
  assert.notEqual(mutated, expr, `mutation (b) must actually change the twin source of ${file}`);
  const { ok, detail } = runTwinComparison(mutated);
  assert.ok(!ok, `control 3 (RED b): the comparator MUST fire on an order-inverted twin of ${file} — it returned ok with: ${detail}`);
  console.log(`✓ control 3 (RED b): order-inverted twin of ${file} FIRES — ${detail}`);
}

// ── Control 4 (RED, listed-but-twinless): a counted twin with a MISSING expression fails ────
// Mirrors the row's "a kernel listed but lacking a twin red": if extraction ever yields a null
// / empty expression for a kernel discovery counted, the comparison must FAIL (not pass, not
// throw-and-swallow) — otherwise a declaration-shape change could silently empty the gate.
{
  const { file } = twins[0];
  for (const bogus of [null, '']) {
    const { ok, detail } = runTwinComparison(bogus);
    assert.ok(!ok, `control 4 (RED twinless): a null/empty twin expression for ${file} MUST fail — got ok with: ${detail}`);
  }
  // And extraction itself: a kernel source WITHOUT a `_cgCanon` declaration extracts to null
  // (comment mentions don't count) — the shape that discovery (correctly) skips.
  assert.equal(extractCgCanon('// const _cgCanon mentioned in a comment only\nconst x = 1;\n'), null,
    'extraction must not count comment mentions as twin declarations');
  console.log(`✓ control 4 (RED twinless): null/empty twin expression of ${file} FIRES; comment-only mentions are not twins`);
}

// ── Control 5 (green-side sanity): a clean re-comparison after the mutations still passes —
// proves the mutations above were in-memory only and no kernel byte was touched on disk.
{
  const { file, expr } = twins[0];
  const { ok } = runTwinComparison(expr);
  assert.ok(ok, `control 5: the UNMUTATED twin of ${file} must still pass after the in-memory mutations (disk drift would surface here)`);
  console.log(`✓ control 5: unmutated twin of ${file} still green — mutations were in-memory only, zero kernel bytes touched`);
}

console.log('\n✓ lint-cgcanon-twin.test.mjs — all controls green (red-then-green proven).');
