// art-664-loan-servicing-waterfall-recompute.proptest.mjs — class-K property-test FLOOR
// (CORE-VERIFY-LOANWFALL-1, CORE-VERIFY-BUILD-SPEC.md §5).
// kernel_digest_at_authoring: sha256:a5294931be53b050f99b64e583ecf46c561050b194b01b0a27b92cec2c735a78
// spec: CORE-VERIFY-BUILD-SPEC.md §5
// human_sign_off: PENDING
//
// SCOPE: floor tier (FV-PBT-FLOOR-BUILD-SPEC.md). Kernel is pure integer minor-units arithmetic
// (fixed-point money, no floats, no transcendentals) — float_sensitive: NO, no rounding_steps.
//
// P0  fixture oracle — every pinned vector in fixtures.json reproduces byte-for-byte.
// P1  conservation: whenever inputs are ready, sum(computed_applied_by_bucket) + unapplied_remainder
//     === payment_amount, for every randomized valid input.
// P2  bucket cap: no bucket's computed applied amount ever exceeds its declared owed balance.
// P3  waterfall priority: once a bucket in the declared order receives less than its full owed
//     balance (i.e. the payment ran out inside it), every later bucket in the order receives 0 —
//     the cascade never skips ahead.
// P4  determinism: compute() twice on identical input is byte-identical.
// P5  totality: compute() never throws, across random valid input AND hostile/malformed input.
// P6  missing-input indeterminacy: any of application_order / payment_amount / a declared bucket's
//     balance / core_applied being absent forces verdict INDETERMINATE, never a guessed MATCHES.
// P7  verdict correctness: given ready inputs and a present core_applied with every diffed bucket
//     valid, verdict is MATCHES iff every per-bucket delta is 0, else DIVERGES.
// P8  diff union completeness: every bucket key core_applied names appears in per_bucket_deltas,
//     even when it is outside the declared application_order (computed side reported as 0).
// P9  output shape: no NaN/undefined/non-finite value anywhere in output_payload, across the
//     nasty-value discovery leg.
//
// Zero external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-664-loan-servicing-waterfall-recompute.proptest.mjs

import { compute } from '../art-664-loan-servicing-waterfall-recompute.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations, runDiscoveryLeg } from './_pbt-common.mjs';

const KERNEL_ID = 'art-664-loan-servicing-waterfall-recompute';
const rand = mulberry32(0x664);

const BUCKET_NAMES = ['late_fee', 'escrow_shortage', 'escrow', 'interest', 'principal'];

function randomOrder() {
  const n = 1 + Math.floor(rand() * BUCKET_NAMES.length);
  const pool = [...BUCKET_NAMES];
  const order = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rand() * pool.length);
    order.push(pool.splice(idx, 1)[0]);
  }
  return order;
}

function randomValidPP() {
  const order = randomOrder();
  const bucket_balances = {};
  for (const b of order) bucket_balances[b] = Math.floor(rand() * 100000);
  const totalOwed = order.reduce((s, b) => s + bucket_balances[b], 0);
  // sometimes underpay, sometimes exactly pay, sometimes overpay
  const mode = rand();
  const payment_amount = mode < 0.34
    ? Math.floor(rand() * totalOwed)
    : mode < 0.67
      ? totalOwed
      : totalOwed + Math.floor(rand() * 5000);
  return { application_order: order, bucket_balances, payment_amount };
}

// ---------- P0: fixture oracle ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}

// ---------- P1: conservation ----------
function checkP1_conservation() {
  let checked = 0, violations = 0;
  const examples = [];
  for (let t = 0; t < 300; t++) {
    const pp = randomValidPP();
    checked++;
    const { output_payload: op } = compute(pp);
    const sumApplied = Object.values(op.computed_applied_by_bucket).reduce((s, v) => s + v, 0);
    const total = sumApplied + op.unapplied_remainder;
    if (total !== pp.payment_amount) { violations++; if (examples.length < 3) examples.push({ pp, op, total }); }
  }
  return { name: 'P1_conservation', checked, violations, examples };
}

// ---------- P2: bucket cap ----------
function checkP2_bucket_cap() {
  let checked = 0, violations = 0;
  const examples = [];
  for (let t = 0; t < 300; t++) {
    const pp = randomValidPP();
    checked++;
    const { output_payload: op } = compute(pp);
    for (const b of pp.application_order) {
      if (op.computed_applied_by_bucket[b] > pp.bucket_balances[b]) {
        violations++;
        if (examples.length < 3) examples.push({ pp, bucket: b, applied: op.computed_applied_by_bucket[b], owed: pp.bucket_balances[b] });
      }
    }
  }
  return { name: 'P2_bucket_cap', checked, violations, examples };
}

// ---------- P3: waterfall priority (no skip-ahead) ----------
function checkP3_priority_cascade() {
  let checked = 0, violations = 0;
  const examples = [];
  for (let t = 0; t < 300; t++) {
    const pp = randomValidPP();
    checked++;
    const { output_payload: op } = compute(pp);
    let sawShortfall = false;
    for (const b of pp.application_order) {
      const applied = op.computed_applied_by_bucket[b];
      const owed = pp.bucket_balances[b];
      if (sawShortfall && applied !== 0) { violations++; if (examples.length < 3) examples.push({ pp, op }); break; }
      if (applied < owed) sawShortfall = true;
    }
  }
  return { name: 'P3_priority_cascade_no_skip_ahead', checked, violations, examples };
}

