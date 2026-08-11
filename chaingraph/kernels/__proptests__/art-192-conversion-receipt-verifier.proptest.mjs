// art-192-conversion-receipt-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C5-1).
// kernel_digest_at_authoring: sha256:77570734c4be05d8e8a9f816845247675a55ed85b3e6ce17165b857dfd39da02
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — CORRECTED from the WU row's initial table (which listed float:yes for this
// kernel). Direct source read confirms the entire kernel is hex-string comparison, structural
// validation, and pure-JS SHA-256 recomputation (integer bit ops, not IEEE-754 arithmetic). No
// float comparisons exist anywhere. Per the WU row's own instruction to re-verify the hash/receipt
// kernels rather than inherit float:yes uncritically, this re-verification finds NO float
// sensitivity. Categorical (not ULP) boundary forcing is used instead.
// Checks: fixture-oracle gate, termination (fixed check pipeline, bounded), boundedness (checks[]
// length bounded by the fixed set of possible pushes), differential re-derivation of `verdict` from
// binding_ok/digest_ok, a round-trip metamorphic identity (verifying an art-191-built receipt for
// the SAME input/output digests always yields verdict:'valid' — this is the strongest cross-kernel
// check this floor can make without importing art-191 as a dependency, so it is done by hand-rolling
// art-191's exact receipt shape), and forced categorical boundary cases (malformed receipt, tampered
// binding, string-vs-object receipt input).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-192-conversion-receipt-verifier.proptest.mjs

import { compute } from '../art-192-conversion-receipt-verifier.kernel.mjs';
import { compute as buildReceipt } from '../art-191-conversion-receipt-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-192-conversion-receipt-verifier.fixtures.json');
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
const rand = mulberry32(0x192A0);
function randHex64(rng) {
  let s = '';
  for (let i = 0; i < 64; i++) s += Math.floor(rng() * 16).toString(16);
  return s;
}

function randomBuiltReceipt(rng) {
  const pp = {
    input_sha256: randHex64(rng), output_sha256: randHex64(rng),
    source_format: 'pdf', target_format: 'docx',
    converter: { name: 'conv', version: '1.0.0' }, parameters: {},
  };
  return buildReceipt(pp).output_payload.receipt;
}

const TRIALS = 3000;

// ---------- P1: termination — checks[] never exceeds the fixed maximum possible pushes (7) ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const receipt = randomBuiltReceipt(rand);
    const { output_payload } = compute({ receipt });
    checked++;
    if (output_payload.checks.length > 7 || output_payload.checks.length < 1) violations++;
  }
  return { name: 'P1_termination_bounded_check_count', trials: checked, violations };
}

// ---------- P2 (differential): verdict re-derivation from binding_ok/digest_ok ----------
function checkP2_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const receipt = randomBuiltReceipt(rand);
    const tamper = rand() < 0.3;
    if (tamper) receipt.binding_sha256 = randHex64(rand);
    const { output_payload } = compute({ receipt });
    checked++;
    let expected;
    if (!output_payload.binding_ok) expected = 'binding_mismatch';
    else if (!output_payload.digest_ok) expected = 'digest_mismatch';
    else expected = 'valid';
    if (output_payload.verdict !== expected) violations++;
    if (tamper && output_payload.verdict === 'valid') violations++;
  }
  return { name: 'P2_verdict_differential', trials: checked, violations };
}

// ---------- P3: metamorphic round-trip — an untampered art-191 receipt always verifies as 'valid' ----------
function checkP3_metamorphic_roundtrip_valid() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const receipt = randomBuiltReceipt(rand);
    const { output_payload } = compute({ receipt });
    checked++;
    if (output_payload.verdict !== 'valid') violations++;
    if (output_payload.binding_ok !== true) violations++;
  }
  return { name: 'P3_metamorphic_untampered_receipt_always_valid', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases ----------
function checkP4_forced() {
  const goodReceipt = randomBuiltReceipt(rand);
  const cases = [
    { label: 'well-formed art-191 receipt -> valid', receipt: goodReceipt },
    { label: 'receipt as a JSON string (not object) -> parsed and accepted', receipt: JSON.stringify(goodReceipt) },
    { label: 'malformed receipt (missing receipt_version) -> malformed verdict', receipt: { input: {}, output: {}, converter: {}, binding_sha256: 'x' } },
    { label: 'tampered binding_sha256 -> binding_mismatch', receipt: { ...goodReceipt, binding_sha256: 'f'.repeat(64) } },
    { label: 'non-JSON garbage string -> malformed verdict', receipt: 'not json at all {{{' },
  ];
  return cases.map((c) => {
    const { output_payload } = compute({ receipt: c.receipt });
    return { label: c.label, verdict: output_payload.verdict, binding_ok: output_payload.binding_ok };
  });
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_verdict_differential());
results.properties.push(checkP3_metamorphic_roundtrip_valid());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const goodReceiptValid = results.boundary_forced[0].verdict === 'valid';
const stringReceiptValid = results.boundary_forced[1].verdict === 'valid';
const malformedDetected = results.boundary_forced[2].verdict === 'malformed';
const tamperedDetected = results.boundary_forced[3].verdict === 'binding_mismatch';
const garbageStringMalformed = results.boundary_forced[4].verdict === 'malformed';
const anyBoundaryMismatch = !(goodReceiptValid && stringReceiptValid && malformedDetected && tamperedDetected && garbageStringMalformed);

console.log(JSON.stringify({
  tool_id: 'art-192-conversion-receipt-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
