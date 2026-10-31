// 794-event-fee-recompute — class-K property-test FLOOR per FV-PBT-FLOOR-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:93e829980db28a63b66b2fe3a39a1234f52c77bf7edb8260e7c49dd3c5203854
// spec: research/kalshi-event-contract-rows-2026-10-30.md section 3.3 + research/EVENT-FEE-RECOMPUTE-PIN-2026-10-30.md
// human_sign_off: TIM-PENDING-2026-10-31
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/794-event-fee-recompute.proptest.mjs

import { compute } from '../794-event-fee-recompute.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = '794-event-fee-recompute';

const SEED = 20261031;
const N = 200;

/** Random VALID policy_parameters over the declared domain. */
function randomValidPp(rng) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const profile = pick(['kalshi', 'polymarket_global', 'polymarket_us', 'generic']);
  const nOrders = 1 + Math.floor(rng() * 3);
  const orders = [];
  for (let i = 0; i < nOrders; i++) {
    const nFills = 1 + Math.floor(rng() * 4);
    const fills = [];
    for (let k = 0; k < nFills; k++) {
      fills.push({ contracts: 1 + Math.floor(rng() * 200), price_micro: 1000 + Math.floor(rng() * 997000) });
    }
    const o = {
      order_label: 'gen-order-' + String(i + 1) + '-a',
      role: rng() < 0.7 ? 'taker' : 'maker',
      fills,
    };
    if (rng() < 0.3) o.outcomes = ['outcome-a', 'outcome-b'];
    orders.push(o);
  }
  const pp = { profile, as_of: pick(['2026-10-01', '2026-09-16', '2026-09-17', '2026-09-26']), orders };
  if (profile === 'polymarket_global') pp.category = pick(['crypto', 'sports', 'politics', 'other']);
  if (profile === 'generic') {
    pp.params = {
      fee_family: pick(['parabolic', 'multiplier', 'linear', 'flat']),
      theta_taker_num: Math.floor(rng() * 10), theta_taker_den: 100,
      fill_rounding_unit_micro: 1, rounding_mode: 'ceil',
    };
    if (pp.params.fee_family === 'flat') pp.params.flat_fee_micro = 500 + Math.floor(rng() * 2000);
  }
  return pp;
}

function bigFee(po) {
  // order_fee_micro is a number or a decimal string for values above 2^53; compare as BigInt
  return BigInt(po.order_fee_micro);
}

// P1 — DETERMINISM + SHAPE: compute() is a pure function of pp (same input,
// byte-identical output_payload); a completed payload carries the contract fields,
// echoes the profile, and every per-order block carries the per-fill fields.
function checkDeterminismAndShape() {
  const rng = mulberry32(SEED);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    if (a.verdict !== 'completed') continue;
    checked++;
    const shapeOk = typeof a.profile_id === 'string' && typeof a.source_pin === 'string'
      && typeof a.fee_family === 'string'
      && a.effective_theta && typeof a.effective_theta.taker.num === 'number'
      && typeof a.fill_rounding_unit_micro === 'number'
      && Array.isArray(a.per_order) && a.per_order.length === pp.orders.length
      && typeof a.total_fee_micro !== 'undefined'
      && typeof a.conservation_ok === 'boolean';
    if (!shapeOk) violations++;
    for (const po of a.per_order) {
      checked++;
      const ok = typeof po.order_label === 'string' && (po.role === 'taker' || po.role === 'maker')
        && Array.isArray(po.per_fill) && po.per_fill.length === po.fills_in
        && po.per_fill.every((f) => typeof f.trade_fee_micro !== 'undefined' && typeof f.net_fee_micro !== 'undefined');
      if (!ok) violations++;
    }
  }
  return { name: 'P1_determinism_and_output_shape', checked, violations };
}

