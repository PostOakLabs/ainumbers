import { executionHash } from './_hash.mjs';

// art-769, port of ApexLogics #152 "Medicare OOP Exposure"
// (al_id AL-166, tool_id 152-medicare-oop-exposure, registry 5.13.0).
//
// art-769 reserved by APEX-PORT-ARTNUM-ALLOC-1 for Apex #152 (payload staging number
// art-747 VOID, renumbered at land by APEX-PORT-152-LAND-RESUME-1).
//
// LAND ADJUDICATION (2026-11-13, Tim popup answer 'diff first, then decide', CMS 2026
// Part B fact sheet re-fetched by the verifier seat) -- three changes against the payload:
//  A1  bnd-C13: tier-6 refusal KEPT. The CMS 2026 Part B fact sheet lists six income bands
//      only (top band $689.90), so there is no tier 6; any tier outside 0-5 is a named
//      domain error, never coerced.
//  A2  bnd-C16: worst_case_spend_multiplier is now an optional INPUT (default 4, integer
//      1-100) instead of a fixed literal. It is a MODEL_ASSUMPTION, not a CMS figure, and
//      is reported in model_assumptions_used.
//  A3  ND-1: Plan G annual_ceiling is null (unbounded), not the $283 Part B deductible.
//      The $283 stays only as the Part B deductible residual; the flag
//      PLANG_CEILING_IS_PART_B_DEDUCTIBLE_ONLY is kept.
//  A4  domain_errors is mirrored into output_payload.warnings (flag-mirror doctrine) and
//      compliance flags are built conditionally; execution_hash comes from _hash.mjs.
//
// PORT DECISIONS (all deliberate, all reversible by the builder):
//  P1  Integer CENTS throughout. The Apex page computes in IEEE-754 dollars with a
//      `money(n) = round(n*100)/100` helper. This draft scales every monetary input
//      and constant to integer cents and does the coinsurance divisions as exact
//      round-half-up integer division by the basis-point denominator (10000). Same
//      algebra, no floating point anywhere in the arithmetic, so it is zkVM-promotable
//      in the art-617 sense. Verified equivalent to the Apex page's own floats on all
//      48 fixture vectors (see .d/fixtures.json and VECTORS.md).
//  P2  EXPLICIT plan_year INPUT (the APEXPORT-110B pattern). The Apex page reads no
//      clock in its arithmetic -- `new Date()` appears only in the Markdown/AP2
//      exporters -- so its compute() is already deterministic. But the parameters are
//      2026-vintage and silently rotate, so the draft takes `plan_year` as an explicit
//      input and looks the parameters up in PLAN_YEAR_PARAMS. A new year adds a keyed
//      entry; existing entries are never overwritten. An undeclared plan_year is a named
//      domain error, never a silent fallback to 2026.
//  P3  REJECT out-of-domain inputs, do not clamp. The Apex page coerces every
//      non-finite or negative numeric input to 0 and falls through any unrecognised
//      coverage_structure to the Advantage branch. The draft follows the art-617 house
//      rule ("REJECTED here, never clamped or silently coerced") and returns
//      valid_input:false with named domain_errors. Fixtures C13/C16 record the page's
//      NaN-producing behaviour that this replaces.
//  P4  The Apex "Constants Panel" (18 editable fields) is NOT carried as policy
//      parameters. Those fields are 2026 CMS/statutory figures and live in
//      PLAN_YEAR_PARAMS as named literals with sources, exactly as art-617 keeps its
//      annual_oop_threshold_cents. The remaining six -- Plan N $20 visit copay, $250
//      average visit charge, and the four worst-case knobs -- are modelling assumptions,
//      not tax-year-indexed facts, and stay in MODEL_ASSUMPTIONS.
//
// CITATIONS: every premise below is grounded by a fetch performed 2026-10-13; URLs,
// verbatim quotes and sha256 digests of the fetched bytes are in .d/CITES.md. Kernel
// comments carry the short cite key. Nothing here is cited from memory.
//
// Verify-only recomputation from caller-declared inputs. This kernel does not enrol
// anyone in anything, does not price any actual plan, and does not assert that any
// real enrollee's bill is correct. Estimate only -- not an official CMS, SSA or plan
// communication, and not financial, legal or tax advice.

const TOOL_ID = 'art-769-medicare-oop-exposure';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_medicare_oop_exposure',
  mandate_type: 'retirement_projection',
  gpu: false,
};

