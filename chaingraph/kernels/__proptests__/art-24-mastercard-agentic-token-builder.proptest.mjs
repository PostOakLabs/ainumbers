// art-24-mastercard-agentic-token-builder.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C7-1).
// kernel_digest_at_authoring: sha256:c3fc5f06ba67952f984a4b92f4a19b72dc85afedb761aaa7dace3b61ae13cc1e
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — pure field-presence linting; the only math is
// integer weight arithmetic in the score formula).
// Checks: fixture-oracle gate, termination (findings length bounded by the fixed field list),
// boundedness (score in [0,100]), a differential re-derivation of score/verdict from
// errors/warnings counts, a metamorphic field-alias-invariance check (agentId/agent_id/agent
// all resolve identically via `first()`), and forced categorical boundary cases for every
// lint branch (no agent binding, unrestricted merchant scope, no spend limit, no expiry).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-24-mastercard-agentic-token-builder.proptest.mjs

import { compute } from '../art-24-mastercard-agentic-token-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-24-mastercard-agentic-token-builder.fixtures.json');
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
const rand = mulberry32(0x24A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomScope(rng) {
  const scope = {};
  if (rng() < 0.8) scope[pick(rng, ['agentId', 'agent_id', 'agent'])] = `agent:${Math.floor(rng() * 1000)}`;
  if (rng() < 0.8) scope[pick(rng, ['merchantScope', 'merchants', 'allowed_merchants'])] = rng() < 0.2 ? 'any' : [`m-${Math.floor(rng() * 10)}`];
  const policy = {};
  if (rng() < 0.7) policy[pick(rng, ['perTransactionLimit', 'txnLimit'])] = 1 + Math.floor(rng() * 1000);
  if (rng() < 0.5) policy[pick(rng, ['totalLimit', 'periodLimit'])] = 1 + Math.floor(rng() * 10000);
  if (rng() < 0.7) policy[pick(rng, ['expiresAt', 'expiry'])] = 1780000000 + Math.floor(rng() * 1e7);
  if (rng() < 0.4) policy.velocity = Math.floor(rng() * 10);
  scope.consentPolicy = policy;
  return scope;
}

const TRIALS = 5000;

// ---------- P1: termination — findings length bounded ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { output_payload: o } = compute({ token_scope: randomScope(rand) });
    checked++;
    if (o.findings.length < 5 || o.findings.length > 8) violations++;
  }
  return { name: 'P1_termination_findings_bounded', trials: checked, violations };
}

// ---------- P2: boundedness — score always in [0,100] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { output_payload: o } = compute({ token_scope: randomScope(rand) });
    checked++;
    if (o.score < 0 || o.score > 100) violations++;
  }
  return { name: 'P2_score_bounded_0_to_100', trials: checked, violations };
}

// ---------- P3 (differential): score/verdict re-derived from errors/warnings counts ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { output_payload: o } = compute({ token_scope: randomScope(rand) });
    checked++;
    const refScore = Math.max(0, Math.min(100, 100 - o.errors * 15 - o.warnings * 4));
    const refVerdict = o.errors > 0 ? 'unsafe' : o.warnings > 0 ? 'advisory' : 'safe';
    if (o.score !== refScore) violations++;
    if (o.verdict !== refVerdict) violations++;
  }
  return { name: 'P3_differential_score_verdict_from_counts', trials: checked, violations };
}

// ---------- P4 (metamorphic): field-alias invariance — agentId/agent_id/agent equivalent ----------
function checkP4_aliasInvariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const id = `agent:${Math.floor(rand() * 1000)}`;
    const base = { merchantScope: ['m-1'], consentPolicy: { perTransactionLimit: 100 } };
    const a = compute({ token_scope: { ...base, agentId: id } }).output_payload;
    const b = compute({ token_scope: { ...base, agent_id: id } }).output_payload;
    const c = compute({ token_scope: { ...base, agent: id } }).output_payload;
    checked++;
    if (a.score !== b.score || b.score !== c.score) violations++;
    if (a.verdict !== b.verdict || b.verdict !== c.verdict) violations++;
  }
  return { name: 'P4_field_alias_invariance_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_categoricalBoundaries() {
  let violations = 0, checked = 0;
  const cases = [
    { token_scope: {} }, // no agent binding, no merchant scope, no limit -> multiple errors
    { token_scope: { agentId: 'a1', merchantScope: 'any', consentPolicy: { perTransactionLimit: 10 } } }, // unrestricted merchant scope
    { token_scope: { agentId: 'a1', merchantScope: ['m1'] } }, // no spend limit
    { token_scope: { agentId: 'a1', merchantScope: ['m1'], consentPolicy: { perTransactionLimit: 10 } } }, // no expiry
    { token_scope: { agentId: 'a1', merchantScope: ['m1'], consentPolicy: { perTransactionLimit: 10, expiresAt: 1e9, velocity: 5 } } }, // fully safe
    { token_scope: null }, // not an object
  ];
  for (const c of cases) {
    checked++;
    const { output_payload: o } = compute(c);
    if (o.score < 0 || o.score > 100) violations++;
    if (!['safe', 'advisory', 'unsafe'].includes(o.verdict)) violations++;
  }
  const noBinding = compute(cases[0]).output_payload;
  if (noBinding.verdict !== 'unsafe') violations++;
  const fullySafe = compute(cases[4]).output_payload;
  if (fullySafe.verdict !== 'safe') violations++;
  return { name: 'P5_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_aliasInvariance());
results.properties.push(checkP5_categoricalBoundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-24-mastercard-agentic-token-builder',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
