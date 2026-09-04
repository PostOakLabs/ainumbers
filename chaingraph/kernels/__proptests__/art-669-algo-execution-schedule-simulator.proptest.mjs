// art-669-algo-execution-schedule-simulator — class-K property-test floor.
// kernel_digest_at_authoring: sha256:4bdbc0208024145fd6927060a0ca39b66c00ff5b437427fa38ae6d928628bbed
// spec: ALGO-EXEC-SIM-BUILD-SPEC.md (ALGOSIM-BUILD-1) — worked example is the parity pin.
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-669-algo-execution-schedule-simulator.proptest.mjs

import { compute } from '../art-669-algo-execution-schedule-simulator.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = 'art-669-algo-execution-schedule-simulator';

const rand = mulberry32(0x669);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const SIDES = ['buy', 'sell'];
const METHODS = ['vwap', 'twap', 'pov'];

/** Random VALID policy_parameters: profile sums to exactly 100, twap always gets a rule when needed. */
function mkValidPP(rng, overrides = {}) {
  const method = overrides.method ?? pick(rng, METHODS);
  const base = {
    side: pick(rng, SIDES),
    order_shares: Math.max(1, Math.floor(randRange(rng, 1, 500000))),
    method,
    arrival_price: randRange(rng, 0.5, 5000),
    avg_fill_price: randRange(rng, 0.5, 5000),
  };
  if (method === 'vwap') {
    // Build a profile that sums to exactly 100 (integer percentages keep the float sum exact).
    const n = 2 + Math.floor(rng() * 6);
    const cuts = new Set();
    while (cuts.size < n - 1) cuts.add(1 + Math.floor(rng() * 99));
    const stops = [0, ...Array.from(cuts).sort((a, b) => a - b), 100];
    base.volume_profile_pct = stops.slice(1).map((s, i) => s - stops[i]);
  } else if (method === 'twap') {
    base.bucket_count = 1 + Math.floor(rng() * 12);
    base.remainder_rule = pick(rng, ['front', 'back']);
  } else {
    base.participation_rate_pct = Math.round(randRange(rng, 1, 100) * 100) / 100;
    base.market_volumes = Array.from({ length: 1 + Math.floor(rng() * 8) }, () => Math.floor(randRange(rng, 0, 2000000)));
  }
  return { ...base, ...overrides };
}

// ---------- P1: determinism — compute() is a pure function of pp ----------
function checkP1_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 5000; i++) {
    const pp = mkValidPP(rand);
    const r1 = JSON.stringify(compute(pp).output_payload);
    const r2 = JSON.stringify(compute({ ...pp }).output_payload);
    checked++;
    if (r1 !== r2) violations++;
  }
  return { name: 'P1_determinism_same_pp_same_output', checked, violations };
}

// ---------- P2: slice-sum invariants — vwap/twap re-sum to the order exactly; pov never exceeds it ----------
function checkP2_sliceSums() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 8000; i++) {
    const pp = mkValidPP(rand);
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.domain_errors) continue;
    let sum = 0;
    for (const s of op.slices) sum += s;
    if (pp.method === 'pov' ? sum > pp.order_shares : sum !== pp.order_shares) violations++;
    if (!op.slices.every((s) => Number.isSafeInteger(s) && s >= 0)) violations++;
  }
  return { name: 'P2_vwap_twap_slices_resum_to_order_pov_capped', checked, violations };
}

