import { executionHash } from './_hash.mjs';

/* ============================================================================
 * art-753 — Home Office & Augusta Rule
 * AINumbers / OpenChainGraph node (chaingraph)
 *
 * Port of Apex tool #139 "Home Office & Augusta Rule Calculator"
 *   source: https://apexlogics.org/tools/139-home-office-augusta/
 *   source manifest: AL-146, tool_id 139-home-office-augusta, v1.0.0
 *   fetched: 2026-10-06, HTTP 200, 39,556 bytes (pinned; see CITES.md F1)
 *
 * Reservation: art-753 reserved by APEX-PORT-ARTNUM-ALLOC-1 for Apex #139 (the
 * payload staging number art-721 is VOID; renumbered at land by
 * APEX-PORT-139-LAND-RESUME-1).
 *
 * LAND ADJUDICATION (7F APEX-DIFFER-RULING-1 2026-11-02, confirmed 2026-11-13):
 *   DIFFERS-04: official wins, the simplified method is NOT selectable for an
 *     S-corp owner-employee (Rev. Proc. 2013-13 sec 4.02); fixture b-c10 is
 *     re-pinned to the official figure at the Apex inputs.
 *   DIFFERS-06: the Apex corporate-deduction figure is retained with the declared
 *     deviation flag ART753_CORP_DEDUCTION_BARRED_TEXT_280A_G_1. It is a DISCLOSED
 *     OPEN LEGAL QUESTION (IRC 280A(g)(1)): the tool does not decide it.
 *   DIFFERS-01/02/03/05/07/08 stand as drafted in the payload.
 *
 * The compute core below (between the ART753 COMPUTE CORE markers) is mirrored
 * byte-for-byte in page.draft.html's inline <script>. The port harness
 * (scratch/APEXPORT-139/tmp/opencode/run-apex139.mjs) asserts the two regions
 * are identical and that both produce byte-identical output_payloads for every
 * fixture in fixtures.json.
 *
 * Conventions:
 *   - All money in USD. All rates as fractions (0.37 = 37%).
 *   - Input keys are snake_case; the Apex camelCase names are echoed in the
 *     FIELD_MAP below and in fixtures.json.
 *   - Every comparator and threshold from Apex #139 is a named constant.
 *   - Divergences from Apex are gated by switches (see DIFFERS.md); default
 *     switches pick the official value where the official text and Apex differ.
 * ==========================================================================*/

// ── ART753 COMPUTE CORE BEGIN ──────────────────────────────────────────────
// (mirrored verbatim in page.draft.html — do not edit one without the other)

const ART753_CONSTANTS = {
  // Named thresholds, each grounded in CITES.md:
  SIMPLIFIED_METHOD_RATE_USD_PER_SQFT: 5,
  // Rev. Proc. 2013-13 sec 4.01(3): "The prescribed rate is $5.00."
  SIMPLIFIED_METHOD_MAX_SQFT: 300,
  // Rev. Proc. 2013-13 sec 4.01(2): "not to exceed 300 square feet."
  AUGUSTA_RULE_MAX_RENTAL_DAYS: 14,
  // 26 U.S.C. sec 280A(g): "actually rented for less than 15 days during the taxable year."
  PERCENT_DIVISOR: 100,
  // Apex #139 reads its two rate controls as percentages and divides by 100.
  FALLBACK_CORP_TAX_RATE: 0.37,
  // IR-2025-103 (Oct 9, 2025): TY2026 top individual rate 37% (>$640,600 single).
  FALLBACK_OWNER_MARGINAL_RATE: 0.32,
  // IR-2025-103: TY2026 32% bracket begins at $201,775 single.
  HIGH_BUSINESS_USE_PCT_HEURISTIC: 0.5
  // UNGROUNDED: Apex #139 warns the IRS "scrutinizes home-office deductions
  // above ~50%". No official text fetched this run states a 50% threshold; the
  // operative tests are exclusive regular use and the principal-place-of-business
  // test (26 U.S.C. sec 280A(c)(1)). Kept as a heuristic, flagged, never a rule.
};

