// art-355-erba-standardized-rwa-calculator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C16-1).
// kernel_digest_at_authoring: sha256:99791def46ab9a59fb40a172849acf5aa989fe19c873d272759c2ddf8bcfd80d
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — per-exposure RWA is amount * (risk_weight/100),
// LTV-band selection is a `ltv <= b.max_ltv` float compare, CCF is a percent-of-amount multiply)
// — ULP-boundary forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (per_exposure.length === exposures.length exactly —
// a single map over the caller-supplied array, no recursion), boundedness (aggregate_rwa equals
// the exact sum of per_exposure.rwa — a differential re-derivation, and average_risk_weight is
// always within [0, 200] given the table's max published weight of 150), a metamorphic scale
// identity (scaling every exposure_amount by k>0 scales aggregate_rwa by exactly k, since
// risk_weight/basis selection depends on ltv/category/rating, never on amount itself), and
// mandatory ULP-boundary forcing on the residential_re LTV-band boundaries (50/60/80/90/100)
// and on exposure_amount (0, -0, denormals).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-355-erba-standardized-rwa-calculator.proptest.mjs

import { compute } from '../art-355-erba-standardized-rwa-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-355-erba-standardized-rwa-calculator.fixtures.json');
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
const rand = mulberry32(0x35500);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const CATEGORIES = ['residential_re', 'retail_qrre_transactor', 'retail_qrre_revolver', 'retail_other', 'off_balance', 'corporate'];
const RATINGS = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', null];
const CCF_TYPES = ['under_1y', 'over_1y', 'direct_credit_substitute', 'note_issuance_uw', 'unconditionally_cancellable'];

function randomExposure(rng, i) {
  const category = pick(rng, CATEGORIES);
  const exp = { id: `e${i}`, category, exposure_amount: rng() * 1_000_000, sme: rng() < 0.3 };
  if (category === 'residential_re') exp.ltv = rng() * 120;
  if (category === 'off_balance') { exp.commitment_type = pick(rng, CCF_TYPES); exp.external_rating = pick(rng, RATINGS); }
  if (category === 'corporate') { exp.external_rating = pick(rng, RATINGS); exp.investment_grade_unrated = rng() < 0.2; }
  return exp;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  const exposures = [];
  for (let i = 0; i < n; i++) exposures.push(randomExposure(rng, i));
  return { rule_set: pick(rng, ['2023', '2026']), exposures };
}

const TRIALS = 4000;

// ---------- P1: termination — per_exposure.length === exposures.length exactly ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.per_exposure.length !== pp.exposures.length) violations++;
    if (o.exposure_count !== pp.exposures.length) violations++;
  }
  return { name: 'P1_termination_per_exposure_exactly_exposures_length', trials: checked, violations };
}

// ---------- P2: boundedness — aggregate_rwa is the exact sum of per_exposure.rwa ----------
function checkP2_aggregate_sum_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const sum = o.per_exposure.reduce((s, e) => s + e.rwa, 0);
    if (Math.abs(sum - o.aggregate_rwa) > 1e-6 * Math.max(1, Math.abs(sum))) violations++;
    if (o.total_exposure_amount > 0 && (o.average_risk_weight < 0 || o.average_risk_weight > 200)) violations++;
    for (const e of o.per_exposure) {
      if (e.rwa < 0) violations++;
      if (e.exposure_amount < 0) violations++;
    }
  }
  return { name: 'P2_aggregate_rwa_exact_sum_and_avg_weight_bounded', trials: checked, violations };
}

// ---------- P3: metamorphic — scaling every exposure_amount by k>0 scales aggregate_rwa by exactly k ----------
function checkP3_amount_scale_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    if (pp.exposures.length === 0) continue;
    const k = 0.1 + rand() * 9;
    const base = compute(pp).output_payload;
    const scaled = compute({ ...pp, exposures: pp.exposures.map((e) => ({ ...e, exposure_amount: e.exposure_amount * k })) }).output_payload;
    checked++;
    if (base.aggregate_rwa === 0) {
      if (Math.abs(scaled.aggregate_rwa) > 1e-9) violations++;
    } else {
      const ratio = scaled.aggregate_rwa / base.aggregate_rwa;
      if (Math.abs(ratio - k) / k > 1e-6) violations++;
    }
  }
  return { name: 'P3_exposure_amount_scale_metamorphic_identity', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const ltvBoundaries = [50, 60, 80, 90, 100];
  for (const b of ltvBoundaries) {
    for (const ltv of [b - eps, b, b + eps, b - 1e-9, b + 1e-9]) {
      const { output_payload: o } = compute({ rule_set: '2026', exposures: [{ id: 'e1', category: 'residential_re', exposure_amount: 100000, ltv }] });
      checked++;
      if (!Number.isFinite(o.per_exposure[0].risk_weight)) violations++;
      if (!Number.isFinite(o.aggregate_rwa)) violations++;
    }
  }
  const amountForced = [0, -0, eps, Number.MIN_VALUE, 1e-300];
  for (const exposure_amount of amountForced) {
    const { output_payload: o } = compute({ rule_set: '2026', exposures: [{ id: 'e1', category: 'corporate', exposure_amount, external_rating: 'BBB' }] });
    checked++;
    if (!Number.isFinite(o.aggregate_rwa)) violations++;
    if (o.per_exposure[0].rwa < 0) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_ltv_bands_and_exposure_amount', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_aggregate_sum_boundedness());
results.properties.push(checkP3_amount_scale_metamorphic());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-355-erba-standardized-rwa-calculator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
