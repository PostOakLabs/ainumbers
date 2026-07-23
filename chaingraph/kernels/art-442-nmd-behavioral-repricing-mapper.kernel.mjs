import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-442-nmd-behavioral-repricing-mapper';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'map_nmd_behavioral_repricing',
  mandate_type: 'analytics_mandate', gpu: false,
};

// Non-maturity deposit (NMD) behavioral repricing mapper -- OCC 2010-1
// Interagency Advisory on IRR (core/volatile deposit segmentation; deposit
// beta). Distinct from art-369 (Rate Shock Ladder Replay): art-369 takes a
// bucketed repricing_gaps schedule as a GIVEN input; this kernel DERIVES
// that bucket schedule from underlying NMD segment balances, a caller-
// declared behavioral repricing allocation, and a deposit beta -- a step
// art-369 never performs. Output net_repricing_gap is shaped to plug
// directly into art-369's repricing_gaps input.
//
// Per segment: rate_sensitive_balance_b = balance * beta * allocation[b]
// (allocation is the caller's OWN behavioral-study schedule -- never a
// baked-in regulatory decay curve). Deposits are liabilities, so each
// segment's contribution nets NEGATIVE into net_repricing_gap.
// Fixed-point money math (2dp rounding), finite gate, NaN-safe inputs.

const BUCKET_KEYS = ['on_1m', 'm1_y1', 'y1_y3', 'y3_y5', 'y5_y10', 'y10_plus'];
const ALLOC_TOLERANCE = 0.001;

function g(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function clamp01(v) { const n = g(v); return n < 0 ? 0 : n > 1 ? 1 : n; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};
  const segments = Array.isArray(pp.nmd_segments) ? pp.nmd_segments : [];
  const compliance_flags = [];

  const net_repricing_gap = BUCKET_KEYS.reduce((o, k) => { o[k] = 0; return o; }, {});
  const segment_results = [];
  let total_balance = 0;
  let total_rate_sensitive_balance = 0;
  let any_misallocated = false;

  for (const seg of segments) {
    const name = String((seg && seg.name) || '').trim() || 'unnamed_segment';
    const balance = Math.max(0, g(seg && seg.balance));
    const beta = clamp01(seg && seg.beta);
    const allocation = (seg && seg.allocation) || {};
    const allocByBucket = BUCKET_KEYS.reduce((o, k) => { o[k] = clamp01(allocation[k]); return o; }, {});
    const allocSum = BUCKET_KEYS.reduce((s, k) => s + allocByBucket[k], 0);
    const sums_to_one = Math.abs(allocSum - 1) <= ALLOC_TOLERANCE;
    if (!sums_to_one) any_misallocated = true;

    const rate_sensitive_balance = r2(balance * beta);
    const bucket_gaps = {};
    for (const k of BUCKET_KEYS) {
      const contribution = -r2(balance * beta * allocByBucket[k]);
      bucket_gaps[k] = contribution;
      net_repricing_gap[k] = r2(net_repricing_gap[k] + contribution);
    }

    total_balance = r2(total_balance + balance);
    total_rate_sensitive_balance = r2(total_rate_sensitive_balance + rate_sensitive_balance);
    segment_results.push({
      name, balance: r2(balance), beta, allocation_sum: r2(allocSum),
      sums_to_one, rate_sensitive_balance, bucket_gaps,
    });
  }

  const weighted_avg_beta = total_balance > 0 ? r2(total_rate_sensitive_balance / total_balance) : 0;
  const total_net_repricing_gap = r2(BUCKET_KEYS.reduce((s, k) => s + net_repricing_gap[k], 0));

  compliance_flags.push('NMD_REPRICING_MAPPED');
  if (any_misallocated) compliance_flags.push('NMD_ALLOCATION_SCHEDULE_INVALID');
  if (segments.length === 0) compliance_flags.push('NMD_NO_SEGMENTS_DECLARED');

  return {
    output_payload: {
      net_repricing_gap,
      segment_results,
      total_balance,
      total_rate_sensitive_balance,
      weighted_avg_beta,
      total_net_repricing_gap,
      buckets_used: BUCKET_KEYS,
      convention: 'OCC 2010-1 NMD core/volatile behavioral repricing mapper (caller-declared allocation)',
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