const ART753_POLICY = {
  // Port switches — see DIFFERS.md for the official-text basis of each:
  APEX_FAITHFUL_MODE: false,
  // true => revert every gated divergence to Apex #139 behavior (parity mode).
  GROSS_INCOME_CAP_APPLIES_TO_SIMPLIFIED_METHOD: true,
  // DIFFERS-01 — official wins (IRS Topic 509: "Regardless of the method used
  // to compute the deduction, you may not deduct business expenses in excess of
  // the gross income limitation."; Rev. Proc. 2013-13 sec 4.08(2)).
  SIMPLIFIED_METHOD_AVAILABLE_TO_S_CORP_EMPLOYEE: false
  // DIFFERS-04 — official wins (Rev. Proc. 2013-13 sec 4.02: the safe harbor
  // "does not apply to an employee with a home office if the employee receives
  // advances, allowances, or reimbursements … under a reimbursement or other
  // expense allowance arrangement (as defined in sec 1.62-2) with his or her
  // employer.").
};

// Exact allowlist for both entity selectors: the two values Apex #139's controls offer.
const ART753_ENTITY_TYPES = ['soleProp', 'scorp'];
// Caller numerics the core reads. A missing (undefined or null) value takes the documented
// Apex fallback; a present value must already be a JS number. Nothing is coerced.
const ART753_NUMERIC_FIELDS = ['office_sq_ft', 'home_sq_ft', 'business_use_pct', 'annual_rent_usd', 'utilities_usd', 'other_home_expenses_usd', 'gross_business_income_usd', 'rental_days', 'daily_rental_rate_usd', 'corp_tax_rate_pct', 'owner_marginal_rate_pct'];

// Typed input check, run before any arithmetic. Returns [{ code, field, kind }] in a fixed
// field order; the first entry names the refusal_reason.
function art753InputErrors(pp) {
  if (pp === null || typeof pp !== 'object' || Array.isArray(pp)) {
    return [{ code: 'REFUSED_INPUT_NOT_OBJECT', field: '(input)', kind: 'not_an_object' }];
  }
  const errors = [];
  for (const f of ART753_NUMERIC_FIELDS) {
    const v = pp[f];
    if (v !== undefined && v !== null && typeof v !== 'number') {
      errors.push({ code: 'REFUSED_WRONG_TYPE_' + f.toUpperCase(), field: f, kind: 'expected_number_or_absent_got_' + (Array.isArray(v) ? 'array' : typeof v) });
    }
  }
  for (const [f, suffix] of [['entity_type_ho', 'HO'], ['entity_type_aug', 'AUG']]) {
    const v = pp[f];
    if (typeof v !== 'string' || !ART753_ENTITY_TYPES.includes(v)) {
      errors.push({ code: 'REFUSED_ENTITY_TYPE_' + suffix + '_NOT_ALLOWED', field: f, kind: 'expected_one_of_soleProp_scorp_got_' + ((v === null || v === undefined) ? 'absent_or_null' : Array.isArray(v) ? 'array' : typeof v === 'string' ? 'other_string' : typeof v) });
    }
  }
  return errors;
}

