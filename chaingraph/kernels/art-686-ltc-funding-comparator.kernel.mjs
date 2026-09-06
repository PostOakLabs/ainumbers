/**
 * art-686-ltc-funding-comparator.kernel.mjs
 *
 * LTC-COMPARATOR-BUILD-1 (LTC-COMPARATOR-BUILD-SPEC.md) -- deterministic
 * long-term-care funding arithmetic over caller-declared synthetic inputs.
 * A COMPARATOR, never advice: there is no policy record, no health datum,
 * no market feed, and no clock inside compute(). The caller declares a
 * horizon in years and three candidate funding amounts (self-fund annual
 * set-aside, hybrid premium total, traditional annual premium); this kernel
 * only computes the declared simple-sum totals and names the smallest.
 *
 * FUNCTIONS (per the spec):
 *   - Simple-sum comparison (the declared method, restated in the trace):
 *     self_fund_total = self_fund_annual * horizon_years;
 *     hybrid_total    = hybrid_premium_total (lump, already a sum);
 *     traditional_total = traditional_annual * horizon_years.
 *     Discounting is a declared-rate follow-on and is OUT OF SCOPE for v1.
 *   - Cheapest identified: the option with the unique smallest total, named
 *     in `cheapest`. Verdict "CHEAPEST_IDENTIFIED" on the unique-minimum
 *     path; the opposite verdict path is a tie -- verdict "TIE_IDENTIFIED"
 *     with `cheapest` null and the tied options named in the trace.
 *   - Sensitivity note: OUT OF SCOPE for v1 (spec follow-on).
 *
 * NEVER GUESS, NEVER DEFAULT. An absent or out-of-range input resolves to
 * the fail-closed payload -- every output field null, each offending field
 * named in domain_errors and in the trace -- never a silently repaired
 * projection.
 *
 * SCOPE FENCE (advice-perimeter doctrine, PLATFORM-DOORS 4.4; wealthtech
 * framing is binding copy per the spec). This kernel computes
 * multiply-accumulate-and-compare arithmetic over caller-declared synthetic
 * inputs. It is NOT insurance advice, NOT a policy recommendation, NOT a
 * suitability determination, and NOT a tax or benefits determination: it
 * never recommends that the caller buy, avoid, or replace any LTC funding
 * instrument. Naming carries no optimizer or advisor vocabulary anywhere.
 * Funding decisions belong to the caller and its advisers.
 *
 * Output payload shape: exactly { self_fund_total, hybrid_total,
 * traditional_total, cheapest, trace, overall } on a computable path (the
 * canonical pinned shape; extra keys would move the execution_hash), and
 * the same fields nulled plus a domain_errors[] array on the fail-closed
 * path (the flag-mirror member: a caveat carrier, truthy exactly when
 * inputs were refused).
 *
 * ROUNDING DECLARATION: every emitted monetary total is rounded to 2
 * decimal places, half-up (declared convention, restated here in-kernel;
 * the trace carries the raw product form per the canonical trace format).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute() (as-of
 * is an input by construction: nothing here reads a date). Runs unmodified in
 * the QuickJS-ng guest (no TextEncoder/atob/btoa/URL anywhere in this file).
 *
 * Spec: LTC-COMPARATOR-BUILD-SPEC.md (canonical preimage, execution_hash
 * pinned at staging: d058dc0bd4d821eaf43bcaa40c46384d3cb0cb814b8cf7c6ab8b449c678d7375).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-686-ltc-funding-comparator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_ltc_funding_comparator',
  mandate_type: 'compliance_control',
  gpu: false,
};

// Human phrasing per domain error code -- composes the fail-closed trace.
const ERROR_PHRASES = {
  INVALID_HORIZON: 'horizon_years must be an integer in [1, 100]',
  INVALID_SELF_FUND: 'self_fund_annual must be a finite number in [0, 1000000000]',
  INVALID_HYBRID: 'hybrid_premium_total must be a finite number in [0, 1000000000]',
  INVALID_TRADITIONAL: 'traditional_annual must be a finite number in [0, 1000000000]',
};

// Half-up rounding to dp decimal places (declared rounding convention). The
// scale factor is built by iterated multiplication, never Math.pow: IEEE 754
// multiplication is exactly specified, so this stays engine-deterministic
// where Math.pow is implementation-defined (kernel-determinism gate).
function roundHalfUp(x, dp) {
  let m = 1;
  for (let i = 0; i < dp; i++) m *= 10;
  const scaled = x * m;
  const r = scaled < 0 ? -Math.floor(-scaled + 0.5) : Math.floor(scaled + 0.5);
  return r / m;
}

function isMoney(v, min, max) {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];
  const compliance_flags = [];

  const years = pp.horizon_years;
  if (typeof years !== 'number' || !Number.isInteger(years) || years < 1 || years > 100) {
    domain_errors.push('INVALID_HORIZON');
  }

  const selfAnnual = pp.self_fund_annual;
  if (!isMoney(selfAnnual, 0, 1000000000)) domain_errors.push('INVALID_SELF_FUND');

  const hybridTotal = pp.hybrid_premium_total;
  if (!isMoney(hybridTotal, 0, 1000000000)) domain_errors.push('INVALID_HYBRID');

  const tradAnnual = pp.traditional_annual;
  if (!isMoney(tradAnnual, 0, 1000000000)) domain_errors.push('INVALID_TRADITIONAL');

  if (domain_errors.length > 0) {
    const reasons = domain_errors.map((c) => ERROR_PHRASES[c]).join('; ');
    compliance_flags.push('DOMAIN_ERROR');
    for (const code of domain_errors) compliance_flags.push(`LTCFUND_${code}`);
    return {
      output_payload: {
        self_fund_total: null,
        hybrid_total: null,
        traditional_total: null,
        cheapest: null,
        trace: `fail-closed: ${reasons}; no LTC funding comparison performed -- correct the named inputs and resubmit. Long-term-care funding arithmetic over caller-declared synthetic inputs only: not insurance advice, not a policy recommendation, and not a suitability determination.`,
        overall: null,
        domain_errors,
      },
      compliance_flags,
    };
  }

  const sfTotal = roundHalfUp(selfAnnual * years, 2);
  const hyTotal = roundHalfUp(hybridTotal, 2);
  const trTotal = roundHalfUp(tradAnnual * years, 2);

  // Trace factor string: the canonical simple-sum form from the spec --
  // "sa*h=sfTotal; hyTotal; ta*h=trTotal" -- byte-exact on the canonical path.
  const sumsStr = `simple-sum method as declared: ${selfAnnual}*${years}=${sfTotal}; ${hyTotal}; ${tradAnnual}*${years}=${trTotal}`;

  const options = [
    { name: 'self_fund', total: sfTotal },
    { name: 'hybrid', total: hyTotal },
    { name: 'traditional', total: trTotal },
  ];
  const minTotal = Math.min(sfTotal, hyTotal, trTotal);
  const winners = options.filter((o) => o.total === minTotal).map((o) => o.name);

  let overall;
  let cheapest;
  let trace;
  if (winners.length === 1) {
    cheapest = winners[0];
    overall = 'CHEAPEST_IDENTIFIED';
    trace = sumsStr;
  } else {
    cheapest = null;
    overall = 'TIE_IDENTIFIED';
    trace = `${sumsStr}; tie between ${winners.join(' and ')} at ${minTotal} -- no unique cheapest identified`;
  }

  return {
    output_payload: {
      self_fund_total: sfTotal,
      hybrid_total: hyTotal,
      traditional_total: trTotal,
      cheapest,
      trace,
      overall,
    },
    compliance_flags,
  };
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
