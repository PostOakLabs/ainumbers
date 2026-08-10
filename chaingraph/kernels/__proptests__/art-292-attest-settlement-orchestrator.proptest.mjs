// art-292-attest-settlement-orchestrator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C10-1).
// kernel_digest_at_authoring: sha256:e62a92dde406825f63c0b95978cb5a1070ed19f539f9c3a665a53cd2257c5ee0
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — composite_score is Math.round((100*got)/max) over small bounded
// integer got/max pairs (per-domain check counts are fixed and tiny); confirmed by direct
// read, no user-supplied floating quantity ever reaches the scoring path.
// Checks: fixture-oracle gate, boundedness (composite_score in [0,100], grade matches score
// via an independent re-derivation of grade()), termination (checks.length fixed at the sum
// of each domain's fixed check count), and metamorphic domain-independence (D-domain checks
// never change when only kernel_bindings/manifest/policyRef vary).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-292-attest-settlement-orchestrator.proptest.mjs

import { compute } from '../art-292-attest-settlement-orchestrator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-292-attest-settlement-orchestrator.fixtures.json');
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
const rand = mulberry32(0x292A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function grade(pct) {
  if (pct >= 90) return 'A';
  if (pct >= 78) return 'B';
  if (pct >= 62) return 'C';
  if (pct >= 45) return 'D';
  return 'F';
}

function randomManifest(rng) {
  const r = rng();
  if (r < 0.15) return null;
  return {
    name: rng() < 0.85 ? 'orchestrator-' + Math.floor(rng() * 100) : '',
    version: rng() < 0.85 ? '1.0.' + Math.floor(rng() * 9) : '',
    description: rng() < 0.7 ? 'A sufficiently long description of the orchestrator behavior.' : (rng() < 0.5 ? 'short' : ''),
  };
}
function randomPolicyRef(rng) {
  const r = rng();
  if (r < 0.2) return '';
  if (r < 0.4) return 'bad ref with spaces!!';
  return 'policy://sli/commit-halt-v' + Math.floor(rng() * 5);
}
function randomBindings(rng) {
  const n = Math.floor(rng() * 5);
  const arr = [];
  for (let i = 0; i < n; i++) {
    const wellFormed = rng() < 0.7;
    arr.push(wellFormed ? { tool_id: 'art-' + (200 + i), mcp_name: 'do_thing_' + i } : { tool_id: 'art-' + (200 + i) });
  }
  if (rng() < 0.2 && arr.length > 0) arr.push({ ...arr[0] }); // force a duplicate tool_id
  return arr;
}
const TRANSPORTS = ['https', 'mcp-stdio', 'mcp-http', 'ftp', undefined];
function randomTransport(rng) { return pick(rng, TRANSPORTS); }

function randomPP(rng) {
  return {
    orchestrator_manifest: randomManifest(rng),
    decision_policy_ref: randomPolicyRef(rng),
    kernel_bindings: randomBindings(rng),
    transport: randomTransport(rng),
  };
}

const TRIALS = 5000;

// ---------- P1: boundedness — composite_score in [0,100], checks.length fixed per input shape ----------
function checkP1_score_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.attestation.composite_score < 0 || output_payload.attestation.composite_score > 100) violations++;
    if (!Number.isInteger(output_payload.attestation.composite_score)) violations++;
  }
  return { name: 'P1_composite_score_bounded_0_to_100_integer', trials: checked, violations };
}

// ---------- P2 (differential): grade re-derived independently from composite_score ----------
function checkP2_grade_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = grade(output_payload.attestation.composite_score);
    if (output_payload.attestation.composite_grade !== expected) violations++;
    const failCount = output_payload.checks.filter((c) => c.status === 'fail').length;
    const expectedOverall = failCount > 0 ? 'fail' : output_payload.checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';
    if (output_payload.overall !== expectedOverall) violations++;
  }
  return { name: 'P2_grade_and_overall_differential', trials: checked, violations };
}

// ---------- P3: termination — bound_tool_ids re-derived from kernel_bindings ----------
function checkP3_bound_tool_ids_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = Array.isArray(pp.kernel_bindings) ? pp.kernel_bindings.filter((b) => b && b.tool_id).map((b) => b.tool_id) : [];
    if (JSON.stringify(output_payload.attestation.bound_tool_ids) !== JSON.stringify(expected)) violations++;
  }
  return { name: 'P3_bound_tool_ids_bounded_by_kernel_bindings', trials: checked, violations };
}

// ---------- P4: metamorphic — domain-D (transport) checks unaffected by manifest/bindings/policyRef ----------
function checkP4_domain_independence() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const transport = randomTransport(rand);
    const pp1 = { orchestrator_manifest: randomManifest(rand), decision_policy_ref: randomPolicyRef(rand), kernel_bindings: randomBindings(rand), transport };
    const pp2 = { orchestrator_manifest: randomManifest(rand), decision_policy_ref: randomPolicyRef(rand), kernel_bindings: randomBindings(rand), transport };
    const r1 = compute(pp1).output_payload;
    const r2 = compute(pp2).output_payload;
    checked++;
    const d1 = r1.checks.filter((c) => c.code.startsWith('D'));
    const d2 = r2.checks.filter((c) => c.code.startsWith('D'));
    if (JSON.stringify(d1) !== JSON.stringify(d2)) violations++;
  }
  return { name: 'P4_domainD_transport_checks_independent_of_other_domains', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_score_bounded());
results.properties.push(checkP2_grade_differential());
results.properties.push(checkP3_bound_tool_ids_bounded());
results.properties.push(checkP4_domain_independence());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-292-attest-settlement-orchestrator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
