// art-102-crypto-asset-whitepaper-linter.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C2-1).
// kernel_digest_at_authoring: sha256:0d1c9a8705e0308f72420985fe902d83fa6bf9181650ec1939bfcc4d60dfd150
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (categorical section-completeness checks and integer gap counts only).
// Checks: fixture-oracle gate, termination (array-bounded, gap_count <= 10 known required sections),
// conformance_grade decision-table differential re-derivation, boundedness (gaps subset of the known
// section list), and permutation-invariance of the annex_i_sections array.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-102-crypto-asset-whitepaper-linter.proptest.mjs

import { compute } from '../art-102-crypto-asset-whitepaper-linter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const REQUIRED_SECTIONS = [
  'identity-of-offeror', 'description-of-project', 'description-of-crypto-asset', 'rights-obligations',
  'technology', 'risks', 'principal-adverse-impacts', 'conflicts-of-interest', 'fees-and-charges', 'regulatory-status',
];

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-102-crypto-asset-whitepaper-linter.fixtures.json');
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
const rand = mulberry32(0xA02A1);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const FORMATS = ['ixbrl', 'pdf', 'html', 'other'];
const TAXONOMY_VERSIONS = ['ESMA-MiCA-2026.1', 'ESMA-MiCA-2025.2', 'other-taxonomy-v1', ''];
const STATUSES = ['complete', 'partial', 'missing'];

function randomInputs(rng) {
  const nSections = Math.floor(rng() * (REQUIRED_SECTIONS.length + 3));
  const chosen = shuffle(rng, REQUIRED_SECTIONS.slice()).slice(0, Math.min(nSections, REQUIRED_SECTIONS.length));
  const annex_i_sections = chosen.map((section) => ({ section, status: pick(rng, STATUSES) }));
  return {
    inputs: {
      annex_i_sections,
      format: pick(rng, FORMATS),
      taxonomy_version: pick(rng, TAXONOMY_VERSIONS),
      crypto_asset_type: pick(rng, ['art', 'emt', 'other-than-art-emt']),
    },
  };
}

const TRIALS = 5000;

// ---------- P1: termination — sections_checked bounded by input length, gap_count in [0,10] ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomInputs(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.sections_checked !== pp.inputs.annex_i_sections.length) violations++;
    if (output_payload.annex_i_gaps.length < 0 || output_payload.annex_i_gaps.length > REQUIRED_SECTIONS.length) violations++;
  }
  return { name: 'P1_termination_bounded_gaps', trials: checked, violations };
}

// ---------- P2 (differential): conformance_grade decision table re-derivation ----------
function classifyGrade(noSections, gapCount, ixbrlValid, taxonomyConformant) {
  if (!noSections && gapCount === 0 && ixbrlValid && taxonomyConformant) return 'A';
  if (!noSections && gapCount === 0 && ixbrlValid && !taxonomyConformant) return 'B';
  if (!noSections && gapCount === 0 && !ixbrlValid) return 'B';
  if (!noSections && gapCount >= 1 && gapCount <= 2) return 'C';
  if (!noSections && gapCount >= 3 && gapCount <= 4) return 'D';
  return 'F';
}
function checkP2_grade_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomInputs(rand);
    const { output_payload } = compute(pp);
    checked++;
    const noSections = pp.inputs.annex_i_sections.length === 0;
    const expected = classifyGrade(noSections, output_payload.annex_i_gaps.length, output_payload.ixbrl_valid, output_payload.taxonomy_conformant);
    if (output_payload.conformance_grade !== expected) violations++;
  }
  return { name: 'P2_conformance_grade_differential', trials: checked, violations };
}

// ---------- P3: boundedness — every reported gap is one of the 10 known required sections ----------
function checkP3_gaps_subset() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomInputs(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const g of output_payload.annex_i_gaps) {
      if (!REQUIRED_SECTIONS.includes(g)) violations++;
    }
  }
  return { name: 'P3_gaps_subset_of_known_sections', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of annex_i_sections order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomInputs(rand);
    const shuffled = { inputs: { ...pp.inputs, annex_i_sections: shuffle(rand, pp.inputs.annex_i_sections) } };
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.conformance_grade !== r2.conformance_grade) violations++;
    if (JSON.stringify(r1.annex_i_gaps.slice().sort()) !== JSON.stringify(r2.annex_i_gaps.slice().sort())) violations++;
  }
  return { name: 'P4_permutation_invariance_sections', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_grade_differential());
results.properties.push(checkP3_gaps_subset());
results.properties.push(checkP4_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-102-crypto-asset-whitepaper-linter',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
