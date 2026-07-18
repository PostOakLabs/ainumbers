import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-369-run-rate-shock-ladder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'run_rate_shock_ladder',
  mandate_type: 'analytics_mandate', gpu: false,
};

// US OCC/FDIC interest-rate-risk parallel shock ladder (Comptroller's Handbook /
// FDIC IRR guidance convention): +/-100/200/300/400bp parallel shocks over a
// bucketed repricing-gap schedule, distinct from the shipped BCBS d368 / EBA
// standardised six-scenario convention (art-183/art-185, fixed 200bp reference,
// baked-in Annex 2 short/long tenor scalars). This kernel (a) sweeps FOUR
// magnitudes, not one, and (b) emits BOTH a delta-EVE leg (duration-weighted,
// same bucket-midpoint approximation as art-183) and a delta-NII leg (simple
// 12-month cumulative-gap x shock approximation) from a SINGLE combined kernel,
// rather than art-183's EVE-only / art-185's NII-only split.
//
// Non-parallel presets (steepener/flattener) are OPTIONAL and their short/long
// tenor split is a caller-DECLARED input (short_bps/long_bps), never a baked-in
// regulatory scalar -- this is what keeps the convention distinct from art-183's
// fixed BCBS Annex 2 steepener/flattener coefficients. NII is a parallel-only
// concept in this kernel (OCC guidance ties the 12-month NII simulation to
// parallel shocks); non-parallel presets report delta_nii: null.
//
// DeltaEVE_scenario = -sum(net_cashflow_gap_b * duration_proxy_b * shock_bps / 10000)
// DeltaNII_scenario = nii_12m_gap * shock_bps / 10000   (parallel scenarios only)
// Fixed-point money math (2dp rounding on every emitted number), finite gate
// (no NaN/Infinity ever). NaN-safe inputs. Zero network, zero PII.

const BUCKETS = [
  { key: 'on_1m',    midpoint: 0.04 },
  { key: 'm1_y1',    midpoint: 0.5 },
  { key: 'y1_y3',    midpoint: 2 },
  { key: 'y3_y5',    midpoint: 4 },
  { key: 'y5_y10',   midpoint: 7.5 },
  { key: 'y10_plus', midpoint: 15 },
];
const SHORT_BUCKET_KEYS = new Set(['on_1m', 'm1_y1', 'y1_y3']);
const MAGNITUDES_BPS = [100, 200, 300, 400];

function g(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

function deltaEveParallel(gaps, shockBps) {
  return -gaps.reduce((s, b) => s + b.net_cashflow_gap * b.midpoint * shockBps / 10000, 0);
}

function deltaEvePreset(gaps, shortBps, longBps) {
  return -gaps.reduce((s, b) => {
    const bps = SHORT_BUCKET_KEYS.has(b.key) ? shortBps : longBps;
    return s + b.net_cashflow_gap * b.midpoint * bps / 10000;
  }, 0);
}

export function compute(pp) {
  pp = pp || {};
  const { repricing_gaps = {} } = pp;
  const nii12mGap = g(pp.nii_12m_gap);
  const presets = Array.isArray(pp.shock_presets) ? pp.shock_presets : [];
  const compliance_flags = [];

  const gaps = BUCKETS.map((b) => ({ ...b, net_cashflow_gap: g(repricing_gaps[b.key]) }));
  const total_net_gap = gaps.reduce((s, b) => s + b.net_cashflow_gap, 0);

  const ladder = {};
  for (const mag of MAGNITUDES_BPS) {
    for (const dir of ['up', 'down']) {
      const shockBps = dir === 'up' ? mag : -mag;
      const key = `parallel_${dir}_${mag}bp`;
      ladder[key] = {
        shock_bps: shockBps,
        delta_eve: r2(deltaEveParallel(gaps, shockBps)),
        delta_nii: r2(nii12mGap * shockBps / 10000),
      };
    }
  }

  const preset_shocks = {};
  for (const preset of presets) {
    const name = String((preset && preset.name) || '').trim();
    if (!name) continue;
    const shortBps = g(preset && preset.short_bps);
    const longBps = g(preset && preset.long_bps);
    preset_shocks[name] = {
      short_bps: shortBps,
      long_bps: longBps,
      delta_eve: r2(deltaEvePreset(gaps, shortBps, longBps)),
      delta_nii: null,
    };
  }

  const allScenarios = { ...ladder, ...preset_shocks };
  const scenarioKeys = Object.keys(allScenarios);
  let worst_scenario = scenarioKeys[0], worst_delta_eve = allScenarios[scenarioKeys[0]].delta_eve;
  for (const k of scenarioKeys) {
    if (allScenarios[k].delta_eve < worst_delta_eve) { worst_delta_eve = allScenarios[k].delta_eve; worst_scenario = k; }
  }

  compliance_flags.push('RSL_LADDER_CALCULATED');
  if (worst_delta_eve < 0) compliance_flags.push('RSL_WORST_SCENARIO_IS_DECLINE');
  if (presets.length > 0) compliance_flags.push('RSL_NONPARALLEL_PRESETS_DECLARED');

  return {
    output_payload: {
      ladder,
      preset_shocks,
      worst_scenario,
      worst_delta_eve,
      total_net_gap,
      nii_12m_gap: r2(nii12mGap),
      buckets_used: BUCKETS.map((b) => b.key),
      magnitudes_bps: MAGNITUDES_BPS,
      convention: 'US OCC/FDIC parallel rate-shock ladder',
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
