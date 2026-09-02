import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-218-qm-points-and-fees';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_qm_points_and_fees',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Qualified Mortgage points-and-fees test per Reg Z §1026.43(e)(3).
// This node exists because agents reliably hallucinate current-year thresholds.
//
// The tier table is NOT owned here. It lives in `chaingraph/kernels/_regz-thresholds.mjs`,
// the single writer shared with art-220 and art-234, and is copied in below by
// `node scripts/gen-regz-inline.mjs` (the guest cannot resolve a sibling import).
// `node scripts/gen-regz-inline.mjs --check` fails if this copy drifts from the module.
// ⛔ Do not hand-edit the block between the REGZ-SHARED markers — edit the module.
//
// A year outside the pinned range is REFUSED, not silently answered with the newest
// band. Serving next year's query out of this year's table is a wrong answer wearing a
// citation, which is worse than no answer.

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
// differently: the rate thresholds (1.5 / 2.5 / 3.5 pp) are structural and stable as of
// 2026-08-31, while the dollar figure is the TILA §129H appraisal exemption, adjusted
// annually and indexed to CPI-W. It is an APPRAISAL exemption, not an escrow amount.
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
// a docket locator for the widely-reported vacatur could not be opened as of the
// 2026-08-23 retrieval, and an unsourced narrative is not repaired by substituting a
// second unsourced narrative.
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

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

function findTier(loan_amount, tiers) {
  for (const tier of tiers) {
    const min = typeof tier.threshold_min === 'number' ? tier.threshold_min : 0;
    const max = typeof tier.threshold_max === 'number' ? tier.threshold_max : Infinity;
    if (loan_amount >= min && loan_amount <= max) return tier;
  }
  return null;
}

export function compute(pp) {
  pp = pp || {};

  const loan_amount = safeNum(pp.loan_amount, 0);
  const points_and_fees = safeNum(pp.points_and_fees, 0);
  const year = Math.round(safeNum(pp.year, 2026));

  const yearData = REGZ_QM_TIERS[year];
  const available_years = Object.keys(REGZ_QM_TIERS).map(Number).sort((a, b) => a - b);

  // Fail closed. There is no "nearest year" answer to give: a threshold table is the law
  // of one year, and extrapolating it forward produces a confident, cited, wrong number.
  if (!yearData) {
    return {
      output_payload: {
        pass: false,
        error: 'year_not_in_table',
        year,
        available_years,
        note: 'Only years ' + available_years[0] + '-' + available_years[available_years.length - 1] +
              ' are in this version-pinned table.',
      },
      compliance_flags: ['LOOKUP_YEAR_UNAVAILABLE'],
    };
  }

  const tier = findTier(loan_amount, yearData.tiers);

  if (!tier) {
    return {
      output_payload: {
        pass: false, error: 'no_tier_matched', loan_amount: r2(loan_amount),
        points_and_fees: r2(points_and_fees), year,
      },
      compliance_flags: ['QM_TIER_LOOKUP_FAILED'],
    };
  }

  const limit = tier.limit_type === 'pct'
    ? r2(loan_amount * tier.limit_pct / 100)
    : tier.limit_fixed;

  const pass = points_and_fees <= limit + 0.005; // 0.5-cent rounding tolerance
  const headroom = r2(limit - points_and_fees);

  const compliance_flags = [];
  if (!pass) compliance_flags.push('QM_POINTS_AND_FEES_EXCEEDED');

  const output_payload = {
    pass,
    points_and_fees: r2(points_and_fees),
    loan_amount: r2(loan_amount),
    year,
    tier_label: tier.label,
    limit_type: tier.limit_type,
    limit_pct: tier.limit_type === 'pct' ? tier.limit_pct : null,
    limit_fixed: tier.limit_type === 'fixed' ? tier.limit_fixed : null,
    limit: limit,
    headroom,
    fr_citation: regzCiteLong(year, yearData.effective),
    effective_date: yearData.effective,
    regulatory_basis: 'Reg Z §1026.43(e)(3)(ii), QM points-and-fees test',
    note: 'Thresholds are version-pinned. Run lookup_reg_z_thresholds for year-by-year table. Points-and-fees definition: §1026.32(b)(1). Confirm current thresholds at consumerfinance.gov/rules-policy/final-rules.',
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
