import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-315-ab2013-training-data-disclosure-linter';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_ab2013_training_data_disclosure',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Honesty guard (STATE-AI-WAVE-SPEC.md §D3, binding): this lints a SUPPLIED disclosure
// document against the 12 AB 2013 datapoint categories, asserting "these inputs replay to
// this presence/gap finding," NEVER "this developer is AB 2013 compliant" or legal advice.
// DRAFT-PIN (wave-wide honesty invariant): the 12-category list below is encoded from
// secondary-source summaries of Cal. Bus. & Prof. Code §22757.7 (AB 2013, eff. 2026-01-01) --
// primary statutory text was not directly re-read at build time. Treat the category set as
// provisional pending a primary-text confirmation pass; do not claim verified conformance to
// the codified section numbering of each sub-item.

export const STATUTE_CITATION_DRAFT = 'Cal. Bus. & Prof. Code §22757.7 (AB 2013), eff. 2026-01-01 -- DRAFT-PINNED against secondary-source summaries';

export const AB2013_DATAPOINTS = [
  'dataset_sources_or_owners',
  'dataset_purpose_alignment',
  'number_of_datapoints',
  'types_of_datapoints',
  'ip_status_copyright_trademark_patent_or_public_domain',
  'purchased_or_licensed',
  'includes_personal_information',
  'includes_aggregate_consumer_information',
  'cleaning_processing_or_modification_description',
  'synthetic_data_use',
  'collection_time_period',
  'collection_dates_or_version',
];

function isPresent(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

export function compute(pp) {
  const disclosure = (pp && typeof pp.disclosure === 'object' && pp.disclosure) || {};

  const per_datapoint = AB2013_DATAPOINTS.map((key) => ({
    datapoint: key,
    status: isPresent(disclosure[key]) ? 'present' : 'missing',
  }));

  const missing_datapoints = per_datapoint.filter((d) => d.status === 'missing').map((d) => d.datapoint);
  const present_count = per_datapoint.length - missing_datapoints.length;
  const all_present = missing_datapoints.length === 0;
  const insufficient_evidence = Object.keys(disclosure).length === 0;

  const output_payload = {
    per_datapoint, missing_datapoints, present_count,
    total_datapoints: AB2013_DATAPOINTS.length,
    all_present, insufficient_evidence,
    statute_citation: STATUTE_CITATION_DRAFT,
  };

  const compliance_flags = ['AB2013_DISCLOSURE_LINT_RUN', all_present ? 'AB2013_ALL_DATAPOINTS_PRESENT' : 'AB2013_DATAPOINTS_MISSING'];

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
