import { executionHash } from './_hash.mjs';

// art-852, US federal self-employment tax (Schedule SE) recompute + cross-check.
// Spec: research/SE-TAX-NODE-SPEC-2026-11.md (row SE-TAX-SPEC-1, workspace-side).
// Built by SE-TAX-NODE-1. Regular (actual-net-earnings) method only; the farm and
// nonfarm optional methods are OUT of this version and refuse by name.
//
// NOT TAX ADVICE. Recomputes three figures a caller already holds so they can be
// cross-checked: (1) Schedule SE tax split into its social security (OASDI) and
// hospital insurance (Medicare) parts, (2) the 0.9 percent Additional Medicare Tax
// on self-employment income, and (3) the above-the-line deduction of one half of
// the SE tax. Values-only inputs: no SSN, EIN, name or business name exists on the
// input surface.
//
// YEAR-KEYED AND FAIL-CLOSED. tax_year is REQUIRED; the OASDI contribution and
// benefit base is selected from TAX_YEAR_PARAMS[tax_year]. Any year that does not
// resolve in the pinned table (absent, mistyped, or unsupported such as 2024)
// refuses LOOKUP_YEAR_UNAVAILABLE and computes nothing; the node never extrapolates
// a base or an optional-method constant to an unpinned year. [S4] bases are
// year-specific; the SSA publishes them annually.
//
// PINNED CONSTANTS, every one carried by a snapshot key (sources fetched and
// sha256-pinned 2026-11-21; digest list in the spec's snapshot meta):
//   [S1] 26 USC 1401(a): 12.4 percent OASDI; 1401(b)(1): 2.9 percent HI;
//        1401(b)(2)(A): 0.9 percent Additional Medicare Tax over thresholds
//        250000 joint / one half of that for married-filing-separately (the
//        statute says half of clause (i); the 125000 dollar figure is printed
//        verbatim in the Form 8959 threshold chart [S6]) / 200000 all others;
//        taxable years beginning after Dec 31 2012; 1401(b)(2)(B): the
//        applicable threshold is reduced (not below zero) by wages taken into
//        account under section 3121(b)(2).
//   [S2] 26 USC 1402(a): net earnings from self-employment = gross income less
//        the attributable deductions; 1402(a)(12): the deduction equals net
//        earnings times one half of the sum of the 1401(a) and 1401(b)(1) rates
//        (7.65 percent), i.e. net earnings = profit x 0.9235 (the explicit
//        92.35 percent statement is [S7] ch.10); 1402(b)(1): OASDI applies only
//        up to (base − wages); 1402(b)(2): 400 dollar floor on net earnings;
//        1402(j)(2)(B): for church employee income "100 shall be substituted for
//        400" on the net-earnings floor; 1402(j)(3): the 1402(a)(12) deduction
//        applies to church employee income notwithstanding 1402(j)(1).
//   [S3] 26 USC 164(f)(1): the deduction is one half of the taxes imposed by
//        1401 OTHER THAN the taxes imposed by 1401(b)(2) — the Additional
//        Medicare Tax is excluded from the deduction base.
//   [S4] SSA contribution and benefit base: 176100 (2025), 184500 (2026);
//        OASDI self-employment rate 12.4 percent; HI self-employed 2.90 percent
//        (no HI limitation after 1993).
//   [S5] Instructions for Schedule SE (2026): church employee income floor
//        108.28 dollars; 400 dollar net-earnings filing floor; church-only path
//        (skip lines 1-4b, zero on 4c); losses of one business offset another in
//        the combined figure the caller supplies; fiscal-year filers out of
//        scope (the node refuses rather than approximate).
//   [S6] Instructions for Form 8959 (2025): threshold chart 250000 joint /
//        125000 married-filing-separately / 200000 single, head-of-household,
//        qualifying-surviving-spouse; thresholds are not indexed for inflation;
//        SE income is read from Schedule SE Part I line 6 (net earnings, not raw
//        profit); a self-employment loss is not considered; line 13 multiplies
//        by 0.009; the threshold is reduced by TOTAL Medicare wages (this node's
//        single wage input is OASDI wages, so callers whose Medicare-only wages
//        exceed the OASDI base are flagged, see WAGE_INPUT_ABOVE_BASE_DIVERGENCE);
//        RRTA compensation is compared separately and never reduces the SE
//        threshold (out of scope here).
//   [S7] Pub 334 (2025) ch.1: SE tax = 15.3 percent (12.4 + 2.9); wages at or
//        above the base mean no 12.4 percent SE part; no maximum on the Medicare
//        part; ch.10 regular method: multiply by 92.35 percent (0.9235).
//
// CHURCH INCOME (values in dollars, scaled at 0.9235 like all other earnings —
// [S2] 1402(j)(3) keeps the (a)(12) deduction alive for church income, and the
// 100-dollar net-earnings floor over 0.9235 reproduces the 108.28-dollar income
// filing floor [S5]). The floors are applied SEPARATELY, never to the combined
// figure: church employee income below 108.28 dollars is excluded at intake
// (flagged); non-church net earnings below 400 dollars contribute nothing
// (flagged when the caller actually entered a positive non-church profit);
// church net earnings below 100 dollars contribute nothing (statutory floor,
// unflagged, documented in the branch inventory).
//
// ARITHMETIC. All money is integer cents internally and every product runs in
// BigInt over a 1e4-scaled rational (numerator of cents/10000), so a value is
// rounded half-up to cents exactly once, at output, from its unrounded value.
// Named consequence: the sum of the rounded parts can differ from the rounded
// total by one cent (church-only 1000 dollars at 2026: 114.51 + 26.78 parts vs
// 141.30 total); the divergence is documented in the payload, not smoothed away.
// Dollar inputs are converted at intake with Math.round(dollars x 100), so a
// sub-cent fraction rounds at intake (named in the branch inventory); each
// money input is bounded at MAX_DOLLARS so every downstream product stays exact.
//
// Pure ECMA-262 arithmetic: no Date, no Math.random, no Intl, no toLocaleString,
// no TextEncoder (hashing happens only through the shared _hash.mjs import).

