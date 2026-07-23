import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-444-collateral-haircut-engine';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_basel_haircut_adjusted_exposure',
  mandate_type: 'regulatory_reporting', gpu: false,
};

// Basel CRE22 comprehensive-approach collateral haircut engine per BANKING-OCG-BUILD-SPEC.md §5.3.
// Deterministic haircut application ONLY -- no allocation/optimization solver (spec: "optimization
// solver OUT"; a multi-item collateral-to-exposure ALLOCATION optimizer is a separate, unbuilt tool).
// Steps: (1) each collateral item's base supervisory haircut (Hc) and any FX-mismatch haircut (Hfx)
// come from a caller-supplied, versioned haircut table (policy input, not hardcoded -- matches the
// art-427/art-437 versioned-table pattern; CRE22.68's standard 10-business-day holding period table
// is the seed default in fixtures, cited, never baked into the kernel); (2) haircuts scale for a
// non-standard holding period via CRE22.68's square-root-of-time rule H = H_table * sqrt(NR/10)
// (Math.sqrt is IEEE754 correctly-rounded, cross-engine bit-exact -- no _detmath needed, unlike
// sin/cos/exp/log); (3) an explicit per-item haircut_override_pct (with mandatory
// override_reason_code) can replace the table-derived Hc -- an override lacking a reason_code is
// flagged deficient, the item-level basis for a separate §27 human_accountability_record (this
// kernel does not mint that record); (4) an unmatched asset_class/maturity_bucket falls back to a
// conservative 100% haircut (zero collateral value) and is flagged, never silently valued; (5) net
// exposure E* = max(0, E*(1+He_scaled) - sum(C_i*(1-Hc_i_scaled-Hfx_i_scaled))), CRE22.68 formula,
// clamped so no single item's combined haircut exceeds 100%.
//
// Pure ECMA-262 arithmetic only -- no Date.now/new Date(), no Math.random. Dollar figures rounded
// to 2 decimals (r2) only at declared output boundaries. No filing claim: evidence artifact only,
// never a capital-return submission (SPEC §0 "no filing claims").

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }
function str(v, def) { return (typeof v === 'string' && v) ? v : def; }
function clampPct(v) { return Math.max(0, Math.min(100, v)); }

function lookupHaircut(table, assetClass, maturityBucket) {
  for (const row of table) {
    if (row.asset_class === assetClass && (row.maturity_bucket === maturityBucket || !row.maturity_bucket)) {
      return row.haircut_pct;
    }
  }
  return null;
}

function timeScale(holdingPeriodDays) {
  const nr = holdingPeriodDays > 0 ? holdingPeriodDays : 10;
  return Math.sqrt(nr / 10);
}

function classifyItems(items, table, fxHaircutPct, minFloorPct, exposureCurrency, scale) {
  let overrideMissingReason = 0;
  let overrideCount = 0;
  let unclassifiedCount = 0;

  const classified = arr(items).map((item, idx) => {
    const itemId = str(item && item.item_id, 'item-' + idx);
    const assetClass = str(item && item.asset_class, 'unclassified');
    const maturityBucket = str(item && item.maturity_bucket, null);
    const marketValue = Math.max(0, safeNum(item && item.market_value, 0));
    const currency = str(item && item.currency, exposureCurrency);

    let hcTable = lookupHaircut(table, assetClass, maturityBucket);
    let unclassified = false;
    if (hcTable === null) { hcTable = 100; unclassified = true; unclassifiedCount += 1; }

    let hc = hcTable;
    let overridden = false;
    let overrideReasonCode = null;
    if (item && item.haircut_override_pct !== undefined && item.haircut_override_pct !== null) {
      overridden = true;
      overrideCount += 1;
      hc = clampPct(safeNum(item.haircut_override_pct, hcTable));
      overrideReasonCode = str(item.override_reason_code, null);
      if (!overrideReasonCode) overrideMissingReason += 1;
    }

    const hcScaled = clampPct(hc * scale);
    const currencyMismatch = currency !== exposureCurrency;
    const hfxScaled = currencyMismatch ? clampPct(fxHaircutPct * scale) : 0;
    const combinedHaircutPct = clampPct(hfxScaled + hcScaled);
    const effectiveFloorPct = Math.max(combinedHaircutPct, clampPct(minFloorPct));
    const adjustedValue = r2(marketValue * (1 - effectiveFloorPct / 100));

    return {
      item_id: itemId,
      asset_class: assetClass,
      maturity_bucket: maturityBucket,
      market_value: r2(marketValue),
      currency,
      table_haircut_pct: r2(hcTable),
      haircut_pct: r2(hc),
      haircut_scaled_pct: r2(hcScaled),
      fx_haircut_scaled_pct: r2(hfxScaled),
      combined_haircut_pct: r2(effectiveFloorPct),
      adjusted_value: adjustedValue,
      currency_mismatch: currencyMismatch,
      unclassified,
      override_applied: overridden,
      override_reason_code: overrideReasonCode,
    };
  });

  return { classified, overrideCount, overrideMissingReason, unclassifiedCount };
}

