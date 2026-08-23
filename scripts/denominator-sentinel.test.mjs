#!/usr/bin/env node
// denominator-sentinel.test.mjs — proven-to-reject fixture for the shared denominator sentinel
// (DENOMINATOR-SENTINEL-1; gate-integrity findings F-01…F-06, F-08).
//
// ⚖ SO #40(b): a gate proves RED before GREEN. The entire defect being fixed here is that six gates were
// silently green on an empty scope, so a sentinel never OBSERVED refusing an empty scope is not known to
// refuse one. Every assertion below drives the SHIPPED functions from ./denominator-sentinel.mjs — never
// a restatement of their logic (SO #34: verify a checker by mutation, and never let a checker validate
// its own paraphrase).
//
// ⭐ THREE LAYERS, and the third is the one that keeps the fix from rotting:
//   1. STATE CONTROLS — every hard-fail state fires on its own fixture, plus the BOUNDARY the row pins
//      (exactly-at-threshold passes, one below fails) and the anti-vacuity control that a healthy count
//      is ACCEPTED, so "it rejects everything" cannot masquerade as "it rejects the empty ones".
//   2. LIVE WIRING — the real denominators of the real six gates, measured against the real tree: the
//      committed floor count is derivable and matches what is on disk; the derived fixture-exemption
//      really does cover the two non-vector corpus files; and EVERY committed *.fixtures.json survives
//      parityVectorsOf. That last one is the zero-vector gate running a second time, cheaply (JSON parse
//      only, no hashing) — it reds the moment a present-but-empty corpus file appears.
//   3. NOT-A-WRAPPER CONTROL — the six gate sources are asserted to import the shared module and to no
//      longer contain the silent default each one shipped (`?? []`, the "no-op PASS" exit, the warn-only
//      "not found" arm), AND scripts/preflight.mjs is asserted NOT to import it. ⭐ That is the row's
//      "all six asserts at point-of-check, ⛔ not a wrapper" done-item promoted from a one-time review
//      into a permanent gate (SO #41: a done-item a script could check IS a gate). Move an assert up
//      into the runner, or restore any of the six silent defaults, and this test turns red.
//
// ⚖ WHY NO DESTRUCTIVE END-TO-END CASE HERE, stated so nobody adds one thinking it was overlooked: an
// end-to-end RED for these six means renaming a real directory, emptying a real ledger, or moving the
// real chaingraph.json, then restoring it. A test that mutates committed files and relies on its own
// cleanup runs on every push via preflight, and one interrupted run leaves a wrecked tree. That evidence
// was produced by hand, once, under the row — six RED proofs plus the zero-vector and boundary cases,
// each run twice (against the fixed sources AND against the pre-fix sources in a detached scratch
// worktree), each restored and `git status --porcelain`-verified in the same step, all quoted in the PR.
// Layer 3 above is what makes it durable without the hazard.

import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import {
  assertDenominator,
  assertSsotPresent,
  committedFileCount,
  fixtureClaimants,
  parityVectorsOf,
  PARITY_GATE_FILES,
  DenominatorSentinelError,
  DENOMINATOR_SENTINEL_STATES,
} from './denominator-sentinel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const KERNELS = resolve(REPO, 'chaingraph', 'kernels');
const FIXDIR = resolve(KERNELS, 'fixtures');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const OPTS = { label: 'FIXTURE gate', unit: 'thing(s)', scope: '/fixture/dir', remedy: 'restore the fixture scope' };

// Drive the shipped assert and return the thrown error, or null if it did not throw.
function catchState(fn) {
  try { fn(); return null; } catch (e) { return e; }
}

// ── LAYER 1: state controls ───────────────────────────────────────────────────────────────────────

console.log('\nLAYER 1 — hard-fail state controls (RED)');

