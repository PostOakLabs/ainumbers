// art-297-agentic-dispute-ce30-linter.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C10-1).
// kernel_digest_at_authoring: sha256:d3eda08f22ed67d0de0b0d7d5ca2877c9954ecff416aae4cf51d9906260ae374
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (digest/transaction_ref string equality and count thresholds, no
// arithmetic — confirmed by direct read).
// Checks: fixture-oracle gate, termination/boundedness (per_element.length fixed at 3,
// missing_elements a subset of the 4 declared element names), differential re-derivation of
// agent_identity via combine() and of ce30_readiness from per_element + prior-txn test, and a
// monotonicity metamorphic check: appending more matching prior_transactions entries can only
// move ce30_prior_txn_test from 'fail' toward 'pass', never the reverse.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-297-agentic-dispute-ce30-linter.proptest.mjs

import { compute } from '../art-297-agentic-dispute-ce30-linter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-297-agentic-dispute-ce30-linter.fixtures.json');
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
const rand = mulberry32(0x297A0);
const TXN_REF = 'txn-001';

function randomElement(rng, matchRef) {
  const r = rng();
  if (r < 0.3) return null; // missing
  const digest = r < 0.65 ? 'sha256:' + 'a'.repeat(64) : undefined; // undefined -> missing per evalElement
  return { digest, bound_transaction_ref: matchRef ? TXN_REF : 'other-txn' };
}
function randomEvidence(rng) {
  return {
    ap2_mandate: randomElement(rng, rng() < 0.6),
    tap_signature: randomElement(rng, rng() < 0.6),
    agentic_token: randomElement(rng, rng() < 0.6),
    delivery_proof: randomElement(rng, rng() < 0.6),
    prior_transactions: rng() < 0.5 ? randomPriorTxns(rng) : undefined,
  };
}
function randomPriorTxn(rng, forceMatch) {
  const n = forceMatch ? 2 + Math.floor(rng() * 2) : Math.floor(rng() * 2);
  return { matched_data_elements: Array.from({ length: n }, (_, i) => 'field' + i) };
}
function randomPriorTxns(rng) {
  const n = Math.floor(rng() * 5);
  return Array.from({ length: n }, () => randomPriorTxn(rng, rng() < 0.4));
}

function evalElement(obj, transaction_ref) {
  if (!obj || typeof obj !== 'object') return 'missing';
  const digest = typeof obj.digest === 'string' && obj.digest.length > 0 ? obj.digest : null;
  if (!digest) return 'missing';
  const bound = typeof obj.bound_transaction_ref === 'string' ? obj.bound_transaction_ref : null;
  return bound === transaction_ref ? 'present' : 'unbound';
}
function combine(a, b) {
  if (a === 'present' && b === 'present') return 'present';
  if (a === 'missing' && b === 'missing') return 'missing';
  return 'unbound';
}

const TRIALS = 5000;

// ---------- P1: termination/boundedness — per_element.length fixed at 3, missing_elements subset ----------
function checkP1_bounded() {
  let violations = 0, checked = 0;
  const ALLOWED = new Set(['authorization_at_delegation', 'agent_identity', 'fulfillment', 'prior_transaction_test']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = { dispute: { network: 'visa', reason_code: '10.4', transaction_ref: TXN_REF }, evidence: randomEvidence(rand) };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.per_element.length !== 3) violations++;
    for (const m of output_payload.missing_elements) if (!ALLOWED.has(m)) violations++;
  }
  return { name: 'P1_per_element_fixed_and_missing_elements_bounded', trials: checked, violations };
}

// ---------- P2 (differential): agent_identity + ce30_readiness re-derived independently ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const evidence = randomEvidence(rand);
    const pp = { dispute: { network: 'visa', reason_code: '10.4', transaction_ref: TXN_REF }, evidence };
    const { output_payload } = compute(pp);
    checked++;
    const expectedAgentIdentity = combine(evalElement(evidence.tap_signature, TXN_REF), evalElement(evidence.agentic_token, TXN_REF));
    const agentEl = output_payload.per_element.find((e) => e.element === 'agent_identity');
    if (agentEl.status !== expectedAgentIdentity) violations++;

    const allPresent = output_payload.per_element.every((e) => e.status === 'present');
    const expectedReadiness = allPresent && output_payload.ce30_prior_txn_test !== 'fail' ? 'ready' : 'gaps';
    if (output_payload.ce30_readiness !== expectedReadiness) violations++;
  }
  return { name: 'P2_agent_identity_and_readiness_differential', trials: checked, violations };
}

// ---------- P3: boundedness — insufficient_evidence iff all 3 elements are missing ----------
function checkP3_insufficient_evidence_correct() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const evidence = randomEvidence(rand);
    const pp = { dispute: { network: 'visa', reason_code: '10.4', transaction_ref: TXN_REF }, evidence };
    const { output_payload } = compute(pp);
    checked++;
    const expected = output_payload.per_element.every((e) => e.status === 'missing');
    if (output_payload.insufficient_evidence !== expected) violations++;
  }
  return { name: 'P3_insufficient_evidence_iff_all_missing', trials: checked, violations };
}

// ---------- P4: metamorphic — appending matching prior_transactions is monotone toward 'pass' ----------
function checkP4_prior_txn_monotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const evidence = randomEvidence(rand);
    const base = randomPriorTxns(rand);
    const extraMatching = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => randomPriorTxn(rand, true));
    const pp1 = { dispute: { network: 'visa', reason_code: '10.4', transaction_ref: TXN_REF }, evidence: { ...evidence, prior_transactions: base } };
    const pp2 = { dispute: { network: 'visa', reason_code: '10.4', transaction_ref: TXN_REF }, evidence: { ...evidence, prior_transactions: base.concat(extraMatching) } };
    const r1 = compute(pp1).output_payload;
    const r2 = compute(pp2).output_payload;
    checked++;
    // rank: not_applicable(n/a, only when array empty) < fail < pass — appending more matching
    // entries can only move the same-or-later array from fail to pass, never pass to fail.
    if (r1.ce30_prior_txn_test === 'pass' && r2.ce30_prior_txn_test !== 'pass') violations++;
  }
  return { name: 'P4_prior_txn_test_monotone_toward_pass_on_append', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_bounded());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_insufficient_evidence_correct());
results.properties.push(checkP4_prior_txn_monotone());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-297-agentic-dispute-ce30-linter',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
