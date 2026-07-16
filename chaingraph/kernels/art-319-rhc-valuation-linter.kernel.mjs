/**
 * art-319-rhc-valuation-linter.kernel.mjs
 * Valuation Double-Count / Decimal Linter — Robinhood Chain stock tokens.
 * Chainlink feed (8-dec) already includes corporate actions; multiplying by uiMultiplier again
 * double-applies the action. Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-319-rhc-valuation-linter';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'lint_stock_token_valuation',
  mandate_type: 'collateral_mandate',
  gpu:          false,
};

const EPS = 1e-6;

export function compute(pp) {
  const {
    raw_balance,
    chainlink_price_usd,
    ui_multiplier,
    computed_usd_value_under_test,
    applied_multiplier_in_expression,
  } = pp;

  const finite = [raw_balance, chainlink_price_usd, ui_multiplier, computed_usd_value_under_test]
    .every(v => typeof v === 'number' && Number.isFinite(v));

  if (!finite) {
    const output_payload = {
      verdict: 'MISMATCH_UNEXPLAINED',
      reason: 'non_finite_or_missing_input',
      correct_value: null,
      double_counted_value: null,
      delta: null,
      corrected_expression: 'raw_balance * chainlink_price_usd',
    };
    return { output_payload, compliance_flags: ['RHC_VALUATION_INPUT_INVALID'] };
  }

  const correct_value = raw_balance * chainlink_price_usd;
  const double_counted_value = raw_balance * chainlink_price_usd * ui_multiplier;

  const matchesCorrect = Math.abs(computed_usd_value_under_test - correct_value) < EPS * Math.max(1, Math.abs(correct_value));
  const matchesDoubleCounted = Math.abs(computed_usd_value_under_test - double_counted_value) < EPS * Math.max(1, Math.abs(double_counted_value));

  let verdict;
  let discrepancy = null;
  if (matchesCorrect) {
    verdict = 'CLEAN';
  } else if (matchesDoubleCounted || applied_multiplier_in_expression === true) {
    verdict = 'DOUBLE_COUNT_DETECTED';
    discrepancy = 'valuation_expression_reapplies_ui_multiplier_already_priced_in_by_chainlink_feed';
  } else {
    verdict = 'MISMATCH_UNEXPLAINED';
    discrepancy = 'computed_value_matches_neither_correct_nor_double_counted_expression';
  }

  const delta = computed_usd_value_under_test - correct_value;

  const output_payload = {
    verdict,
    correct_value,
    double_counted_value,
    computed_usd_value_under_test,
    delta,
    discrepancy,
    corrected_expression: 'raw_balance * chainlink_price_usd  (do not multiply by uiMultiplier — the feed already reflects it)',
  };

  const compliance_flags = verdict === 'CLEAN' ? ['RHC_VALUATION_CLEAN'] : ['RHC_VALUATION_DOUBLE_COUNT'];
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
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
