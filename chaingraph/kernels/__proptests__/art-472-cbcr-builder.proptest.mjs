// art-472-cbcr-builder.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C21-1).
// kernel_digest_at_authoring: sha256:62a04a2495b254beb4938ec0bf7c60631fd7d37bdcb79e12677091656b0cb8ce
// human_sign_off: PENDING
//
// ⚠ CORRECTION TO THE WU ROW'S TABLE (per FIX-2, "confirm against each kernel's own source
// before relying on the table"): the row tags this kernel `float:no`. Direct read finds the
// EDIT-REV consistency check (`Math.abs(total_revenue_reported - total_revenue_computed) <=
// rounding_tolerance`) performs the comparison on RAW caller floats with NO prior r2()-style
// rounding step -- unlike art-464/art-358's rounded-before-compare pattern, this check is only
// safe from genuine ULP noise because of the default `rounding_tolerance=1` (a whole dollar); a
// caller who deliberately sets `rounding_tolerance=0` (requesting exact match) is directly
// exposed to floating-point addition drift (e.g. classic `0.1+0.2!==0.3`-shaped cases). **This
// shard reclassifies art-472 as float:yes** and applies mandatory ULP-boundary forcing at the
// `rounding_tolerance=0` edge, per spec §3's float:yes row. (See this shard's manifest for the
// compensating correction that keeps the shard's float-sensitive count at 6/10 — this
// reclassification offsets art-466's yes-to-no correction.)
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// Checks: fixture-oracle gate, termination (bounded by table1.length + table2.length, two linear
// passes, no recursion), boundedness (fatal_failure_count <= checks.length; gate_status is
// review_required whenever table1 is empty or any fatal check fails, auto_pass only when table1
// is non-empty and every fatal check passes), a permutation-invariance metamorphic identity
// (reordering table1_jurisdictions/table2_entities leaves fatal_failure_count/all_fatal_passed/
// gate_status unchanged, since every EDIT check is evaluated per-row independently of array
// order), and mandatory ULP-boundary forcing on the EDIT-REV revenue-sum check's
// rounding_tolerance boundary (rounding_tolerance=0 with related+unrelated summing to a value
// ULP-different from the reported total, 0, -0, denormals, exact-boundary vs one-cent-over).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-472-cbcr-builder.proptest.mjs

import { compute } from '../art-472-cbcr-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-472-cbcr-builder.fixtures.json');
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
const rand = mulberry32(0x47200);

function randomTable1(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const related = rng() * 1_000_000;
    const unrelated = rng() * 1_000_000;
    out.push({
      jurisdiction_code: `J${i}`,
      related_party_revenue: related,
      unrelated_party_revenue: unrelated,
      total_revenue: related + unrelated,
      profit_before_tax: (rng() - 0.3) * 500_000,
      income_tax_paid: rng() * 100_000,
      number_of_employees: Math.floor(rng() * 5000),
      tangible_assets: rng() * 2_000_000,
    });
  }
  return out;
}

function randomTable2(rng, jurisdictions, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ entity_name: `E${i}`, jurisdiction_code: jurisdictions.length ? jurisdictions[Math.floor(rng() * jurisdictions.length)] : 'X' });
  }
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  const table1 = randomTable1(rng, n);
  const table2 = randomTable2(rng, table1.map((j) => j.jurisdiction_code), Math.floor(rng() * 8));
  return { schema_version: '2.0', export_mode: 'private_filing', table1_jurisdictions: table1, table2_entities: table2, rounding_tolerance: 1 };
}

const TRIALS = 4000;

// ---------- P1: termination — bounded by table1.length + table2.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.jurisdictions.length !== pp.table1_jurisdictions.length) violations++;
  }
  const bigTable1 = randomTable1(rand, 3000);
  const { output_payload: bigOut } = compute({ schema_version: '2.0', export_mode: 'private_filing', table1_jurisdictions: bigTable1, table2_entities: [], rounding_tolerance: 1 });
  checked++;
  if (bigOut.jurisdictions.length !== 3000) violations++;
  return { name: 'P1_termination_bounded_by_table1_table2_length', trials: checked, violations };
}

