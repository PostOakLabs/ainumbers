// art-521-settlement-asset-backing-invariant.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C26-1).
// kernel_digest_at_authoring: sha256:2c62975ee6e29f7fd6568274a00305cd6d0043e1c89119d37e1e5d16ce3371ef
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// ⛔⛔ CORRECTION TO THE WU ROW'S TABLE (per FIX-2): the row lists this kernel as float:yes.
// Direct read of the full compute() body shows this is FIXED-POINT MONEY MATH -- the kernel's
// own docstring states verbatim "FIXED-POINT MONEY MATH. Every amount crosses the boundary as
// an integer number of minor units; no floating-point arithmetic in compute()." Every amount is
// coerced through toMinorUnits() (Number.isSafeInteger-gated); backing_ratio_bps/idle_cost_bps
// through toBpsOrNull() (also Number.isSafeInteger-gated). The one division in the file
// (`value_in_circulation_minor_units * backing_ratio_bps / 10000`) is immediately Math.trunc()'d
// to an integer before any comparison, and every downstream compare (backing_intact_before/
// _after, floor/ceiling breaches) is an integer `>=`/`<`/`>` between two such integers -- there
// is no floating threshold anywhere a caller-supplied value sits near a rounding boundary.
// Corrected to float:no; floored with forced categorical boundary cases at the integer backing
// threshold instead of an ULP claim, per spec §3's float:no fallback. A differential property
// below additionally re-derives required_backing_minor_units via the same bps formula to guard
// the one place a large multiply/divide could in principle lose precision, per FIX-2 discipline.
// Checks: fixture-oracle gate, termination (buffers/movements bounded by input array length,
// no division by an input-derived count), forced categorical boundary cases at the backing
// threshold (aggregate exactly at vs one minor unit under required_backing) and the
// backing_model vacuous/segregated switch, differential re-derivation of
// aggregate_backing_before/after and required_backing_minor_units (bps formula re-applied
// independently), boundedness (aggregate_backing_after_minor_units is a safe integer), and
// metamorphic invariance (a zero-amount movement between two known buffers never changes
// backing_intact_after).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-521-settlement-asset-backing-invariant.proptest.mjs

