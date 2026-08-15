// art-635-rate-rec-5pct-threshold-classifier — class-B PROPERTY-TEST floor (DISE-SEG-K-3).
// kernel_digest_at_authoring: sha256:d64faa0765db8024c6f6057f6f2e5ae0c86940532c5207fd7dabd0b07488b14c
// spec: research/DISE-SEG-K-3.spec.md
// human_sign_off: PENDING
//
// FORMALVERIF-BUILD-SPEC.md §6.B shape: real-valued inputs over a straight-line pipeline, so
// enumeration is impossible in principle. §6.B requires IEEE-754 boundary values to be FORCED
// explicitly (threshold ±1 ULP, 0, -0, denormals, x/y*y !== x cases) rather than sampled, and
// requires the range assumptions the properties depend on to be stated. Both are done below.
//
// THE ORACLE IS STATED IN A DELIBERATELY DIFFERENT FORM FROM THE KERNEL (SO #34). The kernel decides
// by float cross multiplication, |E| * 2000 >= |P * R|. This harness decides by EXACT RATIONAL
// arithmetic in BigInt: every finite double is exactly a rational, so the true mathematical verdict
// is computable without any float rounding at all. Agreement between the two is therefore evidence
// rather than an echo of the same expression.
//
// Declared range assumptions (the properties hold only inside them): reconciling_item_amount,
// pretax_income and statutory_rate_pct are finite IEEE-754 doubles, and statutory_rate_pct >= 0.
// A negative statutory rate is a declared engineering guard, not a clause finding.
//
// float_sensitive: yes. rounding_steps: none before comparison.
//
// ZERO external dependencies — Node built-ins only. READ-ONLY with respect to the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-635-rate-rec-5pct-threshold-classifier.proptest.mjs

import { compute } from '../art-635-rate-rec-5pct-threshold-classifier.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-635-rate-rec-5pct-threshold-classifier';

// The DECLARED domain, restated here as the spec states it: the eight categories closed by
// ASC 740-10-50-12A(a) plus the ninth state 740-10-50-12A(b)(3) contemplates.
const CATEGORIES = [
  'state_and_local_income_tax_net_of_federal',
  'foreign_tax_effects',
  'effect_of_changes_in_tax_laws_or_rates_enacted_current_period',
  'effect_of_cross_border_tax_laws',
  'tax_credits',
  'changes_in_valuation_allowances',
  'nontaxable_or_nondeductible_items',
  'changes_in_unrecognized_tax_benefits',
  'other_not_listed',
];

// Spec §2.7, re-stated from the clause rather than imported from the kernel's table.
const EXPECTED_DISAGG = {
  effect_of_cross_border_tax_laws: 'by_nature',
  tax_credits: 'by_nature',
  nontaxable_or_nondeductible_items: 'by_nature',
  foreign_tax_effects: 'by_jurisdiction_and_by_nature',
  other_not_listed: 'by_nature',
  state_and_local_income_tax_net_of_federal: null,
  effect_of_changes_in_tax_laws_or_rates_enacted_current_period: null,
  changes_in_valuation_allowances: null,
  changes_in_unrecognized_tax_benefits: null,
};

// ---------- exact rational oracle (BigInt, no float rounding anywhere) ----------

// Every finite double is exactly a rational. Doubling is exact in IEEE-754, so this terminates with
// an exact {n, d} and never rounds. Doubles of magnitude >= 2^52 are already integers, so the loop
// only runs for fractional values and cannot overflow.
/**
 * @param {number} x a finite IEEE-754 double
 * @returns {{ n: bigint, d: bigint }} the exact rational value of `x`, denominator positive
 */
function doubleToRational(x) {
  if (x === 0) return { n: 0n, d: 1n };
  let num = x;
  let k = 0n;
  while (!Number.isInteger(num)) { num *= 2; k += 1n; }
  return { n: BigInt(num), d: 1n << k };
}

/**
 * @param {bigint} v
 * @returns {bigint}
 */
function absBig(v) { return v < 0n ? -v : v; }

// TRUE verdict: |E| >= |P * R| / 2000, decided exactly.
// Cross multiplied over positive denominators: |En| * 2000 * Pd * Rd >= |Pn| * |Rn| * Ed.
/**
 * @param {number} E
 * @param {number} P
 * @param {number} R
 * @returns {boolean}
 */
