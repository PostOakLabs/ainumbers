// art-615-mla-charge-inclusion-classifier — class-A EXHAUSTIVE ENUMERATION harness (MLA-MAPR-K-1).
// kernel_digest_at_authoring: sha256:89816e3e50a57991a0dc1ef768b3915ef88e0fad54e72319fdd72363c04680af
// spec: research/MLA-MAPR-CLASSIFIER.spec.md
// human_sign_off: PENDING
//
// FORMALVERIF-BUILD-SPEC.md §6.A shape, NOT the class-B property template: a loop over the FULL
// declared input domain, every input computed and checked against the spec's postconditions and
// invariants, pass/fail recorded per state, never sampled.
//
// Declared domain: 9 charge_type values x 2 is_credit_card_account x 2 short_term_exception_claimed
// = 36 states, all enumerated. The 9 values are the node's PUBLISHED input schema, confirmed against
// chaingraph/art-615-mla-charge-inclusion-classifier.html#manifest per §6.A's totality caveat, not
// merely what compute() destructures.
//
// float_sensitive: no. rounding_steps: []. This kernel performs no arithmetic, so there is no
// threshold-exact value, no ULP boundary and no denormal to force — the §6.A float caveat does not
// engage here, and that is an explicit claim rather than an omission.
//
// ZERO external dependencies — Node built-ins only. READ-ONLY with respect to the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-615-mla-charge-inclusion-classifier.proptest.mjs

