import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-433-call-report-rcr-capital';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'map_call_report_schedule_rcr',
  mandate_type: 'regulatory_reporting', gpu: false,
};

// FFIEC Call Report (FFIEC 031) Schedule RC-R -- Regulatory Capital --
// mapping and ratio-calculation kernel, per BANKING-OCG-BUILD-SPEC.md §4.1.
// Given caller-supplied CET1/Tier1/Tier2 capital components and risk-weighted
// assets, computes the standard capital ratios plus the supplementary
// leverage ratio (SLR), including the enhanced-SLR (eSLR) buffer that became
// final and effective 2026-04-01 (§0.2). Capital component labels
// (tier1_capital_usd, tier2_capital_usd) mirror the FDIC BankFind Suite
// mnemonics RBCT1J/RBCT2/RWAJT, which the FDIC itself sources directly from
// filed Call Report Schedule RC-R submissions -- used here (rather than a
// specific MDRM code) because RC-R's own MDRM prefix varies by approach
// (advanced vs standardized) and reporting vintage; RC's total-asset/equity
// MDRM codes (RCON2170/RCON2948/RCON3210, art-432) are unambiguous across
// vintages and used there instead. BOUNDARY: capital component and RWA
// VALUES are caller-declared; this kernel performs only ratio arithmetic and
// threshold comparison against caller-declared (versioned) minimums -- it
// does not calculate risk weights or classify exposures. Pure ECMA-262
// arithmetic only -- no Math.pow, no Date.now/new Date(), no Math.random,
// no Intl/toLocaleString.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1000000) / 1000000 : 0; }
function pct(numerator, denominator) { return denominator > 0 ? r6(numerator / denominator) : 0; }

