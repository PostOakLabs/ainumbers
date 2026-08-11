// art-575-tmpg-fails-charge-recompute.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C30-1).
// kernel_digest_at_authoring: sha256:14e3887cf72bab31d7ba429fce3f50695fd92a5bf06a7db441520862bfd55efc
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — the WU row's triage table listed this kernel as float:yes; RE-CONFIRMED BY
// DIRECT READ per FIX-2 and that classification does NOT hold. This is a CORRECTION (yes -> no). The
// kernel's own docstring states "every comparison is exact integer arithmetic" and every field is
// gated through posInt()/nonNegInt()/bpsRate(), all of which require Number.isSafeInteger — there is
// no division producing a fractional quotient compared against a continuous threshold anywhere in
// compute(); roundHalfUpRatio() performs Math.floor(numerator/denominator) where both operands are
// always integers, i.e. an exact-integer-division-with-remainder pattern, the same fixed-point-money
// shape the campaign's own doctrine treats as NOT float-sensitive (BigInt fixed-point money is not
// float-sensitive; this kernel achieves the identical guarantee via Number.isSafeInteger bounds
// instead of BigInt). No ULP-boundary claim is made or needed.
// ⚠ ONE GENUINE RISK REMAINS, DISTINCT FROM ULP FORCING: unlike its sibling money kernel art-579 in
// this same shard (which explicitly caps every multiplicand via MAX_VALUE_MINOR/MAX_RATE_BPS so no
// product can approach 2^53), this kernel places NO magnitude cap on par_amount_minor or days_failed
// beyond Number.isSafeInteger — so rate_diff_bps * par_amount_minor * days_failed can exceed
// Number.MAX_SAFE_INTEGER (2^53) for large-but-individually-valid inputs, at which point the
// multiplication itself (not the division) has already lost precision. This is a BOUNDEDNESS/overflow
// concern (class C floor property), not a continuous-threshold ULP-forcing concern (there is no 0/-0/
// denormal/x·y÷y≠x case to force on integer-only inputs), so it is floored here as P5's forced
// large-magnitude boundary case rather than fabricated as ULP forcing around a threshold that does
// not exist in this kernel.
// Checks: fixture-oracle gate, termination (P1: determinations.length bounded by well-formed fails,
// truncated at MAX_FAILS=500), boundedness (P2: every recomputed_charge_minor is a non-negative
// integer, total_recomputed_charge_minor is the exact sum of per-fail recomputed charges), a
// differential re-derivation of the rate_diff_bps/recomputed_charge_minor/verdict formula against an
// independent reimplementation (P3), a metamorphic permutation-invariance identity over
// distinct-fail_id inputs (P4: totals and overall verdict are order-independent since summation and
// per-fail verdicts do not depend on array position), and forced categorical boundary cases including
// the CAP_BPS=300 zero-charge boundary, the near-Number.MAX_SAFE_INTEGER overflow probe named above,
// and the missing-tolerance did-not-run path (P5).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-575-tmpg-fails-charge-recompute.proptest.mjs

import { compute } from '../art-575-tmpg-fails-charge-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-575-tmpg-fails-charge-recompute.fixtures.json');
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
const rand = mulberry32(0x575C30);

function randomFail(rng, id) {
  return {
    fail_id: id,
    par_amount_minor: 1 + Math.floor(rng() * 50_000_000),
    days_failed: 1 + Math.floor(rng() * 90),
    reference_rate_bps: Math.floor(rng() * 400), // can exceed the 300 cap, exercising max(0, ...)
    claimed_charge_minor: rng() < 0.9 ? Math.floor(rng() * 20_000) : undefined,
  };
}
function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  const fails = Array.from({ length: n }, (_, i) => randomFail(rng, `F-${i}`));
  return {
    diff_tolerance_minor: rng() < 0.9 ? Math.floor(rng() * 50) : undefined,
    fails,
  };
}

// Independent reimplementation of the rate/charge/verdict formula, for the differential check (P3).
const CAP_BPS = 300, DAY_COUNT = 360;
function roundHalfUpRatioRef(numerator, denominator) {
  const q = Math.floor(numerator / denominator);
  const r = numerator - q * denominator;
  return (r * 2 >= denominator) ? q + 1 : q;
}
function reimplement(pp) {
  const tol = pp.diff_tolerance_minor;
  if (typeof tol !== 'number' || !Number.isSafeInteger(tol) || tol < 0) return null;
  const dets = [];
  for (const f of pp.fails) {
    const rateDiff = Math.max(0, CAP_BPS - f.reference_rate_bps);
    const numerator = rateDiff * f.par_amount_minor * f.days_failed;
    const denom = 10000 * DAY_COUNT;
    const recomputed = roundHalfUpRatioRef(numerator, denom);
    let verdict;
    if (f.claimed_charge_minor === undefined) verdict = 'INDETERMINATE';
    else verdict = Math.abs(recomputed - f.claimed_charge_minor) <= tol ? 'MATCHES' : 'DIVERGES';
    dets.push({ recomputed, verdict });
  }
  return dets;
}

const TRIALS = 3000;

// ---------- P1: termination — determinations bounded by well-formed fails, never exceeds MAX_FAILS ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.determinations.length > pp.fails.length) violations++;
    if (o.determinations.length > 500) violations++;
    if (o.decision.execution_state === 'ran' && o.determinations.length !== pp.fails.length) violations++;
  }
  return { name: 'P1_termination_determinations_bounded', trials: checked, violations };
}

