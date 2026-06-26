/**
 * qfa-02-portfolio-var-engine.kernel.mjs
 * Portfolio VaR Engine — LCG + Box-Muller, Monte Carlo VaR/ES.
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'qfa-02-portfolio-var-engine',
  mcp_name:     'compute_portfolio_var',
  mandate_type: 'risk_control',
  version:      '1.0.0',
};

const TOOL_ID      = 'qfa-02-portfolio-var-engine';
const TOOL_VERSION = '1.0.0';

// ── LCG (matches source HTML) ─────────────────────────────────────────────────
function makeLCG(seed) {
  let s = seed;
  return () => {
    s = (1664525 * s + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

// ── Box-Muller (same as source) ───────────────────────────────────────────────
function normalPair(u1, u2) {
  const mag = Math.sqrt(-2 * Math.log(u1 + 1e-10));
  return [mag * Math.cos(2 * Math.PI * u2), mag * Math.sin(2 * Math.PI * u2)];
}

// ── Cholesky decomposition (matches source buildCholesky) ─────────────────────
function buildCholesky(n, rho) {
  // Simple equal-correlation matrix: C[i][j] = rho (i≠j), 1 (i===j)
  const L = [];
  for (let i = 0; i < n; i++) {
    L[i] = new Float64Array(n);
  }
  // L[0][0] = 1
  L[0][0] = 1;
  for (let j = 1; j < n; j++) {
    L[j][0] = rho;
    let sumSq = rho * rho;
    for (let k = 1; k < j; k++) {
      // Off-diagonal L[j][k] for k>0: L[j][k] = (corr[j][k] - sum L[j][m]*L[k][m]) / L[k][k]
      // For equal-correlation matrix corr[j][k]=rho for j≠k
      const corr = (j === k) ? 1 : rho;
      let s = corr;
      for (let m = 0; m < k; m++) s -= L[j][m] * L[k][m];
      L[j][k] = s / L[k][k];
      sumSq += L[j][k] * L[j][k];
    }
    L[j][j] = Math.sqrt(Math.max(0, 1 - sumSq));
  }
  return L;
}

// ── Sector vols (from source SECTOR_VOLS) ────────────────────────────────────
const SECTOR_VOLS = [0.25, 0.20, 0.18, 0.30, 0.15, 0.22, 0.28, 0.16, 0.24, 0.19];

// ── Normal quantile map (from source zMap) ────────────────────────────────────
const Z_MAP = { '0.95': 1.645, '0.99': 2.326, '0.999': 3.090 };

// ── Parametric VaR/ES ────────────────────────────────────────────────────────
function parametricVaR(portVol, hp, confLevel) {
  const z = Z_MAP[String(confLevel)] ?? 2.326;
  const varP = portVol * Math.sqrt(hp / 252) * z;
  // ES ≈ z * phi(z) / (1-alpha) * portVol * sqrt(hp/252) — standard normal ES
  const phi = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  const alpha = 1 - confLevel;
  const esP = portVol * Math.sqrt(hp / 252) * phi / alpha;
  return { varP, esP };
}

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  const n_assets      = Math.min(Math.max(pp.n_assets     ?? 10, 2), SECTOR_VOLS.length);
  const n_paths       = Math.min(Math.max(pp.n_paths      ?? 2000, 100), 10000);
  const holding_period = pp.holding_period ?? 10;      // trading days
  const conf_level    = pp.conf_level      ?? 0.99;
  const correlation   = pp.correlation     ?? 0.30;    // equal pairwise correlation
  const portfolio_value_mm = pp.portfolio_value_mm ?? 100; // $M
  const seed          = pp.seed            ?? (42 + n_assets);

  // Asset weights (equal weight)
  const wt = 1 / n_assets;
  // Asset vols (use first n_assets from SECTOR_VOLS)
  const vols = SECTOR_VOLS.slice(0, n_assets);
  // Portfolio variance (equal-weight, equal-correlation)
  // σ²_p = wt² * sum(σ²_i) + wt² * ρ * sum_{i≠j}(σ_i * σ_j)
  let portVarAnn = 0;
  for (let i = 0; i < n_assets; i++) {
    for (let j = 0; j < n_assets; j++) {
      const corr = (i === j) ? 1 : correlation;
      portVarAnn += wt * wt * vols[i] * vols[j] * corr;
    }
  }
  const portVolAnn = Math.sqrt(portVarAnn);

  // Cholesky for MC
  const L = buildCholesky(n_assets, correlation);

  const rng = makeLCG(seed);
  const pnlArr = new Float64Array(n_paths);

  for (let p = 0; p < n_paths; p++) {
    // Correlated normal draws via Cholesky
    const z_raw = [];
    for (let i = 0; i < n_assets; i++) {
      const [z1, z2] = normalPair(rng(), rng());
      z_raw.push(z1);
      if (i + 1 < n_assets) { z_raw.push(z2); i++; }
    }
    // Apply Cholesky
    const z_corr = new Float64Array(n_assets);
    for (let i = 0; i < n_assets; i++) {
      for (let j = 0; j <= i; j++) {
        z_corr[i] += L[i][j] * (z_raw[j] ?? 0);
      }
    }
    // Portfolio return for holding period
    let ret = 0;
    for (let i = 0; i < n_assets; i++) {
      ret += wt * vols[i] * Math.sqrt(holding_period / 252) * z_corr[i];
    }
    pnlArr[p] = ret;
  }

  pnlArr.sort((a, b) => a - b);

  const alphaIdx = Math.max(0, Math.floor(n_paths * (1 - conf_level)) - 1);
  const mc_var_pct = -pnlArr[alphaIdx];
  const esArr = pnlArr.slice(0, alphaIdx + 1);
  const mc_es_pct  = esArr.length > 0
    ? -esArr.reduce((s, v) => s + v, 0) / esArr.length
    : mc_var_pct;

  const { varP: param_var_pct, esP: param_es_pct } = parametricVaR(portVolAnn, holding_period, conf_level);

  // Historical VaR: approximate via empirical quantile of normal dist samples (same data set)
  const hist_var_pct = mc_var_pct; // in this kernel, MC = historical approximation

  const portfolio_vol_hp = +(portVolAnn * Math.sqrt(holding_period / 252) * 100).toFixed(4);
  const var_dollar_mm    = +(mc_var_pct * portfolio_value_mm).toFixed(4);
  const es_dollar_mm     = +(mc_es_pct  * portfolio_value_mm).toFixed(4);

  const compliance_flags = [];
  if (mc_var_pct > 0.10) compliance_flags.push('HIGH_VAR_BREACH_RISK');
  else compliance_flags.push('VAR_WITHIN_LIMITS');
  if (mc_es_pct > mc_var_pct * 1.5) compliance_flags.push('ELEVATED_TAIL_RISK');

  return {
    verdict:          mc_var_pct > 0.10 ? 'HIGH_RISK' : mc_var_pct > 0.05 ? 'MODERATE_RISK' : 'LOW_RISK',
    mc_var_pct:       +mc_var_pct.toFixed(6),
    mc_es_pct:        +mc_es_pct.toFixed(6),
    param_var_pct:    +param_var_pct.toFixed(6),
    param_es_pct:     +param_es_pct.toFixed(6),
    hist_var_pct:     +hist_var_pct.toFixed(6),
    portfolio_vol_hp,
    var_dollar_mm,
    es_dollar_mm,
    conf_level,
    holding_period,
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
