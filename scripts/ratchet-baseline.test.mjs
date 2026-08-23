#!/usr/bin/env node
// ratchet-baseline.test.mjs — proven-to-reject fixture for the shared ratchet baseline loader
// (RATCHET-BASELINE-LOADER-1; gate-integrity finding F-11).
//
// ⚖ SO #40(b): a gate proves RED before GREEN. The whole reason this loader exists is that the previous
// behaviour was silently-green on a deleted baseline, so a loader never OBSERVED rejecting a deleted /
// corrupt / key-stripped / non-finite baseline is not known to reject one. Every assertion below drives
// the SHIPPED functions from ./ratchet-baseline.mjs — never a restatement of their logic (SO #34: verify
// a checker by mutation, and never let a checker validate its own paraphrase).
//
// ⭐ THREE LAYERS, and the third is the one that keeps the fix from rotting:
//   1. STATE CONTROLS — every hard-fail state fires on its own fixture, and (anti-vacuity) a good
//      baseline is ACCEPTED, so "it rejects everything" cannot masquerade as "it rejects the bad ones".
//   2. LIVE WIRING — the three REAL baseline files in scripts/ validate against the three REAL
//      required-key declarations their gates ship. This catches the failure mode a purely in-memory test
//      cannot see: a typo'd key name in a gate's BASELINE_REQUIRED_KEYS, which would hard-fail CI on a
//      perfectly good baseline. It reads the declarations out of the gate modules, not a copy of them.
//   3. CONVERSION CONTROL — the three gate sources are asserted to contain NO `?? Infinity` ceiling and
//      NO warn-only "no baseline … not blocking" branch, and to route their strict path through the
//      shared loader. ⭐ This is the row's "all three sites converted, grep-proven" done-item promoted
//      from a one-time check into a permanent gate (SO #41: a done-item a script could check IS a gate).
//      Reintroducing `?? Infinity` in any of the three turns this test red.
//
// ⚖ WHY NO DESTRUCTIVE END-TO-END CASE HERE, stated so nobody adds one thinking it was overlooked: the
// three gates resolve their baseline path internally (correctly — a redirectable baseline path would
// itself be a bypass surface), so an end-to-end RED would have to delete or corrupt the REAL committed
// baseline, run the gate, and restore it. A test that mutates a committed control file and relies on its
// own cleanup runs on every push via preflight, and one interrupted run leaves a corrupt ceiling in the
// tree. That evidence was produced by hand, once, under the row (four RED states x three gates, each
// restored and sha256-verified in the same step, quoted in PR #1481) — and layer 3 above is what makes
// it durable without the hazard.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import {
  loadRatchetBaseline,
  validateRatchetBaseline,
  readBaselineForUpdate,
  assertFiniteCeiling,
  RatchetBaselineError,
  RATCHET_BASELINE_STATES,
} from './ratchet-baseline.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const OPTS = { label: 'FIXTURE ratchet', path: '/fixture/baseline.json', repinCommand: 'node scripts/fixture.mjs --update-baseline' };
const KEYS = ['deferred', { key: 'deferred_nodes', type: 'name-list' }];
const GOOD = JSON.stringify({ deferred: 14, deferred_nodes: ['node_a'], known_gpu_false_nodes: ['node_a', 'node_b'] });

// Drive the shipped validator and return the thrown error, or null if it did not throw.
function catchState(text, keys = KEYS) {
  try { validateRatchetBaseline(text, keys, OPTS); return null; }
  catch (e) { return e; }
}

// ── LAYER 1: state controls — the four RED states the row names, plus the list-type sibling ────────

console.log('\nLAYER 1 — hard-fail state controls (RED)');

test('RED #1 MISSING-FILE — an absent baseline is a hard failure, never a silent Infinity ceiling', () => {
  const e = catchState(null);
  assert(e instanceof RatchetBaselineError, 'must throw RatchetBaselineError, got ' + (e === null ? 'no throw at all — THIS IS THE F-11 DEFECT' : e?.name));
  assert(e.state === 'MISSING-FILE', `expected state MISSING-FILE, got ${e.state}`);
  assert(e.message.includes('MISSING-FILE'), 'the message must NAME the state so a CI log says which one fired');
  assert(e.message.includes(OPTS.path), 'the message must name the path that is missing');
  assert(e.message.includes(OPTS.repinCommand), 'the message must carry the repin command as the way out');
});