// ── PLAN-YEAR PARAMETERS ────────────────────────────────────────────────────────
// Every value is an integer in CENTS (or a day count, or basis points). Plan-year
// indexed: CMS republishes every one of these annually and the 2027 set differs.
// A future year ADDS a keyed entry; an existing entry is never overwritten.
//
// Sources, all fetched and quoted 2026-10-13 -- see .d/CITES.md rows C1..C9:
//   [C1] CMS, "2026 Medicare Parts A & B Premiums and Deductibles" fact sheet, 2025-11-14
//   [C2] CMS MLN Matters MM14279, "Medicare Deductible, Coinsurance & Premium Rates:
//        CY 2026 Update", Rev. 13504, issued 2025-12-05, effective 2026-01-01
//   [C3] CMS, "Final CY 2026 Part D Redesign Program Instructions" fact sheet, 2025-04-07
//   [C4] Medicare.gov, "2026 Medicare Costs" (Part A cost sharing by day)
//   [C5] CMS Medicare Benefit Policy Manual, Ch. 3 sec. 10 (benefit period, lifetime
//        reserve days) and sec. 20.B (100 days of extended care services per period)
export const PLAN_YEAR_PARAMS = {
  2026: {
    // Social Security Act 1813(a)(1)(A): the inpatient hospital deductible in effect for
    // the calendar year in which the benefit period BEGINS. [C1] "The Medicare Part A
    // inpatient hospital deductible that beneficiaries pay if admitted to the hospital
    // will be $1,736 in 2026" ; [C2] "Part A deductible: $1,736".
    part_a_deductible_cents: 173600,

    // SSA 1813(a)(1)(A): one-fourth of the inpatient deductible per day, days 61-90.
    // [C1] "$434 per day for the 61 st through 90 th day" ; [C2] "$434 a day for days 61-90".
    part_a_coinsurance_days_61_90_cents: 43400,

    // SSA 1813(a)(1)(B): one-half of the inpatient deductible per lifetime reserve day.
    // [C1] "$868 per day for lifetime reserve days" ; [C2] "$868 a day for days 91-150".
    part_a_lifetime_reserve_day_cents: 86800,

    // 60 reserve days for the beneficiary's LIFETIME, non-renewable, used only once.
    // [C5] "Part A benefits allow for 60 lifetime reserve days for use after a 90-day
    // benefit period has exhausted. The 60 days are not renewable and may be used only
    // once during a beneficiary's lifetime."
    lifetime_reserve_days: 60,

    // SSA 1813(a)(3): one-eighth of the inpatient deductible per SNF day, days 21-100.
    // [C1] "the daily coinsurance for days 21 through 100 of extended care services in a
    // benefit period will be $217.00 in 2026" ; [C4] "Days 21-100: $217 each day."
    snf_daily_coinsurance_cents: 21700,

    // [C4] "Days 1-20: $0 each day after you pay your Part A deductible. Days 21-100:
    // $217 each day. Days 101 and beyond: You pay all costs."
    snf_days_covered_in_full: 20,
    snf_days_covered_per_period: 100,

    // SMI cash deductible satisfied once per calendar year before payment under Part B.
    // [C1] "The annual deductible for all Medicare Part B beneficiaries will be $283 in
    // 2026" ; [C2] "Part B deductible: $283 a year".
    part_b_deductible_cents: 28300,

    // SSA 1853(b)(1): 20 percent of the Medicare-approved amount after the deductible.
    // [C2] "Part B coinsurance: 20%" ; [C4] "Usually 20% of the cost for each
    // Medicare-covered service or item after you've paid your deductible".
    part_b_coinsurance_bp: 2000,

    // SSA 1860D-2(b)(1), as indexed for CY 2026: the maximum annual Part D deductible.
    // [C3] "The enrollee pays 100% of their gross covered prescription drug costs (GCPDC)
    // until the deductible of $615 for CY 2026 is met."
    part_d_max_deductible_cents: 61500,

    // SSA 1860D-2(b)(4)(B), as indexed for CY 2026: the annual out-of-pocket threshold
    // above which the enrollee owes no cost sharing for covered Part D drugs.
    // [C3] "The CY 2026 annual out-of-pocket (OOP) threshold of $2,100" and "This phase
    // ends when the enrollee has reached the annual OOP spending threshold of $2,100".
    // Anchored to the same figure AINumbers already carries in
    // chaingraph/kernels/art-617-m3p-monthly-cap-calculator.kernel.mjs
    // PLAN_YEAR_PARAMS[2026].annual_oop_threshold_cents = 210000.
    part_d_oop_cap_cents: 210000,

    // Initial-coverage coinsurance the enrollee pays on covered Part D drugs.
    // [C3] "The enrollee pays 25% coinsurance for covered Part D drugs."
    part_d_standard_coinsurance_bp: 2500,

    // 2026 Part B IRMAA tier TOTAL monthly premium (tiers 0..5), full Part B coverage.
    // [C1] income table, Total Monthly Premium Amount column, in order:
    //   $0.00 IRMAA -> $202.90 | >$109,000-<=$137,000 -> $284.10 | >$137,000-<=$171,000 ->
    //   $405.80 | >$171,000-<=$205,000 -> $527.50 | >$205,000-<$500,000 -> $649.20 |
    //   >=$500,000 -> $689.90.
    // (tier 0 is the base standard premium [C1] "$202.90 for 2026", [C2] "Part B standard
    // premium: $202.90 a month"; tiers 1-5 add the IRMAA to it.)
    part_b_premium_by_tier_cents: [20290, 28410, 40580, 52750, 64920, 68990],

    // 2026 Part D income-related monthly adjustment amount (tiers 0..5).
    // [C1] Part D income table, Income-related monthly adjustment amount column, in order:
    //   $0.00 | $14.50 | $37.50 | $60.40 | $83.30 | $91.00.
    part_d_irmaa_by_tier_cents: [0, 1450, 3750, 6040, 8330, 9100],
  },
};

