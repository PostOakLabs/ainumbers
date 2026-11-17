// 812-eth-staking-queue — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:572c5fe067f787dfd04db12afdff90642261ea262745766d1989302747979106
// spec: research/ETH-STAKING-BUILD-SPEC-AMENDED-2026-11.md (Node B)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/812-eth-staking-queue.proptest.mjs

import { compute } from '../812-eth-staking-queue.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = '812-eth-staking-queue';
const INC = 1000000000n;
const ACT_CAP = 256000000000n;

function rngPP(rng) {
  // 1e15 up to about 1e17 Gwei: spans the churn floor (below 8,388,608 ETH) and the 256-ETH cap.
  const total = BigInt(Math.floor(rng() * 99e6) + 1e6) * INC;
  const prefix = 1 + Math.floor(rng() * 2);
  const maxIncs = prefix === 2 ? 2048 : 32;
  const eb = () => (BigInt(Math.floor(rng() * maxIncs) + 1) * INC).toString();
  const cur = Math.floor(rng() * 1e6);
  const n = Math.floor(rng() * 2e6) + 1;
  const next = Math.floor(rng() * n);
  const target = Math.floor(rng() * n);
  const dist = (target - next + n) % n;
  const count = Math.floor(rng() * 50000);
  return {
    total_active_balance_gwei: total.toString(),
    current_epoch: cur,
    withdrawal_credential_prefix: prefix,
    seconds_per_slot: rng() < 0.5 ? 12 : null,
    exit: {
      state_earliest_exit_epoch: cur + Math.floor(rng() * 20000),
      state_exit_balance_to_consume_gwei: (BigInt(Math.floor(rng() * 256)) * INC).toString(),
      exit_balance_gwei: eb(),
    },
    activation: {
      deposit_balance_to_consume_gwei: (BigInt(Math.floor(rng() * 256)) * INC).toString(),
      pending_deposit_balance_ahead_gwei: count === 0 ? 0 : (BigInt(count) * BigInt(Math.floor(rng() * 64) + 1) * INC).toString(),
      pending_deposit_count_ahead: count,
      deposit_amount_gwei: eb(),
      finality_lag_epochs: Math.floor(rng() * 10),
    },
    sweep: {
      validator_count: n,
      next_withdrawal_validator_index: next,
      target_validator_index: target,
      withdrawable_count_ahead: Math.floor(rng() * (dist + 1)),
      prior_withdrawals_per_slot: Math.floor(rng() * 16),
    },
  };
}

const N = 400;

function checkDeterminismAndShape() {
  const rng = mulberry32(812);
  let v = 0;
  for (let i = 0; i < N; i++) {
    const pp = rngPP(rng);
    const a = compute(pp);
    const b = compute(JSON.parse(JSON.stringify(pp)));
    if (!deepEqual(a, b)) v++;
    if (a.output_payload.refused !== false || a.compliance_flags.length !== 0) v++;
  }
  return { name: 'deterministic_and_in_domain_inputs_accepted', checked: N, violations: v };
}

function checkChurnIdentities() {
  const rng = mulberry32(2);
  let v = 0;
  for (let i = 0; i < N; i++) {
    const o = compute(rngPP(rng)).output_payload;
    const bal = BigInt(o.balance_churn_limit_gwei);
    const act = BigInt(o.activation_exit_churn_limit_gwei);
    const cons = BigInt(o.consolidation_churn_limit_gwei);
    if (bal % INC !== 0n || bal < 128000000000n) v++;
    if (act > ACT_CAP || act > bal || cons !== bal - act) v++;
    if (o.activation_exit_churn_at_cap !== (act === ACT_CAP)) v++;
  }
  return { name: 'churn_limits_floor_cap_and_split', checked: N, violations: v };
}

function checkExitQueue() {
  // Exit lands no earlier than the lookahead and the declared queue head, withdrawable is +256,
  // and a larger exit never lands earlier than a smaller one from the same state.
  const rng = mulberry32(3);
  let v = 0;
  for (let i = 0; i < N; i++) {
    const pp = rngPP(rng);
    const o = compute(pp).output_payload;
    const e = BigInt(o.exit_epoch);
    const floor = BigInt(pp.current_epoch) + 5n;
    if (e < floor || e < BigInt(pp.exit.state_earliest_exit_epoch)) v++;
    if (BigInt(o.withdrawable_epoch) !== e + 256n) v++;
    if (BigInt(o.exit_balance_to_consume_after_gwei) < 0n) v++;
    const bigger = JSON.parse(JSON.stringify(pp));
    bigger.withdrawal_credential_prefix = 2;
    bigger.exit.exit_balance_gwei = '2048000000000';
    if (BigInt(compute(bigger).output_payload.exit_epoch) < e) v++;
  }
  return { name: 'exit_epoch_floor_withdrawable_and_monotone', checked: N, violations: v };
}

