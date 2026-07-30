/**
 * art-492-classify-settlement-finality.kernel.mjs
 * Vendor-neutral settlement-finality classifier.
 *
 * Classifies a settlement-finality position under one of three settlement models, each with its
 * OWN ordered tier ladder. The ladders are deliberately NOT flattened into one shared enum: a
 * "posted" on an optimistic rollup and a "committed" on a validity rollup are different claims,
 * and merging them would put a false equivalence into a receipt. The ladder actually used is
 * emitted as tier_ladder so the receipt is self-describing.
 *
 * The tier that justifies this node is validity_proof/proven_unfinalized: validity-proof finality
 * is a TWO-GATE condition (proof accepted AND L1 finalized), not a timer, and a three-state model
 * cannot express the in-between.
 *
 * chain_label is free text echoed verbatim. There is no chain enum, no named chain profile and no
 * published window table: a window table is a fact about a third party that nobody here owns and
 * that goes stale silently.
 *
 * Pure decision kernel: no clock, no randomness, no network, no storage. as_of_ts is caller
 * supplied; buildArtifact takes `now` via options.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-492-classify-settlement-finality';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mandate_type: 'compliance_mandate',
  mcp_name:     'classify_settlement_finality',
  gpu:          false,
};

const LADDERS = {
  optimistic_challenge: ['soft', 'posted', 'challengeable', 'final'],
  validity_proof:       ['soft', 'committed', 'proven_unfinalized', 'final'],
  single_slot_bft:      ['soft', 'final'],
};

const REORG = {
  optimistic_challenge: { soft: 'high', posted: 'high', challengeable: 'low', final: 'none' },
  validity_proof:       { soft: 'high', committed: 'high', proven_unfinalized: 'low', final: 'none' },
  single_slot_bft:      { soft: 'none', final: 'none' },
};

const DEFAULT_CHALLENGE_WINDOW_SECONDS = 604800; // 7 days, the common optimistic-rollup default
const DEFAULT_L1_FINALITY_SECONDS = 768;         // 2 epochs at 12s slots, the common validity-rollup default

function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }
function bool(v) { return v === true; }

// I-JSON: an integer beyond 2^53 is emitted as a string rather than a lossy number.
function ijson(v) {
  if (v === null) return null;
  return Number.isSafeInteger(v) ? v : String(v);
}

export function compute(pp) {
  pp = pp || {};

  const compliance_flags = ['FINALITY_CLASSIFIED'];
  const rationale = [];
  let draft_pinned = false;

  const requested_model = str(pp.settlement_model);
  const settlement_model = Object.prototype.hasOwnProperty.call(LADDERS, requested_model)
    ? requested_model
    : 'optimistic_challenge';
  if (settlement_model !== requested_model) {
    compliance_flags.push('FINALITY_MODEL_DEFAULTED');
    rationale.push('No recognised settlement_model was supplied, so the optimistic challenge model was assumed. Supply settlement_model to remove this assumption.');
  }

  const tier_ladder = LADDERS[settlement_model].slice();
  const as_of_ts = num(pp.as_of_ts) ?? 0;
  const chain_label = str(pp.chain_label);

  let finality_tier = 'soft';
  let earliest_final_at = null;

  if (settlement_model === 'optimistic_challenge') {
    const assertion_created_at = num(pp.assertion_created_at);
    const suppliedWindow = num(pp.challenge_window_seconds);
    const challenge_window_seconds = suppliedWindow === null ? DEFAULT_CHALLENGE_WINDOW_SECONDS : suppliedWindow;
    if (suppliedWindow === null) {
      draft_pinned = true;
      rationale.push('No challenge_window_seconds was supplied, so a 604800 second window was assumed. The real window is a property of the deployment and should be supplied.');
    }
    if (!bool(pp.batch_posted)) {
      finality_tier = 'soft';
      rationale.push('The batch has not been posted to the settlement layer, so the position is a sequencer promise only.');
    } else if (assertion_created_at === null) {
      finality_tier = 'posted';
      rationale.push('The batch is posted but no assertion timestamp was supplied, so the challenge clock cannot be evaluated.');
    } else {
      earliest_final_at = assertion_created_at + challenge_window_seconds;
      if (as_of_ts >= earliest_final_at) {
        finality_tier = 'final';
        rationale.push('The challenge window closed at ' + earliest_final_at + ' and as_of_ts is at or past it, so the assertion is final under this model.');
      } else {
        finality_tier = 'challengeable';
        rationale.push('The challenge window is still open until ' + earliest_final_at + '. Settlement inside an open window is optimistic, not final.');
      }
    }
  } else if (settlement_model === 'validity_proof') {
    const batch_committed_at = num(pp.batch_committed_at);
    const proof_submitted_at = num(pp.proof_submitted_at);
    const suppliedFinality = num(pp.l1_finality_seconds);
    const l1_finality_seconds = suppliedFinality === null ? DEFAULT_L1_FINALITY_SECONDS : suppliedFinality;
    if (suppliedFinality === null) {
      draft_pinned = true;
      rationale.push('No l1_finality_seconds was supplied, so a 768 second settlement-layer finality delay was assumed.');
    }
    const proof_accepted = bool(pp.proof_accepted);
    const l1_finalized = bool(pp.l1_finalized);

    if (proof_accepted && proof_submitted_at !== null) {
      earliest_final_at = proof_submitted_at + l1_finality_seconds;
    }

    if (batch_committed_at === null) {
      finality_tier = 'soft';
      rationale.push('No settlement-layer commitment timestamp was supplied, so the position is a sequencer promise only.');
    } else if (!proof_accepted) {
      finality_tier = 'committed';
      rationale.push('Data is committed to the settlement layer but no validity proof has been accepted, so state correctness is not yet established.');
    } else if (!l1_finalized) {
      finality_tier = 'proven_unfinalized';
      rationale.push('The validity proof is accepted but the settlement-layer block carrying it is not finalised. State correctness is established and settlement-layer finality is not. These are two separate gates and both are required.');
    } else {
      finality_tier = 'final';
      rationale.push('The validity proof is accepted and the settlement-layer block carrying it is finalised, so both finality gates are met.');
    }
    const cadence = num(pp.expected_proof_cadence_seconds);
    if (cadence !== null && finality_tier === 'committed') {
      rationale.push('At the stated proof cadence of ' + cadence + ' seconds, a proof would be expected within that interval of the commitment. This is a projection, not a guarantee.');
    }
  } else {
    const included_in_block = bool(pp.included_in_block);
    const quorum_committed = bool(pp.quorum_committed);
    finality_tier = included_in_block && quorum_committed ? 'final' : 'soft';
    if (finality_tier === 'final') {
      rationale.push('The transaction is included and a quorum has committed, so the block is final on this chain. There is no challenge window and no reorg tier.');
    } else {
      rationale.push('Inclusion or quorum commitment is not established, so the position is not yet final.');
    }
    const pct = num(pp.quorum_pct_of_stake);
    if (pct !== null) {
      rationale.push('Declared quorum stake share: ' + pct + ' percent.');
    }
    compliance_flags.push('FINALITY_RISK_MOVED_OFFCHAIN');
    rationale.push('Sub-second consensus finality removes reorg exposure. It does not remove settlement risk, it relocates it to cross-chain message trust and to validator-set governance, neither of which this classification covers.');
  }

  const tier_rank = tier_ladder.indexOf(finality_tier);
  const reorg_exposure = REORG[settlement_model][finality_tier] || 'high';

  let required_tier = str(pp.required_tier);
  if (tier_ladder.indexOf(required_tier) < 0) {
    required_tier = tier_ladder[tier_ladder.length - 1];
    rationale.push('No required_tier valid for this model was supplied, so the top tier of the model ladder was applied as the cutoff.');
  }
  const meets_required_tier = tier_rank >= tier_ladder.indexOf(required_tier);
  compliance_flags.push(meets_required_tier ? 'FINALITY_MEETS_CUTOFF' : 'FINALITY_BELOW_CUTOFF');
  if (!meets_required_tier) compliance_flags.push('ESCALATION_RAISED');

  const claimed_tier = str(pp.claimed_tier);
  let claim_verdict = 'no_claim';
  if (tier_ladder.indexOf(claimed_tier) >= 0) {
    claim_verdict = tier_ladder.indexOf(claimed_tier) > tier_rank ? 'claim_overstated' : 'claim_supported';
    if (claim_verdict === 'claim_overstated') {
      compliance_flags.push('FALSE_FINALITY_CLAIM');
      rationale.push('A counterparty asserted ' + claimed_tier + ' while the evaluated position is ' + finality_tier + '. The claim is overstated.');
    }
  }

  return {
    output_payload: {
      settlement_model,
      finality_tier,
      tier_rank,
      tier_ladder,
      earliest_final_at: ijson(earliest_final_at),
      reorg_exposure,
      required_tier,
      meets_required_tier,
      claimed_tier: claimed_tier || null,
      claim_verdict,
      chain_label: chain_label || null,
      as_of_ts: ijson(as_of_ts),
      draft_pinned,
      rationale,
    },
    compliance_flags,
  };
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
