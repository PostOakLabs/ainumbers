// art-123-c2pa-manifest-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C3-1).
// kernel_digest_at_authoring: sha256:e2191fb2c1cfcbbec083616921861612aebe0dd75f823fe782a6fc1d301f70c8
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (label-membership boolean logic + integer array-length counting only).
// Checks: fixture-oracle gate, termination (assertion_count/missing_elements bounded by the
// assertions array), differential re-derivation of manifest_valid + missing_elements from the
// three underlying booleans, and metamorphic permutation-invariance of the assertions array.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-123-c2pa-manifest-validator.proptest.mjs

import { compute } from '../art-123-c2pa-manifest-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-123-c2pa-manifest-validator.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = await compute(vec.policy_parameters);
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
const rand = mulberry32(0x123C2);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function maybe(rng, v, p = 0.7) { return rng() < p ? v : undefined; }

const LABELS = ['c2pa.hash.data', 'c2pa.hash.bmff', 'c2pa.actions', 'c2pa.actions.v2', 'c2pa.other', 'c2pa.thumbnail'];

function randomAssertions(rng, n) {
  return Array.from({ length: n }, () => ({ label: pick(rng, LABELS) }));
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  return {
    claim_generator: maybe(rng, 'c2patool/0.9'),
    claim: { format: maybe(rng, 'image/jpeg'), instanceID: maybe(rng, 'xmp:iid:abc') },
    assertions: randomAssertions(rng, n),
    signature: rng() < 0.5 ? { present: true } : (rng() < 0.5 ? { alg: 'es256' } : {}),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — assertion_count/missing_elements bounded by assertions length ----------
async function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    checked++;
    if (output_payload.assertion_count !== pp.assertions.length) violations++;
    if (output_payload.missing_elements.length > 3) violations++; // exactly 3 possible flags
  }
  return { name: 'P1_termination_bounded', trials: checked, violations };
}

// ---------- P2 (differential): manifest_valid + missing_elements re-derivation ----------
async function checkP2_validity_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    checked++;
    const labels = pp.assertions.map((a) => a.label).filter(Boolean);
    const has_hard_binding = labels.includes('c2pa.hash.data') || labels.includes('c2pa.hash.bmff');
    const claim_well_formed = typeof pp.claim_generator === 'string' && pp.claim_generator.length > 0
      && typeof pp.claim.format === 'string' && typeof pp.claim.instanceID === 'string';
    const sig_ref_present = !!pp.signature && (pp.signature.present === true || typeof pp.signature.alg === 'string');
    const expectedMissing = [];
    if (!claim_well_formed) expectedMissing.push('CLAIM_GENERATOR_FORMAT_OR_INSTANCEID');
    if (!has_hard_binding) expectedMissing.push('HARD_BINDING_HASH_ASSERTION');
    if (!sig_ref_present) expectedMissing.push('CLAIM_SIGNATURE_REFERENCE');
    if (output_payload.manifest_valid !== (expectedMissing.length === 0)) violations++;
    if (JSON.stringify(output_payload.missing_elements) !== JSON.stringify(expectedMissing)) violations++;
    if (output_payload.has_hard_binding !== has_hard_binding) violations++;
  }
  return { name: 'P2_validity_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of assertions order ----------
async function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rand() * 8);
    const assertions = randomAssertions(rand, n);
    const pp = { claim_generator: maybe(rand, 'c2patool/0.9'), claim: { format: 'image/jpeg', instanceID: 'x' }, assertions, signature: { present: true } };
    const shuffledPp = { ...pp, assertions: shuffle(rand, assertions) };
    const r1 = (await compute(pp)).output_payload;
    const r2 = (await compute(shuffledPp)).output_payload;
    checked++;
    if (r1.manifest_valid !== r2.manifest_valid) violations++;
    if (r1.has_hard_binding !== r2.has_hard_binding) violations++;
    if (r1.assertion_count !== r2.assertion_count) violations++;
    if (JSON.stringify(r1.missing_elements.slice().sort()) !== JSON.stringify(r2.missing_elements.slice().sort())) violations++;
  }
  return { name: 'P3_permutation_invariance_assertions', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(await checkP1_termination());
results.properties.push(await checkP2_validity_differential());
results.properties.push(await checkP3_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-123-c2pa-manifest-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
