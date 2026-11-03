// 815-eth-fee-market — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:ca5384afe984d3fe69a57d6de6bcf228d4f351f8a03661332b891fc173d6847e
// spec: board row ETH-FEEMARKET-NODE-1; pin note research/ETH-FEEMARKET-PIN-2026-11.md (workspace root)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/815-eth-fee-market.proptest.mjs

import { compute } from '../815-eth-fee-market.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = '815-eth-fee-market';
const GAS_PER_BLOB = 131072n;
const FORKS = { cancun: [3, 6, false], prague: [6, 9, false], osaka: [6, 9, true], bpo1: [10, 15, true], bpo2: [14, 21, true] };
const NAMES = Object.keys(FORKS);

function rngPP(rng) {
  const fork = NAMES[Math.floor(rng() * NAMES.length)];
  const [, max] = FORKS[fork];
  const limit = Math.floor(rng() * 60e6) + 5000;
  return {
    fork,
    base_fee: {
      parent_gas_limit: limit,
      parent_gas_used: Math.floor(rng() * (limit + 1)),
      parent_base_fee_per_gas: Math.floor(rng() * 2e11),
    },
    blob_fee: {
      parent_excess_blob_gas: Math.floor(rng() * 4e8),
      parent_blob_gas_used: Math.floor(rng() * (max + 1)) * 131072,
      parent_base_fee_per_gas: Math.floor(rng() * 2e11),
    },
  };
}

const N = 400;

