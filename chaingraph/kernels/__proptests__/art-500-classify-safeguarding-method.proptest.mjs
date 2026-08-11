// art-500-classify-safeguarding-method.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C24-1).
// kernel_digest_at_authoring: sha256:314afddd557143ad20b8ecc8db1f7ebf34c9ff4eded6024723b8cde4d9501938
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// ⛔⛔ CORRECTION TO THE WU ROW'S TABLE (per FIX-2): the row lists this kernel as float:yes.
// Direct read of the full compute() body shows NO floating-point arithmetic exists at all: every
// numeric input (relevant_funds_high_water_minor_units, weeks_observed) is coerced through
// toSafeInt(), which requires Number.isSafeInteger and returns null otherwise, and every
// comparison against AUDIT_EXEMPTION_THRESHOLD_MINOR_UNITS (10000000) or AUDIT_EXEMPTION_MIN_WEEKS
// (53) is an integer compare. The rest of the kernel is pure string-enum classification
// (funds_category / method_asserted / account status / acknowledgement status) with no arithmetic
// at all. There is no floating-point threshold anywhere to ULP-force. Corrected to float:no;
// floored with forced categorical boundary cases at the two integer thresholds (spec §3's
// float:no fallback), per FIX-2 discipline.
// Checks: fixture-oracle gate, termination (determinations bounded by input streams.length),
// forced categorical boundary cases at the audit-exemption weeks/high-water thresholds,
// differential re-derivation of classification_verdict/method_coherence from the stream facts,
// boundedness (coherent+incoherent+judgment-carrying counts partition stream_count), and
// metamorphic invariance (a stream with all five insurance conditions true and a provider_ref
// present is always coherent; flipping any one condition to false always makes it incoherent).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-500-classify-safeguarding-method.proptest.mjs

import { compute } from '../art-500-classify-safeguarding-method.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-500-classify-safeguarding-method.fixtures.json');
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
const rand = mulberry32(0x500A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomStream(rng, i) {
  const method = pick(rng, ['segregation', 'insurance_or_guarantee', 'unknown']);
  const s = {
    stream_ref: `S${i}`,
    funds_category: pick(rng, ['payment_service_relevant_funds', 'emoney_relevant_funds', 'own_funds', 'mixed_remittance', '']),
    method_asserted: method,
  };
  if (method === 'segregation') {
    s.designated_account_status = pick(rng, ['designated_relevant_funds_bank_account', 'not_designated', 'unknown']);
    s.acknowledgement_letter_status = pick(rng, ['received_and_countersigned', 'not_received', 'unknown']);
    s.receipt_to_segregation_timing = pick(rng, ['same_business_day', 'next_business_day']);
  } else if (method === 'insurance_or_guarantee') {
    const allTrue = rng() < 0.3;
    s.insurance_conditions = {
      proceeds_payable_on_insolvency_event: allTrue || rng() < 0.5,
      no_conditions_on_prompt_payout: allTrue || rng() < 0.5,
      certification_no_more_onerous_than_necessary: allTrue || rng() < 0.5,
      proceeds_paid_into_relevant_funds_bank_account: allTrue || rng() < 0.5,
      cancellation_restricted_with_3_months_notice: allTrue || rng() < 0.5,
    };
    s.provider_ref = rng() < 0.7 ? `PROV-${i}` : '';
  }
  return s;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 6);
  const streams = [];
  for (let i = 0; i < n; i++) streams.push(randomStream(rng, i));
  return {
    as_of_date: '2026-07-30',
    streams,
    relevant_funds_high_water_minor_units: pick(rng, [0, 5000000, 10000000, 10000001, 20000000, 1.5, null]),
    weeks_observed: pick(rng, [0, 10, 52, 53, 54, 100, null]),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — determinations.length exactly matches streams.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.determinations.length !== pp.streams.length) violations++;
    if (output_payload.stream_count !== pp.streams.length) violations++;
  }
  return { name: 'P1_termination_determinations_exact', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases at the audit-exemption integer thresholds ----------
function checkP2_audit_exemption_boundary_categorical() {
  let violations = 0, checked = 0;
  const cases = [
    { high_water: 10000000, weeks: 53, expect: 'audit_exemption_indicated' }, // exactly at both thresholds
    { high_water: 10000001, weeks: 53, expect: 'audit_exemption_not_indicated' }, // one minor unit over
    { high_water: 10000000, weeks: 52, expectJudgment: true }, // one week short
    { high_water: 0, weeks: 53, expect: 'audit_exemption_indicated' },
    { high_water: 1.5, weeks: 53, expectJudgment: true }, // non-integer high_water -> toSafeInt null
    { high_water: 10000000, weeks: 53.5, expectJudgment: true }, // non-integer weeks
  ];
  for (const c of cases) {
    const pp = { as_of_date: '2026-01-01', streams: [], relevant_funds_high_water_minor_units: c.high_water, weeks_observed: c.weeks };
    const { output_payload } = compute(pp);
    checked++;
    if (c.expect && output_payload.audit_exemption_indicator.outcome !== c.expect) violations++;
    if (c.expectJudgment && output_payload.audit_exemption_indicator.outcome !== 'judgment_required') violations++;
  }
  return { name: 'P2_audit_exemption_thresholds_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): classification_verdict re-derivation ----------
function checkP3_classification_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const incoherent = output_payload.determinations.filter((d) => d.method_coherence === 'incoherent').length;
    const openJudgments = output_payload.open_judgment_count;
    let expected;
    if (pp.streams.length === 0) expected = 'NO_STREAMS_SUPPLIED';
    else if (incoherent > 0) expected = 'INCOHERENCE_PRESENT';
    else if (openJudgments > 0) expected = 'JUDGMENT_REQUIRED';
    else expected = 'COHERENT_ON_SUPPLIED_FACTS';
    if (output_payload.classification_verdict !== expected) violations++;
  }
  return { name: 'P3_classification_verdict_differential', trials: checked, violations };
}

// ---------- P4: boundedness — coherent+incoherent+(judgment-only) partitions stream_count ----------
function checkP4_coherence_partition_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const judgmentOnly = output_payload.determinations.filter((d) => d.method_coherence === 'judgment_required').length;
    if (output_payload.coherent_count + output_payload.incoherent_count + judgmentOnly !== output_payload.stream_count) violations++;
    if (output_payload.coherent_count < 0 || output_payload.incoherent_count < 0) violations++;
  }
  return { name: 'P4_coherence_partition_bounded', trials: checked, violations };
}