const TOOL_ID = 'art-852-se-tax-and-deductions';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_se_tax_and_deductions',
  mandate_type: 'compliance_control', gpu: false,
};

// ── year-keyed parameters (cents) ────────────────────────────────────────────────
// [S4] the OASDI contribution and benefit base is the ONLY constant that moves
// between 2025 and 2026 in the regular-method compute path; a future year ADDS a
// keyed entry and never overwrites one. 2027 is recorded in the pinned SSA table
// but stays unsupported until the IRS publishes final 2027 instructions (the
// spec's refresh item); this node refuses it until then.
export const TAX_YEAR_PARAMS = {
  2025: { oasdi_base_cents: 17610000 },
  2026: { oasdi_base_cents: 18450000 },
};
export const SUPPORTED_TAX_YEARS = Object.keys(TAX_YEAR_PARAMS);

// Statutory, not indexed, deliberately NOT year-keyed: [S1]/[S4]/[S6].
const OASDI_BP = 1240;        // 12.4 percent of 10000
const HI_BP = 290;            // 2.9 percent
const ADDL_MEDICARE_BP = 90;  // 0.9 percent
const NE_FACTOR = 9235;       // 92.35 percent net-earnings factor [S2 a12; S7 ch10]
const NE_FACTOR_DEN = 10000;
const BP_DEN = 10000;
const HASH_SCALE_DEN = 100000000; // cents/100 preimage scale for bp products

// Additional Medicare Tax thresholds (cents), [S1] 1401(b)(2)(A) + [S6] chart.
const THRESHOLD_MFJ_CENTS = 25000000;
const THRESHOLD_MFS_CENTS = 12500000;
const THRESHOLD_OTHER_CENTS = 20000000;

// Floors (cents): [S2] 1402(b)(2) 400 dollars; [S5] 108.28 dollars church income
// floor; [S2] 1402(j)(2)(B) 100 dollars church net-earnings floor.
const NE_FLOOR_CENTS = 40000;
const CHURCH_INCOME_FLOOR_CENTS = 10828;
const CHURCH_NE_FLOOR_CENTS = 10000;

const FILING_STATUSES = ['single', 'mfj', 'mfs', 'hoh', 'qss'];
const METHODS = ['regular'];
const OPTIONAL_METHOD_NAMES = ['farm', 'nonfarm', 'farm_and_nonfarm'];

// Money bound: keeps every downstream BigInt product exact and every dollar
// output inside the double range. 1e13 dollars per input.
const MAX_DOLLARS = 10000000000000;

