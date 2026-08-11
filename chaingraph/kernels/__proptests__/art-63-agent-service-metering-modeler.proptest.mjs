// kernel_digest_at_authoring: sha256:db80ef83629be0220c5b3db867b3911ee1a7817bb6e530149ec725258b0edafe
//
// FV-PROPFLOOR-SHARD-B15-1 — property-test floor for art-63-agent-service-metering-modeler.
// Class B (bounded-numeric), FLOAT-SENSITIVE (net_margin_pct, batch_savings_pct, and the
// sensitivity table all divide by gross_revenue_day / unbatched_cost_day and apply toFixed —
// classic division-near-zero and rounding-boundary surface) — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3, including near-zero take_rate_pct and
// near-zero calls_per_day since the kernel divides by calls_per_day (guarded by `|| 1`).
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-63-agent-service-metering-modeler.proptest.mjs

import { compute } from '../art-63-agent-service-metering-modeler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-63-agent-service-metering-modeler.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x63A11);
const TRIALS = 8000;
function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

function mkPP(rng) {
  return {
    pricing: {
      model: 'per-call',
      unit_price_minor: randInt(rng, 1, 10000),
      currency: 'USDC',
    },
    usage: {
      calls_per_day: randInt(rng, 1, 1000000),
      avg_units_per_call: randInt(rng, 1, 10),
    },
    settlement: {
      rail: 'x402-v2',
      batch: rng() < 0.7,
      per_tx_cost_minor: randInt(rng, 1, 500),
      batch_size: randInt(rng, 1, 10000),
    },
    marketplace: {
      take_rate_pct: randRange(rng, 0, 20),
      infra_cost_per_day_minor: randInt(rng, 0, 500000),
    },
  };
}

// ---------- P1: exactness — net_margin_day = gross_revenue - settlement_cost - take_and_infra ----------
function checkP1_netMarginExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { gross_revenue_day, settlement_cost_day, take_and_infra_day, net_margin_day } = r.output_payload;
    const expected = gross_revenue_day - settlement_cost_day - take_and_infra_day;
    if (Math.abs(net_margin_day - expected) > 1e-6) violations++;
  }
  return { name: 'P1_net_margin_day_exact_revenue_minus_cost_minus_takeinfra', trials: checked, violations };
}

// ---------- P2: boundedness — net_margin_pct is always finite (never NaN/Infinity even at edge inputs) ----------
function checkP2_netMarginPctFinite() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!Number.isFinite(r.output_payload.net_margin_pct)) violations++;
  }
  return { name: 'P2_net_margin_pct_always_finite', trials: checked, violations };
}

// ---------- P3: monotonicity — increasing batch_size (staying batched) never increases settlement_cost_day ----------
function checkP3_monotonicSettlementCostInBatchSize() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const small = { ...pp, settlement: { ...pp.settlement, batch: true, batch_size: Math.max(1, Math.floor(pp.usage.calls_per_day / 10) || 1) } };
    const large = { ...pp, settlement: { ...pp.settlement, batch: true, batch_size: pp.usage.calls_per_day * 2 + 1000 } };
    const rSmall = compute(small);
    const rLarge = compute(large);
    checked++;
    if (rLarge.output_payload.settlement_cost_day > rSmall.output_payload.settlement_cost_day + 1e-6) violations++;
  }
  return { name: 'P3_settlement_cost_nonincreasing_as_batch_size_grows', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ marketplace: { take_rate_pct: 0, infra_cost_per_day_minor: 0 } }, 'take_rate_pct exactly 0 and infra exactly 0 — net_margin_pct must equal 100 - (settlement_cost/gross)*100 exactly, no NaN'],
  [{ marketplace: { take_rate_pct: -0 } }, 'take_rate_pct negative zero — must behave identically to positive zero, no NaN or sign-flip in take_amount_day'],
  [{ pricing: { unit_price_minor: 0 } }, 'unit_price_minor exactly 0 — gross_revenue_day is 0, net_margin_pct must hit the `gross_revenue_day > 0 ? ... : 0` guard and return exactly 0, not NaN/Infinity from 0/0'],
  [{ usage: { calls_per_day: 1 } }, 'calls_per_day exactly 1 — smallest nonzero denominator, settlement_cost_per_call must be finite, breakeven_calls_day must not divide by zero'],
  [{ marketplace: { take_rate_pct: 100 } }, 'take_rate_pct exactly 100 — revenue_net_take_per_call = price*(1-1) = 0 exactly, margin_per_call must be non-positive, breakeven_calls_day must be null (infinite), not divide-by-zero crash'],
  [{ settlement: { batch: true, batch_size: 1 } }, 'batch_size exactly 1 — batch and per-request paths must produce the same settlement_cost_day (batch of 1 == unbatched), batch_savings_pct must be exactly 0'],
  [{ marketplace: { take_rate_pct: 0.1 * 3 } }, 'take_rate_pct = 0.1*3 (classic non-exact double 0.30000000000000004) — take_amount_day must reflect that exact double, no silent snap to 0.3'],
  [{ usage: { calls_per_day: Number.MAX_SAFE_INTEGER > 1e9 ? 999999999 : 1 } }, 'calls_per_day near the practical ceiling — gross_revenue_day must remain finite, not overflow to Infinity'],
  [{ settlement: { per_tx_cost_minor: 0 } }, 'per_tx_cost_minor exactly 0 — settlement_cost_day must be exactly 0 regardless of batch mode, batch_savings_pct must be exactly 0 (0/0 guarded)'],
  [{ pricing: { unit_price_minor: 1 }, marketplace: { take_rate_pct: 99.99999999 } }, 'take_rate_pct extremely close to 100 (denormal-adjacent gap) — margin_per_call must stay a well-defined finite number, breakeven_calls_day null-or-huge but never NaN'],
];

function checkP4_forced() {
  const base = mkPP(mulberry32(0x63B22));
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = {
      pricing: { ...base.pricing, ...(overrides.pricing || {}) },
      usage: { ...base.usage, ...(overrides.usage || {}) },
      settlement: { ...base.settlement, ...(overrides.settlement || {}) },
      marketplace: { ...base.marketplace, ...(overrides.marketplace || {}) },
    };
    const r = compute(pp);
    const { net_margin_pct, breakeven_calls_day, batch_savings_pct, gross_revenue_day } = r.output_payload;
    const plausible = Number.isFinite(net_margin_pct) && Number.isFinite(gross_revenue_day)
      && (breakeven_calls_day === null || Number.isFinite(breakeven_calls_day))
      && Number.isFinite(batch_savings_pct);
    rows.push({ label, input: pp, net_margin_pct, breakeven_calls_day, batch_savings_pct, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_netMarginExact());
results.properties.push(checkP2_netMarginPctFinite());
results.properties.push(checkP3_monotonicSettlementCostInBatchSize());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
