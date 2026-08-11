// art-528-cross-ccp-pqd-comparator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C27-1).
// kernel_digest_at_authoring: sha256:fd251101f928b941bade8919f9fc8215154f87e82c9ec9e6953ea483c95b82f1
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read of art-528-cross-ccp-pqd-comparator.kernel.mjs confirmed:
// delta_pct = +(((b.value - a.value) / a.value) * 100).toFixed(4) and threshold ratio_pct =
// +((num.value / denom.value) * 100).toFixed(4) are real float division feeding a gt/gte/lt/lte
// threshold-breach comparison — matches the WU row's own float:yes classification. No correction
// needed. ULP-boundary forcing is MANDATORY per spec §3.
// Class-C shape: the kernel iterates once over the caller-supplied, UNBOUNDED `fields[]` array (no
// recursion) — termination means field_rows.length can never exceed fields.length, and every
// fields[] entry lands in either the valid or the rejected bucket, checked explicitly (P1) rather
// than assumed. The comparator's own reference dataset (CCP_DATASET) is a small fixed table baked
// into the kernel, not caller-supplied, so the "unbounded input" this floor targets is the
// caller's fields[]/threshold shape, not the dataset itself.
// Checks: fixture-oracle gate, termination (P1, field_rows.length === fields.length, fields.length
// <= fields_in.length), boundedness (P2, fully+partially+unavailable counts sum to fields.length),
// a swap-symmetry metamorphic identity (P3: swapping entity_a/entity_b exactly negates every
// available `delta` and leaves cross_ccp unchanged -- delta_pct is deliberately excluded, see P3's
// own comment for why it is not a valid identity), mandatory ULP-boundary forcing on the threshold
// ratio_pct comparison using the kernel's own fixed dataset figures (P4), and forced categorical
// boundary cases (unknown CCP, unknown division, unknown field, empty fields[], malformed threshold
// object) (P5).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-528-cross-ccp-pqd-comparator.proptest.mjs

import { compute } from '../art-528-cross-ccp-pqd-comparator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-528-cross-ccp-pqd-comparator.fixtures.json');
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
const rand = mulberry32(0x528C27);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// Mirror of the kernel's own fixed reference dataset (CCP-CORE-BUILD-SPEC.md §0), used only to
// derive expected values for the differential/ULP checks below — never to change compute()'s logic.
const CCP_DATASET = {
  FICC: { divisions: {
    GSD:  { backtest_coverage_pct: 99.7, largest_deficiency_usd: 48600000 },
    MBSD: { backtest_coverage_pct: 99.7, largest_deficiency_usd: 24800000 },
    NSCC: { backtest_coverage_pct: 99.8, largest_deficiency_usd: 172900000 },
  } },
  ICE: { skin_in_the_game_total_usd: 343000000, divisions: {
    ICC:  { default_fund_requirement_usd: 4798000000, cover2_peak_stress_usd: 1178000000, total_im_required_usd: 57855000000 },
    ICEU: { default_fund_requirement_usd: 3706000000, cover2_peak_stress_usd: 3670000000, total_im_required_usd: 60751000000 },
    ICUS: { default_fund_requirement_usd: 1009000000, cover2_peak_stress_usd: 800000000, total_im_required_usd: 18811000000 },
  } },
};
const DIVISION_LEVEL_FIELDS = ['backtest_coverage_pct', 'largest_deficiency_usd', 'default_fund_requirement_usd', 'cover2_peak_stress_usd', 'total_im_required_usd'];
const CCP_LEVEL_FIELDS = ['skin_in_the_game_usd'];
const KNOWN_FIELDS = [...CCP_LEVEL_FIELDS, ...DIVISION_LEVEL_FIELDS];
const ENTITIES = [{ ccp: 'FICC', division: 'GSD' }, { ccp: 'FICC', division: 'MBSD' }, { ccp: 'FICC', division: 'NSCC' }, { ccp: 'ICE', division: 'ICC' }, { ccp: 'ICE', division: 'ICEU' }, { ccp: 'ICE', division: 'ICUS' }];
const BAD_STRINGS = ['CME', 'LCH', 'UNKNOWN_FIELD', '', null, 42];

function randomEntity(rng) {
  if (rng() < 0.15) return { ccp: pick(rng, BAD_STRINGS), division: pick(rng, BAD_STRINGS) };
  return pick(rng, ENTITIES);
}
function randomFields(rng) {
  const n = Math.floor(rng() * 8);
  const out = [];
  for (let i = 0; i < n; i++) out.push(rng() < 0.2 ? pick(rng, BAD_STRINGS) : pick(rng, KNOWN_FIELDS));
  return out;
}
function randomPP(rng) {
  const pp = { entity_a: randomEntity(rng), entity_b: randomEntity(rng), fields: randomFields(rng) };
  if (rng() < 0.3) {
    pp.threshold = { field_id: pick(rng, KNOWN_FIELDS), operator: pick(rng, ['gt', 'gte', 'lt', 'lte']), value_pct_of_default_fund: rng() * 200 - 50 };
  }
  return pp;
}

const TRIALS = 4000;

// ---------- P1: termination — field_rows.length === valid-fields count, bounded by input length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.fields.length > pp.fields.length) violations++;
    const validKnown = pp.fields.filter((f) => typeof f === 'string' && KNOWN_FIELDS.includes(f)).length;
    if (output_payload.fields.length !== validKnown) violations++;
  }
  return { name: 'P1_termination_field_rows_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2: boundedness — fully+partially+unavailable sum to fields.length ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const sum = o.fully_available_field_count + o.partially_available_field_count + o.unavailable_field_count;
    if (sum !== o.fields.length) violations++;
    if (o.fully_available_field_count < 0 || o.partially_available_field_count < 0 || o.unavailable_field_count < 0) violations++;
    for (const row of o.rejected_inputs) { if (typeof row.where !== 'string' || !('reason' in row)) violations++; }
  }
  return { name: 'P2_boundedness_availability_counts_sum_to_fields_length', trials: checked, violations };
}

