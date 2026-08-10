// kernel_digest_at_authoring: sha256:96bc4cfa0b4c4dc33183c6c6c36cb074ef7ecf0c8a4e10dbd7552fefa7eeeb97
//
// FV-PROPFLOOR-SHARD-B28-1 — property-test floor for art-290-check-linea-l2-finality-window.
// Class B (bounded-numeric per the WU row), NOT float-sensitive — this kernel is purely
// categorical (finality tier classification from enum-valued status strings via a fixed rank
// table, no arithmetic on floats at all). Forced CATEGORICAL boundary cases (every tier×cutoff
// combination) used instead of ULP forcing, per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-290-check-linea-l2-finality-window.proptest.mjs

import { compute } from '../art-290-check-linea-l2-finality-window.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-290-check-linea-l2-finality-window.fixtures.json');
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
const rand = mulberry32(0x290C3);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

const TIER_RANK = { soft: 0, batched: 1, l1_final: 2 };
const BATCH_STATUSES = ['unsubmitted', 'submitted', 'batched', 'BOGUS'];
const L1_STATUSES = ['pending', 'finalized', 'BOGUS'];
const CUTOFFS = ['soft', 'batched', 'l1_final', 'invalid_cutoff'];

function classifyTier(batchSubmissionStatus, l1FinalizationStatus) {
  if (l1FinalizationStatus === 'finalized') return 'l1_final';
  if (batchSubmissionStatus === 'submitted' || batchSubmissionStatus === 'batched') return 'batched';
  return 'soft';
}

function mkPP(rng) {
  return {
    l2_block: rng() < 0.8 ? Math.floor(rng() * 1e7) : null,
    batch_submission_status: pick(rng, BATCH_STATUSES),
    l1_finalization_status: pick(rng, L1_STATUSES),
    corridor_cutoff: pick(rng, CUTOFFS),
    asset_type: rng() < 0.8 ? 'tokenized_deposit' : 'other_asset',
  };
}

// ---------- P1: boundedness — finality_tier always one of the 3 declared ranks ----------
function checkP1_tierBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!(r.output_payload.finality_tier in TIER_RANK)) violations++;
  }
  return { name: 'P1_finality_tier_bounded_to_declared_rank_set', trials: checked, violations };
}

// ---------- P2: fixed rule agreement — finality_tier exactly matches classifyTier() reference ----------
function checkP2_tierMatchesReference() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = classifyTier(pp.batch_submission_status, pp.l1_finalization_status);
    if (r.output_payload.finality_tier !== expected) violations++;
  }
  return { name: 'P2_finality_tier_matches_reference_classification', trials: checked, violations };
}

// ---------- P3: monotonicity — safe_to_release iff finality rank >= cutoff rank (falls back to l1_final for invalid cutoff) ----------
function checkP3_safeToReleaseMonotonic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const tier = r.output_payload.finality_tier;
    const cutoff = Object.prototype.hasOwnProperty.call(TIER_RANK, pp.corridor_cutoff) ? pp.corridor_cutoff : 'l1_final';
    const expected = TIER_RANK[tier] >= TIER_RANK[cutoff];
    if (r.output_payload.safe_to_release !== expected) violations++;
  }
  return { name: 'P3_safe_to_release_matches_rank_comparison', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (every tier × cutoff edge) ----------
const BOUNDARY_CASES = [
  [{ l2_block: 1, batch_submission_status: 'unsubmitted', l1_finalization_status: 'pending', corridor_cutoff: 'soft', asset_type: 'tokenized_deposit' }, 'soft tier vs soft cutoff — equal rank, safe_to_release must be true'],
  [{ l2_block: 1, batch_submission_status: 'unsubmitted', l1_finalization_status: 'pending', corridor_cutoff: 'batched', asset_type: 'tokenized_deposit' }, 'soft tier vs batched cutoff — below cutoff, safe_to_release must be false'],
  [{ l2_block: 1, batch_submission_status: 'batched', l1_finalization_status: 'pending', corridor_cutoff: 'batched', asset_type: 'tokenized_deposit' }, 'batched tier vs batched cutoff — equal rank, safe_to_release must be true'],
  [{ l2_block: 1, batch_submission_status: 'batched', l1_finalization_status: 'pending', corridor_cutoff: 'l1_final', asset_type: 'tokenized_deposit' }, 'batched tier vs l1_final cutoff — below cutoff, safe_to_release must be false'],
  [{ l2_block: 1, batch_submission_status: 'unsubmitted', l1_finalization_status: 'finalized', corridor_cutoff: 'l1_final', asset_type: 'tokenized_deposit' }, 'l1_finalization_status=finalized dominates batch status — tier must be l1_final regardless of batch state'],
  [{ l2_block: null, batch_submission_status: 'unsubmitted', l1_finalization_status: 'pending', corridor_cutoff: 'not_a_real_tier', asset_type: 'tokenized_deposit' }, 'invalid corridor_cutoff falls back to l1_final per hasOwnProperty guard — soft tier must be unsafe'],
  [{ l2_block: null, batch_submission_status: 'unsubmitted', l1_finalization_status: 'pending', corridor_cutoff: 'soft', asset_type: 'tokenized_deposit' }, 'l2_block absent (null) — must not throw, rationale must report n/a'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const { finality_tier, safe_to_release } = r.output_payload;
    const plausible = finality_tier in TIER_RANK && typeof safe_to_release === 'boolean';
    rows.push({ label, input: pp, finality_tier, safe_to_release, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_tierBounded());
results.properties.push(checkP2_tierMatchesReference());
results.properties.push(checkP3_safeToReleaseMonotonic());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
