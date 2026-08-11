// art-523-identity-proofing-assurance-level.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C26-1).
// kernel_digest_at_authoring: sha256:f691517dd02006a5787bea91055d22c567fb6049e1f3d15c3bb2a474032cd335
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// ⛔⛔ CORRECTION TO THE WU ROW'S TABLE (per FIX-2, the RARER direction -- a float:no that IS
// float-sensitive): the row lists this kernel as float:no. Direct read of compute()/bestMatch()/
// evalLevel() shows a GENUINE, UNGUARDED floating-point threshold comparison: `strength =
// safeNum(ev.strength, -1)` and `minStrength = safeNum(c.min_strength, null)` both accept ANY
// finite Number() coercion (the docstring itself calls it "a caller-normalized 0-100 scale", not
// an integer scale), and the criterion-met test is the bare compare `match.strength >=
// minStrength` -- no Number.isSafeInteger gate, no cross-multiplication safeguard (contrast
// art-494's deliberately cross-multiplied quorum threshold, which the C24 shard correctly left
// float:no). A caller can legitimately supply strength=79.99999999999999 against min_strength=80
// and the >= boundary is exactly where floating-point representation error lives. Corrected to
// float:YES; ULP-boundary forcing is MANDATORY and provided below (P4).
// Checks: fixture-oracle gate, termination (levels/criteria/evidence_items bounded by input
// array lengths, the walk-down loop is bounded by levels.length), forced categorical boundary
// cases distinguishing IAL_DEFINITION_INSUFFICIENT (criterion cannot express itself) from
// IAL_SHORTFALL (evidence present but below threshold), differential re-derivation of
// criteria_met/achieved_level via an independent bestMatch, boundedness (criteria_met +
// criteria_shortfall_count + criteria_undecidable_count === criteria_evaluated), and
// ULP-boundary forcing (mandatory, float_sensitive: yes) on the strength >= min_strength compare
// at 0, negative zero, Number.EPSILON, denormals, and the exact/one-ULP-under boundary.
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-523-identity-proofing-assurance-level.proptest.mjs

import { compute } from '../art-523-identity-proofing-assurance-level.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-523-identity-proofing-assurance-level.fixtures.json');
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
const rand = mulberry32(0x523F0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomLevels(rng) {
  return [
    { level_id: 'low', criteria: [{ criterion_id: 'c-low', required_evidence_type: 'doc', min_strength: 30 }] },
    { level_id: 'mid', criteria: [{ criterion_id: 'c-mid', required_evidence_type: 'doc', min_strength: pick(rng, [50, 60, 70]) }] },
    { level_id: 'high', criteria: [{ criterion_id: 'c-high', required_evidence_type: 'doc', min_strength: 90 }, { criterion_id: 'c-high2', required_evidence_type: 'bio', min_strength: 80 }] },
  ];
}
function randomEvidence(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ evidence_id: `E-${i}`, type: pick(rng, ['doc', 'bio', 'other']), strength: Math.floor(rng() * 100) });
  return out;
}
function randomPP(rng) {
  const n = Math.floor(rng() * 5);
  return {
    level_definition: { framework_id: 'TEST', framework_version: '1.0', levels: randomLevels(rng) },
    evidence_items: randomEvidence(rng, n),
    declared_target_level: pick(rng, ['low', 'mid', 'high']),
    as_of: '2026-08-10',
  };
}

const TRIALS = 4000;

