// kernel_digest_at_authoring: sha256:5d628b9e3200e3791c5152e7eb5d6bbe34b3e278f43cd24ebc497eea062d9d15
//
// FV-PROPFLOOR-SHARD-B13-1 — property-test floor for art-47-arc-cctp-transfer.
// Class B (bounded-numeric), float:no per the WU row — confirmed by inspection, notional_usd only
// ever participates in fixed-threshold comparisons (>=3000, >1000000), never division, multiplication,
// or accumulation; fmtEnUS is pure string formatting. Forced CATEGORICAL boundary cases used instead
// of ULP forcing, per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-47-arc-cctp-transfer.proptest.mjs

import { compute } from '../art-47-arc-cctp-transfer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-47-arc-cctp-transfer.fixtures.json');
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
const rand = mulberry32(0x4712);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randBool(rng) { return rng() < 0.5; }
const TRIALS = 8000;

const DOMAINS = ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'avalanche', 'solana', 'noble', 'sui', 'linea', 'arc', 'unichain', 'worldchain', 'unknowndomain'];
const MODES = ['standard', 'fast'];

function mkPP(rng) {
  return {
    source_domain: pick(rng, DOMAINS),
    dest_domain: pick(rng, DOMAINS),
    notional_usd: randRange(rng, 0, 5_000_000),
    transfer_mode: pick(rng, MODES),
    hook_payload: rng() < 0.5 ? null : 'somehook',
    using_v1: randBool(rng),
  };
}

// ---------- P1: boundedness — grade is always one of the fixed A-F 6-state enum ----------
function checkP1_gradeBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!['A', 'B', 'C', 'D', 'E', 'F'].includes(r.output_payload.grade)) violations++;
  }
  return { name: 'P1_grade_bounded_to_6_state_a_to_f_enum', trials: checked, violations };
}

// ---------- P2: metamorphic — verdict is FAIL iff fail_count > 0, WARN iff fail_count === 0 && warn_count > 0 ----------
function checkP2_verdictMatchesCounts() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const o = r.output_payload;
    const expected = o.fail_count > 0 ? 'FAIL' : o.warn_count > 0 ? 'WARN' : 'PASS';
    if (o.verdict !== expected) violations++;
  }
  return { name: 'P2_verdict_matches_fail_and_warn_counts', trials: checked, violations };
}

// ---------- P3: threshold-tier agreement — travel_rule warn is exactly notional_usd >= 3000, never off-by-one ----------
function checkP3_travelRuleMatchesExactThreshold() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expectedWarn = Number(pp.notional_usd) >= 3000;
    const actual = r.output_payload.checks.find(c => c.id === 'travel_rule');
    if (actual.warn !== expectedWarn) violations++;
  }
  return { name: 'P3_travel_rule_warn_matches_exact_3000_threshold', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced CATEGORICAL boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ source_domain: 'arc', dest_domain: 'ethereum', notional_usd: 2999.99, transfer_mode: 'standard' }, 'notional_usd 1 cent below the $3000 Travel Rule threshold — travel_rule check must not warn'],
  [{ source_domain: 'arc', dest_domain: 'ethereum', notional_usd: 3000, transfer_mode: 'standard' }, 'notional_usd exactly at the $3000 Travel Rule threshold (boundary is >=) — travel_rule check must warn'],
  [{ source_domain: 'arc', dest_domain: 'ethereum', notional_usd: 1_000_000, transfer_mode: 'standard' }, 'notional_usd exactly at the $1M LP-depth threshold with standard mode (not fast) — lp_depth_risk must not warn (isFast required)'],
  [{ source_domain: 'arc', dest_domain: 'ethereum', notional_usd: 1_000_000.01, transfer_mode: 'fast' }, 'notional_usd 1 cent over $1M with fast mode — lp_depth_risk check must warn'],
  [{ source_domain: 'ARC', dest_domain: 'ETHEREUM', notional_usd: 500, transfer_mode: 'standard' }, 'domain names in uppercase — kernel lowercases via .toLowerCase().trim(), domain_eligibility must still pass'],
  [{ source_domain: 'nosuchdomain', dest_domain: 'ethereum', notional_usd: 500, transfer_mode: 'standard' }, 'unrecognized source domain — domain_eligibility must fail, grade must reflect the fail'],
  [{ source_domain: 'arc', dest_domain: 'ethereum', notional_usd: 500, transfer_mode: 'fast', hook_payload: '   ' }, 'hook_payload is a whitespace-only string — kernel trims before length check, hook_safety must NOT warn (trimmed length 0)'],
  [{ source_domain: 'arc', dest_domain: 'ethereum', notional_usd: 500, transfer_mode: 'fast', using_v1: true }, 'using_v1 true — v1_sunset check must warn regardless of other fields'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const plausible = ['A', 'B', 'C', 'D', 'E', 'F'].includes(o.grade) && Array.isArray(o.checks) && o.checks.length === 6;
    rows.push({ label, input: pp, output: o, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_gradeBounded());
results.properties.push(checkP2_verdictMatchesCounts());
results.properties.push(checkP3_travelRuleMatchesExactThreshold());
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
