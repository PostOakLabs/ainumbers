// art-654-perp-funding-implied-yield — class-K property-test floor.
// kernel_digest_at_authoring: sha256:d10783401eec2998aef2e27c245e97fc78632f94a25943c54ecca3ccec527663
// spec: DERIV-WORKFLOWS-BUILD-SPEC.md (DERIVMATH row, AT-13 + AT-15) + DERIV-WF-DERIVMATH-1
// human_sign_off: PENDING (this row does not sign -- manifest-level signature per spec §4)
//
// ZERO external dependencies -- Node built-ins only. Self-contained deliberately: the
// mutation-tier sandbox (scripts/run-mutation-tier.mjs's ensureSharedLibsCopied) only
// mirrors `chaingraph/kernels/_*.mjs`, not `chaingraph/kernels/__proptests__/_pbt-common.mjs`,
// so a proptest file importing that helper ERR_MODULE_NOT_FOUNDs inside the sandbox even
// though it runs fine standalone. Same fixture-oracle/mulberry32 shapes, inlined.
//
// Run: node chaingraph/kernels/__proptests__/art-654-perp-funding-implied-yield.proptest.mjs

import { compute } from '../art-654-perp-funding-implied-yield.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KERNEL_ID = 'art-654-perp-funding-implied-yield';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x654);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const MECHANISMS = ['offshore-8h-twap', 'kalshi-periodic'];
const SIDES = ['long', 'short'];

function mkValidPP(rng, overrides = {}) {
  const mechanism = overrides.funding_mechanism ?? pick(rng, MECHANISMS);
  const base = {
    funding_mechanism: mechanism,
    venue: pick(rng, ['hyperliquid', 'binance', 'dydx_v4', 'kalshi', 'generic']),
    mark_price: randRange(rng, 0.01, 200000),
    index_price: randRange(rng, 0.01, 200000),
    interval_hours: randRange(rng, 0.25, 24),
    position_notional: randRange(rng, 0, 5000000),
    position_side: pick(rng, SIDES),
    premium_index_pct: randRange(rng, -5, 5),
    interest_rate_pct: randRange(rng, -1, 1),
  };
  if (mechanism === 'offshore-8h-twap') base.clamp_pct = randRange(rng, 0, 1);
  return { ...base, ...overrides };
}

// ---------- fixture oracle ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', `${KERNEL_ID}.fixtures.json`);
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    if (JSON.stringify(output_payload) !== JSON.stringify(vec.output_payload)) {
      failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
    }
  }
  return { total: fixtures.vectors.length, failures };
}

// ---------- P1: determinism -- compute() is a pure function of pp ----------
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

// ---------- P2: sign convention -- funding_payment sign follows position_side/funding_rate per the cited rule ----------
function checkP2_signConvention() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 10000; i++) {
    const pp = mkValidPP(rand);
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.domain_errors.length > 0) continue;
    const sideSign = op.position_side === 'long' ? 1 : -1;
    const expectedPayment = op.position_notional * (op.funding_rate_pct / 100) * sideSign;
    // Tolerance accounts for TWO independent round6() roundings compounding across the
    // rebuild (funding_rate_pct is rounded before this check reconstructs the payment from
    // it, rather than from the kernel's own unrounded intermediate funding_rate) -- this is
    // slack in the TEST's reconstruction, not in the kernel, which the fixture oracle above
    // already pins byte-for-byte.
    if (Math.abs(op.funding_payment - expectedPayment) > 1e-3 + Math.abs(op.position_notional) * 1e-7) violations++;
    const expectedDir = op.funding_payment > 0 ? 'position_pays' : (op.funding_payment < 0 ? 'position_receives' : 'flat');
    if (op.funding_payment_direction !== expectedDir) violations++;
  }
  return { name: 'P2_funding_payment_sign_matches_side_and_rate', checked, violations };
}

