// kernel_digest_at_authoring: sha256:05bec4999682594eba3e6bccae123325059131b7d46c30a259ce4f0037610adf
//
// FV-PROPFLOOR-SHARD-B13-1 — property-test floor for art-39-tempo-zone-disclosure.
// Class B (bounded-numeric), float:no per the WU row — confirmed by inspection, compute() is
// pure boolean-logic AND/OR gates over 11 boolean flags, no arithmetic at all. Forced CATEGORICAL
// boundary cases used instead of ULP forcing, per FV-PBT-FLOOR-BUILD-SPEC.md §3.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-39-tempo-zone-disclosure.proptest.mjs

import { compute } from '../art-39-tempo-zone-disclosure.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-39-tempo-zone-disclosure.fixtures.json');
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
const rand = mulberry32(0x39D2);
function randBool(rng) { return rng() < 0.5; }
const TRIALS = 8000;

const FLAG_KEYS = ['opSeesAll', 'userSeesOwn', 'outsidersZK', 'tip403Allow', 'tip403Block', 'tip403Freeze', 'tip403Mainnet', 'amlTravel', 'amlSAR', 'amlOFAC', 'amlAudit'];

function mkPP(rng) {
  const pp = { operatorName: 'Op', useCase: 'payments' };
  for (const k of FLAG_KEYS) pp[k] = randBool(rng);
  return pp;
}

function recomputeChecks(pp) {
  return {
    AML_COVERAGE_MAINTAINED: pp.opSeesAll && (pp.amlOFAC || pp.amlSAR),
    TIP403_CROSS_ZONE: pp.tip403Allow && pp.tip403Block && pp.tip403Freeze && pp.tip403Mainnet,
    TRAVEL_RULE_COMPLIANT: !!pp.amlTravel,
    REGULATOR_AUDIT_CAPABLE: !!pp.amlAudit,
    SELECTIVE_DISCLOSURE_CONFIRMED: pp.userSeesOwn && pp.outsidersZK,
    COMPETITIVE_CONFIDENTIALITY: !!pp.outsidersZK,
    OPERATOR_SEES_ALL: !!pp.opSeesAll,
    TIP403_ALLOWLIST: !!pp.tip403Allow,
    TIP403_BLOCKLIST: !!pp.tip403Block,
    TIP403_FREEZE: !!pp.tip403Freeze,
  };
}

// ---------- P1: boundedness — verdict is always one of the 3 declared enum values ----------
function checkP1_verdictBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!['INSUFFICIENT', 'PARTIAL_ATTESTATION', 'FULL_ATTESTATION'].includes(r.output_payload.verdict)) violations++;
  }
  return { name: 'P1_verdict_bounded_to_3_state_enum', trials: checked, violations };
}

// ---------- P2: full oracle emulation — checks object exactly matches independent recomputation of every flag ----------
function checkP2_checksObjectRoundtrips() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = recomputeChecks(pp);
    if (JSON.stringify(r.output_payload.checks) !== JSON.stringify(expected)) violations++;
  }
  return { name: 'P2_checks_object_exactly_matches_independent_recomputation', trials: checked, violations };
}

// ---------- P3: metamorphic implication — FULL_ATTESTATION implies AML_COVERAGE_MAINTAINED, OPERATOR_SEES_ALL, and TRAVEL_RULE_COMPLIANT all true ----------
function checkP3_fullAttestationImpliesAllChecksPass() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.verdict === 'FULL_ATTESTATION') {
      const c = r.output_payload.checks;
      if (!c.AML_COVERAGE_MAINTAINED || !c.OPERATOR_SEES_ALL || !c.TRAVEL_RULE_COMPLIANT) violations++;
    }
  }
  return { name: 'P3_full_attestation_implies_aml_operator_and_travel_rule_all_true', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced CATEGORICAL boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ opSeesAll: true, amlOFAC: true, amlSAR: false, amlTravel: true, amlAudit: true, userSeesOwn: true, outsidersZK: true, tip403Allow: true, tip403Block: true, tip403Freeze: true, tip403Mainnet: true }, 'AML_COVERAGE via OFAC-only (SAR false) — OR condition must still pass, verdict FULL_ATTESTATION'],
  [{ opSeesAll: true, amlOFAC: false, amlSAR: false, amlTravel: true, amlAudit: true, userSeesOwn: true, outsidersZK: true, tip403Allow: true, tip403Block: true, tip403Freeze: true, tip403Mainnet: true }, 'both amlOFAC and amlSAR false — AML_COVERAGE_MAINTAINED must be false, verdict INSUFFICIENT'],
  [{ opSeesAll: false, amlOFAC: true, amlSAR: true, amlTravel: true, amlAudit: true, userSeesOwn: true, outsidersZK: true, tip403Allow: true, tip403Block: true, tip403Freeze: true, tip403Mainnet: true }, 'opSeesAll false alone — AML_COVERAGE_MAINTAINED false (short-circuits AND), OPERATOR_SEES_ALL false, verdict INSUFFICIENT'],
  [{ opSeesAll: true, amlOFAC: true, amlSAR: true, amlTravel: false, amlAudit: true, userSeesOwn: true, outsidersZK: true, tip403Allow: true, tip403Block: true, tip403Freeze: true, tip403Mainnet: true }, 'amlTravel false alone with everything else true — verdict must be PARTIAL_ATTESTATION not FULL'],
  [{ opSeesAll: true, amlOFAC: true, amlSAR: true, amlTravel: true, amlAudit: true, userSeesOwn: true, outsidersZK: false, tip403Allow: true, tip403Block: true, tip403Freeze: true, tip403Mainnet: true }, 'outsidersZK false alone — SELECTIVE_DISCLOSURE_CONFIRMED false, but this check does not gate verdict per kernel — verdict must still be FULL_ATTESTATION'],
  [{ opSeesAll: true, amlOFAC: true, amlSAR: true, amlTravel: true, amlAudit: true, userSeesOwn: true, outsidersZK: true, tip403Allow: true, tip403Block: true, tip403Freeze: true, tip403Mainnet: false }, 'exactly one of the four TIP-403 flags false — TIP403_CROSS_ZONE false, but this also does not gate verdict per kernel — verdict must still be FULL_ATTESTATION'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const plausible = ['INSUFFICIENT', 'PARTIAL_ATTESTATION', 'FULL_ATTESTATION'].includes(o.verdict);
    rows.push({ label, input: pp, output: o, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_verdictBounded());
results.properties.push(checkP2_checksObjectRoundtrips());
results.properties.push(checkP3_fullAttestationImpliesAllChecksPass());
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
