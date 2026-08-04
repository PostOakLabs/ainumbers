import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-539-asset-liability-coverage';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_asset_liability_coverage',
  mandate_type: 'compliance_control', gpu: false,
};

// Asset/liability coverage (art-539): total_assets_musd / total_liabilities_musd, plus
// surplus_shortfall_musd = total_assets_musd - total_liabilities_musd, per
// EXCHANGE-ASSURANCE-BUILD-SPEC.md SS2.2 -- a general solvency-shape computation. No single
// normative anchor exists for exchange-level asset/liability coverage (unlike bank
// capital-adequacy ratios, which already have dedicated nodes elsewhere in the suite); this
// node states that explicitly rather than inventing a crosswalk citation.
//
// Aggregate totals only, by design (spec SS2.2/SS2.6) -- no per-customer or per-wallet line
// item, so SPEC.md SS25 (private inputs) does not apply.
//
// total_liabilities_musd resolving to 0 is NOT a division-by-zero to guard defensively -- it
// is the declared edge case: status NO_LIABILITIES_OUTSTANDING, coverage_ratio null, never a
// division artifact (never NaN/Infinity, never a computed 0 or Infinity ratio).
//
// Pure ECMA-262 arithmetic only -- no Date.now/argless new Date(), no Math.random.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r4(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 10000) / 10000; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }
function s(v) { return String(v == null ? '' : v).trim(); }

function coverageRatio(assets, liabilities) {
  if (liabilities === 0) return null;
  return assets / liabilities;
}

function statusFor(ratio) {
  if (ratio === null) return 'NO_LIABILITIES_OUTSTANDING';
  return ratio >= 1.0 ? 'COVERED' : 'SHORTFALL';
}

export function compute(pp) {
  pp = pp || {};

  const assetsIn = arr(pp.assets).map((a) => ({
    asset_class: s(a && a.asset_class) || 'unclassified',
    amount_musd: Math.max(0, safeNum(a && a.amount_musd, 0)),
  }));
  const liabilitiesIn = arr(pp.liabilities).map((l) => ({
    liability_class: s(l && l.liability_class) || 'unclassified',
    amount_musd: Math.max(0, safeNum(l && l.amount_musd, 0)),
  }));

  const assetsByClass = new Map();
  for (const a of assetsIn) {
    assetsByClass.set(a.asset_class, (assetsByClass.get(a.asset_class) || 0) + a.amount_musd);
  }
  const liabilitiesByClass = new Map();
  for (const l of liabilitiesIn) {
    liabilitiesByClass.set(l.liability_class, (liabilitiesByClass.get(l.liability_class) || 0) + l.amount_musd);
  }

  const asset_breakdown = Array.from(assetsByClass.keys()).sort().map((asset_class) => ({
    asset_class,
    amount_musd: r2(assetsByClass.get(asset_class) || 0),
  }));
  const liability_breakdown = Array.from(liabilitiesByClass.keys()).sort().map((liability_class) => ({
    liability_class,
    amount_musd: r2(liabilitiesByClass.get(liability_class) || 0),
  }));

  const total_assets_musd = r2(assetsIn.reduce((sum, a) => sum + a.amount_musd, 0));
  const total_liabilities_musd = r2(liabilitiesIn.reduce((sum, l) => sum + l.amount_musd, 0));
  const ratio = coverageRatio(total_assets_musd, total_liabilities_musd);
  const status = statusFor(ratio);
  const surplus_shortfall_musd = r2(total_assets_musd - total_liabilities_musd);

  const compliance_flags = [`OVERALL_${status}`];

  const output_payload = {
    asset_breakdown,
    liability_breakdown,
    total_assets_musd,
    total_liabilities_musd,
    coverage_ratio: r4(ratio),
    surplus_shortfall_musd,
    status,
    formula: 'coverage_ratio = total_assets_musd / total_liabilities_musd; surplus_shortfall_musd = total_assets_musd - total_liabilities_musd',
    note: 'General solvency-shape computation over caller-supplied aggregate totals only (no per-customer or per-wallet line item, no single normative regime anchor). Attests the computation over the inputs supplied, not an audit of their source or a determination of regulatory compliance.',
  };

  return { output_payload, compliance_flags };
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
