import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-139-cra-annex1-completeness-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_cra_annex1_completeness',
  mandate_type: 'compliance_mandate', gpu: false,
};

// CRA (EU 2024/2847) Annex I essential-requirement subset.
// Full applicability: 11 Dec 2027. Penalty: up to €15M or 2.5% global turnover.
export function compute(pp) {
  const { sbom_present, sbom_machine_readable, top_level_deps_covered,
          vuln_handling_policy_present, secure_by_default, conformity_route } = pp;
  const checks = {
    sbom_present, sbom_machine_readable, top_level_deps_covered,
    vuln_handling_policy_present, secure_by_default,
  };
  const gaps = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
  const ROUTES = ['self_assessment', 'eu_type_examination', 'full_quality_assurance'];
  const route_ok = ROUTES.includes(conformity_route);
  if (!route_ok) gaps.push('conformity_route');
  const annex1_complete = gaps.length === 0;
  const compliance_flags = { CRA_ANNEX1_ASSESSED: true };
  compliance_flags[annex1_complete ? 'CRA_ANNEX1_COMPLETE' : 'CRA_ANNEX1_INCOMPLETE'] = true;
  return { output_payload: { annex1_complete, gaps, conformity_route: route_ok ? conformity_route : null }, compliance_flags };
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
