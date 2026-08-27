/**
 * art-71-cbam-certificate-cost-engine.kernel.mjs
 * CBAM Certificate Cost & Free-Allocation Engine.
 * Converts embedded emissions (from ART-69) into CBAM certificate liability:
 * screens the mass-based de minimis exemption, selects the pricing rule for the
 * vintage year, applies the CBAM factor (free-allocation phase-out), deducts
 * origin carbon price, and projects the purchase/surrender schedule.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Provenance for every threshold, date and rule below lives in node metadata
 * (standards_basis / cited_clause_digest / description) and in the payload
 * `reference` block, never in this source. Values are carried from the pinned
 * correction spec; none is derived here.
 *
 * EDUCATIONAL: outputs are decision-support drafts, not official declarations.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-71-cbam-certificate-cost-engine';
const TOOL_VERSION = '1.1.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'model_cbam_certificate_cost',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// ─── CBAM factor schedule ───────────────────────────────────────────────────
// Factor = share of costs not covered by free EU-ETS allowances.
// UNCHANGED by the 2025 amending regulation; carried forward byte-identically.
const CBAM_FACTOR = {
  2026: 0.025,
  2027: 0.050,
  2028: 0.100,
  2029: 0.225,
  2030: 0.485,
  2031: 0.610,
  2032: 0.735,
  2033: 0.860,
  2034: 1.000,
};

// Years outside the declared table fall back to the full (unabated) factor.
// Conservative by construction: it never under-states liability. Emitted as
// `cbam_factor_source_year: null` plus the CBAM_FACTOR_YEAR_OUT_OF_TABLE flag
// so the fallback is visible rather than silent.
const CBAM_FACTOR_FALLBACK = 1.000;
const getCbamFactor = (year) => CBAM_FACTOR[+year] ?? CBAM_FACTOR_FALLBACK;
const isTabledYear  = (year) => Object.prototype.hasOwnProperty.call(CBAM_FACTOR, String(+year));

// ─── Quarterly minimum holding ──────────────────────────────────────────────
const QUARTERLY_HOLDING_MINIMUM_SHARE = 0.50;
const HOLDING_RULE_APPLIES_FROM_YEAR  = 2027;
const HOLDING_RULE_APPLIES_FROM       = '2027-01-01';

// ─── Certificate sales ──────────────────────────────────────────────────────
const CERTIFICATE_SALES_START = '2027-02-01';

// ─── Mass-based de minimis ──────────────────────────────────────────────────
const DE_MINIMIS_THRESHOLD_T      = 50;
const DE_MINIMIS_EXCLUDED_SECTORS = ['electricity', 'hydrogen'];

// ─── Pricing rules ──────────────────────────────────────────────────────────
const QUARTERLY_PRICING_VINTAGE_YEAR = 2026;

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

// Provisions of the amending regulation this tool deliberately does not model.
// Named so a reader never mistakes silence for ignorance.
const OMNIBUS_OUT_OF_SCOPE = [
  'Repurchase limit rewrite (Reg. (EU) 2023/956 Art 23(2) as replaced by Reg. (EU) 2025/2083 Art 1(19)): not modelled by this tool',
  'Repurchase window for 2026-vintage certificates (Art 23(2a)): not modelled by this tool',
  'Cancellation regime (Art 24 as replaced, annual cancellation on 1 November, and the 1 November 2027 derogation for 2026-vintage certificates): not modelled by this tool',
];

export function compute(pp) {
  const {
    embedded_emissions_tco2e      = 0,
    cbam_factor_year              = 2026,
    origin_carbon_price_eur_per_t = 0,
    eua_reference_price           = 65,   // EUR/tCO₂e — synthetic default; use actual EUA
    import_schedule               = [],   // [{ quarter: 'Q1', emissions: number }]
    annual_imported_net_mass_t    = null, // tonnes net mass, all CN codes, per importer per year
    cbam_sector                   = null, // 'iron_steel'|'aluminium'|'fertilisers'|'cement'|'electricity'|'hydrogen'
    threshold_exceeded_quarter    = null, // 'Q1'..'Q4' — quarter the mass threshold was exceeded in
    eua_quarter_avg_prices        = null, // { Q1?, Q2?, Q3?, Q4? } EUR/tCO₂e quarterly averages
  } = pp;

  const compliance_flags = [];
  const year = +cbam_factor_year;

  const cbam_factor = getCbamFactor(year);
  if (!isTabledYear(year)) compliance_flags.push('CBAM_FACTOR_YEAR_OUT_OF_TABLE');

  // ── 1. De minimis screen (evaluated first: it can extinguish every obligation) ──
  const sector_excluded_from_de_minimis = DE_MINIMIS_EXCLUDED_SECTORS.includes(cbam_sector);
  const mass_declared = typeof annual_imported_net_mass_t === 'number' && Number.isFinite(annual_imported_net_mass_t);

  let de_minimis_exemption = false;
  if (!mass_declared) {
    // Absence is not a pass: an undeclared mass never zeroes liability.
    compliance_flags.push('DE_MINIMIS_INPUT_MISSING');
  } else if (sector_excluded_from_de_minimis) {
    compliance_flags.push('DE_MINIMIS_SECTOR_EXCLUDED');
  } else if (annual_imported_net_mass_t <= DE_MINIMIS_THRESHOLD_T) {
    de_minimis_exemption = true;
    compliance_flags.push('DE_MINIMIS_EXEMPT');
  } else {
    // Exceeding the threshold pulls ALL goods imported that year into scope.
    compliance_flags.push('DE_MINIMIS_THRESHOLD_EXCEEDED_ALL_GOODS');
  }

  // ── 2. Pricing rule selection ──
  const quarterly_pricing = year === QUARTERLY_PRICING_VINTAGE_YEAR;
  const pricing_rule = quarterly_pricing
    ? 'quarterly-average-of-quarter-of-importation'
    : 'weekly-closing-average';

  const quarterPrice = (quarter) => {
    if (!quarterly_pricing) return eua_reference_price;
    const q = eua_quarter_avg_prices && typeof eua_quarter_avg_prices === 'object'
      ? eua_quarter_avg_prices[quarter]
      : undefined;
    if (typeof q === 'number' && Number.isFinite(q)) return q;
    return null; // caller supplied no average for this quarter
  };

  // ── 3. Net CBAM liability ──
  const gross_liability_tco2e = de_minimis_exemption
    ? 0
    : +(embedded_emissions_tco2e * cbam_factor).toFixed(3);
  const origin_price_credit = de_minimis_exemption
    ? 0
    : Math.min(
        +(origin_carbon_price_eur_per_t * embedded_emissions_tco2e).toFixed(2),
        +(gross_liability_tco2e * eua_reference_price).toFixed(2)
      );
  const net_liability_eur = de_minimis_exemption
    ? 0
    : Math.max(0, +(gross_liability_tco2e * eua_reference_price - origin_price_credit).toFixed(2));
  const certificates_required = (!de_minimis_exemption && eua_reference_price > 0)
    ? +Math.ceil(net_liability_eur / eua_reference_price)
    : 0;
  const certificate_liability_eur = net_liability_eur;

  // ── 4. Free-allocation phase-out context ──
  const free_allocation_phaseout_pct = +((1 - cbam_factor) * 100).toFixed(1);

  // ── 5. Quarterly schedule: per-quarter cost always, holding obligation only
  // for vintages it is in force for. The two are gated separately on purpose:
  // the quarter-of-importation pricing rule governs the 2026 vintage, which is
  // precisely a vintage the minimum-holding obligation does NOT yet bind. For
  // those vintages `holding_required` is null (no entitlement asserted either
  // way), never a number a caller could read as a 50% allowance.
  const holding_rule_applies = year >= HOLDING_RULE_APPLIES_FROM_YEAR;
  const grace_index = QUARTERS.indexOf(threshold_exceeded_quarter);
  if (grace_index >= 0) compliance_flags.push('HOLDING_GRACE_QUARTER_APPLIED');

  const quarterly_holding_schedule = [];
  if (import_schedule.length > 0 && !holding_rule_applies) {
    compliance_flags.push('HOLDING_RULE_PRE_2027');
  }
  if (import_schedule.length > 0 && !de_minimis_exemption) {
    let cumulative_certs = 0;
    for (const entry of import_schedule) {
      const q_price_applied = quarterPrice(entry.quarter);
      const price = q_price_applied === null ? eua_reference_price : q_price_applied;
      if (quarterly_pricing && q_price_applied === null && !compliance_flags.includes('QUARTER_PRICE_FALLBACK')) {
        compliance_flags.push('QUARTER_PRICE_FALLBACK');
      }
      const q_liability = +(entry.emissions * cbam_factor * price - origin_price_credit / import_schedule.length).toFixed(2);
      cumulative_certs += price > 0 ? Math.ceil(Math.max(0, q_liability) / price) : 0;
      // Grace: enforcement starts at the END of the quarter FOLLOWING the one
      // in which the mass threshold was exceeded.
      const holding_enforced = holding_rule_applies
        && (grace_index < 0 ? true : QUARTERS.indexOf(entry.quarter) > grace_index);
      quarterly_holding_schedule.push({
        quarter:          entry.quarter,
        q_price_applied,
        q_liability_eur:  +Math.max(0, q_liability).toFixed(2),
        cumulative_certs_required: cumulative_certs,
        holding_applies:  holding_rule_applies,
        holding_enforced,
        holding_required: holding_rule_applies
          ? (holding_enforced ? +Math.ceil(cumulative_certs * QUARTERLY_HOLDING_MINIMUM_SHARE) : 0)
          : null,
      });
    }
  }

  const surrender_deadline = `30 Sep ${year + 1}`;
  const purchase_window = quarterly_pricing ? `from ${CERTIFICATE_SALES_START}` : 'weekly sales';

  // ── 6. Remaining compliance flags ──
  if (quarterly_holding_schedule.some(q => q.holding_required > 0 && q.cumulative_certs_required * QUARTERLY_HOLDING_MINIMUM_SHARE > q.holding_required)) {
    compliance_flags.push('HOLDING_REQUIREMENT_SHORTFALL');
  }
  if (origin_carbon_price_eur_per_t > 0) compliance_flags.push('ORIGIN_PRICE_CREDIT_APPLIED');
  if (!origin_carbon_price_eur_per_t)     compliance_flags.push('ORIGIN_PRICE_UNVERIFIED');
  if (cbam_factor >= 0.485)               compliance_flags.push('HIGH_CBAM_FACTOR_YEAR');

  const output_payload = {
    certificate_liability_eur,
    certificates_required,
    cbam_factor:                cbam_factor,
    cbam_factor_applied:        cbam_factor,
    cbam_factor_year_tabled:    isTabledYear(year),
    free_allocation_phaseout_pct,
    origin_price_credit,
    gross_liability_tco2e,
    net_liability_eur,
    eua_reference_price,
    cbam_factor_year: year,
    de_minimis_exemption,
    de_minimis_threshold_t: DE_MINIMIS_THRESHOLD_T,
    de_minimis_threshold_source: 'Reg. (EU) 2025/2083, Annex VII pt 1 (single mass-based threshold); movable by delegated act under Art 2a(3) where the recomputed value deviates by more than 15 tonnes',
    pricing_rule,
    pricing_rule_source: 'Art 21(1a) (2026 vintage, quarterly average of the quarter of importation) / Art 21(1) (weekly closing average), Reg. (EU) 2023/956 as amended by Reg. (EU) 2025/2083 Art 1(17)',
    certificate_sales_start: CERTIFICATE_SALES_START,
    purchase_window,
    quarterly_holding_minimum_share: QUARTERLY_HOLDING_MINIMUM_SHARE,
    holding_rule_applies_from: HOLDING_RULE_APPLIES_FROM,
    holding_rule_applies,
    holding_basis: 'at least 50% of embedded emissions imported since start of calendar year (Annex IV default values without the point-4.1 mark-up, or the prior-year surrendered count for the same CN codes and countries of origin); the free-allocation adjustment under Art 31 is taken into account',
    quarterly_holding_schedule,
    surrender_deadline,
    omnibus_out_of_scope: OMNIBUS_OUT_OF_SCOPE,
    reference: {
      cbam_factor_source:   'CBAM factor schedule: Directive 2003/87/EC Art 10a(1a), applied through the Art 31 free-allocation adjustment (LOCATOR-UNRETRIEVED: the directive text itself was not retrieved; values carried forward unchanged). Confirmed untouched by Reg. (EU) 2025/2083, whose Art 1 amendment list contains no Art 31 and no directive amendment.',
      reference_version:    'EU-2025-2083-OJ-2025-10-17',
      superseded_reference: 'CBAM-IR-v1.0-2024-Q4 (superseded: the 80% quarterly minimum holding it carried was replaced by 50% from 1 Jan 2027)',
      holding_rule_source:  'Reg. (EU) 2023/956 Art 22(2) and Art 22(2a) as replaced/inserted by Reg. (EU) 2025/2083 Art 1(18)(b)-(c); applicable from 1 Jan 2027 per Art 36(2) point (c) as added by Art 1(27)(a)',
      surrender_rule_source: 'Reg. (EU) 2023/956 Art 22(1) as replaced by Reg. (EU) 2025/2083 Art 1(18)(a): by 30 September of each year, and for the first time in 2027 for the year 2026',
      sales_start_source:   'Reg. (EU) 2023/956 Art 20(1) as replaced by Reg. (EU) 2025/2083 Art 1(16)(a); applicable from 1 Feb 2027 per Art 36(2) point (d)',
      eua_price_note:       'EUA reference price is a user-supplied input. No certificate sales occur before 2027-02-01; 2026-vintage certificates are purchased from 2027-02-01 at the quarterly average of the quarter of importation, and weekly closing-average pricing applies from 2027 onward.',
    },
    note: 'DECISION-SUPPORT DRAFT, not an official CBAM declaration. Certificate liability depends on actual EUA auction prices and origin carbon-price verification. Quarterly minimum holding is 50% of embedded emissions imported since the start of the calendar year, applying from 1 Jan 2027; surrender is due 30 Sep each year, first in 2027 for the 2026 year. Provisions listed in omnibus_out_of_scope are not modelled.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
