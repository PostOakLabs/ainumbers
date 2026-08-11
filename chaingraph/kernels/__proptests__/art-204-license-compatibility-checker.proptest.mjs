// art-204-license-compatibility-checker.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C6-1).
// kernel_digest_at_authoring: sha256:bfd5a5f39b32798e40fc9cc82a2029d902936a511baf42cbd99668b985cf56ae
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — a fixed static LICENSE_DB lookup, boolean rule
// checks only, no arithmetic at all).
// Checks: fixture-oracle gate, termination (checks array bounded by a fixed constant <=6, never by
// caller string length), boundedness (compatible is always true/false/null, reason_codes drawn from
// a fixed 5-code set), differential re-derivation of `compatible` from the presence of any reason
// code, and metamorphic same-license reflexivity (parent_license === child_license, both known,
// never trips SA_REQUIRES_SAME_LICENSE or PIL_RECIPROCAL_MISMATCH, since sameId is always true).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-204-license-compatibility-checker.proptest.mjs

import { compute } from '../art-204-license-compatibility-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-204-license-compatibility-checker.fixtures.json');
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
const rand = mulberry32(0x2040A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const KNOWN_LICENSES = [
  'CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-ND-4.0', 'CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0', 'CC-BY-NC-ND-4.0',
  'PIL-NC-SOCIAL', 'PIL-COMMERCIAL', 'PIL-COMMERCIAL-REMIX',
  'CBE-CC0', 'CBE-ECR', 'CBE-NECR', 'CBE-NECR-HS', 'CBE-PR', 'CBE-PR-HS',
  'EMBEDDED-PRIVATE-NC', 'EMBEDDED-PERSONAL-NC', 'EMBEDDED-PUBLIC-NC', 'EMBEDDED-REPRODUCTION-COMMERCIAL',
];
const REASON_CODES = new Set(['ND_BLOCKS_DERIVATIVE', 'SA_REQUIRES_SAME_LICENSE', 'NC_BLOCKS_COMMERCIAL', 'PIL_RECIPROCAL_MISMATCH', 'CBE_PERSONAL_NO_DERIVATIVE']);

function randomLicenseOrJunk(rng) {
  if (rng() < 0.85) return pick(rng, KNOWN_LICENSES);
  return `JUNK-${Math.floor(rng() * 1e6)}`;
}

const TRIALS = 5000;

// ---------- P1: termination — checks.length bounded by a fixed constant, never caller-size-dependent ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const parent_license = randomLicenseOrJunk(rand);
    const child_license = randomLicenseOrJunk(rand);
    const { output_payload } = compute({ parent_license, child_license });
    checked++;
    if (output_payload.checks.length > 6) violations++;
  }
  return { name: 'P1_termination_checks_bounded_6', trials: checked, violations };
}

// ---------- P2 (differential): `compatible` re-derivation from reason_codes/known-flags ----------
function checkP2_compatible_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const parent_license = randomLicenseOrJunk(rand);
    const child_license = randomLicenseOrJunk(rand);
    const { output_payload } = compute({ parent_license, child_license });
    checked++;
    const parentKnown = KNOWN_LICENSES.includes(parent_license);
    const childKnown = KNOWN_LICENSES.includes(child_license);
    if (!parentKnown || !childKnown) {
      if (output_payload.compatible !== null) violations++;
      continue;
    }
    const expectedCompatible = output_payload.reason_codes.length === 0;
    if (output_payload.compatible !== expectedCompatible) violations++;
  }
  return { name: 'P2_compatible_differential_from_reason_codes', trials: checked, violations };
}

// ---------- P3: boundedness — reason_codes drawn only from the fixed 5-code set ----------
function checkP3_reason_codes_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const parent_license = randomLicenseOrJunk(rand);
    const child_license = randomLicenseOrJunk(rand);
    const { output_payload } = compute({ parent_license, child_license });
    checked++;
    for (const rc of output_payload.reason_codes) if (!REASON_CODES.has(rc)) violations++;
  }
  return { name: 'P3_reason_codes_bounded_fixed_set', trials: checked, violations };
}

// ---------- P4: metamorphic — same-license reflexivity never trips SA/PIL-reciprocal mismatch ----------
function checkP4_same_license_reflexivity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const lic = pick(rand, KNOWN_LICENSES);
    const { output_payload } = compute({ parent_license: lic, child_license: lic });
    checked++;
    if (output_payload.reason_codes.includes('SA_REQUIRES_SAME_LICENSE')) violations++;
    if (output_payload.reason_codes.includes('PIL_RECIPROCAL_MISMATCH')) violations++;
  }
  return { name: 'P4_same_license_reflexivity_no_sa_pil_mismatch', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_compatible_differential());
results.properties.push(checkP3_reason_codes_bounded());
results.properties.push(checkP4_same_license_reflexivity());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-204-license-compatibility-checker',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
