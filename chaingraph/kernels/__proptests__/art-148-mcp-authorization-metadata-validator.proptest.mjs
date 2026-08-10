// art-148-mcp-authorization-metadata-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C4-1).
// kernel_digest_at_authoring: sha256:3165d9c916ead557ee007631e3a0dd32f84782a04aa5df796c776d31c963bd8b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (regex/type/set-membership boolean logic + array length checks only).
// Checks: fixture-oracle gate, termination (missing[] bounded by the fixed 4-field checklist, not by
// any unbounded input — the unbounded inputs here are auth_servers/scopes/bearer arrays, each summarized
// to a count or a boolean, never iterated into an unbounded output), boundedness (missing entries drawn
// only from the fixed 4-name set), differential re-derivation of metadata_valid and missing[], and
// metamorphic monotonicity (adding a well-formed bearer method to an already-ok list never flips
// bearer_ok to false; adding any scope never decreases scope_count).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-148-mcp-authorization-metadata-validator.proptest.mjs

import { compute } from '../art-148-mcp-authorization-metadata-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-148-mcp-authorization-metadata-validator.fixtures.json');
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
const rand = mulberry32(0x148A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const BEARER = ['header', 'body', 'query', 'cookie'];

function randomMetadata(rng) {
  const has_resource = rng() < 0.8;
  const nServers = Math.floor(rng() * 4);
  const nScopes = Math.floor(rng() * 4);
  const nBearer = Math.floor(rng() * 4);
  return {
    resource: has_resource ? (rng() < 0.7 ? 'https://api.example.com/mcp' : 'not-a-url') : undefined,
    authorization_servers: Array.from({ length: nServers }, (_, i) => `https://auth${i}.example.com`),
    scopes_supported: Array.from({ length: nScopes }, (_, i) => `scope${i}`),
    bearer_methods_supported: Array.from({ length: nBearer }, () => pick(rng, BEARER)),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — missing[] length bounded by fixed 4-item checklist ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const metadata = randomMetadata(rand);
    const { output_payload } = compute({ metadata });
    checked++;
    if (output_payload.missing.length > 4) violations++;
  }
  return { name: 'P1_termination_missing_bounded_by_fixed_checklist', trials: checked, violations };
}

// ---------- P2 (differential): re-derive metadata_valid and missing[] ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const metadata = randomMetadata(rand);
    const { output_payload: o } = compute({ metadata });
    checked++;
    const resource_ok = typeof metadata.resource === 'string' && /^https?:\/\//.test(metadata.resource);
    const auth_servers = Array.isArray(metadata.authorization_servers) ? metadata.authorization_servers : [];
    const scopes = Array.isArray(metadata.scopes_supported) ? metadata.scopes_supported : [];
    const bearer = Array.isArray(metadata.bearer_methods_supported) ? metadata.bearer_methods_supported : [];
    const bearer_ok = bearer.length === 0 || bearer.every((b) => ['header', 'body', 'query'].includes(b));
    const expected_valid = resource_ok && auth_servers.length > 0 && scopes.length > 0 && bearer_ok;
    if (o.metadata_valid !== expected_valid) violations++;
    if (o.resource_ok !== resource_ok) violations++;
    if (o.auth_server_count !== auth_servers.length) violations++;
    if (o.scope_count !== scopes.length) violations++;
    if (o.bearer_ok !== bearer_ok) violations++;
    const missing = [];
    if (!resource_ok) missing.push('RESOURCE');
    if (auth_servers.length === 0) missing.push('AUTHORIZATION_SERVERS');
    if (scopes.length === 0) missing.push('SCOPES_SUPPORTED');
    if (!bearer_ok) missing.push('BEARER_METHODS_UNRECOGNIZED');
    if (JSON.stringify(o.missing) !== JSON.stringify(missing)) violations++;
  }
  return { name: 'P2_valid_and_missing_differential', trials: checked, violations };
}

// ---------- P3: boundedness — missing entries drawn only from the fixed 4-name set ----------
function checkP3_bounded() {
  const NAMES = ['RESOURCE', 'AUTHORIZATION_SERVERS', 'SCOPES_SUPPORTED', 'BEARER_METHODS_UNRECOGNIZED'];
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const metadata = randomMetadata(rand);
    const { output_payload } = compute({ metadata });
    checked++;
    for (const m of output_payload.missing) if (!NAMES.includes(m)) violations++;
  }
  return { name: 'P3_missing_names_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — adding a scope never decreases scope_count; extra well-formed bearer never flips bearer_ok true->false ----------
function checkP4_monotonicity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const metadata = randomMetadata(rand);
    const before = compute({ metadata }).output_payload;
    const extended = { ...metadata, scopes_supported: (metadata.scopes_supported || []).concat(['extra:scope']) };
    const after = compute({ metadata: extended }).output_payload;
    checked++;
    if (after.scope_count < before.scope_count) violations++;
    if (before.bearer_ok) {
      const extendedBearer = { ...metadata, bearer_methods_supported: (metadata.bearer_methods_supported || []).concat(['header']) };
      const afterBearer = compute({ metadata: extendedBearer }).output_payload;
      if (!afterBearer.bearer_ok) violations++;
    }
  }
  return { name: 'P4_monotone_scope_and_bearer_append', trials: checked, violations };
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
  tool_id: 'art-148-mcp-authorization-metadata-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
