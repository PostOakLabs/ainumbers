import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-451-model-outcome-analysis';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compare_model_outcome_analysis',
  mandate_type: 'compliance_control', gpu: false,
};

// Model-outcome-analysis kernel: SR 26-2 ongoing-monitoring backtest.
// Takes a flat list of {period_label, predicted, actual} observations and
// an error-tolerance percentage, and returns per-period absolute percent
// error, mean/max absolute percent error, the set of periods breaching
// tolerance, and a pass/fail outcome status against a caller-declared
// maximum breach rate. Second node in the model-passport lifecycle (after
// art-450 inventory entry, before art-452 validation status). Fixed-point
// rounding, finite gate (empty observation list resolves to 0/empty/null,
// never NaN). NaN-safe. Zero network, zero PII.

function g(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};
  const rawObs = Array.isArray(pp.observations) ? pp.observations : [];
  const errorThresholdPct = g(pp.error_threshold_pct) || 10;
  const maxBreachRatePct = g(pp.max_breach_rate_pct) || 20;
  const compliance_flags = [];

  const observations = rawObs
    .map((o) => ({
      period_label: String((o && o.period_label) || '').trim(),
      predicted: g(o && o.predicted),
      actual: g(o && o.actual),
    }))
    .filter((o) => o.period_label);

  const periods = observations.map((o) => {
    const error = r2(o.actual - o.predicted);
    const abs_pct_error = o.predicted !== 0
      ? r2(Math.abs(error / o.predicted) * 100)
      : (o.actual === 0 ? 0 : 100);
    const breach = abs_pct_error > errorThresholdPct;
    return { period_label: o.period_label, predicted: o.predicted, actual: o.actual, error, abs_pct_error, breach };
  });

  const total = periods.length;
  const breaches = periods.filter((p) => p.breach);
  const mean_absolute_percent_error = total > 0
    ? r2(periods.reduce((s, p) => s + p.abs_pct_error, 0) / total)
    : 0;
  const max_absolute_percent_error = total > 0
    ? r2(Math.max(...periods.map((p) => p.abs_pct_error)))
    : 0;
  const breach_rate_pct = total > 0 ? r2((breaches.length / total) * 100) : 0;
  const worst_period = total > 0
    ? [...periods].sort((a, b) => b.abs_pct_error - a.abs_pct_error)[0].period_label
    : null;

  const outcome_status = total === 0
    ? 'not_performed'
    : (breach_rate_pct > maxBreachRatePct ? 'fail' : 'pass');

  compliance_flags.push('OUT_ANALYSIS_CALCULATED');
  if (total === 0) compliance_flags.push('OUT_EMPTY_OBSERVATIONS');
  if (breaches.length > 0) compliance_flags.push('OUT_THRESHOLD_BREACH');
  if (outcome_status === 'fail') compliance_flags.push('OUT_STATUS_FAIL');

  return {
    output_payload: {
      error_threshold_pct: errorThresholdPct,
      max_breach_rate_pct: maxBreachRatePct,
      periods,
      total_periods: total,
      breach_periods: breaches.map((p) => ({ period_label: p.period_label, abs_pct_error: p.abs_pct_error })),
      mean_absolute_percent_error,
      max_absolute_percent_error,
      breach_rate_pct,
      worst_period,
      outcome_status,
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
