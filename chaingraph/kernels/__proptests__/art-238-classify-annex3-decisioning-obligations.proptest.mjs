// kernel_digest_at_authoring: sha256:82eac4d808656a6c43988775fab04d8f5366bddd4446beb2d596f974b6d77373
//
// FV-PROPFLOOR-SHARD-B8-1 — property-test floor for art-238-classify-annex3-decisioning-obligations.
// Class B (bounded categorical), float:no exception per the WU row — boolean gates and enum
// classification only, no continuous arithmetic. Forced categorical boundary cases used in place
// of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1-B7 harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-238-classify-annex3-decisioning-obligations.proptest.mjs

import { compute } from '../art-238-classify-annex3-decisioning-obligations.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-238-classify-annex3-decisioning-obligations.fixtures.json');
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
const rand = mulberry32(0x2380A1);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;
const CATEGORIES = ['5b_creditworthiness', '5c_life_health_insurance_pricing', 'other', 'unknown'];
const ROLES = ['provider', 'deployer', 'both', 'unknown', ''];

function mkPP(rng) {
  return {
    is_high_risk: rng() < 0.7,
    annex3_category: pick(rng, CATEGORIES),
    deployer_role: pick(rng, ROLES),
    has_human_oversight: rng() < 0.5,
    fria_completed: rng() < 0.5,
    db_registered: rng() < 0.5,
    logging_implemented: rng() < 0.5,
  };
}

// ---------- P1: monotone — implementing all obligations never increases compliance_gaps ----------
function checkP1_monotoneGaps() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (!pp.is_high_risk) { checked++; continue; }
    const worse = { ...pp, has_human_oversight: false, fria_completed: false, db_registered: false, logging_implemented: false };
    const better = { ...pp, has_human_oversight: true, fria_completed: true, db_registered: true, logging_implemented: true };
    const r1 = compute(worse);
    const r2 = compute(better);
    checked++;
    if (r2.output_payload.compliance_gaps.length > r1.output_payload.compliance_gaps.length) violations++;
    if (r1.output_payload.compliance_gaps.length === 0 && r2.output_payload.all_obligations_met !== true) violations++;
    if (r2.output_payload.all_obligations_met !== true) violations++;
  }
  return { name: 'P1_monotone_gaps_nonincreasing_toward_full_implementation', trials: checked, violations };
}

// ---------- P2: boundedness — obligations/scope_verdict from known sets, gap count bounded ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN_SCOPE = new Set(['OUT_OF_SCOPE', 'ANNEX3_5B_CREDITWORTHINESS', 'ANNEX3_5C_LIFE_HEALTH_INSURANCE', 'ANNEX3_HIGH_RISK_OTHER_FS']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { scope_verdict, obligations, compliance_gaps } = r.output_payload;
    if (!KNOWN_SCOPE.has(scope_verdict)) violations++;
    if (obligations.length > 3) violations++;
    if (compliance_gaps.length > 4) violations++;
  }
  return { name: 'P2_boundedness_scope_and_gap_count_from_known_sets', trials: checked, violations };
}

// ---------- P3: fixed rule agreement — art26_apply and obligation count match independent rule ----------
function checkP3_art26Agreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!pp.is_high_risk) {
      if (r.output_payload.scope_verdict !== 'OUT_OF_SCOPE') violations++;
      continue;
    }
    const expected_art26 = pp.deployer_role === 'deployer' || pp.deployer_role === 'both' || !pp.deployer_role || pp.deployer_role === 'unknown';
    if (r.output_payload.art26_deployer_duties_apply !== expected_art26) violations++;
    const expected_obligation_count = expected_art26 ? 3 : 2;
    if (r.output_payload.obligations.length !== expected_obligation_count) violations++;
  }
  return { name: 'P3_art26_applicability_and_obligation_count_match_fixed_rule', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ is_high_risk: false }, 'not high-risk — OUT_OF_SCOPE, no obligations, no throw'],
  [{ is_high_risk: true, annex3_category: '5b_creditworthiness', deployer_role: 'provider' }, 'provider-only role — art26 duties must NOT apply'],
  [{ is_high_risk: true, annex3_category: '5b_creditworthiness', deployer_role: 'deployer' }, 'deployer role — art26 duties must apply'],
  [{ is_high_risk: true, annex3_category: '5b_creditworthiness', deployer_role: '' }, 'empty deployer_role — treated as deployer-applicable per fixed rule'],
  [{ is_high_risk: true, annex3_category: '5c_life_health_insurance_pricing', deployer_role: 'both' }, '5c category with both role — scope_verdict must be ANNEX3_5C_LIFE_HEALTH_INSURANCE'],
  [{ is_high_risk: true, annex3_category: 'unknown', deployer_role: 'unknown' }, 'unrecognised category — scope_verdict ANNEX3_HIGH_RISK_OTHER_FS'],
  [{ is_high_risk: true, annex3_category: '5b_creditworthiness', deployer_role: 'deployer', fria_completed: true, has_human_oversight: true, logging_implemented: true, db_registered: true }, 'all obligations implemented — compliance_gaps empty, all_obligations_met true'],
  [{ is_high_risk: true, annex3_category: '5b_creditworthiness', deployer_role: 'deployer', fria_completed: false, has_human_oversight: false, logging_implemented: false, db_registered: false }, 'nothing implemented — all 4 gap types present'],
  [{}, 'fully empty input — defaults to not-high-risk, OUT_OF_SCOPE, no throw'],
  [{ is_high_risk: true }, 'high-risk with no other fields — category defaults unknown, all obligations REQUIRED'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { scope_verdict, obligations, all_obligations_met } = r.output_payload;
    const plausible = typeof scope_verdict === 'string' && Array.isArray(obligations) &&
      (scope_verdict === 'OUT_OF_SCOPE' ? all_obligations_met === undefined : typeof all_obligations_met === 'boolean');
    rows.push({ label, pp, scope_verdict, obligations_count: obligations.length, all_obligations_met, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneGaps());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_art26Agreement());
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
