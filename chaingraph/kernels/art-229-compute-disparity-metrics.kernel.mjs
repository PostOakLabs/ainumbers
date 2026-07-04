import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-229-compute-disparity-metrics';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_disparity_metrics',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── Fair Lending Disparity Metrics ──────────────────────────────────────────
// Computes adverse-impact and disparity statistics from AGGREGATE COUNTS ONLY.
// ZERO PII by construction: inputs are group-level approval counts, never
//   individual applicant records. This design satisfies the privacy constraint
//   while enabling the full ECOA / HMDA disparity testing workflow.
//
// 4/5ths (80%) adverse-impact ratio: 29 CFR §1607.4(D) (EEOC Uniform
//   Guidelines on Employee Selection Procedures, adopted by CFPB / OCC / FDIC
//   for fair lending). A ratio below 0.80 indicates adverse impact requiring
//   further analysis. table_version: "EEOC-UGSP-29CFR1607-2024"
//
// Two-proportion z-statistic: standard epidemiological test for difference in
//   proportions; z > 1.645 (one-tail alpha=0.05) or > 1.96 (two-tail alpha=0.05)
//   signals statistical significance. Uses Math.sqrt which is IEEE 754 bit-portable.
//
// Standardized mean difference (Cohen's h approximation): difference in
//   proportions divided by pooled standard error -- a scale-free disparity measure.
//
// Odds ratio: protected-class odds / control-group odds. OR < 1 indicates
//   lower odds for protected class.
//
// Note: p-values from the normal CDF require the error function (a transcendental
//   not in the IEEE-portable set). This kernel reports z-statistics; apply
//   z > 1.645 (one-tail) or z > 1.96 (two-tail) as significance thresholds.
//
// Disambiguation: compute_disparity_metrics produces aggregate fair-lending
//   statistics from count data. It does not compute individual credit scores or
//   produce HMDA rate-spread values -- for HMDA use compute_hmda_rate_spread.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }

// IEEE-portable sqrt (Math.sqrt is IEEE 754 mandatory correctly-rounded)
function safeSqrt(v) { return v > 0 ? Math.sqrt(v) : 0; }

