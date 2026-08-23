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
//     5% of loan amount, OR the annually adjusted dollar floor for small loans
// (iii) Prepayment penalty trigger: PP applies > 36 months after consummation,
//     OR total PP can exceed 2% of the prepaid amount
//
// CONSUMES art-220 (lookup_reg_z_thresholds), and now actually does. The points-and-fees
// table below is not a private copy that happens to agree: it is projected from
// `chaingraph/kernels/_regz-thresholds.mjs`, the same single-writer module art-220 serves
// its `hoepa` table from, copied in by `node scripts/gen-regz-inline.mjs` because the
// guest cannot resolve a sibling import. `--check` fails if this copy drifts.
// ⛔ Do not hand-edit the block between the REGZ-SHARED markers — edit the module.
//
// This node tests HOEPA high-cost status only. For HPML escrow: art-235.
//
// A year outside the pinned range is REFUSED, not answered from the newest band.

/* ===== inlined _regz-thresholds (RISC0 guest provides only _hash; sibling import is unavailable in-guest) ===== */
// ---- REGZ-SHARED-BEGIN ----
// Federal Register locators for the Reg Z annual threshold adjustment rules.
// `cite` is null where the published page reference is not yet pinned from primary
// text; consumers fall back to an "effective <date>" form rather than invent a page.
const REGZ_FR = {
  2021: { doc: '2020-15900', cite: '85 FR 50944', published: '2020-08-19' },
  2022: { doc: '2021-23478', cite: '86 FR 60357', published: '2021-11-02' },
  2023: { doc: '2022-28023', cite: '87 FR 78831', published: '2022-12-23' },
  2024: { doc: '2023-20476', cite: '88 FR 65113', published: '2023-09-21' },
  2025: { doc: '2024-27553', cite: '89 FR 95080', published: '2024-12-02' },
  2026: { doc: '2025-22773', cite: null, published: null },
};

const REGZ_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Deterministic ISO-date prettifier. Hand-parsed on purpose: no Date object in a kernel.
function regzPrettyDate(iso) {
  const p = String(iso).split('-');
  return REGZ_MONTHS[Number(p[1]) - 1] + ' ' + Number(p[2]) + ', ' + p[0];
}

// "FR 2020-15900 (Aug 19, 2020), 85 FR 50944" | "FR 2025-22773 (effective Jan 1, 2026)"
function regzCiteLong(year, effective) {
  const f = REGZ_FR[year];
  return f.cite
    ? 'FR ' + f.doc + ' (' + regzPrettyDate(f.published) + '), ' + f.cite
    : 'FR ' + f.doc + ' (effective ' + regzPrettyDate(effective) + ')';
}

// "FR 2020-15900, 85 FR 50944" | "FR 2025-22773, effective 2026-01-01"
function regzCiteShort(year, effective) {
  const f = REGZ_FR[year];
  return f.cite ? 'FR ' + f.doc + ', ' + f.cite : 'FR ' + f.doc + ', effective ' + effective;
}

// "FR 2024-27553, 89 FR 95080, effective 2025-01-01; 12 CFR §1026.32(a)(1)(ii)"
function regzCiteHoepa(year, effective) {
  const f = REGZ_FR[year];
  return (f.cite ? 'FR ' + f.doc + ', ' + f.cite + ', ' : 'FR ' + f.doc + ', ')
    + 'effective ' + effective + '; 12 CFR §1026.32(a)(1)(ii)';
}

