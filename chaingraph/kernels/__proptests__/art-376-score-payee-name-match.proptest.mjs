// art-376-score-payee-name-match.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C17-1).
// kernel_digest_at_authoring: sha256:de422d2d169f590fa61cfe8f37060bd7af2944def5730c83f77b88c6ed538871
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO -- re-confirmed by direct read: score is an INTEGER 0-100 via floor
// integer division only (`100 - Math.floor((d*100)/maxLen)`), no float comparison anywhere in
// the scoring path. Forced CATEGORICAL boundary cases used instead of ULP-forcing (below).
// Checks: fixture-oracle gate, termination (unbounded string-length input drives the O(la*lb)
// Levenshtein DP -- bound is `min(la,lb)+1` rows kept live at once, and the loop terminates by
// construction on `la`/`lb`, tested with long strings), boundedness (score always in [0,100]),
// metamorphic (score(A,B) === score(B,A) -- both plainScore/tokenScore are built on a symmetric
// Levenshtein distance, so swapping account_name/reference_name is score-invariant), forced
// categorical boundary cases (empty strings, identical strings, entity-suffix stripping,
// diacritic normalization, totally disjoint strings).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-376-score-payee-name-match.proptest.mjs

import { compute } from '../art-376-score-payee-name-match.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-376-score-payee-name-match.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    // art-376's compute() returns the flat result object directly -- it IS the output_payload
    // (no {output_payload, compliance_flags} wrapper), confirmed by direct read and cross-checked
    // against this fixture file's shape.
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
const rand = mulberry32(0x376D0);

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz ';
function randomString(rng, len) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return s;
}

const TRIALS = 3000;

// ---------- P1: termination — O(la*lb) DP over unbounded-length strings; bound is string length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const lengths = [0, 1, 10, 100, 2000];
  for (const len of lengths) {
    const pp = { account_name: randomString(rand, len), reference_name: randomString(rand, len) };
    const out = compute(pp);
    checked++;
    if (!Number.isInteger(out.score)) violations++;
  }
  for (let i = 0; i < TRIALS; i++) {
    const la = Math.floor(rand() * 40);
    const lb = Math.floor(rand() * 40);
    const pp = { account_name: randomString(rand, la), reference_name: randomString(rand, lb) };
    const out = compute(pp);
    checked++;
    if (!Number.isInteger(out.score)) violations++;
  }
  return { name: 'P1_termination_dp_over_string_length', trials: checked, violations };
}

// ---------- P2: boundedness — score always in [0,100] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const la = Math.floor(rand() * 30);
    const lb = Math.floor(rand() * 30);
    const pp = { account_name: randomString(rand, la), reference_name: randomString(rand, lb), match_threshold: Math.floor(rand() * 100), close_match_threshold: Math.floor(rand() * 100) };
    const out = compute(pp);
    checked++;
    if (out.score < 0 || out.score > 100) violations++;
    if (!['MATCH', 'CLOSE_MATCH', 'NO_MATCH'].includes(out.match_band)) violations++;
  }
  return { name: 'P2_boundedness_score_in_0_100', trials: checked, violations };
}

// ---------- P3: metamorphic — score(A,B) === score(B,A), symmetric Levenshtein ----------
function checkP3_symmetry() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const la = Math.floor(rand() * 25);
    const lb = Math.floor(rand() * 25);
    const a = randomString(rand, la), b = randomString(rand, lb);
    const forward = compute({ account_name: a, reference_name: b });
    const backward = compute({ account_name: b, reference_name: a });
    checked++;
    if (forward.score !== backward.score) violations++;
    if (forward.match_band !== backward.match_band) violations++;
  }
  return { name: 'P3_symmetry_score_a_b_equals_score_b_a', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float_sensitive: no) ----------
function checkP4_categorical_boundaries() {
  let violations = 0, checked = 0;
  const cases = [
    { account_name: '', reference_name: '', expectScore: 100 },
    { account_name: 'John Smith', reference_name: 'John Smith', expectScore: 100 },
    { account_name: 'John Smith', reference_name: '' },
    { account_name: '', reference_name: 'John Smith' },
    { account_name: 'Acme GmbH', reference_name: 'Acme', expectSuffixStripped: true },
    { account_name: 'José García', reference_name: 'Jose Garcia', expectScore: 100 }, // diacritic-stripped equal
    { account_name: 'zzzzzzzzzz', reference_name: 'aaaaaaaaaa' }, // totally disjoint
    { account_name: 'Smith John', reference_name: 'John Smith', expectScore: 100 }, // token-reorder via tokenSort
  ];
  for (const c of cases) {
    const out = compute({ account_name: c.account_name, reference_name: c.reference_name, match_threshold: 95, close_match_threshold: 80 });
    checked++;
    if (out.score < 0 || out.score > 100) violations++;
    if (c.expectScore !== undefined && out.score !== c.expectScore) violations++;
    if (c.expectSuffixStripped !== undefined && out.entity_suffix_stripped !== c.expectSuffixStripped) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_symmetry());
results.properties.push(checkP4_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-376-score-payee-name-match',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
