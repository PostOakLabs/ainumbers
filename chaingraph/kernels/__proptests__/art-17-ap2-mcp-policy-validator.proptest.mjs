// art-17-ap2-mcp-policy-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C5-1).
// kernel_digest_at_authoring: sha256:c8bd009b480838215fafa652ee90ae0e5439c003a08ca20fc0d5c97819232151
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (WU row classification confirmed by direct read). `compliance_score` is
// accumulated from fractional weights (55/9, 15/3, min(5, n*1.5)) but the kernel's own
// Math.max(0, Math.min(100, Math.round(points))) collapses every accumulation path to an integer
// BEFORE the only comparison that matters (score >= 80). Because the compared quantity is always
// an already-rounded integer, this is a categorical integer-threshold boundary, not a raw ULP
// comparison — categorical forcing (score exactly 79 vs 80) is the correct floor treatment here,
// not ULP perturbation of an intermediate float that never reaches a comparison unrounded.
// Checks: fixture-oracle gate, termination (field_results bounded by fixed schema field counts,
// never data-dependent-unbounded), boundedness (compliance_score in [0,100]), differential
// re-derivation of agent_deployment_recommended, metamorphic (adding an extra unknown key to the
// payload never changes compliance_score — the validator only inspects named schema fields), and
// forced categorical boundary cases around the score=80 deployment-recommendation threshold.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-17-ap2-mcp-policy-validator.proptest.mjs

import { compute } from '../art-17-ap2-mcp-policy-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-17-ap2-mcp-policy-validator.fixtures.json');
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
const rand = mulberry32(0x17A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const REQUIRED = ['ap2_version', 'mandate_id', 'issued_at', 'issued_by', 'tool_id', 'tool_version', 'mandate_type', 'jurisdiction', 'payload', 'audit_metadata'];
const MANDATE_TYPES = ['payment_policy', 'aml_rule', 'kyc_requirement', 'routing_policy'];

function fullPayload(rng) {
  const includeAll = rng() < 0.6;
  const obj = {};
  for (const f of REQUIRED) {
    if (includeAll || rng() < 0.85) {
      if (f === 'ap2_version') obj[f] = '1.0';
      else if (f === 'mandate_type') obj[f] = pick(rng, MANDATE_TYPES);
      else if (f === 'jurisdiction') obj[f] = ['US'];
      else if (f === 'payload' || f === 'audit_metadata') obj[f] = f === 'audit_metadata'
        ? { client_side_executed: true, zero_pii_verified: true, deterministic_run: true }
        : { k: 1 };
      else if (f === 'issued_at') obj[f] = '2026-01-01T00:00:00Z';
      else obj[f] = 'v' + Math.floor(rng() * 1000);
    }
  }
  return obj;
}

const TRIALS = 5000;

// ---------- P1: termination — field_results bounded by fixed schema shape ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const payload = fullPayload(rand);
    const { output_payload } = compute({ payload });
    checked++;
    if (output_payload.field_results.length < REQUIRED.length) violations++;
    if (output_payload.field_results.length > REQUIRED.length + 20) violations++; // fixed-size schema, generous cap
  }
  return { name: 'P1_termination_bounded_by_schema_shape', trials: checked, violations };
}

// ---------- P2 (differential): agent_deployment_recommended iff score >= 80; score in [0,100] ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const payload = fullPayload(rand);
    const { output_payload } = compute({ payload });
    checked++;
    if (output_payload.compliance_score < 0 || output_payload.compliance_score > 100) violations++;
    if (!Number.isInteger(output_payload.compliance_score)) violations++;
    if ((output_payload.compliance_score >= 80) !== output_payload.agent_deployment_recommended) violations++;
  }
  return { name: 'P2_score_bounded_and_recommendation_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — an extra unknown key in the payload never changes compliance_score ----------
function checkP3_metamorphic_extra_key_invariant() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const payload = fullPayload(rand);
    const withExtra = { ...payload, __unknown_extra_key_xyz: 'noise-' + rand() };
    const r1 = compute({ payload }).output_payload;
    const r2 = compute({ payload: withExtra }).output_payload;
    checked++;
    if (r1.compliance_score !== r2.compliance_score) violations++;
    if (r1.agent_deployment_recommended !== r2.agent_deployment_recommended) violations++;
  }
  return { name: 'P3_metamorphic_unknown_key_invariant', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no -> categorical rounded-score threshold) ----------
const fullValidPayload = () => ({
  ap2_version: '1.0', mandate_id: 'm1', issued_at: '2026-01-01T00:00:00Z', issued_by: 'x',
  tool_id: 'art-17-ap2-mcp-policy-validator', tool_version: '1.0.0', mandate_type: 'payment_policy',
  jurisdiction: ['US'], payload: { k: 1 },
  audit_metadata: { client_side_executed: true, zero_pii_verified: true, deterministic_run: true },
});
const BOUNDARY_CASES = [
  { label: 'all required + mandate_type + audit_metadata booleans -> score >= 80, deployment recommended', payload: fullValidPayload() },
  { label: 'missing audit_metadata entirely -> score drops below 80', payload: (() => { const p = fullValidPayload(); delete p.audit_metadata; return p; })() },
  { label: 'ap2_version "1.0.0" (deprecated form) -> version FAIL, score penalized', payload: (() => { const p = fullValidPayload(); p.ap2_version = '1.0.0'; return p; })() },
  { label: 'empty payload object -> score 0 (or near 0), not deployment recommended', payload: {} },
];
function checkP4_forced() {
  return BOUNDARY_CASES.map((c) => {
    const { output_payload } = compute({ payload: c.payload });
    return { label: c.label, compliance_score: output_payload.compliance_score, agent_deployment_recommended: output_payload.agent_deployment_recommended };
  });
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_metamorphic_extra_key_invariant());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const fullPayloadRecommended = results.boundary_forced[0].agent_deployment_recommended === true;
const missingAuditNotRecommended = results.boundary_forced[1].compliance_score < 80;
const deprecatedVersionPenalized = results.boundary_forced[2].compliance_score < results.boundary_forced[0].compliance_score;
const emptyPayloadNotRecommended = results.boundary_forced[3].agent_deployment_recommended === false;
const anyBoundaryMismatch = !(fullPayloadRecommended && missingAuditNotRecommended && deprecatedVersionPenalized && emptyPayloadNotRecommended);

console.log(JSON.stringify({
  tool_id: 'art-17-ap2-mcp-policy-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
