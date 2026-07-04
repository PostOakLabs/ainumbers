import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-212-prediction-market-arbitrage';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'find_prediction_arbitrage',
  mandate_type: 'event_market_pnl', gpu: false,
};

// Kalshi parabolic taker fee: ceil_to_cent(0.07 * n * P * (1-P))
function kalshiFee(n, p) {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return 0;
  return Math.ceil(0.07 * n * p * (1 - p) * 100) / 100;
}

function venueFee(venue, n, price) {
  const p = Math.max(0.001, Math.min(0.999, price));
  if (venue === 'kalshi') return kalshiFee(n, p);
  if (venue === 'cme_event') return 0.5 * n;
  if (venue === 'robinhood') return 0.1 * n;
  if (venue === 'sx_bet') return Math.round(0.02 * n * p * 100) / 100;
  return 0;
}

function round6(v) { return isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function round4(v) { return isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }
function round2(v) { return isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

export function compute(pp) {
  pp = pp || {};

  const venue_a = pp.venue_a || 'polymarket';
  const venue_b = pp.venue_b || 'kalshi';
  const payout = Math.max(0.01, safeNum(pp.payout, 1.0));
  const stake_total = Math.max(1, safeNum(pp.stake_total, 1000));

  // Prices in [0, payout). Default to a small arb scenario.
  const yes_price_a = Math.min(payout * 0.9999, Math.max(payout * 0.0001, safeNum(pp.yes_price_a, 0.45)));
  const no_price_b = Math.min(payout * 0.9999, Math.max(payout * 0.0001, safeNum(pp.no_price_b, 0.50)));

  const compliance_flags = [];

  // Gross spread (fractional of payout)
  const cost_per_unit = yes_price_a + no_price_b;
  const gross_spread = payout - cost_per_unit;
  const arb_exists = gross_spread > 0;

  // Contracts: k units of the arb pair for stake_total capital
  // Each unit costs (yes_price_a + no_price_b) in capital
  const k_contracts = cost_per_unit > 0 ? stake_total / cost_per_unit : 0;
  const capital_deployed = round2(k_contracts * cost_per_unit);

  const gross_profit = round2(k_contracts * gross_spread);

  // Fees (applying fee to each leg)
  const fee_a = round2(venueFee(venue_a, k_contracts, yes_price_a / payout));
  const fee_b = round2(venueFee(venue_b, k_contracts, no_price_b / payout));
  const total_fees = round2(fee_a + fee_b);

  const net_profit = round2(gross_profit - total_fees);
  const net_edge_pct = capital_deployed > 0 ? round4(net_profit / capital_deployed * 100) : 0;

  // Survival threshold: min gross spread that breaks even after fees
  const fee_at_unit = venueFee(venue_a, 1, yes_price_a / payout) + venueFee(venue_b, 1, no_price_b / payout);
  const min_gross_spread_to_survive = cost_per_unit > 0 ? round4(fee_at_unit / (stake_total / cost_per_unit) * (stake_total / cost_per_unit) / k_contracts) : 0;
  // Simpler: the arb survives if gross_spread > total_fees / k_contracts
  const min_spread_to_break_even = round4(k_contracts > 0 ? total_fees / k_contracts : 0);

  // Implied probabilities
  const implied_prob_a = round4(yes_price_a / payout);
  const implied_prob_b_no = round4(no_price_b / payout);
  const implied_prob_b_yes = round4(1 - implied_prob_b_no);
  const consensus_gap = round4(Math.abs(implied_prob_a - implied_prob_b_yes));

  if (!arb_exists) compliance_flags.push('NO_ARB_OPPORTUNITY');
  if (net_profit <= 0) compliance_flags.push('FEES_ELIMINATE_EDGE');
  if (gross_spread > 0 && gross_spread < 0.03) compliance_flags.push('THIN_SPREAD');
  if (venue_a === venue_b) compliance_flags.push('SAME_VENUE');

  const output_payload = {
    venue_a: String(venue_a),
    venue_b: String(venue_b),
    yes_price_a: round6(yes_price_a),
    no_price_b: round6(no_price_b),
    payout: round6(payout),
    gross_spread: round6(gross_spread),
    gross_spread_pct: round4(payout > 0 ? gross_spread / payout * 100 : 0),
    arb_exists: arb_exists,
    stake_total: round2(stake_total),
    k_contracts: round4(k_contracts),
    capital_deployed: capital_deployed,
    gross_profit: gross_profit,
    fee_a: fee_a,
    fee_b: fee_b,
    total_fees: total_fees,
    net_profit: net_profit,
    net_edge_pct: net_edge_pct,
    min_spread_to_break_even: min_spread_to_break_even,
    implied_prob_yes_a: implied_prob_a,
    implied_prob_yes_b: implied_prob_b_yes,
    consensus_gap: consensus_gap,
    disclaimer: 'Not financial advice. Arb opportunities are transient and may disappear before execution. Verify current prices and fees with each venue. For informational purposes only.',
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
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
