import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-234-test-hoepa-high-cost';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'test_hoepa_high_cost',
  mandate_type: 'compliance_mandate', gpu: false,
};

// HOEPA high-cost mortgage trigger test per Reg Z §1026.32(a)(1).
// Tests all three triggers; outputs is_high_cost + which triggers fired.
//
// THREE TRIGGERS (§1026.32(a)(1)):
// (i) APR trigger: transaction APR exceeds APOR by threshold pp
//     First lien (standard): APOR + 6.5 pp
//     Subordinate lien OR first lien on dwelling < $50,000: APOR + 8.5 pp
// (ii) Points-and-fees trigger: total points and fees exceed:
//     5% of loan amount, OR
//     $1,380 floor (2026, FR 2025-22773) for loans below $27,592
// (iii) Prepayment penalty trigger: PP applies > 36 months after consummation,
//     OR total PP can exceed 2% of the prepaid amount
//
// All threshold values pinned to 2026 (FR 2025-22773, effective 2026-01-01).
// CONSUMES: art-220 (lookup_reg_z_thresholds) for threshold table --
//   declare consume; do not duplicate thresholds independently.
// This node tests HOEPA high-cost status only. For HPML escrow: art-235.
//
// Table version: HOEPA-REGZ-2026-01-01
// Source: FR 2025-22773 (effective Jan 1, 2026); 12 CFR §1026.32(a)(1)(i)-(iii)

// HOEPA APR thresholds (§1026.32(a)(1)(i)) -- stable structural thresholds, not CPI-adjusted
const HOEPA_APR = {
  first_lien_standard_pp: 6.5,          // §1026.32(a)(1)(i)(A)
  subordinate_or_small_dwelling_pp: 8.5, // §1026.32(a)(1)(i)(B)-(C): sub lien or dwelling < $50k
  fr_citation: '12 CFR §1026.32(a)(1)(i); Reg Z HOEPA (Homeownership and Equity Protection Act)',
};

// HOEPA points-and-fees thresholds (§1026.32(a)(1)(ii)) -- CPI-adjusted annually
// 2026 values: FR 2025-22773, effective 2026-01-01
// Source aligns with art-220 (lookup_reg_z_thresholds) hoepa table.
const HOEPA_PF = {
  2026: {
    fr_citation: 'FR 2025-22773, effective 2026-01-01; 12 CFR §1026.32(a)(1)(ii)',
    effective: '2026-01-01',
    trigger_pct: 5,      // 5% of loan amount
    trigger_floor: 1380, // dollar floor for small loans (threshold below which floor applies)
    // floor applies when 5% < $1,380, i.e., loans below $27,600 approximately
    // Exact: floor applies when loan_amount * 0.05 < floor_amount
  },
  2025: {
    fr_citation: 'FR 2024-28929, effective 2025-01-01; 12 CFR §1026.32(a)(1)(ii)',
    effective: '2025-01-01',
    trigger_pct: 5,
    trigger_floor: 1345,
  },
};

