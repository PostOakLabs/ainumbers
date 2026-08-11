// kernel_digest_at_authoring: sha256:1e4fce8fd6091dfe615782e95fda6b777a3c36d0fe5d65cf211f2957d69a64cd
//
// FV-PROPFLOOR-SHARD-B21-1 — property-test floor for art-370-supervisory-scenario-replay.
// Class B (bounded-numeric), FLOAT:YES — cents-integer fixed-point discipline is a house
// convention (Math.round after every dollar<->cents conversion), not proof the kernel is
// free of float arithmetic: evalCoefficientFnCents multiplies floating coefficients by
// floating macro variables before rounding to cents, so ULP-boundary forcing still
// applies at those multiplication/rounding boundaries. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B12 harness. This
// file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-370-supervisory-scenario-replay.proptest.mjs

import { compute } from '../art-370-supervisory-scenario-replay.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

// compute() here returns output_payload directly (no {output_payload, compliance_flags}
// wrapper — confirmed by reading the kernel: buildArtifact() does
// `const output_payload = compute(pp)`), and the fixture stores that same shape under
// the vector's top-level "output_payload" key.
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-370-supervisory-scenario-replay.fixtures.json');
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
const rand = mulberry32(0x0370A1);
const TRIALS = 4000;
function range(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const VAR_NAMES = ['real_gdp_growth', 'unemployment_rate', 'house_price_index', 'treasury_10y_yield', 'cre_price_index'];

function mkPP(rng) {
  const coefficients = {};
  for (const name of VAR_NAMES) if (rng() < 0.6) coefficients[name] = range(rng, -50, 50);
  const ppnrCoefficients = {};
  for (const name of VAR_NAMES) if (rng() < 0.6) ppnrCoefficients[name] = range(rng, -50, 50);
  return {
    scenario: pick(rng, ['baseline', 'severely_adverse']),
    starting_capital_mn: range(rng, 100, 20000),
    rwa_mn: range(rng, 0, 100000),
    tax_rate: range(rng, 0, 0.5),
    quarterly_distribution_mn: range(rng, 0, 100),
    loss_function: { intercept: range(rng, 0, 500), coefficients },
    ppnr_function: { intercept: range(rng, 0, 500), coefficients: ppnrCoefficients },
  };
}

// ---------- P1: quarters array always has exactly 13 entries (the fixed Fed scenario length) ----------
function checkP1_alwaysThirteenQuarters() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.quarters.length !== 13) violations++;
  }
  return { name: 'P1_quarters_array_always_exactly_13_entries', trials: checked, violations };
}

// ---------- P2: ending_capital_mn equals the last quarter's capital_mn exactly ----------
function checkP2_endingCapitalMatchesLastQuarter() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.ending_capital_mn !== r.quarters[12].capital_mn) violations++;
  }
  return { name: 'P2_ending_capital_mn_matches_last_quarter_exactly', trials: checked, violations };
}

// ---------- P3: trough_capital_mn is the minimum of starting_capital and every quarter's capital_mn ----------
function checkP3_troughIsActualMinimum() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const actualMin = Math.min(r.starting_capital_mn, ...r.quarters.map((q) => q.capital_mn));
    if (Math.abs(actualMin - r.trough_capital_mn) > 0.005) violations++;
  }
  return { name: 'P3_trough_capital_mn_is_actual_minimum_across_path', trials: checked, violations };
}

// ---------- P4: loss_mn is never negative in any quarter (Math.max(0, ...) guard in the kernel) ----------
function checkP4_lossNeverNegative() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.quarters.some((q) => q.loss_mn < 0)) violations++;
  }
  return { name: 'P4_loss_mn_never_negative_across_all_quarters', trials: checked, violations };
}

// ---------- P5 (mandatory, float-sensitive): forced ULP-boundary cases ----------
function checkP5_forced() {
  const rows = [];
  const base = {
    scenario: 'severely_adverse', starting_capital_mn: 5000, rwa_mn: 40000, tax_rate: 0.21,
    loss_function: { intercept: 50, coefficients: { unemployment_rate: 25 } },
    ppnr_function: { intercept: 300, coefficients: { real_gdp_growth: 8 } },
  };
  const cases = [
    { ...base, rwa_mn: 0, label: 'rwa_mn exactly 0 — capital_ratio_pct must be null (rwa>0 gate), not Infinity' },
    { ...base, rwa_mn: 0.0001, label: 'rwa_mn at a tiny-but-representable scale (not denormal) — capital_ratio_pct division must stay finite' },
    { ...base, starting_capital_mn: 0, label: 'starting_capital_mn exactly 0 — capital walk starts at 0, stays finite' },
    { ...base, starting_capital_mn: -0, label: 'starting_capital_mn is negative zero — toCents(Math.round(-0*100)) must not propagate a sign anomaly' },
    { ...base, tax_rate: 0.5, label: 'tax_rate at its declared ceiling (Math.min(0.5,...))' },
    { ...base, tax_rate: 0, label: 'tax_rate exactly 0 — net_income_mn equals pretax_income_mn exactly every quarter' },
    { ...base, loss_function: { intercept: 0, coefficients: {} }, label: 'loss_function entirely zero — every quarter loss_mn exactly 0' },
    { ...base, loss_function: { intercept: Number.EPSILON, coefficients: {} }, label: 'loss_function intercept at Number.EPSILON scale — toCents(round(x*100)) must round to 0, not misfire' },
    { ...base, scenario: 'unknown-scenario-name', label: 'unrecognized scenario name — defaults to severely_adverse per the ternary guard' },
  ];
  for (const c of cases) {
    const { label, ...pp } = c;
    const r = compute(pp);
    const plausible = Number.isFinite(r.ending_capital_mn) && Number.isFinite(r.trough_capital_mn) && r.quarters.length === 13 && r.quarters.every((q) => Number.isFinite(q.capital_mn) && (q.capital_ratio_pct === null || Number.isFinite(q.capital_ratio_pct)));
    rows.push({ label, input: pp, ending_capital_mn: r.ending_capital_mn, trough_capital_mn: r.trough_capital_mn, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_alwaysThirteenQuarters());
results.properties.push(checkP2_endingCapitalMatchesLastQuarter());
results.properties.push(checkP3_troughIsActualMinimum());
results.properties.push(checkP4_lossNeverNegative());
results.boundary_forced = checkP5_forced();

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
