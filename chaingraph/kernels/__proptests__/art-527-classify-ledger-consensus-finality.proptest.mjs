// kernel_digest_at_authoring: sha256:9f216a6b8072c4d486cd19c961df422c56fb4cbef5274d2754b1b59a033920d3
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
const ALPG_OUTCOMES = ['pending', 'notarized_pending', 'skipped', 'final', 'pre_activation'];
const RESULT_CLASSES = ['tes', 'tec', 'other', 'garbage'];

function vocabFor(settlement_model) {
  if (settlement_model === 'federated_bft') return FBFT_OUTCOMES;
  if (settlement_model === 'alpenglow') return ALPG_OUTCOMES;
  return DBI_OUTCOMES;
}

function mkPP(rng) {
  const settlement_model = pick(rng, ['deadline_bounded_inclusion', 'federated_bft', 'alpenglow', 'unknown_model_' + Math.floor(rng() * 5)]);
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
  if (settlement_model === 'alpenglow') {
    const pp = {
      settlement_model,
      as_of_ts: Math.floor(rng() * 2000000000),
      required_tier: pick(rng, [...ALPG_OUTCOMES, 'bogus']),
      claimed_tier: rng() < 0.7 ? pick(rng, [...ALPG_OUTCOMES, 'bogus']) : undefined,
      chain_label: rng() < 0.8 ? 'Solana mainnet' : '',
    };
    // Observed position: usually supplied (epoch preferred over slot), sometimes absent so the
    // regime-assumption branch is exercised. Stakes: usually a valid 0..100 integer, sometimes
    // absent, sometimes malformed (outside 0..100) so the pctOk treatment is exercised.
    const r = rng();
    if (r < 0.55) pp.observed_epoch = 1060 + Math.floor(rng() * 20);
    else if (r < 0.8) pp.observed_slot = 450000000 + Math.floor(rng() * 25000000);
    const stake = () => {
      const s = rng();
      if (s < 0.6) return Math.floor(rng() * 101);
      if (s < 0.7) return null;
      if (s < 0.75) return pick(rng, [-1, 101, 150]);
      return undefined;
    };
    if (rng() < 0.85) pp.notarize_stake_pct = stake();
    if (rng() < 0.6) pp.finalize_stake_pct = stake();
    if (rng() < 0.6) pp.skip_stake_pct = stake();
    return pp;
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
    const vocab = vocabFor(r.output_payload.settlement_model);
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
    const vocab = vocabFor(settlement_model);
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
    } else if (op.settlement_model === 'alpenglow') {
      if (op.submitted_at_ledger !== null || op.included_in_ledger !== null || op.highest_validated_ledger !== null || op.result_class !== null) violations++;
      if (op.time_bounds_max !== null) violations++;
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
  [{ settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 80 }, 'notarize_stake_pct exactly 80 — fast-finalization lower edge: one voting round finalizes, so outcome is final at the boundary itself'],
  [{ settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 79 }, 'notarize_stake_pct exactly one below the fast threshold — must NOT fast-finalize; falls through to the notarization-certificate branch'],
  [{ settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 60, finalize_stake_pct: 60 }, 'both rounds exactly 60 with round-one below fast — slow-finalization lower edge: final in two rounds'],
  [{ settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 59, finalize_stake_pct: 60 }, 'round one one below 60 with finalize at 60 — slow finalization needs both rounds, so pending'],
  [{ settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 55, skip_stake_pct: 60 }, 'skip_stake_pct exactly 60 with notarize below the certificate — skip-certification lower edge: slot skipped, no block final'],
  [{ settlement_model: 'alpenglow', observed_epoch: 1063, notarize_stake_pct: 85 }, 'observed_epoch exactly one below the pinned activation epoch — pre_activation regardless of the vote facts'],
  [{ settlement_model: 'alpenglow', observed_epoch: 1064, notarize_stake_pct: 85 }, 'observed_epoch exactly at the pinned activation epoch — live Alpenglow regime applies'],
  [{ settlement_model: 'alpenglow', observed_slot: 459647999 }, 'observed_slot exactly one below the pinned activation slot with no epoch — pre_activation decided from the slot alone'],
  [{ settlement_model: 'alpenglow', observed_slot: 459648000 }, 'observed_slot exactly at the pinned activation slot with no epoch — live Alpenglow regime decided from the slot alone'],
  [{ settlement_model: 'alpenglow' }, 'no observed position and no vote facts — regime assumed and vote facts missing flagged, outcome pending, never throw'],
  [{ settlement_model: 'alpenglow', observed_epoch: 1071, notarize_stake_pct: 101 }, 'notarize_stake_pct exactly 101 — malformed stake outside 0..100 treated as absent, so pending with vote facts missing, no throw'],
  [{ settlement_model: 'alpenglow', observed_epoch: 1071, notarize_stake_pct: 0 }, 'notarize_stake_pct exactly 0 — inside the 0..100 range so a fact was supplied, but it forms no certificate: pending WITHOUT the missing-facts flag'],
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

// ---------- P6: alpenglow confirmation policy — exact outcome, compliance flag SET, and draft_pinned
// at every certificate boundary (threshold, activation, malformed-fact treatment, claim verdict) ----------
// Flag sets are asserted as sorted joins: kills flag drops/renames and threshold flips that change
// which flags fire, without coupling to push order.
// Named-property case objects, NOT positional tuples: mixed-type tuple destructuring
// infers `string | boolean | string[] | {...}` unions and trips jsdoc-checkjs
// (TS2339/TS2345), the same red the PROPTEST-TUPLE shape memory records.
const ALPG_POLICY_CASES = [
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 80 }, label: 'fast lower edge', wantOutcome: 'final', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_FAST_FINALIZED', 'FINALITY_MEETS_CUTOFF'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 84 }, label: 'fast above strong-OC stake', wantOutcome: 'final', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_FAST_FINALIZED', 'FINALITY_MEETS_CUTOFF'], rationaleNeedle: '82% stake of the strong optimistic confirmation' },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 82 }, label: 'strong-OC stake lower edge', wantOutcome: 'final', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_FAST_FINALIZED', 'FINALITY_MEETS_CUTOFF'], rationaleNeedle: '82% stake of the strong optimistic confirmation' },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 81 }, label: 'fast but below strong-OC stake', wantOutcome: 'final', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_FAST_FINALIZED', 'FINALITY_MEETS_CUTOFF'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 60 }, label: 'notarize cert lower edge', wantOutcome: 'notarized_pending', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 60, finalize_stake_pct: 60 }, label: 'slow lower edge (both rounds at 60)', wantOutcome: 'final', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_SLOW_FINALIZED', 'FINALITY_MEETS_CUTOFF'], rationaleNeedle: 'Round-one notarize stake of 60% and round-two finalize stake of 60%' },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 59, finalize_stake_pct: 60 }, label: 'slow refused: round one at 59', wantOutcome: 'pending', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: 'slow finalization also needs a 60% round-one notarize certificate' },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, finalize_stake_pct: 60 }, label: 'slow refused: finalize alone', wantOutcome: 'pending', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 0, finalize_stake_pct: 60 }, label: 'slow refused: round one at zero', wantOutcome: 'pending', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 101, finalize_stake_pct: 64 }, label: 'malformed notarize with valid finalize', wantOutcome: 'pending', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_VOTE_FACT_MALFORMED', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: 'notarize_stake_pct were not usable percentages' },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: '85', finalize_stake_pct: 64 }, label: 'string notarize with valid finalize', wantOutcome: 'pending', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_VOTE_FACT_MALFORMED', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: -1, skip_stake_pct: 60 }, label: 'negative notarize with skip certificate', wantOutcome: 'skipped', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_VOTE_FACT_MALFORMED', 'ALPENGLOW_SLOT_SKIPPED', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, observed_slot: 100, notarize_stake_pct: 85 }, label: 'epoch live, slot pre-activation: conflict', wantOutcome: 'pending', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_POSITION_CONFLICT', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: 'disagree about the Alpenglow regime' },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1063, observed_slot: 470000000, notarize_stake_pct: 85 }, label: 'epoch pre-activation, slot live: conflict', wantOutcome: 'pending', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_POSITION_CONFLICT', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 55, skip_stake_pct: 60 }, label: 'skip cert lower edge', wantOutcome: 'skipped', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_SLOT_SKIPPED', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1063, notarize_stake_pct: 85 }, label: 'epoch one below activation', wantOutcome: 'pre_activation', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_NOT_ACTIVE', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_slot: 459647999, notarize_stake_pct: 85 }, label: 'slot one below activation', wantOutcome: 'pre_activation', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_NOT_ACTIVE', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_slot: 459648000 }, label: 'slot at activation, no facts', wantOutcome: 'pending', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_VOTE_FACTS_MISSING', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow' }, label: 'no position no facts', wantOutcome: 'pending', wantVerdict: 'no_claim', wantDraftPinned: true, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_REGIME_ASSUMED', 'ALPENGLOW_VOTE_FACTS_MISSING', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1071, notarize_stake_pct: 101 }, label: 'malformed stake treated as absent', wantOutcome: 'pending', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_VOTE_FACT_MALFORMED', 'ALPENGLOW_VOTE_FACTS_MISSING', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1071, notarize_stake_pct: 0 }, label: 'zero stake is a fact, not absence', wantOutcome: 'pending', wantVerdict: 'no_claim', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'FINALITY_BELOW_CUTOFF', 'ESCALATION_RAISED'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 80, claimed_tier: 'notarized_pending' }, label: 'final classified as merely notarized', wantOutcome: 'final', wantVerdict: 'claim_overstated', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_FAST_FINALIZED', 'FALSE_FINALITY_CLAIM', 'FINALITY_MEETS_CUTOFF'], rationaleNeedle: null },
  { pp: { settlement_model: 'alpenglow', observed_epoch: 1070, notarize_stake_pct: 80, required_tier: 'final', claimed_tier: 'final' }, label: 'claim matches evaluated outcome', wantOutcome: 'final', wantVerdict: 'claim_supported', wantDraftPinned: false, wantFlags: ['FINALITY_CLASSIFIED', 'ALPENGLOW_FAST_FINALIZED', 'FINALITY_MEETS_CUTOFF'], rationaleNeedle: null },
];

