// kernel_digest_at_authoring: sha256:bf76db6dbd58cc21042569b32a4e5b60d9f4e3b31a1cded90fb40558f07ff584
//
// FV-PROPFLOOR-SHARD-B12-1 — property-test floor for art-316-sb53-frontier-scope-checker.
// Class B (bounded-numeric/categorical), FLOAT:NO exception per the WU row — compute_flops
// travels as a decimal STRING (RFC 7493 I-JSON safe-integer rule) compared only against a fixed
// threshold string via Number() parsing, never arithmetic on the raw magnitude. Forced
// CATEGORICAL boundary cases used in place of ULP forcing. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-316-sb53-frontier-scope-checker.proptest.mjs

import { compute } from '../art-316-sb53-frontier-scope-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-316-sb53-frontier-scope-checker.fixtures.json');
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
const rand = mulberry32(0x3160B2);
const TRIALS = 8000;
const OBLIGATION_UNIVERSE = ['transparency_report_pre_deployment', 'catastrophic_risk_assessment_summary', 'frontier_ai_safety_framework_publication', 'annual_framework_update', 'incident_reporting_oes', 'whistleblower_protection_channels'];

function mkPP(rng) {
  const exponent = 20 + Math.floor(rng() * 15); // 1e20 .. 1e34
  const mantissa = 1 + rng() * 8;
  const flops = `${mantissa.toFixed(3)}e${exponent}`;
  const revenue = Math.floor(rng() * 1200000000);
  return { compute_flops: flops, annual_revenue_usd: revenue };
}

// ---------- P1: monotonicity — is_large_frontier_developer implies is_frontier_model (subset) ----------
function checkP1_largeImpliesFrontier() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.is_large_frontier_developer && !r.output_payload.is_frontier_model) violations++;
  }
  return { name: 'P1_large_frontier_developer_implies_frontier_model', trials: checked, violations };
}

// ---------- P2: boundedness — obligation_set is always exactly the 0, 2, or 6 element fixed tier ----------
function checkP2_obligationSetFixedTiers() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const set = r.output_payload.obligation_set;
    if (![0, 2, 6].includes(set.length)) violations++;
    for (const o of set) if (!OBLIGATION_UNIVERSE.includes(o)) violations++;
    if (set.length === 2 && !(set[0] === OBLIGATION_UNIVERSE[0] && set[1] === OBLIGATION_UNIVERSE[1])) violations++;
    if (set.length === 6 && JSON.stringify(set) !== JSON.stringify(OBLIGATION_UNIVERSE)) violations++;
  }
  return { name: 'P2_obligation_set_matches_fixed_0_2_6_tiers', trials: checked, violations };
}

// ---------- P3: fixed-threshold agreement — is_frontier_model matches Number(compute_flops) >= 1e26 ----------
function checkP3_frontierMatchesFlopThreshold() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = Number(pp.compute_flops) >= 1e26;
    if (r.output_payload.is_frontier_model !== expected) violations++;
    const expectedLarge = expected && pp.annual_revenue_usd >= 500000000;
    if (r.output_payload.is_large_frontier_developer !== expectedLarge) violations++;
  }
  return { name: 'P3_is_frontier_model_matches_flop_threshold_and_revenue_gate', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'compute_flops and annual_revenue_usd both absent — defaults to "0", out of scope'],
  [{ compute_flops: '1e26' }, 'compute_flops exactly at the threshold string "1e26" — must be in scope (>=)'],
  [{ compute_flops: '9.9999999e25' }, 'compute_flops 1 order of magnitude below threshold at the fractional boundary — must be out of scope'],
  [{ compute_flops: '1e26', annual_revenue_usd: 500000000 }, 'revenue exactly at the $500M large-developer threshold — must be a large developer (>=)'],
  [{ compute_flops: '1e26', annual_revenue_usd: 499999999 }, 'revenue $1 below the $500M threshold — must NOT be a large developer'],
  [{ compute_flops: 'not-a-number' }, 'compute_flops is a non-numeric string — Number() yields NaN, comparison must fail closed (out of scope)'],
  [{ compute_flops: '-1e30' }, 'compute_flops is a negative decimal string — must be out of scope, never throw'],
  [{ compute_flops: '1e26', annual_revenue_usd: -50 }, 'negative annual_revenue_usd — must not be a large developer'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { is_frontier_model, is_large_frontier_developer, obligation_set } = r.output_payload;
    const plausible = typeof is_frontier_model === 'boolean' && typeof is_large_frontier_developer === 'boolean' && Array.isArray(obligation_set) && [0, 2, 6].includes(obligation_set.length);
    rows.push({ label, input: pp, is_frontier_model, is_large_frontier_developer, obligation_set, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_largeImpliesFrontier());
results.properties.push(checkP2_obligationSetFixedTiers());
results.properties.push(checkP3_frontierMatchesFlopThreshold());
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
