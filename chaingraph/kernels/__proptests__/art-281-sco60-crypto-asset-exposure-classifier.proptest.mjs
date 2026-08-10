// kernel_digest_at_authoring: sha256:27ca4b94e8f9b63be974894cab2c35fdb00b72b8c405455fead9dc3a6de0cdd9
//
// FV-PROPFLOOR-SHARD-B10-1 — property-test floor for art-281-sco60-crypto-asset-exposure-classifier.
// Class B (bounded-numeric), FLOAT-SENSITIVE (infra_addon_pct_applied is Math.min-capped
// over a raw double, risk_weight_applied_pct multiplies a base weight by that capped
// double, and group2_exposure_pct_tier1 is a raw division against Tier 1 capital) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays). READ-ONLY with respect to
// the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-281-sco60-crypto-asset-exposure-classifier.proptest.mjs

import { compute } from '../art-281-sco60-crypto-asset-exposure-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-281-sco60-crypto-asset-exposure-classifier.fixtures.json');
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
const rand = mulberry32(0x281B10);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;
const CLASSIFICATIONS = ['tokenized_traditional', 'stablecoin_arte', 'unbacked_crypto', 'hedged_position'];

function mkPP(rng) {
  return {
    position: {
      classification: pick(rng, CLASSIFICATIONS),
      meets_group1_conditions: rng() > 0.5,
      hedge_effective: rng() > 0.5,
      infrastructure_risk_addon_pct: randRange(rng, 0, 300),
      group2_exposure_amount: randRange(rng, 0, 1000000),
      bank_tier1_capital: randRange(rng, 1, 100000000),
    },
  };
}

// ---------- P1: boundedness — infra_addon_pct_applied never exceeds the fixed 150% cap ((2.5-1)*100) ----------
function checkP1_infraCap() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.infra_addon_pct_applied > 150 + 1e-9) violations++;
    if (r.output_payload.infra_addon_pct_applied < 0) violations++;
  }
  return { name: 'P1_infra_addon_applied_bounded_0_to_150pct', trials: checked, violations };
}

// ---------- P2: monotonicity — risk_weight_applied_pct is nondecreasing in infra_addon_pct_applied for Group-1 exposures ----------
function checkP2_riskWeightMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    pp.position.classification = 'tokenized_traditional';
    pp.position.meets_group1_conditions = true;
    pp.position.infrastructure_risk_addon_pct = randRange(rand, 0, 100);
    const r1 = compute(pp);
    const pp2 = { position: { ...pp.position, infrastructure_risk_addon_pct: pp.position.infrastructure_risk_addon_pct + 10 } };
    const r2 = compute(pp2);
    checked++;
    if (!(r2.output_payload.risk_weight_applied_pct >= r1.output_payload.risk_weight_applied_pct)) violations++;
  }
  return { name: 'P2_risk_weight_applied_nondecreasing_in_infra_addon_for_group1', trials: checked, violations };
}

// ---------- P3: fixed-threshold agreement — group2_limit_breached iff group2_exposure_pct_tier1 > 1% exactly ----------
function checkP3_limitAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = pp.position.bank_tier1_capital > 0
      ? (pp.position.group2_exposure_amount / pp.position.bank_tier1_capital) * 100 > 1
      : false;
    if (r.output_payload.group2_limit_breached !== expected) violations++;
  }
  return { name: 'P3_group2_limit_breached_matches_fixed_1pct_tier1_threshold', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ group2_exposure_amount: 1000, bank_tier1_capital: 100000 }, 'group2 exposure exactly 1% of Tier1 (1000/100000=1%) — strict >, limit_breached must be FALSE'],
  [{ group2_exposure_amount: 1000 + Number.EPSILON * 1000, bank_tier1_capital: 100000 }, 'group2 exposure 1-ULP above 1% boundary — limit_breached must be TRUE'],
  [{ bank_tier1_capital: 0 }, 'bank_tier1_capital exactly zero — group2_exposure_pct_tier1 must be exactly 0, not NaN/Infinity (division guard)'],
  [{ infrastructure_risk_addon_pct: 150 }, 'infra addon exactly at 150% cap boundary — infra_addon_pct_applied must equal exactly 150, infra_addon_capped false'],
  [{ infrastructure_risk_addon_pct: 150 + Number.EPSILON * 150 }, 'infra addon 1-ULP above 150% cap — must be capped at exactly 150, infra_addon_capped true'],
  [{ infrastructure_risk_addon_pct: -0 }, 'infra addon negative zero — Number(-0) is finite 0, must not corrupt risk_weight_applied_pct'],
  [{ group2_exposure_amount: 0.1 * 3 * 1000, bank_tier1_capital: 100000 }, 'group2 exposure = 0.1*3*1000 (classic non-exact double artifact) — pct must reflect the EXACT double'],
  [{ infrastructure_risk_addon_pct: Number.MIN_VALUE }, 'infra addon at smallest positive double — must not throw or produce NaN in risk_weight_applied_pct'],
  [{ classification: 'unbacked_crypto', infrastructure_risk_addon_pct: 999999 }, 'unbacked_crypto (group 2b) with huge infra addon input — is_group1 false means addon must be IGNORED, applied stays exactly 0'],
  [{ group2_exposure_amount: Number.MAX_SAFE_INTEGER, bank_tier1_capital: 1 }, 'group2 exposure at MAX_SAFE_INTEGER over minimal Tier1 — pct computation must not overflow, limit_breached true'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const { classification, ...positionOverrides } = overrides;
    const pp = {
      position: {
        classification: classification || 'tokenized_traditional',
        meets_group1_conditions: true,
        hedge_effective: false,
        infrastructure_risk_addon_pct: 10,
        group2_exposure_amount: 500,
        bank_tier1_capital: 100000,
        ...positionOverrides,
      },
    };
    const r = compute(pp);
    const op = r.output_payload;
    const finite = Number.isFinite(op.infra_addon_pct_applied) && Number.isFinite(op.risk_weight_applied_pct) && Number.isFinite(op.group2_exposure_pct_tier1);
    rows.push({ label, overrides, infra_addon_pct_applied: op.infra_addon_pct_applied, risk_weight_applied_pct: op.risk_weight_applied_pct, group2_exposure_pct_tier1: op.group2_exposure_pct_tier1, group2_limit_breached: op.group2_limit_breached, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_infraCap());
results.properties.push(checkP2_riskWeightMonotone());
results.properties.push(checkP3_limitAgreement());
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
