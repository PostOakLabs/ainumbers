import { executionHash } from './_hash.mjs';

// art-761-caregiver-income-impact - port of ApexLogics #117 (AL-124), caregiver
// income-impact and lost-earnings estimator. Landed from the APEXPORT-117
// porting payload (bus ps, GRADES PASS-PENDING-XV 2026-10-14, Builder-verifies-
// at-land: 64/64 payload fixture vectors re-executed through compute() matching
// the stored outputs, APEX-PORT-117-LAND-1).
//
// PORTED FROM: ApexLogics display_number #117 "Caregiver Income Impact & Lost
// Earnings" (al_id AL-124, tool_id 117-caregiver-income-impact, CC BY 4.0).
// Source page https://apexlogics.org/tools/117-caregiver-income-impact/ fetched
// 2026-10-13Z, 30063 bytes, sha256
// 99b9298c706f618954c491318fdf8826b6e0fd46cef3b3caf22ec13e1bd2e6ee. Registry
// entry confirmed in suite-registry.json 5.13.0 (fetched 2026-10-13Z, 423823
// bytes, sha256 13dc9610113f90abe19ad0e44553b959c5fe6fb529e583ea8503114e514d24a4).
//
// ART-761 reserved by APEX-PORT (Apex #117 port; no other holder).
//
// ANCHORS / REUSE (do not duplicate the SSA actuarial family):
//   art-282-social-security-claiming-optimizer - claiming-age / FRA / earnings-
//     test module. Same SSA family; this kernel borrows its pinned-constant +
//     overridable-default discipline (see the earningsTestAnnualLimit pattern in
//     art-282 v1.1.0) and never re-derives FRA or the AIME formula.
//   pf-139-social-security-bridge - the bridge node that carries SS facts across
//     suites. art-761 emits NO SS claim-age advice and no PIA; if this node ever
//     needs one it must call the bridge, not inline a second SSA formula.
//   art-339-compute-gross-to-net / art-713-scorp-election-break-even - the two
//     in-repo carriers of the same SSA wage-base vintage table this kernel reads
//     (C1 below). Reused, not re-derived.
//
// DETERMINISM / zkVM-PROMOTABILITY (APEXPORT-110B as-of pattern):
//   The Apex page has NO clock in its arithmetic - no Date, no today, no now -
//   so nothing had to be parameterised out of the formula. But the SS constants
//   it divides by are VINTAGE-DEPENDENT, and the only thing that selects a
//   vintage is the calendar. So the kernel takes an explicit `as_of` date input
//   (never a clock read) and resolves the SSA table by its year. Same inputs and
//   same as_of give the same bytes on every run, in a browser and in a guest.
//
// ------------------------------- CONSTANTS -------------------------------
// C1  SS contribution and benefit base (the "taxable maximum"), by vintage year:
//       2025 -> $176,100
//       2026 -> $184,500
//     SSA, Contribution and Benefit Base, capture 2026-10-10: "For earnings in
//     2026, this base is $184,500." and the 1937-2026 table rows
//     "2025 176,100" / "2026 $184,500".
//     AINumbers agrees on this fact - art-713 C1 and the art-339 vintage table
//     both carry 184500 for 2026 - so there is NO numeric divergence here (see
//     DIFFERS-D1, which is a LABEL defect in the Apex source, not a value one).
//     Apex #117 hardcodes 184500 with no vintage table: at as_of in 2025 the
//     official base is 176100, which Apex could never express.
// C2  SSA average annual retired-worker benefit, by vintage year:
//       2025 -> $24,180/yr   ($2,015/mo before the 2.8% COLA)
//       2026 -> $24,864/yr   ($2,072/mo after the 2.8% COLA, payable Jan 2026)
//     SSA, "Effect of COLA on Average Social Security Benefits", capture
//     2026-09-22: "The COLA for December 2025 is 2.8 percent and is first payable
//     in January 2026" / "Retired worker $2,015 $2,072 $57".
//     APEX VALUE IS $23,000/yr (page line 336, `const avgSSBenefit = 23000`),
//     which is the official figure for NEITHER vintage. Official wins by default
//     (DIFFERS-D2): the kernel defaults to C2 and still accepts a caller-supplied
//     override so a verifier can reproduce Apex's 23,000 exactly.
// ---------------------------------------------------------------------------
const SS_WAGE_BASE_BY_VINTAGE = { 2025: 176100, 2026: 184500 };
const SS_AVERAGE_ANNUAL_BENEFIT_BY_VINTAGE = { 2025: 24180, 2026: 24864 };

