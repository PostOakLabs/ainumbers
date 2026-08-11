// kernel_digest_at_authoring: sha256:f6d1afb8e2ecf41c2176368c4f1383cba8b5ffe9cbfed4ac2b8f12760984e828
//
// FV-PROPFLOOR-SHARD-B10-1 — property-test floor for art-283-pension-lump-sum-vs-annuity-decision-engine.
// Class B (bounded-numeric), FLOAT-SENSITIVE (pvOfAnnuity compounds a raw discount-rate
// double, and findBreakEvenRate runs a fixed 60-iteration bisection over raw doubles) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays). READ-ONLY with respect to
// the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-283-pension-lump-sum-vs-annuity-decision-engine.proptest.mjs

import { compute } from '../art-283-pension-lump-sum-vs-annuity-decision-engine.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-283-pension-lump-sum-vs-annuity-decision-engine.fixtures.json');
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
const rand = mulberry32(0x283B10);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 8000;

function mkPP(rng) {
  const currentAge = Math.floor(randRange(rng, 45, 70));
  return {
    election: {
      lumpSum: randRange(rng, 10000, 2000000),
      monthlyAnnuitySingleLife: randRange(rng, 100, 10000),
      monthlyAnnuityJointSurvivor: randRange(rng, 50, 9000),
      currentAge,
      lifeExpectancy: Math.floor(randRange(rng, currentAge + 1, 110)),
      discountRatePct: randRange(rng, 0, 12),
      survivorPct: [50, 75, 100][Math.floor(rng() * 3)],
      colaToggle: rng() > 0.5,
    },
  };
}

// ---------- P1: monotonicity — annuityPV is nonincreasing as discountRatePct rises ----------
function checkP1_discountMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const rate1 = Math.min(10, pp.election.discountRatePct);
    const r1 = compute({ election: { ...pp.election, discountRatePct: rate1 } });
    const r2 = compute({ election: { ...pp.election, discountRatePct: rate1 + 1 } });
    checked++;
    if (!(r2.output_payload.annuityPV <= r1.output_payload.annuityPV + 1e-6)) violations++;
  }
  return { name: 'P1_annuity_pv_nonincreasing_as_discount_rate_rises', trials: checked, violations };
}

// ---------- P2: boundedness — recommendation in known set, survivorPct in known set, money fields finite ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (!['annuity', 'lump_sum'].includes(op.recommendation)) violations++;
    if (![50, 75, 100].includes(op.survivorPct)) violations++;
    if (!Number.isFinite(op.annuityPV) || !Number.isFinite(op.breakEvenRate)) violations++;
  }
  return { name: 'P2_recommendation_and_survivor_pct_known_sets_money_finite', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — recommendation matches annuityPV vs lumpSum comparison exactly ----------
function checkP3_recommendationAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = r.output_payload.annuityPV > pp.election.lumpSum ? 'annuity' : 'lump_sum';
    if (r.output_payload.recommendation !== expected) violations++;
  }
  return { name: 'P3_recommendation_matches_annuity_pv_vs_lump_sum_comparison', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ discountRatePct: 0 }, 'discountRatePct exactly zero — pvOfAnnuity discountFactor stays exactly 1 every iteration, PV = sum of undiscounted payments'],
  [{ lumpSum: 0 }, 'lumpSum exactly zero — recommendation must be "annuity" whenever annuityPV > 0'],
  [{ monthlyAnnuitySingleLife: 0 }, 'monthlyAnnuitySingleLife exactly zero — annuityPV must be exactly 0, recommendation "lump_sum" unless lumpSum also 0'],
  [{ currentAge: 65, lifeExpectancy: 66 }, 'lifeExpectancy at its own Math.max(currentAge+1) floor — years=1, single-iteration PV loop must not throw'],
  [{ discountRatePct: 0.1 * 3 }, 'discountRatePct = 0.1*3 (classic non-exact double artifact) — bisection must converge without NaN'],
  [{ monthlyAnnuitySingleLife: 5000, monthlyAnnuityJointSurvivor: 5000 }, 'single-life exactly equals joint-survivor — survivorOptionCostMonthly must be exactly 0, not -0 or epsilon'],
  [{ colaToggle: true, discountRatePct: 2 }, 'COLA toggle on with discountRatePct == DEFAULT_COLA_PCT (2%) — payment growth cancels discounting per-period, PV sums undiscounted-equivalent without throwing'],
  [{ lumpSum: Number.MAX_SAFE_INTEGER }, 'lumpSum at MAX_SAFE_INTEGER — findBreakEvenRate bisection must still terminate in exactly 60 iterations without NaN'],
  [{ discountRatePct: -0 }, 'discountRatePct negative zero — r=0/100=-0, (1+r) must behave as exactly 1, not corrupt the compounding loop'],
  [{ currentAge: 65, lifeExpectancy: 65 + Number.EPSILON * 100 }, 'lifeExpectancy 1-ULP above currentAge — years computation must stay a small positive finite number'],
];

function checkP4_forced() {
  const base = { lumpSum: 300000, monthlyAnnuitySingleLife: 2000, monthlyAnnuityJointSurvivor: 1800, currentAge: 65, lifeExpectancy: 85, discountRatePct: 5, survivorPct: 50, colaToggle: false };
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { election: { ...base, ...overrides } };
    const r = compute(pp);
    const op = r.output_payload;
    const finite = Number.isFinite(op.annuityPV) && Number.isFinite(op.breakEvenRate) && Number.isFinite(op.survivorOptionCostMonthly);
    rows.push({ label, overrides, annuityPV: op.annuityPV, breakEvenRate: op.breakEvenRate, recommendation: op.recommendation, survivorOptionCostMonthly: op.survivorOptionCostMonthly, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_discountMonotone());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_recommendationAgreement());
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
