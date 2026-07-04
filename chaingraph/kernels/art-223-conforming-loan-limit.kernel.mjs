import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-223-conforming-loan-limit';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_conforming_loan_limit',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── FHFA Conforming Loan Limit (CLL) table ───────────────────────────────────
// Source: FHFA FHFA Conforming Loan Limits for 2026 (announced Nov 2025).
//   Federal Housing Finance Agency, FHFA.gov/DataTools/Downloads/Documents/
//   Conforming-Loan-Limits/FullCountyLoanLimitList2026.xlsx (public dataset).
// table_version: "FHFA-CLL-2026"
//
// Disambiguation: check_conforming_loan_limit determines whether a loan amount
//   meets FHFA conforming size limits for agency delivery.
//   It is NOT check_agency_eligibility_matrix (DU/LPA approval grid for DTI/LTV).
//   It is NOT lookup_reg_z_thresholds (Reg Z consumer-protection dollar thresholds).
//
// 2026 baseline limits (contiguous US, standard counties):
//   1-unit: $806,500   2-unit: $1,032,650   3-unit: $1,248,150   4-unit: $1,550,400
// High-cost counties (areas where 115% median exceeds baseline):
//   ceiling = 150% of baseline by unit count:
//   1-unit: $1,209,750  2-unit: $1,548,975  3-unit: $1,872,225  4-unit: $2,325,600
// AK / HI / Guam / USVI: receive the same 150% ceiling as high-cost counties.
//
// Note: exact per-county limits for high-cost areas require the FHFA full-county
//   dataset. This kernel provides the three tiers (baseline / high-cost ceiling /
//   super-conforming ceiling) and classifies loans against them. Callers should
//   supply the actual county-level limit from the FHFA dataset when available.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

// 2026 limits by tier and unit count
const LIMITS_2026 = {
  baseline: [806500, 1032650, 1248150, 1550400],     // 1-4 units
  high_cost_ceiling: [1209750, 1548975, 1872225, 2325600], // 150% of baseline
};

// Named high-cost / AK-HI-territory jurisdictions (abbreviated list for structural classification)
// States where every county receives high-cost ceiling treatment:
const AK_HI_TERRITORY = ['AK', 'HI', 'GU', 'VI'];

// County-level limits are supplied by caller via county_limit_override;
// otherwise the kernel applies baseline or high-cost ceiling.
export function compute(pp) {
  pp = pp || {};

  const loan_amount = safeNum(pp.loan_amount, 0);
  const units = Math.max(1, Math.min(4, Math.round(safeNum(pp.units, 1))));
  const state  = String(pp.state || '').toUpperCase().trim(); // 2-letter USPS
  const high_cost_county = Boolean(pp.high_cost_county); // caller signals county designation
  const county_limit_override = safeNum(pp.county_limit_override, 0); // exact FHFA county limit
  const year = Math.round(safeNum(pp.year, 2026));

  const idx = units - 1; // 0-based into LIMITS arrays
  const baseline = LIMITS_2026.baseline[idx];
  const hcc = LIMITS_2026.high_cost_ceiling[idx];

  // Determine applicable limit
  const isAkHi = AK_HI_TERRITORY.includes(state);
  let applicable_limit;
  let limit_tier;
  if (county_limit_override > 0) {
    applicable_limit = county_limit_override;
    limit_tier = 'county_override';
  } else if (isAkHi || high_cost_county) {
    applicable_limit = hcc;
    limit_tier = isAkHi ? 'ak_hi_territory_ceiling' : 'high_cost_ceiling';
  } else {
    applicable_limit = baseline;
    limit_tier = 'baseline';
  }

  const conforming     = loan_amount > 0 && loan_amount <= applicable_limit;
  const super_conforming = loan_amount > baseline && loan_amount <= hcc && !conforming;
  // super-conforming = above baseline but at or below high-cost ceiling (Fannie/Freddie purchase eligible in those areas)
  const jumbo          = loan_amount > applicable_limit;

  const compliance_flags = [];
  if (loan_amount === 0) compliance_flags.push('LOAN_AMOUNT_MISSING');
  if (jumbo) compliance_flags.push('JUMBO_NON_CONFORMING');
  if (year !== 2026) compliance_flags.push('TABLE_VERSION_MISMATCH_VERIFY_YEAR');

  // Surface loan_program (VA/FHA/USDA/Conventional) from input to output_payload.
  // This enables the mortgage-government-loan-fit chain gate to route on /loan_program.
  const loan_program = String(pp.loan_program || 'Conventional').trim();

  const output_payload = {
    conforming,
    super_conforming,
    jumbo,
    classification: jumbo ? 'jumbo' : (super_conforming ? 'super_conforming' : 'conforming'),
    loan_program,
    loan_amount,
    applicable_limit,
    baseline_limit: baseline,
    high_cost_ceiling: hcc,
    limit_tier,
    units,
    state_code:    state || null,
    is_ak_hi_territory: isAkHi,
    table_version: 'FHFA-CLL-2026',
    table_source:  'FHFA 2026 Conforming Loan Limits (FHFA.gov, Nov 2025 announcement; FullCountyLoanLimitList2026.xlsx)',
    regulatory_basis: '12 USC 1454 (Freddie Mac Charter §305); 12 USC 1717 (Fannie Mae Charter §304(b)); Housing and Economic Recovery Act 2008 §201; FHFA Annual CLL Adjustment',
    note: 'County-level limit sourced from caller (county_limit_override) when provided. Baseline and ceiling values are 2026 FHFA announcement. Verify high-cost designation against FHFA county dataset for exact limit.',
    pii_note: 'All inputs processed locally in your browser. No data is transmitted.',
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