// ── hashability walk (D6) ────────────────────────────────────────────────────────
// Mirrors the classes the shared canonicalizer refuses before hashing: non-finite
// numbers, integers beyond 2^53, nesting past its depth limit, more values than
// its element budget, and a reference cycle. Reports { reason, detail } with the
// path and kind only, never the value; null when the subtree is safe to hash.
const HASH_MAX_DEPTH = 512;
const HASH_MAX_ELEMENTS = 1000000;
// pp alone is held to tighter margins than the full preimage: the
// {policy_parameters, output_payload} envelope wraps pp two levels deeper and
// output_payload carries values too.
const PP_MAX_DEPTH = HASH_MAX_DEPTH - 8;
const PP_MAX_ELEMENTS = 199000;

function findHashRefusal(v, path, depth, budget, stack) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (Array.isArray(v)) {
    if (stack.indexOf(v) !== -1) return { reason: 'REFUSED_INPUT_UNHASHABLE_CYCLE', detail: path + ': reference_cycle' };
    stack.push(v);
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget, stack);
      if (r !== null) { stack.pop(); return r; }
    }
    stack.pop();
    return null;
  }
  if (v !== null && typeof v === 'object') {
    if (stack.indexOf(v) !== -1) return { reason: 'REFUSED_INPUT_UNHASHABLE_CYCLE', detail: path + ': reference_cycle' };
    stack.push(v);
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget, stack);
      if (r !== null) { stack.pop(); return r; }
    }
    stack.pop();
  }
  return null;
}

function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

const hasOwn = (o, k) => Object.hasOwn(o, k);
const refuse = (errors, code, detail) => { errors.push(code + ': ' + detail); };

// Intake conversion: dollars -> integer cents. Math.round on x*100 is the named
// sub-cent policy: 1234.56 -> 123456 exactly; 1234.565 -> 123457 (round half up
// away from zero for positives, toward zero for negatives, at intake only).
function toCents(v) { return Math.round(v * 100); }

function divHalfUp(num, den) {
  const n = BigInt(num);
  const d = BigInt(den);
  const q = n / d;
  const r = n - q * d;
  return (r * 2n >= d) ? q + 1n : q;
}

// cents BigInt -> dollars Number rounded to the cent (exact: |cents| < 2^52).
function money(cents) { return Number(cents) / 100; }

function emptyPayload() {
  return {
    not_tax_advice: true,
    valid_input: false,
    domain_errors: [],
    refusal_code: null,
    tax_year: null,
    filing_status: null,
    net_se_profit_input: null,
    w2_wages_ss_input: null,
    church_employee_income_input: null,
    net_earnings: null,
    non_church_net_earnings: null,
    church_net_earnings: null,
    church_income_included: null,
    oasdi_taxable_net_earnings: null,
    se_tax_oasdi: null,
    se_tax_medicare: null,
    se_tax_total: null,
    additional_medicare: null,
    half_se_deduction: null,
    additional_medicare_threshold: null,
    additional_medicare_threshold_reduced: null,
    oasdi_base: null,
    parts_vs_total_rounding_note: null,
    constants_version: null,
    supported_tax_years: SUPPORTED_TAX_YEARS,
    regulatory_basis: null,
    scope_note: null,
    warnings: [],
  };
}

function refusedResult(errors) {
  const output_payload = emptyPayload();
  output_payload.domain_errors = errors;
  output_payload.refusal_code = errors[0].split(':')[0];
  const compliance_flags = [];
  if (errors.length > 0) compliance_flags.push('INPUT_REFUSED', output_payload.refusal_code);
  output_payload.warnings = compliance_flags.slice();
  return { output_payload, compliance_flags };
}

function thresholdCentsFor(status) {
  if (status === 'mfj') return THRESHOLD_MFJ_CENTS;
  if (status === 'mfs') return THRESHOLD_MFS_CENTS;
  return THRESHOLD_OTHER_CENTS;
}

