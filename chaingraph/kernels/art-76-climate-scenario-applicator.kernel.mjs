/**
 * art-76-climate-scenario-applicator.kernel.mjs
 * Wave 16 — Climate Scenario Applicator (NGFS / Fit-for-55).
 * Applies a climate scenario path (NGFS long-term/short-term, or Fit-for-55)
 * to an exposure/portfolio set, emitting stress-adjusted metrics for bank/insurer
 * climate-risk files.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   NGFS Climate Scenarios Phase V (long-term Nov 2024 / short-term 7 May 2025).
 *   ECB climate stress-testing good practices (May 2026). Verify current edition.
 *   Scenario paths are versioned reference data, NOT the suite's financial-shock
 *   stress parameters (qfa-03).
 *   EDUCATIONAL: outputs are decision-support drafts, not supervisor filings.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-76-climate-scenario-applicator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'apply_climate_scenario',
  mandate_type: 'model_governance',
  gpu:          false,
};

// ─── NGFS scenario reference paths (Phase V, Nov 2024 / May 2025) ─────────────
// Source: NGFS Climate Scenarios Phase V. reference_version: "NGFS-Phase-V-2025".
// Carbon price trajectory (USD/tCO₂e) — 2030 / 2040 / 2050 waypoints.
// Values are approximations for modelling; verify against current NGFS published data.
const SCENARIO_PATHS = {
  'NGFS-orderly': {
    label:             'NGFS Net Zero 2050 (Orderly)',
    carbon_price_2030: 130,
    carbon_price_2040: 310,
    carbon_price_2050: 680,
    gdp_delta_2030:    -0.012,  // -1.2% vs baseline
    gdp_delta_2050:    +0.005,  // +0.5% vs baseline (long-run co-benefits)
    transition_intensity: 'HIGH',
  },
  'NGFS-disorderly': {
    label:             'NGFS Divergent Net Zero (Disorderly)',
    carbon_price_2030: 200,
    carbon_price_2040: 420,
    carbon_price_2050: 850,
    gdp_delta_2030:    -0.018,
    gdp_delta_2050:    -0.008,
    transition_intensity: 'VERY_HIGH',
  },
  'NGFS-hot-house': {
    label:             'NGFS Current Policies (Hot House World)',
    carbon_price_2030: 25,
    carbon_price_2040: 30,
    carbon_price_2050: 35,
    gdp_delta_2030:    -0.002,
    gdp_delta_2050:    -0.042,  // physical risk dominates long-term
    transition_intensity: 'LOW',
  },
  'Fit-for-55': {
    label:             'ECB Fit-for-55 Supervisory Scenario',
    carbon_price_2030: 100,
    carbon_price_2040: 220,
    carbon_price_2050: 500,
    gdp_delta_2030:    -0.010,
    gdp_delta_2050:    -0.003,
    transition_intensity: 'MEDIUM_HIGH',
  },
};

// ─── Sector transition sensitivities (NACE proxy) ────────────────────────────
// PD uplift per 100 EUR/t carbon price, approximate. Verify against ECB guides.
const SECTOR_SENSITIVITY = {
  B:  { name: 'Mining & quarrying',        pd_uplift_per_100_carbon: 0.035 },
  C:  { name: 'Manufacturing',             pd_uplift_per_100_carbon: 0.028 },
  D:  { name: 'Electricity & gas supply',  pd_uplift_per_100_carbon: 0.055 },
  E:  { name: 'Water & waste',             pd_uplift_per_100_carbon: 0.020 },
  F:  { name: 'Construction',              pd_uplift_per_100_carbon: 0.018 },
  G:  { name: 'Wholesale & retail trade',  pd_uplift_per_100_carbon: 0.012 },
  H:  { name: 'Transport & storage',       pd_uplift_per_100_carbon: 0.040 },
  I:  { name: 'Accommodation & food',      pd_uplift_per_100_carbon: 0.008 },
  _default: { name: 'Other',              pd_uplift_per_100_carbon: 0.010 },
};

const REFERENCE_VERSION = 'NGFS-Phase-V-2025';

export function compute(pp) {
  const {
    scenario: {
      family  = 'NGFS-orderly',
      horizon = 2030,
    } = {},
    exposures = [],  // [{ sector_nace, ead, base_pd, transition_sensitivity? }]
    metric    = 'stressed-PD',  // 'expected-loss' | 'stressed-PD' | 'carbon-cost-passthrough'
  } = pp;

  const scenarioData = SCENARIO_PATHS[family] ?? SCENARIO_PATHS['NGFS-orderly'];

  // Interpolate carbon price at horizon
  const h = +horizon;
  let carbon_price_at_horizon;
  if (h <= 2030)      carbon_price_at_horizon = scenarioData.carbon_price_2030;
  else if (h <= 2040) carbon_price_at_horizon = scenarioData.carbon_price_2030 + (scenarioData.carbon_price_2040 - scenarioData.carbon_price_2030) * ((h - 2030) / 10);
  else                carbon_price_at_horizon = scenarioData.carbon_price_2040 + (scenarioData.carbon_price_2050 - scenarioData.carbon_price_2040) * ((h - 2040) / 10);

  carbon_price_at_horizon = +carbon_price_at_horizon.toFixed(0);

  // ── Per-sector stress ──
  const delta_by_sector = [];
  let baseline_total = 0;
  let stressed_total = 0;

  for (const exp of exposures) {
    const nace_div = String(exp.sector_nace ?? '').charAt(0).toUpperCase();
    const sect     = SECTOR_SENSITIVITY[nace_div] ?? SECTOR_SENSITIVITY._default;
    const pd_uplift_pct = exp.transition_sensitivity ?? sect.pd_uplift_per_100_carbon;
    const base_pd  = +(exp.base_pd ?? 0.01);
    const ead      = +(exp.ead ?? 0);

    const stressed_pd  = Math.min(1, base_pd + (carbon_price_at_horizon / 100) * pd_uplift_pct);
    const baseline_el  = +(base_pd * ead * 0.45).toFixed(2);   // proxy LGD 45%
    const stressed_el  = +(stressed_pd * ead * 0.45).toFixed(2);

    baseline_total += baseline_el;
    stressed_total += stressed_el;

    delta_by_sector.push({
      sector_nace:       exp.sector_nace,
      sector_name:       sect.name,
      ead:               +ead.toFixed(2),
      base_pd:           +base_pd.toFixed(4),
      stressed_pd:       +stressed_pd.toFixed(4),
      pd_uplift:         +((stressed_pd - base_pd)).toFixed(4),
      baseline_el:       baseline_el,
      stressed_el:       stressed_el,
      el_delta:          +(stressed_el - baseline_el).toFixed(2),
    });
  }

  const baseline_metric = +baseline_total.toFixed(2);
  const stressed_metric = +stressed_total.toFixed(2);

  // ── Compliance flags ──
  const compliance_flags = [];
  if (scenarioData.transition_intensity === 'VERY_HIGH' || scenarioData.transition_intensity === 'HIGH') {
    compliance_flags.push('DISORDERLY_TRANSITION_STRESS');
  }
  const nace_counts = {};
  for (const d of delta_by_sector) {
    const key = d.sector_nace ?? 'unknown';
    nace_counts[key] = (nace_counts[key] ?? 0) + 1;
  }
  const total_ead = delta_by_sector.reduce((s, d) => s + d.ead, 0);
  const max_sector_ead = delta_by_sector.reduce((m, d) => Math.max(m, d.ead), 0);
  if (total_ead > 0 && max_sector_ead / total_ead > 0.5) {
    compliance_flags.push('HIGH_SECTOR_CONCENTRATION');
  }

  const output_payload = {
    baseline_metric,
    stressed_metric,
    delta:               +(stressed_metric - baseline_metric).toFixed(2),
    delta_pct:           baseline_metric > 0 ? +((stressed_metric / baseline_metric - 1) * 100).toFixed(2) : 0,
    metric,
    delta_by_sector,
    scenario_family:     family,
    scenario_label:      scenarioData.label,
    horizon:             +horizon,
    carbon_price_assumption: carbon_price_at_horizon,
    gdp_delta_at_horizon: h <= 2030 ? scenarioData.gdp_delta_2030 : scenarioData.gdp_delta_2050,
    transition_intensity: scenarioData.transition_intensity,
    reference: {
      scenarios:          'NGFS Climate Scenarios Phase V (long-term Nov 2024 / short-term 7 May 2025)',
      ecb_guidance:       'ECB climate stress-testing good practices (May 2026)',
      reference_version:  REFERENCE_VERSION,
      note:               'Scenario paths are versioned reference data. PD sensitivities are proxy estimates — verify against current ECB NGFS documentation. Carbon prices in USD/tCO₂e (NGFS Phase V); convert to EUR for EU-denominated portfolios.',
    },
    note: 'DECISION-SUPPORT DRAFT — not a supervisory filing. Transition PD sensitivities are sector-level proxies; counterparty-specific analysis required for production use. Verify NGFS Phase V scenario data at ngfs.net. ECB good practices (May 2026) may prescribe different sector mappings.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
