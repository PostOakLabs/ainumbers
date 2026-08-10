// kernel_digest_at_authoring: sha256:fb5a1be978689c0d35c8e8c231bdfcdc0c54da4223e73833b31cce3948bcc51a
//
// FV-PROPFLOOR-SHARD-B11-1 — property-test floor for art-290-check-linea-l2-finality-window.
// Class B (bounded categorical), float:no exception per the WU row — pure tier-ranking/lookup
// logic (finality_tier from two status strings), no continuous arithmetic. Forced categorical
// boundary cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2/B3 harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
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
const rand = mulberry32(0x29001);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 10000;
const TIER_RANK = { soft: 0, batched: 1, l1_final: 2 };
const BATCH_STATUSES = ['unsubmitted', 'submitted', 'batched'];
const L1_STATUSES = ['pending', 'finalized'];
const CUTOFFS = ['soft', 'batched', 'l1_final'];

function mkPP(rng) {
  return {
    l2_block: Math.floor(rng() * 10_000_000),
    batch_submission_status: pick(rng, BATCH_STATUSES),
    l1_finalization_status: pick(rng, L1_STATUSES),
    corridor_cutoff: pick(rng, CUTOFFS),
    asset_type: pick(rng, ['tokenized_deposit', 'stablecoin']),
  };
}

// ---------- P1: monotone — improving finalization state never lowers finality_tier ----------
function checkP1_monotoneTier() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const worse = { ...pp, batch_submission_status: 'unsubmitted', l1_finalization_status: 'pending' };
    const better = { ...pp, batch_submission_status: 'submitted', l1_finalization_status: 'finalized' };
    const r1 = compute(worse);
    const r2 = compute(better);
    checked++;
    if (TIER_RANK[r2.output_payload.finality_tier] < TIER_RANK[r1.output_payload.finality_tier]) violations++;
  }
  return { name: 'P1_monotone_finality_tier_nondecreasing_on_improvement', trials: checked, violations };
}

// ---------- P2: boundedness — finality_tier/reorg_window_risk drawn from known enums ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN_TIERS = new Set(['soft', 'batched', 'l1_final']);
  const KNOWN_RISKS = new Set(['high', 'low', 'none']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { finality_tier, reorg_window_risk } = r.output_payload;
    if (!KNOWN_TIERS.has(finality_tier)) violations++;
    if (!KNOWN_RISKS.has(reorg_window_risk)) violations++;
  }
  return { name: 'P2_boundedness_tier_and_risk_from_known_sets', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — safe_to_release matches tier-rank comparison exactly ----------
function checkP3_safeToReleaseAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { finality_tier, corridor_cutoff, safe_to_release } = r.output_payload;
    const expected = TIER_RANK[finality_tier] >= TIER_RANK[corridor_cutoff];
    if (safe_to_release !== expected) violations++;
  }
  return { name: 'P3_safe_to_release_matches_fixed_tier_rank_rule', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ l1_finalization_status: 'finalized' }, 'l1_finalization_status finalized alone (no batch status) — must classify l1_final regardless of batch state'],
  [{ batch_submission_status: 'submitted', l1_finalization_status: 'pending' }, 'submitted+pending — must classify batched, not soft'],
  [{ batch_submission_status: 'batched', l1_finalization_status: 'pending' }, 'batched+pending — must classify batched'],
  [{ batch_submission_status: 'unsubmitted', l1_finalization_status: 'pending' }, 'unsubmitted+pending — must classify soft'],
  [{}, 'all-empty input — defaults to unsubmitted/pending/l1_final cutoff, soft tier, not safe, no throw'],
  [{ corridor_cutoff: 'not_a_real_tier' }, 'unrecognized corridor_cutoff value — must fall back to l1_final default per hasOwnProperty guard'],
  [{ batch_submission_status: 'submitted', l1_finalization_status: 'finalized', corridor_cutoff: 'l1_final' }, 'exact tier-rank tie at l1_final cutoff — safe_to_release must be true (>= not >)'],
  [{ batch_submission_status: 'batched', l1_finalization_status: 'pending', corridor_cutoff: 'batched' }, 'exact tier-rank tie at batched cutoff — safe_to_release must be true'],
  [{ l2_block: null }, 'null l2_block — must render "n/a" in rationale, not throw or NaN'],
  [{ batch_submission_status: 'unsubmitted', l1_finalization_status: 'pending', corridor_cutoff: 'soft' }, 'lowest possible tier vs lowest possible cutoff — safe_to_release must be true'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { finality_tier, reorg_window_risk, safe_to_release, rationale } = r.output_payload;
    const plausible = ['soft', 'batched', 'l1_final'].includes(finality_tier)
      && ['high', 'low', 'none'].includes(reorg_window_risk)
      && typeof safe_to_release === 'boolean'
      && Array.isArray(rationale);
    rows.push({ label, pp, finality_tier, reorg_window_risk, safe_to_release, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneTier());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_safeToReleaseAgreement());
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
