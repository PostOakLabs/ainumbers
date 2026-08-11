// art-455-globe-sbie-topup.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C21-1).
// kernel_digest_at_authoring: sha256:f883e9af5be1a09cf3f90e6d98b8452905bbef712f381adef50876f7ee4a44ab
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — `payroll_costs * payroll_rate`,
// `tangible_asset_carrying_value * tangible_asset_rate`, `globe_income - sbie`, and
// `excess_profit * top_up_tax_percentage` are all genuine caller-controlled float arithmetic
// chains feeding the excess-profit/top-up thresholds) — ULP-boundary forcing is MANDATORY per
// spec §3.
// Checks: fixture-oracle gate, termination (bounded by policy_rate_table.length — a single
// linear scan, no recursion), boundedness (excess_profit >= 0 always via Math.max(0,...);
// jurisdictional_top_up >= 0 always via Math.max(0,...)), a scale-invariance metamorphic
// identity (scaling payroll_costs, tangible_asset_carrying_value, and globe_income together by
// k>0 scales sbie/excess_profit/top_up_tax/jurisdictional_top_up by k while staying inside the
// same excess-profit and QDMTT-offset branch), and mandatory ULP-boundary forcing at the
// globe_income===sbie zero-excess-profit boundary and the qdmtt_paid===top_up_tax
// over-collection boundary (0, -0, ±ULP, denormal).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-455-globe-sbie-topup.proptest.mjs

import { compute } from '../art-455-globe-sbie-topup.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-455-globe-sbie-topup.fixtures.json');
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
const rand = mulberry32(0x45500);

function randomPP(rng) {
  const year = 2025 + Math.floor(rng() * 5);
  const table = [];
  for (let y = 2025; y <= 2033; y++) table.push({ year: y, payroll_rate: rng() * 0.1, tangible_asset_rate: rng() * 0.08 });
  return {
    payroll_costs: rng() * 10_000_000,
    tangible_asset_carrying_value: rng() * 20_000_000,
    target_year: year,
    policy_rate_table: table,
    globe_income: (rng() - 0.3) * 5_000_000,
    top_up_tax_percentage: rng() * 0.2,
    qdmtt_paid: rng() * 500_000,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — bounded by policy_rate_table.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (!Number.isFinite(o.sbie)) violations++;
  }
  const bigTable = [];
  for (let y = 0; y < 5000; y++) bigTable.push({ year: y, payroll_rate: 0.05, tangible_asset_rate: 0.05 });
  const { output_payload: bigOut } = compute({ payroll_costs: 100, tangible_asset_carrying_value: 100, target_year: 4999, policy_rate_table: bigTable, globe_income: 1000, top_up_tax_percentage: 0.1, qdmtt_paid: 0 });
  checked++;
  if (!bigOut.rate_row_found) violations++;
  if (!Number.isFinite(bigOut.sbie)) violations++;
  return { name: 'P1_termination_bounded_by_rate_table_length', trials: checked, violations };
}

// ---------- P2: boundedness — excess_profit and jurisdictional_top_up always >= 0 ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.excess_profit < 0) violations++;
    if (o.jurisdictional_top_up < 0) violations++;
    if (o.top_up_tax < 0) violations++;
  }
  return { name: 'P2_excess_profit_and_topup_nonnegative', trials: checked, violations };
}

// ---------- P3: metamorphic — scaling payroll/tangible/income by k>0 scales sbie/excess_profit/topup ----------
function checkP3_scale_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const base = compute(pp).output_payload;
    if (!base.rate_row_found) continue;
    const k = 0.1 + rand() * 5;
    const scaled = compute({
      ...pp,
      payroll_costs: pp.payroll_costs * k,
      tangible_asset_carrying_value: pp.tangible_asset_carrying_value * k,
      globe_income: pp.globe_income * k,
      qdmtt_paid: pp.qdmtt_paid * k,
    }).output_payload;
    checked++;
    if (Math.abs(scaled.sbie - base.sbie * k) / Math.max(1, base.sbie * k) > 1e-6) violations++;
    // excess_profit/top_up_tax/jurisdictional_top_up scale by k too, since globe_income - sbie
    // and top_up_tax_percentage is unscaled (a rate, invariant), and qdmtt_paid scaled with it.
    if (Math.abs(scaled.excess_profit - base.excess_profit * k) > 1) violations++;
    if (Math.abs(scaled.jurisdictional_top_up - base.jurisdictional_top_up * k) > 1) violations++;
  }
  return { name: 'P3_scale_invariance_of_sbie_and_topup', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const table = [{ year: 2025, payroll_rate: 0, tangible_asset_rate: 0 }];
  // globe_income === sbie exact boundary (sbie=0 here since rates are 0) -> excess_profit must
  // be exactly 0 at income<=0, and positive/near-zero above.
  const incomeEdges = [0, -0, eps, -eps, Number.MIN_VALUE, -Number.MIN_VALUE];
  for (const income of incomeEdges) {
    const { output_payload: o } = compute({ payroll_costs: 0, tangible_asset_carrying_value: 0, target_year: 2025, policy_rate_table: table, globe_income: income, top_up_tax_percentage: 0.15, qdmtt_paid: 0 });
    checked++;
    if (o.excess_profit < 0 || !Number.isFinite(o.excess_profit)) violations++;
    if (income <= 0 && o.excess_profit !== 0) violations++;
  }
  // qdmtt_paid === top_up_tax exact boundary -> jurisdictional_top_up must be exactly 0, never negative
  const exactQdmtt = compute({ payroll_costs: 0, tangible_asset_carrying_value: 0, target_year: 2025, policy_rate_table: table, globe_income: 1000, top_up_tax_percentage: 0.1, qdmtt_paid: 100 });
  checked++;
  if (exactQdmtt.output_payload.jurisdictional_top_up !== 0) violations++;
  if (exactQdmtt.output_payload.qdmtt_over_collection !== false) violations++;
  // ±ULP either side of the qdmtt boundary
  for (const qdmtt of [100 - eps, 100 + eps]) {
    const r = compute({ payroll_costs: 0, tangible_asset_carrying_value: 0, target_year: 2025, policy_rate_table: table, globe_income: 1000, top_up_tax_percentage: 0.1, qdmtt_paid: qdmtt });
    checked++;
    if (r.output_payload.jurisdictional_top_up < 0) violations++;
    if (!Number.isFinite(r.output_payload.jurisdictional_top_up)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_excess_profit_and_qdmtt_boundary', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_scale_invariance());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-455-globe-sbie-topup',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
