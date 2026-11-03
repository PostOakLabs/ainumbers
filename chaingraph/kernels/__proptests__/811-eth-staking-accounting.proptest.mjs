// 811-eth-staking-accounting — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:d120eae81c8aad743f06509022f822af7d4f6edbba6215ff0c54c40c016eb14e
// spec: research/ETH-STAKING-BUILD-SPEC-AMENDED-2026-11.md (Node A)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/811-eth-staking-accounting.proptest.mjs

import { compute } from '../811-eth-staking-accounting.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = '811-eth-staking-accounting';
const INC = 1000000000n;

function rngPP(rng) {
  const total = BigInt(Math.floor(rng() * 1e7) + 1000) * 1000n * INC; // 1e15 up to about 1e19 Gwei, inside Uint64
  const incs = Math.floor(rng() * 64) + 1;
  const prefix = Math.floor(rng() * 3);
  const maxIncs = prefix === 2 ? 2048 : 32;
  const eb = BigInt(Math.min(incs, maxIncs)) * INC;
  const part = () => (BigInt(Math.floor(rng() * 1000)) * total) / 1000n;
  const slotsCounted = Math.floor(rng() * 33);
  return {
    effective_balance_gwei: eb.toString(),
    withdrawal_credential_prefix: prefix,
    total_active_balance_gwei: total.toString(),
    participation: { timely_source: rng() < 0.5, timely_target: rng() < 0.5, timely_head: rng() < 0.5 },
    unslashed_participating_balance_gwei: [part().toString(), part().toString(), part().toString()],
    in_inactivity_leak: rng() < 0.5,
    inactivity_score: Math.floor(rng() * 200),
    sync: { in_sync_committee: rng() < 0.5, slots_counted: slotsCounted, slots_set: Math.floor(rng() * (slotsCounted + 1)) },
    slashing: {
      is_slashed: rng() < 0.3,
      slashings_sum_gwei: (BigInt(Math.floor(rng() * 1000)) * total * 3n / 2000n).toString(),
      slash_epoch: Math.floor(rng() * 1e6), exit_epoch: Math.floor(rng() * 1e6),
    },
  };
}

const N = 400;

function checkDeterminismAndShape() {
  const rng = mulberry32(811);
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

function checkFlagRewardBounds() {
  // Each flag reward <= base_reward * weight / 64 (participation ratio <= 1); head never penalized.
  const rng = mulberry32(2);
  const W = [14n, 26n, 14n];
  let v = 0;
  for (let i = 0; i < N; i++) {
    const o = compute(rngPP(rng)).output_payload;
    const base = BigInt(o.base_reward_gwei);
    for (let k = 0; k < 3; k++) {
      if (BigInt(o.flag_rewards_gwei[k]) > (base * W[k]) / 64n) v++;
      if (BigInt(o.flag_rewards_gwei[k]) > 0n && BigInt(o.flag_penalties_gwei[k]) > 0n) v++;
    }
    if (o.flag_penalties_gwei[2] !== '0') v++;
  }
  return { name: 'flag_reward_bounded_and_head_never_penalized', checked: N, violations: v };
}

function checkInactivityScoreRules() {
  const rng = mulberry32(3);
  let v = 0;
  for (let i = 0; i < N; i++) {
    const pp = rngPP(rng);
    const o = compute(pp).output_payload;
    const before = BigInt(pp.inactivity_score);
    const after = BigInt(o.inactivity_score_after);
    const missed = !pp.participation.timely_target;
    if (missed && pp.in_inactivity_leak && after !== before + 4n) v++;
    if (!missed && pp.in_inactivity_leak && after !== (before > 0n ? before - 1n : 0n)) v++;
    if (!pp.in_inactivity_leak && after > before + 4n) v++;
    if (!missed && o.inactivity_penalty_gwei !== '0') v++;
    if (missed && after > 0n && o.inactivity_penalty_gwei !== null) v++;
  }
  return { name: 'inactivity_score_update_rules', checked: N, violations: v };
}

function checkSlashingInvariants() {
  const rng = mulberry32(4);
  let v = 0;
  for (let i = 0; i < N; i++) {
    const pp = rngPP(rng);
    const o = compute(pp).output_payload;
    const eb = BigInt(pp.effective_balance_gwei);
    if (!pp.slashing.is_slashed) {
      if (o.initial_slashing_penalty_gwei !== '0' || o.correlated_penalty_epoch !== null) v++;
      continue;
    }
    if (BigInt(o.initial_slashing_penalty_gwei) !== eb / 4096n) v++;
    if (BigInt(o.proposer_slashing_reward_gwei) > BigInt(o.whistleblower_reward_gwei)) v++;
    const total = BigInt(pp.total_active_balance_gwei);
    const whole = BigInt(pp.slashing.slashings_sum_gwei) >= total;
    if (whole && BigInt(o.correlated_penalty_gwei) > eb + total) v++;
    if (!whole && o.correlated_penalty_gwei !== null) v++;
    if (whole !== !o.pending_pin.includes('correlated_penalty_gwei')) v++;
  }
  return { name: 'slashing_invariants_and_pending_pin', checked: N, violations: v };
}

function checkSeededRefusals() {
  const base = rngPP(mulberry32(5));
  const clone = () => JSON.parse(JSON.stringify(base));
  /** @type {Array<[string, (p: any) => void]>} */
  const cases = [
    ['UINT64_RANGE', (p) => { p.total_active_balance_gwei = '18446744073709551616'; }],
    ['UNKNOWN_WITHDRAWAL_PREFIX', (p) => { p.withdrawal_credential_prefix = 7; }],
    ['TOTAL_ACTIVE_BALANCE_ZERO', (p) => { p.total_active_balance_gwei = 0; p.unslashed_participating_balance_gwei = [0, 0, 0]; }],
    ['EFFECTIVE_BALANCE_NOT_INCREMENT_MULTIPLE', (p) => { p.effective_balance_gwei = '1500000000'; p.withdrawal_credential_prefix = 1; }],
    ['EFFECTIVE_BALANCE_EXCEEDS_MAXEB', (p) => { p.effective_balance_gwei = '2049000000000'; p.withdrawal_credential_prefix = 2; }],
    ['PARTICIPATING_EXCEEDS_TOTAL', (p) => { p.unslashed_participating_balance_gwei = [p.total_active_balance_gwei, p.total_active_balance_gwei, '18446744073709551615']; }],
    ['SLOTS_COUNTED_EXCEEDS_EPOCH', (p) => { p.sync.slots_counted = 33; p.sync.slots_set = 0; }],
    ['INCLUSION_LIST_TOO_LONG', (p) => { p.inclusion_attestations = Array.from({ length: 65 }, () => ({ effective_balance_gwei: '32000000000', newly_set_flags: [true, false, false] })); }],
    ['NON_NEGATIVE_INTEGER_INPUTS', (p) => { p.inactivity_score = -1; }],
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
  checkFlagRewardBounds(),
  checkInactivityScoreRules(),
  checkSlashingInvariants(),
  checkSeededRefusals(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