export function compute(pp) {
  pp = pp || {};

  const haircutTableVersion = str(pp.haircut_table_version, null);
  const table = arr(pp.haircut_table);
  const fxHaircutPct = Math.max(0, safeNum(pp.fx_haircut_pct, 8));
  const minFloorPct = Math.max(0, safeNum(pp.min_haircut_floor_pct, 0));
  const holdingPeriodDays = Math.max(0, safeNum(pp.holding_period_days, 10));
  const scale = timeScale(holdingPeriodDays);

  const exposure = pp.exposure || {};
  const exposureAmount = Math.max(0, safeNum(exposure.amount, 0));
  const exposureCurrency = str(exposure.currency, 'USD');
  const exposureAssetClass = str(exposure.asset_class, 'cash');
  const exposureMaturityBucket = str(exposure.maturity_bucket, null);
  const exposureIsCash = exposureAssetClass === 'cash';

  let heTable = exposureIsCash ? 0 : lookupHaircut(table, exposureAssetClass, exposureMaturityBucket);
  let exposureUnclassified = false;
  if (heTable === null) { heTable = exposureIsCash ? 0 : 100; exposureUnclassified = !exposureIsCash; }
  const heScaled = clampPct(heTable * scale);

  const { classified, overrideCount, overrideMissingReason, unclassifiedCount } =
    classifyItems(pp.collateral_items, table, fxHaircutPct, minFloorPct, exposureCurrency, scale);

  const collateralAdjustedTotal = r2(classified.reduce((s, i) => s + i.adjusted_value, 0));
  const exposureAdjusted = r2(exposureAmount * (1 + heScaled / 100));
  const netExposure = r2(Math.max(0, exposureAdjusted - collateralAdjustedTotal));

  const compliance_flags = [];
  if (overrideMissingReason > 0) compliance_flags.push('CRE22_OVERRIDE_MISSING_REASON_CODE');
  else compliance_flags.push('CRE22_HAIRCUT_APPLIED');
  if (unclassifiedCount > 0 || exposureUnclassified) compliance_flags.push('CRE22_UNCLASSIFIED_ASSET_CLASS');
  if (netExposure > 0) compliance_flags.push('CRE22_NET_EXPOSURE_UNCOLLATERALIZED');

  const output_payload = {
    haircut_table_version: haircutTableVersion,
    holding_period_days: holdingPeriodDays,
    time_scale_factor: r2(scale),
    exposure_amount: r2(exposureAmount),
    exposure_currency: exposureCurrency,
    exposure_asset_class: exposureAssetClass,
    exposure_haircut_scaled_pct: r2(heScaled),
    exposure_adjusted: exposureAdjusted,
    item_count: classified.length,
    override_count: overrideCount,
    override_missing_reason_count: overrideMissingReason,
    unclassified_count: unclassifiedCount + (exposureUnclassified ? 1 : 0),
    collateral_items: classified,
    collateral_adjusted_total: collateralAdjustedTotal,
    net_exposure: netExposure,
    note: 'Basel CRE22 comprehensive-approach standardized supervisory haircuts (versioned table = policy input), scaled to the supplied holding period via the square-root-of-time rule. An overridden item haircut without a reason_code is flagged and is the item-level basis for a separate signed §27 human_accountability_record (this kernel does not mint that record). An unmatched asset_class/maturity_bucket defaults to a conservative 100% haircut, flagged, never silently valued. No allocation/optimization across collateral items -- deterministic per-item haircut application and summation only. Evidence artifact only -- not a capital-return filing, never regulator-submittable.',
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
