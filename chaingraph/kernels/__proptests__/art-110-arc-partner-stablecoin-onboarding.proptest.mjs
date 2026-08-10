// art-110-arc-partner-stablecoin-onboarding.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C2-1).
// kernel_digest_at_authoring: sha256:4c76567c95da056626e68881f858c95c745ad333d94f0fbe078b53ac95ca3f49
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (Math.round of integer-ratio percentages only, per WU row's declared exception).
// Checks: fixture-oracle gate, termination (gap arrays bounded by the 3 known requirement lists),
// boundedness of tech/reserve/risk/composite scores in [0,100], grade/eligible/verdict differential
// re-derivation, and permutation-invariance of the input capability arrays (Set-based scoring).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-110-arc-partner-stablecoin-onboarding.proptest.mjs

import { compute } from '../art-110-arc-partner-stablecoin-onboarding.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const REQUIRED_TECH_CAPS = ['evm_compatibility', 'mint_burn_api', 'on_chain_attestation', 'iso20022_messaging'];
const REQUIRED_RESERVE_COMPOSITION = ['liquid_sovereign', 'cash_equivalent'];
const REQUIRED_RISK_CONTROLS = ['aml_screening', 'transaction_monitoring', 'sanctions_screening'];
const GRADE_THRESHOLDS = [{ min: 90, grade: 'A' }, { min: 75, grade: 'B' }, { min: 60, grade: 'C' }, { min: 45, grade: 'D' }, { min: 0, grade: 'F' }];

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-110-arc-partner-stablecoin-onboarding.fixtures.json');
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
const rand = mulberry32(0xA10A2);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function randomSubset(rng, list) {
  return shuffle(rng, list.slice()).slice(0, Math.floor(rng() * (list.length + 1)));
}

function randomProfile(rng) {
  return {
    issuer_profile: {
      ccy: pick(rng, ['EURC', 'JPYC', 'BRLA', 'MXNB']),
      reserve_composition: randomSubset(rng, REQUIRED_RESERVE_COMPOSITION),
      attestation_cadence: pick(rng, ['monthly', 'quarterly', 'none']),
      risk_mgmt_controls: randomSubset(rng, REQUIRED_RISK_CONTROLS),
      technical_caps: randomSubset(rng, REQUIRED_TECH_CAPS),
      home_regime: pick(rng, ['MiCA-EMT', 'JP-PSA-FSA', 'unknown']),
    },
  };
}

const TRIALS = 5000;

// ---------- P1: termination — gap counts bounded by their known requirement-list sizes ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomProfile(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.gaps.length > REQUIRED_TECH_CAPS.length + REQUIRED_RESERVE_COMPOSITION.length + REQUIRED_RISK_CONTROLS.length) violations++;
  }
  return { name: 'P1_termination_bounded_gaps', trials: checked, violations };
}

// ---------- P2: boundedness — every score component in [0,100] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomProfile(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const v of [output_payload.tech_score, output_payload.reserve_score, output_payload.risk_score, output_payload.composite_grade]) {
      if (v < 0 || v > 100 || !Number.isFinite(v)) violations++;
    }
  }
  return { name: 'P2_boundedness_scores_0_100', trials: checked, violations };
}

// ---------- P3 (differential): grade/eligible/verdict re-derivation from composite_grade ----------
function checkP3_grade_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomProfile(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedComposite = Math.round((output_payload.tech_score + output_payload.reserve_score + output_payload.risk_score) / 3);
    if (output_payload.composite_grade !== expectedComposite) violations++;
    const expectedGrade = (GRADE_THRESHOLDS.find((t) => output_payload.composite_grade >= t.min) || { grade: 'F' }).grade;
    if (output_payload.grade !== expectedGrade) violations++;
    const expectedEligible = expectedGrade === 'A' || expectedGrade === 'B';
    if (output_payload.eligible !== expectedEligible) violations++;
    if (output_payload.verdict !== (expectedEligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE')) violations++;
  }
  return { name: 'P3_grade_verdict_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of the capability arrays (Set-based scoring) ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomProfile(rand);
    const shuffled = {
      issuer_profile: {
        ...pp.issuer_profile,
        reserve_composition: shuffle(rand, pp.issuer_profile.reserve_composition),
        risk_mgmt_controls: shuffle(rand, pp.issuer_profile.risk_mgmt_controls),
        technical_caps: shuffle(rand, pp.issuer_profile.technical_caps),
      },
    };
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.tech_score !== r2.tech_score || r1.reserve_score !== r2.reserve_score || r1.risk_score !== r2.risk_score || r1.grade !== r2.grade) violations++;
  }
  return { name: 'P4_permutation_invariance_capability_arrays', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_grade_differential());
results.properties.push(checkP4_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-110-arc-partner-stablecoin-onboarding',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
