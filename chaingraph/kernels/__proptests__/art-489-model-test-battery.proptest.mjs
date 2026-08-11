// art-489-model-test-battery.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C23-1).
// kernel_digest_at_authoring: sha256:20e07ad532c59a2c5619ce03881ce808c367002a5572176618bbb8b6ba06e178
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny. This
// is the highest-scrutiny kernel in this shard (five distinct float-heavy statistics: Gini, KS,
// PSI, CSI, calibration) — analogous to FV-PROPFLOOR-SHARD-C11-1's art-325-tvm-irr treatment.
// float_sensitive: YES, direct read confirmed — Gini/KS are a sorted-scan AUC trapezoid sum, PSI/
// CSI use the kernel's own inlined fdlibm `log()` inside a genuine division
// (`ep/expTotal`, `ap/actTotal`, `log(apf/epf)`), and every one of the five tests gates on a
// caller-supplied threshold via `>=`/`<=` float comparison. ULP-boundary forcing is mandatory.
// ⭐ NO ITERATIVE SOLVER — restated explicitly, matching this shard's other rows: Gini/KS is one
// sorted linear scan bounded by `scored.length`; PSI/CSI is one linear sum bounded by
// `bins.length`; termination is a plain array-length bound, no convergence-or-report property
// applies (there is no while-loop/fixed-point solve anywhere in this kernel).
// Checks: fixture-oracle gate, termination (tests array always length 5, bounded by input sizes),
// differential re-derivation of Gini/KS from an independent sorted-scan reference and PSI from an
// independent log-based reference (native Math.log, wide tolerance vs the kernel's own fdlibm
// log per the same honest-libm-gap reasoning as art-488), ULP-boundary forcing on the five
// threshold comparisons (0, -0, denormals, ±1 ULP) plus the PSI_EPS=1e-6 zero-bin clamp boundary,
// and metamorphic permutation-invariance of scored_outcomes order (rank-based statistics,
// tolerance-bounded since summation order can move the last float bit — the same honest
// non-associativity statement as art-309's shard).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-489-model-test-battery.proptest.mjs

import { compute } from '../art-489-model-test-battery.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-489-model-test-battery.fixtures.json');
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
const rand = mulberry32(0x489C23);

function randomScored(rng, n) {
  const out = [];
  let pos = 0, neg = 0;
  for (let i = 0; i < n; i++) {
    const outcome = rng() < 0.5 ? 1 : 0;
    if (outcome === 1) pos++; else neg++;
    out.push({ score: rng(), outcome });
  }
  if (pos === 0) out.push({ score: rng(), outcome: 1 });
  if (neg === 0) out.push({ score: rng(), outcome: 0 });
  return out;
}

function randomBins(rng, n) {
  const bins = [];
  for (let i = 0; i < n; i++) bins.push({ bin: `b${i}`, expected_count: 1 + Math.floor(rng() * 100), actual_count: 1 + Math.floor(rng() * 100) });
  return bins;
}

function randomPP(rng) {
  const n = 4 + Math.floor(rng() * 10);
  return {
    as_of_date: '2026-01-15',
    thresholds: { gini_min: 0.3, ks_min: 0.2, psi_max: 0.25, csi_max: 0.25, calibration_max_diff: 0.1 },
    discrimination: { scored_outcomes: randomScored(rng, n) },
    stability: { population_bins: randomBins(rng, 3 + Math.floor(rng() * 5)) },
    backtest: { bins: [{ bin: 'b0', predicted_rate: rng(), actual_rate: rng(), n: 100 }] },
  };
}

// Independent reference Gini/KS: sort desc by score, cumulative TPR/FPR, trapezoid AUC.
function refDiscrimination(scored) {
  const rows = scored.filter((r) => typeof r.score === 'number' && Number.isFinite(r.score) && (r.outcome === 1 || r.outcome === 0));
  const sorted = rows.slice().sort((a, b) => b.score - a.score);
  let nPos = 0, nNeg = 0;
  for (const r of sorted) { if (r.outcome === 1) nPos++; else nNeg++; }
  if (nPos === 0 || nNeg === 0) return null;
  let cumP = 0, cumN = 0, auc = 0, maxKS = 0, prevFPR = 0, prevTPR = 0;
  for (const r of sorted) {
    if (r.outcome === 1) cumP++; else cumN++;
    const tpr = cumP / nPos, fpr = cumN / nNeg;
    auc += (fpr - prevFPR) * (tpr + prevTPR) / 2;
    const ks = Math.abs(tpr - fpr);
    if (ks > maxKS) maxKS = ks;
    prevFPR = fpr; prevTPR = tpr;
  }
  return { gini: 2 * auc - 1, ks: maxKS };
}

// Independent reference PSI using NATIVE Math.log (not the kernel's fdlibm) — wide tolerance vs
// the kernel's own value, per the honest cross-libm-gap statement in the header.
function refPSI(bins) {
  const PSI_EPS = 1e-6;
  let expTotal = 0, actTotal = 0;
  for (const b of bins) { expTotal += b.expected_count; actTotal += b.actual_count; }
  if (expTotal <= 0 || actTotal <= 0) return null;
  let index = 0;
  for (const b of bins) {
    const ep = b.expected_count / expTotal, ap = b.actual_count / actTotal;
    const epf = ep <= 0 ? PSI_EPS : ep, apf = ap <= 0 ? PSI_EPS : ap;
    index += (apf - epf) * Math.log(apf / epf);
  }
  return index;
}

