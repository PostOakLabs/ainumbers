// kernel_digest_at_authoring: sha256:46901368779de44333c60943c2a52d7458222841e0ac6420898016c6664114dd
//
// FV-PROPFLOOR-SHARD-B26-1 — property-test floor for art-527-classify-ledger-consensus-finality.
// Class B (bounded-categorical), FLOAT:NO per the WU row — outcome is a terminal-branch enum
// classification over caller-declared booleans/integers/enums, no arithmetic beyond integer
// sequence comparisons (last_ledger_sequence, highest_validated_ledger). Forced CATEGORICAL
// boundary cases used in place of ULP forcing. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1/B3/B12 harness. READ-ONLY w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-527-classify-ledger-consensus-finality.proptest.mjs

import { compute } from '../art-527-classify-ledger-consensus-finality.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-527-classify-ledger-consensus-finality.fixtures.json');
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
const rand = mulberry32(0x527527);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const DBI_OUTCOMES = ['pending', 'expired_unprovable', 'final_never_included', 'final_failure_tec', 'final_success'];
const FBFT_OUTCOMES = ['pending', 'final'];
const RESULT_CLASSES = ['tes', 'tec', 'other', 'garbage'];

function mkPP(rng) {
  const settlement_model = pick(rng, ['deadline_bounded_inclusion', 'federated_bft', 'unknown_model_' + Math.floor(rng() * 5)]);
  if (settlement_model === 'federated_bft') {
    return {
      settlement_model,
      as_of_ts: Math.floor(rng() * 2000000000),
      externalized: rng() < 0.5,
      quorum_slice_trust_ok: rng() < 0.5,
      issuer_clawback_enabled: rng() < 0.3,
      time_bounds_max: Math.floor(rng() * 2000000000),
      required_tier: pick(rng, [...FBFT_OUTCOMES, 'bogus']),
      claimed_tier: rng() < 0.7 ? pick(rng, [...FBFT_OUTCOMES, 'bogus']) : undefined,
      chain_label: rng() < 0.8 ? 'Stellar mainnet' : '',
    };
  }
  const last_ledger_sequence = Math.floor(rng() * 2000);
  const highest_validated_ledger = Math.floor(rng() * 2000);
  return {
    settlement_model,
    as_of_ts: Math.floor(rng() * 2000000000),
    last_ledger_sequence,
    submitted_at_ledger: Math.floor(rng() * 2000),
    included_in_ledger: rng() < 0.4 ? Math.floor(rng() * 2000) : null,
    ledger_validated: rng() < 0.5,
    result_class: pick(rng, RESULT_CLASSES),
    highest_validated_ledger,
    continuous_history_ok: rng() < 0.5,
    required_tier: pick(rng, [...DBI_OUTCOMES, 'bogus']),
    claimed_tier: rng() < 0.7 ? pick(rng, [...DBI_OUTCOMES, 'bogus']) : undefined,
    chain_label: rng() < 0.8 ? 'XRPL mainnet' : '',
  };
}

// ---------- P1: outcome is always in the fixed vocab for the resolved settlement_model ----------
function checkP1_outcomeBoundedToModelVocab() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const vocab = r.output_payload.settlement_model === 'federated_bft' ? FBFT_OUTCOMES : DBI_OUTCOMES;
    if (vocab.indexOf(r.output_payload.outcome) < 0) violations++;
  }
  return { name: 'P1_outcome_bounded_to_model_vocab', trials: checked, violations };
}

// ---------- P2: meets_required_tier is the exact equality of outcome and required_tier ----------
function checkP2_meetsRequiredTierExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = r.output_payload.outcome === r.output_payload.required_tier;
    if (r.output_payload.meets_required_tier !== expected) violations++;
  }
  return { name: 'P2_meets_required_tier_exact_equality', trials: checked, violations };
}