export const DEFAULT_PLAN_YEAR = 2026;

// ── MODEL ASSUMPTIONS ────────────────────────────────────────────────────────────
// NOT tax-year-indexed and NOT CMS parameters. They are this tool's scenario-shaping
// choices, carried from the Apex page's constants panel as they were, and they are the
// knobs a user is most likely to argue with -- so they are named, commented and
// carried in the output payload so an artifact reader can see what moved the number.
export const MODEL_ASSUMPTIONS = {
  // Medicare Supplement Plan N charges the lesser of $20 or the Part B coinsurance for
  // each covered office visit, and the lesser of $50 or the Part B coinsurance for each
  // covered ER visit (waived if admitted). NAIC Model Regulation 651 sec. 9.1E(11)(a);
  // CMS "Revised Questions and Answers Regarding Implementation of Medicare Supplement
  // Plan N Copayment, Deductible and Coinsurance", 2010-04-22 -- "the subscriber is
  // responsible for up to $20 per office visit and up to $50 for an emergency room
  // visit" [C6]. Medicare.gov's plan comparison repeats it: "You must pay a copayment
  // of up to $20 for some office visits and up to $50 for emergency room visits when you
  // aren't admitted as an inpatient." [C7]
  // PORT CAVEAT: the copay is per VISIT, but this tool has no visit count, so it
  // estimates visits as approved Part B charges / average_visit_charge_cents. That is a
  // proxy, not a count of real encounters. See .d/DIFFERS.md.
  plan_n_visit_copay_cents: 2000,

  // Divisor for that visit estimate. Pure modelling choice: there is no official
  // "average Medicare-approved charge per visit" figure to divide by.
  average_visit_charge_cents: 25000,

  // The routine / rough / worst-case triple. "Worst case" is this tool's stress test,
  // not a Medicare category: 2 benefit periods, 30 inpatient days each, 60 SNF days,
  // and 4x the entered Part B and drug spend.
  worst_case_benefit_periods: 2,
  worst_case_days_per_period: 30,
  worst_case_snf_days: 60,
  // Default for the optional worst_case_spend_multiplier input (adjudication A2). No
  // official "worst case" figure exists; the caller may override it within [1, 100].
  worst_case_spend_multiplier: 4,
};
export const WORST_CASE_MULTIPLIER_MAX = 100;

export const COVERAGE_STRUCTURES = ['OriginalOnly', 'PlanG', 'PlanN', 'Advantage'];

// ── integer helpers ──────────────────────────────────────────────────────────────
function isSafeInt(v) { return typeof v === 'number' && Number.isSafeInteger(v); }

