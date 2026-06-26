import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-140-cra-vuln-reporting-readiness';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assess_cra_vuln_reporting_readiness',
  mandate_type: 'compliance_mandate', gpu: false,
};

// CRA Article 14 readiness: 24-hour early warning + 72-hour notification.
// Applies 11 Sep 2026 (vuln reporting); full applicability 11 Dec 2027.
export function compute(pp) {
  const { actively_exploited_detection, early_warning_24h_process, notification_72h_process,
          csirt_enisa_endpoint_configured, coordinated_disclosure_policy } = pp;
  const checks = {
    actively_exploited_detection, early_warning_24h_process, notification_72h_process,
    csirt_enisa_endpoint_configured, coordinated_disclosure_policy,
  };
  const gaps = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
  const vuln_reporting_ready = gaps.length === 0;
  const compliance_flags = { CRA_ART14_READINESS_ASSESSED: true };
  compliance_flags[vuln_reporting_ready ? 'CRA_VULN_REPORTING_READY' : 'CRA_VULN_REPORTING_NOT_READY'] = true;
  return { output_payload: { vuln_reporting_ready, gaps }, compliance_flags };
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