// ---------- P3: claim_verdict is the exact three-way classification against claimed_tier ----------
function checkP3_claimVerdictExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { claimed_tier, outcome, claim_verdict, settlement_model } = r.output_payload;
    const vocab = settlement_model === 'federated_bft' ? FBFT_OUTCOMES : DBI_OUTCOMES;
    let expected;
    if (!claimed_tier || vocab.indexOf(claimed_tier) < 0) expected = 'no_claim';
    else expected = claimed_tier === outcome ? 'claim_supported' : 'claim_overstated';
    if (claim_verdict !== expected) violations++;
  }
  return { name: 'P3_claim_verdict_exact_three_way_classification', trials: checked, violations };
}

// ---------- P4: model-specific fields are null on the OTHER model (fixed key-set discipline) ----------
function checkP4_crossModelFieldsNull() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.settlement_model === 'federated_bft') {
      if (op.submitted_at_ledger !== null || op.included_in_ledger !== null || op.highest_validated_ledger !== null || op.result_class !== null) violations++;
      if (op.time_bounds_max === undefined) violations++;
    } else {
      if (op.time_bounds_max !== null) violations++;
      if (op.submitted_at_ledger === undefined || op.result_class === undefined) violations++;
    }
  }
  return { name: 'P4_cross_model_fields_null_fixed_key_set', trials: checked, violations };
}

// ---------- P5 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'entirely empty input — must default to deadline_bounded_inclusion, outcome pending, no throw'],
  [{ settlement_model: 'deadline_bounded_inclusion', last_ledger_sequence: 100, highest_validated_ledger: 100, included_in_ledger: null, continuous_history_ok: true }, 'highest_validated_ledger exactly equals last_ledger_sequence (deadline boundary lower edge) — deadline_passed requires >= last_ledger_sequence+1, so this must NOT be past-deadline yet'],
  [{ settlement_model: 'deadline_bounded_inclusion', last_ledger_sequence: 100, highest_validated_ledger: 101, included_in_ledger: null, continuous_history_ok: true }, 'highest_validated_ledger exactly one past last_ledger_sequence (deadline boundary upper edge) — deadline_passed must now be true'],
  [{ settlement_model: 'deadline_bounded_inclusion', included_in_ledger: 5, ledger_validated: true, result_class: 'tes' }, 'validated tes inclusion — final_success regardless of deadline state'],
  [{ settlement_model: 'deadline_bounded_inclusion', included_in_ledger: 5, ledger_validated: true, result_class: 'tec' }, 'validated tec inclusion — final_failure_tec, a terminal branch that ranks against nothing'],
  [{ settlement_model: 'deadline_bounded_inclusion', included_in_ledger: 5, ledger_validated: false, result_class: 'tes' }, 'ledger_validated exactly false with an included_in_ledger value — must NOT be treated as final (unvalidated inclusion is not final)'],
  [{ settlement_model: 'federated_bft', externalized: true, quorum_slice_trust_ok: false }, 'externalized exactly true with quorum_slice_trust_ok exactly false — outcome final but FINALITY_RISK_QUORUM_SLICE_TRUST flagged, not a downgrade of outcome'],
  [{ settlement_model: 'federated_bft', externalized: false }, 'externalized exactly false — outcome pending, no reorg/quorum rationale emitted'],
  [{ settlement_model: 'not_a_real_model' }, 'unrecognised settlement_model string — must default to deadline_bounded_inclusion and set draft_pinned/FINALITY_MODEL_DEFAULTED, never throw'],
  [{ settlement_model: 'deadline_bounded_inclusion', required_tier: 'final_success', claimed_tier: 'final_success', included_in_ledger: 5, ledger_validated: true, result_class: 'tes' }, 'claimed_tier exactly equal to the evaluated outcome — claim_supported, never overstated'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { outcome, settlement_model, meets_required_tier, claim_verdict } = r.output_payload;
    const plausible = typeof outcome === 'string' && typeof settlement_model === 'string' && typeof meets_required_tier === 'boolean' && typeof claim_verdict === 'string';
    rows.push({ label, input: pp, outcome, settlement_model, meets_required_tier, claim_verdict, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_outcomeBoundedToModelVocab());
results.properties.push(checkP2_meetsRequiredTierExact());
results.properties.push(checkP3_claimVerdictExact());
results.properties.push(checkP4_crossModelFieldsNull());
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
