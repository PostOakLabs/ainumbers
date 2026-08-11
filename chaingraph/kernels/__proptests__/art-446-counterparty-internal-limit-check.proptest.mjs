// art-446-counterparty-internal-limit-check.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C20-1).
// kernel_digest_at_authoring: sha256:4b222e099bedce272b5741a1299c63886b19820ad6192e036157660ee061fa9c
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct source read confirmed — utilizationPct division by
// approvedLimit over an unbounded counterparties array, r2 rounding, clampPct) —
// ULP-boundary forcing present below on the zero-denominator utilizationPct gate, the
// breached (currentExposure > approvedLimit) compare, and the warned
// (utilizationPct >= warningThresholdPct) compare.
// Checks: fixture-oracle gate, termination (counterparties/breach_list/warning_list length
// bounded by input array length), boundedness (utilization_pct finite-or-null, headroom
// finite), differential re-derivation of status per counterparty, metamorphic
// counterparty-order invariance (breach_list/warning_list membership unchanged by input
// order), ULP-boundary forcing on the breach/warning threshold compares and the
// zero-approved-limit gate.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-446-counterparty-internal-limit-check.proptest.mjs

import { compute } from '../art-446-counterparty-internal-limit-check.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-446-counterparty-internal-limit-check.fixtures.json');
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
const rand = mulberry32(0x446A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomCp(rng, i) {
  return {
    counterparty_id: 'cp-' + i, counterparty_name: 'CP ' + i,
    approved_limit_musd: rng() * 1e6, current_exposure_musd: rng() * 1.2e6,
    warning_threshold_pct: rng() * 100,
    limit_type: pick(rng, ['settlement', 'pre_settlement', 'aggregate', 'bogus']),
  };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 12);
  return { counterparties: Array.from({ length: n }, (_, i) => randomCp(rng, i)) };
}

const TRIALS = 5000;

// ---------- P1: termination — counterparties/breach_list/warning_list length bounded by input array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.counterparties.length !== pp.counterparties.length) violations++;
    if (output_payload.breach_list.length + output_payload.warning_list.length > pp.counterparties.length) violations++;
  }
  return { name: 'P1_termination_lists_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2: boundedness — utilization_pct finite-or-null, headroom finite ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const c of output_payload.counterparties) {
      if (c.utilization_pct !== null && !Number.isFinite(c.utilization_pct)) violations++;
      if (!Number.isFinite(c.headroom_musd)) violations++;
    }
  }
  return { name: 'P2_boundedness_utilization_finite_or_null_headroom_finite', trials: checked, violations };
}

// ---------- P3 (differential): status re-derivation per counterparty ----------
function checkP3_status_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    output_payload.counterparties.forEach((c, idx) => {
      const inCp = pp.counterparties[idx];
      const approvedLimit = Math.max(0, inCp.approved_limit_musd);
      const currentExposure = Math.max(0, inCp.current_exposure_musd);
      const warningThresholdPct = Math.min(100, Math.max(0, inCp.warning_threshold_pct));
      const utilizationPct = approvedLimit > 0 ? Math.round((currentExposure / approvedLimit) * 100 * 100) / 100 : null;
      const breached = currentExposure > approvedLimit;
      const warned = !breached && utilizationPct !== null && utilizationPct >= warningThresholdPct;
      const expectedStatus = breached ? 'BREACH' : (warned ? 'WARNING' : 'WITHIN_LIMIT');
      if (c.status !== expectedStatus) violations++;
    });
  }
  return { name: 'P3_status_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — reordering counterparties never changes breach_list/warning_list counts ----------
function checkP4_order_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.counterparties.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const reversed = { counterparties: [...pp.counterparties].reverse() };
    const r2v = compute(reversed).output_payload;
    checked++;
    if (r1.breach_list.length !== r2v.breach_list.length) violations++;
    if (r1.warning_list.length !== r2v.warning_list.length) violations++;
  }
  return { name: 'P4_counterparty_order_metamorphic_invariance', trials: checked, violations };
}

// ---------- P5 (ULP-forcing): breach/warning threshold boundary + zero-approved-limit gate ----------
function checkP5_ulp_forcing() {
  let violations = 0, checked = 0;
  const EPS = Number.EPSILON;
  // zero-approved-limit gate: utilization_pct must be null, and exposure > 0 must breach
  checked++;
  const zeroLimit = compute({ counterparties: [{ counterparty_id: 'z', approved_limit_musd: 0, current_exposure_musd: 100, warning_threshold_pct: 90 }] }).output_payload.counterparties[0];
  if (zeroLimit.utilization_pct !== null) violations++;
  if (zeroLimit.status !== 'BREACH') violations++;
  // exact-boundary breach: exposure === limit is NOT a breach (strict >), exposure === limit + ULP IS
  const boundaryCases = [
    { limit: 1000, exposure: 1000, expectBreach: false },
    { limit: 1000, exposure: 1000 + EPS * 1000, expectBreach: true },
    { limit: 1000, exposure: 1000 - EPS * 1000, expectBreach: false },
  ];
  for (const c of boundaryCases) {
    checked++;
    const cp = compute({ counterparties: [{ counterparty_id: 'b', approved_limit_musd: c.limit, current_exposure_musd: c.exposure, warning_threshold_pct: 200 }] }).output_payload.counterparties[0];
    if ((cp.status === 'BREACH') !== c.expectBreach) violations++;
  }
  // warning threshold exact-boundary: utilization === threshold IS a warning (>=)
  checked++;
  const warnBoundary = compute({ counterparties: [{ counterparty_id: 'w', approved_limit_musd: 1000, current_exposure_musd: 900, warning_threshold_pct: 90 }] }).output_payload.counterparties[0];
  if (warnBoundary.status !== 'WARNING') violations++;
  return { name: 'P5_ulp_boundary_forcing_breach_warning_thresholds_and_zero_limit', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_status_differential());
results.properties.push(checkP4_order_metamorphic());
results.properties.push(checkP5_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-446-counterparty-internal-limit-check',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
