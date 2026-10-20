/* art-755 reserved by APEX-PORT (Apex #158 port; no other holder) */
/**
 * Owner Salary Normalization — ported from Apex #158 "Owner Salary Normalization"
 * (ApexLogics tool_id 158-owner-salary-normalization, al_id AL-172).
 *
 * WHAT IT DOES
 *   Separates what a replacement manager would actually cost a buyer from what the
 *   owner actually takes out of the business, then reports the two earnings bases a
 *   small-business sale is priced on:
 *     - Seller Discretionary Earnings (SDE) = net income + owner package + one-times
 *     - Normalized EBITDA                 = the same, less the replacement cost
 *   Plus a neutral, non-accusatory reasonable-compensation PATTERN flag.
 *
 * SOURCE
 *   URL:  https://apexlogics.org/tools/158-owner-salary-normalization/
 *   Fetched 2026-10-06; 45977 bytes; sha256(bodies/sha256 of decoded text):
 *     b816bd3ede4b90c8bce32dafb96f7c9a8149dc78c5f4efafb1fe00cb58d10333
 *   Inline compute: function calculate() in the page's first <script> block.
 *   Registry cross-check: https://apexlogics.org/suite-registry.json entry
 *     tool_id 158-owner-salary-normalization, status "shipped",
 *     shipped_date 2026-07-26, maintenance "annual", file_path
 *     "tools/158-owner-salary-normalization/index.html" — the registry slug matched
 *     the fetched path, so no registry-path fallback was needed.
 *
 * PORT FIDELITY
 *   This is a faithful port of the Apex arithmetic, including its rounding and its
 *   integer-cent-free whole-dollar rounding, because fixtures.json pins live Apex
 *   outputs. Where the AINumbers estate disagrees numerically the divergence is
 *   recorded in DIFFERS.md, not silently patched here. Every such point is marked
 *   DIFFERS-n below.
 *
 * PURE
 *   Pure function of `pp`. No Date, no Math.random, no Intl, no I/O, no globals,
 *   no mutation of `pp`. Missing/blank/non-numeric inputs fall back to the page's
 *   own defaults, matching Apex `numOr`/`dollars`.
 */

/* ── TAX-YEAR CONSTANTS (2026) ─────────────────────────────────────────────── */

/**
 * Social Security OASDI contribution and benefit base, calendar 2026.
 * GROUNDED 2026-10-06, IRS Topic no. 751 (https://www.irs.gov/taxtopics/tc751):
 *   "Only the Social Security tax has a wage base limit. ... For earnings in 2026,
 *    this base limit is $184,500."
 * Corroborated by SSA, Contribution and Benefit Base
 * (https://www.ssa.gov/oact/cola/cbb.html):
 *   "For earnings in 2026, this base is $184,500."
 * Matches AINumbers kernel art-339-compute-gross-to-net.kernel.mjs line 70
 * (PARAMS['2026'].ss_wage_base = 184500). NO VALUE CONFLICT.
 * DIFFERS-1 (method, not value): art-339 threads a caller-supplied
 *   `ytd_fica_wages_before_period` through the cap; Apex treats the single
 *   annual `owner_w2` figure as the whole year's FICA wages. Kept Apex's shape
 *   (annual) because this node is an annual normalization, not a per-pay-period
 *   withholding calculation. Used: Apex.
 */
export const SS_WAGE_BASE_2026 = 184500;

import { executionHash } from './_hash.mjs';

/**
 * Employer Social Security (OASDI) rate, percent of FICA wages.
 * GROUNDED 2026-10-06, 26 U.S.C. 3111(a)
 * (https://www.law.cornell.edu/uscode/text/26/3111):
 *   "In addition to other taxes, there is hereby imposed on every employer an
 *    excise tax, with respect to having individuals in his employ, equal to 6.2
 *    percent of the wages (as defined in section 3121(a)) paid by the employer
 *    with respect to employment (as defined in section 3121(b))."
 * Corroborated by IRS Topic no. 751: "The current tax rate for Social Security
 * is 6.2% for the employer and 6.2% for the employee, or 12.4% total."
 * Matches art-339 kernel SS_EMPLOYEE_RATE = 0.062 (line 78). NO VALUE CONFLICT.
 */
export const SS_EMPLOYER_RATE_PCT = 6.20;