import { compute } from '../art-615-mla-charge-inclusion-classifier.kernel.mjs';
import { runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-615-mla-charge-inclusion-classifier';

// The DECLARED domain, stated here as the spec states it.
const CHARGE_TYPES = [
  'credit_insurance_premium',
  'single_premium_credit_insurance_charge',
  'debt_cancellation_fee',
  'debt_suspension_fee',
  'credit_related_ancillary_product_fee',
  'finance_charge',
  'application_fee',
  'participation_fee',
  'other_credit_card_fee',
];
const BOOLS = [false, true];
const DOMAIN_CARDINALITY = CHARGE_TYPES.length * BOOLS.length * BOOLS.length; // 36

// Spec GROUPS 1-6, re-implemented from research/MLA-MAPR-CLASSIFIER.spec.md postconditions.
const GROUP_1 = [
  'credit_insurance_premium',
  'single_premium_credit_insurance_charge',
  'debt_cancellation_fee',
  'debt_suspension_fee',
];
const CARVE_BACK = GROUP_1.concat(['credit_related_ancillary_product_fee']); // (d)(2)(i)-(ii)

function specExpect(charge_type, cc, ste) {
  if (GROUP_1.includes(charge_type)) {
    return { included_in_mapr: true, citation: '32 CFR 232.4(c)(1)(i)', conditional_limit_usd: null, manual_review_required: false };
  }
  if (charge_type === 'credit_related_ancillary_product_fee') {
    return { included_in_mapr: true, citation: '32 CFR 232.4(c)(1)(ii)', conditional_limit_usd: null, manual_review_required: false };
  }
  if (charge_type === 'finance_charge') {
    return { included_in_mapr: true, citation: '32 CFR 232.4(c)(1)(iii)(A)', conditional_limit_usd: null, manual_review_required: false };
  }
  if (charge_type === 'application_fee') {
    return ste
      ? { included_in_mapr: 'conditional', citation: '32 CFR 232.4(c)(1)(iii)(B)', conditional_limit_usd: null, manual_review_required: true }
      : { included_in_mapr: true, citation: '32 CFR 232.4(c)(1)(iii)(B)', conditional_limit_usd: null, manual_review_required: false };
  }
  if (charge_type === 'participation_fee') {
    return cc
      ? { included_in_mapr: 'conditional', citation: '32 CFR 232.4(c)(1)(iii)(C); 232.4(c)(2)(ii)(B); 232.4(d)(1)', conditional_limit_usd: 100, manual_review_required: false }
      : { included_in_mapr: true, citation: '32 CFR 232.4(c)(1)(iii)(C)', conditional_limit_usd: null, manual_review_required: false };
  }
  if (charge_type === 'other_credit_card_fee') {
    return cc
      ? { included_in_mapr: 'conditional', citation: '32 CFR 232.4(d)(1); 232.4(d)(3)', conditional_limit_usd: null, manual_review_required: false }
      : { included_in_mapr: false, citation: '32 CFR 232.4(c)(1)', conditional_limit_usd: null, manual_review_required: false };
  }
  throw new Error('charge_type outside the declared domain: ' + String(charge_type));
}

// Enumerate once; every property below reads this same total sweep.
const SWEEP = [];
for (const charge_type of CHARGE_TYPES) {
  for (const is_credit_card_account of BOOLS) {
    for (const short_term_exception_claimed of BOOLS) {
      const pp = { charge_type, is_credit_card_account, short_term_exception_claimed };
      let result = null, threw = null;
      try {
        result = compute(pp);
      } catch (e) {
        threw = e;
      }
      SWEEP.push({ pp, result, threw });
    }
  }
}

// E1: TOTALITY — every one of the 36 declared triples produces a defined, non-throwing result.
function checkE1_totality() {
  let violations = 0;
  if (SWEEP.length !== DOMAIN_CARDINALITY) violations++;
  for (const s of SWEEP) {
    if (s.threw) { violations++; continue; }
    if (!s.result || !s.result.output_payload) { violations++; continue; }
    if (s.result.output_payload.included_in_mapr === null) violations++;
  }
  return { name: `E1_totality_all_${DOMAIN_CARDINALITY}_states_defined`, checked: SWEEP.length, violations };
}

// E2: POSTCONDITION AGREEMENT — every state matches the spec's GROUP 1-6 postconditions exactly.
function checkE2_postconditions() {
  let violations = 0, checked = 0;
  for (const s of SWEEP) {
    if (s.threw) { violations++; continue; }
    const o = s.result.output_payload;
    const e = specExpect(s.pp.charge_type, s.pp.is_credit_card_account, s.pp.short_term_exception_claimed);
    checked++;
    if (o.included_in_mapr !== e.included_in_mapr) violations++;
    if (o.citation !== e.citation) violations++;
    if (o.conditional_limit_usd !== e.conditional_limit_usd) violations++;
    if (o.manual_review_required !== e.manual_review_required) violations++;
    // inputs echoed, never transformed
    if (o.charge_type !== s.pp.charge_type) violations++;
    if (o.is_credit_card_account !== s.pp.is_credit_card_account) violations++;
    if (o.short_term_exception_claimed !== s.pp.short_term_exception_claimed) violations++;
    // basis is one non-empty plain sentence on every cell
    if (typeof o.basis !== 'string' || o.basis.length === 0) violations++;
    // manual_review_reason is a non-empty string exactly when the flag is set, null otherwise
    if (o.manual_review_required) {
      if (typeof o.manual_review_reason !== 'string' || o.manual_review_reason.length === 0) violations++;
    } else if (o.manual_review_reason !== null) violations++;
  }
  return { name: 'E2_postcondition_agreement_per_state', checked, violations };
}

// E3: the single-cell-group discipline — manual_review_required fires ONLY on
// (application_fee, *, short_term_exception_claimed=true), and conditional_limit_usd is 100 ONLY on
// (participation_fee, is_credit_card_account=true, *). Two cells each, 34 clean.
function checkE3_singleCellGroups() {
  let violations = 0;
  const review = SWEEP.filter((s) => s.result && s.result.output_payload.manual_review_required === true);
  const limit = SWEEP.filter((s) => s.result && s.result.output_payload.conditional_limit_usd === 100);
  if (review.length !== 2) violations++;
  for (const s of review) {
    if (s.pp.charge_type !== 'application_fee') violations++;
    if (s.pp.short_term_exception_claimed !== true) violations++;
  }
  if (limit.length !== 2) violations++;
  for (const s of limit) {
    if (s.pp.charge_type !== 'participation_fee') violations++;
    if (s.pp.is_credit_card_account !== true) violations++;
  }
  return { name: 'E3_manual_review_and_limit_confined_to_named_cells', checked: SWEEP.length, violations };
}

// E4: INERTNESS invariants — short_term_exception_claimed is a no-op for the 8 non-application_fee
// charge types, and is_credit_card_account is a no-op for GROUPS 1-4 (the 7 charge types whose
// clause treatment does not turn on paragraph (d)).
function checkE4_inertness() {
  let violations = 0, checked = 0;
  const at = (ct, cc, ste) =>
    SWEEP.find((s) => s.pp.charge_type === ct && s.pp.is_credit_card_account === cc && s.pp.short_term_exception_claimed === ste);
  for (const ct of CHARGE_TYPES) {
    for (const cc of BOOLS) {
      if (ct !== 'application_fee') {
        checked++;
        const a = at(ct, cc, false), b = at(ct, cc, true);
        if (JSON.stringify(a.result.output_payload) !== JSON.stringify({ ...b.result.output_payload, short_term_exception_claimed: false })) violations++;
      }
    }
    if (ct !== 'participation_fee' && ct !== 'other_credit_card_fee') {
      for (const ste of BOOLS) {
        checked++;
        const a = at(ct, false, ste), b = at(ct, true, ste);
        if (JSON.stringify(a.result.output_payload) !== JSON.stringify({ ...b.result.output_payload, is_credit_card_account: false })) violations++;
      }
    }
  }
  return { name: 'E4_inertness_of_no_op_inputs', checked, violations };
}

// E5: the (d)(2) carve-back is never overridden — the five charge types named in (c)(1)(i) and
// (c)(1)(ii) return included_in_mapr true on all four boolean combinations, and carry the
// MLA_BONA_FIDE_EXCLUSION_INAPPLICABLE flag.
function checkE5_carveBackNeverOverridden() {
  let violations = 0, checked = 0;
  for (const s of SWEEP) {
    if (!CARVE_BACK.includes(s.pp.charge_type)) continue;
    checked++;
    if (s.result.output_payload.included_in_mapr !== true) violations++;
    if (!s.result.compliance_flags.includes('MLA_BONA_FIDE_EXCLUSION_INAPPLICABLE')) violations++;
  }
  return { name: 'E5_d2_carve_back_never_overridden', checked, violations };
}

// E6: compliance_flags shape — MLA_CHARGE_CLASSIFIED always present, exactly one of
// INCLUDED/EXCLUDED/CONDITIONAL, MANUAL_REVIEW_REQUIRED iff the flag is set, no unknown values.
function checkE6_complianceFlags() {
  let violations = 0, checked = 0;
  const KNOWN = new Set([
    'MLA_CHARGE_CLASSIFIED', 'MLA_CHARGE_INCLUDED', 'MLA_CHARGE_EXCLUDED', 'MLA_CHARGE_CONDITIONAL',
    'MLA_BONA_FIDE_EXCLUSION_INAPPLICABLE', 'MLA_MANUAL_REVIEW_REQUIRED',
  ]);
  for (const s of SWEEP) {
    const f = s.result.compliance_flags;
    checked++;
    if (!Array.isArray(f)) { violations++; continue; }
    if (!f.includes('MLA_CHARGE_CLASSIFIED')) violations++;
    const verdicts = f.filter((x) => x === 'MLA_CHARGE_INCLUDED' || x === 'MLA_CHARGE_EXCLUDED' || x === 'MLA_CHARGE_CONDITIONAL');
    if (verdicts.length !== 1) violations++;
    const hasReview = f.includes('MLA_MANUAL_REVIEW_REQUIRED');
    if (hasReview !== s.result.output_payload.manual_review_required) violations++;
    for (const x of f) if (!KNOWN.has(x)) violations++;
  }
  return { name: 'E6_compliance_flags_shape', checked, violations };
}

// E7: EXCLUSIVITY — manual_review_required true implies included_in_mapr === 'conditional'.
// The converse deliberately does not hold (GROUPS 5b and 6a are conditional without manual review).
function checkE7_reviewImpliesConditional() {
  let violations = 0, checked = 0;
  for (const s of SWEEP) {
    checked++;
    const o = s.result.output_payload;
    if (o.manual_review_required && o.included_in_mapr !== 'conditional') violations++;
  }
  return { name: 'E7_manual_review_implies_conditional', checked, violations };
}

// E8: NO ARITHMETIC / output shape — no NaN, no undefined, no Infinity anywhere in the payload, and
// conditional_limit_usd is only ever the literal 100 or null (never a computed value).
function checkE8_noArithmeticOutputShape() {
  let violations = 0, checked = 0;
  for (const s of SWEEP) {
    checked++;
    const o = s.result.output_payload;
    if (findShapeViolations(o).length) violations++;
    if (!(o.conditional_limit_usd === null || o.conditional_limit_usd === 100)) violations++;
    if (typeof o.included_in_mapr !== 'boolean' && o.included_in_mapr !== 'conditional') violations++;
  }
  return { name: 'E8_no_nan_undefined_and_literal_limit_only', checked, violations };
}

// E9: DETERMINISM — recomputing every state yields a byte-identical payload.
function checkE9_determinism() {
  let violations = 0, checked = 0;
  for (const s of SWEEP) {
    checked++;
    const again = compute({ ...s.pp });
    if (JSON.stringify(again) !== JSON.stringify(s.result)) violations++;
  }
  return { name: 'E9_determinism_on_recompute', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkE1_totality(),
  checkE2_postconditions(),
  checkE3_singleCellGroups(),
  checkE4_inertness(),
  checkE5_carveBackNeverOverridden(),
  checkE6_complianceFlags(),
  checkE7_reviewImpliesConditional(),
  checkE8_noArithmeticOutputShape(),
  checkE9_determinism(),
];
console.log(`[${KERNEL_ID}] class-A exhaustive enumeration: domain_cardinality=${DOMAIN_CARDINALITY}, states enumerated=${SWEEP.length}`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
