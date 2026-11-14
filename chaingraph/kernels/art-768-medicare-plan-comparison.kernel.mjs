// art-768-medicare-plan-comparison.kernel.mjs
// APEXPORT-151 DRAFT PAYLOAD for a trusted builder. Not registered, not merged.
// Port of ApexLogics #151 "Medicare Plan Comparison" (al_id AL-165) into an
// AINumbers kernel. One ESM module, one pure exported compute(pp).
//
// ── SOURCE (read-only; every digest below is of bytes fetched THIS run) ───────
//   Tool page: https://apexlogics.org/tools/151-medicare-plan-comparison/
//     fetched 2026-10-13T22:21:16Z, HTTP 200, text/html, 57600 bytes,
//     sha256 c40eb91d7256862cde265523c7afc8fe5fc42d7f1b97fcc2cb7b28806d8568fd
//   Registry:  https://apexlogics.org/suite-registry.json
//     fetched 2026-10-13, HTTP 200, application/json, 423823 bytes,
//     sha256 13dc9610113f90abe19ad0e44553b959c5fe6fb529e583ea8503114e514d24a4,
//     registry_version 5.13.0, last_updated 2026-10-02; entry al_id "AL-165",
//     tool_id "151-medicare-plan-comparison", display_number "#151",
//     status "shipped", shipped_date "2026-07-26",
//     data_vintage "2026 CMS Parts A & B and Part D standard benefit parameters",
//     regulatory_citations [] <-- EMPTY in the registry, so every premise below is
//     re-grounded in .d/CITES.md (G1..G11) from cms.gov / medicare.gov / kff.org
//     bytes fetched this same run.
//
// ── WHAT WAS PORTED ─────────────────────────────────────────────────────────
// The Apex page's inline compute (that page, lines 487-691: fmt/money,
// parseNumList, drugPhase, partADayCoinsurance, runPaths, calculate) prices ONE
// shared utilization scenario twice -- a typical year and a bad-year stress test --
// for Path A (Original Medicare + Medigap + standalone Part D) and Path B (Medicare
// Advantage). Path A cost sharing is a function of the Medigap plan letter; Path B
// medical cost sharing is capped by the plan MOOP; drug cost sharing on both paths
// follows the standard Part D phase function (deductible, then 25% coinsurance, then
// the annual out-of-pocket cap). The comparison returns the annual difference, the
// bad-year difference and both worst-case ceilings.
//
// ── CLOCK ───────────────────────────────────────────────────────────────────
// No clock read reaches the arithmetic. The page's only new Date() calls
// (lines 735, 777, in exportMarkdown / exportAP2) stamp export metadata. compute()
// is therefore a pure function of its declared input domain with NO as-of parameter
// (DIFFERS row D9). Nothing here is wall-clock dependent.
//
// ── DATA VINTAGE ────────────────────────────────────────────────────────────
// 2026. Every 2026 CMS figure is a named literal below carrying its CITES.md id.
// Where the Apex page's own literal disagrees with the official 2026 figure, the
// official value wins here and the disagreement is a DIFFERS.md row -- never a
// silent pick. Exactly one figure disagrees (D1, high-deductible Plan G).
//
// ── SINK CHECK / ANCHOR ─────────────────────────────────────────────────────
// No Medicare plan-comparison node exists in ainumbers (verified against a
// freshly-fetched origin/main tree, commit
// 00bbc3359af08b37824b0ac5520f0e74e1dd6cc5, committed 2026-10-13T19:46:58Z: zero
// paths matching art-768 anywhere in the tree; the highest art-7xx present is
// art-713). The partial anchor is
// chaingraph/kernels/art-617-m3p-monthly-cap-calculator.kernel.mjs line 53,
// PLAN_YEAR_PARAMS[2026].annual_oop_threshold_cents = 210000 cents = $2,100 --
// the same 2026 Part D out-of-pocket threshold this kernel uses at
// PART_D_OUT_OF_POCKET_CAP_2026_USD below (G4). That constant and its citation are
// reused as-is. Its recorded source_digest
// (6eb8797d77cf892afb41f9fb5be0889ccc7504e770f323f7295c66f3ee49ac2d) is NOT the
// digest of the bytes this run fetched for that CMS fact sheet
// (4d537a32539db13600129975952ce357cddf854fffa18e3911b333e82a4d2d24) -- see
// DIFFERS.md D10 and report item R3: the VALUE agrees, the DIGEST does not.
//
// ── REFUSALS ────────────────────────────────────────────────────────────────
// No silent coercion anywhere. Apex coerces blank/negative user fields to 0 and
// silently substitutes a default for a blank or 0 constant; this kernel refuses
// with a named reason instead (D3, D4, D6). Where an Apex clamp is a genuine
// modelling rule rather than a coercion (the Part D deductible ceiling, the Path B
// premium floor, the "MOOP <= 0 means not entered" rule) the clamp is preserved
// verbatim AND surfaced as an explicit output flag (D5, D7, D8).
//
// Verify-only: prices a caller-declared scenario from published 2026 benefit
// parameters. It does not quote any plan, does not read any beneficiary's records,
// does not decide enrollment, and does not assert that any actual bill is correct.
// Estimate only -- not an official CMS, plan or SHIP communication, and not
// financial, tax or legal advice.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-768-medicare-plan-comparison';
const TOOL_VERSION = '1.0.0';
const DATA_VINTAGE = '2026';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compare_medicare_plans',
  mandate_type: 'medicare_plan_comparison_record',
  gpu: false,
};

