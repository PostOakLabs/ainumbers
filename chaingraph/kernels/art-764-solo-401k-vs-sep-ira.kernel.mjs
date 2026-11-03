// art-764-solo-401k-vs-sep-ira — DRAFT (APEXPORT-112). Read-only port payload for
// a trusted builder; not registered. Ported from ApexLogics display_number #112,
// tool_id 112-solo-401k-vs-sep-ira, al_id AL-119.
//
// WHAT THIS NODE COMPARES: for a self-employed filer it prices three retirement
// vehicle contribution ceilings under one set of IRS limits — the Solo 401(k)
// (employee deferral + catch-up + employer profit sharing), the SEP-IRA (25% of
// net earnings capped annually), and the SIMPLE IRA (employee salary reduction +
// a 2% nonelective employer contribution) — ranks them by maximum contribution,
// and reports the estimated tax saving at a caller-supplied marginal rate.
//
// AS-OF IS AN INPUT, NEVER A CLOCK: the Apex page hardcoded the 2026 limits in
// page source (LIMITS, apex112.html lines 241-244). Here `tax_year` is a required
// integer input selecting the LIMITS_BY_TAX_YEAR table; only 2026 is populated.
// A tax year with no published limit table is a NO_LIMITS_FOR_TAX_YEAR refusal,
// never a silent fallback to 2026. This is the APEXPORT-110B explicit-as-of
// pattern; it is what makes the computation deterministic and zkVM-promotable.
//
// MONEY IS INTEGER CENTS, FLOOR-DIVIDED: every dollar amount is an integer count
// of cents and every rate application is floor(a * bp / 10000). No floats, no
// Date, no randomness, no text encoding — a pure function of the declared input
// domain. The Apex page used IEEE-754 doubles and Math.round for display, so its
// intermediate amounts carry sub-cent fractions this node cannot represent
// (see DIFFERS.md row D3). Fixtures carry BOTH the live Apex float output and
// this node's integer output for every vector; the sub-cent delta is named.
//
// LIMITS ARE NAMED LITERALS WITH PROVENANCE COMMENTS, NOT TAX-YEAR-INDEPENDENT
// TRUTHS: each constant below is quoted from IRS sources fetched and hashed on
// 2026-10-13 (see CITES.md). Where the Apex constant disagreed with the official
// figure the official figure won — that is DIFFERS.md row D1 (SIMPLE IRA
// catch-up for age 50+). Nothing was picked silently.
//
// CAP ATTRIBUTION: every plan reports `binding_cap`, naming the comparator that
// actually bound the answer. A port that silently changed which limit binds is
// the failure mode this makes visible.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-764-solo-401k-vs-sep-ira';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compare_solo401k_sep_simple',
  mandate_type: 'compensation_assessment', gpu: false,
};

