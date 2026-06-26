/**
 * sim-01-lcr-nsfr-liquidity-stress-test.kernel.mjs
 * LCR/NSFR Liquidity Stress Test — LCG + Box-Muller (replaces unseeded Math.random()).
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'sim-01-lcr-nsfr-liquidity-stress-test',
  mcp_name:     'run_liquidity_stress_test',
  mandate_type: 'liquidity_mandate',
  version:      '1.0.0',
};

const TOOL_ID      = 'sim-01-lcr-nsfr-liquidity-stress-test';
const TOOL_VERSION = '1.0.0';

// ── LCG ──────────────────────────────────────────────────────────────────────
function makeLCG(seed) {
  let s = seed;
  return () => {
    s = (1664525 * s + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

// ── Box-Muller (seeded, replaces source Math.random() randn) ─────────────────
function makeRandn(rng) {
  let spare = null;
  return () => {
    if (spare !== null) { const v = spare; spare = null; return v; }
    let u, v, s;
    do {
      u = rng() * 2 - 1;
      v = rng() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt(-2 * Math.log(s) / s);
    spare = v * mul;
    return u * mul;
  };
}

// ── Presets ───────────────────────────────────────────────────────────────────
const PRESETS = {
  retail_bank: {
    hqla_l1: 20, hqla_l2a: 5, hqla_l2b: 2,
    retail_outflow: 5, wholesale_outflow: 15, secured_outflow: 10,
    inflows: 30,
    asf_cap: 80, rsf_loans: 50, rsf_securities: 20, rsf_other: 15,
    scenario: 'moderate',
  },
  investment_bank: {
    hqla_l1: 40, hqla_l2a: 15, hqla_l2b: 5,
    retail_outflow: 2, wholesale_outflow: 35, secured_outflow: 25,
    inflows: 50,
    asf_cap: 60, rsf_loans: 30, rsf_securities: 40, rsf_other: 20,
    scenario: 'severe',
  },
  universal_bank: {
    hqla_l1: 30, hqla_l2a: 10, hqla_l2b: 3,
    retail_outflow: 8, wholesale_outflow: 20, secured_outflow: 12,
    inflows: 35,
    asf_cap: 75, rsf_loans: 45, rsf_securities: 25, rsf_other: 18,
    scenario: 'moderate',
  },
};

// ── Scenario multipliers ──────────────────────────────────────────────────────
const SCENARIO_MULT = {
  mild:     { outflow_mult: 0.8, inflow_mult: 1.1, vol_lcr: 0.02, vol_nsfr: 0.015 },
  moderate: { outflow_mult: 1.0, inflow_mult: 1.0, vol_lcr: 0.05, vol_nsfr: 0.030 },
  severe:   { outflow_mult: 1.3, inflow_mult: 0.7, vol_lcr: 0.10, vol_nsfr: 0.060 },
};

// ── Percentile ────────────────────────────────────────────────────────────────
function percentileAt(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * sorted.length)));
  return sorted[idx];
}

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  const preset    = pp.preset ? PRESETS[pp.preset] : null;
  const scenario  = pp.scenario ?? preset?.scenario ?? 'moderate';
  const n_paths   = Math.min(Math.max(pp.n_paths ?? 500, 50), 2000);
  const seed      = pp.seed ?? 42;

  // Bank parameters
  const hqla_l1          = pp.hqla_l1          ?? preset?.hqla_l1          ?? 20;   // £bn
  const hqla_l2a         = pp.hqla_l2a         ?? preset?.hqla_l2a         ?? 5;
  const hqla_l2b         = pp.hqla_l2b         ?? preset?.hqla_l2b         ?? 2;
  const retail_outflow   = pp.retail_outflow    ?? preset?.retail_outflow   ?? 5;    // % of retail deposits
  const wholesale_outflow = pp.wholesale_outflow ?? preset?.wholesale_outflow ?? 15;
  const secured_outflow  = pp.secured_outflow   ?? preset?.secured_outflow  ?? 10;
  const inflows          = pp.inflows           ?? preset?.inflows          ?? 30;   // £bn
  const asf_cap          = pp.asf_cap           ?? preset?.asf_cap          ?? 80;   // £bn available stable funding
  const rsf_loans        = pp.rsf_loans         ?? preset?.rsf_loans        ?? 50;   // £bn required stable funding
  const rsf_securities   = pp.rsf_securities    ?? preset?.rsf_securities   ?? 20;
  const rsf_other        = pp.rsf_other         ?? preset?.rsf_other        ?? 15;

  const sm = SCENARIO_MULT[scenario] ?? SCENARIO_MULT.moderate;
  const T_LCR  = 30;   // LCR 30-day horizon
  const T_NSFR = 250;  // NSFR ~1y horizon (250 trading days)

  const rng   = makeLCG(seed);
  const randn = makeRandn(rng);

  // LCR: HQLA / Net outflows over 30 days
  // HQLA (L1 + 85%×L2A + 75%×L2B)
  const hqla_base = hqla_l1 + 0.85 * hqla_l2a + 0.75 * hqla_l2b;
  const net_outflow_base = (retail_outflow + wholesale_outflow + secured_outflow) * sm.outflow_mult
                         - inflows * sm.inflow_mult;

  const lcrPaths  = new Float64Array(n_paths);
  const nsfrPaths = new Float64Array(n_paths);
  const rsf_base  = rsf_loans + rsf_securities + rsf_other;

  for (let i = 0; i < n_paths; i++) {
    // LCR path: daily random shocks over 30 days
    let hqla_t = hqla_base;
    let outflow_t = net_outflow_base;
    for (let d = 0; d < T_LCR; d++) {
      hqla_t    *= (1 + randn() * sm.vol_lcr * 0.1);
      outflow_t *= (1 + randn() * sm.vol_lcr * 0.2);
    }
    lcrPaths[i] = Math.max(0, hqla_t) / Math.max(0.01, outflow_t);

    // NSFR path: ASF / RSF with cumulative drift over 250 days
    let asf_t = asf_cap;
    let rsf_t = rsf_base;
    for (let d = 0; d < T_NSFR; d++) {
      asf_t *= (1 + randn() * sm.vol_nsfr * 0.05);
      rsf_t *= (1 + randn() * sm.vol_nsfr * 0.03);
    }
    nsfrPaths[i] = Math.max(0, asf_t) / Math.max(0.01, rsf_t);
  }

  const lcr_median_day30  = +percentileAt(lcrPaths,  0.50).toFixed(4);
  const nsfr_median_day250 = +percentileAt(nsfrPaths, 0.50).toFixed(4);
  const lcr_p5            = +percentileAt(lcrPaths,  0.05).toFixed(4);
  const nsfr_p5           = +percentileAt(nsfrPaths, 0.05).toFixed(4);

  // Regulatory minima: LCR ≥ 100%, NSFR ≥ 100%
  const lcr_breach_pct  = +(lcrPaths.filter(v  => v < 1.0).length / n_paths * 100).toFixed(2);
  const nsfr_breach_pct = +(nsfrPaths.filter(v => v < 1.0).length / n_paths * 100).toFixed(2);

  const compliance_flags = [];
  if (lcr_median_day30 >= 1.0)  compliance_flags.push('LCR_COMPLIANT_MEDIAN');
  else compliance_flags.push('LCR_BREACH_RISK_MEDIAN');
  if (nsfr_median_day250 >= 1.0) compliance_flags.push('NSFR_COMPLIANT_MEDIAN');
  else compliance_flags.push('NSFR_BREACH_RISK_MEDIAN');
  if (lcr_breach_pct > 20)  compliance_flags.push('LCR_HIGH_BREACH_PROBABILITY');
  if (nsfr_breach_pct > 20) compliance_flags.push('NSFR_HIGH_BREACH_PROBABILITY');

  const verdict = (lcr_median_day30 >= 1.0 && nsfr_median_day250 >= 1.0)
    ? 'COMPLIANT'
    : (lcr_median_day30 >= 0.90 || nsfr_median_day250 >= 0.90)
    ? 'BORDERLINE'
    : 'BREACH_RISK';

  return {
    verdict,
    lcr_median_day30,
    nsfr_median_day250,
    lcr_p5,
    nsfr_p5,
    lcr_breach_pct,
    nsfr_breach_pct,
    scenario,
    n_paths,
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const result = compute(pp);
  const { compliance_flags = {} } = result;
  const output_payload = result;
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