// ── 2026 CMS STANDARD BENEFIT PARAMETERS ───────────────────────────────────
// Every value here is a 2026 figure grounded in .d/CITES.md with a URL, a quote
// and the sha256 of the bytes fetched during APEXPORT-151 (2026-10-13).

// Monthly Part B premium by IRMAA tier, 2026, full Part B coverage.
// CMS "2026 Medicare Parts A & B Premiums and Deductibles" fact sheet, Full Part B
// Coverage table (G3). Identical to the Apex page's constant (no DIFFERS row).
const PART_B_PREMIUM_BY_IRMAA_TIER_USD = [202.90, 284.10, 405.80, 527.50, 649.20, 689.90];

// Monthly Part D income-related monthly adjustment by the same six MAGI bands,
// 2026 (G3). Identical to the Apex page's constant (no DIFFERS row).
const PART_D_IRMAA_SURCHARGE_BY_TIER_USD = [0, 14.50, 37.50, 60.40, 83.30, 91.00];

// 2026 Part B annual deductible, $283 (G3). Identical to Apex.
const PART_B_DEDUCTIBLE_2026_USD = 283;

// Enrollee pays 20% of the Medicare-approved amount after the Part B deductible is
// met (G3). Identical to the Apex page's hardcoded 0.20.
const PART_B_COINSURANCE_RATE = 0.20;

// 2026 Part A inpatient hospital deductible per benefit period, $1,736 (G3, G9).
const PART_A_DEDUCTIBLE_2026_USD = 1736;

// 2026 Part A daily coinsurance, days 61-90 of a benefit period, $434 (G3, G9).
const PART_A_DAYS_61_90_COINSURANCE_2026_USD = 434;

// 2026 Part A daily coinsurance for lifetime reserve days, $868 (G3, G9).
const PART_A_LIFETIME_RESERVE_COINSURANCE_2026_USD = 868;

// A benefit period covers days 1-90; days 91-150 draw on 60 lifetime reserve days
// "once during your lifetime", after which the enrollee pays all costs (G9).
const PART_A_FULLY_COVERED_DAYS_PER_ADMISSION = 90;
const PART_A_LIFETIME_RESERVE_DAYS = 60;

// 2026 defined-standard Part D deductible, $615: the enrollee pays 100% of gross
// covered prescription drug costs until the $615 deductible is met (G4). This is
// also the 2026 MAXIMUM a plan may charge, which is why the Apex page's
// cPartDMaxDeductible default of 615 is right for the same reason.
const PART_D_DEDUCTIBLE_2026_USD = 615;
const PART_D_MAX_DEDUCTIBLE_2026_USD = 615;

// Standard Part D coinsurance in the initial coverage phase: the enrollee pays 25%
// coinsurance for covered Part D drugs (G4).
const PART_D_COINSURANCE_RATE = 0.25;

// 2026 Part D annual out-of-pocket threshold: the catastrophic phase begins once the
// enrollee reaches $2,100 of out-of-pocket costs, after which cost sharing is $0
// (G4, and independently G5). Same fact, same figure, as the art-617 anchor value
// of 210000 cents.
const PART_D_OUT_OF_POCKET_CAP_2026_USD = 2100;

// Medigap Plan N: the plan pays 100% of Part B coinsurance but the enrollee owes
// "a copayment of up to $20 for some office visits" (G6). Plan G and Plan N do NOT
// cover the Part B deductible (G6 benefits table) -- which is why the Plan G branch
// below charges it.
const PLAN_N_OFFICE_VISIT_COPAY_USD = 20;

// 2026 high-deductible Plan F/G/J annual deductible, $2,950 (G6: "You must pay up to
// $2,950 in 2026 for Medicare-covered costs ... before your policy pays anything").
// DIFFERS D1: the Apex page carries 2900 with the on-page hint "Low confidence,
// verify"; the official figure wins here.
const HIGH_DEDUCTIBLE_PLAN_G_DEDUCTIBLE_2026_USD = 2950;

// 2026 Medicare Advantage in-network maximum out-of-pocket limit: an MA plan may not
// exceed $9,250 in-network in 2026, and those limits cover Part A and B services
// only -- Part D has its own $2,100 limit (G7). Used here ONLY as a plausibility
// flag on a caller-declared MOOP, never as a clamp: a plan may offer a limit lower
// than the maximum, and a caller may be modelling a scenario rather than a plan.
const MA_IN_NETWORK_MOOP_MAX_2026_USD = 9250;

// 2026 Part D national base beneficiary premium, $35.09 (CMS release: "from $35.09 in
// 2026 to $36 in 2027"; shepherd-seat adjudication 2026-11-13, DIFFERS D2). This is the
// PAGE DEFAULT for the stand-alone Part D premium field only -- never a kernel
// constant. The Apex page pre-fills 34.50 and labels it "the 2026 national average".
// The figure 36 appears on the page only as a labelled "KFF 2026 PDP average".
const PART_D_BASE_BENEFICIARY_PREMIUM_2026_USD = 35.09;