test('RED #1 EMPTY-SCOPE — a gate that examined ZERO units is a hard failure, never a green no-op', () => {
  const e = catchState(() => assertDenominator(0, 1, OPTS));
  assert(e instanceof DenominatorSentinelError, 'must throw DenominatorSentinelError, got ' + (e === null ? 'no throw at all — THIS IS THE F-01…F-06 DEFECT' : e?.name));
  assert(e.state === 'EMPTY-SCOPE', `expected state EMPTY-SCOPE, got ${e.state}`);
  assert(e.message.includes('EMPTY-SCOPE'), 'the message must NAME the state so a CI log says which one fired');
  assert(e.message.includes('The denominator is EMPTY'), 'the message must name the EMPTY DENOMINATOR, not merely fail');
  assert(e.message.includes(OPTS.scope), 'the message must name the scope that came back empty');
  assert(e.message.includes(OPTS.remedy), 'the message must carry the remedy as the way out');
});

test('RED #2 BELOW-FLOOR — a partially-vanished scope is a hard failure, and says how much vanished', () => {
  const e = catchState(() => assertDenominator(633, 634, OPTS));
  assert(e?.state === 'BELOW-FLOOR', `expected state BELOW-FLOOR, got ${e?.state ?? 'no throw'}`);
  assert(e.message.includes('633') && e.message.includes('634'), 'the message must quote both the observed count and the floor');
  assert(e.message.includes('1 thing(s) vanished'), 'the message must state the SIZE of the gap, not just that there is one');
});

test('RED #3 BAD-FLOOR — a floor of 0 is refused: it is the vacuous pass written as a constant', () => {
  // The single most likely bad "fix" for a red sentinel is to set its floor to 0. That must not work,
  // even though 0 is a perfectly good number and `observed < 0` is false for every count.
  for (const bad of [0, -1, 1.5, NaN, Infinity, null, undefined, '634', true]) {
    const e = catchState(() => assertDenominator(5, bad, OPTS));
    assert(e?.state === 'BAD-FLOOR', `expected BAD-FLOOR for floor=${String(bad)}, got ${e?.state ?? 'NO THROW — silent pass'}`);
  }
});

test('RED #3b BAD-FLOOR — an observed count that is not a whole number is refused too', () => {
  for (const bad of [-1, 2.5, NaN, Infinity, null, undefined, '634', []]) {
    const e = catchState(() => assertDenominator(bad, 1, OPTS));
    assert(e?.state === 'BAD-FLOOR', `expected BAD-FLOOR for observed=${JSON.stringify(bad)}, got ${e?.state ?? 'NO THROW — silent pass'}`);
  }
});

test('RED #4 MISSING-SSOT — an absent single-document subject is a hard failure, not a "! not found" note', () => {
  const e = catchState(() => assertSsotPresent(join(tmpdir(), 'no-such-chaingraph-' + Date.now() + '.json'), {
    label: 'FIXTURE gate', what: 'the SSOT catalog', remedy: 'restore it',
  }));
  assert(e?.state === 'MISSING-SSOT', `expected MISSING-SSOT, got ${e?.state ?? 'no throw'}`);
  assert(e.message.includes('MISSING-SSOT'), 'the message must name the state');
  for (const empty of [null, undefined, '']) {
    const e2 = catchState(() => assertSsotPresent(empty, { label: 'FIXTURE gate', what: 'the SSOT catalog', remedy: 'restore it' }));
    assert(e2?.state === 'MISSING-SSOT', `expected MISSING-SSOT for an unresolved path ${JSON.stringify(empty)}, got ${e2?.state ?? 'no throw'}`);
  }
});

