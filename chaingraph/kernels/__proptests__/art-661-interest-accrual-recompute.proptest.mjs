// art-661-interest-accrual-recompute — class-A property-test FLOOR.
// kernel_digest_at_authoring: sha256:b57f3f681d019782405635040340d51f868e535834246366a930ca52336768e7
// spec: CORE-VERIFY-BUILD-SPEC.md section 1 (workspace root)
// human_sign_off: PENDING
//
// oracle: "declared -- caller contract term". The day-count convention and compounding basis
// are inputs the caller declares (§0 input contract), never inferred from the ledger -- this
// kernel is a pure recompute of THAT declared arithmetic, not an assertion about which
// convention a core "should" use. ISDA day-count fraction definitions are the standard
// cross-industry citation for the conventions themselves.
//
// ZERO external dependencies -- Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-661-interest-accrual-recompute.proptest.mjs

import { compute } from '../art-661-interest-accrual-recompute.kernel.mjs';
import { runFixtureOracle, findShapeViolations, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-661-interest-accrual-recompute';

function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function dateFromDayIndex(dayIndex) {
  const d = new Date(Date.UTC(2026, 0, 1) + dayIndex * 86400000);
  return d.toISOString().slice(0, 10);
}
function makeDailyBalances(n, balanceCents) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push({ date: dateFromDayIndex(i), principal_balance_cents: balanceCents });
  return rows;
}
function fixedTerms(rate, convention, compounding) {
  return { day_count_convention: convention, compounding, rate_type: 'fixed', rate_value: rate };
}

// PA1: SUM CONSISTENCY — total_recomputed_accrual_cents always equals the sum of the
// schedule's per-day daily_accrual_cents.
function checkPA1_sumConsistency() {
  const rng = mulberry32(661001);
  let checked = 0, violations = 0;
  const conventions = ['30/360', 'actual/360', 'actual/365', 'actual/actual'];
  for (let i = 0; i < 3000; i++) {
    const n = randInt(rng, 1, 60);
    const balance = randInt(rng, 0, 100_000_000);
    const rate = rng() * 0.2;
    const convention = conventions[randInt(rng, 0, conventions.length - 1)];
    const pp = { daily_balances: makeDailyBalances(n, balance), core_reported_accruals: [], product_terms: fixedTerms(rate, convention, 'none') };
    const { output_payload } = compute(pp);
    checked++;
    const sum = output_payload.schedule.reduce((s, r) => s + r.daily_accrual_cents, 0);
    if (sum !== output_payload.total_recomputed_accrual_cents) violations++;
  }
  return { name: 'PA1_sum_consistency', checked, violations };
}

// PA2: ORDER INDEPENDENCE — shuffling daily_balances/core_reported_accruals input order never
// changes the recomputed result (the kernel sorts internally).
function checkPA2_orderIndependence() {
  const rng = mulberry32(661002);
  let checked = 0, violations = 0;
  for (let i = 0; i < 1000; i++) {
    const n = randInt(rng, 2, 20);
    const balance = randInt(rng, 1000, 10_000_000);
    const rows = makeDailyBalances(n, balance);
    const shuffled = rows.slice().sort(() => rng() - 0.5);
    const pt = fixedTerms(0.05, 'actual/365', 'none');
    const a = compute({ daily_balances: rows, core_reported_accruals: [], product_terms: pt }).output_payload;
    const b = compute({ daily_balances: shuffled, core_reported_accruals: [], product_terms: pt }).output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'PA2_order_independence', checked, violations };
}

// PA3: MONOTONE IN RATE — with balances and period fixed, a higher fixed rate never produces a
// smaller total recomputed accrual.
function checkPA3_monotoneInRate() {
  const rng = mulberry32(661003);
  let checked = 0, violations = 0;
  for (let i = 0; i < 2000; i++) {
    const n = randInt(rng, 1, 40);
    const balance = randInt(rng, 0, 50_000_000);
    const rateLo = rng() * 0.15;
    const rateHi = rateLo + rng() * 0.1;
    const daily = makeDailyBalances(n, balance);
    const lo = compute({ daily_balances: daily, core_reported_accruals: [], product_terms: fixedTerms(rateLo, 'actual/365', 'none') }).output_payload;
    const hi = compute({ daily_balances: daily, core_reported_accruals: [], product_terms: fixedTerms(rateHi, 'actual/365', 'none') }).output_payload;
    checked++;
    if (hi.total_recomputed_accrual_cents < lo.total_recomputed_accrual_cents) violations++;
  }
  return { name: 'PA3_monotone_in_rate', checked, violations };
}

// PA4: VERDICT CONSISTENCY — INDETERMINATE iff core_reported_accruals is empty; MATCHES iff
// first_divergence is null and there is at least one core posting; DIVERGES iff first_divergence
// is non-null.
function checkPA4_verdictConsistency() {
  const rng = mulberry32(661004);
  let checked = 0, violations = 0;
  for (let i = 0; i < 2000; i++) {
    const n = randInt(rng, 1, 30);
    const balance = randInt(rng, 0, 20_000_000);
    const rate = rng() * 0.1;
    const daily = makeDailyBalances(n, balance);
    const pt = fixedTerms(rate, 'actual/365', 'none');
    const recomputed = compute({ daily_balances: daily, core_reported_accruals: [], product_terms: pt }).output_payload.total_recomputed_accrual_cents;
    const postCore = rng() < 0.5;
    const noise = randInt(rng, -5, 5);
    const core = postCore ? [{ date: daily[daily.length - 1].date, amount_cents: recomputed + noise }] : [];
    const { output_payload } = compute({ daily_balances: daily, core_reported_accruals: core, product_terms: pt });
    checked++;
    if (!postCore) {
      if (output_payload.verdict !== 'INDETERMINATE' || output_payload.first_divergence !== null) violations++;
    } else if (noise === 0) {
      if (output_payload.verdict !== 'MATCHES' || output_payload.first_divergence !== null) violations++;
    } else {
      if (output_payload.verdict !== 'DIVERGES' || output_payload.first_divergence === null) violations++;
    }
  }
  return { name: 'PA4_verdict_consistency', checked, violations };
}

