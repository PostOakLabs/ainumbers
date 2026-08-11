// art-199-license-election-certifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C5-1).
// kernel_digest_at_authoring: sha256:72d98f80efe5fb34421fb246ca4e8071db4f48d55a8e4abb445b06414241b441
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — CORRECTED from the WU row's initial table (which listed float:yes for this
// kernel). Direct source read confirms the kernel is explicitly "modelled on art-191" (same
// hash/hex-string/boolean pattern) with no numeric fields at all — `election_core` is built purely
// from strings and a nested `params` object that is never inspected or compared numerically. No
// float arithmetic anywhere. Categorical (not ULP) boundary forcing is used instead.
// Checks: fixture-oracle gate, termination (checks[] is a fixed 4-entry pipeline, never
// data-dependent-unbounded), boundedness (checks[] length fixed), metamorphic (terms_hash is a
// deterministic pure function of election_core — recomputing twice on the same input yields the
// same hash, and an unrelated field added to the top-level `pp` outside asset_ref/licensor_did/
// license_election never changes terms_hash, since election_core only pulls the three named
// fields), differential re-derivation of all_checks_pass, and forced categorical boundary cases
// (known vs unknown license family, empty asset_ref/licensor_did).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-199-license-election-certifier.proptest.mjs

import { compute } from '../art-199-license-election-certifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-199-license-election-certifier.fixtures.json');
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
const rand = mulberry32(0x199A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const FAMILIES = ['cc', 'cbe', 'pil', 'embedded', 'unknown-family'];
function randomPP(rng) {
  return {
    asset_ref: 'asset-' + Math.floor(rng() * 1000),
    licensor_did: 'did:example:' + Math.floor(rng() * 1000),
    license_election: { family: pick(rng, FAMILIES), id: 'lic-' + Math.floor(rng() * 100), params: { note: 'x' } },
  };
}

const TRIALS = 5000;

// ---------- P1: termination — checks[] is always exactly 4 entries (fixed pipeline) ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.checks.length !== 4) violations++;
  }
  return { name: 'P1_termination_fixed_check_count', trials: checked, violations };
}

// ---------- P2 (differential): all_checks_pass iff every check.pass true ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = output_payload.checks.every((c) => c.pass);
    if (output_payload.all_checks_pass !== expected) violations++;
    const familyCheck = output_payload.checks.find((c) => c.check === 'license_family_known');
    if (familyCheck.pass !== ['cc', 'cbe', 'pil', 'embedded'].includes(pp.license_election.family)) violations++;
  }
  return { name: 'P2_all_checks_pass_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — terms_hash deterministic, and unaffected by fields outside the election core ----------
function checkP3_metamorphic_hash_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    const r2 = compute(pp).output_payload;
    checked++;
    if (r1.terms_hash !== r2.terms_hash) violations++;
    const withExtra = { ...pp, __unrelated_extra: 'noise-' + rand() };
    const r3 = compute(withExtra).output_payload;
    if (r1.terms_hash !== r3.terms_hash) violations++;
  }
  return { name: 'P3_metamorphic_terms_hash_deterministic_and_extra_field_invariant', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases ----------
function checkP4_forced() {
  const cases = [
    { label: 'known family "cc" -> license_family_known passes', pp: { asset_ref: 'a1', licensor_did: 'did:x:1', license_election: { family: 'cc', id: 'cc-by-4.0', params: {} } } },
    { label: 'unknown family -> license_family_known fails', pp: { asset_ref: 'a1', licensor_did: 'did:x:1', license_election: { family: 'gpl', id: 'gpl-3.0', params: {} } } },
    { label: 'empty asset_ref -> asset_ref_present fails (empty-input mode)', pp: { asset_ref: '', licensor_did: 'did:x:1', license_election: { family: 'cc', id: 'x', params: {} } } },
    { label: 'empty licensor_did -> licensor_did_present fails', pp: { asset_ref: 'a1', licensor_did: '', license_election: { family: 'cc', id: 'x', params: {} } } },
  ];
  return cases.map((c) => {
    const { output_payload } = compute(c.pp);
    return { label: c.label, all_checks_pass: output_payload.all_checks_pass, checks: output_payload.checks };
  });
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_metamorphic_hash_invariance());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const knownFamilyPasses = results.boundary_forced[0].checks.find((c) => c.check === 'license_family_known').pass === true;
const unknownFamilyFails = results.boundary_forced[1].checks.find((c) => c.check === 'license_family_known').pass === false;
const emptyAssetRefFails = results.boundary_forced[2].checks.find((c) => c.check === 'asset_ref_present').pass === false;
const emptyLicensorFails = results.boundary_forced[3].checks.find((c) => c.check === 'licensor_did_present').pass === false;
const anyBoundaryMismatch = !(knownFamilyPasses && unknownFamilyFails && emptyAssetRefFails && emptyLicensorFails);

console.log(JSON.stringify({
  tool_id: 'art-199-license-election-certifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
