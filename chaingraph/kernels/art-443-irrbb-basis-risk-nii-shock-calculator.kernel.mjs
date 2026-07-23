import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-443-irrbb-basis-risk-nii-shock-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'calculate_basis_risk_nii_shock',
  mandate_type: 'analytics_mandate', gpu: false,
};

// IRRBB basis-risk delta-NII calculator (Comptroller's Handbook, Interest
// Rate Risk booklet, basis-risk component). Distinct from art-369 (Rate
// Shock Ladder Replay): art-369 assumes ONE reference-rate shock moves the
// ENTIRE repricing-gap schedule uniformly (parallel-curve assumption). This
// kernel instead sweeps a SINGLE reference shock across MULTIPLE priced
// indices (Prime, SOFR, Fed Funds, CD portfolio, etc.), each with its own
// caller-declared historical beta vs the reference rate, and isolates the
// incremental delta-NII attributable to those indices NOT moving in lockstep
// -- the basis-risk component art-369's single-curve convention cannot see.
//
// Per index: index_shock_bps = reference_shock_bps * beta_vs_reference
//            net_exposure = asset_balance - liability_balance
//            nii_contribution = net_exposure * index_shock_bps/10000 * (horizon_months/12)
// Comparator (no basis risk, beta=1 for every index):
//            parallel_nii = sum(net_exposure) * reference_shock_bps/10000 * (horizon_months/12)
// basis_risk_delta_nii = sum(nii_contribution) - parallel_nii
// Fixed-point money math (2dp rounding), finite gate, NaN-safe inputs.

function g(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};
  const indices = Array.isArray(pp.index_exposures) ? pp.index_exposures : [];
  const referenceShockBps = g(pp.reference_shock_bps);
  const horizonMonths = pp.horizon_months == null ? 12 : Math.max(0, g(pp.horizon_months));
  const materialThresholdPct = pp.material_threshold_pct == null ? 0.10 : Math.max(0, g(pp.material_threshold_pct));
  const horizonFraction = horizonMonths / 12;
  const compliance_flags = [];

  const index_results = [];
  let sumNetExposure = 0;
  let sumNiiContribution = 0;

  for (const idx of indices) {
    const name = String((idx && idx.index_name) || '').trim() || 'unnamed_index';
    const assetBalance = g(idx && idx.asset_balance);
    const liabilityBalance = g(idx && idx.liability_balance);
    const beta = g(idx && idx.beta_vs_reference);
    const netExposure = r2(assetBalance - liabilityBalance);
    const indexShockBps = r2(referenceShockBps * beta);
    const niiContribution = r2(netExposure * indexShockBps / 10000 * horizonFraction);

    sumNetExposure = r2(sumNetExposure + netExposure);
    sumNiiContribution = r2(sumNiiContribution + niiContribution);

    index_results.push({
      index_name: name, asset_balance: r2(assetBalance), liability_balance: r2(liabilityBalance),
      beta_vs_reference: beta, net_exposure: netExposure, index_shock_bps: indexShockBps,
      nii_contribution: niiContribution,
    });
  }

  const parallelNii = r2(sumNetExposure * referenceShockBps / 10000 * horizonFraction);
  const basisRiskDeltaNii = r2(sumNiiContribution - parallelNii);
  const basisRiskPctOfParallel = parallelNii !== 0 ? r2(basisRiskDeltaNii / Math.abs(parallelNii)) : null;
  const isMaterial = basisRiskPctOfParallel !== null && Math.abs(basisRiskPctOfParallel) > materialThresholdPct;

  compliance_flags.push('BASIS_RISK_NII_CALCULATED');
  if (isMaterial) compliance_flags.push('BASIS_RISK_MATERIAL');
  if (indices.length === 0) compliance_flags.push('BASIS_RISK_NO_INDICES_DECLARED');

  return {
    output_payload: {
      index_results,
      reference_shock_bps: referenceShockBps,
      horizon_months: horizonMonths,
      total_net_exposure: sumNetExposure,
      total_nii_contribution: sumNiiContribution,
      parallel_delta_nii: parallelNii,
      basis_risk_delta_nii: basisRiskDeltaNii,
      basis_risk_pct_of_parallel: basisRiskPctOfParallel,
      material_threshold_pct: materialThresholdPct,
      is_material: isMaterial,
      convention: 'Comptroller\'s Handbook IRR basis-risk delta-NII (per-index beta vs single reference shock)',
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