// ---------- P4: determinism ----------
function checkP4_determinism() {
  let checked = 0, violations = 0;
  for (let t = 0; t < 200; t++) {
    const pp = randomValidPP();
    checked++;
    const r1 = JSON.stringify(compute(pp));
    const r2 = JSON.stringify(compute(pp));
    if (r1 !== r2) violations++;
  }
  return { name: 'P4_determinism', checked, violations };
}

// ---------- P5: totality (never throws) — random valid + nasty discovery leg ----------
function checkP5_totality() {
  let checked = 0, violations = 0;
  const examples = [];
  for (let t = 0; t < 200; t++) {
    const pp = randomValidPP();
    checked++;
    try { compute(pp); } catch (e) { violations++; if (examples.length < 3) examples.push({ pp, error: String((e && e.message) || e) }); }
  }
  const baseline = randomValidPP();
  const findings = runDiscoveryLeg(KERNEL_ID, compute, baseline, rand);
  for (const f of findings) {
    checked++;
    if (f.outcome.kind === 'threw') { violations++; if (examples.length < 3) examples.push(f); }
  }
  return { name: 'P5_totality_never_throws', checked, violations, examples };
}

// ---------- P6: missing-input indeterminacy ----------
function checkP6_missing_input_indeterminacy() {
  let checked = 0, violations = 0;
  const examples = [];
  const base = { application_order: ['late_fee', 'principal'], bucket_balances: { late_fee: 100, principal: 900 }, payment_amount: 1000, core_applied: { late_fee: 100, principal: 900 } };

  const cases = [
    { ...base, application_order: undefined },
    { ...base, application_order: [] },
    { ...base, payment_amount: undefined },
    { ...base, payment_amount: -1 },
    { ...base, payment_amount: 1.5 },
    { ...base, bucket_balances: { late_fee: 100 } }, // principal balance missing
    { ...base, core_applied: undefined },
    { ...base, core_applied: { late_fee: 100 } }, // principal missing from core_applied
  ];
  for (const pp of cases) {
    checked++;
    const { output_payload: op } = compute(pp);
    if (op.verdict !== 'INDETERMINATE') { violations++; if (examples.length < 3) examples.push({ pp, verdict: op.verdict }); }
  }
  return { name: 'P6_missing_input_forces_indeterminate', checked, violations, examples };
}

// ---------- P7: verdict correctness given ready inputs + full core_applied ----------
function checkP7_verdict_correctness() {
  let checked = 0, violations = 0;
  const examples = [];
  for (let t = 0; t < 300; t++) {
    const pp = randomValidPP();
    const { output_payload: base } = compute(pp);
    // build a core_applied that sometimes matches, sometimes perturbs one bucket
    const core_applied = { ...base.computed_applied_by_bucket };
    const perturb = rand() < 0.5;
    let expectedVerdict = 'MATCHES';
    if (perturb && pp.application_order.length) {
      const b = pp.application_order[Math.floor(rand() * pp.application_order.length)];
      core_applied[b] = core_applied[b] + (1 + Math.floor(rand() * 50));
      expectedVerdict = 'DIVERGES';
    }
    checked++;
    const { output_payload: op } = compute({ ...pp, core_applied });
    if (op.verdict !== expectedVerdict) { violations++; if (examples.length < 3) examples.push({ pp, core_applied, got: op.verdict, want: expectedVerdict }); }
  }
  return { name: 'P7_verdict_matches_iff_all_deltas_zero', checked, violations, examples };
}

// ---------- P8: diff union completeness ----------
function checkP8_diff_union_completeness() {
  let checked = 0, violations = 0;
  const examples = [];
  for (let t = 0; t < 200; t++) {
    const pp = randomValidPP();
    const core_applied = { ...pp.bucket_balances, extra_undeclared_bucket: 1 + Math.floor(rand() * 1000) };
    checked++;
    const { output_payload: op } = compute({ ...pp, core_applied });
    const seen = new Set(op.per_bucket_deltas.map((d) => d.bucket));
    if (!seen.has('extra_undeclared_bucket')) { violations++; if (examples.length < 3) examples.push({ pp, op }); continue; }
    const extraDelta = op.per_bucket_deltas.find((d) => d.bucket === 'extra_undeclared_bucket');
    if (extraDelta.in_declared_order !== false || extraDelta.computed_applied !== 0) { violations++; if (examples.length < 3) examples.push({ pp, extraDelta }); }
  }
  return { name: 'P8_diff_union_includes_undeclared_core_buckets', checked, violations, examples };
}

// ---------- P9: output shape (no NaN/undefined) over the nasty discovery leg ----------
function checkP9_output_shape() {
  const baseline = randomValidPP();
  const findings = runDiscoveryLeg(KERNEL_ID, compute, baseline, rand);
  let violations = 0;
  const examples = [];
  for (const f of findings) {
    if (f.outcome.kind === 'shape_violation') { violations++; if (examples.length < 3) examples.push(f); }
  }
  // also sweep the fixture + random-valid outputs directly
  let checked = findings.length;
  for (let t = 0; t < 100; t++) {
    const pp = randomValidPP();
    checked++;
    const { output_payload } = compute(pp);
    const v = findShapeViolations(output_payload);
    if (v.length) { violations++; if (examples.length < 3) examples.push({ pp, v }); }
  }
  return { name: 'P9_output_shape_no_nan_undefined', checked, violations, examples };
}

const properties = [
  checkP1_conservation(),
  checkP2_bucket_cap(),
  checkP3_priority_cascade(),
  checkP4_determinism(),
  checkP5_totality(),
  checkP6_missing_input_indeterminacy(),
  checkP7_verdict_correctness(),
  checkP8_diff_union_completeness(),
  checkP9_output_shape(),
];

const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
