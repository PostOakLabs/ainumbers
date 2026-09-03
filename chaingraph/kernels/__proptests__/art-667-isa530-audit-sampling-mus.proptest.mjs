// art-667-isa530-audit-sampling-mus.proptest.mjs -- class-A property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:a62e70730f3f37c0d55c9712f524763870a283e8ed3d9f22efcaf860a398da48
// spec: ISA530-SAMPLING-BUILD-SPEC.md (workspace root, ISA530-BUILD-1).
// human_sign_off: PENDING
//
// SCOPE: floor tier only, NOT a proof, NOT Dafny. float_sensitive: NO for sizing (exact integer
// ceiling/half-up division on the safe-integer domain this floor generates); projection and
// Benford re-derivations below repeat the kernel's fixed float operation order, so equality is
// bit-exact and deterministic, not tolerance-based.
//
// Checks: fixture-oracle gate, determinism, output shape (no NaN/undefined), a differential
// re-derivation of sample size and interval (independent formulations), sizing monotonicity in
// confidence factor and expected misstatement, the fail-closed rule (expected_misstatement >=
// performance_materiality), a differential re-derivation of the tainting projection and basic
// precision, and a differential re-derivation of the Benford chi-square screen (counts summed
// via an independent first-digit extraction, expected proportions re-derived via Math.log10).
//
// Run: node chaingraph/kernels/__proptests__/art-667-isa530-audit-sampling-mus.proptest.mjs

import { compute } from '../art-667-isa530-audit-sampling-mus.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-667-isa530-audit-sampling-mus';
const rand = mulberry32(0x5A17667);

const CHI2_CRIT = 15.507; // independent copy of the 8-df 5% critical value

function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }
function r2(x) { return Math.round(x * 100) / 100; }
function r6(x) { return Math.round(x * 1000000) / 1000000; }

// ---------- random policy_parameters over the declared domains ----------

function randomSizingPP(rng, { forceFailClosed = false } = {}) {
  const bv = randInt(rng, 1, 5000000);
  const pm = randInt(rng, 1000, 1000000);
  const em = forceFailClosed
    ? pm + randInt(rng, 0, 50000)
    : randInt(rng, 0, pm - 1);
  const cf = randInt(rng, 1, 10);
  return { method: 'monetary_unit_sampling', book_value: bv, performance_materiality: pm, expected_misstatement: em, confidence_factor: cf };
}

function randomProjectionPP(rng) {
  const n = randInt(rng, 0, 8);
  const items = [];
  for (let i = 0; i < n; i++) {
    const book = randInt(rng, 1, 500000);
    // audited occasionally exceeds book (understatement -> negative taint), stays non-negative
    const audited = rng() < 0.15 ? book + randInt(rng, 1, 5000) : randInt(rng, 0, book);
    items.push({ book_amount: book, audited_amount: audited });
  }
  return { method: 'misstatement_projection', sampling_interval: randInt(rng, 1, 100000), confidence_factor: randInt(rng, 1, 10), sampled_items: items };
}

function randomBenfordPP(rng) {
  const n = randInt(rng, 0, 60);
  const amounts = [];
  for (let i = 0; i < n; i++) {
    if (rng() < 0.08) amounts.push(pick(rng, [0, -5, -0.25])); // exercise exclusion path
    else amounts.push(+(randInt(rng, 1, 99999) + rng()).toFixed(2));
  }
  return { method: 'benford_screen', amounts };
}

function randomPP(rng) {
  const r = rng();
  if (r < 0.08) return { method: 'not_a_real_method' };
  if (r < 0.12) return {};
  if (r < 0.48) return randomSizingPP(rng);
  if (r < 0.78) return randomProjectionPP(rng);
  return randomBenfordPP(rng);
}

const TRIALS = 1500;

// ---------- P1: determinism -- same policy_parameters -> byte-identical output_payload ----------
function checkP1_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const a = JSON.stringify(compute(pp).output_payload);
    const b = JSON.stringify(compute(pp).output_payload);
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P1_determinism', checked, violations };
}

// ---------- P2: output shape -- no NaN/undefined anywhere in output_payload ----------
function checkP2_output_shape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (findShapeViolations(output_payload).length > 0) violations++;
  }
  return { name: 'P2_output_shape_no_nan_undefined', checked, violations };
}

// ---------- P3 (differential): sizing re-derived with independent formulations ----------
// Ceil property: (n-1) < bv*cf/den <= n, checked exactly with integer products; interval
// re-derived via remainder-operator half-up rounding, a different code path than the kernel's
// corrected-quotient loop.
function checkP3_sizing_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomSizingPP(rand);
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.overall !== 'SAMPLE_COMPUTED') continue; // fail-closed inputs exercised in P5
    const den = pp.performance_materiality - pp.expected_misstatement;
    const num = pp.book_value * pp.confidence_factor;
    const n = op.sample_size;
    if (!((n - 1) * den < num && num <= n * den)) violations++;
    const interval2 = Math.floor(pp.book_value / n) + ((pp.book_value % n) * 2 >= n ? 1 : 0);
    if (op.sampling_interval !== interval2) violations++;
    if (op.tolerable_misstatement !== pp.performance_materiality) violations++;
  }
  return { name: 'P3_sizing_ceil_and_halfup_differential', checked, violations };
}

