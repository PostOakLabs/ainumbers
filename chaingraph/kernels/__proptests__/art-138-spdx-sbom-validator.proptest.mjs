// art-138-spdx-sbom-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C4-1).
// kernel_digest_at_authoring: sha256:72aba0699f8a03e3cc099b887c437ef7f1a801c5284b6e00d616419870a71ef6
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (regex/type/set-membership boolean logic + array indexing only, no arithmetic).
// Checks: fixture-oracle gate, termination (packages_missing_version bounded by packages.length),
// boundedness (every missing-version index in range), differential re-derivation of sbom_valid,
// and metamorphic prefix-invariance (appending packages leaves earlier missing-version indices intact).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-138-spdx-sbom-validator.proptest.mjs

import { compute } from '../art-138-spdx-sbom-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-138-spdx-sbom-validator.fixtures.json');
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
const rand = mulberry32(0x138A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const VERSIONS = ['SPDX-2.2', 'SPDX-2.3', 'SPDX-3.0', 'bogus', undefined];

function randomPackage(rng) {
  const has_name = rng() < 0.85;
  const has_ver = rng() < 0.7;
  const loc_style = pick(rng, ['downloadLocation', 'purl', 'none']);
  return {
    name: has_name ? 'pkg' : undefined,
    versionInfo: has_ver ? '1.0.0' : undefined,
    downloadLocation: loc_style === 'downloadLocation' ? 'https://example.com/pkg.tgz' : undefined,
    externalRefs: loc_style === 'purl' ? [{ referenceType: 'purl', referenceLocator: 'pkg:generic/pkg@1.0' }] : undefined,
  };
}

function randomSbom(rng, n) {
  const has_relationships = rng() < 0.7;
  return {
    spdxVersion: pick(rng, VERSIONS),
    SPDXID: rng() < 0.9 ? 'SPDXRef-DOCUMENT' : '',
    packages: Array.from({ length: n }, () => randomPackage(rng)),
    relationships: has_relationships ? [{ spdxElementId: 'SPDXRef-DOCUMENT', relationshipType: 'DESCRIBES', relatedSpdxElement: 'SPDXRef-Package-x' }] : [],
  };
}

const TRIALS = 5000;

// ---------- P1: termination — packages_missing_version bounded by packages.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 10);
    const sbom = randomSbom(rand, n);
    const { output_payload } = compute({ sbom });
    checked++;
    if (output_payload.package_count !== n) violations++;
    if (output_payload.packages_missing_version.length > n) violations++;
  }
  return { name: 'P1_termination_bounded_by_packages_length', trials: checked, violations };
}

// ---------- P2 (differential): re-derive sbom_valid and packages_missing_version ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 10);
    const sbom = randomSbom(rand, n);
    const { output_payload: o } = compute({ sbom });
    checked++;
    const version_ok = typeof sbom.spdxVersion === 'string' && /^SPDX-(2\.[0-9]+|3\.[0-9]+)$/.test(sbom.spdxVersion);
    const doc_id_ok = typeof sbom.SPDXID === 'string' && sbom.SPDXID.length > 0;
    const missing = sbom.packages.map((p, idx) => {
      const has_name = p && p.name;
      const has_ver = p && p.versionInfo;
      const has_loc = p && (p.downloadLocation || (Array.isArray(p.externalRefs) && p.externalRefs.some((r) => r && r.referenceType === 'purl')));
      return (has_name && has_ver && has_loc) ? null : idx;
    }).filter((x) => x !== null);
    if (JSON.stringify(o.packages_missing_version) !== JSON.stringify(missing)) violations++;
    const has_relationships = Array.isArray(sbom.relationships) && sbom.relationships.length > 0;
    const expected_valid = version_ok && doc_id_ok && n > 0 && missing.length === 0 && has_relationships;
    if (o.sbom_valid !== expected_valid) violations++;
    if (o.has_relationships !== has_relationships) violations++;
  }
  return { name: 'P2_sbom_valid_differential', trials: checked, violations };
}

// ---------- P3: boundedness — every missing-version index in [0, n-1] ----------
function checkP3_index_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 10);
    const sbom = randomSbom(rand, n);
    const { output_payload } = compute({ sbom });
    checked++;
    for (const idx of output_payload.packages_missing_version) {
      if (idx < 0 || idx >= n) violations++;
    }
  }
  return { name: 'P3_missing_version_index_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — prefix-invariance (appending packages leaves earlier indices intact) ----------
function checkP4_prefix_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rand() * 6);
    const base = randomSbom(rand, n);
    const extraN = Math.floor(rand() * 4);
    const extra = Array.from({ length: extraN }, () => randomPackage(rand));
    const extended = { ...base, packages: base.packages.concat(extra) };
    const r1 = compute({ sbom: base }).output_payload;
    const r2 = compute({ sbom: extended }).output_payload;
    checked++;
    const prefixMissing = r2.packages_missing_version.filter((idx) => idx < n);
    if (JSON.stringify(r1.packages_missing_version) !== JSON.stringify(prefixMissing)) violations++;
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
  tool_id: 'art-138-spdx-sbom-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