/** Published IRS dollar limitations by tax year, in integer cents. 2026 only. */
const LIMITS_BY_TAX_YEAR = {
  2026: {
    // 402(g)(1) elective-deferral limitation for 401(k)/403(b)/457/TSP, 2026.
    // "The limitation under section 402(g)(1) ... is increased from $23,500 to $24,500."
    solo_401k_employee_deferral_cents: 2_450_000,
    // 414(v)(2)(B)(i) catch-up for age 50 or over, 2026.
    // "The limitation under section 414(v)(2)(B)(i) ... is increased from $7,500 to $8,000."
    solo_401k_catchup_5059_64plus_cents: 800_000,
    // 414(v)(2)(E)(i) SECURE 2.0 super catch-up for age 60-63, 2026.
    // "The limitation under section 414(v)(2)(E)(i) ... remains $11,250."
    solo_401k_catchup_6063_cents: 1_125_000,
    // 415(c)(1)(A) annual-additions limit for defined contribution plans, 2026.
    // "The limitation for defined contribution plans under section 415(c)(1)(A) is
    //  increased in 2026 from $70,000 to $72,000."
    section415c_cents: 7_200_000,
    // SEP / profit-sharing employer deduction ceiling, 2026.
    // "an employer's deduction for contributions to a defined contribution plan
    //  ... cannot be more than 25% of the compensation paid (or accrued)".
    sep_pct_bp: 2_500,
    sep_annual_cap_cents: 7_200_000,
    // 408(p)(2)(E)(i)(III) SIMPLE IRA salary-reduction limitation, 2026.
    // "The limitation under section 408(p)(2)(E)(i)(III) ... is increased from
    //  $16,500 to $17,000."
    simple_ira_base_cents: 1_700_000,
    // 414(v)(2)(B)(ii) SIMPLE catch-up for age 50 or over, 2026.
    // "The limitation under section 414(v)(2)(B)(ii) ... is increased from $3,500 to $4,000."
    // APEX DISAGREED: apex112.html line 244 hardcoded 5000 ($5,000). Official wins (DIFFERS D1).
    simple_ira_catchup_5059_64plus_cents: 400_000,
    // 414(v)(2)(E)(ii) SIMPLE super catch-up for age 60-63, 2026.
    // "The limitation under section 414(v)(2)(E)(ii) ... remains $5,250."
    simple_ira_catchup_6063_cents: 525_000,
  },
};

/** Supported tax years. A year absent here is a refusal, never a silent fallback. */
const SUPPORTED_TAX_YEARS = [2026];

/**
 * Non-tax-year-indexed rates. Basis points of one (10000 = 100%).
 * These are definitional/statutory mechanics, not annual COLA amounts, which is
 * why they sit outside LIMITS_BY_TAX_YEAR — but each still carries its citation.
 */
const SE_BASE_BP = 9_235;            // 92.35% of net profit is the SE-tax base. Topic 554: "Generally, the amount subject to self-employment tax is 92.35% of your net earnings from self-employment."
const SE_TAX_BP = 1_530;             // 15.3% combined SE rate below the Social Security wage base (12.4% + 2.9%). Pub 505 (2026) Worksheet 2-3: line 9 "Multiply line 8 by 12.4% (0.124)"; line 4 "Multiply line 3 by 2.9% (0.029)".
const SE_HALF_DEDUCTION_BP = 5_000;  // 50% of SE tax is deductible. Pub 505 (2026) Worksheet 2-3 line 11: "Multiply line 10 by 50% (0.50). This is your expected deduction for self-employment tax".
const EMPLOYER_PROFIT_SHARE_BP = 2_500; // 25% of compensation: the solo 401(k) employer contribution rate. Same 25% ceiling the SEP row uses.
const SIMPLE_NONELECTIVE_BP = 200;   // 2% SIMPLE employer nonelective contribution. IRS: "an employer can choose to make nonelective contributions of 2% of each eligible employee's compensation".

// Input domain bounds. Bounds keep every intermediate integer product below 2^53
// under floor division: NI_CENTS_CAP * 9235 < 2^48.
const NI_CENTS_CAP = 20_000_000_000; // $200,000,000 of net self-employment profit.
const AGE_MIN = 18;
const AGE_MAX = 120;
const MARGINAL_RATE_BP_CAP = 10_000; // 100.00%
const EXISTING_DEFERRALS_CENTS_CAP = 72_000_000; // $720,000: a generous bound over the 402(g) limit plus catch-up.

const PLAN_ORDER = ['solo_401k', 'sep_ira', 'simple_ira'];
const SCOPE_NOTE =
  'Estimates maximum CONTRIBUTION ceilings, not after-tax wealth. The marginal rate is a caller ' +
  'input, so tax_savings are a rate-times-contribution identity, not a projection. Not modelled: ' +
  'the Social Security wage base (Pub 505 2026 Worksheet 2-3 caps the 12.4% portion at ' +
  '$184,500, so the true SE rate falls below 15.3% above that base); the employer 25% ceiling ' +
  'measured on compensation net of the employee deferral; SIMPLE $18,100 small-employer limits ' +
  'and the 402(g) aggregation across an outside employer plan; the $400 net-earnings SE-tax ' +
  'floor; Roth catch-up wage thresholds; and plan administration, actuarial or audit cost. ' +
  'Amounts are integer cents with floor division; the Apex source page used IEEE-754 doubles ' +
  'and rounded for display, so sub-cent intermediates differ by construction.';

