// art-149-mcp-registry-entry-conformance.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C4-1).
// kernel_digest_at_authoring: sha256:490f01e12e64fd3fd247586762fcc49a28e499af0f6bff4bbe0cc992e630448e
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (regex/type/array-length boolean logic only).
// Checks: fixture-oracle gate, termination (missing[] bounded by the fixed 4-item checklist),
// boundedness (missing entries drawn only from the fixed name set), differential re-derivation of
// entry_valid and missing[] against the same schema/name/semver/endpoint regexes, and metamorphic
// invariance (adding an unrelated extra package entry never flips has_packages from true to false, and
// never changes name_ok/version_ok/schema_ok which depend only on scalar fields).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-149-mcp-registry-entry-conformance.proptest.mjs

import { compute } from '../art-149-mcp-registry-entry-conformance.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-149-mcp-registry-entry-conformance.fixtures.json');
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
const rand = mulberry32(0x149A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const NAMES = ['com.example/my-server', 'my-server', 'io.acme/pay-mcp', 'BAD NAME', 'a/b'];
const VERSIONS = ['1.0.0', '2.1.3', 'v1.0', '1.0', ''];

function randomEntry(rng) {
  const has_schema = rng() < 0.8;
  const has_packages = rng() < 0.5;
  const has_remotes = rng() < 0.5;
  return {
    $schema: has_schema ? 'https://registry.mcp.io/schema/server.json' : undefined,
    name: pick(rng, NAMES),
    version: pick(rng, VERSIONS),
    packages: has_packages ? [{ registry: 'npm', name: 'x' }] : undefined,
    remotes: has_remotes ? [{ url: 'https://x.example.com/mcp' }] : undefined,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — missing[] length bounded by fixed 4-item checklist ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const entry = randomEntry(rand);
    const { output_payload } = compute({ entry });
    checked++;
    if (output_payload.missing.length > 4) violations++;
  }
  return { name: 'P1_termination_missing_bounded_by_fixed_checklist', trials: checked, violations };
}

// ---------- P2 (differential): re-derive entry_valid and missing[] ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const entry = randomEntry(rand);
    const { output_payload: o } = compute({ entry });
    checked++;
    const schema_ok = typeof entry.$schema === 'string' && entry.$schema.length > 0;
    const name_ok = typeof entry.name === 'string' && /^[a-z0-9.-]+\/[a-z0-9._-]+$/i.test(entry.name);
    const version_ok = typeof entry.version === 'string' && /^\d+\.\d+\.\d+/.test(entry.version);
    const has_packages = Array.isArray(entry.packages) && entry.packages.length > 0;
    const has_remotes = Array.isArray(entry.remotes) && entry.remotes.length > 0;
    const has_endpoint = has_packages || has_remotes;
    const expected_valid = schema_ok && name_ok && version_ok && has_endpoint;
    if (o.entry_valid !== expected_valid) violations++;
    if (o.schema_ok !== schema_ok) violations++;
    if (o.name_ok !== name_ok) violations++;
    if (o.version_ok !== version_ok) violations++;
    if (o.has_packages !== has_packages) violations++;
    if (o.has_remotes !== has_remotes) violations++;
    const missing = [];
    if (!schema_ok) missing.push('$schema');
    if (!name_ok) missing.push('NAME_REVERSE_DNS');
    if (!version_ok) missing.push('SEMVER_VERSION');
    if (!has_endpoint) missing.push('PACKAGES_OR_REMOTES');
    if (JSON.stringify(o.missing) !== JSON.stringify(missing)) violations++;
  }
  return { name: 'P2_valid_and_missing_differential', trials: checked, violations };
}

// ---------- P3: boundedness — missing entries drawn only from the fixed 4-name set ----------
function checkP3_bounded() {
  const NAMES_SET = ['$schema', 'NAME_REVERSE_DNS', 'SEMVER_VERSION', 'PACKAGES_OR_REMOTES'];
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const entry = randomEntry(rand);
    const { output_payload } = compute({ entry });
    checked++;
    for (const m of output_payload.missing) if (!NAMES_SET.includes(m)) violations++;
  }
  return { name: 'P3_missing_names_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — adding a remotes entry never flips has_remotes true->false, scalar flags unchanged ----------
function checkP4_append_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const entry = randomEntry(rand);
    const before = compute({ entry }).output_payload;
    const extended = { ...entry, remotes: (entry.remotes || []).concat([{ url: 'https://extra.example.com/mcp' }]) };
    const after = compute({ entry: extended }).output_payload;
    checked++;
    if (!after.has_remotes) violations++;
    if (after.schema_ok !== before.schema_ok) violations++;
    if (after.name_ok !== before.name_ok) violations++;
    if (after.version_ok !== before.version_ok) violations++;
  }
  return { name: 'P4_append_invariance_remotes', trials: checked, violations };
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
results.properties.push(checkP4_append_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-149-mcp-registry-entry-conformance',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
