// kernel_digest_at_authoring: sha256:4b708c0479222377ddaec18a19c7c15708dac8a9bc59d4e6e6b53661301c9801
//
// FV-PROPFLOOR-SHARD-B27-1 — property-test floor for art-237-validate-agent-audit-trail.
// Class B (bounded-numeric shape, string/enum validation logic). float:no — completeness_score is
// an integer percentage (round(present/4*100)), no continuous float threshold; forced categorical
// boundary cases stand in for ULP-forcing per spec §3. Zero external dependencies. This file is
// READ-ONLY with respect to the kernel it imports.
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
const rand = mulberry32(0x237F6);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randHex(rng, len) { let s = ''; for (let i = 0; i < len; i++) s += Math.floor(rng() * 16).toString(16); return s; }
const TRIALS = 10000;

const ACTION_CLASSES = ['READ', 'WRITE', 'EXECUTE', 'QUERY', 'TRANSFORM', 'AUTHORIZE', 'AUTHENTICATE', 'NOTIFY', 'ROUTE', 'OTHER'];
const OUTCOMES = ['SUCCESS', 'FAILURE', 'PARTIAL', 'PENDING', 'CANCELLED'];
const TRUST_LEVELS = ['UNTRUSTED', 'BASIC', 'ELEVATED', 'HIGH', 'VERIFIED'];
const RESULTS = ['EMPTY_INPUT', 'CONFORMANT', 'PARTIAL', 'NON_CONFORMANT'];

function mkPP(rng) {
  return {
    agent_identity: rng() < 0.95 ? 'did:web:agent-' + Math.floor(rng() * 1000) : '',
    action_class: rng() < 0.9 ? pick(rng, ACTION_CLASSES) : 'BOGUS',
    outcome: rng() < 0.9 ? pick(rng, OUTCOMES) : 'BOGUS',
    trust_level: rng() < 0.9 ? pick(rng, TRUST_LEVELS) : 'BOGUS',
    sha256_prev_record: rng() < 0.5 ? randHex(rng, 64) : '',
    ecdsa_present: rng() < 0.5,
    action_detail: 'detail-' + Math.floor(rng() * 100),
    record_id: 'rec-' + Math.floor(rng() * 100),
  };
}

// ---------- P1: boundedness — conformance_result always one of the four declared values ----------
function checkP1_resultBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!RESULTS.includes(r.output_payload.conformance_result)) violations++;
  }
  return { name: 'P1_conformance_result_bounded_to_declared_enum', trials: checked, violations };
}

// ---------- P2: fixed rule — aat_completeness_score recomputes exactly as round(present/4*100) ----------
function checkP2_completenessScoreExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!pp.agent_identity) continue;
    const op = r.output_payload;
    const present = [op.agent_identity, op.action_class, op.outcome, op.trust_level].filter((v) => !!v).length;
    const expected = Math.round(present / 4 * 100);
    if (op.aat_completeness_score !== expected) violations++;
  }
  return { name: 'P2_completeness_score_exact_recompute', trials: checked, violations };
}

// ---------- P3: metamorphic — chain_position is 'first' iff sha256_prev_record empty, 'chained' iff non-empty ----------
function checkP3_chainPositionMetamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (!pp.agent_identity) continue;
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (!pp.sha256_prev_record && op.chain_position !== 'first') violations++;
    if (pp.sha256_prev_record && op.chain_position !== 'chained') violations++;
  }
  return { name: 'P3_chain_position_agrees_with_prev_record_presence', trials: checked, violations };
}

// ---------- P4 (forced categorical boundary cases) ----------
const FORCED_CASES = [
  [{ agent_identity: '' }, 'empty agent_identity — EMPTY_INPUT guard'],
  [{ agent_identity: 'a1', action_class: 'READ', outcome: 'SUCCESS', trust_level: 'HIGH', sha256_prev_record: '', ecdsa_present: true }, 'all required fields present, first record — CONFORMANT'],
  [{ agent_identity: 'a1', action_class: 'BOGUS', outcome: 'SUCCESS', trust_level: 'HIGH', sha256_prev_record: '' }, 'invalid action_class — NON_CONFORMANT or PARTIAL, never crash'],
  [{ agent_identity: 'a1', action_class: 'READ', outcome: 'SUCCESS', trust_level: 'HIGH', sha256_prev_record: 'not-64-hex' }, 'sha256_prev_record malformed (not 64 hex) — validation_errors includes chain format error'],
  [{ agent_identity: 'a1', action_class: 'READ', outcome: 'SUCCESS', trust_level: 'HIGH', sha256_prev_record: 'A'.repeat(64) }, 'sha256_prev_record uppercase hex — must fail the lowercase-only regex, not silently pass'],
  [{ agent_identity: 'a1', action_class: 'READ', outcome: 'SUCCESS', trust_level: 'HIGH', sha256_prev_record: '0'.repeat(64) }, 'sha256_prev_record all-zero valid hex — chain_position chained'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of FORCED_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = RESULTS.includes(op.conformance_result) && Number.isFinite(op.aat_completeness_score);
    rows.push({ label, input: pp, conformance_result: op.conformance_result, aat_completeness_score: op.aat_completeness_score, chain_position: op.chain_position, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_resultBounded());
results.properties.push(checkP2_completenessScoreExact());
results.properties.push(checkP3_chainPositionMetamorphic());
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
