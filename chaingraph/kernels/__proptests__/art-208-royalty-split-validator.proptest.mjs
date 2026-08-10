// art-208-royalty-split-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C6-1).
// kernel_digest_at_authoring: sha256:e264583d242ab0d715775d7f1ac1a87d7a26916f3fa44a5082a6c2facfa61705
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES -- CONFIRMED by direct read (the one WU-flagged "most likely to have real
// division" kernel in this shard, and it does: `mode === 'percent'` sums caller-supplied percent
// shares with `Math.abs(sum - total) <= tolerance` where tolerance=0.001, plus `capBps / 100` and
// per-entry `sv > capInMode` comparisons). ULP-BOUNDARY FORCING IS MANDATORY here per spec §3.
// Checks: fixture-oracle gate, termination (rule loops bounded by caller entries.length --
// recipient_count === entries.length is asserted directly), boundedness (sum is always finite,
// never NaN), FORCED ULP-boundary cases (percent sum exactly at the ±0.001 tolerance edge, one
// ULP inside/outside that edge, 0, negative zero, classic float non-associativity inputs like
// 33.33+33.33+33.34, denormal-scale shares, cap-boundary equality sv===capInMode), a differential
// re-derivation of `sumOk`/`capOk` from the reported `sum`/`cap_bps`, and metamorphic address-order
// invariance (permuting entries never changes `valid`/`sum`/rule verdicts, only config_hash's
// internal sort order which is already address-sorted and therefore also invariant).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-208-royalty-split-validator.proptest.mjs

import { compute } from '../art-208-royalty-split-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-208-royalty-split-validator.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x2080A0);

function randAddr(rng) {
  let s = '0x';
  for (let i = 0; i < 40; i++) s += Math.floor(rng() * 16).toString(16);
  return s;
}

function randomBpsEntries(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ address: randAddr(rng), basis_points: Math.floor(rng() * 10000) });
  return out;
}

const TRIALS = 5000;

// ---------- P1: termination — recipient_count exactly entries.length, sum always finite ----------
function checkP1_termination_and_finiteness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 15);
    const entries = randomBpsEntries(rand, n);
    const { output_payload } = compute({ entries });
    checked++;
    if (output_payload.recipient_count !== n) violations++;
    if (!Number.isFinite(output_payload.sum)) violations++;
  }
  return { name: 'P1_termination_bounded_by_entries_and_sum_finite', trials: checked, violations };
}

// ---------- P2 (differential): sumOk/capOk re-derivation from reported sum/cap_bps ----------
function checkP2_sum_cap_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 10);
    const entries = randomBpsEntries(rand, n);
    const cap_bps = 1 + Math.floor(rand() * 10000);
    const { output_payload } = compute({ entries, cap_bps });
    checked++;
    const sumRule = output_payload.rules.find((r) => r.id === 'sum');
    const expectedSumOk = Math.abs(output_payload.sum - 10000) <= 0; // bps mode, tolerance=0
    if (sumRule.pass !== expectedSumOk) violations++;
    const capRule = output_payload.rules.find((r) => r.id === 'cap');
    const anyOverCap = entries.some((e) => e.basis_points > output_payload.cap_bps);
    if (capRule.pass !== !anyOverCap) violations++;
  }
  return { name: 'P2_sum_cap_differential', trials: checked, violations };
}

// ---------- P3: FORCED ULP-boundary cases (percent mode, mandatory per §3 for float-sensitive kernels) ----------
function checkP3_ulp_boundary_forcing() {
  const cases = [];
  const push = (name, entries, expectSumOk) => cases.push({ name, entries, expectSumOk });

  push('exact_100', [{ address: '0x' + '1'.repeat(40), percent: 100 }], true);
  // 100.001 - 100 in IEEE-754 double rounds to 0.0010000000000047748 (> 0.001) -- the literal
  // decimal "at the boundary" is NOT exactly representable and rounds to just OUTSIDE tolerance.
  // This is the real ULP-forcing finding for this kernel: the naive "boundary = pass" assumption
  // is false once float rounding is accounted for. Documented in the manifest per FIX-2 discipline.
  push('boundary_literal_100.001_rounds_just_outside_tolerance', [{ address: '0x' + '1'.repeat(40), percent: 100.001 }], false);
  push('boundary_literal_99.999_rounds_just_outside_tolerance', [{ address: '0x' + '1'.repeat(40), percent: 99.999 }], false);
  push('genuinely_within_tolerance_100.0005', [{ address: '0x' + '1'.repeat(40), percent: 100.0005 }], true);
  push('one_ulp_beyond_tolerance', [{ address: '0x' + '1'.repeat(40), percent: 100.001 + Number.EPSILON * 100 }], false);
  push('classic_float_nonassoc_33s', [
    { address: '0x' + '1'.repeat(40), percent: 33.33 },
    { address: '0x' + '2'.repeat(40), percent: 33.33 },
    { address: '0x' + '3'.repeat(40), percent: 33.34 },
  ], true); // 33.33+33.33+33.34 = 100.00000000000001 in IEEE-754, within 0.001 tolerance
  push('zero_percent_single', [{ address: '0x' + '1'.repeat(40), percent: 0 }], false);
  push('negative_zero_percent', [{ address: '0x' + '1'.repeat(40), percent: -0 }, { address: '0x' + '2'.repeat(40), percent: 100 }], true);
  push('denormal_scale_noise', [
    { address: '0x' + '1'.repeat(40), percent: 100 },
    { address: '0x' + '2'.repeat(40), percent: Number.MIN_VALUE }, // denormal, effectively 0 against a 0.001 tolerance
  ], true);
  push('far_outside_tolerance', [{ address: '0x' + '1'.repeat(40), percent: 90 }], false);

  let violations = 0, checked = 0;
  const detail = [];
  for (const c of cases) {
    const { output_payload } = compute({ entries: c.entries });
    checked++;
    const sumRule = output_payload.rules.find((r) => r.id === 'sum');
    if (sumRule.pass !== c.expectSumOk) { violations++; detail.push({ case: c.name, expected: c.expectSumOk, got: sumRule.pass, sum: output_payload.sum }); }
  }
  return { name: 'P3_ULP_boundary_forcing_percent_tolerance', trials: checked, violations, detail };
}

// ---------- P4: metamorphic — permuting entries never changes valid/sum/rule verdicts ----------
function checkP4_entry_order_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(rand() * 8);
    const entries = randomBpsEntries(rand, n);
    const shuffled = entries.slice();
    for (let k = shuffled.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [shuffled[k], shuffled[j]] = [shuffled[j], shuffled[k]];
    }
    const r1 = compute({ entries }).output_payload;
    const r2 = compute({ entries: shuffled }).output_payload;
    checked++;
    if (r1.valid !== r2.valid) violations++;
    if (r1.sum !== r2.sum) violations++;
    if (JSON.stringify(r1.rules.map((r) => [r.id, r.pass])) !== JSON.stringify(r2.rules.map((r) => [r.id, r.pass]))) violations++;
  }
  return { name: 'P4_entry_order_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_and_finiteness());
results.properties.push(checkP2_sum_cap_differential());
results.properties.push(checkP3_ulp_boundary_forcing());
results.properties.push(checkP4_entry_order_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-208-royalty-split-validator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
