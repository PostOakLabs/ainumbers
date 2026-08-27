import { executionHash } from './_hash.mjs';

// art-654-perp-funding-implied-yield — perpetual-contract funding-rate recompute + simple-
// annualized implied funding yield, with optional hash-chaining to the prior funding print
// of the same venue/pair.
//
// Two declared funding mechanism variants (never assumed — the caller must declare one):
//   offshore-8h-twap  continuous premium-index + interest-rate-differential clamp formula,
//                     the shape observed on offshore crypto perpetual venues.
//   kalshi-periodic   a simpler point-in-time price-differential reset, no clamp term.
// Both the mechanism name AND every numeric parameter (interval length, clamp bound) are
// caller-declared policy_parameters — this kernel hardcodes no venue's real-world constant.
//
// Domain validation never clamps or silently coerces a bad input: an invalid/missing field
// is reported by name in output_payload.domain_errors and no rate/yield figure is computed.
//
// Chaining (optional): a caller-supplied prev_funding_hash (this same tool's own prior
// execution_hash) flows straight through policy_parameters into the execution_hash preimage
// (cryptographically binding this print to its predecessor) and auto-populates
// chain.parent_hashes/parent_tool_ids in buildArtifact() below. Omitting it reproduces the
// unlinked single-print artifact shape unchanged.

const TOOL_ID = 'art-654-perp-funding-implied-yield';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_perp_funding_implied_yield',
  mandate_type: 'perp_funding_rate', gpu: false,
};

const MECHANISMS = ['offshore-8h-twap', 'kalshi-periodic'];
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

function round6(v) { return Math.round(v * 1e6) / 1e6; }
function round4(v) { return Math.round(v * 1e4) / 1e4; }

