// art-765-dependent-care-fsa-cdctc-optimizer — Dependent Care FSA (section 129) vs.
// Child & Dependent Care Tax Credit (section 21) strategy comparator and optimal split
// finder.
//
// The kernel takes a household tax profile (filing status, AGI, marginal
// federal rate, state rate, number of qualifying children/dependents, annual
// childcare expense, whether an employer DC-FSA is available, an optional
// user-entered contribution the SOURCE page reads but never uses, and an as_of
// date), prices three strategies — FSA only, CDCTC only, and the optimal
// combination — and returns the recommended contribution, the CDCTC credit, the
// total annual saving, the after-tax cost of childcare, and the effective
// subsidy rate. FICA savings on the DC-FSA contribution are included, matching
// the source page.
//
// PORT SOURCE: ApexLogics AL-137 / display_number "#130" "Dependent Care FSA vs.
// CDCTC Optimizer", https://apexlogics.org/tools/130-dependent-care-fsa-cdctc-optimizer/
// inline <script> (35,033 bytes, sha256 fec17792…, fetched 2026-10-13):
// functions getCDCTCRate / calcStrategy / calculate, ported 1:1 in the
// 'apex_page' ruleset. See DIFFERS.md for every place the 2026 law as fetched
// this run differs from the source page, and CITES.md for the quotes.
//
// RULESETS (an explicit input, never a silent pick):
//   'statutory' (DEFAULT) — the official rules from the bytes fetched this run:
//     section 129(a)(2)(A) exclusion cap, section 21(c) expense caps, section 21(c)(2) cap-reduced-by-
//     section 129-exclusion expense base (Pub. 503 "Reduced Dollar Limit"), and the
//     section 21(a)(2) applicable-percentage schedule as amended by Pub. L. 119-21
//     sections 70404-70405 (taxable years beginning after 12/31/2025), with the
//     pre-amendment schedule for earlier as_of years.
//   'apex_page' — the source page's own constants and formulas, reproduced
//     value-for-value so any Apex result can be verified against this kernel
//     (differential test in the report: 0 mismatches).
//
// DEMONINATED: float USD dollars, exactly as the source page computes (money
// enters as dollars, rates are /100, and the display layer rounds). Nothing in
// this kernel rounds; the page's own rounding (Math.round in the AP2 export) is
// applied by the page draft, not here.
//
// NO WALL CLOCK: the only clock read on the source page is
// `generated_at: new Date().toISOString()` in the AP2 export, which is NOT in
// the arithmetic (it is itself outside the page's own execution hash). This
// kernel instead takes an explicit `as_of` (YYYY-MM-DD string) whose TAX YEAR
// selects the constant table — an as_of input parameter, the APEXPORT-110B
// pattern. No Date, no clock, no randomness: a pure function of pp.
//
// SCOPE: no OASDI wage-base cap ($184,500 for 2026, Pub. 15) and no Additional
// Medicare 0.9% on the FICA line; the 7.65% is the marginal employee-share
// assumption the source page makes. No section 129(b) earned-income limit on the
// exclusion, no section 129(c) related-provider rule, no section 21(e) household
// rules beyond the flag, no section 129(a)(2)(B) excess-inclusion mechanics, no
// reimbursement timing, no state-specific conformity, no section 125 cafeteria-plan
// eligibility test, and no employer discount or match. The source page's $250
// sweep granularity and its expense-unbounded optimum are preserved (with
// flags); see SCOPE_NOTE.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-765-dependent-care-fsa-cdctc-optimizer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'estimate_dc_fsa_cdctc_split',
  mandate_type: 'dependent_care_fsa_cdctc_record', gpu: false,
};

// ---------------------------------------------------------------------------
// Constants, named literals, each with its fetched citation. 2026 figures apply
// to taxable years beginning after 12/31/2025 (Pub. L. 119-21 sections 70404(b),
// 70405(b), quoted in CITES.md).
// ---------------------------------------------------------------------------

// IRC section 21(c)(1)-(2) — dollar limit on creditable employment-related expenses:
// "$3,000 if there is 1 qualifying individual ... $6,000 if there are 2 or more".
// Permanent; not indexed; identical in both rulesets and both source and law.
const CDCTC_EXPENSE_CAP_1 = 3000;
const CDCTC_EXPENSE_CAP_2PLUS = 6000;