export function compute(pp) {
  pp = pp || {};

  const a_label = safeStr(pp.group_a_label || 'protected_class');
  const b_label = safeStr(pp.group_b_label || 'control_group');
  const a_approvals = Math.max(0, Math.round(safeNum(pp.group_a_approvals, 0)));
  const a_total = Math.max(0, Math.round(safeNum(pp.group_a_total, 0)));
  const b_approvals = Math.max(0, Math.round(safeNum(pp.group_b_approvals, 0)));
  const b_total = Math.max(0, Math.round(safeNum(pp.group_b_total, 0)));

  // Guard: empty inputs return finite zero-state
  if (a_total === 0 && b_total === 0) {
    return {
      output_payload: {
        group_a: { label: a_label, approvals: 0, total: 0, approval_rate: 0 },
        group_b: { label: b_label, approvals: 0, total: 0, approval_rate: 0 },
        adverse_impact_ratio: 0,
        four_fifths_threshold: 0.8,
        four_fifths_flag: false,
        four_fifths_result: 'INSUFFICIENT_DATA',
        two_proportion_z: 0,
        z_critical_flag_onetail_05: false,
        z_critical_flag_twotail_05: false,
        odds_ratio: 0,
        standardized_mean_difference: 0,
        n_total: 0,
        regulatory_basis: '29 CFR §1607.4(D) (EEOC UGSP); ECOA 15 USC §1691; 12 CFR Part 1002 (Reg B); HMDA 12 USC §2801',
        table_version: 'EEOC-UGSP-29CFR1607-2024',
        table_source: '29 CFR Part 1607 Uniform Guidelines on Employee Selection Procedures; CFPB HMDA Examination Procedures; OCC Fair Lending Handbook 2020',
        pii_note: 'All inputs are aggregate count data only. No individual applicant records are processed. Zero PII by construction.',
      },
      compliance_flags: ['INSUFFICIENT_DATA'],
    };
  }

  // Clamp approvals to totals
  const a_app = Math.min(a_approvals, a_total);
  const b_app = Math.min(b_approvals, b_total);

  const rate_a = a_total > 0 ? a_app / a_total : 0;
  const rate_b = b_total > 0 ? b_app / b_total : 0;

  // ── 4/5ths adverse-impact ratio ──────────────────────────────────────────
  // AIR = protected_class_rate / control_group_rate
  // Threshold: 0.80 (29 CFR §1607.4(D))
  const FOUR_FIFTHS_THRESHOLD = 0.8;
  let adverse_impact_ratio = 0;
  let four_fifths_result = 'PASS';
  if (rate_b > 0) {
    adverse_impact_ratio = r6(rate_a / rate_b);
    four_fifths_result = adverse_impact_ratio < FOUR_FIFTHS_THRESHOLD ? 'ADVERSE_IMPACT_FLAGGED' : 'PASS';
  } else if (rate_a > 0) {
    // control rate = 0, protected rate > 0 → no adverse impact on protected class
    adverse_impact_ratio = 999; // represents infinity (protected class favored)
    four_fifths_result = 'PASS';
  } else {
    four_fifths_result = 'BOTH_RATES_ZERO';
  }
  const four_fifths_flag = four_fifths_result === 'ADVERSE_IMPACT_FLAGGED';

  // ── Two-proportion z-statistic ───────────────────────────────────────────
  // H0: rate_a == rate_b; pooled proportion estimate
  const n_total = a_total + b_total;
  const pooled_p = n_total > 0 ? (a_app + b_app) / n_total : 0;
  const pooled_q = 1 - pooled_p;
  const se_pooled = a_total > 0 && b_total > 0
    ? safeSqrt(pooled_p * pooled_q * (1 / a_total + 1 / b_total))
    : 0;
  const two_proportion_z = se_pooled > 0 ? r6((rate_a - rate_b) / se_pooled) : 0;

  // Critical values: |z| > 1.645 one-tail p<0.05; |z| > 1.96 two-tail p<0.05
  const abs_z = two_proportion_z < 0 ? -two_proportion_z : two_proportion_z;
  const z_critical_flag_onetail_05 = abs_z > 1.645;
  const z_critical_flag_twotail_05 = abs_z > 1.960;

  // ── Standardized mean difference (Cohen's h approximation) ────────────────
  // SMD = (rate_a - rate_b) / pooled_se (unpooled)
  const se_a = a_total > 0 ? safeSqrt(rate_a * (1 - rate_a) / a_total) : 0;
  const se_b = b_total > 0 ? safeSqrt(rate_b * (1 - rate_b) / b_total) : 0;
  const se_unpooled = safeSqrt(se_a * se_a + se_b * se_b);
  const standardized_mean_difference = se_unpooled > 0 ? r6((rate_a - rate_b) / se_unpooled) : 0;

  // ── Odds ratio ────────────────────────────────────────────────────────────
  // OR = (a_app / a_denial) / (b_app / b_denial)
  const a_denial = a_total - a_app;
  const b_denial = b_total - b_app;
  let odds_ratio = 0;
  if (a_app > 0 && a_denial > 0 && b_app > 0 && b_denial > 0) {
    odds_ratio = r6((a_app * b_denial) / (a_denial * b_app));
  }

  const compliance_flags = [];
  if (four_fifths_flag) compliance_flags.push('ADVERSE_IMPACT_RATIO_BELOW_4_5THS');
  if (z_critical_flag_onetail_05 && (rate_a < rate_b)) compliance_flags.push('Z_STAT_SIGNIFICANT_DISPARITY');

  const output_payload = {
    group_a: { label: a_label, approvals: a_app, total: a_total, approval_rate: r4(rate_a) },
    group_b: { label: b_label, approvals: b_app, total: b_total, approval_rate: r4(rate_b) },
    adverse_impact_ratio: Number.isFinite(adverse_impact_ratio) ? r4(adverse_impact_ratio) : null,
    four_fifths_threshold: FOUR_FIFTHS_THRESHOLD,
    four_fifths_flag,
    four_fifths_result,
    two_proportion_z: r4(two_proportion_z),
    z_critical_flag_onetail_05,
    z_critical_flag_twotail_05,
    pooled_proportion: r6(pooled_p),
    odds_ratio: r4(odds_ratio),
    standardized_mean_difference: r4(standardized_mean_difference),
    n_total,
    zero_pii_confirmation: 'Inputs are aggregate count data only. No individual applicant records processed.',
    regulatory_basis: '29 CFR §1607.4(D) (EEOC UGSP); ECOA 15 USC §1691; 12 CFR Part 1002 (Reg B); HMDA 12 USC §2801; OCC Fair Lending Handbook 2020',
    table_version: 'EEOC-UGSP-29CFR1607-2024',
    table_source: '29 CFR Part 1607 Uniform Guidelines on Employee Selection Procedures (Federal Register 43 FR 38290 1978-08-25); CFPB HMDA Examination Procedures; OCC Fair Lending Handbook Oct 2020',
    pii_note: 'All inputs are aggregate count data only. No individual applicant records are processed. Zero PII by construction.',
  };

  return { output_payload, compliance_flags };
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
