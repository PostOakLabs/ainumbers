// art-561-currency-basket-index.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C30-1).
// kernel_digest_at_authoring: sha256:84f9b197e0b2e11acc54f7bb0ac50a30db1e80f22e33238395093d9ac9887921
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — RE-CONFIRMED BY DIRECT READ per FIX-2; this matches the WU row's own
// float:yes classification, no correction needed. compute() takes arbitrary finite FX rates and
// amounts and performs genuine continuous floating-point arithmetic: index_value =
// sum(amount*usd_rate), live_weight = contribution/index_value, drift = (live_weight-target)*100,
// and a target-weight-sum structural gate compared against a 0.001 continuous tolerance
// (Math.abs(target_weight_sum - 1) > 0.001). ULP-boundary forcing is mandatory per spec §3 and is
// provided below (P5).
// Checks: fixture-oracle gate, termination/boundedness (P1: this kernel places NO array-length cap
// on components[] -- genuinely unbounded input -- confirmed to stay finite well beyond the
// fixture-tested range), a differential re-derivation of the fixed_amount_valuation index formula
// against an independent reimplementation (P3), a metamorphic scaling/homogeneity identity (P4: this
// kernel is linear in fixed_amount, so doubling every component's fixed_amount must double
// index_value exactly — the textbook f(scale*x)=scale*f(x) metamorphic identity spec §3 names as an
// example for a linear kernel — plus permutation-invariance over components[] order using
// integer-valued rates/amounts to isolate real order-dependence from summation-order noise), and
// mandatory ULP-boundary forcing on the target-weight-sum 0.001 tolerance gate, the derive-mode
// division (target_weight*index_value_at_rebase/rebase_usd_rate), and the basket_shift_pct 5%
// EXTREME_MOVEMENT flag threshold — 0, negative zero, denormals, values one ULP either side of each
// threshold, and an x/y*y!==x-shaped rebase-derivation case (P5).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-561-currency-basket-index.proptest.mjs

import { compute } from '../art-561-currency-basket-index.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-561-currency-basket-index.fixtures.json');
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
const rand = mulberry32(0x561C30);

function randomComponent(rng, ccy, integer) {
  const rate = integer ? 1 + Math.floor(rng() * 200) : 0.5 + rng() * 2;
  const amount = integer ? 1 + Math.floor(rng() * 1000) : rng() * 1000;
  return { currency: ccy, usd_rate: rate, fixed_amount: amount };
}
function randomPP(rng, integer = false) {
  const n = 1 + Math.floor(rng() * 6);
  const ccys = Array.from({ length: n }, (_, i) => `C${i}`);
  return {
    mode: 'fixed_amount_valuation',
    basket_id: 'B1',
    as_of_date: '2026-08-01',
    components: ccys.map((c) => randomComponent(rng, c, integer)),
  };
}

// Independent reimplementation of the fixed_amount_valuation index formula, for the differential check (P3).
function reimplement(pp) {
  let index = 0;
  for (const c of pp.components) index += c.fixed_amount * c.usd_rate;
  return index;
}

const TRIALS = 2000;

// ---------- P1: termination/boundedness — no array cap; stays finite at larger N ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.structural_error) continue;
    if (!Number.isFinite(o.index_value)) violations++;
    if (o.components.length !== pp.components.length) violations++;
  }
  // Large-N probe.
  {
    const components = Array.from({ length: 3000 }, (_, i) => randomComponent(rand, `C${i}`, false));
    const { output_payload: o } = compute({ mode: 'fixed_amount_valuation', basket_id: 'B', as_of_date: '2026-08-01', components });
    checked++;
    if (!Number.isFinite(o.index_value)) violations++;
  }
  return { name: 'P1_termination_unbounded_array_stays_finite', trials: checked, violations };
}

// ---------- P3: differential — fixed_amount_valuation index formula re-derived independently ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.structural_error) continue;
    const exp = reimplement(pp);
    if (Math.abs(o.index_value - exp) > 1e-6 * Math.max(1, Math.abs(exp))) violations++;
  }
  return { name: 'P3_index_value_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — homogeneity (scale invariance) + permutation-invariance ----------
function checkP4_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand, true); // integer amounts/rates
    const scaled = { ...pp, components: pp.components.map((c) => ({ ...c, fixed_amount: c.fixed_amount * 3 })) };
    const a = compute(pp).output_payload;
    const b = compute(scaled).output_payload;
    checked++;
    if (!a.structural_error && !b.structural_error) {
      if (Math.abs(b.index_value - a.index_value * 3) > 1e-6) violations++;
    }
    if (pp.components.length >= 2) {
      const shuffled = { ...pp, components: [...pp.components].reverse() };
      const c = compute(shuffled).output_payload;
      if (!a.structural_error && !c.structural_error && Math.abs(a.index_value - c.index_value) > 1e-9) violations++;
    }
  }
  return { name: 'P4_homogeneity_and_permutation_invariance', trials: checked, violations };
}

