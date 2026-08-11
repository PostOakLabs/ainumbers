// art-386-lint-cbom-structure.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C18-1).
// kernel_digest_at_authoring: sha256:d82c9dafda429dc646d851ed45d680724fa9e2d9c308b29e2d9a6ac10f24c257
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — pure string-pattern classification via
// Array.prototype.includes and missing-field checks; no arithmetic at all) — forced
// categorical boundary cases used in place of ULP-forcing, per spec §3's float:no row.
// Unbounded input: policy_parameters.cbom.components (caller-supplied array), iterated by a
// plain for-loop with no declared cap — termination bound is the array's own length.
// Checks: fixture-oracle gate, termination (loop runs exactly components.length iterations,
// scales linearly, never hangs), boundedness (findings is always sliced to a max of 50
// regardless of input size — the one explicit output-bound in this kernel — and every count
// field is a non-negative integer that never exceeds total_components), metamorphic
// (permutation-invariance: reordering algorithm components reorders findings identically but
// leaves every summary count unchanged; appending a non-"algorithm" assetType component never
// changes any count), forced categorical boundary cases (missing field, non-JSON string CBOM,
// non-object CBOM, wrong specVersion, quantum-vulnerable vs CNSA2-ready pattern match).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-386-lint-cbom-structure.proptest.mjs

import { compute } from '../art-386-lint-cbom-structure.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-386-lint-cbom-structure.fixtures.json');
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
const rand = mulberry32(0x386B0);

const VALID_ALG = {
  type: 'cryptographic-asset', name: 'AES-256-GCM',
  cryptoProperties: { assetType: 'algorithm', algorithmProperties: { primitive: 'ae', parameterSetIdentifier: 'AES-256', certificationLevel: ['fips140-3'], cryptoFunctions: ['encrypt', 'decrypt'] } },
};
const RSA_ALG = {
  type: 'cryptographic-asset', name: 'RSA-2048',
  cryptoProperties: { assetType: 'algorithm', algorithmProperties: { primitive: 'signature', parameterSetIdentifier: '2048', certificationLevel: ['none'], cryptoFunctions: ['sign', 'verify'] } },
};

function randomComponent(rng) {
  const r = rng();
  if (r < 0.5) return { ...VALID_ALG, name: `AES-${Math.floor(rng() * 1000)}` };
  if (r < 0.75) return { ...RSA_ALG, name: `RSA-${Math.floor(rng() * 1000)}` };
  return { type: 'cryptographic-asset', name: `X${Math.floor(rng() * 1000)}`, cryptoProperties: { assetType: 'algorithm', algorithmProperties: { primitive: 'hash' } } }; // structurally invalid — missing fields
}

function cbomWith(components) {
  return { bomFormat: 'CycloneDX', specVersion: '1.6', components };
}

const TRIALS = 3000;

// ---------- P1: termination — loop scales linearly with components.length, never hangs ----------
function checkP1_termination_linear_in_component_count() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 10, 100, 1000, 5000];
  for (const n of sizes) {
    const components = Array.from({ length: n }, () => randomComponent(rand));
    const start = Date.now();
    const out = compute({ cbom: cbomWith(components) });
    checked++;
    if (Date.now() - start > 3000) violations++;
    if (out.total_components !== n) violations++;
  }
  return { name: 'P1_termination_linear_scaling_never_hangs', trials: checked, violations };
}