/**
 * Employer Medicare (hospital insurance) rate, percent of FICA wages.
 * GROUNDED 2026-10-06, 26 U.S.C. 3111(b)
 * (https://www.law.cornell.edu/uscode/text/26/3111):
 *   "In addition to the tax imposed by the preceding subsection, there is hereby
 *    imposed on every employer an excise tax, with respect to having individuals
 *    in his employ, equal to 1.45 percent of the wages (as defined in section
 *    3121(a)) paid by the employer with respect to employment (as defined in
 *    section 3121(b))."
 * Corroborated by IRS Topic no. 751: "The current rate for Medicare is 1.45%
 * for the employer and 1.45% for the employee, or 2.9% total."
 * Matches art-339 kernel MEDICARE_RATE = 0.0145 (line 79). NO VALUE CONFLICT.
 */
export const MEDICARE_EMPLOYER_RATE_PCT = 1.45;

/**
 * SCOPE, verified NOT a divergence: the 3101(b)(2) Additional Medicare Tax
 * (0.9% of wages over $200,000, no employer match) is deliberately absent.
 * This node computes the EMPLOYER's share only under IRC 3111, and IRS Topic 751
 * says of the Additional Medicare Tax: "There's no employer match for Additional
 * Medicare tax." art-339 kernel lines 80-81 carry it because that node withholds
 * from the employee as well. Recorded here so a future builder does not "fix" it.
 *   - AINumbers fact: Additional Medicare applies only to the employee share.
 *   - Apex: correct by omission.
 *   - Used: Apex (omitted), and the omission is affirmatively correct.
 */

/* ── ARITHMETIC CONSTANTS ──────────────────────────────────────────────────── */

/** Basis points per whole (Apex `...Bp` / 10000 idiom). */
export const BP_SCALE = 10000;

/** Weeks per year in the effective-hourly denominator (Apex `hoursPerWeek * 52`). */
export const WEEKS_PER_YEAR = 52;

/**
 * Reasonable-compensation PATTERN threshold: owner W-2 below 60% of the single
 * replacement cost. UNGROUNDED — a heuristic, not a statutory or published
 * figure. Apex ships it as a literal (`replacementCostSingle * 0.6`) with no
 * citation, and the page's own disclaimer calls the output "a neutral
 * reasonable-compensation pattern flag ... not an accusation". CITES.md records
 * `UNGROUNDED: reasonable-compensation pattern threshold (owner W-2 < 60% of
 * replacement cost)`. Kept verbatim; the kernel never turns it into advice.
 */
export const REASONABLE_COMP_W2_RATIO = 0.6;

/** Second half of the pattern test: distributions strictly above W-2. Same status. */
export const REASONABLE_COMP_DISTRIBUTIONS_OVER_W2 = true;

/* ── PAGE DEFAULTS (Apex `value=` attributes on the live page, 2026-10-06) ──── */

export const DEFAULT_NET_INCOME = 180000;
export const DEFAULT_ONE_TIME_EXPENSES = 15000;
export const DEFAULT_OWNER_COUNT = 1;
export const DEFAULT_OWNER_W2 = 95000;
export const DEFAULT_DISTRIBUTIONS = 60000;
export const DEFAULT_EMPLOYER_PAYROLL_TAXES_ENTERED = 0;
export const DEFAULT_OWNER_HEALTH = 14400;
export const DEFAULT_OWNER_RETIREMENT = 12000;
export const DEFAULT_PERSONAL_VEHICLE = 9600;
export const DEFAULT_OTHER_PERSONAL = 6000;
export const DEFAULT_MARKET_WAGE = 85000;
export const DEFAULT_BENEFIT_LOAD_PCT = 22;
export const DEFAULT_HOURS_PER_WEEK = 55;
export const DEFAULT_SS_RATE_PCT = SS_EMPLOYER_RATE_PCT;
export const DEFAULT_MEDICARE_RATE_PCT = MEDICARE_EMPLOYER_RATE_PCT;
export const DEFAULT_SDE_MULTIPLE = 2.80;

/* ── COERCION HELPERS (verbatim Apex semantics) ────────────────────────────── */

/** Apex `numOr`: parseFloat, non-finite -> def. Accepts "" -> def. */
function numOr(raw, def) {
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  return Number.isFinite(n) ? n : def;
}

/** Apex `dollars`: numOr then Math.round to a whole dollar. */
function dollars(raw, def) {
  return Math.round(numOr(raw, def));
}

/* ── KERNEL ────────────────────────────────────────────────────────────────── */

