/**
 * art-681-best-execution-evidence-pack.kernel.mjs
 *
 * BESTEX-PACK-BUILD-1 (BESTEX-PACK-BUILD-SPEC.md) -- deterministic best-execution
 * monitoring arithmetic over caller-declared synthetic inputs. An EVIDENCE PACK
 * compiler, never a routing decision and never a published execution-quality
 * report: there is no order store, no venue connection, no fill observer, and no
 * clock inside compute(). The caller declares the per-venue fill count and the
 * per-venue average price improvement (bps); this kernel only computes the
 * fill-weighted improvement and flags the declared negative-improvement venues.
 *
 * FUNCTIONS (per the spec):
 *   - Fill-weighted price improvement: sum(venue fills * venue avg_improvement_bps)
 *     divided by total declared fills, rounded to 2 decimal places, HALF-UP.
 *     Rounding declaration (spec constraint): every real number this kernel emits
 *     is rounded 2dp half-up, away from zero, by repeatable integer-floor
 *     arithmetic -- no transcendentals, no Math.round banker's rounding.
 *   - negative_venues: declared venues whose declared avg_improvement_bps is
 *     strictly negative, preserving declared order.
 *   - Overall: "REVIEW_ITEM_FLAGGED" exactly when negative_venues is non-empty;
 *     otherwise "WITHIN_POLICY".
 *
 * PRIMARY TEXT (SO #38, recorded in-row before any constant landed):
 *   Commission Delegated Regulation (EU) 2026/825 on order execution policies
 *   (MiFIR review package; replaces the discontinued RTS 27 / RTS 28 reporting
 *   regimes with an evidence-based monitoring obligation -- "from documenting
 *   best execution to demonstrating it"). Citation lives in the node shard
 *   description; this comment carries articles only.
 *   - The regulation turns the deliverable from published execution-quality
 *     tables into internal best-execution EVIDENCE retained by the firm; this
 *     kernel compiles exactly such an internal monitoring evidence record from
 *     caller-declared monitoring MI.
 *   - Documentary dated constant (NOT in the hashed preimage): regulation
 *     applies from 12 February 2028. Measured 2026-09-05; source locator
 *     BESTEX-PACK-BUILD-SPEC.md staging note, corroborated by the MiFIR review
 *     RTS coverage (Linklaters financial regulation brief; ESMA best-execution
 *     reporting clarifications); derive: OJ publication plus the stated
 *     application period per the staging spec note.
 *
 * NEVER GUESS, NEVER DEFAULT. An absent or malformed venue list, venue name,
 * fill count, or improvement figure resolves to the fail-closed payload -- every
 * output field null, each offending field named in domain_errors and in the
 * trace -- never a silently repaired pack and never a defaulted venue or fill.
 *
 * SCOPE FENCE (advice-perimeter doctrine, PLATFORM-DOORS 4.4). This kernel
 * computes weighted-average and sign arithmetic over caller-declared synthetic
 * inputs. It is NOT investment advice, NOT a best-execution determination for
 * any actual order, NOT a routing engine, and NOT a regulatory submission: it
 * never sends, publishes, or files anything anywhere. Execution-quality
 * judgements belong to the firm and its reviewers alone.
 *
 * Output payload shape: exactly { weighted_improvement_bps, negative_venues,
 * trace, overall } on a computable path (the canonical pinned shape; extra keys
 * would move the execution_hash), and the same fields nulled plus a
 * domain_errors[] array on the fail-closed path.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute(). Runs
 * unmodified in the QuickJS-ng guest (no TextEncoder/atob/btoa/URL anywhere in
 * this file).
 *
 * Spec: BESTEX-PACK-BUILD-SPEC.md (canonical preimage, execution_hash pinned at
 * staging: 6bd25c0cf93b2ab0a11d5df456dcb996c1f2c9a04c8b6d49f01a07532518d5e3).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-681-best-execution-evidence-pack';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_best_execution_evidence_pack',
  mandate_type: 'compliance_control',
  gpu: false,
};

// Human phrasing per domain error code -- composes the fail-closed trace.
const ERROR_PHRASES = {
  INVALID_VENUES: 'venues must be a non-empty array of declared venue records',
  INVALID_VENUE_NAME: 'each venue.venue must be a non-empty string',
  INVALID_FILLS: 'each venue.fills must be an integer greater than 0',
  INVALID_IMPROVEMENT: 'each venue.avg_improvement_bps must be a finite number',
};

/** Round to 2 decimal places, half-up away from zero, by integer-floor steps. */
function round2dpHalfUp(x) {
  const sign = x < 0 ? -1 : 1;
  return (sign * Math.floor(Math.abs(x) * 100 + 0.5)) / 100;
}

