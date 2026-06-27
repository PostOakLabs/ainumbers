import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-178-ifrs17-csm-rollforward-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_ifrs17_csm_rollforward',
  mandate_type: 'compliance_mandate', gpu: false,
};

// IFRS 17 CSM roll-forward mechanics: opening + new business + interest accretion
// + experience adjustments - coverage-unit release + FX = closing CSM.
// No negative CSM allowed — if computed closing < 0, contract is onerous and the
// shortfall becomes a loss component. NaN-safe on every numeric input.
export function compute(pp) {
  const { csm = {} } = pp;

  const g = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const opening     = g(csm.opening_csm);
  const new_biz     = g(csm.new_business_csm);
  const interest    = g(csm.interest_accretion);
  const exp_adj     = g(csm.experience_adjustments);
  const release     = g(csm.release_to_profit);
  const fx          = g(csm.fx_adjustments);

  const computed_closing = opening + new_biz + interest + exp_adj - release + fx;
  const onerous = computed_closing < 0;
  const loss_component = onerous ? Math.abs(computed_closing) : 0;
  const closing_csm = onerous ? 0 : computed_closing;

  // Release cannot exceed pre-release balance (when balance is positive)
  const pre_release = opening + new_biz + interest + exp_adj + fx;
  const release_excess = release > pre_release && pre_release >= 0;

  const csm_valid = !release_excess && !onerous;

  const compliance_flags = { IFRS17_CSM_ROLLFORWARD_ASSESSED: true };
  if (csm_valid) compliance_flags.IFRS17_CSM_VALID = true;
  if (onerous)   compliance_flags.IFRS17_ONEROUS_CONTRACT_FLAG = true;
  if (release_excess) compliance_flags.IFRS17_CSM_RELEASE_EXCESS = true;

  return {
    output_payload: {
      closing_csm,
      opening_csm: opening,
      new_business_csm: new_biz,
      interest_accretion: interest,
      experience_adjustments: exp_adj,
      release_to_profit: release,
      fx_adjustments: fx,
      onerous,
      loss_component,
      csm_valid,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
