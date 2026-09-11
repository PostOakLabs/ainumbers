/**
 * art-371-simulate-var-monte-carlo.kernel.mjs
 * Portfolio VaR by Monte Carlo — integer-only PRNG (xoshiro256**), fixed-point
 * arithmetic throughout the path simulation (no float accumulation drift).
 *
 * OCG SPEC.md §24.6.2 (v0.8.8): this kernel declares determinism_class
 * "seeded-stochastic" — a declared integer seed replays byte-identically
 * (seed-replay.test.mjs re-verifies this every CI run), and the same kernel
 * re-run at a tampered seed produces a different hash. determinism_class is
 * hash-excluded metadata per §24.6 and is attached in buildArtifact, not
 * inside output_payload. prng_algorithm, seed, and draw_count remain ordinary
 * receipt content inside output_payload, as §24.6.2 requires.
 *
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'art-371-simulate-var-monte-carlo',
  mcp_name:     'simulate_var_monte_carlo',
  mandate_type: 'risk_control',
  version:      '1.0.0',
};

const TOOL_ID      = 'art-371-simulate-var-monte-carlo';
const TOOL_VERSION = '1.1.1';

const FP        = 1_000_000n;       // fixed-point scale: 1.0 == 1_000_000n
const MASK64    = (1n << 64n) - 1n;
const SECTOR_VOLS_BP = [250000n, 200000n, 180000n, 300000n, 150000n, 220000n, 280000n, 160000n, 240000n, 190000n]; // fixed-point annualized vol, 10 sectors

// ── fixed-point helpers (BigInt only — no float in the hot path) ─────────────
function fpMul(a, b) { return (a * b) / FP; }
function fpDiv(a, b) { return (a * FP) / b; }
function isqrt(n) {
  if (n < 0n) throw new Error('isqrt: negative input');
  if (n < 2n) return n;
  let x0 = n, x1 = (x0 + 1n) >> 1n;
  while (x1 < x0) { x0 = x1; x1 = (x0 + n / x0) >> 1n; }
  return x0;
}
function fpSqrt(a) { return isqrt(a * FP); } // sqrt(a/FP) * FP, integer-exact

// ── splitmix64 (seed expansion) + xoshiro256** (integer-only PRNG) ───────────
function splitmix64(seed) {
  let z = seed & MASK64;
  return function next() {
    z = (z + 0x9E3779B97F4A7C15n) & MASK64;
    let x = z;
    x = ((x ^ (x >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK64;
    x = ((x ^ (x >> 27n)) * 0x94D049BB133111EBn) & MASK64;
    x = x ^ (x >> 31n);
    return x & MASK64;
  };
}
function rotl(x, k) { return ((x << k) | (x >> (64n - k))) & MASK64; }
function makeXoshiro256ss(seed) {
  const sm = splitmix64(BigInt(seed) & MASK64);
  let s0 = sm(), s1 = sm(), s2 = sm(), s3 = sm();
  return function next() {
    const result = (rotl((s1 * 5n) & MASK64, 7n) * 9n) & MASK64;
    const t = (s1 << 17n) & MASK64;
    s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3; s2 ^= t;
    s3 = rotl(s3, 45n);
    return result;
  };
}

// Uniform fixed-point draw in [0, FP) — i.e. value/FP is uniform on [0,1).
function uniformFixed(rng) { return rng() % FP; }

// Irwin-Hall N=12 sum-of-uniforms standard-normal approximation, fully integer:
// sum of 12 uniform(0,1) has mean 6, variance 1 → (sum - 6) approximates N(0,1).
function normalFixed(rng) {
  let sum = 0n;
  for (let i = 0; i < 12; i++) sum += uniformFixed(rng);
  return sum - 6n * FP; // fixed-point N(0,1) draw
}

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  const n_assets       = Math.min(Math.max(Math.trunc(pp.n_assets ?? 10), 2), SECTOR_VOLS_BP.length);
  const n_paths         = Math.min(Math.max(Math.trunc(pp.n_paths ?? 10000), 100), 20000);
  const holding_period   = Math.max(1, Math.trunc(pp.holding_period ?? 10));
  const conf_level       = [0.95, 0.99, 0.999].includes(pp.conf_level) ? pp.conf_level : 0.99;
  const correlation      = Math.min(0.95, Math.max(0, pp.correlation ?? 0.30));
  const portfolio_value_mm = pp.portfolio_value_mm ?? 100;
  const seed             = Math.trunc(pp.seed ?? (42 + n_assets));
  const prng_algorithm    = 'xoshiro256**';
  const draw_count        = n_paths * (n_assets + 1) * 12; // uniform draws consumed (commonZ + n_assets idioZ draws per path, 12 uniforms each)

  const rho_fixed   = BigInt(Math.round(correlation * 1e6));
  const sqrtRho     = fpSqrt(rho_fixed);
  const sqrtOneMinusRho = fpSqrt(FP - rho_fixed);
  const wt_fixed    = FP / BigInt(n_assets);
  const hp_fixed    = fpDiv(BigInt(holding_period) * FP, 252n * FP);
  const hpSqrtFixed = fpSqrt(hp_fixed);

  const rng = makeXoshiro256ss(seed);
  const pnlFixed = new Array(n_paths);

  for (let p = 0; p < n_paths; p++) {
    const commonZ = normalFixed(rng);
    let retFixed = 0n;
    for (let i = 0; i < n_assets; i++) {
      const idioZ = normalFixed(rng);
      const zCorr = fpMul(sqrtRho, commonZ) + fpMul(sqrtOneMinusRho, idioZ);
      const volFixed = SECTOR_VOLS_BP[i];
      retFixed += fpMul(fpMul(wt_fixed, volFixed), fpMul(hpSqrtFixed, zCorr));
    }
    pnlFixed[p] = retFixed;
  }

  pnlFixed.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const alphaIdx = Math.max(0, Math.floor(n_paths * (1 - conf_level)) - 1);
  const mcVarFixed = -pnlFixed[alphaIdx];
  let esSumFixed = 0n;
  for (let i = 0; i <= alphaIdx; i++) esSumFixed += pnlFixed[i];
  const mcEsFixed = alphaIdx >= 0 ? -esSumFixed / BigInt(alphaIdx + 1) : mcVarFixed;

  const toPct = (fixedVal) => Math.round(Number(fixedVal) / Number(FP) * 1e6) / 1e6;
  const mc_var_pct = toPct(mcVarFixed);
  const mc_es_pct  = toPct(mcEsFixed);
  const var_dollar_mm = Math.round(mc_var_pct * portfolio_value_mm * 1e4) / 1e4;
  const es_dollar_mm  = Math.round(mc_es_pct  * portfolio_value_mm * 1e4) / 1e4;

  const compliance_flags = [];
  if (mc_var_pct > 0.10) compliance_flags.push('HIGH_VAR_BREACH_RISK');
  else compliance_flags.push('VAR_WITHIN_LIMITS');
  if (mc_es_pct > mc_var_pct * 1.5) compliance_flags.push('ELEVATED_TAIL_RISK');

  return {
    verdict:       mc_var_pct > 0.10 ? 'HIGH_RISK' : mc_var_pct > 0.05 ? 'MODERATE_RISK' : 'LOW_RISK',
    mc_var_pct,
    mc_es_pct,
    var_dollar_mm,
    es_dollar_mm,
    conf_level,
    holding_period,
    n_assets,
    n_paths,
    correlation,
    prng_algorithm,
    seed,
    draw_count,
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const result = compute(pp);
  const { compliance_flags = [] } = result;
  const output_payload = result;
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    determinism_class: 'seeded-stochastic',
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