// ---------- refusal plumbing ----------

/** @type {(reason: string, text: string) => { output_payload: object, compliance_flags: string[] }} */
function refused(reason, text) {
  return {
    output_payload: {
      tax_year: null,
      net_income_usd_cents: null,
      self_employment_tax_usd_cents: null,
      half_se_tax_deduction_usd_cents: null,
      net_earnings_after_half_deduction_usd_cents: null,
      age: null,
      marginal_rate_bp: null,
      catchup_eligible: null,
      solo_401k: null,
      sep_ira: null,
      simple_ira: null,
      ranking: [],
      winner: null,
      refusal_reason: reason,
      domain_errors: [{ code: reason, text }],
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: reason ? ['ART764_INPUT_REFUSED'] : [],
  };
}

// ---------- integer arithmetic (no floats anywhere) ----------

/** @type {(a: number, bp: number) => number} floor(a * bp / 10000), the only rate application */
function applyBp(a, bp) {
  return Math.floor((a * bp) / 10_000);
}

/** @type {(v: unknown, lo: number, hi: number) => boolean} integer in [lo, hi] */
function isIntIn(v, lo, hi) {
  return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
}

// ---------- validation ----------

/** @type {(pp: object) => { output_payload: object, compliance_flags: string[] } | null} */
function validate(pp) {
  if (!pp || typeof pp !== 'object' || Array.isArray(pp)) {
    return refused('REFUSED_BAD_INPUT', 'policy_parameters must be an object carrying tax_year, net_income_usd_cents, age, marginal_rate_bp, existing_employer_plan and existing_deferrals_cents');
  }
  if (!isIntIn(pp.tax_year, 1000, 9999)) {
    return refused('REFUSED_BAD_TAX_YEAR', 'tax_year must be a four-digit integer; the node reads no clock, so the tax year is an input, never "this year"');
  }
  if (!SUPPORTED_TAX_YEARS.includes(pp.tax_year)) {
    return refused('NO_LIMITS_FOR_TAX_YEAR', 'no IRS limit table is pinned for tax year ' + pp.tax_year + '; this node ships ' + SUPPORTED_TAX_YEARS.join(', ') + ' only. Extend LIMITS_BY_TAX_YEAR with a cited table rather than reusing another year\'s limits');
  }
  if (!isIntIn(pp.net_income_usd_cents, 1, NI_CENTS_CAP)) {
    return refused('REFUSED_BAD_NET_INCOME', 'net_income_usd_cents must be an integer from 1 to ' + NI_CENTS_CAP + ' ($0 is refused: a contributor with no net profit has no contribution ceiling to maximise, and the Apex source page silently substituted its 120000-dollar default on a zero input — see DIFFERS.md row D2)');
  }
  if (!isIntIn(pp.age, AGE_MIN, AGE_MAX)) {
    return refused('REFUSED_BAD_AGE', 'age must be an integer from ' + AGE_MIN + ' to ' + AGE_MAX + ' (age is age AT END OF TAX YEAR, the test 414(v) and 414(v)(2)(E) use)');
  }
  if (!isIntIn(pp.marginal_rate_bp, 0, MARGINAL_RATE_BP_CAP)) {
    return refused('REFUSED_BAD_MARGINAL_RATE', 'marginal_rate_bp must be an integer from 0 to ' + MARGINAL_RATE_BP_CAP + ' (basis points of one; 2400 = 24%)');
  }
  if (typeof pp.existing_employer_plan !== 'boolean') {
    return refused('REFUSED_BAD_EXISTING_PLAN', 'existing_employer_plan must be a boolean; it is echoed and flagged, never used in the arithmetic (see SCOPE_NOTE and DIFFERS.md row D4)');
  }
  if (!isIntIn(pp.existing_deferrals_cents, 0, EXISTING_DEFERRALS_CENTS_CAP)) {
    return refused('REFUSED_BAD_EXISTING_DEFERRALS', 'existing_deferrals_cents must be an integer from 0 to ' + EXISTING_DEFERRALS_CENTS_CAP + ' (elective deferrals already made to an outside employer plan in the tax year)');
  }
  return null;
}

// ---------- the ported compute ----------

/**
 * compute(pp) — pure retirement-contribution comparator over the declared input domain.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  const bad = validate(pp);
  if (bad) return bad;

  const L = LIMITS_BY_TAX_YEAR[pp.tax_year];
  const flags = [];

  // --- Net earnings from self-employment, the base every 25% ceiling runs on.
  // Mirrors Apex apex112.html lines 259-260 (seTax = netIncome * 0.9235 * 0.153;
  // netComp = netIncome - seTax * 0.5), with each step floor-divided in cents.
  const seBase = applyBp(pp.net_income_usd_cents, SE_BASE_BP);
  const seTax = applyBp(seBase, SE_TAX_BP);
  const halfDeduction = applyBp(seTax, SE_HALF_DEDUCTION_BP);
  const netEarnings = pp.net_income_usd_cents - halfDeduction;

  // --- Age-banded catch-up. Apex lines 263-266: age 60-63 wins over age 50+,
  // and the 50+ band covers 50-59 and 64+. Same band shape, official amounts.
  const superBand = pp.age >= 60 && pp.age <= 63;
  const catchupEligible = pp.age >= 50;
  const soloCatchup = superBand ? L.solo_401k_catchup_6063_cents
    : catchupEligible ? L.solo_401k_catchup_5059_64plus_cents : 0;
  const simpleCatchup = superBand ? L.simple_ira_catchup_6063_cents
    : catchupEligible ? L.simple_ira_catchup_5059_64plus_cents : 0;

  // --- Solo 401(k). Apex lines 269-274.
  const deferralLimit = L.solo_401k_employee_deferral_cents + soloCatchup;
  const deferralRoom = Math.max(0, deferralLimit - pp.existing_deferrals_cents);
  const employeeDeferral = Math.min(netEarnings, deferralRoom);
  const employerRateAmount = applyBp(netEarnings, EMPLOYER_PROFIT_SHARE_BP);
  const employerRaw = Math.min(employerRateAmount, L.section415c_cents - employeeDeferral);
  const employerContribution = Math.max(0, employerRaw);
  const soloTotalRaw = employeeDeferral + employerContribution;
  const soloTotal = Math.min(soloTotalRaw, L.section415c_cents + soloCatchup);

  const soloBindingDeferral = netEarnings < deferralRoom ? 'net_earnings' : 'deferral_limit_less_existing_deferrals';
  const soloBindingEmployer = employerRateAmount <= L.section415c_cents - employeeDeferral
    ? 'employer_25pct_of_net_earnings'
    : (employerRaw < 0 ? 'no_415c_headroom_after_deferral' : 'section415c_less_employee_deferral');
  const soloBindingTotal = soloTotal < soloTotalRaw ? 'section415c_plus_catchup' : 'not_capped';

  // --- SEP-IRA. Apex line 277: min(netComp * 0.25, 72000).
  const sepRateAmount = applyBp(netEarnings, L.sep_pct_bp);
  const sepContribution = Math.min(sepRateAmount, L.sep_annual_cap_cents);
  const sepBinding = sepRateAmount <= L.sep_annual_cap_cents ? 'sep_25pct_of_net_earnings' : 'sep_annual_cap_72000';

  // --- SIMPLE IRA. Apex lines 282-285: employee = min(base + catchup, netIncome),
  // employer = 2% nonelective of net income; Apex taxes only the employee portion.
  const simpleEmployee = Math.min(L.simple_ira_base_cents + simpleCatchup, pp.net_income_usd_cents);
  const simpleEmployer = applyBp(pp.net_income_usd_cents, SIMPLE_NONELECTIVE_BP);
  const simpleTotal = simpleEmployee + simpleEmployer;
  const simpleBinding = (L.simple_ira_base_cents + simpleCatchup) <= pp.net_income_usd_cents
    ? 'simple_base_plus_catchup' : 'net_income';

  const soloTaxSavings = applyBp(soloTotal, pp.marginal_rate_bp);
  const sepTaxSavings = applyBp(sepContribution, pp.marginal_rate_bp);
  const simpleTaxSavings = applyBp(simpleEmployee, pp.marginal_rate_bp);

  // --- Winner. Apex lines 288-292 sort descending on total and take [0]; V8's
  // sort is stable, so an exact tie resolves to the first plan in the declared
  // order [solo_401k, sep_ira, simple_ira]. That tie order is a declared
  // constant here, not an engine accident.
  const plans = [
    { plan: 'solo_401k', max_total_usd_cents: soloTotal, tax_savings_usd_cents: soloTaxSavings },
    { plan: 'sep_ira', max_total_usd_cents: sepContribution, tax_savings_usd_cents: sepTaxSavings },
    { plan: 'simple_ira', max_total_usd_cents: simpleTotal, tax_savings_usd_cents: simpleTaxSavings },
  ];
  let winnerIdx = 0;
  for (let i = 1; i < plans.length; i++) {
    if (plans[i].max_total_usd_cents > plans[winnerIdx].max_total_usd_cents) winnerIdx = i;
  }
  const tied = plans.filter((p) => p.max_total_usd_cents === plans[winnerIdx].max_total_usd_cents)
    .map((p) => p.plan);

  if (superBand) flags.push('ART764_SUPER_CATCHUP_BAND');
  if (pp.existing_employer_plan) flags.push('ART764_EXISTING_PLAN_NOT_MODELED');

  return {
    output_payload: {
      tax_year: pp.tax_year,
      net_income_usd_cents: pp.net_income_usd_cents,
      self_employment_tax_base_usd_cents: seBase,
      self_employment_tax_usd_cents: seTax,
      half_se_tax_deduction_usd_cents: halfDeduction,
      net_earnings_after_half_deduction_usd_cents: netEarnings,
      age: pp.age,
      marginal_rate_bp: pp.marginal_rate_bp,
      catchup_eligible: catchupEligible,
      super_catchup_band: superBand,
      existing_employer_plan: pp.existing_employer_plan,
      existing_deferrals_cents: pp.existing_deferrals_cents,
      solo_401k: {
        employee_deferral_usd_cents: employeeDeferral,
        catchup_usd_cents: soloCatchup,
        employer_contribution_usd_cents: employerContribution,
        max_total_usd_cents: soloTotal,
        tax_savings_usd_cents: soloTaxSavings,
        binding_caps: {
          employee_deferral: soloBindingDeferral,
          employer_contribution: soloBindingEmployer,
          total: soloBindingTotal,
        },
      },
      sep_ira: {
        max_total_usd_cents: sepContribution,
        tax_savings_usd_cents: sepTaxSavings,
        binding_caps: { contribution: sepBinding },
      },
      simple_ira: {
        employee_usd_cents: simpleEmployee,
        employer_nonelective_usd_cents: simpleEmployer,
        max_total_usd_cents: simpleTotal,
        tax_savings_usd_cents: simpleTaxSavings,
        binding_caps: { employee: simpleBinding },
      },
      ranking: plans.map((p) => ({ plan: p.plan, max_total_usd_cents: p.max_total_usd_cents })),
      winner: plans[winnerIdx].plan,
      winner_tied: tied.length > 1,
      winner_tie_order: PLAN_ORDER,
      refusal_reason: null,
      domain_errors: [],
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: flags,
  };
}

/** Build the OCG v0.4 artifact envelope. Mirrors chaingraph/kernels/_hash.mjs. */
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