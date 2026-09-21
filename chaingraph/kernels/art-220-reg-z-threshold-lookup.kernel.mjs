import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-220-reg-z-threshold-lookup';
const TOOL_VERSION = '1.1.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lookup_reg_z_thresholds',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Reg Z threshold lookup service.
// This node exists because agents reliably hallucinate current-year dollar thresholds.
// Tables: qm_points_fees | hoepa | hpml | card_penalty
// All values version-pinned with Federal Register citations.
// Input: { year, table } → returns the full threshold row for that year.

// ---- QM POINTS-AND-FEES (§1026.43(e)(3)) ----
// Values and citations pinned from the CFPB annual threshold-adjustment notices
// (primary-text snapshots: research/clause-snapshots/ART220-QM-HOEPA-THRESHOLDS-FR-2021-2026-*.md).
const QM_POINTS_FEES = {
  2021: { fr_citation: 'FR 2020-15900, 85 FR 50944', effective: '2021-01-01', tier_1_min: 110260, tier_1_pct: 3, tier_2_fixed: 3308, tier_3_min: 22052, tier_3_pct: 5, tier_4_fixed: 1103, tier_5_pct: 8 },
  2022: { fr_citation: 'FR 2021-23478, 86 FR 60357', effective: '2022-01-01', tier_1_min: 114847, tier_1_pct: 3, tier_2_fixed: 3445, tier_3_min: 22969, tier_3_pct: 5, tier_4_fixed: 1148, tier_5_pct: 8 },
  2023: { fr_citation: 'FR 2022-28023, 87 FR 78831', effective: '2023-01-01', tier_1_min: 124331, tier_1_pct: 3, tier_2_fixed: 3730, tier_3_min: 24866, tier_3_pct: 5, tier_4_fixed: 1243, tier_5_pct: 8 },
  2024: { fr_citation: 'FR 2023-20476, 88 FR 65113', effective: '2024-01-01', tier_1_min: 130461, tier_1_pct: 3, tier_2_fixed: 3914, tier_3_min: 26092, tier_3_pct: 5, tier_4_fixed: 1305, tier_5_pct: 8 },
  2025: { fr_citation: 'FR 2024-27553, 89 FR 95080', effective: '2025-01-01', tier_1_min: 134841, tier_1_pct: 3, tier_2_fixed: 4045, tier_3_min: 26968, tier_3_pct: 5, tier_4_fixed: 1348, tier_5_pct: 8 },
  2026: { fr_citation: 'FR 2025-22773, 90 FR 57890', effective: '2026-01-01', tier_1_min: 137958, tier_1_pct: 3, tier_2_fixed: 4139, tier_3_min: 27592, tier_3_pct: 5, tier_4_fixed: 1380, tier_5_pct: 8 },
};