// P2 — CONSERVATION: for every completed run, every order satisfies
// order_fee = trade_fees + carry (the accumulator identity), the order fee equals
// the sum of its per-fill net fees, each fill satisfies
// trade + rounding - rebate = net, and rebate_total + carry = rounding_total.
function checkConservation() {
  const rng = mulberry32(SEED + 1);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const out = compute(pp).output_payload;
    if (out.verdict !== 'completed') continue;
    checked++;
    let total = 0n;
    for (const po of out.per_order) {
      const netSum = po.per_fill.reduce((acc, f) => acc + BigInt(f.net_fee_micro), 0n);
      const roundSum = po.per_fill.reduce((acc, f) => acc + BigInt(f.rounding_fee_micro), 0n);
      const ok = bigFee(po) === BigInt(po.trade_fees_micro) + BigInt(po.carry_micro)
        && bigFee(po) === netSum
        && po.per_fill.every((f) => BigInt(f.trade_fee_micro) + BigInt(f.rounding_fee_micro) - BigInt(f.rebate_micro) === BigInt(f.net_fee_micro))
        && BigInt(po.rebate_total_micro) + BigInt(po.carry_micro) === roundSum;
      if (!ok) violations++;
      total += bigFee(po);
    }
    checked++;
    if (total !== BigInt(out.total_fee_micro)) violations++;
  }
  return { name: 'P2_conservation_accumulator_identity', checked, violations };
}

// P3 — FEE NONNEGATIVITY + PARABOLIC SYMMETRY/MONOTONICITY: fees never go negative;
// holding contracts and profile fixed, the per-fill fee at a mid price is >= the fee
// at an extreme price (p(1-p) curve), and prices p and 1-p charge the same fee.
function checkMonotonicityAndNonnegativity() {
  const rng = mulberry32(SEED + 2);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const c = 1 + Math.floor(rng() * 50);
    const profile = rng() < 0.5 ? 'kalshi' : 'polymarket_us';
    const asOf = profile === 'polymarket_us' ? '2026-09-17' : '2026-10-01';
    const mid = compute({ profile, as_of: asOf, orders: [{ order_label: 'mono-mid-a', role: 'taker', fills: [{ contracts: c, price_micro: 500000 }] }] }).output_payload;
    const edge = compute({ profile, as_of: asOf, orders: [{ order_label: 'mono-edge-a', role: 'taker', fills: [{ contracts: c, price_micro: 10000 }] }] }).output_payload;
    checked += 2;
    if (mid.verdict !== 'completed' || edge.verdict !== 'completed') { violations++; continue; }
    const midFee = BigInt(mid.per_order[0].per_fill[0].trade_fee_micro);
    const edgeFee = BigInt(edge.per_order[0].per_fill[0].trade_fee_micro);
    if (midFee < 0n || edgeFee < 0n) violations++;
    if (midFee < edgeFee) violations++;
    // symmetry: p and 1-p price the same dollar fee
    const p = 300000 + Math.floor(rng() * 400000);
    const symA = compute({ profile, as_of: asOf, orders: [{ order_label: 'sym-a-a', role: 'taker', fills: [{ contracts: c, price_micro: p }] }] }).output_payload;
    const symB = compute({ profile, as_of: asOf, orders: [{ order_label: 'sym-b-a', role: 'taker', fills: [{ contracts: c, price_micro: 1000000 - p }] }] }).output_payload;
    checked++;
    if (symA.verdict !== 'completed' || BigInt(symA.per_order[0].per_fill[0].trade_fee_micro) !== BigInt(symB.per_order[0].per_fill[0].trade_fee_micro)) violations++;
  }
  return { name: 'P3_nonnegativity_parabolic_symmetry_monotonicity', checked, violations };
}

