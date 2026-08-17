import { executionHash } from './_hash.mjs';

// art-647-record-index-correction — Record Index Correction: pure attestation kernel.
//
// Fourth entry of the Financial Index/Benchmark Administrator Lineage family
// (INDEX-LINEAGE-BUILD-SPEC.md, corrections chain section). art-557 already
// covers constituent-set corrections via the SPEC.md top-level `supersedes`
// field; this node adds the
// equivalent for a PUBLISHED INDEX LEVEL OR WEIGHT-SET VALUE -- the case BMR
// calls an index restatement: a level or weight was published, then found
// wrong, and corrected.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): this kernel
// attests THAT a correction was declared, by whom (via the caller-supplied
// original_value_ref), and why (reason_code); it does not itself verify the
// corrected value against a third-party recomputation, and it creates no
// reverse link or status registry -- the OCG spec's supersession section is
// explicit that supersession is discoverable only from the newer artifact or
// a log scan. The artifact's
// own top-level `supersedes` field (set by buildArtifact()'s caller-supplied
// option, same mechanism as art-557) is what makes the correction discoverable
// by standard supersession, in addition to the explicit original_value_ref
// citation carried in output_payload.

const TOOL_ID = 'art-647-record-index-correction';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'record_index_correction',
  mandate_type: 'attestation_mandate', gpu: false,
};

const NOT_PROVEN = [
  { item: 'Corrected-value re-verification', detail: 'This kernel attests that a correction was declared, by whom (the cited original_value_ref), and why (reason_code). It does not itself verify the corrected_value against a third-party recomputation.' },
  { item: 'Original-artifact accuracy', detail: 'original_value_ref (execution_hash, tool_id, field_path) is caller-supplied and asserted; this kernel performs no lookup of the referenced artifact and does not verify the reference resolves to a real prior artifact.' },
  { item: 'Reverse-link / status registry', detail: 'This kernel creates no reverse link or status registry. Per SPEC.md §1, a supersession is discoverable only from the newer artifact (via its top-level supersedes field) or a log scan, never a lookup from the original artifact forward.' },
  { item: 'Regulatory benchmark-administrator compliance', detail: 'EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) Art 12(1)(e) (traceable and verifiable) is cited as the traceability rationale for this attestation; SEBI (Index Providers) Regulations, 2024 has no located provision governing correction/restatement of a published index value (confirmed absent on retrieval -- N/A, not silently inherited). This kernel makes no claim of compliance under either regime.' },
];

const REQUIRED_REF_FIELDS = ['execution_hash', 'tool_id', 'field_path'];

function normalizeOriginalValueRef(ref) {
  ref = ref || {};
  return {
    execution_hash: ref.execution_hash ?? null,
    tool_id: ref.tool_id ?? null,
    field_path: ref.field_path ?? null,
  };
}

/**
 * compute(pp) — pure index-correction attestation kernel.
 * pp: {
 *   index_id: string,
 *   original_value_ref: { execution_hash: string, tool_id: string, field_path: string },
 *   corrected_value: any,
 *   reason_code: string,          // free-text, e.g. "input data error", "methodology misapplication", "vendor restatement"
 *   correction_date: string,
 *   affected_period: string,
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const indexId = pp.index_id ?? null;
  const originalValueRef = normalizeOriginalValueRef(pp.original_value_ref);
  const correctedValue = Object.prototype.hasOwnProperty.call(pp, 'corrected_value') ? pp.corrected_value : null;
  const reasonCode = pp.reason_code ?? null;
  const correctionDate = pp.correction_date ?? null;
  const affectedPeriod = pp.affected_period ?? null;

  let structuralError = null;
  if (!indexId) structuralError = 'index_id is required.';
  else if (!originalValueRef.execution_hash || !originalValueRef.tool_id || !originalValueRef.field_path) {
    structuralError = `original_value_ref is missing required field(s): ${REQUIRED_REF_FIELDS.filter((f) => !originalValueRef[f]).join(', ')}.`;
  } else if (!Object.prototype.hasOwnProperty.call(pp, 'corrected_value')) structuralError = 'corrected_value is required.';
  else if (!reasonCode) structuralError = 'reason_code is required.';
  else if (!correctionDate) structuralError = 'correction_date is required.';
  else if (!affectedPeriod) structuralError = 'affected_period is required.';

  const compliance_flags = [];
  if (structuralError) compliance_flags.push('INDEX_CORRECTION_STRUCTURAL_ERROR');
  else compliance_flags.push('INDEX_CORRECTION_RECORDED');
  if (!structuralError) compliance_flags.push('INDEX_CORRECTION_INPUTS_SUPPLIED_NOT_VERIFIED');
  if (!structuralError) compliance_flags.push('INDEX_CORRECTION_CITES_ORIGINAL_VALUE_REF');

  const output_payload = {
    index_id: indexId,
    structural_error: structuralError,
    original_value_ref: originalValueRef,
    corrected_value: correctedValue,
    reason_code: reasonCode,
    correction_date: correctionDate,
    affected_period: affectedPeriod,
    not_proven: NOT_PROVEN,
    fence: 'original_value_ref, corrected_value, reason_code and the correction/affected-period dates are SUPPLIED, asserted, and digested into this receipt. This kernel attests THAT a correction was declared, by whom, and why -- never a verification of the corrected value against a third-party recomputation, and it creates no reverse link or status registry.',
    regulatory_framework: 'EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) Art 12(1)(e) (traceable and verifiable) is the cited traceability rationale; SEBI (Index Providers) Regulations, 2024 has no located provision on correction/restatement of a published index value. This kernel makes no compliance claim under either regime.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0, supersedes = undefined } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  const artifact = {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  if (Array.isArray(supersedes) && supersedes.length > 0) {
    artifact.supersedes = supersedes;
  }
  return artifact;
}