/** round_half_up(numerator, denominator) for numerator >= 0, denominator > 0.
 *  Exact integer floor + remainder compare; no floating-point division in the
 *  decision, so there is no IEEE-754 rounding boundary to be unsound about. */
function roundHalfUp(numerator, denominator) {
  const q = Math.floor(numerator / denominator);
  const r = numerator - q * denominator;
  return (2 * r >= denominator) ? q + 1 : q;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function usd(cents) { return cents === null ? null : (cents / 100).toFixed(2); }

// ── the Part D phase walk (Apex tool 151 step 5 / tool 152 step 5) ────────────────
// Deductible phase (100% of gross covered drug cost) -> initial coverage at
// part_d_standard_coinsurance_bp -> capped at the plan-year OOP threshold, above which
// the enrollee owes nothing for covered Part D drugs. [C3]
function drugPhase(drugCostCents, planDeductibleCents, oopCapCents, standardCoinsuranceBp) {
  const deductiblePaid = Math.max(0, Math.min(drugCostCents, planDeductibleCents));
  const postDeductible = Math.max(0, drugCostCents - planDeductibleCents);
  const coinsurancePaid = roundHalfUp(postDeductible * standardCoinsuranceBp, 10000);
  const beforeCap = deductiblePaid + coinsurancePaid;
  return Math.min(beforeCap, oopCapCents);
}

// ── one scenario: steps 1-9 of the Apex pipeline ─────────────────────────────────
function runScenario(p, y, a) {
  // Step 1: Part A inpatient, per benefit period.
  // Days 1-60 are covered by the deductible; days 61-90 carry the one-fourth coinsurance;
  // days 91-150 carry the one-half lifetime-reserve coinsurance; days after 150 get no
  // Medicare payment at all. [C1] [C2] [C4] [C5]
  const days61to90 = clamp(p.days_per_period - 60, 0, 30);
  const coins61to90 = days61to90 * y.part_a_coinsurance_days_61_90_cents;
  const reserveDaysPerPeriod = clamp(p.days_per_period - 90, 0, y.lifetime_reserve_days);
  const coinsReserve = reserveDaysPerPeriod * y.part_a_lifetime_reserve_day_cents;
  const beyondReserve = Math.max(0, p.days_per_period - (90 + y.lifetime_reserve_days));
  const unlimitedFlag = beyondReserve > 0;
  const perPeriodA = p.benefit_periods > 0
    ? y.part_a_deductible_cents + coins61to90 + coinsReserve
    : 0;

  // Step 2: total Part A inpatient for the year.
  const partAInpatient = perPeriodA * p.benefit_periods;
  const reserveDaysConsumed = reserveDaysPerPeriod * p.benefit_periods;

  // Step 3: skilled nursing. Days 1-20 are in full, days 21-100 carry coinsurance,
  // days 101+ get no Medicare payment and are NOT costed here. [C4]
  const snfChargeableDays = clamp(
    p.snf_days - y.snf_days_covered_in_full,
    0,
    y.snf_days_covered_per_period - y.snf_days_covered_in_full,
  );
  const snfBeyondMax = p.snf_days > y.snf_days_covered_per_period;
  const partASNF = snfChargeableDays * y.snf_daily_coinsurance_cents * p.benefit_periods;

  // Step 4: Part B -- annual deductible first, then coinsurance on the remainder.
  const partBAfterDeductible = Math.max(0, p.part_b_approved_charges_cents - y.part_b_deductible_cents);
  const partBCoins = roundHalfUp(partBAfterDeductible * y.part_b_coinsurance_bp, 10000);
  const partBTotal = Math.min(y.part_b_deductible_cents, p.part_b_approved_charges_cents) + partBCoins;

  // Step 5: Part D phase walk.
  const partDTotal = drugPhase(p.annual_drug_cost_cents, p.part_d_deductible_cents, y.part_d_oop_cap_cents, y.part_d_standard_coinsurance_bp);

  // Step 6: apply the coverage structure.
  // OriginalOnly: the enrollee keeps every dollar of Part A and Part B cost sharing, and
  // there is no annual ceiling on the medical side. [C8] "Traditional Medicare does not
  // have an out-of-pocket limit for covered services."
  // PlanG / PlanN: both cover the Part B deductible (no), Part B coinsurance (yes) and
  // all Part A cost sharing (yes) [C7], so what survives is the Part B deductible plus,
  // for Plan N, the per-visit copays. Plan G carries no out-of-pocket limit [C7]
  // "Out-of-pocket limit ... N/A" -- see .d/DIFFERS.md for the Plan G ceiling.
  // Advantage: the plan sets its own coinsurance and its own in-network MOOP, and CMS
  // caps how high that MOOP may be [C9] (see regulatory_basis). The Part D amount is NOT
  // inside the MOOP: [C10] "These out-of-pocket limits apply to Part A and B services
  // only, and do not apply to Part D spending, which has a separate out-of-pocket limit
  // of $2,100 in 2026."
  let medicalOOP, ceiling, moopFallback = false;
  if (p.coverage_structure === 'OriginalOnly') {
    medicalOOP = partAInpatient + partASNF + partBTotal;
    ceiling = null;
  } else if (p.coverage_structure === 'PlanG') {
    // ND-1 (adjudication A3): no annual ceiling. The Part B deductible is only the
    // residual the plan leaves, not a cap on exposure.
    medicalOOP = y.part_b_deductible_cents;
    ceiling = null;
  } else if (p.coverage_structure === 'PlanN') {
    const estimatedVisits = roundHalfUp(p.part_b_approved_charges_cents, a.average_visit_charge_cents);
    medicalOOP = y.part_b_deductible_cents + a.plan_n_visit_copay_cents * estimatedVisits;
    ceiling = null; // no out-of-pocket limit on Plan N either [C7]
  } else {
    const medicalRaw = roundHalfUp(
      (partAInpatient + partASNF + partBAfterDeductible) * p.advantage_coinsurance_pct,
      100,
    );
    if (p.advantage_moop_cents <= 0) {
      // A $0 MOOP is not a real Medicare Advantage MOOP; treat it as not entered and
      // say so rather than letting a plan with a $0 ceiling look like a good buy.
      medicalOOP = medicalRaw;
      ceiling = null;
      moopFallback = true;
    } else {
      medicalOOP = Math.min(medicalRaw, p.advantage_moop_cents);
      ceiling = p.advantage_moop_cents;
    }
  }

  // Step 7: premiums. Part B IRMAA is a whole-premium uplift by tier; the Part D
  // income-related adjustment is added on top of whatever the plan charges. [C1]
  const premiums = (y.part_b_premium_by_tier_cents[p.irmaa_tier] + p.supplemental_monthly_premium_cents) * 12
    + y.part_d_irmaa_by_tier_cents[p.irmaa_tier] * 12;

  // Steps 8-9: totals and the monthly budget equivalent.
  const totalOOPExcludingPremiums = medicalOOP + partDTotal;
  const totalWithPremiums = totalOOPExcludingPremiums + premiums;
  const monthlyBudget = roundHalfUp(totalWithPremiums, 12);

  return {
    part_a_inpatient_cents: partAInpatient,
    part_a_snf_cents: partASNF,
    part_b_total_cents: partBTotal,
    part_d_total_cents: partDTotal,
    medical_oop_cents: medicalOOP,
    annual_ceiling_cents: ceiling,
    premiums_cents: premiums,
    total_oop_excluding_premiums_cents: totalOOPExcludingPremiums,
    total_with_premiums_cents: totalWithPremiums,
    monthly_budget_cents: monthlyBudget,
    reserve_days_consumed: reserveDaysConsumed,
    reserve_days_beyond_pool: beyondReserve,
    unlimited_days_flag: unlimitedFlag,
    snf_beyond_max_flag: snfBeyondMax,
    moop_fallback_flag: moopFallback,
  };
}

// ── input bounds ─────────────────────────────────────────────────────────────────
// Finite upper bounds chosen so every product in runScenario (cents x basis points, cents x
// worst-case multiplier, periods x per-period cost) stays below 2^53 and so buildArtifact
// can always hash the result. Largest chain: 1e10 cents x 100 (multiplier) x 2500 bp
// = 2.5e15 < 9.007e15.
export const MAX_COUNT_PERIODS = 100;
export const MAX_COUNT_DAYS = 366;
export const MAX_CENTS = 10000000000;

// ── hashability walk (D6) ────────────────────────────────────────────────────────
// Mirrors the classes _hash.mjs assertIJson() refuses before canonicalizing: a non-finite
// number or an integer outside the 2^53 safe range, nesting past its MAX_DEPTH, more values
// than its MAX_ELEMENTS. Reports { reason, detail } with the path and kind only, never the
// value; null when the subtree is safe to hash. The shared _hash.mjs stays untouched.
const HASH_MAX_DEPTH = 512;        // _hash.mjs MAX_DEPTH
const HASH_MAX_ELEMENTS = 1000000; // _hash.mjs MAX_ELEMENTS
// pp alone is held to tighter margins than the full preimage: the {policy_parameters,
// output_payload} envelope wraps pp two levels deeper and output_payload carries values too.
const PP_MAX_DEPTH = HASH_MAX_DEPTH - 8;
const PP_MAX_ELEMENTS = 199000;

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  return null;
}