/** Render a product for the trace: negatives attach their sign without a space. */
function renderTerm(acc, product) {
  if (acc === '') return `${product}`;
  return product < 0 ? `${acc}${product}` : `${acc}+${product}`;
}

export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];
  const compliance_flags = [];

  const venues = pp.venues;
  if (!Array.isArray(venues) || venues.length === 0) {
    domain_errors.push('INVALID_VENUES');
  } else {
    for (const v of venues) {
      if (!v || typeof v !== 'object' || typeof v.venue !== 'string' || v.venue.trim().length === 0) domain_errors.push('INVALID_VENUE_NAME');
      if (!v || typeof v !== 'object' || typeof v.fills !== 'number' || !Number.isInteger(v.fills) || v.fills <= 0) domain_errors.push('INVALID_FILLS');
      if (!v || typeof v !== 'object' || typeof v.avg_improvement_bps !== 'number' || !Number.isFinite(v.avg_improvement_bps)) domain_errors.push('INVALID_IMPROVEMENT');
    }
  }

  if (domain_errors.length > 0) {
    const reasons = [...new Set(domain_errors)].map((c) => ERROR_PHRASES[c]).join('; ');
    compliance_flags.push('DOMAIN_ERROR');
    for (const code of [...new Set(domain_errors)]) compliance_flags.push(`BESTEX_${code}`);
    return {
      output_payload: {
        weighted_improvement_bps: null,
        negative_venues: null,
        trace: `fail-closed: ${reasons}; no evidence pack computed -- correct the named inputs and resubmit. Best-execution monitoring arithmetic over caller-declared synthetic inputs only: not investment advice, not a best-execution determination, and not a regulatory submission. Rounding declaration: emitted numbers are 2dp half-up.`,
        overall: null,
        domain_errors: [...new Set(domain_errors)],
      },
      compliance_flags,
    };
  }

  // Declared arithmetic: fill-weighted mean improvement over declared venues.
  const totalFills = venues.reduce((s, v) => s + v.fills, 0);
  const products = venues.map((v) => v.fills * v.avg_improvement_bps);
  const rawWeighted = products.reduce((s, p) => s + p, 0) / totalFills;
  const weighted = round2dpHalfUp(rawWeighted);

  // Declared negative-improvement venues, declared order preserved.
  const negative_venues = venues
    .filter((v) => v.avg_improvement_bps < 0)
    .map((v) => v.venue);

  // Trace: canonical phrasing "(f1*b1 + f2*b2)/total = (p1p2)/total = w".
  const terms = venues.map((v, i) => `${v.fills}*${v.avg_improvement_bps}`).join(' + ');
  const productsRendered = products.reduce((acc, p) => renderTerm(acc, p), '');
  const trace = `(${terms})/${totalFills} = (${productsRendered})/${totalFills} = ${weighted}`;

  const overall = negative_venues.length > 0 ? 'REVIEW_ITEM_FLAGGED' : 'WITHIN_POLICY';

  return {
    output_payload: { weighted_improvement_bps: weighted, negative_venues, trace, overall },
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