// The all-null refusal payload. Entity echoes survive only when they are allowlisted strings.
function art753Refusal(reason, notes, entityTypeHO, entityTypeAug, fallbackFields) {
  const P = ART753_POLICY;
  const capSimplified = P.GROSS_INCOME_CAP_APPLIES_TO_SIMPLIFIED_METHOD && !P.APEX_FAITHFUL_MODE;
  const gateScorpSimplified = !P.SIMPLIFIED_METHOD_AVAILABLE_TO_S_CORP_EMPLOYEE && !P.APEX_FAITHFUL_MODE;
  const echo = (v) => (typeof v === 'string' && ART753_ENTITY_TYPES.includes(v)) ? v : null;
  return {
    refusal_reason: reason,
    office_sq_ft: null, home_sq_ft: null, business_use_fraction: null,
    gross_business_income_usd: null, entity_type_ho: echo(entityTypeHO),
    rental_days: null, daily_rental_rate_usd: null, corp_tax_rate: null,
    owner_marginal_rate: null, entity_type_aug: echo(entityTypeAug),
    total_home_expenses_usd: null,
    regular_deduction_before_gross_income_cap_usd: null,
    regular_deduction_usd: null,
    simplified_deduction_before_gross_income_cap_usd: null,
    simplified_deduction_usd: null,
    simplified_method_selectable: null,
    simplified_wins_on_amounts: null,
    best_home_office_deduction_usd: null,
    best_home_office_method: null,
    gross_income_cap_applied_to: null,
    total_rental_income_usd: null,
    qualifies_280a_g_day_test: null,
    augusta_tax_free_income_usd: null,
    augusta_corp_deduction_usd: null,
    augusta_tax_benefit_usd: null,
    augusta_tax_benefit_at_owner_rate_usd: null,
    home_office_tax_benefit_usd: null,
    combined_tax_benefit_usd: null,
    combined_tax_benefit_at_owner_rate_basis_usd: null,
    switches: {
      apex_faithful_mode: P.APEX_FAITHFUL_MODE,
      gross_income_cap_applies_to_simplified_method: P.GROSS_INCOME_CAP_APPLIES_TO_SIMPLIFIED_METHOD,
      simplified_method_available_to_s_corp_employee: P.SIMPLIFIED_METHOD_AVAILABLE_TO_S_CORP_EMPLOYEE,
      effective_cap_applied: capSimplified,
      effective_gate_applied: gateScorpSimplified
    },
    fallback_fields: fallbackFields,
    compliance_flags: [],
    warnings: [],
    notes: notes
  };
}

