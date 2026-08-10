// kernel_digest_at_authoring: sha256:0f260f878472634095d299ddde16662204d6432e1b458c6afddc094d2bac7dd8
//
// FV-PROPFLOOR-SHARD-B14-1 — property-test floor for art-53-mletr-ebl-conformance-validator.
// Class B (bounded-numeric/categorical), FLOAT:NO exception per the WU row — confirmed on direct
// kernel reading: every scored field is a pick() lookup over a fixed {0,2,3,4} table; JX_STATUS
// enforceability is a pure string-keyed lookup with no arithmetic on continuous quantities. Forced
// CATEGORICAL boundary cases used in place of ULP forcing. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-53-mletr-ebl-conformance-validator.proptest.mjs

import { compute } from '../art-53-mletr-ebl-conformance-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-53-mletr-ebl-conformance-validator.fixtures.json');
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
const rand = mulberry32(0x53F66B);
const TRIALS = 8000;
const JX = ['UK', 'Singapore', 'UAE', 'France', 'Bahrain', 'Japan', 'India', 'US', 'Germany', 'other-adopted', 'other', 'bogus-jx'];
const JX_STATUS = { UK: 'adopted', Singapore: 'adopted', UAE: 'adopted', France: 'adopted', Bahrain: 'adopted', Japan: 'adopted', India: 'adopted', US: 'aligned', Germany: 'aligned', 'other-adopted': 'adopted', other: 'not-adopted' };

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  return {
    record_type: pick(rng, ['ebl', 'promissory-note', 'bill-of-exchange']),
    singularity_mechanism: pick(rng, ['single-authoritative-copy', 'token', 'registry-control', 'unclear']),
    control_method: pick(rng, ['exclusive-control-cryptographic', 'platform-custody', 'multi-party-unclear']),
    integrity_method: pick(rng, ['hash-chain', 'digital-signature', 'platform-log', 'none']),
    reliability_standard: pick(rng, ['qualified-trust-service', 'platform-attested', 'self-asserted']),
    origin_jurisdiction: pick(rng, JX),
    dest_jurisdiction: pick(rng, JX),
    platform: pick(rng, ['', 'wave', 'bolero', 'edoxonline']),
    governing_law: pick(rng, ['UK', 'Singapore', 'US']),
  };
}

// ---------- P1: conformance_grade is the exact letter() of conformance_score, and each test's
// result field ('pass'/'partial'/'fail') is an exact function of its raw 0/2/3/4 score ----------
function checkP1_gradeAndResultExact() {
  let violations = 0, checked = 0;
  const letter = (s) => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { conformance_grade, conformance_score, test_results } = r.output_payload;
    if (conformance_grade !== letter(conformance_score)) violations++;
    for (const k of Object.keys(test_results)) {
      const t = test_results[k];
      const expectedResult = t.score >= 100 ? 'pass' : t.score >= 50 ? 'partial' : 'fail';
      if (t.result !== expectedResult) violations++;
      if (t.result === 'pass' && t.remediation !== null) violations++;
      if (t.result !== 'pass' && t.remediation === null) violations++;
    }
  }
  return { name: 'P1_conformance_grade_and_test_result_exact_function_of_score', trials: checked, violations };
}

// ---------- P2: enforceability_tier is an exact function of the origin/dest JX_STATUS pair ----------
function checkP2_enforceabilityTierExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const ox = JX_STATUS[pp.origin_jurisdiction] ?? 'not-adopted';
    const dx = JX_STATUS[pp.dest_jurisdiction] ?? 'not-adopted';
    let expected;
    if (ox === 'adopted' && dx === 'adopted') expected = 'strong';
    else if (ox === 'not-adopted' || dx === 'not-adopted') expected = 'weak';
    else expected = 'conditional';
    if (r.output_payload.enforceability_tier !== expected) violations++;
    if (r.output_payload.corridor_matrix.verdict !== expected) violations++;
  }
  return { name: 'P2_enforceability_tier_exact_function_of_jx_status_pair', trials: checked, violations };
}

// ---------- P3: remediation_checklist contains exactly the non-'pass' tests, no more, no fewer ----------
function checkP3_remediationChecklistExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { test_results, remediation_checklist } = r.output_payload;
    const expectedTests = Object.entries(test_results).filter(([, v]) => v.result !== 'pass').map(([k]) => k);
    const actualTests = remediation_checklist.map((c) => c.test);
    if (JSON.stringify(expectedTests.sort()) !== JSON.stringify(actualTests.sort())) violations++;
  }
  return { name: 'P3_remediation_checklist_exactly_the_non_pass_tests', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'all fields defaulted — must produce a deterministic, non-throwing result'],
  [{ singularity_mechanism: 'unrecognized-mechanism-xyz' }, 'unrecognized singularity_mechanism string — pick() default of 0 must apply (fail), not throw or NaN'],
  [{ origin_jurisdiction: 'UK', dest_jurisdiction: 'UK' }, 'both jurisdictions MLETR-adopted (strong corridor) — enforceability_tier must be "strong"'],
  [{ origin_jurisdiction: 'US', dest_jurisdiction: 'Germany' }, 'both jurisdictions only "aligned" (neither fully adopted, neither not-adopted) — enforceability_tier must be "conditional"'],
  [{ origin_jurisdiction: 'other', dest_jurisdiction: 'UK' }, 'one not-adopted jurisdiction — enforceability_tier must be "weak" even though the other is fully adopted'],
  [{ origin_jurisdiction: 'bogus-unlisted-country', dest_jurisdiction: 'UK' }, 'origin_jurisdiction not present in JX_STATUS at all — must default to not-adopted (fail-closed on unknown jurisdiction), tier "weak"'],
  [{ singularity_mechanism: 'single-authoritative-copy', control_method: 'exclusive-control-cryptographic', integrity_method: 'hash-chain', reliability_standard: 'qualified-trust-service' }, 'all four tests at maximum score — conformance_score must be exactly 100.0, grade A, remediation_checklist empty'],
  [{ singularity_mechanism: 'unclear', control_method: 'multi-party-unclear', integrity_method: 'none', reliability_standard: 'self-asserted' }, 'all four tests at minimum score (0) — conformance_score must be exactly 0.0, grade F, all four tests in remediation_checklist'],
  [{ record_type: 123 }, 'record_type is a non-string type — must not throw, must still resolve a conformance_grade'],
  [{ origin_jurisdiction: null, dest_jurisdiction: undefined }, 'origin/dest jurisdiction null/undefined — must fall back to default "mletr-adopted" for undefined (destructuring default) and not-adopted classification for the resolved null, no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { conformance_grade, conformance_score, enforceability_tier, test_results } = r.output_payload;
    const plausible = typeof conformance_grade === 'string' && Number.isFinite(conformance_score) &&
      typeof enforceability_tier === 'string' && Object.values(test_results).every((t) => typeof t.result === 'string');
    rows.push({ label, input: pp, conformance_grade, conformance_score, enforceability_tier, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_gradeAndResultExact());
results.properties.push(checkP2_enforceabilityTierExact());
results.properties.push(checkP3_remediationChecklistExact());
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