function checkActivation() {
  const rng = mulberry32(4);
  let v = 0;
  for (let i = 0; i < N; i++) {
    const pp = rngPP(rng);
    const o = compute(pp).output_payload;
    const a = pp.activation;
    const applied = BigInt(o.deposit_applied_epoch);
    const cur = BigInt(pp.current_epoch);
    if (applied < cur) v++;
    if (BigInt(o.activation_epoch) - applied !== 7n + BigInt(a.finality_lag_epochs)) v++;
    if (BigInt(o.activation_wait_epochs) !== BigInt(o.activation_epoch) - cur) v++;
    // At most 16 deposits per epoch: the epochs used cover every deposit ahead plus this one.
    if ((applied - cur + 1n) * 16n < BigInt(a.pending_deposit_count_ahead) + 1n) v++;
  }
  return { name: 'activation_offsets_and_deposit_count_limit', checked: N, violations: v };
}

function checkSweep() {
  const rng = mulberry32(5);
  let v = 0;
  for (let i = 0; i < N; i++) {
    const pp = rngPP(rng);
    const o = compute(pp).output_payload;
    const s = pp.sweep;
    const slots = BigInt(o.sweep_slots_to_target);
    const n = BigInt(s.validator_count);
    const dist = (BigInt(s.target_validator_index) - BigInt(s.next_withdrawal_validator_index) + n) % n;
    if (slots < 1n || slots * 16384n <= dist) v++;
    if (slots * (16n - BigInt(s.prior_withdrawals_per_slot)) < BigInt(s.withdrawable_count_ahead) + 1n) v++;
    if (o.sweep_slots_is_lower_bound !== !(s.withdrawable_count_ahead === 0 && s.prior_withdrawals_per_slot === 0)) v++;
    if ((pp.seconds_per_slot === null) !== (o.seconds_to_sweep_target === null)) v++;
  }
  return { name: 'sweep_scan_and_payload_bounds', checked: N, violations: v };
}

function checkSeededRefusals() {
  const base = rngPP(mulberry32(6));
  const clone = () => JSON.parse(JSON.stringify(base));
  /** @type {Array<[string, (p: any) => void]>} */
  const cases = [
    ['NON_NEGATIVE_INTEGER_INPUTS', (p) => { p.current_epoch = -1; }],
    ['NON_NEGATIVE_INTEGER_INPUTS', (p) => { p.exit = 'x'; }],
    ['UINT64_RANGE', (p) => { p.total_active_balance_gwei = '18446744073709551616'; }],
    ['TOTAL_ACTIVE_BALANCE_ZERO', (p) => { p.total_active_balance_gwei = 0; }],
    ['UNKNOWN_WITHDRAWAL_PREFIX', (p) => { p.withdrawal_credential_prefix = 7; }],
    ['EFFECTIVE_BALANCE_EXCEEDS_MAXEB', (p) => { p.withdrawal_credential_prefix = 1; p.exit.exit_balance_gwei = '33000000000'; }],
    ['EFFECTIVE_BALANCE_NOT_INCREMENT_MULTIPLE', (p) => { p.withdrawal_credential_prefix = 1; p.exit.exit_balance_gwei = '1500000000'; }],
    ['PRIOR_WITHDRAWALS_OUT_OF_RANGE', (p) => { p.sweep.prior_withdrawals_per_slot = 16; }],
    ['TARGET_INDEX_OUT_OF_RANGE', (p) => { p.sweep.target_validator_index = p.sweep.validator_count; }],
    ['DEPOSIT_COUNT_BALANCE_MISMATCH', (p) => { p.activation.pending_deposit_count_ahead = 0; p.activation.pending_deposit_balance_ahead_gwei = '1000000000'; }],
    ['WITHDRAWABLE_AHEAD_EXCEEDS_DISTANCE', (p) => { p.sweep.next_withdrawal_validator_index = 0; p.sweep.target_validator_index = 0; p.sweep.withdrawable_count_ahead = 1; }],
    ['CONSOLIDATION_CHURN_ZERO', (p) => {
      p.total_active_balance_gwei = '5000000000000000';
      p.consolidation = { state_earliest_consolidation_epoch: 0, state_consolidation_balance_to_consume_gwei: 0, consolidation_balance_gwei: '32000000000' };
    }],
  ];
  let v = 0;
  for (const [code, mutate] of cases) {
    const p = clone();
    mutate(p);
    const r = compute(p);
    if (r.output_payload.refusal_code !== code || !deepEqual(r.compliance_flags, ['INPUT_REFUSED'])) v++;
  }
  return { name: 'each_refusal_branch_reachable', checked: cases.length, violations: v };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDeterminismAndShape(),
  checkChurnIdentities(),
  checkExitQueue(),
  checkActivation(),
  checkSweep(),
  checkSeededRefusals(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
