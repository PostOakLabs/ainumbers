import { executionHash } from './_hash.mjs';

// 841-planning-materiality: from a declared benchmark amount, declared percentages in basis
// points and a required rationale id, recompute the overall, performance and clearly-trivial
// thresholds. Arithmetic on declared policy: the kernel ships no default percentage and no
// "typical" range, does not choose the benchmark and does not judge whether a percentage is
// appropriate. A missing rationale id, a percentage of zero or above 10000 basis points, or a
// negative or non-integer amount refuses with an explicit code. An ordering violation
// (clearly-trivial above performance) is FLAGGED, never corrected. Integer minor units, BigInt
// products, no clock, no randomness, zero network, zero PII, pure function of pp.

const TOOL_ID = '841-planning-materiality';
const TOOL_VERSION = '1.0.0';
const BPS = 10000n;

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_planning_materiality',
  mandate_type: 'compliance_control', gpu: false,
};

// Strings only: any other type reads as absent, so a wrong-typed input refuses.
function s(v) { return typeof v === 'string' ? v.trim() : ''; }
function isInt(v) { return typeof v === 'number' && Number.isSafeInteger(v); }
function isBps(v) { return isInt(v) && v >= 1 && v <= 10000; }
const ROUNDING = ['half_up', 'floor'];

// value * bps / 10000 under the declared rounding rule, exact in BigInt.
function applyBps(value, bps, rule) {
  const p = value * BigInt(bps);
  return Number(rule === 'half_up' ? (p + BPS / 2n) / BPS : p / BPS);
}

function refused(pp, reasons) {
  const flags = reasons.length > 0 ? ['INPUT_REFUSED'] : [];
  return {
    output_payload: {
      outcome: 'refused',
      refusal_reasons: reasons,
      benchmark_id: s(pp.benchmark_id) || null,
      rationale_id: s(pp.rationale_id) || null,
      rounding_rule: ROUNDING.includes(pp.rounding_rule) ? pp.rounding_rule : null,
      benchmark_amount: isInt(pp.benchmark_amount) && pp.benchmark_amount >= 0 ? pp.benchmark_amount : null,
      overall_bps: isBps(pp.overall_bps) ? pp.overall_bps : null,
      performance_bps: isBps(pp.performance_bps) ? pp.performance_bps : null,
      trivial_bps: isBps(pp.trivial_bps) ? pp.trivial_bps : null,
      overall_materiality: null,
      performance_materiality: null,
      clearly_trivial_threshold: null,
      performance_not_above_overall: null,
      trivial_not_above_performance: null,
      warnings: flags.slice(),
    },
    compliance_flags: flags,
  };
}

export function compute(pp) {
  pp = pp || {};
  const reasons = [];
  const benchmark_id = s(pp.benchmark_id);
  const rationale_id = s(pp.rationale_id);

  if (benchmark_id === '') reasons.push('BENCHMARK_ID_MISSING');
  if (!isInt(pp.benchmark_amount) || pp.benchmark_amount < 0) reasons.push('BENCHMARK_AMOUNT_INVALID');
  if (!isBps(pp.overall_bps)) reasons.push('OVERALL_BPS_INVALID');
  if (!isBps(pp.performance_bps)) reasons.push('PERFORMANCE_BPS_INVALID');
  if (!isBps(pp.trivial_bps)) reasons.push('TRIVIAL_BPS_INVALID');
  if (rationale_id === '') reasons.push('RATIONALE_ID_MISSING');
  if (!ROUNDING.includes(pp.rounding_rule)) reasons.push('ROUNDING_RULE_INVALID');
  if (reasons.length > 0) return refused(pp, reasons);

  const rule = pp.rounding_rule;
  const amount = BigInt(pp.benchmark_amount);
  // Performance and clearly-trivial are percentages OF the rounded overall figure.
  const overall = applyBps(amount, pp.overall_bps, rule);
  const performance = applyBps(BigInt(overall), pp.performance_bps, rule);
  const trivial = applyBps(BigInt(overall), pp.trivial_bps, rule);

  const performance_not_above_overall = performance <= overall;
  const trivial_not_above_performance = trivial <= performance;

  const compliance_flags = [];
  if (!trivial_not_above_performance) compliance_flags.push('CLEARLY_TRIVIAL_ABOVE_PERFORMANCE');
  const warnings = compliance_flags.slice();

  return {
    output_payload: {
      outcome: 'computed',
      refusal_reasons: [],
      benchmark_id,
      rationale_id,
      rounding_rule: rule,
      benchmark_amount: pp.benchmark_amount,
      overall_bps: pp.overall_bps,
      performance_bps: pp.performance_bps,
      trivial_bps: pp.trivial_bps,
      overall_materiality: overall,
      performance_materiality: performance,
      clearly_trivial_threshold: trivial,
      performance_not_above_overall,
      trivial_not_above_performance,
      warnings,
    },
    compliance_flags,
  };
}

// Hashability walk: mirrors the classes _hash.mjs refuses before canonicalizing
// (non-finite number, integer past 2^53, nesting past MAX_DEPTH, more than
// MAX_ELEMENTS values). Reports { reason, detail } with path and kind only,
// never the value; null when safe. Recursion stops at the depth limit.
const HASH_MAX_DEPTH = 512;        // _hash.mjs MAX_DEPTH
const HASH_MAX_ELEMENTS = 1000000; // _hash.mjs MAX_ELEMENTS
function findHashRefusal(v, path, depth, budget) {
  if (depth > HASH_MAX_DEPTH) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > HASH_MAX_ELEMENTS) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  return null;
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  // Walk the execution_hash preimage first. An unhashable input mints the
  // artifact with a null execution_hash and the reason beside it, never a throw.
  const budget = { n: 0 };
  const unhashable = findHashRefusal(pp, 'pp', 2, budget) || findHashRefusal(output_payload, 'output_payload', 2, budget);
  const hash = unhashable === null ? await executionHash(pp, output_payload) : null;
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
  if (unhashable !== null) artifact.hash_refusal = { reason: unhashable.reason, detail: unhashable.detail };
  return artifact;
}