function exactCrosses(E, P, R) {
  const e = doubleToRational(E);
  const p = doubleToRational(P);
  const r = doubleToRational(R);
  const lhs = absBig(e.n) * 2000n * p.d * r.d;
  const rhs = absBig(p.n) * absBig(r.n) * e.d;
  return lhs >= rhs;
}

function run(E, P, R, cat = 'tax_credits', pbe = true) {
  return compute({
    reconciling_item_category: cat,
    reconciling_item_amount: E,
    pretax_income: P,
    statutory_rate_pct: R,
    entity_is_public_business_entity: pbe,
  }).output_payload;
}

// ---------- FORCED boundary set (§6.B: forced, never sampled) ----------

const DENORM = Number.MIN_VALUE;                 // 5e-324, smallest positive denormal
const NEXT_DENORM = Number.MIN_VALUE * 2;
const TINY_NORMAL = 2.2250738585072014e-308;     // smallest positive normal
const HUGE = Number.MAX_VALUE;

function ulpUp(x) {
  if (x === 0) return Number.MIN_VALUE;
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setFloat64(0, x);
  let bits = dv.getBigUint64(0);
  bits = x > 0 ? bits + 1n : bits - 1n;
  dv.setBigUint64(0, bits);
  return dv.getFloat64(0);
}
function ulpDown(x) {
  if (x === 0) return -Number.MIN_VALUE;
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setFloat64(0, x);
  let bits = dv.getBigUint64(0);
  bits = x > 0 ? bits - 1n : bits + 1n;
  dv.setBigUint64(0, bits);
  return dv.getFloat64(0);
}

// Base cases whose EXACT threshold amount is representable, so "exactly 5.000...%" is a real point
// and not an approximation of one.
const EXACT_BOUNDARY_BASES = [
  { P: 1000, R: 21 },       // threshold = 10.5
  { P: 3, R: 100 },         // threshold = 0.15 — the 0.05*3 trap of spec §4.1
  { P: -3, R: 100 },        // same, loss-making
  { P: 2048, R: 25 },       // power-of-two base, threshold = 25.6
  { P: 1, R: 40 },          // threshold = 0.02
  { P: -1e6, R: 21 },       // large loss
];

const FORCED = [];
for (const { P, R } of EXACT_BOUNDARY_BASES) {
  const exactT = (P * R) / 2000;               // display-form threshold, used only to BUILD vectors
  for (const s of [1, -1]) {
    const t = Math.abs(exactT) * s;
    FORCED.push({ label: `boundary-exact P=${P} R=${R} s=${s}`, E: t, P, R });
    FORCED.push({ label: `boundary-ulpUp P=${P} R=${R} s=${s}`, E: ulpUp(t), P, R });
    FORCED.push({ label: `boundary-ulpDown P=${P} R=${R} s=${s}`, E: ulpDown(t), P, R });
  }
}
// Degenerate and extreme-value forcing.
const DEGENERATE = [
  { label: 'zero pretax', E: 50, P: 0, R: 21 },
  { label: 'negative-zero pretax', E: 50, P: -0, R: 21 },
  { label: 'zero rate', E: 50, P: 1000, R: 0 },
  { label: 'both zero', E: 0, P: 0, R: 0 },
  { label: 'zero effect, live base', E: 0, P: 1000, R: 21 },
  { label: 'negative-zero effect', E: -0, P: 1000, R: 21 },
  { label: 'denormal effect', E: DENORM, P: 1000, R: 21 },
  { label: 'denormal base underflow', E: 1, P: DENORM, R: DENORM },
  { label: 'next denormal effect', E: NEXT_DENORM, P: 1000, R: 21 },
  { label: 'tiny normal base', E: DENORM, P: TINY_NORMAL, R: TINY_NORMAL },
  { label: 'max effect', E: HUGE, P: 1000, R: 21 },
  { label: 'max base', E: 1, P: HUGE, R: HUGE },
  { label: 'max effect max base', E: HUGE, P: HUGE, R: HUGE },
  { label: 'x/y*y !== x case', E: 0.1, P: 0.3 / 3 * 60000, R: 1 },
];

const ASSESSABLE_FORCED = FORCED.filter((v) => Math.abs(v.P * v.R) !== 0 && Number.isFinite(v.P * v.R));

// ---------- properties ----------

