// art-647-record-index-correction — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:b2e5b57d770e2f357434539c6d70b7271e7f0bafbfc71e5b9e07f11e9dbb83e8
// spec: INDEX-LINEAGE-BUILD-SPEC.md, corrections chain section
// human_sign_off: sonnet-2026-08-17
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3). NOT a proof, NOT Dafny.
// float_sensitive: NO -- pure attestation kernel, no arithmetic on corrected_value anywhere
// (it is echoed, never computed on).
// Checks: fixture-oracle gate, echo-fidelity (P1), differential re-derivation of
// structural_error via an independent reimplementation (P2), forced categorical boundary
// cases (P3).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-647-record-index-correction.proptest.mjs

import { compute } from '../art-647-record-index-correction.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-647-record-index-correction';
const rand = mulberry32(0x64700001);
const REASON_CODES = ['input data error', 'methodology misapplication', 'vendor restatement'];

function randomPP(rng) {
  return {
    index_id: rng() < 0.1 ? undefined : `IDX-${Math.floor(rng() * 1000)}`,
    original_value_ref: {
      execution_hash: rng() < 0.1 ? undefined : `sha256:${Math.floor(rng() * 1e9).toString(16)}`,
      tool_id: rng() < 0.1 ? undefined : 'art-645-compute-index-weights',
      field_path: rng() < 0.1 ? undefined : 'output_payload.weights[0].weight',
    },
    corrected_value: Math.round(rng() * 1000) / 1000,
    reason_code: rng() < 0.1 ? undefined : pick(rng, REASON_CODES),
    correction_date: rng() < 0.1 ? undefined : '2026-08-10',
    affected_period: rng() < 0.1 ? undefined : '2026-08-05',
  };
}

const TRIALS = 3000;

// ---------- P1: echo-fidelity -- every declared field is echoed unmodified when clean ----------
function checkP1_echoFidelity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.structural_error !== null) continue;
    if (output_payload.corrected_value !== pp.corrected_value) violations++;
    if (output_payload.reason_code !== pp.reason_code) violations++;
    if (output_payload.correction_date !== pp.correction_date) violations++;
    if (output_payload.affected_period !== pp.affected_period) violations++;
    if (output_payload.original_value_ref.execution_hash !== pp.original_value_ref.execution_hash) violations++;
  }
  return { name: 'P1_echo_fidelity_when_no_structural_error', checked, violations };
}

// ---------- P2 (differential): structural_error re-derived independently ----------
function reimplement(pp) {
  if (!pp.index_id) return 'index_id is required.';
  const ref = pp.original_value_ref || {};
  const missing = ['execution_hash', 'tool_id', 'field_path'].filter((f) => !ref[f]);
  if (missing.length > 0) return `original_value_ref is missing required field(s): ${missing.join(', ')}.`;
  if (!Object.prototype.hasOwnProperty.call(pp, 'corrected_value')) return 'corrected_value is required.';
  if (!pp.reason_code) return 'reason_code is required.';
  if (!pp.correction_date) return 'correction_date is required.';
  if (!pp.affected_period) return 'affected_period is required.';
  return null;
}
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = reimplement(pp);
    if (output_payload.structural_error !== expected) violations++;
  }
  return { name: 'P2_structural_error_differential', checked, violations };
}

// ---------- P3: forced categorical boundary cases ----------
function checkP3_forcedCategorical() {
  let violations = 0, checked = 0;
  const base = { index_id: 'IDX', original_value_ref: { execution_hash: 'sha256:x', tool_id: 'art-645-compute-index-weights', field_path: 'output_payload.weights[0].weight' }, corrected_value: 0.5, reason_code: 'input data error', correction_date: '2026-08-10', affected_period: '2026-08-05' };
  checked++;
  { const r = compute({ ...base, index_id: undefined }).output_payload; if (!r.structural_error) violations++; }
  checked++;
  { const r = compute({ ...base, original_value_ref: { execution_hash: 'sha256:x' } }).output_payload; if (!r.structural_error) violations++; }
  checked++;
  { const r = compute({ ...base, reason_code: undefined }).output_payload; if (!r.structural_error) violations++; }
  checked++;
  { const r = compute({ ...base, corrected_value: 0 }).output_payload; if (r.structural_error !== null) violations++; }
  checked++;
  { const r = compute(base).output_payload; if (r.structural_error !== null) violations++; }
  return { name: 'P3_forced_categorical_boundaries', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_echoFidelity(),
  checkP2_differential(),
  checkP3_forcedCategorical(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