function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

// ── domain validation (P3: name the violated bound, never coerce) ─────────────────
// `pp` here is an own-property copy of the caller's object, so no inherited key is read.
// Presence: absent (undefined) takes the declared default only for plan_year and
// worst_case_spend_multiplier; a present null or wrong type always refuses.
function validate(pp) {
  const errors = [];

  const planYear = pp.plan_year === undefined ? DEFAULT_PLAN_YEAR : pp.plan_year;
  const y = (typeof planYear === 'number' && Number.isSafeInteger(planYear) && Object.hasOwn(PLAN_YEAR_PARAMS, planYear))
    ? PLAN_YEAR_PARAMS[planYear] : undefined;
  if (!y) {
    errors.push(typeof planYear === 'number'
      ? `plan_year ${JSON.stringify(planYear)} has no declared parameter entry; add one to PLAN_YEAR_PARAMS, never fall back`
      : `plan_year must be a number naming a declared plan year, got ${planYear === null ? 'null' : typeof planYear}; never coerced`);
  }

  if (!COVERAGE_STRUCTURES.includes(pp.coverage_structure)) {
    errors.push(`coverage_structure must be exactly one of ${COVERAGE_STRUCTURES.map((s) => JSON.stringify(s)).join(', ')}`);
  }

  const tier = pp.irmaa_tier;
  if (!isSafeInt(tier) || tier < 0 || tier >= (y?.part_b_premium_by_tier_cents.length ?? Infinity)) {
    errors.push(`irmaa_tier must be an integer in [0, ${(y?.part_b_premium_by_tier_cents.length ?? 6) - 1}] indexing the plan-year IRMAA tables`);
  }

  for (const [k, max] of [['benefit_periods', MAX_COUNT_PERIODS], ['days_per_period', MAX_COUNT_DAYS], ['snf_days', MAX_COUNT_DAYS]]) {
    if (!isSafeInt(pp[k]) || pp[k] < 0) errors.push(`${k} must be a non-negative integer count of days or periods`);
    else if (pp[k] > max) errors.push(`${k} must not exceed ${max}`);
  }

  for (const k of ['part_b_approved_charges_cents', 'annual_drug_cost_cents', 'part_d_deductible_cents',
    'supplemental_monthly_premium_cents', 'advantage_moop_cents']) {
    if (!isSafeInt(pp[k]) || pp[k] < 0) errors.push(`${k} must be a non-negative integer number of CENTS`);
    else if (pp[k] > MAX_CENTS) errors.push(`${k} must not exceed ${MAX_CENTS} cents`);
  }

  if (!isSafeInt(pp.advantage_coinsurance_pct) || pp.advantage_coinsurance_pct < 0 || pp.advantage_coinsurance_pct > 100) {
    errors.push('advantage_coinsurance_pct must be an integer in [0, 100]');
  }

  // Optional input (A2): absent (undefined) takes the declared default; a present null or
  // wrong type refuses; otherwise an integer in [1, WORST_CASE_MULTIPLIER_MAX].
  if (pp.worst_case_spend_multiplier !== undefined
    && (!isSafeInt(pp.worst_case_spend_multiplier) || pp.worst_case_spend_multiplier < 1
      || pp.worst_case_spend_multiplier > WORST_CASE_MULTIPLIER_MAX)) {
    errors.push(`worst_case_spend_multiplier must be an integer in [1, ${WORST_CASE_MULTIPLIER_MAX}] when given`);
  }

  return { errors, planYear, y };
}