/**
 * @typedef {Object} OwnerSalaryNormalizationInputs
 * @property {number}  reported_net_income                   Pre-tax net income from the P&L, before add-backs (USD). May be negative.
 * @property {number}  one_time_expenses                     One-time / non-recurring expenses a buyer would not repeat (USD).
 * @property {number}  owner_count                           Owners taking compensation; whole number, floored at 1.
 * @property {number}  owner_w2_salary                       Owner W-2 wages run through payroll (USD).
 * @property {number}  owner_distributions                   Owner distributions or draws, non-payroll (USD).
 * @property {number}  employer_payroll_taxes_entered        Employer payroll taxes on owner wages; 0 means "compute it".
 * @property {number}  owner_health_insurance                Company-paid owner health premiums (USD).
 * @property {number}  owner_retirement_contribution         Company-paid owner retirement, employer side only (USD).
 * @property {number}  personal_vehicle_and_travel           Non-business vehicle and travel run through the company (USD).
 * @property {number}  other_personal_expenses               Other personal / discretionary company spend (USD).
 * @property {number}  market_wage_replacement_manager        What a replacement manager would cost, base wage (USD).
 * @property {number}  benefit_load_pct                      Benefits load on the replacement wage (percent).
 * @property {number}  hours_per_week                        Hours the owner works per week.
 * @property {number}  ss_wage_base                          Social Security contribution and benefit base (USD).
 * @property {number}  ss_rate_pct                           Employer Social Security rate (percent).
 * @property {number}  medicare_rate_pct                     Employer Medicare rate (percent).
 * @property {number}  sde_multiple                          SDE multiple, valuation-impact line only (x).
 */

/**
 * @typedef {Object} OwnerSalaryNormalizationOutputs
 * @property {number}  employer_payroll_taxes                 Employer payroll taxes used (computed or entered).
 * @property {number}  ss_taxable_wages                      min(owner_w2_salary, ss_wage_base) — the OASDI-capped base.
 * @property {number}  employer_ss_tax                        Employer OASDI on ss_taxable_wages.
 * @property {number}  employer_medicare_tax                 Employer Medicare on the full uncapped owner W-2.
 * @property {boolean} employer_payroll_taxes_entered        True when the caller overrode the computed figure.
 * @property {number}  total_owner_package                   W-2 + distributions + payroll taxes + health + retirement + vehicle + personal.
 * @property {number}  replacement_cost_single               Fully loaded cost of ONE replacement manager.
 * @property {number}  replacement_cost_aggregate            replacement_cost_single * owner_count.
 * @property {number}  normalization_adjustment              total_owner_package - replacement_cost_aggregate.
 * @property {number}  seller_discretionary_earnings         net income + owner package + one-times.
 * @property {number}  normalized_ebitda                     seller_discretionary_earnings - replacement_cost_aggregate.
 * @property {number}  owner_effective_hourly_rate           package / (hours_per_week * 52); 0 when hours are 0.
 * @property {boolean} owner_hourly_suppressed               True when hours_per_week === 0.
 * @property {number}  owner_package_pct_of_replacement_bp   package as percent of replacement cost, in basis points.
 * @property {boolean} owner_package_pct_suppressed          True when replacement cost is 0 (absentee owner).
 * @property {boolean} reasonable_comp_pattern_flag          Neutral pattern observation, never an accusation.
 * @property {number}  valuation_impact_at_multiple          normalization_adjustment * sde_multiple.
 * @property {number}  per_owner_average_package             total_owner_package / owner_count.
 * @property {boolean} multi_owner                           owner_count > 1.
 */

