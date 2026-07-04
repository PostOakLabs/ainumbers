import { executionHash } from './_hash.mjs';
import { log } from './_detmath.bundle.mjs';

const TOOL_ID = 'art-211-prediction-market-analyzer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'analyze_prediction_market',
  mandate_type: 'event_market_pnl', gpu: false,
};

// Kalshi parabolic taker fee: ceil_to_cent(coef * n * P * (1-P))
function kalshiFee(coef, n, p) {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return 0;
  const raw = coef * n * p * (1 - p);
  return Math.ceil(raw * 100) / 100;
}

// Per-venue fee (taker, binary mode). Returns USD fee.
function venueFee(venue, n, entry_price) {
  const p = Math.max(0.001, Math.min(0.999, Number(entry_price) || 0.5));
  if (venue === 'kalshi') return kalshiFee(0.07, n, p);
  if (venue === 'cme_event') return 0.5 * n;
  if (venue === 'robinhood') return 0.1 * n;
  return 0; // polymarket ~0, default
}

// Fractional odds string (e.g. "3/2")
function fractionalOdds(decimal) {
  // decimal = payout/entry. fractional = (decimal-1)/1 expressed as ratio
  const f = decimal - 1;
  if (!Number.isFinite(f) || f <= 0) return 'N/A';
  // Find a good integer approximation up to denom 99
  let bestNum = 1, bestDen = 1, bestErr = Math.abs(f - 1);
  for (let d = 1; d <= 99; d++) {
    const n2 = Math.round(f * d);
    if (n2 > 0) {
      const err = Math.abs(f - n2 / d);
      if (err < bestErr) { bestErr = err; bestNum = n2; bestDen = d; }
    }
  }
  const g = gcd(bestNum, bestDen);
  return (bestNum / g) + '/' + (bestDen / g);
}

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

