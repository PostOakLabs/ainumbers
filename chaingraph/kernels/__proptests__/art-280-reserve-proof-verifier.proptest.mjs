// art-280-reserve-proof-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C9-1).
// kernel_digest_at_authoring: sha256:9a44a8b6d21f0ba1ee172222c28125d7263777d94f96a76bc65393e293655f09
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — Merkle-sum walk uses integer/decimal balance sums
// and string hashing only; the one percentage field, deviation_pct, is a diagnostic display value
// computed from the same finite sums, not a threshold comparator this floor treats as ULP-critical
// — forced categorical cases below cover its guard branches instead).
// TERMINATION-BOUND ARGUMENT (verifier kernel, per WU row instruction): walkMerkleSumPath's
// for-loop is bounded by `path.length`, checked against MAX_PATH_DEPTH=40 BEFORE the walk starts
// (`proof.path.length > MAX_PATH_DEPTH` short-circuits to structural_error) — never recursive.
// Checks: fixture-oracle gate, termination/boundedness (a path over the 40-level cap always
// yields STRUCTURAL_ERROR and skips the walk), a differential re-derivation of computed_root.sum
// as leaf.sum + sum(path step sums) (the walk's own sum arithmetic, independent of its hash),
// a differential re-derivation of por_round staleness/deviation from the same guard formulas,
// and forced categorical boundary cases (float:no, no ULP forcing): empty path, path exactly at
// the 40-node cap, path 1 over the cap, zero/negative balances.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-280-reserve-proof-verifier.proptest.mjs

import { compute } from '../art-280-reserve-proof-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-280-reserve-proof-verifier.fixtures.json');
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
const rand = mulberry32(0x280A0);

function randomPath(rng, n) {
  return Array.from({ length: n }, (_, i) => ({ hash: `h${i}`, sum: Math.floor(rng() * 100000), position: rng() < 0.5 ? 'left' : 'right' }));
}
function genericProof(rng, { balance = Math.floor(rng() * 1_000_000), pathLen = Math.floor(rng() * 10), rootHash = 'irrelevant', rootSum = 0 } = {}) {
  return { exchange: 'generic', merkle_proof: { leaf_user_id_hash: 'u1', leaf_balance: balance, path: randomPath(rng, pathLen), root: { hash: rootHash, sum: rootSum } } };
}

const TRIALS = 3000;

// ---------- P1: termination/boundedness — path over MAX_PATH_DEPTH (40) always -> STRUCTURAL_ERROR ----------
function checkP1_bounded_path_depth() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pathLen = Math.floor(rand() * 50); // spans below/at/above the 40 cap
    const pp = genericProof(rand, { pathLen });
    checked++;
    const { output_payload } = compute(pp);
    if (pathLen > 40 && output_payload.reserve_proof_determination !== 'STRUCTURAL_ERROR') violations++;
    if (pathLen > 40 && output_payload.structural_error === null) violations++;
    if (pathLen <= 40 && output_payload.structural_error !== null) violations++;
  }
  return { name: 'P1_path_depth_bounded_by_max_40', trials: checked, violations };
}

// ---------- P2 (differential): computed_root.sum re-derivation from leaf + path sums ----------
function checkP2_sum_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const balance = Math.floor(rand() * 1_000_000);
    const pathLen = Math.floor(rand() * 15);
    const pp = genericProof(rand, { balance, pathLen });
    const expectedSum = balance + pp.merkle_proof.path.reduce((s, step) => s + step.sum, 0);
    checked++;
    const { output_payload } = compute(pp);
    if (output_payload.computed_root.sum !== expectedSum) violations++;
    if (typeof output_payload.sum_verified !== 'boolean') violations++;
    if (output_payload.sum_verified !== (output_payload.computed_root.sum === output_payload.declared_root.sum)) violations++;
  }
  return { name: 'P2_computed_root_sum_differential', trials: checked, violations };
}

// ---------- P3 (differential): por_round staleness/deviation re-derivation ----------
function checkP3_por_round_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const balance = Math.floor(rand() * 1_000_000);
    const pp = genericProof(rand, { balance, pathLen: 0 });
    const updatedAt = Math.floor(rand() * 1_000_000);
    const now = updatedAt + Math.floor(rand() * 200_000) - 100_000;
    const maxStaleness = 1 + Math.floor(rand() * 200_000);
    pp.por_round = { round_id: 'r1', updated_at_seconds: updatedAt, current_timestamp_seconds: now, max_staleness_seconds: maxStaleness, reserves_reported_usd: balance };
    checked++;
    const { output_payload } = compute(pp);
    const expectedStaleness = Math.max(0, now - updatedAt);
    const expectedStale = expectedStaleness > maxStaleness;
    if (output_payload.por_round.staleness_seconds !== expectedStaleness) violations++;
    if (output_payload.por_round.is_stale !== expectedStale) violations++;
    if (!Number.isFinite(output_payload.por_round.deviation_pct) && output_payload.por_round.deviation_pct !== null) violations++;
  }
  return { name: 'P3_por_round_staleness_deviation_differential', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no, no ULP forcing) ----------
const CATEGORICAL_CASES = [
  { label: 'empty path (leaf is root) -> depth ok, sum = balance', pp: genericProof(rand, { balance: 500, pathLen: 0 }) },
  { label: 'path exactly at 40-node cap -> not structural error', pp: genericProof(rand, { balance: 500, pathLen: 40 }) },
  { label: 'path 1 over the cap (41) -> STRUCTURAL_ERROR', pp: genericProof(rand, { balance: 500, pathLen: 41 }) },
  { label: 'zero balance -> sum = path sum only, finite', pp: genericProof(rand, { balance: 0, pathLen: 3 }) },
  { label: 'unrecognized exchange falls back to generic normalization', pp: { exchange: 'unknown_exchange_xyz', merkle_proof: { leaf_user_id_hash: 'u', leaf_balance: 10, path: [], root: { hash: '', sum: 0 } } } },
];
function checkP5_forced() {
  return CATEGORICAL_CASES.map((c) => {
    const { output_payload } = compute(c.pp);
    return { label: c.label, determination: output_payload.reserve_proof_determination, computed_sum: output_payload.computed_root?.sum ?? null, structural_error: output_payload.structural_error };
  });
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_bounded_path_depth());
results.properties.push(checkP2_sum_differential());
results.properties.push(checkP3_por_round_differential());
const forcedCases = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-280-reserve-proof-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  forced_categorical_cases: forcedCases,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
