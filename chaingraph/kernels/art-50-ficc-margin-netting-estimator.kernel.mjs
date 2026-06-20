/**
 * art-50-ficc-margin-netting-estimator.kernel.mjs
 * Wave 11 — FICC VaR-based margin (VBM) proxy + netting benefit of central clearing.
 * DV01 by tenor bucket → bucketed VaR with cross-bucket correlation → net cleared IM;
 * gross bilateral IM (no offset) → netting benefit; done-away uplift; minimum charge.
 * EDUCATIONAL proxy — NOT the official FICC VBM calculator. Pure kernel.
 * Spec: WORKFLOW-CANDIDATES-WAVE11 §2.3.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-50-ficc-margin-netting-estimator';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'estimate_ficc_margin_netting', mandate_type: 'risk_parameter', gpu: false };

const Z = { 0.90: 1.282, 0.95: 1.645, 0.99: 2.326, 0.999: 3.090 };
const BUCKETS = ['0-2y', '2-5y', '5-10y', '10-30y'];
const DAILY_VOL_BP = { '0-2y': 3, '2-5y': 5, '5-10y': 6, '10-30y': 7 }; // bp/day yield vol
const BUCKET_CORR = 0.80;       // inter-bucket correlation (simplified single rho)
const MIN_CHARGE_RATE = 0.001;  // 0.1% of gross notional floor

function bucketOf(t) { return t <= 2 ? '0-2y' : t <= 5 ? '2-5y' : t <= 10 ? '5-10y' : '10-30y'; }
// Modified-duration approx (good enough for an educational DV01): ~ tenor / (1 + 0.04).
const modDur = (t) => t / 1.04;

export function compute(pp) {
  const {
    positions = [],
    clearing_model = 'cleared-done-away',
    confidence_level = 0.99,
    mpor_days = 1,
    include_cross_product = true,
  } = pp;

  const z = Z[confidence_level] ?? 2.326;
  const sq = Math.sqrt(Math.max(1, Number(mpor_days) || 1));

  // DV01 per position ($ per 1bp). repo/reverse-repo: short-dated rate risk → small bucket.
  let grossNotional = 0;
  const netDV01 = { '0-2y': 0, '2-5y': 0, '5-10y': 0, '10-30y': 0 };
  let grossBilateralIM = 0;
  for (const p of positions) {
    const notional = Number(p.notional) || 0;
    const tenor = Number(p.tenor_years) || (p.instrument === 'repo' || p.instrument === 'reverse-repo' ? 0.1 : 5);
    const sign = (p.direction === 'short' || p.instrument === 'reverse-repo') ? -1 : 1;
    const dv01 = notional * modDur(tenor) * 0.0001; // $ per 1bp
    grossNotional += Math.abs(notional);
    const b = bucketOf(tenor);
    // cross-product netting: when ON, repo offsets (signed) within its bucket; when OFF,
    // repo sits in a separate netting set (approximate by adding its magnitude, no offset).
    const isRepo = p.instrument === 'repo' || p.instrument === 'reverse-repo';
    const offsets = include_cross_product || !isRepo;
    netDV01[b] += offsets ? sign * dv01 : Math.abs(dv01);
    // standalone (bilateral, no offset) VaR for this position
    grossBilateralIM += Math.abs(dv01) * z * DAILY_VOL_BP[b] * sq;
  }

  // Bucketed VaR with correlation.
  const bucketVaR = {};
  for (const b of BUCKETS) bucketVaR[b] = Math.abs(netDV01[b]) * z * DAILY_VOL_BP[b] * sq;
  let varSq = 0;
  for (const a of BUCKETS) for (const c of BUCKETS) varSq += bucketVaR[a] * bucketVaR[c] * (a === c ? 1 : BUCKET_CORR);
  let netClearedIM = Math.sqrt(varSq);

  // Done-away gets an extra cross-counterparty netting uplift.
  const doneAway = clearing_model === 'cleared-done-away';
  const done_away_uplift = doneAway ? 0.10 : 0;
  netClearedIM *= (1 - done_away_uplift);

  // Minimum/special charge floor.
  const minCharge = grossNotional * MIN_CHARGE_RATE;
  const minimum_charge_applied = netClearedIM < minCharge;
  const estimated_vbm = Math.max(netClearedIM, minCharge);

  const netting_benefit_usd = Math.max(0, grossBilateralIM - estimated_vbm);
  const netting_benefit_pct = grossBilateralIM > 0 ? +((netting_benefit_usd / grossBilateralIM) * 100).toFixed(1) : 0;

  const margin_by_bucket = BUCKETS.map((b) => ({ bucket: b, net_dv01: +netDV01[b].toFixed(2), var: Math.round(bucketVaR[b]) }));

  const compliance_flags = ['ESTIMATE_NOT_OFFICIAL_FICC_VBM'];
  if (minimum_charge_applied) compliance_flags.push('MINIMUM_CHARGE_BINDING');
  if (netting_benefit_pct >= 40) compliance_flags.push('LARGE_NETTING_BENEFIT');

  const output_payload = {
    estimated_vbm: Math.round(estimated_vbm),
    gross_bilateral_im: Math.round(grossBilateralIM),
    net_cleared_im: Math.round(estimated_vbm),
    netting_benefit_usd: Math.round(netting_benefit_usd),
    netting_benefit_pct,
    done_away_uplift_pct: +(done_away_uplift * 100).toFixed(1),
    margin_by_bucket,
    minimum_charge_applied,
    assumptions: { confidence_level, mpor_days: Number(mpor_days) || 1, daily_vol_bp: DAILY_VOL_BP, bucket_corr: BUCKET_CORR },
    note: 'Educational VaR-based-margin proxy for FICC-cleared UST/repo. Not the official FICC VBM; for indicative netting economics only.',
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', ap2_version: '1.0.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