import { compute } from '../art-521-settlement-asset-backing-invariant.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-521-settlement-asset-backing-invariant.fixtures.json');
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
const rand = mulberry32(0x521F0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomBuffer(rng, i) {
  return {
    buffer_id: `BUF-${i}`,
    role: 'settlement', asset_type: pick(rng, ['cash', 'reserve']),
    backs: pick(rng, ['circulation', 'issuance']),
    balance_minor_units: Math.floor(rng() * 100000),
    min_minor_units: pick(rng, [null, 0, 1000]),
    max_minor_units: pick(rng, [null, 500000]),
  };
}
function randomPP(rng) {
  const n = 2 + Math.floor(rng() * 3);
  const buffers = Array.from({ length: n }, (_, i) => randomBuffer(rng, i));
  const nm = Math.floor(rng() * 3);
  const movements = Array.from({ length: nm }, (_, i) => ({
    movement_id: `M-${i}`,
    from: pick(rng, buffers).buffer_id, to: pick(rng, buffers).buffer_id,
    amount_minor_units: Math.floor(rng() * 20000),
  }));
  return {
    as_of: '2026-08-10', backing_model: pick(rng, ['segregated', 'vacuous']),
    value_in_circulation_minor_units: Math.floor(rng() * 200000),
    backing_ratio_bps: pick(rng, [10000, 9000, 5000]),
    idle_cost_bps: pick(rng, [0, 100]),
    cost_per_crossing_minor_units: pick(rng, [0, 50]),
    buffers, movements,
  };
}

const TRIALS = 3000;

// ---------- P1: termination -- buffer_count === input length, movements bounded ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.buffer_count !== pp.buffers.length) violations++;
    if (output_payload.buffers.length !== pp.buffers.length) violations++;
    if (output_payload.movements.length !== pp.movements.length) violations++;
  }
  return { name: 'P1_termination_buffer_and_movement_counts_exact', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases -- backing threshold + vacuous/segregated switch ----------
function checkP2_boundary_categorical() {
  let violations = 0, checked = 0;
  const mk = (circulation, ratio, balance) => ({
    as_of: '2026-01-01', backing_model: 'segregated', value_in_circulation_minor_units: circulation, backing_ratio_bps: ratio, idle_cost_bps: 0, cost_per_crossing_minor_units: 0,
    buffers: [{ buffer_id: 'B1', role: 'r', asset_type: 'cash', backs: 'circulation', balance_minor_units: balance }],
    movements: [],
  });
  // required_backing = 1000 * 10000 / 10000 = 1000 exactly. balance===1000 -> intact; 999 -> shortfall.
  {
    const { output_payload } = compute(mk(1000, 10000, 1000));
    checked++;
    if (output_payload.backing_intact_before !== true) violations++;
  }
  {
    const { output_payload } = compute(mk(1000, 10000, 999));
    checked++;
    if (output_payload.backing_intact_before !== false) violations++;
  }
  // vacuous model: backing_applicable false, backing_intact null (never true/false)
  {
    const { output_payload } = compute({ ...mk(1000, 10000, 0), backing_model: 'vacuous' });
    checked++;
    if (output_payload.backing_applicable !== false) violations++;
    if (output_payload.backing_intact_before !== null) violations++;
    if (output_payload.backing_intact_after !== null) violations++;
  }
  return { name: 'P2_backing_threshold_and_vacuous_switch_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): aggregate_backing_before/after + required_backing_minor_units re-derivation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedRequired = Math.trunc(output_payload.value_in_circulation_minor_units * output_payload.backing_ratio_bps / 10000);
    if (output_payload.required_backing_minor_units !== expectedRequired) violations++;
    let aggBefore = 0;
    for (const b of output_payload.buffers) if (b.backs === 'circulation') aggBefore += b.balance_before_minor_units;
    if (output_payload.aggregate_backing_before_minor_units !== aggBefore) violations++;
    let aggAfter = 0;
    for (const b of output_payload.buffers) if (b.backs === 'circulation') aggAfter += b.balance_after_minor_units;
    if (output_payload.aggregate_backing_after_minor_units !== aggAfter) violations++;
    if (output_payload.backing_applicable) {
      if (output_payload.backing_intact_after !== (aggAfter >= expectedRequired)) violations++;
    }
  }
  return { name: 'P3_aggregate_backing_and_required_backing_differential', trials: checked, violations };
}

// ---------- P4: boundedness -- aggregate figures are safe integers ----------
function checkP4_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isSafeInteger(output_payload.aggregate_backing_before_minor_units)) violations++;
    if (!Number.isSafeInteger(output_payload.aggregate_backing_after_minor_units)) violations++;
    if (!Number.isSafeInteger(output_payload.required_backing_minor_units)) violations++;
  }
  return { name: 'P4_boundedness_aggregate_and_required_safe_integers', trials: checked, violations };
}

// ---------- P5: metamorphic -- a zero-amount movement between two known buffers never changes backing_intact_after ----------
function checkP5_zero_movement_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    checked++;
    if (pp.buffers.length >= 2) {
      const extended = { ...pp, movements: [...pp.movements, { movement_id: 'ZERO', from: pp.buffers[0].buffer_id, to: pp.buffers[1].buffer_id, amount_minor_units: 0 }] };
      const r2 = compute(extended).output_payload;
      checked++;
      if (r1.backing_intact_after !== r2.backing_intact_after) violations++;
      if (r1.aggregate_backing_after_minor_units !== r2.aggregate_backing_after_minor_units) violations++;
    }
  }
  return { name: 'P5_zero_movement_noop_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundary_categorical());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_boundedness());
results.properties.push(checkP5_zero_movement_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-521-settlement-asset-backing-invariant',
  float_sensitive: false,
  float_sensitive_correction: 'WU row table said float:yes; direct source read shows the kernel is documented and implemented as fixed-point integer-only money math with no floating-point arithmetic in compute() -- the one bps division is immediately Math.trunc()\'d to an integer before any comparison, and every threshold compare is integer-vs-integer. Corrected to float:no; floored with forced categorical boundary cases instead of ULP-boundary forcing, plus a differential re-derivation of the bps formula to guard against precision loss on the multiply/divide.',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
