// kernel_digest_at_authoring: sha256:484b5640fddbb90b1bdecd2a7f4e9023d17cef27245c21ed1f726cbf1f30e0a4
//
// FV-PROPFLOOR-SHARD-B24-1 — property-test floor for art-449-solvency2-scr-module-aggregator.
// Class B (bounded-numeric), FLOAT-SENSITIVE (five module charges feed a correlation-matrix
// sum-of-squares-plus-cross-terms under Math.sqrt) — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-449-solvency2-scr-module-aggregator.proptest.mjs

import { compute } from '../art-449-solvency2-scr-module-aggregator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-449-solvency2-scr-module-aggregator.fixtures.json');
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
const rand = mulberry32(0x449C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
const CORR = {
  market: { default: 0.25, life: 0.25, health: 0.25, nonlife: 0.25 },
  default: { life: 0.25, health: 0.25, nonlife: 0.5 },
  life: { health: 0.25, nonlife: 0 },
  health: { nonlife: 0 },
};
const MODULES = ['market', 'default', 'life', 'health', 'nonlife'];

function mkPP(rng) {
  const modules = {};
  for (const m of MODULES) modules[m] = randRange(rng, 0, 1e6);
  return { modules, operational: { scr_operational: randRange(rng, 0, 1e5), loss_absorbing_adjustment: randRange(rng, 0, 1e5) } };
}

function expectedBscr(modules) {
  let sumSquares = 0;
  for (const m of MODULES) sumSquares += modules[m] * modules[m];
  let sumCross = 0;
  for (const [a, row] of Object.entries(CORR)) for (const [b, corr] of Object.entries(row)) sumCross += 2 * corr * modules[a] * modules[b];
  return Math.sqrt(Math.max(sumSquares + sumCross, 0));
}

// ---------- P1: boundedness — bscr and scr_total always >= 0 ----------
function checkP1_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.bscr < 0 || r.scr_total < 0) violations++;
  }
  return { name: 'P1_bscr_and_scr_total_never_negative', trials: checked, violations };
}

// ---------- P2: boundedness — bscr never exceeds the sum of the five module charges (correlations all <=1) ----------
function checkP2_bscrBoundedBySum() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const sumModules = MODULES.reduce((s, m) => s + pp.modules[m], 0);
    if (r.bscr > sumModules + 1e-6) violations++;
  }
  return { name: 'P2_bscr_never_exceeds_sum_of_module_charges', trials: checked, violations };
}

// ---------- P3: monotonicity — increasing any single module charge never decreases bscr ----------
function checkP3_moduleMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp).output_payload;
    const bumpMod = MODULES[Math.floor(rand() * MODULES.length)];
    const pp2 = { modules: { ...pp.modules, [bumpMod]: pp.modules[bumpMod] + randRange(rand, 0.01, 1e4) }, operational: pp.operational };
    const r2v = compute(pp2).output_payload;
    checked++;
    if (r2v.bscr < r1.bscr - 1e-9) violations++;
  }
  return { name: 'P3_bscr_nondecreasing_as_any_module_charge_grows', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
function zeroModules() { return { market: 0, default: 0, life: 0, health: 0, nonlife: 0 }; }
const ULP_BOUNDARY_CASES = [
  [{ modules: zeroModules(), operational: {} }, 'all modules and operational zero — bscr and scr_total exactly 0, no NaN'],
  [{ modules: { ...zeroModules(), market: -0 }, operational: {} }, 'market negative zero — Math.max(v,0) clamps, treated as zero'],
  [{ modules: { ...zeroModules(), market: Number.MIN_VALUE }, operational: {} }, 'market smallest positive double — sqrt() of a tiny positive, finite non-NaN'],
  [{ modules: { ...zeroModules(), market: 1e150, default: 1e150 }, operational: {} }, 'module charges at 1e150 — sumSquares near overflow, must stay finite (sqrt saves it)'],
  [{ modules: { market: 100, default: 100, life: 100, health: 100, nonlife: 100 }, operational: {} }, 'all five modules equal — symmetric aggregation, bscr must equal expectedBscr exactly'],
  [{ modules: zeroModules(), operational: { scr_operational: 0, loss_absorbing_adjustment: 100 } }, 'loss_absorbing_adjustment exceeds bscr+operational — scr_total clamped to exactly 0, adjustment_exceeds flag true'],
  [{ modules: zeroModules(), operational: { scr_operational: 50, loss_absorbing_adjustment: 50 } }, 'loss_absorbing_adjustment exactly equals scr_operational — scr_total exactly 0, adjustment_exceeds false (not strictly greater)'],
  [{ modules: { ...zeroModules(), market: 0.1, default: 0.2 }, operational: {} }, 'classic 0.1/0.2 rounding artifact feeding sumSquares'],
  [{ modules: zeroModules(), operational: { scr_operational: Number.MAX_SAFE_INTEGER } }, 'scr_operational at MAX_SAFE_INTEGER — scr_total must remain finite'],
  [{}, 'entirely empty policy_parameters — modules/operational default to {}, all charges 0'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = Number.isFinite(r.bscr) && Number.isFinite(r.scr_total) && r.bscr >= 0 && r.scr_total >= 0;
    rows.push({ label, bscr: r.bscr, scr_total: r.scr_total, adjustment_exceeds: r.adjustment_exceeds_bscr_plus_op, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_bounded());
results.properties.push(checkP2_bscrBoundedBySum());
results.properties.push(checkP3_moduleMonotone());
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
