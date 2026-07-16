/**
 * art-321-rhc-bold-finality-classifier.kernel.mjs
 * BoLD Challenge-Window Finality Classifier — Robinhood Chain (Arbitrum Orbit + BoLD).
 * "Settled onchain" inside the challenge window is optimistic, not final. Classifies a finality
 * claim as soft / posted / challengeable / final. Composes classify_settlement_asset_finality in
 * the chain (see RHC-WAVE-BUILD-SPEC.md §RHC-5); follows the check_linea_l2_finality_window shape
 * as precedent only (different proof system).
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-321-rhc-bold-finality-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mandate_type: 'settlement_finality_mandate',
  mcp_name:     'classify_bold_challenge_finality',
  gpu:          false,
};

export function compute(pp) {
  const {
    l2_inclusion_timestamp,
    batch_posted_to_l1,
    assertion_created,           // boolean — has a BoLD assertion been created for this batch
    assertion_created_timestamp,
    challenge_window_seconds = 604800, // 7 days, BoLD default
    current_time,
    finality_claim,              // 'soft' | 'posted' | 'challengeable' | 'final' — the claim under test
  } = pp;

  const finiteCore = [current_time].every(v => typeof v === 'number' && Number.isFinite(v));
  if (!finiteCore || typeof l2_inclusion_timestamp !== 'number') {
    const output_payload = { verdict: 'INVALID_INPUT', finality_class: 'unknown', earliest_final_at: null, claim_verdict: 'UNVERIFIABLE' };
    return { output_payload, compliance_flags: ['RHC_FINALITY_INPUT_INVALID'] };
  }

  let finality_class;
  let earliest_final_at = null;

  if (batch_posted_to_l1 !== true) {
    finality_class = 'soft';
  } else if (assertion_created !== true) {
    finality_class = 'posted';
  } else {
    const elapsed = typeof assertion_created_timestamp === 'number' ? current_time - assertion_created_timestamp : null;
    earliest_final_at = typeof assertion_created_timestamp === 'number' ? assertion_created_timestamp + challenge_window_seconds : null;
    finality_class = (elapsed !== null && elapsed >= challenge_window_seconds) ? 'final' : 'challengeable';
  }

  const RANK = { soft: 0, posted: 1, challengeable: 2, final: 3 };
  let claim_verdict = 'UNVERIFIABLE';
  if (finality_claim && RANK[finality_claim] !== undefined) {
    if (finality_claim === finality_class) claim_verdict = 'SUPPORTED';
    else if (RANK[finality_claim] > RANK[finality_class]) claim_verdict = 'OVERSTATED';
    else claim_verdict = 'UNDERSTATED';
  }

  const output_payload = {
    verdict: claim_verdict === 'OVERSTATED' ? 'FALSE_FINALITY_CLAIM' : 'CLASSIFIED',
    finality_class,
    earliest_final_at,
    finality_claim: finality_claim ?? null,
    claim_verdict,
    challenge_window_seconds,
  };

  const compliance_flags = claim_verdict === 'OVERSTATED' ? ['RHC_FALSE_FINALITY_CLAIM'] : ['RHC_FINALITY_CLASSIFIED'];
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