// IRC section 3101(a) 6.2% (OASDI) + section 3101(b)(1) 1.45% (HI) = 7.65% employee share
// (2026, Pub. 15 "What's New": "The rate of social security tax on taxable wages
// is 6.2% each for the employer and employee ... The Medicare tax rate is 1.45%
// each for the employee and employer"). The source page's FICA_RATE literal is
// 0.0765 (page line 325) and 0.062 + 0.0145 === 0.0765 in IEEE-754, so the
// port is value-identical to the page.
// A section 125 cafeteria-plan salary reduction is not FICA wages: IRC section 3121(a)(5)(G)
// excludes from "wages" a payment "under a cafeteria plan (within the meaning of
// section 125) if such payment would not be treated as wages without regard to
// such plan", and IRS Pub. 15 (2026) lists "Dependent care assistance programs.
// Exempt to the extent it is reasonable to believe amounts are excludable from
// gross income under section 129." A DC-FSA contribution therefore escapes FICA
// as well as income tax — the page's FICA-savings premise is grounded.
const FICA_EMPLOYEE_RATE = 0.0765;

// IRC section 129(a)(2)(A) — dependent-care-assistance exclusion cap: "$7,500 ($3,750
// in the case of a separate return by a married individual)" for taxable years
// beginning after 12/31/2025 (Pub. L. 119-21 section 70404(a): "striking '$5,000
// ($2,500' and inserting '$7,500 ($3,750'"). Single and joint share the $7,500.
const FSA_LIMIT_2026 = { single_or_joint: 7500, mfs: 3750 };
// Pre-2026 text quoted by the Pub. L. 119-21 section 70404 amendment and the LII
// "Amendments 2025" note for section 129: "$5,000 ($2,500 ... )".
const FSA_LIMIT_PRE_2026 = { single_or_joint: 5000, mfs: 2500 };

// IRC section 21(a)(2), as amended by Pub. L. 119-21 section 70405(a) (applicable percentage:
// "50 percent—reduced (but not below 35 percent) by 1 percentage point for each
// $2,000 or fraction thereof by which the taxpayer's adjusted gross income ...
// exceeds $15,000, and ... further reduced (but not below 20 percent) by 1
// percentage point for each $2,000 ($4,000 in the case of a joint return) or
// fraction thereof by which the taxpayer's adjusted gross income ... exceeds
// $75,000 ($150,000 in the case of a joint return)").
const CDCTC_SCHEDULE_2026 = {
  base: 0.50,
  tier_a_from: 15000, tier_a_step: 2000, tier_a_floor: 0.35,
  tier_b_from_nonjoint: 75000, tier_b_from_joint: 150000,
  tier_b_step_nonjoint: 2000, tier_b_step_joint: 4000, tier_b_floor: 0.20,
};
// Pre-2026 section 21(a)(2), quoted verbatim by the LII "Amendments 2025" note for
// section 21 and tabulated in Pub. 503 (2025): "35 percent reduced (but not below 20
// percent) by 1 percentage point for each $2,000 (or fraction thereof) by which
// the taxpayer's adjusted gross income for the taxable year exceeds $15,000".
// Expressed as the same two-tier shape with tier_b disabled.
const CDCTC_SCHEDULE_PRE_2026 = {
  base: 0.35,
  tier_a_from: 15000, tier_a_step: 2000, tier_a_floor: 0.20,
  tier_b_from_nonjoint: Infinity, tier_b_from_joint: Infinity,
  tier_b_step_nonjoint: 2000, tier_b_step_joint: 2000, tier_b_floor: 0.20,
};

// The SOURCE PAGE's own rate schedule (page lines 330-336, duplicated at
// 451-455): 35% at AGI <= $15,000, 20% at AGI >= $43,000, otherwise
// 35% - floor((agi - 15000)/1000) * 1pp. Reproduced only under
// ruleset === 'apex_page'; it is the pre-OBBBA schedule re-stepped to $1,000
// with the floor lost over $30,999 (see DIFFERS rows D2/D3/D4).
const CDCTC_SCHEDULE_APEX_PAGE = {
  apex_max: 0.35, apex_floor_at: 43000, apex_step: 1000, apex_from: 15000,
};

// Source page sweep granularity (page line 375): the optimum is searched on
// multiples of $250 only.
const SWEEP_STEP = 250;