// QM points-and-fees tier table, §1026.43(e)(3)(ii). Thresholds indexed to CPI-U
// (comment 43(e)(3)(ii)-1: "the annual percentage change in the CPI-U"). CPI-W governs
// the §129H appraisal exemption only, and is not this table's index.
const REGZ_QM_TIERS = {
  2021: {
    effective: '2021-01-01',
    tiers: [
      { threshold_min: 110260, limit_type: 'pct', limit_pct: 3.0, label: '>= $110,260: 3%' },
      { threshold_min: 66156, threshold_max: 110259.99, limit_type: 'fixed', limit_fixed: 3308, label: '$66,156 - $110,259.99: $3,308' },
      { threshold_min: 22052, threshold_max: 66155.99, limit_type: 'pct', limit_pct: 5.0, label: '$22,052 - $66,155.99: 5%' },
      { threshold_min: 13783, threshold_max: 22051.99, limit_type: 'fixed', limit_fixed: 1103, label: '$13,783 - $22,051.99: $1,103' },
      { threshold_max: 13782.99, limit_type: 'pct', limit_pct: 8.0, label: '< $13,783: 8%' },
    ],
  },
  2022: {
    effective: '2022-01-01',
    tiers: [
      { threshold_min: 114847, limit_type: 'pct', limit_pct: 3.0, label: '>= $114,847: 3%' },
      { threshold_min: 68908, threshold_max: 114846.99, limit_type: 'fixed', limit_fixed: 3445, label: '$68,908 - $114,846.99: $3,445' },
      { threshold_min: 22969, threshold_max: 68907.99, limit_type: 'pct', limit_pct: 5.0, label: '$22,969 - $68,907.99: 5%' },
      { threshold_min: 14356, threshold_max: 22968.99, limit_type: 'fixed', limit_fixed: 1148, label: '$14,356 - $22,968.99: $1,148' },
      { threshold_max: 14355.99, limit_type: 'pct', limit_pct: 8.0, label: '< $14,356: 8%' },
    ],
  },
  2023: {
    effective: '2023-01-01',
    tiers: [
      { threshold_min: 124331, limit_type: 'pct', limit_pct: 3.0, label: '>= $124,331: 3%' },
      { threshold_min: 74599, threshold_max: 124330.99, limit_type: 'fixed', limit_fixed: 3730, label: '$74,599 - $124,330.99: $3,730' },
      { threshold_min: 24866, threshold_max: 74598.99, limit_type: 'pct', limit_pct: 5.0, label: '$24,866 - $74,598.99: 5%' },
      { threshold_min: 15541, threshold_max: 24865.99, limit_type: 'fixed', limit_fixed: 1243, label: '$15,541 - $24,865.99: $1,243' },
      { threshold_max: 15540.99, limit_type: 'pct', limit_pct: 8.0, label: '< $15,541: 8%' },
    ],
  },
  2024: {
    effective: '2024-01-01',
    tiers: [
      { threshold_min: 130461, limit_type: 'pct', limit_pct: 3.0, label: '>= $130,461: 3%' },
      { threshold_min: 78277, threshold_max: 130460.99, limit_type: 'fixed', limit_fixed: 3914, label: '$78,277 - $130,460.99: $3,914' },
      { threshold_min: 26092, threshold_max: 78276.99, limit_type: 'pct', limit_pct: 5.0, label: '$26,092 - $78,276.99: 5%' },
      { threshold_min: 16308, threshold_max: 26091.99, limit_type: 'fixed', limit_fixed: 1305, label: '$16,308 - $26,091.99: $1,305' },
      { threshold_max: 16307.99, limit_type: 'pct', limit_pct: 8.0, label: '< $16,308: 8%' },
    ],
  },
  2025: {
    effective: '2025-01-01',
    tiers: [
      { threshold_min: 134841, limit_type: 'pct', limit_pct: 3.0, label: '>= $134,841: 3%' },
      { threshold_min: 80905, threshold_max: 134840.99, limit_type: 'fixed', limit_fixed: 4045, label: '$80,905 - $134,840.99: $4,045' },
      { threshold_min: 26968, threshold_max: 80904.99, limit_type: 'pct', limit_pct: 5.0, label: '$26,968 - $80,904.99: 5%' },
      { threshold_min: 16855, threshold_max: 26967.99, limit_type: 'fixed', limit_fixed: 1348, label: '$16,855 - $26,967.99: $1,348' },
      { threshold_max: 16854.99, limit_type: 'pct', limit_pct: 8.0, label: '< $16,855: 8%' },
    ],
  },
  2026: {
    effective: '2026-01-01',
    tiers: [
      { threshold_min: 137958, limit_type: 'pct', limit_pct: 3.0, label: '>= $137,958: 3%' },
      { threshold_min: 82775, threshold_max: 137957.99, limit_type: 'fixed', limit_fixed: 4139, label: '$82,775 - $137,957.99: $4,139' },
      { threshold_min: 27592, threshold_max: 82774.99, limit_type: 'pct', limit_pct: 5.0, label: '$27,592 - $82,774.99: 5%' },
      { threshold_min: 17245, threshold_max: 27591.99, limit_type: 'fixed', limit_fixed: 1380, label: '$17,245 - $27,591.99: $1,380' },
      { threshold_max: 17244.99, limit_type: 'pct', limit_pct: 8.0, label: '< $17,245: 8%' },
    ],
  },
};

