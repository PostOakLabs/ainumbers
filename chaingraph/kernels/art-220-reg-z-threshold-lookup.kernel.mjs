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
  2021: { fr_citation: 'FR 2020-27416, 85 FR 83720', effective: '2021-01-01', tier_1_min: 110260, tier_1_pct: 3, tier_2_fixed: 3308, tier_3_min: 22052, tier_3_pct: 5, tier_4_fixed: 1103, tier_5_pct: 8 },
  2022: { fr_citation: 'FR 2021-27322, 86 FR 71487', effective: '2022-01-01', tier_1_min: 114847, tier_1_pct: 3, tier_2_fixed: 3445, tier_3_min: 22969, tier_3_pct: 5, tier_4_fixed: 1148, tier_5_pct: 8 },
  2023: { fr_citation: 'FR 2022-27762, 87 FR 77143', effective: '2023-01-01', tier_1_min: 124331, tier_1_pct: 3, tier_2_fixed: 3730, tier_3_min: 24866, tier_3_pct: 5, tier_4_fixed: 1243, tier_5_pct: 8 },
  2024: { fr_citation: 'FR 2023-27060, 88 FR 86062', effective: '2024-01-01', tier_1_min: 130867, tier_1_pct: 3, tier_2_fixed: 3926, tier_3_min: 26173, tier_3_pct: 5, tier_4_fixed: 1309, tier_5_pct: 8 },
  2025: { fr_citation: 'FR 2024-28929, 89 FR 99882', effective: '2025-01-01', tier_1_min: 134500, tier_1_pct: 3, tier_2_fixed: 4035, tier_3_min: 26900, tier_3_pct: 5, tier_4_fixed: 1345, tier_5_pct: 8 },
  2026: { fr_citation: 'FR 2025-22773, effective 2026-01-01', effective: '2026-01-01', tier_1_min: 137958, tier_1_pct: 3, tier_2_fixed: 4139, tier_3_min: 27592, tier_3_pct: 5, tier_4_fixed: 1380, tier_5_pct: 8 },
};

// ---- HOEPA HIGH-COST MORTGAGE (§1026.32(a)(1)) ----
// HOEPA rate spread trigger: APR > APOR + threshold pp
// HOEPA points-and-fees trigger (as % of loan or fixed floor)
const HOEPA = {
  2021: { fr_citation: 'FR 2020-27416, 85 FR 83720', effective: '2021-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1103 },
  2022: { fr_citation: 'FR 2021-27322, 86 FR 71487', effective: '2022-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1148 },
  2023: { fr_citation: 'FR 2022-27762, 87 FR 77143', effective: '2023-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1243 },
  2024: { fr_citation: 'FR 2023-27060, 88 FR 86062', effective: '2024-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1309 },
  2025: { fr_citation: 'FR 2024-28929, 89 FR 99882', effective: '2025-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1345 },
  2026: { fr_citation: 'FR 2025-22773, effective 2026-01-01', effective: '2026-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1380 },
};

// ---- HPML HIGHER-PRICED MORTGAGE (§1026.35) ----
// HPML trigger: APR exceeds APOR by threshold pp
// (1.5 pp for first lien; 2.5 pp for jumbo first lien >= FHFA conforming limit; 3.5 pp for sub lien)
// These thresholds are set by Dodd-Frank and do NOT change annually — stable.
const HPML = {
  2021: { fr_citation: 'Dodd-Frank Act §1412; Reg Z §1026.35(a)(1); unchanged since 2014', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, escrow_exemption_threshold: 27200 },
  2022: { fr_citation: 'Reg Z §1026.35(a)(1); unchanged since 2014', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, escrow_exemption_threshold: 28500 },
  2023: { fr_citation: 'Reg Z §1026.35(a)(1); FR 2022-27762 (escrow threshold)', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, escrow_exemption_threshold: 31000 },
  2024: { fr_citation: 'Reg Z §1026.35(a)(1); FR 2023-27060 (escrow threshold)', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, escrow_exemption_threshold: 32000 },
  2025: { fr_citation: 'Reg Z §1026.35(a)(1); FR 2024-28929 (escrow threshold)', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, escrow_exemption_threshold: 33500 },
  2026: { fr_citation: 'Reg Z §1026.35(a)(1); FR 2025-22773 (escrow threshold)', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, escrow_exemption_threshold: 34500 },
};

// ---- CARD ACT PENALTY FEES (§1026.52(b)) ----
// The CFPB $8 late-fee safe-harbor rule was VACATED May 2025; the previous safe-harbor applies.
// Late fee safe harbor: $30 first occurrence, $41 subsequent (unchanged since 2013).
// Over-limit and returned-payment: $30 safe harbor.
// These are statutory safe harbors set by rulemaking; exact amounts version-pinned here.
const CARD_PENALTY = {
  2021: { fr_citation: 'Reg Z §1026.52(b); FR 2013-19978, 78 FR 25818', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: '$8 cap rule vacated May 2025; safe-harbor amounts unchanged since 2013.' },
  2022: { fr_citation: 'Reg Z §1026.52(b); FR 2013-19978', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: 'Safe-harbor amounts unchanged since 2013.' },
  2023: { fr_citation: 'Reg Z §1026.52(b); FR 2013-19978', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: 'Safe-harbor amounts unchanged since 2013.' },
  2024: { fr_citation: 'Reg Z §1026.52(b); FR 2013-19978; CFPB 2024 $8 rule proposed (not effective)', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: 'CFPB proposed $8 late-fee cap NOT in effect in 2024; safe-harbor amounts unchanged.' },
  2025: { fr_citation: 'Reg Z §1026.52(b); FR 2013-19978; CFPB $8 rule VACATED May 2025', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: '$8 CFPB late-fee cap rule vacated May 2025 by Fifth Circuit; prior safe-harbor applies.' },
  2026: { fr_citation: 'Reg Z §1026.52(b); FR 2013-19978; $8 rule vacated 2025', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: 'Safe-harbor amounts unchanged since 2013. $8 rule vacated 2025.' },
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