test('RED #2 INVALID-JSON — an unparseable baseline is a hard failure', () => {
  const e = catchState('{ "deferred": 14, ');
  assert(e?.state === 'INVALID-JSON', `expected state INVALID-JSON, got ${e?.state ?? 'no throw'}`);
  assert(e.message.includes('INVALID-JSON'), 'the message must name the state');
});

test('RED #2b INVALID-JSON — valid JSON that is not an OBJECT is still not a baseline', () => {
  // Each of these parses cleanly and would make every `baseline.deferred` read undefined — i.e. pass.
  for (const text of ['[1,2,3]', '"14"', '14', 'null']) {
    const e = catchState(text);
    assert(e?.state === 'INVALID-JSON', `expected INVALID-JSON for ${text}, got ${e?.state ?? 'no throw'}`);
  }
});

test('RED #3 MISSING-KEY — the ceiling key deleted from an otherwise-valid baseline is a hard failure', () => {
  const e = catchState(JSON.stringify({ deferred_nodes: ['node_a'] }));
  assert(e?.state === 'MISSING-KEY', `expected state MISSING-KEY, got ${e?.state ?? 'no throw'}`);
  assert(e.message.includes('"deferred"'), 'the message must name WHICH key is missing');
  assert(e.message.includes('MISSING-KEY'), 'the message must name the state');
});

test('RED #3b MISSING-KEY — a deleted provenance LIST key is a hard failure too', () => {
  // `deferred_nodes ?? []` used to mean "nothing was known before", which reclassifies every proof
  // regression as a legitimate brand-new node. That is the same silent-green shape, one key down.
  const e = catchState(JSON.stringify({ deferred: 14 }));
  assert(e?.state === 'MISSING-KEY', `expected state MISSING-KEY, got ${e?.state ?? 'no throw'}`);
  assert(e.message.includes('"deferred_nodes"'), 'the message must name the missing list key');
});

test('RED #4 NAN-KEY — a ceiling that is not a finite number is a hard failure', () => {
  // Every one of these makes `count > ceiling` false for every count, i.e. an infinite ceiling by
  // another name. 1e999 is the sharp one: JSON.parse turns it into literal Infinity — the exact value
  // the old `?? Infinity` default supplied — so a baseline could otherwise smuggle the defect back in.
  const cases = ['"not-a-number"', 'null', 'true', '1e999', '-1e999'];
  for (const v of cases) {
    const e = catchState(`{"deferred": ${v}, "deferred_nodes": []}`);
    assert(e?.state === 'NAN-KEY', `expected NAN-KEY for deferred=${v}, got ${e?.state ?? 'no throw'}`);
    assert(e.message.includes('NAN-KEY'), 'the message must name the state');
  }
});

test('RED #4b BAD-LIST-KEY — a provenance list of the wrong type is a hard failure', () => {
  for (const v of ['"node_a"', '42', '{"0":"node_a"}', '[1,2]']) {
    const e = catchState(`{"deferred": 14, "deferred_nodes": ${v}}`);
    assert(e?.state === 'BAD-LIST-KEY', `expected BAD-LIST-KEY for deferred_nodes=${v}, got ${e?.state ?? 'no throw'}`);
  }
});

test('every thrown state is a declared one — no undocumented failure modes', () => {
  const seen = ['MISSING-FILE', 'INVALID-JSON', 'MISSING-KEY', 'NAN-KEY', 'BAD-LIST-KEY'];
  for (const s of seen) assert(RATCHET_BASELINE_STATES.includes(s), `${s} thrown but not in RATCHET_BASELINE_STATES`);
  assert(RATCHET_BASELINE_STATES.length === seen.length, 'RATCHET_BASELINE_STATES drifted from the states this test exercises');
});

