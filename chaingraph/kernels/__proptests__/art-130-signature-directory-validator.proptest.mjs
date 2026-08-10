// art-130-signature-directory-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C3-1).
// kernel_digest_at_authoring: sha256:3826cbd5f7c8d26075aaa4ebe3fa0b1f62f959e159a28b2eb6a153d6f307efcb
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (path-equality + array .every()/.find() boolean logic, integer counting).
// Checks: fixture-oracle gate, termination (key_count bounded by directory_jwks.keys length),
// differential re-derivation of directory_valid/key_found/algorithm_ok from the three underlying
// conditions, and metamorphic permutation-invariance of the keys array (order never changes
// key_found or algorithm_ok).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-130-signature-directory-validator.proptest.mjs

import { compute } from '../art-130-signature-directory-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-130-signature-directory-validator.fixtures.json');
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
const rand = mulberry32(0x130D0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const KIDS = ['kid-1', 'kid-2', 'kid-3', 'kid-4'];

function randomKey(rng, i) {
  return { kid: pick(rng, KIDS), kty: pick(rng, ['OKP', 'RSA']), crv: pick(rng, ['Ed25519', 'P-256', undefined]) };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 6);
  return {
    directory_jwks: { keys: Array.from({ length: n }, (_, i) => randomKey(rng, i)) },
    keyid: pick(rng, KIDS),
    well_known_path: pick(rng, ['/.well-known/http-message-signatures-directory', '/wrong-path']),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — key_count exactly bounded by directory_jwks.keys length ----------
async function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    checked++;
    if (output_payload.key_count !== pp.directory_jwks.keys.length) violations++;
  }
  return { name: 'P1_termination_key_count_bounded', trials: checked, violations };
}

// ---------- P2 (differential): directory_valid/key_found/algorithm_ok re-derivation ----------
async function checkP2_validity_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    checked++;
    const keys = pp.directory_jwks.keys;
    const path_ok = pp.well_known_path === '/.well-known/http-message-signatures-directory';
    const all_ed25519 = keys.length > 0 && keys.every((k) => k && k.kty === 'OKP' && k.crv === 'Ed25519');
    const key_found = keys.some((k) => k && k.kid === pp.keyid);
    if (output_payload.path_ok !== path_ok) violations++;
    if (output_payload.algorithm_ok !== all_ed25519) violations++;
    if (output_payload.key_found !== key_found) violations++;
    if (output_payload.directory_valid !== (path_ok && all_ed25519 && key_found)) violations++;
  }
  return { name: 'P2_validity_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of keys order ----------
async function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rand() * 6);
    const keys = Array.from({ length: n }, (_, i) => randomKey(rand, i));
    const pp = { directory_jwks: { keys }, keyid: pick(rand, KIDS), well_known_path: '/.well-known/http-message-signatures-directory' };
    const shuffledPp = { ...pp, directory_jwks: { keys: shuffle(rand, keys) } };
    const r1 = (await compute(pp)).output_payload;
    const r2 = (await compute(shuffledPp)).output_payload;
    checked++;
    if (r1.directory_valid !== r2.directory_valid) violations++;
    if (r1.key_found !== r2.key_found) violations++;
    if (r1.algorithm_ok !== r2.algorithm_ok) violations++;
    if (r1.key_count !== r2.key_count) violations++;
  }
  return { name: 'P3_permutation_invariance_keys', trials: checked, violations };
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
  tool_id: 'art-130-signature-directory-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
