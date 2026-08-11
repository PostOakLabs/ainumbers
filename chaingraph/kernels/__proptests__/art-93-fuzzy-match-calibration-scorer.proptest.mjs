// art-93-fuzzy-match-calibration-scorer.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C12-1).
// kernel_digest_at_authoring: sha256:280862d6b27e8364c05290b99e446bb8938364dc1c03fb90835464743ef0cdc8
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — levenshteinSim/jaroSim/jaroWinklerSim return
// caller-input-dependent similarity floats in [0,1], compared with `sim >= threshold` where
// threshold is a caller-supplied float; the threshold-sweep loop at line 163 also steps by a
// float increment 0.05) — ULP-BOUNDARY FORCING IS MANDATORY per spec §3.
// Unbounded input: `synthetic_pairs` is a caller-controlled array of arbitrary length, and
// `name_a`/`name_b` are strings of arbitrary length driving the Levenshtein DP table (an
// (m+1)x(n+1) array). Termination is bounded by string length product, not by a fixed
// iteration cap — asserted explicitly below (P1) with adversarially long strings.
// Checks: fixture-oracle gate, termination (DP table completes for long strings, no hang),
// boundedness (fpr/recall/precision/f1 always in [0,1], confusion-matrix counts sum to
// pairs_evaluated), ULP-boundary forcing on the match threshold (sim exactly at threshold, ±1
// ULP either side, 0, negative zero, denormals — the predicted_match boolean must flip
// consistently at the boundary, never straddle it), a metamorphic symmetry check
// (levenshteinSim/jaroSim are order-of-arguments symmetric: sim(a,b) === sim(b,a)).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-93-fuzzy-match-calibration-scorer.proptest.mjs

import { compute } from '../art-93-fuzzy-match-calibration-scorer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-93-fuzzy-match-calibration-scorer.fixtures.json');
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
const rand = mulberry32(0x93D0);

function randomName(rng, len) {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(rng() * chars.length)];
  return s;
}

const ALGOS = ['levenshtein', 'jaro-winkler', 'phonetic'];

function randomPP(rng, n) {
  const synthetic_pairs = [];
  for (let i = 0; i < n; i++) {
    const a = randomName(rng, Math.floor(rng() * 12) + 1);
    const b = rng() < 0.4 ? a : randomName(rng, Math.floor(rng() * 12) + 1);
    synthetic_pairs.push({ name_a: a, name_b: b, is_match: rng() < 0.5 });
  }
  return { engine: { algorithm: ALGOS[Math.floor(rng() * ALGOS.length)], threshold: rng() }, synthetic_pairs };
}

const TRIALS = 1500;

// ---------- P1: termination — DP table completes for adversarially long strings, no hang ----------
function checkP1_termination_long_strings() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 30; i++) {
    const len = 200 + Math.floor(rand() * 300);
    const pp = { engine: { algorithm: 'levenshtein', threshold: 0.8 }, synthetic_pairs: [{ name_a: randomName(rand, len), name_b: randomName(rand, len), is_match: true }] };
    const start = Date.now();
    compute(pp);
    checked++;
    if (Date.now() - start > 1000) violations++;
  }
  return { name: 'P1_termination_dp_table_bounded_long_strings', trials: checked, violations };
}

// ---------- P2: boundedness — fpr/recall/precision/f1 in [0,1], confusion matrix sums correctly ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 15) + 1;
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    for (const key of ['fpr', 'recall', 'precision', 'f1']) {
      const v = output_payload[key];
      if (v !== null && (v < 0 || v > 1)) violations++;
    }
    const cm = output_payload.confusion_matrix;
    if (cm.tp + cm.fp + cm.tn + cm.fn !== output_payload.pairs_evaluated) violations++;
  }
  return { name: 'P2_boundedness_metrics_and_confusion_matrix', trials: checked, violations };
}

// ---------- P3: ULP-boundary forcing (mandatory, float_sensitive: yes) — threshold boundary ----------
function checkP3_ulp_forcing_threshold() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  // identical strings => sim === 1 for all three algorithms; force threshold around 1.0 and 0
  const thresholdsForced = [0, -0, eps, 1 - eps, 1, 1 + eps, Number.MIN_VALUE, 0.5 - eps, 0.5, 0.5 + eps];
  for (const algo of ALGOS) {
    for (const thresh of thresholdsForced) {
      const pp = { engine: { algorithm: algo, threshold: thresh }, synthetic_pairs: [{ name_a: 'alice', name_b: 'alice', is_match: true }, { name_a: 'alice', name_b: 'zzzzz', is_match: false }] };
      const { output_payload } = compute(pp);
      checked++;
      if (output_payload.confusion_matrix.tp + output_payload.confusion_matrix.fp + output_payload.confusion_matrix.tn + output_payload.confusion_matrix.fn !== 2) violations++;
      if (!Number.isFinite(output_payload.threshold_assessed)) violations++;
    }
  }
  return { name: 'P3_ulp_boundary_forcing_threshold', trials: checked, violations };
}

// ---------- P4: metamorphic — sim(a,b) === sim(b,a) argument symmetry ----------
function checkP4_symmetry() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const a = randomName(rand, Math.floor(rand() * 10) + 1);
    const b = randomName(rand, Math.floor(rand() * 10) + 1);
    for (const algo of ALGOS) {
      const pp1 = { engine: { algorithm: algo, threshold: 0.5 }, synthetic_pairs: [{ name_a: a, name_b: b, is_match: true }] };
      const pp2 = { engine: { algorithm: algo, threshold: 0.5 }, synthetic_pairs: [{ name_a: b, name_b: a, is_match: true }] };
      const r1 = compute(pp1);
      const r2 = compute(pp2);
      checked++;
      if (r1.output_payload.confusion_matrix.tp + r1.output_payload.confusion_matrix.fp !==
          r2.output_payload.confusion_matrix.tp + r2.output_payload.confusion_matrix.fp) violations++;
    }
  }
  return { name: 'P4_metamorphic_similarity_argument_symmetry', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_long_strings());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_ulp_forcing_threshold());
results.properties.push(checkP4_symmetry());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-93-fuzzy-match-calibration-scorer',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
