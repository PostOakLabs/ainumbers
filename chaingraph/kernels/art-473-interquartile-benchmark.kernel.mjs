import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-473-interquartile-benchmark';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'benchmark_tp_interquartile_range',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Transfer-pricing arm's-length range arithmetic (OECD TP Guidelines Ch. III
// §3.57, "interquartile range" as the most common statistical-range
// narrowing tool). Comparable-set SELECTION and functional/DEMPE analysis
// are judgment calls made entirely by the caller -- this kernel takes a
// caller-declared array of already-selected comparable financial-ratio
// results and only does the downstream arithmetic: sort, interquartile
// range (linear-interpolation method, the same one spreadsheet QUARTILE.EXC
// uses), median, and a tested-party ratio-vs-range verdict. Also computes
// the two most common margin ratios directly from caller-declared financial
// data so a caller doesn't have to pre-compute them: TNMM net cost plus /
// operating margin, and the Berry ratio (gross profit / operating expenses).
// This kernel never selects comparables, never judges functional
// comparability, and never opines on which PLI (profit level indicator) is
// appropriate for the tested party's function -- those stay OUT, per
// CBCR-BUILD-SPEC.md boundary.
export function compute(pp) {
  pp = pp || {};

  const comparables = Array.isArray(pp.comparable_ratios)
    ? pp.comparable_ratios.map((v) => Number(v)).filter((v) => Number.isFinite(v))
    : [];
  const sorted = [...comparables].sort((a, b) => a - b);
  const n = sorted.length;

  // Linear-interpolation quartile (QUARTILE.EXC style): position = q * (n + 1).
  function quantile(q) {
    if (n === 0) return null;
    if (n === 1) return sorted[0];
    const pos = q * (n + 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    const frac = pos - lo;
    const at = (i) => sorted[Math.min(Math.max(i, 1), n) - 1];
    if (lo < 1) return sorted[0];
    if (hi > n) return sorted[n - 1];
    return at(lo) + frac * (at(hi) - at(lo));
  }

  const q1 = quantile(0.25);
  const median = n === 0 ? null : (n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2);
  const q3 = quantile(0.75);
  const iqr = (q1 !== null && q3 !== null) ? (q3 - q1) : null;

  const tested_party_ratio = Number.isFinite(Number(pp.tested_party_ratio)) ? Number(pp.tested_party_ratio) : null;
  let range_verdict = 'insufficient_data';
  if (tested_party_ratio !== null && q1 !== null && q3 !== null) {
    range_verdict = (tested_party_ratio >= q1 && tested_party_ratio <= q3) ? 'within_range' : (tested_party_ratio < q1 ? 'below_range' : 'above_range');
  }

  // Ratio suite: computed only when the caller declares the underlying financials.
  const fin = (pp.financials && typeof pp.financials === 'object') ? pp.financials : {};
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const revenue = num(fin.revenue);
  const total_cost = num(fin.total_cost);
  const operating_profit = num(fin.operating_profit);
  const gross_profit = num(fin.gross_profit);
  const operating_expenses = num(fin.operating_expenses);

  const tnmm_net_cost_plus_margin = (operating_profit !== null && total_cost !== null && total_cost !== 0) ? operating_profit / total_cost : null;
  const tnmm_operating_margin = (operating_profit !== null && revenue !== null && revenue !== 0) ? operating_profit / revenue : null;
  const berry_ratio = (gross_profit !== null && operating_expenses !== null && operating_expenses !== 0) ? gross_profit / operating_expenses : null;

  const missing_inputs = [];
  if (n === 0) missing_inputs.push('comparable_ratios: no comparables declared -- range cannot be computed');
  if (tested_party_ratio === null) missing_inputs.push('tested_party_ratio: not declared -- no range verdict computed');

  return {
    output_payload: {
      comparable_count: n,
      sorted_comparable_ratios: sorted,
      q1, median, q3, iqr,
      tested_party_ratio,
      range_verdict,
      ratio_suite: { tnmm_net_cost_plus_margin, tnmm_operating_margin, berry_ratio },
      missing_inputs,
      not_a_comparable_selector: 'Arithmetic only. Comparable-set selection, functional/DEMPE analysis, and PLI choice are caller judgment and are never performed or validated by this kernel.',
    },
    compliance_flags: ['CBCR_TP_BENCHMARK_COMPUTED', n > 0 ? 'CBCR_TP_BENCHMARK_HAS_COMPARABLES' : 'CBCR_TP_BENCHMARK_NO_COMPARABLES'],
  };
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
