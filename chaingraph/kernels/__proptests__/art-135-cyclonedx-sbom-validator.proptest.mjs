// art-135-cyclonedx-sbom-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C3-1).
// kernel_digest_at_authoring: sha256:3f160ab65134e8918e39f71151aed591c8cd27e82ed90f22cff146f7fa75fcd1
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (string-equality/set-membership + array-index counting only).
// Checks: fixture-oracle gate, termination (components_missing_purl indices bounded by
// components.length), differential re-derivation of sbom_valid from the four underlying
// conditions, and metamorphic permutation-invariance of the components array under an
// index-relabeling equivalence (component validity per-slot is preserved under a fixed
// permutation; the count of malformed components is order-independent).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-135-cyclonedx-sbom-validator.proptest.mjs

import { compute } from '../art-135-cyclonedx-sbom-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-135-cyclonedx-sbom-validator.fixtures.json');
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
const rand = mulberry32(0x135D3);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function maybe(rng, v, p = 0.7) { return rng() < p ? v : undefined; }

function randomComponent(rng, i) {
  return { name: maybe(rng, `pkg-${i}`), version: maybe(rng, '1.0.0'), purl: maybe(rng, `pkg:npm/pkg-${i}@1.0.0`) };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  return {
    sbom: {
      bomFormat: pick(rng, ['CycloneDX', 'SPDX']),
      specVersion: pick(rng, ['1.4', '1.5', '1.6', '1.0']),
      components: Array.from({ length: n }, (_, i) => randomComponent(rng, i)),
      dependencies: Array.from({ length: Math.floor(rng() * 4) }, (_, i) => ({ ref: `dep-${i}` })),
    },
  };
}

const TRIALS = 5000;

// ---------- P1: termination — components_missing_purl indices bounded by components.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.component_count !== pp.sbom.components.length) violations++;
    if (output_payload.components_missing_purl.length > pp.sbom.components.length) violations++;
    for (const idx of output_payload.components_missing_purl) {
      if (idx < 0 || idx >= pp.sbom.components.length) violations++;
    }
  }
  return { name: 'P1_termination_missing_purl_bounded', trials: checked, violations };
}

// ---------- P2 (differential): sbom_valid re-derivation ----------
function checkP2_validity_differential() {
  let violations = 0, checked = 0;
  const SUPPORTED = ['1.4', '1.5', '1.6'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const format_ok = pp.sbom.bomFormat === 'CycloneDX';
    const spec_ok = SUPPORTED.includes(String(pp.sbom.specVersion));
    const components = pp.sbom.components;
    const expectedMissing = components.map((c, i) => ((c && c.name && c.version && c.purl) ? null : i)).filter((i) => i !== null);
    const has_dependencies = Array.isArray(pp.sbom.dependencies) && pp.sbom.dependencies.length > 0;
    const expectedValid = format_ok && spec_ok && components.length > 0 && expectedMissing.length === 0 && has_dependencies;
    if (JSON.stringify(output_payload.components_missing_purl) !== JSON.stringify(expectedMissing)) violations++;
    if (output_payload.has_dependencies !== has_dependencies) violations++;
    if (output_payload.sbom_valid !== expectedValid) violations++;
  }
  return { name: 'P2_validity_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance (malformed-component COUNT is order-independent) ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rand() * 8);
    const components = Array.from({ length: n }, (_, i) => randomComponent(rand, i));
    const dependencies = Array.from({ length: Math.floor(rand() * 4) }, (_, i) => ({ ref: `dep-${i}` }));
    const sbom = { bomFormat: 'CycloneDX', specVersion: '1.5', components, dependencies };
    const shuffledSbom = { ...sbom, components: shuffle(rand, components) };
    const r1 = compute({ sbom }).output_payload;
    const r2 = compute({ sbom: shuffledSbom }).output_payload;
    checked++;
    if (r1.sbom_valid !== r2.sbom_valid) violations++;
    if (r1.components_missing_purl.length !== r2.components_missing_purl.length) violations++;
    if (r1.component_count !== r2.component_count) violations++;
  }
  return { name: 'P3_permutation_invariance_components', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_validity_differential());
results.properties.push(checkP3_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-135-cyclonedx-sbom-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
