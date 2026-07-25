import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-470-lookback-completeness-reconciler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'reconcile_aml_lookback_completeness',
  mandate_type: 'compliance_control', gpu: false,
};

// AML consent-order lookback completeness-reconciler kernel (art-470). Answers "did we
// re-screen EVERYTHING the order requires" by reconciling, per period, the caller-declared
// SOURCE-SYSTEM record count against the extract actually produced for re-screening --
// never the extract's own self-reported count. This is the ABSENCE-INSTRUMENT rule: a
// lookback that reports zero gaps because it counted only what the extract already
// contains is indistinguishable from a clean lookback, and that blind spot is the exact
// failure this node exists to catch, so source_record_count is a required, independent
// caller input, not derived from the extract.
//
// A second, independent completeness axis: policy-list SNAPSHOT availability. A period
// whose versioned sanctions/PEP list snapshot was not preserved cannot be re-screened
// against the list that was actually in force at the time -- screening it against
// TODAY's list instead would manufacture false hits/misses and is explicitly disallowed
// by the build spec. Such periods are flagged unverifiable and excluded from the
// "screened" coverage denominator (they are gaps to escalate, not silent zeros).
//
// Deterministic reconciliation arithmetic only -- equality/ratio/dedup checks, no
// randomness, no clock, no network. Zero PII (record counts and hashes only).

function s(v) { return String(v == null ? '' : v).trim(); }
function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function b(v) { return v === true; }

function reconcilePeriod(p) {
  p = p || {};
  const period_label = s(p.period_label) || 'unlabeled_period';
  const source_record_count = Math.max(0, Math.trunc(n(p.source_record_count, 0)));
  const extract_record_count = Math.max(0, Math.trunc(n(p.extract_record_count, 0)));
  const dedup_record_count = Math.max(0, Math.trunc(n(p.dedup_record_count, extract_record_count)));
  const snapshot_available = b(p.snapshot_available);

  const gap_count = Math.max(0, source_record_count - extract_record_count);
  const coverage_pct = source_record_count > 0
    ? Math.round((extract_record_count / source_record_count) * 10000) / 100
    : (extract_record_count > 0 ? 0 : 100);
  const duplicate_count = Math.max(0, extract_record_count - dedup_record_count);

  let period_status;
  if (!snapshot_available) period_status = 'unverifiable_no_snapshot';
  else if (gap_count > 0) period_status = 'incomplete';
  else if (duplicate_count > 0) period_status = 'complete_with_duplicates';
  else period_status = 'complete';

  return {
    period_label,
    source_record_count,
    extract_record_count,
    dedup_record_count,
    duplicate_count,
    gap_count,
    coverage_pct,
    snapshot_available,
    period_status,
  };
}

export function compute(pp) {
  pp = pp || {};
  const periods_in = Array.isArray(pp.periods) ? pp.periods : [];
  const periods = periods_in.map(reconcilePeriod);

  const total_source_record_count = periods.reduce((a, p) => a + p.source_record_count, 0);
  const total_extract_record_count = periods.reduce((a, p) => a + p.extract_record_count, 0);
  const total_duplicate_count = periods.reduce((a, p) => a + p.duplicate_count, 0);

  const unverifiable_periods = periods.filter((p) => p.period_status === 'unverifiable_no_snapshot').map((p) => p.period_label);
  const gap_periods = periods.filter((p) => p.period_status === 'incomplete').map((p) => p.period_label);

  // Coverage denominator excludes unverifiable periods -- those are escalation gaps, not
  // screened-clean zeros (never silently folded into "screened everything").
  const verifiable_source_count = periods
    .filter((p) => p.period_status !== 'unverifiable_no_snapshot')
    .reduce((a, p) => a + p.source_record_count, 0);
  const verifiable_extract_count = periods
    .filter((p) => p.period_status !== 'unverifiable_no_snapshot')
    .reduce((a, p) => a + p.extract_record_count, 0);
  const overall_coverage_pct = verifiable_source_count > 0
    ? Math.round((verifiable_extract_count / verifiable_source_count) * 10000) / 100
    : (verifiable_extract_count > 0 ? 0 : 100);

  const compliance_flags = ['LOOKBACK_COMPLETENESS_EVALUATED'];
  if (unverifiable_periods.length > 0) compliance_flags.push('SNAPSHOT_ABSENT_PERIODS_FLAGGED_UNVERIFIABLE');
  if (gap_periods.length > 0) compliance_flags.push('LOOKBACK_COVERAGE_GAP_DETECTED');
  if (total_duplicate_count > 0) compliance_flags.push('DUPLICATE_RECORDS_IN_EXTRACT');
  if (gap_periods.length === 0 && unverifiable_periods.length === 0) compliance_flags.push('LOOKBACK_FULLY_RECONCILED');

  const lookback_status = unverifiable_periods.length > 0
    ? 'incomplete_unverifiable_periods_present'
    : (gap_periods.length > 0 ? 'incomplete_gaps_present' : 'complete');

  return {
    output_payload: {
      period_count: periods.length,
      periods,
      total_source_record_count,
      total_extract_record_count,
      total_duplicate_count,
      verifiable_source_count,
      verifiable_extract_count,
      overall_coverage_pct,
      gap_periods,
      unverifiable_periods,
      lookback_status,
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