// ---- HOEPA HIGH-COST MORTGAGE (§1026.32(a)(1)) ----
// HOEPA rate spread trigger: APR > APOR + threshold pp
// HOEPA points-and-fees trigger (as % of loan or fixed floor)
const HOEPA = {
  2021: { fr_citation: 'FR 2020-15900, 85 FR 50944', effective: '2021-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1103 },
  2022: { fr_citation: 'FR 2021-23478, 86 FR 60357', effective: '2022-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1148 },
  2023: { fr_citation: 'FR 2022-28023, 87 FR 78831', effective: '2023-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1243 },
  2024: { fr_citation: 'FR 2023-20476, 88 FR 65113', effective: '2024-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1305 },
  // 2025 corrected from FR 2024-28929 / 1345 to the primary text (ART220-HOEPA-2025-CONSTANT-FIX-1,
  // folded into PR #1862; ruling 2026-09-11T23:28Z -- parity is restored by fixing art-220, never by
  // changing art-234 back). FR 2024-27553, 89 FR 95080: "Effective January 1, 2025, for purposes of
  // determining under Sec. 1026.32(a)(1)(ii) the points-and-fees coverage test under HOEPA to which a
  // transaction is subject, the total loan amount threshold figure is $26,968, and the adjusted
  // points-and-fees dollar trigger under Sec. 1026.32(a)(1)(ii)(B) is $1,348."
  2025: { fr_citation: 'FR 2024-27553, 89 FR 95080', effective: '2025-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1348 },
  2026: { fr_citation: 'FR 2025-22773, 90 FR 57890', effective: '2026-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1380 },
};

// ---- HPML HIGHER-PRICED MORTGAGE (§1026.35) ----
// HPML trigger: APR exceeds APOR by threshold pp
// (1.5 pp for first lien; 2.5 pp for jumbo first lien >= FHFA conforming limit; 3.5 pp for sub lien)
// These rate triggers are set by Dodd-Frank and do NOT change annually - stable since 2014-01-10 (that effective date rides each row's own `effective` field; re-verified as of 2026-09-20).
//
// FIELD RENAME (ART220-CARD-PENALTY-RECORD section 6c, adjudicated 2026-09-08): the annual dollar
// figure on these rows was mislabelled `escrow_exemption_threshold`. It is not the escrow
// exemption. That exemption is an ASSET-SIZE test on the creditor, denominated in billions and
// adjusted by its own separate annual rule (FR 2026-00085, 2026-01-07, $2.785 billion for 2026).
// The 27,200 / 28,500 / 31,000 / 32,400 / 33,500 / 34,200 series is instead the SPECIAL-APPRAISAL
// exemption for smaller loans, adjusted by the joint OCC / Board / Bureau rule titled "Appraisals
// for Higher-Priced Mortgage Loans Exemption Threshold". Each row's own fr_citation pins that
// year's joint rule, verbatim amounts.
// ⚠ The pre-rebase branch pinned the 2026 figure to FR 2025-22773; that attribution is wrong
// (2025-22773 does not amend, cite or mention this part anywhere - record section 7f) and main's
// 34,500 matched no published year. Both are corrected here.
const HPML = {
  2021: { fr_citation: 'Reg Z §1026.35(a)(1) rate triggers unchanged since 2014; §1026.35(c)(2)(ii) special-appraisal exemption FR 2020-25872, 85 FR 79385 (eff. 2021-01-01)', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, hpml_special_appraisal_exemption_threshold: 27200 },
  2022: { fr_citation: 'Reg Z §1026.35(a)(1) rate triggers unchanged since 2014; §1026.35(c)(2)(ii) special-appraisal exemption FR 2021-25908, 86 FR 67843 (eff. 2022-01-01)', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, hpml_special_appraisal_exemption_threshold: 28500 },
  2023: { fr_citation: 'Reg Z §1026.35(a)(1) rate triggers unchanged since 2014; §1026.35(c)(2)(ii) special-appraisal exemption FR 2022-22820, 87 FR 63663 (eff. 2023-01-01)', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, hpml_special_appraisal_exemption_threshold: 31000 },
  2024: { fr_citation: 'Reg Z §1026.35(a)(1) rate triggers unchanged since 2014; §1026.35(c)(2)(ii) special-appraisal exemption FR 2023-25047, 88 FR 83311 (eff. 2024-01-01)', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, hpml_special_appraisal_exemption_threshold: 32400 },
  2025: { fr_citation: 'Reg Z §1026.35(a)(1) rate triggers unchanged since 2014; §1026.35(c)(2)(ii) special-appraisal exemption FR 2024-23277, 89 FR 82931 (eff. 2025-01-01)', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, hpml_special_appraisal_exemption_threshold: 33500 },
  2026: { fr_citation: 'Reg Z §1026.35(a)(1) rate triggers unchanged since 2014; §1026.35(c)(2)(ii) special-appraisal exemption FR 2025-22875, 90 FR 58141 (eff. 2026-01-01)', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, hpml_special_appraisal_exemption_threshold: 34200 },
};

// ---- CARD ACT PENALTY FEES (Reg Z 1026.52(b), Subpart G) ----
// ⚠ THIS TABLE IS ADJUDICATED. Read board/done/ART220-CARD-PENALTY-RECORD-1.md and
// research/ART220-CARD-PENALTY-RECORD-2026-09-08.md sections 6-7 before changing a figure, and do
// NOT re-derive it from the eCFR face text: the eCFR still PRINTS a provision a federal court
// voided, and printed is not in force. This is the exact hallucination class the node exists to
// block, and an earlier revision of this very kernel fell into it.
//
// THE VACATUR (FR 2024-05011; re-verified as of 2026-09-20), pinned to the primary record:
// the CFPB Credit Card Penalty Fees Final Rule
// (89 FR 19128, FR doc 2024-05011) introduced an $8 late-payment cap for larger issuers. It was
// preliminarily enjoined 2024-05-10, FOUR DAYS before its 2024-05-14 effective date, so it was
// never operative for a single day, and was then VACATED 2025-04-15 under 5 U.S.C. 706(2) on the
// parties' joint consent motion in Chamber of Commerce of the United States of America v. CFPB,
// No. 4:24-cv-00213-P (N.D. Tex., Fort Worth Div., Pittman, J.). No appeal.
// Docket: https://www.courtlistener.com/docket/68319595/
// No agency removal document has been published, so the void $8 text is still printed in the
// eCFR at its 2026-09-03 currency. eCFR currency is not force-of-law currency.
//
// CONSEQUENCE FOR THE VALUES (re-verified as of 2026-09-20): the vacatur voids the 2024
// carve-out, not the general branch. So the
// general penalty-fee safe harbor each row's fr_citation names stands as ONE rule covering late
// fees and other violations alike, at its current CPI-adjusted amounts: $32 for a first violation,
// $43 for each subsequent violation of the same type within the same or next six billing cycles.
// There is no separate late-fee number in force. The 2026 annual threshold adjustment
// (FR 2025-22773, 90 FR 57890, eff. 2026-01-01) did NOT move them: a verbatim full-text read
// returned ZERO occurrences of "1026.52", and its only amendatory instructions revise
// Supplement I comments to other parts of Reg Z (record sections 7c / 7d).
const CARD_PENALTY_NOTE_PRE2024 = 'General penalty-fee safe harbor under 12 CFR 1026.52(b)(1)(ii)(A)/(B), covering late fees and other violations alike. As retrieved 2026-09-03 from the eCFR versioner API, the paragraph read $29 first / $40 subsequent for 2021 (last adjusted 84 FR 37567) and $30 / $41 from 2022-01-01 (86 FR 60360).';
const CARD_PENALTY_NOTE_2024ON = 'General penalty-fee safe harbor under 12 CFR 1026.52(b)(1)(ii)(A)/(B): $32 for a first violation, $43 for each subsequent violation of the same type within the same or next six billing cycles. It covers late fees and other violations alike. The CFPB $8 late-fee cap (89 FR 19128) is VOID and never took operative effect: preliminarily enjoined 2024-05-10, four days before its 2024-05-14 effective date, and vacated 2025-04-15 under 5 U.S.C. 706(2) in Chamber of Commerce v. CFPB, No. 4:24-cv-00213-P (N.D. Tex.), docket https://www.courtlistener.com/docket/68319595/ . No agency removal document has been published, so the void $8 text is still printed in the eCFR (currency 2026-09-03); printed is not in force. FR 2025-22773, 90 FR 57890 did not readjust these amounts for the 2026 cycle.';
const CARD_PENALTY = {
  2021: { fr_citation: 'Reg Z §1026.52(b)(1)(ii)(A)/(B); 84 FR 37567', effective: '2019-08-01', late_fee_first: 29, late_fee_subsequent: 40, returned_payment: 29, over_limit: 29, note: CARD_PENALTY_NOTE_PRE2024 },
  2022: { fr_citation: 'Reg Z §1026.52(b)(1)(ii)(A)/(B); 86 FR 60360', effective: '2022-01-01', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: CARD_PENALTY_NOTE_PRE2024 },
  2023: { fr_citation: 'Reg Z §1026.52(b)(1)(ii)(A)/(B); 86 FR 60360', effective: '2022-01-01', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: CARD_PENALTY_NOTE_PRE2024 },
  2024: { fr_citation: 'Reg Z §1026.52(b)(1)(ii)(A)/(B) as printed at eCFR currency 2026-09-03; the $8 branch of 89 FR 19128 is void ab initio (N.D. Tex. 4:24-cv-00213-P, 2025-04-15)', effective: '2024-01-01', late_fee_first: 32, late_fee_subsequent: 43, returned_payment: 32, over_limit: 32, note: CARD_PENALTY_NOTE_2024ON },
  2025: { fr_citation: 'Reg Z §1026.52(b)(1)(ii)(A)/(B) as printed at eCFR currency 2026-09-03; the $8 branch of 89 FR 19128 is void ab initio (N.D. Tex. 4:24-cv-00213-P, 2025-04-15)', effective: '2025-01-01', late_fee_first: 32, late_fee_subsequent: 43, returned_payment: 32, over_limit: 32, note: CARD_PENALTY_NOTE_2024ON },
  2026: { fr_citation: 'Reg Z §1026.52(b)(1)(ii)(A)/(B) as printed at eCFR currency 2026-09-03, not readjusted by FR 2025-22773, 90 FR 57890; the $8 branch of 89 FR 19128 is void ab initio (N.D. Tex. 4:24-cv-00213-P, 2025-04-15)', effective: '2026-01-01', late_fee_first: 32, late_fee_subsequent: 43, returned_payment: 32, over_limit: 32, note: CARD_PENALTY_NOTE_2024ON },
};

const TABLES = {
  qm_points_fees: QM_POINTS_FEES,
  hoepa: HOEPA,
  hpml: HPML,
  card_penalty: CARD_PENALTY,
};

const VALID_TABLES = Object.keys(TABLES);

// Single-writer export (ART220-TABLE-SINGLE-WRITER-1): the node page's TABLES block is
// generated from this object by scripts/check-art220-table-parity.mjs; the page never
// hand-maintains a second copy of these constants.
export const THRESHOLD_TABLES = TABLES;

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

export function compute(pp) {
  pp = pp || {};

  const year = Math.round(safeNum(pp.year, 2026));
  const table = String(pp.table || 'qm_points_fees');

  if (!VALID_TABLES.includes(table)) {
    return {
      output_payload: {
        error: 'unknown_table', table, valid_tables: VALID_TABLES,
        year, note: 'Supported tables: qm_points_fees, hoepa, hpml, card_penalty',
      },
      compliance_flags: ['LOOKUP_TABLE_UNKNOWN'],
    };
  }

  const tableData = TABLES[table];
  const row = tableData[year];
  const available_years = Object.keys(tableData).map(Number).sort((a, b) => a - b);

  if (!row) {
    return {
      output_payload: {
        error: 'year_not_in_table', table, year, available_years,
        note: 'Only years ' + available_years[0] + '-' + available_years[available_years.length - 1] + ' are in this version-pinned table.',
      },
      compliance_flags: ['LOOKUP_YEAR_UNAVAILABLE'],
    };
  }

  const output_payload = {
    table,
    year,
    available_years,
    data: row,
    regulatory_basis: 'Reg Z 12 CFR 1026 (version-pinned threshold table)',
    note: 'This node exists because agents hallucinate current-year dollar thresholds. Values are pinned at build time; refresh yearly. Always verify at consumerfinance.gov for the latest effective rule.',
  };

  return { output_payload, compliance_flags: [] };
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
