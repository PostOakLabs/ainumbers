/**
 * art-69-cbam-embedded-emissions-calculator.kernel.mjs
 * Wave 16 — CBAM Embedded-Emissions Calculator (W-A flagship importer tool).
 * Computes embedded emissions (direct + indirect, tCO₂e) for a consignment of
 * CBAM goods from actual installation data or resolved default values (from ART-70).
 * Applies the system boundaries of CBAM Reg. 2023/956 Annexes III/IV.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   CBAM Reg. (EU) 2023/956 Annexes III/IV — embedded-emissions methodology,
 *     system boundaries, monitoring rules. Verify current edition.
 *   CBAM Implementing Regulation — default values + system boundaries. Verify.
 *   EDUCATIONAL: outputs are decision-support drafts, not filed CBAM declarations.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-69-cbam-embedded-emissions-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'calculate_cbam_embedded_emissions',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// ─── Reference data (CBAM Annex I goods + indirect-emission eligibility) ─────
// Source: CBAM Reg. 2023/956 Annex I. Verify current edition.
const CBAM_GOODS_CATEGORIES = {
  cement:      { indirect_eligible: false, default_see_direct: 0.766, unit: 'tCO2e/t' },
  iron_steel:  { indirect_eligible: true,  default_see_direct: 1.894, unit: 'tCO2e/t' },
  aluminium:   { indirect_eligible: true,  default_see_direct: 1.503, unit: 'tCO2e/t' },
  fertiliser:  { indirect_eligible: false, default_see_direct: 2.340, unit: 'tCO2e/t' },
  hydrogen:    { indirect_eligible: false, default_see_direct: 10.90, unit: 'tCO2e/t' },
  electricity: { indirect_eligible: false, default_see_direct: 0.000, unit: 'tCO2e/MWh' },
};

// Default indirect emission factor (EU grid average proxy — verify against Implementing Reg.)
const DEFAULT_INDIRECT_EF = 0.376; // tCO2e/MWh (EU-28 grid proxy — verify current edition)

export function compute(pp) {
  const {
    cn_code            = '',
    good_category      = 'iron_steel',
    country_of_origin  = '',
    quantity_tonnes    = 0,
    emissions_basis    = 'default',   // 'actual' | 'default'
    // Actual data path
    direct_emissions_factor   = null,  // tCO2e/t
    indirect_emissions_factor = null,  // tCO2e/MWh (electricity consumption per tonne)
    electricity_source        = 'grid',
    // Precursor emissions (from ART-72 handoff)
    precursor_emissions       = null,  // { cumulative_see_tco2e: number }
    // Monitoring method
    monitoring_method  = 'calculation-based',
  } = pp;

  const cat = CBAM_GOODS_CATEGORIES[good_category] ?? CBAM_GOODS_CATEGORIES.iron_steel;

  // ── Specific embedded emissions (SEE) ──
  let see_direct, see_indirect, default_markup_applied;

  if (emissions_basis === 'actual' && direct_emissions_factor !== null) {
    see_direct          = +direct_emissions_factor;
    see_indirect        = cat.indirect_eligible && indirect_emissions_factor !== null
      ? +(indirect_emissions_factor * DEFAULT_INDIRECT_EF).toFixed(4)
      : 0;
    default_markup_applied = false;
  } else {
    // Default values path — defaults are priced at base value (markup applied by ART-70)
    see_direct          = cat.default_see_direct;
    see_indirect        = cat.indirect_eligible ? +(DEFAULT_INDIRECT_EF * 0.5).toFixed(4) : 0;
    default_markup_applied = true;
  }

  const see_total = +(see_direct + see_indirect).toFixed(4);

  // ── Precursor contribution ──
  const precursor_contribution = precursor_emissions?.cumulative_see_tco2e ?? 0;

  // ── Total embedded emissions ──
  const total_from_see = +(see_total * quantity_tonnes).toFixed(3);
  const total_embedded_emissions_tco2e = +(total_from_see + precursor_contribution).toFixed(3);

  // ── Data quality flag ──
  const data_quality_flag = emissions_basis === 'actual' ? 'HIGH' : 'DEFAULT_VALUES';

  // ── Compliance flags ──
  const compliance_flags = [];
  if (default_markup_applied)              compliance_flags.push('DEFAULT_VALUES_USED');
  if (cat.indirect_eligible && see_indirect > 0) compliance_flags.push('INDIRECT_EMISSIONS_INCLUDED');
  if (!precursor_emissions && ['iron_steel', 'aluminium'].includes(good_category)) {
    compliance_flags.push('PRECURSOR_DATA_MISSING');
  }
  if (quantity_tonnes <= 0) compliance_flags.push('ZERO_QUANTITY');

  const output_payload = {
    total_embedded_emissions_tco2e,
    see_direct,
    see_indirect,
    see_total,
    basis:                 emissions_basis,
    default_markup_applied,
    precursor_contribution,
    monitoring_method,
    data_quality_flag,
    quantity_tonnes,
    good_category,
    cn_code,
    country_of_origin,
    reference: {
      methodology:  'CBAM Reg. 2023/956 Annexes III/IV (embedded-emissions methodology)',
      default_data: 'CBAM Implementing Regulation default values — verify current edition',
      note:         'DECISION-SUPPORT DRAFT — not a filed CBAM declaration. Verify all emission factors and methodology rules against the current CBAM Implementing Regulation before use in any official declaration.',
    },
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