console.log('\nLAYER 1 — anti-vacuity control (GREEN)');

test('GREEN — a valid baseline is ACCEPTED and returned unchanged (the four REDs are not "reject all")', () => {
  const b = validateRatchetBaseline(GOOD, KEYS, OPTS);
  assert(b.deferred === 14, `expected the pinned ceiling 14 back, got ${b.deferred}`);
  assert(Array.isArray(b.deferred_nodes) && b.deferred_nodes[0] === 'node_a', 'the list key must round-trip');
  assert(b.known_gpu_false_nodes.length === 2, 'keys beyond the required set must be preserved, not stripped');
});

test('GREEN — a ceiling of 0 is a real ceiling, not a falsy "missing" (the fully-ratcheted end state)', () => {
  const b = validateRatchetBaseline('{"deferred": 0, "deferred_nodes": []}', KEYS, OPTS);
  assert(b.deferred === 0, 'zero must survive validation — `?? ` and `||` differ here and this pins the right one');
});

// ── loadRatchetBaseline / readBaselineForUpdate over the real filesystem ───────────────────────────

console.log('\nLAYER 1 — filesystem behaviour');

const TMP = mkdtempSync(join(tmpdir(), 'ratchet-baseline-test-'));
try {
  test('loadRatchetBaseline throws MISSING-FILE for a path that is not on disk', () => {
    let e = null;
    try { loadRatchetBaseline(join(TMP, 'does-not-exist.json'), KEYS, OPTS); } catch (err) { e = err; }
    assert(e?.state === 'MISSING-FILE', `expected MISSING-FILE, got ${e?.state ?? 'no throw'}`);
  });

  test('loadRatchetBaseline reads and validates a real file on disk', () => {
    const p = join(TMP, 'good.json');
    writeFileSync(p, GOOD);
    assert(loadRatchetBaseline(p, KEYS, OPTS).deferred === 14, 'a good on-disk baseline must load');
  });

  test('readBaselineForUpdate returns null for an absent file — the ONE sanctioned absent path', () => {
    // --update-baseline on a first-ever pin. It WRITES the file and derives no ceiling from the read.
    assert(readBaselineForUpdate(join(TMP, 'nope.json'), KEYS, OPTS) === null, 'first-ever pin must read as null, not throw');
  });

  test('readBaselineForUpdate still validates an EXISTING file — a corrupt pin is never overwritten blind', () => {
    const p = join(TMP, 'good2.json');
    writeFileSync(p, GOOD);
    assert(readBaselineForUpdate(p, KEYS, OPTS).deferred === 14, 'an existing valid baseline must load in update mode too');
  });
} finally {
  rmSync(TMP, { recursive: true, force: true });
}

test('assertFiniteCeiling refuses a non-finite ceiling at the pure-function seam', () => {
  // ratchetBreach() in check-compute-proof-coverage.mjs is exported and called DIRECTLY by its own
  // self-test, bypassing the loader entirely. Without this guard, F-11 survives inside that seam.
  for (const v of [undefined, null, NaN, Infinity, '14']) {
    let e = null;
    try { assertFiniteCeiling(v, { label: 'FIXTURE', keyName: 'deferred' }); } catch (err) { e = err; }
    assert(e?.state === 'NAN-KEY', `expected NAN-KEY for ceiling ${String(v)}, got ${e?.state ?? 'NO THROW — silent pass'}`);
  }
  assert(assertFiniteCeiling(0, { label: 'FIXTURE', keyName: 'deferred' }) === 0, 'a finite ceiling of 0 must pass through');
});

// ── LAYER 2: live wiring — the shipped baselines satisfy the shipped declarations ──────────────────

console.log('\nLAYER 2 — live wiring (real baselines vs. real required-key declarations)');

