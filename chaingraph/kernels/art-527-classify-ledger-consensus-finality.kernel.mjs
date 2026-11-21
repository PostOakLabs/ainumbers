/**
 * art-527-classify-ledger-consensus-finality.kernel.mjs
 * Vendor-neutral classifier for ledger-consensus models whose finality is NOT a monotone rank.
 *
 * Sibling of art-492-classify-settlement-finality, kept as a NEW node rather than a widened enum
 * on that kernel: art-492's three models all rank on one ladder (soft -> ... -> final), and this
 * node covers two models that do not. deadline_bounded_inclusion (XRPL) is a set of TERMINAL
 * BRANCHES (final success, final tec-failure, provable non-inclusion, or an unprovable-absence
 * state caused by a gap in validated history) where none of the branches outranks another.
 * federated_bft (Stellar SCP) has no reorg tier at all once externalized: there is nothing to
 * rank against.
 *
 * The machine-branch field is `outcome`, never a tier_rank / ladder index; forcing one of these
 * outcomes onto a ladder would assert a false ordering between e.g. final_failure_tec and
 * expired_unprovable, which the research behind this node found no basis for.
 *
 * Caller-supplied signed ledger facts only: no live network fetch, no witness/light-client infra,
 * no embedded validator-list (UNL) snapshot. Pure decision kernel: no clock, no randomness, no
 * network, no storage. as_of_ts is caller supplied; buildArtifact takes `now` via options.
 *
 * The alpenglow model (added additively; the two existing models' outputs are unchanged) classifies
 * Solana Votor vote/stake facts against the confirmation thresholds pinned from primary text in the
 * constants below, gated on the pinned mainnet activation (epoch 1064, slot 459648000).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-527-classify-ledger-consensus-finality';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mandate_type: 'compliance_mandate',
  mcp_name:     'classify_ledger_consensus_finality',
  gpu:          false,
};

const MODELS = ['deadline_bounded_inclusion', 'federated_bft', 'alpenglow'];

// Alpenglow confirmation-policy profile, pinned from primary text 2026-11-20 (ART527-ALPENGLOW-PROFILE-1):
// - SIMD-0326 (solana-foundation/solana-improvement-documents, proposals/0326-alpenglow.md, retrieved
//   2026-11-20): "Fast-finalization is the mechanism of finalizing a block after observing one round of
//   votes for the block from 80% of the stake"; "Slow-finalization ... after observing two rounds of
//   votes for the block from 60% of the stake". Certificate thresholds (same file): notarization 60% of
//   notarize votes; skip 60% of skip or skip-fallback votes; finalization 60% of finalize votes;
//   fast-finalization 80% of notarize votes; notar-fallback 60%. Timeouts are short periods measured
//   locally by the nodes, dynamically adjusted (no fixed protocol constant is pinned by that text, so
//   this profile encodes the threshold policy, never a timeout constant).
// - SIMD-0384 (proposals/0384-alpenglow-migration.md, retrieved 2026-11-20): strong optimistic
//   confirmation is a block carrying vote transactions from at least 82% of stake.
// - Anza docs, docs.anza.xyz/consensus/alpenglow (retrieved 2026-11-20): "Alpenglow targets finality in
//   roughly 150 ms under normal network conditions"; docs.anza.xyz/consensus/commitments: under
//   Alpenglow the Confirmed and Finalized commitment statuses are equivalent (both mean the transaction
//   is permanently committed and cannot be rolled back). Rotor data dissemination is NOT live (SIMD-0326
//   keeps Turbine initially), so this profile classifies Votor vote/stake facts only.
// - Activation: agave feature-set/src/lib.rs declares feature A1pengvuM6JEcyNuTnMqepBKhwHE3N6PmUrdATGawhJS
//   ("SIMD-0326: Alpenglow: new consensus algorithm"); the on-chain feature account (mainnet, retrieved
//   2026-11-20) records activated_at_slot 459648000, which is exactly epoch 1064 (slot 459648000 =
//   1064 x 432000 slots/epoch).
const ALPENGLOW_FAST_FINALIZE_STAKE_PCT = 80;
const ALPENGLOW_SLOW_FINALIZE_STAKE_PCT = 60;
const ALPENGLOW_NOTARIZE_CERT_STAKE_PCT = 60;
const ALPENGLOW_SKIP_CERT_STAKE_PCT = 60;
const ALPENGLOW_STRONG_OC_STAKE_PCT = 82;
const ALPENGLOW_ACTIVATION_EPOCH = 1064;
const ALPENGLOW_ACTIVATION_SLOT = 459648000;
const ALPENGLOW_SLOTS_PER_EPOCH = 432000;

function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }
function bool(v) { return v === true; }

// I-JSON: an integer beyond 2^53 is emitted as a string rather than a lossy number.
function ijson(v) {
  if (v === null) return null;
  return Number.isSafeInteger(v) ? v : String(v);
}

function classifyDeadlineBoundedInclusion(pp, compliance_flags, rationale) {
  const last_ledger_sequence = num(pp.last_ledger_sequence);
  const submitted_at_ledger = num(pp.submitted_at_ledger);
  const included_in_ledger = num(pp.included_in_ledger);
  const ledger_validated = bool(pp.ledger_validated);
  const result_class = ['tes', 'tec', 'other'].indexOf(str(pp.result_class)) >= 0 ? str(pp.result_class) : 'other';
  const highest_validated_ledger = num(pp.highest_validated_ledger) ?? 0;
  const continuous_history_ok = bool(pp.continuous_history_ok);

  let outcome;
  const deadline_passed = last_ledger_sequence !== null && highest_validated_ledger >= last_ledger_sequence + 1;

  if (included_in_ledger !== null && ledger_validated && result_class === 'tes') {
    outcome = 'final_success';
    rationale.push('The transaction is included in a validated ledger with a tes result, so it is a final success.');
  } else if (included_in_ledger !== null && ledger_validated && result_class === 'tec') {
    outcome = 'final_failure_tec';
    compliance_flags.push('TEC_FINAL_FAILURE');
    rationale.push('The transaction is included in a validated ledger with a tec result. This is a terminal, final failure: the fee was consumed, there is no other ledger effect, and it is not retryable as the same intent.');
  } else if (deadline_passed && included_in_ledger === null && continuous_history_ok) {
    outcome = 'final_never_included';
    rationale.push('The submission deadline (last_ledger_sequence) has passed, the caller attests gap-free validated history over the submission range, and no inclusion was found. Absence is proven.');
  } else if (deadline_passed && included_in_ledger === null && !continuous_history_ok) {
    outcome = 'expired_unprovable';
    compliance_flags.push('ABSENCE_PROOF_INCOMPLETE');
    rationale.push('The submission deadline has passed and no inclusion was found, but the caller does not attest gap-free validated history over that range, so absence is not proven. The transaction could exist in the gap.');
  } else {
    outcome = 'pending';
    rationale.push('The submission deadline has not yet passed (highest_validated_ledger has not reached last_ledger_sequence) and no validated inclusion has been found.');
  }

  return {
    outcome,
    finality_tier: outcome,
    reorg_exposure: 'none',
    submitted_at_ledger: ijson(submitted_at_ledger),
    included_in_ledger: ijson(included_in_ledger),
    highest_validated_ledger: ijson(highest_validated_ledger),
    result_class,
  };
}

function classifyFederatedBft(pp, compliance_flags, rationale) {
  const externalized = bool(pp.externalized);
  const quorum_slice_trust_ok = bool(pp.quorum_slice_trust_ok);
  const issuer_clawback_enabled = bool(pp.issuer_clawback_enabled);
  const time_bounds_max = num(pp.time_bounds_max);

  const outcome = externalized ? 'final' : 'pending';
  if (outcome === 'final') {
    rationale.push('The transaction is externalized, which is unconditional finality under SCP: there is no reorg path once externalized.');
    compliance_flags.push('FINALITY_RISK_QUORUM_SLICE_TRUST');
    rationale.push(quorum_slice_trust_ok
      ? 'The caller attests the relied-upon quorum slice(s) are within its own trust configuration. Consensus finality does not remove quorum-slice topology risk, it is a separate, declared input.'
      : 'The caller does NOT attest the relied-upon quorum slice(s) are within its own trust configuration. The externalization is protocol-final, but the residual quorum-slice trust risk is unconfirmed.');
  } else {
    rationale.push('The transaction has not yet been externalized, so there is no finality determination to make.');
  }

  if (issuer_clawback_enabled) {
    compliance_flags.push('ISSUER_CLAWBACK_DISCLOSED');
    rationale.push('Issuer-clawback is enabled on this asset. An externalized transfer can still be clawed back by the issuer: that is an asset-authority property, distinct from consensus finality, and is disclosed separately here.');
  }

  return {
    outcome,
    finality_tier: outcome,
    reorg_exposure: 'none',
    time_bounds_max: ijson(time_bounds_max),
  };
}

function classifyAlpenglow(pp, compliance_flags, rationale) {
  // Each of these is an optional caller fact: the null coalesce evidences absence to the input-schema
  // derivation. The profile classifies a missing fact (assumption flag or pending outcome); it never
  // fails closed on a missing optional.
  const observed_epoch = num(pp.observed_epoch ?? null);
  const observed_slot = num(pp.observed_slot ?? null);
  const notarize_stake_pct = num(pp.notarize_stake_pct ?? null);
  const finalize_stake_pct = num(pp.finalize_stake_pct ?? null);
  const skip_stake_pct = num(pp.skip_stake_pct ?? null);

  // A stake percentage outside 0..100 is a malformed fact, same treatment as absent: the kernel
  // never invents a certificate from malformed input.
  const pctOk = (v) => v !== null && v >= 0 && v <= 100;
  const notarize_ok = pctOk(notarize_stake_pct);
  const finalize_ok = pctOk(finalize_stake_pct);
  const skip_ok = pctOk(skip_stake_pct);

  // Regime gate: the caller-declared observed position against the pinned activation. The epoch, when
  // supplied, decides; the slot is consulted only when no epoch was supplied. With no position at all
  // the profile classifies under the live regime (Alpenglow) and discloses the assumption.
  const position_supplied = observed_epoch !== null || observed_slot !== null;
  const pre_activation = observed_epoch !== null
    ? observed_epoch < ALPENGLOW_ACTIVATION_EPOCH
    : (observed_slot !== null && observed_slot < ALPENGLOW_ACTIVATION_SLOT);

  if (!position_supplied) {
    compliance_flags.push('ALPENGLOW_REGIME_ASSUMED');
    rationale.push('No observed_epoch or observed_slot was supplied, so the classification assumes the live regime is Alpenglow, active since the pinned activation (epoch ' + ALPENGLOW_ACTIVATION_EPOCH + ', slot ' + ALPENGLOW_ACTIVATION_SLOT + '). Supply the observed position to remove this assumption.');
  }

  if (pre_activation) {
    compliance_flags.push('ALPENGLOW_NOT_ACTIVE');
    rationale.push('The observed position precedes the pinned Alpenglow activation (epoch ' + ALPENGLOW_ACTIVATION_EPOCH + ', slot ' + ALPENGLOW_ACTIVATION_SLOT + '), so this position is classified under TowerBFT, whose consensus finality of about 12.8 seconds is probabilistic, not the Votor confirmation policy.');
    return {
      outcome: 'pre_activation',
      finality_tier: 'pre_activation',
      reorg_exposure: 'none',
      draft_pinned: false,
      submitted_at_ledger: null,
      included_in_ledger: null,
      highest_validated_ledger: null,
      result_class: null,
      time_bounds_max: null,
    };
  }

  if (!notarize_ok && !finalize_ok && !skip_ok) {
    compliance_flags.push('ALPENGLOW_VOTE_FACTS_MISSING');
    rationale.push('No notarize_stake_pct, finalize_stake_pct or skip_stake_pct within 0..100 was supplied, so no Votor certificate can be evaluated. The block is pending confirmation.');
    return {
      outcome: 'pending',
      finality_tier: 'pending',
      reorg_exposure: 'none',
      draft_pinned: !position_supplied,
      submitted_at_ledger: null,
      included_in_ledger: null,
      highest_validated_ledger: null,
      result_class: null,
      time_bounds_max: null,
    };
  }

  // Certificate evaluation in fixed order: fast finalization, slow finalization, skip certificate,
  // notarization-without-finalization, pending. The thresholds are the SIMD-0326 certificate stakes.
  if (notarize_ok && notarize_stake_pct >= ALPENGLOW_FAST_FINALIZE_STAKE_PCT) {
    compliance_flags.push('ALPENGLOW_FAST_FINALIZED');
    rationale.push('Round-one notarize stake of ' + notarize_stake_pct + '% meets the ' + ALPENGLOW_FAST_FINALIZE_STAKE_PCT + '% fast-finalization threshold (SIMD-0326), which finalizes the block after one voting round.');
    if (notarize_stake_pct >= ALPENGLOW_STRONG_OC_STAKE_PCT) {
      rationale.push('The same round-one stake also exceeds the ' + ALPENGLOW_STRONG_OC_STAKE_PCT + '% stake of the strong optimistic confirmation defined by the Alpenglow migration (SIMD-0384), though strong optimistic confirmation additionally requires the following-slot block to carry those votes.');
    }
    rationale.push('Under Alpenglow the Confirmed and Finalized commitment statuses are equivalent (Anza documentation): the block is permanently committed and cannot be rolled back.');
    return {
      outcome: 'final',
      finality_tier: 'final',
      reorg_exposure: 'none',
      draft_pinned: !position_supplied,
      submitted_at_ledger: null,
      included_in_ledger: null,
      highest_validated_ledger: null,
      result_class: null,
      time_bounds_max: null,
    };
  }
  if (finalize_ok && finalize_stake_pct >= ALPENGLOW_SLOW_FINALIZE_STAKE_PCT) {
    compliance_flags.push('ALPENGLOW_SLOW_FINALIZED');
    rationale.push('Round-two finalize stake of ' + finalize_stake_pct + '% meets the ' + ALPENGLOW_SLOW_FINALIZE_STAKE_PCT + '% slow-finalization threshold (SIMD-0326), which finalizes the block after two voting rounds.');
    rationale.push('Under Alpenglow the Confirmed and Finalized commitment statuses are equivalent (Anza documentation): the block is permanently committed and cannot be rolled back.');
    return {
      outcome: 'final',
      finality_tier: 'final',
      reorg_exposure: 'none',
      draft_pinned: !position_supplied,
      submitted_at_ledger: null,
      included_in_ledger: null,
      highest_validated_ledger: null,
      result_class: null,
      time_bounds_max: null,
    };
  }
  if (skip_ok && skip_stake_pct >= ALPENGLOW_SKIP_CERT_STAKE_PCT) {
    compliance_flags.push('ALPENGLOW_SLOT_SKIPPED');
    rationale.push('Skip or skip-fallback stake of ' + skip_stake_pct + '% meets the ' + ALPENGLOW_SKIP_CERT_STAKE_PCT + '% skip-certificate threshold (SIMD-0326): the slot is certified skipped and no block is finalized in it.');
    return {
      outcome: 'skipped',
      finality_tier: 'skipped',
      reorg_exposure: 'none',
      draft_pinned: !position_supplied,
      submitted_at_ledger: null,
      included_in_ledger: null,
      highest_validated_ledger: null,
      result_class: null,
      time_bounds_max: null,
    };
  }
  if (notarize_ok && notarize_stake_pct >= ALPENGLOW_NOTARIZE_CERT_STAKE_PCT) {
    rationale.push('Notarize stake of ' + notarize_stake_pct + '% forms a notarization certificate (the ' + ALPENGLOW_NOTARIZE_CERT_STAKE_PCT + '% threshold of SIMD-0326) but is below the ' + ALPENGLOW_FAST_FINALIZE_STAKE_PCT + '% fast-finalization threshold, so the block is notarized without being final; finality waits on a ' + ALPENGLOW_SLOW_FINALIZE_STAKE_PCT + '% round-two finalize certificate or a later ' + ALPENGLOW_FAST_FINALIZE_STAKE_PCT + '% round-one notarize.');
    return {
      outcome: 'notarized_pending',
      finality_tier: 'notarized_pending',
      reorg_exposure: 'none',
      draft_pinned: !position_supplied,
      submitted_at_ledger: null,
      included_in_ledger: null,
      highest_validated_ledger: null,
      result_class: null,
      time_bounds_max: null,
    };
  }

  rationale.push('The supplied vote facts form no Votor certificate: notarize stake ' + (notarize_ok ? notarize_stake_pct + '% (below the ' + ALPENGLOW_NOTARIZE_CERT_STAKE_PCT + '% notarization threshold)' : 'not supplied') + ', finalize stake ' + (finalize_ok ? finalize_stake_pct + '% (below the ' + ALPENGLOW_SLOW_FINALIZE_STAKE_PCT + '% slow-finalization threshold)' : 'not supplied') + ', skip stake ' + (skip_ok ? skip_stake_pct + '% (below the ' + ALPENGLOW_SKIP_CERT_STAKE_PCT + '% skip-certificate threshold)' : 'not supplied') + '. The block is pending confirmation.');
  return {
    outcome: 'pending',
    finality_tier: 'pending',
    reorg_exposure: 'none',
    draft_pinned: !position_supplied,
    submitted_at_ledger: null,
    included_in_ledger: null,
    highest_validated_ledger: null,
    result_class: null,
    time_bounds_max: null,
  };
}

export function compute(pp) {
  pp = pp || {};

  const compliance_flags = ['FINALITY_CLASSIFIED'];
  const rationale = [];
  let draft_pinned = false;

  const requested_model = str(pp.settlement_model);
  const settlement_model = MODELS.indexOf(requested_model) >= 0 ? requested_model : 'deadline_bounded_inclusion';
  if (settlement_model !== requested_model) {
    compliance_flags.push('FINALITY_MODEL_DEFAULTED');
    draft_pinned = true;
    rationale.push('No recognised settlement_model was supplied, so deadline_bounded_inclusion was assumed. Supply settlement_model to remove this assumption.');
  }

  const as_of_ts = num(pp.as_of_ts) ?? 0;
  const chain_label = str(pp.chain_label);

  const model_result = settlement_model === 'federated_bft'
    ? classifyFederatedBft(pp, compliance_flags, rationale)
    : settlement_model === 'alpenglow'
      ? classifyAlpenglow(pp, compliance_flags, rationale)
      : classifyDeadlineBoundedInclusion(pp, compliance_flags, rationale);

  const outcome = model_result.outcome;
  const meets_required_tier_vocab = settlement_model === 'federated_bft'
    ? ['pending', 'final']
    : settlement_model === 'alpenglow'
      ? ['pending', 'notarized_pending', 'skipped', 'final', 'pre_activation']
      : ['pending', 'expired_unprovable', 'final_never_included', 'final_failure_tec', 'final_success'];

  let required_tier = str(pp.required_tier);
  if (meets_required_tier_vocab.indexOf(required_tier) < 0) {
    required_tier = settlement_model === 'deadline_bounded_inclusion' ? 'final_success' : 'final';
    rationale.push('No required_tier valid for this model was supplied, so the model default cutoff was applied.');
  }
  // Terminal-branch discriminant, not a ladder: "meets" is exact-outcome-match; there is no
  // ranking to compare across, so a cutoff request is satisfied only by hitting that exact branch.
  const meets_required_tier = outcome === required_tier;
  compliance_flags.push(meets_required_tier ? 'FINALITY_MEETS_CUTOFF' : 'FINALITY_BELOW_CUTOFF');
  if (!meets_required_tier) compliance_flags.push('ESCALATION_RAISED');

  const claimed_field = settlement_model === 'federated_bft' || settlement_model === 'alpenglow' ? undefined : pp.claimed_outcome;
  const claimed_tier = str(claimed_field !== undefined ? claimed_field : pp.claimed_tier);
  let claim_verdict = 'no_claim';
  if (meets_required_tier_vocab.indexOf(claimed_tier) >= 0) {
    claim_verdict = claimed_tier === outcome ? 'claim_supported' : 'claim_overstated';
    if (claim_verdict === 'claim_overstated') {
      compliance_flags.push('FALSE_FINALITY_CLAIM');
      rationale.push('A counterparty asserted ' + claimed_tier + ' while the evaluated outcome is ' + outcome + '. The claim is overstated.');
    }
  }

  // Fixed key set across all three models (per-model fields null where not applicable) rather than a
  // conditionally-shaped object: a stable member set is easier for a caller to program against and
  // for the page<->kernel parity gate to compare structurally.
  const output_payload = {
    settlement_model,
    outcome,
    finality_tier: model_result.finality_tier,
    reorg_exposure: model_result.reorg_exposure,
    required_tier,
    meets_required_tier,
    claimed_tier: claimed_tier || null,
    claim_verdict,
    chain_label: chain_label || null,
    as_of_ts: ijson(as_of_ts),
    draft_pinned: draft_pinned || model_result.draft_pinned === true,
    rationale,
    submitted_at_ledger: settlement_model === 'federated_bft' ? null : model_result.submitted_at_ledger,
    included_in_ledger: settlement_model === 'federated_bft' ? null : model_result.included_in_ledger,
    highest_validated_ledger: settlement_model === 'federated_bft' ? null : model_result.highest_validated_ledger,
    result_class: settlement_model === 'federated_bft' ? null : model_result.result_class,
    time_bounds_max: settlement_model === 'federated_bft' ? model_result.time_bounds_max : null,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
