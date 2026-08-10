// kernel_digest_at_authoring: sha256:83f3aad85600dfd0e80b47b86e5d42e5774e39b792077038e2debae508d10ed5
//
// FV-PROPFLOOR-SHARD-B5-1 — property-test floor for art-184-irrbb-sot-eve-evaluator.
// Class B (bounded supervisory-outlier evaluator). float-sensitive: yes -- the 15%-of-Tier-1
// bright-line comparison is a raw-division threshold. ULP-boundary forcing is mandatory per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit boundary
// arrays), same shape as the B1/B2/B3 harnesses. Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-184-irrbb-sot-eve-evaluator.proptest.mjs

import { compute } from '../art-184-irrbb-sot-eve-evaluator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-184-irrbb-sot-eve-evaluator.fixtures.json');
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
const rand = mulberry32(0x18401);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const TRIALS = 8000;
const SOT_EVE_THRESHOLD_PCT = 15;

function mkPP(rng) {
  return {
    eve_shock: { worst_delta_eve: randRange(rng, -2000, 500) },
    capital: { tier1_capital: rng() < 0.05 ? 0 : randRange(rng, 1, 5000) },
  };
}

// ---------- P1: threshold agreement -- eve_outlier matches the raw formula exactly ----------
function checkP1_thresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const declineAbs = Math.abs(Math.min(0, pp.eve_shock.worst_delta_eve));
    const expPct = pp.capital.tier1_capital > 0 ? Math.round((declineAbs / pp.capital.tier1_capital) * 10000) / 100 : 0;
    const expOutlier = pp.capital.tier1_capital > 0 && expPct > SOT_EVE_THRESHOLD_PCT;
    if (r.delta_eve_pct_of_tier1 !== expPct) violations++;
    if (r.eve_outlier !== expOutlier) violations++;
  }
  return { name: 'P1_eve_outlier_matches_raw_threshold_formula', trials: checked, violations };
}

// ---------- P2: boundedness -- delta_eve_pct_of_tier1 non-negative; worst_delta_eve echoed unchanged ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.delta_eve_pct_of_tier1 < 0) violations++;
    if (r.worst_delta_eve !== pp.eve_shock.worst_delta_eve) violations++;
    if (r.sot_eve_threshold_pct !== SOT_EVE_THRESHOLD_PCT) violations++;
  }
  return { name: 'P2_boundedness_pct_nonneg_and_echoed_fields', trials: checked, violations };
}

// ---------- P3: monotone -- a larger EVE decline (holding tier1 fixed) never decreases delta_eve_pct_of_tier1 ----------
function checkP3_monotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const worse = { eve_shock: { worst_delta_eve: pp.eve_shock.worst_delta_eve - 500 }, capital: pp.capital };
    const r1 = compute(pp).output_payload;
    const r2 = compute(worse).output_payload;
    checked++;
    if (r2.delta_eve_pct_of_tier1 < r1.delta_eve_pct_of_tier1) violations++;
  }
  return { name: 'P3_monotone_pct_nondecreasing_with_larger_decline', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (float_sensitive: yes) ----------
const ULP_BOUNDARY_CASES = [
  [{ eve_shock: { worst_delta_eve: -150 }, capital: { tier1_capital: 1000 } }, 'pct exactly 15% -- must NOT be outlier (> is strict)'],
  [{ eve_shock: { worst_delta_eve: -150.00000000000003 }, capital: { tier1_capital: 1000 } }, 'pct 1 ULP above 15% -- must be outlier'],
  [{ eve_shock: { worst_delta_eve: 0 }, capital: { tier1_capital: 1000 } }, 'no decline (positive/zero delta_eve) -- decline_abs 0, never outlier'],
  [{ eve_shock: { worst_delta_eve: -500 }, capital: { tier1_capital: 0 } }, 'zero tier1_capital -- guarded division, pct 0, never outlier'],
  [{ eve_shock: { worst_delta_eve: -0 }, capital: { tier1_capital: 1000 } }, 'negative-zero worst_delta_eve -- must behave as zero decline'],
  [{ eve_shock: { worst_delta_eve: -Number.MIN_VALUE }, capital: { tier1_capital: 1000 } }, 'denormal decline -- must stay finite, near-zero pct'],
  [{ eve_shock: { worst_delta_eve: -1e12 }, capital: { tier1_capital: 1 } }, 'very large decline vs tiny tier1 -- must stay finite'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const finite = Number.isFinite(r.delta_eve_pct_of_tier1) && Number.isFinite(r.worst_delta_eve) && Number.isFinite(r.tier1_capital);
    rows.push({ label, pp, delta_eve_pct_of_tier1: r.delta_eve_pct_of_tier1, eve_outlier: r.eve_outlier, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_thresholdAgreement());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_monotone());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-184-irrbb-sot-eve-evaluator',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