export function compute(pp) {
  pp = pp || {};
  const entityId = String(pp.entity_id || '').trim();
  const reportingPeriod = String(pp.reporting_period || '').trim();
  const constantsVersion = String(pp.constants_version || '').trim();
  const isGsib = !!pp.is_gsib;

  const cet1CapitalUsd = safeNum(pp.cet1_capital_usd, 0);
  const additionalTier1Usd = safeNum(pp.additional_tier1_capital_usd, 0);
  const tier1CapitalUsd = safeNum(pp.tier1_capital_usd, cet1CapitalUsd + additionalTier1Usd);
  const tier2CapitalUsd = safeNum(pp.tier2_capital_usd, 0);
  const totalCapitalUsd = r2(tier1CapitalUsd + tier2CapitalUsd);
  const totalRwaUsd = safeNum(pp.total_rwa_usd, 0);
  const totalLeverageExposureUsd = safeNum(pp.total_leverage_exposure_usd, 0);

  // 2026 minimum thresholds (Basel III standardized, unchanged by the eSLR
  // final rule itself, which recalibrates the eSLR BUFFER for GSIBs -- see
  // eslr_buffer_pct below). Caller may override via *_min_pct fields; this
  // kernel never hardcodes a "current" minimum beyond the well-established
  // Basel III standardized floors, and folds constants_version into the
  // execution hash so any future minimum-table change is provenance-pinned.
  const cet1MinPct = safeNum(pp.cet1_min_pct, 0.045);
  const tier1MinPct = safeNum(pp.tier1_min_pct, 0.06);
  const totalCapitalMinPct = safeNum(pp.total_capital_min_pct, 0.08);
  const slrMinPct = safeNum(pp.slr_min_pct, 0.03);
  // eSLR final rule (eff. 2026-04-01, §0.2): GSIB supplementary-leverage-ratio
  // buffer, caller-declared per the institution's own eSLR category -- this
  // kernel does not derive GSIB status or the buffer calibration itself.
  const eslrBufferPct = isGsib ? safeNum(pp.eslr_buffer_pct, 0.02) : 0;

  const compliance_flags = [];
  if (!entityId) compliance_flags.push('CALLRCR_ENTITY_ID_MISSING');
  if (!reportingPeriod) compliance_flags.push('CALLRCR_REPORTING_PERIOD_MISSING');
  if (!constantsVersion) compliance_flags.push('CALLRCR_CONSTANTS_VERSION_UNPINNED');
  if (totalRwaUsd <= 0) compliance_flags.push('CALLRCR_RWA_NONPOSITIVE');
  if (tier1CapitalUsd < cet1CapitalUsd) compliance_flags.push('CALLRCR_TIER1_LESS_THAN_CET1');
  if (totalCapitalUsd < tier1CapitalUsd) compliance_flags.push('CALLRCR_TOTAL_LESS_THAN_TIER1');

  const cet1RatioPct = pct(cet1CapitalUsd, totalRwaUsd);
  const tier1RatioPct = pct(tier1CapitalUsd, totalRwaUsd);
  const totalCapitalRatioPct = pct(totalCapitalUsd, totalRwaUsd);
  const slrPct = pct(tier1CapitalUsd, totalLeverageExposureUsd);
  const eslrRequiredPct = r6(slrMinPct + eslrBufferPct);

  const cet1Pass = cet1RatioPct >= cet1MinPct;
  const tier1Pass = tier1RatioPct >= tier1MinPct;
  const totalCapitalPass = totalCapitalRatioPct >= totalCapitalMinPct;
  const slrPass = slrPct >= slrMinPct;
  const eslrPass = !isGsib || slrPct >= eslrRequiredPct;

  if (!cet1Pass) compliance_flags.push('CALLRCR_CET1_BELOW_MINIMUM');
  if (!tier1Pass) compliance_flags.push('CALLRCR_TIER1_BELOW_MINIMUM');
  if (!totalCapitalPass) compliance_flags.push('CALLRCR_TOTAL_CAPITAL_BELOW_MINIMUM');
  if (!slrPass) compliance_flags.push('CALLRCR_SLR_BELOW_MINIMUM');
  if (isGsib && !eslrPass) compliance_flags.push('CALLRCR_ESLR_BUFFER_SHORTFALL');

  const output_payload = {
    entity_id: entityId,
    reporting_period: reportingPeriod,
    report_form: 'FFIEC 031',
    schedule: 'RC-R',
    constants_version: constantsVersion,
    is_gsib: isGsib,
    cet1_capital_usd: r2(cet1CapitalUsd),
    additional_tier1_capital_usd: r2(additionalTier1Usd),
    tier1_capital_usd: r2(tier1CapitalUsd),
    tier2_capital_usd: r2(tier2CapitalUsd),
    total_capital_usd: totalCapitalUsd,
    total_rwa_usd: r2(totalRwaUsd),
    total_leverage_exposure_usd: r2(totalLeverageExposureUsd),
    ratios: {
      cet1_ratio_pct: cet1RatioPct, cet1_min_pct: cet1MinPct, cet1_pass: cet1Pass,
      tier1_ratio_pct: tier1RatioPct, tier1_min_pct: tier1MinPct, tier1_pass: tier1Pass,
      total_capital_ratio_pct: totalCapitalRatioPct, total_capital_min_pct: totalCapitalMinPct, total_capital_pass: totalCapitalPass,
      supplementary_leverage_ratio_pct: slrPct, slr_min_pct: slrMinPct, slr_pass: slrPass,
    },
    eslr: {
      applicable: isGsib,
      buffer_pct: eslrBufferPct,
      required_slr_pct: isGsib ? eslrRequiredPct : null,
      pass: eslrPass,
      final_rule_citation: 'eSLR final rule, published 2025-12-01, effective 2026-04-01 (§0.2)',
    },
    boundary_note: 'Capital component and RWA values are caller-declared; this kernel performs only ratio arithmetic and threshold comparison against caller-declared, version-pinned minimums. It does not calculate risk weights, classify exposures, or derive GSIB status.',
    mdrm_note: 'Schedule RC-R MDRM item prefixes vary by advanced vs. standardized approach and reporting vintage; capital-component field names here mirror the FDIC BankFind Suite mnemonics (RBCT1J tier1, RBCT2 tier2, RWAJT total RWA), which the FDIC itself derives from filed Call Report Schedule RC-R submissions.',
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
