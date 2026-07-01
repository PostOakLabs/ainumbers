import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-185-irrbb-sot-nii-evaluator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'evaluate_irrbb_sot_nii',
  mandate_type: 'compliance_mandate', gpu: false,
};

// EBA Supervisory Outlier Test on Net Interest Income: unlike the EVE leg (hard
// 15%-of-Tier-1 EU-wide threshold), the NII SOT threshold is left to competent
// authority / institution discretion under EBA Guidelines on IRRBB & CSRBB
// (EBA/GL/2022/14) -- Pillar 2 proportionality, no single EU-wide bright-line
// percentage. This node evaluates the worst 1-year DeltaNII (parallel up/down)
// against a caller-supplied threshold (sot_nii_threshold_pct), echoing the
// threshold used so the verdict is auditable. Terminal node of
// irrbb-supervisory-outlier-test chain. NaN-safe. Zero network, zero PII.
export function compute(pp) {
  const { nii_shock = {}, baseline = {} } = pp;
  const g = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

  const delta_nii_parallel_up = g(nii_shock.delta_nii_parallel_up);
  const delta_nii_parallel_down = g(nii_shock.delta_nii_parallel_down);
  const projected_nii = g(baseline.projected_nii);
  const threshold_pct = g(baseline.sot_nii_threshold_pct);

  const worst_delta_nii = Math.min(delta_nii_parallel_up, delta_nii_parallel_down);
  const decline_abs = Math.abs(Math.min(0, worst_delta_nii));

  const delta_nii_pct_of_nii = projected_nii > 0
    ? Math.round((decline_abs / projected_nii) * 10000) / 100 : 0;

  const threshold_set = threshold_pct > 0;
  const nii_outlier = threshold_set && delta_nii_pct_of_nii > threshold_pct;

  const compliance_flags = { IRRBB_SOT_NII_EVALUATED: true };
  if (!threshold_set) compliance_flags.IRRBB_SOT_NII_THRESHOLD_NOT_SET = true;
  else if (nii_outlier) compliance_flags.IRRBB_SOT_NII_OUTLIER_BREACH = true;
  else compliance_flags.IRRBB_SOT_NII_WITHIN_THRESHOLD = true;

  return {
    output_payload: {
      worst_delta_nii,
      projected_nii,
      delta_nii_pct_of_nii,
      sot_nii_threshold_pct: threshold_pct,
      threshold_set,
      nii_outlier,
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
