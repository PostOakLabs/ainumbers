import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-316-sb53-frontier-scope-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_sb53_frontier_scope',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Honesty guard (STATE-AI-WAVE-SPEC.md §D3, binding): this routes supplied model attributes
// through the SB 53 (Transparency in Frontier Artificial Intelligence Act, eff. 2026-01-01)
// scope thresholds and returns the triggered obligation set. It asserts "these inputs replay
// to this scope/obligation finding," NEVER that the developer has fulfilled those
// obligations -- publishing a framework or transparency report is a separate act this kernel
// does not perform or verify.

export const STATUTE_CITATION = 'Cal. SB 53 (Transparency in Frontier Artificial Intelligence Act), eff. 2026-01-01';
// FLOP counts exceed 2^53 (not safe I-JSON integers, RFC 7493) -- threshold and the supplied
// compute_flops travel as decimal STRINGS, compared via Number() parsing (precision loss at
// this magnitude is immaterial: the statutory line is three orders of magnitude wide).
export const FLOP_THRESHOLD_STR = '1e26';
export const LARGE_DEVELOPER_REVENUE_THRESHOLD_USD = 500000000;

export function compute(pp) {
  const compute_flops_str = typeof (pp && pp.compute_flops) === 'string' ? pp.compute_flops : '0';
  const annual_revenue_usd = typeof (pp && pp.annual_revenue_usd) === 'number' ? pp.annual_revenue_usd : 0;

  const is_frontier_model = Number(compute_flops_str) >= Number(FLOP_THRESHOLD_STR);
  const is_large_frontier_developer = is_frontier_model && annual_revenue_usd >= LARGE_DEVELOPER_REVENUE_THRESHOLD_USD;

  let obligation_set = [];
  if (is_frontier_model) {
    obligation_set = ['transparency_report_pre_deployment', 'catastrophic_risk_assessment_summary'];
    if (is_large_frontier_developer) {
      obligation_set = obligation_set.concat([
        'frontier_ai_safety_framework_publication',
        'annual_framework_update',
        'incident_reporting_oes',
        'whistleblower_protection_channels',
      ]);
    }
  }

  const output_payload = {
    is_frontier_model, is_large_frontier_developer, obligation_set,
    compute_flops: compute_flops_str,
    flop_threshold: FLOP_THRESHOLD_STR,
    large_developer_revenue_threshold_usd: LARGE_DEVELOPER_REVENUE_THRESHOLD_USD,
    statute_citation: STATUTE_CITATION,
  };

  const compliance_flags = ['SB53_SCOPE_CHECKED', is_frontier_model ? 'SB53_IN_SCOPE' : 'SB53_OUT_OF_SCOPE'];

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