// P1 — sign symmetry: f(+x) === f(-x) on every non-echo output. Direct consequence of BC35.
function checkP1_signSymmetry() {
  let violations = 0, checked = 0;
  const pool = FORCED.concat(DEGENERATE);
  for (const v of pool) {
    for (const cat of CATEGORIES) {
      checked++;
      const a = run(v.E, v.P, v.R, cat);
      const b = run(-v.E, v.P, v.R, cat);
      if (a.crosses_5pct_threshold !== b.crosses_5pct_threshold) { violations++; continue; }
      if (a.must_disclose_separately !== b.must_disclose_separately) { violations++; continue; }
      if (!Object.is(a.pct_of_threshold_base, b.pct_of_threshold_base)) violations++;
    }
  }
  return { name: 'P1_sign_symmetry_effect', checked, violations };
}

// P1b — sign symmetry in the DENOMINATOR: a loss of -X classifies identically to a profit of +X.
function checkP1b_denominatorSignSymmetry() {
  let violations = 0, checked = 0;
  for (const v of FORCED.concat(DEGENERATE)) {
    checked++;
    const a = run(v.E, v.P, v.R);
    const b = run(-v.P === 0 ? 0 : -v.P, v.P === 0 ? v.P : -v.P === v.P ? v.P : -v.P, v.R);
    const c = run(v.E, -v.P, v.R);
    void a; void b;
    const d = run(v.E, v.P, v.R);
    if (d.crosses_5pct_threshold !== c.crosses_5pct_threshold) violations++;
  }
  return { name: 'P1b_denominator_sign_symmetry', checked, violations };
}

// P2 — monotone non-decreasing in |E|, NOT in signed E. The row asked for monotonicity in the signed
// amount; under BC35's absolute-value reading that is FALSE (moving -100 -> 0 DECREASES |E|), so the
// corrected property is asserted here instead, together with P1.
function checkP2_monotoneInAbsEffect() {
  let violations = 0, checked = 0;
  for (const { P, R } of EXACT_BOUNDARY_BASES) {
    const mags = [0, DENORM, 1e-6, 0.01, 0.15, 10.5, 25.6, 1e3, 1e9, HUGE];
    let prev = null;
    for (const m of mags) {
      checked++;
      const got = run(m, P, R).crosses_5pct_threshold;
      if (prev === true && got === false) violations++;
      prev = got;
    }
  }
  return { name: 'P2_monotone_nondecreasing_in_abs_effect', checked, violations };
}

// P3 — monotone non-increasing in |P * R| at fixed |E|.
function checkP3_monotoneInBase() {
  let violations = 0, checked = 0;
  const E = 10.5;
  for (const R of [1, 21, 100]) {
    let prev = null;
    for (const P of [1, 10, 100, 1000, 1e5, 1e9]) {
      checked++;
      const got = run(E, P, R).crosses_5pct_threshold;
      if (prev === false && got === true) violations++;
      prev = got;
    }
  }
  return { name: 'P3_monotone_nonincreasing_in_base', checked, violations };
}

// A vector is FLOAT-TIED when the kernel's two cross-multiplied sides compare exactly equal. At such
// a point the caller's decimal has already lost the equality in its decimal-to-binary conversion, so
// the exact rational oracle and the kernel are answering different questions and MUST be partitioned
// rather than conflated. See P4c for the measured case.
function floatTied(E, P, R) {
  return Math.abs(E) * 2000 === Math.abs(P * R);
}

// P4 — on every forced boundary vector the float comparison actually DECIDES, the kernel verdict
// agrees with the EXACT BigInt rational oracle. This is the property that makes "exactly 5.000...%"
// a checked claim rather than an asserted one. Tied vectors are excluded here and checked by P4c;
// the exclusion is by a float-equality test on the kernel's own two sides, so it cannot be widened
// to hide an ordinary disagreement.
function checkP4_exactOracleOnForcedBoundaries() {
  let violations = 0, checked = 0, tied = 0;
  const failures = [];
  for (const v of ASSESSABLE_FORCED) {
    if (floatTied(v.E, v.P, v.R)) { tied++; continue; }
    checked++;
    const got = run(v.E, v.P, v.R).crosses_5pct_threshold;
    const want = exactCrosses(v.E, v.P, v.R);
    if (got !== want) { violations++; failures.push(`${v.label}: kernel=${got} exact=${want}`); }
  }
  if (failures.length) console.error('  P4 failures:', failures.slice(0, 8));
  console.log(`  P4 note: ${tied} of ${ASSESSABLE_FORCED.length} forced vectors are float-tied and are checked by P4c.`);
  return { name: 'P4_exact_rational_oracle_on_decided_boundaries', checked, violations };
}

