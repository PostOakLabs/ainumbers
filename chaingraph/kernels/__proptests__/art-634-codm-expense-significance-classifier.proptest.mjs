// art-634-codm-expense-significance-classifier — class-A EXHAUSTIVE ENUMERATION harness (DISE-SEG-K-2).
// kernel_digest_at_authoring: sha256:ba852e7332b2eb306965c24556629e1120bcfa2adb18d491c6832fc1423640f6
// spec: research/DISE-SEG-K-2.spec.md
// human_sign_off: PENDING
//
// FORMALVERIF-BUILD-SPEC.md §6.A shape, NOT the class-B property template: a loop over the FULL
// declared input domain, every state computed and checked against the spec's postconditions,
// pass/fail recorded per state, never sampled.
//
// DECLARED DOMAIN: 4 booleans x 10 specified_item_50_22 values = 160 states, all enumerated.
// The 10 comes from ASC 280-10-50-22's own subparagraphs (a) through (j) with (i) SUPERSEDED by
// ASU 2015-01, leaving 9 live members, plus 'none'. It is NOT the 7-category placeholder in
// DISE-SEG-BUILD-SPEC.md §3.2: ASU 2023-07 closes no expense-category NAME list at all (see the
// spec file §2), so a 7 x 2 x 2 x 2 = 56 enumeration would have proven a domain the Update does
// not define.
//
// POSTCONDITIONS BELOW ARE STATED AS BICONDITIONALS OVER THE INPUTS, deliberately in a different
// form from the kernel's procedural branches, so agreement is evidence rather than an echo
// (STANDING-ORDERS #34).
//
// float_sensitive: no. rounding_steps: []. This kernel performs no arithmetic, so there is no
// threshold-exact value, no ULP boundary and no denormal to force. Explicit claim, not an omission.
//
// ZERO external dependencies — Node built-ins only. READ-ONLY with respect to the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-634-codm-expense-significance-classifier.proptest.mjs

