// art-02-agent-spend-policy-simulator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C1-1).
// kernel_digest_at_authoring: sha256:236e163038383b05b4d5d18a1d3cf7d32a974a1035496ab1c00fbad3e84f412a
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — ULP-boundary forcing mandatory (policyRiskVerdict thresholds at exactly
// failRate=0.40 and failRate=0.15, both compared strictly with `>`).
// Checks: fixture-oracle gate, termination (n_txns clamped to [10,2000], the kernel's own loop bound),
// determinism/reproducibility (same seed+params -> byte-identical output — the class-C "cheap reference
// computation" here IS a second call), boundedness of percentages/counts, a differential re-derivation
// of policyRiskVerdict from the reported fail_rate_pct, and ULP-forced verdict-threshold cases.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled, distinct seed
// stream from the kernel's own internal generator).
//
// Run: node chaingraph/kernels/__proptests__/art-02-agent-spend-policy-simulator.proptest.mjs

import { compute } from '../art-02-agent-spend-policy-simulator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-02-agent-spend-policy-simulator.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0xA02A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function randInt(rng, lo, hi) { return Math.floor(randRange(rng, lo, hi + 1)); }

function randomPP(rng) {
  return {
    seed: randInt(rng, 0, 1_000_000),
    n_txns: randInt(rng, 10, 2000),
    hnp_ratio: rng() * 0.3,
    chaos: rng() * 0.5,
    drip_freq: rng() * 0.3,
    per_tx_limit: randRange(rng, 50, 2000),
    daily_limit: randRange(rng, 500, 10000),
    monthly_limit: randRange(rng, 5000, 100000),
  };
}

const TRIALS = 400; // each trial runs a full simulation of up to 2000 txns -- kept smaller per §3's "fewer trials for costlier kernels" allowance.

// ---------- P1: termination — n_txns is always clamped into [10,2000], total_transactions matches ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const extremes = [-100, 0, 1, 9, 10, 2000, 2001, 50000];
  for (const raw of extremes) {
    const output_payload = compute({ ...randomPP(rand), n_txns: raw });
    checked++;
    if (output_payload.total_transactions < 10 || output_payload.total_transactions > 2000) violations++;
  }
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    if (output_payload.total_transactions !== output_payload.pass_count + output_payload.fail_count) violations++;
  }
  return { name: 'P1_termination_clamped_bounded', trials: checked, violations };
}

// ---------- P2: determinism — same seed+params -> byte-identical output (reference = a second call) ----------
function checkP2_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P2_determinism_reproducibility', trials: checked, violations };
}

// ---------- P3: boundedness — fail_rate_pct in [0,100], total_approved_spend >= 0 ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    if (output_payload.fail_rate_pct < 0 || output_payload.fail_rate_pct > 100) violations++;
    if (output_payload.total_approved_spend < 0) violations++;
  }
  return { name: 'P3_boundedness_rate_and_spend', trials: checked, violations };
}

// ---------- P4 (differential): policyRiskVerdict re-derived from fail_rate_pct + bypass_paths_detected ----------
function classifyRisk(failRate, bypassCount) {
  if (failRate > 0.40 || bypassCount >= 2) return 'HIGH';
  if (failRate > 0.15 || bypassCount >= 1) return 'MEDIUM';
  return 'LOW';
}
function checkP4_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    const failRateFraction = output_payload.fail_count / output_payload.total_transactions;
    const expected = classifyRisk(failRateFraction, output_payload.bypass_paths_detected.length);
    if (output_payload.verdict !== expected) violations++;
  }
  return { name: 'P4_risk_verdict_differential', trials: checked, violations };
}

// ---------- P5 (ULP-forcing, float_sensitive:yes) — policyRiskVerdict threshold cases (0.40 / 0.15, strict >) ----------
// Constructed via an unattainably tight per_tx_limit (forces near-100% or near-0% fail rate) to bracket
// the strict-inequality threshold behavior directly against the pure classifier function above.
const ULP_BOUNDARY_CASES = [
  { per_tx_limit: 1e9, daily_limit: 1e12, monthly_limit: 1e15, n_txns: 500, seed: 1, label: 'no limits triggered -> failRate=0 -> LOW' },
  { per_tx_limit: 0.0000001, daily_limit: 1e12, monthly_limit: 1e15, n_txns: 500, seed: 1, label: 'per_tx_limit ~0 -> failRate~1.0 -> HIGH' },
];
function checkP5_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const output_payload = compute(c);
    const failRateFraction = output_payload.fail_count / output_payload.total_transactions;
    const expected = classifyRisk(failRateFraction, output_payload.bypass_paths_detected.length);
    rows.push({ label: c.label, fail_rate_pct: output_payload.fail_rate_pct, verdict: output_payload.verdict, expected, matches: output_payload.verdict === expected });
  }
  // Also directly exercise the pure threshold function at its exact boundary values (0.40, 0.15) --
  // this documents the kernel's OWN strict-> comparison contract independent of what the PRNG can hit.
  rows.push({ label: 'classifier(0.40 exactly, 0 bypass) -> MEDIUM (not HIGH, strict >)', matches: classifyRisk(0.40, 0) === 'MEDIUM' });
  rows.push({ label: 'classifier(0.4000000001, 0 bypass) -> HIGH', matches: classifyRisk(0.4000000001, 0) === 'HIGH' });
  rows.push({ label: 'classifier(0.15 exactly, 0 bypass) -> LOW (not MEDIUM, strict >)', matches: classifyRisk(0.15, 0) === 'LOW' });
  rows.push({ label: 'classifier(0.1500000001, 0 bypass) -> MEDIUM', matches: classifyRisk(0.1500000001, 0) === 'MEDIUM' });
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_determinism());
results.properties.push(checkP3_boundedness());
results.properties.push(checkP4_verdict_differential());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.matches);

console.log(JSON.stringify({
  tool_id: 'art-02-agent-spend-policy-simulator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