// ---------- P3: domain rejection — invalid input is always refused, never silently computed ----------
// Spoils are METHOD-AWARE: a vwap-only field spoiled on a twap vector is simply not read by the
// kernel (correctly), so only fields the pp's own method consumes count as refusal probes.
function checkP3_domainRejection() {
  let violations = 0, checked = 0;
  const universalSpoils = [
    (pp) => ({ ...pp, side: 'sideways' }),
    (pp) => ({ ...pp, side: undefined }),
    (pp) => ({ ...pp, order_shares: -5 }),
    (pp) => ({ ...pp, order_shares: 1000.5 }),
    (pp) => ({ ...pp, method: 'island' }),
    (pp) => ({ ...pp, method: undefined }),
    (pp) => ({ ...pp, arrival_price: 0 }),
    (pp) => ({ ...pp, avg_fill_price: -1 }),
  ];
  const methodSpoils = {
    vwap: [
      (pp) => ({ ...pp, volume_profile_pct: [10, 25, 30, 20, 10] }), // sums to 95, not 100
      (pp) => ({ ...pp, volume_profile_pct: [] }),
      (pp) => ({ ...pp, volume_profile_pct: 'lots' }),
      (pp) => ({ ...pp, volume_profile_pct: new Array(513).fill(100 / 513) }),
    ],
    twap: [
      (pp) => ({ ...pp, bucket_count: 0 }),
      (pp) => ({ ...pp, bucket_count: 2.5 }),
      (pp) => ({ ...pp, bucket_count: 513 }),
      (pp) => { const q = { ...pp, order_shares: 100003, bucket_count: 4 }; delete q.remainder_rule; return q; }, // indivisible, no rule
    ],
    pov: [
      (pp) => ({ ...pp, participation_rate_pct: 0 }),
      (pp) => ({ ...pp, participation_rate_pct: 150 }),
      (pp) => ({ ...pp, market_volumes: 'lots' }),
      (pp) => ({ ...pp, market_volumes: [] }),
    ],
  };
  for (let i = 0; i < 6000; i++) {
    const base = mkValidPP(rand);
    const pool = [...universalSpoils, ...methodSpoils[base.method]];
    const pp = pick(rand, pool)(base);
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (!Array.isArray(op.domain_errors) || op.domain_errors.length === 0) { violations++; continue; }
    if (!compliance_flags.includes('DOMAIN_ERROR')) violations++;
    if (op.slices !== null || op.shortfall_bps !== null || op.shortfall_cost !== null) violations++;
    if (typeof op.trace !== 'string' || !op.trace.startsWith('fail-closed:')) violations++;
  }
  return { name: 'P3_invalid_input_always_fail_closed_never_computed', checked, violations };
}

// ---------- P4: shortfall decomposition — sign follows side, cost follows bps on the same declared prices ----------
function checkP4_shortfallDecomposition() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 8000; i++) {
    const pp = mkValidPP(rand);
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.domain_errors) continue;
    const sideSign = pp.side === 'buy' ? 1 : -1;
    const rawBps = ((pp.avg_fill_price - pp.arrival_price) / pp.arrival_price) * 10000 * sideSign;
    if (Math.abs(op.shortfall_bps - rawBps) > 0.02) violations++;
    const rawCost = (pp.avg_fill_price - pp.arrival_price) * pp.order_shares * sideSign;
    if (Math.abs(op.shortfall_cost - rawCost) > Math.max(0.02, Math.abs(rawCost) * 1e-9)) violations++;
    if (rawBps !== 0 && Math.sign(op.shortfall_bps) !== Math.sign(rawBps)) violations++;
  }
  return { name: 'P4_shortfall_bps_and_cost_match_declared_price_diff_by_side', checked, violations };
}

// ---------- P5: success payload shape — exactly the four canonical keys, no caveat carrier ----------
function checkP5_successShape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 4000; i++) {
    const pp = mkValidPP(rand);
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (op.domain_errors) continue;
    const keys = Object.keys(op).sort().join(',');
    if (keys !== 'shortfall_bps,shortfall_cost,slices,trace') violations++;
    if (compliance_flags.length !== 0) violations++; // no unconditional emissions: success raises no flag
    if (typeof op.trace !== 'string' || op.trace.length === 0) violations++;
  }
  return { name: 'P5_success_payload_is_exactly_the_canonical_four_keys', checked, violations };
}

// ---------- P6: twap remainder wiring — the declared rule absorbs the indivisible remainder ----------
function checkP6_twapRemainderWiring() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const bucketCount = 2 + Math.floor(rand() * 10);
    // Force an indivisible remainder more often than not.
    const orderShares = Math.floor(randRange(rand, 1, 100000)) * bucketCount + (rand() < 0.7 ? Math.floor(rand() * bucketCount) + 1 : 0);
    const rule = pick(rand, ['front', 'back']);
    const pp = mkValidPP(rand, { method: 'twap', order_shares: orderShares, bucket_count: bucketCount, remainder_rule: rule });
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.domain_errors) continue;
    const base = Math.floor(orderShares / bucketCount);
    const rem = orderShares - base * bucketCount;
    if (op.slices.length !== bucketCount) violations++;
    if (op.slices.some((s) => s !== base) && rem === 0) violations++;
    if (rem > 0) {
      const expected = new Array(bucketCount).fill(base);
      expected[rule === 'front' ? 0 : bucketCount - 1] += rem;
      if (!deepEqual(op.slices, expected)) violations++;
    }
  }
  return { name: 'P6_twap_remainder_absorbed_by_declared_rule', checked, violations };
}

