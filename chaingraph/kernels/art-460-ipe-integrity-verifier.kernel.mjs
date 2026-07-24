import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-460-ipe-integrity-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_ipe_integrity',
  mandate_type: 'compliance_control', gpu: false,
};

// Information-Produced-by-Entity (IPE) integrity-verifier kernel (SOX 404 / ICFR, art-460).
// Answers "is this report extract what the source system actually produced" by comparing three
// caller-declared facts about a source extract vs the report built from it: a content hash
// (source_extract_hash vs report_hash), a row count, and a control total (within a caller-set
// tolerance for rounding). All three are policy inputs -- this kernel never re-derives or
// recomputes the extract itself, it only reconciles the declared parameters. Deterministic
// equality/tolerance checks only -- no randomness, no clock, no network. Zero PII.

function s(v) { return String(v == null ? '' : v).trim(); }
function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }

export function compute(pp) {
  pp = pp || {};
  const source_extract_hash = s(pp.source_extract_hash);
  const report_hash = s(pp.report_hash);
  const source_row_count = Math.trunc(n(pp.source_row_count, 0));
  const report_row_count = Math.trunc(n(pp.report_row_count, 0));
  const source_control_total = n(pp.source_control_total, 0);
  const report_control_total = n(pp.report_control_total, 0);
  const tolerance = Math.max(0, n(pp.tolerance, 0));

  const hash_match = !!source_extract_hash && !!report_hash && source_extract_hash === report_hash;
  const row_count_match = source_row_count === report_row_count;
  const control_total_delta = report_control_total - source_control_total;
  const total_within_tolerance = Math.abs(control_total_delta) <= tolerance;

  const discrepancies = [];
  if (!hash_match) discrepancies.push('HASH_MISMATCH');
  if (!row_count_match) discrepancies.push('ROW_COUNT_MISMATCH');
  if (!total_within_tolerance) discrepancies.push('CONTROL_TOTAL_OUT_OF_TOLERANCE');

  const integrity_status = discrepancies.length === 0 ? 'confirmed' : 'exception';
  const compliance_flags = ['IPE_INTEGRITY_EVALUATED'];
  if (integrity_status === 'confirmed') compliance_flags.push('IPE_INTEGRITY_CONFIRMED');
  else compliance_flags.push('IPE_INTEGRITY_EXCEPTION');

  return {
    output_payload: {
      source_extract_hash: source_extract_hash || null,
      report_hash: report_hash || null,
      hash_match,
      source_row_count,
      report_row_count,
      row_count_match,
      source_control_total,
      report_control_total,
      control_total_delta,
      tolerance,
      total_within_tolerance,
      discrepancies,
      integrity_status,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
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
}
