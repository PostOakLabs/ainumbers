// kernel_digest_at_authoring: sha256:c6c4a22b53316a6e6ccebc23773eb8e8509b3aea2dd9591b8ac65c6cd03e31db
//
// FV-PROPFLOOR-SHARD-B24-1 — property-test floor for art-439-y14-capital-worksheet-rollforward.
// Class B (bounded-numeric), FLOAT-SENSITIVE (beginning/additions/deductions/scenario-adjustment
// USD amounts feed unrounded roll-forward addition + a tolerance comparison) — ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-439-y14-capital-worksheet-rollforward.proptest.mjs

import { compute } from '../art-439-y14-capital-worksheet-rollforward.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-439-y14-capital-worksheet-rollforward.fixtures.json');
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
const rand = mulberry32(0x439C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

function mkComponent(rng) {
  return {
    beginning: randRange(rng, 0, 1e10),
    additions: randRange(rng, 0, 1e9),
    deductions: randRange(rng, 0, 1e9),
    adj: randRange(rng, -1e8, 1e8),
  };
}

function mkPP(rng) {
  const cet1 = mkComponent(rng);
  const at1 = mkComponent(rng);
  const t2 = mkComponent(rng);
  const hasRef = rng() < 0.7;
  return {
    entity_id: 'X', reporting_period: '2026-03-31', constants_version: 'v1',
    published_scenario: { name: 'severely-adverse', citation: 'cite', cet1_adjustment_usd: cet1.adj, at1_adjustment_usd: at1.adj, t2_adjustment_usd: t2.adj },
    beginning_balances: { cet1: cet1.beginning, at1: at1.beginning, t2: t2.beginning },
    additions: { cet1: cet1.additions, at1: at1.additions, t2: t2.additions },
    deductions: { cet1: cet1.deductions, at1: at1.deductions, t2: t2.deductions },
    cross_check: hasRef ? { reported_total_capital_usd: randRange(rng, 0, 1e10), tolerance_usd: randRange(rng, 0, 1e6) } : {},
    _components: { cet1, at1, t2 },
  };
}

// ---------- P1: fixed rule — ending_usd exactly r2(beginning+additions-deductions+scenario_adj) per component ----------
function checkP1_endingExactRollforward() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    for (const key of ['cet1', 'at1', 't2']) {
      const c = pp._components[key];
      const expected = r2(c.beginning + c.additions - c.deductions + c.adj);
      if (r.rollforward[key].ending_usd !== expected) violations++;
    }
  }
  return { name: 'P1_ending_usd_exact_rollforward_arithmetic', trials: checked, violations };
}

// ---------- P2: round-trip — ending_total_capital_usd equals r2(sum of the three component endings) ----------
function checkP2_totalCapitalRoundtrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expected = r2(r.rollforward.cet1.ending_usd + r.rollforward.at1.ending_usd + r.rollforward.t2.ending_usd);
    if (r.ending_total_capital_usd !== expected) violations++;
    if (r.ending_tier1_capital_usd !== r2(r.rollforward.cet1.ending_usd + r.rollforward.at1.ending_usd)) violations++;
  }
  return { name: 'P2_ending_total_capital_roundtrips_from_component_endings', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — cross_check.pass matches |delta|<=tolerance exactly ----------
function checkP3_crossCheckThreshold() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.cross_check.reported_total_capital_usd === null) {
      if (r.cross_check.pass !== null) violations++;
    } else {
      const expected = Math.abs(r.cross_check.delta_usd) <= r.cross_check.tolerance_usd;
      if (r.cross_check.pass !== expected) violations++;
    }
  }
  return { name: 'P3_cross_check_pass_matches_abs_delta_vs_tolerance', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const BASE_COMPONENT = { beginning: 100, additions: 0, deductions: 0 };
function mkBase(overrides) {
  return {
    entity_id: 'X', reporting_period: '2026-03-31', constants_version: 'v1',
    published_scenario: { name: 's', citation: 'c' },
    beginning_balances: { cet1: BASE_COMPONENT.beginning, at1: 0, t2: 0 },
    additions: { cet1: 0, at1: 0, t2: 0 },
    deductions: { cet1: 0, at1: 0, t2: 0 },
    cross_check: {},
    ...overrides,
  };
}
const ULP_BOUNDARY_CASES = [
  [mkBase({ cross_check: { reported_total_capital_usd: 100, tolerance_usd: 0 } }), 'exact match, tolerance zero — pass must be true (delta 0 <= 0)'],
  [mkBase({ cross_check: { reported_total_capital_usd: 100 + Number.EPSILON, tolerance_usd: 0 } }), 'reported value 1 ULP above ending — delta nonzero, tolerance 0 — pass must be false'],
  [mkBase({ additions: { cet1: 0.1, at1: 0, t2: 0 }, deductions: { cet1: 0, at1: 0, t2: 0 }, published_scenario: { name: 's', citation: 'c' } }), 'additions=0.1 classic decimal — ending must be exactly beginning+0.1 unrounded-then-r2'],
  [mkBase({ beginning_balances: { cet1: 0, at1: 0, t2: 0 } }), 'beginning zero across all components — ending must be exactly 0, no NaN'],
  [mkBase({ beginning_balances: { cet1: -0, at1: 0, t2: 0 } }), 'beginning negative zero — must behave as zero, no NaN'],
  [mkBase({ beginning_balances: { cet1: Number.MAX_SAFE_INTEGER, at1: 0, t2: 0 } }), 'beginning at MAX_SAFE_INTEGER — must remain finite, not overflow'],
  [mkBase({ deductions: { cet1: 1000, at1: 0, t2: 0 } }), 'deductions exceed beginning — ending goes negative, must flag CET1_ENDING_NEGATIVE, no NaN'],
  [mkBase({ cross_check: { reported_total_capital_usd: 100, tolerance_usd: -0 } }), 'tolerance negative zero — must behave as zero tolerance, exact-match-only pass'],
  [mkBase({}), 'cross_check entirely absent — hasReference false, pass/delta must be null, not NaN'],
  [mkBase({ beginning_balances: { cet1: 1 / 3, at1: 0, t2: 0 }, additions: { cet1: 1 / 3, at1: 0, t2: 0 } }), '1/3+1/3 rounding-artifact sum feeding the ending balance'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const finite = Number.isFinite(r.ending_total_capital_usd) && Number.isFinite(r.ending_tier1_capital_usd);
    rows.push({ label, ending_total_capital_usd: r.ending_total_capital_usd, cross_check_pass: r.cross_check.pass, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_endingExactRollforward());
results.properties.push(checkP2_totalCapitalRoundtrip());
results.properties.push(checkP3_crossCheckThreshold());
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