// ---------- P7 (mandatory, float-sensitive): pinned parity + boundary forcing ----------
const PINNED_WORKED_EXAMPLE = {
  pp: { side: 'buy', order_shares: 100000, method: 'vwap', volume_profile_pct: [10, 25, 30, 20, 15], arrival_price: 50, avg_fill_price: 50.06 },
  out: {
    slices: [10000, 25000, 30000, 20000, 15000],
    shortfall_bps: 12,
    shortfall_cost: 6000,
    trace: 'slices = 100000 * pct/100 per bucket = [10000,25000,30000,20000,15000]; shortfall_bps = (50.06 - 50) / 50 * 10000 = 12 (buy side, positive = cost); shortfall_cost = (50.06 - 50) * 100000 = 6000',
  },
};

/** @type {[string, () => boolean][]} */
const BOUNDARY_CASES = [
  ['pinned worked example byte-identical (spec parity pin 1653547f...)', () => {
    const { output_payload } = compute(PINNED_WORKED_EXAMPLE.pp);
    return deepEqual(output_payload, PINNED_WORKED_EXAMPLE.out);
  }],
  ['float-sum profile [33.33, 33.33, 33.34] (sums to 99.999... in IEEE) must NOT fail the 100-sum check', () => {
    const { output_payload } = compute(mkValidPP(rand, { method: 'vwap', volume_profile_pct: [33.33, 33.33, 33.34] }));
    return !output_payload.domain_errors;
  }],
  ['order of exactly 1 share across 5 buckets — largest remainder must still re-sum to 1', () => {
    const { output_payload } = compute(mkValidPP(rand, { method: 'vwap', order_shares: 1, volume_profile_pct: [20, 20, 20, 20, 20] }));
    if (output_payload.domain_errors) return false;
    let s = 0; for (const x of output_payload.slices) s += x;
    return s === 1;
  }],
  ['twap bucket_count 1 — whole order is one slice, no rule needed', () => {
    const { output_payload } = compute(mkValidPP(rand, { method: 'twap', order_shares: 99999, bucket_count: 1 }));
    return !output_payload.domain_errors && deepEqual(output_payload.slices, [99999]);
  }],
  ['twap indivisible remainder with NO declared rule must fail closed, never guess', () => {
    // remainder_rule: undefined overrides the base rule — the kernel must read that as absent.
    const pp = mkValidPP(rand, { method: 'twap', order_shares: 100003, bucket_count: 4, remainder_rule: undefined });
    const { output_payload } = compute(pp);
    return Array.isArray(output_payload.domain_errors) && output_payload.domain_errors.includes('INVALID_REMAINDER_RULE');
  }],
  ['pov rate 100% — slices mirror declared volumes up to the order cap', () => {
    const { output_payload } = compute(mkValidPP(rand, { method: 'pov', order_shares: 5000, participation_rate_pct: 100, market_volumes: [2000, 4000, 1000] }));
    if (output_payload.domain_errors) return false;
    return deepEqual(output_payload.slices, [2000, 3000, 0]);
  }],
  ['equal arrival and fill prices — shortfall is exactly 0 on both measures', () => {
    const { output_payload } = compute(mkValidPP(rand, { arrival_price: 41.37, avg_fill_price: 41.37 }));
    return !output_payload.domain_errors && output_payload.shortfall_bps === 0 && output_payload.shortfall_cost === 0;
  }],
  ['empty input {} — fail closed naming every required field, never throws', () => {
    const { output_payload, compliance_flags } = compute({});
    return Array.isArray(output_payload.domain_errors) && output_payload.domain_errors.length >= 5
      && compliance_flags.includes('DOMAIN_ERROR');
  }],
  ['513-bucket vwap profile — over the 512-bucket bound must fail closed', () => {
    const pct = new Array(513).fill(100 / 513);
    const { output_payload } = compute(mkValidPP(rand, { method: 'vwap', volume_profile_pct: pct }));
    return Array.isArray(output_payload.domain_errors) && output_payload.domain_errors.includes('INVALID_VOLUME_PROFILE');
  }],
];

function checkP7_forced() {
  const rows = [];
  for (const [label, fn] of BOUNDARY_CASES) {
    let pass = false;
    try { pass = fn(); } catch (e) { pass = false; }
    rows.push({ label, pass });
  }
  return rows;
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_determinism(),
  checkP2_sliceSums(),
  checkP3_domainRejection(),
  checkP4_shortfallDecomposition(),
  checkP5_successShape(),
  checkP6_twapRemainderWiring(),
];
const boundaryForced = checkP7_forced();
const ok = summarize(KERNEL_ID, oracle, properties) && boundaryForced.every((b) => b.pass);
if (boundaryForced.some((b) => !b.pass)) {
  console.log('BOUNDARY-FORCED FAILURES:');
  for (const b of boundaryForced.filter((b) => !b.pass)) console.log('  ✗ ' + b.label);
}
process.exit(ok ? 0 : 1);
