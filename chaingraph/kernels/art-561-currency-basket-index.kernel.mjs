// art-561 — Currency Basket Index: fixed-amount basket valuation.
//
// DERIV-WORKFLOWS-BUILD-SPEC.md §6 (AT-10). Values a currency basket by the
// fixed-amount method: currency AMOUNTS are fixed at a rebase date and the
// live WEIGHTS float daily with FX. The non-obvious arithmetic this node owns
// is the derivation of fixed amounts from target weights on a transition date,
// then the daily valuation that follows from them.
//
//   Valuation:   index_in_USD = sum( fixed_amount_i * usd_rate_i )
//   Live weight: w_i(t)       = fixed_amount_i * usd_rate_i / index_in_USD
//   Derivation:  fixed_amount_i = target_w_i * index_value_at_rebase / usd_rate_i(rebase)
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): every FX rate,
// fixed amount and target weight is SUPPLIED by the caller and merely ASSERTED.
// This kernel performs zero FX, reference-rate or market-data lookups
// (zero-egress by contract, no network calls of any kind). It computes what the
// stated method yields on the stated numbers -- never that those numbers are
// the correct rates for the stated date, and never a live basket publication.
//
// Presets are MECHANISM-named and describe published basket structures by their
// arithmetic, not by any venue that operates them.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-561-currency-basket-index';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'currency_basket_index',
  mandate_type: 'currency_basket_index',
  gpu: false,
};

const MODES = ['fixed_amount_valuation', 'derive_amounts_from_target_weights'];

const AMOUNT_DP = 10;
const RATE_DP = 10;
const PCT_DP = 6;
const INDEX_DP = 8;

const NOT_PROVEN = [
  { item: 'FX-rate accuracy', detail: 'Every usd_rate is caller-supplied and asserted. This kernel performs no FX, reference-rate or market-data lookups (zero-egress) and does not verify any rate against a published fixing for the stated date.' },
  { item: 'Basket-composition authority', detail: 'Fixed amounts and target weights are caller-supplied. This kernel does not verify that a stated composition matches any published basket, nor that a preset remains current -- a basket reviewed on a periodic cycle changes on its own schedule.' },
  { item: 'Live index publication', detail: 'The index value computed here is what the fixed-amount method yields on the supplied rates. It is not a claim that any basket administrator did, or would, publish this value for this date.' },
  { item: 'Parent-print freshness', detail: 'Where per-pair rates are cited from upstream oracle prints, this kernel records the citation but does not verify that those prints are current, in-epoch, or drawn from the same observation window.' },
];

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function nonEmpty(v) { const s = safeStr(v); return s.length > 0 ? s : null; }
function num(v) { return Number.isFinite(v) ? v : null; }
function r(x, dp) {
  if (!Number.isFinite(x)) return null;
  return Number(x.toFixed(dp));
}

// Integer power of ten by repeated multiplication. Math.pow is a transcendental
// whose last bit is not pinned across runtimes, and amount_scale is always a
// small non-negative integer, so exact integer arithmetic is both correct and
// bit-portable across every §24 surface.
function pow10(n) {
  let out = 1;
  for (let i = 0; i < n; i += 1) out *= 10;
  return out;
}

function normalizeComponent(raw, i, mode, rejected) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const currency = nonEmpty(c.currency);
  if (!currency) rejected.push({ where: `components[${i}].currency`, reason: 'absent -- each component must name its currency', supplied: null });

  const usd_rate = num(c.usd_rate);
  if (usd_rate === null) rejected.push({ where: `components[${i}].usd_rate`, reason: 'absent or not a finite number -- the USD value of one unit of this currency is required', supplied: c.usd_rate === undefined ? null : c.usd_rate });
  else if (usd_rate <= 0) rejected.push({ where: `components[${i}].usd_rate`, reason: 'must be greater than zero', supplied: c.usd_rate });

  const fixed_amount = num(c.fixed_amount);
  const target_weight = num(c.target_weight);
  const rebase_usd_rate = num(c.rebase_usd_rate);

  if (mode === 'fixed_amount_valuation' && fixed_amount === null) {
    rejected.push({ where: `components[${i}].fixed_amount`, reason: 'absent -- fixed_amount_valuation requires the amount fixed at the rebase date', supplied: c.fixed_amount === undefined ? null : c.fixed_amount });
  }
  if (mode === 'derive_amounts_from_target_weights') {
    if (target_weight === null) rejected.push({ where: `components[${i}].target_weight`, reason: 'absent -- deriving amounts requires each component target weight (as a fraction, not a percentage)', supplied: c.target_weight === undefined ? null : c.target_weight });
    if (rebase_usd_rate === null) rejected.push({ where: `components[${i}].rebase_usd_rate`, reason: 'absent -- deriving amounts requires the USD rate observed on the rebase date', supplied: c.rebase_usd_rate === undefined ? null : c.rebase_usd_rate });
    else if (rebase_usd_rate <= 0) rejected.push({ where: `components[${i}].rebase_usd_rate`, reason: 'must be greater than zero', supplied: c.rebase_usd_rate });
  }

  return {
    currency,
    usd_rate: usd_rate !== null && usd_rate > 0 ? usd_rate : null,
    fixed_amount,
    target_weight,
    rebase_usd_rate: rebase_usd_rate !== null && rebase_usd_rate > 0 ? rebase_usd_rate : null,
    idx: i,
  };
}

