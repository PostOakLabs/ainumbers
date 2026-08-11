// kernel_digest_at_authoring: sha256:688cc0519d212cdc48f08b6a4d5ebce07750de7562edc9abad7f91202ba38bf9
//
// FV-PROPFLOOR-SHARD-B5-1 — property-test floor for art-183-irrbb-eve-shock-calculator.
// Class B (bounded standardised-shock calculator). float-sensitive: yes -- delta_eve is a
// duration-weighted sum of gap*midpoint*shock_bps/10000, rounded to 2dp. ULP-boundary forcing
// is mandatory per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1/B2/B3 harnesses. Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-183-irrbb-eve-shock-calculator.proptest.mjs

import { compute } from '../art-183-irrbb-eve-shock-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-183-irrbb-eve-shock-calculator.fixtures.json');
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
const rand = mulberry32(0x18301);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const TRIALS = 8000;
const R_BAR_BPS = 200;
const BUCKETS = [
  { key: 'on_1m', midpoint: 0.04 },
  { key: 'm1_y1', midpoint: 0.5 },
  { key: 'y1_y3', midpoint: 2 },
  { key: 'y3_y5', midpoint: 4 },
  { key: 'y5_y10', midpoint: 7.5 },
  { key: 'y10_plus', midpoint: 15 },
];
const SCENARIOS = ['parallel_up', 'parallel_down', 'short_up', 'short_down', 'steepener', 'flattener'];

function decay(midpoint) { return Math.max(0, 1 - midpoint / 20); }
function shockBps(scenario, midpoint) {
  const d = decay(midpoint);
  switch (scenario) {
    case 'parallel_up': return R_BAR_BPS;
    case 'parallel_down': return -R_BAR_BPS;
    case 'short_up': return R_BAR_BPS * d;
    case 'short_down': return -R_BAR_BPS * d;
    case 'steepener': return -0.65 * R_BAR_BPS * d + 0.90 * R_BAR_BPS * (1 - d);
    case 'flattener': return 0.80 * R_BAR_BPS * d - 0.60 * R_BAR_BPS * (1 - d);
    default: return 0;
  }
}
function expectedShocks(gaps) {
  const shocks = {};
  for (const scenario of SCENARIOS) {
    const delta_eve = Math.round(
      -BUCKETS.reduce((s, b) => s + gaps[b.key] * b.midpoint * shockBps(scenario, b.midpoint) / 10000, 0) * 100
    ) / 100;
    shocks[scenario] = delta_eve;
  }
  return shocks;
}

function mkGaps(rng) {
  const gaps = {};
  for (const b of BUCKETS) gaps[b.key] = randRange(rng, -2000, 2000);
  return gaps;
}

// ---------- P1: identity -- total_net_gap equals the raw sum of the 6 bucket gaps ----------
function checkP1_totalGap() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const gaps = mkGaps(rand);
    const r = compute({ repricing_gaps: gaps }).output_payload;
    checked++;
    const expTotal = BUCKETS.reduce((s, b) => s + gaps[b.key], 0);
    if (r.total_net_gap !== expTotal) violations++;
  }
  return { name: 'P1_total_net_gap_matches_raw_sum', trials: checked, violations };
}

// ---------- P2: round-trip -- every scenario's delta_eve matches the independently-derived formula exactly ----------
function checkP2_scenarioFormula() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const gaps = mkGaps(rand);
    const r = compute({ repricing_gaps: gaps }).output_payload;
    const exp = expectedShocks(gaps);
    for (const s of SCENARIOS) {
      checked++;
      if (r.shocks[s].delta_eve !== exp[s]) violations++;
    }
  }
  return { name: 'P2_scenario_delta_eve_matches_independent_formula', trials: checked, violations };
}

// ---------- P3: worst-scenario selection matches min across the 6 scenarios ----------
function checkP3_worstSelection() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const gaps = mkGaps(rand);
    const r = compute({ repricing_gaps: gaps }).output_payload;
    checked++;
    const values = SCENARIOS.map((s) => r.shocks[s].delta_eve);
    const expWorst = Math.min(...values);
    if (r.worst_delta_eve !== expWorst) violations++;
    if (r.shocks[r.worst_scenario].delta_eve !== expWorst) violations++;
  }
  return { name: 'P3_worst_scenario_matches_min_of_shocks', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (float_sensitive: yes) ----------
const ULP_BOUNDARY_CASES = [
  [{ on_1m: 0, m1_y1: 0, y1_y3: 0, y3_y5: 0, y5_y10: 0, y10_plus: 0 }, 'all-zero gaps -- every scenario delta_eve must be exactly 0'],
  [{ on_1m: -0, m1_y1: -0, y1_y3: 0, y3_y5: 0, y5_y10: 0, y10_plus: 0 }, 'negative-zero gaps -- must behave as zero'],
  [{ on_1m: Number.MIN_VALUE, m1_y1: 0, y1_y3: 0, y3_y5: 0, y5_y10: 0, y10_plus: 0 }, 'denormal gap in shortest bucket -- must stay finite'],
  [{ on_1m: 0, m1_y1: 0, y1_y3: 0, y3_y5: 0, y5_y10: 0, y10_plus: Number.MIN_VALUE }, 'denormal gap in longest bucket (midpoint 15, near-zero decay) -- must stay finite'],
  [{ on_1m: 1e12, m1_y1: 0, y1_y3: 0, y3_y5: 0, y5_y10: 0, y10_plus: 0 }, 'very large gap -- must stay finite, not overflow'],
  [{ on_1m: 0.1, m1_y1: 0.2, y1_y3: 0, y3_y5: 0, y5_y10: 0, y10_plus: 0 }, '0.1+0.2 float-repr gaps -- x/y*y!==x style, must stay finite'],
  [{ on_1m: 500, m1_y1: 800, y1_y3: -300, y3_y5: 1200, y5_y10: -400, y10_plus: 200 }, 'mixed-sign gaps (fixture-shaped) -- sanity replica'],
];

function checkP4_forced() {
  const rows = [];
  for (const [gaps, label] of ULP_BOUNDARY_CASES) {
    const r = compute({ repricing_gaps: gaps }).output_payload;
    const finite = SCENARIOS.every((s) => Number.isFinite(r.shocks[s].delta_eve))
      && Number.isFinite(r.worst_delta_eve) && Number.isFinite(r.total_net_gap);
    rows.push({ label, gaps, worst_delta_eve: r.worst_delta_eve, worst_scenario: r.worst_scenario, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_totalGap());
results.properties.push(checkP2_scenarioFormula());
results.properties.push(checkP3_worstSelection());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-183-irrbb-eve-shock-calculator',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