// UNGROUNDED (CITES.md U1) - Apex page line 332: `setbackCost =
// fv(annualSetbackLoss, 0.02, yearsAfterCare)` with the comment "salary grows
// ~2% but still gap". 2% is a modelling rate with no statutory or published
// source; the Apex comment is also confused about whether it inflates or
// discounts the loss. No official same-fact figure exists, so there is nothing
// to override it with: kept AS-IS at 2% for source fidelity and flagged.
const SETBACK_COMPOUNDING_RATE = 0.02;

// UNGROUNDED (CITES.md U2) - Apex page line 338:
// `annualSSReduction = avgSSBenefit * ssReducFraction * Math.min(careYears / 35,
// 0.15)`. The linearisation "earnings gap / wage base -> proportional benefit
// loss, scaled by caregiving years, capped at 15%" is NOT the SSA benefit
// formula: SSA computes AIME from indexed lifetime earnings (Sec.202), so a year
// of zero earnings does not remove 1/35 of the benefit and no 15% cap exists in
// the statute. No official same-fact figure exists, so the shape is kept AS-IS
// for source fidelity; the whole branch is flagged ART761_SS_ESTIMATE_MODELED
// and the constants are named so a builder can swap them on adjudication.
const SS_CARE_YEARS_DIVISOR = 35;
const SS_CARE_YEAR_CAP = 0.15;

// UNGROUNDED (CITES.md U3) - Apex page line 341: `totalImpactWithSS =
// totalImpact + annualSSReduction * 20` with the comment "~20 yr SS draw". The
// 20-year drawdown is a modelling horizon, not a statutory term (benefits are
// for life, taxable above the threshold). Kept AS-IS, flagged, named.
const SS_LIFETIME_YEARS = 20;

// Apex UI bounds (page min/max attributes, lines 123-168). Advisory only: Apex
// itself does not clamp a typed-out-of-range value, so neither does this kernel -
// an out-of-range input computes AND raises a named caveat flag rather than
// being silently clamped or silently refused.
const UI_BOUNDS = {
  salary_usd: [10000, 1000000],
  current_age: [18, 65],
  retirement_age: [55, 75],
  care_years: [0.5, 30],
  income_reduction_pct: [0, 100],
  career_setback_pct: [0, 100],
  contribution_401k_pct: [0, 20],
  investment_return_pct: [1, 12],
  marginal_tax_rate_pct: [10, 37],
};

// The Apex career-setback selector offers 0 / 5 / 10 / 20 (page lines 151-154);
// the strategy branch below fires above 5.
const SETBACK_STRATEGY_BRANCH_PCT = 0.05;

const STRATEGY_BASE = [
  'Max IRA/401(k) during and after the caregiving period - even small contributions compound over the years left to retirement',
  'Consider spousal IRA contributions where applicable (allows retirement savings with little or no own income)',
  'Negotiate phased re-entry or remote arrangements to limit the career setback',
  'A written caregiver agreement with family for shared caregiving can provide modest taxable income and keep the Social Security record alive',
  'Review employer EAP, FMLA and caregiver benefits BEFORE reducing hours',
];

const SCOPE_NOTE =
  'Not a benefit projection and not tax advice. The Social Security term is a flagged linearisation (ART761_SS_ESTIMATE_MODELED), ' +
  'not the SSA AIME formula - use art-282-social-security-claiming-optimizer or pf-139-social-security-bridge for a real benefit ' +
  'estimate. The career-setback compounding rate, the caregiving-year divisor, the 15 percent cap and the 20-year draw are modelling ' +
  'constants carried from the source, each UNGROUNDED. marginal_tax_rate_pct is accepted and echoed but enters no formula ' +
  '(source DIFFERS-D4: the Apex page reads it and never uses it). No inflation, no FMLA/state leave value, no unpaid-care ' +
  'opportunity cost beyond the direct wage loss, no employer-benefit valuation.';

const TOOL_ID = 'art-761-caregiver-income-impact';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'estimate_caregiver_income_impact',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ------------------------------ DOMAIN ------------------------------

/** @type {(v: unknown) => boolean} */
function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function isIsoDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const y = Number(v.slice(0, 4));
  const m = Number(v.slice(5, 7));
  const d = Number(v.slice(8, 10));
  if (m < 1 || m > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= dim;
}

/** @type {(reason: string, text: string) => { output_payload: object, compliance_flags: string[] }} */
function refused(reason, text) {
  return {
    output_payload: {
      as_of: null, vintage_year: null,
      ss_wage_base_usd: null, ss_average_annual_benefit_usd: null, ss_average_benefit_source: null,
      salary_usd: null, current_age: null, retirement_age: null, care_years: null,
      income_reduction_pct: null, career_setback_pct: null, contribution_401k_pct: null,
      investment_return_pct: null, marginal_tax_rate_pct: null, marginal_tax_rate_used: false,
      years_to_retirement: null, years_after_care: null, years_from_midcare: null,
      annual_income_loss_cents: null, direct_income_loss_cents: null,
      annual_401k_lost_cents: null, retirement_savings_gap_cents: null,
      career_setback_cost_cents: null, setback_compounding_rate_bp: 200,
      ss_reduction_fraction_micro: null, annual_ss_reduction_cents: null, ss_lifetime_reduction_cents: null,
      total_impact_cents: null, total_impact_with_ss_cents: null,
      strategies: [], refusals: [], refusal_reason: reason,
      domain_errors: [{ code: reason, text }], caveats: ['ART761_INPUT_REFUSED'], scope_note: SCOPE_NOTE,
    },
    compliance_flags: ['ART761_INPUT_REFUSED'],
  };
}

