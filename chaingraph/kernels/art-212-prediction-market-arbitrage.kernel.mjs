import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-212-prediction-market-arbitrage';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'find_prediction_arbitrage',
  mandate_type: 'event_market_pnl', gpu: false,
};

// ---- Parabolic taker fee, exact integer arithmetic (same table and rules as art-211) ----
// fee = theta * C * p * (1 - p). Price p is held on a micro grid (pu = p * 1e6,
// clamped to 1000..999000, i.e. 0.001..0.999). The contract count here is a stake
// ratio, not a whole number, so C is held as integer micro-contracts:
// cu = round_half_up(k_contracts * 1e6), cs = 1e6. Every fee is returned in integer
// micro-dollars (BigInt); rounding happens once, on the regime's own grid.
const PRICE_SCALE = 1000000n;
const CONTRACT_SCALE = 1000000n;
function ceilDiv(a, b) { return (a + b - 1n) / b; }   // a >= 0, b > 0
function halfUpDiv(a, b) { return (2n * a + b) / (2n * b); }
function priceMicro(p) {
  const q = Number.isFinite(p) ? p : 0.5;
  return BigInt(Math.min(999000, Math.max(1000, Math.round(q * 1e6))));
}
function contractsMicro(k) {
  return BigInt(Math.max(0, Math.round((Number.isFinite(k) ? k : 0) * 1e6)));
}
function parabolic(theta_num, theta_den, cu, cs, pu) {
  return {
    num: theta_num * cu * pu * (PRICE_SCALE - pu),
    den: theta_den * cs * PRICE_SCALE * PRICE_SCALE,
  };
}

// Polymarket global taker rates by market category (docs.polymarket.com/trading/fees,
// retrieved 2026-10-30). Makers pay 0; maker rebates are paid out of collected
// taker fees and are not a per-trade fee, so they stay out of this node.
const POLYMARKET_GLOBAL_RATES = {
  crypto: [7n, 100n], sports: [5n, 100n], finance: [4n, 100n], politics: [4n, 100n],
  economics: [5n, 100n], culture: [5n, 100n], weather: [5n, 100n], other: [5n, 100n],
  mentions: [4n, 100n], tech: [4n, 100n], geopolitics: [0n, 1n], combos: [5n, 100n],
};
// Polymarket US taker theta by effective date (CFTC 40.6(d) letters dated 2026-07-07
// and 2026-09-21; both effective 12:00 a.m. ET on the date shown).
const POLYMARKET_US_THETA = [
  { from: '2026-09-17', theta: [695n, 10000n], label: '0.0695' },
  { from: '2026-07-01', theta: [6n, 100n], label: '0.06' },
  { from: '', theta: [5n, 100n], label: '0.05' },
];
const DEFAULT_FEE_REGIME = 'polymarket_global';
const DEFAULT_MARKET_CATEGORY = 'other';
const DEFAULT_AS_OF = '2026-10-30';

function fmtRatio(n, d) {
  if (n === 0n) return '0';
  const s = (n * 1000000n / d).toString().padStart(7, '0');
  return (s.slice(0, -6) + '.' + s.slice(-6)).replace(/0+$/, '').replace(/\.$/, '');
}

// Per-leg taker fee for the whole leg. Returns { micro (BigInt micro-dollars), regime, theta, rounding }.
function venueFee(venue, cu, cs, price, opts) {
  const pu = priceMicro(price);
  if (venue === 'kalshi') {
    // Kalshi standard schedule (multiplier 1): theta 0.07, ceil to the cent for the leg.
    const f = parabolic(7n, 100n, cu, cs, pu);
    return { micro: ceilDiv(f.num * 100n, f.den) * 10000n, regime: 'kalshi', theta: '0.07', rounding: 'ceil_cent' };
  }
  if (venue === 'polymarket') {
    if (opts.fee_regime === 'polymarket_us') {
      const row = POLYMARKET_US_THETA.find(r => opts.as_of >= r.from);
      const f = parabolic(row.theta[0], row.theta[1], cu, cs, pu);
      // The filings state no rounding rule; shown to $0.000001, half-up.
      return { micro: halfUpDiv(f.num * PRICE_SCALE, f.den), regime: 'polymarket_us', theta: row.label, rounding: 'half_up_micro_usd_unstated_in_filing' };
    }
    const rate = POLYMARKET_GLOBAL_RATES[opts.market_category];
    const f = parabolic(rate[0], rate[1], cu, cs, pu);
    // "Fees are rounded to 5 decimal places ... Anything smaller rounds to zero": truncate to $0.00001.
    return { micro: (f.num * 100000n / f.den) * 10n, regime: 'polymarket_global', theta: fmtRatio(rate[0], rate[1]), rounding: 'truncate_5dp' };
  }
  // cme_event, robinhood and sx_bet: unchanged by this fix (cent-rounded as before).
  const n = Number(cu) / Number(cs);
  const p = Math.max(0.001, Math.min(0.999, price));
  let legacy = null;
  if (venue === 'cme_event') legacy = 0.5 * n;
  if (venue === 'robinhood') legacy = 0.1 * n;
  if (venue === 'sx_bet') legacy = Math.round(0.02 * n * p * 100) / 100;
  if (legacy === null) return { micro: 0n, regime: 'not_modelled', theta: null, rounding: 'none' };
  return { micro: BigInt(Math.round(round2(legacy) * 1e6)), regime: venue + '_legacy', theta: null, rounding: 'round_cent' };
}

function feeOpts(pp) {
  const fee_regime = pp.fee_regime === 'polymarket_us' ? 'polymarket_us' : DEFAULT_FEE_REGIME;
  const cat = String(pp.market_category || DEFAULT_MARKET_CATEGORY).toLowerCase();
  const market_category = Object.prototype.hasOwnProperty.call(POLYMARKET_GLOBAL_RATES, cat) ? cat : DEFAULT_MARKET_CATEGORY;
  const as_of = /^\d{4}-\d{2}-\d{2}$/.test(String(pp.as_of || '')) ? String(pp.as_of) : DEFAULT_AS_OF;
  return { fee_regime, market_category, as_of };
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

  // Fees (applying fee to each leg), priced on integer micro-contracts
  const opts = feeOpts(pp);
  const cu = contractsMicro(k_contracts);
  const leg_a = venueFee(venue_a, cu, CONTRACT_SCALE, yes_price_a / payout, opts);
  const leg_b = venueFee(venue_b, cu, CONTRACT_SCALE, no_price_b / payout, opts);
  const fee_a = Number(leg_a.micro) / 1e6;
  const fee_b = Number(leg_b.micro) / 1e6;
  const total_fees = Number(leg_a.micro + leg_b.micro) / 1e6;

  const net_profit = round2(gross_profit - total_fees);
  const net_edge_pct = capital_deployed > 0 ? round4(net_profit / capital_deployed * 100) : 0;

  // The arb survives if gross_spread > total_fees / k_contracts
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
  if (leg_a.regime === 'not_modelled' || leg_b.regime === 'not_modelled') compliance_flags.push('FEE_NOT_MODELLED');
  const usesPolymarket = venue_a === 'polymarket' || venue_b === 'polymarket';

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
    fee_regime_a: leg_a.regime,
    fee_regime_b: leg_b.regime,
    fee_theta_a: leg_a.theta,
    fee_theta_b: leg_b.theta,
    fee_market_category: usesPolymarket && opts.fee_regime === 'polymarket_global' ? opts.market_category : null,
    fee_as_of: usesPolymarket && opts.fee_regime === 'polymarket_us' ? opts.as_of : null,
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