// ---------- P2: boundedness — recomputed charges non-negative integers, total is exact sum ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.decision.execution_state !== 'ran') continue;
    let sum = 0;
    for (const d of o.determinations) {
      if (!Number.isSafeInteger(d.recomputed_charge_minor) || d.recomputed_charge_minor < 0) violations++;
      sum += d.recomputed_charge_minor;
    }
    if (sum !== o.total_recomputed_charge_minor) violations++;
  }
  return { name: 'P2_boundedness_nonneg_integer_charges_exact_total', trials: checked, violations };
}

// ---------- P3: differential — rate/charge/verdict formula re-derived against an independent reimplementation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.decision.execution_state !== 'ran') continue;
    const expected = reimplement(pp);
    if (!expected) { violations++; continue; }
    if (expected.length !== o.determinations.length) { violations++; continue; }
    for (let j = 0; j < expected.length; j++) {
      if (expected[j].recomputed !== o.determinations[j].recomputed_charge_minor) violations++;
      if (expected[j].verdict !== o.determinations[j].verdict) violations++;
    }
  }
  return { name: 'P3_rate_charge_verdict_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance over distinct fail_ids ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    if (pp.fails.length < 2) continue;
    const shuffled = { ...pp, fails: [...pp.fails].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (a.verdict !== b.verdict) violations++;
    if (a.total_recomputed_charge_minor !== b.total_recomputed_charge_minor) violations++;
    if (a.total_claimed_charge_minor !== b.total_claimed_charge_minor) violations++;
  }
  return { name: 'P4_permutation_invariance_distinct_fail_ids', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // tolerance absent -> did_not_run
  { const { output_payload: o } = compute({ fails: [{ fail_id: 'a', par_amount_minor: 100, days_failed: 1, reference_rate_bps: 0 }] }); checked++; if (o.decision.execution_state !== 'did_not_run') violations++; if (o.verdict !== 'INDETERMINATE') violations++; }
  // reference_rate_bps === CAP_BPS -> rate_diff_bps = 0 -> recomputed charge = 0 exactly
  { const { output_payload: o } = compute({ diff_tolerance_minor: 0, fails: [{ fail_id: 'a', par_amount_minor: 999999, days_failed: 30, reference_rate_bps: 300, claimed_charge_minor: 0 }] }); checked++; if (o.determinations[0].recomputed_charge_minor !== 0) violations++; if (o.determinations[0].verdict !== 'MATCHES') violations++; }
  // reference_rate_bps === 0 -> rate_diff_bps = 300 (max); numerator = 300*3,600,000*1 = 1,080,000,000,
  // denom = 3,600,000 -> exact quotient 300, no remainder.
  { const { output_payload: o } = compute({ diff_tolerance_minor: 0, fails: [{ fail_id: 'a', par_amount_minor: 3600000, days_failed: 1, reference_rate_bps: 0, claimed_charge_minor: 300 }] }); checked++; if (!Number.isSafeInteger(o.determinations[0].recomputed_charge_minor)) violations++; if (o.determinations[0].recomputed_charge_minor !== 300) violations++; }
  // overflow-magnitude probe: par_amount_minor near Number.MAX_SAFE_INTEGER with a nonzero rate/day
  // count -- the multiplication genuinely exceeds 2^53 here. This is NOT a business-realistic input
  // (a >$9 quadrillion fail par amount), but the kernel places no upper cap beyond safe-integer-ness,
  // so the floor documents the observed behavior rather than assuming it: the kernel must still
  // return a finite, non-NaN, deterministic integer -- never throw, never NaN -- even though the
  // returned figure may not equal the true (unrepresentable) mathematical charge.
  {
    const bigPar = Number.MAX_SAFE_INTEGER - 7;
    const { output_payload: o } = compute({ diff_tolerance_minor: 0, fails: [{ fail_id: 'a', par_amount_minor: bigPar, days_failed: 5, reference_rate_bps: 100 }] });
    checked++;
    const rc = o.determinations[0].recomputed_charge_minor;
    if (!Number.isFinite(rc) || Number.isNaN(rc)) violations++;
    // Determinism under the same overflowing input: calling compute() again must reproduce the same result.
    const { output_payload: o2 } = compute({ diff_tolerance_minor: 0, fails: [{ fail_id: 'a', par_amount_minor: bigPar, days_failed: 5, reference_rate_bps: 100 }] });
    if (o2.determinations[0].recomputed_charge_minor !== rc) violations++;
  }
  // duplicate fail_id -> second occurrence rejected, not double-counted
  { const { output_payload: o } = compute({ diff_tolerance_minor: 0, fails: [{ fail_id: 'dup', par_amount_minor: 100, days_failed: 1, reference_rate_bps: 0, claimed_charge_minor: 8 }, { fail_id: 'dup', par_amount_minor: 200, days_failed: 1, reference_rate_bps: 0, claimed_charge_minor: 17 }] }); checked++; if (o.fail_count !== 1) violations++; if (o.rejected_inputs.length !== 1) violations++; }
  return { name: 'P5_forced_categorical_boundary_and_overflow_probe', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-575-tmpg-fails-charge-recompute',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