/**
 * Owner Salary Normalization kernel.
 *
 * Every input is optional; a missing or non-numeric value falls back to the
 * live page default, exactly as the Apex page did. The returned
 * `{ output_payload, compliance_flags }` envelope matches the AINumbers
 * OpenChainGraph kernel shape (cf. art-339, art-704).
 *
 * @param {OwnerSalaryNormalizationInputs} pp
 * @returns {{ output_payload: OwnerSalaryNormalizationOutputs & { error: string|null, regulatory_basis: string, scope_note: string }, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};

  /* ── inputs, with Apex's own coercion order ─────────────────────────────── */

  // DIFFERS-2 (method, not value): Apex `dollars()` rounds every currency input
  // to a whole dollar on read, and the payroll-tax component is likewise
  // rounded with Math.round. The art-339 kernel keeps 2 decimals via r2().
  // Kept Apex's whole-dollar rounding so the fixtures reproduce live Apex
  // outputs to the dollar. Used: Apex. Consequence: cent-level inputs collapse.
  const reportedNetIncome = dollars(pp.reported_net_income, DEFAULT_NET_INCOME);
  const oneTimeExpenses = dollars(pp.one_time_expenses, DEFAULT_ONE_TIME_EXPENSES);

  // COMPARATOR C1 — owner_count is rounded, then floored at 1 (Apex
  // `Math.max(1, Math.round(numOr(...)))`). So 0 -> 1, 0.4 -> 1, 1.5 -> 2.
  const ownerCount = Math.max(1, Math.round(numOr(pp.owner_count, DEFAULT_OWNER_COUNT)));

  const ownerW2 = dollars(pp.owner_w2_salary, DEFAULT_OWNER_W2);
  const ownerDistributions = dollars(pp.owner_distributions, DEFAULT_DISTRIBUTIONS);
  const employerPayrollTaxesEntered = dollars(pp.employer_payroll_taxes_entered, DEFAULT_EMPLOYER_PAYROLL_TAXES_ENTERED);
  const ownerHealth = dollars(pp.owner_health_insurance, DEFAULT_OWNER_HEALTH);
  const ownerRetirement = dollars(pp.owner_retirement_contribution, DEFAULT_OWNER_RETIREMENT);
  const personalVehicle = dollars(pp.personal_vehicle_and_travel, DEFAULT_PERSONAL_VEHICLE);
  const otherPersonal = dollars(pp.other_personal_expenses, DEFAULT_OTHER_PERSONAL);
  const marketWage = dollars(pp.market_wage_replacement_manager, DEFAULT_MARKET_WAGE);

  // COMPARATORS C2a-C2d — four separate `Math.max(0, ...)` clamps. None of these
  // can go negative even if a caller passes one.
  const benefitLoadPct = Math.max(0, numOr(pp.benefit_load_pct, DEFAULT_BENEFIT_LOAD_PCT));
  const hoursPerWeek = Math.max(0, numOr(pp.hours_per_week, DEFAULT_HOURS_PER_WEEK));
  const ssRatePct = Math.max(0, numOr(pp.ss_rate_pct, DEFAULT_SS_RATE_PCT));
  const medicareRatePct = Math.max(0, numOr(pp.medicare_rate_pct, DEFAULT_MEDICARE_RATE_PCT));
  const sdeMultiple = Math.max(0, numOr(pp.sde_multiple, DEFAULT_SDE_MULTIPLE));

  const ssWageBase = dollars(pp.ss_wage_base, SS_WAGE_BASE_2026);

  // Apex converts each percent to integer basis points once, then divides by
  // BP_SCALE. Rounding the bp value means a 6.204% rate becomes 620 bp = 6.20%.
  const benefitLoadBp = Math.round(benefitLoadPct * 100);
  const ssRateBp = Math.round(ssRatePct * 100);
  const medicareRateBp = Math.round(medicareRatePct * 100);

  /* ── step 1: employer payroll taxes, computed only when left at 0 ───────── */

  // COMPARATOR C3 — `employer_payroll_taxes_entered === 0` selects the compute
  // branch. Strict equality: a negative entered value is USED VERBATIM (there is
  // no Math.max(0) clamp on this input), and so is any non-zero positive.
  // A caller who wants the computed figure must not enter one.
  let employerPayrollTaxes;
  let employerSsTax = null;
  let employerMedicareTax = null;
  let ssTaxableWages = null;
  const employerPayrollTaxesWasEntered = employerPayrollTaxesEntered !== 0;

  if (employerPayrollTaxesEntered === 0) {
    // COMPARATOR C4 — the OASDI wage-base cap: min(owner W-2, ss_wage_base).
    // Medicare has no cap and applies to the full owner W-2.
    ssTaxableWages = Math.min(ownerW2, ssWageBase);
    employerSsTax = Math.round(ssTaxableWages * ssRateBp / BP_SCALE);
    employerMedicareTax = Math.round(ownerW2 * medicareRateBp / BP_SCALE);
    employerPayrollTaxes = employerSsTax + employerMedicareTax;
  } else {
    employerPayrollTaxes = employerPayrollTaxesEntered;
  }

  /* ── step 2: total owner package ────────────────────────────────────────── */

  const totalOwnerPackage =
    ownerW2 +
    ownerDistributions +
    employerPayrollTaxes +
    ownerHealth +
    ownerRetirement +
    personalVehicle +
    otherPersonal;

  /* ── step 3: replacement cost ───────────────────────────────────────────── */

  const replacementCostSingle = Math.round(marketWage * (BP_SCALE + benefitLoadBp) / BP_SCALE);
  const replacementCostAggregate = replacementCostSingle * ownerCount;

  /* ── step 4: normalization adjustment ───────────────────────────────────── */

  const normalizationAdjustment = totalOwnerPackage - replacementCostAggregate;

  /* ── steps 5-6: the two earnings bases ──────────────────────────────────── */

  const sellerDiscretionaryEarnings = reportedNetIncome + totalOwnerPackage + oneTimeExpenses;
  const normalizedEbitda = sellerDiscretionaryEarnings - replacementCostAggregate;

  /* ── step 7: effective hourly rate, suppressed on zero hours ────────────── */

  // COMPARATORS C5 (`hours_per_week > 0`) and C6 (`Math.max(1, hours*52)`).
  // Between 0 and 1/52 the product rounds to 0, so the Math.max guard keeps the
  // divisor at 1 rather than dividing by zero.
  const ownerHourlySuppressed = hoursPerWeek === 0;
  const ownerEffectiveHourlyRate = hoursPerWeek > 0
    ? Math.round(totalOwnerPackage / Math.max(1, hoursPerWeek * WEEKS_PER_YEAR))
    : 0;

  /* ── step 8: package as a percent of replacement cost ───────────────────── */

  // COMPARATORS C7 (`replacement_cost === 0`) and C8 (`Math.max(1, ...)`).
  // Zero replacement cost means either an absentee owner or a zero market wage;
  // the ratio is suppressed rather than reported as a division by zero.
  const ownerPackagePctSuppressed = replacementCostAggregate === 0;
  const ownerPackagePctOfReplacementBp = ownerPackagePctSuppressed
    ? 0
    : Math.round(totalOwnerPackage / Math.max(1, replacementCostAggregate) * BP_SCALE);

  /* ── step 9: neutral reasonable-compensation pattern ────────────────────── */

  // COMPARATORS C9 (`owner_w2 < replacement_cost_single * 0.6`) and C10
  // (`distributions > owner_w2`). Both must hold. Ungrounded heuristic — see
  // REASONABLE_COMP_W2_RATIO and CITES.md UNGROUNDED.
  const lowW2VsReplacement =
    ownerW2 < replacementCostSingle * REASONABLE_COMP_W2_RATIO;
  const distributionsAboveW2 = REASONABLE_COMP_DISTRIBUTIONS_OVER_W2
    ? ownerDistributions > ownerW2
    : false;
  const reasonableCompPatternFlag = lowW2VsReplacement && distributionsAboveW2;

  /* ── step 10: valuation impact at the chosen multiple ───────────────────── */

  const valuationImpactAtMultiple = Math.round(normalizationAdjustment * sdeMultiple);

  /* ── step 11: per-owner average ─────────────────────────────────────────── */

  const perOwnerAveragePackage = Math.round(totalOwnerPackage / ownerCount);
  const multiOwner = ownerCount > 1;

  /* ── compliance flags ───────────────────────────────────────────────────── */

  const complianceFlags = ['FEDERAL_ONLY_NOT_TAX_ADVICE', 'ILLUSTRATIVE_ESTIMATE_NOT_ADVICE'];
  if (employerPayrollTaxesWasEntered) complianceFlags.push('EMPLOYER_PAYROLL_TAXES_USER_ENTERED');
  if (ownerHourlySuppressed) complianceFlags.push('OWNER_HOURLY_SUPPRESSED_ZERO_HOURS');
  if (ownerPackagePctSuppressed) complianceFlags.push('OWNER_PACKAGE_PCT_SUPPRESSED_ZERO_REPLACEMENT');
  if (reasonableCompPatternFlag) complianceFlags.push('REASONABLE_COMP_PATTERN_OBSERVED');
  if (multiOwner) complianceFlags.push('MULTI_OWNER_AGGREGATE_REPLACEMENT_COST');

  // AUTHORING-STANDARD section 2.2 flag mirror: every conditional compliance flag is
  // mirrored into output_payload.warnings as a reader-facing sentence, so a
  // consumer that never reads compliance_flags still sees the condition.
  const warnings = [];
  if (employerPayrollTaxesWasEntered) warnings.push('Employer payroll taxes were entered by the caller and are used verbatim (no wage-base cap was applied).');
  if (ownerHourlySuppressed) warnings.push('Owner effective hourly rate is suppressed because hours per week is 0.');
  if (ownerPackagePctSuppressed) warnings.push('Owner package as a percent of replacement cost is suppressed because the aggregate replacement cost is 0.');
  if (reasonableCompPatternFlag) warnings.push('Reasonable-compensation pattern observed: owner W-2 is below 60% of the replacement cost and distributions exceed W-2 (an ungrounded heuristic, not a statutory test).');
  if (multiOwner) warnings.push('More than one owner: replacement cost is aggregated across ' + ownerCount + ' owners.');

  return {
    output_payload: {
      employer_payroll_taxes: employerPayrollTaxes,
      employer_payroll_taxes_entered: employerPayrollTaxesWasEntered,
      ss_taxable_wages: ssTaxableWages,
      employer_ss_tax: employerSsTax,
      employer_medicare_tax: employerMedicareTax,
      total_owner_package: totalOwnerPackage,
      replacement_cost_single: replacementCostSingle,
      replacement_cost_aggregate: replacementCostAggregate,
      normalization_adjustment: normalizationAdjustment,
      seller_discretionary_earnings: sellerDiscretionaryEarnings,
      normalized_ebitda: normalizedEbitda,
      owner_effective_hourly_rate: ownerEffectiveHourlyRate,
      owner_hourly_suppressed: ownerHourlySuppressed,
      owner_package_pct_of_replacement_bp: ownerPackagePctOfReplacementBp,
      owner_package_pct_suppressed: ownerPackagePctSuppressed,
      reasonable_comp_pattern_flag: reasonableCompPatternFlag,
      valuation_impact_at_multiple: valuationImpactAtMultiple,
      per_owner_average_package: perOwnerAveragePackage,
      multi_owner: multiOwner,
      warnings,
      error: null,
      regulatory_basis: REGULATORY_BASIS,
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: complianceFlags,
  };
}

