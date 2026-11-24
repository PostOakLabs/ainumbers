// art-857-average-price-allocation — class-K property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:37543c9279b6e96874dcd31f39f479b21dcfd4d2034b61d25beb1129b800f176
// spec: board row AVG-PRICE-ALLOC-NODE-1 (SPEC.md §4 execution_hash, §18 deferred landing)
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: NO. The kernel is BigInt end to end; this file recomputes with an
// independent BigInt formulation (cross-multiplied comparisons, no shared helper).
//
// Checks: fixture-oracle gate (30 vectors, V1-V10 from the row contract);
// P1 identity: sum of final amounts + unallocated residual = total_minor, every mode;
// P2 residual bound: |residual_minor| <= account count under unrounded_average;
// P3 refusals never produce amounts (junk set);
// P4 independent recompute of total_minor and pre-residual amounts;
// P5 determinism, shape, flag mirror, R4 (null equals absent for every key);
// P6 buildArtifact_never_throws;
// P7 red/green pair: a mutant that drops the residual is caught by P1, the kernel is not.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-857-average-price-allocation.proptest.mjs

import { compute, buildArtifact } from '../art-857-average-price-allocation.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-857-average-price-allocation';
const CURRENCIES = [['USD', 2], ['JPY', 0], ['BHD', 3], ['EUR', 2], ['CLF', 4]];

function randPP(rng) {
  const nf = 1 + Math.floor(rng() * 12);
  const fills = [];
  let q = 0;
  for (let i = 0; i < nf; i++) {
    const qty = 1 + Math.floor(rng() * 5000);
    const whole = Math.floor(rng() * 500);
    const decs = Math.floor(rng() * 9);
    let frac = '';
    for (let d = 0; d < decs; d++) frac += String(Math.floor(rng() * 10));
    let price = String(whole) + (decs ? '.' + frac : '');
    if (/^0(\.0*)?$/.test(price)) price = '0.01';
    fills.push({ price_per_share: price, quantity_shares: qty });
    q += qty;
  }
  const na = Math.min(q, 1 + Math.floor(rng() * 9));
  const allocations = [];
  let left = q;
  for (let i = 0; i < na; i++) {
    const s = i === na - 1 ? left : 1 + Math.floor(rng() * (left - (na - 1 - i)));
    allocations.push({ account: 'ACCT-' + i, shares: s });
    left -= s;
  }
  const [currency] = CURRENCIES[Math.floor(rng() * CURRENCIES.length)];
  const pp = { currency, side: rng() < 0.5 ? 'buy' : 'sell', fills, allocations };
  const mode = Math.floor(rng() * 4);
  if (mode === 1) pp.residual_handling = 'report_unallocated';
  if (mode >= 2) {
    pp.amount_basis = 'rounded_average_dp';
    pp.average_price_dp = Math.floor(rng() * 9);
    pp.residual_handling = mode === 2 ? 'assign_largest' : 'report_unallocated';
  }
  return pp;
}

function identityViolations(fn, seed, count) {
  let checked = 0, violations = 0;
  const rng = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const o = fn(randPP(rng)).output_payload;
    checked++;
    if (o.overall !== 'ALLOCATION_COMPUTED') { violations++; continue; }
    let sum = 0n;
    for (const a of o.allocations) sum += BigInt(a.amount_minor);
    const unalloc = o.residual_account === null ? BigInt(o.residual_minor) : 0n;
    if (sum + unalloc !== BigInt(o.total_minor) || o.identity_holds !== true) violations++;
  }
  return { checked, violations };
}

function checkP1Identity() {
  return { name: 'P1 identity: sum(final) + unallocated = total_minor', ...identityViolations(compute, 85701, 400) };
}

function checkP2ResidualBound() {
  let checked = 0, violations = 0;
  const rng = mulberry32(85702);
  for (let i = 0; i < 400; i++) {
    const pp = randPP(rng);
    delete pp.amount_basis; delete pp.average_price_dp;
    if (pp.residual_handling === 'assign_largest') delete pp.residual_handling;
    const o = compute(pp).output_payload;
    checked++;
    if (o.overall !== 'ALLOCATION_COMPUTED' || Math.abs(o.residual_minor) > o.allocations.length) violations++;
  }
  return { name: 'P2 |residual_minor| <= account count under unrounded_average', checked, violations };
}

function checkP3RefusalsNoAmounts() {
  let checked = 0, violations = 0;
  const base = () => ({ currency: 'USD', side: 'buy', fills: [{ price_per_share: '1.50', quantity_shares: 2 }], allocations: [{ account: 'A', shares: 2 }] });
  const bads = [undefined, null, '1', 1, NaN, Infinity, -1, 0, 1.5, 1e300, 9007199254740993, {}, [], true, 'constructor', '__proto__'];
  const keys = ['currency', 'side', 'fills', 'allocations', 'amount_basis', 'average_price_dp', 'residual_handling'];
  for (const k of keys) {
    for (const bad of bads) {
      const pp = base();
      if (bad === undefined) delete pp[k]; else pp[k] = bad;
      const r = compute(pp);
      const o = r.output_payload;
      checked++;
      if (o.overall === 'INPUT_REFUSED') {
        if (o.allocations.length !== 0 || o.total_minor !== null || o.residual_minor !== null || o.average_price !== null ||
            o.refusals.length < 1 || JSON.stringify(r.compliance_flags) !== '["INPUT_REFUSED"]') violations++;
      } else if (bad !== undefined && bad !== null) {
        violations++; // every bad present value refuses
      }
    }
  }
  for (const f of [{ price_per_share: '-1', quantity_shares: 1 }, { price_per_share: '1e2', quantity_shares: 1 }, { price_per_share: ' 1', quantity_shares: 1 },
    { price_per_share: '01.5', quantity_shares: 1 }, { price_per_share: '1.', quantity_shares: 1 }, { price_per_share: '1.5', quantity_shares: -1 }, 5, null]) {
    const o = compute({ ...base(), fills: [f] }).output_payload;
    checked++;
    if (o.overall !== 'INPUT_REFUSED' || o.allocations.length !== 0) violations++;
  }
  for (const bad of [null, undefined, 5, 'x', [], [1]]) {
    checked++;
    const o = compute(bad).output_payload;
    if (o.overall !== 'INPUT_REFUSED' || o.allocations.length !== 0) violations++;
  }
  const tooMany = { ...base(), fills: Array.from({ length: 5001 }, () => ({ price_per_share: '1', quantity_shares: 1 })) };
  checked++;
  if (compute(tooMany).output_payload.overall !== 'INPUT_REFUSED') violations++;
  return { name: 'P3 refusals never produce amounts', checked, violations };
}

