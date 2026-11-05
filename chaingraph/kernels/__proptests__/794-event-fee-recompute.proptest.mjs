// 794-event-fee-recompute — class-K property-test FLOOR per FV-PBT-FLOOR-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:0a362342261e84e5c2a0d247fefc6e643ce9b7f2498187b9e227fa1719dbfed1
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

// ---------- exact-value and refusal properties (mutation-floor strengthening) ----------
// Small tally helper: every assertion counts as one check; a failed one is a violation.
function tally() {
  const t = { checked: 0, violations: 0, failed: [] };
  t.ok = (cond, label) => { t.checked++; if (!cond) { t.violations++; t.failed.push(label); } };
  return t;
}

const ORD = (extra) => Object.assign({ order_label: 'ord-a', role: 'taker', fills: [{ contracts: 2, price_micro: 500000 }] }, extra);
const GP = (over) => Object.assign({ fee_family: 'parabolic', theta_taker_num: 7, theta_taker_den: 100, fill_rounding_unit_micro: 1, rounding_mode: 'ceil' }, over);
const GEN = (params, order, asOf) => compute({ profile: 'generic', as_of: asOf || '2026-10-01', params, orders: [order || ORD()] });
const KAL = (order, extra) => compute(Object.assign({ profile: 'kalshi', as_of: '2026-10-01', orders: [order] }, extra));
const fee0 = (r) => r.output_payload.per_order[0].order_fee_micro;

