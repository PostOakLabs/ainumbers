// art-762-irmaa-bracket-calculator — APEXPORT-150 landed kernel (Tier 2 port of
// ApexLogics #150 "IRMAA Bracket Calculator", CC BY 4.0 sister suite).
//
// PORT OF: ApexLogics #150 "IRMAA Bracket Calculator" (al_id AL-164,
// tool_id 150-irmaa-bracket-calculator). Source page fetched 2026-10-13:
// https://apexlogics.org/tools/150-irmaa-bracket-calculator/
//   46374 bytes, sha256 2cc867b8895b17d2af452620771989e24db0aa7933c4df8e33b9e889d823d5e2
// Compute ported from the page's inline `calculate()` + `tierLookup()`
// (apex150.html L422-L435, L438-L516).
//
// WHAT THIS KERNEL COMPUTES: given a tax filing status, the look-back-year
// adjusted gross income and tax-exempt interest, and the Medicare enrollment
// facts, the modified adjusted gross income (MAGI), the IRMAA tier, the 2026
// Part B total monthly premium and Part D income-related monthly adjustment
// amount (IRMAA), the annualised per-person and household cost, the dollars of
// headroom before the next band cliff, the annual cost of crossing it, and the
// effect of an amount of additional income under consideration.
//
// DETERMINISM / zkVM PROMOTABILITY: no Date, no clock, no randomness, no text
// encoding, no network. `compute(pp)` is a pure function of `pp`. The Apex page
// is NOT wall-clock dependent in its arithmetic — `calculate()` reads no clock;
// the only `new Date()` calls on the page sit in `exportMarkdown()` (L555) and
// `exportAP2()` (L594), i.e. in the artifact-stamping paths, never in the math.
// The APEXPORT-110B as-of-parameter pattern is therefore NOT required here;
// determinism is achieved by making the premium year an explicit INPUT
// (`premium_year`) with the 2026 tables as its named literal default.
//
// MONEY: every currency amount is an integer number of USD CENTS. No floats in
// the money path, no rounding helper is needed because every CMS 2026 figure is
// an exact number of cents and every derived figure is a sum or product of
// cents (12 months, enrollees in {1,2}, the household multiplier). The single
// division in the kernel is `implied_marginal_bps`, which is an explicit
// round-half-away-from-zero integer division.
//
// BAND SEMANTICS (DIFFERS #3 — official wins): the Apex page assigns tiers with
// a strict `magi > thresholds[k]` sweep, which puts MAGI of exactly $500,000 in
// tier 4. CMS publishes the top band as "Greater than or equal to $500,000"
// (single) / "Greater than or equal to $750,000" (joint), so MAGI of exactly
// $500,000 is tier 5. This kernel therefore treats the LAST threshold in a
// threshold list as an INCLUSIVE LOWER bound and every earlier threshold as an
// exclusive upper bound:  tier = #{k < n-1 : magi > t[k]} + (magi >= t[n-1] ? 1 : 0).
//
// MFS PREMIUM TABLE (DIFFERS #2/#4 — official wins): married-filing-separately
// beneficiaries have their own three-band premium ladder (CMS 2026 fact sheet:
// <=$109,000 -> $202.90; >$109,000 and <$391,000 -> $649.20; >=$391,000 -> $689.90;
// Part D IRMAA $0.00 / $83.30 / $91.00). The Apex page reuses the single/MFJ
// six-vector premium ladder for MFS and reuses a $394,000 second threshold. This
// kernel carries dedicated `part_b_..._mfs_usd` / `part_d_..._mfs_usd` inputs
// and a $391,000 second MFS threshold.
//
// HEADROOM (DIFFERS #5 — official wins): under CMS band semantics the largest
// additive amount that keeps the current tier is `t[k] - magi` for k < n-1
// (arriving exactly ON t[k] is still band k) and `t[k] - magi - 1` for k = n-1
// (arriving exactly ON t[n-1] is already band n). The Apex page subtracts 1
// unconditionally (apex150.html L475), understating headroom by $1.00 on every
// band below the top.

const TOOL_ID = 'art-762-irmaa-bracket-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_irmaa_bracket',
  mandate_type: 'compliance_control',
  gpu: false,
};