import { compute } from '../art-634-codm-expense-significance-classifier.kernel.mjs';
import { runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-634-codm-expense-significance-classifier';

// The DECLARED domain, stated here as the spec states it.
const SPECIFIED_ITEMS = [
  'none',
  'revenues_from_external_customers',              // ASC 280-10-50-22(a)
  'intersegment_revenues',                         // (b)
  'interest_revenue',                              // (c)
  'interest_expense',                              // (d)
  'depreciation_depletion_amortization',           // (e)
  'unusual_items',                                 // (f)
  'equity_in_net_income_of_equity_method_investees',// (g)
  'income_tax_expense_or_benefit',                 // (h)
  'significant_noncash_items_other_than_dda',      // (j) — (i) is superseded and deliberately absent
];
const BOOLS = [false, true];
const DOMAIN_CARDINALITY = BOOLS.length ** 4 * SPECIFIED_ITEMS.length; // 16 * 10 = 160

const BUCKET_A = 'ASC 280-10-50-26B(a)';
const BUCKET_B = 'ASC 280-10-50-26B(b)';
const BUCKET_D = 'ASC 280-10-50-26B(d)';

// Enumerate once; every property below reads this same total sweep.
const SWEEP = [];
for (const included_in_segment_profit_measure of BOOLS) {
  for (const regularly_provided_to_codm of BOOLS) {
    for (const easily_computable_from_codm_information of BOOLS) {
      for (const assessed_significant of BOOLS) {
        for (const specified_item_50_22 of SPECIFIED_ITEMS) {
          const pp = {
            included_in_segment_profit_measure,
            regularly_provided_to_codm,
            easily_computable_from_codm_information,
            assessed_significant,
            specified_item_50_22,
          };
          let result = null, threw = null;
          try { result = compute(pp); } catch (e) { threw = e; }
          SWEEP.push({ pp, result, threw });
        }
      }
    }
  }
}

// Shorthand for the five input propositions.
const P = (s) => ({
  m: s.pp.included_in_segment_profit_measure,
  r: s.pp.regularly_provided_to_codm,
  e: s.pp.easily_computable_from_codm_information,
  g: s.pp.assessed_significant,
  is22: s.pp.specified_item_50_22 !== 'none',
});

// E1: TOTALITY — all 160 declared states produce a defined, non-throwing result.
function checkE1_totality() {
  let violations = 0;
  if (SWEEP.length !== DOMAIN_CARDINALITY) violations++;
  for (const s of SWEEP) {
    if (s.threw) { violations++; continue; }
    const o = s.result && s.result.output_payload;
    if (!o) { violations++; continue; }
    for (const k of [
      'must_disclose_separately_50_26A', 'folds_into_other_segment_items_50_26B',
      'outside_significant_expense_principle', 'separate_disclosure_required_50_22',
      'other_segment_items_buckets', 'citation', 'basis',
    ]) if (o[k] === undefined) violations++;
  }
  return { name: `E1_totality_all_${DOMAIN_CARDINALITY}_states_defined`, checked: SWEEP.length, violations };
}

// E2: POSTCONDITION AGREEMENT — the spec's biconditionals, per state.
//   must    <=> m AND (r OR e) AND g          [ASC 280-10-50-26A, second limb via 55-15A/15B]
//   outside <=> NOT m                          [nothing inside the measure is excluded entirely]
//   folds   <=> m AND NOT must                 [50-26B is a reconciling residual]
//   50_22   <=> is22 AND (m OR r)              [50-22 reaches further than 50-26A]
function checkE2_postconditions() {
  let violations = 0, checked = 0;
  for (const s of SWEEP) {
    if (s.threw) { violations++; continue; }
    const o = s.result.output_payload, { m, r, e, g, is22 } = P(s);
    checked++;
    const must = m && (r || e) && g;
    if (o.must_disclose_separately_50_26A !== must) violations++;
    if (o.outside_significant_expense_principle !== !m) violations++;
    if (o.folds_into_other_segment_items_50_26B !== (m && !must)) violations++;
    if (o.separate_disclosure_required_50_22 !== (is22 && (m || r))) violations++;
    if (o.evaluated_under_50_26A !== (m && (r || e))) violations++;
    if (typeof o.basis !== 'string' || o.basis.length === 0) violations++;
    if (typeof o.citation !== 'string' || !o.citation.includes('ASC 280-10-50-26A')) violations++;
  }
  return { name: 'E2_postcondition_biconditionals_per_state', checked, violations };
}

// E3: MUTUAL EXCLUSIVITY — exactly one of the three dispositions is true in every state.
function checkE3_exactlyOneDisposition() {
  let violations = 0, checked = 0;
  for (const s of SWEEP) {
    const o = s.result.output_payload;
    checked++;
    const n = [o.must_disclose_separately_50_26A, o.folds_into_other_segment_items_50_26B,
      o.outside_significant_expense_principle].filter(Boolean).length;
    if (n !== 1) violations++;
  }
  return { name: 'E3_exactly_one_disposition_per_state', checked, violations };
}

// E4: BUCKET MEMBERSHIP — 50-26B's buckets are NOT a partition; each has its own biconditional,
// and (c) is never returned because it covers gains/losses, not expense categories.
function checkE4_bucketMembership() {
  let violations = 0, checked = 0;
  for (const s of SWEEP) {
    const o = s.result.output_payload, { m, r, e, g, is22 } = P(s);
    checked++;
    const b = o.other_segment_items_buckets;
    if (!Array.isArray(b)) { violations++; continue; }
    const must = m && (r || e) && g;
    const folds = m && !must;
    if (b.includes(BUCKET_A) !== (folds && !r)) violations++;
    if (b.includes(BUCKET_B) !== folds) violations++;
    if (b.includes(BUCKET_D) !== (folds && is22)) violations++;
    if (b.some((x) => x.includes('26B(c)'))) violations++;
    if (!folds && b.length !== 0) violations++;
    if (new Set(b).size !== b.length) violations++;
  }
  return { name: 'E4_bucket_membership_and_c_never_returned', checked, violations };
}

// E5: NOTHING INSIDE THE MEASURE IS EXCLUDED ENTIRELY — the row's design aid proposed an
// `excluded_entirely` output for the not-provided-to-CODM case. 50-26B(a) puts exactly that case
// into other segment items, so this asserts the corrected reading over the whole sweep.
function checkE5_nothingInsideMeasureExcluded() {
  let violations = 0, checked = 0;
  for (const s of SWEEP) {
    const o = s.result.output_payload, { m } = P(s);
    if (!m) continue;
    checked++;
    if (o.outside_significant_expense_principle) violations++;
    if (!(o.must_disclose_separately_50_26A || o.folds_into_other_segment_items_50_26B)) violations++;
  }
  return { name: 'E5_nothing_inside_reported_measure_is_excluded_entirely', checked, violations };
}

// E6: THE 50-22 ROUTE IS STRICTLY BROADER — there exist states OUTSIDE the significant expense
// principle that still require separate 50-22 disclosure. Asserts the set is non-empty (the
// asymmetry only retrieval settles) and that every member has the expected shape.
function checkE6_5022StrictlyBroader() {
  let violations = 0;
  const outsideButRequired = SWEEP.filter((s) =>
    s.result.output_payload.outside_significant_expense_principle &&
    s.result.output_payload.separate_disclosure_required_50_22);
  if (outsideButRequired.length === 0) violations++;
  for (const s of outsideButRequired) {
    const { m, r, is22 } = P(s);
    if (m) violations++;
    if (!r) violations++;
    if (!is22) violations++;
  }
  return { name: 'E6_50_22_reaches_beyond_the_significant_expense_principle', checked: outsideButRequired.length, violations };
}

// E7: COMPLIANCE FLAGS — exactly one disposition flag, known values only, flags track the payload.
function checkE7_complianceFlags() {
  let violations = 0, checked = 0;
  const KNOWN = new Set([
    'SEG_EXPENSE_CLASSIFIED', 'SEG_EXPENSE_DISCLOSE_SEPARATELY', 'SEG_EXPENSE_OTHER_SEGMENT_ITEMS',
    'SEG_EXPENSE_OUTSIDE_SIGNIFICANT_EXPENSE_PRINCIPLE', 'SEG_EXPENSE_EASILY_COMPUTABLE_ROUTE',
    'SEG_EXPENSE_50_22_SEPARATE_DISCLOSURE_REQUIRED',
    'SEG_EXPENSE_INTEREST_EXPENSE_50_24_INTERACTION', 'SEG_EXPENSE_INPUT_OUTSIDE_DECLARED_DOMAIN',
  ]);
  for (const s of SWEEP) {
    const f = s.result.compliance_flags, o = s.result.output_payload;
    checked++;
    if (!Array.isArray(f)) { violations++; continue; }
    if (!f.includes('SEG_EXPENSE_CLASSIFIED')) violations++;
    const verdicts = f.filter((x) => x === 'SEG_EXPENSE_DISCLOSE_SEPARATELY' ||
      x === 'SEG_EXPENSE_OTHER_SEGMENT_ITEMS' || x === 'SEG_EXPENSE_OUTSIDE_SIGNIFICANT_EXPENSE_PRINCIPLE');
    if (verdicts.length !== 1) violations++;
    if (f.includes('SEG_EXPENSE_50_22_SEPARATE_DISCLOSURE_REQUIRED') !== o.separate_disclosure_required_50_22) violations++;
    if (f.includes('SEG_EXPENSE_INTEREST_EXPENSE_50_24_INTERACTION') !== (s.pp.specified_item_50_22 === 'interest_expense')) violations++;
    // no state in the DECLARED domain is out of domain
    if (f.includes('SEG_EXPENSE_INPUT_OUTSIDE_DECLARED_DOMAIN')) violations++;
    for (const x of f) if (!KNOWN.has(x)) violations++;
  }
  return { name: 'E7_compliance_flags_shape', checked, violations };
}

// E8: NO ARITHMETIC / OUTPUT SHAPE — no NaN, undefined or Infinity anywhere; inputs echoed intact.
function checkE8_shapeAndEcho() {
  let violations = 0, checked = 0;
  for (const s of SWEEP) {
    const o = s.result.output_payload;
    checked++;
    if (findShapeViolations(o).length) violations++;
    if (o.included_in_segment_profit_measure !== s.pp.included_in_segment_profit_measure) violations++;
    if (o.regularly_provided_to_codm !== s.pp.regularly_provided_to_codm) violations++;
    if (o.easily_computable_from_codm_information !== s.pp.easily_computable_from_codm_information) violations++;
    if (o.assessed_significant !== s.pp.assessed_significant) violations++;
    if (o.specified_item_50_22 !== s.pp.specified_item_50_22) violations++;
    for (const v of Object.values(o)) if (typeof v === 'number') violations++; // no numeric output at all
  }
  return { name: 'E8_output_shape_no_numbers_inputs_echoed', checked, violations };
}

// E9: DETERMINISM — recomputing every state yields a byte-identical result.
function checkE9_determinism() {
  let violations = 0, checked = 0;
  for (const s of SWEEP) {
    checked++;
    if (JSON.stringify(compute({ ...s.pp })) !== JSON.stringify(s.result)) violations++;
  }
  return { name: 'E9_determinism_on_recompute', checked, violations };
}

// E10: THE SUPERSEDED SUBPARAGRAPH IS ABSENT — 50-22 runs (a) through (j) but (i) was superseded by
// ASU 2015-01, so the live count is 9 and the enum is 10 with 'none'. Guards the exact miscount a
// naive reading of "(a) through (j)" produces, and pins DOMAIN_CARDINALITY to 160 rather than 56.
function checkE10_enumCardinality() {
  let violations = 0;
  if (SPECIFIED_ITEMS.length !== 10) violations++;
  if (SPECIFIED_ITEMS.filter((x) => x !== 'none').length !== 9) violations++;
  if (new Set(SPECIFIED_ITEMS).size !== SPECIFIED_ITEMS.length) violations++;
  if (DOMAIN_CARDINALITY !== 160) violations++;
  if (SWEEP.length !== 160) violations++;
  for (const item of SPECIFIED_ITEMS) {
    if (SWEEP.filter((s) => s.pp.specified_item_50_22 === item).length !== 16) violations++;
  }
  return { name: 'E10_declared_enum_is_9_live_items_plus_none_domain_160', checked: SPECIFIED_ITEMS.length, violations };
}

// ---------- NEGATIVE CONTROLS: prove the properties have teeth ----------
// Each states a WRONG reading of the clause and asserts the sweep DISCRIMINATES it. If a negative
// control ever stops firing, the enumeration has gone vacuous and E2/E4/E6 are no longer evidence.
function checkN1_negativeControls() {
  let violations = 0;
  // N1a: single-limb 50-26A (ignoring "easily computable", ASC 280-10-55-15A/15B). The Update's own
  // cost-of-sales worked example lives in exactly this gap.
  const singleLimb = SWEEP.filter((s) => {
    const { m, r, e, g } = P(s);
    return (m && (r || e) && g) !== (m && r && g);
  });
  if (singleLimb.length === 0) violations++;

  // N1b: treating a not-provided-to-CODM expense inside the measure as excluded entirely, rather
  // than as ASC 280-10-50-26B(a) other segment items.
  const wouldBeWronglyExcluded = SWEEP.filter((s) => {
    const { m, r, e } = P(s);
    return m && !r && !e;
  });
  if (wouldBeWronglyExcluded.length === 0) violations++;
  for (const s of wouldBeWronglyExcluded) {
    if (s.result.output_payload.outside_significant_expense_principle) violations++;
    if (!s.result.output_payload.other_segment_items_buckets.includes(BUCKET_A)) violations++;
  }

  // N1c: collapsing 50-22 into 50-26A's "included in the measure" gate would drop every specified
  // item that is regularly provided but sits outside the measure.
  const droppedByCollapse = SWEEP.filter((s) => {
    const { m, r, is22 } = P(s);
    return is22 && !m && r;
  });
  if (droppedByCollapse.length === 0) violations++;
  for (const s of droppedByCollapse) {
    if (!s.result.output_payload.separate_disclosure_required_50_22) violations++;
  }

  return { name: 'N1_negative_controls_three_wrong_readings_all_discriminated', checked: 3, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkE1_totality(),
  checkE2_postconditions(),
  checkE3_exactlyOneDisposition(),
  checkE4_bucketMembership(),
  checkE5_nothingInsideMeasureExcluded(),
  checkE6_5022StrictlyBroader(),
  checkE7_complianceFlags(),
  checkE8_shapeAndEcho(),
  checkE9_determinism(),
  checkE10_enumCardinality(),
  checkN1_negativeControls(),
];
console.log(`[${KERNEL_ID}] class-A exhaustive enumeration: domain_cardinality=${DOMAIN_CARDINALITY}, states enumerated=${SWEEP.length}`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
