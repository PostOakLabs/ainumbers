// art-304-aiuc1-evidence-pack-assembler.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C10-1).
// kernel_digest_at_authoring: sha256:bde1926d75bbc6dbc37f1d43332bd1684a077131e61b89d6e99929a12b8cf33c
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (digest lookup, string equality, integer-rank comparisons over an
// unbounded control_mapping array — no arithmetic on any monetary or continuous quantity;
// confirmed by direct read).
// Checks: fixture-oracle gate, termination (controls.length bounded by control_mapping.length),
// differential re-derivation of each control's status via an independent resolveDigest
// replica, boundedness/differential of pack_claim_strength as the STRENGTH-rank minimum over
// bound controls, and metamorphic order-independence (permuting the artifact pools never
// changes which digests resolve, since resolution is by id/digest match, not position).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-304-aiuc1-evidence-pack-assembler.proptest.mjs

import { compute, CATALOG_VERSION } from '../art-304-aiuc1-evidence-pack-assembler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-304-aiuc1-evidence-pack-assembler.fixtures.json');
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
const rand = mulberry32(0x304A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const STRENGTH_RANK = { 'receipt-backed': 2, 'attestation-only': 1, missing: 0 };
const STRENGTH_NAME = ['missing', 'attestation-only', 'receipt-backed'];

function resolveDigestRef(ref, artifacts) {
  const pools = [artifacts.receipts, artifacts.escalation_closures, artifacts.mandates];
  for (const pool of pools) {
    if (!Array.isArray(pool)) continue;
    const hit = pool.find((a) => a && (a.id === ref || a.digest === ref));
    if (hit && typeof hit.digest === 'string' && hit.digest.length > 0) return hit.digest;
  }
  return null;
}

function randomArtifacts(rng) {
  const receipts = Array.from({ length: Math.floor(rng() * 4) }, (_, i) => ({ id: 'r' + i, digest: 'sha256:' + 'a'.repeat(63) + i }));
  const escalation_closures = Array.from({ length: Math.floor(rng() * 3) }, (_, i) => ({ id: 'e' + i, digest: 'sha256:' + 'b'.repeat(63) + i }));
  const mandates = Array.from({ length: Math.floor(rng() * 3) }, (_, i) => ({ id: 'm' + i, digest: 'sha256:' + 'c'.repeat(63) + i }));
  return { receipts, escalation_closures, mandates };
}
function randomControlMapping(rng, artifacts) {
  const allRefs = [...artifacts.receipts, ...artifacts.escalation_closures, ...artifacts.mandates].map((a) => a.id);
  const n = Math.floor(rng() * 6);
  return Array.from({ length: n }, (_, i) => {
    const nRefs = Math.floor(rng() * 3);
    const refs = [];
    for (let j = 0; j < nRefs; j++) {
      refs.push(rng() < 0.7 && allRefs.length > 0 ? pick(rng, allRefs) : 'unresolvable-ref-' + j);
    }
    return { control_id: 'C-' + i, artifact_refs: refs };
  });
}

const TRIALS = 5000;

// ---------- P1: termination — controls.length bounded by control_mapping.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const artifacts = randomArtifacts(rand);
    const control_mapping = randomControlMapping(rand, artifacts);
    const { output_payload } = compute({ aiuc1_version: CATALOG_VERSION, artifacts, control_mapping });
    checked++;
    if (output_payload.controls.length !== control_mapping.length) violations++;
  }
  return { name: 'P1_controls_length_bounded_by_control_mapping', trials: checked, violations };
}

// ---------- P2 (differential): per-control status re-derived via an independent resolveDigest replica ----------
function checkP2_status_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const artifacts = randomArtifacts(rand);
    const control_mapping = randomControlMapping(rand, artifacts);
    const { output_payload } = compute({ aiuc1_version: CATALOG_VERSION, artifacts, control_mapping });
    checked++;
    output_payload.controls.forEach((c, idx) => {
      const refs = control_mapping[idx].artifact_refs;
      const digests = refs.map((r) => resolveDigestRef(r, artifacts)).filter((d) => typeof d === 'string');
      const expected = refs.length === 0 ? 'missing' : digests.length === refs.length ? 'receipt-backed' : 'attestation-only';
      if (c.status !== expected) violations++;
      if (c.artifact_digests.length !== digests.length) violations++;
    });
  }
  return { name: 'P2_per_control_status_differential', trials: checked, violations };
}

// ---------- P3 (differential): pack_claim_strength as STRENGTH-rank minimum over bound controls ----------
function checkP3_claim_strength_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const artifacts = randomArtifacts(rand);
    const control_mapping = randomControlMapping(rand, artifacts);
    const { output_payload } = compute({ aiuc1_version: CATALOG_VERSION, artifacts, control_mapping });
    checked++;
    const bound = output_payload.controls.filter((c) => c.status !== 'missing');
    const expected = bound.length === 0 ? 'insufficient' : STRENGTH_NAME[Math.min(...bound.map((c) => STRENGTH_RANK[c.status]))];
    if (output_payload.pack_claim_strength !== expected) violations++;
  }
  return { name: 'P3_pack_claim_strength_min_rank_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permuting the artifact pools never changes resolution ----------
function checkP4_pool_order_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const artifacts = randomArtifacts(rand);
    const control_mapping = randomControlMapping(rand, artifacts);
    const shuffled = {
      receipts: [...artifacts.receipts].reverse(),
      escalation_closures: [...artifacts.escalation_closures].reverse(),
      mandates: [...artifacts.mandates].reverse(),
    };
    const r1 = compute({ aiuc1_version: CATALOG_VERSION, artifacts, control_mapping }).output_payload;
    const r2 = compute({ aiuc1_version: CATALOG_VERSION, artifacts: shuffled, control_mapping }).output_payload;
    checked++;
    if (JSON.stringify(r1.controls) !== JSON.stringify(r2.controls)) violations++;
    if (r1.pack_claim_strength !== r2.pack_claim_strength) violations++;
  }
  return { name: 'P4_artifact_pool_order_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_status_differential());
results.properties.push(checkP3_claim_strength_differential());
results.properties.push(checkP4_pool_order_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-304-aiuc1-evidence-pack-assembler',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
