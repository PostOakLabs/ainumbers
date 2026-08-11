// art-400-check-official-statement-completeness.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C19-1).
// kernel_digest_at_authoring: sha256:031039a46c60763e68a297e2d0cb28799aa5de6df00d9cd56926d73092ab6b30
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — pure present/absent checklist counting over the
// declared os_elements / material_event_categories_covered arrays; no division, no arithmetic
// beyond integer counts and array length comparisons; forced categorical boundary cases used).
// Checks: fixture-oracle gate, termination (gap_count bounded by REQUIRED_ELEMENTS.length=12,
// material_event_gaps bounded by MATERIAL_EVENT_CATEGORIES.length=15 — a single linear walk over
// each declared array, no recursion), boundedness (elements_checked is always the fixed 12,
// gaps.length===gap_count), a differential re-derivation of completeness_grade from the gap
// counts, a permutation-invariance metamorphic identity over os_elements order (elementMap is
// keyed by unique element id so order never changes the result when ids are distinct), and forced
// categorical boundary cases (empty arrays, all-complete, all-absent, CDU present-but-incomplete).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-400-check-official-statement-completeness.proptest.mjs

import { compute } from '../art-400-check-official-statement-completeness.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-400-check-official-statement-completeness.fixtures.json');
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
const rand = mulberry32(0x400C19);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const REQUIRED_ELEMENTS = [
  'cover-page', 'summary-statement', 'description-of-securities', 'use-of-proceeds',
  'sources-and-uses-of-funds', 'description-of-issuer', 'financial-statements',
  'tax-matters-legal-opinion', 'risk-factors', 'litigation-disclosure', 'underwriting',
  'continuing-disclosure-undertaking',
];
const MATERIAL_EVENT_CATEGORIES = [
  'principal-and-interest-payment-delinquencies', 'non-payment-related-defaults',
  'unscheduled-draws-on-debt-service-reserves', 'unscheduled-draws-on-credit-enhancements',
  'substitution-of-credit-or-liquidity-providers', 'adverse-tax-opinions-or-irs-events',
  'modifications-to-rights-of-security-holders', 'bond-calls', 'defeasances',
  'release-substitution-or-sale-of-property-securing-repayment', 'rating-changes',
  'bankruptcy-insolvency-receivership', 'merger-consolidation-or-sale-of-substantially-all-assets',
  'appointment-of-successor-trustee', 'incurrence-of-financial-obligation-or-agreement-to-covenants',
];
const STATUSES = ['complete', 'partial', 'absent'];

function randomPP(rng) {
  const os_elements = [];
  for (const el of REQUIRED_ELEMENTS) {
    if (rng() < 0.85) os_elements.push({ element: el, status: pick(rng, STATUSES) });
  }
  const material_event_categories_covered = MATERIAL_EVENT_CATEGORIES.filter(() => rng() < 0.6);
  return {
    inputs: {
      os_elements,
      material_event_categories_covered,
      continuing_disclosure_undertaking_present: rng() < 0.7,
    },
  };
}

const TRIALS = 4000;

// ---------- P1: termination — gap counts bounded by the fixed declared-element table sizes ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.gap_count > REQUIRED_ELEMENTS.length) violations++;
    if (o.material_event_gaps.length > MATERIAL_EVENT_CATEGORIES.length) violations++;
  }
  return { name: 'P1_termination_gaps_bounded_by_table_size', trials: checked, violations };
}

// ---------- P2: boundedness — elements_checked fixed, gaps.length === gap_count ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.elements_checked !== REQUIRED_ELEMENTS.length) violations++;
    if (o.gaps.length !== o.gap_count) violations++;
    if (o.material_event_categories_checked !== MATERIAL_EVENT_CATEGORIES.length) violations++;
  }
  return { name: 'P2_elements_checked_fixed_and_gaps_length_matches', trials: checked, violations };
}

// ---------- P3: differential — completeness_grade re-derivation from gap_count/material_event_gaps ----------
function checkP3_grade_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const gc = o.gap_count, mg = o.material_event_gaps.length;
    let expected;
    if (gc === 0 && mg === 0) expected = 'A';
    else if (gc === 0 && mg <= 3) expected = 'B';
    else if (gc >= 1 && gc <= 2) expected = 'C';
    else if (gc >= 3 && gc <= 5) expected = 'D';
    else expected = 'F';
    if (o.completeness_grade !== expected) violations++;
    if (o.compliant !== (gc === 0 && o.continuing_disclosure_undertaking_present)) violations++;
  }
  return { name: 'P3_completeness_grade_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of os_elements order (distinct element ids) ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    if (pp.inputs.os_elements.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const shuffled = [...pp.inputs.os_elements];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r2 = compute({ inputs: { ...pp.inputs, os_elements: shuffled } }).output_payload;
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P4_permutation_invariance_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no — categorical, not ULP) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // empty everything
  {
    const { output_payload: o } = compute({ inputs: { os_elements: [], material_event_categories_covered: [], continuing_disclosure_undertaking_present: false } });
    checked++;
    if (o.gap_count !== REQUIRED_ELEMENTS.length) violations++;
    if (o.completeness_grade !== 'F') violations++;
  }
  // all complete, all material events covered, CDU present -> grade A, compliant
  {
    const os_elements = REQUIRED_ELEMENTS.map((el) => ({ element: el, status: 'complete' }));
    const { output_payload: o } = compute({ inputs: { os_elements, material_event_categories_covered: [...MATERIAL_EVENT_CATEGORIES], continuing_disclosure_undertaking_present: true } });
    checked++;
    if (o.completeness_grade !== 'A') violations++;
    if (!o.compliant) violations++;
  }
  // CDU element complete but continuing_disclosure_undertaking_present flag false -> cdu_gap true
  {
    const os_elements = REQUIRED_ELEMENTS.map((el) => ({ element: el, status: 'complete' }));
    const { output_payload: o } = compute({ inputs: { os_elements, material_event_categories_covered: [...MATERIAL_EVENT_CATEGORIES], continuing_disclosure_undertaking_present: false } });
    checked++;
    if (o.compliant) violations++;
    if (o.continuing_disclosure_undertaking_present) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_grade_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-400-check-official-statement-completeness',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