// HOEPA high-cost triggers, §1026.32(a)(1). The rate-spread points are structural and
// do not move with CPI; the points-and-fees dollar floor is the annually adjusted figure.
const REGZ_HOEPA = {
  2021: { effective: '2021-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1103 },
  2022: { effective: '2022-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1148 },
  2023: { effective: '2023-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1243 },
  2024: { effective: '2024-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1305 },
  2025: { effective: '2025-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1348 },
  2026: { effective: '2026-01-01', rate_spread_first_lien_pp: 6.5, rate_spread_sub_lien_pp: 8.5, points_fees_pct: 5, points_fees_floor: 1380 },
};

// HPML, §1026.35. Two different kinds of number share this row and they behave
// differently: the rate thresholds (1.5 / 2.5 / 3.5 pp) are structural and stable,
// while the dollar figure is the TILA §129H appraisal exemption, adjusted annually and
// indexed to CPI-W. It is an APPRAISAL exemption, not an escrow amount.
const REGZ_HPML = {
  2021: { effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, appraisal_exemption_threshold: 27200, appraisal_cite: '85 FR 79385' },
  2022: { effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, appraisal_exemption_threshold: 28500, appraisal_cite: '86 FR 67843' },
  2023: { effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, appraisal_exemption_threshold: 31000, appraisal_cite: '87 FR 63663' },
  2024: { effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, appraisal_exemption_threshold: 32400, appraisal_cite: '88 FR 83311' },
  2025: { effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, appraisal_exemption_threshold: 33500, appraisal_cite: '89 FR 82931' },
  2026: { effective: '2014-01-10', first_lien_pp: 1.5, first_lien_jumbo_pp: 2.5, sub_lien_pp: 3.5, appraisal_exemption_threshold: 34200, appraisal_cite: '90 FR 58141' },
};

// Card Act penalty-fee safe harbors, §1026.52(b)(1)(ii).
//
// ⚠ 2021-2024 ARE UNVERIFIED. The historical penalty-fee series was not retrieved from
// primary text, so those four rows carry the values they were authored with and say so
// in their own note. They are NOT evidence that $30/$41 was correct in those years;
// resolving them needs comment 52(b)(1)(ii)-2's annual-adjustment series.
//
// 2025-2026 are the retrieved rows. No court holding is asserted anywhere in this table:
// a docket locator for the widely-reported vacatur could not be opened, and an unsourced
// narrative is not repaired by substituting a second unsourced narrative.
const REGZ_CARD_UNVERIFIED_NOTE = 'Historical row: the 2021-2024 penalty-fee series was not retrieved from primary text this cycle and is unverified. Do not rely on it; resolve against comment 52(b)(1)(ii)-2 annual-adjustment series.';
const REGZ_CARD_OBSERVED_NOTE = 'As retrieved 2026-08-23 from the eCFR versioner API (content as of 2026-08-20), 12 CFR 1026.52(b)(1)(ii)(A) and (B) read $32 and $43; a separate $8 late-payment safe harbor applies except to smaller card issuers under (b)(1)(ii)(E). The section source note shows its most recent amendment as 89 FR 19202 (2024-03-15).';

const REGZ_CARD_PENALTY = {
  2021: { fr_citation: 'Reg Z §1026.52(b); FR 2013-19978, 78 FR 25818', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: REGZ_CARD_UNVERIFIED_NOTE },
  2022: { fr_citation: 'Reg Z §1026.52(b); FR 2013-19978', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: REGZ_CARD_UNVERIFIED_NOTE },
  2023: { fr_citation: 'Reg Z §1026.52(b); FR 2013-19978', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: REGZ_CARD_UNVERIFIED_NOTE },
  2024: { fr_citation: 'Reg Z §1026.52(b); FR 2013-19978', effective: '2013-08-22', late_fee_first: 30, late_fee_subsequent: 41, returned_payment: 30, over_limit: 30, note: REGZ_CARD_UNVERIFIED_NOTE },
  2025: { fr_citation: 'Reg Z §1026.52(b)(1)(ii)', effective: '2013-08-22', late_fee_first: 32, late_fee_subsequent: 43, returned_payment: 32, over_limit: 32, note: REGZ_CARD_OBSERVED_NOTE },
  2026: { fr_citation: 'Reg Z §1026.52(b)(1)(ii)', effective: '2013-08-22', late_fee_first: 32, late_fee_subsequent: 43, returned_payment: 32, over_limit: 32, note: REGZ_CARD_OBSERVED_NOTE },
};
// ---- REGZ-SHARED-END ----
/* ===== END inlined _regz-thresholds ===== */

// HOEPA APR thresholds (§1026.32(a)(1)(i)) -- stable structural thresholds, not CPI-adjusted
const HOEPA_APR = {
  first_lien_standard_pp: 6.5,          // §1026.32(a)(1)(i)(A)
  subordinate_or_small_dwelling_pp: 8.5, // §1026.32(a)(1)(i)(B)-(C): sub lien or dwelling < $50k
  fr_citation: '12 CFR §1026.32(a)(1)(i); Reg Z HOEPA (Homeownership and Equity Protection Act)',
};

// HOEPA points-and-fees thresholds (§1026.32(a)(1)(ii)) -- CPI-adjusted annually.
// Projected from the shared module, so this node and art-220 cannot disagree by
// construction. The floor applies when loan_amount * 0.05 < trigger_floor.
const HOEPA_PF = {};
for (const y of Object.keys(REGZ_HOEPA).map(Number)) {
  const h = REGZ_HOEPA[y];
  HOEPA_PF[y] = {
    fr_citation: regzCiteHoepa(y, h.effective),
    effective: h.effective,
    trigger_pct: h.points_fees_pct,
    trigger_floor: h.points_fees_floor,
  };
}

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

  const pf_data = HOEPA_PF[year];
  const available_years = Object.keys(HOEPA_PF).map(Number).sort((a, b) => a - b);

  // Fail closed. The previous `|| HOEPA_PF[2026]` answered any out-of-range year with the
  // newest band AND attached that year's citation, so a 2019 query came back as a 2026
  // verdict wearing a 2026 locator. No verdict field is emitted here on purpose: refusing
  // is the answer, and an is_high_cost of false would be a finding this node cannot make.
  if (!pf_data) {
    return {
      output_payload: {
        error: 'year_not_in_table',
        year,
        available_years,
        note: 'Only years ' + available_years[0] + '-' + available_years[available_years.length - 1] +
              ' are in this version-pinned table.',
      },
      compliance_flags: ['LOOKUP_YEAR_UNAVAILABLE'],
    };
  }

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
    table_version: 'HOEPA-REGZ-' + pf_data.effective,
    fr_citation: pf_data.fr_citation,
    regulatory_basis: '12 CFR §1026.32(a)(1) HOEPA high-cost mortgage trigger test. APR trigger: §1026.32(a)(1)(i). Points-and-fees trigger: §1026.32(a)(1)(ii). Prepayment penalty trigger: §1026.32(a)(1)(iii).',
    consumes: 'art-220 (lookup_reg_z_thresholds) serves the HOEPA threshold table (table: hoepa). This node does not keep a second copy of it: both project the same single-writer module, chaingraph/kernels/_regz-thresholds.mjs, so the two cannot drift apart.',
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