// Bad-year stress-test shape. These are Apex's own scenario knobs (its cBadYear*
// controls), not regulatory facts: they replace the declared admissions and length
// of stay and multiply the declared outpatient charges and drug cost.
const DEFAULT_BAD_YEAR_ADMISSIONS = 2;
const DEFAULT_BAD_YEAR_LENGTH_OF_STAY_DAYS = 7;
const DEFAULT_BAD_YEAR_CHARGE_MULTIPLIER = 3;

export const BAD_YEAR_DEFAULTS = {
  bad_year_admissions: DEFAULT_BAD_YEAR_ADMISSIONS,
  bad_year_length_of_stay_days: DEFAULT_BAD_YEAR_LENGTH_OF_STAY_DAYS,
  bad_year_charge_multiplier: DEFAULT_BAD_YEAR_CHARGE_MULTIPLIER,
};

const MEDIGAP_PLAN_TYPES = ['PlanG', 'PlanN', 'HDG', 'None'];

const SCOPE_NOTE =
  'Verify-only annual-cost projection of two caller-declared enrollment paths from published 2026 '
  + 'benefit parameters. It does not compare provider networks, formularies, prior-authorization '
  + 'rules or plan availability, it does not price any specific plan or county, and it does not '
  + 'assert that any actual bill is correct. Estimate only -- not an official CMS, plan or SHIP '
  + 'communication, and not financial, tax or legal advice.';

// ── small numeric helpers (mirroring the Apex page's arithmetic exactly) ────
// money(): the page rounds every intermediate money amount half-up to the cent
// (line 489). Kept verbatim so ported outputs match Apex to the cent.
function money(n) { return Math.round(n * 100) / 100; }

function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function isNonNeg(v) { return isNum(v) && v >= 0; }

// ── the standard Part D phase function (Apex lines 498-504) ─────────────────
// Enrollee pays 100% of covered drug cost up to the plan deductible, then the
// standard 25% coinsurance, and owes nothing more once the annual out-of-pocket
// threshold is reached (G4). oop_cap is always the 2026 threshold (2100) -- the same
// figure art-617 carries as 210000 cents.
function drugPhase(drugCostUsd, planDeductibleUsd, oopCapUsd) {
  const deductiblePaid = Math.max(0, Math.min(drugCostUsd, planDeductibleUsd));
  const postDeductible = Math.max(0, drugCostUsd - planDeductibleUsd);
  const coinsurancePaid = money(postDeductible * PART_D_COINSURANCE_RATE);
  const beforeCap = money(deductiblePaid + coinsurancePaid);
  return {
    deductible_paid_usd: money(deductiblePaid),
    coinsurance_paid_usd: money(coinsurancePaid),
    out_of_pocket_before_cap_usd: money(beforeCap),
    out_of_pocket_after_cap_usd: money(Math.min(beforeCap, oopCapUsd)),
    out_of_pocket_cap_reached: beforeCap > oopCapUsd,
  };
}

// ── Part A day coinsurance (Apex lines 507-513) ─────────────────────────────
// Days 1-60 of a benefit period are covered by the Part A deductible; days 61-90 cost
// $434/day; days 91-150 cost $868/day each and draw on the 60 lifetime reserve days;
// beyond day 150 the enrollee pays everything (G3, G9).
function partADayCoinsurance(lengthOfStayDays, admissions, days61to90RateUsd, reserveRateUsd) {
  const lastReservedDay = PART_A_FULLY_COVERED_DAYS_PER_ADMISSION + PART_A_LIFETIME_RESERVE_DAYS;
  const daysIn61to90 = Math.max(0, Math.min(lengthOfStayDays, PART_A_FULLY_COVERED_DAYS_PER_ADMISSION) - 60);
  const daysInReserve = Math.max(0, Math.min(lengthOfStayDays, lastReservedDay) - PART_A_FULLY_COVERED_DAYS_PER_ADMISSION);
  const beyondReserveDays = Math.max(0, lengthOfStayDays - lastReservedDay);
  return {
    days_61_to_90: daysIn61to90,
    days_91_to_150: daysInReserve,
    beyond_150_days: beyondReserveDays,
    lifetime_reserve_days_exhausted: lengthOfStayDays > lastReservedDay,
    day_coinsurance_usd: money((daysIn61to90 * days61to90RateUsd + daysInReserve * reserveRateUsd) * admissions),
  };
}

