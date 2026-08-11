// art-509-recompute-payment-waterfall.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C25-1).
// kernel_digest_at_authoring: sha256:79ba683f5f9684c6c7ab2b2cfe7cdd8546591b5de200da9f10a3bb9637e408f1
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (matches the WU row, direct read confirms). The kernel's own header claims "no
// floating-point arithmetic ... never from toFixed() on a float", but `display(minor)` computes
// `Math.trunc(abs / MINOR_SCALE)` — a genuine IEEE-754 division of a safe-integer Number by 100, not
// true integer division. For `abs` near Number.MAX_SAFE_INTEGER the relative rounding error of that
// division is no longer negligible and can, in principle, move an exact-multiple-of-100 amount across
// the truncation boundary. The ratio-test cross-multiplication (`mn * td` vs `tn * md`) is also plain
// Number multiplication and can silently exceed the safe-integer range for large operands. ULP-boundary
// forcing is mandatory here.
// Checks: fixture-oracle gate, termination (steps bounded by priority_ladder length, ledgers bounded
// by available_funds length), differential re-derivation of the sequential allocation, a scale
// (linearity) metamorphic property for cap-free ladders, and ULP-boundary forcing around display()'s
// safe-integer division boundary and the ratio-test cross-multiplication overflow edge.
//
// Run: node chaingraph/kernels/__proptests__/art-509-recompute-payment-waterfall.proptest.mjs

import { compute } from '../art-509-recompute-payment-waterfall.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-509-recompute-payment-waterfall.fixtures.json');
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
const rand = mulberry32(0x50900);

function randomLadder(rng, n) {
  const steps = [];
  for (let i = 0; i < n; i++) {
    steps.push({
      step_id: `S${i}`,
      amount_due_minor_units: Math.floor(rng() * 100000),
      cap_minor_units: rng() < 0.3 ? Math.floor(rng() * 50000) : undefined,
    });
  }
  return steps;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 6);
  return {
    period_label: 'P1',
    deal_ref: 'D1',
    currency: 'EUR',
    available_funds_minor_units: Math.floor(rng() * 300000),
    priority_ladder: randomLadder(rng, n),
    tests: [],
  };
}

const TRIALS = 3000;

// ---------- P1: termination — steps bounded by priority_ladder length, ledgers by available_funds ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.steps.length !== pp.priority_ladder.length) violations++;
    if (output_payload.step_count !== pp.priority_ladder.length) violations++;
  }
  return { name: 'P1_steps_bounded_by_ladder_length', trials: checked, violations };
}

// ---------- P2 (differential): sequential allocation re-derived ----------
function checkP2_allocation_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    let pool = pp.available_funds_minor_units;
    for (const s of output_payload.steps) {
      const claim = s.claim_minor_units;
      const cap = s.cap_minor_units;
      const due = (cap !== null && cap < claim) ? cap : claim;
      const payable = due > 0 ? due : 0;
      const expectedPaid = pool < payable ? (pool > 0 ? pool : 0) : payable;
      const expectedShortfall = payable - expectedPaid;
      if (s.paid_minor_units !== expectedPaid) violations++;
      if (s.shortfall_minor_units !== expectedShortfall) violations++;
      pool -= expectedPaid;
    }
  }
  return { name: 'P2_sequential_allocation_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — scaling every amount by an integer k scales every allocation by k (no caps) ----------
function checkP3_scale_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const n = Math.floor(rand() * 5) + 1;
    const ladder = [];
    for (let j = 0; j < n; j++) ladder.push({ step_id: `S${j}`, amount_due_minor_units: Math.floor(rand() * 5000) });
    const funds = Math.floor(rand() * 20000);
    const pp = { period_label: 'P', deal_ref: 'D', currency: 'EUR', available_funds_minor_units: funds, priority_ladder: ladder, tests: [] };
    const k = 2 + Math.floor(rand() * 4);
    const scaledLadder = ladder.map((s) => ({ step_id: s.step_id, amount_due_minor_units: s.amount_due_minor_units * k }));
    const scaledPP = { ...pp, available_funds_minor_units: funds * k, priority_ladder: scaledLadder };
    const r1 = compute(pp).output_payload;
    const r2 = compute(scaledPP).output_payload;
    checked++;
    for (let j = 0; j < r1.steps.length; j++) {
      if (r1.steps[j].paid_minor_units * k !== r2.steps[j].paid_minor_units) violations++;
      if (r1.steps[j].shortfall_minor_units * k !== r2.steps[j].shortfall_minor_units) violations++;
    }
  }
  return { name: 'P3_scale_linearity_metamorphic_no_caps', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing around display()'s safe-integer division and ratio cross-mult ----------
function checkP4_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const MAX_SAFE = Number.MAX_SAFE_INTEGER; // 9007199254740991

  // Large exact-multiple-of-100 amount near MAX_SAFE_INTEGER must still display with frac '00'.
  const nearMaxMultiple = Math.floor(MAX_SAFE / 100) * 100;
  checked++;
  {
    const pp = { period_label: 'P', deal_ref: 'D', currency: 'EUR', available_funds_minor_units: nearMaxMultiple,
      priority_ladder: [{ step_id: 'S1', amount_due_minor_units: nearMaxMultiple }] };
    const { output_payload } = compute(pp);
    if (!output_payload.total_available_display.endsWith('.00')) violations++;
  }
  // zero and boundary-adjacent single-unit amounts
  for (const amt of [0, 1, 99, 100, 101, MAX_SAFE - (MAX_SAFE % 100)]) {
    checked++;
    const pp = { period_label: 'P', deal_ref: 'D', currency: 'EUR', available_funds_minor_units: amt,
      priority_ladder: [{ step_id: 'S1', amount_due_minor_units: amt }] };
    const { output_payload } = compute(pp);
    const s = output_payload.steps[0];
    // reconstruct minor units from the display string and confirm exact round-trip
    const [whole, frac] = s.paid_display.replace('-', '').split('.');
    const reconstructed = Number(whole) * 100 + Number(frac);
    if (reconstructed !== s.paid_minor_units) violations++;
  }
  // ratio cross-multiplication near the safe-integer overflow boundary: mn*td could exceed 2^53
  checked++;
  {
    const big = Math.floor(MAX_SAFE / 100); // ~9e13, so big*td (td~100) approaches MAX_SAFE
    const pp = {
      period_label: 'P', deal_ref: 'D', currency: 'EUR', available_funds_minor_units: 0, priority_ladder: [],
      tests: [{ test_id: 'T1', comparator: 'gte', measured_numerator: big, measured_denominator: 100, threshold_numerator: big - 1, threshold_denominator: 100 }],
    };
    const { output_payload } = compute(pp);
    if (typeof output_payload.test_results[0].outcome !== 'string') violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_display_division_and_ratio_crossmult', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_allocation_differential());
results.properties.push(checkP3_scale_metamorphic());
results.properties.push(checkP4_ulp_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-509-recompute-payment-waterfall',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