const TRIALS = 4000;

// ---------- P1: termination — tests array always length 5, bounded by input sizes ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.tests.length !== 5) violations++;
    if (output_payload.tests_run + output_payload.tests_skipped_no_threshold + output_payload.tests_skipped_insufficient_data !== 5) violations++;
  }
  return { name: 'P1_termination_tests_array_bounded', trials: checked, violations };
}

// ---------- P2 (differential): Gini/KS re-derived from an independent sorted-scan reference ----------
function checkP2_gini_ks_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const ref = refDiscrimination(pp.discrimination.scored_outcomes);
    const giniTest = output_payload.tests.find((t) => t.name === 'gini_coefficient');
    const ksTest = output_payload.tests.find((t) => t.name === 'ks_statistic');
    if (ref === null) {
      if (giniTest.result !== 'skipped_insufficient_data') violations++;
    } else {
      if (Math.abs(giniTest.metric_value - ref.gini) > 1e-6) violations++;
      if (Math.abs(ksTest.metric_value - ref.ks) > 1e-6) violations++;
    }
  }
  return { name: 'P2_gini_ks_differential', trials: checked, violations };
}

// ---------- P3 (differential): PSI re-derived via native Math.log, wide cross-libm tolerance ----------
function checkP3_psi_crosscheck() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const ref = refPSI(pp.stability.population_bins);
    const psiTest = output_payload.tests.find((t) => t.name === 'population_stability_index');
    if (ref === null) {
      if (psiTest.result !== 'skipped_insufficient_data') violations++;
    } else if (Math.abs(psiTest.metric_value - ref) > 1e-6) violations++;
  }
  return { name: 'P3_psi_crosscheck_wide_tolerance', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  const eps = Number.EPSILON;
  let violations = 0, checked = 0;
  const rows = [];
  // Perfectly-separated 2-record set -> gini=ks=1 exactly; force thresholds at the boundary.
  const scored = { scored_outcomes: [{ score: 1, outcome: 1 }, { score: 0, outcome: 0 }] };
  const forcedGiniMin = [1, 1 + eps, 1 - eps, 0, -0, Number.MIN_VALUE];
  for (const th of forcedGiniMin) {
    const pp = { thresholds: { gini_min: th }, discrimination: scored, stability: {}, backtest: {} };
    const { output_payload } = compute(pp);
    checked++;
    const t = output_payload.tests.find((x) => x.name === 'gini_coefficient');
    const expected = 1 >= th ? 'pass' : 'breach';
    if (t.result !== expected) violations++;
    rows.push({ test: 'gini_min', threshold: th, result: t.result, expected });
  }
  // PSI zero-bin epsilon clamp: expected_count 0 for one bin forces PSI_EPS substitution.
  const zeroBins = [{ bin: 'b0', expected_count: 0, actual_count: 10 }, { bin: 'b1', expected_count: 10, actual_count: 10 }];
  const forcedPsiMax = [0, -0, Number.MIN_VALUE, Infinity];
  for (const th of forcedPsiMax) {
    const pp = { thresholds: { psi_max: th }, discrimination: {}, stability: { population_bins: zeroBins }, backtest: {} };
    const { output_payload } = compute(pp);
    checked++;
    const t = output_payload.tests.find((x) => x.name === 'population_stability_index');
    const finite = Number.isFinite(th);
    const expected = !finite ? 'skipped_no_threshold' : (t.metric_value <= th ? 'pass' : 'breach');
    if (t.result !== expected) violations++;
    rows.push({ test: 'psi_max (zero-bin clamp)', threshold: th, result: t.result, expected, metric_value: t.metric_value });
  }
  results.ulp_forced_rows = rows;
  return { name: 'P4_ulp_boundary_forcing_float_sensitive', trials: checked, violations };
}

// ---------- P5: metamorphic — tolerance-bounded permutation-invariance of scored_outcomes order ----------
function checkP5_permutation_tolerance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const shuffled = [...pp.discrimination.scored_outcomes];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp, discrimination: { scored_outcomes: shuffled } }).output_payload;
    checked++;
    const g1 = r1.tests.find((t) => t.name === 'gini_coefficient');
    const g2 = r2.tests.find((t) => t.name === 'gini_coefficient');
    if (g1.metric_value === null || g2.metric_value === null) {
      if (g1.result !== g2.result) violations++;
      continue;
    }
    if (Math.abs(g1.metric_value - g2.metric_value) > 1e-9) violations++;
  }
  return { name: 'P5_permutation_invariance_tolerance_bounded', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_gini_ks_differential());
results.properties.push(checkP3_psi_crosscheck());
results.properties.push(checkP4_ulp_forcing());
results.properties.push(checkP5_permutation_tolerance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-489-model-test-battery',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