const SCOPE_NOTE =
  'Strategy comparator for a Dependent Care FSA (IRC §129 exclusion) vs. the Child & Dependent Care ' +
  'Tax Credit (IRC §21), plus the optimal combination. FICA savings on the FSA contribution are the ' +
  '7.65% employee share (IRC §3101(a) 6.2% + §3101(b)(1) 1.45%) with NO OASDI wage-base cap ($184,500 ' +
  'for 2026) and NO 0.9% Additional Medicare Tax. Marginal federal and state rates are caller inputs, ' +
  'not computed from tax tables. Not modelled: the §129(b) earned-income limit on the exclusion, the ' +
  '§129(a)(2)(B) excess inclusion, §129(c) related providers, §21(e) household and joint-return ' +
  'rules (MFS is flagged, not zeroed), plan discrimination tests (§129(d)), employer discounts, and ' +
  'state conformity. The optimum is searched on $250 grid steps and is never bounded by actual ' +
  'expenses, exactly as the source page does; both are flagged. Educational decision support, not tax ' +
  'advice. Money is float USD exactly as the source computes it; nothing rounds.';

// ---------------------------------------------------------------------------
// refusal plumbing
// ---------------------------------------------------------------------------

function refused(reason, text) {
  return {
    output_payload: {
      as_of: null, tax_year: null, ruleset: null,
      filing_status: null, agi: null, marginal_rate_pct: null, state_rate_pct: null,
      num_children: null, childcare_cost: null, fsa_available: null, fsa_contrib: null,
      fsa_limit: null, cdctc_expense_cap: null, cdctc_rate: null,
      rate_schedule: null,
      strategies: { fsa_only: null, cdctc_only: null, optimal_combo: null },
      optimal_fsa_contribution: null, fica_savings_on_fsa: null,
      effective_rate: null, effective_subsidy_pct: null,
      best_strategy: null, verdict: null,
      refusals: [], refusal_reason: reason, domain_errors: [{ code: reason, text }],
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: ['ART765_INPUT_REFUSED'],
  };
}

// ---------------------------------------------------------------------------
// date helper (no Date object anywhere in the arithmetic)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------

function isFiniteNumber(v) { return typeof v === 'number' && Number.isFinite(v); }
function isNonNegMoney(v) { return isFiniteNumber(v) && v >= 0; }
function isPercent(v) { return isFiniteNumber(v) && v >= 0 && v <= 100; }

function validate(pp) {
  if (!isIsoDate(pp.as_of)) {
    return refused('REFUSED_BAD_AS_OF', 'as_of must be a real calendar date as a YYYY-MM-DD string; the node never reads a clock');
  }
  if (pp.filing_status !== 'single' && pp.filing_status !== 'mfj' && pp.filing_status !== 'mfs') {
    return refused('REFUSED_BAD_FILING_STATUS', "filing_status must be 'single', 'mfj' or 'mfs'");
  }
  if (!isNonNegMoney(pp.agi)) {
    return refused('REFUSED_BAD_AGI', 'policy_parameters.agi must be a finite non-negative number of USD dollars');
  }
  if (!isPercent(pp.marginal_rate_pct)) {
    return refused('REFUSED_BAD_MARGINAL_RATE', 'marginal_rate_pct must be a finite number in [0, 100]');
  }
  if (!isPercent(pp.state_rate_pct)) {
    return refused('REFUSED_BAD_STATE_RATE', 'state_rate_pct must be a finite number in [0, 100]');
  }
  if (typeof pp.num_children !== 'number' || !Number.isInteger(pp.num_children) || pp.num_children < 1) {
    return refused('REFUSED_BAD_NUM_CHILDREN', 'num_children must be an integer >= 1 (number of qualifying individuals)');
  }
  if (!isNonNegMoney(pp.childcare_cost)) {
    return refused('REFUSED_BAD_CHILDCARE_COST', 'childcare_cost must be a finite non-negative number of USD dollars');
  }
  if (typeof pp.fsa_available !== 'boolean') {
    return refused('REFUSED_BAD_FSA_AVAILABLE', 'fsa_available must be a boolean (is a dependent care FSA available through the employer?)');
  }
  // fsa_contrib is echoed only: the source page reads this control (page line
  // 359) and never dereferences it in the arithmetic (DIFFERS shape S5). It is
  // therefore OPTIONAL and never changes a number. R4 (absent equals explicit
  // null): a null fsa_contrib takes the absent form's answer — treated as not
  // supplied, echoed as not supplied.
  if (pp.fsa_contrib != null && !isNonNegMoney(pp.fsa_contrib)) {
    return refused('REFUSED_BAD_FSA_CONTRIB', 'fsa_contrib must be a finite non-negative number of USD dollars');
  }
  if (pp.ruleset != null && pp.ruleset !== 'statutory' && pp.ruleset !== 'apex_page') {
    return refused('REFUSED_BAD_RULESET', "ruleset must be 'statutory' (default) or 'apex_page'");
  }
  return null;
}

// ---------------------------------------------------------------------------
// the two rule tables selected by as_of's tax year
// ---------------------------------------------------------------------------

function tablesFor(taxYear) {
  const post2025 = taxYear >= 2026;
  return {
    fsaLimit: post2025 ? FSA_LIMIT_2026 : FSA_LIMIT_PRE_2026,
    cdctc: post2025 ? CDCTC_SCHEDULE_2026 : CDCTC_SCHEDULE_PRE_2026,
    post2025,
  };
}

function rateScheduleDescriptor(cdctc) {
  // A disabled tier (the pre-2026 schedule has no tier B) is emitted as null,
  // never Infinity: the execution hash canonicalizer rejects non-finite numbers
  // (RFC 8785 section 3.2.2.3 I-JSON), and null is what the committed vector record
  // carries for the disabled tier. The RATE LOGIC below still compares against
  // the table's numeric thresholds, not this descriptor.
  const fin = (x) => (Number.isFinite(x) ? x : null);
  return {
    base: cdctc.base,
    tier_a: { from: cdctc.tier_a_from, step: cdctc.tier_a_step, floor: cdctc.tier_a_floor },
    tier_b: {
      from_nonjoint: fin(cdctc.tier_b_from_nonjoint), from_joint: fin(cdctc.tier_b_from_joint),
      step_nonjoint: cdctc.tier_b_step_nonjoint, step_joint: cdctc.tier_b_step_joint,
      floor: cdctc.tier_b_floor,
    },
  };
}

// ---------------------------------------------------------------------------
// section 21(a)(2) applicable percentage — the statute as fetched this run.
// "50 percent—reduced (but not below 35 percent) by 1 percentage point for each
//  $2,000 or fraction thereof by which ... adjusted gross income ... exceeds
//  $15,000, and ... further reduced (but not below 20 percent) by 1 percentage
//  point for each $2,000 ($4,000 in the case of a joint return) or fraction
//  thereof by which ... adjusted gross income ... exceeds $75,000 ($150,000 in
//  the case of a joint return)."
// ---------------------------------------------------------------------------

function cdctcRateStatutory(agi, joint, cdctc) {
  let rate = cdctc.base;
  if (agi > cdctc.tier_a_from) {
    rate = Math.max(cdctc.tier_a_floor, rate - Math.ceil((agi - cdctc.tier_a_from) / cdctc.tier_a_step) * 0.01);
  }
  if (agi > cdctc.tier_b_from_joint || agi > cdctc.tier_b_from_nonjoint) {
    const from = joint ? cdctc.tier_b_from_joint : cdctc.tier_b_from_nonjoint;
    const step = joint ? cdctc.tier_b_step_joint : cdctc.tier_b_step_nonjoint;
    if (agi > from) {
      rate = Math.max(cdctc.tier_b_floor, rate - Math.ceil((agi - from) / step) * 0.01);
    }
  }
  return rate;
}

// The source page's own schedule, reproduced exactly (page lines 330-336 and
// its duplicate at 451-455). No 20% floor below $43,000; $1,000 steps.
function cdctcRateApexPage(agi) {
  const S = CDCTC_SCHEDULE_APEX_PAGE;
  if (agi <= S.apex_from) return S.apex_max;
  if (agi >= S.apex_floor_at) return 0.20;
  return 0.35 - Math.floor((agi - S.apex_from) / S.apex_step) * 0.01;
}

// ---------------------------------------------------------------------------
// section 21(c) credit base — the statute vs. the source page.
// ---------------------------------------------------------------------------

const BASE_RULE = {
  statutory: 'statutory_cap_minus_exclusion_then_expenses',
  apex_page: 'apex_min_cap_cost_minus_exclusion',
};

// section 21(c)(2): "The amount determined under paragraph (1) or (2) (whichever is
// applicable) shall be reduced by the aggregate amount excludable from gross
// income under section 129 for the taxable year." Pub. 503 (2025) "Reduced
// Dollar Limit": "you must subtract that amount from the dollar limit that
// applies to you", and its George example figures the credit on $2,000 of $2,900
// expenses with a $3,000 limit and a $1,000 exclusion — i.e.
// min(expenses, cap - exclusion), never (min(cap, expenses) - exclusion).
function creditBaseStatutory(childcareCost, cap, fsa) {
  return Math.min(childcareCost, Math.max(0, cap - fsa));
}

// The source page's construction (page line 340):
// Math.max(0, Math.min(expCap, childcareCost) - fsaContrib).
function creditBaseApexPage(childcareCost, cap, fsa) {
  return Math.max(0, Math.min(cap, childcareCost) - fsa);
}

// ---------------------------------------------------------------------------
// one strategy (page calcStrategy, lines 338-349), with the two rule knobs
// ---------------------------------------------------------------------------

function strategy(fsa, ctx) {
  const cap = ctx.num_children >= 2 ? CDCTC_EXPENSE_CAP_2PLUS : CDCTC_EXPENSE_CAP_1;
  const base = ctx.ruleset === 'apex_page'
    ? creditBaseApexPage(ctx.childcare_cost, cap, fsa)
    : creditBaseStatutory(ctx.childcare_cost, cap, fsa);
  const cdctc_credit = base * ctx.rate;
  // Bit-identical to the page: fsaContrib * (marginalRate/100 + stateRate/100)
  const fsa_tax_savings = fsa * (ctx.marginal_rate_pct / 100 + ctx.state_rate_pct / 100);
  const fica_savings = fsa * FICA_EMPLOYEE_RATE;
  const total_savings = fsa_tax_savings + fica_savings + cdctc_credit;
  const net_cost = ctx.childcare_cost - total_savings;
  const effective_rate = ctx.childcare_cost > 0 ? net_cost / ctx.childcare_cost : 0;
  return {
    fsa_contrib: fsa,
    fsa_tax_savings, fica_savings, cdctc_credit,
    total_savings, net_cost, effective_rate,
    credit_base: base, expense_cap: cap,
  };
}

// The page's "FSA Only" card zeroes the credit (lines 366-367).
function fsaOnlyStrategy(fsaAmt, ctx) {
  const s = strategy(fsaAmt, ctx);
  return Object.assign({}, s, { cdctc_credit: 0, total_savings: s.fsa_tax_savings + s.fica_savings });
}

// ---------------------------------------------------------------------------
// the ported compute
// ---------------------------------------------------------------------------

export function compute(pp) {
  pp = pp || {};
  const bad = validate(pp);
  if (bad) return bad;

  const ruleset = pp.ruleset == null ? 'statutory' : pp.ruleset;
  const as_of = pp.as_of;
  const tax_year = Number(as_of.slice(0, 4));
  const tables = tablesFor(tax_year);
  const joint = pp.filing_status === 'mfj';
  const mfs = pp.filing_status === 'mfs';

  const fsa_limit = mfs ? tables.fsaLimit.mfs : tables.fsaLimit.single_or_joint;

  // Applicable percentage (section 21(a)(2)) — statutory unless ruleset === 'apex_page'.
  const cdctc = tables.cdctc;
  const rate = ruleset === 'apex_page'
    ? cdctcRateApexPage(pp.agi)
    : cdctcRateStatutory(pp.agi, joint, cdctc);

  const ctx = {
    num_children: pp.num_children,
    childcare_cost: pp.childcare_cost,
    marginal_rate_pct: pp.marginal_rate_pct,
    state_rate_pct: pp.state_rate_pct,
    ruleset,
    rate,
  };

  // Strategy 1 — FSA only (page lines 363-367): max the FSA, drop the credit.
  const fsaAmt = pp.fsa_available ? Math.min(fsa_limit, pp.childcare_cost) : 0;
  const strat_fsa_only = fsaOnlyStrategy(fsaAmt, ctx);

  // Strategy 2 — CDCTC only (page line 370).
  const strat_cdctc_only = strategy(0, ctx);

  // Strategy 3 — the page's optimal sweep (lines 372-379): f from 0 to fsa_max
  // in $250 steps, first strictly-better candidate wins, CDCTC-only is the seed.
  let best = strat_cdctc_only;
  if (pp.fsa_available) {
    for (let f = 0; f <= fsa_limit; f += SWEEP_STEP) {
      const s = strategy(f, ctx);
      if (s.total_savings > best.total_savings) best = s;
    }
  }
  const optimal_combo = best;
  const optimal_fsa_contribution = pp.fsa_available ? optimal_combo.fsa_contrib : 0;
  const fica_savings_on_fsa = optimal_fsa_contribution * FICA_EMPLOYEE_RATE;
  const effective_rate = pp.childcare_cost > 0 ? optimal_combo.net_cost / pp.childcare_cost : 0;

  // Page verdict comparator (line 427): the combo card "wins" on >= against
  // both single-strategy cards (so an exact three-way tie reports the combo).
  const is_combo_win = optimal_combo.total_savings >= strat_fsa_only.total_savings
    && optimal_combo.total_savings >= strat_cdctc_only.total_savings;
  const best_strategy = is_combo_win
    ? (optimal_fsa_contribution > 0 ? 'OPTIMAL_COMBO' : 'CDCTC_ONLY')
    : (strat_fsa_only.total_savings >= strat_cdctc_only.total_savings ? 'FSA_ONLY' : 'CDCTC_ONLY');
  const verdict = is_combo_win ? 'OPTIMAL_COMBO' : 'SINGLE_STRATEGY';

  const flags = [];
  // section 21(e)(2) "Married couples must file joint return": "If the taxpayer is
  // married at the close of the taxable year, the credit shall be allowed under
  // subsection (a) only if the taxpayer and his spouse file a joint return for
  // the taxable year." — the source page grants an MFS claimant the full credit.
  // Flagged, not silently changed.
  if (mfs) flags.push('ART765_CDCTC_MFS_BARRED_BY_SECTION_21E2');
  // The page's sweep objective never bounds the contribution by expenses.
  if (optimal_fsa_contribution > pp.childcare_cost) {
    flags.push('ART765_FSA_RECOMMENDATION_EXCEEDS_EXPENSES');
  }
  // The $250 grid cannot land on the expense-filling optimum.
  const expenseFilling = Math.min(ctx_expenseCap(ctx), pp.childcare_cost);
  if (optimal_fsa_contribution > 0 && expenseFilling % SWEEP_STEP !== 0) {
    flags.push('ART765_SWEEP_GRANULARITY_250');
  }
  if (ruleset === 'apex_page') flags.push('ART765_RATE_BASIS_SOURCE_PAGE');

  return {
    output_payload: {
      as_of,
      tax_year,
      ruleset,
      filing_status: pp.filing_status,
      agi: pp.agi,
      marginal_rate_pct: pp.marginal_rate_pct,
      state_rate_pct: pp.state_rate_pct,
      num_children: pp.num_children,
      childcare_cost: pp.childcare_cost,
      fsa_available: pp.fsa_available,
      fsa_contrib_input: pp.fsa_contrib == null ? undefined : pp.fsa_contrib,
      fsa_limit,
      cdctc_expense_cap: ctx_expenseCap(ctx),
      cdctc_rate: rate,
      rate_schedule: ruleset === 'apex_page'
        ? { source: 'apex page lines 330-336', max: 0.35, floor_at_or_above: 43000, step: 1000, from: 15000 }
        : { source: post2025Label(tables.post2025), ...rateScheduleDescriptor(cdctc) },
      credit_base_rule: BASE_RULE[ruleset],
      strategies: { fsa_only: strat_fsa_only, cdctc_only: strat_cdctc_only, optimal_combo },
      optimal_fsa_contribution,
      fica_savings_on_fsa,
      effective_rate,
      effective_subsidy_pct: (1 - effective_rate) * 100,
      best_strategy,
      verdict,
      refusals: [],
      refusal_reason: null,
      domain_errors: [],
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: flags,
  };
}

function ctx_expenseCap(ctx) {
  return ctx.num_children >= 2 ? CDCTC_EXPENSE_CAP_2PLUS : CDCTC_EXPENSE_CAP_1;
}

function post2025Label(post2025) {
  return post2025
    ? 'IRC 21(a)(2) as amended by Pub. L. 119-21 sec. 70405 (taxable years beginning after 12/31/2025)'
    : 'IRC 21(a)(2) prior text (taxable years beginning before 1/1/2026)';
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

