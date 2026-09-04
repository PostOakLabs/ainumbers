/**
 * art-669-algo-execution-schedule-simulator.kernel.mjs
 *
 * ALGOSIM-BUILD-1 (ALGO-EXEC-SIM-BUILD-SPEC.md) -- deterministic execution-schedule arithmetic
 * for the buy-side desk audience. A SIMULATOR over caller-declared synthetic inputs, never a
 * consumer of market data: there is no feed, no network, no venue, and no clock inside compute().
 * The caller declares the order, the slicing method, the volume profile or bucket structure, and
 * both prices; this kernel only performs the arithmetic and returns it with a trace.
 *
 * THREE SLICING METHODS (declared, never chosen by this kernel):
 *   - vwap: slices the order across a declared volume_profile_pct[] that must sum to 100
 *     (fail closed otherwise). slice[i] = order_shares * pct[i] / 100, allocated by
 *     largest-remainder so the slices always re-sum to the order exactly.
 *   - twap: order_shares / bucket_count with a declared remainder_rule ("front" or "back")
 *     naming which bucket absorbs the indivisible remainder. When the division is exact no
 *     rule is needed; when it is not and no rule is declared, the run fails closed rather
 *     than guessing.
 *   - pov: participation_rate_pct of each declared per-bucket market volume, floored so a
 *     slice never exceeds the declared participation, and capped at the remaining unfilled
 *     order (running cap), so the schedule never exceeds order_shares. Any unfilled remainder
 *     is stated in the trace -- it is a property of the declared inputs, never a signal to
 *     act on.
 *
 * IMPLEMENTATION-SHORTFALL DECOMPOSITION over declared prices:
 *   shortfall_bps  = (avg_fill_price - arrival_price) / arrival_price * 10000, sign-corrected
 *                    by side (buy: as computed; sell: sign flipped) so positive always reads
 *                    "paid away" and negative always reads "improved versus arrival".
 *   shortfall_cost = (avg_fill_price - arrival_price) * order_shares, same side sign.
 *   Both are rounded half-up to 2 decimal places; slices are whole shares.
 *
 * NEVER GUESS, NEVER DEFAULT. An absent or invalid side, order, method, profile, bucket
 * structure, rate, or price resolves to the fail-closed payload -- slices/shortfall null,
 * each offending field named in domain_errors and in the trace -- never a silently repaired
 * schedule and never a silently defaulted parameter.
 *
 * SCOPE FENCE (advice-perimeter doctrine, PLATFORM-DOORS 4.4). This kernel simulates schedule
 * arithmetic over caller-declared synthetic inputs. It is NOT personalized investment advice,
 * NOT a recommendation to trade, hold, or choose any method or schedule, and NOT an order
 * router or execution management system: it never sends, stages, routes, or simulates the
 * sending of any order to any venue. Whether a schedule is suitable for any order is a
 * judgement that belongs to the caller alone.
 *
 * Output payload shape: exactly { slices, shortfall_bps, shortfall_cost, trace } on success
 * (the canonical pinned shape; extra keys would move the execution_hash), and the same four
 * keys nulled plus a domain_errors[] array on the fail-closed path (the flag-mirror member:
 * a caveat carrier, truthy exactly when inputs were refused).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute(). Runs unmodified in
 * the QuickJS-ng guest (no TextEncoder/atob/btoa/URL anywhere in this file).
 *
 * Spec: ALGO-EXEC-SIM-BUILD-SPEC.md (worked example + fail-closed vectors).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-669-algo-execution-schedule-simulator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_algo_execution_schedule_simulator',
  mandate_type: 'analytics_mandate',
  gpu: false,
};

const SIDES = ['buy', 'sell'];
const METHODS = ['vwap', 'twap', 'pov'];
const REMAINDER_RULES = ['front', 'back'];
const MAX_BUCKETS = 512;
const SUM_EPSILON = 1e-9; // float tolerance for volume_profile_pct summing to 100

// Human phrasing per domain error code -- composes the fail-closed trace.
const ERROR_PHRASES = {
  INVALID_SIDE: 'side must be "buy" or "sell"',
  INVALID_ORDER_SHARES: 'order_shares must be a positive whole number of shares',
  INVALID_METHOD: 'method must be one of vwap, twap, pov',
  INVALID_VOLUME_PROFILE: 'volume_profile_pct must be a non-empty array of percentages (each a number 0..100), at most 512 buckets (vwap)',
  PROFILE_SUM_NOT_100: 'volume_profile_pct must sum to exactly 100 (vwap requires a complete profile)',
  INVALID_BUCKET_COUNT: 'bucket_count must be a whole number between 1 and 512 (twap)',
  INVALID_REMAINDER_RULE: 'remainder_rule must be "front" or "back" when the order does not divide evenly across buckets (twap)',
  INVALID_PARTICIPATION_RATE: 'participation_rate_pct must be a number greater than 0 and at most 100 (pov)',
  INVALID_MARKET_VOLUMES: 'market_volumes must be a non-empty array of declared per-bucket volumes (numbers >= 0), at most 512 buckets (pov)',
  INVALID_ARRIVAL_PRICE: 'arrival_price must be a positive number',
  INVALID_AVG_FILL_PRICE: 'avg_fill_price must be a positive number',
};

function isFiniteNumber(v) { return typeof v === 'number' && Number.isFinite(v); }

/** Half-up rounding to dp decimals, sign-symmetric (deterministic; no toFixed on a float).
 *  10^dp by repeated multiplication — never Math.pow (a banned non-deterministic-guest transcendental). */