// P6 — REFUSAL TABLE: every malformed input refuses with its own reason, names the
// offending field, carries the refusal flag exactly once, never claims a completed
// verdict, and marks the payload as a refusal in its evidence block.
function checkRefusalTable() {
  const t = tally();
  const G = (params, orders) => ({ profile: 'generic', as_of: '2026-10-01', params, orders: orders || [ORD()] });
  const K = (order) => ({ profile: 'kalshi', as_of: '2026-10-01', orders: [order] });
  const longOk = 'a b '.repeat(16); // 64 chars with whitespace: opaque-looking but not identifier-like
  const cases = [
    [undefined, 'profile_must_be_a_string', 'profile'],
    [{ profile: 5 }, 'profile_must_be_a_string', 'profile'],
    [{ profile: 'kalshi', as_of: 20261001, orders: [ORD()] }, 'as_of_must_be_iso_date', 'as_of'],
    [{ profile: 'kalshi', orders: [ORD()] }, 'as_of_must_be_iso_date', 'as_of'],
    [{ profile: 'kalshi', as_of: '2026-10-01' }, 'orders_must_be_nonempty_array', 'orders'],
    [{ profile: 'kalshi', as_of: '2026-10-01', orders: 'x' }, 'orders_must_be_nonempty_array', 'orders'],
    [{ profile: 'kalshi', as_of: '2026-10-01', orders: Array.from({ length: 101 }, () => ORD()) }, 'orders_exceed_bounded_domain_100', 'orders'],
    [{ profile: 'generic', as_of: '2026-10-01', orders: [ORD()] }, 'generic_profile_requires_params', 'params'],
    [G('x'), 'generic_profile_requires_params', 'params'],
    [G({ rows: [{ effective_from: '2026-01-01', fee_family: 'bogus' }] }), 'generic_row_missing_effective_from_or_family', 'params.rows'],
    [G({ rows: [{ effective_from: 5, fee_family: 'parabolic' }] }), 'generic_row_missing_effective_from_or_family', 'params.rows'],
    [G({ rows: [{ fee_family: 'parabolic' }] }), 'generic_row_missing_effective_from_or_family', 'params.rows'],
    [G({ rows: [null] }), 'generic_row_missing_effective_from_or_family', 'params.rows'],
    [G({ rows: [GP({ effective_from: '2026-10-02' })] }), 'no_generic_row_effective_at_as_of', 'params.rows'],
    [G({ rows: [GP({ effective_from: '2026-01-01', effective_to: '2026-09-30' })] }), 'no_generic_row_effective_at_as_of', 'params.rows'],
    [G({ fee_family: 'bogus' }), 'generic_fee_family_unknown', 'params.fee_family'],
    [G({}), 'generic_fee_family_unknown', 'params.fee_family'],
    [G({ fee_family: 5 }), 'generic_fee_family_unknown', 'params.fee_family'],
    [G(GP({ theta_taker_num: -1 })), 'theta_num_den_must_be_nonnegative_integers', 'theta'],
    [G(GP({ theta_taker_num: 1.5 })), 'theta_num_den_must_be_nonnegative_integers', 'theta'],
    [G(GP({ theta_taker_den: 0 })), 'theta_num_den_must_be_nonnegative_integers', 'theta'],
    [G(GP({ theta_taker_den: -5 })), 'theta_num_den_must_be_nonnegative_integers', 'theta'],
    [G(GP({ theta_taker_den: 1.5 })), 'theta_num_den_must_be_nonnegative_integers', 'theta'],
    [G(GP({ theta_taker_num: undefined })), 'theta_num_den_must_be_nonnegative_integers', 'theta'],
    [G(GP({ theta_maker_num: -1, theta_maker_den: 100 }), [ORD({ role: 'maker' })]), 'theta_num_den_must_be_nonnegative_integers', 'theta'],
    [G(GP({ theta_maker_num: 1, theta_maker_den: 0 })), 'theta_num_den_must_be_nonnegative_integers', 'theta'],
    [G(GP({ rounding_mode: 'floor' })), 'rounding_mode_must_be_ceil_or_round_half_up', 'rounding_mode'],
    [G(GP({ rounding_mode: undefined })), 'rounding_mode_must_be_ceil_or_round_half_up', 'rounding_mode'],
    [G(GP({ fill_rounding_unit_micro: 0 })), 'fill_rounding_unit_micro_must_be_positive_int', 'fill_rounding_unit_micro'],
    [G(GP({ fill_rounding_unit_micro: 1.5 })), 'fill_rounding_unit_micro_must_be_positive_int', 'fill_rounding_unit_micro'],
    [G(GP({ fill_rounding_unit_micro: '1' })), 'fill_rounding_unit_micro_must_be_positive_int', 'fill_rounding_unit_micro'],
    [G(GP({ fill_rounding_unit_micro: undefined })), 'fill_rounding_unit_micro_must_be_positive_int', 'fill_rounding_unit_micro'],
    [G(GP({ order_rounding_unit_micro: -1 })), 'order_rounding_unit_micro_must_be_nonnegative_int', 'order_rounding_unit_micro'],
    [G(GP({ order_rounding_unit_micro: 1.5 })), 'order_rounding_unit_micro_must_be_nonnegative_int', 'order_rounding_unit_micro'],
    [G(GP({ order_rounding_unit_micro: '5' })), 'order_rounding_unit_micro_must_be_nonnegative_int', 'order_rounding_unit_micro'],
    [G(GP({ fee_family: 'rebate_share' })), 'rebate_share_bp_must_be_0_to_10000', 'rebate_share_bp'],
    [G(GP({ fee_family: 'rebate_share', rebate_share_bp: -1 })), 'rebate_share_bp_must_be_0_to_10000', 'rebate_share_bp'],
    [G(GP({ fee_family: 'rebate_share', rebate_share_bp: 10001 })), 'rebate_share_bp_must_be_0_to_10000', 'rebate_share_bp'],
    [G(GP({ fee_family: 'rebate_share', rebate_share_bp: 1.5 })), 'rebate_share_bp_must_be_0_to_10000', 'rebate_share_bp'],
    [G(GP({ fee_family: 'flat' })), 'flat_family_requires_flat_fee_micro', 'flat_fee_micro'],
    [G(GP({ fee_family: 'flat', flat_fee_micro: 1.5 })), 'flat_family_requires_flat_fee_micro', 'flat_fee_micro'],
    [{ profile: 'polymarket_global', as_of: '2026-10-01', category: 'bogus', orders: [ORD()] }, 'unknown_category', 'category'],
    [{ profile: 'kalshi', as_of: '1969-12-31', orders: [ORD()] }, 'no_profile_row_effective_at_as_of', 'as_of'],
    [K(ORD({ order_label: '' })), 'order_label_must_be_short_opaque_string', 'orders[0].order_label'],
    [K(ORD({ order_label: 5 })), 'order_label_must_be_short_opaque_string', 'orders[0].order_label'],
    [K(ORD({ order_label: undefined })), 'order_label_must_be_short_opaque_string', 'orders[0].order_label'],
    [K(ORD({ order_label: longOk + 'a' })), 'order_label_must_be_short_opaque_string', 'orders[0].order_label'],
    [K(ORD({ role: 'both' })), 'role_must_be_taker_or_maker', 'orders[0].role'],
    [K(ORD({ role: undefined })), 'role_must_be_taker_or_maker', 'orders[0].role'],
    [K(ORD({ kind: 'spread' })), 'kind_must_be_standard_or_combo', 'orders[0].kind'],
    [K(ORD({ outcomes: 'ab' })), 'outcomes_must_have_at_least_two_entries', 'orders[0].outcomes'],
    [K(ORD({ outcomes: ['only-one'] })), 'outcomes_must_have_at_least_two_entries', 'orders[0].outcomes'],
    [K(ORD({ outcomes: ['ok-a', ''] })), 'outcome_label_must_be_short_opaque_string', 'orders[0].outcomes[1]'],
    [K(ORD({ outcomes: ['ok-a', 5] })), 'outcome_label_must_be_short_opaque_string', 'orders[0].outcomes[1]'],
    [K(ORD({ outcomes: ['ok-a', longOk + 'a'] })), 'outcome_label_must_be_short_opaque_string', 'orders[0].outcomes[1]'],
    [K(ORD({ outcomes: ['ok-a', 'acct-123456789012'] })), 'identifier_like_outcome_label_refused', 'orders[0].outcomes[1]'],
    [K(ORD({ kind: 'combo', fills: undefined })), 'combo_order_requires_legs', 'orders[0].legs'],
    [K(ORD({ kind: 'combo', legs: [] })), 'combo_order_requires_legs', 'orders[0].legs'],
    [K(ORD({ kind: 'combo', legs: [{ fills: [] }] })), 'fills_must_be_nonempty_array', 'orders[0].legs[0].fills'],
    [K(ORD({ kind: 'combo', legs: [null] })), 'fills_must_be_nonempty_array', 'orders[0].legs[0].fills'],
    [K(ORD({ fills: [] })), 'fills_must_be_nonempty_array', 'orders[0].fills'],
    [K(ORD({ fills: undefined })), 'fills_must_be_nonempty_array', 'orders[0].fills'],
    [K(ORD({ fills: [{ contracts: 0, price_micro: 500000 }] })), 'contracts_must_be_integer_1_to_1e9', 'orders[0].fills[0].contracts'],
    [K(ORD({ fills: [{ contracts: 1.5, price_micro: 500000 }] })), 'contracts_must_be_integer_1_to_1e9', 'orders[0].fills[0].contracts'],
    [K(ORD({ fills: [{ contracts: '2', price_micro: 500000 }] })), 'contracts_must_be_integer_1_to_1e9', 'orders[0].fills[0].contracts'],
    [K(ORD({ fills: [{ contracts: 1000000001, price_micro: 500000 }] })), 'contracts_must_be_integer_1_to_1e9', 'orders[0].fills[0].contracts'],
    [K(ORD({ fills: [{ contracts: 1, price_micro: 500000 }, { contracts: 0, price_micro: 500000 }] })), 'contracts_must_be_integer_1_to_1e9', 'orders[0].fills[1].contracts'],
    [K(ORD({ fills: [{ contracts: 1, price_micro: 1000000 }] })), 'price_micro_must_be_integer_1_to_999999', 'orders[0].fills[0].price_micro'],
    [K(ORD({ fills: [{ contracts: 1, price_micro: 1.5 }] })), 'price_micro_must_be_integer_1_to_999999', 'orders[0].fills[0].price_micro'],
    [K(ORD({ fills: [{ contracts: 1, price_micro: '5' }] })), 'price_micro_must_be_integer_1_to_999999', 'orders[0].fills[0].price_micro'],
    [K(ORD({ fills: Array.from({ length: 501 }, () => ({ contracts: 1, price_micro: 500000 })) })), 'fills_exceed_bounded_domain_500', 'orders[0].fills'],
    [K(ORD({ reported_fee_minor: -1 })), 'reported_fee_minor_must_be_nonnegative_integer', 'orders[0].reported_fee_minor'],
    [K(ORD({ reported_fee_minor: 1.5 })), 'reported_fee_minor_must_be_nonnegative_integer', 'orders[0].reported_fee_minor'],
    [K(ORD({ reported_fee_minor: '5' })), 'reported_fee_minor_must_be_nonnegative_integer', 'orders[0].reported_fee_minor'],
  ];
  for (const [pp, why, field] of cases) {
    const r = compute(pp);
    const p = r.output_payload;
    const label = why + '@' + field;
    t.ok(p.verdict === 'refused' && p.refused_because === why, 'reason ' + label);
    t.ok(p.refused_field === field, 'field ' + label);
    t.ok(r.compliance_flags.filter((x) => x === 'REFUSED_MALFORMED_OR_IDENTIFIER_INPUT').length === 1, 'flag ' + label);
    t.ok(p.manual_review_required === true && p.evidence.refused === true
      && p.evidence.record_type === 'event_contract_fee_recompute' && p.evidence.tool_id === KERNEL_ID && p.evidence.tool_version === '1.0.0', 'evidence ' + label);
  }
  // unknown profile: both flags, the requested profile echoed
  const u = compute({ profile: 'robinhood', as_of: '2026-10-01', orders: [ORD()] });
  t.ok(u.output_payload.refused_because === 'unknown_profile' && u.output_payload.requested_profile === 'robinhood'
    && u.compliance_flags.includes('REFUSED_UNKNOWN_PROFILE') && u.compliance_flags.includes('REFUSED_MALFORMED_OR_IDENTIFIER_INPUT'), 'unknown profile echo');
  const uc = compute({ profile: 'polymarket_global', as_of: '2026-10-01', category: 'bogus', orders: [ORD()] });
  t.ok(uc.output_payload.requested_category === 'bogus', 'unknown category echo');
  // identifier-like labels: refuse, raise the identifier flag, echo the profile
  for (const bad of ['0xabc123', '0xAB', 'abcdef0123456789', 'acct-123456789012', 'x'.repeat(32), 'z'.repeat(40)]) {
    const r = KAL(ORD({ order_label: bad }));
    t.ok(r.output_payload.refused_because === 'identifier_like_order_label_refused' && r.output_payload.refused_field === 'orders[0].order_label'
      && r.output_payload.requested_profile === 'kalshi' && r.compliance_flags.includes('IDENTIFIER_LIKE_FIELD_REFUSED'), 'idlike ' + bad);
  }
  // near-misses of each identifier pattern stay accepted and raise no identifier flag
  for (const good of ['0x', '0xzz', '0xab!', 'a0xab', 'abcdef012345678', 'zzabcdef0123456789', 'acct-12345678901', 'x'.repeat(31), 'word '.repeat(6) + 'ab', 'a', longOk]) {
    const r = KAL(ORD({ order_label: good }));
    t.ok(r.output_payload.verdict === 'completed' && !r.compliance_flags.includes('IDENTIFIER_LIKE_FIELD_REFUSED'), 'idok ' + good);
  }
  return { name: 'P6_refusal_table_reason_field_flags', checked: t.checked, violations: t.violations, failed: t.failed };
}

