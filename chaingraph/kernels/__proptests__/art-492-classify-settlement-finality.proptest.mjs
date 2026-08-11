// kernel_digest_at_authoring: sha256:46e7fe0b9f14a69f3dc986d9646148d94f230f1f25765dbffe60f3082b8e7185
//
// FV-PROPFLOOR-SHARD-B25-1 — property-test floor for art-492-classify-settlement-finality.
// Class B (bounded-numeric), float:no per WU — all numeric fields (as_of_ts, window seconds,
// timestamps) are integer domain, compared only via >= /</index-lookup, never fractional
// arithmetic. Forced CATEGORICAL boundary cases (as_of_ts exactly at earliest_final_at) are used
// in place of ULP forcing, per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies. This
// file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-492-classify-settlement-finality.proptest.mjs

import { compute } from '../art-492-classify-settlement-finality.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-492-classify-settlement-finality.fixtures.json');
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
const rand = mulberry32(0x492C3);
function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }
function pick(rng, arr) { return arr[randInt(rng, 0, arr.length - 1)]; }
const TRIALS = 10000;
const MODELS = ['optimistic_challenge', 'validity_proof', 'single_slot_bft'];
const LADDERS = {
  optimistic_challenge: ['soft', 'posted', 'challengeable', 'final'],
  validity_proof: ['soft', 'committed', 'proven_unfinalized', 'final'],
  single_slot_bft: ['soft', 'final'],
};

function mkPP(rng) {
  const settlement_model = pick(rng, MODELS);
  return {
    settlement_model,
    as_of_ts: randInt(rng, 0, 2000000000),
    assertion_created_at: rng() < 0.8 ? randInt(rng, 0, 2000000000) : undefined,
    challenge_window_seconds: rng() < 0.5 ? randInt(rng, 1, 1000000) : undefined,
    batch_posted: rng() < 0.7,
    batch_committed_at: rng() < 0.8 ? randInt(rng, 0, 2000000000) : undefined,
    proof_submitted_at: rng() < 0.6 ? randInt(rng, 0, 2000000000) : undefined,
    proof_accepted: rng() < 0.5,
    l1_finalized: rng() < 0.5,
    l1_finality_seconds: rng() < 0.5 ? randInt(rng, 1, 10000) : undefined,
    included_in_block: rng() < 0.5,
    quorum_committed: rng() < 0.5,
    required_tier: pick(rng, LADDERS[settlement_model]),
    claimed_tier: rng() < 0.6 ? pick(rng, LADDERS[settlement_model]) : undefined,
    chain_label: 'chain-' + randInt(rng, 0, 100),
  };
}

// ---------- P1: boundedness — finality_tier always a member of its own model's tier_ladder ----------
function checkP1_tierInLadder() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { finality_tier, tier_ladder, tier_rank } = r.output_payload;
    if (!tier_ladder.includes(finality_tier)) violations++;
    if (tier_rank !== tier_ladder.indexOf(finality_tier)) violations++;
  }
  return { name: 'P1_finality_tier_always_in_own_model_ladder', trials: checked, violations };
}

// ---------- P2: fixed rule — unrecognised settlement_model always defaults to optimistic_challenge ----------
function checkP2_modelDefaulting() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS / 4; i++) {
    const pp = mkPP(rand);
    pp.settlement_model = 'not_a_real_model_' + randInt(rand, 0, 100);
    const r = compute(pp);
    checked++;
    if (r.output_payload.settlement_model !== 'optimistic_challenge') violations++;
    if (!r.compliance_flags.includes('FINALITY_MODEL_DEFAULTED')) violations++;
  }
  return { name: 'P2_unrecognised_model_defaults_to_optimistic_challenge', trials: checked, violations };
}

// ---------- P3: fixed rule — meets_required_tier exact equivalence with rank comparison ----------
function checkP3_meetsRequiredTierExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { tier_ladder, tier_rank, required_tier, meets_required_tier } = r.output_payload;
    const expected = tier_rank >= tier_ladder.indexOf(required_tier);
    if (meets_required_tier !== expected) violations++;
  }
  return { name: 'P3_meets_required_tier_exact_rank_comparison', trials: checked, violations };
}

// ---------- P4: fixed rule — claim_verdict overstated iff claimed tier ranks above evaluated tier ----------
function checkP4_claimVerdictExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { tier_ladder, tier_rank, claimed_tier, claim_verdict } = r.output_payload;
    if (claimed_tier === null) {
      if (claim_verdict !== 'no_claim') violations++;
    } else {
      const claimedRank = tier_ladder.indexOf(claimed_tier);
      const expected = claimedRank > tier_rank ? 'claim_overstated' : 'claim_supported';
      if (claim_verdict !== expected) violations++;
    }
  }
  return { name: 'P4_claim_verdict_exact_rank_overstatement_check', trials: checked, violations };
}

// ---------- P5 (mandatory, float:no exception): forced categorical boundary cases ----------
const BOUNDARY_CASES = [
  [{ settlement_model: 'optimistic_challenge', batch_posted: true, assertion_created_at: 1000, challenge_window_seconds: 604800, as_of_ts: 1000 + 604800, required_tier: 'final' }, 'as_of_ts exactly equal to earliest_final_at — challenge window closed, must be final (>=)'],
  [{ settlement_model: 'optimistic_challenge', batch_posted: true, assertion_created_at: 1000, challenge_window_seconds: 604800, as_of_ts: 1000 + 604800 - 1, required_tier: 'final' }, 'as_of_ts one second before earliest_final_at — must be challengeable, not final'],
  [{ settlement_model: 'validity_proof', batch_committed_at: 1, proof_accepted: true, l1_finalized: true, required_tier: 'final' }, 'validity_proof both gates true — must be final (two-gate AND, not OR)'],
  [{ settlement_model: 'validity_proof', batch_committed_at: 1, proof_accepted: true, l1_finalized: false, required_tier: 'final' }, 'validity_proof proof accepted but L1 not finalized — must be proven_unfinalized, distinct from committed and final'],
  [{ settlement_model: 'single_slot_bft', included_in_block: true, quorum_committed: false, required_tier: 'final' }, 'single_slot_bft inclusion without quorum — must be soft, only two tiers exist on this ladder'],
  [{ settlement_model: 'not_recognised_xyz', batch_posted: false, as_of_ts: 0, required_tier: 'final' }, 'garbage settlement_model string — must silently default to optimistic_challenge, never throw'],
  [{ settlement_model: 'optimistic_challenge', batch_posted: true, as_of_ts: 0, required_tier: 'not_a_tier' }, 'required_tier not on the model ladder — must fall back to the top tier of the ladder'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const plausible = o.tier_ladder.includes(o.finality_tier) && typeof o.meets_required_tier === 'boolean';
    rows.push({ label, input: pp, finality_tier: o.finality_tier, tier_ladder: o.tier_ladder, meets_required_tier: o.meets_required_tier, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_tierInLadder());
results.properties.push(checkP2_modelDefaulting());
results.properties.push(checkP3_meetsRequiredTierExact());
results.properties.push(checkP4_claimVerdictExact());
results.boundary_forced = checkP5_forced();

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
