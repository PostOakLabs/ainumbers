import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-541-best-execution-recompute';
const TOOL_VERSION = '1.0.0';
const RULES_VERSION = 'best-execution-nbbo-recompute-2026.1';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_best_execution',
  mandate_type: 'analytics_mandate', gpu: false,
};

// EXCHANGE-ASSURANCE-BUILD-SPEC.md §2.4 -- recomputes, per supplied fill, price
// improvement in basis points against the NBBO at the time of execution, and whether
// the fill cleared at-or-better than the NBBO. Reg NMS best-execution obligations and
// FINRA Rule 5310 are the US crosswalk entry; the underlying recompute (price
// improvement vs. NBBO) is the generic shape any best-execution regime ultimately
// checks. This is a recompute over caller-supplied fill data only -- it does not
// verify the source of the NBBO or execution-price figures, does not fetch live
// market data, and makes no determination of regulatory compliance.
//
// FILL_SET_CEILING: input fill-set size is capped at 5,000 fills so the kernel runs
// over a small, finite, provable amount of data (the art-201 bounded-input lesson).
// No customer/order identifiers are accepted -- zero-PII by construction (CONTRACT
// zero-PII rule; also keeps this profile out of SPEC.md §25 scope per §2.6).
//
// Pure ECMA-262 arithmetic only -- no Date.now/argless new Date(), no Math.random.
// Every division guards its denominator so a zero/absent NBBO leg resolves to a
// finite, excluded fill rather than NaN/Infinity (the finite gate).

const FILL_SET_CEILING = 5000;
const SIDES = new Set(['buy', 'sell']);

function safeNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }

function computeFill(f, index) {
  const side = SIDES.has(f && f.side) ? f.side : null;
  const execution_price = safeNum(f && f.execution_price);
  const nbbo_bid = safeNum(f && f.nbbo_bid);
  const nbbo_ask = safeNum(f && f.nbbo_ask);
  const quantity = Math.max(0, safeNum(f && f.quantity) ?? 0);

  let price_improvement_bps = null;
  let at_or_better = null;
  let rejection_reason = null;

  if (!side) {
    rejection_reason = 'INVALID_SIDE';
  } else if (execution_price === null || execution_price <= 0) {
    rejection_reason = 'INVALID_EXECUTION_PRICE';
  } else if (side === 'buy' && (nbbo_ask === null || nbbo_ask <= 0)) {
    rejection_reason = 'MISSING_NBBO_ASK';
  } else if (side === 'sell' && (nbbo_bid === null || nbbo_bid <= 0)) {
    rejection_reason = 'MISSING_NBBO_BID';
  } else {
    price_improvement_bps = side === 'buy'
      ? (nbbo_ask - execution_price) / nbbo_ask * 10000
      : (execution_price - nbbo_bid) / nbbo_bid * 10000;
    at_or_better = price_improvement_bps >= 0;
  }

  return {
    index, side, execution_price: r2(execution_price), nbbo_bid: r2(nbbo_bid),
    nbbo_ask: r2(nbbo_ask), quantity: r2(quantity),
    price_improvement_bps: price_improvement_bps === null ? null : Math.round(price_improvement_bps * 100) / 100,
    at_or_better, rejection_reason,
  };
}

export function compute(pp) {
  pp = pp || {};
  const rawFills = arr(pp.fills);
  const truncated = rawFills.length > FILL_SET_CEILING;
  const fills = rawFills.slice(0, FILL_SET_CEILING).map(computeFill);

  const scored = fills.filter((f) => f.price_improvement_bps !== null);
  const atOrBetterCount = scored.filter((f) => f.at_or_better).length;
  const fill_count = fills.length;
  const scored_count = scored.length;
  const pct_at_or_better = scored_count > 0 ? Math.round((atOrBetterCount / scored_count) * 10000) / 100 : null;
  const avg_price_improvement_bps = scored_count > 0
    ? Math.round((scored.reduce((s, f) => s + f.price_improvement_bps, 0) / scored_count) * 100) / 100
    : null;
  const rejected_count = fill_count - scored_count;

  const compliance_flags = [];
  if (fill_count === 0) compliance_flags.push('NO_FILLS_SUPPLIED');
  if (truncated) compliance_flags.push('FILL_SET_TRUNCATED_AT_CEILING');
  if (rejected_count > 0) compliance_flags.push('SOME_FILLS_REJECTED_MISSING_NBBO');
  if (scored_count > 0) {
    compliance_flags.push(pct_at_or_better >= 100 ? 'ALL_SCORED_FILLS_AT_OR_BETTER' : 'SOME_SCORED_FILLS_WORSE_THAN_NBBO');
  }

  const output_payload = {
    fills,
    fill_count,
    scored_count,
    rejected_count,
    pct_at_or_better,
    avg_price_improvement_bps,
    fill_set_ceiling: FILL_SET_CEILING,
    fill_set_truncated: truncated,
    rules_version: RULES_VERSION,
    regulatory_basis: 'Reg NMS best-execution obligations (17 CFR 242) and FINRA Rule 5310; the price-improvement-vs-NBBO recompute is the generic shape any best-execution regime ultimately checks.',
    note: 'Deterministic per-fill recompute of price improvement against the caller-supplied NBBO at execution time. Does not verify the source of the execution-price or NBBO figures, does not fetch live market data, and is not a determination of regulatory compliance.',
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
    compute_proof_ready: 'deferred',
    deferred_reason: 'New shard; awaiting the async GPU proving queue (S18 steady-state).',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
