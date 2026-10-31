// 795-stablecoin-refund-dispute — class-K property-test floor.
// Spec: stablecoin refund/dispute recompute over the pinned Circle Refund Protocol rules
// (commit a7ae494b67ceae4693b416efd52f835d7b53c690, Apache-2.0); pin note
// research/STABLECOIN-REFUND-DISPUTE-PIN-2026-10-30.md. Synthetic data only.
// kernel_digest_at_authoring: sha256:bf959cae3ee8d36fd7d37e5797f50d3e97452293fe37998a415c84aa1d8f05d3
// human_sign_off: PENDING
//
// Run: node chaingraph/kernels/__proptests__/795-stablecoin-refund-dispute.proptest.mjs

import { compute } from '../795-stablecoin-refund-dispute.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = '795-stablecoin-refund-dispute';

const P = (over = {}) => Object.assign(
  { lock_period_seconds: 86400, early_withdrawal_fee_bp: 100, arbiter_role: 'arbiter', partial_refunds_allowed: true },
  over
);
const pay = (o) => Object.assign({ refund_requests: [], arbiter_decisions: [] }, o);

// P1 determinism: same pp => identical payload, twice.
function checkDeterminism() {
  let checked = 0, violations = 0;
  const pps = [
    { profile: 'refund_protocol_a7ae494', params: P(), payments: [pay({ payment_ref: 'd1', amount_minor: 1000, paid_at: 0, reported_state: 'RELEASED', reported_refunded_minor: 0, reported_released_minor: 1000 })] },
    { profile: 'generic', params: P({ as_of_seconds: 100 }), payments: [pay({ payment_ref: 'd2', amount_minor: 500, paid_at: 0, reported_state: 'HELD', reported_refunded_minor: 0, reported_released_minor: 0 })] },
  ];
  for (const pp of pps) {
    const a = compute(pp).output_payload, b = compute(pp).output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'P1-determinism', checked, violations };
}

// P2 conservation identity: for every generated payment, paid == refunded + released + fee + held.
function checkConservation() {
  const rng = mulberry32(79501);
  let checked = 0, violations = 0;
  for (let i = 0; i < 120; i++) {
    const amount = 100 + Math.floor(rng() * 1000000);
    const partial = rng() < 0.5;
    const payments = [pay({
      payment_ref: 'c' + i, amount_minor: amount, paid_at: 0,
      arbiter_decisions: rng() < 0.5 ? [{ at: 10, refund_minor: partial ? Math.floor(amount / 2) : amount }] : [],
      early_withdrawal_at: rng() < 0.3 ? 50 : undefined,
      reported_state: null, reported_refunded_minor: null, reported_released_minor: null,
    })];
    const { output_payload } = compute({ profile: 'generic', params: P({ partial_refunds_allowed: partial }), payments });
    checked++;
    const t = output_payload.conservation.total;
    if (t.refunded_minor + t.released_minor + t.fee_minor + t.held_minor !== t.paid_minor || !t.balanced) violations++;
    for (const per of output_payload.conservation.per_payment) {
      if (per.refunded_minor + per.released_minor + per.fee_minor + per.held_minor !== per.paid_minor || !per.balanced) { violations++; break; }
    }
  }
  return { name: 'P2-conservation-identity', checked, violations };
}

// P3 fee rounding conformance: fee == floor(amount * bp / 10000), released = amount - fee.
function checkFeeRounding() {
  const rng = mulberry32(79502);
  let checked = 0, violations = 0;
  for (let i = 0; i < 80; i++) {
    const amount = 1000 + Math.floor(rng() * 999000);
    const bp = Math.floor(rng() * 10001);
    const { output_payload } = compute({ profile: 'generic', params: P({ early_withdrawal_fee_bp: bp }), payments: [pay({ payment_ref: 'f' + i, amount_minor: amount, paid_at: 0, early_withdrawal_at: 50 })] });
    const e = output_payload.expected[0];
    checked++;
    if (e.terminal_state !== 'EARLY_WITHDRAWN' || e.fee_minor !== Math.floor((amount * bp) / 10000) || e.released_minor !== amount - e.fee_minor) violations++;
  }
  return { name: 'P3-fee-floor-rounding', checked, violations };
}