// Declared here in the same shape each gate declares it. ⚠ This is NOT a re-implementation of the
// loader (layer 1 already drives the shipped one); it is the CONTRACT each gate asserts about its own
// baseline file, re-checked against the file as committed. A drift on either side reds this test.
const LIVE = [
  ['compute-proof-baseline.json', ['deferred', { key: 'deferred_nodes', type: 'name-list' }, { key: 'known_gpu_false_nodes', type: 'name-list' }]],
  ['fv-floor-coverage-baseline.json', ['unfloored', { key: 'unfloored_nodes', type: 'name-list' }, { key: 'known_live_nodes', type: 'name-list' }]],
  ['s18-digest-freshness-baseline.json', ['stale', { key: 'stale_nodes', type: 'name-list' }]],
];

for (const [file, keys] of LIVE) {
  test(`${file} validates against the required keys its gate declares`, () => {
    const b = loadRatchetBaseline(resolve(HERE, file), keys, { label: file, repinCommand: '(see the gate header)' });
    const countKey = typeof keys[0] === 'string' ? keys[0] : keys[0].key;
    assert(Number.isFinite(b[countKey]), `${countKey} must be a finite pinned ceiling`);
  });
}

test('each gate DECLARES the same required keys this test checks (declaration, not a copy, is the source)', () => {
  // Reads the declaration out of the gate source so a divergence between the gate's BASELINE_REQUIRED_KEYS
  // and the LIVE table above cannot pass unnoticed — otherwise layer 2 would only be testing itself.
  const pairs = [
    ['check-compute-proof-coverage.mjs', ['deferred', 'deferred_nodes', 'known_gpu_false_nodes']],
    ['check-fv-floor-coverage.mjs', ['unfloored', 'unfloored_nodes', 'known_live_nodes']],
    ['check-s18-digest-freshness.mjs', ['stale', 'stale_nodes']],
  ];
  for (const [file, keys] of pairs) {
    const src = readFileSync(resolve(HERE, file), 'utf8');
    const block = src.match(/const BASELINE_REQUIRED_KEYS = \[([\s\S]*?)\];/);
    assert(block, `${file} declares no BASELINE_REQUIRED_KEYS`);
    for (const k of keys) assert(block[1].includes(`'${k}'`), `${file} BASELINE_REQUIRED_KEYS is missing ${k}`);
  }
});

// ── LAYER 3: conversion control — no call site may drift back to a silent default ──────────────────

console.log('\nLAYER 3 — conversion control (the grep-proof, made permanent)');

const CONVERTED = ['check-compute-proof-coverage.mjs', 'check-fv-floor-coverage.mjs', 'check-s18-digest-freshness.mjs'];

for (const file of CONVERTED) {
  const src = readFileSync(resolve(HERE, file), 'utf8');
  // Comments in these files quote the old `?? Infinity` text to explain what was removed, so strip
  // comment lines before asserting — otherwise the explanation would trip the check it explains.
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');

  test(`${file} — no \`?? Infinity\` ceiling default remains (F-11 site)`, () => {
    assert(!/\?\?\s*Infinity/.test(code), `${file} still defaults a ceiling to Infinity — that is a ratchet that cannot be breached`);
  });

  test(`${file} — no warn-only "no baseline … not blocking" branch remains`, () => {
    assert(!/no .*baseline.*not blocking/i.test(code), `${file} still treats an absent baseline as non-blocking (SO #34c: absence is not a pass)`);
  });

  test(`${file} — strict path loads the baseline through the shared hard-failing loader`, () => {
    assert(/from '\.\/ratchet-baseline\.mjs'/.test(src), `${file} does not import the shared loader`);
    assert(/loadRatchetBaselineOrExit\(\s*BASELINE_PATH/.test(code), `${file} does not load BASELINE_PATH through loadRatchetBaselineOrExit`);
  });

  test(`${file} — no bare existsSync(BASELINE_PATH) branch left anywhere`, () => {
    // readBaselineForUpdate() owns the only legitimate absent-baseline check now, and it lives in the
    // shared module. A local existsSync on the baseline path is by definition a second, ungoverned policy.
    assert(!/existsSync\(\s*BASELINE_PATH\s*\)/.test(code), `${file} still branches locally on baseline existence`);
  });
}

console.log(`\nratchet-baseline loader self-test — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