// ── one full pricing of both paths for a given scenario (Apex runPaths) ─────
function runPaths(p, C) {
  // irmaa_tier is validated as an integer in [0, 5] before runPaths is reached; the own-key
  // guard keeps the table lookup safe on its own (an unreachable miss is NaN, never a silent 0).
  const partBAnnual = Object.hasOwn(C.part_b_premium_by_irmaa_tier_usd, p.irmaa_tier)
    ? money(C.part_b_premium_by_irmaa_tier_usd[p.irmaa_tier] * 12) : NaN;
  const partDSurchargeAnnual = Object.hasOwn(C.part_d_irmaa_surcharge_by_tier_usd, p.irmaa_tier)
    ? money(C.part_d_irmaa_surcharge_by_tier_usd[p.irmaa_tier] * 12) : NaN;

  // Path A premiums: the Part B premium every Medicare beneficiary pays, plus the
  // Medigap premium, plus the stand-alone Part D premium, plus the Part D IRMAA
  // surcharge (which attaches to the Part D premium, not to Part B).
  const a_premiums_usd = money(partBAnnual
    + p.medigap_premium_monthly_usd * 12
    + p.part_d_premium_monthly_usd * 12
    + partDSurchargeAnnual);

  // Path A medical cost sharing, by Medigap plan letter.
  const total_visits = p.primary_visits_per_year + p.specialist_visits_per_year;
  let a_medical_usd = 0;
  let day_coins = null;
  let reserve_exhausted = false;
  if (p.medigap_plan_type === 'PlanG') {
    // Plan G covers Part A and Part B cost sharing after the deductibles are met, but
    // no Medigap plan covers the Part B deductible (G6), so the enrollee pays the
    // full $283 Part B deductible (or whatever the caller declares).
    a_medical_usd = money(C.part_b_deductible_usd);
  } else if (p.medigap_plan_type === 'PlanN') {
    // Plan N covers Part A coinsurance and Part B coinsurance, leaves the Part B
    // deductible to the enrollee, and charges up to $20 per office visit (G6).
    a_medical_usd = money(C.part_b_deductible_usd + total_visits * C.plan_n_office_visit_copay_usd);
  } else if (p.medigap_plan_type === 'HDG') {
    // High-deductible G: the enrollee pays Medicare cost sharing until the plan's own
    // annual deductible is met, then the plan pays (G6).
    day_coins = partADayCoinsurance(p.length_of_stay_days, p.admissions_per_year,
      C.part_a_days_61_to_90_coinsurance_usd, C.part_a_lifetime_reserve_coinsurance_usd);
    reserve_exhausted = day_coins.lifetime_reserve_days_exhausted;
    const raw_exposure = money(C.part_a_deductible_usd * p.admissions_per_year
      + C.part_b_deductible_usd
      + p.outpatient_charges_usd * PART_B_COINSURANCE_RATE);
    a_medical_usd = money(Math.min(raw_exposure, C.high_deductible_plan_g_deductible_usd));
  } else {
    // None: Original Medicare with no supplement -- Part A deductible per benefit
    // period, Part A day coinsurance, the Part B deductible, then 20% of the
    // outpatient charges above that deductible (G3, G9).
    day_coins = partADayCoinsurance(p.length_of_stay_days, p.admissions_per_year,
      C.part_a_days_61_to_90_coinsurance_usd, C.part_a_lifetime_reserve_coinsurance_usd);
    reserve_exhausted = day_coins.lifetime_reserve_days_exhausted;
    a_medical_usd = money(C.part_a_deductible_usd * p.admissions_per_year
      + day_coins.day_coinsurance_usd
      + C.part_b_deductible_usd
      + Math.max(0, p.outpatient_charges_usd - C.part_b_deductible_usd) * PART_B_COINSURANCE_RATE);
  }

  const a_drugs = drugPhase(p.annual_drug_cost_usd, p.part_d_deductible_a_usd, C.part_d_out_of_pocket_cap_usd);
  const a_total_usd = money(a_premiums_usd + a_medical_usd + a_drugs.out_of_pocket_after_cap_usd);

  // Path B premiums. Apex floors this at zero (line 560): a Part B giveback larger
  // than the Part B premium plus the plan premium cannot produce a negative premium.
  // Preserved verbatim and surfaced as path_b.premiums_floored_at_zero.
  const b_premiums_raw = money(partBAnnual
    - p.part_b_giveback_monthly_usd * 12
    + p.ma_premium_monthly_usd * 12
    + (p.ma_drug_coverage_included ? partDSurchargeAnnual : 0));
  const b_premiums_usd = b_premiums_raw < 0 ? 0 : b_premiums_raw;

  // Path B medical cost sharing before the MOOP.
  const b_visits_usd = money(p.primary_visits_per_year * p.ma_primary_copay_usd
    + p.specialist_visits_per_year * p.ma_specialist_copay_usd);
  const b_inpatient_usd = money(p.admissions_per_year
    * Math.min(p.length_of_stay_days, p.ma_inpatient_copay_days)
    * p.ma_inpatient_copay_per_day_usd);
  const b_outpatient_usd = money(p.outpatient_charges_usd * p.ma_outpatient_coinsurance_pct / 100);
  const b_medical_raw_usd = money(b_visits_usd + b_inpatient_usd + b_outpatient_usd);

  // Apply the MOOP. A caller-declared MOOP of 0 means "not entered" on the Apex page
  // (line 569) and Path B medical cost sharing is then shown uncapped -- preserved
  // verbatim here as path_b.ma_moop_not_entered, never as an Infinity in the output
  // (D7). The MA MOOP covers Part A and B services only; Part D is capped separately
  // at the $2,100 threshold (G7).
  const moop_not_entered = p.ma_moop_usd <= 0;
  const b_medical_usd = moop_not_entered ? b_medical_raw_usd : money(Math.min(b_medical_raw_usd, p.ma_moop_usd));
  const moop_reached = !moop_not_entered && b_medical_raw_usd > p.ma_moop_usd;

  // Path B drugs: bundled Part D follows the standard phase function; an MA plan with
  // no drug coverage leaves the enrollee paying the full retail cost.
  const b_drugs = p.ma_drug_coverage_included
    ? drugPhase(p.annual_drug_cost_usd, p.ma_plan_drug_deductible_usd, C.part_d_out_of_pocket_cap_usd)
    : {
      deductible_paid_usd: money(p.annual_drug_cost_usd),
      coinsurance_paid_usd: 0,
      out_of_pocket_before_cap_usd: money(p.annual_drug_cost_usd),
      out_of_pocket_after_cap_usd: money(p.annual_drug_cost_usd),
      out_of_pocket_cap_reached: false,
    };
  const b_drugs_uncovered = !p.ma_drug_coverage_included;

  const b_total_usd = money(b_premiums_usd + b_medical_usd + b_drugs.out_of_pocket_after_cap_usd);

  return {
    part_b_annual_premium_usd: partBAnnual,
    part_d_irmaa_surcharge_annual_usd: partDSurchargeAnnual,
    path_a: {
      premiums_usd: a_premiums_usd,
      medical_usd: a_medical_usd,
      drugs_usd: a_drugs.out_of_pocket_after_cap_usd,
      drug_phase: a_drugs,
      total_usd: a_total_usd,
      part_a_day_coinsurance: day_coins,
      lifetime_reserve_days_exhausted: reserve_exhausted,
    },
    path_b: {
      premiums_usd: b_premiums_usd,
      premiums_before_zero_floor_usd: b_premiums_raw,
      premiums_floored_at_zero: b_premiums_raw < 0,
      visits_usd: b_visits_usd,
      inpatient_usd: b_inpatient_usd,
      outpatient_usd: b_outpatient_usd,
      medical_before_moop_usd: b_medical_raw_usd,
      medical_usd: b_medical_usd,
      moop_reached: moop_reached,
      ma_moop_not_entered: moop_not_entered,
      drugs_usd: b_drugs.out_of_pocket_after_cap_usd,
      drug_phase: b_drugs,
      drugs_uncovered: b_drugs_uncovered,
      total_usd: b_total_usd,
    },
  };
}