// ---------------------------------------------------------------------------
// NAMED LITERAL CONSTANTS — 2026 premium year.
//
// Grounding for every number below (all fetched and quoted on 2026-10-13; see
// CITES.md for URLs, byte counts and sha256 digests of the fetched bytes):
//
//  [C1] CMS, "2026 Medicare Parts A & B Premiums and Deductibles" fact sheet,
//       https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles
//       sha256 59ca77403619c51639ddf49f0dd2c87c3b041b9eda0ff02fe606da1bb3e767d9 (66816 bytes)
//  [C2] 90 FR 52063 (2025-11-19), "Medicare Program; Medicare Part B Monthly
//       Actuarial Rates, Premium Rates, and Annual Deductible Beginning
//       January 1, 2026", full text fetched from federalregister.gov.
//       sha256 529325bd9353a73dce3e6b97cb43fc710e1e25aeaab28f4ea25cf4c0e7cbb35e (81034 bytes)
//  [R1] 20 CFR 418 (eCFR XML, title-20 issue date 2026-10-08)
//       sha256 b6cb91f222d4cd50018f4f9833c31af2617549a13a5c472e3d1b7fe06f36d393 (39755 bytes)
//       Sections relied on: 418.1010(a)(6) MAGI definition; 418.1105 "What is the threshold?";
//       418.1115 MAGI ranges and the 2020+ inflation mechanism; 418.1120(b)(1)/(b)(3) the general
//       and MFS percentage tables; 418.1125 Part B premium construction; 418.1135(a) the two-year
//       look-back; 418.1140(e) the lived-apart re-routing; 418.1201/418.1205 life-changing events.
//       NOTE: the Apex page cites "42 CFR 418.1105". The section is 20 CFR 418.1105 — see [R2].
//  [R2] 42 CFR 418 (eCFR XML, title-42 issue date 2026-10-08) — read ONLY to
//       establish that the Apex page's "42 CFR 418.1105" does not exist.
//       sha256 dd232c6cbb87ff8d1a8c15fe840b1c6c562d1f136501647bece2f92bf0ea9c43 (51983 bytes)
// ---------------------------------------------------------------------------

/** Premium year the bundled tables describe. CMS published 2026 amounts on 2025-11-14 [C1]. */
export const PREMIUM_YEAR = 2026;

/**
 * 20 CFR 418.1135(a): "In general, we will use your modified adjusted gross
 * income provided by IRS for the tax year 2 years prior to the effective year of
 * the income-related monthly adjustment amount determination." [R1]
 * So 2026 premiums read the 2024 return. This constant is label-only: it does
 * not select a table (see PORT NOTE below).
 */
export const LOOKBACK_YEARS = 2;

/**
 * 2026 standard monthly Part B premium. [C1] "The standard monthly premium for
 * Medicare Part B enrollees will be $202.90 for 2026". Corroborated by [C2]:
 * "The standard monthly Part B premium rate for all enrollees for 2026 is
 * $202.90". NOT read by this compute — band 0 of part_b_total_monthly_by_tier_usd
 * carries the same value — kept for documentation only.
 */
export const PART_B_STANDARD_MONTHLY_CENTS = 20290;

/**
 * 2026 Part B annual deductible, $283.00. [C1] "The annual deductible for all
 * Medicare Part B beneficiaries will be $283 in 2026"; [C2] "The Part B
 * deductible for 2026 is $283.00 for all Part B beneficiaries."
 * NOT read by this compute and not exposed as an input: the deductible is not a
 * premium and never enters an IRMAA arithmetic. (See DIFFERS.md note A-4.)
 */
export const PART_B_ANNUAL_DEDUCTIBLE_CENTS = 28300;

/** CMS 2026 Part B "Full Part B Coverage" total monthly premium, by band. [C1] */
export const PART_B_TOTAL_MONTHLY_CENTS = [20290, 28410, 40580, 52750, 64920, 68990];

/**
 * CMS 2026 Part D income-related monthly adjustment amount, by band. [C1]
 * 0.00 / 14.50 / 37.50 / 60.40 / 83.30 / 91.00 for single / MFJ.
 */
export const PART_D_IRMAA_MONTHLY_CENTS = [0, 1450, 3750, 6040, 8330, 9100];

/**
 * CMS 2026 Part B total monthly premium for beneficiaries "who are married and
 * lived with their spouses at any time during the year, but who file separate
 * tax returns from their spouses". [C1]: <= $109,000 -> $202.90;
 * > $109,000 and < $391,000 -> $649.20; >= $391,000 -> $689.90.
 */
export const PART_B_TOTAL_MONTHLY_MFS_CENTS = [20290, 64920, 68990];