// P4 — INVALID DOMAIN REJECTED: unknown profiles, malformed as_of, identifier-like
// labels, out-of-range prices and combo orders without legs all refuse; refused
// payloads never echo fee figures.
function checkInvalidDomainRefused() {
  const base = { profile: 'kalshi', as_of: '2026-10-01', orders: [{ order_label: 'inv-a', role: 'taker', fills: [{ contracts: 1, price_micro: 500000 }] }] };
  const cases = [
    [Object.assign({}, base, { profile: 'kalshi_x' }), 'unknown_profile'],
    [Object.assign({}, base, { profile: 'robinhood' }), 'unknown_profile'],
    [Object.assign({}, base, { as_of: '2026-13-99' }), 'as_of_must_be_iso_date'],
    [Object.assign({}, base, { orders: [Object.assign({}, base.orders[0], { order_label: 'deadbeefdeadbeef1234' })] }), 'identifier_like_order_label_refused'],
    [Object.assign({}, base, { orders: [Object.assign({}, base.orders[0], { order_label: 'acct-987654321098' })] }), 'identifier_like_order_label_refused'],
    [Object.assign({}, base, { orders: [Object.assign({}, base.orders[0], { outcomes: ['x'] })] }), 'outcomes_must_have_at_least_two_entries'],
    [Object.assign({}, base, { orders: [Object.assign({}, base.orders[0], { fills: [{ contracts: 1, price_micro: 0 }] })] }), 'price_micro_must_be_integer_1_to_999999'],
    [Object.assign({}, base, { orders: [Object.assign({}, base.orders[0], { kind: 'combo' })] }), 'combo_order_requires_legs'],
    [Object.assign({}, base, { orders: [] }), 'orders_must_be_nonempty_array'],
  ];
  let checked = 0; let violations = 0;
  for (const [pp, why] of cases) {
    const r = compute(pp);
    checked++;
    if (r.output_payload.verdict !== 'refused' || r.output_payload.refused_because !== why) violations++;
    checked++;
    const payload = JSON.stringify(r.output_payload);
    if (payload.includes('total_fee_micro')) violations++; // no fee figures on a refusal
  }
  // a valid generic parameter set completes
  const r = compute({ profile: 'generic', as_of: '2026-10-01', params: { fee_family: 'parabolic', theta_taker_num: 7, theta_taker_den: 100, fill_rounding_unit_micro: 1, rounding_mode: 'ceil' }, orders: [{ order_label: 'gen-a', role: 'taker', fills: [{ contracts: 2, price_micro: 500000 }] }] });
  checked++;
  if (r.output_payload.verdict !== 'completed') violations++;
  return { name: 'P4_invalid_domain_refused_no_fee_echo', checked, violations };
}

// P5 — EFFECTIVE-DATING: a parameter set whose theta changes between two dates
// returns the old fee strictly before effective_from and the new fee on and after it.
function checkEffectiveDating() {
  const params = {
    rows: [
      { effective_from: '2026-01-01', fee_family: 'parabolic', theta_taker_num: 5, theta_taker_den: 100, fill_rounding_unit_micro: 1, rounding_mode: 'ceil' },
      { effective_from: '2026-09-17', fee_family: 'parabolic', theta_taker_num: 695, theta_taker_den: 10000, fill_rounding_unit_micro: 1, rounding_mode: 'ceil' },
    ],
  };
  const order = () => [{ order_label: 'eff-a', role: 'taker', fills: [{ contracts: 100, price_micro: 500000 }] }];
  let checked = 0; let violations = 0;
  const before = compute({ profile: 'generic', as_of: '2026-09-16', params, orders: order() }).output_payload;
  const on = compute({ profile: 'generic', as_of: '2026-09-17', params, orders: order() }).output_payload;
  const after = compute({ profile: 'generic', as_of: '2026-10-01', params, orders: order() }).output_payload;
  checked++;
  if (before.verdict !== 'completed' || BigInt(before.per_order[0].order_fee_micro) !== 1250000n) violations++; // 0.05*100*0.25
  checked++;
  if (on.verdict !== 'completed' || BigInt(on.per_order[0].order_fee_micro) !== 1737500n) violations++; // 0.0695*100*0.25
  checked++;
  if (after.verdict !== 'completed' || BigInt(after.per_order[0].order_fee_micro) !== 1737500n) violations++;
  return { name: 'P5_effective_dating_selects_row', checked, violations };
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
  checkConservation(),
  checkMonotonicityAndNonnegativity(),
  checkInvalidDomainRefused(),
  checkEffectiveDating(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