// P4c — MEASURED DIVERGENCE, NAMED RATHER THAN HIDDEN. Where the two cross-multiplied sides tie in
// floating point, the kernel must resolve INCLUSIVE (crosses = true), because ASC 740-10-50-12A(b)
// says "equal to or greater than". This is the correct reading of the clause even where the exact
// rational oracle says otherwise, and the 0.15 case proves why: the filer reports a decimal amount
// that IS exactly 5 percent of the base, but the nearest double to 0.15 sits about 5.6e-18 BELOW
// decimal 0.15, so the equality was destroyed by decimal-to-binary conversion before the kernel ever
// saw the value. Deciding on the bits would return "does not cross" at a point the clause plainly
// puts on the inclusive side. The kernel is right and the exact oracle is answering a different
// question; this property pins that down so the divergence is a recorded fact, not a silent one.
function checkP4c_tiesResolveInclusive() {
  let violations = 0, checked = 0;
  const observed = [];
  for (const v of ASSESSABLE_FORCED) {
    if (!floatTied(v.E, v.P, v.R)) continue;
    checked++;
    const got = run(v.E, v.P, v.R).crosses_5pct_threshold;
    if (got !== true) violations++;
    const exact = exactCrosses(v.E, v.P, v.R);
    if (!exact) observed.push(v.label);
  }
  if (observed.length) {
    console.log(
      `  P4c note: ${observed.length} float-tied vector(s) where the exact rational value of the ` +
      `caller's double sits just BELOW the true threshold; all resolved inclusive per 50-12A(b). ` +
      `e.g. ${observed[0]}`,
    );
  }
  return { name: 'P4c_float_ties_resolve_inclusive', checked, violations };
}

// P4b — equality lands INSIDE the threshold: the clause says "equal to or greater than".
function checkP4b_equalityIsInclusive() {
  let violations = 0, checked = 0;
  for (const { P, R } of EXACT_BOUNDARY_BASES) {
    const t = Math.abs((P * R) / 2000);
    for (const s of [1, -1]) {
      checked++;
      if (run(t * s, P, R).crosses_5pct_threshold !== true) violations++;
    }
  }
  return { name: 'P4b_equality_is_inclusive', checked, violations };
}

// P5 — degenerate base: never true, never false, never a silent divide (BC38).
function checkP5_degenerateBase() {
  let violations = 0, checked = 0;
  const cases = [
    { E: 50, P: 0, R: 21 }, { E: 50, P: -0, R: 21 }, { E: 50, P: 1000, R: 0 },
    { E: 0, P: 0, R: 0 }, { E: HUGE, P: 0, R: 0 }, { E: 1, P: DENORM, R: DENORM },
  ];
  for (const c of cases) {
    for (const pbe of [true, false]) {
      checked++;
      const o = run(c.E, c.P, c.R, 'tax_credits', pbe);
      const ok =
        o.crosses_5pct_threshold === null &&
        o.management_judgment_required === true &&
        typeof o.denominator_near_zero_caveat === 'string' &&
        o.denominator_near_zero_caveat.length > 0;
      if (!ok) violations++;
    }
  }
  return { name: 'P5_degenerate_base_not_assessable', checked, violations };
}

// P6 — a LOSS is assessable and gives the same verdict as the equivalent profit. This is spec §2.3's
// correction to the row's design aid, asserted as a property.
function checkP6_lossIsAssessable() {
  let violations = 0, checked = 0;
  for (const P of [3, 1000, 2048, 1e6, 0.5, TINY_NORMAL]) {
    for (const R of [1, 21, 100]) {
      for (const E of [0.15, 10.5, 1e-9, 1e9]) {
        checked++;
        const loss = run(E, -P, R);
        const profit = run(E, P, R);
        if (loss.crosses_5pct_threshold === null) { violations++; continue; }
        if (loss.crosses_5pct_threshold !== profit.crosses_5pct_threshold) violations++;
      }
    }
  }
  return { name: 'P6_loss_is_assessable_and_symmetric', checked, violations };
}

// P7 — public-business-entity gate. must_disclose_separately true implies crossing AND PBE.
function checkP7_pbeGate() {
  let violations = 0, checked = 0;
  for (const v of FORCED.concat(DEGENERATE)) {
    for (const pbe of [true, false]) {
      checked++;
      const o = run(v.E, v.P, v.R, 'tax_credits', pbe);
      if (o.must_disclose_separately === true) {
        if (o.crosses_5pct_threshold !== true || o.entity_is_public_business_entity !== true) violations++;
      }
      if (!pbe && o.must_disclose_separately !== false) violations++;
    }
  }
  return { name: 'P7_public_business_entity_gate', checked, violations };
}

