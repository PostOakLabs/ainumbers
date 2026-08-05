// art-557 — Record Index Constituents: pure attestation kernel.
//
// First entry of the Financial Index/Benchmark Administrator Lineage family
// (INDEX-LINEAGE-BUILD-SPEC.md §1). Gives an index's constituent set, as of a
// stated date, its own citable execution_hash -- the BMR/SEBI-shaped starting
// point ("what was in the index and why") that every downstream weighting or
// rebalance artifact cites rather than re-declaring.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): the constituent
// list, the eligibility criteria description, and the selection universe size are
// all SUPPLIED by the caller and merely ASSERTED -- this kernel performs zero
// market-data or index-provider lookups (zero-egress by contract, no network
// calls of any kind, never a live index-data feed). It attests THAT a declared
// constituent set exists exactly as stated, selected under the stated criteria --
// nothing about whether the criteria was applied correctly against underlying
// market data. Fence matches art-373: supplied and asserted, never verified.
//
// Corrections use the SPEC.md §1 top-level `supersedes` field (no bespoke status
// registry): a restated constituent set cites the prior artifact's execution_hash
// via the caller-supplied `supersedes` option to buildArtifact().

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-557-record-index-constituents';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'record_index_constituents',
  mandate_type: 'attestation_mandate',
  gpu: false,
};

const NOT_PROVEN = [
  { item: 'Eligibility-criteria application', detail: 'This kernel attests that a declared constituent set exists exactly as stated, selected under the stated criteria. It does not itself verify the criteria was applied correctly against underlying market data.' },
  { item: 'Constituent-data accuracy', detail: 'Every security_id, name, sector and country is caller-supplied and asserted. This kernel performs no index-provider or market-data lookups (zero-egress) and does not verify these values against any external source.' },
  { item: 'Live index-data feed', detail: 'All inputs are point-in-time as supplied by the caller for the stated as_of_date; this kernel makes no claim about a live or real-time index-provider feed and makes none of its own calls.' },
  { item: 'Regulatory benchmark-administrator compliance', detail: 'EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) and SEBI benchmark-administrator framework references, where used downstream, are informative context only; this kernel makes no claim of compliance with either.' },
];

function normalizeConstituent(c) {
  c = c || {};
  return {
    security_id: c.security_id ?? null,
    name: c.name ?? null,
    sector: c.sector ?? null,
    country: c.country ?? null,
  };
}

/**
 * compute(pp) — pure constituent-set attestation kernel.
 * pp: {
 *   index_id: string,
 *   as_of_date: string,
 *   constituents: [{ security_id, name, sector, country }],
 *   eligibility_criteria_ref: string,  // free-text methodology-rule description
 *   selection_universe_size?: number,
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const indexId = pp.index_id ?? null;
  const asOfDate = pp.as_of_date ?? null;
  const constituentsRaw = Array.isArray(pp.constituents) ? pp.constituents : [];
  const constituents = constituentsRaw.map(normalizeConstituent);
  const eligibilityCriteriaRef = pp.eligibility_criteria_ref ?? null;
  const selectionUniverseSize = Number.isFinite(pp.selection_universe_size) ? pp.selection_universe_size : null;

  let structuralError = null;
  if (!indexId) structuralError = 'index_id is required.';
  else if (!asOfDate) structuralError = 'as_of_date is required.';
  else if (constituents.length === 0) structuralError = 'constituents must be a non-empty array.';
  else if (!eligibilityCriteriaRef) structuralError = 'eligibility_criteria_ref is required.';

  const constituentCount = constituents.length;
  const missingIds = constituents.filter((c) => !c.security_id).length;

  const compliance_flags = [];
  if (structuralError) compliance_flags.push('INDEX_CONSTITUENTS_STRUCTURAL_ERROR');
  else compliance_flags.push('INDEX_CONSTITUENTS_RECORDED');
  if (!structuralError && missingIds > 0) compliance_flags.push('INDEX_CONSTITUENTS_MISSING_SECURITY_ID');
  if (!structuralError && selectionUniverseSize != null && selectionUniverseSize < constituentCount) {
    compliance_flags.push('INDEX_SELECTION_UNIVERSE_SIZE_INCONSISTENT');
  }
  if (!structuralError) compliance_flags.push('INDEX_CONSTITUENTS_INPUTS_SUPPLIED_NOT_VERIFIED');

  const output_payload = {
    index_id: indexId,
    as_of_date: asOfDate,
    structural_error: structuralError,
    constituents,
    constituent_count: constituentCount,
    eligibility_criteria_ref: eligibilityCriteriaRef,
    selection_universe_size: selectionUniverseSize,
    not_proven: NOT_PROVEN,
    fence: 'The constituent list, eligibility-criteria description, and selection universe size are SUPPLIED, asserted, and digested into this receipt. This kernel attests THAT a declared constituent set exists exactly as stated, selected under the stated criteria -- never a verification of the criteria against market data, never a live index-data feed (zero-egress by contract).',
    regulatory_framework: 'EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) and SEBI benchmark-administrator framework references are informative context only; this kernel makes no compliance claim under either.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0, supersedes } = {}) {
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
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  if (Array.isArray(supersedes) && supersedes.length > 0) {
    artifact.supersedes = supersedes;
  }
  return artifact;
}
