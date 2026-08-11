// art-378-quarterly-test-evidence-composer.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C17-1).
// kernel_digest_at_authoring: sha256:4110cf70767dc5ed8b26fc3543ef15d71239a5f52a8e9396832ac105f212de32
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO -- re-confirmed by direct read: `pass_rate = passed/total` is the only
// division in the kernel, used ONLY in a sign comparison (`delta < 0`), never an equality or
// ULP-sensitive threshold compare -- no forced boundary-value class applies. Forced CATEGORICAL
// boundary cases used instead (below).
// Checks: fixture-oracle gate, termination (unbounded tests array -- bound is array length),
// boundedness (pass_rate in [0,1] or null when total===0, per_test.length===total always),
// metamorphic (tests-array permutation invariance of total/passed/pass_rate -- counts are
// order-independent), forced categorical boundary cases (empty tests array => pass_rate null,
// forbidden determinism_class coerced to 'estimated' + flagged, chain tamper detection via
// declared_prior_pack_digest mismatch, regression sign detection, ha_evidence_bundle only
// assembled when subject_hash is declared).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-378-quarterly-test-evidence-composer.proptest.mjs

import { compute } from '../art-378-quarterly-test-evidence-composer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-378-quarterly-test-evidence-composer.fixtures.json');
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
const rand = mulberry32(0x378D0);

const CLASSES = ['bit-exact', 'replayable', 'seeded-stochastic', 'estimated', 'deterministic'];

function randomTest(rng, i) {
  const determinism_class = CLASSES[Math.floor(rng() * CLASSES.length)];
  return { test_id: `t${i}`, determinism_class, status: rng() > 0.2 ? 'pass' : 'fail', receipt_digest: `sha256:${'a'.repeat(64)}` };
}

function randomPP(rng, n) {
  const tests = [];
  for (let i = 0; i < n; i++) tests.push(randomTest(rng, i));
  return { quarter: '2026-Q1', aiuc_version: '2026-Q1', suite: { suite_id: 's', suite_version: '1.0.0' }, tests };
}

const TRIALS = 2000;

// ---------- P1: termination — unbounded tests array, bound is array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 5, 50, 500];
  for (const n of sizes) {
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.per_test.length !== n || output_payload.total !== n) violations++;
  }
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.per_test.length !== n) violations++;
  }
  return { name: 'P1_termination_array_length_bound', trials: checked, violations };
}

// ---------- P2: boundedness — pass_rate in [0,1] or null, counts consistent ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand, Math.floor(rand() * 15));
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.total === 0) {
      if (output_payload.pass_rate !== null) violations++;
    } else {
      if (output_payload.pass_rate < 0 || output_payload.pass_rate > 1) violations++;
    }
    if (output_payload.passed > output_payload.total) violations++;
  }
  return { name: 'P2_boundedness_pass_rate_and_counts', trials: checked, violations };
}

// ---------- P3: metamorphic — tests-array permutation invariance of total/passed/pass_rate ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS / 3; i++) {
    const n = 2 + Math.floor(rand() * 10);
    const pp = randomPP(rand, n);
    const shuffled = { ...pp, tests: [...pp.tests].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (a.total !== b.total) violations++;
    if (a.passed !== b.passed) violations++;
    if (a.pass_rate !== b.pass_rate) violations++;
  }
  return { name: 'P3_permutation_invariance_of_totals', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float_sensitive: no) ----------
function checkP4_categorical_boundaries() {
  let violations = 0, checked = 0;

  // empty tests -> pass_rate null, claim strength insufficient
  {
    const { output_payload } = compute({ quarter: 'q', tests: [] });
    checked++;
    if (output_payload.pass_rate !== null) violations++;
    if (output_payload.pack_claim_strength !== 'insufficient') violations++;
  }

  // forbidden determinism_class -> coerced to 'estimated' + flagged
  {
    const { output_payload, compliance_flags } = compute({ quarter: 'q', tests: [{ test_id: 't1', determinism_class: 'not-a-real-class', status: 'pass' }] });
    checked++;
    if (output_payload.per_test[0].determinism_class !== 'estimated') violations++;
    if (!output_payload.per_test[0].coerced_from_forbidden_class) violations++;
    if (!compliance_flags.includes('AU2_DETERMINISM_CLASS_COERCED')) violations++;
  }

  // chain tamper detection
  {
    const { output_payload, compliance_flags } = compute({
      quarter: 'q', tests: [{ test_id: 't1', determinism_class: 'deterministic', status: 'pass' }],
      prior_quarter: { quarter: 'q-1', pack_digest: 'sha256:AAA', pass_rate: 0.9 },
      declared_prior_pack_digest: 'sha256:BBB', // mismatch -- deliberate tamper case
    });
    checked++;
    if (output_payload.chain_intact !== false) violations++;
    if (output_payload.tamper_detected !== true) violations++;
    if (output_payload.pack_claim_strength !== 'chain-broken') violations++;
    if (!compliance_flags.includes('AU2_CHAIN_TAMPER_DETECTED')) violations++;
  }

  // regression sign detection
  {
    const { output_payload, compliance_flags } = compute({
      quarter: 'q', tests: [{ test_id: 't1', determinism_class: 'deterministic', status: 'fail' }],
      prior_quarter: { quarter: 'q-1', pack_digest: 'sha256:AAA', pass_rate: 0.9 },
      declared_prior_pack_digest: 'sha256:AAA',
    });
    checked++;
    if (output_payload.regression.regressed !== true) violations++;
    if (!(output_payload.regression.delta < 0)) violations++;
    if (!compliance_flags.includes('AU2_REGRESSION_DETECTED')) violations++;
  }

  // ha_evidence_bundle only assembled when subject_hash declared
  {
    const withoutSubject = compute({ quarter: 'q', tests: [{ test_id: 't1', determinism_class: 'deterministic', status: 'pass', receipt_digest: 'sha256:x' }] });
    const withSubject = compute({ quarter: 'q', subject_hash: 'sha256:subj', tests: [{ test_id: 't1', determinism_class: 'deterministic', status: 'pass', receipt_digest: 'sha256:x' }] });
    checked++;
    if (withoutSubject.output_payload.ha_evidence_bundle !== null) violations++;
    if (withSubject.output_payload.ha_evidence_bundle === null) violations++;
    if (!withSubject.compliance_flags.includes('AU2_HA_EVIDENCE_BUNDLE_ASSEMBLED')) violations++;
  }

  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-378-quarterly-test-evidence-composer',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
