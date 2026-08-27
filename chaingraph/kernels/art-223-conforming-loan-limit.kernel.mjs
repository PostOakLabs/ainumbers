import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-223-conforming-loan-limit';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_conforming_loan_limit',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── FHFA Conforming Loan Limit (CLL) table ───────────────────────────────────
// Source: FHFA Conforming Loan Limit Values for 2026, announced 2025-11-25.
//   Federal Housing Finance Agency, fhfa.gov news release
//   "FHFA Announces Conforming Loan Limit Values for 2026".
// table_version: "FHFA-CLL-2026"
//
// Disambiguation: check_conforming_loan_limit determines whether a loan amount
//   meets FHFA conforming size limits for agency delivery.
//   It is NOT check_agency_eligibility_matrix (DU/LPA approval grid for DTI/LTV).
//   It is NOT lookup_reg_z_thresholds (Reg Z consumer-protection dollar thresholds).
//
// 2026 baseline limits (contiguous US, standard counties):
//   1-unit: $832,750   2-unit: $1,066,250   3-unit: $1,288,800   4-unit: $1,601,750
// High-cost areas (where 115% of the local median exceeds the baseline), ceiling
//   at 150% of baseline by unit count:
//   1-unit: $1,249,125  2-unit: $1,599,375  3-unit: $1,933,200  4-unit: $2,402,625
// AK / HI / Guam / USVI: a statutory provision raises their BASELINE to 150% of
//   the contiguous baseline. That uplifted figure is their applicable limit, so
//   by default there is no above-baseline band there; a caller-supplied county
//   limit above it is what opens one.
//
// The three tiers are distinct agency categories, not a labelling nicety. At or
//   below the area baseline is ordinary conforming. Above the area baseline and
//   at or below the applicable high-cost limit is super-conforming, which carries
//   its own pricing, LLPA, mortgage-insurance and delivery rules. Above the
//   applicable limit is jumbo, outside agency purchase.
//
// Exact per-county limits for high-cost areas require the FHFA full-county
//   dataset. This kernel carries the tier structure and classifies against it;
//   callers should supply the actual county-level limit via county_limit_override.
//
// Fail-closed: an unsupported year, or a missing or non-positive loan_amount,
//   returns a null verdict plus a named flag. This kernel never returns a
//   computed classification over an input its table cannot answer for.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

// 2026 limits by tier and unit count
const LIMITS_2026 = {
  baseline: [832750, 1066250, 1288800, 1601750],            // 1-4 units
  high_cost_ceiling: [1249125, 1599375, 1933200, 2402625],  // 150% of baseline
};

// The single table vintage this build carries. Any other year is not answerable.
const TABLE_YEAR = 2026;
const AVAILABLE_YEARS = [TABLE_YEAR];
const TABLE_VERSION = 'FHFA-CLL-2026';

// Jurisdictions receiving the statutory baseline uplift.
const AK_HI_TERRITORY = ['AK', 'HI', 'GU', 'VI'];

const TABLE_SOURCE = 'FHFA Conforming Loan Limit Values for 2026 (fhfa.gov news release, 2025-11-25)';
const REGULATORY_BASIS = '12 U.S.C. §§ 1454(a)(2), 1717 (as amended by HERA §1124); FHFA CLL notice 2025-11-25';
const PII_NOTE = 'All inputs processed locally in your browser. No data is transmitted.';

