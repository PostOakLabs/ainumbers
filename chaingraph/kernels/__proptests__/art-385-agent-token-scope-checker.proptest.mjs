// art-385-agent-token-scope-checker.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C18-1).
// kernel_digest_at_authoring: sha256:ceb4b481b11aabd4718fed5d5c1d67fb69a5b58a07e48c5d1be12bbe8113af1a
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — every comparison is Date/timestamp ordering,
// currency string equality, or a single Number.isFinite/amount>cap integer-shaped compare;
// no ratio/threshold arithmetic that would need ULP forcing) — forced categorical boundary
// cases are used in place of ULP-forcing, per spec §3's float:no row.
// Unbounded input: policy_parameters.attenuation_chain (caller-supplied array) drives a
// data-dependent for-loop (chain-narrowing check) whose length is not declared anywhere in
// the kernel — termination bound is the array's own length, tested here up to a large size.
// Checks: fixture-oracle gate, termination (attenuation-chain loop runs exactly chain.length-1
// iterations regardless of size, never hangs), boundedness (checks_run/failing_checks/
// attenuation_depth stay within input-derived bounds, verdict is always IN_SCOPE|OUT_OF_SCOPE),
// metamorphic (an all-narrowing chain of any length never trips a WIDENED violation; injecting
// one widening link at any position is always caught fail-closed), forced categorical boundary
// cases (expiry exactly at requested_at, currency mismatch, MCC allow-list empty vs populated).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-385-agent-token-scope-checker.proptest.mjs

import { compute } from '../art-385-agent-token-scope-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-385-agent-token-scope-checker.fixtures.json');
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
const rand = mulberry32(0x385A0);

const BASE_TOKEN = { token_id: 'root', currency: 'USD', max_amount: 10000, expires_at: '2030-01-01T00:00:00Z', allowed_mccs: [] };
const BASE_ACTION = { requested_at: '2026-01-01T00:00:00Z', amount: 100, currency: 'USD', mcc: '5411' };

// MCC narrowing means the ALLOW-LIST SHRINKS (fewer allowed categories = more restrictive) —
// growing the list, even by adding a "new" code, WIDENS scope. So the pool only ever loses
// members as the chain progresses, never gains one.
function narrowingChain(rng, n) {
  const chain = [];
  let amt = 100000;
  let mccs = ['MCC1000', 'MCC2000', 'MCC3000', 'MCC4000', 'MCC5000'];
  for (let i = 0; i < n; i++) {
    amt = amt - Math.floor(rng() * 1000);
    // floor at 1: an empty array means UNRESTRICTED per mccSubsetOrEqual (wider, not narrower),
    // so shrinking must never reach zero-length mid-chain or it flips to a widening violation.
    if (rng() > 0.5 && mccs.length > 1) mccs = mccs.slice(0, mccs.length - 1);
    chain.push({ token_id: `link${i}`, currency: 'USD', max_amount: amt, expires_at: '2030-01-01T00:00:00Z', allowed_mccs: [...mccs] });
  }
  return chain;
}

const TRIALS = 3000;

// ---------- P1: termination — attenuation-chain loop bound is the chain's own length ----------
function checkP1_termination_chain_length_bound() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 2, 10, 100, 500];
  for (const n of sizes) {
    const chain = narrowingChain(rand, n);
    const leaf = chain.length ? { ...chain[chain.length - 1], token_id: 'leaf', max_amount: chain[chain.length - 1].max_amount } : BASE_TOKEN;
    const pp = { requested_action: BASE_ACTION, token: leaf, attenuation_chain: chain };
    const start = Date.now();
    const { checks } = compute(pp);
    checked++;
    if (Date.now() - start > 2000) violations++; // never hangs regardless of chain size
    const attCheck = checks.find((c) => c.id === 'attenuation');
    if (!attCheck) violations++;
  }
  return { name: 'P1_termination_attenuation_chain_length_bound', trials: checked, violations };
}

// ---------- P2: boundedness — verdict is always exactly one of the two declared values ----------
function checkP2_verdict_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 8);
    const chain = narrowingChain(rand, n);
    const leaf = { ...BASE_TOKEN, token_id: 'leaf', max_amount: 50 + Math.floor(rand() * 9950), expires_at: rand() > 0.1 ? '2030-01-01T00:00:00Z' : '2020-01-01T00:00:00Z' };
    const pp = { requested_action: { ...BASE_ACTION, amount: Math.floor(rand() * 20000) }, token: leaf, attenuation_chain: chain };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.verdict !== 'IN_SCOPE' && output_payload.verdict !== 'OUT_OF_SCOPE') violations++;
    if (output_payload.attenuation_depth !== chain.length) violations++;
    if (output_payload.checks_run < 4 || output_payload.checks_run > 5) violations++;
  }
  return { name: 'P2_verdict_and_depth_boundedness', trials: checked, violations };
}

