// art-31-a2a-x402-extension-mandate-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C11-1).
// kernel_digest_at_authoring: sha256:8136ed46e50029be28e18bd1ec82e60c057b1b12a749df5dc4f847a012b5dddf
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO per WU triage table — direct read confirms one numeric comparison uses a
// FIXED 1e-9 tolerance constant (CON-01, pay <= cap + 1e-9), which is a forced categorical
// boundary case, not an ULP-boundary claim about the kernel's own float representation; the
// rest is string/boolean logic. Forced categorical boundary cases used for CON-01 below.
// Checks: fixture-oracle gate, termination/boundedness (allChecks.length is a FIXED small set
// of check codes independent of the extensions array's size — the one "unbounded input" this
// kernel takes), differential re-derivation of verdict from pass/fail/warn counts, forced
// categorical boundary cases at the CON-01 tolerance edge, and metamorphic case-insensitivity
// of assetMatch.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-31-a2a-x402-extension-mandate-validator.proptest.mjs

import { compute } from '../art-31-a2a-x402-extension-mandate-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-31-a2a-x402-extension-mandate-validator.fixtures.json');
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
const rand = mulberry32(0x31D0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomExtensions(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ uri: rng() < 0.3 ? 'https://example.com/x402/v1' : `https://example.com/other-${i}` });
  return out;
}

function randomPP(rng) {
  const extN = Math.floor(rng() * 12);
  const card = {
    capabilities: { extensions: randomExtensions(rng, extN).concat([{ uri: 'https://example.com/x402/v1', params: { payment_authority: { scope: ['pay'], max_amount: 100 }, settlement_rail: { scheme: 'exact', network: 'base', asset: 'usdc' } } }]) },
  };
  const amt = Math.max(0.01, rng() * 200);
  const pay = { scheme: 'exact', network: 'base', maxAmountRequired: String(amt), resource: 'r', payTo: '0xabc', asset: 'usdc', maxTimeoutSeconds: 60 };
  const cap = { max_amount: amt + (rng() - 0.5) * 5, asset: 'usdc' };
  return { agent_card: card, payment_payload: pay, mandate_cap: cap };
}

const TRIALS = 5000;

// ---------- P1: termination/boundedness — allChecks.length independent of extensions array size ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    // fixed code families: EXT(3) + SCOPE(3) + RAIL(4) + PAY(up to 9) + CON(up to 4) — bounded
    // regardless of how many extension entries the card declares.
    if (output_payload.checks.length > 25) violations++;
    if (output_payload.checks.length < 3) violations++;
  }
  return { name: 'P1_termination_checks_bounded_independent_of_extensions_size', trials: checked, violations };
}

// ---------- P2 (differential): verdict re-derivation from pass/fail/warn counts ----------
function checkP2_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = output_payload.fail_count > 0 ? 'fail' : output_payload.warn_count > 0 ? 'warn' : 'pass';
    if (output_payload.verdict !== expected) violations++;
    if (output_payload.pass_count + output_payload.fail_count + output_payload.warn_count !== output_payload.checks.length) violations++;
  }
  return { name: 'P2_verdict_differential_from_counts', trials: checked, violations };
}

// ---------- P3: forced categorical boundary cases — CON-01 tolerance edge (pay <= cap + 1e-9) ----------
function checkP3_con01_boundary_forcing() {
  let violations = 0, checked = 0;
  const card = { capabilities: { extensions: [{ uri: 'https://example.com/x402/v1', params: { payment_authority: { scope: ['pay'], max_amount: 100 }, settlement_rail: { scheme: 'exact', network: 'base', asset: 'usdc' } } }] } };
  const capAmt = 100;
  const deltas = [0, 1e-9, -1e-9, 1e-9 + 1e-12, -(1e-9 + 1e-12), 0.5, -0.5];
  for (const d of deltas) {
    const payAmt = capAmt + d;
    const pay = { scheme: 'exact', network: 'base', maxAmountRequired: String(payAmt), resource: 'r', payTo: '0xabc', asset: 'usdc' };
    const { output_payload } = compute({ agent_card: card, payment_payload: pay, mandate_cap: { max_amount: capAmt, asset: 'usdc' } });
    checked++;
    const con01 = output_payload.checks.find((c) => c.code === 'CON-01');
    const expectedPass = payAmt <= capAmt + 1e-9;
    if (!con01 || (con01.status === 'pass') !== expectedPass) violations++;
  }
  return { name: 'P3_con01_tolerance_boundary_forced', trials: checked, violations };
}

// ---------- P4: metamorphic — assetMatch is case/whitespace-insensitive ----------
function checkP4_asset_match_case_insensitive() {
  let violations = 0, checked = 0;
  const card = { capabilities: { extensions: [{ uri: 'https://example.com/x402/v1', params: { payment_authority: { scope: ['pay'], max_amount: 100 }, settlement_rail: { scheme: 'exact', network: 'base', asset: 'USDC' } } }] } };
  const variants = ['usdc', 'USDC', 'UsDc', ' usdc ', 'UsdC'];
  const results_ = [];
  for (const v of variants) {
    const pay = { scheme: 'exact', network: 'base', maxAmountRequired: '10', resource: 'r', payTo: '0xabc', asset: v };
    const { output_payload } = compute({ agent_card: card, payment_payload: pay, mandate_cap: { max_amount: 100, asset: 'usdc' } });
    checked++;
    const con02 = output_payload.checks.find((c) => c.code === 'CON-02');
    results_.push(con02 ? con02.status : null);
  }
  if (new Set(results_).size !== 1) violations++;
  return { name: 'P4_asset_match_case_whitespace_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_verdict_differential());
results.properties.push(checkP3_con01_boundary_forcing());
results.properties.push(checkP4_asset_match_case_insensitive());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-31-a2a-x402-extension-mandate-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
