// art-21-agent-traffic-acceptance-policy-builder.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C6-1).
// kernel_digest_at_authoring: sha256:84f9842501dbebf909297725390cac30febcc88c7e7048926c349bf36258fd9b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — assessGuardrails() is pure comparison/branch logic
// over integers and enums; max_single_val_usd/max_daily_val_usd are echoed, never divided).
// Checks: fixture-oracle gate, termination (guardrail_findings.length is bounded by the FIXED
// number of assessGuardrails() branches -- 4 always-present findings plus 0-1 for refund_posture
// (no push when 'strict') plus 0-1 for block_anon_high, so length is in [4,6] -- never by caller
// input size), boundedness (warn_count + pass_count === guardrail_findings.length always),
// differential re-derivation of overall_risk/verdict from warn_count, and metamorphic
// verification-level monotonicity (upgrading verification_level from 'none' to any stronger level,
// all else fixed, never increases warn_count).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-21-agent-traffic-acceptance-policy-builder.proptest.mjs

import { compute } from '../art-21-agent-traffic-acceptance-policy-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-21-agent-traffic-acceptance-policy-builder.fixtures.json');
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
const rand = mulberry32(0x210A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const VERIF_LEVELS = ['none', 'jwt', 'ap2_vdc', 'tap_sig'];
const RAILS_POOL = ['x402', 'acp', 'ucp', 'tap'];
const BLOCK_RULES_POOL = ['block_anon_high', 'block_vpn', 'block_burst'];
const REFUND_POSTURES = ['liberal', 'standard', 'strict'];

function randomSubset(rng, pool) {
  return pool.filter(() => rng() < 0.5);
}

function randomPP(rng) {
  return {
    verification_level: pick(rng, VERIF_LEVELS),
    max_tx_per_min: Math.floor(rng() * 200),
    max_tx_per_day: Math.floor(rng() * 20000),
    max_single_val_usd: Math.floor(rng() * 2000),
    max_daily_val_usd: Math.floor(rng() * 10000),
    rails: randomSubset(rng, RAILS_POOL),
    refund_posture: pick(rng, REFUND_POSTURES),
    retry_policy: pick(rng, ['retry_1x', 'retry_3x', 'no_retry']),
    block_rules: randomSubset(rng, BLOCK_RULES_POOL),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — guardrail_findings.length bounded by fixed branch count (5 or 6) ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const n = output_payload.guardrail_findings.length;
    if (n < 4 || n > 6) violations++;
  }
  return { name: 'P1_termination_findings_bounded_4_to_6', trials: checked, violations };
}

// ---------- P2 (differential): overall_risk/verdict re-derivation from warn_count ----------
function checkP2_risk_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedRisk = output_payload.guardrail_warnings === 0 ? 'low' : output_payload.guardrail_warnings <= 1 ? 'moderate' : 'high';
    if (output_payload.overall_risk !== expectedRisk) violations++;
    const expectedVerdict = expectedRisk === 'low' ? 'POLICY_SOUND' : expectedRisk === 'moderate' ? 'POLICY_ADVISORY' : 'POLICY_AT_RISK';
    if (output_payload.verdict !== expectedVerdict) violations++;
  }
  return { name: 'P2_risk_verdict_differential_from_warn_count', trials: checked, violations };
}

// ---------- P3: boundedness — warn_count + pass_count === guardrail_findings.length ----------
function checkP3_warn_pass_sum_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.guardrail_warnings + output_payload.guardrail_passes !== output_payload.guardrail_findings.length) violations++;
  }
  return { name: 'P3_warn_plus_pass_equals_findings_length', trials: checked, violations };
}

// ---------- P4: metamorphic — upgrading verification_level from 'none' never increases warn_count ----------
function checkP4_verification_level_monotonicity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const noneR = compute({ ...pp, verification_level: 'none' }).output_payload;
    const strongerR = compute({ ...pp, verification_level: pick(rand, ['jwt', 'ap2_vdc', 'tap_sig']) }).output_payload;
    checked++;
    if (strongerR.guardrail_warnings > noneR.guardrail_warnings) violations++;
  }
  return { name: 'P4_verification_level_upgrade_never_increases_warnings', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_risk_verdict_differential());
results.properties.push(checkP3_warn_pass_sum_bounded());
results.properties.push(checkP4_verification_level_monotonicity());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-21-agent-traffic-acceptance-policy-builder',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