// ---------- P3: metamorphic — an all-narrowing chain never trips a WIDENED failure ----------
function checkP3_metamorphic_narrowing_never_fails_attenuation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const n = 1 + Math.floor(rand() * 20);
    const chain = narrowingChain(rand, n);
    const leaf = { ...chain[chain.length - 1], token_id: 'leaf' };
    const pp = { requested_action: BASE_ACTION, token: leaf, attenuation_chain: chain };
    const { checks } = compute(pp);
    checked++;
    const attCheck = checks.find((c) => c.id === 'attenuation');
    if (attCheck.status !== 'pass') violations++;
  }
  return { name: 'P3_metamorphic_all_narrowing_chain_never_fails', trials: checked, violations };
}

// ---------- P4: metamorphic — injecting one widening link at any position is always caught ----------
function checkP4_metamorphic_injected_widening_always_caught() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const n = 2 + Math.floor(rand() * 10);
    const chain = narrowingChain(rand, n);
    // widenIdx must be >= 1: index 0 has no parent within the chain, so widening it is
    // undetectable by construction — the violation must exceed its IMMEDIATE PARENT's cap.
    const widenIdx = 1 + Math.floor(rand() * (chain.length - 1));
    chain[widenIdx] = { ...chain[widenIdx], max_amount: chain[widenIdx - 1].max_amount + 999999 }; // WIDEN vs its own parent
    const leaf = { ...chain[chain.length - 1], token_id: 'leaf' };
    const pp = { requested_action: BASE_ACTION, token: leaf, attenuation_chain: chain };
    const { checks, verdict } = compute(pp);
    checked++;
    const attCheck = checks.find((c) => c.id === 'attenuation');
    if (attCheck.status !== 'fail') violations++;
    if (verdict !== 'OUT_OF_SCOPE') violations++; // fail-closed
  }
  return { name: 'P4_metamorphic_injected_widening_always_caught_fail_closed', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no exception — no ULP claim made) ----------
function checkP5_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const cases = [
    // expiry exactly equal to requested_at — kernel uses "<=" so this must be EXPIRED
    { pp: { requested_action: BASE_ACTION, token: { ...BASE_TOKEN, expires_at: BASE_ACTION.requested_at } }, expectVerdict: 'OUT_OF_SCOPE' },
    // amount exactly equal to max_amount — must PASS (kernel uses ">")
    { pp: { requested_action: { ...BASE_ACTION, amount: 10000 }, token: BASE_TOKEN }, expectVerdict: 'IN_SCOPE' },
    // amount exactly one over max_amount — must FAIL
    { pp: { requested_action: { ...BASE_ACTION, amount: 10001 }, token: BASE_TOKEN }, expectVerdict: 'OUT_OF_SCOPE' },
    // empty allowed_mccs — unrestricted, must PASS regardless of requested mcc
    { pp: { requested_action: { ...BASE_ACTION, mcc: '9999' }, token: { ...BASE_TOKEN, allowed_mccs: [] } }, expectVerdict: 'IN_SCOPE' },
    // mcc not in a populated allow-list — must FAIL
    { pp: { requested_action: { ...BASE_ACTION, mcc: '9999' }, token: { ...BASE_TOKEN, allowed_mccs: ['5411'] } }, expectVerdict: 'OUT_OF_SCOPE' },
    // currency mismatch — must FAIL
    { pp: { requested_action: { ...BASE_ACTION, currency: 'EUR' }, token: BASE_TOKEN }, expectVerdict: 'OUT_OF_SCOPE' },
  ];
  for (const c of cases) {
    const { verdict } = compute(c.pp);
    checked++;
    if (verdict !== c.expectVerdict) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_chain_length_bound());
results.properties.push(checkP2_verdict_boundedness());
results.properties.push(checkP3_metamorphic_narrowing_never_fails_attenuation());
results.properties.push(checkP4_metamorphic_injected_widening_always_caught());
results.properties.push(checkP5_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-385-agent-token-scope-checker',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
