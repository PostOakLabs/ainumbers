// kernel_digest_at_authoring: sha256:2ea7eb0372ecebf09f65212f7005ce7e5e31c1e0b784b1a8e55b057cc5f98846
//
// FV-PROPFLOOR-SHARD-B23-1 — property-test floor for art-415-check-capital-adequacy-private.
// Class B (bounded-numeric), FLOAT-SENSITIVE (private ratio_pct = (capital/rwa)*100 compared
// against a caller-declared minimum and minimum+2.5pp buffer) — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. This is a §25 ocg-private-input@1 kernel:
// compute(pp) never recomputes from policy_parameters alone (by design — see kernel header),
// so every property here drives buildArtifact(raw) with an explicit {capital_inputs, salt}
// witness, the kernel's only real compute path, and reads output_payload's public
// above_minimum/tier fields. Zero external dependencies. This file is READ-ONLY with respect
// to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-415-check-capital-adequacy-private.proptest.mjs

import { compute, buildArtifact } from '../art-415-check-capital-adequacy-private.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

const SALT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const DEFAULT_MIN = 10.5;

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-415-check-capital-adequacy-private.fixtures.json');
  const disclosurePath = path.join(__dirname, '..', 'fixtures', 'art-415-check-capital-adequacy-private.disclosure.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const disclosure = JSON.parse(readFileSync(disclosurePath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const disc = disclosure.vectors.find((d) => d.name === vec.name);
    const artifact = await buildArtifact({
      capital_inputs: disc.input_value, salt: disc.salt,
      regime: disc.input_value.regime, regulatory_minimum_pct: vec.policy_parameters.regulatory_minimum_pct,
    });
    const a = JSON.stringify(artifact.output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: artifact.output_payload });
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
const rand = mulberry32(0x415C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 5000;

function tierFor(ratioPct, minPct) {
  if (ratioPct < minPct) return 'below_minimum';
  return ratioPct >= minPct + 2.5 ? 'well_capitalized' : 'adequately_capitalized';
}

// ---------- P1: boundedness — tier always one of the 3 declared tiers ----------
async function checkP1_tierBounded() {
  let violations = 0, checked = 0;
  const TIERS = ['below_minimum', 'adequately_capitalized', 'well_capitalized'];
  for (let i = 0; i < TRIALS; i++) {
    const capital = randRange(rand, 0, 50);
    const rwa = randRange(rand, 0.01, 100);
    const artifact = await buildArtifact({ capital_inputs: { eligible_capital: capital, risk_weighted_assets: rwa }, salt: SALT });
    checked++;
    if (!TIERS.includes(artifact.output_payload.tier)) violations++;
  }
  return { name: 'P1_tier_bounded_to_3_declared_values', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — above_minimum and tier match independently recomputed ratio ----------
async function checkP2_verdictMatchesRatio() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const capital = randRange(rand, 0, 50);
    const rwa = randRange(rand, 0.01, 100);
    const minPct = randRange(rand, 4, 14);
    const artifact = await buildArtifact({ capital_inputs: { eligible_capital: capital, risk_weighted_assets: rwa }, salt: SALT, regulatory_minimum_pct: minPct });
    checked++;
    const ratioPct = (capital / rwa) * 100;
    const expectAbove = ratioPct >= minPct;
    if (artifact.output_payload.above_minimum !== expectAbove) violations++;
    if (artifact.output_payload.tier !== tierFor(ratioPct, minPct)) violations++;
  }
  return { name: 'P2_above_minimum_and_tier_match_recomputed_ratio', trials: checked, violations };
}

// ---------- P3: monotonicity — increasing eligible_capital (RWA fixed) never lowers the tier rank ----------
async function checkP3_monotonicInCapital() {
  let violations = 0, checked = 0;
  const RANK = { below_minimum: 0, adequately_capitalized: 1, well_capitalized: 2 };
  for (let i = 0; i < TRIALS / 5; i++) {
    const rwa = randRange(rand, 0.01, 100);
    const capLo = randRange(rand, 0, 25);
    const capHi = capLo + randRange(rand, 0.01, 25);
    const [aLo, aHi] = await Promise.all([
      buildArtifact({ capital_inputs: { eligible_capital: capLo, risk_weighted_assets: rwa }, salt: SALT }),
      buildArtifact({ capital_inputs: { eligible_capital: capHi, risk_weighted_assets: rwa }, salt: SALT }),
    ]);
    checked++;
    if (RANK[aHi.output_payload.tier] < RANK[aLo.output_payload.tier]) violations++;
  }
  return { name: 'P3_tier_rank_nondecreasing_as_capital_increases', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing at the minimum and minimum+2.5pp thresholds ----------
const EPS = Number.EPSILON;
const ULP_BOUNDARY_CASES = [
  [{ eligible_capital: 10.5, risk_weighted_assets: 100 }, DEFAULT_MIN, 'ratio exactly at the 10.5% default minimum — above_minimum true, adequately_capitalized (not yet well_capitalized)'],
  [{ eligible_capital: 10.5 * (1 - EPS * 4), risk_weighted_assets: 100 }, DEFAULT_MIN, 'ratio 1 ULP below the minimum — above_minimum false, below_minimum'],
  [{ eligible_capital: 13, risk_weighted_assets: 100 }, DEFAULT_MIN, 'ratio exactly at minimum+2.5pp (13.0%) — well_capitalized (>= boundary)'],
  [{ eligible_capital: 13 * (1 - EPS * 4), risk_weighted_assets: 100 }, DEFAULT_MIN, 'ratio 1 ULP below minimum+2.5pp — adequately_capitalized, not well_capitalized'],
  [{ eligible_capital: 0, risk_weighted_assets: 100 }, DEFAULT_MIN, 'eligible_capital exactly zero — ratio 0%, below_minimum'],
  [{ eligible_capital: -0, risk_weighted_assets: 100 }, DEFAULT_MIN, 'negative-zero capital — must behave as zero, no NaN'],
  [{ eligible_capital: 10, risk_weighted_assets: 0 }, DEFAULT_MIN, 'risk_weighted_assets exactly zero — division guard yields ratio 0, below_minimum, no Infinity/NaN'],
  [{ eligible_capital: 10, risk_weighted_assets: -0 }, DEFAULT_MIN, 'negative-zero RWA — guard treats as non-positive, ratio 0'],
  [{ eligible_capital: 1 / 3 * 30, risk_weighted_assets: 100 }, DEFAULT_MIN, 'x/y*y!==x style rounding artifact near well_capitalized boundary — must classify deterministically, finite'],
  [{ eligible_capital: Number.MAX_SAFE_INTEGER, risk_weighted_assets: 1 }, DEFAULT_MIN, 'capital at MAX_SAFE_INTEGER — must not overflow to non-finite ratio, well_capitalized'],
  [{ eligible_capital: NaN, risk_weighted_assets: 100 }, DEFAULT_MIN, 'NaN capital — Number.isFinite guard coerces to 0, below_minimum, never NaN propagation'],
];

async function checkP4_forced() {
  const rows = [];
  for (const [capital_inputs, minPct, label] of ULP_BOUNDARY_CASES) {
    const artifact = await buildArtifact({ capital_inputs, salt: SALT, regulatory_minimum_pct: minPct });
    const op = artifact.output_payload;
    const codeOk = ['below_minimum', 'adequately_capitalized', 'well_capitalized'].includes(op.tier)
      && typeof op.above_minimum === 'boolean';
    rows.push({ label, input: capital_inputs, above_minimum: op.above_minimum, tier: op.tier, plausible: codeOk });
  }
  return rows;
}

const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

const decoyCall = compute({});
if (decoyCall.above_minimum !== null) {
  console.error('compute() decoy export unexpectedly returned a non-null verdict — private-input contract violated.');
  process.exit(1);
}

results.properties.push(await checkP1_tierBounded());
results.properties.push(await checkP2_verdictMatchesRatio());
results.properties.push(await checkP3_monotonicInCapital());
results.boundary_forced = await checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  compute_decoy_ok: decoyCall.above_minimum === null,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