// P7 — CALENDAR DATES: every month's last day is a valid as_of and the day after is
// refused, leap years follow the Gregorian rule, and malformed shapes refuse.
function checkCalendar() {
  const t = tally();
  const run = (d) => compute({ profile: 'generic', as_of: d, params: GP(), orders: [ORD()] }).output_payload.verdict;
  const dim = (y, m) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  const pad = (n, w) => String(n).padStart(w, '0');
  for (const y of [1900, 2000, 2023, 2024, 2026, 2100]) {
    for (let m = 1; m <= 12; m++) {
      const last = dim(y, m);
      t.ok(run(pad(y, 4) + '-' + pad(m, 2) + '-' + pad(last, 2)) === 'completed', 'last ' + y + '-' + m);
      t.ok(run(pad(y, 4) + '-' + pad(m, 2) + '-' + pad(last + 1, 2)) === 'refused', 'past ' + y + '-' + m);
      t.ok(run(pad(y, 4) + '-' + pad(m, 2) + '-01') === 'completed', 'first ' + y + '-' + m);
      t.ok(run(pad(y, 4) + '-' + pad(m, 2) + '-00') === 'refused', 'zero day ' + y + '-' + m);
    }
  }
  for (const bad of ['2026-00-10', '2026-13-01', '2026-1-01', '2026-10-1', '26-10-01', '2026-10-01x', 'x2026-10-01', '2026/10/01', '', '2026-10-011']) {
    t.ok(run(bad) === 'refused', 'shape ' + bad);
  }
  return { name: 'P7_calendar_date_validation', checked: t.checked, violations: t.violations, failed: t.failed };
}