// PA5: INVALID-DOMAIN REJECTION — malformed inputs are rejected (valid_input: false,
// verdict INDETERMINATE, empty schedule), never silently coerced to a computed accrual.
function checkPA5_invalidDomainRejection() {
  let checked = 0, violations = 0;
  const daily = makeDailyBalances(3, 100000);
  const goodCore = [];
  const hostileTerms = [
    { day_count_convention: 'bogus', compounding: 'none', rate_type: 'fixed', rate_value: 0.05 },
    { day_count_convention: 'actual/365', compounding: 'weekly', rate_type: 'fixed', rate_value: 0.05 },
    { day_count_convention: 'actual/365', compounding: 'none', rate_type: 'bogus', rate_value: 0.05 },
    { day_count_convention: 'actual/365', compounding: 'none', rate_type: 'fixed', rate_value: -0.01 },
    { day_count_convention: 'actual/365', compounding: 'none', rate_type: 'tiered', tiers: [] },
    null,
  ];
  for (const terms of hostileTerms) {
    const { output_payload } = compute({ daily_balances: daily, core_reported_accruals: goodCore, product_terms: terms });
    checked++;
    if (output_payload.valid_input !== false || output_payload.verdict !== 'INDETERMINATE' || output_payload.schedule.length !== 0) violations++;
  }
  const hostileDaily = [null, undefined, [], [{ date: 'not-a-date', principal_balance_cents: 1 }], [{ date: '2026-01-01', principal_balance_cents: -1 }]];
  for (const d of hostileDaily) {
    const { output_payload } = compute({ daily_balances: d, core_reported_accruals: goodCore, product_terms: fixedTerms(0.05, 'actual/365', 'none') });
    checked++;
    if (output_payload.valid_input !== false) violations++;
  }
  return { name: 'PA5_invalid_domain_rejection_never_silently_computed', checked, violations };
}

// PA6: DETERMINISM — recomputing the same policy_parameters yields a byte-identical payload.
function checkPA6_determinism() {
  const rng = mulberry32(661006);
  let checked = 0, violations = 0;
  for (let i = 0; i < 500; i++) {
    const n = randInt(rng, 1, 20);
    const balance = randInt(rng, 0, 10_000_000);
    const daily = makeDailyBalances(n, balance);
    const core = rng() < 0.5 ? [{ date: daily[daily.length - 1].date, amount_cents: randInt(rng, 0, 1000) }] : [];
    const pp = { daily_balances: daily, core_reported_accruals: core, product_terms: fixedTerms(rng() * 0.1, 'actual/365', rng() < 0.5 ? 'daily' : 'none') };
    checked++;
    if (JSON.stringify(compute(pp)) !== JSON.stringify(compute(pp))) violations++;
  }
  return { name: 'PA6_determinism_on_recompute', checked, violations };
}

// PA7: OUTPUT SHAPE — no NaN/undefined/non-finite anywhere, including hostile inputs.
function checkPA7_outputShape() {
  let checked = 0, violations = 0;
  const hostile = [
    {}, null, undefined,
    { daily_balances: [{ date: '2026-01-01', principal_balance_cents: NaN }], core_reported_accruals: [], product_terms: fixedTerms(0.05, 'actual/365', 'none') },
    { daily_balances: [{ date: '2026-01-01', principal_balance_cents: Infinity }], core_reported_accruals: [], product_terms: fixedTerms(0.05, 'actual/365', 'none') },
    { daily_balances: makeDailyBalances(2, 1000), core_reported_accruals: [{ date: '2026-01-02', amount_cents: NaN }], product_terms: fixedTerms(0.05, 'actual/365', 'none') },
    { daily_balances: makeDailyBalances(2, 1000), core_reported_accruals: [], product_terms: { day_count_convention: 'actual/365', compounding: 'none', rate_type: 'fixed', rate_value: NaN } },
    { daily_balances: makeDailyBalances(2, 1000), core_reported_accruals: [], product_terms: { day_count_convention: 'actual/365', compounding: 'none', rate_type: 'fixed', rate_value: Infinity } },
  ];
  for (const pp of hostile) {
    checked++;
    let r;
    try { r = compute(pp); } catch { violations++; continue; }
    if (findShapeViolations(r.output_payload).length) violations++;
    if (typeof r.output_payload.valid_input !== 'boolean') violations++;
  }
  return { name: 'PA7_output_shape_no_nan_undefined_hostile_inputs', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkPA1_sumConsistency(),
  checkPA2_orderIndependence(),
  checkPA3_monotoneInRate(),
  checkPA4_verdictConsistency(),
  checkPA5_invalidDomainRejection(),
  checkPA6_determinism(),
  checkPA7_outputShape(),
];
console.log(`[${KERNEL_ID}] class-A floor property test (day-count/compounding recompute, oracle: declared -- caller contract term).`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