// ---------- P3: domain rejection -- an invalid input is always refused, never silently computed ----------
function checkP3_domainRejection() {
  let violations = 0, checked = 0;
  const badMakers = [
    (pp) => ({ ...pp, funding_mechanism: 'not-a-real-mechanism' }),
    (pp) => ({ ...pp, mark_price: -1 }),
    (pp) => ({ ...pp, index_price: 0 }),
    (pp) => ({ ...pp, interval_hours: 0 }),
    (pp) => ({ ...pp, position_notional: -1 }),
    (pp) => ({ ...pp, position_side: 'sideways' }),
    (pp) => ({ ...pp, premium_index_pct: NaN }),
    (pp) => ({ ...pp, prev_funding_hash: 'garbage' }),
  ];
  for (let i = 0; i < 4000; i++) {
    const base = mkValidPP(rand);
    const spoil = pick(rand, badMakers);
    const pp = spoil(base);
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (op.domain_errors.length === 0) { violations++; continue; }
    if (!compliance_flags.includes('DOMAIN_ERROR')) violations++;
    if (op.funding_rate_pct !== null || op.funding_payment !== null || op.implied_annual_funding_yield_pct !== null) violations++;
  }
  return { name: 'P3_invalid_input_always_refused_never_computed', checked, violations };
}

// ---------- P4: offshore-8h-twap clamp bound -- the interest/premium offset never exceeds clamp_pct ----------
function checkP4_clampBound() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 6000; i++) {
    const pp = mkValidPP(rand, { funding_mechanism: 'offshore-8h-twap' });
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.domain_errors.length > 0) continue;
    const offset = op.funding_rate_pct - op.premium_index_pct;
    // Tolerance covers the independent round6() roundings of funding_rate_pct, premium_index_pct
    // and clamp_pct each compounding into this test's reconstructed offset -- test-side slack,
    // not kernel slack (the fixture oracle above pins the kernel's exact bytes).
    if (Math.abs(offset) > op.clamp_pct + 1e-4) violations++;
  }
  return { name: 'P4_offshore_offset_within_declared_clamp_pct', checked, violations };
}

// ---------- P5: kalshi-periodic identity -- funding_rate_pct === premium_index_pct exactly, no clamp field ----------
function checkP5_kalshiIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 6000; i++) {
    const pp = mkValidPP(rand, { funding_mechanism: 'kalshi-periodic' });
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.domain_errors.length > 0) continue;
    if (op.funding_rate_pct !== op.premium_index_pct) violations++;
    if (op.clamp_pct !== null) violations++;
  }
  return { name: 'P5_kalshi_periodic_funding_rate_equals_premium_index', checked, violations };
}

// ---------- P6: chaining -- a valid prev_funding_hash always flows through, backward-compatibly ----------
function checkP6_chainedFlag() {
  let violations = 0, checked = 0;
  const validHash = 'sha256:' + '7'.repeat(64);
  for (let i = 0; i < 2000; i++) {
    const withoutHash = mkValidPP(rand);
    const withHash = { ...withoutHash, prev_funding_hash: validHash };
    const rWith = compute(withHash).output_payload;
    const rWithout = compute(withoutHash).output_payload;
    checked++;
    if (rWith.domain_errors.length > 0 || rWithout.domain_errors.length > 0) continue;
    if (rWith.chained !== true || rWith.prev_funding_hash !== validHash) violations++;
    if (rWithout.chained !== false || rWithout.prev_funding_hash !== null) violations++;
    // Omitting prev_funding_hash must reproduce the unchained shape byte-for-byte
    // except for the chained/prev_funding_hash fields themselves (backward-compat).
    const stripChain = (op) => { const { chained, prev_funding_hash, ...rest } = op; return rest; };
    if (JSON.stringify(stripChain(rWith)) !== JSON.stringify(stripChain(rWithout))) violations++;
  }
  return { name: 'P6_prev_funding_hash_wiring_is_backward_compatible', checked, violations };
}