// ── validation: name the violated bound, never coerce ────────────────────────────
// Presence: absent means === undefined. A present null or a wrong type refuses.
// No Number(), no parseFloat, no truthiness default on any caller value.
function validate(pp) {
  const errors = [];

  // v1 computes the regular method only. An explicit request for the farm or
  // nonfarm optional method is a named refusal, never a silent regular-method
  // fallback (the governing text and issuer constants are pinned for a v2).
  let method = 'regular';
  if (hasOwn(pp, 'method') && pp.method !== null) {
    if (typeof pp.method !== 'string') {
      refuse(errors, 'REFUSED_INPUT_WRONG_TYPE', 'method must be a string when present');
    } else if (OPTIONAL_METHOD_NAMES.indexOf(pp.method) !== -1) {
      refuse(errors, 'OPTIONAL_METHOD_UNSUPPORTED', 'method ' + pp.method + ' is not computed by this version; the regular method only. The optional-method governing text and constants are pinned for a future version.');
    } else if (METHODS.indexOf(pp.method) === -1) {
      refuse(errors, 'REFUSED_INPUT_NOT_IN_ENUM', 'method must be exactly one of ' + METHODS.join(', ') + ' when present');
    } else method = pp.method;
  }

  // Year gate first, exactly as the spec orders it: nothing computes without a
  // pinned year. Any tax_year that does not resolve in TAX_YEAR_PARAMS refuses
  // LOOKUP_YEAR_UNAVAILABLE (absent, null, wrong type, or an unsupported year).
  let params = null;
  const ty = pp.tax_year;
  if (typeof ty === 'number' && Number.isSafeInteger(ty) && Object.hasOwn(TAX_YEAR_PARAMS, ty)) {
    params = TAX_YEAR_PARAMS[ty];
  } else {
    refuse(errors, 'LOOKUP_YEAR_UNAVAILABLE', 'tax_year must resolve in the pinned year table (' + SUPPORTED_TAX_YEARS.join(', ') + '); no base or constant is ever extrapolated to an unpinned year');
  }

  let status = null;
  if (typeof pp.filing_status !== 'string' || FILING_STATUSES.indexOf(pp.filing_status) === -1) {
    refuse(errors, 'REFUSED_INPUT_NOT_IN_ENUM', 'filing_status must be exactly one of ' + FILING_STATUSES.join(', '));
  } else status = pp.filing_status;

  let profit = null;
  if (typeof pp.net_se_profit !== 'number' || !Number.isFinite(pp.net_se_profit)) {
    refuse(errors, 'REFUSED_INPUT_WRONG_TYPE', 'net_se_profit must be a finite number of dollars (a loss may be negative)');
  } else if (Math.abs(pp.net_se_profit) > MAX_DOLLARS) {
    refuse(errors, 'REFUSED_INPUT_UNSAFE_MAGNITUDE', 'net_se_profit must not exceed ' + MAX_DOLLARS + ' dollars');
  } else profit = toCents(pp.net_se_profit);

  let wages = null;
  if (typeof pp.w2_wages_ss !== 'number' || !Number.isFinite(pp.w2_wages_ss) || pp.w2_wages_ss < 0) {
    refuse(errors, 'REFUSED_INPUT_WRONG_TYPE', 'w2_wages_ss must be a finite number of dollars, at least 0');
  } else if (pp.w2_wages_ss > MAX_DOLLARS) {
    refuse(errors, 'REFUSED_INPUT_UNSAFE_MAGNITUDE', 'w2_wages_ss must not exceed ' + MAX_DOLLARS + ' dollars');
  } else wages = toCents(pp.w2_wages_ss);

  // Optional; absent means no church employee income. A present null or a wrong
  // type refuses rather than defaulting. A present value below the floor is a
  // flagged exclusion, not an error.
  let churchGiven = false;
  let church = 0;
  if (hasOwn(pp, 'church_employee_income') && pp.church_employee_income !== null) {
    const cv = pp.church_employee_income;
    if (typeof cv !== 'number' || !Number.isFinite(cv) || cv < 0) {
      refuse(errors, 'REFUSED_INPUT_WRONG_TYPE', 'church_employee_income must be a finite number of dollars, at least 0, when present');
    } else if (cv > MAX_DOLLARS) {
      refuse(errors, 'REFUSED_INPUT_UNSAFE_MAGNITUDE', 'church_employee_income must not exceed ' + MAX_DOLLARS + ' dollars');
    } else { churchGiven = true; church = toCents(cv); }
  }

  return { errors, method, params, taxYear: typeof ty === 'number' ? ty : null, status, profit, wages, churchGiven, church };
}