function checkP6_alpenglowCertificatePolicy() {
  const failures = [];
  for (const c of ALPG_POLICY_CASES) {
    const pp = c.pp;
    const r = compute(pp);
    const op = r.output_payload;
    const gotFlags = r.compliance_flags.slice().sort().join(',');
    const wantFlagStr = c.wantFlags.slice().sort().join(',');
    if (op.outcome !== c.wantOutcome) failures.push({ label: c.label, kind: 'outcome', want: c.wantOutcome, got: op.outcome });
    if (gotFlags !== wantFlagStr) failures.push({ label: c.label, kind: 'flags', want: wantFlagStr, got: gotFlags });
    if (op.claim_verdict !== c.wantVerdict) failures.push({ label: c.label, kind: 'claim_verdict', want: c.wantVerdict, got: op.claim_verdict });
    if (op.draft_pinned !== c.wantDraftPinned) failures.push({ label: c.label, kind: 'draft_pinned', want: c.wantDraftPinned, got: op.draft_pinned });
    if (c.rationaleNeedle !== null) {
      const joined = op.rationale.join(' ');
      if (joined.indexOf(c.rationaleNeedle) < 0) failures.push({ label: c.label, kind: 'rationale-missing', want: c.rationaleNeedle });
    } else if (op.settlement_model === 'alpenglow' && pp.notarize_stake_pct === 81) {
      if (op.rationale.join(' ').indexOf('strong optimistic confirmation') >= 0) failures.push({ label: c.label, kind: 'rationale-leak' });
    }
  }
  return { name: 'P6_alpenglow_certificate_policy_boundaries', cases: ALPG_POLICY_CASES.length, violations: failures.length, failures };
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
results.properties.push(checkP6_alpenglowCertificatePolicy());
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
