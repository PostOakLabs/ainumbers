import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-177-ifrs17-measurement-model-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_ifrs17_measurement_model',
  mandate_type: 'compliance_mandate', gpu: false,
};

// IFRS 17 measurement model classification: GMM/BBA, VFA, or PAA.
// PAA eligible if coverage period ≤12 months. VFA eligible if direct-participating
// features and not reinsurance held. GMM is always available as baseline.
export function compute(pp) {
  const { contract = {} } = pp;

  const g = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const coverage_months = g(contract.coverage_period_months);
  const direct_par = contract.direct_participating_features === true;
  const is_reinsurance = contract.is_reinsurance === true;
  const paa_elected = contract.premium_allocation_approach_election === true;
  const vfa_elected = contract.vfa_election === true;

  const paa_eligible = coverage_months > 0 && coverage_months <= 12;
  const vfa_eligible = direct_par && !is_reinsurance;

  const eligible_models = [];
  if (paa_eligible || paa_elected) eligible_models.push('PAA');
  if (vfa_eligible || (vfa_elected && !is_reinsurance)) eligible_models.push('VFA');
  eligible_models.push('GMM');

  let measurement_model;
  if (paa_elected && paa_eligible) {
    measurement_model = 'PAA';
  } else if (vfa_elected && vfa_eligible) {
    measurement_model = 'VFA';
  } else if (vfa_eligible && !paa_elected) {
    measurement_model = 'VFA';
  } else if (paa_eligible) {
    measurement_model = 'PAA';
  } else {
    measurement_model = 'GMM';
  }

  const compliance_flags = { IFRS17_MEASUREMENT_MODEL_CLASSIFIED: true };
  compliance_flags[`IFRS17_MODEL_${measurement_model}`] = true;
  if (vfa_eligible) compliance_flags.IFRS17_VFA_ELIGIBLE = true;
  if (paa_eligible) compliance_flags.IFRS17_PAA_ELIGIBLE = true;
  if (is_reinsurance) compliance_flags.IFRS17_REINSURANCE_HELD = true;

  return {
    output_payload: {
      measurement_model,
      eligible_models,
      direct_participating: direct_par,
      paa_eligible,
      vfa_eligible,
      coverage_period_months: coverage_months,
      is_reinsurance,
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
