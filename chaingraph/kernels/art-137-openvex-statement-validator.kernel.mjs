import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-137-openvex-statement-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_openvex_statement',
  mandate_type: 'compliance_mandate', gpu: false,
};

// OpenVEX: each statement needs vulnerability, non-empty products, allowed status,
// and — when status === "not_affected" — a required justification.
export function compute(pp) {
  const { vex = {} } = pp;
  const STATUS = ['not_affected', 'affected', 'fixed', 'under_investigation'];
  const statements = Array.isArray(vex.statements) ? vex.statements : [];
  const invalid_statements = [];
  statements.forEach((s, i) => {
    const has_vuln = !!(s && (s.vulnerability && (typeof s.vulnerability === 'string' || s.vulnerability.name || s.vulnerability['@id'])));
    const has_products = Array.isArray(s && s.products) && s.products.length > 0;
    const status_ok = s && STATUS.includes(s.status);
    const just_ok = !(s && s.status === 'not_affected') || (typeof s.justification === 'string' && s.justification.length > 0);
    if (!(has_vuln && has_products && status_ok && just_ok)) {
      invalid_statements.push({ index: i, has_vuln, has_products, status_ok, just_ok });
    }
  });
  const context_ok = typeof vex['@context'] === 'string' || Array.isArray(vex['@context']);
  const vex_valid = context_ok && statements.length > 0 && invalid_statements.length === 0;
  const compliance_flags = [];
  compliance_flags.push('OPENVEX_ASSESSED');
  compliance_flags.push(vex_valid ? 'OPENVEX_VALID' : 'OPENVEX_INVALID');
  return { output_payload: { vex_valid, statement_count: statements.length, invalid_statements, context_ok }, compliance_flags };
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