function checkDeterminismAndShape() {
  const rng = mulberry32(815);
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

function checkBaseFeeBounds() {
  // The change is at most 1/8 of the parent fee, rises by at least 1 wei above target, never
  // rises below target, and is zero exactly at target.
  const rng = mulberry32(2);
  let v = 0;
  for (let i = 0; i < N; i++) {
    const { base_fee: b } = rngPP(rng);
    const o = compute({ base_fee: b }).output_payload;
    const parent = BigInt(b.parent_base_fee_per_gas);
    const fee = BigInt(o.base_fee_per_gas);
    const target = BigInt(o.parent_gas_target);
    const used = BigInt(b.parent_gas_used);
    const change = fee - parent;
    if (BigInt(o.base_fee_change_wei) !== change) v++;
    if (used > target && (change < 1n || (change > parent / 8n && change !== 1n))) v++;
    if (used < target && (change > 0n || -change > parent / 8n)) v++;
    if (used === target && change !== 0n) v++;
  }
  return { name: 'base_fee_change_bounded_by_one_eighth', checked: N, violations: v };
}

function checkBaseFeeMonotone() {
  // More gas used in the parent never gives a lower base fee.
  const rng = mulberry32(3);
  let v = 0;
  for (let i = 0; i < N; i++) {
    const { base_fee: b } = rngPP(rng);
    const more = { ...b, parent_gas_used: Math.min(b.parent_gas_limit, b.parent_gas_used + Math.floor(rng() * 1e6) + 1) };
    if (BigInt(compute({ base_fee: more }).output_payload.base_fee_per_gas) < BigInt(compute({ base_fee: b }).output_payload.base_fee_per_gas)) v++;
  }
  return { name: 'base_fee_monotone_in_gas_used', checked: N, violations: v };
}

function checkExcessUpdate() {
  // Below target the excess resets to zero; otherwise it is the parent excess plus used minus
  // target, or (reserve branch) plus used * (max - target) / max. The reserve branch only fires on
  // reserve-price forks.
  const rng = mulberry32(4);
  let v = 0;
  for (let i = 0; i < N; i++) {
    const pp = rngPP(rng);
    const [t, m, reserve] = FORKS[pp.fork];
    const o = compute({ fork: pp.fork, blob_fee: pp.blob_fee }).output_payload;
    const ex = BigInt(pp.blob_fee.parent_excess_blob_gas);
    const used = BigInt(pp.blob_fee.parent_blob_gas_used);
    const target = GAS_PER_BLOB * BigInt(t);
    const got = BigInt(o.excess_blob_gas);
    if (ex + used < target) { if (got !== 0n) v++; continue; }
    const plain = ex + used - target;
    const res = ex + (used * BigInt(m - t)) / BigInt(m);
    if (o.reserve_price_branch_taken === true) { if (!reserve || got !== res) v++; } else if (got !== plain) v++;
    if (!reserve && o.reserve_price_branch_taken !== null) v++;
  }
  return { name: 'excess_blob_gas_update_rules', checked: N, violations: v };
}

function checkBlobPriceMonotone() {
  // Price is at least 1 wei, never falls as excess rises, and the per-blob figure is 2^17 times it.
  const rng = mulberry32(5);
  let v = 0;
  for (let i = 0; i < N; i++) {
    const pp = rngPP(rng);
    const lo = { fork: pp.fork, blob_fee: { ...pp.blob_fee, parent_blob_gas_used: 0 } };
    const hi = { fork: pp.fork, blob_fee: { ...lo.blob_fee, parent_excess_blob_gas: pp.blob_fee.parent_excess_blob_gas + Math.floor(rng() * 1e7) } };
    const a = compute(lo).output_payload;
    const b = compute(hi).output_payload;
    const pa = BigInt(a.parent_base_fee_per_blob_gas);
    if (pa < 1n || BigInt(b.parent_base_fee_per_blob_gas) < pa) v++;
    if (BigInt(a.base_fee_per_blob_wei) !== BigInt(a.base_fee_per_blob_gas) * GAS_PER_BLOB) v++;
  }
  return { name: 'blob_price_floor_and_monotone', checked: N, violations: v };
}

function checkSeededRefusals() {
  const base = rngPP(mulberry32(6));
  const clone = () => JSON.parse(JSON.stringify(base));
  /** @type {Array<[string, (p: any) => void]>} */
  const cases = [
    ['UNKNOWN_FORK', (p) => { p.fork = 'frontier'; }],
    ['FORK_PARAMETERS_INVALID', (p) => { p.fork_parameters = { target_blobs: 0 }; }],
    ['FORK_PARAMETERS_INVALID', (p) => { p.fork_parameters = { reserve_price: 'yes' }; }],
    ['FORK_PARAMETERS_INVALID', (p) => { p.fork_parameters = { unknown_knob: 1 }; }],
    ['NO_SECTION_REQUESTED', (p) => { delete p.base_fee; delete p.blob_fee; }],
    ['NON_NEGATIVE_INTEGER_INPUTS', (p) => { p.base_fee = 'x'; }],
    ['NON_NEGATIVE_INTEGER_INPUTS', (p) => { p.blob_fee.parent_excess_blob_gas = 1.5; }],
    ['UINT64_RANGE', (p) => { p.blob_fee.parent_excess_blob_gas = '18446744073709551616'; }],
    ['UINT256_RANGE', (p) => { p.base_fee.parent_base_fee_per_gas = (1n << 256n).toString(); }],
    ['GAS_USED_EXCEEDS_LIMIT', (p) => { p.base_fee.parent_gas_used = p.base_fee.parent_gas_limit + 1; }],
    ['GAS_TARGET_ZERO', (p) => { p.base_fee.parent_gas_limit = 1; p.base_fee.parent_gas_used = 0; }],
    ['BLOB_GAS_USED_INVALID', (p) => { p.blob_fee.parent_blob_gas_used = 131073; }],
    ['RESERVE_PRICE_NEEDS_PARENT_BASE_FEE', (p) => { p.fork = 'bpo2'; delete p.blob_fee.parent_base_fee_per_gas; }],
    ['EXCESS_BLOB_GAS_OUT_OF_RANGE', (p) => { p.fork = 'cancun'; p.blob_fee.parent_blob_gas_used = 0; p.blob_fee.parent_excess_blob_gas = 128 * 3338477 + 1; }],
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
  checkBaseFeeBounds(),
  checkBaseFeeMonotone(),
  checkExcessUpdate(),
  checkBlobPriceMonotone(),
  checkSeededRefusals(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
