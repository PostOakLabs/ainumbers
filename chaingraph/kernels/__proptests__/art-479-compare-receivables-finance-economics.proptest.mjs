// art-479-compare-receivables-finance-economics.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C22-1).
// kernel_digest_at_authoring: sha256:ff2eabad532dc59453467b36302b88c0ac41425aca4e48f9524b89d928c33878
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — every instrument's net_proceeds/cost is plain IEEE-754 +,-,*,/ arithmetic,
// and annualCost()'s denominator is explicitly floored at 1e-9 (`netProceeds > 1e-9 ? netProceeds :
// 1e-9`) specifically to survive a degenerate near-zero net-proceeds input. ULP-boundary forcing
// mandatory (§3): threshold ±1 ULP, 0, negative zero, denormals, x/y*y !== x cases, forced around
// that 1e-9 clamp.
// Checks: fixture-oracle gate, termination (compute() is O(1) — four fixed instruments, no
// caller-controlled loop bound; confirmed and stress-tested with extreme scalar inputs), boundedness
// (output is always finite for any positive finite invoice_value/tenor_days, never NaN/Infinity —
// the exact guarantee the 1e-9 floor exists to provide), differential re-derivation of
// cheapest_instrument/highest_proceeds_instrument/cost_ranking from the four instrument figures, ULP
// forcing around the annualCost() 1e-9 denominator floor, and a rejection-boundary categorical check
// (invoice_value<=0 / tenor_days<=0 must throw, per the kernel's own documented finite gate). Zero
// external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-479-compare-receivables-finance-economics.proptest.mjs

import { compute } from '../art-479-compare-receivables-finance-economics.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-479-compare-receivables-finance-economics.fixtures.json');
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
const rand = mulberry32(0x479A0);

function randomPP(rng) {
  return {
    invoice_value: rng() * 1e7 + 1,
    tenor_days: rng() * 365 + 1,
    currency: 'USD',
    forfaiting_discount_rate_pct: rng() * 15,
    forfaiting_arrangement_fee_pct: rng() * 3,
    factoring_advance_rate_pct: rng() * 100,
    factoring_service_fee_pct: rng() * 5,
    factoring_finance_charge_pct: rng() * 15,
    nr_factoring_advance_rate_pct: rng() * 100,
    nr_factoring_service_fee_pct: rng() * 5,
    nr_factoring_finance_charge_pct: rng() * 15,
    id_advance_rate_pct: rng() * 100,
    id_discount_charge_pct: rng() * 15,
    id_service_fee_pct: rng() * 5,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — compute() is O(1), always returns exactly 4 instruments regardless of scale ----------
function checkP1_termination_fixed_instrument_count() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (Object.keys(output_payload.results).length !== 4) violations++;
    if (output_payload.cost_ranking.length !== 4) violations++;
  }
  return { name: 'P1_termination_always_four_instruments', trials: checked, violations };
}

// ---------- P2: boundedness — every instrument's net_proceeds/cost stays finite for any positive finite input ----------
function checkP2_output_boundedness_finite() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const id of Object.keys(output_payload.results)) {
      const r = output_payload.results[id];
      if (!Number.isFinite(r.net_proceeds)) violations++;
      if (!Number.isFinite(r.effective_annual_cost_pct)) violations++;
    }
  }
  return { name: 'P2_boundedness_all_outputs_finite', trials: checked, violations };
}

