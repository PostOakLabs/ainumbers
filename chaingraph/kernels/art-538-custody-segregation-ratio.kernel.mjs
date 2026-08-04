import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-538-custody-segregation-ratio';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_custody_segregation_ratio',
  mandate_type: 'compliance_control', gpu: false,
};

// Custody-segregation ratio (art-538): segregated_custody_assets_musd / customer_claims_musd,
// per EXCHANGE-ASSURANCE-BUILD-SPEC.md SS2.1 -- a generic, jurisdiction-neutral segregation
// check, not a bespoke regime filing. SEC Rule 15c3-3 possession-or-control (17 CFR
// 240.15c3-3(b)) is one crosswalk-annex instance among possibly several (spec SS0); the
// arithmetic below does not depend on that citation and art-396 (the Exhibit A reserve
// formula) is a distinct, unedited node.
//
// Aggregate totals only, by design (spec SS2.1/SS2.6) -- no per-customer or per-wallet line
// item, so SPEC.md SS25 (private inputs) does not apply.
//
// customer_claims_musd resolving to 0 is NOT a division-by-zero to guard defensively -- it is
// the declared edge case: status NO_CLAIMS_OUTSTANDING, segregation_ratio null, never a
// division artifact (never NaN/Infinity, never a computed 0 or Infinity ratio).
//
// Pure ECMA-262 arithmetic only -- no Date.now/argless new Date(), no Math.random.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r4(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 10000) / 10000; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }
function s(v) { return String(v == null ? '' : v).trim(); }

function lineRatio(segregated, claims) {
  if (claims === 0) return null;
  return segregated / claims;
}

function statusFor(ratio, ceiling) {
  if (ratio === null) return 'NO_CLAIMS_OUTSTANDING';
  if (ratio < 1.0) return 'UNDER_SEGREGATED';
  if (Number.isFinite(ceiling) && ratio > ceiling) return 'OVER_SEGREGATED';
  return 'FULLY_SEGREGATED';
}

export function compute(pp) {
  pp = pp || {};
  const ceiling = (pp.over_segregation_ceiling != null && Number.isFinite(Number(pp.over_segregation_ceiling)))
    ? Number(pp.over_segregation_ceiling) : null;

  const segregatedIn = arr(pp.segregated_assets).map((a) => ({
    asset_class: s(a && a.asset_class) || 'unclassified',
    custody_location_type: s(a && a.custody_location_type) || 'unspecified',
    amount_musd: Math.max(0, safeNum(a && a.amount_musd, 0)),
  }));
  const claimsIn = arr(pp.customer_claims).map((c) => ({
    asset_class: s(c && c.asset_class) || 'unclassified',
    amount_musd: Math.max(0, safeNum(c && c.amount_musd, 0)),
  }));

  // Roll up segregated assets by asset_class (a class may have multiple custody locations).
  const segByClass = new Map();
  for (const a of segregatedIn) {
    segByClass.set(a.asset_class, (segByClass.get(a.asset_class) || 0) + a.amount_musd);
  }
  const claimsByClass = new Map();
  for (const c of claimsIn) {
    claimsByClass.set(c.asset_class, (claimsByClass.get(c.asset_class) || 0) + c.amount_musd);
  }

  const allClasses = Array.from(new Set([...segByClass.keys(), ...claimsByClass.keys()])).sort();
  const line_items = allClasses.map((asset_class) => {
    const segregated_custody_assets_musd = r2(segByClass.get(asset_class) || 0);
    const customer_claims_musd = r2(claimsByClass.get(asset_class) || 0);
    const ratio = lineRatio(segregated_custody_assets_musd, customer_claims_musd);
    return {
      asset_class,
      segregated_custody_assets_musd,
      customer_claims_musd,
      segregation_ratio: r4(ratio),
      status: statusFor(ratio, ceiling),
    };
  });

  const total_segregated_musd = r2(segregatedIn.reduce((sum, a) => sum + a.amount_musd, 0));
  const total_claims_musd = r2(claimsIn.reduce((sum, c) => sum + c.amount_musd, 0));
  const overall_ratio = lineRatio(total_segregated_musd, total_claims_musd);
  const overall_status = statusFor(overall_ratio, ceiling);

  const compliance_flags = [`OVERALL_${overall_status}`];
  if (line_items.some((l) => l.status === 'UNDER_SEGREGATED')) compliance_flags.push('LINE_ITEM_UNDER_SEGREGATED_PRESENT');
  if (line_items.some((l) => l.status === 'OVER_SEGREGATED')) compliance_flags.push('LINE_ITEM_OVER_SEGREGATED_PRESENT');
  if (line_items.some((l) => l.status === 'NO_CLAIMS_OUTSTANDING')) compliance_flags.push('LINE_ITEM_NO_CLAIMS_OUTSTANDING_PRESENT');

  const custody_location_breakdown = {};
  for (const a of segregatedIn) {
    custody_location_breakdown[a.custody_location_type] = r2((custody_location_breakdown[a.custody_location_type] || 0) + a.amount_musd);
  }

  const output_payload = {
    line_items,
    total_segregated_musd,
    total_claims_musd,
    segregation_ratio: r4(overall_ratio),
    status: overall_status,
    over_segregation_ceiling: ceiling,
    custody_location_breakdown,
    formula: 'segregation_ratio = segregated_custody_assets_musd / customer_claims_musd',
    note: 'Generic, jurisdiction-neutral segregation check over caller-supplied aggregate totals only (no per-customer or per-wallet line item). Attests the computation over the inputs supplied, not an audit of their source or a determination of regulatory compliance.',
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