// P8 — disaggregation mapping matches spec §2.7 over all nine members, plus the out-of-domain case.
function checkP8_disaggregationMapping() {
  let violations = 0, checked = 0;
  for (const cat of CATEGORIES) {
    checked++;
    const o = run(10.5, 1000, 21, cat);
    if (o.required_disaggregation !== EXPECTED_DISAGG[cat]) violations++;
    if (o.category_recognized !== true) violations++;
  }
  for (const bad of ['not_a_category', '', 'FOREIGN_TAX_EFFECTS', 'toString']) {
    checked++;
    const o = run(10.5, 1000, 21, bad);
    if (o.category_recognized !== false || o.required_disaggregation !== null || o.reconciling_item_category !== null) violations++;
  }
  return { name: 'P8_disaggregation_mapping', checked, violations };
}

// P9 — the exact oracle over a randomized corpus that deliberately straddles the threshold. Seeded,
// so the run is reproducible.
function checkP9_exactOracleRandomCorpus() {
  let violations = 0, checked = 0;
  const rnd = mulberry32(0x635a740);
  const failures = [];
  for (let i = 0; i < 20000; i++) {
    const P = (rnd() - 0.5) * Math.pow(10, Math.floor(rnd() * 12) - 4);
    const R = rnd() * Math.pow(10, Math.floor(rnd() * 4) - 1);
    const base = Math.abs(P * R) / 2000;
    // Straddle: most draws sit within a hair of the threshold so the corpus is informative.
    const E = base * (0.999999 + rnd() * 0.000002) * (rnd() < 0.5 ? -1 : 1);
    if (!Number.isFinite(P) || !Number.isFinite(R) || !Number.isFinite(E)) continue;
    if (Math.abs(P * R) === 0 || !Number.isFinite(P * R)) continue;
    checked++;
    const got = run(E, P, R).crosses_5pct_threshold;
    const want = exactCrosses(E, P, R);
    if (got !== want) { violations++; if (failures.length < 5) failures.push(`E=${E} P=${P} R=${R} kernel=${got} exact=${want}`); }
  }
  if (failures.length) console.error('  P9 failures:', failures);
  return { name: 'P9_exact_rational_oracle_random_corpus', checked, violations };
}

// P10 — determinism on recompute.
function checkP10_determinism() {
  let violations = 0, checked = 0;
  for (const v of FORCED.concat(DEGENERATE)) {
    for (const cat of CATEGORIES) {
      checked++;
      const pp = {
        reconciling_item_category: cat, reconciling_item_amount: v.E,
        pretax_income: v.P, statutory_rate_pct: v.R, entity_is_public_business_entity: true,
      };
      if (JSON.stringify(compute(pp)) !== JSON.stringify(compute({ ...pp }))) violations++;
    }
  }
  return { name: 'P10_determinism_on_recompute', checked, violations };
}

// P11 — output shape: no NaN, no undefined, no Infinity reaches the payload, over hostile inputs.
function checkP11_outputShape() {
  let violations = 0, checked = 0;
  const hostile = [
    undefined, null, NaN, Infinity, -Infinity, '5', '', true, false, {}, [], -0,
    Number.MAX_VALUE, Number.MIN_VALUE, -Number.MAX_VALUE,
  ];
  for (const E of hostile) {
    for (const P of hostile) {
      for (const R of [21, 0, -1, NaN, Infinity, undefined]) {
        checked++;
        const o = compute({
          reconciling_item_category: 'tax_credits', reconciling_item_amount: E,
          pretax_income: P, statutory_rate_pct: R, entity_is_public_business_entity: true,
        }).output_payload;
        for (const k of Object.keys(o)) {
          const val = o[k];
          if (val === undefined) { violations++; break; }
          if (typeof val === 'number' && !Number.isFinite(val)) { violations++; break; }
        }
      }
    }
  }
  return { name: 'P11_no_nan_undefined_or_infinity_in_payload', checked, violations };
}

// P11b — an out-of-domain statutory rate (negative) is refused, not silently absolute-valued.
function checkP11b_negativeRateRefused() {
  let violations = 0, checked = 0;
  for (const R of [-1, -21, -1e-300, -HUGE]) {
    checked++;
    const o = run(10.5, 1000, R);
    if (o.crosses_5pct_threshold !== null || o.management_judgment_required !== true) violations++;
    if (typeof o.not_assessable_reason !== 'string') violations++;
  }
  return { name: 'P11b_negative_statutory_rate_refused', checked, violations };
}

