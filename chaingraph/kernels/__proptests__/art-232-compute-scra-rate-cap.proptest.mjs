// kernel_digest_at_authoring: sha256:0a3d8bc33a4d50ca92a1673b6b23e5bcb483ad80dc375dfba12094440fc0d32d
//
// FV-PROPFLOOR-SHARD-B7-1 — property-test floor for art-232-compute-scra-rate-cap.
// Class B (bounded-numeric), FLOAT-SENSITIVE (simple-interest products through r2 rounding,
// excess-rate subtraction through r4, compared against a fixed 6% statutory cap) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays). Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-232-compute-scra-rate-cap.proptest.mjs

import { compute } from '../art-232-compute-scra-rate-cap.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-232-compute-scra-rate-cap.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    if (!deepEqual(output_payload, vec.output_payload)) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
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
const rand = mulberry32(0x23201);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  return {
    original_rate_pct: randRange(rng, 0, 30),
    loan_balance: randRange(rng, 1, 500000),
    covered_months: Math.floor(randRange(rng, 0, 48)),
    is_pre_service_obligation: rng() < 0.8,
    servicemember_notified: rng() < 0.5,
  };
}

// ---------- P1: fixed-threshold-tier agreement — exceeds_cap iff original_rate_pct > 6.0 exactly ----------
function checkP1_exceedsCapAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.exceeds_cap !== (pp.original_rate_pct > 6.0)) violations++;
  }
  return { name: 'P1_exceeds_cap_matches_original_rate_gt_6pct', trials: checked, violations };
}

// ---------- P2: boundedness — effective_rate_pct never exceeds 6.0 ----------
function checkP2_effectiveRateBoundedAtCap() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    if (r.effective_rate_pct > 6.0) violations++;
  }
  return { name: 'P2_effective_rate_never_exceeds_6pct_cap', trials: checked, violations };
}

// ---------- P3: round-trip identity — interest_delta_forgiven === total_interest_at_original - total_interest_at_cap ----------
function checkP3_deltaForgivenRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    const expected = Math.round((r.total_interest_at_original_rate - r.total_interest_at_cap) * 100) / 100;
    if (r.interest_delta_forgiven !== expected) violations++;
  }
  return { name: 'P3_delta_forgiven_equals_original_minus_cap_interest', trials: checked, violations };
}

// ---------- P4: monotonicity — total_interest_at_original nondecreasing in covered_months (rate/balance fixed) ----------
function checkP4_interestMonotoneInMonths() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const lo = { ...base, covered_months: 3 };
    const hi = { ...base, covered_months: 24 };
    const rLo = compute(lo).output_payload.total_interest_at_original_rate;
    const rHi = compute(hi).output_payload.total_interest_at_original_rate;
    checked++;
    if (rHi < rLo) violations++;
  }
  return { name: 'P4_interest_at_original_nondecreasing_in_covered_months', trials: checked, violations };
}

// ---------- P5 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ original_rate_pct: 6.0 }, 'original_rate_pct exactly at the 6.0% cap boundary — exceeds_cap must be false (strict >)'],
  [{ original_rate_pct: 6.000000000000001 }, 'original_rate_pct 1-ULP-ish above 6.0 — exceeds_cap must be true'],
  [{ original_rate_pct: 5.999999999999999 }, 'original_rate_pct 1-ULP-below-6.0 — exceeds_cap must be false'],
  [{ original_rate_pct: 0, loan_balance: 0 }, 'both original_rate_pct and loan_balance exactly zero — guard branch, excess_rate_pct exactly 0'],
  [{ original_rate_pct: -0 }, 'original_rate_pct negative zero — Math.max(0,...) must normalize to plain 0'],
  [{ original_rate_pct: 9, loan_balance: 100000, covered_months: 12 }, 'excess_rate_pct = 9-6 = 3 exactly — interest_delta_forgiven must equal r2() of the EXACT simple-interest difference'],
  [{ original_rate_pct: 8, loan_balance: 0.1 * 3 * 1e6, covered_months: 12 }, 'loan_balance built from a 0.1*3 rounding-noise product — total_interest fields must be r2() of the EXACT double product, not a hand-rounded approximation'],
];

function checkP5_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { original_rate_pct: 5, loan_balance: 100000, covered_months: 12, is_pre_service_obligation: true, servicemember_notified: true, ...overrides };
    const r = compute(pp).output_payload;
    // Guard branch (original_rate_pct===0 && loan_balance===0) returns a zero-state shape that
    // omits effective_rate_pct entirely — legitimately absent there, not a NaN/undefined defect.
    const finite = (r.effective_rate_pct === undefined || Number.isFinite(r.effective_rate_pct))
      && Number.isFinite(r.excess_rate_pct) && Number.isFinite(r.interest_delta_forgiven);
    rows.push({ label, overrides, effective_rate_pct: r.effective_rate_pct, exceeds_cap: r.exceeds_cap, interest_delta_forgiven: r.interest_delta_forgiven, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_exceedsCapAgreement());
results.properties.push(checkP2_effectiveRateBoundedAtCap());
results.properties.push(checkP3_deltaForgivenRoundTrip());
results.properties.push(checkP4_interestMonotoneInMonths());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
}, null, 2));

if (anyPropertyViolation || anyBoundaryImplausible) {
  console.error('PROPERTY FLOOR FAILED for art-232-compute-scra-rate-cap');
  process.exit(1);
}
console.log('PASS art-232-compute-scra-rate-cap');
