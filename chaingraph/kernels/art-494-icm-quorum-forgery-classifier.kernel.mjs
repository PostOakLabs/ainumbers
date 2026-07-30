import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-494-icm-quorum-forgery-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_icm_quorum_forgery_risk',
  mandate_type: 'analytics_mandate', gpu: false,
};

// Interchain Messaging (ICM / Avalanche Warp Messaging) quorum-forgery
// classifier. Given a caller-transcribed validator stake distribution for a
// SOURCE Avalanche L1 and the stake-weight quorum the RECEIVING L1 accepts,
// computes the smallest validator set that could jointly sign a message the
// receiver would accept: sort weights descending, prefix-sum, and stop at the
// first count whose cumulative weight satisfies the quorum comparison. That
// count is min_colluding_validators.
//
// Quorum semantics follow avalanchego's Warp signature check: quorum is met
// when signed_weight * 100 >= total_weight * quorum_pct (a ">=" comparison,
// not a strict ">"). The comparison is evaluated in cross-multiplied form so
// no division rounding can move the boundary.
//
// quorum_pct is a CALLER INPUT with no baked-in default threshold. The
// accepted quorum is the receiving L1's own policy for that source, in the
// same way art-445 refuses to bake in a concentration limit. The subnet-EVM
// Warp precompile's own default (67, minimum 33, denominator 100) is
// documented on the node page as context, and is deliberately NOT applied
// here as a threshold.
//
// Borrows the art-445 helper pattern only (2dp fixed-point rounding, pctOf,
// finite gate, NaN-safe coercion). art-445 computes top-N / sector rollups
// and HHI; it does NOT compute a minimum-colluding set, so this is a new
// kernel rather than a ruleset swap.
//
// No chain observation, no RPC, no P-Chain query: the validator set is
// transcribed by the caller. Opaque validator_id strings, zero PII.
// No clock, no randomness, no network. Zero network, zero PII.

const MAX_SAFE = 9007199254740991;

