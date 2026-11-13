// 841-planning-materiality — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:4462871e2c2a4460e9cea0cf001c00712262524b9f9403bb08c5126e00f52219
// method: integer basis-point multiplication under a declared rounding rule (arithmetic on declared policy)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/841-planning-materiality.proptest.mjs

import { compute } from '../841-planning-materiality.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = '841-planning-materiality';

function randomCase(rng) {
  // Amounts span small values through the safe-integer ceiling.
  const amount = rng() < 0.2 ? Math.floor(rng() * 100) : Math.floor(rng() * Number.MAX_SAFE_INTEGER);
  return {
    benchmark_id: 'bm', benchmark_amount: amount,
    overall_bps: 1 + Math.floor(rng() * 10000),
    performance_bps: 1 + Math.floor(rng() * 10000),
    trivial_bps: 1 + Math.floor(rng() * 10000),
    rationale_id: 'rat', rounding_rule: rng() < 0.5 ? 'half_up' : 'floor',
  };
}

// Independent recompute: a different formulation (doubled numerator for the half-up tie) in BigInt.
function oracle(value, bps, rule) {
  const num = value * BigInt(bps);
  return rule === 'floor' ? num / 10000n : (2n * num + 10000n) / 20000n;
}

// Round trip against the independent BigInt recompute, all three thresholds.
function checkBigIntRoundTrip() {
  const rng = mulberry32(841);
  let checked = 0, violations = 0;
  for (let i = 0; i < 500; i++) {
    const pp = randomCase(rng);
    const o = compute(pp).output_payload;
    const overall = oracle(BigInt(pp.benchmark_amount), pp.overall_bps, pp.rounding_rule);
    const perf = oracle(overall, pp.performance_bps, pp.rounding_rule);
    const triv = oracle(overall, pp.trivial_bps, pp.rounding_rule);
    checked++;
    if (BigInt(o.overall_materiality) !== overall || BigInt(o.performance_materiality) !== perf
      || BigInt(o.clearly_trivial_threshold) !== triv) violations++;
  }
  return { name: 'round_trip_against_independent_bigint', checked, violations };
}

// Overall, performance and trivial are monotone non-decreasing in the benchmark amount.
function checkMonotoneInBenchmark() {
  const rng = mulberry32(8411);
  let checked = 0, violations = 0;
  for (let i = 0; i < 400; i++) {
    const pp = randomCase(rng);
    const bigger = { ...pp, benchmark_amount: pp.benchmark_amount + Math.floor(rng() * 1000) };
    if (!Number.isSafeInteger(bigger.benchmark_amount)) continue;
    const a = compute(pp).output_payload, b = compute(bigger).output_payload;
    checked++;
    if (b.overall_materiality < a.overall_materiality || b.performance_materiality < a.performance_materiality
      || b.clearly_trivial_threshold < a.clearly_trivial_threshold) violations++;
  }
  return { name: 'monotone_in_benchmark', checked, violations };
}

// No threshold exceeds its parent: overall <= benchmark, performance <= overall;
// trivial <= performance exactly when the flag is absent (flagged, never corrected).
function checkThresholdsNeverExceedParent() {
  const rng = mulberry32(8412);
  let checked = 0, violations = 0;
  for (let i = 0; i < 500; i++) {
    const pp = randomCase(rng);
    const r = compute(pp);
    const o = r.output_payload;
    checked++;
    const flagged = r.compliance_flags.includes('CLEARLY_TRIVIAL_ABOVE_PERFORMANCE');
    if (o.overall_materiality > pp.benchmark_amount || o.performance_materiality > o.overall_materiality
      || o.performance_not_above_overall !== true
      || o.trivial_not_above_performance !== !flagged
      || (o.clearly_trivial_threshold <= o.performance_materiality) !== !flagged
      || o.clearly_trivial_threshold > o.overall_materiality
      || !deepEqual(o.warnings, r.compliance_flags)) violations++;
  }
  return { name: 'thresholds_never_exceed_parent_and_ordering_flag_mirrors', checked, violations };
}

