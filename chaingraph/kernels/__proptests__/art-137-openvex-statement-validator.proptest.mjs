// art-137-openvex-statement-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C4-1).
// kernel_digest_at_authoring: sha256:676d999d882d7e4a0d0e97841723ed8a0c8b3440fd079227c910c1945058a0de
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (pure string/type/enum-membership boolean logic, no arithmetic anywhere).
// Checks: fixture-oracle gate, termination (invalid_statements.length bounded by statements.length),
// boundedness (every invalid_statements index in range), differential re-derivation of vex_valid,
// and metamorphic prefix-invariance (appending statements never changes an earlier statement's flags).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-137-openvex-statement-validator.proptest.mjs

import { compute } from '../art-137-openvex-statement-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-137-openvex-statement-validator.fixtures.json');
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
const rand = mulberry32(0x137A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const STATUS = ['not_affected', 'affected', 'fixed', 'under_investigation', 'bogus_status'];

function randomStatement(rng) {
  const has_vuln = rng() < 0.8;
  const has_products = rng() < 0.8;
  const status = pick(rng, STATUS);
  const has_just = rng() < 0.6;
  return {
    vulnerability: has_vuln ? (rng() < 0.5 ? 'CVE-2026-X' : { name: 'CVE-2026-X' }) : undefined,
    products: has_products ? [`pkg:generic/x@${Math.floor(rng() * 9)}`] : [],
    status,
    justification: has_just ? 'component_not_present' : undefined,
  };
}

function randomVex(rng, n) {
  const has_context = rng() < 0.8;
  return { '@context': has_context ? 'https://openvex.dev/ns/v0.2.0' : undefined, statements: Array.from({ length: n }, () => randomStatement(rng)) };
}

const TRIALS = 5000;

// ---------- P1: termination — invalid_statements.length bounded by statements.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 10);
    const vex = randomVex(rand, n);
    const { output_payload } = compute({ vex });
    checked++;
    if (output_payload.statement_count !== n) violations++;
    if (output_payload.invalid_statements.length > n) violations++;
  }
  return { name: 'P1_termination_bounded_by_statements_length', trials: checked, violations };
}

// ---------- P2 (differential): re-derive vex_valid and each invalid_statements row ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 10);
    const vex = randomVex(rand, n);
    const { output_payload: o } = compute({ vex });
    checked++;
    const context_ok = typeof vex['@context'] === 'string' || Array.isArray(vex['@context']);
    if (o.context_ok !== context_ok) violations++;
    const invalid = [];
    vex.statements.forEach((s, idx) => {
      const has_vuln = !!(s && (s.vulnerability && (typeof s.vulnerability === 'string' || s.vulnerability.name || s.vulnerability['@id'])));
      const has_products = Array.isArray(s && s.products) && s.products.length > 0;
      const status_ok = s && STATUS.slice(0, 4).includes(s.status);
      const just_ok = !(s && s.status === 'not_affected') || (typeof s.justification === 'string' && s.justification.length > 0);
      if (!(has_vuln && has_products && status_ok && just_ok)) invalid.push(idx);
    });
    const reported = o.invalid_statements.map((x) => x.index);
    if (JSON.stringify(reported) !== JSON.stringify(invalid)) violations++;
    const expected_valid = context_ok && n > 0 && invalid.length === 0;
    if (o.vex_valid !== expected_valid) violations++;
  }
  return { name: 'P2_vex_valid_differential', trials: checked, violations };
}

// ---------- P3: boundedness — every invalid_statements index in [0, n-1] ----------
function checkP3_index_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 10);
    const vex = randomVex(rand, n);
    const { output_payload } = compute({ vex });
    checked++;
    for (const row of output_payload.invalid_statements) {
      if (row.index < 0 || row.index >= n) violations++;
    }
  }
  return { name: 'P3_invalid_index_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — prefix-invariance (appending statements leaves earlier flags unchanged) ----------
function checkP4_prefix_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rand() * 6);
    const base = randomVex(rand, n);
    const extraN = Math.floor(rand() * 4);
    const extra = Array.from({ length: extraN }, () => randomStatement(rand));
    const extended = { ...base, statements: base.statements.concat(extra) };
    const r1 = compute({ vex: base }).output_payload;
    const r2 = compute({ vex: extended }).output_payload;
    checked++;
    const prefixInvalid = r2.invalid_statements.filter((x) => x.index < n);
    if (JSON.stringify(r1.invalid_statements) !== JSON.stringify(prefixInvalid)) violations++;
  }
  return { name: 'P4_prefix_invariance_on_append', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_index_bounded());
results.properties.push(checkP4_prefix_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-137-openvex-statement-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