// ── declared-domain validation ─────────────────────────────────────────────
// Every check is a named refusal; errors are collected, nothing is coerced, clamped
// into range, or silently defaulted (D3, D4, D6).
function validate(pp, C) {
  const errors = [];

  const reqNum = (key, { min = 0, max = null, integer = false } = {}) => {
    const v = pp[key];
    // A blank (null) and an omitted (undefined) field are the same refusal (R4: absent equals null).
    if (!isNum(v)) { errors.push(`${key} must be a finite number (got ${v === undefined || v === null ? 'missing' : JSON.stringify(v)})`); return false; }
    if (v < min) { errors.push(`${key} must be >= ${min} (got ${v})`); return false; }
    if (max !== null && v > max) { errors.push(`${key} must be <= ${max} (got ${v})`); return false; }
    if (integer && !Number.isInteger(v)) { errors.push(`${key} must be an integer (got ${v})`); return false; }
    return true;
  };

  // IRMAA tier: exactly 0..5. Apex reads a <select> but its arithmetic indexes the
  // tier arrays directly, so any other value silently yields undefined -> NaN across
  // every downstream money figure (D2).
  reqNum('irmaa_tier', { min: 0, max: C.part_b_premium_by_irmaa_tier_usd.length - 1, integer: true });

  reqNum('admissions_per_year');
  reqNum('primary_visits_per_year');
  reqNum('specialist_visits_per_year');
  reqNum('length_of_stay_days');
  reqNum('outpatient_charges_usd');
  reqNum('annual_drug_cost_usd');
  reqNum('medigap_premium_monthly_usd');
  reqNum('part_d_premium_monthly_usd');
  reqNum('part_d_deductible_a_usd');
  reqNum('ma_premium_monthly_usd');
  reqNum('part_b_giveback_monthly_usd');
  reqNum('ma_primary_copay_usd');
  reqNum('ma_specialist_copay_usd');
  reqNum('ma_inpatient_copay_per_day_usd');
  reqNum('ma_inpatient_copay_days');
  reqNum('ma_outpatient_coinsurance_pct', { min: 0, max: 100 });
  reqNum('ma_moop_usd');
  reqNum('ma_plan_drug_deductible_usd');

  if (!MEDIGAP_PLAN_TYPES.includes(pp.medigap_plan_type)) {
    errors.push(`medigap_plan_type must be one of ${MEDIGAP_PLAN_TYPES.join('|')} (got ${pp.medigap_plan_type === undefined || pp.medigap_plan_type === null ? 'missing' : JSON.stringify(pp.medigap_plan_type)})`);
  }
  if (typeof pp.ma_drug_coverage_included !== 'boolean') {
    errors.push(`ma_drug_coverage_included must be a boolean (got ${pp.ma_drug_coverage_included === undefined || pp.ma_drug_coverage_included === null ? 'missing' : JSON.stringify(pp.ma_drug_coverage_included)})`);
  }

  // Bad-year knobs: optional, defaulting to the Apex page's shipped values (2 / 7 /
  // 3). The default is reported in bad_year_scenario.defaults_applied, never silent.
  for (const key of ['bad_year_admissions', 'bad_year_length_of_stay_days', 'bad_year_charge_multiplier']) {
    if (pp[key] === undefined || pp[key] === null) continue;
    if (!isNonNeg(pp[key])) errors.push(`${key} must be a finite number >= 0 (got ${JSON.stringify(pp[key])})`);
  }

  return errors;
}

