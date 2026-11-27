// 858-fill-quality-summary — class-K property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:9cb6593dd7b5df7f20ad18aaed32b8e998abdd197681340441a20ffa06cee686
// spec: board/claimed/FILL-QUALITY-SUMMARY-NODE-1.md (SPEC.md §4 execution_hash, §18 deferred landing)
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: NO -- BigInt integer arithmetic, half-away-from-zero integer division.
//
// Checks: fixture-oracle gate (every golden and refusal vector); P1 the residual identity
// (sum price x qty = vwap x filled + residual) holds on random valid orders, with an
// independent BigInt oracle for vwap; P2 refusals never emit figures and always name a field;
// P3 participation is never above 100.00 and filled never exceeds the target; P4 input-class
// refusals (deleted, null, wrong type, prototype name) refuse by field name; P5 determinism;
// P6 buildArtifact_never_throws on inputs the shared canonicalizer cannot hash.
//
// ZERO external dependencies -- Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/858-fill-quality-summary.proptest.mjs

import { compute, buildArtifact } from '../858-fill-quality-summary.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = '858-fill-quality-summary';

const FIGURES = ['vwap_price', 'vwap_residual', 'filled_qty', 'fill_rate_pct', 'participation_pct', 'auction_fill_share_pct', 'cancel_ratio', 'order_to_trade_ratio'];

function randomOrder(rnd) {
  const n = 1 + Math.floor(rnd() * 8);
  const fills = [];
  let filled = 0;
  for (let i = 0; i < n; i++) {
    const q = 1 + Math.floor(rnd() * 5000);
    filled += q;
    fills.push({
      fill_id: 'f' + i, side: 'buy', currency: 'USD',
      price: String(1 + Math.floor(rnd() * 2000000)),
      quantity_shares: String(q),
      venue_type: rnd() < 0.4 ? 'auction' : 'continuous',
    });
  }
  const target = filled + Math.floor(rnd() * 3) * Math.floor(rnd() * 1000);
  const market = filled + Math.floor(rnd() * 100000);
  const orders = n + Math.floor(rnd() * 20);
  return {
    order_side: 'buy', order_target_qty: String(target), currency: 'USD',
    price_decimals: String(Math.floor(rnd() * 9)),
    market_volume_shares: String(market), market_volume_window: 'w',
    orders_placed: String(orders), cancels: String(Math.floor(rnd() * (orders + 1))),
    fills,
  };
}

function checkP1ResidualIdentity() {
  const rnd = mulberry32(858);
  let checked = 0, violations = 0;
  for (let i = 0; i < 400; i++) {
    const pp = randomOrder(rnd);
    const o = compute(pp).output_payload;
    checked++;
    if (o.refused !== false) { violations++; console.log('P1 violation: valid order refused', JSON.stringify(o.domain_errors)); continue; }
    let sum = 0n, qty = 0n;
    for (const f of pp.fills) { sum += BigInt(f.price) * BigInt(f.quantity_shares); qty += BigInt(f.quantity_shares); }
    const vwap = BigInt(o.vwap_price), res = BigInt(o.vwap_residual);
    if (sum !== vwap * BigInt(o.filled_qty) + res || BigInt(o.filled_qty) !== qty) { violations++; console.log('P1 violation: identity broken'); }
    // independent oracle: vwap is the nearest integer to sum/qty, ties away from zero
    const lo = sum / qty, rem = sum % qty;
    const want = 2n * rem >= qty ? lo + 1n : lo;
    if (vwap !== want) { violations++; console.log('P1 violation: vwap rounding'); }
    if (2n * (res < 0n ? -res : res) > qty) { violations++; console.log('P1 violation: residual exceeds half a share'); }
  }
  return { name: 'P1 residual identity and vwap rounding vs BigInt oracle', checked, violations };
}

function checkP2RefusalNoFigures() {
  const rnd = mulberry32(2858);
  let checked = 0, violations = 0;
  const mutators = [
    (p) => { p.fills[0].price = '100.5'; }, (p) => { p.fills[0].quantity_shares = '0'; },
    (p) => { p.fills[0].venue_type = 'x'; }, (p) => { p.order_side = 'hold'; },
    (p) => { p.price_decimals = '9'; }, (p) => { p.cancels = String(Number(p.orders_placed) + 1); },
    (p) => { p.market_volume_shares = '0'; }, (p) => { p.fills = []; },
    (p) => { p.currency = 'ZZZ'; }, (p) => { p.market_volume_window = ''; },
    (p) => { p.market_volume_shares = '1'; }, (p) => { p.order_target_qty = '1'; },
  ];
  for (let i = 0; i < 300; i++) {
    const pp = randomOrder(rnd);
    mutators[i % mutators.length](pp);
    const r = compute(pp);
    const o = r.output_payload;
    checked++;
    const emitted = FIGURES.some((k) => Object.prototype.hasOwnProperty.call(o, k));
    if (o.refused !== true || emitted || !Array.isArray(o.domain_errors) || o.domain_errors.length < 1
      || o.domain_errors.some((e) => typeof e.field !== 'string' || e.field.length === 0)
      || r.compliance_flags.join() !== 'INPUT_REFUSED') {
      violations++; console.log('P2 violation: mutator', i % mutators.length, JSON.stringify(o).slice(0, 120));
    }
  }
  return { name: 'P2 refusals never emit figures and always name a field', checked, violations };
}