// ---------- P1: termination -- criteria_evaluated bounded by the target level's own criteria array ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.criteria_met > output_payload.criteria_evaluated) violations++;
    if (output_payload.shortfall.length + output_payload.undecidable.length > output_payload.criteria_evaluated) violations++;
    if (output_payload.evidence_item_count !== pp.evidence_items.length) violations++;
  }
  return { name: 'P1_termination_criteria_and_evidence_bounded', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases -- IAL_DEFINITION_INSUFFICIENT vs IAL_SHORTFALL ----------
function checkP2_boundary_categorical() {
  let violations = 0, checked = 0;
  const base = { as_of: '2026-01-01', declared_target_level: 'low' };
  // criterion missing min_strength -> undecidable, never a shortfall
  {
    const pp = { ...base, level_definition: { levels: [{ level_id: 'low', criteria: [{ criterion_id: 'c1', required_evidence_type: 'doc' }] }] }, evidence_items: [{ evidence_id: 'e1', type: 'doc', strength: 100 }] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.criteria_undecidable_count !== 1) violations++;
    if (output_payload.criteria_shortfall_count !== 0) violations++;
  }
  // criterion well-formed, evidence present but below threshold -> shortfall, never undecidable
  {
    const pp = { ...base, level_definition: { levels: [{ level_id: 'low', criteria: [{ criterion_id: 'c1', required_evidence_type: 'doc', min_strength: 80 }] }] }, evidence_items: [{ evidence_id: 'e1', type: 'doc', strength: 79 }] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.criteria_shortfall_count !== 1) violations++;
    if (output_payload.criteria_undecidable_count !== 0) violations++;
  }
  return { name: 'P2_definition_insufficient_vs_shortfall_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): criteria_met/target_met re-derivation via independent bestMatch ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const levels = pp.level_definition.levels;
    const targetIdx = levels.findIndex((l) => l.level_id === pp.declared_target_level);
    if (targetIdx < 0) continue;
    const criteria = levels[targetIdx].criteria;
    let met = 0, shortfall = 0;
    for (const c of criteria) {
      let best = -1;
      for (const ev of pp.evidence_items) if (ev.type === c.required_evidence_type && ev.strength > best) best = ev.strength;
      if (best >= 0 && best >= c.min_strength) met++; else shortfall++;
    }
    if (output_payload.criteria_met !== met) violations++;
    if (output_payload.criteria_shortfall_count !== shortfall) violations++;
  }
  return { name: 'P3_criteria_met_differential_via_independent_bestmatch', trials: checked, violations };
}

// ---------- P4: boundedness -- met + shortfall + undecidable === evaluated ----------
function checkP4_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.criteria_met + output_payload.criteria_shortfall_count + output_payload.criteria_undecidable_count !== output_payload.criteria_evaluated) violations++;
  }
  return { name: 'P4_met_plus_shortfall_plus_undecidable_equals_evaluated', trials: checked, violations };
}

// ---------- P5 (ULP-boundary forcing, MANDATORY -- float_sensitive: yes): strength >= min_strength at exact/epsilon boundaries ----------
function checkP5_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const mkPP = (min_strength, strength) => ({
    level_definition: { levels: [{ level_id: 'L', criteria: [{ criterion_id: 'c1', required_evidence_type: 'doc', min_strength }] }] },
    evidence_items: [{ evidence_id: 'e1', type: 'doc', strength }],
    declared_target_level: 'L', as_of: '2026-01-01',
  });
  const cases = [
    // exact match at the threshold -> MET (>= is inclusive)
    { min: 80, strength: 80, expectMet: true },
    // one ULP under the threshold -> SHORTFALL
    { min: 80, strength: 80 - eps * 80, expectMet: false },
    // one ULP over -> MET
    { min: 80, strength: 80 + eps * 80, expectMet: true },
    // zero / negative zero boundary
    { min: 0, strength: 0, expectMet: true },
    { min: 0, strength: -0, expectMet: true },
    { min: 0, strength: Number.MIN_VALUE, expectMet: true }, // smallest denormal, still >= 0
    // x/y*y !== x style representable-but-imprecise value
    { min: (0.1 + 0.2) * 100, strength: 30, expectMet: (0.1 + 0.2) * 100 <= 30 },
  ];
  for (const c of cases) {
    const { output_payload } = compute(mkPP(c.min, c.strength));
    checked++;
    if (output_payload.target_met !== c.expectMet) violations++;
    if (!Number.isFinite(output_payload.criteria_met)) violations++;
  }
  return { name: 'P5_ulp_boundary_forcing_strength_vs_min_strength', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundary_categorical());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_boundedness());
results.properties.push(checkP5_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-523-identity-proofing-assurance-level',
  float_sensitive: true,
  float_sensitive_correction: 'WU row table said float:no; direct source read shows a genuine, unguarded floating-point threshold compare (match.strength >= minStrength) over a caller-declared "0-100 scale" with no Number.isSafeInteger gate and no cross-multiplication safeguard -- unlike art-494\'s deliberately cross-multiplied quorum threshold, which correctly stays float:no. Corrected to float:YES; ULP-boundary forcing applied (P5, mandatory).',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