// ---------- P5: metamorphic — all-true insurance conditions + provider_ref => coherent;
// flipping exactly one condition to false always yields incoherent for that stream ----------
function checkP5_insurance_all_true_metamorphic() {
  let violations = 0, checked = 0;
  const KEYS = ['proceeds_payable_on_insolvency_event', 'no_conditions_on_prompt_payout', 'certification_no_more_onerous_than_necessary', 'proceeds_paid_into_relevant_funds_bank_account', 'cancellation_restricted_with_3_months_notice'];
  for (let i = 0; i < 500; i++) {
    const base = {
      stream_ref: 'S0',
      funds_category: 'payment_service_relevant_funds',
      method_asserted: 'insurance_or_guarantee',
      insurance_conditions: Object.fromEntries(KEYS.map((k) => [k, true])),
      provider_ref: 'PROV-1',
    };
    const r1 = compute({ as_of_date: '2026-01-01', streams: [base] }).output_payload;
    checked++;
    if (r1.determinations[0].method_coherence !== 'coherent') violations++;
    const flipKey = pick(rand, KEYS);
    const flipped = { ...base, insurance_conditions: { ...base.insurance_conditions, [flipKey]: false } };
    const r2 = compute({ as_of_date: '2026-01-01', streams: [flipped] }).output_payload;
    checked++;
    if (r2.determinations[0].method_coherence !== 'incoherent') violations++;
  }
  return { name: 'P5_insurance_all_true_flip_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_audit_exemption_boundary_categorical());
results.properties.push(checkP3_classification_verdict_differential());
results.properties.push(checkP4_coherence_partition_bounded());
results.properties.push(checkP5_insurance_all_true_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-500-classify-safeguarding-method',
  float_sensitive: false,
  float_sensitive_correction: 'WU row table said float:yes; direct source read shows no floating-point arithmetic anywhere in compute() — every numeric input is coerced through toSafeInt() (Number.isSafeInteger), and every comparison is an integer compare against a fixed threshold. Corrected to float:no; floored with forced categorical boundary cases instead of ULP-boundary forcing.',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