// P8 — EXACT FEE VALUES per family, rounding mode, unit snapping and floor, derived by
// hand from the declared formulas (fee = theta x C x p x (1-p), micro-dollars).
function checkExactFees() {
  const t = tally();
  const one = (params, order, asOf) => GEN(params, order, asOf);
  const fills = (c, p) => [{ contracts: c, price_micro: p }];

  // parabolic: 7% of C x p x (1-p): 2 x 0.25 x 0.07 = 0.035 dollars = 35000 micro
  t.ok(fee0(one(GP())) === 35000, 'parabolic 35000');
  // flat declares a zero effective theta and echoes its family (the per-fill pricing of
  // generic flat/linear is not asserted here: see the row report)
  let r = one(GP({ fee_family: 'flat', flat_fee_micro: 700 }), ORD({ fills: fills(3, 123456) }));
  t.ok(r.output_payload.verdict === 'completed' && r.output_payload.fee_family === 'flat', 'flat family echo');
  t.ok(r.output_payload.effective_theta.taker.num === 0 && r.output_payload.effective_theta.taker.den === 1, 'flat theta zero');
  // multiplier family takes the parabolic path
  t.ok(fee0(one(GP({ fee_family: 'multiplier' }))) === 35000, 'multiplier path');

  // rounding mode: 1/3 theta at p=0.5, C=1 -> 83333.33 micro
  const third = (mode, c) => fee0(one(GP({ theta_taker_num: 1, theta_taker_den: 3, rounding_mode: mode }), ORD({ fills: fills(c || 1, 500000) })));
  t.ok(third('ceil') === 83334 && third('round_half_up') === 83333, 'ceil vs half-up');
  // fractions .25 / .5 / .75 / 1.5 of a micro
  const frac = (n, d, c, mode) => fee0(one(GP({ theta_taker_num: n, theta_taker_den: d, rounding_mode: mode }), ORD({ fills: fills(c, 500000) })));
  t.ok(frac(1, 1000000, 1, 'ceil') === 1 && frac(1, 1000000, 1, 'round_half_up') === 0, 'quarter');
  t.ok(frac(3, 1000000, 1, 'ceil') === 1 && frac(3, 1000000, 1, 'round_half_up') === 1, 'three quarters');
  t.ok(frac(1, 500000, 1, 'ceil') === 1 && frac(1, 500000, 1, 'round_half_up') === 1, 'tie rounds up (1)');
  t.ok(frac(1, 500000, 3, 'ceil') === 2 && frac(1, 500000, 3, 'round_half_up') === 2, 'tie rounds up (2)');
  t.ok(frac(1, 250000, 1, 'ceil') === 1 && frac(1, 250000, 1, 'round_half_up') === 1, 'exact integer');

  // fill unit snapping: round half up to the unit grid
  // C=1, p=0.5: fee micro = theta_num x 250000 / theta_den
  const unit = (u, n, d) => fee0(one(GP({ theta_taker_num: n, theta_taker_den: d, fill_rounding_unit_micro: u }), ORD({ fills: fills(1, 500000) })));
  t.ok(unit(100, 1, 3) === 83300, 'unit 100 down');
  t.ok(unit(100, 1, 5000) === 100, 'unit tie up');
  t.ok(unit(100, 49, 250000) === 0, 'unit below half');
  t.ok(unit(100, 51, 250000) === 100, 'unit above half');
  t.ok(unit(1, 51, 250000) === 51, 'unit 1 identity');

  // minimum-fee floor: strictly below the floor rounds to zero, at/above stays
  const floor = (fm) => fee0(one(GP({ theta_taker_num: 1, theta_taker_den: 100, floor_min_fee_micro: fm }), ORD({ fills: fills(1, 500000) })));
  t.ok(floor(3000) === 0 && floor(2501) === 0 && floor(2500) === 2500 && floor(1) === 2500 && floor(0) === 2500, 'floor boundary');
  t.ok(fee0(one(GP({ floor_min_fee_micro: 1 }))) === 35000, 'floor does not bite');

  // exact rebate_share: maker rebate = floor(taker-equivalent x bp / 10000)
  const rs = (role, bp) => one(GP({ fee_family: 'rebate_share', rebate_share_bp: bp }), ORD({ role }));
  let po = rs('maker', 2500).output_payload.per_order[0];
  t.ok(po.per_fill[0].trade_fee_micro === 35000 && po.per_fill[0].rebate_micro === 8750 && po.per_fill[0].net_fee_micro === 26250 && po.order_fee_micro === 26250, 'rebate 25%');
  po = rs('maker', 3333).output_payload.per_order[0];
  t.ok(po.per_fill[0].rebate_micro === 11665 && po.order_fee_micro === 23335, 'rebate floors');
  po = rs('maker', 0).output_payload.per_order[0];
  t.ok(po.per_fill[0].rebate_micro === 0 && po.order_fee_micro === 35000, 'rebate 0');
  po = rs('maker', 10000).output_payload.per_order[0];
  t.ok(po.per_fill[0].rebate_micro === 35000 && po.order_fee_micro === 0, 'rebate 100%');
  po = rs('taker', 5000).output_payload.per_order[0];
  t.ok(po.per_fill[0].rebate_micro === 0 && po.order_fee_micro === 35000, 'taker gets no rebate');
  t.ok(rs('maker', 2500).output_payload.rebate_share_bp === 2500 && one(GP()).output_payload.rebate_share_bp === null, 'rebate bp echo');

  // generic accumulator: rounding overpayment carries; rebate paid in whole order units
  const acc = (over) => one(GP(Object.assign({ theta_taker_num: 1, theta_taker_den: 3, order_rounding_unit_micro: 100, accumulator: true }, over)),
    ORD({ fills: [{ contracts: 1, price_micro: 500000 }, { contracts: 1, price_micro: 500000 }] }));
  r = acc();
  po = r.output_payload.per_order[0];
  t.ok(r.output_payload.accumulator === true && po.per_fill[0].trade_fee_micro === 83334 && po.per_fill[0].rounding_fee_micro === 66
    && po.per_fill[0].rebate_micro === 0 && po.per_fill[0].net_fee_micro === 83400, 'acc fill 1');
  t.ok(po.per_fill[1].rounding_fee_micro === 66 && po.per_fill[1].rebate_micro === 100 && po.per_fill[1].net_fee_micro === 83300, 'acc fill 2');
  t.ok(po.order_fee_micro === 166700 && po.carry_micro === 32 && po.trade_fees_micro === 166668 && po.rebate_total_micro === 100 && po.conservation_ok === true, 'acc order');
  t.ok(r.output_payload.total_fee_micro === 166700 && r.output_payload.fills_net_sum_micro === 166700 && r.output_payload.conservation_ok === true, 'acc totals');
  t.ok(acc({ accumulator: false }).output_payload.accumulator === false, 'acc off');
  t.ok(acc({ accumulator: 'yes' }).output_payload.accumulator === false, 'acc strict true');
  t.ok(acc({ order_rounding_unit_micro: 0 }).output_payload.accumulator === false, 'acc needs a unit');
  po = acc({ accumulator: false }).output_payload.per_order[0];
  t.ok(po.per_fill[0].rounding_fee_micro === 0 && po.per_fill[0].net_fee_micro === 83334 && po.carry_micro === 0, 'no acc no rounding fee');
  // a trade fee that already sits on the grid carries nothing
  po = one(GP({ order_rounding_unit_micro: 100, accumulator: true })).output_payload.per_order[0];
  t.ok(po.per_fill[0].rounding_fee_micro === 0 && po.carry_micro === 0 && po.order_fee_micro === 35000, 'acc on grid');

  // reported-fee comparison: sign convention and flags
  const rep = (n) => one(GP(), ORD({ reported_fee_minor: n }));
  for (const [n, check, flag] of [[35000, 'MATCH', 'FEE_CHECK_MATCH'], [40000, 'OVERCHARGE', 'FEE_CHECK_OVERCHARGE'], [30000, 'UNDERCHARGE', 'FEE_CHECK_UNDERCHARGE'], [0, 'UNDERCHARGE', 'FEE_CHECK_UNDERCHARGE'], [35001, 'OVERCHARGE', 'FEE_CHECK_OVERCHARGE'], [34999, 'UNDERCHARGE', 'FEE_CHECK_UNDERCHARGE']]) {
    const x = rep(n);
    const flags = x.compliance_flags;
    t.ok(x.output_payload.per_order[0].fee_check === check && x.output_payload.per_order[0].reported_fee_minor === n
      && flags.includes(flag) && flags.filter((f) => f.startsWith('FEE_CHECK_')).length === 1, 'fee check ' + n);
  }
  t.ok(one(GP()).output_payload.per_order[0].fee_check === null && one(GP()).compliance_flags.length === 0, 'no reported fee, no check');

  // multi-order totals and kind/role echo
  r = compute({ profile: 'generic', as_of: '2026-10-01', params: GP(), orders: [ORD({ order_label: 'one-a' }), ORD({ order_label: 'two-a', role: 'maker', fills: fills(3, 500000) })] });
  t.ok(r.output_payload.per_order[0].kind === 'standard' && r.output_payload.per_order[1].role === 'maker' && r.output_payload.per_order[1].order_label === 'two-a', 'order echo');
  t.ok(r.output_payload.total_fee_micro === 35000 + 52500 && r.output_payload.fills_net_sum_micro === 87500, 'multi-order total');
  // theta maker override on the generic profile
  r = one(GP({ theta_maker_num: 1, theta_maker_den: 100 }), ORD({ role: 'maker' }));
  t.ok(fee0(r) === 5000 && r.output_payload.effective_theta.maker.num === 1 && r.output_payload.effective_theta.taker.num === 7, 'maker theta override');
  r = one(GP({ theta_maker_num: 0, theta_maker_den: 1 }), ORD({ role: 'maker' }));
  t.ok(fee0(r) === 0, 'maker theta zero override');
  // theta num of zero is a valid fee-free parameter set
  t.ok(fee0(one(GP({ theta_taker_num: 0 }))) === 0, 'theta zero');

  // BigInt-safe output: numbers up to 2^53-1, decimal strings above
  // C=1, p=0.5, theta n/250000 -> fee = n micro exactly
  t.ok(fee0(one(GP({ theta_taker_num: 9007199254740991, theta_taker_den: 250000 }), ORD({ fills: fills(1, 500000) }))) === 9007199254740991, 'max safe number');
  t.ok(fee0(one(GP({ theta_taker_num: 9007199254740992, theta_taker_den: 250000 }), ORD({ fills: fills(1, 500000) }))) === '9007199254740992', 'past max safe string');
  r = one(GP({ theta_taker_num: 1000000000, theta_taker_den: 1 }), ORD({ fills: fills(1000000000, 500000) }));
  t.ok(fee0(r) === '250000000000000000000000' && r.output_payload.total_fee_micro === '250000000000000000000000', 'big string');
  // domain boundaries accepted
  t.ok(one(GP(), ORD({ fills: fills(1000000000, 500000) })).output_payload.verdict === 'completed', 'contracts max');
  t.ok(one(GP(), ORD({ fills: fills(1, 1) })).output_payload.verdict === 'completed' && one(GP(), ORD({ fills: fills(1, 999999) })).output_payload.verdict === 'completed', 'price bounds');
  t.ok(one(GP(), ORD({ fills: Array.from({ length: 500 }, () => ({ contracts: 1, price_micro: 500000 })) })).output_payload.verdict === 'completed', '500 fills');
  t.ok(compute({ profile: 'generic', as_of: '2026-10-01', params: GP(), orders: Array.from({ length: 100 }, (_, i) => ORD({ order_label: 'o-' + i })) }).output_payload.verdict === 'completed', '100 orders');
  t.ok(one(GP(), ORD({ outcomes: ['ok-a', 'ok-b', 'ok-c'] })).output_payload.verdict === 'completed', 'outcomes ok');
  t.ok(one(GP(), ORD({ reported_fee_minor: 0 })).output_payload.verdict === 'completed', 'reported 0 ok');
  return { name: 'P8_exact_fee_values_by_family_rounding_floor', checked: t.checked, violations: t.violations, failed: t.failed };
}