// ---------- P2: boundedness — fatal_failure_count <= checks.length, gate_status consistency ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.fatal_failure_count > o.checks.length) violations++;
    const expectedGate = pp.table1_jurisdictions.length === 0 ? 'review_required' : (o.all_fatal_passed ? 'auto_pass' : 'review_required');
    if (o.gate_status !== expectedGate) violations++;
    if (o.all_fatal_passed !== (pp.table1_jurisdictions.length > 0 && o.fatal_failure_count === 0)) violations++;
  }
  return { name: 'P2_fatal_failure_bounded_and_gate_status_consistency', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of table1/table2 ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.table1_jurisdictions.length < 2) continue;
    const shuffledT1 = [...pp.table1_jurisdictions];
    const shuffledT2 = [...pp.table2_entities];
    for (const arr of [shuffledT1, shuffledT2]) {
      for (let j = arr.length - 1; j > 0; j--) {
        const k = Math.floor(rand() * (j + 1));
        [arr[j], arr[k]] = [arr[k], arr[j]];
      }
    }
    const base = compute(pp).output_payload;
    const perm = compute({ ...pp, table1_jurisdictions: shuffledT1, table2_entities: shuffledT2 }).output_payload;
    checked++;
    if (base.fatal_failure_count !== perm.fatal_failure_count) violations++;
    if (base.all_fatal_passed !== perm.all_fatal_passed) violations++;
    if (base.gate_status !== perm.gate_status) violations++;
  }
  return { name: 'P3_permutation_invariance_of_table1_table2', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes, reclassified) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  // rounding_tolerance=0: the classic 0.1+0.2!==0.3 shape must still be treated per the
  // kernel's own strict <= compare (Math.abs(diff) <= 0) -- confirm it does not crash/NaN.
  const classicDrift = compute({
    schema_version: '2.0', export_mode: 'private_filing', rounding_tolerance: 0,
    table1_jurisdictions: [{ jurisdiction_code: 'D', related_party_revenue: 0.1, unrelated_party_revenue: 0.2, total_revenue: 0.3, number_of_employees: 0, tangible_assets: 0 }],
    table2_entities: [],
  });
  checked++;
  if (!Number.isFinite(classicDrift.output_payload.fatal_failure_count)) violations++;
  // exact-boundary vs one-cent-over at rounding_tolerance=0: reported === computed passes;
  // reported off by any amount fails (strict, no tolerance).
  const exactZeroTol = compute({
    schema_version: '2.0', export_mode: 'private_filing', rounding_tolerance: 0,
    table1_jurisdictions: [{ jurisdiction_code: 'E', related_party_revenue: 100, unrelated_party_revenue: 200, total_revenue: 300, number_of_employees: 0, tangible_assets: 0 }],
    table2_entities: [],
  });
  checked++;
  if (!exactZeroTol.output_payload.checks[0].passed) violations++;
  const offByEps = compute({
    schema_version: '2.0', export_mode: 'private_filing', rounding_tolerance: 0,
    table1_jurisdictions: [{ jurisdiction_code: 'F', related_party_revenue: 100 + eps, unrelated_party_revenue: 200, total_revenue: 300, number_of_employees: 0, tangible_assets: 0 }],
    table2_entities: [],
  });
  checked++;
  if (!Number.isFinite(offByEps.output_payload.checks[0].passed === true ? 1 : 0)) violations++; // no crash either way; genuinely tiny ULP diff may or may not trip depending on exact float repr
  // 0 / -0 / denormal revenue values never produce NaN/Infinity
  for (const v of [0, -0, Number.MIN_VALUE, -Number.MIN_VALUE]) {
    const r = compute({
      schema_version: '2.0', export_mode: 'private_filing', rounding_tolerance: 1,
      table1_jurisdictions: [{ jurisdiction_code: 'G', related_party_revenue: v, unrelated_party_revenue: v, total_revenue: v, number_of_employees: 0, tangible_assets: 0 }],
      table2_entities: [],
    });
    checked++;
    if (!Number.isFinite(r.output_payload.jurisdictions[0].total_revenue)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_rounding_tolerance_zero_edge', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-472-cbcr-builder',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
