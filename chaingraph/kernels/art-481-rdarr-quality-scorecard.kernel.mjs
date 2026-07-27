// art-481 — RDARR Quality Scorecard: pure decision kernel.
//
// RDARR-K-1, second entry of the BCBS 239 / RDARR family (BCBS239-RDARR-BUILD-SPEC.md).
// Deterministic data-quality metrics over a SUPPLIED source extract, keyed to the
// measurable RDARR prerequisites: completeness of mandatory attributes,
// referential integrity across the declared hierarchy, timeliness against a
// declared cut-off, reconciliation coverage, and manual-adjustment ratio. Each
// metric is scored against a POLICY-SUPPLIED threshold (never hardcoded) and
// labelled with its ECB Guide on effective risk data aggregation and risk
// reporting (3 May 2024) prerequisite area, so the result drops into an existing
// self-assessment.
//
// HARD FENCE: thresholds and the metric-to-prerequisite-area map are policy
// INPUTS, not kernel logic — national supervisor variants exist and this kernel
// takes no position on which threshold set is correct. Materiality of a breach is
// a judgement call and is NEVER computed here; the kernel emits pass/breach
// against the supplied threshold only. This is NEVER a supervisory pass mark.
//
// Pure integer arithmetic throughout (record counts, percentage = count*10000/
// total, rendered to 2 decimals) — no floats accumulate across the metric set.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-481-rdarr-quality-scorecard';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'rdarr_quality_scorecard',
  mandate_type: 'attestation_mandate',
  gpu: false,
};

// Percentage of `num`/`den` rendered to 2 decimal places via integer math only
// (never a float division) — deterministic across V8/QuickJS.
function pct2(num, den) {
  if (den <= 0) return '0.00';
  const scaled = Math.trunc((num * 1000000) / den); // basis-points*100, integer
  const whole = Math.trunc(scaled / 10000);
  const frac = Math.abs(scaled % 10000);
  const fracStr = String(Math.trunc(frac / 100)).padStart(2, '0');
  return `${whole}.${fracStr}`;
}

function pctToNumber(s) {
  return Number(s);
}

function isPresent(v) {
  return v !== null && v !== undefined && v !== '';
}

const NOT_PROVEN = [
  { item: 'Extract accuracy', detail: 'Every extract record is caller-supplied and asserted. This kernel checks structural properties (presence, referential linkage, dates, flags) and performs no market-data or source-system lookups (zero-egress).' },
  { item: 'Threshold appropriateness', detail: 'Thresholds and the metric-to-prerequisite-area map are policy inputs supplied by the caller; this kernel takes no position on whether a given threshold set is correct for a given supervisor.' },
  { item: 'Materiality', detail: 'Whether a breach is material is a governance judgement outside this kernel\'s scope — it is never emitted as a kernel output, only pass/breach against the supplied threshold.' },
  { item: 'Aggregation-figure correctness', detail: 'This kernel scores data-quality structure only. Whether a reported risk figure recomputes correctly is scored separately by art-480-rdarr-aggregation-recompute.' },
];

/**
 * compute(pp) — pure quality-scorecard kernel.
 * pp: {
 *   guide_version: string,          // e.g. "ECB Guide on RDARR, 3 May 2024"
 *   cutoff_date: string,            // ISO 'YYYY-MM-DD'
 *   mandatory_attributes: string[], // keys expected present in each record.attributes
 *   hierarchy_node_ids: string[],   // valid node_id universe for referential-integrity check
 *   thresholds: {
 *     completeness_pct: number,             // min required
 *     referential_integrity_pct: number,    // min required
 *     timeliness_pct: number,               // min required
 *     reconciliation_coverage_pct: number,  // min required
 *     manual_adjustment_ratio_pct: number,  // max allowed
 *   },
 *   prerequisite_areas?: { [metric]: string },  // override default ECB-area labels
 *   extract: [ {
 *     record_id: string, node_id: string, as_of_date?: string,
 *     reconciled?: boolean, manual_adjustment?: boolean,
 *     attributes?: { [k: string]: any },
 *   } ],
 * }
 */