function checkP3Bounds() {
  const rnd = mulberry32(3858);
  let checked = 0, violations = 0;
  for (let i = 0; i < 400; i++) {
    const pp = randomOrder(rnd);
    if (i % 2) pp.market_volume_shares = String(Math.max(1, Math.floor(rnd() * 20000)));
    const o = compute(pp).output_payload;
    checked++;
    if (o.refused === false) {
      if (Number(o.participation_pct) > 100 || Number(o.fill_rate_pct) > 100 || Number(o.auction_fill_share_pct) > 100
        || BigInt(o.filled_qty) > BigInt(pp.order_target_qty) || BigInt(o.filled_qty) > BigInt(pp.market_volume_shares)
        || o.unfilled_qty !== String(BigInt(pp.order_target_qty) - BigInt(o.filled_qty))
        || o.order_complete !== (o.unfilled_qty === '0' ? 'true' : 'false')
        || !/^[0-9]+\.[0-9]{2}$/.test(o.participation_pct)) { violations++; console.log('P3 violation: bound broken'); }
    } else {
      const names = o.domain_errors.map((e) => e.field);
      if (BigInt(pp.market_volume_shares) < pp.fills.reduce((a, f) => a + BigInt(f.quantity_shares), 0n) && !names.includes('filled_qty')) {
        violations++; console.log('P3 violation: volume overrun not named');
      }
    }
  }
  return { name: 'P3 participation never above 100.00; filled never above target or volume', checked, violations };
}

function checkP4InputClasses() {
  const rnd = mulberry32(4858);
  let checked = 0, violations = 0;
  const top = ['order_side', 'order_target_qty', 'currency', 'market_volume_shares', 'market_volume_window', 'orders_placed', 'cancels', 'fills'];
  for (const k of top) {
    for (const bad of [undefined, null, 5, true, [], {}, 'constructor', '__proto__', '1e3', ' 5', '+5', '05']) {
      // the window label is any non-empty string, echoed and never interpreted
      if (k === 'market_volume_window' && typeof bad === 'string') continue;
      const pp = randomOrder(rnd);
      if (bad === undefined) delete pp[k]; else pp[k] = bad;
      const o = compute(pp).output_payload;
      checked++;
      // a few combinations are legitimately valid (an enum-looking string never is; fills [] is refused)
      const names = o.domain_errors ? o.domain_errors.map((e) => e.field) : [];
      if (o.refused !== true || !names.includes(k)) { violations++; console.log('P4 violation:', k, JSON.stringify(bad)); }
    }
  }
  for (const nonObj of [null, undefined, 5, 'x', [], true]) {
    const o = compute(nonObj).output_payload;
    checked++;
    if (o.refused !== true || o.domain_errors[0].field !== 'policy_parameters') { violations++; console.log('P4 violation: non-object'); }
  }
  // prototype-name keys on the object are ignored, never read as inputs
  const pp = JSON.parse(JSON.stringify(randomOrder(mulberry32(1))).slice(0, -1) + ',"constructor":5,"toString":"x","__proto__":{"order_side":"sell"}}');
  checked++;
  if (compute(pp).output_payload.refused !== false) { violations++; console.log('P4 violation: prototype-name keys changed validity'); }
  return { name: 'P4 input classes (deleted, null, wrong type, prototype name) refuse by field', checked, violations };
}

function checkP5Determinism() {
  const rnd = mulberry32(5858);
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = randomOrder(rnd);
    checked++;
    if (JSON.stringify(compute(pp)) !== JSON.stringify(compute(JSON.parse(JSON.stringify(pp))))) { violations++; console.log('P5 violation: nondeterministic'); }
  }
  return { name: 'P5 determinism', checked, violations };
}

async function checkP6BuildArtifactNeverThrows() {
  let checked = 0, violations = 0;
  /** @type {any} */ let deep = 1; for (let i = 0; i < 600; i++) deep = [deep];
  const wide = new Array(1000001).fill(0);
  const base = () => randomOrder(mulberry32(7));
  const hostile = [
    { market_volume_shares: 1e300 }, { zzz: Infinity }, { zzz: NaN }, { zzz: { a: [Number.MAX_SAFE_INTEGER + 2] } },
    { zzz: deep }, { zzz: wide }, { zzz: 10n },
  ];
  for (const delta of hostile) {
    checked++;
    try {
      const art = await buildArtifact({ ...base(), ...delta });
      const r = art.hash_refusal;
      if (art.execution_hash !== null || !r || !/^REFUSED_INPUT_(UNSAFE_NUMBER|HASH_LIMIT)$/.test(r.reason)) { violations++; console.log('P6 violation: artifact shape', Object.keys(delta)[0]); }
    } catch (e) { violations++; console.log('P6 violation: buildArtifact threw', String(e.message).slice(0, 80)); }
  }
  for (const pp of [base(), { ...base(), currency: 'ZZZ' }, null, 5, []]) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      if (!/^[0-9a-f]{64}$/.test(art.execution_hash) || art.hash_refusal !== undefined) { violations++; console.log('P6 violation: clean input lost its hash'); }
    } catch (e) { violations++; console.log('P6 violation: threw on clean input', String(e.message).slice(0, 80)); }
  }
  return { name: 'buildArtifact_never_throws (null hash + hash_refusal on unhashable, hash on clean)', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1ResidualIdentity(),
  checkP2RefusalNoFigures(),
  checkP3Bounds(),
  checkP4InputClasses(),
  checkP5Determinism(),
  await checkP6BuildArtifactNeverThrows(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