// ── compute ──────────────────────────────────────────────────────────────────────
export function compute(rawPp) {
  // Presence and shape are checked, never defaulted: a non-object or an unhashable input
  // (D6) refuses here, so buildArtifact never has to hash anything compute accepted.
  const shapeErrors = [];
  if (!isPlainObject(rawPp)) {
    shapeErrors.push('REFUSED_INPUT_WRONG_TYPE: policy parameters must be a plain object');
  } else {
    const unhashable = findHashRefusal(rawPp, 'pp', 1, { maxDepth: PP_MAX_DEPTH, maxElements: PP_MAX_ELEMENTS, n: 0 });
    if (unhashable !== null) shapeErrors.push(`${unhashable.reason}: ${unhashable.detail}`);
  }
  // Own-property copy: a caller key such as __proto__ or constructor is an ordinary key and
  // no inherited value is ever read.
  const pp = shapeErrors.length === 0 ? Object.fromEntries(Object.entries(rawPp)) : {};
  const checked = shapeErrors.length === 0 ? validate(pp) : { errors: shapeErrors, planYear: DEFAULT_PLAN_YEAR, y: undefined };
  const { errors, planYear, y } = checked;
  const valid_input = errors.length === 0;

  const output_payload = {
    plan_year: typeof planYear === 'number' ? planYear : null,
    coverage_structure: COVERAGE_STRUCTURES.includes(pp.coverage_structure) ? pp.coverage_structure : null,
    irmaa_tier: isSafeInt(pp.irmaa_tier) ? pp.irmaa_tier : null,
    valid_input,
    domain_errors: errors,

    routine: null,
    rough: null,
    worst: null,
    exposure_spread_cents: null,
    unlimited_exposure: null,

    part_d_deductible_input_cents: isSafeInt(pp.part_d_deductible_cents) ? pp.part_d_deductible_cents : null,
    // A plan deductible above the plan-year maximum is not a real plan; the statutory
    // maximum binds. Clamped, and the clamp is reported, never silent. [C3]
    part_d_deductible_effective_cents: (valid_input && y)
      ? Math.min(pp.part_d_deductible_cents, y.part_d_max_deductible_cents)
      : null,
    part_d_deductible_clamped: (valid_input && y)
      ? pp.part_d_deductible_cents > y.part_d_max_deductible_cents
      : null,

    parameters_used: valid_input ? { ...y } : null,
    model_assumptions_used: {
      ...MODEL_ASSUMPTIONS,
      // A refused number is echoed as given (it is hashable: the shape walk already ran);
      // absent, null or a non-number reports the declared default.
      worst_case_spend_multiplier: typeof pp.worst_case_spend_multiplier === 'number'
        ? pp.worst_case_spend_multiplier
        : MODEL_ASSUMPTIONS.worst_case_spend_multiplier,
    },

    regulatory_basis: 'SSA 1813(a)(1)(A) Part A deductible; 1813(a)(1)(A) one-fourth coinsurance days 61-90; 1813(a)(1)(B) one-half coinsurance lifetime reserve days; 1813(a)(3) one-eighth SNF coinsurance days 21-100; SMA 1853(b)(1) Part B 20 percent after the annual deductible; SSA 1860D-2(b)(1) Part D deductible; 1860D-2(b)(4)(B) Part D annual out-of-pocket threshold; 42 CFR 422.100(f)(4) Medicare Advantage in-network MOOP; NAIC Model Regulation 651 sec. 9.1E(11) Plan N copayments.',
    scope_note: 'Verify-only recomputation of Medicare cost sharing for a modelled year of utilisation. It does not track a real enrollee, does not price any actual plan, does not decide enrollment, and does not model Part B excess charges above the Medicare-approved amount, non-covered services, premiums other than Part B, Part D base premium, or any cost beyond day 150 / day 100 of SNF care. Estimate only -- not an official CMS, SSA or plan communication, and not financial, legal or tax advice.',
  };

  if (!valid_input) {
    output_payload.warnings = ['OOP_INPUT_OUT_OF_DECLARED_DOMAIN'];
    return { output_payload, compliance_flags: ['OOP_INPUT_OUT_OF_DECLARED_DOMAIN'] };
  }

  const a = MODEL_ASSUMPTIONS;
  const worstMultiplier = output_payload.model_assumptions_used.worst_case_spend_multiplier;
  const base = {
    coverage_structure: pp.coverage_structure,
    irmaa_tier: pp.irmaa_tier,
    benefit_periods: pp.benefit_periods,
    days_per_period: pp.days_per_period,
    snf_days: pp.snf_days,
    part_b_approved_charges_cents: pp.part_b_approved_charges_cents,
    annual_drug_cost_cents: pp.annual_drug_cost_cents,
    part_d_deductible_cents: Math.min(pp.part_d_deductible_cents, y.part_d_max_deductible_cents),
    supplemental_monthly_premium_cents: pp.supplemental_monthly_premium_cents,
    advantage_moop_cents: pp.advantage_moop_cents,
    advantage_coinsurance_pct: pp.advantage_coinsurance_pct,
  };

  // Step 10: the three scenarios.
  //   routine -- no admission, no SNF; premiums and Part B / Part D still stand.
  //   rough   -- the year exactly as entered.
  //   worst   -- this tool's own stress test (MODEL_ASSUMPTIONS).
  const routine = runScenario({ ...base, benefit_periods: 0, snf_days: 0 }, y, a);
  const rough = runScenario(base, y, a);
  const worst = runScenario({
    ...base,
    benefit_periods: a.worst_case_benefit_periods,
    days_per_period: a.worst_case_days_per_period,
    snf_days: a.worst_case_snf_days,
    part_b_approved_charges_cents: base.part_b_approved_charges_cents * worstMultiplier,
    annual_drug_cost_cents: base.annual_drug_cost_cents * worstMultiplier,
  }, y, a);

  // Step 11: exposure spread.
  const exposureSpread = worst.total_with_premiums_cents - routine.total_with_premiums_cents;

  // Step 12: is there an annual ceiling at all?
  const unlimitedExposure = rough.annual_ceiling_cents === null;

  output_payload.routine = routine;
  output_payload.rough = rough;
  output_payload.worst = worst;
  output_payload.exposure_spread_cents = exposureSpread;
  output_payload.unlimited_exposure = unlimitedExposure;

  output_payload.usd_view = {
    routine_total: usd(routine.total_with_premiums_cents),
    rough_total: usd(rough.total_with_premiums_cents),
    worst_total: usd(worst.total_with_premiums_cents),
    monthly_budget: usd(rough.monthly_budget_cents),
    medical_oop: usd(rough.medical_oop_cents),
    annual_ceiling: usd(rough.annual_ceiling_cents),
    exposure_spread: usd(exposureSpread),
  };

  // Every flag is earned by a computed condition. The tool multiplies per-period reserve
  // consumption by the period count, so a year with several long admissions can report
  // more than the 60 non-renewable lifetime days; real lifetime consumption is bounded
  // at 60, so the overcount is surfaced, not smoothed over.
  const compliance_flags = [
    ...(unlimitedExposure ? ['NO_ANNUAL_MEDICAL_CEILING'] : []),
    ...(rough.unlimited_days_flag ? ['LIFETIME_RESERVE_DAYS_EXHAUSTED'] : []),
    ...(rough.reserve_days_consumed > y.lifetime_reserve_days ? ['LIFETIME_RESERVE_OVERCOUNT_MODELLING_CAVEAT'] : []),
    ...(rough.snf_beyond_max_flag ? ['SNF_DAYS_BEYOND_100_NOT_COSTED'] : []),
    ...(rough.moop_fallback_flag ? ['ADVANTAGE_MOOP_NOT_ENTERED'] : []),
    ...(pp.coverage_structure === 'PlanG' ? ['PLANG_CEILING_IS_PART_B_DEDUCTIBLE_ONLY'] : []),
    ...(pp.coverage_structure === 'PlanN' ? ['PLANN_VISIT_COUNT_ESTIMATED_NOT_COUNTED'] : []),
  ];
  output_payload.warnings = compliance_flags.slice();

  return { output_payload, compliance_flags };
}

// ── artifact wrapper ─────────────────────────────────────────────────────────────
// `now` is passed in, never read from a clock, so the same pp always produces the same
// artifact. execution_hash comes from the shared RFC 8785 path in _hash.mjs.
export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  // The object walked below is the exact execution_hash preimage. When the shared
  // canonicalizer would refuse it, mint the artifact with a null execution_hash and the
  // reason beside it instead of letting the hash throw (D6). compute() already refuses the
  // same input, so this is the backstop: buildArtifact never throws on any input.
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'pp', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  const artifact = {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now,
    execution_hash: unhashable === null ? await executionHash(pp, output_payload) : null,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  if (unhashable !== null) artifact.hash_refusal = { reason: unhashable.reason, detail: unhashable.detail };
  return artifact;
}