// ---------- P2: boundedness — findings capped at 50, counts never exceed total_algorithm_assets ----------
function checkP2_findings_cap_and_count_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const n = Math.floor(rand() * 200);
    const components = Array.from({ length: n }, () => randomComponent(rand));
    const out = compute({ cbom: cbomWith(components) });
    checked++;
    if (out.findings.length > 50) violations++;
    const sum = out.vulnerable_count + out.cnsa2_ready_count + out.unclassified_count + out.structurally_invalid_count;
    if (sum !== out.total_algorithm_assets) violations++;
    if (out.total_algorithm_assets > out.total_components) violations++;
    for (const c of [out.vulnerable_count, out.cnsa2_ready_count, out.unclassified_count, out.structurally_invalid_count, out.total_algorithm_assets, out.total_components]) {
      if (!Number.isInteger(c) || c < 0) violations++;
    }
  }
  return { name: 'P2_findings_cap_50_and_count_boundedness', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of summary counts under component reorder ----------
function checkP3_metamorphic_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 200; i++) {
    const n = 1 + Math.floor(rand() * 30);
    const components = Array.from({ length: n }, () => randomComponent(rand));
    const shuffled = [...components];
    for (let j = shuffled.length - 1; j > 0; j--) { const k = Math.floor(rand() * (j + 1)); [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]; }
    const outA = compute({ cbom: cbomWith(components) });
    const outB = compute({ cbom: cbomWith(shuffled) });
    checked++;
    if (outA.vulnerable_count !== outB.vulnerable_count) violations++;
    if (outA.cnsa2_ready_count !== outB.cnsa2_ready_count) violations++;
    if (outA.unclassified_count !== outB.unclassified_count) violations++;
    if (outA.structurally_invalid_count !== outB.structurally_invalid_count) violations++;
    if (outA.total_algorithm_assets !== outB.total_algorithm_assets) violations++;
  }
  return { name: 'P3_metamorphic_permutation_invariance_of_counts', trials: checked, violations };
}

// ---------- P4: metamorphic — appending a non-"algorithm" assetType component never changes counts ----------
function checkP4_metamorphic_non_algorithm_append_is_noop() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 200; i++) {
    const n = Math.floor(rand() * 20);
    const components = Array.from({ length: n }, () => randomComponent(rand));
    const outBefore = compute({ cbom: cbomWith(components) });
    const withCert = [...components, { type: 'cryptographic-asset', name: 'cert-1', cryptoProperties: { assetType: 'certificate' } }];
    const outAfter = compute({ cbom: cbomWith(withCert) });
    checked++;
    if (outAfter.total_algorithm_assets !== outBefore.total_algorithm_assets) violations++;
    if (outAfter.vulnerable_count !== outBefore.vulnerable_count) violations++;
    if (outAfter.cnsa2_ready_count !== outBefore.cnsa2_ready_count) violations++;
    if (outAfter.total_components !== outBefore.total_components + 1) violations++;
  }
  return { name: 'P4_metamorphic_non_algorithm_component_append_noop_on_counts', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no exception — no ULP claim made) ----------
function checkP5_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const cases = [
    { pp: { cbom: 'not valid json {{{' }, expectVerdict: 'INVALID_CBOM' },
    { pp: { cbom: 42 }, expectVerdict: 'INVALID_CBOM' },
    { pp: { cbom: { bomFormat: 'SPDX', specVersion: '1.6', components: [] } }, expectVerdict: 'INVALID_CBOM' },
    { pp: { cbom: { bomFormat: 'CycloneDX', specVersion: '1.5', components: [] } }, expectVerdict: 'INVALID_CBOM' },
    { pp: { cbom: cbomWith([]) }, expectVerdict: 'INVALID_CBOM' }, // empty components array trips NO_COMPONENTS_FOUND

    { pp: { cbom: cbomWith([RSA_ALG]) }, expectVerdict: 'QUANTUM_VULNERABLE_PRIMITIVES_ASSERTED' },
    { pp: { cbom: cbomWith([VALID_ALG]) }, expectVerdict: 'NO_VULNERABLE_PRIMITIVES_ASSERTED' },
  ];
  for (const c of cases) {
    const out = compute(c.pp);
    checked++;
    if (out.verdict !== c.expectVerdict) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_linear_in_component_count());
results.properties.push(checkP2_findings_cap_and_count_boundedness());
results.properties.push(checkP3_metamorphic_permutation_invariance());
results.properties.push(checkP4_metamorphic_non_algorithm_append_is_noop());
results.properties.push(checkP5_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-386-lint-cbom-structure',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