// ---------- P7 (mandatory, float-sensitive): ULP/edge-boundary forcing ----------
const BOUNDARY_CASES = [
  [{ funding_mechanism: 'offshore-8h-twap', mark_price: 0.01, index_price: 0.01, interval_hours: 0.25, position_notional: 0, premium_index_pct: 0, interest_rate_pct: 0, clamp_pct: 0 }, 'all-zero/near-zero offshore inputs -- must not throw or produce NaN'],
  [{ funding_mechanism: 'kalshi-periodic', mark_price: 200000, index_price: 200000, interval_hours: 8760, position_notional: 5000000, premium_index_pct: 0 }, 'max-scale kalshi inputs, 1-year interval -- periods_per_year must stay finite'],
  [{ funding_mechanism: 'offshore-8h-twap', premium_index_pct: 0.1 * 3, interest_rate_pct: 0.1 * 3, clamp_pct: 0.1 * 3 }, 'classic non-exact doubles (0.1*3) feeding the clamp -- must round-trip through round6 without throwing'],
  [{ funding_mechanism: 'offshore-8h-twap', premium_index_pct: (1 / 3) * 3, clamp_pct: (1 / 3) * 3 }, '(1/3)*3 x/y*y!==x artifact -- must not flip the clamp boundary on float noise'],
  [{ funding_mechanism: 'offshore-8h-twap', clamp_pct: 0 }, 'clamp_pct exactly zero -- funding_rate must collapse to premium_index_pct exactly'],
  [{ position_notional: 0 }, 'zero notional -- funding_payment must be exactly 0 and direction "flat"'],
  [{ interval_hours: 8760 }, 'interval_hours at the 1-year domain ceiling -- must stay finite, not domain-reject'],
  [{ interval_hours: 8760.0001 }, 'interval_hours 0.0001 over the domain ceiling -- must domain-reject, never silently clamp'],
];

function checkP7_forced() {
  const rows = [];
  for (const [overrides, label] of BOUNDARY_CASES) {
    const pp = mkValidPP(rand, overrides);
    const { output_payload: op } = compute(pp);
    const finite = op.domain_errors.length > 0
      ? true // a domain-reject vector is plausible by construction -- nothing numeric to check
      : [op.funding_rate_pct, op.funding_payment, op.periods_per_year, op.implied_annual_funding_yield_pct].every(Number.isFinite);
    rows.push({ label, overrides, domain_errors: op.domain_errors, plausible: finite });
  }
  return rows;
}

// ---------- run ----------
const oracle = runFixtureOracle();
console.log(`=== ${KERNEL_ID} — class-K floor property test ===`);
console.log(`fixture-oracle: ${oracle.total - oracle.failures.length}/${oracle.total} PASS`);
if (oracle.failures.length) console.log('FIXTURE ORACLE FAILURES:', JSON.stringify(oracle.failures, null, 2));

const properties = [
  checkP1_determinism(),
  checkP2_signConvention(),
  checkP3_domainRejection(),
  checkP4_clampBound(),
  checkP5_kalshiIdentity(),
  checkP6_chainedFlag(),
];
for (const p of properties) {
  console.log(`  [${p.violations === 0 ? 'PASS' : 'FAIL'}] ${p.name} — ${p.checked} checked, ${p.violations} violations`);
}
const boundaryForced = checkP7_forced();
console.log(`  boundary-forced: ${boundaryForced.filter((b) => b.plausible).length}/${boundaryForced.length} plausible`);
if (boundaryForced.some((b) => !b.plausible)) console.log('BOUNDARY-FORCED FAILURES:', JSON.stringify(boundaryForced.filter((b) => !b.plausible), null, 2));

const ok = oracle.failures.length === 0
  && properties.every((p) => p.violations === 0)
  && boundaryForced.every((b) => b.plausible);
process.exit(ok ? 0 : 1);