/* ── OPENCHAINGraph ENVELOPE (meta + buildArtifact, art-763 shape) ─────────── */

export const TOOL_ID = 'art-755-owner-salary-normalization';
export const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'normalize_owner_salary',
  mandate_type: 'analytics_mandate', gpu: false,
};

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

/* ── DECLARED BASIS AND SCOPE ─────────────────────────────────────────────── */

/**
 * Every regulatory premise, with the URL and the fetch date it was grounded on
 * during this run (2026-10-06). Full quotes in CITES.md.
 */
export const REGULATORY_BASIS =
  'SSA / IRS 2026 OASDI contribution and benefit base $184,500 '
  + '(https://www.irs.gov/taxtopics/tc751, https://www.ssa.gov/oact/cola/cbb.html); '
  + 'IRC 3111(a) employer Social Security rate 6.2% (https://www.law.cornell.edu/uscode/text/26/3111); '
  + 'IRC 3111(b) employer Medicare rate 1.45% (https://www.law.cornell.edu/uscode/text/26/3111). '
  + 'The market wage, the benefits load, the SDE multiple and the reasonable-compensation '
  + 'pattern threshold are user-supplied or ungrounded conventions, NOT statutory figures.';

/**
 * What this node deliberately does not do. Kept close to the Apex page's own
 * disclaimer so a reader cannot mistake an output for a tax position.
 */
export const SCOPE_NOTE =
  'This is an illustrative estimate, not tax advice. Reasonable compensation for an S '
  + "corporation owner depends on the full facts and on current IRS guidance, which can "
  + 'change; consult a CPA or tax attorney. Employer payroll taxes are the employer share '
  + 'only (IRC 3111); the section 3101(b)(2) Additional Medicare Tax is an employee '
  + 'withholding with no employer match and is out of scope. Federal only: no state '
  + 'wage-base, unemployment-insurance, workers-comp or payroll-tax caps are modelled. '
  + 'One year only: the OASDI wage-base cap is applied as min(annual owner W-2, base), '
  + 'which assumes the whole year is already earned. A "replacement manager" is a single '
  + 'full-time manager; no partial, interim, or shared-role cost is modelled. '
  + 'The reasonable-compensation output is a neutral pattern observation, not a finding '
  + 'of unreasonable compensation, and not an accusation.';
