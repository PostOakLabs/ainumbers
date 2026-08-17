// art-645-compute-index-weights — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:89e1c42dc3d59ad3566052948cdbe988799613418a705f2fb499bf4c98e981cb
// spec: INDEX-LINEAGE-BUILD-SPEC.md §2
// human_sign_off: sonnet-2026-08-17
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3). NOT a proof, NOT Dafny.
// float_sensitive: YES -- weight_i = basis_i / sum(basis) is a true division; the sum-to-1
// invariant is checked with WEIGHT_SUM_TOLERANCE (1e-9), matching the kernel's own tolerance,
// never an exact-equality float compare.
// Checks: fixture-oracle gate, sum-to-one invariant (P1), shape/boundedness (P2), differential
// re-derivation of structural_error via an independent reimplementation (P3), metamorphic
// permutation-invariance of inputs order (P4), forced categorical boundary cases (P5).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-645-compute-index-weights.proptest.mjs

import { compute } from '../art-645-compute-index-weights.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-645-compute-index-weights';
const WEIGHT_SUM_TOLERANCE = 1e-9;
const METHODOLOGIES = ['market-cap', 'float-adjusted-market-cap', 'equal-weight', 'price-weight', 'factor-tilted'];

const rand = mulberry32(0x64500001);

function randomInput(rng, i) {
  return {
    security_id: `SEC-${i}`,
    market_cap: rng() < 0.15 ? undefined : Math.floor(rng() * 10000) + 1,
    price: rng() < 0.15 ? undefined : Math.floor(rng() * 1000) + 1,
    float_factor: rng() < 0.15 ? undefined : rng(),
    factor_score: rng() < 0.15 ? undefined : rng() * 10,
    currency: 'USD',
  };
}
function randomPP(rng) {
  const n = Math.floor(rng() * 8) + 1;
  return {
    index_id: rng() < 0.1 ? undefined : `IDX-${Math.floor(rng() * 1000)}`,
    as_of_date: rng() < 0.1 ? undefined : '2026-08-05',
    weighting_methodology: rng() < 0.1 ? undefined : pick(rng, METHODOLOGIES),
    inputs: Array.from({ length: n }, (_, i) => randomInput(rng, i)),
  };
}

const TRIALS = 3000;

// ---------- P1: sum-to-one invariant whenever structural_error is null ----------
function checkP1_sumToOne() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.structural_error === null) {
      if (Math.abs(output_payload.weight_sum_check - 1) > WEIGHT_SUM_TOLERANCE) violations++;
      if (output_payload.weight_sum_within_tolerance !== true) violations++;
    } else {
      if (output_payload.weights.length !== 0) violations++;
      if (output_payload.weight_sum_check !== null) violations++;
    }
  }
  return { name: 'P1_sum_to_one_within_tolerance_when_no_structural_error', checked, violations };
}

// ---------- P2: shape/boundedness -- weights.length === inputs.length when clean ----------
function checkP2_shapeBoundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.structural_error === null && output_payload.weights.length !== pp.inputs.length) violations++;
    for (const w of output_payload.weights) {
      if (!Number.isFinite(w.weight)) violations++;
      if (w.weight < 0) violations++;
    }
  }
  return { name: 'P2_weights_shape_bounded_by_inputs_length', checked, violations };
}