export function compute(pp) {
  const guideVersion = pp.guide_version ?? 'ECB Guide on effective risk data aggregation and risk reporting, 3 May 2024';
  const cutoffDate = pp.cutoff_date ?? null;
  const mandatoryAttributes = Array.isArray(pp.mandatory_attributes) ? pp.mandatory_attributes : [];
  const hierarchyNodeIds = new Set(Array.isArray(pp.hierarchy_node_ids) ? pp.hierarchy_node_ids : []);
  const thresholds = pp.thresholds ?? {};
  const extract = Array.isArray(pp.extract) ? pp.extract : [];
  const total = extract.length;

  const defaultAreas = {
    completeness_pct: 'Completeness',
    referential_integrity_pct: 'Accuracy and integrity',
    timeliness_pct: 'Timeliness',
    reconciliation_coverage_pct: 'Accuracy and integrity',
    manual_adjustment_ratio_pct: 'Adaptability',
  };
  const areas = { ...defaultAreas, ...(pp.prerequisite_areas ?? {}) };

  let completeCount = 0;
  let referentiallyIntactCount = 0;
  let timelyCount = 0;
  let reconciledCount = 0;
  let manualAdjustmentCount = 0;

  for (const r of extract) {
    const attrs = r.attributes ?? {};
    const missing = mandatoryAttributes.filter((k) => !isPresent(attrs[k]));
    if (missing.length === 0) completeCount++;

    if (r.node_id != null && hierarchyNodeIds.has(r.node_id)) referentiallyIntactCount++;

    if (cutoffDate != null && typeof r.as_of_date === 'string' && r.as_of_date <= cutoffDate) timelyCount++;

    if (r.reconciled === true) reconciledCount++;

    if (r.manual_adjustment === true) manualAdjustmentCount++;
  }

  const metricDefs = [
    { key: 'completeness_pct', value_count: completeCount, comparator: 'min' },
    { key: 'referential_integrity_pct', value_count: referentiallyIntactCount, comparator: 'min' },
    { key: 'timeliness_pct', value_count: timelyCount, comparator: 'min' },
    { key: 'reconciliation_coverage_pct', value_count: reconciledCount, comparator: 'min' },
    { key: 'manual_adjustment_ratio_pct', value_count: manualAdjustmentCount, comparator: 'max' },
  ];

  const metrics = metricDefs.map((m) => {
    const valuePctStr = pct2(m.value_count, total);
    const valuePctNum = pctToNumber(valuePctStr);
    const thresholdPct = Number.isFinite(thresholds[m.key]) ? thresholds[m.key] : null;
    let status = 'threshold_missing';
    if (thresholdPct != null) {
      status = m.comparator === 'min'
        ? (valuePctNum >= thresholdPct ? 'pass' : 'breach')
        : (valuePctNum <= thresholdPct ? 'pass' : 'breach');
    }
    return {
      metric: m.key,
      ecb_prerequisite_area: areas[m.key] ?? null,
      record_count: m.value_count,
      total_records: total,
      value_pct: valuePctStr,
      threshold_pct: thresholdPct,
      comparator: m.comparator,
      status,
    };
  });

  const passCount = metrics.filter((m) => m.status === 'pass').length;
  const breachCount = metrics.filter((m) => m.status === 'breach').length;
  const missingThresholdCount = metrics.filter((m) => m.status === 'threshold_missing').length;
  const overallStatus = missingThresholdCount > 0 ? 'incomplete_policy' : (breachCount > 0 ? 'breach' : 'pass');

  const compliance_flags = ['RDARR_QUALITY_SCORECARD_COMPUTED'];
  if (breachCount > 0) compliance_flags.push('RDARR_THRESHOLD_BREACH');
  if (missingThresholdCount > 0) compliance_flags.push('RDARR_THRESHOLD_MISSING');
  if (total === 0) compliance_flags.push('RDARR_EXTRACT_EMPTY');

  const output_payload = {
    guide_version: guideVersion,
    cutoff_date: cutoffDate,
    total_records: total,
    metrics,
    scorecard: {
      pass_count: passCount,
      breach_count: breachCount,
      missing_threshold_count: missingThresholdCount,
      overall_status: overallStatus,
    },
    not_proven: NOT_PROVEN,
    fence: 'Extract records and thresholds are SUPPLIED, asserted, and digested into this receipt. This kernel scores deterministic structural metrics against the declared thresholds and attests THAT — never a supervisory pass mark, never a materiality judgement, never confirmation the reported figures reconcile (see art-480), zero-egress by contract.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
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
}
