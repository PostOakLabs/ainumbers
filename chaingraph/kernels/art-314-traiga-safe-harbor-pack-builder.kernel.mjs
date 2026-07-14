import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-314-traiga-safe-harbor-pack-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_traiga_safe_harbor_pack',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Honesty guard (STATE-AI-WAVE-SPEC.md §D2, binding): this assembles supplied NIST AI RMF
// mapping output + exposure-assessment output into an evidence bundle asserting substantial
// NIST AI RMF Generative AI Profile (NIST-AI-600-1) compliance. It is framed as EVIDENCE
// TOWARD the Tex. Bus. & Com. Code §553.106 statutory affirmative defense, NEVER a guarantee
// the defense succeeds -- that determination belongs to a court or the Texas AG. "Substantial
// compliance" bar = the shipped art-174 mapper's own coverage_band tiers (Substantial or
// Comprehensive); Minimal/Partial bands do not meet the bar encoded here.

export const STATUTE_CITATION = 'Tex. Bus. & Com. Code §553.106 (TRAIGA affirmative defense), eff. 2026-01-01';
const QUALIFYING_BANDS = ['Substantial', 'Comprehensive'];

export function compute(pp) {
  const rmf_mapping = (pp && typeof pp.rmf_mapping === 'object' && pp.rmf_mapping) || null;
  const exposure_result = (pp && typeof pp.exposure_result === 'object' && pp.exposure_result) || null;

  const insufficient_evidence = !rmf_mapping || !exposure_result;

  const coverage_band = rmf_mapping && typeof rmf_mapping.coverage_band === 'string' ? rmf_mapping.coverage_band : null;
  const overall_coverage = rmf_mapping && typeof rmf_mapping.overall_coverage === 'number' ? rmf_mapping.overall_coverage : null;
  const prohibited_use_detected = exposure_result ? exposure_result.prohibited_use_detected === true : null;

  const meets_substantial_compliance_bar = !insufficient_evidence && QUALIFYING_BANDS.includes(coverage_band);
  const eligible_for_affirmative_defense_evidence = !insufficient_evidence && meets_substantial_compliance_bar && prohibited_use_detected === false;

  const output_payload = {
    insufficient_evidence,
    eligible_for_affirmative_defense_evidence,
    meets_substantial_compliance_bar,
    coverage_band, overall_coverage, prohibited_use_detected,
    statute_citation: STATUTE_CITATION,
    framing: 'evidence toward the statutory affirmative defense; not a guarantee the defense succeeds',
  };

  const compliance_flags = ['TRAIGA_SAFE_HARBOR_PACK_BUILT', eligible_for_affirmative_defense_evidence ? 'TRAIGA_DEFENSE_EVIDENCE_ELIGIBLE' : 'TRAIGA_DEFENSE_EVIDENCE_NOT_ELIGIBLE'];

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
