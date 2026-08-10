// art-150-mcp-tool-scope-revocation-auditor.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C4-1).
// kernel_digest_at_authoring: sha256:43b2320d22c9bb43d9f57049be817347d84f13e34532dbec3d13725872886ba2
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — direct read confirmed. token_age_s = Number(now_unix) - Number(token_created_unix)
// is a plain integer-second subtraction (Unix timestamps), and rotation_due = age > max_token_age_s is a
// comparison between integers in every fixture/realistic case; there is no fractional threshold and no
// division anywhere in this kernel, so no ULP-boundary forcing applies.
// Checks: fixture-oracle gate, termination (ungated_tools bounded by tool_grants.length), boundedness
// (audit_pass is a pure AND of 3 booleans, token_age_s is exactly now_unix - token_created_unix or null),
// differential re-derivation of scopes_ok/revocable/rotation_ok/audit_pass, and metamorphic monotonicity
// (granting a non-empty scope to a previously-ungated tool never adds it back to ungated_tools; raising
// max_token_age_s never turns a passing rotation_ok false).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-150-mcp-tool-scope-revocation-auditor.proptest.mjs

import { compute } from '../art-150-mcp-tool-scope-revocation-auditor.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-150-mcp-tool-scope-revocation-auditor.fixtures.json');
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
const rand = mulberry32(0x150A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomGrant(rng, i) {
  const has_scopes = rng() < 0.6;
  return { tool: `tool${i}`, scopes: has_scopes ? [`scope${i}`] : [] };
}

function randomInput(rng) {
  const n = Math.floor(rng() * 8);
  const tool_grants = Array.from({ length: n }, (_, i) => randomGrant(rng, i));
  const revocation_endpoint = pick(rng, ['https://auth.example.com/revoke', 'not-a-url', undefined]);
  const token_created_unix = 1_000_000 + Math.floor(rng() * 10000);
  const now_unix = token_created_unix + Math.floor(rng() * 20000) - 5000;
  const max_token_age_s = pick(rng, [3600, 7200, 0]);
  const next_token_present = pick(rng, [true, false, undefined]);
  return { tool_grants, revocation_endpoint, token_created_unix, now_unix, max_token_age_s, next_token_present };
}

const TRIALS = 5000;

// ---------- P1: termination — ungated_tools bounded by tool_grants.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomInput(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.ungated_tools.length > pp.tool_grants.length) violations++;
  }
  return { name: 'P1_termination_ungated_bounded_by_grants_length', trials: checked, violations };
}

// ---------- P2 (differential): re-derive scopes_ok/revocable/rotation_ok/audit_pass ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomInput(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const ungated = pp.tool_grants.filter((g) => !(g && Array.isArray(g.scopes) && g.scopes.length > 0)).map((g, idx) => (g && g.tool) || ('#' + idx));
    if (JSON.stringify(o.ungated_tools) !== JSON.stringify(ungated)) violations++;
    const revocable = typeof pp.revocation_endpoint === 'string' && /^https?:\/\//.test(pp.revocation_endpoint);
    if (o.revocable !== revocable) violations++;
    const age = pp.now_unix - pp.token_created_unix;
    if (o.token_age_s !== age) violations++;
    const rotation_due = age > pp.max_token_age_s;
    const rotation_ok = !rotation_due || pp.next_token_present === true;
    if (o.rotation_ok !== rotation_ok) violations++;
    const scopes_ok = pp.tool_grants.length > 0 && ungated.length === 0;
    if (o.scopes_ok !== scopes_ok) violations++;
    if (o.audit_pass !== (scopes_ok && revocable && rotation_ok)) violations++;
  }
  return { name: 'P2_audit_flags_differential', trials: checked, violations };
}

// ---------- P3: boundedness — audit_pass is a pure AND, token_age_s exact ----------
function checkP3_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomInput(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.audit_pass && !(o.scopes_ok && o.revocable && o.rotation_ok)) violations++;
    if (o.token_age_s !== (pp.now_unix - pp.token_created_unix)) violations++;
  }
  return { name: 'P3_audit_pass_and_age_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — granting scope to an ungated tool removes it from ungated_tools ----------
function checkP4_monotonicity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomInput(rand);
    const before = compute(pp).output_payload;
    if (before.ungated_tools.length === 0) { checked++; continue; }
    const fixedGrants = pp.tool_grants.map((g) => (g && Array.isArray(g.scopes) && g.scopes.length > 0) ? g : { ...g, scopes: ['granted:scope'] });
    const after = compute({ ...pp, tool_grants: fixedGrants }).output_payload;
    checked++;
    if (after.ungated_tools.length !== 0) violations++;
    // raising max_token_age_s never turns a passing rotation_ok false
    const raised = compute({ ...pp, max_token_age_s: pp.max_token_age_s + 100000 }).output_payload;
    if (before.rotation_ok && !raised.rotation_ok) violations++;
  }
  return { name: 'P4_monotone_scope_grant_and_age_raise', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_bounded());
results.properties.push(checkP4_monotonicity());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-150-mcp-tool-scope-revocation-auditor',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