// Independent recompute: price as integer numerator over 10^decimals, cross-multiplied.
function ratio(price) {
  const [w, f = ''] = price.split('.');
  return { n: BigInt(w + f), d: 10n ** BigInt(f.length) };
}
/** @param {bigint} n @param {bigint} d @returns {bigint} */
function roundHalfUpRatio(n, d) { // n/d >= 0, nearest integer, halves up
  const q = n / d, r = n - q * d;
  return 2n * r >= d ? q + 1n : q;
}
function checkP4Recompute() {
  let checked = 0, violations = 0;
  const rng = mulberry32(85704);
  for (let i = 0; i < 300; i++) {
    const pp = randPP(rng);
    const o = compute(pp).output_payload;
    checked++;
    const m = 10n ** BigInt(o.minor_unit_exponent);
    const D = 10n ** 8n;
    let N = 0n, Q = 0n;
    for (const f of pp.fills) { const r = ratio(f.price_per_share); N += BigInt(f.quantity_shares) * r.n * (D / r.d); Q += BigInt(f.quantity_shares); }
    const total = roundHalfUpRatio(N * m, D);
    let ok = BigInt(o.total_minor) === total;
    for (let k = 0; k < o.allocations.length; k++) {
      const s = BigInt(pp.allocations[k].shares);
      let want;
      if (pp.amount_basis === 'rounded_average_dp') {
        const dpS = 10n ** BigInt(pp.average_price_dp);
        const avgR = roundHalfUpRatio(N * dpS, Q * D);
        want = roundHalfUpRatio(s * avgR * m, dpS);
      } else {
        want = roundHalfUpRatio(s * N * m, Q * D);
      }
      if (BigInt(o.allocations[k].amount_minor_pre_residual) !== want) ok = false;
    }
    if (!ok) violations++;
  }
  return { name: 'P4 independent recompute of total and pre-residual amounts', checked, violations };
}

function checkP5DeterminismShapeR4() {
  let checked = 0, violations = 0;
  const rng = mulberry32(85705);
  for (let i = 0; i < 60; i++) {
    const pp = randPP(rng);
    const a = compute(pp), b = compute(pp);
    checked += 3;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    if (findShapeViolations(a.output_payload).length) violations++;
    if (JSON.stringify(a.output_payload.warnings) !== JSON.stringify(a.compliance_flags)) violations++;
    for (const k of Object.keys(pp)) {
      const withNull = { ...pp, [k]: null };
      const without = { ...pp }; delete without[k];
      checked++;
      if (JSON.stringify(compute(withNull)) !== JSON.stringify(compute(without))) violations++;
    }
  }
  return { name: 'P5 determinism, shape, flag mirror, null equals absent', checked, violations };
}

async function checkP6NeverThrows() {
  let checked = 0, violations = 0;
  const ok = { currency: 'USD', side: 'buy', fills: [{ price_per_share: '1.50', quantity_shares: 2 }], allocations: [{ account: 'A', shares: 2 }] };
  const inputs = [null, undefined, 1, 'x', [], ok, { ...ok, extra: 1e300 }, { ...ok, extra: { deep: [Infinity] } },
    { ...ok, fills: [{ price_per_share: '1', quantity_shares: 9007199254740993 }] }, { ...ok, currency: 10n },
    { ...ok, zzz: { a: [3n] } }, { ...ok, fills: [{ price_per_share: '999999999999999.99999999', quantity_shares: 9007199254740991 }], allocations: [{ account: 'A', shares: 9007199254740991 }] }];
  for (const pp of inputs) {
    checked++;
    try {
      const a = await buildArtifact(pp);
      const hashable = a.execution_hash !== null;
      if (!hashable && !a.hash_refusal) violations++;
      if (hashable && a.hash_refusal) violations++;
    } catch { violations++; }
  }
  return { name: 'buildArtifact_never_throws', checked, violations };
}

// P7 red/green: the mutant leaves every account at its pre-residual amount and still names a
// residual account, so the identity fails whenever the residual is non-zero.
function checkP7RedGreen() {
  const mutant = (pp) => {
    const r = compute(pp);
    const o = { ...r.output_payload, allocations: r.output_payload.allocations.map((a) => ({ ...a, amount_minor: a.amount_minor_pre_residual })) };
    return { ...r, output_payload: o };
  };
  const green = identityViolations(compute, 85707, 200).violations;
  const red = identityViolations(mutant, 85707, 200).violations;
  return { name: 'P7 red/green pair (kernel green, residual-dropping mutant red)', checked: 2, violations: (green === 0 ? 0 : 1) + (red > 0 ? 0 : 1) };
}

let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1Identity(), checkP2ResidualBound(), checkP3RefusalsNoAmounts(), checkP4Recompute(), checkP5DeterminismShapeR4(),
  await checkP6NeverThrows(), checkP7RedGreen(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
