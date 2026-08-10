// art-209-nft-metadata-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C6-1).
// kernel_digest_at_authoring: sha256:f44568d42f15c3115cd7fa67045fb18872ae4cc0ba789b6bede70f9448176a1b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — string/schema/regex checks only, no arithmetic
// beyond integer length/count).
// Checks: fixture-oracle gate, termination (checks.length is a small fixed constant plus at most
// one extra entry for attributes[].structure -- bounded regardless of attributes array size, which
// is the caller-controlled unbounded input), boundedness (field_count === Object.keys(meta_obj).
// length, fail_count/warn_count <= checks.length), differential re-derivation of required_pass/
// all_pass from the checks array, and metamorphic extra-field invariance (adding unrelated keys to
// meta_obj only changes field_count, never the required/recommended/license checks).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-209-nft-metadata-validator.proptest.mjs

import { compute } from '../art-209-nft-metadata-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-209-nft-metadata-validator.fixtures.json');
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
const rand = mulberry32(0x2090A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomAttrs(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(rng() < 0.7 ? { trait_type: `t${i}`, value: Math.floor(rng() * 100) } : { trait_type: '' });
  }
  return out;
}

function randomMeta(rng) {
  const meta_obj = {};
  if (rng() < 0.8) meta_obj.name = `NFT #${Math.floor(rng() * 1000)}`;
  if (rng() < 0.8) meta_obj.description = 'a description';
  if (rng() < 0.8) meta_obj.image = pick(rng, ['https://example.com/img.png', 'ipfs://Qm...', 'not-a-uri']);
  if (rng() < 0.5) meta_obj.external_url = pick(rng, ['https://example.com', 'bad']);
  if (rng() < 0.5) meta_obj.animation_url = pick(rng, ['https://example.com/a.mp4', 'bad']);
  if (rng() < 0.5) meta_obj.attributes = randomAttrs(rng, Math.floor(rng() * 20));
  if (rng() < 0.3) meta_obj.license = 'CC-BY-4.0';
  return meta_obj;
}

const TRIALS = 5000;

// ---------- P1: termination — checks.length bounded regardless of attributes[] size ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const meta_obj = randomMeta(rand);
    if (rand() < 0.5 && meta_obj.attributes === undefined) meta_obj.attributes = randomAttrs(rand, Math.floor(rand() * 100)); // stress large arrays
    const { output_payload } = compute({ metadata: meta_obj });
    checked++;
    if (output_payload.checks.length > 8) violations++;
  }
  return { name: 'P1_termination_checks_bounded_regardless_of_attrs_size', trials: checked, violations };
}

// ---------- P2 (differential): required_pass/all_pass re-derivation from checks ----------
function checkP2_pass_flags_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const meta_obj = randomMeta(rand);
    const { output_payload } = compute({ metadata: meta_obj });
    checked++;
    const requiredChecks = output_payload.checks.filter((c) => c.group === 'required');
    const expectedRequiredPass = requiredChecks.every((c) => c.pass && !c.warn);
    if (output_payload.required_pass !== expectedRequiredPass) violations++;
    const expectedAllPass = output_payload.checks.every((c) => c.pass);
    if (output_payload.all_pass !== expectedAllPass) violations++;
    const expectedFailCount = output_payload.checks.filter((c) => !c.pass).length;
    if (output_payload.fail_count !== expectedFailCount) violations++;
  }
  return { name: 'P2_pass_flags_differential_from_checks', trials: checked, violations };
}

// ---------- P3: boundedness — field_count equals Object.keys(meta_obj).length ----------
function checkP3_field_count_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const meta_obj = randomMeta(rand);
    const { output_payload } = compute({ metadata: meta_obj });
    checked++;
    if (output_payload.field_count !== Object.keys(meta_obj).length) violations++;
    if (output_payload.fail_count > output_payload.checks.length) violations++;
    if (output_payload.warn_count > output_payload.checks.length) violations++;
  }
  return { name: 'P3_field_count_exact_and_counts_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — unrelated extra keys change field_count only, never checks ----------
function checkP4_extra_field_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const meta_obj = randomMeta(rand);
    const extended = { ...meta_obj, __irrelevant_x: 'x', __irrelevant_y: 42 };
    const r1 = compute({ metadata: meta_obj }).output_payload;
    const r2 = compute({ metadata: extended }).output_payload;
    checked++;
    if (JSON.stringify(r1.checks) !== JSON.stringify(r2.checks)) violations++;
    if (r2.field_count !== r1.field_count + 2) violations++;
  }
  return { name: 'P4_extra_field_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_pass_flags_differential());
results.properties.push(checkP3_field_count_bounded());
results.properties.push(checkP4_extra_field_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-209-nft-metadata-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
