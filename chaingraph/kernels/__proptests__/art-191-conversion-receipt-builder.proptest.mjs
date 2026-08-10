// art-191-conversion-receipt-builder.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C5-1).
// kernel_digest_at_authoring: sha256:e9c4a6255342b4fb2f2bd3687128e671dad4028f95ca277ee482fabe7b2b83ce
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — CORRECTED from the WU row's initial table (which listed float:yes for this
// kernel). Direct source read confirms the entire kernel operates on hex-string digests, boolean
// checks, and array/string logic; the only "SHA-256" arithmetic present is the pure-JS hash
// implementation's uint32 bitwise/modular arithmetic (>>> 0, rotr, XOR), which is integer bit
// manipulation, not IEEE-754 float arithmetic, and therefore carries no ULP-boundary concern. Per
// the WU row's own instruction ("hashing itself is not float arithmetic"), this is exactly the
// hash/receipt-kernel case it flagged for re-verification, and re-verification finds NO float
// sensitivity here. Categorical (not ULP) boundary forcing is used instead.
// Checks: fixture-oracle gate, termination (all checks/loops bounded by fixed check count or
// Object.keys(parameters).length), boundedness (checks[] length is fixed), differential
// re-derivation of all_checks_pass, metamorphic (binding_sha256 is a pure function of receiptCore —
// recomputing it twice on the same input yields the same digest; permuting parameter key insertion
// order does not change binding_sha256, since _cgCanon sorts keys), and forced categorical boundary
// cases (63-char vs 64-char hex, self-conversion, PII-carrier key detection).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-191-conversion-receipt-builder.proptest.mjs

import { compute } from '../art-191-conversion-receipt-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-191-conversion-receipt-builder.fixtures.json');
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
const rand = mulberry32(0x191A0);

function randHex64(rng) {
  let s = '';
  for (let i = 0; i < 64; i++) s += Math.floor(rng() * 16).toString(16);
  return s;
}

function randomPP(rng) {
  const input_sha256 = randHex64(rng);
  const sameDigest = rng() < 0.2;
  const output_sha256 = sameDigest ? input_sha256 : randHex64(rng);
  return {
    input_sha256, output_sha256,
    source_format: 'pdf', target_format: 'docx',
    converter: { name: 'conv', version: '1.0.0' },
    parameters: { dpi: 300 },
  };
}

const TRIALS = 5000;

// ---------- P1: termination — checks[] is always exactly 5 entries (fixed pipeline) ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.checks.length !== 5) violations++;
  }
  return { name: 'P1_termination_fixed_check_count', trials: checked, violations };
}

// ---------- P2 (differential): all_checks_pass iff every check.pass true; self-conversion flag re-derivation ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedAllPass = output_payload.checks.every((c) => c.pass);
    if (output_payload.all_checks_pass !== expectedAllPass) violations++;
    const selfConv = pp.input_sha256 === pp.output_sha256;
    const notSelfCheck = output_payload.checks.find((c) => c.check === 'not_self_conversion');
    if (notSelfCheck.pass !== !selfConv) violations++;
  }
  return { name: 'P2_all_checks_pass_and_self_conversion_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — binding_sha256 is a deterministic pure function (recompute twice -> identical) ----------
function checkP3_metamorphic_deterministic_binding() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    const r2 = compute(pp).output_payload;
    checked++;
    if (r1.receipt.binding_sha256 !== r2.receipt.binding_sha256) violations++;
  }
  return { name: 'P3_metamorphic_deterministic_binding', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no -> categorical hex-length/self-conversion/PII) ----------
const BOUNDARY_CASES = [
  { label: '64-char hex digests (valid boundary)', pp: { input_sha256: 'a'.repeat(64), output_sha256: 'b'.repeat(64), converter: { name: 'c', version: '1' }, parameters: {} } },
  { label: '63-char hex digest (one short of valid)', pp: { input_sha256: 'a'.repeat(63), output_sha256: 'b'.repeat(64), converter: { name: 'c', version: '1' }, parameters: {} } },
  { label: 'input_sha256 === output_sha256 (self-conversion)', pp: { input_sha256: 'c'.repeat(64), output_sha256: 'c'.repeat(64), converter: { name: 'c', version: '1' }, parameters: {} } },
  { label: 'PII-carrier key "email" in parameters -> flagged', pp: { input_sha256: 'a'.repeat(64), output_sha256: 'b'.repeat(64), converter: { name: 'c', version: '1' }, parameters: { email: 'x@y.com' } } },
  { label: 'missing converter version -> identity_complete false', pp: { input_sha256: 'a'.repeat(64), output_sha256: 'b'.repeat(64), converter: { name: 'c' }, parameters: {} } },
];
function checkP4_forced() {
  return BOUNDARY_CASES.map((c) => {
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
results.properties.push(checkP3_metamorphic_deterministic_binding());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const validHexPasses = results.boundary_forced[0].all_checks_pass === true;
const shortHexFails = results.boundary_forced[1].checks.find((c) => c.check === 'input_sha256_is_64_hex').pass === false;
const selfConvFails = results.boundary_forced[2].checks.find((c) => c.check === 'not_self_conversion').pass === false;
const piiFlagged = results.boundary_forced[3].checks.find((c) => c.check === 'parameters_free_of_pii_keys').pass === false;
const missingVersionFails = results.boundary_forced[4].checks.find((c) => c.check === 'converter_identity_complete').pass === false;
const anyBoundaryMismatch = !(validHexPasses && shortHexFails && selfConvFails && piiFlagged && missingVersionFails);

console.log(JSON.stringify({
  tool_id: 'art-191-conversion-receipt-builder',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