// Floor never exceeds half-up, and they differ by at most one unit per step.
function checkRoundingRelation() {
  const rng = mulberry32(8413);
  let checked = 0, violations = 0;
  for (let i = 0; i < 400; i++) {
    const pp = randomCase(rng);
    const f = compute({ ...pp, rounding_rule: 'floor' }).output_payload;
    const h = compute({ ...pp, rounding_rule: 'half_up' }).output_payload;
    checked++;
    if (f.overall_materiality > h.overall_materiality || h.overall_materiality - f.overall_materiality > 1) violations++;
  }
  return { name: 'floor_never_above_half_up', checked, violations };
}

// Invalid domains refuse with an explicit code and the INPUT_REFUSED flag, never a figure.
function checkRefusals() {
  const base = { benchmark_id: 'bm', benchmark_amount: 1000, overall_bps: 500, performance_bps: 7500, trivial_bps: 500, rationale_id: 'rat', rounding_rule: 'floor' };
  const cases = [
    [{ ...base, rationale_id: '' }, 'RATIONALE_ID_MISSING'],
    [{ ...base, rationale_id: undefined }, 'RATIONALE_ID_MISSING'],
    [{ ...base, rationale_id: 7 }, 'RATIONALE_ID_MISSING'],
    [{ ...base, benchmark_id: '' }, 'BENCHMARK_ID_MISSING'],
    [{ ...base, benchmark_id: ['x'] }, 'BENCHMARK_ID_MISSING'],
    [{ ...base, benchmark_amount: -1 }, 'BENCHMARK_AMOUNT_INVALID'],
    [{ ...base, benchmark_amount: 1.5 }, 'BENCHMARK_AMOUNT_INVALID'],
    [{ ...base, benchmark_amount: '10' }, 'BENCHMARK_AMOUNT_INVALID'],
    [{ ...base, benchmark_amount: 1e21 }, 'BENCHMARK_AMOUNT_INVALID'],
    [{ ...base, benchmark_amount: NaN }, 'BENCHMARK_AMOUNT_INVALID'],
    [{ ...base, overall_bps: 0 }, 'OVERALL_BPS_INVALID'],
    [{ ...base, overall_bps: 10001 }, 'OVERALL_BPS_INVALID'],
    [{ ...base, overall_bps: 5.5 }, 'OVERALL_BPS_INVALID'],
    [{ ...base, performance_bps: 0 }, 'PERFORMANCE_BPS_INVALID'],
    [{ ...base, performance_bps: 10001 }, 'PERFORMANCE_BPS_INVALID'],
    [{ ...base, trivial_bps: 0 }, 'TRIVIAL_BPS_INVALID'],
    [{ ...base, trivial_bps: 10001 }, 'TRIVIAL_BPS_INVALID'],
    [{ ...base, trivial_bps: -5 }, 'TRIVIAL_BPS_INVALID'],
    [{ ...base, rounding_rule: 'ceil' }, 'ROUNDING_RULE_INVALID'],
    [{ ...base, rounding_rule: undefined }, 'ROUNDING_RULE_INVALID'],
  ];
  let violations = 0;
  for (const [pp, code] of cases) {
    const r = compute(pp);
    const o = r.output_payload;
    if (!o.refusal_reasons.includes(code) || !deepEqual(r.compliance_flags, ['INPUT_REFUSED'])
      || o.outcome !== 'refused' || o.overall_materiality !== null) violations++;
  }
  for (const bad of [null, undefined, {}]) {
    const r = compute(bad);
    if (!deepEqual(r.compliance_flags, ['INPUT_REFUSED'])) violations++;
  }
  return { name: 'invalid_domains_refuse_with_code', checked: cases.length + 3, violations };
}

// ---------- run ----------
let fixtureOracle;
try {
  fixtureOracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  fixtureOracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkBigIntRoundTrip(),
  checkMonotoneInBenchmark(),
  checkThresholdsNeverExceedParent(),
  checkRoundingRelation(),
  checkRefusals(),
];
const ok = summarize(KERNEL_ID, fixtureOracle, properties);
process.exit(ok ? 0 : 1);
