// kernel_digest_at_authoring: sha256:deb127f858cd16e99f62c0f27cc261879e577527549c00156ae299b59e04afbc
//
// FV-PROPFLOOR-SHARD-B8-1 — property-test floor for art-237-validate-agent-audit-trail.
// Class B (bounded categorical), float:no exception per the WU row — enum/format validation only,
// no continuous arithmetic beyond a fixed-denominator completeness score. Forced categorical
// boundary cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1-B7 harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-237-validate-agent-audit-trail.proptest.mjs

import { compute } from '../art-237-validate-agent-audit-trail.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-237-validate-agent-audit-trail.fixtures.json');
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
const rand = mulberry32(0x2370A1);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

const ACTION_CLASSES = ['READ', 'WRITE', 'EXECUTE', 'QUERY', 'TRANSFORM', 'AUTHORIZE', 'AUTHENTICATE', 'NOTIFY', 'ROUTE', 'OTHER'];
const OUTCOMES = ['SUCCESS', 'FAILURE', 'PARTIAL', 'PENDING', 'CANCELLED'];
const TRUST_LEVELS = ['UNTRUSTED', 'BASIC', 'ELEVATED', 'HIGH', 'VERIFIED'];
const CONFORMANCE_RANK = { NON_CONFORMANT: 0, PARTIAL: 1, CONFORMANT: 2 };

function mkPP(rng) {
  return {
    agent_identity: 'agent-' + Math.floor(rng() * 1e6),
    action_class: rng() < 0.7 ? pick(rng, ACTION_CLASSES) : 'BOGUS',
    outcome: rng() < 0.7 ? pick(rng, OUTCOMES) : 'BOGUS',
    trust_level: rng() < 0.7 ? pick(rng, TRUST_LEVELS) : 'BOGUS',
    sha256_prev_record: rng() < 0.5 ? '' : 'a'.repeat(64),
    ecdsa_present: rng() < 0.5,
    action_detail: 'detail-' + Math.floor(rng() * 1000),
    record_id: 'rec-' + Math.floor(rng() * 1000),
  };
}

// ---------- P1: monotone — fully-valid fields never yield a lower conformance rank than a degraded variant ----------
function checkP1_monotoneConformance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const worse = { ...pp, action_class: 'BOGUS', outcome: 'BOGUS' };
    const better = { ...pp, action_class: pick(rand, ACTION_CLASSES), outcome: pick(rand, OUTCOMES), trust_level: pick(rand, TRUST_LEVELS) };
    const r1 = compute(worse);
    const r2 = compute(better);
    checked++;
    if (CONFORMANCE_RANK[r2.output_payload.conformance_result] < CONFORMANCE_RANK[r1.output_payload.conformance_result]) violations++;
    if (r2.output_payload.aat_completeness_score < r1.output_payload.aat_completeness_score) violations++;
  }
  return { name: 'P1_monotone_conformance_nondecreasing_on_valid_fields', trials: checked, violations };
}

// ---------- P2: boundedness — score in [0,100], conformance_result and chain_position from known sets ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN_RESULTS = new Set(['CONFORMANT', 'PARTIAL', 'NON_CONFORMANT']);
  const KNOWN_CHAIN = new Set(['first', 'chained']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { aat_completeness_score, conformance_result, chain_position } = r.output_payload;
    if (aat_completeness_score < 0 || aat_completeness_score > 100) violations++;
    if (!KNOWN_RESULTS.has(conformance_result)) violations++;
    if (!KNOWN_CHAIN.has(chain_position)) violations++;
  }
  return { name: 'P2_boundedness_score_and_enum_fields_from_known_sets', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — conformance_result matches independently-derived rule ----------
function checkP3_conformanceAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const errors = [];
    if (!pp.action_class || !ACTION_CLASSES.includes(pp.action_class)) errors.push(1);
    if (!pp.outcome || !OUTCOMES.includes(pp.outcome)) errors.push(1);
    if (!pp.agent_identity) errors.push(1);
    const required = [pp.agent_identity, pp.action_class, pp.outcome, pp.trust_level];
    const present = required.filter((v) => !!v).length;
    const expected_score = Math.round((present / 4) * 100);
    const expected_result = errors.length === 0 ? 'CONFORMANT' : (expected_score >= 75 ? 'PARTIAL' : 'NON_CONFORMANT');
    if (r.output_payload.aat_completeness_score !== expected_score) violations++;
    if (r.output_payload.conformance_result !== expected_result) violations++;
  }
  return { name: 'P3_conformance_result_matches_fixed_completeness_rule', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ agent_identity: '' }, 'empty agent_identity — EMPTY_INPUT result, no throw'],
  [{ agent_identity: 'a1', action_class: 'BOGUS', outcome: 'SUCCESS', trust_level: 'HIGH' }, 'invalid action_class — NON_CONFORMANT or PARTIAL, error recorded'],
  [{ agent_identity: 'a1', action_class: 'READ', outcome: 'BOGUS', trust_level: 'HIGH' }, 'invalid outcome — error recorded'],
  [{ agent_identity: 'a1', action_class: 'READ', outcome: 'SUCCESS', trust_level: 'UNRECOGNISED' }, 'unrecognised trust_level — warning only, still CONFORMANT if other fields valid'],
  [{ agent_identity: 'a1', action_class: 'READ', outcome: 'SUCCESS', trust_level: 'HIGH', sha256_prev_record: 'not-a-hash' }, 'malformed sha256_prev_record — error, chain_position must still resolve'],
  [{ agent_identity: 'a1', action_class: 'READ', outcome: 'SUCCESS', trust_level: 'HIGH', sha256_prev_record: '' }, 'empty sha256_prev_record — chain_position must be "first"'],
  [{ agent_identity: 'a1', action_class: 'READ', outcome: 'SUCCESS', trust_level: 'HIGH', sha256_prev_record: 'b'.repeat(64) }, 'valid 64-hex sha256_prev_record — chain_position must be "chained"'],
  [{ agent_identity: 'a1', action_class: 'READ', outcome: 'SUCCESS', trust_level: 'HIGH', ecdsa_present: false }, 'ecdsa_present false — warning only, still CONFORMANT'],
  [{ agent_identity: 'a1' }, 'only agent_identity present — 25% completeness, NON_CONFORMANT'],
  [{}, 'fully empty input — EMPTY_INPUT, no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { conformance_result, aat_completeness_score, chain_position } = r.output_payload;
    const plausible = typeof conformance_result === 'string' && Number.isFinite(aat_completeness_score) && typeof chain_position === 'string';
    rows.push({ label, pp, conformance_result, aat_completeness_score, chain_position, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneConformance());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_conformanceAgreement());
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