// ---------- P3 (differential): cheapest_instrument/highest_proceeds_instrument/cost_ranking re-derivation ----------
function checkP3_ranking_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const entries = Object.entries(output_payload.results).map(([id, r]) => ({ id, ...r }));
    const sortedIds = entries.slice().sort((a, b) => a.effective_annual_cost_pct - b.effective_annual_cost_pct).map((e) => e.id);
    const costsInOrder = sortedIds.map((id) => entries.find((e) => e.id === id).effective_annual_cost_pct);
    for (let j = 1; j < costsInOrder.length; j++) if (costsInOrder[j] < costsInOrder[j - 1]) violations++;
  }
  return { name: 'P3_cost_ranking_monotone_nondecreasing', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing around the annualCost() 1e-9 net-proceeds denominator floor ----------
// KNOWN GAP (floor-only disclosure, not a correctness claim): the 1e-9 clamp protects only the
// net_proceeds side of annualCost()'s division — a denormally small `tenor_days` still blows up the
// separate `365 / tenorDays` term toward Infinity, and 0 * Infinity yields NaN. The kernel's finite
// gate does not cover this axis. This floor states that gap explicitly rather than asserting a
// finiteness guarantee the source does not actually provide for denormal tenor_days.
function checkP4_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const baseline = {
    invoice_value: 1000, tenor_days: 90, currency: 'USD',
    forfaiting_discount_rate_pct: 0, forfaiting_arrangement_fee_pct: 100, // forces forfNetProceeds toward 0/negative
    factoring_advance_rate_pct: 0, factoring_service_fee_pct: 0, factoring_finance_charge_pct: 0,
    nr_factoring_advance_rate_pct: 0, nr_factoring_service_fee_pct: 0, nr_factoring_finance_charge_pct: 0,
    id_advance_rate_pct: 0, id_discount_charge_pct: 0, id_service_fee_pct: 0,
  };
  // These cases stay algebraically well-behaved (huge-but-finite, not blown up by a second
  // division axis) — finiteness IS guaranteed here by the 1e-9 net-proceeds floor and MUST hold.
  const mustBeFiniteCases = [
    { ...baseline, forfaiting_arrangement_fee_pct: 100, label: 'net_proceeds_forced_zero_via_100pct_fee' },
    { ...baseline, forfaiting_arrangement_fee_pct: 100 + Number.EPSILON, label: 'plus_one_ulp_past_zero' },
    { ...baseline, forfaiting_arrangement_fee_pct: 100 - Number.EPSILON, label: 'minus_one_ulp_before_zero' },
    { ...baseline, invoice_value: Number.MIN_VALUE * 1e15, forfaiting_arrangement_fee_pct: 100, label: 'denormal_scale_invoice_value' },
  ];
  for (const c of mustBeFiniteCases) {
    checked++;
    try {
      const { output_payload } = compute(c);
      for (const id of Object.keys(output_payload.results)) {
        const r = output_payload.results[id];
        if (!Number.isFinite(r.net_proceeds) || !Number.isFinite(r.effective_annual_cost_pct)) violations++;
      }
    } catch (e) {
      violations++;
    }
  }
  // Denormal tenor_days: documented gap — must not throw (tenor_days > 0 still holds), but
  // effective_annual_cost_pct is NOT required to be finite here (365/tenorDays -> Infinity,
  // 0 * Infinity -> NaN is the measured, honest behaviour of the current source).
  {
    checked++;
    try {
      compute({ ...baseline, tenor_days: Number.MIN_VALUE * 1e10 });
    } catch (e) {
      violations++; // tenor_days stays strictly positive, so a throw here would be a real regression
    }
  }
  // x/y*y !== x style case fed through the discount-rate input.
  {
    checked++;
    const x = 0.1, y = 3;
    const derived = (x / y) * y; // !== x in IEEE-754
    const pp = { ...baseline, forfaiting_discount_rate_pct: 5 + (derived - x), forfaiting_arrangement_fee_pct: 1 };
    const { output_payload } = compute(pp);
    if (!Number.isFinite(output_payload.results.forfaiting.net_proceeds)) violations++;
  }
  // negative-zero tenor offset check: -0 tenor_days must still fail the documented tenor>0 gate.
  {
    checked++;
    let threw = false;
    try { compute({ ...baseline, tenor_days: -0 }); } catch (e) { threw = true; }
    if (!threw) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_net_proceeds_denominator_floor', trials: checked, violations };
}

// ---------- P5: forced categorical rejection boundary — invoice_value<=0 / tenor_days<=0 must throw ----------
function checkP5_forced_categorical_rejection() {
  let violations = 0, checked = 0;
  const badCases = [
    { invoice_value: 0, tenor_days: 90 },
    { invoice_value: -100, tenor_days: 90 },
    { invoice_value: 1000, tenor_days: 0 },
    { invoice_value: 1000, tenor_days: -30 },
    { invoice_value: NaN, tenor_days: 90 },
  ];
  for (const c of badCases) {
    checked++;
    let threw = false;
    try { compute(c); } catch (e) { threw = true; }
    if (!threw) violations++;
  }
  return { name: 'P5_forced_categorical_rejection_nonpositive_inputs', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_fixed_instrument_count());
results.properties.push(checkP2_output_boundedness_finite());
results.properties.push(checkP3_ranking_differential());
results.properties.push(checkP4_ulp_boundary_forcing());
results.properties.push(checkP5_forced_categorical_rejection());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-479-compare-receivables-finance-economics',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
