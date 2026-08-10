// kernel_digest_at_authoring: sha256:bb655f6f08ccd299198d1eff963940525ec31c073ef296bfce08503620cb28c7
//
// FV-PROPFLOOR-SHARD-B1-1 — property-test floor for art-07-basel31-reporting-delta-calculator.
// Class B (bounded-numeric), FLOAT-SENSITIVE (RWA weighted-sum arithmetic, output-floor ratio) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// Read-only w.r.t. the kernel it imports. NOTE: this kernel's compute() returns the flat result
// object directly (not {output_payload, compliance_flags}) — the fixture-oracle and every property
// below reads that shape directly, matching the kernel and its fixtures file exactly.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-07-basel31-reporting-delta-calculator.proptest.mjs

import { compute } from '../art-07-basel31-reporting-delta-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-07-basel31-reporting-delta-calculator.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0xA07A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const ASSET_IDS = ['residential_mortgage', 'sme_retail', 'large_corporate', 'bank', 'sovereign', 'equity'];
const APPROACHES = ['sa', 'irb'];
const TRIALS = 20000;

function randMix(rng) {
  const raw = ASSET_IDS.map(() => rng());
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const mix = {};
  ASSET_IDS.forEach((id, i) => { mix[id] = raw[i] / sum; });
  return mix;
}
function randPP(rng) {
  return {
    ead_bn: randRange(rng, 1, 1000),
    approach: pick(rng, APPROACHES),
    cet1_ratio: randRange(rng, 0.08, 0.25),
    mix: randMix(rng),
  };
}

// ---------- P1: monotone in ead_bn (fixed mix/approach/cet1, current_rwa_bn and basel31_rwa_bn scale up) ----------
function checkP1_monotoneEad() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = randPP(rand);
    const e1 = randRange(rand, 1, 400);
    const e2 = e1 + randRange(rand, 0, 400);
    const r1 = compute({ ...base, ead_bn: e1 });
    const r2 = compute({ ...base, ead_bn: e2 });
    checked++;
    if (r2.current_rwa_bn < r1.current_rwa_bn - 0.01) violations++;
    if (r2.basel31_rwa_bn < r1.basel31_rwa_bn - 0.01) violations++;
  }
  return { name: 'P1_monotone_in_ead_bn', trials: checked, violations };
}

// ---------- P2: boundedness — RWA values non-negative, output_floor_binding only under IRB ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randPP(rand);
    const r = compute(pp);
    checked++;
    if (r.current_rwa_bn < -0.01 || r.basel31_rwa_bn < -0.01) violations++;
    if (r.output_floor_binding && pp.approach !== 'irb') violations++;
    if (r.floor_rwa_bn < -0.01) violations++;
  }
  return { name: 'P2_boundedness_nonneg_rwa_floor_irb_only', trials: checked, violations };
}

// ---------- P3: round-trip identity — rwa_delta_bn = basel31_rwa_bn - current_rwa_bn (toFixed(3) rounding) ----------
function checkP3_deltaIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(randPP(rand));
    checked++;
    const expected = +(r.basel31_rwa_bn - r.current_rwa_bn).toFixed(3);
    if (Math.abs(r.rwa_delta_bn - expected) > 0.002) violations++;
  }
  return { name: 'P3_rwa_delta_identity', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const singleMix = (id) => Object.fromEntries(ASSET_IDS.map((a) => [a, a === id ? 1 : 0]));
const ULP_BOUNDARY_CASES = [
  ['ead_bn=0', { ead_bn: 0, approach: 'sa', cet1_ratio: 0.155, mix: singleMix('residential_mortgage') }],
  ['ead_bn subnormal', { ead_bn: Number.MIN_VALUE, approach: 'sa', cet1_ratio: 0.155, mix: singleMix('residential_mortgage') }],
  ['CET1 exactly at 10.5% threshold (basel31 pct) — boundary category check', { ead_bn: 100, approach: 'sa', cet1_ratio: 0.105, mix: singleMix('equity') }],
  ['output floor exactly 72.5% boundary — IRB, large_corporate only', { ead_bn: 100, approach: 'irb', cet1_ratio: 0.16, mix: singleMix('large_corporate') }],
  ['mix weights sum to 0.9999999999999999 (not exactly 1) — must stay finite', { ead_bn: 100, approach: 'sa', cet1_ratio: 0.155, mix: { residential_mortgage: 0.3333333333333333, sme_retail: 0.3333333333333333, large_corporate: 0.3333333333333333 } }],
  ['x/y*y!==x-shaped ead_bn', { ead_bn: 33.333333333333336, approach: 'irb', cet1_ratio: 0.16, mix: singleMix('sovereign') }],
  ['default inputs (empty pp, preset fallback)', {}],
];

function checkP4_forced() {
  const rows = [];
  for (const [label, pp] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const finite = Number.isFinite(r.current_rwa_bn) && Number.isFinite(r.basel31_rwa_bn) && Number.isFinite(r.rwa_delta_bn);
    const nonneg = r.current_rwa_bn >= -0.01 && r.basel31_rwa_bn >= -0.01;
    const deltaOk = Math.abs(r.rwa_delta_bn - +(r.basel31_rwa_bn - r.current_rwa_bn).toFixed(3)) <= 0.002;
    rows.push({ label, current_rwa_bn: r.current_rwa_bn, basel31_rwa_bn: r.basel31_rwa_bn, output_floor_binding: r.output_floor_binding, verdict: r.verdict, finite, plausible: finite && nonneg && deltaOk });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneEad());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_deltaIdentity());
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