function computeCore(pp) {
  const C = ART753_CONSTANTS;
  const P = ART753_POLICY;
  const capSimplified = P.GROSS_INCOME_CAP_APPLIES_TO_SIMPLIFIED_METHOD && !P.APEX_FAITHFUL_MODE;
  const gateScorpSimplified = !P.SIMPLIFIED_METHOD_AVAILABLE_TO_S_CORP_EMPLOYEE && !P.APEX_FAITHFUL_MODE;

  // ── 0. Typed refusal: a wrong type or an unlisted entity is refused, never coerced ──
  const inputErrors = art753InputErrors(pp);
  if (inputErrors.length > 0) {
    const typedNotes = ['Input refused before any arithmetic: ' + inputErrors.map((e) => e.field + ' (' + e.code + ', ' + e.kind + ')').join('; ') + '. Apex #139 fallbacks apply only to a missing (null or undefined) numeric, never to a wrong type; the entity selectors accept exactly "soleProp" or "scorp".'];
    const isObj = inputErrors[0].code !== 'REFUSED_INPUT_NOT_OBJECT';
    const typedRefusal = art753Refusal(inputErrors[0].code, typedNotes, isObj ? pp.entity_type_ho : null, isObj ? pp.entity_type_aug : null, []);
    typedRefusal.compliance_flags.push('ART753_INPUT_REFUSED');
    typedRefusal.warnings.push('ART753_INPUT_REFUSED');
    return typedRefusal;
  }

  // ── 1. Apex #139's reads, including its fallbacks and quirks (typed values only) ──
  // Apex: `+el.value || fallback` — a falsy number (0, -0, NaN) takes the
  // fallback. A 0% rate entry therefore collapses to the default rate (C12/C13).
  const fallbackFields = [];
  const trackFallback = (field, rawInput, fallback) => {
    fallbackFields.push({ field: field, apex_fallback: fallback, raw_input: (rawInput === null || rawInput === undefined) ? '(empty control)' : rawInput });
  };
  const apexNumOr = (v, fb, field) => {
    const n = (v === null || v === undefined) ? 0 : v;
    if (!n) { trackFallback(field, v, fb); return fb; }
    return n;
  };
  // Apex: `+value / 100 || fallback` — the fallback applies to the divided value.
  const apexPctOr = (v, fb, field) => {
    const n = ((v === null || v === undefined) ? 0 : v) / C.PERCENT_DIVISOR;
    if (!n) { trackFallback(field, v, fb); return fb; }
    return n;
  };

  const officeSqFt = apexNumOr(pp.office_sq_ft, 0, 'office_sq_ft');
  const homeSqFt = apexNumOr(pp.home_sq_ft, 1, 'home_sq_ft');
  // Apex: `buPctOverride ? (+buPctOverride / 100) : (officeSqFt / homeSqFt)`.
  // A missing value (null or undefined) auto-derives; a typed number, including 0,
  // is present and overrides (0 overrides to 0%).
  const buPctControl = pp.business_use_pct;
  const buPctAbsent = buPctControl === null || buPctControl === undefined;
  const buPct = buPctAbsent
    ? (officeSqFt / homeSqFt)
    : (buPctControl / C.PERCENT_DIVISOR);
  if (buPctAbsent) {
    fallbackFields.push({ field: 'business_use_pct', apex_fallback: 'auto-derive office_sq_ft / home_sq_ft', raw_input: '(empty control)' });
  }
  const annualRent = apexNumOr(pp.annual_rent_usd, 0, 'annual_rent_usd');
  const utilities = apexNumOr(pp.utilities_usd, 0, 'utilities_usd');
  const otherHomeExp = apexNumOr(pp.other_home_expenses_usd, 0, 'other_home_expenses_usd');
  const grossIncome = apexNumOr(pp.gross_business_income_usd, 0, 'gross_business_income_usd');
  const entityTypeHO = pp.entity_type_ho;
  const rentalDays = apexNumOr(pp.rental_days, 0, 'rental_days');
  const dailyRate = apexNumOr(pp.daily_rental_rate_usd, 0, 'daily_rental_rate_usd');
  const corpTaxRate = apexPctOr(pp.corp_tax_rate_pct, C.FALLBACK_CORP_TAX_RATE, 'corp_tax_rate_pct');
  const ownerMargRate = apexPctOr(pp.owner_marginal_rate_pct, C.FALLBACK_OWNER_MARGINAL_RATE, 'owner_marginal_rate_pct');
  const entityTypeAug = pp.entity_type_aug;

  // ── DIFFERS-07 (port hardening): refuse non-finite inputs ──
  // Apex #139 would propagate NaN/Infinity into every derived figure. All Apex
  // fallbacks run first, so only values that survive them (±Infinity) are
  // refused; no legitimate input is refused.
  const coercedNumerics = [officeSqFt, homeSqFt, buPct, annualRent, utilities, otherHomeExp, grossIncome, rentalDays, dailyRate, corpTaxRate, ownerMargRate];
  if (coercedNumerics.some((n) => !Number.isFinite(n))) {
    const refusalNotes = ['One or more inputs are non-finite after Apex coercion; refused per the I-JSON guard (RFC 8785 §3.2.2.3). Apex #139 would propagate NaN/Infinity into every derived figure (DIFFERS-07).'];
    const nonFiniteRefusal = art753Refusal('REFUSED_NON_FINITE_INPUT', refusalNotes, entityTypeHO, entityTypeAug, fallbackFields);
    nonFiniteRefusal.compliance_flags.push('ART753_INPUT_REFUSED');
    nonFiniteRefusal.warnings.push('ART753_INPUT_REFUSED');
    return nonFiniteRefusal;
  }

  // ── 2. Home office: Apex #139 lines 365–369 (regular vs simplified) ──
  const totalHomeExp = annualRent + utilities + otherHomeExp;
  const regularDeductionBeforeCap = totalHomeExp * buPct;
  const regularDeduction = Math.min(regularDeductionBeforeCap, grossIncome);
  const simplifiedDeductionBeforeCap = Math.min(officeSqFt, C.SIMPLIFIED_METHOD_MAX_SQFT) * C.SIMPLIFIED_METHOD_RATE_USD_PER_SQFT;
  const simplifiedDeduction = capSimplified
    ? Math.min(simplifiedDeductionBeforeCap, grossIncome)
    : simplifiedDeductionBeforeCap;
  // DIFFERS-04: an S-corp owner-employee is reimbursed under an expense
  // allowance arrangement, so the simplified safe harbor does not apply to them;
  // the regular method is the only candidate.
  const simplifiedSelectable = gateScorpSimplified ? (entityTypeHO !== 'scorp') : true;
  const bestHO = simplifiedSelectable ? Math.max(regularDeduction, simplifiedDeduction) : regularDeduction;
  const bestHOMethod = simplifiedSelectable
    ? (regularDeduction >= simplifiedDeduction ? 'Regular' : 'Simplified')
    : 'Regular';

  // ── 3. Augusta Rule: Apex #139 lines 378–390 ──
  const totalRental = rentalDays * dailyRate;
  const qualifies = rentalDays <= C.AUGUSTA_RULE_MAX_RENTAL_DAYS;
  const augTaxFreeIncome = qualifies ? totalRental : 0;
  const augCorpDeduction = entityTypeAug === 'scorp' && qualifies ? totalRental : 0;
  const augTaxBenefit = entityTypeAug === 'scorp' && qualifies ? totalRental * corpTaxRate : 0;
  // DIFFERS-05 (additive): the same deduction at the owner's marginal rate,
  // so both bases are published side by side (neither is dropped).
  const augTaxBenefitAtOwnerRate = entityTypeAug === 'scorp' && qualifies ? totalRental * ownerMargRate : 0;
  const hoBenefit = bestHO * ownerMargRate;
  const totalTaxBenefit = hoBenefit + augTaxBenefit;
  const combinedTaxBenefitAtOwnerRateBasis = hoBenefit + augTaxBenefitAtOwnerRate;

  // ── 4. Compliance flags ──
  const complianceFlags = [];
  if (rentalDays > 0) {
    complianceFlags.push('ART753_280A_G_RESIDENCE_CONDITION_UNTESTED');
    complianceFlags.push('ART753_PLANNED_NOT_ACTUAL_RENTAL_DAYS');
  }
  if (regularDeductionBeforeCap !== 0 || simplifiedDeductionBeforeCap !== 0) complianceFlags.push('ART753_GROSS_INCOME_SCOPE_UNVERIFIED');
  if (otherHomeExp !== 0) complianceFlags.push('ART753_SIMPLIFIED_METHOD_WITH_NON_SCHEDULE_A_EXPENSE_BUCKET');
  if (buPct > C.HIGH_BUSINESS_USE_PCT_HEURISTIC) complianceFlags.push('ART753_HIGH_BUSINESS_USE_HEURISTIC_UNGROUNDED');
  if (gateScorpSimplified && entityTypeHO === 'scorp' && simplifiedDeductionBeforeCap >= regularDeductionBeforeCap) complianceFlags.push('ART753_SIMPLIFIED_AND_REGULAR_DISAGREE_FOR_S_CORP_EMPLOYEE');
  if (entityTypeAug === 'scorp' && qualifies) complianceFlags.push('ART753_CORP_DEDUCTION_BARRED_TEXT_280A_G_1');
  if (!Number.isInteger(rentalDays)) complianceFlags.push('ART753_RENTAL_DAYS_NOT_A_WHOLE_DAY');
  if (fallbackFields.some((f) => f.field === 'corp_tax_rate_pct' || f.field === 'owner_marginal_rate_pct')) complianceFlags.push('ART753_ZERO_RATE_COLLAPSED_TO_DEFAULT');
  if ([officeSqFt, homeSqFt, annualRent, utilities, otherHomeExp, grossIncome, rentalDays, dailyRate].some((n) => n < 0)) complianceFlags.push('ART753_NEGATIVE_INPUT_PUBLISHED');

  // ── 5. Notes (deterministic; byte-identical to page.draft.html) ──
  const notes = [];
  notes.push('§280A(g) has two conditions: the dwelling unit must be "used during the taxable year by the taxpayer as a residence" AND "actually rented for less than 15 days during the taxable year" (26 U.S.C. §280A(g), fetched 2026-10-06). This node tests only the day count — no input records residence status — so qualifies_280a_g_day_test is a day-count test, not a §280A(g) determination.');
  notes.push('rental_days is the count you plan to rent (Apex #139 control label: "Days You Plan to Rent to Business"); §280A(g) tests days "actually rented". A plan is not an actual rental; the statutory test is retrospective and this node reads no calendar.');
  notes.push('gross_business_income_usd is a free-standing whole-business figure. Rev. Proc. 2013-13 §2.06 states the §280A(c)(5) limitation as "the gross income derived from that use for the taxable year reduced by (1) the deductions allocable to the use that are allowable for the taxable year whether or not the unit is used as described in §280A(c)(1) through (4) … and (2) the allowable trade or business expenses that are not allocable to the use of the dwelling unit"; §4.08(2) restates it for the safe harbor. No Form 8829 mechanic is modelled, so the cap\'s scope is unverified.');
  if (entityTypeHO === 'scorp') notes.push('entity_type_ho=scorp: an S-corp owner-employee\'s home-office deduction runs through an accountable plan (26 U.S.C. §62(a)(2)(A)); Rev. Proc. 2013-13 §4.02 withholds the safe-harbor method from "an employee with a home office if the employee receives advances, allowances, or reimbursements for expenses related to the qualified business use of the employee\'s home under a reimbursement or other expense allowance arrangement (as defined in §1.62-2) with his or her employer". The simplified method is therefore computed but not selectable here, and the regular method is the only candidate (DIFFERS-04).');
  if (entityTypeAug === 'scorp' && qualifies) notes.push('entity_type_aug=scorp with rental_days<=14: the owner excludes the rental income under §280A(g)(2) and the corporation books the rent deduction. CAUTION: §280A(g)(1) says "no deduction otherwise allowable under this chapter because of the rental use of such dwelling unit shall be allowed" — on its face that bars this very deduction; practitioners split on whether the S-corp deduction survives. The figure is retained from Apex #139 and flagged, not endorsed (DIFFERS-06; OPEN QUESTION 1 in APEXPORT-139-REPORT.md).');
  if (entityTypeAug === 'scorp' && !qualifies) notes.push('rental_days>14: the §280A(g) exclusion is lost — all rental income is taxable (26 U.S.C. §280A(g)); the S-corp deduction for the rental use is also lost.');
  if (entityTypeAug === 'soleProp') notes.push('entity_type_aug=soleProp: renting your own home to yourself has no separate entity to pay or deduct the rent; only the §280A(g)(2) income exclusion (when qualifying) is at stake.');
  if (buPct > C.HIGH_BUSINESS_USE_PCT_HEURISTIC) notes.push('business-use fraction above 50%: Apex #139 warns that the IRS scrutinizes home-office deductions above ~50%; no official text fetched this run states a 50% threshold (UNGROUNDED) — the operative tests are exclusive regular use and the principal-place-of-business test (26 U.S.C. §280A(c)(1)).');
  if (otherHomeExp !== 0) notes.push('other_home_expenses_usd is a single bucket whose Apex #139 hint lists "Insurance, repairs, depreciation (optional)"; a taxpayer using the safe harbor method "cannot deduct any depreciation (including any additional first-year depreciation) or §179 expense for the portion of the home that is used in a qualified business use" (Rev. Proc. 2013-13 §4.06), so a depreciation-bearing bucket distorts the regular-vs-simplified comparison.');
  if (capSimplified && simplifiedDeductionBeforeCap > grossIncome) notes.push('gross-income cap applied to the simplified method (DIFFERS-01): IRS Topic 509 — "Regardless of the method used to compute the deduction, you may not deduct business expenses in excess of the gross income limitation."');
  if (fallbackFields.some((f) => f.field === 'corp_tax_rate_pct' || f.field === 'owner_marginal_rate_pct')) notes.push('a 0% rate entry collapsed to the Apex #139 default (corp 37% / owner 32%): the (+value/100)||default idiom treats 0 as falsy, so an explicit 0% cannot be expressed (comparators C12/C13).');
  if (!Number.isInteger(rentalDays)) notes.push('rental_days is fractional; §280A(g) speaks in days and Apex #139 has no integrality test (no rounding rule is invented here — UNGROUNDED either way).');
  if ([officeSqFt, homeSqFt, annualRent, utilities, otherHomeExp, grossIncome, rentalDays, dailyRate].some((n) => n < 0)) notes.push('negative input(s) passed through unclamped: Apex #139 has no lower-bound comparator (REPORT ITEM — no official value to pick); the published best method is negative.');

  // ── 6. Output payload ──
  return {
    refusal_reason: null,
    // input echoes (post-coercion, as Apex's _lastResult carries them):
    office_sq_ft: officeSqFt,
    home_sq_ft: homeSqFt,
    business_use_fraction: buPct,
    gross_business_income_usd: grossIncome,
    entity_type_ho: entityTypeHO === undefined ? null : entityTypeHO,
    rental_days: rentalDays,
    daily_rental_rate_usd: dailyRate,
    corp_tax_rate: corpTaxRate,
    owner_marginal_rate: ownerMargRate,
    entity_type_aug: entityTypeAug === undefined ? null : entityTypeAug,
    // home office:
    total_home_expenses_usd: totalHomeExp,
    regular_deduction_before_gross_income_cap_usd: regularDeductionBeforeCap,
    regular_deduction_usd: regularDeduction,
    simplified_deduction_before_gross_income_cap_usd: simplifiedDeductionBeforeCap,
    simplified_deduction_usd: simplifiedDeduction,
    simplified_method_selectable: simplifiedSelectable,
    simplified_wins_on_amounts: simplifiedDeductionBeforeCap >= regularDeductionBeforeCap,
    best_home_office_deduction_usd: bestHO,
    best_home_office_method: bestHOMethod,
    gross_income_cap_applied_to: capSimplified ? 'both' : 'regular',
    // augusta rule:
    total_rental_income_usd: totalRental,
    qualifies_280a_g_day_test: qualifies,
    augusta_tax_free_income_usd: augTaxFreeIncome,
    augusta_corp_deduction_usd: augCorpDeduction,
    augusta_tax_benefit_usd: augTaxBenefit,
    augusta_tax_benefit_at_owner_rate_usd: augTaxBenefitAtOwnerRate,
    // benefits:
    home_office_tax_benefit_usd: hoBenefit,
    combined_tax_benefit_usd: totalTaxBenefit,
    combined_tax_benefit_at_owner_rate_basis_usd: combinedTaxBenefitAtOwnerRateBasis,
    // provenance:
    switches: {
      apex_faithful_mode: P.APEX_FAITHFUL_MODE,
      gross_income_cap_applies_to_simplified_method: P.GROSS_INCOME_CAP_APPLIES_TO_SIMPLIFIED_METHOD,
      simplified_method_available_to_s_corp_employee: P.SIMPLIFIED_METHOD_AVAILABLE_TO_S_CORP_EMPLOYEE,
      effective_cap_applied: capSimplified,
      effective_gate_applied: gateScorpSimplified
    },
    fallback_fields: fallbackFields,
    compliance_flags: complianceFlags,
    warnings: complianceFlags.slice(),
    notes: notes
  };
}
// ── ART753 COMPUTE CORE END ────────────────────────────────────────────────

