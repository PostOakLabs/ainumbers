import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-220-reg-z-threshold-lookup';
const TOOL_VERSION = '1.0.0';

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
const QM_POINTS_FEES = {
  2021: { fr_citation: 'FR 2021-23478, 86 FR 60357 (2021 amounts per its historical list)', effective: '2021-01-01', tier_1_min: 110260, tier_1_pct: 3, tier_2_fixed: 3308, tier_3_min: 22052, tier_3_pct: 5, tier_4_fixed: 1103, tier_5_pct: 8 },
  2022: { fr_citation: 'FR 2021-23478, 86 FR 60357', effective: '2022-01-01', tier_1_min: 114847, tier_1_pct: 3, tier_2_fixed: 3445, tier_3_min: 22969, tier_3_pct: 5, tier_4_fixed: 1148, tier_5_pct: 8 },
  2023: { fr_citation: 'FR 2022-28023, 87 FR 78831', effective: '2023-01-01', tier_1_min: 124331, tier_1_pct: 3, tier_2_fixed: 3730, tier_3_min: 24866, tier_3_pct: 5, tier_4_fixed: 1243, tier_5_pct: 8 },
  2024: { fr_citation: 'FR 2023-20476, 88 FR 65113', effective: '2024-01-01', tier_1_min: 130461, tier_1_pct: 3, tier_2_fixed: 3914, tier_3_min: 26092, tier_3_pct: 5, tier_4_fixed: 1305, tier_5_pct: 8 },
  2025: { fr_citation: 'FR 2024-27553, 89 FR 95080', effective: '2025-01-01', tier_1_min: 134841, tier_1_pct: 3, tier_2_fixed: 4045, tier_3_min: 26968, tier_3_pct: 5, tier_4_fixed: 1348, tier_5_pct: 8 },
  2026: { fr_citation: 'FR 2025-22773, effective 2026-01-01', effective: '2026-01-01', tier_1_min: 137958, tier_1_pct: 3, tier_2_fixed: 4139, tier_3_min: 27592, tier_3_pct: 5, tier_4_fixed: 1380, tier_5_pct: 8 },
};

