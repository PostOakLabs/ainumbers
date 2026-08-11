// art-32-a2a-agent-card-trust-chain-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C11-1).
// kernel_digest_at_authoring: sha256:b559ef728aacf8aa3f1ee6cb9db684bf7b32b917bafcbcacb0cc88c16c76c008
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — string/array/boolean logic only, no arithmetic
// comparisons anywhere in the kernel; valid_days <= MAX_VALID_DAYS is an integer comparison).
// Checks: fixture-oracle gate, termination (allChecks.length grows linearly and only with
// skills.length + delegation_chain.length, the kernel's two unbounded inputs), differential
// re-derivation of trust_determination from pass/fail/warn counts, boundedness (DLG-D01 fail
// iff chain.length > MAX_DELEG_DEPTH), and metamorphic well-formed-link-append (appending a
// non-escalating, non-expired delegation link to a passing chain preserves no_scope_escalation
// and no_expired_links).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-32-a2a-agent-card-trust-chain-validator.proptest.mjs

import { compute } from '../art-32-a2a-agent-card-trust-chain-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-32-a2a-agent-card-trust-chain-validator.fixtures.json');
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
const rand = mulberry32(0x3200A);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomCard(rng, skillN) {
  const skills = [];
  for (let i = 0; i < skillN; i++) skills.push(rng() < 0.7 ? { id: `s${i}`, name: `skill${i}` } : { id: `s${i}` });
  return {
    name: 'agent-x', url: 'https://example.com/agent', version: '1.0', protocolVersion: '0.4',
    capabilities: { extensions: [] }, skills,
    signatures: rng() < 0.6 ? [{ protected: 'p', signature: 's' }] : [],
  };
}

function randomChain(rng, n) {
  const chain = [];
  let prevSubject = null;
  for (let i = 0; i < n; i++) {
    const issuer = i === 0 ? `A${i}` : (rng() < 0.85 ? prevSubject : `WRONG${i}`);
    const subject = `A${i + 1}`;
    const scope = rng() < 0.8 && i > 0 ? (chain[i - 1] ? chain[i - 1].scope : ['s']) : [`scope${i}`];
    chain.push({ issuer, subject, scope, valid_days: pick(rng, [10, 30, 90, 91, -1]) });
    prevSubject = subject;
  }
  return chain;
}

function randomPP(rng) {
  const skillN = Math.floor(rng() * 6);
  const chainN = Math.floor(rng() * 6);
  return {
    agent_card: randomCard(rng, skillN),
    delegation_chain: randomChain(rng, chainN),
    spend_policy: rng() < 0.5 ? { per_tx_cap: 10, daily_cap: 100 } : null,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — allChecks.length grows only with skills.length + chain.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const skillN = pp.agent_card.skills.length;
    const chainN = pp.delegation_chain.length;
    // base card checks (6 fixed + CARD-URL2 + CARD-X00/S01) + skillN per-skill + chain checks (~4/link + DLG-D01/D00)
    const upperBound = 12 + skillN + chainN * 5 + 3;
    if (output_payload.checks.length > upperBound) violations++;
  }
  return { name: 'P1_termination_checks_bounded_by_skills_and_chain', trials: checked, violations };
}

// ---------- P2 (differential): trust_determination re-derivation from counts ----------
function checkP2_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = output_payload.fail_count > 0 ? 'fail' : output_payload.warn_count > 0 ? 'warn' : 'pass';
    if (output_payload.trust_determination !== expected) violations++;
    // note: checks.length can exceed pass+fail+warn because some codes (CARD-X00/CARD-X03) carry
    // an 'info' status that is not tallied into any of the three counters — confirmed by direct
    // source read, so this is NOT asserted as an equality here.
    if (output_payload.pass_count + output_payload.fail_count + output_payload.warn_count > output_payload.checks.length) violations++;
  }
  return { name: 'P2_trust_determination_differential', trials: checked, violations };
}

// ---------- P3: boundedness — DLG-D01 fails iff chain.length > MAX_DELEG_DEPTH(4) ----------
function checkP3_deleg_depth_bounded() {
  let violations = 0, checked = 0;
  const MAX_DELEG_DEPTH = 4;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (pp.delegation_chain.length === 0) continue;
    const d01 = output_payload.checks.find((c) => c.code === 'DLG-D01');
    if (!d01) { violations++; continue; }
    const expectedPass = pp.delegation_chain.length <= MAX_DELEG_DEPTH;
    if ((d01.status === 'pass') !== expectedPass) violations++;
  }
  return { name: 'P3_deleg_depth_boundedness', trials: checked, violations };
}

// ---------- P4: metamorphic — well-formed non-escalating link append preserves no_scope_escalation ----------
function checkP4_wellformed_append_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const chain = pp.delegation_chain;
    if (chain.length === 0) continue;
    const last = chain[chain.length - 1];
    const nextLink = { issuer: last.subject, subject: `${last.subject}-child`, scope: Array.isArray(last.scope) ? last.scope : [last.scope], valid_days: 5 };
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp, delegation_chain: [...chain, nextLink] }).output_payload;
    checked++;
    // the newly appended link itself introduces no scope escalation (same scope as parent) and
    // is not expired (valid_days=5>0<=90) — its own DLG-E/DLG-X codes must be pass, though prior
    // links' verdicts are unaffected by the append.
    const newEscCode = `DLG-E0${chain.length + 1}`;
    const newExpCode = `DLG-X0${chain.length + 1}`;
    const escCheck = r2.checks.find((c) => c.code === newEscCode);
    const expCheck = r2.checks.find((c) => c.code === newExpCode);
    if (!escCheck || escCheck.status !== 'pass') violations++;
    if (!expCheck || expCheck.status !== 'pass') violations++;
    if (r2.checks.length <= r1.checks.length) violations++;
  }
  return { name: 'P4_wellformed_link_append_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_verdict_differential());
results.properties.push(checkP3_deleg_depth_bounded());
results.properties.push(checkP4_wellformed_append_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-32-a2a-agent-card-trust-chain-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
