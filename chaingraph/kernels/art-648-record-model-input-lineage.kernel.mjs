// art-648 — Record Model Input Lineage: pure attribute-level data-lineage attestation kernel.
//
// From the model-risk lineage build spec's attribute-level attestation section. None of the
// existing model-risk nodes (art-450/451/453/488/489, or the art-562 lineage pack that cites
// them) attest WHERE a model's input data came from -- only what the model did with declared
// inputs. The referenced supervisory data-lineage guidance requires complete and up-to-date data
// lineages on data attribute level (starting from data capture and including extraction,
// transformation and loading) for the risk indicators and critical data elements feeding a report
// or model -- see the node shard's regulatory_basis / cited_clause_digest for the pinned citation,
// never this comment. This kernel gives that its own citable artifact, distinct from -- and
// optionally cited by -- the outcome/validation record it feeds.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): attributes are supplied and
// asserted by the caller; this kernel never fetches or validates against a live data warehouse or
// source system. An attribute declared without a source_system is a legitimate finding
// (unmapped_attribute_count), never silently dropped or treated as an error.
//
// run_ref is OPTIONAL, matching the sibling index-lineage spec's constituents_ref pattern -- a
// caller with no model-run artifact yet still gets a valid lineage receipt; chain.parent_hashes
// populates only when run_ref is supplied (wired by the caller via buildArtifact's options, not
// this kernel -- this kernel only echoes run_ref back in output_payload for citation).

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-648-record-model-input-lineage';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'record_model_input_lineage',
  mandate_type: 'attestation_mandate',
  gpu: false,
};

const NOT_PROVEN = [
  { item: 'Source-system accuracy', detail: 'Every attribute (source_system, source_field, transformation_applied) is caller-supplied and asserted. This kernel performs no lookup against a live data warehouse, catalog, or source system (zero-egress) and does not verify these values against any external source.' },
  { item: 'Model-run correctness', detail: 'This node attests attribute-level lineage only. Whether the model run that consumed these attributes computed correctly is scored separately by art-451-model-outcome-analysis / art-488-model-replication-diff, never by this receipt.' },
  { item: 'Referenced-artifact authenticity', detail: 'run_ref, when supplied, is a caller-supplied {tool_id, execution_hash} pair, asserted and digested into this receipt. This node performs no lookup against a live artifact store and does not itself verify that the cited hash corresponds to a real, still-valid upstream artifact.' },
  { item: 'RDARR / BCBS 239 compliance', detail: 'This receipt evidences one attribute-lineage assertion. It has no bearing on whether the underlying model is fit for use and does not itself satisfy RDARR or BCBS 239 -- those are firm-level governance obligations this document evidences a piece of, never fulfills.' },
];

function s(v) { return String(v == null ? '' : v).trim(); }

function normalizeRunRef(ref) {
  if (!ref || typeof ref !== 'object') return null;
  const execution_hash = s(ref.execution_hash);
  if (!execution_hash) return null;
  return { execution_hash, tool_id: s(ref.tool_id) || null };
}

// Normalizes one declared attribute. field_name is the only required member -- everything else
// missing is a legitimate finding (unmapped), never a structural error on its own.
function normalizeAttribute(a) {
  if (!a || typeof a !== 'object') return null;
  const field_name = s(a.field_name);
  if (!field_name) return null;
  return {
    field_name,
    source_system: s(a.source_system) || null,
    source_field: s(a.source_field) || null,
    transformation_applied: s(a.transformation_applied) || 'as-is',
    sensitivity_tier: s(a.sensitivity_tier) || null,
  };
}

/**
 * compute(pp) — pure attribute-lineage attestation kernel.
 * pp: {
 *   model_id: string,
 *   as_of_date: string,
 *   run_ref?: { execution_hash, tool_id? },
 *   attributes: [{ field_name, source_system?, source_field?, transformation_applied?, sensitivity_tier? }],
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const model_id = s(pp.model_id) || null;
  const as_of_date = s(pp.as_of_date) || null;
  const rawAttributes = Array.isArray(pp.attributes) ? pp.attributes : [];

  let structural_error = null;
  if (!model_id) structural_error = 'model_id is required.';
  else if (!as_of_date) structural_error = 'as_of_date is required.';
  else if (rawAttributes.length === 0) structural_error = 'attributes must be a non-empty array.';

  const attributes = [];
  if (!structural_error) {
    for (let i = 0; i < rawAttributes.length; i++) {
      const norm = normalizeAttribute(rawAttributes[i]);
      if (!norm) { structural_error = `attributes[${i}] is missing required field_name.`; break; }
      attributes.push(norm);
    }
  }

  const run_ref = structural_error ? null : normalizeRunRef(pp.run_ref);
  const attribute_count = attributes.length;
  const unmapped_attribute_count = attributes.filter((a) => !a.source_system).length;

  const compliance_flags = [];
  if (structural_error) {
    compliance_flags.push('MRM_LINEAGE_STRUCTURAL_ERROR');
  } else {
    compliance_flags.push('MRM_LINEAGE_RECORDED');
    compliance_flags.push(unmapped_attribute_count > 0 ? 'MRM_LINEAGE_UNMAPPED_ATTRIBUTES_PRESENT' : 'MRM_LINEAGE_ALL_MAPPED');
    compliance_flags.push(run_ref ? 'MRM_LINEAGE_RUN_REF_CITED' : 'MRM_LINEAGE_RUN_REF_ABSENT');
  }

  const output_payload = {
    model_id,
    as_of_date,
    structural_error,
    run_ref,
    attributes,
    attribute_count,
    unmapped_attribute_count,
    not_proven: NOT_PROVEN,
    fence: 'Attributes are supplied and asserted by the caller. This kernel never fetches or validates against a live data warehouse or source system (zero-egress). An attribute declared without a source_system is a legitimate finding (unmapped_attribute_count), never silently dropped or treated as an error.',
    regulatory_framework: 'ECB Guide on effective risk data aggregation and risk reporting (May 2024) §3.4(3) requires complete, up-to-date data lineages on data attribute level for risk indicators and their critical data elements; this receipt evidences one such lineage assertion. SR 26-2 (effective 2026-04-17) scopes the model-risk context this attribute set feeds to conventional quantitative models only.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0, supersedes = undefined } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  const artifact = {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    compute_proof_ready: 'deferred',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  if (Array.isArray(supersedes) && supersedes.length > 0) {
    artifact.supersedes = supersedes;
  }
  return artifact;
}