/** @type {(pp: object) => object | null} */
function validate(pp) {
  if (!isIsoDate(pp.as_of)) {
    return refused('REFUSED_BAD_AS_OF', 'as_of must be a real calendar date as a YYYY-MM-DD string; the node never reads a clock');
  }
  const vintage = Number(pp.as_of.slice(0, 4));
  if (!Object.prototype.hasOwnProperty.call(SS_WAGE_BASE_BY_VINTAGE, vintage)) {
    return refused('REFUSED_UNSUPPORTED_VINTAGE',
      'as_of year ' + vintage + ' has no pinned SSA vintage table in this kernel; supported years are '
      + Object.keys(SS_WAGE_BASE_BY_VINTAGE).join(', ') + '. Refusing beats guessing a wage base.');
  }
  // Every one of these is unconditionally dereferenced by the compute, so a
  // missing or non-numeric entry is a refusal - never a silent default. The Apex
  // source instead writes `+el.value / 100 || 0.5`, which silently rewrites a
  // legitimate 0 into the default (source DIFFERS-D3; proven by fixture v4, where
  // the all-zero Apex control set returns byte-identical output to the defaults).
  const numeric = [
    ['salary_usd', 0, null],
    ['current_age', null, null],
    ['retirement_age', null, null],
    ['care_years', 0, null],
    ['income_reduction_pct', 0, 100],
    ['career_setback_pct', 0, 100],
    ['contribution_401k_pct', 0, 100],
    ['investment_return_pct', -100, 100],
    ['marginal_tax_rate_pct', 0, 100],
  ];
  for (const [key, lo, hi] of numeric) {
    if (!isFiniteNumber(pp[key])) {
      return refused('REFUSED_MISSING_INPUT', key + ' is required and must be a finite number');
    }
    if (lo !== null && pp[key] < lo) {
      return refused('REFUSED_OUT_OF_DOMAIN', key + ' must be at least ' + lo + '; got ' + pp[key]);
    }
    if (hi !== null && pp[key] > hi) {
      return refused('REFUSED_OUT_OF_DOMAIN', key + ' must be at most ' + hi + '; got ' + pp[key]);
    }
  }
  if (pp.ss_average_annual_benefit_usd !== undefined && pp.ss_average_annual_benefit_usd !== null) {
    if (!isFiniteNumber(pp.ss_average_annual_benefit_usd) || pp.ss_average_annual_benefit_usd <= 0) {
      return refused('REFUSED_OUT_OF_DOMAIN', 'ss_average_annual_benefit_usd, when supplied, must be a positive finite number');
    }
  }
  return null;
}

// ------------------------------ ARITHMETIC ------------------------------

/** ordinary-annuity future value, the Apex `fv(pmt, r, n)` verbatim (page line 299) */
function fv(pmt, r, n) {
  if (r === 0) return pmt * n;
  return pmt * (Math.pow(1 + r, n) - 1) / r;
}

/** integer USD cents, half-up, applied once at the payload edge (display-only money) */
function cents(x) {
  return Math.round(x * 100);
}