// P9 — GENERIC EFFECTIVE ROWS AND ECHOED FIELDS: the effective_to day is inclusive,
// the latest matching row wins, the multiplier echoes with a default denominator of 1,
// and a generic run is labelled caller-declared.
function checkGenericRowsAndEcho() {
  const t = tally();
  const rows = [
    GP({ effective_from: '2026-01-01', effective_to: '2026-10-01', theta_taker_num: 5, theta_taker_den: 100 }),
    GP({ effective_from: '2026-10-02', theta_taker_num: 10, theta_taker_den: 100 }),
  ];
  const at = (d, rs) => fee0(GEN({ rows: rs || rows }, null, d));
  t.ok(at('2026-10-01') === 25000 && at('2026-10-02') === 50000 && at('2026-01-01') === 25000 && at('2030-01-01') === 50000, 'row boundaries');
  // overlapping rows: the later entry wins
  const overlap = [GP({ effective_from: '2026-01-01', theta_taker_num: 5 }), GP({ effective_from: '2026-01-01', theta_taker_num: 10 })];
  t.ok(at('2026-10-01', overlap) === 50000, 'later row wins');
  t.ok(at('2026-10-01', [overlap[1], overlap[0]]) === 25000, 'later row wins (swapped)');
  t.ok(GEN({ rows }, null, '2025-12-31').output_payload.refused_because === 'no_generic_row_effective_at_as_of', 'before first row');

  let p = GEN(GP()).output_payload;
  t.ok(p.venue_label === 'caller-declared' && p.source_pin === 'caller-declared parameters' && p.as_of === '2026-10-01' && p.profile_id === 'generic', 'caller-declared labels');
  t.ok(p.series_multiplier.num === 1 && p.series_multiplier.den === 1 && p.order_rounding_unit_micro === 0 && p.accumulator === false, 'generic defaults');
  t.ok(p.evidence.refused === false && p.evidence.tool_id === KERNEL_ID && p.evidence.record_type === 'event_contract_fee_recompute', 'completed evidence');
  t.ok(p.rounding_mode === 'ceil' && p.fill_rounding_unit_micro === 1 && p.fee_family === 'parabolic', 'params echo');
  t.ok(!('category' in p) && !('effective_date_pinned' in p), 'no venue-only fields on generic');
  p = GEN(GP({ series_multiplier_num: 3 })).output_payload;
  t.ok(p.series_multiplier.num === 3 && p.series_multiplier.den === 1, 'multiplier default den');
  p = GEN(GP({ series_multiplier_num: 3, series_multiplier_den: 2 })).output_payload;
  t.ok(p.series_multiplier.num === 3 && p.series_multiplier.den === 2, 'multiplier echo');
  p = GEN(GP({ order_rounding_unit_micro: 250 })).output_payload;
  t.ok(p.order_rounding_unit_micro === 250, 'order unit echo');

  // shipped profiles: category table, role fee zones, pinned dates
  const cats = { finance: [1, 25], politics: [1, 25], economics: [1, 20], culture: [1, 20], weather: [1, 20], other: [1, 20], mentions: [1, 25], tech: [1, 25] };
  for (const [c, [n, d]] of Object.entries(cats)) {
    const g = compute({ profile: 'polymarket_global', as_of: '2026-10-01', category: c, orders: [ORD()] }).output_payload;
    t.ok(g.verdict === 'completed' && g.category === c && g.effective_theta.taker.num === n && g.effective_theta.taker.den === d, 'category ' + c);
    t.ok(g.effective_theta.maker.num === 0 && g.effective_theta.maker.den === 1, 'maker zero ' + c);
  }
  for (const c of [undefined, '', 5]) {
    const g = compute({ profile: 'polymarket_global', as_of: '2026-10-01', category: c, orders: [ORD()] }).output_payload;
    t.ok(g.verdict === 'completed' && g.category === 'other' && g.effective_theta.taker.den === 20, 'category default ' + String(c));
  }
  const mk = compute({ profile: 'polymarket_global', as_of: '2026-10-01', category: 'sports', orders: [ORD({ role: 'maker' })] });
  t.ok(mk.output_payload.verdict === 'completed' ? fee0(mk) === 0 : mk.output_payload.refused_because === 'unknown_category', 'global maker pays nothing or category refused');
  // Polymarket global minimum fee: a tiny fill below 10 micro rounds to zero, the floor itself stays
  const tiny = compute({ profile: 'polymarket_global', as_of: '2026-10-01', category: 'finance', orders: [ORD({ fills: [{ contracts: 1, price_micro: 1 }] })] });
  t.ok(tiny.output_payload.verdict === 'completed' && fee0(tiny) === 0, 'global tiny fill floors to zero');
  t.ok(KAL(ORD()).output_payload.effective_date_pinned === false, 'kalshi date not pinned');
  t.ok(KAL(ORD({ role: 'maker' })).output_payload.verdict === 'completed' && fee0(KAL(ORD({ role: 'maker' }))) === 0, 'kalshi maker zero');
  t.ok(KAL(ORD(), { balance_precision_micro: 100 }).output_payload.order_rounding_unit_micro === 100, 'kalshi direct member grid');
  t.ok(KAL(ORD(), { balance_precision_micro: 1 }).output_payload.order_rounding_unit_micro === 10000 && KAL(ORD()).output_payload.order_rounding_unit_micro === 10000, 'kalshi default grid');
  t.ok(KAL(ORD()).output_payload.accumulator === true, 'kalshi accumulator on');
  const us = (kind, asOf, role) => {
    const o = kind === 'combo' ? { order_label: 'us-a', role: role || 'taker', kind: 'combo', legs: [{ fills: [{ contracts: 1, price_micro: 500000 }] }] } : ORD({ role: role || 'taker', fills: [{ contracts: 1, price_micro: 500000 }] });
    return compute({ profile: 'polymarket_us', as_of: asOf, orders: [o] });
  };
  // combo surcharge schedule: the new curve starts on its effective date, not before
  t.ok(fee0(us('combo', '2026-09-25')) === 18630, 'us combo surcharge day');
  t.ok(fee0(us('combo', '2026-09-26')) === 18630, 'us combo surcharge after');
  t.ok(fee0(us('combo', '2026-09-24')) === 17380, 'us combo before surcharge');
  t.ok(fee0(us('std', '2026-09-25')) === 17380 && fee0(us('std', '2026-09-24')) === 17380, 'us standard unaffected');
  t.ok(fee0(us('std', '2026-09-25', 'maker')) === 0, 'us maker pays nothing');
  return { name: 'P9_generic_rows_and_echoed_fields', checked: t.checked, violations: t.violations, failed: t.failed };
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
  checkRefusalTable(),
  checkCalendar(),
  checkExactFees(),
  checkGenericRowsAndEcho(),
];
for (const p of properties) if (p.failed && p.failed.length) console.error(p.name + ' FAILED: ' + p.failed.slice(0, 40).join(' | '));
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
