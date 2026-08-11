// art-520-operator-exit-data-portability.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C26-1).
// kernel_digest_at_authoring: sha256:f788f6feb29648cf1c09156f55bc79fa0da7511e5ce55547e00b893c8f6e826b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed -- the WU row's own table agrees, no correction
// needed). Every field is a tri-state (true/false/undeclared) or an opaque string except
// notice_period_days, which is coerced through Math.trunc() on a Number.isFinite guard -- an
// integer. There is no floating-point comparison anywhere in compute().
// Checks: fixture-oracle gate, termination (categories/components/dependencies bounded by
// input array lengths), forced categorical boundary cases on the tri-state absence-instrument
// rule (export_exists true/false/undeclared each a DISTINCT, non-collapsed state) and the
// operator-claim-unsupported condition, differential re-derivation of stranded_categories/
// operator_claim_unsupported/portable, boundedness (operator_controlled_count +
// supplier_controlled_count + undeclared_component_count === components.length), and
// metamorphic invariance (an undeclared-tri-state component never flips portable/
// operator_claim_unsupported on its own).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-520-operator-exit-data-portability.proptest.mjs

import { compute } from '../art-520-operator-exit-data-portability.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-520-operator-exit-data-portability.fixtures.json');
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
const rand = mulberry32(0x520E0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRI = [true, false, undefined];

function randomCategory(rng, i) {
  return { category: `CAT-${i}`, export_exists: pick(rng, TRI), format: 'csv', format_open: pick(rng, TRI), export_cadence: 'daily', last_successful_export: '2026-08-01' };
}
function randomComponent(rng, i) {
  return { name: `COMP-${i}`, controlled_by: pick(rng, ['operator', 'supplier', null]) };
}
function randomDependency(rng, i) {
  return { name: `DEP-${i}`, single_supplier: pick(rng, TRI), substitutable: pick(rng, TRI) };
}
function randomPP(rng) {
  const nc = Math.floor(rng() * 5);
  const ncomp = Math.floor(rng() * 5);
  const nd = Math.floor(rng() * 4);
  return {
    as_of: '2026-08-10',
    contractual_operator: pick(rng, TRI),
    data_categories: Array.from({ length: nc }, (_, i) => randomCategory(rng, i)),
    declared_components: Array.from({ length: ncomp }, (_, i) => randomComponent(rng, i)),
    dependencies: Array.from({ length: nd }, (_, i) => randomDependency(rng, i)),
    escrow_arrangements: { exists: pick(rng, TRI), description: null },
    notice_period_days: pick(rng, [null, 0, 30, 90]),
    transition_assistance_terms: pick(rng, [null, 'standard-terms']),
  };
}

const TRIALS = 4000;

// ---------- P1: termination -- categories/components/dependencies bounded by input length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.category_count !== pp.data_categories.length) violations++;
    if (output_payload.components.length !== pp.declared_components.length) violations++;
    if (output_payload.dependencies.length !== pp.dependencies.length) violations++;
  }
  return { name: 'P1_termination_categories_components_dependencies_bounded', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases -- tri-state absence-instrument + operator claim ----------
function checkP2_boundary_categorical() {
  let violations = 0, checked = 0;
  const base = { as_of: '2026-01-01', data_categories: [], declared_components: [], dependencies: [] };
  // export_exists: true/false/undeclared are three DISTINCT verdicts, never collapsed
  {
    const { output_payload } = compute({ ...base, data_categories: [{ category: 'C1', export_exists: true, format_open: true }] });
    checked++;
    if (output_payload.categories[0].verdict !== 'PORTABLE') violations++;
  }
  {
    const { output_payload } = compute({ ...base, data_categories: [{ category: 'C1', export_exists: false }] });
    checked++;
    if (output_payload.categories[0].verdict !== 'STRANDED') violations++;
  }
  {
    const { output_payload } = compute({ ...base, data_categories: [{ category: 'C1' }] });
    checked++;
    if (output_payload.categories[0].verdict !== 'UNDECLARED') violations++;
  }
  // operator claim unsupported: declared operator, all components supplier-controlled
  {
    const { output_payload } = compute({ ...base, contractual_operator: true, declared_components: [{ name: 'X', controlled_by: 'supplier' }] });
    checked++;
    if (output_payload.operator_claim_unsupported !== true) violations++;
  }
  {
    const { output_payload } = compute({ ...base, contractual_operator: true, declared_components: [{ name: 'X', controlled_by: 'operator' }] });
    checked++;
    if (output_payload.operator_claim_unsupported !== false) violations++;
  }
  return { name: 'P2_tristate_and_operator_claim_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): stranded_categories / operator_claim_unsupported / portable re-derivation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const stranded = output_payload.categories.filter((c) => c.export_exists === 'false').length;
    if (output_payload.stranded_category_count !== stranded) violations++;
    if (output_payload.portable !== (stranded === 0)) violations++;
    const opCtrl = output_payload.components.filter((c) => c.controlled_by === 'operator').length;
    const supCtrl = output_payload.components.filter((c) => c.controlled_by === 'supplier').length;
    const declaredCount = opCtrl + supCtrl;
    const expectUnsupported = output_payload.contractual_operator === 'true' && declaredCount > 0 && opCtrl === 0;
    if (output_payload.operator_claim_unsupported !== expectUnsupported) violations++;
  }
  return { name: 'P3_stranded_and_operator_claim_differential', trials: checked, violations };
}

// ---------- P4: boundedness -- component control partition sums to total ----------
function checkP4_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.operator_controlled_count + output_payload.supplier_controlled_count + output_payload.undeclared_component_count !== output_payload.components.length) violations++;
    if (output_payload.stranded_categories.length > output_payload.category_count) violations++;
  }
  return { name: 'P4_component_control_partition_sums_to_total', trials: checked, violations };
}

// ---------- P5: metamorphic -- an all-undeclared-controlled-by extra component never flips operator_claim_unsupported ----------
function checkP5_undeclared_component_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    const extended = { ...pp, declared_components: [...pp.declared_components, { name: 'EXTRA-UNDECLARED' }] };
    const r2 = compute(extended).output_payload;
    checked++;
    if (r1.operator_claim_unsupported !== r2.operator_claim_unsupported) violations++;
    if (r1.portable !== r2.portable) violations++;
    if (r2.undeclared_component_count !== r1.undeclared_component_count + 1) violations++;
  }
  return { name: 'P5_undeclared_component_noop_metamorphic', trials: checked, violations };
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
results.properties.push(checkP5_undeclared_component_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-520-operator-exit-data-portability',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