// ── optional constant overrides ────────────────────────────────────────────
// A supplied constant must be a finite non-negative number (the two tier arrays must
// be exactly six such numbers). It is used as supplied -- the caller asked for it --
// but it is reported back in constant_overrides with the official 2026 value beside
// it and flagged. Nothing is substituted silently.
function resolveConstants(pp) {
  const C = {
    part_b_premium_by_irmaa_tier_usd: PART_B_PREMIUM_BY_IRMAA_TIER_USD.slice(),
    part_d_irmaa_surcharge_by_tier_usd: PART_D_IRMAA_SURCHARGE_BY_TIER_USD.slice(),
    part_b_deductible_usd: PART_B_DEDUCTIBLE_2026_USD,
    part_a_deductible_usd: PART_A_DEDUCTIBLE_2026_USD,
    part_a_days_61_to_90_coinsurance_usd: PART_A_DAYS_61_90_COINSURANCE_2026_USD,
    part_a_lifetime_reserve_coinsurance_usd: PART_A_LIFETIME_RESERVE_COINSURANCE_2026_USD,
    part_d_max_deductible_usd: PART_D_MAX_DEDUCTIBLE_2026_USD,
    part_d_out_of_pocket_cap_usd: PART_D_OUT_OF_POCKET_CAP_2026_USD,
    plan_n_office_visit_copay_usd: PLAN_N_OFFICE_VISIT_COPAY_USD,
    high_deductible_plan_g_deductible_usd: HIGH_DEDUCTIBLE_PLAN_G_DEDUCTIBLE_2026_USD,
  };

  const overrides = [];
  const errors = [];

  const takeNumber = (name, v) => {
    if (!Object.hasOwn(C, name)) return;
    if (v === undefined || v === null) return;
    if (!isNonNeg(v)) { errors.push(`${name} must be a finite number >= 0 (got ${JSON.stringify(v)})`); return; }
    if (v !== C[name]) overrides.push({ constant: name, used: v, official_2026: C[name] });
    C[name] = v;
  };

  const takeTierArray = (name, v) => {
    if (!Object.hasOwn(C, name)) return;
    if (v === undefined || v === null) return;
    if (!Array.isArray(v) || v.length !== 6 || v.some(x => !isNonNeg(x))) {
      errors.push(`${name} must be an array of exactly 6 finite numbers >= 0 (got ${JSON.stringify(v)})`);
      return;
    }
    if (JSON.stringify(v) !== JSON.stringify(C[name])) overrides.push({ constant: name, used: v.slice(), official_2026: C[name].slice() });
    C[name] = v;
  };

  takeTierArray('part_b_premium_by_irmaa_tier_usd', pp.part_b_premium_by_irmaa_tier_usd);
  takeTierArray('part_d_irmaa_surcharge_by_tier_usd', pp.part_d_irmaa_surcharge_by_tier_usd);
  takeNumber('part_b_deductible_usd', pp.part_b_deductible_usd);
  takeNumber('part_a_deductible_usd', pp.part_a_deductible_usd);
  takeNumber('part_a_days_61_to_90_coinsurance_usd', pp.part_a_days_61_to_90_coinsurance_usd);
  takeNumber('part_a_lifetime_reserve_coinsurance_usd', pp.part_a_lifetime_reserve_coinsurance_usd);
  takeNumber('part_d_max_deductible_usd', pp.part_d_max_deductible_usd);
  takeNumber('part_d_out_of_pocket_cap_usd', pp.part_d_out_of_pocket_cap_usd);
  takeNumber('plan_n_office_visit_copay_usd', pp.plan_n_office_visit_copay_usd);
  takeNumber('high_deductible_plan_g_deductible_usd', pp.high_deductible_plan_g_deductible_usd);

  return { C, overrides, errors };
}

// The Part D plan deductible cannot exceed the standard maximum for the vintage (G4).
// Apex applies Math.min(ded, cPartDMaxDeductible) (lines 608, 620); the clamp is
// preserved and surfaced rather than hidden (D5).
function applyPartDDeductible(deductible, maxDeductible) {
  const applied = Math.min(deductible, maxDeductible);
  return { applied, clamped: applied !== deductible };
}

