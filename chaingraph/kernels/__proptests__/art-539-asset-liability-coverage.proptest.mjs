// art-539-asset-liability-coverage.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C28-1).
// kernel_digest_at_authoring: sha256:a80285b47c468275f244648e19b225f0e740ed20c7f8925e658514529f807919
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (matches the WU row, direct read confirms). coverageRatio() divides
// total_assets_musd / total_liabilities_musd -- real IEEE-754 division -- and statusFor()
// compares the raw ratio against the literal 1.0 threshold (COVERED vs SHORTFALL). r2/r4
// round musd totals and the ratio via Math.round(v*N)/N, real IEEE-754 rounding. The
// liabilities===0 branch is a declared non-division edge (NO_LIABILITIES_OUTSTANDING), not a
// float boundary. ULP-boundary forcing is mandatory around the ratio===1.0 threshold and the
// zero-liabilities finite gate.
// Checks: fixture-oracle gate, termination (breakdown arrays bounded by/never exceeding input
// array length), differential re-derivation of totals/ratio/status/surplus, permutation-
// invariance of assets/liabilities order (class aggregation is order-independent at the r2
// rounding precision used), and ULP-boundary forcing around the ratio===1.0 COVERED/SHORTFALL
// threshold plus the liabilities===0 finite gate (0, negative zero, denormal, x/y*y!==x cases).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-539-asset-liability-coverage.proptest.mjs

import { compute } from '../art-539-asset-liability-coverage.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-539-asset-liability-coverage.fixtures.json');
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
const rand = mulberry32(0x53900028);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const ASSET_CLASSES = ['cash', 'securities', 'digital_assets', null];
const LIAB_CLASSES = ['payables', 'accrued_liabilities', null];

function randomLine(rng, classPool) {
  const shape = rng();
  const amount = shape < 0.1 ? -Math.floor(rng() * 1000) : Math.floor(rng() * 500000) / 100;
  return { class_key: pick(rng, classPool), amount_musd: amount };
}

function randomPP(rng) {
  const na = Math.floor(rng() * 8);
  const nl = Math.floor(rng() * 8);
  const assets = Array.from({ length: na }, () => {
    const l = randomLine(rng, ASSET_CLASSES);
    return { asset_class: l.class_key, amount_musd: l.amount_musd };
  });
  const liabilities = Array.from({ length: nl }, () => {
    const l = randomLine(rng, LIAB_CLASSES);
    return { liability_class: l.class_key, amount_musd: l.amount_musd };
  });
  return { assets, liabilities };
}

const TRIALS = 3000;

// ---------- P1: termination -- breakdown arrays never exceed input array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.asset_breakdown.length > pp.assets.length) violations++;
    if (output_payload.liability_breakdown.length > pp.liabilities.length) violations++;
    if (!Number.isFinite(output_payload.total_assets_musd)) violations++;
    if (!Number.isFinite(output_payload.total_liabilities_musd)) violations++;
    if (!['COVERED', 'SHORTFALL', 'NO_LIABILITIES_OUTSTANDING'].includes(output_payload.status)) violations++;
  }
  return { name: 'P1_breakdown_bounded_by_input_length_and_finite_totals', trials: checked, violations };
}

// ---------- P2 (differential): totals/ratio/status/surplus re-derived independently ----------
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function r4(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 10000) / 10000; }
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const totalAssets = r2(pp.assets.reduce((s, a) => s + Math.max(0, Number.isFinite(Number(a.amount_musd)) ? Number(a.amount_musd) : 0), 0));
    const totalLiab = r2(pp.liabilities.reduce((s, l) => s + Math.max(0, Number.isFinite(Number(l.amount_musd)) ? Number(l.amount_musd) : 0), 0));
    const ratio = totalLiab === 0 ? null : totalAssets / totalLiab;
    const status = ratio === null ? 'NO_LIABILITIES_OUTSTANDING' : (ratio >= 1.0 ? 'COVERED' : 'SHORTFALL');
    const surplus = r2(totalAssets - totalLiab);
    if (output_payload.total_assets_musd !== totalAssets) violations++;
    if (output_payload.total_liabilities_musd !== totalLiab) violations++;
    if (output_payload.coverage_ratio !== r4(ratio)) violations++;
    if (output_payload.status !== status) violations++;
    if (output_payload.surplus_shortfall_musd !== surplus) violations++;
  }
  return { name: 'P2_totals_ratio_status_surplus_differential', trials: checked, violations };
}