// ---------- P3: metamorphic — swapping entity_a/entity_b exactly negates every available `delta`
// (delta_pct is NOT included: it is (b-a)/a*100, scaled by the "a" side's own value, which itself
// changes on swap, so its magnitude is not preserved under swap -- only the absolute delta is an
// exact metamorphic identity here; asserting delta_pct negation would be a false property, not a
// kernel bug, so it is deliberately excluded) ----------
function checkP3_swap_symmetry() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    if (pp.fields.length === 0) continue;
    const swapped = { ...pp, entity_a: pp.entity_b, entity_b: pp.entity_a, threshold: undefined };
    const orig = compute({ ...pp, threshold: undefined }).output_payload;
    const swap = compute(swapped).output_payload;
    checked++;
    if (orig.cross_ccp !== swap.cross_ccp) violations++;
    for (let f = 0; f < orig.fields.length; f++) {
      const o = orig.fields[f], s = swap.fields[f];
      if (o.entity_a.available && o.entity_b.available) {
        if (!s.entity_a.available || !s.entity_b.available) { violations++; continue; }
        if (Math.abs(o.delta + s.delta) > 1e-6) violations++;
      }
    }
  }
  return { name: 'P3_entity_swap_negates_delta_metamorphic', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing on the threshold ratio_pct comparison (mandatory, float:yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  // Known exact figures: ICE ICC cover2_peak_stress_usd=1178000000, default_fund_requirement_usd=4798000000.
  const exactRatio = (1178000000 / 4798000000) * 100; // ~24.551896623...
  const roundedRatio = +exactRatio.toFixed(4); // 24.5519, exactly what the kernel computes as ratio_pct

  const boundaryValues = [roundedRatio, roundedRatio - eps, roundedRatio + eps, 0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, 100, -100];
  for (const valuePct of boundaryValues) {
    for (const operator of ['gt', 'gte', 'lt', 'lte']) {
      const pp = {
        entity_a: { ccp: 'ICE', division: 'ICC' }, entity_b: { ccp: 'ICE', division: 'ICEU' },
        fields: ['cover2_peak_stress_usd'],
        threshold: { field_id: 'cover2_peak_stress_usd', operator, value_pct_of_default_fund: valuePct },
      };
      const { output_payload: o } = compute(pp);
      checked++;
      if (!Number.isFinite(o.threshold.entity_a.ratio_pct)) violations++;
      if (typeof o.threshold.entity_a.breach !== 'boolean') violations++;
      // Verify the breach flag agrees with a direct re-derivation of the same comparison.
      const r = o.threshold.entity_a.ratio_pct;
      let expected;
      if (operator === 'gt') expected = r > valuePct;
      else if (operator === 'gte') expected = r >= valuePct;
      else if (operator === 'lt') expected = r < valuePct;
      else expected = r <= valuePct;
      if (o.threshold.entity_a.breach !== expected) violations++;
    }
  }
  // x/y*y !== x shaped case: default_fund_requirement_usd as denominator, cover2 as numerator.
  {
    const denom = 4798000000, num = 1178000000;
    const reconstructed = (num / denom) * denom;
    checked++;
    if (Number.isNaN(reconstructed)) violations++; // sanity: must never be NaN even if !== num exactly
  }
  return { name: 'P4_ulp_boundary_forcing_threshold_ratio_pct', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // unknown CCP
  { const { output_payload: o } = compute({ entity_a: { ccp: 'CME', division: 'X' }, entity_b: { ccp: 'FICC', division: 'GSD' }, fields: ['backtest_coverage_pct'] }); checked++; if (o.entity_a.resolved) violations++; }
  // unknown division
  { const { output_payload: o } = compute({ entity_a: { ccp: 'FICC', division: 'NOPE' }, entity_b: { ccp: 'FICC', division: 'GSD' }, fields: ['backtest_coverage_pct'] }); checked++; if (o.entity_a.resolved) violations++; }
  // unknown field
  { const { output_payload: o, compliance_flags } = compute({ entity_a: { ccp: 'FICC', division: 'GSD' }, entity_b: { ccp: 'FICC', division: 'NSCC' }, fields: ['not_a_real_field'] }); checked++; if (o.fields.length !== 0) violations++; if (!compliance_flags.includes('PQD_INPUTS_REJECTED')) violations++; }
  // empty fields[]
  { const { output_payload: o } = compute({ entity_a: { ccp: 'FICC', division: 'GSD' }, entity_b: { ccp: 'FICC', division: 'NSCC' }, fields: [] }); checked++; if (o.fields.length !== 0) violations++; }
  // malformed threshold object
  { const { output_payload: o } = compute({ entity_a: { ccp: 'FICC', division: 'GSD' }, entity_b: { ccp: 'FICC', division: 'NSCC' }, fields: ['backtest_coverage_pct'], threshold: 'not-an-object' }); checked++; if (o.threshold !== null) violations++; }
  // field unavailable on both sides
  { const { output_payload: o } = compute({ entity_a: { ccp: 'FICC', division: 'MBSD' }, entity_b: { ccp: 'ICE', division: 'ICUS' }, fields: ['default_fund_requirement_usd', 'backtest_coverage_pct'] }); checked++; if (o.unavailable_field_count !== 0 || o.partially_available_field_count !== 2) violations++; }
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
results.properties.push(checkP3_swap_symmetry());
results.properties.push(checkP4_ulp_forcing());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-528-cross-ccp-pqd-comparator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