function roundHalfUp(x, dp) {
  let m = 1;
  for (let i = 0; i < dp; i++) m *= 10;
  const scaled = x * m;
  const r = scaled < 0 ? -Math.floor(-scaled + 0.5) : Math.floor(scaled + 0.5);
  return r / m;
}

/** Shortest round-trip number formatting for trace strings (12 -> "12", 50.06 -> "50.06"). */
function fmt(n) { return String(n); }

/** Largest-remainder allocation: whole-share slices proportional to pct[] that re-sum to order exactly. */
function vwapSlices(orderShoes, pct) {
  const quotas = pct.map((p) => (orderShoes * p) / 100);
  const base = quotas.map((q) => Math.floor(q));
  let allocated = 0;
  for (const b of base) allocated += b;
  let remainder = orderShoes - allocated;
  const order = quotas.map((q, i) => ({ i, frac: q - base[i] })).sort((a, b) => (b.frac - a.frac) || (a.i - b.i));
  const slices = base.slice();
  for (const o of order) {
    if (remainder <= 0) break;
    slices[o.i] += 1;
    remainder -= 1;
  }
  return slices;
}

/** TWAP slices: even base buckets with the indivisible remainder absorbed by the declared rule. */
function twapSlices(orderShares, bucketCount, remainderRule) {
  const base = Math.floor(orderShares / bucketCount);
  const remainder = orderShares - base * bucketCount;
  const slices = new Array(bucketCount).fill(base);
  if (remainder > 0) {
    if (remainderRule === 'front') slices[0] += remainder;
    else if (remainderRule === 'back') slices[bucketCount - 1] += remainder;
  }
  return { slices, remainder };
}

/** POV slices: floored participation of each declared bucket volume, capped at the remaining order. */
function povSlices(orderShares, ratePct, marketVolumes) {
  const rate = ratePct / 100;
  const slices = [];
  let remaining = orderShares;
  for (const mv of marketVolumes) {
    const participation = Math.floor(mv * rate);
    const slice = Math.min(participation, remaining);
    slices.push(slice);
    remaining -= slice;
  }
  return { slices, unfilled: remaining };
}