// HOEPA prepayment penalty trigger (§1026.32(a)(1)(iii)) -- structural, not CPI-adjusted
const HOEPA_PP = {
  max_months: 36,        // PP must not apply > 36 months after consummation
  max_pct_of_loan: 2.0,  // Total PP must not exceed 2% of prepaid amount
  fr_citation: '12 CFR §1026.32(a)(1)(iii)',
};

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};

  const apr_pct = safeNum(pp.apr_pct, 0);
  const apor_pct = safeNum(pp.apor_pct, 0);
  const lien_type = pp.lien_type === 'subordinate' ? 'subordinate' : 'first';
  const is_small_dwelling = Boolean(pp.is_small_dwelling); // dwelling < $50,000
  const loan_amount = safeNum(pp.loan_amount, 0);
  const points_and_fees = safeNum(pp.points_and_fees, 0);
  const has_prepayment_penalty = Boolean(pp.has_prepayment_penalty);
  const pp_period_months = safeNum(pp.prepayment_penalty_period_months, 0);
  const pp_pct = safeNum(pp.prepayment_penalty_pct, 0);
  const year = Math.round(safeNum(pp.year, 2026));

  const pf_data = HOEPA_PF[year] || HOEPA_PF[2026];

  // (i) APR trigger
  const apr_spread = r4(apr_pct - apor_pct);
  const use_subordinate_threshold = (lien_type === 'subordinate') || is_small_dwelling;
  const apr_threshold = use_subordinate_threshold
    ? HOEPA_APR.subordinate_or_small_dwelling_pp
    : HOEPA_APR.first_lien_standard_pp;
  const apr_trigger_met = apr_spread > apr_threshold - 1e-5;

  // (ii) Points-and-fees trigger
  const pf_pct_limit = r2(loan_amount * pf_data.trigger_pct / 100);
  // Applicable limit: greater of pct-based limit and floor (floor protects small loans)
  const pf_limit = pf_pct_limit < pf_data.trigger_floor
    ? pf_data.trigger_floor
    : pf_pct_limit;
  const pf_trigger_met = points_and_fees > pf_limit + 0.005; // 0.5-cent rounding tolerance

  // (iii) Prepayment penalty trigger: fires if PP exists AND
  //       (a) applies beyond 36 months, OR (b) total PP can exceed 2% of prepaid amount
  const pp_exceeds_period = has_prepayment_penalty && pp_period_months > HOEPA_PP.max_months;
  const pp_exceeds_pct = has_prepayment_penalty && pp_pct > HOEPA_PP.max_pct_of_loan - 1e-5;
  const pp_trigger_met = pp_exceeds_period || pp_exceeds_pct;

  const triggers_fired = [];
  if (apr_trigger_met) triggers_fired.push('apr_trigger');
  if (pf_trigger_met) triggers_fired.push('points_fees_trigger');
  if (pp_trigger_met) triggers_fired.push('prepayment_penalty_trigger');

  const is_high_cost = triggers_fired.length > 0;

  const compliance_flags = [];
  if (is_high_cost) compliance_flags.push('HOEPA_HIGH_COST_MORTGAGE');
  if (apr_trigger_met) compliance_flags.push('HOEPA_APR_TRIGGER');
  if (pf_trigger_met) compliance_flags.push('HOEPA_POINTS_FEES_TRIGGER');
  if (pp_trigger_met) compliance_flags.push('HOEPA_PREPAYMENT_PENALTY_TRIGGER');

  const output_payload = {
    is_high_cost,
    triggers_fired,
    apr_trigger_met,
    points_fees_trigger_met: pf_trigger_met,
    prepayment_penalty_trigger_met: pp_trigger_met,
    apr_spread_pct: apr_spread,
    apr_pct: r4(apr_pct),
    apor_pct: r4(apor_pct),
    apr_threshold_pct: apr_threshold,
    apr_threshold_basis: use_subordinate_threshold
      ? 'subordinate_lien_or_small_dwelling_8.5pp'
      : 'first_lien_standard_6.5pp',
    lien_type,
    is_small_dwelling,
    loan_amount: r2(loan_amount),
    points_and_fees: r2(points_and_fees),
    points_fees_limit: r2(pf_limit),
    points_fees_limit_pct: pf_data.trigger_pct,
    points_fees_floor: pf_data.trigger_floor,
    has_prepayment_penalty,
    prepayment_penalty_period_months: pp_period_months,
    prepayment_penalty_pct: r4(pp_pct),
    pp_period_limit_months: HOEPA_PP.max_months,
    pp_pct_limit: HOEPA_PP.max_pct_of_loan,
    year,
    table_version: 'HOEPA-REGZ-2026-01-01',
    fr_citation: pf_data.fr_citation,
    regulatory_basis: '12 CFR §1026.32(a)(1) HOEPA high-cost mortgage trigger test. APR trigger: §1026.32(a)(1)(i). Points-and-fees trigger: §1026.32(a)(1)(ii). Prepayment penalty trigger: §1026.32(a)(1)(iii).',
    consumes: 'art-220 (lookup_reg_z_thresholds) supplies the HOEPA threshold table (table: hoepa). This node pins the same values for local deterministic compute.',
    note: 'HOEPA restrictions apply if ANY trigger is met. APOR must be supplied by caller from FFIEC weekly APOR table (ffiec.gov/ratespread). For HPML escrow requirement: use art-235 (test_hpml_escrow).',
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
