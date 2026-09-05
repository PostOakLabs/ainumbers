import { executionHash } from './_hash.mjs';

// art-685-direct-indexing-fit-screen — Direct-Indexing Fit Screen.
// Deterministic calculator over caller-declared synthetic inputs: it computes the
// arithmetic of a named rule (expected tax alpha in bps minus the direct-indexing
// fee delta over an ETF expense ratio) and NOTHING more. It is never advice, never
// an optimizer, and never a recommendation engine: the verdict enum describes the
// sign of the declared arithmetic only. Zero storage, zero network, no runtime
// clock (any as-of is a caller-declared input). All inputs are synthetic per the
// PII banner, never real client or portfolio data.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(),
// no network, no filesystem. It runs unmodified inside the QuickJS-ng zkVM guest,
// which is a STRICT SUBSET of a browser/Node global environment.

const TOOL_ID = 'art-685-direct-indexing-fit-screen';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_direct_indexing_fit_screen',
  mandate_type: 'compliance_control', gpu: false,
};

// Round to 2 decimal places, half-up, declared here and mirrored in every trace.
function round2dpHalfUp(x) {
  const scaled = x * 100;
  const r = Math.sign(scaled) * Math.round(Math.abs(scaled) + Number.EPSILON * Math.abs(scaled));
  return r / 100;
}

function asFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * compute(pp) — pure decision kernel.
 * Declared inputs:
 *   portfolio_value          (required, > 0) synthetic notional, bounds the screen only
 *   di_fee_bps               (required, >= 0) declared direct-indexing fee, bps per year
 *   etf_expense_bps          (required, >= 0) declared ETF expense ratio, bps per year
 *   expected_tax_alpha_bps   (required, finite) declared expected tax alpha, bps per year
 *   years_held               (optional, >= 0) declared holding period so far, years
 *   alpha_exhaustion_years   (optional, > 0) declared horizon after which the tax alpha
 *                            is treated as exhausted (loss-harvest capacity spent)
 *   concentrated_stock_position (optional boolean) declared concentrated stock unwound
 *                            by the direct-indexing program
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const flags = [];

  const portfolioValue = asFiniteNumber(pp.portfolio_value);
  const diFeeBps = asFiniteNumber(pp.di_fee_bps);
  const etfExpenseBps = asFiniteNumber(pp.etf_expense_bps);
  const taxAlphaBps = asFiniteNumber(pp.expected_tax_alpha_bps);

  if (portfolioValue === null || portfolioValue <= 0) {
    flags.push('DIF_ERROR');
    throw new TypeError('portfolio_value must be supplied as a finite positive number (synthetic value; never real portfolio data).');
  }
  if (diFeeBps === null || diFeeBps < 0) {
    flags.push('DIF_ERROR');
    throw new TypeError('di_fee_bps must be supplied as a finite non-negative number.');
  }
  if (etfExpenseBps === null || etfExpenseBps < 0) {
    flags.push('DIF_ERROR');
    throw new TypeError('etf_expense_bps must be supplied as a finite non-negative number.');
  }
  if (taxAlphaBps === null) {
    flags.push('DIF_ERROR');
    throw new TypeError('expected_tax_alpha_bps must be supplied as a finite number.');
  }

  // The named rule: net benefit = declared tax alpha minus the fee delta
  // (direct-indexing fee floor minus ETF expense). 2dp half-up, declared.
  const feeDeltaBps = round2dpHalfUp(diFeeBps - etfExpenseBps);
  const netBenefitBps = round2dpHalfUp(taxAlphaBps - feeDeltaBps);

  const overall = netBenefitBps > 0 ? 'FIT_POSITIVE' : netBenefitBps < 0 ? 'FIT_NEGATIVE' : 'FIT_NEUTRAL';

  const output_payload = {
    fee_delta_bps: feeDeltaBps,
    net_benefit_bps: netBenefitBps,
    trace: `${round2dpHalfUp(taxAlphaBps)} - (${round2dpHalfUp(diFeeBps)} - ${round2dpHalfUp(etfExpenseBps)}) = ${netBenefitBps} bps net of the declared fee delta`,
    overall,
  };

  // Exhaustion warning: only when BOTH holding-period inputs are declared. The
  // flag records the declared arithmetic (holding period at or past the declared
  // exhaustion horizon); it is a warning, never advice to trade.
  const yearsHeld = asFiniteNumber(pp.years_held);
  const exhaustionYears = asFiniteNumber(pp.alpha_exhaustion_years);
  if (yearsHeld !== null && exhaustionYears !== null) {
    if (yearsHeld < 0 || exhaustionYears <= 0) {
      flags.push('DIF_ERROR');
      throw new TypeError('years_held must be >= 0 and alpha_exhaustion_years must be > 0 when declared.');
    }
    output_payload.exhaustion_warning = yearsHeld >= exhaustionYears
      ? `years_held ${round2dpHalfUp(yearsHeld)} is at or past the declared alpha_exhaustion_years ${round2dpHalfUp(exhaustionYears)}: the declared tax alpha is treated as exhausted`
      : `years_held ${round2dpHalfUp(yearsHeld)} is below the declared alpha_exhaustion_years ${round2dpHalfUp(exhaustionYears)}: the declared tax alpha is treated as unexhausted`;
    if (yearsHeld >= exhaustionYears) flags.push('DIF_ALPHA_EXHAUSTION_WARNING');
  }

  // Concentrated-stock unwind note: caller-declared presence of a concentrated
  // position, note only, never a recommendation.
  if (pp.concentrated_stock_position !== undefined) {
    if (typeof pp.concentrated_stock_position !== 'boolean') {
      flags.push('DIF_ERROR');
      throw new TypeError('concentrated_stock_position, when declared, must be a boolean.');
    }
    output_payload.concentrated_stock_note = pp.concentrated_stock_position
      ? 'the caller declared a concentrated stock position: the declared fee-delta arithmetic above does not price the cost or the risk of unwinding it'
      : 'the caller declared no concentrated stock position: no unwind consideration applies to the declared fee-delta arithmetic';
    if (pp.concentrated_stock_position) flags.push('DIF_CONCENTRATED_STOCK_NOTE');
  }

  // Flag-mirror doctrine (AUTHORING-STANDARD): every conditional flag mirrors into
  // output_payload. The four canonical-parity keys stay byte-frozen, so the mirror
  // member is added only when a conditional flag actually fired.
  const mirrored = flags.filter((f) => f !== 'DIF_ERROR');
  if (mirrored.length > 0) output_payload.warnings = mirrored;

  return { output_payload, compliance_flags: flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