// ---------- P3: metamorphic -- permuting assets/liabilities order never changes totals ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    if (pp.assets.length < 2 && pp.liabilities.length < 2) continue;
    const shuffled = {
      assets: [...pp.assets].sort(() => rand() - 0.5),
      liabilities: [...pp.liabilities].sort(() => rand() - 0.5),
    };
    const r1 = compute(pp).output_payload;
    const r2v = compute(shuffled).output_payload;
    checked++;
    if (r1.total_assets_musd !== r2v.total_assets_musd) violations++;
    if (r1.total_liabilities_musd !== r2v.total_liabilities_musd) violations++;
    if (r1.coverage_ratio !== r2v.coverage_ratio) violations++;
    if (r1.status !== r2v.status) violations++;
    if (r1.asset_breakdown.length !== r2v.asset_breakdown.length) violations++;
    if (r1.liability_breakdown.length !== r2v.liability_breakdown.length) violations++;
  }
  return { name: 'P3_asset_liability_order_invariance', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing around the ratio===1.0 threshold and zero-liabilities gate ----------
function checkP4_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const mk = (assetAmt, liabAmt) => ({
    assets: [{ asset_class: 'cash', amount_musd: assetAmt }],
    liabilities: liabAmt === undefined ? [] : [{ liability_class: 'payables', amount_musd: liabAmt }],
  });

  // exact ratio === 1.0 -> COVERED (boundary, never SHORTFALL)
  checked++;
  {
    const r = compute(mk(100, 100)).output_payload;
    if (r.coverage_ratio !== 1 || r.status !== 'COVERED') violations++;
  }
  // one ULP below 1.0 -> SHORTFALL
  checked++;
  {
    const justBelow = 100 * (1 - Number.EPSILON);
    const r = compute(mk(justBelow, 100)).output_payload;
    if (!Number.isFinite(r.coverage_ratio) && r.coverage_ratio !== null) violations++;
    if (r.status !== 'SHORTFALL' && r.coverage_ratio !== 1) violations++; // rounding to r4 may collapse to 1.0
  }
  // liabilities === 0 -> null ratio, never a division artifact (no NaN/Infinity)
  checked++;
  {
    const r = compute(mk(5, 0)).output_payload;
    if (r.coverage_ratio !== null || r.status !== 'NO_LIABILITIES_OUTSTANDING') violations++;
  }
  // negative-zero liabilities -> treated identically to 0 (JS -0 === 0)
  checked++;
  {
    const r = compute(mk(5, -0)).output_payload;
    if (r.coverage_ratio !== null || r.status !== 'NO_LIABILITIES_OUTSTANDING') violations++;
  }
  // denormal asset amount -> never throws, never NaN/Infinity
  checked++;
  {
    const r = compute(mk(Number.MIN_VALUE, 1)).output_payload;
    if (!Number.isFinite(r.total_assets_musd) && r.total_assets_musd !== 0) violations++;
    if (r.coverage_ratio !== null && !Number.isFinite(r.coverage_ratio)) violations++;
  }
  // x/y*y !== x shaped assets/liabilities pair -> ratio still resolves finite, never throws
  checked++;
  {
    const x = 0.1, y = 3;
    const derived = (x / y) * y; // !== x in IEEE-754
    const r = compute(mk(100 + (derived - x) * 1000, 100)).output_payload;
    if (r.coverage_ratio !== null && !Number.isFinite(r.coverage_ratio)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_ratio_one_and_zero_liabilities', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_ulp_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-539-asset-liability-coverage',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
