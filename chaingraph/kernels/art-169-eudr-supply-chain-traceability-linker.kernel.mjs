import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-169-eudr-supply-chain-traceability-linker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'link_eudr_supply_chain_traceability',
  mandate_type: 'compliance_mandate', gpu: false,
};

// EUDR single-DDS rule: only the first operator placing goods on the EU market files the DDS.
// All downstream traders must reference the upstream DDS reference number(s) and retain records.
// This kernel validates: single-DDS rule compliance, upstream DDS reference chain integrity,
// plot-geolocation coverage, and custody-chain completeness. Flags traceability gaps.
// Feeds readiness diagnostic (art-170). Zero network.
export function compute(pp) {
  const { supply_chain = {} } = pp;

  const operator_is_first = supply_chain.operator_is_first === true;
  const upstream_dds_refs = Array.isArray(supply_chain.upstream_dds_refs) ? supply_chain.upstream_dds_refs : [];
  const plot_geolocation_present = supply_chain.plot_geolocation_present === true;
  const custody_chain_complete = supply_chain.custody_chain_complete === true;
  const linked_dds_count = upstream_dds_refs.length;

  // DDS reference format: TRACES NT generates alphanumeric identifiers
  const DDS_REF_RE = /^[A-Z0-9-]{4,40}$/;
  const refs_valid = upstream_dds_refs.every(
    (r) => typeof r === 'string' && DDS_REF_RE.test(r.trim()),
  );

  const gaps = [];

  // Single-DDS rule check
  if (!operator_is_first && linked_dds_count === 0) {
    gaps.push('downstream_operator_must_reference_upstream_dds');
  }
  if (operator_is_first && linked_dds_count > 0) {
    gaps.push('first_operator_should_not_reference_upstream_dds');
  }
  if (!operator_is_first && !refs_valid && linked_dds_count > 0) {
    gaps.push('upstream_dds_ref_format_invalid');
  }
  if (!plot_geolocation_present) {
    gaps.push('plot_geolocation_missing');
  }
  if (!custody_chain_complete) {
    gaps.push('custody_chain_incomplete');
  }

  const chain_integrity = gaps.length === 0;
  const single_dds_rule_met =
    (operator_is_first && linked_dds_count === 0) ||
    (!operator_is_first && linked_dds_count > 0 && refs_valid);

  const compliance_flags = [];
  compliance_flags.push('EUDR_TRACEABILITY_ASSESSED');
  if (chain_integrity) compliance_flags.push('EUDR_CHAIN_INTEGRITY_VERIFIED');
  else compliance_flags.push('EUDR_TRACEABILITY_GAPS_FOUND');
  if (!single_dds_rule_met) compliance_flags.push('EUDR_SINGLE_DDS_RULE_VIOLATION');

  return {
    output_payload: {
      chain_integrity,
      single_dds_rule_met,
      operator_is_first,
      linked_dds_count,
      refs_valid: linked_dds_count > 0 ? refs_valid : null,
      plot_geolocation_present,
      custody_chain_complete,
      traceability_gaps: gaps,
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
