import { executionHash } from './_hash.mjs';

// art-682-rule-605-publication-composer (RULE605-COMPOSER-BUILD-1, RULE605-COMPOSER-BUILD-SPEC.md)
//
// Rule 605 publication composer for a caller-declared best-ex/669-shaped input set: the
// effective-vs-quoted spread ratio, covered-order roll-ups (declared counts, echoed in the
// verdict trace on the page, never guessed here), and a publication-row builder for declared
// categories. It exists because first-time Rule 605 filers have no arithmetic stepping-stone
// from declared spread statistics to publication-shaped rows; it links nothing and checks
// nothing live.
//
// VERDICT RULES (mechanical, from the declared inputs):
//   - eq_ratio = roundHalfUp(avg_effective_spread_bps / avg_quoted_spread_bps, 2).
//   - PUBLICATION_ROWS_BUILT iff every declared input is in domain (publication rows are
//     composed, one per declared category, or a single unnamed row when none are declared).
//   - otherwise fail-closed (overall null, every offending input named in domain_errors).
//
// ROUNDING CONVENTION (declared, per spec): eq_ratio and the trace's spread figures are rounded
// half-up to 2 (ratio) / 1 (spread bps) decimal places by roundHalfUp(x, dp) — 10^dp by repeated
// multiplication, never Math.pow (a banned non-deterministic-guest transcendental). The trace
// prints spreads at 1dp fixed notation and the ratio via ECMAScript Number-to-String, which is
// what makes the canonical preimage byte-exact.
//
// NEVER GUESS, NEVER DEFAULT. An absent, non-integer, out-of-range, or non-positive
// orders_covered, shares_covered, avg_effective_spread_bps, or avg_quoted_spread_bps — or a
// malformed declared_categories array — resolves to the fail-closed payload with every
// offending input named in domain_errors, never a silently repaired publication set.
//
// SCOPE FENCE: arithmetic over caller-declared synthetic declarations only. It does NOT read
// market data, any tape, any execution venue, or any order-management system; "covered" is the
// caller's declaration, never an observation this kernel makes; a PUBLICATION_ROWS_BUILT verdict
// says rows were composed from the declared inputs, not that any publication obligation is
// satisfied or assessed.
//
// Zero network, zero storage, zero randomness, zero wall-clock reads inside compute(). No
// TextEncoder/atob/btoa/URL/Date anywhere in this file (QuickJS-ng guest safe).

const TOOL_ID = 'art-682-rule-605-publication-composer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_rule_605_publication_composer',
  mandate_type: 'regulatory_reporting', gpu: false,
};

const MAX_ORDERS = 1000000;
const MAX_SHARES = 1000000000;
const MAX_SPREAD_BPS = 10000;
const MAX_CATEGORIES = 50;

const ERROR_PHRASES = {
  INVALID_ORDERS: 'orders_covered must be an integer in [1, 1000000]',
  INVALID_SHARES: 'shares_covered must be an integer in [1, 1000000000]',
  INVALID_EFFECTIVE: 'avg_effective_spread_bps must be a finite number in (0, 10000]',
  INVALID_QUOTED: 'avg_quoted_spread_bps must be a finite number in (0, 10000]',
  INVALID_CATEGORIES: 'declared_categories must be an array of 1 to 50 non-empty strings of at most 80 characters',
};

/** Half-up rounding to dp decimal places, sign-symmetric, deterministic. 10^dp by repeated
 *  multiplication — never Math.pow (a banned non-deterministic-guest transcendental). */
function roundHalfUp(x, dp) {
  let m = 1;
  for (let i = 0; i < dp; i++) m *= 10;
  const scaled = x * m;
  const r = scaled < 0 ? -Math.floor(-scaled + 0.5) : Math.floor(scaled + 0.5);
  return r / m;
}

function isCount(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function isSpread(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_SPREAD_BPS;
}

/** Fixed 1dp print for the trace, via half-up rounding to 1dp (never toFixed on the raw float
 *  path for half integers — roundHalfUp then String). */
function printBps(v) {
  const r = roundHalfUp(v, 1);
  return (Number.isInteger(r) ? r.toFixed(1) : String(r));
}

export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];

  const orders = pp.orders_covered;
  if (!isCount(orders) || orders < 1 || orders > MAX_ORDERS) domain_errors.push('INVALID_ORDERS');

  const shares = pp.shares_covered;
  if (!isCount(shares) || shares < 1 || shares > MAX_SHARES) domain_errors.push('INVALID_SHARES');

  const eff = pp.avg_effective_spread_bps;
  if (!isSpread(eff)) domain_errors.push('INVALID_EFFECTIVE');

  const quoted = pp.avg_quoted_spread_bps;
  if (!isSpread(quoted)) domain_errors.push('INVALID_QUOTED');

  const cats = pp.declared_categories;
  let categories = null;
  if (cats !== undefined) {
    if (!Array.isArray(cats) || cats.length < 1 || cats.length > MAX_CATEGORIES) {
      domain_errors.push('INVALID_CATEGORIES');
    } else {
      let ok = true;
      for (const c of cats) {
        if (typeof c !== 'string' || c.length < 1 || c.length > 80) { ok = false; break; }
      }
      if (!ok) domain_errors.push('INVALID_CATEGORIES');
      else categories = cats;
    }
  }

  const compliance_flags = [];

  if (domain_errors.length > 0) {
    compliance_flags.push('DOMAIN_ERROR');
    for (const code of domain_errors) compliance_flags.push(`R605_${code}`);
    const reasons = domain_errors.map((c) => ERROR_PHRASES[c]).join('; ');
    return {
      output_payload: {
        eq_ratio: null,
        publication_rows: null,
        trace: `fail-closed: ${reasons}; no publication rows composed -- correct the named inputs and resubmit. Arithmetic of caller-declared covered-order and spread declarations only: no market data, tape, venue, or order-management system is read, and covered orders/shares are your declarations, never observations this kernel makes.`,
        overall: null,
        domain_errors,
      },
      compliance_flags,
    };
  }

  const eqRatio = roundHalfUp(eff / quoted, 2);
  const trace = `${printBps(eff)}/${printBps(quoted)} = ${eqRatio} effective-to-quoted`;

  const output_payload = { eq_ratio: eqRatio, trace, overall: 'PUBLICATION_ROWS_BUILT' };
  if (categories !== null) {
    output_payload.publication_rows = categories.map((c) => ({ category: c, eq_ratio: eqRatio, orders_covered: orders, shares_covered: shares }));
  }

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