function round6(v) { return isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function round4(v) { return isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }
function round2(v) { return isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

export function compute(pp) {
  pp = pp || {};

  const mode = (pp.mode === 'scalar') ? 'scalar' : 'binary';
  const venue = pp.venue || 'polymarket';
  const side = pp.side || 'yes';
  const payout = Math.max(0.01, safeNum(pp.payout, 1.0));
  const n = Math.max(1, Math.round(safeNum(pp.n_contracts, 1)));
  const bankroll = Math.max(1, safeNum(pp.bankroll, 1000));

  const compliance_flags = [];

  let output_payload;

  if (mode === 'binary') {
    const entry_price = Math.min(payout * 0.9999, Math.max(payout * 0.0001, safeNum(pp.entry_price, 0.5)));
    const no_ask = Number.isFinite(Number(pp.no_ask)) ? Math.min(payout * 0.9999, Math.max(payout * 0.0001, Number(pp.no_ask))) : null;
    const won = (pp.won === 1 || pp.won === '1' || pp.won === true) ? 1 : 0;
    const user_probability = Number.isFinite(Number(pp.user_probability)) ? Math.min(0.9999, Math.max(0.0001, Number(pp.user_probability))) : null;

    const isYesSide = side !== 'no';
    const yesWon = won === 1;
    const holdingWon = isYesSide ? yesWon : !yesWon;
    const payout_received = holdingWon ? payout : 0;

    const fee = venueFee(venue, n, entry_price / payout);
    const pnl = round2(n * (payout_received - entry_price) - fee);

    const implied_probability = round4(entry_price / payout);
    const break_even_probability = round4((entry_price + fee / n) / payout);

    // No-vig fair value
    let fair_yes_prob;
    if (no_ask !== null) {
      const total = entry_price + no_ask;
      fair_yes_prob = round4(total > 0 ? entry_price / total : implied_probability);
    } else {
      fair_yes_prob = implied_probability;
    }

    // Decimal odds (per unit risked)
    const decimal_odds = round4(payout / entry_price);
    let american_odds;
    if (decimal_odds >= 2) {
      american_odds = Math.round((decimal_odds - 1) * 100);
    } else if (decimal_odds > 1) {
      american_odds = Math.round(-100 / (decimal_odds - 1));
    } else {
      american_odds = -9999;
    }

    // EV and Kelly (require user_probability)
    let expected_value = null;
    let kelly_fraction = null;
    let half_kelly_stake = null;
    if (user_probability !== null) {
      const pnl_win = n * (payout - entry_price) - fee;
      const pnl_lose = -n * entry_price - fee;
      expected_value = round4(user_probability * pnl_win + (1 - user_probability) * pnl_lose);

      const b = (payout - entry_price) / entry_price;
      if (b > 0) {
        const kf = (user_probability * b - (1 - user_probability)) / b;
        kelly_fraction = round4(Math.max(0, kf));
        half_kelly_stake = round2(0.5 * kelly_fraction * bankroll);
      } else {
        kelly_fraction = 0;
        half_kelly_stake = 0;
      }
    }

    // Forecast accuracy scores (if forecast_prob provided)
    let brier_score = null;
    let log_score = null;
    const forecast_prob = Number.isFinite(Number(pp.forecast_prob)) ? Math.min(0.9999, Math.max(0.0001, Number(pp.forecast_prob))) : null;
    const outcome = (pp.outcome === 1 || pp.outcome === '1' || pp.outcome === true) ? 1 : (pp.outcome === 0 || pp.outcome === '0' || pp.outcome === false) ? 0 : null;

    if (forecast_prob !== null && outcome !== null) {
      const p_correct = outcome === 1 ? forecast_prob : (1 - forecast_prob);
      brier_score = round6((forecast_prob - outcome) ** 2);
      const raw_log = log(Math.max(1e-9, p_correct));
      log_score = round6(Number.isFinite(raw_log) ? raw_log : -20.7);
    }

    // Flags
    if (implied_probability < 0.05 || implied_probability > 0.95) compliance_flags.push('EXTREME_PROBABILITY');
    if (entry_price <= 0 || entry_price >= payout) compliance_flags.push('INVALID_PRICE');
    if (won === 0) compliance_flags.push('POSITION_EXPIRED_LOSS');
    if (kelly_fraction !== null && kelly_fraction === 0 && user_probability !== null) compliance_flags.push('NEGATIVE_EDGE');

    output_payload = {
      mode: 'binary',
      venue: String(venue),
      side: isYesSide ? 'yes' : 'no',
      entry_price: round6(entry_price),
      n_contracts: n,
      payout: round6(payout),
      won: won,
      pnl: pnl,
      fee_paid: round2(fee),
      implied_probability: implied_probability,
      break_even_probability: break_even_probability,
      no_vig_fair_value: fair_yes_prob,
      expected_value: expected_value,
      kelly_fraction: kelly_fraction,
      half_kelly_stake: half_kelly_stake,
      odds_decimal: decimal_odds,
      odds_american: american_odds,
      odds_fractional: fractionalOdds(decimal_odds),
      brier_score: brier_score,
      log_score: log_score,
      disclaimer: 'Not financial advice. For informational purposes only. Verify all fee schedules with the venue before trading.',
    };

  } else {
    // Scalar mode
    const strike = safeNum(pp.strike, 3.5);
    const settlement_value = safeNum(pp.settlement_value, 4.0);
    const unit_value = Math.max(1, safeNum(pp.unit_value, 200));
    const contract_min = safeNum(pp.contract_min, 0);
    const contract_max = safeNum(pp.contract_max, 100);
    const side_sign = side === 'long' ? 1 : -1;

    const settlement_clamped = Math.max(contract_min, Math.min(contract_max, settlement_value));
    const settlement_delta = settlement_clamped - strike;
    const pnl = round2(side_sign * settlement_delta * unit_value * n);

    const in_range = settlement_value >= contract_min && settlement_value <= contract_max;
    if (!in_range) compliance_flags.push('OUT_OF_RANGE');
    if (pnl < 0) compliance_flags.push('NEGATIVE_PNL');

    output_payload = {
      mode: 'scalar',
      venue: String(venue),
      side: side === 'long' ? 'long' : 'short',
      strike: round6(strike),
      settlement_value: round6(settlement_value),
      settlement_clamped: round6(settlement_clamped),
      settlement_delta: round6(settlement_delta),
      unit_value: unit_value,
      n_contracts: n,
      pnl: pnl,
      settlement_in_range: in_range,
      disclaimer: 'Not financial advice. For informational purposes only.',
    };
  }

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
