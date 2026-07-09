import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-158-emir-reporting-readiness-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'run_emir_reporting_fit',
  mandate_type: 'compliance_mandate', gpu: false,
  export_capability: ['json', 'pdf', 'vc'],
};

export function compute(pp) {
  const {
    iso20022_cutover_done,
    upi_sourcing_configured,
    uti_sharing_sla_met,
    reconciliation_tolerance_set,
    lifecycle_action_controls,
  } = pp;
  const dims = {
    iso20022_cutover_done,
    upi_sourcing_configured,
    uti_sharing_sla_met,
    reconciliation_tolerance_set,
    lifecycle_action_controls,
  };
  const gaps = Object.entries(dims).filter(([, v]) => v !== true).map(([k]) => k);
  const passed = 5 - gaps.length;
  const grade = ['F', 'E', 'D', 'C', 'B', 'A'][passed]; // 0..5 → F..A
  const ready = gaps.length === 0;

  const compliance_flags = [];
  compliance_flags.push('EMIR_REPORTING_FIT_ASSESSED');
  compliance_flags.push(ready ? 'EMIR_REPORTING_READY' : 'EMIR_REPORTING_GAPS');

  return {
    output_payload: { ready, grade, dimensions_passed: passed, gaps },
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
