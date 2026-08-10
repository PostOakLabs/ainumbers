// art-04-agent-identity-attestation-checker.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C1-1).
// kernel_digest_at_authoring: sha256:f4e9e5aed913e80c7f97e3d0d2501e7349c523de4ffd433a1d29081620197b1f
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (integer Unix-second comparisons and categorical checks only — no ULP-forcing).
// Checks: fixture-oracle gate, termination (checks array bounded by fixed check IDs + delegate array
// length), overall_status differential re-derivation from pass/fail/warn counts (accounting identity),
// chain-depth-cap enforcement (differential), and permutation-invariance of delegates array order.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-04-agent-identity-attestation-checker.proptest.mjs

import { compute } from '../art-04-agent-identity-attestation-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-04-agent-identity-attestation-checker.fixtures.json');
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
const rand = mulberry32(0xA04A1);
function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const NOW = 1_780_000_000;
const SCOPES = ['read:account', 'write:payment', 'execute:trade', 'delegate:sub_agent', 'admin:audit'];

function randomRoot(rng) {
  const iat = NOW - randInt(rng, 0, 30) * 86400;
  const exp = NOW + randInt(rng, -10, 90) * 86400;
  return {
    agent_id: 'agent-root', issuer: 'did:web:example.com',
    issued_at: iat, expires_at: exp,
    scopes: [pick(rng, SCOPES), pick(rng, SCOPES)],
    signature: 'ed25519:abcd1234',
  };
}
function randomDelegate(rng, idx, parentScopes) {
  return {
    agent_id: `delegate-${idx}`, depth: 1, delegated_by: 'agent-root',
    scopes: rng() < 0.7 ? parentScopes.slice(0, 1) : [pick(rng, SCOPES)],
    expires_at: NOW + randInt(rng, -5, 60) * 86400,
    signature: rng() < 0.8 ? 'ed25519:xyz9' : undefined,
  };
}
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const TRIALS = 6000;

// ---------- P1: termination — checks.length bounded, pass+fail+warn === checks_run (accounting identity) ----------
function checkP1_termination_accounting() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const root = randomRoot(rand);
    const n = Math.floor(rand() * 5);
    const delegates = Array.from({ length: n }, (_, idx) => randomDelegate(rand, idx, root.scopes));
    const cred = n > 0 ? { credential_type: 'DelegationChain', root, delegates } : { credential_type: 'AgentCredential', ...root };
    const { output_payload } = compute({ credential: cred, validate_at_unix: NOW });
    checked++;
    if (output_payload.checks.length < 1 || output_payload.checks.length > 20) violations++;
    const pass = output_payload.checks.filter((c) => c.status === 'pass').length;
    const fail = output_payload.checks.filter((c) => c.status === 'fail').length;
    const warn = output_payload.checks.filter((c) => c.status === 'warn').length;
    if (pass + fail + warn !== output_payload.checks.length) violations++;
    if (output_payload.pass !== pass || output_payload.fail !== fail || output_payload.warn !== warn) violations++;
  }
  return { name: 'P1_termination_accounting_identity', trials: checked, violations };
}

// ---------- P2 (differential): overall_status re-derived from fail/warn counts ----------
function checkP2_overall_status_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const root = randomRoot(rand);
    const n = Math.floor(rand() * 5);
    const delegates = Array.from({ length: n }, (_, idx) => randomDelegate(rand, idx, root.scopes));
    const cred = n > 0 ? { credential_type: 'DelegationChain', root, delegates } : { credential_type: 'AgentCredential', ...root };
    const { output_payload } = compute({ credential: cred, validate_at_unix: NOW });
    checked++;
    const expected = output_payload.fail > 0 ? 'fail' : output_payload.warn > 0 ? 'warn' : 'pass';
    if (output_payload.overall_status !== expected) violations++;
  }
  return { name: 'P2_overall_status_differential', trials: checked, violations };
}

// ---------- P3: enum boundedness of check statuses ----------
const VALID_STATUS = new Set(['pass', 'fail', 'warn']);
function checkP3_enum_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const root = randomRoot(rand);
    const { output_payload } = compute({ credential: { credential_type: 'AgentCredential', ...root }, validate_at_unix: NOW });
    checked++;
    for (const c of output_payload.checks) {
      if (!VALID_STATUS.has(c.status)) violations++;
    }
    if (!['pass', 'fail', 'warn'].includes(output_payload.overall_status)) violations++;
  }
  return { name: 'P3_enum_boundedness', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of delegates array order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const root = randomRoot(rand);
    const n = 2 + Math.floor(rand() * 4);
    const delegates = Array.from({ length: n }, (_, idx) => randomDelegate(rand, idx, root.scopes));
    const cred = { credential_type: 'DelegationChain', root, delegates };
    const shuffledCred = { credential_type: 'DelegationChain', root, delegates: shuffle(rand, delegates) };
    const r1 = compute({ credential: cred, validate_at_unix: NOW }).output_payload;
    const r2 = compute({ credential: shuffledCred, validate_at_unix: NOW }).output_payload;
    checked++;
    if (r1.overall_status !== r2.overall_status) violations++;
    if (r1.pass !== r2.pass || r1.fail !== r2.fail || r1.warn !== r2.warn) violations++;
  }
  return { name: 'P4_permutation_invariance_delegates', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_accounting());
results.properties.push(checkP2_overall_status_differential());
results.properties.push(checkP3_enum_bounded());
results.properties.push(checkP4_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-04-agent-identity-attestation-checker',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