export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];

  const side = typeof pp.side === 'string' ? pp.side.trim().toLowerCase() : null;
  if (!SIDES.includes(side)) domain_errors.push('INVALID_SIDE');

  const orderShares = pp.order_shares;
  if (!(typeof orderShares === 'number' && Number.isSafeInteger(orderShares) && orderShares > 0)) domain_errors.push('INVALID_ORDER_SHARES');

  const method = typeof pp.method === 'string' ? pp.method.trim().toLowerCase() : null;
  if (!METHODS.includes(method)) domain_errors.push('INVALID_METHOD');

  const arrival = pp.arrival_price;
  if (!(isFiniteNumber(arrival) && arrival > 0)) domain_errors.push('INVALID_ARRIVAL_PRICE');

  const avgFill = pp.avg_fill_price;
  if (!(isFiniteNumber(avgFill) && avgFill > 0)) domain_errors.push('INVALID_AVG_FILL_PRICE');

  let slices = null;
  let scheduleNote = null;

  if (domain_errors.length === 0) {
    if (method === 'vwap') {
      const pct = pp.volume_profile_pct;
      const shapeOk = Array.isArray(pct) && pct.length > 0 && pct.length <= MAX_BUCKETS && pct.every((p) => isFiniteNumber(p) && p >= 0 && p <= 100);
      if (!shapeOk) {
        domain_errors.push('INVALID_VOLUME_PROFILE');
      } else {
        let sum = 0;
        for (const p of pct) sum += p;
        if (Math.abs(sum - 100) > SUM_EPSILON) {
          domain_errors.push('PROFILE_SUM_NOT_100');
        } else {
          slices = vwapSlices(orderShares, pct);
          scheduleNote = `slices = ${fmt(orderShares)} * pct/100 per bucket = [${slices.map(fmt).join(',')}]`;
        }
      }
    } else if (method === 'twap') {
      const bc = pp.bucket_count;
      if (!(typeof bc === 'number' && Number.isSafeInteger(bc) && bc >= 1 && bc <= MAX_BUCKETS)) {
        domain_errors.push('INVALID_BUCKET_COUNT');
      } else {
        const remainder = orderShares - Math.floor(orderShares / bc) * bc;
        const rule = typeof pp.remainder_rule === 'string' ? pp.remainder_rule.trim().toLowerCase() : null;
        if (remainder > 0 && !REMAINDER_RULES.includes(rule)) {
          domain_errors.push('INVALID_REMAINDER_RULE');
        } else {
          const r = twapSlices(orderShares, bc, rule);
          slices = r.slices;
          scheduleNote = remainder > 0
            ? `slices = ${fmt(orderShares)} / ${fmt(bc)} buckets, remainder ${fmt(remainder)} to ${rule} = [${slices.map(fmt).join(',')}]`
            : `slices = ${fmt(orderShares)} / ${fmt(bc)} buckets = [${slices.map(fmt).join(',')}]`;
        }
      }
    } else {
      // pov
      const rate = pp.participation_rate_pct;
      if (!(isFiniteNumber(rate) && rate > 0 && rate <= 100)) {
        domain_errors.push('INVALID_PARTICIPATION_RATE');
      } else {
        const mv = pp.market_volumes;
        const shapeOk = Array.isArray(mv) && mv.length > 0 && mv.length <= MAX_BUCKETS && mv.every((v) => isFiniteNumber(v) && v >= 0);
        if (!shapeOk) {
          domain_errors.push('INVALID_MARKET_VOLUMES');
        } else {
          const r = povSlices(orderShares, rate, mv);
          slices = r.slices;
          scheduleNote = `slices = ${fmt(rate)}% participation of declared bucket volumes, capped at remaining order = [${slices.map(fmt).join(',')}]`
            + (r.unfilled > 0 ? `; unfilled remainder ${fmt(r.unfilled)}` : '');
        }
      }
    }
  }

  const compliance_flags = [];

  if (domain_errors.length > 0) {
    compliance_flags.push('DOMAIN_ERROR');
    for (const code of domain_errors) compliance_flags.push(`ALGOSIM_${code}`);
    const reasons = domain_errors.map((c) => ERROR_PHRASES[c]).join('; ');
    return {
      output_payload: {
        slices: null,
        shortfall_bps: null,
        shortfall_cost: null,
        trace: `fail-closed: ${reasons}; no schedule or shortfall computed -- correct the named inputs and resubmit. Simulator over caller-declared synthetic inputs only: not advice, not a recommendation, and not an order router.`,
        domain_errors,
      },
      compliance_flags,
    };
  }

  const sign = side === 'buy' ? 1 : -1;
  const shortfall_bps = roundHalfUp(((avgFill - arrival) / arrival) * 10000 * sign, 2);
  const shortfall_cost = roundHalfUp((avgFill - arrival) * orderShares * sign, 2);
  const sideNote = side === 'buy'
    ? 'buy side, positive = cost'
    : 'sell side, sign flipped, positive = cost';

  const output_payload = {
    slices,
    shortfall_bps,
    shortfall_cost,
    trace: `${scheduleNote}; shortfall_bps = (${fmt(avgFill)} - ${fmt(arrival)}) / ${fmt(arrival)} * 10000 = ${fmt(shortfall_bps)} (${sideNote}); shortfall_cost = (${fmt(avgFill)} - ${fmt(arrival)}) * ${fmt(orderShares)} = ${fmt(shortfall_cost)}`,
  };

  return { output_payload, compliance_flags };
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
