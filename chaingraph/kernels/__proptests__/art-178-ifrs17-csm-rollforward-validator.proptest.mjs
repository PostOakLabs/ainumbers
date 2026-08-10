// kernel_digest_at_authoring: sha256:6d63a964418acbc17998ddac7014b0d42e3a09197ea4e1ffe32feeea586fb11f
//
// FV-PROPFLOOR-SHARD-B4-1 — property-test floor for art-178-ifrs17-csm-rollforward-validator.
// Class B (bounded-numeric), FLOAT-SENSITIVE — six raw doubles are summed and compared
// against a zero threshold to classify onerous/loss_component, a real-valued arithmetic
// boundary — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero
// external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the
// B1/B2/B3 float harness (art-15/art-107). This file is READ-ONLY with respect to the
// kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-178-ifrs17-csm-rollforward-validator.proptest.mjs

import { compute } from '../art-178-ifrs17-csm-rollforward-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-178-ifrs17-csm-rollforward-validator.fixtures.json');
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
const rand = mulberry32(0x17801);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  return {
    csm: {
      opening_csm: randRange(rng, -500, 5000),
      new_business_csm: randRange(rng, -500, 2000),
      interest_accretion: randRange(rng, -200, 500),
      experience_adjustments: randRange(rng, -2000, 2000),
      release_to_profit: randRange(rng, -500, 1500),
      fx_adjustments: randRange(rng, -300, 300),
    },
  };
}

function rawClosing(csm) {
  return csm.opening_csm + csm.new_business_csm + csm.interest_accretion + csm.experience_adjustments - csm.release_to_profit + csm.fx_adjustments;
}

// ---------- P1: boundedness — closing_csm is never negative regardless of the raw sum ----------
function checkP1_closingNeverNegative() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.closing_csm < 0) violations++;
  }
  return { name: 'P1_boundedness_closing_csm_never_negative', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — onerous exactly iff raw computed_closing < 0, loss_component = |min(raw,0)| ----------
function checkP2_onerousAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const raw = rawClosing(pp.csm);
    const expectedOnerous = raw < 0;
    if (r.output_payload.onerous !== expectedOnerous) violations++;
    const expectedLoss = expectedOnerous ? Math.abs(raw) : 0;
    if (r.output_payload.loss_component !== expectedLoss) violations++;
    const expectedClosing = expectedOnerous ? 0 : raw;
    if (r.output_payload.closing_csm !== expectedClosing) violations++;
  }
  return { name: 'P2_onerous_and_loss_component_match_raw_zero_threshold', trials: checked, violations };
}

// ---------- P3: round-trip identity — the 6 individual echoed fields equal the finite raw inputs exactly ----------
function checkP3_fieldsRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.opening_csm !== pp.csm.opening_csm) violations++;
    if (op.new_business_csm !== pp.csm.new_business_csm) violations++;
    if (op.interest_accretion !== pp.csm.interest_accretion) violations++;
    if (op.experience_adjustments !== pp.csm.experience_adjustments) violations++;
    if (op.release_to_profit !== pp.csm.release_to_profit) violations++;
    if (op.fx_adjustments !== pp.csm.fx_adjustments) violations++;
  }
  return { name: 'P3_six_csm_fields_roundtrip_exact_for_finite_input', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing on the computed_closing < 0 threshold ----------
const ULP_BOUNDARY_CASES = [
  [{ opening_csm: 0, new_business_csm: 0, interest_accretion: 0, experience_adjustments: 0, release_to_profit: 0, fx_adjustments: 0 }, 'all-zero inputs — computed_closing exactly 0, onerous must be false (strict < 0)'],
  [{ opening_csm: 100, experience_adjustments: -100, release_to_profit: 0 }, 'sum exactly zero via cancellation (100-100) — onerous must be false'],
  [{ opening_csm: 100, experience_adjustments: -100.00000000000001, release_to_profit: 0 }, '1-ULP-below-zero sum — onerous must become true, loss_component tiny but nonzero'],
  [{ opening_csm: -0, new_business_csm: 0, interest_accretion: 0, experience_adjustments: 0, release_to_profit: 0, fx_adjustments: 0 }, 'negative-zero opening_csm — must behave as zero, onerous false, no -0 artifact in closing_csm'],
  [{ opening_csm: Number.MIN_VALUE, experience_adjustments: 0, release_to_profit: 0 }, 'smallest positive double as opening_csm — onerous must be false, closing_csm must remain that tiny positive value'],
  [{ opening_csm: 0.1, new_business_csm: 0.2, release_to_profit: 0.3 }, '0.1+0.2-0.3 classic non-exact double rounding artifact near zero — must classify consistently with the actual double sum, no throw'],
  [{ experience_adjustments: -1 / 3 * 3 }, '-(1/3)*3 rounding artifact — must round-trip the exact double, onerous per the exact double sign'],
  [{ opening_csm: Number.MAX_SAFE_INTEGER, experience_adjustments: -Number.MAX_SAFE_INTEGER }, 'MAX_SAFE_INTEGER cancellation — must not overflow or lose precision, closing_csm near zero'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const csm = { opening_csm: 0, new_business_csm: 0, interest_accretion: 0, experience_adjustments: 0, release_to_profit: 0, fx_adjustments: 0, ...overrides };
    const r = compute({ csm });
    const { closing_csm, onerous, loss_component } = r.output_payload;
    const finite = Number.isFinite(closing_csm) && Number.isFinite(loss_component) && typeof onerous === 'boolean' && closing_csm >= 0;
    rows.push({ label, csm, closing_csm, onerous, loss_component, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_closingNeverNegative());
results.properties.push(checkP2_onerousAgreement());
results.properties.push(checkP3_fieldsRoundTrip());
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