/**
 * compute(pp) — pure decision kernel.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];

  const funding_mechanism = pp.funding_mechanism;
  if (!MECHANISMS.includes(funding_mechanism)) domain_errors.push('INVALID_FUNDING_MECHANISM');

  const venue = (typeof pp.venue === 'string' && pp.venue.length > 0) ? pp.venue : null;

  const mark_price = Number(pp.mark_price);
  if (!Number.isFinite(mark_price) || mark_price <= 0) domain_errors.push('INVALID_MARK_PRICE');

  const index_price = Number(pp.index_price);
  if (!Number.isFinite(index_price) || index_price <= 0) domain_errors.push('INVALID_INDEX_PRICE');

  const interval_hours = Number(pp.interval_hours);
  if (!Number.isFinite(interval_hours) || interval_hours <= 0 || interval_hours > 8760) domain_errors.push('INVALID_INTERVAL_HOURS');

  const position_notional = Number(pp.position_notional);
  if (!Number.isFinite(position_notional) || position_notional < 0) domain_errors.push('INVALID_POSITION_NOTIONAL');

  const position_side = pp.position_side;
  if (position_side !== 'long' && position_side !== 'short') domain_errors.push('INVALID_POSITION_SIDE');

  const premium_index_pct = Number(pp.premium_index_pct);
  if (!Number.isFinite(premium_index_pct)) domain_errors.push('INVALID_PREMIUM_INDEX_PCT');

  const interest_rate_pct = (pp.interest_rate_pct === undefined || pp.interest_rate_pct === null) ? 0 : Number(pp.interest_rate_pct);
  if (!Number.isFinite(interest_rate_pct)) domain_errors.push('INVALID_INTEREST_RATE_PCT');

  const mechanismUsesClamp = funding_mechanism === 'offshore-8h-twap';
  let clamp_pct = null;
  if (mechanismUsesClamp) {
    clamp_pct = Number(pp.clamp_pct);
    if (!Number.isFinite(clamp_pct) || clamp_pct < 0) domain_errors.push('INVALID_CLAMP_PCT');
  }

  let prev_funding_hash = null;
  if (pp.prev_funding_hash !== undefined && pp.prev_funding_hash !== null) {
    if (typeof pp.prev_funding_hash === 'string' && HASH_RE.test(pp.prev_funding_hash)) {
      prev_funding_hash = pp.prev_funding_hash;
    } else {
      domain_errors.push('INVALID_PREV_FUNDING_HASH');
    }
  }

  const compliance_flags = [];

  if (domain_errors.length > 0) {
    compliance_flags.push('DOMAIN_ERROR');
    const output_payload = {
      funding_mechanism: MECHANISMS.includes(funding_mechanism) ? funding_mechanism : null,
      venue,
      interval_hours: Number.isFinite(interval_hours) ? interval_hours : null,
      position_side: (position_side === 'long' || position_side === 'short') ? position_side : null,
      funding_rate_pct: null,
      funding_payment: null,
      funding_payment_direction: null,
      periods_per_year: null,
      implied_annual_funding_yield_pct: null,
      prev_funding_hash,
      chained: false,
      domain_errors,
      scope_note: 'One or more declared inputs failed domain validation; no funding-rate or implied-yield figure is computed. Inputs are never silently clamped or coerced to a default — correct every field named in domain_errors and resubmit.',
    };
    return { output_payload, compliance_flags };
  }

  const premium_index = premium_index_pct / 100;
  const interest_component = interest_rate_pct / 100;

  let funding_rate;
  let mechanism_note;
  if (mechanismUsesClamp) {
    const clamp = clamp_pct / 100;
    const diffRaw = interest_component - premium_index;
    const diffClamped = Math.max(-clamp, Math.min(clamp, diffRaw));
    funding_rate = premium_index + diffClamped;
    mechanism_note = "offshore-8h-twap: funding_rate = premium_index + clamp(interest_rate - premium_index, -clamp_pct, +clamp_pct), applied to a TWAP-sampled premium index over the declared interval -- the continuous funding formula shape observed on offshore perpetual venues (e.g. Binance/Hyperliquid-class). The TWAP sampling and clamp bound are venue conventions this node lets the caller declare; the cited policy statement (see this node's cited_clause_digest) describes the funding-rate concept in general terms and does not itself prescribe this or any specific formula.";
  } else {
    funding_rate = premium_index;
    mechanism_note = "kalshi-periodic: funding_rate = premium_index, a single point-in-time price-differential reset at the declared interval, with no interest-rate offset term and no clamp -- modeled as the simpler, more directly observable mechanism shape a CFTC-regulated, manipulation-resistant DCM listing would plausibly use in place of a continuously-sampled offshore-style TWAP+clamp formula (see this node's cited_clause_digest for the reliability-at-every-funding-interval discussion this models against). The cited policy statement does not itself prescribe this or any specific formula -- this is a declared modeling choice (standards_basis: cites_informative), not a conformance claim against any venue's actual, unpublished-to-this-node computation.";
  }

  const funding_rate_pct = round6(funding_rate * 100);
  const side_sign = position_side === 'long' ? 1 : -1;
  const funding_payment = round6(position_notional * funding_rate * side_sign);
  const funding_payment_direction = funding_payment > 0 ? 'position_pays' : (funding_payment < 0 ? 'position_receives' : 'flat');

  const periods_per_year = round4((24 / interval_hours) * 365);
  const implied_annual_funding_yield_pct = round6(funding_rate_pct * periods_per_year);

  if (Math.abs(funding_rate_pct) >= 0.5) compliance_flags.push('HIGH_FUNDING_RATE');
  if (funding_rate_pct < 0) compliance_flags.push('NEGATIVE_FUNDING');
  if (prev_funding_hash) compliance_flags.push('CHAINED_TO_PRIOR_PRINT');

  const output_payload = {
    funding_mechanism,
    venue,
    mark_price: round6(mark_price),
    index_price: round6(index_price),
    interval_hours,
    position_side,
    position_notional: round6(position_notional),
    premium_index_pct: round6(premium_index_pct),
    interest_rate_pct: round6(interest_rate_pct),
    clamp_pct: clamp_pct === null ? null : round6(clamp_pct),
    funding_rate_pct,
    funding_payment,
    funding_payment_direction,
    periods_per_year,
    implied_annual_funding_yield_pct,
    prev_funding_hash,
    chained: prev_funding_hash !== null,
    domain_errors: [],
    mechanism_note,
    sign_convention_note: "Per the cited policy statement (see this node's cited_clause_digest): when the perpetual contract trades above the underlying spot/index price, long positions make payments while short positions receive them, and vice versa. funding_rate_pct > 0 with position_side=\"long\" therefore yields a positive (paying) funding_payment; the reverse holds for a short position or a negative rate.",
    scope_note: "Recomputes a caller-declared funding-rate formula and its simple-annualized implied yield from caller-declared inputs. Never fetches a live market price or a venue's actual current funding print, never asserts that any venue's own published print matches this recompute, and the mechanism formulas themselves are declared modeling conventions (see mechanism_note), not requirements drawn from the cited policy statement.",
    disclaimer: 'Not financial advice. Verify actual funding mechanics, interval length, and historical prints with your venue before trading. For informational purposes only.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  const prevHash = output_payload.prev_funding_hash || null;
  // Chain wiring: an explicit caller-supplied parent_hashes/parent_tool_ids always wins
  // (this stays a normal buildArtifact()); absent that, a valid prev_funding_hash inside
  // policy_parameters auto-populates the chain block. No prev_funding_hash => both arrays
  // stay empty and chain_depth stays 0, byte-for-byte the pre-chaining artifact shape.
  const chainedParentHashes = (parent_hashes.length === 0 && prevHash) ? [prevHash] : parent_hashes;
  const chainedParentToolIds = (parent_tool_ids.length === 0 && prevHash) ? [TOOL_ID] : parent_tool_ids;
  const chainedDepth = (parent_hashes.length === 0 && prevHash && chain_depth === 0) ? 1 : chain_depth;
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes: chainedParentHashes, parent_tool_ids: chainedParentToolIds, chain_depth: chainedDepth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
