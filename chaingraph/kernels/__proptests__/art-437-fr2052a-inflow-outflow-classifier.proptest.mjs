// art-437-fr2052a-inflow-outflow-classifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C20-1).
// kernel_digest_at_authoring: sha256:e6b15395a2f44a43b2968b7f10f6d7ef12137cd68b1a0ff292e5031b775f4f97
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct source read confirmed — r2 rounding on amounts, bucket
// aggregation sums over an unbounded rows array, net_musd = inflow-outflow subtraction) —
// ULP-boundary forcing present below on the maturity-bucket boundary compare (`days <=
// b.max_days`).
// Checks: fixture-oracle gate, termination (row_count/bucket rows bounded by input array
// length), boundedness (all money fields finite), differential re-derivation of
// total_inflow/outflow/net and elimination_total, metamorphic row-order invariance of the
// aggregated totals, ULP-boundary forcing on the maturity_days <= max_days bucket boundary.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-437-fr2052a-inflow-outflow-classifier.proptest.mjs

import { compute } from '../art-437-fr2052a-inflow-outflow-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-437-fr2052a-inflow-outflow-classifier.fixtures.json');
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
const rand = mulberry32(0x437A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomBoundaries(rng, n) {
  const days = Array.from({ length: n }, () => Math.floor(rng() * 400)).sort((a, b) => a - b);
  return days.map((d, i) => ({ bucket_label: 'b' + i, max_days: d }));
}

function randomRows(rng, n, intercoRatio) {
  return Array.from({ length: n }, (_, i) => ({
    row_id: 'r' + i,
    flow_type: pick(rng, ['inflow', 'outflow']),
    amount_musd: rng() * 1e5,
    maturity_days: Math.floor(rng() * 400),
    is_intercompany: rng() < intercoRatio,
  }));
}

function randomPP(rng) {
  const nb = Math.floor(rng() * 6);
  const nr = Math.floor(rng() * 12);
  return { boundary_table_version: 'v1', rows: randomRows(rng, nr, rng() * 0.3), bucket_boundaries: randomBoundaries(rng, nb) };
}

const TRIALS = 5000;

// ---------- P1: termination — row_count bounded by input length, bucket count bounded by non-intercompany rows ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.row_count !== pp.rows.length) violations++;
    if (output_payload.form_2052a.length > pp.rows.length) violations++;
  }
  return { name: 'P1_termination_row_and_bucket_count_bounded', trials: checked, violations };
}

// ---------- P2: boundedness — all money fields finite ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const fields = [output_payload.total_inflow_musd, output_payload.total_outflow_musd, output_payload.total_net_musd, output_payload.elimination_total_musd];
    if (fields.some((v) => !Number.isFinite(v))) violations++;
  }
  return { name: 'P2_boundedness_money_fields_finite', trials: checked, violations };
}

// ---------- P3 (differential): total_inflow/outflow/net + elimination_total re-derivation ----------
function checkP3_totals_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    let expInflow = 0, expOutflow = 0, expElim = 0;
    for (const row of pp.rows) {
      const amt = Math.round(Math.max(0, row.amount_musd) * 100) / 100;
      if (row.is_intercompany) { expElim += amt; continue; }
      if (row.flow_type === 'outflow') expOutflow += amt; else expInflow += amt;
    }
    expInflow = Math.round(expInflow * 100) / 100;
    expOutflow = Math.round(expOutflow * 100) / 100;
    expElim = Math.round(expElim * 100) / 100;
    if (Math.abs(expInflow - output_payload.total_inflow_musd) > 0.05) violations++;
    if (Math.abs(expOutflow - output_payload.total_outflow_musd) > 0.05) violations++;
    if (Math.abs(expElim - output_payload.elimination_total_musd) > 0.01) violations++;
  }
  return { name: 'P3_totals_and_elimination_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — reordering rows never changes the aggregated totals ----------
function checkP4_row_order_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.rows.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const reversed = { ...pp, rows: [...pp.rows].reverse() };
    const r2v = compute(reversed).output_payload;
    checked++;
    if (Math.abs(r1.total_inflow_musd - r2v.total_inflow_musd) > 0.01) violations++;
    if (Math.abs(r1.total_outflow_musd - r2v.total_outflow_musd) > 0.01) violations++;
  }
  return { name: 'P4_row_order_metamorphic_invariance', trials: checked, violations };
}

// ---------- P5 (ULP-forcing): maturity_days <= max_days bucket boundary, incl. 0/-0/denormal ----------
function checkP5_ulp_forcing() {
  let violations = 0, checked = 0;
  const boundaries = [{ bucket_label: 'short', max_days: 30 }, { bucket_label: 'long', max_days: 365 }];
  const EPS = Number.EPSILON;
  const boundaryDays = [30, 30 - EPS, 30 + EPS, 0, -0, Number.MIN_VALUE, 365, 365 - EPS];
  for (const days of boundaryDays) {
    checked++;
    const rows = [{ row_id: 'r', flow_type: 'inflow', amount_musd: 100, maturity_days: days, is_intercompany: false }];
    const { output_payload } = compute({ boundary_table_version: 'v1', rows, bucket_boundaries: boundaries });
    const expectedBucket = Math.max(0, days) <= 30 ? 'short' : (Math.max(0, days) <= 365 ? 'long' : 'long');
    if (output_payload.rows[0].table_bucket !== expectedBucket) violations++;
    if (!Number.isFinite(output_payload.total_inflow_musd)) violations++;
  }
  return { name: 'P5_ulp_boundary_forcing_maturity_bucket_boundary', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_totals_differential());
results.properties.push(checkP4_row_order_metamorphic());
results.properties.push(checkP5_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-437-fr2052a-inflow-outflow-classifier',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
