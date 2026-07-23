import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-436-bhc-schedule-hcr-capital';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'map_bhc_schedule_hcr',
  mandate_type: 'regulatory_reporting', gpu: false,
};

// FR Y-9C Schedule HC-R -- Regulatory Capital -- mapping and
// ratio-calculation kernel, per BANKING-OCG-BUILD-SPEC.md §4.2. Mirrors the
// art-433 Call Report Schedule RC-R kernel 1:1: given caller-supplied
// CET1/Tier1/Tier2 capital components and risk-weighted assets, computes the
// standard capital ratios plus the supplementary leverage ratio (SLR),
// including the enhanced-SLR (eSLR) buffer, final and effective 2026-04-01
// (§0.2). Reporting entity is the top-tier bank holding company (Y-9C
// panel: total consolidated assets >= $3B), not the insured depository
// institution art-433 targets -- same thresholds and eSLR buffer treatment
// apply at the consolidated holding-company level. NO public XBRL edit
// taxonomy exists for Y-9C (§0.2); capital-component field names here
// mirror the FR Y-9/FFIEC BHCK consolidated mnemonic convention, hand-encoded
// from FR Y-9C instruction text rather than a machine-readable taxonomy.
// BOUNDARY: capital component and RWA VALUES are caller-declared; this
// kernel performs only ratio arithmetic and threshold comparison against
// caller-declared (versioned) minimums -- it does not calculate risk
// weights or classify exposures. Pure ECMA-262 arithmetic only -- no
// Math.pow, no Date.now/new Date(), no Math.random, no Intl/toLocaleString.

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

  // Same 2026 Basel III standardized minimum thresholds as art-433
  // (unchanged by the eSLR final rule itself, which recalibrates only the
  // eSLR buffer for GSIBs). Caller-overridable; constants_version folded
  // into the execution hash so a future minimum-table change stays
  // provenance-pinned.
  const cet1MinPct = safeNum(pp.cet1_min_pct, 0.045);
  const tier1MinPct = safeNum(pp.tier1_min_pct, 0.06);
  const totalCapitalMinPct = safeNum(pp.total_capital_min_pct, 0.08);
  const slrMinPct = safeNum(pp.slr_min_pct, 0.03);
  const eslrBufferPct = isGsib ? safeNum(pp.eslr_buffer_pct, 0.02) : 0;

  const compliance_flags = [];
  if (!entityId) compliance_flags.push('BHCHCR_ENTITY_ID_MISSING');
  if (!reportingPeriod) compliance_flags.push('BHCHCR_REPORTING_PERIOD_MISSING');
  if (!constantsVersion) compliance_flags.push('BHCHCR_CONSTANTS_VERSION_UNPINNED');
  if (totalRwaUsd <= 0) compliance_flags.push('BHCHCR_RWA_NONPOSITIVE');
  if (tier1CapitalUsd < cet1CapitalUsd) compliance_flags.push('BHCHCR_TIER1_LESS_THAN_CET1');
  if (totalCapitalUsd < tier1CapitalUsd) compliance_flags.push('BHCHCR_TOTAL_LESS_THAN_TIER1');

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

  if (!cet1Pass) compliance_flags.push('BHCHCR_CET1_BELOW_MINIMUM');
  if (!tier1Pass) compliance_flags.push('BHCHCR_TIER1_BELOW_MINIMUM');
  if (!totalCapitalPass) compliance_flags.push('BHCHCR_TOTAL_CAPITAL_BELOW_MINIMUM');
  if (!slrPass) compliance_flags.push('BHCHCR_SLR_BELOW_MINIMUM');
  if (isGsib && !eslrPass) compliance_flags.push('BHCHCR_ESLR_BUFFER_SHORTFALL');

  const output_payload = {
    entity_id: entityId,
    reporting_period: reportingPeriod,
    report_form: 'FR Y-9C',
    schedule: 'HC-R',
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
    taxonomy_note: 'No public XBRL edit taxonomy exists for FR Y-9C (§0.2); capital-component field names mirror the FR Y-9/FFIEC BHCK consolidated mnemonic convention, hand-encoded from FR Y-9C instruction text.',
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