/**
 * compute(pp) — fixed-amount basket valuation.
 * pp: {
 *   mode: 'fixed_amount_valuation' | 'derive_amounts_from_target_weights',
 *   basket_id: string,
 *   as_of_date: string,
 *   components: [{ currency, usd_rate, fixed_amount?, target_weight?, rebase_usd_rate? }],
 *   index_value_at_rebase?: number,   // derive mode; default 1.0
 *   amount_scale?: number,            // integer-quantity baskets: divide by 10^scale
 *   prior_index_value?: number,       // for the basket_shift_pct readout
 *   parent_print_hashes?: string[],   // per-pair oracle prints these rates came from
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const modeRaw = nonEmpty(pp.mode);
  const mode = modeRaw && MODES.indexOf(modeRaw) !== -1 ? modeRaw : null;
  if (!mode) {
    rejected_inputs.push({ where: 'mode', reason: modeRaw ? `not one of the supported modes: ${MODES.join(', ')}` : `absent -- must be stated explicitly, never assumed; one of: ${MODES.join(', ')}`, supplied: modeRaw });
  }

  const basket_id = nonEmpty(pp.basket_id);
  if (!basket_id) rejected_inputs.push({ where: 'basket_id', reason: 'absent -- an identifier for the basket being valued is required', supplied: null });
  const as_of_date = nonEmpty(pp.as_of_date);
  if (!as_of_date) rejected_inputs.push({ where: 'as_of_date', reason: 'absent -- the valuation date is required', supplied: null });

  const amount_scale = Number.isFinite(pp.amount_scale) && pp.amount_scale >= 0 ? Math.floor(pp.amount_scale) : 0;
  const scaleDiv = pow10(amount_scale);
  const index_value_at_rebase = Number.isFinite(pp.index_value_at_rebase) && pp.index_value_at_rebase > 0 ? pp.index_value_at_rebase : 1.0;
  const prior_index_value = Number.isFinite(pp.prior_index_value) && pp.prior_index_value > 0 ? pp.prior_index_value : null;

  const parentHashesRaw = Array.isArray(pp.parent_print_hashes) ? pp.parent_print_hashes : [];
  const parent_print_hashes = parentHashesRaw.map((h) => nonEmpty(h)).filter(Boolean);

  const componentsRaw = Array.isArray(pp.components) ? pp.components : [];
  const components = componentsRaw.map((c, i) => normalizeComponent(c, i, mode, rejected_inputs));

  let structural_error = null;
  if (!mode) structural_error = 'mode is required.';
  else if (!basket_id) structural_error = 'basket_id is required.';
  else if (!as_of_date) structural_error = 'as_of_date is required.';
  else if (components.length === 0) structural_error = 'components must be a non-empty array.';
  else if (components.some((c) => !c.currency || c.usd_rate === null)) structural_error = 'every component requires a currency and a positive usd_rate.';
  else if (mode === 'fixed_amount_valuation' && components.some((c) => c.fixed_amount === null)) structural_error = 'fixed_amount_valuation requires a fixed_amount on every component.';
  else if (mode === 'derive_amounts_from_target_weights' && components.some((c) => c.target_weight === null || c.rebase_usd_rate === null)) structural_error = 'derive_amounts_from_target_weights requires target_weight and rebase_usd_rate on every component.';

  // Target weights must sum to 1 in derive mode -- checked before use, since a
  // basket derived from weights that do not sum to one is not a basket.
  let target_weight_sum = null;
  if (!structural_error && mode === 'derive_amounts_from_target_weights') {
    target_weight_sum = r(components.reduce((a, c) => a + c.target_weight, 0), PCT_DP);
    if (Math.abs(target_weight_sum - 1) > 0.001) {
      structural_error = `target weights must sum to 1 within 0.001; supplied sum is ${target_weight_sum}.`;
    }
  }

  let index_value = null;
  let rows = [];
  let dominant_contributor = null;
  let dominant_contribution_pct = null;
  let basket_shift_pct = null;
  let max_drift_pct = null;

  if (!structural_error) {
    // Resolve each component's effective fixed amount.
    const resolved = components.map((c) => {
      const amount = mode === 'derive_amounts_from_target_weights'
        ? (c.target_weight * index_value_at_rebase) / c.rebase_usd_rate
        : c.fixed_amount / scaleDiv;
      return { ...c, amount };
    });

    index_value = resolved.reduce((a, c) => a + c.amount * c.usd_rate, 0);

    rows = resolved.map((c) => {
      const contribution = c.amount * c.usd_rate;
      const live_weight = index_value > 0 ? contribution / index_value : null;
      const drift = (c.target_weight != null && live_weight != null) ? (live_weight - c.target_weight) * 100 : null;
      return {
        currency: c.currency,
        fixed_amount: r(c.amount, AMOUNT_DP),
        usd_rate: r(c.usd_rate, RATE_DP),
        usd_contribution: r(contribution, INDEX_DP),
        live_weight_pct: live_weight != null ? r(live_weight * 100, PCT_DP) : null,
        target_weight_pct: c.target_weight != null ? r(c.target_weight * 100, PCT_DP) : null,
        drift_from_target_pct: drift != null ? r(drift, PCT_DP) : null,
      };
    });

    const top = rows.reduce((best, row) => (best === null || row.usd_contribution > best.usd_contribution ? row : best), null);
    if (top) {
      dominant_contributor = top.currency;
      dominant_contribution_pct = top.live_weight_pct;
    }

    const drifts = rows.map((row) => row.drift_from_target_pct).filter((d) => d != null).map(Math.abs);
    if (drifts.length) max_drift_pct = r(Math.max(...drifts), PCT_DP);

    if (prior_index_value != null) {
      basket_shift_pct = r((index_value - prior_index_value) / prior_index_value * 100, PCT_DP);
    }

    index_value = r(index_value, INDEX_DP);
  }

  const compliance_flags = [];
  if (structural_error) {
    compliance_flags.push('CURRENCY_BASKET_STRUCTURAL_ERROR');
    if (target_weight_sum != null && Math.abs(target_weight_sum - 1) > 0.001) compliance_flags.push('WEIGHTS_DO_NOT_SUM_TO_ONE');
  } else {
    compliance_flags.push('CURRENCY_BASKET_VALUED');
    if (basket_shift_pct != null && Math.abs(basket_shift_pct) > 5) compliance_flags.push('EXTREME_MOVEMENT');
    if (parent_print_hashes.length > 0) compliance_flags.push('CURRENCY_BASKET_PARENT_PRINTS_CITED');
  }
  if (rejected_inputs.length > 0) compliance_flags.push('CURRENCY_BASKET_INPUTS_REJECTED');
  compliance_flags.push('CURRENCY_BASKET_INPUTS_SUPPLIED_NOT_VERIFIED');

  const output_payload = {
    basket_id,
    as_of_date,
    mode,
    structural_error,
    index_value,
    components: rows,
    component_count: rows.length,
    dominant_contributor,
    dominant_contribution_pct,
    max_drift_from_target_pct: max_drift_pct,
    basket_shift_pct,
    target_weight_sum,
    amount_scale,
    parent_print_hashes,
    rejected_inputs,
    not_proven: NOT_PROVEN,
    fence: 'Every FX rate, fixed amount and target weight is SUPPLIED, asserted, and digested into this receipt. This kernel computes what the fixed-amount basket method yields on the stated numbers: it performs no FX or reference-rate lookups (zero-egress by contract), does not verify any rate against a published fixing, and makes no claim that any administrator did or would publish this value.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);

  // Per-pair oracle prints cited as parents. chain.* is OUTSIDE the §4 preimage,
  // so this population never moves execution_hash.
  let ph = parent_hashes;
  let pt = parent_tool_ids;
  let cd = chain_depth;
  if (ph.length === 0 && output_payload.parent_print_hashes.length > 0) {
    ph = output_payload.parent_print_hashes.slice();
    pt = ph.map(() => 'art-560-oracle-price-aggregation');
    cd = chain_depth > 0 ? chain_depth : 1;
  }

  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes: ph, parent_tool_ids: pt, chain_depth: cd },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    compute_mode:       'server',
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