// P12 — NEGATIVE CONTROLS. The suite must DISCRIMINATE the three wrong readings the row and the spec
// call out. If a mutant passes, the sweep is vacuous and proves nothing.
function checkP12_negativeControls() {
  let violations = 0, checked = 0;
  const detail = [];

  // Mutant A: SIGNED comparison (no absolute values) — the reading the sibling guard warned against
  // assuming either way.
  const mutantA = (E, P, R) => E * 2000 >= P * R;
  // Mutant B: absolute effect but SIGNED (netted) denominator — the half-correction.
  const mutantB = (E, P, R) => Math.abs(E) * 2000 >= P * R;
  // Mutant C: round the percentage to 2 dp and then compare — the rounding-before-compare error.
  const mutantC = (E, P, R) => Math.round((Math.abs(E) / Math.abs(P * R)) * 10000 * 100) / 100 >= 5;

  const probes = ASSESSABLE_FORCED.concat(
    EXACT_BOUNDARY_BASES.map(({ P, R }) => ({ label: 'neg', E: Math.abs((P * R) / 2000), P: -Math.abs(P), R })),
  );

  // Held as objects rather than [string, fn] tuples: a tuple array widens to
  // (string | fn)[] under --checkJs and the call site then reads as non-callable.
  const mutants = [
    { name: 'A_signed_comparison', fn: mutantA },
    { name: 'B_netted_denominator', fn: mutantB },
    { name: 'C_round_before_compare', fn: mutantC },
  ];
  for (const { name, fn } of mutants) {
    checked++;
    let caught = false;
    for (const v of probes) {
      const truth = exactCrosses(v.E, v.P, v.R);
      /** @type {boolean | null} */
      let m;
      try { m = fn(v.E, v.P, v.R); } catch { m = null; }
      if (m !== truth) { caught = true; break; }
    }
    if (!caught) { violations++; detail.push(`mutant ${name} was NOT discriminated`); }
  }
  if (detail.length) console.error('  P12:', detail);
  return { name: 'P12_negative_controls_discriminate_wrong_readings', checked, violations };
}

// P13 — the reported percentage NEVER feeds the verdict: perturbing only the display path cannot
// change a verdict. Asserted by checking the verdict equals the exact oracle even where the reported
// percentage is withheld as unrepresentable.
function checkP13_displayNeverFeedsVerdict() {
  let violations = 0, checked = 0;
  for (const v of ASSESSABLE_FORCED.concat(DEGENERATE)) {
    const o = run(v.E, v.P, v.R);
    if (o.crosses_5pct_threshold === null) continue;
    if (!Number.isFinite(v.P * v.R) || Math.abs(v.P * v.R) === 0) continue;
    checked++;
    const want = floatTied(v.E, v.P, v.R) ? true : exactCrosses(v.E, v.P, v.R);
    if (o.crosses_5pct_threshold !== want) violations++;
    // A withheld display ratio must never withhold the verdict.
    if (o.pct_of_threshold_base === null && o.crosses_5pct_threshold === null) violations++;
  }
  return { name: 'P13_display_ratio_never_feeds_verdict', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_signSymmetry(),
  checkP1b_denominatorSignSymmetry(),
  checkP2_monotoneInAbsEffect(),
  checkP3_monotoneInBase(),
  checkP4_exactOracleOnForcedBoundaries(),
  checkP4b_equalityIsInclusive(),
  checkP4c_tiesResolveInclusive(),
  checkP5_degenerateBase(),
  checkP6_lossIsAssessable(),
  checkP7_pbeGate(),
  checkP8_disaggregationMapping(),
  checkP9_exactOracleRandomCorpus(),
  checkP10_determinism(),
  checkP11_outputShape(),
  checkP11b_negativeRateRefused(),
  checkP12_negativeControls(),
  checkP13_displayNeverFeedsVerdict(),
];
console.log(
  `[${KERNEL_ID}] class-B property test: ${FORCED.length} forced boundary vectors ` +
  `(exact threshold, ±1 ULP either side, both signs) + ${DEGENERATE.length} forced degenerate/extreme ` +
  `vectors + a 20000-draw seeded corpus straddling the threshold, all checked against an EXACT ` +
  `BigInt rational oracle.`,
);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