export function compute(pp) {
  pp = pp || {};
  const { C, overrides, errors: constantErrors } = resolveConstants(pp);
  const errors = constantErrors.concat(validate(pp, C));
  const valid_input = errors.length === 0;

  const bad_year_admissions = (pp.bad_year_admissions === undefined || pp.bad_year_admissions === null)
    ? DEFAULT_BAD_YEAR_ADMISSIONS : pp.bad_year_admissions;
  const bad_year_length_of_stay_days = (pp.bad_year_length_of_stay_days === undefined || pp.bad_year_length_of_stay_days === null)
    ? DEFAULT_BAD_YEAR_LENGTH_OF_STAY_DAYS : pp.bad_year_length_of_stay_days;
  const bad_year_charge_multiplier = (pp.bad_year_charge_multiplier === undefined || pp.bad_year_charge_multiplier === null)
    ? DEFAULT_BAD_YEAR_CHARGE_MULTIPLIER : pp.bad_year_charge_multiplier;
  const bad_year_defaults_applied = [pp.bad_year_admissions, pp.bad_year_length_of_stay_days, pp.bad_year_charge_multiplier]
    .some(v => v === undefined || v === null);

  const partDA = applyPartDDeductible(isNonNeg(pp.part_d_deductible_a_usd) ? pp.part_d_deductible_a_usd : 0, C.part_d_max_deductible_usd);
  const partDB = applyPartDDeductible(isNonNeg(pp.ma_plan_drug_deductible_usd) ? pp.ma_plan_drug_deductible_usd : 0, C.part_d_max_deductible_usd);

  const base = {
    irmaa_tier: valid_input ? pp.irmaa_tier : 0,
    primary_visits_per_year: valid_input ? pp.primary_visits_per_year : 0,
    specialist_visits_per_year: valid_input ? pp.specialist_visits_per_year : 0,
    admissions_per_year: valid_input ? pp.admissions_per_year : 0,
    length_of_stay_days: valid_input ? pp.length_of_stay_days : 0,
    outpatient_charges_usd: valid_input ? pp.outpatient_charges_usd : 0,
    annual_drug_cost_usd: valid_input ? pp.annual_drug_cost_usd : 0,
    medigap_premium_monthly_usd: valid_input ? pp.medigap_premium_monthly_usd : 0,
    medigap_plan_type: valid_input ? pp.medigap_plan_type : 'None',
    part_d_premium_monthly_usd: valid_input ? pp.part_d_premium_monthly_usd : 0,
    part_d_deductible_a_usd: partDA.applied,
    ma_premium_monthly_usd: valid_input ? pp.ma_premium_monthly_usd : 0,
    part_b_giveback_monthly_usd: valid_input ? pp.part_b_giveback_monthly_usd : 0,
    ma_primary_copay_usd: valid_input ? pp.ma_primary_copay_usd : 0,
    ma_specialist_copay_usd: valid_input ? pp.ma_specialist_copay_usd : 0,
    ma_inpatient_copay_per_day_usd: valid_input ? pp.ma_inpatient_copay_per_day_usd : 0,
    ma_inpatient_copay_days: valid_input ? pp.ma_inpatient_copay_days : 0,
    ma_outpatient_coinsurance_pct: valid_input ? pp.ma_outpatient_coinsurance_pct : 0,
    ma_moop_usd: valid_input ? pp.ma_moop_usd : 0,
    ma_drug_coverage_included: valid_input ? pp.ma_drug_coverage_included : false,
    ma_plan_drug_deductible_usd: partDB.applied,
  };

  const typical = valid_input ? runPaths(base, C) : null;
  const bad_year = valid_input ? runPaths({
    ...base,
    admissions_per_year: bad_year_admissions,
    length_of_stay_days: bad_year_length_of_stay_days,
    outpatient_charges_usd: base.outpatient_charges_usd * bad_year_charge_multiplier,
    annual_drug_cost_usd: base.annual_drug_cost_usd * bad_year_charge_multiplier,
  }, C) : null;

  // Comparison. difference > 0 means Path A costs more, so B is cheaper; the branch
  // is on the rounded cent total exactly as the Apex page does (line 650).
  const annual_difference_usd = typical ? money(typical.path_a.total_usd - typical.path_b.total_usd) : null;
  const lower_cost_path = typical
    ? (annual_difference_usd > 0 ? 'B' : (annual_difference_usd < 0 ? 'A' : 'tie'))
    : null;
  const bad_year_difference_usd = bad_year ? money(bad_year.path_a.total_usd - bad_year.path_b.total_usd) : null;
  const bad_year_lower_cost_path = bad_year
    ? (bad_year_difference_usd > 0 ? 'B' : (bad_year_difference_usd < 0 ? 'A' : 'tie'))
    : null;

  // Worst-case ceilings (Apex lines 662-676).
  let a_worst_case_ceiling_usd = null;
  let a_worst_case_ceiling_basis = null;
  if (typical) {
    if (base.medigap_plan_type === 'PlanG') {
      // Path A pays premiums + the Part B deductible Plan G leaves + the Part D cap.
      a_worst_case_ceiling_usd = money(typical.path_a.premiums_usd + C.part_b_deductible_usd + C.part_d_out_of_pocket_cap_usd);
      a_worst_case_ceiling_basis = 'premiums + Part B deductible + 2026 Part D out-of-pocket cap';
    } else if (base.medigap_plan_type === 'HDG') {
      a_worst_case_ceiling_usd = money(typical.path_a.premiums_usd + C.high_deductible_plan_g_deductible_usd + C.part_d_out_of_pocket_cap_usd);
      a_worst_case_ceiling_basis = 'premiums + high-deductible Plan G deductible + 2026 Part D out-of-pocket cap (proxy: the day-150 lifetime limit and benefit-period structure are not fully captured)';
    } else if (base.medigap_plan_type === 'PlanN') {
      // Plan N has no published annual maximum; the Apex page uses the bad-year total
      // as a practical proxy and says so on the page (lines 669-672).
      a_worst_case_ceiling_usd = money(bad_year.path_a.total_usd);
      a_worst_case_ceiling_basis = 'bad-year Path A total used as a proxy -- Plan N has no defined annual maximum';
    } else {
      a_worst_case_ceiling_usd = null;
      a_worst_case_ceiling_basis = 'none -- Original Medicare with no Medigap supplement has no annual out-of-pocket maximum';
    }
  }
  const b_worst_case_ceiling_usd = typical
    ? money(typical.path_b.premiums_usd
      + (typical.path_b.ma_moop_not_entered ? typical.path_b.medical_before_moop_usd : base.ma_moop_usd)
      + C.part_d_out_of_pocket_cap_usd)
    : null;

  const compliance_flags = [];
  if (!valid_input) compliance_flags.push('ART768_INPUT_OUT_OF_DECLARED_DOMAIN');
  if (overrides.length > 0) compliance_flags.push('ART768_CONSTANT_OVERRIDE');
  if (valid_input && base.ma_moop_usd > MA_IN_NETWORK_MOOP_MAX_2026_USD) compliance_flags.push('ART768_MA_MOOP_ABOVE_2026_IN_NETWORK_MAXIMUM');
  if (valid_input) compliance_flags.push('ART768_COMPARISON_COMPUTED');
  if (valid_input && partDA.clamped) compliance_flags.push('ART768_PART_D_DEDUCTIBLE_A_CLAMPED');
  if (valid_input && partDB.clamped) compliance_flags.push('ART768_PART_D_DEDUCTIBLE_B_CLAMPED');
  if (valid_input && typical.path_b.ma_moop_not_entered) compliance_flags.push('ART768_MA_MOOP_NOT_ENTERED');
  if (valid_input && typical.path_b.moop_reached) compliance_flags.push('ART768_MA_MOOP_REACHED');
  if (valid_input && typical.path_b.drugs_uncovered) compliance_flags.push('ART768_MA_DRUGS_UNCOVERED');
  if (valid_input && typical.path_b.premiums_floored_at_zero) compliance_flags.push('ART768_PATH_B_PREMIUM_FLOORED_AT_ZERO');
  if (valid_input && (base.medigap_plan_type === 'HDG' || base.medigap_plan_type === 'PlanN')) compliance_flags.push('ART768_PATH_A_CEILING_IS_PROXY');
  if (valid_input && a_worst_case_ceiling_usd === null) compliance_flags.push('ART768_ORIGINAL_MEDICARE_NO_ANNUAL_CAP');
  if (valid_input && (typical.path_a.lifetime_reserve_days_exhausted || bad_year.path_a.lifetime_reserve_days_exhausted)) compliance_flags.push('ART768_LIFETIME_RESERVE_DAYS_EXHAUSTED');

  const output_payload = {
    data_vintage: DATA_VINTAGE,
    valid_input: valid_input,
    domain_errors: errors,
    medigap_plan_type: MEDIGAP_PLAN_TYPES.includes(pp.medigap_plan_type) ? pp.medigap_plan_type : null,
    irmaa_tier: valid_input ? pp.irmaa_tier : null,
    typical_year: typical,
    bad_year: bad_year,
    bad_year_scenario: valid_input ? {
      admissions_per_year: bad_year_admissions,
      length_of_stay_days: bad_year_length_of_stay_days,
      charge_multiplier: bad_year_charge_multiplier,
      outpatient_charges_usd: money(base.outpatient_charges_usd * bad_year_charge_multiplier),
      annual_drug_cost_usd: money(base.annual_drug_cost_usd * bad_year_charge_multiplier),
      defaults_applied: bad_year_defaults_applied,
    } : null,
    comparison: valid_input ? {
      annual_difference_usd: annual_difference_usd,
      lower_cost_path: lower_cost_path,
      bad_year_difference_usd: bad_year_difference_usd,
      bad_year_lower_cost_path: bad_year_lower_cost_path,
      path_a_worst_case_ceiling_usd: a_worst_case_ceiling_usd,
      path_a_worst_case_ceiling_basis: a_worst_case_ceiling_basis,
      path_b_worst_case_ceiling_usd: b_worst_case_ceiling_usd,
    } : null,
    constants_used: C,
    constant_overrides: overrides,
    part_d_deductible_a_applied_usd: partDA.applied,
    part_d_deductible_a_clamped: partDA.clamped,
    ma_plan_drug_deductible_applied_usd: partDB.applied,
    ma_plan_drug_deductible_clamped: partDB.clamped,
    regulatory_basis: [
      '2026 Part A inpatient hospital deductible $1,736; days 61-90 $434/day; lifetime reserve days $868/day (CMS 2026 Medicare Parts A & B Premiums and Deductibles fact sheet; medicare.gov inpatient hospital coverage).',
      '2026 Part B deductible $283; enrollee pays 20% of the Medicare-approved amount above it (same fact sheet).',
      'Medigap Plan G and Plan N do not cover the Part B deductible; Plan N charges up to $20 per office visit; high-deductible F/G is $2,950 in 2026 (medicare.gov Medigap plan benefit comparison).',
      '2026 Part D deductible $615, 25% standard coinsurance, $2,100 annual out-of-pocket threshold, $0 cost sharing in the catastrophic phase (CMS Final CY 2026 Part D Redesign Program Instructions; CMS 2026 MA and Part D Rate Announcement).',
      '2026 Medicare Advantage in-network out-of-pocket limit may not exceed $9,250 and excludes Part D spending (KFF analysis of the CMS MA enrollment and benefit landscape).',
    ],
    rounding_mode: 'half_up_to_cent_on_every_intermediate_money_amount',
    scope_note: SCOPE_NOTE,
    cites: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G11'],
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