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

const MODELS = ['deadline_bounded_inclusion', 'federated_bft'];

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
    : classifyDeadlineBoundedInclusion(pp, compliance_flags, rationale);

  const outcome = model_result.outcome;
  const meets_required_tier_vocab = settlement_model === 'federated_bft'
    ? ['pending', 'final']
    : ['pending', 'expired_unprovable', 'final_never_included', 'final_failure_tec', 'final_success'];

  let required_tier = str(pp.required_tier);
  if (meets_required_tier_vocab.indexOf(required_tier) < 0) {
    required_tier = settlement_model === 'federated_bft' ? 'final' : 'final_success';
    rationale.push('No required_tier valid for this model was supplied, so the model default cutoff was applied.');
  }
  // Terminal-branch discriminant, not a ladder: "meets" is exact-outcome-match; there is no
  // ranking to compare across, so a cutoff request is satisfied only by hitting that exact branch.
  const meets_required_tier = outcome === required_tier;
  compliance_flags.push(meets_required_tier ? 'FINALITY_MEETS_CUTOFF' : 'FINALITY_BELOW_CUTOFF');
  if (!meets_required_tier) compliance_flags.push('ESCALATION_RAISED');

  const claimed_field = settlement_model === 'federated_bft' ? undefined : pp.claimed_outcome;
  const claimed_tier = str(claimed_field !== undefined ? claimed_field : pp.claimed_tier);
  let claim_verdict = 'no_claim';
  if (meets_required_tier_vocab.indexOf(claimed_tier) >= 0) {
    claim_verdict = claimed_tier === outcome ? 'claim_supported' : 'claim_overstated';
    if (claim_verdict === 'claim_overstated') {
      compliance_flags.push('FALSE_FINALITY_CLAIM');
      rationale.push('A counterparty asserted ' + claimed_tier + ' while the evaluated outcome is ' + outcome + '. The claim is overstated.');
    }
  }

  // Fixed key set across both models (per-model fields null where not applicable) rather than a
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
    draft_pinned,
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
