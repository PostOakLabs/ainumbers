// RED CONTROL — a deliberately perturbed scratch copy of art-220's threshold service.
//
// ⛔ NOT A KERNEL. This file is never loaded by any node, chain, manifest or gate. It
// exists so the consistency harness can be shown catching a defect it was built to
// catch, on a copy, without touching a real kernel. Its filename deliberately does not
// end in `.kernel.mjs`.
//
// THE PERTURBATION, and only this one: the 2025 qm_points_fees row carries the 2024
// figures. That is the historical shape the estate has already paid for once — a
// yearly threshold table where one year silently kept the prior year's numbers — and
// it is invisible to every per-kernel fixture suite, because each kernel's fixtures
// are regenerated from the kernel's own table and therefore agree with the stale row.
// Only a CROSS-kernel property, comparing this publisher against an applier that has
// the correct 2025 numbers, can see it.
//
// Every other value below is a verbatim copy of art-220 at the commit this control was
// written against. The two perturbed values are marked inline.

const QM_POINTS_FEES = {
  2021: { fr_citation: 'FR 2020-27416, 85 FR 83720', effective: '2021-01-01', tier_1_min: 110260, tier_1_pct: 3, tier_2_fixed: 3308, tier_3_min: 22052, tier_3_pct: 5, tier_4_fixed: 1103, tier_5_pct: 8 },
  2022: { fr_citation: 'FR 2021-27322, 86 FR 71487', effective: '2022-01-01', tier_1_min: 114847, tier_1_pct: 3, tier_2_fixed: 3445, tier_3_min: 22969, tier_3_pct: 5, tier_4_fixed: 1148, tier_5_pct: 8 },
  2023: { fr_citation: 'FR 2022-27762, 87 FR 77143', effective: '2023-01-01', tier_1_min: 124331, tier_1_pct: 3, tier_2_fixed: 3730, tier_3_min: 24866, tier_3_pct: 5, tier_4_fixed: 1243, tier_5_pct: 8 },
  2024: { fr_citation: 'FR 2023-27060, 88 FR 86062', effective: '2024-01-01', tier_1_min: 130867, tier_1_pct: 3, tier_2_fixed: 3926, tier_3_min: 26173, tier_3_pct: 5, tier_4_fixed: 1309, tier_5_pct: 8 },
  // ⚠ PERTURBED ROW. Correct 2025 values are tier_1_min 134500 / tier_2_fixed 4035 /
  // tier_3_min 26900 / tier_4_fixed 1345. Here tier_1_min and tier_2_fixed have kept
  // the 2024 figures, as if the yearly refresh had missed two cells.
  2025: { fr_citation: 'FR 2024-28929, 89 FR 99882', effective: '2025-01-01', tier_1_min: 130867, tier_1_pct: 3, tier_2_fixed: 3926, tier_3_min: 26900, tier_3_pct: 5, tier_4_fixed: 1345, tier_5_pct: 8 },
  2026: { fr_citation: 'FR 2025-22773, effective 2026-01-01', effective: '2026-01-01', tier_1_min: 137958, tier_1_pct: 3, tier_2_fixed: 4139, tier_3_min: 27592, tier_3_pct: 5, tier_4_fixed: 1380, tier_5_pct: 8 },
};

const HOEPA = {
  2021: { fr_citation: 'FR 2020-27416, 85 FR 83720', effective: '2021-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1103 },
  2022: { fr_citation: 'FR 2021-27322, 86 FR 71487', effective: '2022-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1148 },
  2023: { fr_citation: 'FR 2022-27762, 87 FR 77143', effective: '2023-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1243 },
  2024: { fr_citation: 'FR 2023-27060, 88 FR 86062', effective: '2024-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1309 },
  2025: { fr_citation: 'FR 2024-28929, 89 FR 99882', effective: '2025-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1345 },
  2026: { fr_citation: 'FR 2025-22773, effective 2026-01-01', effective: '2026-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1380 },
};

const HPML = {
  2021: { fr_citation: 'Dodd-Frank Act 1412; Reg Z 1026.35(a)(1); unchanged since 2014', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, escrow_exemption_threshold: 27200 },
  2022: { fr_citation: 'Reg Z 1026.35(a)(1); unchanged since 2014', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, escrow_exemption_threshold: 28500 },
  2023: { fr_citation: 'Reg Z 1026.35(a)(1); FR 2022-27762 (escrow threshold)', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, escrow_exemption_threshold: 31000 },
  2024: { fr_citation: 'Reg Z 1026.35(a)(1); FR 2023-27060 (escrow threshold)', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, escrow_exemption_threshold: 32000 },
  2025: { fr_citation: 'Reg Z 1026.35(a)(1); FR 2024-28929 (escrow threshold)', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, escrow_exemption_threshold: 33500 },
  2026: { fr_citation: 'Reg Z 1026.35(a)(1); FR 2025-22773 (escrow threshold)', effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, escrow_exemption_threshold: 34500 },
};

const CARD_PENALTY = {
  2021: { fr_citation: 'Reg Z 1026.52(b); FR 2013-19978, 78 FR 25818', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30 },
  2022: { fr_citation: 'Reg Z 1026.52(b); FR 2013-19978', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30 },
  2023: { fr_citation: 'Reg Z 1026.52(b); FR 2013-19978', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30 },
  2024: { fr_citation: 'Reg Z 1026.52(b); FR 2013-19978', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30 },
  2025: { fr_citation: 'Reg Z 1026.52(b); FR 2013-19978', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30 },
  2026: { fr_citation: 'Reg Z 1026.52(b); FR 2013-19978', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30 },
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
      output_payload: { error: 'unknown_table', table, valid_tables: VALID_TABLES, year },
      compliance_flags: ['LOOKUP_TABLE_UNKNOWN'],
    };
  }

  const tableData = TABLES[table];
  const row = tableData[year];
  const available_years = Object.keys(tableData).map(Number).sort((a, b) => a - b);

  if (!row) {
    return {
      output_payload: { error: 'year_not_in_table', table, year, available_years },
      compliance_flags: ['LOOKUP_YEAR_UNAVAILABLE'],
    };
  }

  return {
    output_payload: {
      table, year, available_years, data: row,
      regulatory_basis: 'RED CONTROL COPY — not a published threshold service.',
    },
    compliance_flags: [],
  };
}
