// art-143-nis2-penalty-exposure-calculator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C4-1).
// kernel_digest_at_authoring: sha256:1e050fdce69b0aa2eeb1cbcca0c6b09530edfc86980ab96104181ae460bbb60a
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO -- RE-EXAMINED PER THE WU ROW'S OWN FLAG ("turnover float calc" caveat). This
// kernel does multiply a caller-supplied turnover by a fixed percentage (pct_based = safe_turnover *
// pct) and takes Math.max(fixed_max, pct_based) per infringement type, which looks float-comparison
// shaped. Direct read shows it is NOT branch-affecting: every entry in `infringement_types` shares the
// SAME entity_classification and SAME global_annual_turnover_eur (there is exactly one `pct` and one
// `fixed_max` per compute() call, not per type), so pct_based is identical across all iterations of the
// loop -- max_penalty_eur tracks a `>` comparison against a running max of IDENTICAL values, never two
// distinct nearby floats. Math.round() is applied only to already-selected display values, never used to
// decide a branch. mitigated_estimate_eur's reduction = min(factor_count*0.10, 0.70) is a numeric-value
// computation, not a categorical decision -- Math.min with an exact 0.10 step lands on values that never
// need to fall exactly on the 0.70 floor to change which branch of a boolean flag fires (there is no
// boolean flag downstream of `reduction` at all). Conclusion: float:no CONFIRMED, no ULP-forcing
// required. (This shard's genuine correction went to art-156 instead -- see that file's header.)
// Checks: fixture-oracle gate, termination (infringement_breakdown.length === infringement_types.length,
// output bounded by a fixed per-type formula), boundedness (max_penalty_eur >= every breakdown entry,
// mitigated_estimate_eur <= max_penalty_eur, reduction floor respected), differential re-derivation of
// the per-type breakdown and the mitigation reduction, and metamorphic scale-invariance (doubling
// turnover doubles the percentage-based component for a fixed classification, when it is the binding
// constraint over the flat cap).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-143-nis2-penalty-exposure-calculator.proptest.mjs

import { compute } from '../art-143-nis2-penalty-exposure-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-143-nis2-penalty-exposure-calculator.fixtures.json');
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
const rand = mulberry32(0x143A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const CLASSES = ['essential', 'important', 'other', ''];
const TYPES = ['art21_measures_absent', 'reporting_failure', 'noncompliance_directive'];

function randomInput(rng) {
  const cls = pick(rng, CLASSES);
  const turnover = Math.floor(rng() * 2_000_000_000);
  const nTypes = Math.floor(rng() * 5);
  const infringement_types = Array.from({ length: nTypes }, () => pick(rng, TYPES));
  const nFactors = Math.floor(rng() * 12);
  const mitigating_factors = Array.from({ length: nFactors }, (_, i) => `factor-${i}`);
  return { entity_classification: cls, global_annual_turnover_eur: turnover, infringement_types, mitigating_factors };
}

function expectedBreakdown(pp) {
  const is_essential = pp.entity_classification === 'essential';
  const is_important = pp.entity_classification === 'important';
  return pp.infringement_types.map((type) => {
    const fixed_max = is_essential ? 10_000_000 : is_important ? 7_000_000 : 0;
    const pct = is_essential ? 0.02 : is_important ? 0.014 : 0;
    const pct_based = pp.global_annual_turnover_eur * pct;
    const penalty = Math.max(fixed_max, pct_based);
    return { type, fixed_max_eur: fixed_max, pct_based_eur: Math.round(pct_based), penalty_eur: Math.round(penalty) };
  });
}

const TRIALS = 5000;

// ---------- P1: termination — infringement_breakdown.length === infringement_types.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomInput(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.infringement_breakdown.length !== pp.infringement_types.length) violations++;
  }
  return { name: 'P1_termination_breakdown_matches_types_length', trials: checked, violations };
}

// ---------- P2 (differential): re-derive infringement_breakdown, max_penalty_eur, mitigation ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomInput(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const breakdown = expectedBreakdown(pp);
    if (JSON.stringify(o.infringement_breakdown) !== JSON.stringify(breakdown)) violations++;
    // kernel tracks max_penalty_eur as the running max of UNROUNDED penalty values (only rounded at
    // output time), so re-derive from the same unrounded formula rather than from breakdown's rounded fields.
    const is_essential = pp.entity_classification === 'essential';
    const is_important = pp.entity_classification === 'important';
    const fixed_max = is_essential ? 10_000_000 : is_important ? 7_000_000 : 0;
    const pct = is_essential ? 0.02 : is_important ? 0.014 : 0;
    const rawPenalty = pp.global_annual_turnover_eur * pct;
    const expectedMaxRaw = pp.infringement_types.length === 0 ? 0 : Math.max(fixed_max, rawPenalty);
    if (o.max_penalty_eur !== Math.round(expectedMaxRaw)) violations++;
    const reduction = Math.min(pp.mitigating_factors.length * 0.10, 0.70);
    // mitigated_estimate_eur is derived from the UNROUNDED running max (kernel's internal accumulator),
    // not from the rounded output_payload.max_penalty_eur field -- re-derive from expectedMaxRaw.
    const expectedMitigated = Math.round(expectedMaxRaw * (1 - reduction));
    if (o.mitigated_estimate_eur !== expectedMitigated) violations++;
    if (o.mitigating_factors_applied !== pp.mitigating_factors.length) violations++;
  }
  return { name: 'P2_breakdown_and_mitigation_differential', trials: checked, violations };
}

// ---------- P3: boundedness — mitigated_estimate_eur <= max_penalty_eur, floor respected ----------
function checkP3_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomInput(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.mitigated_estimate_eur > output_payload.max_penalty_eur) violations++;
    if (output_payload.max_penalty_eur > 0 && output_payload.mitigated_estimate_eur < Math.round(output_payload.max_penalty_eur * 0.30) - 1) violations++;
    for (const b of output_payload.infringement_breakdown) {
      if (b.penalty_eur > output_payload.max_penalty_eur) violations++;
    }
  }
  return { name: 'P3_mitigated_and_floor_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — doubling turnover doubles pct_based_eur (fixed classification, pct branch binding) ----------
function checkP4_scale_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const cls = pick(rand, ['essential', 'important']);
    const turnover = 1_000_000 + Math.floor(rand() * 500_000_000);
    const pp1 = { entity_classification: cls, global_annual_turnover_eur: turnover, infringement_types: ['art21_measures_absent'], mitigating_factors: [] };
    const pp2 = { ...pp1, global_annual_turnover_eur: turnover * 2 };
    const r1 = compute(pp1).output_payload;
    const r2 = compute(pp2).output_payload;
    checked++;
    const pct1 = r1.infringement_breakdown[0].pct_based_eur;
    const pct2 = r2.infringement_breakdown[0].pct_based_eur;
    if (Math.abs(pct2 - pct1 * 2) > 1) violations++; // Math.round on each side allows +/-1 slack
  }
  return { name: 'P4_scale_invariance_pct_based_doubling', trials: checked, violations };
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
results.properties.push(checkP4_scale_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-143-nis2-penalty-exposure-calculator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