// ---- HOEPA HIGH-COST MORTGAGE (§1026.32(a)(1)) ----
// HOEPA rate spread trigger: APR > APOR + threshold pp
// HOEPA points-and-fees trigger (as % of loan or fixed floor)
const HOEPA = {
  2021: { fr_citation: 'FR 2021-23478, 86 FR 60357 (2021 amounts per its historical list)', effective: '2021-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1103 },
  2022: { fr_citation: 'FR 2021-23478, 86 FR 60357', effective: '2022-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1148 },
  2023: { fr_citation: 'FR 2022-28023, 87 FR 78831', effective: '2023-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1243 },
  2024: { fr_citation: 'FR 2023-20476, 88 FR 65113', effective: '2024-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1305 },
  2025: { fr_citation: 'FR 2024-27553, 89 FR 95080', effective: '2025-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1348 },
  2026: { fr_citation: 'FR 2025-22773, effective 2026-01-01', effective: '2026-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1380 },
};

// ---- HPML HIGHER-PRICED MORTGAGE (§1026.35) ----
// HPML trigger: APR exceeds APOR by threshold pp
// (1.5 pp for first lien; 2.5 pp for jumbo first lien >= FHFA conforming limit; 3.5 pp for sub lien)
// The pp thresholds are set by Dodd-Frank and do NOT change annually.
// The special-appraisal exemption threshold below is adjusted annually by the
// joint OCC/Federal Reserve/CFPB notices (see fr_citation per year).
const HPML = {
  2021: { fr_citation: 'Reg Z §1026.35(a)(1), (c)(2)(ii); FR 2020-25872, 85 FR 79385', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, hpml_special_appraisal_exemption_threshold: 27200 },
  2022: { fr_citation: 'Reg Z §1026.35(a)(1), (c)(2)(ii); FR 2021-25908, 86 FR 67843', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, hpml_special_appraisal_exemption_threshold: 28500 },
  2023: { fr_citation: 'Reg Z §1026.35(a)(1), (c)(2)(ii); FR 2022-22820, 87 FR 63663', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, hpml_special_appraisal_exemption_threshold: 31000 },
  2024: { fr_citation: 'Reg Z §1026.35(a)(1), (c)(2)(ii); FR 2023-25047, 88 FR 83311', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, hpml_special_appraisal_exemption_threshold: 32400 },
  2025: { fr_citation: 'Reg Z §1026.35(a)(1), (c)(2)(ii); FR 2024-23277, 89 FR 82931', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, hpml_special_appraisal_exemption_threshold: 33500 },
  2026: { fr_citation: 'Reg Z §1026.35(a)(1), (c)(2)(ii); FR 2025-22875, 90 FR 58141', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, hpml_special_appraisal_exemption_threshold: 34200 },
};

// ---- CARD ACT PENALTY FEES (§1026.52(b)) ----
// Safe-harbor penalty-fee amounts: 2023 $30/$41; 2024-2026 $32/$43 (first/subsequent),
// per the annual adjustments cited in each row's fr_citation. The larger-issuer
// $8 interval (2024-05-14 to 2025-04-15) is NOT modeled — scoped out in the row notes.
const CARD_PENALTY = {
  2021: { fr_citation: 'Reg Z §1026.52(b); FR 2013-19978, 78 FR 25818', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: 'Pre-2024 safe harbors; the $30/$41 amounts are confirmed in the 2024 adjustment rule\'s restatement of then-current amounts.' },
  2022: { fr_citation: 'Reg Z §1026.52(b); FR 2013-19978', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: 'Pre-2024 safe harbors; the $30/$41 amounts are confirmed in the 2024 adjustment rule\'s restatement of then-current amounts.' },
  2023: { fr_citation: 'Reg Z §1026.52(b); FR 2013-19978', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: 'Pre-2024 safe harbors; the $30/$41 amounts are confirmed in the 2024 adjustment rule\'s restatement of then-current amounts.' },
  2024: { fr_citation: 'Reg Z §1026.52(b); FR 2024-05011, 89 FR 19128', effective: '2024-05-14', late_fee_first: 32, late_fee_subsequent: 43, returned_payment: 32, over_limit: 32, note: '$32/$43 safe harbors effective 2024-05-14. The $8 single late-fee amount for larger issuers (>=1M open accounts) was operative only 2024-05-14 to 2025-04-15; that interval is not modeled here (scoped out).' },
  2025: { fr_citation: 'Reg Z §1026.52(b); FR 2024-05011, 89 FR 19128 (amounts unchanged in 2025)', effective: '2024-05-14', late_fee_first: 32, late_fee_subsequent: 43, returned_payment: 32, over_limit: 32, note: 'Flat from 2024 (no 2025 adjustment document). The $8 larger-issuer rule was vacated 2025-04-15 by consent judgment (N.D. Tex. No. 4:24-cv-00213-P); the pre-rule framework including annual indexing resumed. The 2024-05-14 to 2025-04-15 larger-issuer interval is not modeled (scoped out).' },
  2026: { fr_citation: 'Reg Z §1026.52(b); FR 2024-05011, 89 FR 19128 (amounts unchanged in 2026)', effective: '2024-05-14', late_fee_first: 32, late_fee_subsequent: 43, returned_payment: 32, over_limit: 32, note: 'Flat from 2024 (no 2026 adjustment document). The 2024-05-14 to 2025-04-15 larger-issuer interval is not modeled (scoped out).' },
};

const TABLES = {
  qm_points_fees: QM_POINTS_FEES,
  hoepa: HOEPA,
  hpml: HPML,
  card_penalty: CARD_PENALTY,
};

const VALID_TABLES = Object.keys(TABLES);

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
    note: 'This node exists because agents hallucinate current-year dollar thresholds. All rows and citations verified against the cited Federal Register instruments on 2026-09-01. Coverage is version-pinned 2021-2026; the figures are a dated observation as of that verification, not a standing promise of currency.',
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
