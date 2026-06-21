/**
 * art-71-cbam-certificate-cost-engine.kernel.mjs
 * Wave 16 — CBAM Certificate Cost & Free-Allocation Engine.
 * Converts embedded emissions (from ART-69) into CBAM certificate liability:
 * applies the CBAM factor (free-allocation phase-out), deducts origin carbon price,
 * prices certificates off EUA reference, and projects the purchase/surrender schedule.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   CBAM Reg. (EU) 2023/956 Arts 21–22 (certificates, holding/surrender);
 *   Free-allocation phase-out: EU-ETS Directive amendment (CBAM Reg. Art 31 + Annex V).
 *   EUA reference pricing: CBAM Implementing Regulation (quarterly 2026, weekly 2027+).
 *   Surrender deadline: 30 Sep each year (CBAM Reg. Art 22(2)).
 *   reference_version: "CBAM-IR-v1.0-2024-Q4" — verify current edition.
 *   EDUCATIONAL: outputs are decision-support drafts, not official declarations.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-71-cbam-certificate-cost-engine';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'model_cbam_certificate_cost',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// ─── CBAM factor schedule (Annex V, CBAM Reg. 2023/956) ─────────────────────
// Source: CBAM Reg. 2023/956 Annex V. reference_version: "CBAM-IR-v1.0-2024-Q4".
// Factor = share of costs not covered by free EU-ETS allowances.
// Verify current edition — EU-ETS free-allocation acts still moving.
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

const getCbamFactor = (year) => CBAM_FACTOR[+year] ?? 1.000;

// Holding threshold: ≥80% of estimated annual liability by end of each quarter
const QUARTERLY_HOLDING_THRESHOLD = 0.80;

export function compute(pp) {
  const {
    embedded_emissions_tco2e  = 0,
    cbam_factor_year          = 2026,
    origin_carbon_price_eur_per_t = 0,
    eua_reference_price       = 65,   // EUR/tCO₂e — synthetic default; use actual EUA
    import_schedule           = [],   // [{ quarter: 'Q1', emissions: number }]
  } = pp;

  const cbam_factor = getCbamFactor(cbam_factor_year);

  // ── Net CBAM liability ──
  const gross_liability_tco2e     = +(embedded_emissions_tco2e * cbam_factor).toFixed(3);
  const origin_price_credit       = Math.min(
    +(origin_carbon_price_eur_per_t * embedded_emissions_tco2e).toFixed(2),
    +(gross_liability_tco2e * eua_reference_price).toFixed(2)
  );
  const net_liability_eur         = Math.max(0, +(gross_liability_tco2e * eua_reference_price - origin_price_credit).toFixed(2));
  const certificates_required     = eua_reference_price > 0
    ? +Math.ceil(net_liability_eur / eua_reference_price)
    : 0;
  const certificate_liability_eur = net_liability_eur;

  // ── Free-allocation phase-out context ──
  const free_allocation_phaseout_pct = +((1 - cbam_factor) * 100).toFixed(1);

  // ── Quarterly holding schedule (≥80% rolling) ──
  const quarterly_holding_schedule = [];
  if (import_schedule.length > 0) {
    let cumulative_certs = 0;
    for (const entry of import_schedule) {
      const q_liability = +(entry.emissions * cbam_factor * eua_reference_price - origin_price_credit / import_schedule.length).toFixed(2);
      cumulative_certs += Math.ceil(Math.max(0, q_liability) / eua_reference_price);
      quarterly_holding_schedule.push({
        quarter:          entry.quarter,
        q_liability_eur:  +Math.max(0, q_liability).toFixed(2),
        cumulative_certs_required: cumulative_certs,
        holding_required: +Math.ceil(cumulative_certs * QUARTERLY_HOLDING_THRESHOLD),
      });
    }
  }

  const surrender_deadline = `30 Sep ${+cbam_factor_year + 1}`;

  // ── Compliance flags ──
  const compliance_flags = [];
  if (quarterly_holding_schedule.some(q => q.holding_required > 0 && q.cumulative_certs_required * QUARTERLY_HOLDING_THRESHOLD > q.holding_required)) {
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
    free_allocation_phaseout_pct,
    origin_price_credit,
    gross_liability_tco2e,
    net_liability_eur,
    eua_reference_price,
    cbam_factor_year: +cbam_factor_year,
    quarterly_holding_schedule,
    surrender_deadline,
    reference: {
      cbam_factor_source:   'CBAM Reg. 2023/956 Annex V — verify current edition',
      reference_version:    'CBAM-IR-v1.0-2024-Q4',
      eua_price_note:       'EUA reference price is a user-supplied input. Verify against current CBAM certificate auction prices (quarterly 2026, weekly 2027+).',
    },
    note: 'DECISION-SUPPORT DRAFT — not an official CBAM declaration. Certificate liability depends on actual EUA auction prices and origin carbon-price verification. Verify surrender deadline (30 Sep) + holding obligation (≥80% rolling) against CBAM Reg. Arts 21–22. CBAM factor schedule: verify Annex V edition.',
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
