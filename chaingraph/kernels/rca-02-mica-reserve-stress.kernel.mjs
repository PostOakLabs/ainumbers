/**
 * rca-02-mica-reserve-stress.kernel.mjs
 * MiCA Reserve Stress Simulator — LCG + Box-Muller (replaces unseeded Math.random()).
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'rca-02-mica-reserve-stress',
  mcp_name:     'simulate_stablecoin_reserve',
  mandate_type: 'liquidity_mandate',
  version:      '1.0.0',
};

const TOOL_ID      = 'rca-02-mica-reserve-stress';
const TOOL_VERSION = '1.0.0';

// ── LCG ──────────────────────────────────────────────────────────────────────
function makeLCG(seed) {
  let s = seed;
  return () => {
    s = (1664525 * s + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

// ── Box-Muller (seeded, replaces source randn() that used Math.random()) ─────
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

// ── Shock parameters (from source SHOCK_PARAMS) ───────────────────────────────
const SHOCK_PARAMS = {
  mild:     { sigma: 0.008, peakDrop: 0.08, firesaleBase: 0.10 },
  moderate: { sigma: 0.015, peakDrop: 0.18, firesaleBase: 0.20 },
  severe:   { sigma: 0.025, peakDrop: 0.35, firesaleBase: 0.40 },
};

// ── Redemption curve: fraction redeemed per day over T days ──────────────────
function buildRedemptionCurve(scenario, T, randn) {
  const sp = SHOCK_PARAMS[scenario];
  const curve = [];
  // Peak outflow at day 5, exponential decay
  for (let d = 0; d < T; d++) {
    const peakDay = 5;
    const base = sp.peakDrop * Math.exp(-Math.abs(d - peakDay) * 0.3);
    const noise = randn() * sp.sigma;
    curve.push(Math.max(0, base + noise));
  }
  return curve;
}

// ── Shock scalar: asset value haircut path ────────────────────────────────────
function buildShockScalar(scenario, T, randn) {
  const sp = SHOCK_PARAMS[scenario];
  const scalars = [1.0];
  for (let d = 1; d < T; d++) {
    // Reversion to 1.0 after peak
    const prev  = scalars[d - 1];
    const shock = randn() * sp.sigma;
    const revert = (1.0 - prev) * 0.05; // gentle mean reversion
    scalars.push(Math.max(0.50, prev + shock + revert));
  }
  return scalars;
}

// ── Percentile ────────────────────────────────────────────────────────────────
function pctile(sorted, p) {
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * sorted.length)));
  return sorted[idx];
}

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  const scenario           = pp.scenario           ?? 'moderate';
  const n_paths            = Math.min(Math.max(pp.n_paths ?? 500, 50), 2000);
  const T                  = pp.horizon_days        ?? 30;
  const reserve_ratio_init = pp.reserve_ratio_init  ?? 1.05;  // initial reserve / supply
  const art36_buffer       = pp.art36_buffer        ?? 0.02;  // MiCA Art.36 mandatory buffer (2%)
  const seed               = pp.seed                ?? 42;

  const sp  = SHOCK_PARAMS[scenario] ?? SHOCK_PARAMS.moderate;
  const rng    = makeLCG(seed);
  const randn  = makeRandn(rng);

  // Run MC paths
  const coverageAtEnd = new Float64Array(n_paths);
  const breachCounts  = new Uint32Array(n_paths); // days below 100% coverage per path
  const peakBreaches  = new Float64Array(n_paths); // worst coverage ratio per path

  for (let p = 0; p < n_paths; p++) {
    const redemptionCurve = buildRedemptionCurve(scenario, T, randn);
    const shockScalars    = buildShockScalar(scenario, T, randn);

    let supply        = 1.0;            // normalised
    let reserveValue  = reserve_ratio_init;  // £ of reserves per £ supply
    let breachDays    = 0;
    let peakCoverage  = reserve_ratio_init;
    let minCoverage   = reserve_ratio_init;

    for (let d = 0; d < T; d++) {
      // Redemptions reduce supply
      const redeemed   = supply * redemptionCurve[d];
      const firesale   = redeemed * sp.firesaleBase * shockScalars[d];
      supply           = Math.max(0, supply - redeemed);
      reserveValue     = Math.max(0, reserveValue - redeemed - firesale) * shockScalars[d];

      const coverage   = supply > 0 ? reserveValue / supply : (reserveValue > 0 ? 999 : 0);
      if (coverage < 1.0 && supply > 0) breachDays++;
      if (coverage < minCoverage) minCoverage = coverage;
    }

    coverageAtEnd[p] = supply > 0 ? reserveValue / supply : (reserveValue > 0 ? 999 : 0);
    breachCounts[p]  = breachDays;
    peakBreaches[p]  = minCoverage;
  }

  const sortedCoverage    = [...coverageAtEnd].sort((a, b) => a - b);
  const sortedPeak        = [...peakBreaches].sort((a, b) => a - b);

  const coverage_p50_end_day = +pctile(sortedCoverage, 0.50).toFixed(4);
  const coverage_p5_end_day  = +pctile(sortedCoverage, 0.05).toFixed(4);
  const breach_probability_pct = +(coverageAtEnd.filter(v => v < 1.0).length / n_paths * 100).toFixed(2);
  const peak_breach_pct       = +(peakBreaches.filter(v => v < 1.0).length / n_paths * 100).toFixed(2);

  // MiCA Art.36: reserves must cover 100% + art36_buffer at P95
  const art36_coverage_p95    = +pctile(sortedCoverage, 0.95).toFixed(4);
  const art36_buffer_adequate_pct = +((art36_coverage_p95 >= 1.0 + art36_buffer ? 100 : 0)).toFixed(2);

  const compliance_flags = [];
  if (breach_probability_pct < 5)  compliance_flags.push('MICA_ART36_RESERVE_ADEQUATE');
  else if (breach_probability_pct < 20) compliance_flags.push('MICA_ART36_RESERVE_AT_RISK');
  else compliance_flags.push('MICA_ART36_RESERVE_BREACH_LIKELY');
  if (art36_buffer_adequate_pct >= 100) compliance_flags.push('MICA_ART36_BUFFER_SUFFICIENT');
  else compliance_flags.push('MICA_ART36_BUFFER_INSUFFICIENT');

  return {
    verdict:               breach_probability_pct < 5 ? 'ADEQUATE' : breach_probability_pct < 20 ? 'AT_RISK' : 'BREACH_LIKELY',
    coverage_p50_end_day,
    coverage_p5_end_day,
    breach_probability_pct,
    peak_breach_pct,
    art36_buffer_adequate_pct,
    scenario,
    n_paths,
    horizon_days:          T,
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
