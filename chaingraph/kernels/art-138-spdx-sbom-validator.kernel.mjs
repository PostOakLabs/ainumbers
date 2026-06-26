import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-138-spdx-sbom-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_spdx_sbom',
  mandate_type: 'compliance_mandate', gpu: false,
};

// SPDX SBOM: spdxVersion, SPDXID, packages[].{name,versionInfo,downloadLocation or purl externalRef}, relationships.
// CRA Annex I Part II(1): SPDX-format counterpart to art-135 CycloneDX validator.
export function compute(pp) {
  const { sbom = {} } = pp;
  const version_ok = typeof sbom.spdxVersion === 'string' && /^SPDX-(2\.[0-9]+|3\.[0-9]+)$/.test(sbom.spdxVersion);
  const doc_id_ok = typeof sbom.SPDXID === 'string' && sbom.SPDXID.length > 0;
  const packages = Array.isArray(sbom.packages) ? sbom.packages : [];
  const packages_missing_version = packages
    .map((p, i) => {
      const has_name = p && p.name;
      const has_ver = p && p.versionInfo;
      const has_loc = p && (p.downloadLocation || (Array.isArray(p.externalRefs) && p.externalRefs.some(r => r && r.referenceType === 'purl')));
      return (has_name && has_ver && has_loc) ? null : i;
    })
    .filter(i => i !== null);
  const has_relationships = Array.isArray(sbom.relationships) && sbom.relationships.length > 0;
  const sbom_valid = version_ok && doc_id_ok && packages.length > 0 && packages_missing_version.length === 0 && has_relationships;
  const compliance_flags = { SPDX_SBOM_ASSESSED: true };
  compliance_flags[sbom_valid ? 'SPDX_SBOM_VALID' : 'SPDX_SBOM_INVALID'] = true;
  if (!has_relationships) compliance_flags.NO_RELATIONSHIPS = true;
  return { output_payload: { sbom_valid, format: 'SPDX', spdx_version: sbom.spdxVersion ?? null, package_count: packages.length, packages_missing_version, has_relationships }, compliance_flags };
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