// ---------- P3 (differential): structural_error re-derived independently ----------
function basisFor(methodology, row) {
  if (methodology === 'market-cap') return Number.isFinite(row.market_cap) ? row.market_cap : null;
  if (methodology === 'float-adjusted-market-cap') return Number.isFinite(row.market_cap) && Number.isFinite(row.float_factor) ? row.market_cap * row.float_factor : null;
  if (methodology === 'equal-weight') return 1;
  if (methodology === 'price-weight') return Number.isFinite(row.price) ? row.price : null;
  if (methodology === 'factor-tilted') return Number.isFinite(row.factor_score) ? row.factor_score : null;
  return null;
}
function reimplement(pp) {
  const inputs = Array.isArray(pp.inputs) ? pp.inputs : [];
  const methodology = pp.weighting_methodology;
  if (!pp.index_id) return 'index_id is required.';
  if (!pp.as_of_date) return 'as_of_date is required.';
  if (!methodology || !METHODOLOGIES.includes(methodology)) return 'weighting_methodology must be one of market-cap, float-adjusted-market-cap, equal-weight, price-weight, factor-tilted.';
  if (inputs.length === 0) return 'inputs must be a non-empty array.';
  const basisValues = inputs.map((row) => basisFor(methodology, row));
  const missing = basisValues.filter((v) => v == null).length;
  if (missing > 0) return `${missing} input row(s) are missing the field required by weighting_methodology="${methodology}".`;
  const basisSum = basisValues.reduce((acc, v) => acc + v, 0);
  if (basisSum <= 0) return 'the sum of weighting-basis values must be strictly positive.';
  return null;
}
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = reimplement(pp);
    // Compare only whether an error exists (message text differs deliberately by missing-count
    // wording elsewhere) except for the exact-match cases below where the text is invariant.
    if ((output_payload.structural_error === null) !== (expected === null)) violations++;
    if (expected !== null && output_payload.structural_error !== null && expected.endsWith('required.') && output_payload.structural_error !== expected) violations++;
  }
  return { name: 'P3_structural_error_differential', checked, violations };
}

// ---------- P4: metamorphic -- permutation-invariance of inputs order ----------
function checkP4_permutationInvariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    if (pp.inputs.length < 2) continue;
    const shuffled = { ...pp, inputs: [...pp.inputs].reverse() };
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.structural_error !== r2.structural_error) violations++;
    if (r1.structural_error === null) {
      const m1 = new Map(r1.weights.map((w) => [w.security_id, w.weight]));
      const m2 = new Map(r2.weights.map((w) => [w.security_id, w.weight]));
      for (const [id, w] of m1) {
        if (Math.abs((m2.get(id) ?? NaN) - w) > 1e-12) violations++;
      }
    }
  }
  return { name: 'P4_inputs_order_invariance', checked, violations };
}

// ---------- P5: forced categorical boundary cases ----------
function checkP5_forcedCategorical() {
  let violations = 0, checked = 0;
  const base = { index_id: 'IDX', as_of_date: '2026-08-05', weighting_methodology: 'market-cap', inputs: [{ security_id: 'S1', market_cap: 100 }, { security_id: 'S2', market_cap: 300 }] };
  checked++;
  { const r = compute({ ...base, index_id: undefined }).output_payload; if (!r.structural_error) violations++; }
  checked++;
  { const r = compute({ ...base, as_of_date: undefined }).output_payload; if (!r.structural_error) violations++; }
  checked++;
  { const r = compute({ ...base, weighting_methodology: 'not-a-methodology' }).output_payload; if (!r.structural_error) violations++; }
  checked++;
  { const r = compute({ ...base, inputs: [] }).output_payload; if (!r.structural_error) violations++; }
  checked++;
  { const r = compute({ ...base, inputs: [{ security_id: 'S1' }, { security_id: 'S2', market_cap: 100 }] }).output_payload; if (!r.structural_error) violations++; }
  checked++;
  { const r = compute({ ...base, weighting_methodology: 'equal-weight' }).output_payload; if (r.structural_error !== null || Math.abs(r.weight_sum_check - 1) > WEIGHT_SUM_TOLERANCE) violations++; }
  checked++;
  { const r = compute({ ...base, constituents_ref: { execution_hash: 'sha256:x', tool_id: 'art-557-record-index-constituents' } }); if (!r.compliance_flags.includes('INDEX_WEIGHTS_CITES_CONSTITUENTS_REF')) violations++; }
  return { name: 'P5_forced_categorical_boundaries', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_sumToOne(),
  checkP2_shapeBoundedness(),
  checkP3_differential(),
  checkP4_permutationInvariance(),
  checkP5_forcedCategorical(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