// P4 invalid-domain rejection: unknown profile, bad params, empty payments, identifier-like refs.
function checkRefusalPaths() {
  let checked = 0, violations = 0;
  const bads = [
    { profile: 'other', params: P(), payments: [pay({ payment_ref: 'x', amount_minor: 100, paid_at: 0 })] },
    { profile: 'generic', params: { lock_period_seconds: -1 }, payments: [pay({ payment_ref: 'x', amount_minor: 100, paid_at: 0 })] },
    { profile: 'generic', params: P({ early_withdrawal_fee_bp: 20000 }), payments: [pay({ payment_ref: 'x', amount_minor: 100, paid_at: 0 })] },
    { profile: 'generic', params: P(), payments: [] },
    { profile: 'generic', params: P(), payments: [pay({ payment_ref: 'x', amount_minor: 100.5, paid_at: 0 })] },
    { profile: 'generic', params: P(), payments: [pay({ payment_ref: '0x' + 'ab'.repeat(40), amount_minor: 100, paid_at: 0 })] },
    { profile: 'generic', params: P(), payments: [pay({ payment_ref: '0x' + '12'.repeat(64), amount_minor: 100, paid_at: 0 })] },
    { profile: 'generic', params: P(), payments: [pay({ payment_ref: 'z'.repeat(48), amount_minor: 100, paid_at: 0 })] },
  ];
  for (const pp of bads) {
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.refused !== true || !output_payload.reason) violations++;
  }
  return { name: 'P4-refusal-paths-reachable', checked, violations };
}

// P5 state machine: lock-open report of RELEASED must break; post-lock clean release must not.
function checkStateMachine() {
  let checked = 0, violations = 0;
  const locked = compute({ profile: 'generic', params: P({ as_of_seconds: 100 }), payments: [pay({ payment_ref: 's1', amount_minor: 1000, paid_at: 0, reported_state: 'RELEASED', reported_refunded_minor: 0, reported_released_minor: 1000 })] }).output_payload;
  checked++;
  if (locked.expected[0].terminal_state !== 'HELD' || locked.breaks.length === 0 || locked.verdict !== 'CONSISTENT_WITH_BREAKS') violations++;
  const open = compute({ profile: 'generic', params: P(), payments: [pay({ payment_ref: 's2', amount_minor: 1000, paid_at: 0, reported_state: 'RELEASED', reported_refunded_minor: 0, reported_released_minor: 1000 })] }).output_payload;
  checked++;
  if (open.expected[0].terminal_state !== 'RELEASED' || open.breaks.length !== 0 || open.verdict !== 'CONSISTENT') violations++;
  const inconv = compute({ profile: 'generic', params: P(), payments: [pay({ payment_ref: 's3', amount_minor: 1000, paid_at: 0, reported_state: 'RELEASED', reported_refunded_minor: 0, reported_released_minor: 5000 })] }).output_payload;
  checked++;
  if (inconv.verdict !== 'INCONSISTENT') violations++;
  const allOrNothing = compute({ profile: 'generic', params: P({ partial_refunds_allowed: false }), payments: [pay({ payment_ref: 's4', amount_minor: 1000, paid_at: 0, arbiter_decisions: [{ at: 5, refund_minor: 400 }] })] }).output_payload;
  checked++;
  if (allOrNothing.expected[0].terminal_state !== 'REFUNDED' || !allOrNothing.breaks.some((b) => b.rule === 'refund_is_all_or_nothing')) violations++;
  return { name: 'P5-state-machine-and-breaks', checked, violations };
}

// P6 output shape: no non-finite values on generated valid domains.
function checkShape() {
  const rng = mulberry32(79503);
  let checked = 0, violations = 0;
  for (let i = 0; i < 60; i++) {
    const payments = [pay({ payment_ref: 'h' + i, amount_minor: 1 + Math.floor(rng() * 100000), paid_at: Math.floor(rng() * 1000), early_withdrawal_at: rng() < 0.3 ? 10 : undefined })];
    const { output_payload } = compute({ profile: 'generic', params: P({ early_withdrawal_fee_bp: Math.floor(rng() * 10001) }), payments });
    checked++;
    violations += findShapeViolations(output_payload).length;
  }
  return { name: 'P6-output-shape-no-nonfinite', checked, violations };
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
  checkConservation(),
  checkFeeRounding(),
  checkRefusalPaths(),
  checkStateMachine(),
  checkShape(),
];
console.log('[' + KERNEL_ID + '] class-K floor property test — stablecoin refund/dispute recompute (synthetic data only).');
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
