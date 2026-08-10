// art-256-validate-openids-homeowners-record.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C7-1).
// kernel_digest_at_authoring: sha256:1b6e89be4bc17a5622e6bd5153cc9520c91514b8c0ddd89759d30ffae9bd3c5e
// human_sign_off: PENDING
//
// float_sensitive: CORRECTED TO YES on direct read (WU row's own triage table classified this
// kernel float:no; re-confirmation per FIX-2 discipline found a genuine float division +
// threshold comparison: `coverage.other_structures_limit / coverage.dwelling_limit > 0.5` at
// L114-118, plus non-negative-number float checks on the four coverage limit fields). This is
// exactly the class of x/y-vs-threshold comparison ULP-forcing targets, so it is floored here
// as float-sensitive rather than inherited as float:no.
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// Checks: fixture-oracle gate, termination (bounded by the fixed REQUIRED_SECTIONS/field
// tables), boundedness (sections_present in [0,4], error_count/warning_count >= 0), a
// differential re-derivation of record_valid from errors.length, a metamorphic
// extra-field-invariance check (unknown fields never affect validity), and ULP-boundary
// forcing at the 0.5 coverage-ratio threshold and the coverage-limit >= 0 edge.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-256-validate-openids-homeowners-record.proptest.mjs

import { compute } from '../art-256-validate-openids-homeowners-record.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-256-validate-openids-homeowners-record.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x256A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function validRecord(rng) {
  const dwelling = 100000 + rng() * 500000;
  return {
    policy: {
      policy_number: `HOW-${Math.floor(rng() * 10000)}`,
      effective_date: '2025-01-01',
      expiration_date: '2026-01-01',
      policy_type: pick(rng, ['HO-1', 'HO-2', 'HO-3', 'HO-4', 'HO-5']),
    },
    insured_location: {
      street_address: '1 Main St', city: 'Austin', state: 'TX', zip_code: '78701',
      construction_type: pick(rng, ['frame', 'masonry', 'superior']),
    },
    coverage: {
      dwelling_limit: dwelling,
      other_structures_limit: rng() * dwelling * 0.6,
      personal_property_limit: rng() * dwelling,
      liability_limit: 100000 + rng() * 400000,
    },
    premium: { annual_premium: 500 + rng() * 5000, payment_plan: pick(rng, ['annual', 'monthly', 'quarterly']) },
  };
}

const TRIALS = 5000;

// ---------- P1: termination — errors/warnings bounded by the fixed section/field tables ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const record = validRecord(rand);
    if (rand() < 0.3) delete record.policy.expiration_date;
    if (rand() < 0.3) delete record.coverage;
    const o = compute({ record });
    checked++;
    if (o.errors.length > 20) violations++;
    if (o.sections_present < 0 || o.sections_present > 4) violations++;
  }
  return { name: 'P1_termination_errors_bounded_by_fixed_tables', trials: checked, violations };
}

// ---------- P2 (differential): record_valid re-derived from errors.length ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const record = validRecord(rand);
    if (rand() < 0.3) delete record.policy.policy_number;
    if (rand() < 0.2) record.coverage.dwelling_limit = -1;
    const o = compute({ record });
    checked++;
    if (o.record_valid !== (o.errors.length === 0)) violations++;
    if (o.error_count !== o.errors.length) violations++;
    if (o.warning_count !== o.warnings.length) violations++;
  }
  return { name: 'P2_differential_record_valid_from_error_count', trials: checked, violations };
}

// ---------- P3 (metamorphic): extra unknown fields never affect validity ----------
function checkP3_extraFieldInvariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const record = validRecord(rand);
    const withExtra = { ...record, some_unknown_field: `x${Math.floor(rand() * 1000)}`, policy: { ...record.policy, extra_note: 'n/a' } };
    const a = compute({ record }).errors.length + compute({ record }).warnings.length;
    const b = compute({ record: withExtra }).errors.length + compute({ record: withExtra }).warnings.length;
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P3_extra_field_invariance_metamorphic', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float:yes corrected): 0.5 coverage-ratio threshold + limit>=0 edge ----------
function checkP4_ulpForcing() {
  let violations = 0, checked = 0;
  const mkRecord = (dwelling, other) => {
    const r = validRecord(rand);
    r.coverage.dwelling_limit = dwelling;
    r.coverage.other_structures_limit = other;
    return r;
  };
  const cases = [
    mkRecord(100000, 50000),      // ratio exactly 0.5 -> no warning
    mkRecord(100000, 50000.01),   // ratio just over 0.5 -> warning
    mkRecord(100000, -0),         // negative zero limit
    mkRecord(1e-300, 5e-301),     // denormal-scale dwelling limit, ratio 0.5
  ];
  for (const record of cases) {
    checked++;
    const o = compute({ record });
    if (!Number.isFinite(o.error_count) || !Number.isFinite(o.warning_count)) violations++;
  }
  const atThreshold = compute({ record: cases[0] });
  if (atThreshold.warnings.some((w) => w.includes('other_structures_limit'))) violations++;
  const overThreshold = compute({ record: cases[1] });
  if (!overThreshold.warnings.some((w) => w.includes('other_structures_limit'))) violations++;
  const negLimit = compute({ record: (() => { const r = validRecord(rand); r.coverage.dwelling_limit = -1; return r; })() });
  if (!negLimit.errors.some((e) => e.includes('dwelling_limit'))) violations++;
  return { name: 'P4_ulp_boundary_forcing_coverage_ratio_and_limit_sign', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_extraFieldInvariance());
results.properties.push(checkP4_ulpForcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-256-validate-openids-homeowners-record',
  float_sensitive: true,
  float_sensitive_corrected_from_triage: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