export function compute(rawPp) {
  // Presence and shape are checked, never defaulted: a non-object or an
  // unhashable input (D6) refuses here, so buildArtifact never has to hash
  // anything compute accepted.
  if (!isPlainObject(rawPp)) return refusedResult(['REFUSED_INPUT_WRONG_TYPE: policy_parameters must be a plain object']);
  const unhashable = findHashRefusal(rawPp, 'pp', 1, { maxDepth: PP_MAX_DEPTH, maxElements: PP_MAX_ELEMENTS, n: 0 }, []);
  if (unhashable !== null) return refusedResult([unhashable.reason + ': ' + unhashable.detail]);

  // Own-property copy: a caller key such as __proto__ or constructor is an
  // ordinary key and no inherited value is ever read.
  const pp = Object.fromEntries(Object.entries(rawPp));
  const v = validate(pp);
  if (v.errors.length > 0) return refusedResult(v.errors);

  const y = v.params;
  const compliance_flags = [];

  // Losses: a self-employment loss is not considered for this tax [S6]; the
  // combined figure across businesses is the caller's input [S5].
  const lossNotConsidered = v.profit < 0;
  const pCents = lossNotConsidered ? 0 : v.profit;
  if (lossNotConsidered) compliance_flags.push('LOSS_NOT_CONSIDERED');

  // Church intake floor, applied to the caller's entered income only: a value
  // that is present, positive and below 108.28 dollars is excluded and flagged.
  const churchExcluded = v.churchGiven && v.church > 0 && v.church < CHURCH_INCOME_FLOOR_CENTS;
  if (churchExcluded) compliance_flags.push('CHURCH_BELOW_FLOOR');
  const churchIncluded = v.churchGiven && !churchExcluded ? v.church : 0;
  const churchNENum = BigInt(churchIncluded) * BigInt(NE_FACTOR); // scale 1e4 over cents
  // [S2] 1402(j)(2)(B): the 100-dollar net-earnings floor applies to church
  // income separately; below it the church contribution is zero (unflagged,
  // documented in the branch inventory — at income >= the 108.28 filing floor
  // only income in a hair-thin band above it lands here).
  const churchTaxableNum = churchNENum < BigInt(CHURCH_NE_FLOOR_CENTS) * BigInt(NE_FACTOR_DEN) ? 0n : churchNENum;

  // Non-church net earnings and the separate 400-dollar floor [S2] 1402(b)(2).
  const ncNENum = BigInt(pCents) * BigInt(NE_FACTOR);
  const ncTaxableNum = ncNENum < BigInt(NE_FLOOR_CENTS) * BigInt(NE_FACTOR_DEN) ? 0n : ncNENum;
  if (ncTaxableNum === 0n && pCents > 0) compliance_flags.push('BELOW_NET_EARNINGS_FLOOR');

  const neNum = ncTaxableNum + churchTaxableNum; // scale 1e4 over cents

  // OASDI cap coordination [S2] 1402(b)(1): taxable only up to (base − wages).
  const roomCents = BigInt(y.oasdi_base_cents) - BigInt(v.wages);
  const cappedRoomNum = (roomCents <= 0n) ? 0n : roomCents * BigInt(NE_FACTOR_DEN);
  const oasdiBaseNum = neNum < cappedRoomNum ? neNum : cappedRoomNum;
  // [S7] ch.1: wages at or above the base mean the caller may hold Medicare-only
  // wages this input cannot see; the Additional Medicare threshold reduction is
  // then understated and the divergence is flagged, not absorbed [S6].
  if (BigInt(v.wages) >= BigInt(y.oasdi_base_cents)) compliance_flags.push('WAGE_INPUT_ABOVE_BASE_DIVERGENCE');

  // Parts, each from its own unrounded value (scale 1e8 over cents).
  const oasdiNum = oasdiBaseNum * BigInt(OASDI_BP);
  const hiNum = neNum * BigInt(HI_BP);
  const totalNum = oasdiNum + hiNum;

  // Additional Medicare Tax [S1] 1401(b)(2): threshold by filing status,
  // reduced (not below zero) by wages, 0.9 percent of the excess of net
  // earnings over the reduced threshold (net earnings, not raw profit [S6]).
  const thresholdCents = BigInt(thresholdCentsFor(v.status));
  const reducedCents = thresholdCents > BigInt(v.wages) ? thresholdCents - BigInt(v.wages) : 0n;
  const excessNum = neNum - reducedCents * BigInt(NE_FACTOR_DEN);
  const addlNum = excessNum > 0n ? excessNum * BigInt(ADDL_MEDICARE_BP) : 0n;

  const oasdiCents = divHalfUp(oasdiNum, BigInt(HASH_SCALE_DEN));
  const hiCents = divHalfUp(hiNum, BigInt(HASH_SCALE_DEN));
  const totalCents = divHalfUp(totalNum, BigInt(HASH_SCALE_DEN));
  const addlCents = divHalfUp(addlNum, BigInt(HASH_SCALE_DEN));
  // [S3] 164(f)(1): one half of the SE tax EXCLUDING the Additional Medicare Tax,
  // rounded half up from the unrounded half.
  const halfCents = divHalfUp(totalNum, BigInt(2 * HASH_SCALE_DEN));

  let partsNote = null;
  if (oasdiCents + hiCents !== totalCents) {
    partsNote = 'the rounded parts sum to ' + money(oasdiCents + hiCents) + ' while the total rounds from its unrounded value to ' + money(totalCents) + '; per-output rounding from unrounded values is the declared policy.';
  }

  const output_payload = {
    not_tax_advice: true,
    valid_input: true,
    domain_errors: [],
    refusal_code: null,
    tax_year: v.taxYear,
    filing_status: v.status,
    net_se_profit_input: money(BigInt(v.profit)),
    w2_wages_ss_input: money(BigInt(v.wages)),
    church_employee_income_input: v.churchGiven ? money(BigInt(v.church)) : 0,
    net_earnings: money(divHalfUp(neNum, BigInt(NE_FACTOR_DEN))),
    non_church_net_earnings: money(divHalfUp(ncNENum, BigInt(NE_FACTOR_DEN))),
    church_net_earnings: money(divHalfUp(churchNENum, BigInt(NE_FACTOR_DEN))),
    church_income_included: churchIncluded > 0 ? true : (v.churchGiven && v.church > 0 ? false : null),
    oasdi_taxable_net_earnings: money(divHalfUp(oasdiBaseNum, BigInt(NE_FACTOR_DEN))),
    se_tax_oasdi: money(oasdiCents),
    se_tax_medicare: money(hiCents),
    se_tax_total: money(totalCents),
    additional_medicare: money(addlCents),
    half_se_deduction: money(halfCents),
    additional_medicare_threshold: money(thresholdCents),
    additional_medicare_threshold_reduced: money(reducedCents),
    oasdi_base: money(BigInt(y.oasdi_base_cents)),
    parts_vs_total_rounding_note: partsNote,
    constants_version: String(v.taxYear),
    supported_tax_years: SUPPORTED_TAX_YEARS,
    regulatory_basis: '26 USC 1401(a) 12.4 percent OASDI; 26 USC 1401(b)(1) 2.9 percent HI; 26 USC 1401(b)(2) 0.9 percent Additional Medicare Tax with thresholds 250000 joint, one half of that for married filing separately, 200000 others, reduced by section 3121(b)(2) wages; 26 USC 1402(a)(12) 92.35 percent net-earnings factor; 26 USC 1402(b)(1) OASDI cap coordination against the contribution and benefit base; 26 USC 1402(b)(2) 400 dollar floor; 26 USC 1402(j) church employee income with a 100 dollar net-earnings floor and the 108.28 dollar income floor; 26 USC 164(f)(1) one-half deduction excluding the 1401(b)(2) tax; SSA contribution and benefit base 176100 (2025) and 184500 (2026); IRS Schedule SE (2026) and Form 8959 (2025) instructions; IRS Pub 334 (2025) chapters 1 and 10.',
    scope_note: 'Recompute and cross-check of US federal self-employment tax (Schedule SE regular method), the Additional Medicare Tax on self-employment income, and the one-half SE tax deduction, from values the caller already holds. Federal only; not an official IRS, SSA or Treasury communication; not tax advice; not return preparation. Farm and nonfarm optional methods, RRTA compensation, fiscal years, community property, qualified joint ventures, partnership allocations, nonresident aliens and totalization agreements, and the section 162(l) health-insurance interaction are out of scope and refused or unmodelled rather than approximated.',
    warnings: compliance_flags.slice(),
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  // The object walked below is the exact execution_hash preimage. When the shared
  // canonicalizer would refuse it, mint the artifact with a null execution_hash and
  // the reason beside it instead of letting the hash throw (D6). compute() already
  // refuses the same input, so this is the backstop: buildArtifact never throws.
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'preimage', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 }, []);
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
