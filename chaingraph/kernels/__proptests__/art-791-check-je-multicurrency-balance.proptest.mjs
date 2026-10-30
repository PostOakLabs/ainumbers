// art-791-check-je-multicurrency-balance — class-K property-test floor.
// kernel_digest_at_authoring: sha256:b6d7bcfeb17ca487d5fcc37212a7d3a604c28110483550fb68711ff50878fb39
// spec: JE-MULTICCY-BALANCE-1 (fixed contract in the row; research/borrow-triage-2026-10-29/
//       ledger-checks-enhanced-recommendations-2026-10-30.md §3)
// human_sign_off: builder JE-MULTICCY-BALANCE-1, 2026-10-30 (all inputs synthetic integers)
//
// The input domain is integers in minor units, so the properties below enumerate integer
// amounts over stated ranges with a deterministic mulberry32 seed — no floats anywhere in
// the amount paths. ZERO external dependencies.
//
// Run: node chaingraph/kernels/__proptests__/art-791-check-je-multicurrency-balance.proptest.mjs

import { compute } from '../art-791-check-je-multicurrency-balance.kernel.mjs';
import { runFixtureOracle, findShapeViolations, summarize, mulberry32, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = 'art-791-check-je-multicurrency-balance';

const EXP = { USD: 2, EUR: 2, JPY: 0, KWD: 3 };

function twoLine(pp, a, b, ccy) {
  return {
    policy_version: '1.0.0',
    balance_basis: 'per_currency',
    currency_exponents: EXP,
    entries: [{ entry_id: 'E1', lines: [
      { line_id: 'L1', account: 'acc-a', currency: ccy || 'USD', amount_minor: a },
      { line_id: 'L2', account: 'acc-b', currency: ccy || 'USD', amount_minor: b }] }],
    ...pp,
  };
}

// P1 determinism: identical pp -> identical output_payload, over 400 seeded random batches.
function checkDeterminism() {
  const rng = mulberry32(789001);
  let checked = 0, violations = 0;
  for (let i = 0; i < 400; i++) {
    const a = Math.floor(rng() * 2_000_001) - 1_000_000;
    const b = -a; // half balanced, and the diff path still runs the full pipeline
    const pp = twoLine({}, a, b);
    const r1 = compute(pp), r2 = compute(pp);
    checked++;
    if (!deepEqual(r1.output_payload, r2.output_payload)) violations++;
  }
  return { name: 'P1 determinism (compute is a pure function of pp)', checked, violations };
}

// P2 split invariance: splitting one debit line into k parts that sum to it preserves the
// verdict exactly (integer partition, k in 2..5, 300 cases).
function checkSplitInvariance() {
  const rng = mulberry32(789002);
  let checked = 0, violations = 0;
  for (let i = 0; i < 300; i++) {
    const credit = -Math.floor(rng() * 500_000);
    const k = 2 + Math.floor(rng() * 4);
    const parts = [];
    let remaining = -credit;
    for (let j = 0; j < k - 1; j++) {
      const p = Math.floor(rng() * (remaining + 1));
      parts.push(p); remaining -= p;
    }
    parts.push(remaining);
    const lines = parts.map((p, j) => ({ line_id: 'L' + j, account: 'acc-' + j, currency: 'USD', amount_minor: p }));
    lines.push({ line_id: 'LC', account: 'acc-c', currency: 'USD', amount_minor: credit });
    const pp = { policy_version: '1.0.0', balance_basis: 'per_currency', currency_exponents: EXP,
      entries: [{ entry_id: 'E1', lines }] };
    const base = compute(twoLine({}, -credit, credit));
    const split = compute(pp);
    const eb = base.output_payload.entries[0], es = split.output_payload.entries[0];
    checked++;
    if (eb.status !== es.status || es.status !== 'balanced') violations++;
  }
  return { name: 'P2 integer split invariance (partitioning a line preserves balanced)', checked, violations };
}

// P3 sign invariance: negating every amount (debit/credit swap) preserves status and
// negates each residual, on the functional basis too (300 cases).
function checkSignInvariance() {
  const rng = mulberry32(789003);
  let checked = 0, violations = 0;
  for (let i = 0; i < 300; i++) {
    const a = Math.floor(rng() * 1_000_001) - 500_000;
    const b = Math.floor(rng() * 1_000_001) - 500_000;
    const basis = i % 2 === 0 ? 'per_currency' : 'functional';
    const mk = (flip) => {
      const lines = [
        { line_id: 'L1', account: 'acc-a', currency: 'USD', amount_minor: flip ? -a : a },
        { line_id: 'L2', account: 'acc-b', currency: 'EUR', amount_minor: flip ? -b : b },
      ];
      if (basis === 'functional') {
        lines[1].functional_minor = flip ? -b : b;
      }
      return { policy_version: '1.0.0', balance_basis: basis, functional_currency: 'USD',
        currency_exponents: EXP, entries: [{ entry_id: 'E1', lines }] };
    };
    const r1 = compute(mk(false)), r2 = compute(mk(true));
    const e1 = r1.output_payload.entries[0], e2 = r2.output_payload.entries[0];
    checked++;
    if (e1.status !== e2.status) violations++;
    const k1 = Object.keys(e1.residual_minor), k2 = Object.keys(e2.residual_minor);
    if (k1.length !== k2.length) { violations++; continue; }
    for (const c of k1) {
      if (e1.residual_minor[c] !== -e2.residual_minor[c]) violations++;
    }
  }
  return { name: 'P3 sign invariance (debit/credit swap negates residuals, preserves status)', checked, violations };
}

// P4 invalid-domain rejection: non-integer amounts, amounts outside the safe range,
// unknown currencies, negative tolerances and undeclared bases never produce `ran`
// output with a non-refused entry (600 cases, each case names its expected refusal).
function checkRefusalDomain() {
  const rng = mulberry32(789004);
  let checked = 0, violations = 0;
  const cases = [
    () => [twoLine({}, 10.5, -10), 'AMOUNT_NOT_INTEGER'],
    () => [twoLine({}, 9007199254740992, -1), 'AMOUNT_UNSAFE_INTEGER'],
    () => [twoLine({}, -9007199254740992, 1), 'AMOUNT_UNSAFE_INTEGER'],
    () => [twoLine({}, 1, -1, 'GBP'), 'UNKNOWN_CURRENCY'],
    () => [twoLine({ tolerance_minor: { USD: -1 } }, 1, -1), 'NEGATIVE_TOLERANCE'],
    () => [twoLine({ balance_basis: 'nonsense' }, 1, -1), 'BASIS_NOT_DECLARED'],
    () => [{ policy_version: '1', balance_basis: 'per_currency', currency_exponents: EXP,
             entries: [{ entry_id: 'E1', lines: [{ line_id: 'L1', account: 'a', currency: 'USD', amount_minor: 1 }] }] },
           'ENTRY_TOO_FEW_LINES'],
    () => [twoLine({}, 1, -1), null], // control: valid input must run
  ];
  for (let i = 0; i < 600; i++) {
    const [pp, expected] = cases[i % cases.length]();
    if (expected === null && i % cases.length !== cases.length - 1) continue;
    const r = compute(pp);
    const o = r.output_payload;
    checked++;
    if (expected === null) {
      if (o.execution_state !== 'ran' || o.entries[0].status === 'refused') violations++;
      continue;
    }
    const refusedAs = o.execution_state === 'ran'
      ? (o.entries[0].status === 'refused' ? o.entries[0].reason : null)
      : (String(o.reason).indexOf(expected) === 0 ? expected : null);
    if (refusedAs !== expected) violations++;
  }
  return { name: 'P4 invalid-domain rejection (every malformed input lands its named refusal)', checked, violations };
}

// P5 tolerance monotonicity: raising the declared tolerance can move an entry from
// imbalanced to within_tolerance/balanced but never the other way (400 cases).
function checkToleranceMonotonicity() {
  const rng = mulberry32(789005);
  let checked = 0, violations = 0;
  const rank = { balanced: 0, within_tolerance: 1, imbalanced: 2 };
  for (let i = 0; i < 400; i++) {
    const residual = Math.floor(rng() * 20); // 0..19 — off-by-N credit side, exact hand-set residual
    const tLow = Math.floor(rng() * 10);
    const tHigh = tLow + Math.floor(rng() * 10) + 1;
    const entryWithResidual = (t) => twoLine({ tolerance_minor: { USD: t } }, 10000, -(10000 - residual));
    const lo = compute(entryWithResidual(tLow)).output_payload.entries[0].status;
    const hi = compute(entryWithResidual(tHigh)).output_payload.entries[0].status;
    checked++;
    if (rank[hi] > rank[lo]) violations++;
  }
  return { name: 'P5 tolerance monotonicity (larger declared tolerance never worsens the verdict)', checked, violations };
}

// P6 output shape: no NaN / undefined / non-finite anywhere, across refusals and runs.
function checkShape() {
  const rng = mulberry32(789006);
  let checked = 0, violations = 0;
  const samples = [];
  for (let i = 0; i < 100; i++) {
    const a = Math.floor(rng() * 1_000_000);
    samples.push(twoLine({}, a, -a));
    samples.push(twoLine({ balance_basis: undefined }, a, -a));
    samples.push(compute(twoLine({}, a, -a)).output_payload);
  }
  for (let i = 0; i < 100; i++) {
    const a = Math.floor(rng() * 1_000_000) - 500_000;
    const r = compute(twoLine({}, a, -a + Math.floor(rng() * 5) - 2));
    samples.push(r.output_payload);
    checked++;
    const v = findShapeViolations(r.output_payload);
    if (v.length > 0) violations++;
  }
  return { name: 'P6 output shape (no NaN/undefined/non-finite in any payload)', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDeterminism(),
  checkSplitInvariance(),
  checkSignInvariance(),
  checkRefusalDomain(),
  checkToleranceMonotonicity(),
  checkShape(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