// ── hashability walk (D6) ────────────────────────────────────────────────────────
// Mirrors the classes _hash.mjs assertIJson() refuses before it canonicalizes: a non-finite
// number, an integer outside the 2^53 safe range, nesting past MAX_DEPTH, more values than
// MAX_ELEMENTS. A BigInt is refused too, because JSON.stringify throws on one. Reports
// { reason, detail } with the path and kind only, never the value; null when the subtree is
// safe to hash. The shared _hash.mjs stays untouched. Mirrored verbatim in the page.
const HASH_MAX_DEPTH = 512;        // _hash.mjs MAX_DEPTH
const HASH_MAX_ELEMENTS = 1000000; // _hash.mjs MAX_ELEMENTS

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'bigint') return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': bigint' };
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

const TOOL_ID = 'art-753-home-office-augusta';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'calculate_home_office_augusta',
  mandate_type: 'home_office_augusta_record',
  gpu: false,
};

export { ART753_CONSTANTS, ART753_POLICY };

// compute() wraps the verbatim core: the artifact carries the flags beside the payload.
export function compute(pp) {
  const output_payload = computeCore(pp);
  return { output_payload, compliance_flags: output_payload.compliance_flags.slice() };
}

// `now` is passed in, never read from a clock. execution_hash comes from _hash.mjs.
// buildArtifact never throws on any input: the object walked below is the exact execution_hash
// preimage, and when the shared canonicalizer would refuse it the artifact is minted with a
// null execution_hash and a hash_refusal beside it.
export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
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
