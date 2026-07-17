/**
 * art-348-score-credit-model-quantized.kernel.mjs
 * Quantized Credit Decisioning Model Scorer — pure integer inference over a
 * fixed, int8-quantized logistic-regression-class credit model (ZKML-GUEST-1
 * demand-test pilot, ZG-2). No DOM, no window, no Date.now(), no Math.random(),
 * NO FLOATING-POINT ARITHMETIC ANYWHERE IN compute() — every operand is an
 * integer, every operator is integer add/multiply/compare. This is what makes
 * the finite gate and cross-surface determinism (browser V8 / Worker V8 /
 * QuickJS-wasm guest / RV32IM zkVM guest) trivial: there is no libm, no
 * float rounding mode, nothing engine-implementation-defined in the path.
 *
 * WHAT THIS PROVES (and what it does NOT): this kernel proves that THIS fixed
 * quantized model produced THIS score from THESE (already-normalized,
 * fixed-point) inputs. It is NOT a fairness attestation, NOT a model-quality
 * certification, and NOT fit for real regulatory credit decisioning — the
 * underlying model is a synthetic offline demand-test artifact (ZG-1,
 * `chaingraph/kernels/fixtures/art-348-score-credit-model-quantized.*`,
 * `chaingraph/kernels/fixtures/zg1_gen_model.py`). See `quantization_parity`
 * in the built artifact for the float-vs-quantized agreement rate this
 * specific quantization achieved (0.998 top1-match over 1000 held-out vectors).
 *
 * Quantization scheme (static-linear, per-tensor, int8 weights, int32
 * fixed-point accumulator, 16 fractional bits) — values embedded verbatim
 * from the ZG-1 offline fixture (`reference_model.json` .quantization block):
 *   int8_weights:      [-84, -75, -54, 36, -22, -13, 127, 105, 54, 122]
 *   int32_bias_fixp:   -2964619
 *   threshold_fixp:    0
 *   scale:             0.018568686683702897  (recorded for the parity
 *                       declaration only — NEVER used inside compute(), which
 *                       stays 100% integer)
 *   fixp_shift:        16 (inputs arrive PRE-NORMALIZED as int32 fixed-point
 *                       with 16 fractional bits — see policy_parameters below)
 *
 * Input contract: policy_parameters.normalized_fixp16 is a 10-element array of
 * integers, one per model feature, already mean/std-normalized and scaled by
 * 2^16 OFFLINE (this kernel never computes a mean, std-dev, or division of any
 * kind — that normalization step is float math and happens strictly outside
 * the deterministic compute path, exactly as the ZG-1 offline generator does
 * before it ever hands a row to quantized_infer()). Feature order matches
 * ZG-1's reference_model.json .features array: duration_months,
 * credit_amount, installment_rate_pct, age_years, existing_credits,
 * num_dependents, checking_status_score, savings_status_score,
 * employment_years, credit_history_score.
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'art-348-score-credit-model-quantized',
  mcp_name:     'score_credit_model_quantized',
  mandate_type: 'credit_assessment',
  version:      '1.0.0',
};

const TOOL_ID      = 'art-348-score-credit-model-quantized';
const TOOL_VERSION = '1.0.0';

const N_FEATURES     = 10;
const INT8_WEIGHTS   = [-84, -75, -54, 36, -22, -13, 127, 105, 54, 122];
const INT32_BIAS_FIXP = -2964619;
const THRESHOLD_FIXP  = 0;

// Recorded for the quantization_parity declaration only. NEVER referenced by
// compute() — the kernel itself performs zero float arithmetic.
const QUANT_META = {
  quant_method: 'static-linear',
  bits: 8,
  scale: 0.018568686683702897,
  zero_point: 0,
  granularity: 'per-tensor',
  reference_model_digest: 'sha256:7a8a79f1c1c7570afa1e3217060335266479aad32e05fc7a831fe0c00b33014e',
  test_vectors_digest: 'sha256:1e4afbc3ecbfac4abca04d0b1434fe46403d2cd60216c47876fa8fdbd7f6f0ae',
  n_vectors: 1000,
  agreement: { metric: 'top1-match', value: 0.998 },
};

/** Coerce a value to a safe integer, defaulting to 0. No float ops — Number()
 *  parsing + integer truncation only (Math.trunc is an integer operation on
 *  an already-integral value here; inputs are expected pre-quantized ints). */
function toInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const t = Math.trunc(n);
  return Number.isSafeInteger(t) ? t : 0;
}

export function compute(pp) {
  pp = pp || {};
  const rawInputs = Array.isArray(pp.normalized_fixp16) ? pp.normalized_fixp16 : [];

  const x = new Array(N_FEATURES);
  for (let i = 0; i < N_FEATURES; i++) x[i] = toInt(rawInputs[i]);

  // Pure integer dot product + fixed-point bias accumulation.
  let acc = INT32_BIAS_FIXP;
  for (let i = 0; i < N_FEATURES; i++) acc += x[i] * INT8_WEIGHTS[i];

  const decision = acc > THRESHOLD_FIXP ? 1 : 0;

  const compliance_flags = [
    'QUANTIZED_INFERENCE_ONLY',
    'SYNTHETIC_DEMAND_TEST_MODEL',
    'NOT_A_REGULATORY_CREDIT_DECISION',
    'NOT_A_FAIRNESS_OR_MODEL_QUALITY_ATTESTATION',
  ];

  const output_payload = {
    decision,
    accumulator_fixp: acc,
    threshold_fixp: THRESHOLD_FIXP,
    n_features: N_FEATURES,
    quant_method: 'static-linear',
    bits: 8,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    // Additive, hash-excluded (NOT part of the execution_hash preimage — only
    // policy_parameters + output_payload are hashed above). Per
    // ZKML-GUEST-1-BUILD-SPEC.md §ZG-3 DETCLASS-1 rider.
    quantization_parity: QUANT_META,
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