/**
 * compute(pp) - pure caregiver income-impact estimator over the declared domain.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const bad = validate(pp);
  if (bad) return bad;

  const vintage = Number(pp.as_of.slice(0, 4));
  const wageBase = SS_WAGE_BASE_BY_VINTAGE[vintage];
  const suppliedBenefit = pp.ss_average_annual_benefit_usd;
  const useSuppliedBenefit = suppliedBenefit !== undefined && suppliedBenefit !== null;
  const avgSSBenefit = useSuppliedBenefit ? suppliedBenefit : SS_AVERAGE_ANNUAL_BENEFIT_BY_VINTAGE[vintage];

  const salary = pp.salary_usd;
  const currentAge = pp.current_age;
  const retirementAge = pp.retirement_age;
  const careYears = pp.care_years;
  const incomeReductionPct = pp.income_reduction_pct / 100;
  const setbackPct = pp.career_setback_pct / 100;
  const contrib401k = pp.contribution_401k_pct / 100;
  const returnRate = pp.investment_return_pct / 100;
  // marginal_rate_pct is read, validated and echoed, and enters NO formula -
  // the source reads it into its result object and never uses it (DIFFERS-D4).
  void pp.marginal_tax_rate_pct;

  const yearsToRetirement = retirementAge - currentAge;
  const yearsAfterCare = Math.max(0, yearsToRetirement - careYears);

  // 1. direct income loss during caregiving
  const annualIncomeLoss = salary * incomeReductionPct;
  const directIncomeLoss = annualIncomeLoss * careYears;

  // 2. retirement savings gap: missed 401(k) contributions, then compounded
  const annual401kLost = salary * incomeReductionPct * contrib401k;
  const yearsFromMidCare = Math.max(0, yearsToRetirement - careYears / 2);
  const retirementGap = fv(annual401kLost, returnRate, careYears) * Math.pow(1 + returnRate, yearsAfterCare);

  // 3. career setback: post-care salary permanently lower
  const annualSetbackLoss = salary * setbackPct;
  const setbackCost = fv(annualSetbackLoss, SETBACK_COMPOUNDING_RATE, yearsAfterCare);

  // 4. Social Security reduction: the flagged UNGROUNDED linearisation (U2)
  const ssReducFraction = (salary * incomeReductionPct) / wageBase;
  const ssCareScale = Math.min(careYears / SS_CARE_YEARS_DIVISOR, SS_CARE_YEAR_CAP);
  const annualSSReduction = avgSSBenefit * ssReducFraction * ssCareScale;

  const totalImpact = directIncomeLoss + retirementGap + setbackCost;
  const totalImpactWithSS = totalImpact + annualSSReduction * SS_LIFETIME_YEARS;

  const strategies = STRATEGY_BASE.slice();
  if (setbackPct > SETBACK_STRATEGY_BRANCH_PCT) {
    strategies.push('Invest in a credential or certification during or after caregiving to offset the '
      + Math.round(setbackPct * 100) + '% setback (see the AINumbers workforce ROI node)');
  }

  const flags = [];
  for (const [key, [lo, hi]] of Object.entries(UI_BOUNDS)) {
    if (pp[key] < lo || pp[key] > hi) flags.push('ART761_OUT_OF_UI_RANGE_' + key.toUpperCase());
  }
  if (careYears > 0 && yearsAfterCare === 0) flags.push('ART761_CARE_AT_OR_AFTER_RETIREMENT');
  if (ssCareScale >= SS_CARE_YEAR_CAP) flags.push('ART761_SS_CARE_YEAR_CAP_REACHED');
  if (setbackPct > SETBACK_STRATEGY_BRANCH_PCT) flags.push('ART761_SETBACK_ABOVE_FIVE_PCT');
  flags.push('ART761_SS_ESTIMATE_MODELED');
  if (useSuppliedBenefit) flags.push('ART761_SS_AVERAGE_BENEFIT_USER_SUPPLIED');

  return {
    output_payload: {
      as_of: pp.as_of,
      vintage_year: vintage,
      ss_wage_base_usd: wageBase,
      ss_average_annual_benefit_usd: avgSSBenefit,
      ss_average_benefit_source: useSuppliedBenefit ? 'user_supplied' : 'pinned_official_' + vintage,

      salary_usd: salary,
      current_age: currentAge,
      retirement_age: retirementAge,
      care_years: careYears,
      income_reduction_pct: pp.income_reduction_pct,
      career_setback_pct: pp.career_setback_pct,
      contribution_401k_pct: pp.contribution_401k_pct,
      investment_return_pct: pp.investment_return_pct,
      marginal_tax_rate_pct: pp.marginal_tax_rate_pct,
      marginal_tax_rate_used: false,

      years_to_retirement: yearsToRetirement,
      years_after_care: yearsAfterCare,
      // dead in the source (page line 327 computes it and never reads it again);
      // carried for parity, flagged here so nobody wires it into a formula.
      years_from_midcare: yearsFromMidCare,

      annual_income_loss_cents: cents(annualIncomeLoss),
      direct_income_loss_cents: cents(directIncomeLoss),
      annual_401k_lost_cents: cents(annual401kLost),
      retirement_savings_gap_cents: cents(retirementGap),
      career_setback_cost_cents: cents(setbackCost),
      setback_compounding_rate_bp: Math.round(SETBACK_COMPOUNDING_RATE * 10000),
      ss_reduction_fraction_micro: Math.round(ssReducFraction * 1e6),
      annual_ss_reduction_cents: cents(annualSSReduction),
      ss_lifetime_reduction_cents: cents(annualSSReduction * SS_LIFETIME_YEARS),
      total_impact_cents: cents(totalImpact),
      total_impact_with_ss_cents: cents(totalImpactWithSS),

      strategies,
      refusals: [],
      refusal_reason: null,
      domain_errors: [],
      caveats: flags.slice(),
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: flags.slice(),
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now,
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