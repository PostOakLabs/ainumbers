import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-183-irrbb-eve-shock-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'calculate_irrbb_eve_shocks',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Delta-EVE under the 6 BCBS d368 / EBA standardised IRRBB shock scenarios
// (parallel up/down, short up/down, steepener, flattener), recalibrated effective
// 1 Jan 2026. Duration-based sensitivity approximation over 6 standardised time
// buckets: DeltaEVE_scenario = -sum(net_cashflow_gap_b * duration_b * shock_bps_b / 10000).
// Reference parallel shock magnitude 200bp (BCBS d368 Annex 2 standardised size);
// short/long tenor decomposition uses the Annex 2 scalars (steepener short -0.65/long
// +0.90; flattener short +0.80/long -0.60). Simplified: does not apply the BCBS
// post-shock rate floor. Root node of irrbb-supervisory-outlier-test chain.
// NaN-safe. Zero network, zero PII.
const R_BAR_BPS = 200;
const BUCKETS = [
  { key: 'on_1m',    midpoint: 0.04 },
  { key: 'm1_y1',    midpoint: 0.5 },
  { key: 'y1_y3',    midpoint: 2 },
  { key: 'y3_y5',    midpoint: 4 },
  { key: 'y5_y10',   midpoint: 7.5 },
  { key: 'y10_plus', midpoint: 15 },
];

function decay(midpoint) { return Math.max(0, 1 - midpoint / 20); }

function shockBps(scenario, midpoint) {
  const d = decay(midpoint);
  switch (scenario) {
    case 'parallel_up':   return R_BAR_BPS;
    case 'parallel_down': return -R_BAR_BPS;
    case 'short_up':      return R_BAR_BPS * d;
    case 'short_down':    return -R_BAR_BPS * d;
    case 'steepener':     return -0.65 * R_BAR_BPS * d + 0.90 * R_BAR_BPS * (1 - d);
    case 'flattener':     return  0.80 * R_BAR_BPS * d - 0.60 * R_BAR_BPS * (1 - d);
    default: return 0;
  }
}

export function compute(pp) {
  const { repricing_gaps = {} } = pp;
  const g = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

  const gaps = BUCKETS.map((b) => ({ ...b, net_cashflow_gap: g(repricing_gaps[b.key]) }));
  const total_net_gap = gaps.reduce((s, b) => s + b.net_cashflow_gap, 0);

  const SCENARIOS = ['parallel_up', 'parallel_down', 'short_up', 'short_down', 'steepener', 'flattener'];
  const shocks = {};
  for (const scenario of SCENARIOS) {
    const delta_eve = Math.round(
      -gaps.reduce((s, b) => s + b.net_cashflow_gap * b.midpoint * shockBps(scenario, b.midpoint) / 10000, 0) * 100
    ) / 100;
    shocks[scenario] = { delta_eve };
  }

  let worst_scenario = SCENARIOS[0], worst_delta_eve = shocks[SCENARIOS[0]].delta_eve;
  for (const s of SCENARIOS) {
    if (shocks[s].delta_eve < worst_delta_eve) { worst_delta_eve = shocks[s].delta_eve; worst_scenario = s; }
  }

  const compliance_flags = { IRRBB_EVE_SHOCKS_CALCULATED: true };
  if (worst_delta_eve < 0) compliance_flags.IRRBB_WORST_SCENARIO_IS_DECLINE = true;

  return {
    output_payload: {
      shocks,
      worst_scenario,
      worst_delta_eve,
      total_net_gap,
      buckets_used: BUCKETS.map((b) => b.key),
      reference_parallel_shock_bps: R_BAR_BPS,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