// ---------- P4: monotonicity -- bigger confidence factor never shrinks n; bigger expected
// misstatement never shrinks n (it shrinks the denominator PM - EM, so the quotient grows) ----------
function checkP4_sizing_monotonicity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const base = randomSizingPP(rand);
    if (base.expected_misstatement >= base.performance_materiality) continue;
    const cfUp = { ...base, confidence_factor: base.confidence_factor + randInt(rand, 1, 5) };
    const emUp = { ...base, expected_misstatement: Math.min(base.performance_materiality - 1, base.expected_misstatement + randInt(rand, 1, 5000)) };
    const n0 = compute(base).output_payload.sample_size;
    const nCf = compute(cfUp).output_payload.sample_size;
    const nEm = compute(emUp).output_payload.sample_size;
    checked++;
    if (nCf < n0) violations++;
    if (nEm < n0) violations++;
  }
  return { name: 'P4_sizing_monotonicity_cf_and_em', checked, violations };
}

// ---------- P5: fail-closed -- expected >= materiality never computes a sample ----------
function checkP5_sizing_fail_closed() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const pp = randomSizingPP(rand, { forceFailClosed: true });
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (op.overall !== 'INPUT_REJECTED') violations++;
    if (op.sample_size !== null || op.sampling_interval !== null) violations++;
    if (!compliance_flags.includes('MUS_EXPECTED_NOT_BELOW_MATERIALITY')) violations++;
    if (!Array.isArray(op.warnings) || op.warnings.length === 0) violations++;
  }
  return { name: 'P5_sizing_fail_closed_em_ge_pm', checked, violations };
}

// ---------- P6 (differential): tainting projection re-derived per item and in total ----------
function checkP6_projection_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomProjectionPP(rand);
    const { output_payload: op } = compute(pp);
    checked++;
    if (pp.sampled_items.length === 0) continue; // rejection path; covered by oracle + P2
    if (op.overall !== 'PROJECTED') continue;
    const usable = pp.sampled_items.filter((it) => it.book_amount > 0 && it.audited_amount >= 0);
    let raw = 0;
    for (const it of usable) raw += (it.book_amount - it.audited_amount) * pp.sampling_interval / it.book_amount;
    if (op.projected_misstatement !== r2(raw)) violations++;
    if (op.basic_precision !== r2(pp.confidence_factor * pp.sampling_interval)) violations++;
    if (op.usable_item_count !== usable.length) violations++;
    for (const row of op.per_item) {
      const it = pp.sampled_items[row.seq - 1];
      const num = it.book_amount - it.audited_amount;
      if (row.taint_percent !== r2(100 * num / it.book_amount)) violations++;
      if (row.projected_amount !== r2(num * pp.sampling_interval / it.book_amount)) violations++;
    }
    // flag-mirror doctrine: item rejections are a conditional flag, so warnings must be present with them
    const rejectedSome = usable.length < pp.sampled_items.length;
    if (rejectedSome !== (Array.isArray(op.warnings) && op.warnings.length > 0)) violations++;
  }
  return { name: 'P6_projection_tainting_differential', checked, violations };
}

// ---------- P7 (differential): Benford counts and chi-square re-derived independently ----------
// First digits re-extracted with a regex (vs the kernel's charCode walk), expected proportions
// re-derived with Math.log10 (vs the kernel's embedded literals).
function checkP7_benford_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomBenfordPP(rand);
    const { output_payload: op } = compute(pp);
    checked++;
    if (pp.amounts.length === 0) continue;
    if (op.overall === 'INPUT_REJECTED') continue;
    const counts = {};
    for (let d = 1; d <= 9; d++) counts[d] = 0;
    let usable = 0;
    for (const v of pp.amounts) {
      if (typeof v !== 'number' || !(v > 0)) continue;
      const m = /([1-9])/.exec(String(Math.abs(v)));
      if (!m) continue;
      counts[+m[1]] += 1;
      usable += 1;
    }
    if (usable === 0) continue;
    let chi2 = 0;
    for (let d = 1; d <= 9; d++) {
      const expected = usable * Math.log10(1 + 1 / d);
      chi2 += (counts[d] - expected) ** 2 / expected;
    }
    if (op.usable_count !== usable) violations++;
    if (JSON.stringify(op.first_digit_counts) !== JSON.stringify(counts)) violations++;
    if (op.chi_square_statistic !== r6(chi2)) violations++;
    if (op.deviation_flag !== (op.chi_square_statistic > CHI2_CRIT)) violations++;
    const sumCounts = Object.values(op.first_digit_counts).reduce((a, b) => a + b, 0);
    if (sumCounts !== op.usable_count) violations++;
  }
  return { name: 'P7_benford_counts_and_chisquare_differential', checked, violations };
}

// ---------- P8: dispatch -- an unrecognized method never computes ----------
function checkP8_method_dispatch() {
  let violations = 0, checked = 0;
  for (const pp of [{ method: 'attribute_sampling' }, { method: '' }, {}, { method: 42 }]) {
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (op.overall !== 'INPUT_REJECTED') violations++;
    if (!compliance_flags.includes('METHOD_NOT_RECOGNIZED')) violations++;
    if (!Array.isArray(op.warnings) || op.warnings.length === 0) violations++;
  }
  return { name: 'P8_method_dispatch_refuses_unknown', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_determinism(),
  checkP2_output_shape(),
  checkP3_sizing_differential(),
  checkP4_sizing_monotonicity(),
  checkP5_sizing_fail_closed(),
  checkP6_projection_differential(),
  checkP7_benford_differential(),
  checkP8_method_dispatch(),
];
console.log(`[${KERNEL_ID}] class-A floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