// County-level limits are supplied by the caller via county_limit_override;
// otherwise the kernel applies the area baseline or the high-cost ceiling.
export function compute(pp) {
  pp = pp || {};

  const loan_program = String(pp.loan_program || 'Conventional').trim();
  const yearSupplied = pp.year !== undefined && pp.year !== null && pp.year !== '';
  const yearRaw = yearSupplied ? Number(pp.year) : TABLE_YEAR;
  const year = Number.isFinite(yearRaw) ? Math.round(yearRaw) : null;

  // ── Fail closed (a): the requested vintage is not in this build's table. ──
  if (year === null || !AVAILABLE_YEARS.includes(year)) {
    return {
      output_payload: {
        error: 'year_not_in_table',
        classification: null,
        conforming: null,
        super_conforming: null,
        jumbo: null,
        year,
        available_years: AVAILABLE_YEARS,
        loan_program,
        table_version: TABLE_VERSION,
        table_source: TABLE_SOURCE,
        regulatory_basis: REGULATORY_BASIS,
        note: 'Only year ' + TABLE_YEAR + ' is in this version-pinned table. No classification is returned for any other year: the limits are re-set annually, so answering from the wrong vintage would be silently wrong.',
        pii_note: PII_NOTE,
      },
      compliance_flags: ['LOOKUP_YEAR_UNAVAILABLE'],
    };
  }

  const loan_amount = safeNum(pp.loan_amount, 0);

  // ── Fail closed (b): no usable loan amount to classify. ──
  if (!(loan_amount > 0)) {
    return {
      output_payload: {
        error: 'loan_amount_missing_or_non_positive',
        classification: null,
        conforming: null,
        super_conforming: null,
        jumbo: null,
        loan_amount,
        year,
        available_years: AVAILABLE_YEARS,
        loan_program,
        table_version: TABLE_VERSION,
        table_source: TABLE_SOURCE,
        regulatory_basis: REGULATORY_BASIS,
        note: 'A positive loan_amount is required. No classification is returned without one.',
        pii_note: PII_NOTE,
      },
      compliance_flags: ['LOAN_AMOUNT_MISSING'],
    };
  }

  const units = Math.max(1, Math.min(4, Math.round(safeNum(pp.units, 1))));
  const state  = String(pp.state || '').toUpperCase().trim(); // 2-letter USPS
  const high_cost_county = Boolean(pp.high_cost_county); // caller signals county designation
  const county_limit_override = safeNum(pp.county_limit_override, 0); // exact FHFA county limit

  const idx = units - 1; // 0-based into LIMITS arrays
  const baseline = LIMITS_2026.baseline[idx];
  const hcc = LIMITS_2026.high_cost_ceiling[idx];

  // The area's own baseline. AK/HI/GU/VI carry the statutory 150% uplift.
  const isAkHi = AK_HI_TERRITORY.includes(state);
  const area_baseline = isAkHi ? baseline * 1.5 : baseline;

  // Determine the applicable limit and which tier supplied it.
  let applicable_limit;
  let limit_tier;
  if (county_limit_override > 0) {
    applicable_limit = county_limit_override;
    limit_tier = 'county_override';
  } else if (high_cost_county && !isAkHi) {
    applicable_limit = hcc;
    limit_tier = 'high_cost_ceiling';
  } else {
    applicable_limit = area_baseline;
    limit_tier = isAkHi ? 'ak_hi_territory_baseline' : 'baseline';
  }

  // Three-way partition. For loan_amount > 0 exactly one of these is true.
  const conforming       = loan_amount <= Math.min(area_baseline, applicable_limit);
  const super_conforming = loan_amount > area_baseline
                        && loan_amount <= applicable_limit
                        && applicable_limit > area_baseline;
  const jumbo            = loan_amount > applicable_limit;

  const compliance_flags = [];
  if (jumbo) compliance_flags.push('JUMBO_NON_CONFORMING');

  const output_payload = {
    conforming,
    super_conforming,
    jumbo,
    classification: jumbo ? 'jumbo' : (super_conforming ? 'super_conforming' : 'conforming'),
    loan_program,
    loan_amount,
    applicable_limit,
    baseline_limit: baseline,
    area_baseline,
    high_cost_ceiling: hcc,
    limit_tier,
    units,
    year,
    state_code:    state || null,
    is_ak_hi_territory: isAkHi,
    table_version: TABLE_VERSION,
    table_source:  TABLE_SOURCE,
    regulatory_basis: REGULATORY_BASIS,
    note: 'County-level limit sourced from the caller (county_limit_override) when provided. Baseline and ceiling values are the 2026 FHFA announcement. Verify high-cost designation against the FHFA county dataset for the exact limit; in AK, HI, Guam and USVI an above-baseline county limit must be supplied as an override.',
    pii_note: PII_NOTE,
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
