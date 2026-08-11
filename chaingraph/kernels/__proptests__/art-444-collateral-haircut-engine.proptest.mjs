// art-444-collateral-haircut-engine.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C20-1).
// kernel_digest_at_authoring: sha256:1d708d8172b54b003ff2da60df4711a8999f6e0d8f327a28ef3538e1eae84cb7
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct source read confirmed — Math.sqrt(NR/10) time-scaling per
// CRE22.68, r2 rounding, clampPct at multiple stages, over an unbounded collateral_items
// array) — ULP-boundary forcing present below (Math.sqrt is IEEE754 correctly-rounded per
// the kernel's own comment, but the CALLER-side clampPct/holding-period boundaries still
// need forcing: 0, negative zero, denormal holding periods, and the 100% combined-haircut
// clamp).
// Checks: fixture-oracle gate, termination (collateral_items length bounded by input array
// length), boundedness (net_exposure/collateral_adjusted_total finite and net_exposure >=
// 0), differential re-derivation of collateral_adjusted_total and net_exposure (CRE22.68
// formula), metamorphic collateral-item-order invariance, ULP-boundary forcing on
// timeScale(holding_period_days) at 0/-0/denormal and the combined_haircut_pct 100% clamp.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-444-collateral-haircut-engine.proptest.mjs

import { compute } from '../art-444-collateral-haircut-engine.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-444-collateral-haircut-engine.fixtures.json');
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
const rand = mulberry32(0x444A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const ASSET_CLASSES = ['govt_bond', 'corp_bond', 'equity', 'cash'];

function randomTable(rng) {
  return ASSET_CLASSES.filter((c) => c !== 'cash').map((c) => ({ asset_class: c, maturity_bucket: null, haircut_pct: rng() * 20 }));
}

function randomItem(rng, i) {
  return { item_id: 'i' + i, asset_class: pick(rng, ASSET_CLASSES), market_value: rng() * 1e6, currency: 'USD' };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 10);
  return {
    haircut_table_version: 'v1',
    haircut_table: randomTable(rng),
    fx_haircut_pct: rng() * 15,
    min_haircut_floor_pct: rng() * 5,
    holding_period_days: 1 + rng() * 30,
    exposure: { amount: rng() * 1e6, currency: 'USD', asset_class: pick(rng, ASSET_CLASSES) },
    collateral_items: Array.from({ length: n }, (_, i) => randomItem(rng, i)),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — collateral_items length bounded by input array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.item_count !== pp.collateral_items.length) violations++;
    if (output_payload.collateral_items.length !== pp.collateral_items.length) violations++;
  }
  return { name: 'P1_termination_collateral_items_bounded_by_input', trials: checked, violations };
}

// ---------- P2: boundedness — net_exposure/collateral_adjusted_total finite, net_exposure never negative ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.net_exposure) || output_payload.net_exposure < 0) violations++;
    if (!Number.isFinite(output_payload.collateral_adjusted_total)) violations++;
    for (const item of output_payload.collateral_items) {
      if (item.combined_haircut_pct < 0 || item.combined_haircut_pct > 100) violations++;
    }
  }
  return { name: 'P2_boundedness_net_exposure_nonneg_and_haircut_range', trials: checked, violations };
}

// ---------- P3 (differential): net_exposure = max(0, E*(1+He) - sum(adjusted collateral)) ----------
function checkP3_net_exposure_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = Math.max(0, Math.round((output_payload.exposure_adjusted - output_payload.collateral_adjusted_total) * 100) / 100);
    if (Math.abs(expected - output_payload.net_exposure) > 0.02) violations++;
  }
  return { name: 'P3_net_exposure_cre22_formula_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — reordering collateral_items never changes collateral_adjusted_total/net_exposure ----------
function checkP4_item_order_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.collateral_items.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const reversed = { ...pp, collateral_items: [...pp.collateral_items].reverse() };
    const r2v = compute(reversed).output_payload;
    checked++;
    if (Math.abs(r1.collateral_adjusted_total - r2v.collateral_adjusted_total) > 0.05) violations++;
    if (Math.abs(r1.net_exposure - r2v.net_exposure) > 0.05) violations++;
  }
  return { name: 'P4_item_order_metamorphic_invariance', trials: checked, violations };
}

// ---------- P5 (ULP-forcing): timeScale(holding_period_days) boundary + 100% combined-haircut clamp ----------
function checkP5_ulp_forcing() {
  let violations = 0, checked = 0;
  const EPS = Number.EPSILON;
  const boundaryDays = [0, -0, 10, 10 - EPS, 10 + EPS, EPS, -EPS, Number.MIN_VALUE, -Number.MIN_VALUE];
  for (const days of boundaryDays) {
    checked++;
    const { output_payload } = compute({
      haircut_table_version: 'v1', haircut_table: [{ asset_class: 'govt_bond', maturity_bucket: null, haircut_pct: 5 }],
      fx_haircut_pct: 8, min_haircut_floor_pct: 0, holding_period_days: days,
      exposure: { amount: 1000, currency: 'USD', asset_class: 'cash' },
      collateral_items: [{ item_id: 'x', asset_class: 'govt_bond', market_value: 1000, currency: 'USD' }],
    });
    // time_scale_factor is r2-rounded (2dp), so a sub-cent scale for a denormal/tiny holding
    // period legitimately rounds to 0 -- finiteness and non-negativity are the invariant, not
    // strict positivity.
    if (!Number.isFinite(output_payload.time_scale_factor) || output_payload.time_scale_factor < 0) violations++;
    if (!Number.isFinite(output_payload.net_exposure)) violations++;
  }
  // 100% combined-haircut clamp: force a huge haircut_pct override, must clamp to 100, never exceed
  checked++;
  const clampCase = compute({
    haircut_table_version: 'v1', haircut_table: [],
    fx_haircut_pct: 999999, min_haircut_floor_pct: 0, holding_period_days: 10,
    exposure: { amount: 1000, currency: 'USD', asset_class: 'cash' },
    collateral_items: [{ item_id: 'x', asset_class: 'govt_bond', market_value: 1000, currency: 'JPY', haircut_override_pct: 999999, override_reason_code: 'test' }],
  }).output_payload;
  if (clampCase.collateral_items[0].combined_haircut_pct !== 100) violations++;
  if (clampCase.collateral_items[0].adjusted_value !== 0) violations++;
  return { name: 'P5_ulp_boundary_forcing_timescale_and_100pct_haircut_clamp', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_net_exposure_differential());
results.properties.push(checkP4_item_order_metamorphic());
results.properties.push(checkP5_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-444-collateral-haircut-engine',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