/**
 * CMS 2026 Part D IRMAA for the same MFS population. [C1]: <= $109,000 -> $0.00;
 * > $109,000 and < $391,000 -> $83.30; >= $391,000 -> $91.00.
 */
export const PART_D_IRMAA_MONTHLY_MFS_CENTS = [0, 8330, 9100];

/**
 * CMS 2026 MAGI thresholds, single (also head of household, qualifying
 * widow(er), and MFS living apart all year). [C1] "Less than or equal to
 * $109,000" / "Greater than $109,000 and less than or equal to $137,000" /
 * "...$171,000" / "...$205,000" / "Greater than or equal to $500,000".
 */
export const THRESHOLDS_SINGLE_CENTS = [10900000, 13700000, 17100000, 20500000, 50000000];

/** CMS 2026 MAGI thresholds, married filing jointly. [C1] 218/274/342/410/750 ($000). */
export const THRESHOLDS_MFJ_CENTS = [21800000, 27400000, 34200000, 41000000, 75000000];

/**
 * CMS 2026 MAGI thresholds, married filing separately, lived with spouse at
 * some time during the tax year. [C1]: <= $109,000 -> lowest band;
 * > $109,000 and less than $391,000; greater than or equal to $391,000.
 * The Apex page used 394000 here (apex150.html L260) and self-flagged it
 * "Low confidence" — see DIFFERS.md #1.
 */
export const THRESHOLDS_MFS_CENTS = [10900000, 39100000];

const FILING_STATUSES = ['Single', 'MFJ', 'MFS'];

const MONTHS_PER_YEAR = 12;

const SCOPE_NOTE =
  'Full Part B coverage only: the CMS Part B table for beneficiaries with Part B ' +
  'immunosuppressive drug coverage only (2026 totals $121.60 base, $202.70 / $324.30 / ' +
  '$445.90 / $567.50 / $608.10) is NOT modelled. MAGI is modelled as adjusted gross ' +
  'income plus tax-exempt interest only; 20 CFR 418.1010(a)(6) adds four further ' +
  'tax-exempt add-backs (US savings-bond higher-education interest, foreign earned ' +
  'income, Guam/American Samoa/Northern Mariana Islands income, Puerto Rico income) ' +
  'that this tool does not expose. No late-enrolment penalty, no non-standard ' +
  'premium, no state surcharge, no Medicare Savings Program interaction, and no ' +
  'Part B or Part D plan premium (the Part D figure is the IRMAA surcharge only). ' +
  'SSA makes the final determination; this is a planning estimate.';

// ---------------------------------------------------------------------------
// integer helpers
// ---------------------------------------------------------------------------

/** dollars (any finite number) -> integer cents, half away from zero */
function toCents(usd) {
  const neg = usd < 0;
  const a = neg ? -usd : usd;
  const c = Math.floor(a * 100 + 0.5);
  return neg ? -c : c;
}

/** round-half-away-from-zero integer division; d must be a non-zero integer */
function divRound(n, d) {
  const neg = n < 0;
  const a = neg ? -n : n;
  const ad = d < 0 ? -d : d;
  const q = Math.floor(a / ad);
  const r = a - q * ad;
  const out = r * 2 >= ad ? q + 1 : q;
  return (neg !== (d < 0)) ? -out : out;
}

// ---------------------------------------------------------------------------
// refusal plumbing
// ---------------------------------------------------------------------------

