import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-135-cyclonedx-sbom-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_cyclonedx_sbom',
  mandate_type: 'compliance_mandate', gpu: false,
};

// CRA Annex I Part II(1): machine-readable SBOM covering >= top-level dependencies.
// CycloneDX shape: bomFormat/specVersion/components[].{name,version,purl}/dependencies[].
export function compute(pp) {
  const { sbom = {} } = pp;
  const SUPPORTED = ['1.4', '1.5', '1.6'];
  const format_ok = sbom.bomFormat === 'CycloneDX';
  const spec_ok = SUPPORTED.includes(String(sbom.specVersion));
  const components = Array.isArray(sbom.components) ? sbom.components : [];
  const components_missing_purl = components
    .map((c, i) => ((c && c.name && c.version && c.purl) ? null : i))
    .filter(i => i !== null);
  const has_dependencies = Array.isArray(sbom.dependencies) && sbom.dependencies.length > 0;
  const sbom_valid = format_ok && spec_ok && components.length > 0 && components_missing_purl.length === 0 && has_dependencies;

  const compliance_flags = { CYCLONEDX_SBOM_ASSESSED: true };
  compliance_flags[sbom_valid ? 'CYCLONEDX_SBOM_VALID' : 'CYCLONEDX_SBOM_INVALID'] = true;
  if (!format_ok) compliance_flags.NOT_CYCLONEDX = true;
  if (!has_dependencies) compliance_flags.NO_TOP_LEVEL_DEPENDENCIES = true;

  const output_payload = {
    sbom_valid, format: 'CycloneDX', spec_version: sbom.specVersion ?? null,
    component_count: components.length, components_missing_purl, has_dependencies,
  };
  return { output_payload, compliance_flags };
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
