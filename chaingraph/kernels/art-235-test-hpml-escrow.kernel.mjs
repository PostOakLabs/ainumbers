import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-235-test-hpml-escrow';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'test_hpml_escrow',
  mandate_type: 'compliance_mandate', gpu: false,
};

// HPML (Higher-Priced Mortgage Loan) definition and escrow requirement test.
// §1026.35(a) HPML definition; §1026.35(b) escrow requirement; §1026.35(b)(2) exemptions.
//
// HPML DEFINITION (§1026.35(a)(1)):
// A closed-end consumer credit transaction secured by the consumer's principal dwelling
// with an APR that exceeds the APOR by:
//   (A) 1.5 pp or more for a first-lien transaction (standard)
//   (B) 2.5 pp or more for a first-lien jumbo transaction (above FHFA conforming limit)
//   (C) 3.5 pp or more for a subordinate-lien transaction
//
// NOTE: These are structural Dodd-Frank thresholds (10 USC §987 basis), unchanged since 2014.
// They differ from HOEPA (art-234) which uses 6.5/8.5 pp thresholds.
//
// ESCROW REQUIREMENT (§1026.35(b)(1)):
// If HPML AND first-lien: creditor must maintain escrow for property taxes and insurance.
// Escrow period: minimum 5 years (§1026.35(b)(3)).
// Escrow does NOT apply to subordinate-lien HPMLs.
//
// EXEMPTIONS from escrow (§1026.35(b)(2)):
//   (i)  Rural or underserved area AND creditor meets size/volume thresholds
//        (assets < $2B + <= 500 first-lien HPMLs in prior year)
//   (ii) Condominium: HOA master policy covers hazard insurance for all units
//   (iii) HPML qualified mortgage (QM) exemptions (§1026.35(b)(2)(iv)) -- not modeled here
//
// CONSUMES: art-220 (lookup_reg_z_thresholds, table: hpml) for threshold reference.
// For HOEPA high-cost trigger test: use art-234 (test_hoepa_high_cost).
//
// Table version: HPML-REGZ-2026-01-01
// Source: Reg Z §1026.35(a)(1); §1026.35(b)(1)-(3); FR 2025-22773 (escrow threshold update)

// HPML spread thresholds (§1026.35(a)(1)) -- Dodd-Frank structural, unchanged since 2014
const HPML_SPREADS = {
  first_lien_standard_pp: 1.5,  // §1026.35(a)(1)(i)(A): >= 1.5pp above APOR
  first_lien_jumbo_pp: 2.5,     // §1026.35(a)(1)(i)(B): >= 2.5pp for jumbo (> conforming limit)
  subordinate_lien_pp: 3.5,     // §1026.35(a)(1)(i)(C): >= 3.5pp above APOR
  fr_citation: 'Reg Z §1026.35(a)(1); Dodd-Frank Act; Reg Z §1026.35 Final Rule (FR 2013-01730, eff. Jan 10, 2014). Structural thresholds unchanged since 2014.',
};

// HPML escrow small-creditor / rural exemption size threshold (§1026.35(b)(2)(iii))
// The $2B asset threshold is not CPI-adjusted; the 500-loan count is structural.
const RURAL_EXEMPT = {
  max_assets: 2_000_000_000, // $2 billion asset size limit
  max_first_lien_hpml_count: 500,
};

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }

export function compute(pp) {
  pp = pp || {};

  const apr_pct = safeNum(pp.apr_pct, 0);
  const apor_pct = safeNum(pp.apor_pct, 0);
  const lien_type = pp.lien_type === 'subordinate' ? 'subordinate' : 'first';
  const is_jumbo = Boolean(pp.is_jumbo);
  const year = Math.round(safeNum(pp.year, 2026));

  // Escrow-exemption inputs (§1026.35(b)(2))
  const is_rural_or_underserved = Boolean(pp.is_rural_or_underserved);
  const creditor_assets_under_2b = Boolean(pp.creditor_assets_under_2b);
  const loan_count_under_500 = Boolean(pp.loan_count_under_500);
  const property_is_condo_master_policy = Boolean(pp.property_is_condo_master_policy);

  // (A) Determine HPML spread threshold
  let spread_threshold, spread_basis;
  if (lien_type === 'subordinate') {
    spread_threshold = HPML_SPREADS.subordinate_lien_pp;
    spread_basis = 'subordinate_lien_3.5pp';
  } else if (is_jumbo) {
    spread_threshold = HPML_SPREADS.first_lien_jumbo_pp;
    spread_basis = 'first_lien_jumbo_2.5pp';
  } else {
    spread_threshold = HPML_SPREADS.first_lien_standard_pp;
    spread_basis = 'first_lien_standard_1.5pp';
  }

  const apr_spread = r4(apr_pct - apor_pct);
  const is_hpml = apr_spread >= spread_threshold - 1e-5;

  // (B) Escrow requirement: first-lien HPML only
  // Default: escrow required if HPML + first lien
  let escrow_required = is_hpml && lien_type === 'first';
  let escrow_exemption = null;
  let escrow_exemption_basis = null;

  if (escrow_required) {
    // Check §1026.35(b)(2) exemptions
    if (is_rural_or_underserved && creditor_assets_under_2b && loan_count_under_500) {
      escrow_required = false;
      escrow_exemption = 'rural_or_underserved_small_creditor';
      escrow_exemption_basis = '§1026.35(b)(2)(iii): rural or underserved area + creditor assets < $2B + <= 500 first-lien HPMLs originated in prior year';
    } else if (property_is_condo_master_policy) {
      escrow_required = false;
      escrow_exemption = 'condo_master_policy';
      escrow_exemption_basis = '§1026.35(b)(2)(ii): condominium where HOA master policy covers hazard insurance for all units';
    }
  }

  const compliance_flags = [];
  if (is_hpml) compliance_flags.push('HPML_LOAN');
  if (escrow_required) compliance_flags.push('HPML_ESCROW_REQUIRED');
  if (escrow_exemption) compliance_flags.push('HPML_ESCROW_EXEMPTION_APPLIES');
  if (is_hpml && lien_type === 'subordinate') compliance_flags.push('HPML_SUBORDINATE_NO_ESCROW');

  const output_payload = {
    is_hpml,
    escrow_required,
    escrow_exemption,
    escrow_exemption_basis,
    apr_spread_pct: apr_spread,
    apr_pct: r4(apr_pct),
    apor_pct: r4(apor_pct),
    lien_type,
    is_jumbo,
    spread_threshold_pct: spread_threshold,
    spread_threshold_basis: spread_basis,
    year,
    table_version: 'HPML-REGZ-2026-01-01',
    fr_citation: HPML_SPREADS.fr_citation,
    regulatory_basis: 'Reg Z §1026.35(a)(1) HPML definition; §1026.35(b)(1) escrow requirement (first-lien HPML, minimum 5 years); §1026.35(b)(2) rural/underserved small creditor and condo master-policy exemptions.',
    consumes: 'art-220 (lookup_reg_z_thresholds) supplies the HPML threshold table (table: hpml). HPML spread thresholds (1.5/2.5/3.5 pp) are structural Dodd-Frank values, not CPI-adjusted.',
    note: 'HPML escrow applies to first-lien transactions only; subordinate liens are not subject to §1026.35(b) escrow. For HOEPA high-cost test (APOR+6.5pp/8.5pp): use art-234 (test_hoepa_high_cost). APOR must be supplied by caller from FFIEC weekly table (ffiec.gov/ratespread).',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
