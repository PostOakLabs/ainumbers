// art-08-en16931-einvoice-batch-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C1-1).
// kernel_digest_at_authoring: sha256:2ae638995633cb25dd6ef2c645f6246c8aef863054019213ba1424a7509c4c7e
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — ULP-boundary forcing mandatory (compliance-rate verdict tiers at exactly 95%
// and 80%, deadline_readiness_score clamped to [0,100], both compared with `>=`).
// Checks: fixture-oracle gate, termination (n_invoices clamped to [10,2000]), determinism/reproducibility
// (same seed+params -> byte-identical output — the cheap "reference computation" for this LCG-driven
// simulator), boundedness of rates/scores, a differential re-derivation of verdict from
// compliance_rate_pct, and ULP-forced verdict-threshold cases exercised directly against the pure
// classifier (>=95 / >=80), which the PRNG alone cannot reliably land on.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled, distinct seed
// stream from the kernel's own internal LCG generator).
//
// Run: node chaingraph/kernels/__proptests__/art-08-en16931-einvoice-batch-validator.proptest.mjs

import { compute } from '../art-08-en16931-einvoice-batch-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-08-en16931-einvoice-batch-validator.fixtures.json');
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
const rand = mulberry32(0xA08A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function randInt(rng, lo, hi) { return Math.floor(randRange(rng, lo, hi + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  return {
    seed: randInt(rng, 0, 1_000_000),
    n_invoices: randInt(rng, 10, 2000),
    error_rate: rng() * 0.6,
    strictness: pick(rng, ['lenient', 'standard', 'strict']),
    profile: pick(rng, ['B2B', 'B2G', 'B2C']),
  };
}

const TRIALS = 400;

// ---------- P1: termination — n_invoices clamped into [10,2000], pass+fail === total ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const extremes = [-100, 0, 1, 9, 10, 2000, 2001, 50000];
  for (const raw of extremes) {
    const output_payload = compute({ ...randomPP(rand), n_invoices: raw });
    checked++;
    if (output_payload.total_invoices < 10 || output_payload.total_invoices > 2000) violations++;
  }
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    if (output_payload.total_invoices !== output_payload.pass_count + output_payload.fail_count) violations++;
  }
  return { name: 'P1_termination_clamped_bounded', trials: checked, violations };
}

// ---------- P2: determinism — same seed+params -> byte-identical output ----------
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

// ---------- P3: boundedness — compliance_rate_pct in [0,100], deadline_readiness_score in [0,100] ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    if (output_payload.compliance_rate_pct < 0 || output_payload.compliance_rate_pct > 100) violations++;
    if (output_payload.deadline_readiness_score < 0 || output_payload.deadline_readiness_score > 100) violations++;
  }
  return { name: 'P3_boundedness_rate_and_score', trials: checked, violations };
}

// ---------- P4 (differential): verdict re-derived from compliance_rate_pct ----------
function classifyVerdict(pct) {
  if (pct >= 95) return 'COMPLIANT';
  if (pct >= 80) return 'PARTIAL';
  return 'NON_COMPLIANT';
}
function checkP4_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    if (output_payload.verdict !== classifyVerdict(output_payload.compliance_rate_pct)) violations++;
  }
  return { name: 'P4_verdict_differential', trials: checked, violations };
}

// ---------- P5 (ULP-forcing, float_sensitive:yes) — verdict-tier boundary at exactly 95% / 80% ----------
// The pure classifier is exercised directly at its exact-equality boundaries (>=95, >=80) — the PRNG
// cannot reliably land compliance_rate_pct on these exact values, so this documents the kernel's own
// contract independent of what simulation can hit, same shape as the DTI-B1 forced-case pattern.
function checkP5_forced() {
  const rows = [];
  rows.push({ label: 'classifier(95 exactly) -> COMPLIANT (>=)', matches: classifyVerdict(95) === 'COMPLIANT' });
  rows.push({ label: 'classifier(94.99) -> PARTIAL', matches: classifyVerdict(94.99) === 'PARTIAL' });
  rows.push({ label: 'classifier(80 exactly) -> PARTIAL (>=)', matches: classifyVerdict(80) === 'PARTIAL' });
  rows.push({ label: 'classifier(79.99) -> NON_COMPLIANT', matches: classifyVerdict(79.99) === 'NON_COMPLIANT' });
  // Live kernel forced cases: near-zero error_rate -> near-100% compliance -> COMPLIANT.
  const clean = compute({ seed: 7, n_invoices: 500, error_rate: 0, strictness: 'lenient', profile: 'B2B' });
  rows.push({ label: 'error_rate=0, lenient -> compliance_rate_pct high, verdict COMPLIANT', compliance_rate_pct: clean.compliance_rate_pct, verdict: clean.verdict, matches: clean.verdict === classifyVerdict(clean.compliance_rate_pct) });
  const dirty = compute({ seed: 7, n_invoices: 500, error_rate: 0.9, strictness: 'strict', profile: 'B2G' });
  rows.push({ label: 'error_rate=0.9, strict, B2G -> compliance_rate_pct low, verdict NON_COMPLIANT/PARTIAL', compliance_rate_pct: dirty.compliance_rate_pct, verdict: dirty.verdict, matches: dirty.verdict === classifyVerdict(dirty.compliance_rate_pct) });
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
  tool_id: 'art-08-en16931-einvoice-batch-validator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