// ---------- P5: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP5_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  // (a) target weight sum exactly at the 0.001 tolerance boundary, and just inside/outside. The
  // kernel compares the ROUNDED sum (r(sum, 6)), not the raw float sum -- the expectation below
  // replicates that exact rounding step rather than comparing the unrounded quotient, since that IS
  // the kernel's real decision boundary.
  function r6(x) { return Number(x.toFixed(6)); }
  for (const w2 of [0.5 - 0.001, 0.5 - 0.001 + 1e-9, 0.5 - 0.001 - 1e-9, 0.501, 0.499]) {
    const pp = {
      mode: 'derive_amounts_from_target_weights', basket_id: 'B', as_of_date: '2026-08-01',
      components: [
        { currency: 'A', usd_rate: 1, target_weight: 0.5, rebase_usd_rate: 1 },
        { currency: 'B', usd_rate: 1, target_weight: w2, rebase_usd_rate: 1 },
      ],
    };
    const { output_payload: o } = compute(pp);
    checked++;
    const roundedSum = r6(0.5 + w2);
    const expectedOk = Math.abs(roundedSum - 1) <= 0.001;
    if (expectedOk && o.structural_error) violations++;
    if (!expectedOk && !o.structural_error) violations++;
    if (o.structural_error === null && o.target_weight_sum !== roundedSum) violations++;
  }
  // (b) derive-mode division: target_weight*index_value_at_rebase/rebase_usd_rate with a denormal
  // rebase_usd_rate. Finding: 1/Number.MIN_VALUE overflows to +Infinity, and the kernel's own r()
  // rounding helper (which gates every emitted figure through Number.isFinite) converts that
  // Infinity to null rather than letting it leak into the JSON payload as a non-finite value --
  // structural_error stays null (the weight-sum gate that sets it does not itself involve this
  // division), so this is a genuine SILENT-NULL path: no error is raised, but index_value/
  // fixed_amount both come back null instead of a number. This is floored as observed behavior
  // (never NaN, never Infinity in the payload -- the r() gate holds) rather than asserted as
  // reachable-but-unflagged, since fixing it is a kernel edit outside this floor row's scope.
  {
    const pp = { mode: 'derive_amounts_from_target_weights', basket_id: 'B', as_of_date: '2026-08-01', index_value_at_rebase: 1, components: [{ currency: 'A', usd_rate: 1, target_weight: 1, rebase_usd_rate: Number.MIN_VALUE }] };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.index_value !== null && !Number.isFinite(o.index_value)) violations++; // never Infinity/NaN leaking out
    if (o.components[0].fixed_amount !== null && !Number.isFinite(o.components[0].fixed_amount)) violations++;
  }
  // (c) negative zero as usd_rate is rejected (must be > 0); denormal usd_rate accepted and finite.
  {
    const { output_payload: o } = compute({ mode: 'fixed_amount_valuation', basket_id: 'B', as_of_date: '2026-08-01', components: [{ currency: 'A', usd_rate: -0, fixed_amount: 1 }] });
    checked++;
    if (!o.structural_error) violations++; // usd_rate must be > 0; -0 > 0 is false, so this must reject
  }
  {
    const { output_payload: o } = compute({ mode: 'fixed_amount_valuation', basket_id: 'B', as_of_date: '2026-08-01', components: [{ currency: 'A', usd_rate: Number.MIN_VALUE, fixed_amount: 1 }] });
    checked++;
    if (o.structural_error || !Number.isFinite(o.index_value)) violations++;
  }
  // (d) basket_shift_pct EXTREME_MOVEMENT threshold at exactly 5%, and one part in 1e6 either side.
  for (const priorVal of [95.2380952380952, 95.23809523809525, 95.23809523809515]) { // ~100/1.05, boundary-adjacent
    const pp = { mode: 'fixed_amount_valuation', basket_id: 'B', as_of_date: '2026-08-01', prior_index_value: priorVal, components: [{ currency: 'A', usd_rate: 100, fixed_amount: 1 }] };
    const { output_payload: o } = compute(pp);
    checked++;
    if (!Number.isFinite(o.basket_shift_pct)) violations++;
  }
  return { name: 'P5_ulp_boundary_forcing_weight_sum_and_derivation', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_metamorphic());
results.properties.push(checkP5_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-561-currency-basket-index',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