test('RED #5 UNDETERMINABLE-FLOOR — a floor that cannot be derived is refused, never defaulted to 0', () => {
  // A derived floor that silently becomes 0 is the F-11 `?? Infinity` shape inverted: the comparison
  // still runs, still passes, and no longer means anything.
  const tmp = mkdtempSync(join(tmpdir(), 'denominator-sentinel-test-'));
  try {
    const e = catchState(() => committedFileCount({
      repoRoot: tmp, pathspec: 'whatever', match: /\.mjs$/, label: 'FIXTURE gate', remedy: 'run inside a checkout',
    }));
    assert(e?.state === 'UNDETERMINABLE-FLOOR', `expected UNDETERMINABLE-FLOOR outside a git checkout, got ${e?.state ?? 'no throw'}`);
    assert(e.message.includes('UNDETERMINABLE-FLOOR'), 'the message must name the state');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('RED #6 ZERO-VECTOR-FIXTURE — a present corpus file contributing zero vectors is an ERROR, not a skip', () => {
  const claimants = new Map();
  // (a) the headline case: a `vectors` key that yields nothing
  for (const doc of [{ vectors: [] }, { vectors: null }, { vectors: 'three' }, { vectors: {} }]) {
    const e = catchState(() => parityVectorsOf(doc, 'fake.fixtures.json', { claimants, label: 'FIXTURE gate', remedy: 'restore it' }));
    assert(e?.state === 'ZERO-VECTOR-FIXTURE', `expected ZERO-VECTOR-FIXTURE for ${JSON.stringify(doc)}, got ${e?.state ?? 'NO THROW — this is the exact hole'}`);
    assert(e.message.includes('fake.fixtures.json'), 'the message must name WHICH file contributes nothing');
  }
  // (b) no `vectors` key at all and nothing claims it — an orphan masquerading as corpus
  const orphan = catchState(() => parityVectorsOf({ _comment: 'looks official' }, 'orphan.fixtures.json', { claimants, label: 'FIXTURE gate', remedy: 'restore it' }));
  assert(orphan?.state === 'ZERO-VECTOR-FIXTURE', `an unclaimed vectorless file must error, got ${orphan?.state ?? 'no throw'}`);
  // (c) ⛔ being claimed does NOT license an EMPTY `vectors` key — the claim is the problem
  const claimed = new Map([['claimed.fixtures.json', 'some-other.test.mjs']]);
  const stillBad = catchState(() => parityVectorsOf({ vectors: [] }, 'claimed.fixtures.json', { claimants: claimed, label: 'FIXTURE gate', remedy: 'restore it' }));
  assert(stillBad?.state === 'ZERO-VECTOR-FIXTURE', 'an empty vectors[] must error even when a sibling gate names the file');
});

test('every thrown state is a declared one — no undocumented failure modes', () => {
  const seen = ['EMPTY-SCOPE', 'BELOW-FLOOR', 'BAD-FLOOR', 'UNDETERMINABLE-FLOOR', 'MISSING-SSOT', 'ZERO-VECTOR-FIXTURE'];
  for (const s of seen) assert(DENOMINATOR_SENTINEL_STATES.includes(s), `${s} thrown but not in DENOMINATOR_SENTINEL_STATES`);
  assert(DENOMINATOR_SENTINEL_STATES.length === seen.length, 'DENOMINATOR_SENTINEL_STATES drifted from the states this test exercises');
});

console.log('\nLAYER 1 — boundary + anti-vacuity controls (GREEN)');

test('BOUNDARY — exactly at the threshold PASSES, one below FAILS (the comparison is < , not <=)', () => {
  assert(assertDenominator(634, 634, OPTS) === 634, 'observed === floor is FULL coverage and must pass, returning the count');
  assert(catchState(() => assertDenominator(633, 634, OPTS))?.state === 'BELOW-FLOOR', 'one below the floor must fail');
  assert(assertDenominator(635, 634, OPTS) === 635, 'above the floor must pass — floors are minimums, scope is allowed to grow');
  // and at the smallest possible floor, where EMPTY-SCOPE and BELOW-FLOOR meet
  assert(assertDenominator(1, 1, OPTS) === 1, 'exactly one unit at a floor of one is coverage');
  assert(catchState(() => assertDenominator(0, 1, OPTS))?.state === 'EMPTY-SCOPE', 'zero at a floor of one is the empty denominator');
});

test('GREEN — a healthy corpus file returns its vectors, and a claimed vectorless file returns null', () => {
  const claimants = new Map([['sidecar.fixtures.json', 'sidecar-consumer.test.mjs']]);
  const v = parityVectorsOf({ vectors: [{ name: 'a' }, { name: 'b' }] }, 'good.fixtures.json', { claimants, label: 'FIXTURE gate', remedy: 'x' });
  assert(Array.isArray(v) && v.length === 2, 'the vectors array must be returned unchanged for a healthy file');
  const skip = parityVectorsOf({ _comment: 'different schema by design' }, 'sidecar.fixtures.json', { claimants, label: 'FIXTURE gate', remedy: 'x' });
  assert(skip === null, 'a vectorless file NAMED by a sibling gate is the one sanctioned exemption and must read as null');
});

// ── LAYER 2: live wiring — the real six denominators against the real tree ─────────────────────────

console.log('\nLAYER 2 — live wiring (real denominators, real tree)');

test('run-proptests floor is derivable from git and matches what is on disk', () => {
  const committed = committedFileCount({
    repoRoot: REPO, pathspec: 'chaingraph/kernels/__proptests__', match: /\.proptest\.mjs$/,
    label: 'LIVE run-proptests', remedy: '(self-test)',
  });
  assert(Number.isInteger(committed) && committed > 0, `committed floor must be a positive integer, got ${committed}`);
  const onDisk = readdirSync(resolve(KERNELS, '__proptests__')).filter((f) => f.endsWith('.proptest.mjs')).length;
  // ⛔ This is NOT the gate re-run: the gate asserts onDisk >= committed. Here they must be EQUAL,
  // because a committed floor file missing from a clean checkout would mean the derivation itself is
  // wrong (a pathspec typo silently narrowing the floor is the way this control dies quietly).
  assert(onDisk === committed, `git says ${committed} committed floor file(s), disk has ${onDisk} — the pathspec or the tree is wrong`);
});

test('schema-validate\'s subject really is present at the path the gate resolves', () => {
  assertSsotPresent(resolve(REPO, 'chaingraph', 'chaingraph.json'), {
    label: 'LIVE schema-validate', what: 'chaingraph.json', remedy: '(self-test)',
  });
});

test('the fixture exemption is DERIVED and really does cover the two non-vector corpus files', () => {
  const claims = fixtureClaimants(KERNELS);
  assert(claims.size > 0, 'no sibling gate names any fixture file — the derivation is broken, not merely empty');
  for (const f of ['ha-records.fixtures.json', 'seed-replay.fixtures.json']) {
    assert(claims.has(f), `${f} carries no vectors array and nothing claims it — its exemption has evaporated`);
  }
  // ⛔ Neither parity gate may exempt a file from the very check it is performing.
  for (const claimant of claims.values()) {
    assert(!PARITY_GATE_FILES.includes(claimant), `${claimant} must never be able to claim a fixture — it IS the gate`);
  }
});

test('EVERY committed *.fixtures.json survives parityVectorsOf — zero present-but-empty corpus files', () => {
  // The zero-vector gate, run a second time and cheaply (JSON parse only, no hashing). It exists here
  // as well as inside the two parity gates so the corpus invariant is asserted even in a preflight run
  // where a parity gate failed earlier for an unrelated reason.
  const claimants = fixtureClaimants(KERNELS);
  const files = readdirSync(FIXDIR).filter((f) => f.endsWith('.fixtures.json')).sort();
  assert(files.length > 0, 'the fixtures directory is empty — the corpus this asserts over does not exist');
  let vectors = 0, exempt = 0;
  for (const f of files) {
    const got = parityVectorsOf(JSON.parse(readFileSync(join(FIXDIR, f), 'utf8')), f, {
      claimants, label: 'LIVE fixture corpus', remedy: '(self-test)',
    });
    if (got === null) exempt++; else vectors += got.length;
  }
  assert(vectors > 0, 'the whole corpus contributed zero vectors');
  console.log(`      (${files.length} corpus file(s): ${vectors} vector(s), ${exempt} derived-exempt)`);
});

// ── LAYER 3: not-a-wrapper control — the six asserts stay at their own point of check ──────────────

console.log('\nLAYER 3 — not-a-wrapper control (the row\'s point-of-check rule, made permanent)');

// [path, [substrings the CODE must contain], [substrings the CODE must NOT contain any more]]
const CONVERTED = [
  ['scripts/run-proptests.mjs',
    ['committedFileCountOrExit(', 'assertDenominatorOrExit('],
    ['0 property files found — no-op PASS']],
  ['scripts/verify-proof-surface.mjs',
    ['assertDenominatorOrExit(emitters, 1'],
    []],
  ['scripts/check-deadline-freshness.mjs',
    ['assertDenominatorOrExit(entries.length, 1'],
    ['data.entries ?? []']],
  ['scripts/check-bank-fact-freshness.mjs',
    ['assertDenominatorOrExit(entries.length, 1'],
    ['data.entries ?? []']],
  ['chaingraph/standard/schema-validate.mjs',
    ['assertSsotPresentOrExit(CHAINGRAPH'],
    ['chaingraph.json not found at']],
  ['chaingraph/kernels/golden-parity.test.mjs',
    ['parityVectorsOfOrExit(', 'assertDenominatorOrExit(checked, 1'],
    ['doc.vectors ?? []']],
  ['chaingraph/kernels/determinism-replay.test.mjs',
    ['parityVectorsOfOrExit(', 'assertDenominatorOrExit(vectors, 1'],
    ['doc.vectors ?? []']],
];

// Comments in these files quote the old silent-default text to explain what was removed, so strip
// comment lines before asserting — otherwise the explanation would trip the check it explains.
function codeOf(src) {
  return src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
}

for (const [file, mustHave, mustNotHave] of CONVERTED) {
  const src = readFileSync(resolve(REPO, file), 'utf8');
  const code = codeOf(src);

  test(`${file} — imports the shared sentinel (one validation path, not a second copy)`, () => {
    assert(/from '(\.\/|\.\.\/\.\.\/scripts\/)denominator-sentinel\.mjs'/.test(src), `${file} does not import scripts/denominator-sentinel.mjs`);
  });

  test(`${file} — asserts its denominator AT ITS OWN POINT OF CHECK`, () => {
    for (const needle of mustHave) {
      assert(code.includes(needle), `${file} no longer calls ${needle} — its denominator assert has been removed or moved out of the gate`);
    }
  });

  if (mustNotHave.length) {
    test(`${file} — the silent default it shipped is gone`, () => {
      for (const needle of mustNotHave) {
        assert(!code.includes(needle), `${file} still contains \`${needle}\` — the vacuous path is back`);
      }
    });
  }
}

test('⛔ scripts/preflight.mjs does NOT import the sentinel — a wrapper-level assert is the banned shape', () => {
  // The row's rule, stated mechanically: a runner-level "did that gate print a number" check is a second,
  // ungoverned copy of each gate's scope rule and goes stale the moment a gate's scope changes. The assert
  // belongs on the line where the count is taken, inside the gate, and nowhere else.
  const src = readFileSync(resolve(REPO, 'scripts', 'preflight.mjs'), 'utf8');
  const code = codeOf(src);
  assert(!/denominator-sentinel\.mjs/.test(code), 'preflight.mjs imports the sentinel — assert at the point of check, never in the runner');
  assert(!/assertDenominator\s*\(/.test(code), 'preflight.mjs calls assertDenominator — assert at the point of check, never in the runner');
});

console.log(`\ndenominator-sentinel self-test — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
