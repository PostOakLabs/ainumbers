// art-206-rights-record-builder.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C6-1).
// kernel_digest_at_authoring: sha256:8f35e055dceefb5e3f15d1f661ea140e9414f44f8804e17f8a67f35739d0bfc2
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (WU triage table lists this kernel float:yes; direct source read finds
// term_years is stored verbatim as a number/parseInt result with no threshold comparison or
// division against it, and the only other numeric work is inside the inlined pure-JS SHA-256 --
// 32-bit unsigned integer arithmetic, no IEEE-754 operations. CORRECTED to float:no per FIX-2
// discipline; no ULP-forcing applies. This correction is stated in the manifest, matching the same
// correction made for art-201 in this shard.)
// Checks: fixture-oracle gate, termination (rights_vector is always exactly the fixed 9-key
// RIGHTS_VECTOR_FIELDS set, checks array is always exactly 5 -- bounded by fixed constants, never
// by caller input size), boundedness (record_hash is always a 64-hex-char string, rights_vector
// values always boolean), differential re-derivation of record_hash via an INDEPENDENT node:crypto
// SHA-256 over the same JCS-canonical rights_row (node:crypto is a Node built-in, not an added
// dependency), and metamorphic toBool-representation invariance (the truthy string/number forms
// '1', 1, true, 'true' all normalize identically inside rights_vector).
// Zero external dependencies beyond node:crypto (Node built-in) — no fast-check, no npm package.
//
// Run: node chaingraph/kernels/__proptests__/art-206-rights-record-builder.proptest.mjs

import { compute } from '../art-206-rights-record-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-206-rights-record-builder.fixtures.json');
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
const rand = mulberry32(0x2060A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function cgCanon(v) {
  return Array.isArray(v) ? v.map(cgCanon) : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {}) : v;
}
function independentRecordHash(rightsRow) {
  return createHash('sha256').update(JSON.stringify(cgCanon(rightsRow)), 'utf8').digest('hex');
}

const RIGHTS_VECTOR_FIELDS = ['copy', 'display', 'commercial', 'exclusive', 'modify', 'sublicense', 'share_alike', 'attribution', 'revocable'];

function randomPP(rng) {
  const rights_vector = {};
  for (const f of RIGHTS_VECTOR_FIELDS) if (rng() < 0.8) rights_vector[f] = pick(rng, [true, false, '1', '0', 1, 0, 'true', 'false']);
  return {
    licensor: `licensor-${Math.floor(rng() * 1e6)}`,
    licensee: `licensee-${Math.floor(rng() * 1e6)}`,
    territory: pick(rng, ['Worldwide', 'US', 'EU', '']),
    term_years: Math.floor(rng() * 20),
    license_id: pick(rng, ['CC-BY-4.0', 'CC0-1.0', '']),
    asset_ref: `asset-${Math.floor(rng() * 1e6)}`,
    rights_vector,
    renewal: pick(rng, ['none', 'auto', 'negotiated']),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — rights_vector exactly 9 keys, checks exactly 5 ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (Object.keys(output_payload.rights_row.rights_vector).length !== 9) violations++;
    if (output_payload.checks.length !== 5) violations++;
  }
  return { name: 'P1_termination_fixed_9_fields_5_checks', trials: checked, violations };
}

// ---------- P2 (differential): record_hash matches an INDEPENDENT node:crypto SHA-256 over JCS-canonical rights_row ----------
function checkP2_hash_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedHash = independentRecordHash(output_payload.rights_row);
    if (output_payload.record_hash !== expectedHash) violations++;
  }
  return { name: 'P2_record_hash_differential_vs_node_crypto', trials: checked, violations };
}

// ---------- P3: boundedness — record_hash is 64 lowercase hex chars, rights_vector values boolean ----------
function checkP3_hash_and_vector_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!/^[0-9a-f]{64}$/.test(output_payload.record_hash)) violations++;
    for (const f of RIGHTS_VECTOR_FIELDS) if (typeof output_payload.rights_row.rights_vector[f] !== 'boolean') violations++;
  }
  return { name: 'P3_hash_hex64_and_vector_boolean_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — truthy representations of the same field normalize identically ----------
function checkP4_toBool_representation_invariance() {
  let violations = 0, checked = 0;
  const TRUTHY = [true, 1, '1', 'true'];
  const FALSY = [false, 0, '0', 'false'];
  for (let i = 0; i < 2000; i++) {
    const f = pick(rand, RIGHTS_VECTOR_FIELDS);
    const basePP = randomPP(rand);
    const tVal = pick(rand, TRUTHY);
    const fVal = pick(rand, FALSY);
    const r1 = compute({ ...basePP, rights_vector: { ...basePP.rights_vector, [f]: tVal } }).output_payload;
    const r2 = compute({ ...basePP, rights_vector: { ...basePP.rights_vector, [f]: fVal } }).output_payload;
    checked++;
    if (r1.rights_row.rights_vector[f] !== true) violations++;
    if (r2.rights_row.rights_vector[f] !== false) violations++;
  }
  return { name: 'P4_toBool_representation_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_hash_differential());
results.properties.push(checkP3_hash_and_vector_bounded());
results.properties.push(checkP4_toBool_representation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-206-rights-record-builder',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
