// art-608-erc2981-royalty-calculator property-test floor (ETHMATH-RIDERS-1).
// kernel_digest_at_authoring: sha256:c573de67d9322a020f559748f9321e33213cedf75800b73729610cbe6cec2a94
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- inputs are a bounded (sale_price,
// royalty_fraction_bps) pair, enumeration-friendly. Shape: pure BigInt integer-division
// arithmetic -- no network calls, no chain reads, no cryptographic primitive at all. The
// fixture oracle (5 vectors) is the primary correctness anchor; properties below are the two
// mathematical edge invariants integer-division royalty math must hold (0% always yields zero,
// 100% always yields the full sale price) plus general structural invariants. float:no (all
// arithmetic is BigInt over decimal-string inputs). ZERO external dependencies. READ-ONLY
// w.r.t. the kernel it imports. compute() is synchronous.
//
// Run: node chaingraph/kernels/__proptests__/art-608-erc2981-royalty-calculator.proptest.mjs

import { compute } from '../art-608-erc2981-royalty-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const BASE_PP = { sale_price: '1000000000000000000', royalty_fraction_bps: 250, claimed_royalty_amount: '25000000000000000' };

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-608-erc2981-royalty-calculator.fixtures.json');
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

// ---------- negative control: an oracle never seen rejecting a wrong spec is not known to work ----------
function negativeControl() {
  const { output_payload } = compute(BASE_PP);
  const mutated = { ...output_payload, computed_royalty_amount: '1' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: determinism -- same input, called twice, byte-identical output.
function checkP1_determinism() {
  const a = compute(BASE_PP).output_payload;
  const b = compute(BASE_PP).output_payload;
  const violations = JSON.stringify(a) === JSON.stringify(b) ? 0 : 1;
  return { name: 'P1_determinism_repeat_call', trials: 1, violations };
}

// P2: missing sale_price/royalty_fraction_bps forces INDETERMINATE with a null computed_royalty_amount.
function checkP2_missingRequiredForcesIndeterminate() {
  let violations = 0, checked = 0;
  const cases = [{}, { sale_price: '100' }, { royalty_fraction_bps: 250 }, { sale_price: '-5', royalty_fraction_bps: 100 }];
  for (const pp of cases) {
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.overall_determination !== 'INDETERMINATE') violations++;
    if (output_payload.computed_royalty_amount !== null) violations++;
  }
  return { name: 'P2_missing_required_forces_indeterminate', trials: checked, violations };
}

// P3: 0 bps always yields a computed_royalty_amount of "0", for any non-negative sale_price.
function checkP3_zeroBpsYieldsZeroRoyalty() {
  let violations = 0, checked = 0;
  const salePrices = ['0', '1', '999999999999999999999999'];
  for (const sale_price of salePrices) {
    const { output_payload } = compute({ sale_price, royalty_fraction_bps: 0 });
    checked++;
    if (output_payload.computed_royalty_amount !== '0') violations++;
  }
  return { name: 'P3_zero_bps_yields_zero_royalty', trials: checked, violations };
}

// P4: 10000 bps (100%) always yields a computed_royalty_amount exactly equal to sale_price.
function checkP4_fullBpsYieldsFullPrice() {
  let violations = 0, checked = 0;
  const salePrices = ['0', '1', '12345678901234567890'];
  for (const sale_price of salePrices) {
    const { output_payload } = compute({ sale_price, royalty_fraction_bps: 10000 });
    checked++;
    if (output_payload.computed_royalty_amount !== sale_price) violations++;
    if (output_payload.findings.find((f) => f.check === 'bps_range_validity').verdict !== 'CONSISTENT') violations++;
  }
  return { name: 'P4_full_bps_yields_full_price', trials: checked, violations };
}

// P5: output shape -- overall_determination is always one of the three known verdicts, findings/
// related_tools/not_proven are always arrays, and bps above 10000 always flags out-of-range.
function checkP5_outputShapeAndRangeInvariant() {
  let violations = 0, checked = 0;
  const VERDICTS = new Set(['CONSISTENT', 'INCONSISTENT', 'INDETERMINATE']);
  const inputs = [{}, BASE_PP, { sale_price: '500', royalty_fraction_bps: 15000 }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!VERDICTS.has(output_payload.overall_determination)) violations++;
    if (!Array.isArray(output_payload.findings)) violations++;
    if (!Array.isArray(output_payload.related_tools)) violations++;
    if (!Array.isArray(output_payload.not_proven)) violations++;
  }
  const { output_payload: overRange } = compute({ sale_price: '500', royalty_fraction_bps: 15000 });
  checked++; if (overRange.findings.find((f) => f.check === 'bps_range_validity').verdict !== 'INCONSISTENT') violations++;
  return { name: 'P5_output_shape_and_range_invariant', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

const negControl = negativeControl();
if (!negControl.rejected_wrong_spec) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

results.properties.push(checkP1_determinism());
results.properties.push(checkP2_missingRequiredForcesIndeterminate());
results.properties.push(checkP3_zeroBpsYieldsZeroRoyalty());
results.properties.push(checkP4_fullBpsYieldsFullPrice());
results.properties.push(checkP5_outputShapeAndRangeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-608-erc2981-royalty-calculator',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
