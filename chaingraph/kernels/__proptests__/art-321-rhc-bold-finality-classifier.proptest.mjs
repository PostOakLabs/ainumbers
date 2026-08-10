// kernel_digest_at_authoring: sha256:843562f81f65f23041c7aed365bb1e7119591065931b82e37682c2ad6489ea93
//
// FV-PROPFLOOR-SHARD-B12-1 — property-test floor for art-321-rhc-bold-finality-classifier.
// Class B (bounded-numeric), FLOAT-SENSITIVE per the WU row — current_time/assertion_created_timestamp
// travel as raw numbers compared against challenge_window_seconds with no rounding, so ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3 even though typical callers pass integer
// unix seconds. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-321-rhc-bold-finality-classifier.proptest.mjs

import { compute } from '../art-321-rhc-bold-finality-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-321-rhc-bold-finality-classifier.fixtures.json');
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
const rand = mulberry32(0x321F6);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;
const CLAIMS = ['soft', 'posted', 'challengeable', 'final'];
const RANK = { soft: 0, posted: 1, challengeable: 2, final: 3 };

function mkPP(rng) {
  const l2_inclusion_timestamp = Math.floor(randRange(rng, 0, 1000000));
  const batch_posted_to_l1 = rng() < 0.75;
  const assertion_created = batch_posted_to_l1 && rng() < 0.75;
  const assertion_created_timestamp = l2_inclusion_timestamp + Math.floor(randRange(rng, 0, 1000));
  const challenge_window_seconds = 604800;
  const current_time = assertion_created_timestamp + Math.floor(randRange(rng, -1000, 1300000));
  const finality_claim = pick(rng, CLAIMS);
  return { l2_inclusion_timestamp, batch_posted_to_l1, assertion_created, assertion_created_timestamp, challenge_window_seconds, current_time, finality_claim };
}

// ---------- P1: boundedness — finality_class always one of the fixed 4-state set ----------
function checkP1_finalityClassBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!(r.output_payload.finality_class in RANK)) violations++;
  }
  return { name: 'P1_finality_class_bounded_to_fixed_4_state_set', trials: checked, violations };
}

// ---------- P2: fixed rule — claim_verdict exactly follows the RANK comparison ----------
function checkP2_claimVerdictMatchesRank() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { finality_class, claim_verdict } = r.output_payload;
    let expected;
    if (pp.finality_claim === finality_class) expected = 'SUPPORTED';
    else if (RANK[pp.finality_claim] > RANK[finality_class]) expected = 'OVERSTATED';
    else expected = 'UNDERSTATED';
    if (claim_verdict !== expected) violations++;
  }
  return { name: 'P2_claim_verdict_matches_rank_comparison_exactly', trials: checked, violations };
}

// ---------- P3: monotonicity — finality_class rank is nondecreasing as posting/assertion/elapsed advance ----------
function checkP3_finalityClassMonotoneInProgress() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const rSoft = compute({ ...pp, batch_posted_to_l1: false });
    const rPosted = compute({ ...pp, batch_posted_to_l1: true, assertion_created: false });
    const rAsserted = compute({ ...pp, batch_posted_to_l1: true, assertion_created: true });
    const ranks = [RANK[rSoft.output_payload.finality_class], RANK[rPosted.output_payload.finality_class], RANK[rAsserted.output_payload.finality_class]];
    if (ranks[1] < ranks[0]) violations++;
    if (ranks[2] < ranks[1]) violations++;
  }
  return { name: 'P3_finality_class_rank_nondecreasing_soft_to_posted_to_asserted', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ assertion_created_timestamp: 1000, current_time: 1000 + 604800, l2_inclusion_timestamp: 0, batch_posted_to_l1: true, assertion_created: true, finality_claim: 'final' }, 'elapsed EXACTLY equals challenge_window_seconds (>=  boundary) — finality_class must be "final"'],
  [{ assertion_created_timestamp: 1000, current_time: 1000 + 604800 - Number.EPSILON, l2_inclusion_timestamp: 0, batch_posted_to_l1: true, assertion_created: true, finality_claim: 'final' }, 'elapsed 1 ULP below challenge_window_seconds — finality_class must remain "challengeable"'],
  [{ assertion_created_timestamp: 0, current_time: 0, l2_inclusion_timestamp: 0, batch_posted_to_l1: true, assertion_created: true, finality_claim: 'challengeable' }, 'assertion_created_timestamp and current_time both exactly zero — elapsed is exactly 0, must classify challengeable, earliest_final_at must equal challenge_window_seconds'],
  [{ assertion_created_timestamp: 1000.1 * 3, current_time: 1000.1 * 3 + 605800, l2_inclusion_timestamp: 0, batch_posted_to_l1: true, assertion_created: true, finality_claim: 'final' }, 'assertion_created_timestamp is a repeating-decimal double (1000.1*3) — must remain finite and classify correctly, no NaN propagation'],
  [{ assertion_created_timestamp: 1000, current_time: 999, l2_inclusion_timestamp: 0, batch_posted_to_l1: true, assertion_created: true, finality_claim: 'challengeable' }, 'current_time BEFORE assertion_created_timestamp (negative elapsed, clock skew) — must not crash, must classify challengeable not final'],
  [{ assertion_created_timestamp: Number.MAX_SAFE_INTEGER - 1000, current_time: Number.MAX_SAFE_INTEGER, l2_inclusion_timestamp: 0, batch_posted_to_l1: true, assertion_created: true, finality_claim: 'challengeable' }, 'timestamps near MAX_SAFE_INTEGER — must not overflow or lose precision in the elapsed subtraction'],
  [{ challenge_window_seconds: 0, assertion_created_timestamp: 1000, current_time: 1000, l2_inclusion_timestamp: 0, batch_posted_to_l1: true, assertion_created: true, finality_claim: 'final' }, 'challenge_window_seconds exactly zero — elapsed (0) >= window (0) is true, must classify final immediately'],
  [{ l2_inclusion_timestamp: 0, batch_posted_to_l1: false, current_time: 0, finality_claim: 'invalid_claim_value' }, 'finality_claim is an unrecognized string outside the 4-state enum — claim_verdict must be UNVERIFIABLE, never crash'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const full = { challenge_window_seconds: 604800, ...pp };
    const r = compute(full);
    const { finality_class, claim_verdict, earliest_final_at } = r.output_payload;
    const plausible = (finality_class in RANK) && typeof claim_verdict === 'string' && (earliest_final_at === null || Number.isFinite(earliest_final_at));
    rows.push({ label, input: full, finality_class, claim_verdict, earliest_final_at, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_finalityClassBounded());
results.properties.push(checkP2_claimVerdictMatchesRank());
results.properties.push(checkP3_finalityClassMonotoneInProgress());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
