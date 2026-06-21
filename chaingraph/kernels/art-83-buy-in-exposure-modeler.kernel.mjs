/**
 * art-83-buy-in-exposure-modeler.kernel.mjs
 * Wave 17 — Buy-In Exposure Modeler.
 * Models CSDR Refit last-resort mandatory buy-in exposure: eligible trigger date,
 * extension period, buy-in cost mark-up, and cash-compensation alternative.
 * CSDR Refit buy-in reform is pending final adoption — verify status before use.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   CSDR Reg. (EU) 909/2014 Art 7 — current buy-in framework.
 *   CSDR Refit Reg. (EU) 2023/2845 — adopted 27 Nov 2023, mandatory buy-in
 *     provisions reform: last-resort after extension period, suspended pending
 *     delegated acts. Verify current adoption status and application date.
 *   ESMA CSDR Refit RTS (delegated acts) — not yet in force as of Jun 2026
 *     (verify). Buy-in reform suspended until delegated acts published.
 *   Buy-in cost mark-up baked as configurable (default 5% over last traded price).
 *   EDUCATIONAL: outputs are decision-support drafts.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-83-buy-in-exposure-modeler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'model_buy_in_exposure',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// ─── CSDR Refit extension periods by asset class (calendar days) ─────────────
// Source: CSDR Refit Art 7 (Reg. 2023/2845) — verify in force.
// Liquid equities: 4 business days → ~7 calendar (approx). For model: calendar days.
// Government bonds: 7 business days → ~12 calendar.
// Other bonds: 7 business days → ~12 calendar.
// SME/illiquid: 15 business days → ~22 calendar.
const EXTENSION_DAYS_CALENDAR = {
  liquid_equity:  7,
  government_bond: 12,
  other_bond:     12,
  sme_equity:     22,
  illiquid:       22,
};

const DEFAULT_BUYIN_MARKUP   = 0.05;   // 5% over reference price
const DEFAULT_CASH_COMP_PCT  = 0.10;   // 10% premium on reference price for cash comp

export function compute(pp) {
  const {
    fails = [],  // [{ asset_class, quantity, reference_price, fail_date_t, current_date_t, currency }]
    buyin_markup_pct = DEFAULT_BUYIN_MARKUP,
    cash_comp_premium_pct = DEFAULT_CASH_COMP_PCT,
    delegated_acts_in_force = false,  // CSDR Refit buy-in delegated acts — verify before setting true
  } = pp;

  const modeled_fails = [];
  let total_buyin_exposure    = 0;
  let total_cash_comp_exposure = 0;
  let buyin_triggered_count   = 0;

  for (const f of fails) {
    const ac        = String(f.asset_class ?? 'liquid_equity');
    const qty       = +(f.quantity      ?? 0);
    const refPrice  = +(f.reference_price ?? 0);
    const notional  = qty * refPrice;

    // Days elapsed since fail (T = day-0)
    const failDateOrd  = +(f.fail_date_t  ?? 0);
    const currDateOrd  = +(f.current_date_t ?? failDateOrd);
    const days_elapsed = Math.max(0, currDateOrd - failDateOrd);

    const extension_days = EXTENSION_DAYS_CALENDAR[ac] ?? EXTENSION_DAYS_CALENDAR.liquid_equity;
    const buyin_eligible = days_elapsed >= extension_days;

    // Buy-in cost = reference price × (1 + markup) × quantity
    const buyin_cost = +(notional * (1 + +buyin_markup_pct)).toFixed(2);
    // Cash compensation = reference price × (1 + cash_comp_premium) × quantity
    const cash_comp  = +(notional * (1 + +cash_comp_premium_pct)).toFixed(2);

    if (buyin_eligible) {
      buyin_triggered_count++;
      total_buyin_exposure     += buyin_cost;
      total_cash_comp_exposure += cash_comp;
    }

    modeled_fails.push({
      asset_class:     ac,
      quantity:        qty,
      reference_price: refPrice,
      notional:        +notional.toFixed(2),
      days_elapsed,
      extension_days_threshold: extension_days,
      buyin_eligible,
      buyin_cost:     buyin_eligible ? buyin_cost : null,
      cash_comp_alt:  buyin_eligible ? cash_comp  : null,
      currency:       f.currency ?? 'EUR',
      buyin_markup_pct: +buyin_markup_pct,
      cash_comp_premium_pct: +cash_comp_premium_pct,
    });
  }

  const compliance_flags = [];
  if (!delegated_acts_in_force)  compliance_flags.push('BUYIN_REFORM_PENDING_DELEGATED_ACTS');
  if (buyin_triggered_count > 0) compliance_flags.push('BUYIN_TRIGGERED');

  const output_payload = {
    total_buyin_exposure:     +total_buyin_exposure.toFixed(2),
    total_cash_comp_exposure: +total_cash_comp_exposure.toFixed(2),
    buyin_triggered_count,
    total_fails:              fails.length,
    modeled_fails,
    status_note: delegated_acts_in_force
      ? 'CSDR Refit buy-in delegated acts flagged in-force — verify current status.'
      : 'CSDR Refit mandatory buy-in reform PENDING delegated acts (not yet in force as of Jun 2026). Buy-in exposure is modeled for planning purposes only.',
    reference: {
      regulation: 'CSDR Reg. (EU) 909/2014 Art 7; CSDR Refit Reg. (EU) 2023/2845 (27 Nov 2023)',
      extension_days_source: 'CSDR Refit Art 7 extension periods (approximate calendar days — verify against business-day convention)',
      note: 'CSDR Refit mandatory buy-in reform suspended pending delegated acts. Verify adoption date and applicability from ESMA/EC publications before relying on buy-in trigger dates.',
    },
    note: 'DECISION-SUPPORT DRAFT — buy-in exposure is a modeled estimate for planning purposes. Reference-price mark-up and cash compensation premium are configurable inputs. CSDR Refit buy-in reform applicability: verify current status against ESMA/EC publications (as of Jun 2026, delegated acts not yet in force).',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
