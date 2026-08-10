// kernel_digest_at_authoring: sha256:8bc32901d512c613154fd05bc8dba90a59d45911b83c8c2b2174ad8fddce59cb
//
// FV-PROPFLOOR-SHARD-B27-1 — property-test floor for art-238-classify-annex3-decisioning-obligations.
// Class B (bounded-numeric shape, boolean obligation-status logic). float:no — pure boolean gates
// and a fixed obligations list, no float arithmetic; forced categorical boundary cases stand in for
// ULP-forcing per spec §3. Zero external dependencies. This file is READ-ONLY with respect to the
// kernel it imports.
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
const rand = mulberry32(0x238A7);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

const CATEGORIES = ['5b_creditworthiness', '5c_life_health_insurance_pricing', 'other', 'unknown'];
const DEPLOYER_ROLES = ['provider', 'deployer', 'both', 'unknown', ''];
const SCOPE_VERDICTS = ['OUT_OF_SCOPE', 'ANNEX3_5B_CREDITWORTHINESS', 'ANNEX3_5C_LIFE_HEALTH_INSURANCE', 'ANNEX3_HIGH_RISK_OTHER_FS'];

function mkPP(rng) {
  return {
    is_high_risk: rng() < 0.8,
    annex3_category: pick(rng, CATEGORIES),
    deployer_role: pick(rng, DEPLOYER_ROLES),
    has_human_oversight: rng() < 0.5,
    fria_completed: rng() < 0.5,
    db_registered: rng() < 0.5,
    logging_implemented: rng() < 0.5,
  };
}

// ---------- P1: boundedness — scope_verdict always one of the four declared values; is_high_risk false forces OUT_OF_SCOPE ----------
function checkP1_scopeVerdictBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (!SCOPE_VERDICTS.includes(op.scope_verdict)) violations++;
    if (!pp.is_high_risk && op.scope_verdict !== 'OUT_OF_SCOPE') violations++;
  }
  return { name: 'P1_scope_verdict_bounded_out_of_scope_when_not_high_risk', trials: checked, violations };
}

// ---------- P2: monotonicity — flipping any single implemented-obligation flag from false to true never INCREASES compliance_gaps ----------
function checkP2_implementingFlagNeverIncreasesGaps() {
  let violations = 0, checked = 0;
  const flags = ['has_human_oversight', 'fria_completed', 'db_registered', 'logging_implemented'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (!pp.is_high_risk) continue;
    const flag = pick(rand, flags);
    const before = compute({ ...pp, [flag]: false });
    const after = compute({ ...pp, [flag]: true });
    checked++;
    if (after.output_payload.compliance_gaps.length > before.output_payload.compliance_gaps.length) violations++;
  }
  return { name: 'P2_implementing_a_flag_never_increases_compliance_gaps', trials: checked, violations };
}

// ---------- P3: fixed rule — all_obligations_met === (compliance_gaps.length === 0) ----------
function checkP3_allMetAgreesWithGaps() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!pp.is_high_risk) continue;
    const op = r.output_payload;
    if (op.all_obligations_met !== (op.compliance_gaps.length === 0)) violations++;
    if (op.enforcement_readiness !== (op.all_obligations_met ? 'READY' : 'NOT_READY')) violations++;
  }
  return { name: 'P3_all_obligations_met_agrees_with_gaps_and_readiness', trials: checked, violations };
}

// ---------- P4 (forced categorical boundary cases) ----------
const FORCED_CASES = [
  [{ is_high_risk: false }, 'not high-risk — OUT_OF_SCOPE, no obligations'],
  [{ is_high_risk: true, annex3_category: '5b_creditworthiness', deployer_role: 'provider', has_human_oversight: true, fria_completed: true, db_registered: true, logging_implemented: true }, 'provider role — Art 26(6) deployer duties do NOT apply, only 2 obligations (Art12+Art27)'],
  [{ is_high_risk: true, annex3_category: '5b_creditworthiness', deployer_role: 'deployer', has_human_oversight: true, fria_completed: true, db_registered: true, logging_implemented: true }, 'all obligations implemented, deployer role — READY, zero gaps'],
  [{ is_high_risk: true, annex3_category: '5b_creditworthiness', deployer_role: 'deployer', has_human_oversight: false, fria_completed: false, db_registered: false, logging_implemented: false }, 'nothing implemented, deployer role — NOT_READY, 4 gaps (logging+fria+oversight+db)'],
  [{ is_high_risk: true, annex3_category: 'unknown', deployer_role: 'unknown', has_human_oversight: false, fria_completed: false, db_registered: false, logging_implemented: false }, 'unknown category — scope_verdict falls back to ANNEX3_HIGH_RISK_OTHER_FS'],
  [{ is_high_risk: true, annex3_category: '5c_life_health_insurance_pricing', deployer_role: 'both', has_human_oversight: true, fria_completed: true, db_registered: true, logging_implemented: true }, '5c insurance pricing, both role — ANNEX3_5C_LIFE_HEALTH_INSURANCE, all met'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of FORCED_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = SCOPE_VERDICTS.includes(op.scope_verdict) && Array.isArray(op.compliance_gaps) &&
      (op.scope_verdict === 'OUT_OF_SCOPE' ? op.all_obligations_met === undefined : typeof op.all_obligations_met === 'boolean');
    rows.push({ label, input: pp, scope_verdict: op.scope_verdict, compliance_gaps: op.compliance_gaps, all_obligations_met: op.all_obligations_met, obligations_count: op.obligations ? op.obligations.length : 0, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scopeVerdictBounded());
results.properties.push(checkP2_implementingFlagNeverIncreasesGaps());
results.properties.push(checkP3_allMetAgreesWithGaps());
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