function g(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
// I-JSON: integers beyond 2^53-1 are emitted as strings, never as lossy numbers.
function jnum(v) { return Number.isFinite(v) && Math.abs(v) > MAX_SAFE ? String(v) : (Number.isFinite(v) ? v : 0); }

export function compute(pp) {
  pp = pp || {};
  const rawValidators = Array.isArray(pp.validator_weights) ? pp.validator_weights : [];
  const quorum_pct = g(pp.quorum_pct);
  const min_colluding_floor = Math.max(0, Math.trunc(g(pp.min_colluding_floor)));
  const source_l1_label = String(pp.source_l1_label || '').trim() || 'unlabelled source L1';
  const message_class = String(pp.message_class || '').trim() || null;
  const compliance_flags = ['ICM_QUORUM_EVALUATED'];
  const rationale = [];

  const validators = rawValidators
    .map((v) => ({
      validator_id: String((v && v.validator_id) || '').trim(),
      weight: Math.max(0, g(v && v.weight)),
    }))
    .filter((v) => v.validator_id);

  const total_validators = validators.length;
  const total_stake_weight = validators.reduce((s, v) => s + v.weight, 0);

  // Edge case: quorum_pct outside the arithmetically meaningful range. A
  // quorum of 0 or below is met by the empty set; a quorum above 100 can
  // never be met by the whole validator set. Neither is evaluable, so the
  // classifier refuses rather than returning a misleading count.
  const quorum_pct_valid = quorum_pct > 0 && quorum_pct <= 100;
  // Edge case: no validators transcribed, or every transcribed weight is
  // zero. Total stake is 0, so no prefix-sum can be a meaningful quorum --
  // guarded explicitly, because the raw comparison 0 >= 0 would otherwise
  // resolve to a colluding set of size 0.
  const stake_present = total_stake_weight > 0;

  let min_colluding_validators = null;
  let colluding_stake_weight = 0;
  let colluding_share_pct = 0;
  let quorum_reachable = false;

  if (!quorum_pct_valid) {
    compliance_flags.push('ICM_QUORUM_INPUT_INVALID');
    rationale.push('quorum_pct of ' + quorum_pct + ' is outside the evaluable range (greater than 0, up to and including 100). No colluding-set size was computed.');
  } else if (total_validators === 0) {
    compliance_flags.push('ICM_QUORUM_NO_VALIDATORS');
    rationale.push('No validators were transcribed for ' + source_l1_label + '. The accepting quorum cannot be evaluated, so acceptance from this source cannot be justified on this evidence.');
  } else if (!stake_present) {
    compliance_flags.push('ICM_QUORUM_ZERO_STAKE');
    rationale.push('All ' + total_validators + ' transcribed validators of ' + source_l1_label + ' carry zero weight. Total stake is zero, so no stake-weighted quorum exists and no colluding-set size was computed.');
  } else {
    const sorted = [...validators].sort((a, b) =>
      b.weight - a.weight || (a.validator_id < b.validator_id ? -1 : a.validator_id > b.validator_id ? 1 : 0));
    let cum = 0;
    for (let i = 0; i < sorted.length; i++) {
      cum += sorted[i].weight;
      // Cross-multiplied form of cum / total >= quorum_pct / 100.
      if (cum * 100 >= total_stake_weight * quorum_pct) {
        min_colluding_validators = i + 1;
        colluding_stake_weight = cum;
        quorum_reachable = true;
        break;
      }
    }
    if (!quorum_reachable) {
      // Defensive: with quorum_pct <= 100 the full set always satisfies the
      // comparison, so this branch is unreachable in practice. Kept so the
      // outputs can never fall through as NaN.
      compliance_flags.push('ICM_QUORUM_UNREACHABLE');
      rationale.push('No subset of the transcribed validator set reaches a quorum of ' + quorum_pct + ' percent of stake.');
    }
  }

  const pctOf = (w) => (total_stake_weight > 0 ? r2((w / total_stake_weight) * 100) : 0);
  colluding_share_pct = quorum_reachable ? pctOf(colluding_stake_weight) : 0;

  const stake_hhi = stake_present
    ? r2(validators.reduce((s, v) => {
        const share = v.weight / total_stake_weight;
        return s + share * share;
      }, 0) * 10000)
    : 0;

  // meets_floor: the receiving operator's declared minimum number of
  // independent validators that must be required to reach quorum. Fewer than
  // the floor means a smaller group than the operator accepts could sign a
  // message the receiver would honour.
  const meets_floor = quorum_reachable && min_colluding_validators >= min_colluding_floor;
  if (quorum_reachable) {
    rationale.push('The ' + min_colluding_validators + ' largest of ' + total_validators + ' transcribed validators hold ' + colluding_share_pct + ' percent of stake, which satisfies the accepting quorum of ' + quorum_pct + ' percent. That is the smallest group able to sign a message ' + source_l1_label + ' could have the receiver accept.');
    if (!meets_floor) {
      compliance_flags.push('ICM_QUORUM_BELOW_FLOOR');
      rationale.push('The declared floor requires at least ' + min_colluding_floor + ' validators to be needed for quorum. Only ' + min_colluding_validators + ' are needed.');
    }
    // A single validator that alone meets quorum is the strongest finding the
    // classifier can return, and it is a structural fact rather than a policy
    // threshold, so it is flagged unconditionally.
    if (min_colluding_validators === 1) {
      compliance_flags.push('ICM_QUORUM_CONCENTRATION_BREACH');
      rationale.push('One validator alone meets the accepting quorum. That single key holder can produce a message the receiving L1 will accept.');
    }
  } else {
    rationale.push('No colluding-set size is available, so no floor comparison was made.');
  }

  const escalate = compliance_flags.includes('ICM_QUORUM_BELOW_FLOOR')
    || compliance_flags.includes('ICM_QUORUM_CONCENTRATION_BREACH')
    || compliance_flags.includes('ICM_QUORUM_NO_VALIDATORS')
    || compliance_flags.includes('ICM_QUORUM_ZERO_STAKE')
    || compliance_flags.includes('ICM_QUORUM_UNREACHABLE');
  if (escalate) compliance_flags.push('ESCALATION_RAISED');

  return {
    output_payload: {
      source_l1_label,
      message_class,
      quorum_pct,
      quorum_pct_valid,
      min_colluding_floor,
      total_validators,
      total_stake_weight: jnum(total_stake_weight),
      min_colluding_validators,
      colluding_stake_weight: quorum_reachable ? jnum(colluding_stake_weight) : 0,
      colluding_share_pct,
      stake_hhi,
      quorum_reachable,
      meets_floor,
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
