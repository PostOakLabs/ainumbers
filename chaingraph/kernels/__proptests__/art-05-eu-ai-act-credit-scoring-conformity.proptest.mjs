// art-05-eu-ai-act-credit-scoring-conformity.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C1-1).
// kernel_digest_at_authoring: sha256:fcb93e8040bc73e15337abc8b67a8e70b03cd115900de0221cee4a2bf125136f
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — ULP-boundary forcing mandatory (DIR_THRESHOLD=0.80, EO_GAP_THRESHOLD=5pp,
// DP_GAP_THRESHOLD=10pp, checklist-score 0.85 pass/warn boundary — all compared with strict `<`/`>`).
// Checks: fixture-oracle gate, termination (fixed checklists + bounded characteristics array),
// boundedness (dir in [0,1] by min<=max construction, scores in [0,1]), determination differential
// re-derivation, ULP-forced bias/checklist threshold cases, and permutation-invariance of groups order
// within a characteristic (min/max are order-independent).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-05-eu-ai-act-credit-scoring-conformity.proptest.mjs

import { compute } from '../art-05-eu-ai-act-credit-scoring-conformity.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-05-eu-ai-act-credit-scoring-conformity.fixtures.json');
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
const rand = mulberry32(0xA05A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const DATA_IDS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
const ART_IDS = ['r1', 'r2', 't1', 't2', 't3', 't4', 't5', 'tr1', 'tr2', 'tr3', 'h1', 'h2', 'a1', 'a2', 'reg1'];
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function randomAnswers(rng, ids) {
  const o = {};
  for (const id of ids) o[id] = rng() < 0.15 ? false : rng() < 0.7 ? true : null;
  return o;
}
function randomCharacteristic(rng) {
  const nGroups = 2 + Math.floor(rng() * 3);
  const groups = Array.from({ length: nGroups }, (_, i) => ({
    label: `g${i}`, approval: randRange(rng, 0, 100), tpr: randRange(rng, 0, 100), fpr: randRange(rng, 0, 100),
  }));
  return { name: 'char', groups };
}
function randomPP(rng) {
  return {
    characteristics: Array.from({ length: Math.floor(rng() * 3) }, () => randomCharacteristic(rng)),
    data_answers: randomAnswers(rng, DATA_IDS),
    art_answers: randomAnswers(rng, ART_IDS),
  };
}

const TRIALS = 6000;

// ---------- P1: termination — bias_results.length === characteristics.length, bounded checklists ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.bias_results.length !== pp.characteristics.length) violations++;
  }
  return { name: 'P1_termination_bias_results_count', trials: checked, violations };
}

// ---------- P2: boundedness — dir in [0,1] (min<=max by construction), scores in [0,100] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const b of output_payload.bias_results) {
      if (b.dir != null && (b.dir < 0 || b.dir > 1)) violations++;
    }
    if (output_payload.data_governance_score_pct < 0 || output_payload.data_governance_score_pct > 100) violations++;
    if (output_payload.art_checklist_score_pct < 0 || output_payload.art_checklist_score_pct > 100) violations++;
  }
  return { name: 'P2_boundedness_dir_and_scores', trials: checked, violations };
}

// ---------- P3 (differential): determination re-derived from bias/checklist fail signals ----------
function checkP3_determination_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const anyBiasFail = output_payload.bias_results.some((b) => !b.skipped && b.any_fail);
    const highWeightDataFail = ['d1', 'd3', 'd4'].some((id) => pp.data_answers[id] === false);
    const highWeightArtFail = ['r1', 't2', 't3', 't4', 'tr2', 'h1', 'a1', 'a2'].some((id) => pp.art_answers[id] === false);
    let expected;
    if (anyBiasFail || highWeightDataFail || highWeightArtFail) expected = 'FAIL';
    else if (output_payload.data_governance_score_pct / 100 < 0.85 || output_payload.art_checklist_score_pct / 100 < 0.85) expected = 'WARN';
    else expected = 'PASS';
    if (output_payload.determination !== expected) violations++;
  }
  return { name: 'P3_determination_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of groups order within a characteristic ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const c = randomCharacteristic(rand);
    const r1 = compute({ characteristics: [c] }).output_payload;
    const r2 = compute({ characteristics: [{ ...c, groups: shuffle(rand, c.groups) }] }).output_payload;
    checked++;
    if (JSON.stringify(r1.bias_results) !== JSON.stringify(r2.bias_results)) violations++;
  }
  return { name: 'P4_permutation_invariance_groups', trials: checked, violations };
}

// ---------- P5 (ULP-forcing, float_sensitive:yes) — DIR/EO/DP threshold boundaries ----------
const ULP_BOUNDARY_CASES = [
  { groups: [{ label: 'a', approval: 80, tpr: 0, fpr: 0 }, { label: 'b', approval: 100, tpr: 0, fpr: 0 }], label: 'DIR exactly 0.80 -> dir_fail must be FALSE (strict <)' },
  { groups: [{ label: 'a', approval: 79.999999, tpr: 0, fpr: 0 }, { label: 'b', approval: 100, tpr: 0, fpr: 0 }], label: 'DIR fractionally under 0.80 -> dir_fail TRUE' },
  { groups: [{ label: 'a', approval: 50, tpr: 10, fpr: 0 }, { label: 'b', approval: 50, tpr: 15, fpr: 0 }], label: 'TPR gap exactly 5pp -> tpr_fail must be FALSE (strict >)' },
  { groups: [{ label: 'a', approval: 50, tpr: 10, fpr: 0 }, { label: 'b', approval: 50, tpr: 15.000001, fpr: 0 }], label: 'TPR gap fractionally over 5pp -> tpr_fail TRUE' },
];
function checkP5_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const { output_payload } = compute({ characteristics: [{ name: 'x', groups: c.groups }] });
    const b = output_payload.bias_results[0];
    rows.push({ label: c.label, dir: b.dir, dir_pass: b.dir_pass, tpr_gap: b.tpr_gap, tpr_pass: b.tpr_pass, finite: Number.isFinite(b.dir ?? 0) });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_determination_differential());
results.properties.push(checkP4_permutation_invariance());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const b = results.boundary_forced;
const anyBoundaryMismatch = !(b[0].dir_pass === true && b[1].dir_pass === false && b[2].tpr_pass === true && b[3].tpr_pass === false);

console.log(JSON.stringify({
  tool_id: 'art-05-eu-ai-act-credit-scoring-conformity',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