/** @type {(reason: string, text: string) => { output_payload: object, compliance_flags: string[] }} */
function refused(reason, text) {
  return {
    output_payload: {
      premium_year: null,
      lookback_year: null,
      filing_status: null,
      threshold_basis: null,
      magi_usd_cents: null,
      tier: null,
      at_top_tier: null,
      part_b_total_monthly_usd_cents: null,
      part_b_irmaa_monthly_usd_cents: null,
      part_d_irmaa_monthly_usd_cents: null,
      annual_per_person_usd_cents: null,
      annual_irmaa_per_person_usd_cents: null,
      annual_household_usd_cents: null,
      annual_irmaa_household_usd_cents: null,
      next_threshold_usd_cents: null,
      distance_to_next_usd_cents: null,
      headroom_before_next_usd_cents: null,
      crossing_cost_annual_usd_cents: null,
      projected_magi_usd_cents: null,
      projected_tier: null,
      incremental_annual_cost_usd_cents: null,
      implied_marginal_bps: null,
      life_changing_event: null,
      refusal_reason: reason,
      domain_errors: [{ code: reason, text }],
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: ['ART762_INPUT_REFUSED'],
  };
}

function bad(code, text) {
  const r = refused(code, text);
  r.output_payload.domain_errors = [{ code, text }];
  return r;
}

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------

/** strictly increasing array of finite non-negative numbers, length >= 2 */
function thresholdsOk(a) {
  if (!Array.isArray(a) || a.length < 2) return false;
  for (let i = 0; i < a.length; i++) {
    if (typeof a[i] !== 'number' || !Number.isFinite(a[i]) || a[i] < 0) return false;
    if (i > 0 && !(a[i] > a[i - 1])) return false;
  }
  return true;
}

/** finite non-negative numbers, length >= n */
function premiumsOk(a, n) {
  if (!Array.isArray(a) || a.length < n) return false;
  for (let i = 0; i < a.length; i++) {
    if (typeof a[i] !== 'number' || !Number.isFinite(a[i]) || a[i] < 0) return false;
  }
  return true;
}

function pick(v, dflt) {
  return v === undefined || v === null ? dflt : v;
}

// ---------------------------------------------------------------------------
// band lookup — the ported core
// ---------------------------------------------------------------------------

/**
 * Band index for a MAGI against a CMS threshold ladder.
 *
 * CMS band edges: bands 0..n-2 are "greater than t[k] and less than or equal to
 * t[k+1]"; the final band n is "greater than or equal to t[n-1]" [C1], matching
 * the codified range list in 20 CFR 418.1115(b)(3)(iv)-(v) and (c)(3)(iv)-(v):
 * "Greater than $160,000 but less than $500,000" and "Greater than or equal to
 * $500,000" [R1]. So every threshold except the last is an EXCLUSIVE edge and the
 * last is an INCLUSIVE one.
 */
function bandOf(magiCents, thresholds) {
  const n = thresholds.length;
  let tier = 0;
  for (let k = 0; k < n - 1; k++) {
    if (magiCents > thresholds[k]) tier = k + 1;
  }
  if (magiCents >= thresholds[n - 1]) tier = n;
  return tier;
}

/**
 * Full priced position at one MAGI. Mirrors the Apex `tierLookup()`
 * (apex150.html L422-L435) with the official MFS ladder substituted where the
 * status calls for it.
 */
function positionAt(magiCents, thresholds, partB, partD, enrolledPartD, enrollees) {
  const tier = bandOf(magiCents, thresholds);
  const partBTotal = partB[tier];
  const partDIrmaa = enrolledPartD ? partD[tier] : 0;
  const partBIrmaa = partB[tier] - partB[0];
  return {
    tier,
    partBTotal,
    partDIrmaa,
    partBIrmaa,
    annualPerPerson: (partBTotal + partDIrmaa) * MONTHS_PER_YEAR,
    annualIrmaaPerPerson: (partBIrmaa + partDIrmaa) * MONTHS_PER_YEAR,
  };
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

/**
 * @param {object} pp policy parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  if (!pp || typeof pp !== 'object' || Array.isArray(pp)) {
    return bad('MALFORMED_INPUT', 'policy parameters must be a plain object');
  }

  const filingStatus = pp.filing_status;
  if (typeof filingStatus !== 'string' || FILING_STATUSES.indexOf(filingStatus) === -1) {
    return bad(
      'INVALID_FILING_STATUS',
      'filing_status must be one of ' + FILING_STATUSES.join(', ') + '; got ' + JSON.stringify(filingStatus),
    );
  }

  if (typeof pp.agi_usd !== 'number' || !Number.isFinite(pp.agi_usd)) {
    return bad('INVALID_AGI', 'agi_usd must be a finite number of US dollars; got ' + JSON.stringify(pp.agi_usd));
  }

  if (typeof pp.enrollees !== 'number' || !Number.isInteger(pp.enrollees) || pp.enrollees < 1) {
    return bad('INVALID_ENROLLEES', 'enrollees must be an integer of at least 1; got ' + JSON.stringify(pp.enrollees));
  }

  const additionalRaw = pick(pp.additional_income_usd, 0);
  if (typeof additionalRaw !== 'number' || !Number.isFinite(additionalRaw)) {
    return bad('INVALID_ADDITIONAL_INCOME', 'additional_income_usd must be a finite number; got ' + JSON.stringify(additionalRaw));
  }

  const teiRaw = pick(pp.tax_exempt_interest_usd, 0);
  if (typeof teiRaw !== 'number' || !Number.isFinite(teiRaw) || teiRaw < 0) {
    return bad('INVALID_TAX_EXEMPT_INTEREST', 'tax_exempt_interest_usd must be a finite non-negative number; got ' + JSON.stringify(teiRaw));
  }

  const mfsLivingApart = pick(pp.mfs_living_apart, true) === true;
  const enrolledPartD = pick(pp.enrolled_part_d, true) === true;
  const lifeChangingEvent = pick(pp.life_changing_event, false) === true;
  const enrollees = pp.enrollees;

  const premiumYear = pick(pp.premium_year, PREMIUM_YEAR);
  if (typeof premiumYear !== 'number' || !Number.isInteger(premiumYear)) {
    return bad('INVALID_PREMIUM_YEAR', 'premium_year must be an integer calendar year; got ' + JSON.stringify(premiumYear));
  }
  const lookbackYears = pick(pp.lookback_years, LOOKBACK_YEARS);
  if (typeof lookbackYears !== 'number' || !Number.isInteger(lookbackYears) || lookbackYears < 0) {
    return bad('INVALID_LOOKBACK_YEARS', 'lookback_years must be a non-negative integer; got ' + JSON.stringify(lookbackYears));
  }

  // Premium tables arrive in USD and are converted to cents; the named literal
  // defaults are ALREADY in cents and pass through untouched.
  const table = (usd, centsDefault) => {
    const v = pick(usd, undefined);
    return v === undefined ? centsDefault.slice() : v.map(toCents);
  };
  const thresholdsSingle = table(pp.thresholds_single_usd, THRESHOLDS_SINGLE_CENTS);
  const thresholdsMfj = table(pp.thresholds_mfj_usd, THRESHOLDS_MFJ_CENTS);
  const thresholdsMfs = table(pp.thresholds_mfs_usd, THRESHOLDS_MFS_CENTS);
  const partB = table(pp.part_b_total_monthly_by_tier_usd, PART_B_TOTAL_MONTHLY_CENTS);
  const partD = table(pp.part_d_irmaa_monthly_by_tier_usd, PART_D_IRMAA_MONTHLY_CENTS);
  const partBMfs = table(pp.part_b_total_monthly_by_tier_mfs_usd, PART_B_TOTAL_MONTHLY_MFS_CENTS);
  const partDMfs = table(pp.part_d_irmaa_monthly_by_tier_mfs_usd, PART_D_IRMAA_MONTHLY_MFS_CENTS);

  if (!thresholdsOk(thresholdsSingle)) return bad('INVALID_THRESHOLDS', 'thresholds_single_usd must be a strictly increasing array of >= 2 non-negative numbers');
  if (!thresholdsOk(thresholdsMfj)) return bad('INVALID_THRESHOLDS', 'thresholds_mfj_usd must be a strictly increasing array of >= 2 non-negative numbers');
  if (!thresholdsOk(thresholdsMfs)) return bad('INVALID_THRESHOLDS', 'thresholds_mfs_usd must be a strictly increasing array of >= 2 non-negative numbers');

  // Step 2 — pick the threshold ladder and the premium ladder that go with it.
  let thresholds;
  let basis;
  let statusPartB;
  let statusPartD;
  if (filingStatus === 'MFJ') {
    thresholds = thresholdsMfj; basis = 'mfj'; statusPartB = partB; statusPartD = partD;
  } else if (filingStatus === 'MFS' && mfsLivingApart) {
    // Lived apart from the spouse all year -> the single ladder (apex150.html L459;
    // 20 CFR 418.1140(e) confirms SSA re-routes the separated-but-apart case to the
    // § 418.1120(b)(1) single table once the beneficiary attests to it [R1]).
    thresholds = thresholdsSingle; basis = 'mfs_lived_apart_single_ladder'; statusPartB = partB; statusPartD = partD;
  } else if (filingStatus === 'MFS') {
    thresholds = thresholdsMfs; basis = 'mfs_lived_together'; statusPartB = partBMfs; statusPartD = partDMfs;
  } else {
    thresholds = thresholdsSingle; basis = 'single'; statusPartB = partB; statusPartD = partD;
  }

  const bands = thresholds.length + 1;
  if (!premiumsOk(statusPartB, bands)) {
    return bad('PREM_TABLE_TOO_SHORT', 'part_b premium ladder for ' + filingStatus + ' needs at least ' + bands + ' entries; got ' + statusPartB.length);
  }
  if (!premiumsOk(statusPartD, bands)) {
    return bad('PREM_TABLE_TOO_SHORT', 'part_d premium ladder for ' + filingStatus + ' needs at least ' + bands + ' entries; got ' + statusPartD.length);
  }

  // Step 1 — MAGI. 20 CFR 418.1010(a)(6): "Modified adjusted gross income is your
  // adjusted gross income as defined by the Internal Revenue Code, plus ...
  // (i) Tax-exempt interest income; ..." [R1]. AGI below zero clamps to zero for
  // the lookup, matching apex150.html L463.
  const agiCents = toCents(pp.agi_usd);
  const teiCents = toCents(teiRaw);
  const magiCents = (agiCents < 0 ? 0 : agiCents) + teiCents;

  const cur = positionAt(magiCents, thresholds, statusPartB, statusPartD, enrolledPartD, enrollees);

  // Steps 8/9 — next cliff and the cost of stepping over it.
  const n = thresholds.length;
  const atTopTier = cur.tier >= n;
  let nextThreshold = null;
  let distanceToNext = null;
  let headroom = null;
  let crossingCostAnnual = null;
  if (!atTopTier) {
    const k = cur.tier;
    nextThreshold = thresholds[k];
    distanceToNext = nextThreshold - magiCents;
    // t[k] is an exclusive edge for k < n-1 (ON it is still band k) and an
    // inclusive edge for k = n-1 (ON it is already band n). See DIFFERS #5.
    headroom = Math.max(0, k === n - 1 ? distanceToNext - 1 : distanceToNext);
    const nextIdx = k + 1;
    const nextMonthly = statusPartB[nextIdx] + (enrolledPartD ? statusPartD[nextIdx] : 0);
    const curMonthly = cur.partBTotal + cur.partDIrmaa;
    crossingCostAnnual = (nextMonthly - curMonthly) * MONTHS_PER_YEAR * enrollees;
  }

  // Step 10 — additional income under consideration, clamped at zero.
  const projectedMagiCents = Math.max(0, magiCents + toCents(additionalRaw));
  const proj = positionAt(projectedMagiCents, thresholds, statusPartB, statusPartD, enrolledPartD, enrollees);
  const annualHousehold = cur.annualPerPerson * enrollees;
  const annualIrmaaHousehold = cur.annualIrmaaPerPerson * enrollees;
  const projectedAnnualHousehold = proj.annualPerPerson * enrollees;
  const incrementalCost = projectedAnnualHousehold - annualHousehold;

  // Step 11 — implied marginal rate on the additional income, in basis points.
  const additionalCents = toCents(additionalRaw);
  const impliedMarginalBps = additionalCents === 0 ? 0 : divRound(incrementalCost * 10000, additionalCents);

  // Step 12 — the two labels the tool shows.
  const lookbackYear = premiumYear - lookbackYears;

  return {
    output_payload: {
      premium_year: premiumYear,
      lookback_year: lookbackYear,
      filing_status: filingStatus,
      threshold_basis: basis,
      magi_usd_cents: magiCents,
      tier: cur.tier,
      at_top_tier: atTopTier,
      part_b_total_monthly_usd_cents: cur.partBTotal,
      part_b_irmaa_monthly_usd_cents: cur.partBIrmaa,
      part_d_irmaa_monthly_usd_cents: cur.partDIrmaa,
      annual_per_person_usd_cents: cur.annualPerPerson,
      annual_irmaa_per_person_usd_cents: cur.annualIrmaaPerPerson,
      annual_household_usd_cents: annualHousehold,
      annual_irmaa_household_usd_cents: annualIrmaaHousehold,
      next_threshold_usd_cents: nextThreshold,
      distance_to_next_usd_cents: distanceToNext,
      headroom_before_next_usd_cents: headroom,
      crossing_cost_annual_usd_cents: crossingCostAnnual,
      projected_magi_usd_cents: projectedMagiCents,
      projected_tier: proj.tier,
      incremental_annual_cost_usd_cents: incrementalCost,
      implied_marginal_bps: impliedMarginalBps,
      life_changing_event: lifeChangingEvent,
      refusal_reason: null,
      domain_errors: [],
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: [],
  };
}

export default compute;

// Artifact envelope — same shape as every landed kernel; executionHash comes
// from the in-repo SSOT (chaingraph/kernels/_hash.mjs, WORKER-HASH-SSOT-1).
import { executionHash } from './_hash.mjs';

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}