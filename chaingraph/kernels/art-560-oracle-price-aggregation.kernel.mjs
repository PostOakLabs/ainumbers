// art-560 — Oracle Price Aggregation: deterministic aggregation-step simulator.
//
// DERIV-WORKFLOWS-BUILD-SPEC.md §6 (AT-06). Computes the aggregate price a
// decentralized oracle network would publish from a set of individual
// submissions, under four named aggregation mechanisms. Mechanism-named
// throughout: this node describes HOW an aggregation rule works, never which
// venue runs it.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): every
// submission -- price, weight, confidence, timestamp, submitter id -- is
// SUPPLIED by the caller and merely ASSERTED. This kernel performs zero
// price-feed, oracle-network or market-data lookups (zero-egress by contract,
// no network calls of any kind). It simulates the AGGREGATION STEP ONLY: the
// commit-reveal phase that precedes aggregation in most real networks is not
// modelled, and no claim is made that any real network would publish this
// number.
//
// DETERMINISM: two implementations that disagree on the stake-weighted median
// convention produce different execution_hash values on identical inputs. This
// kernel pins the convention explicitly (see STAKE-WEIGHTED MEDIAN below) and
// rounds every emitted float to a fixed decimal count, so the artifact is
// bit-reproducible across every §24 surface.
//
// §4 PER-PRINT LINEAGE (the prev_print_hash wiring): `prev_print_hash` is an
// OPTIONAL policy_parameters field. When supplied, this print cites the prior
// print of the same pair, turning a series of same-pair prints into a walkable
// chain, and buildArtifact populates chain.parent_hashes / chain.parent_tool_ids.
// When OMITTED, the wiring contributes NOTHING: the field is absent from
// policy_parameters and the two lineage keys are absent from output_payload, so
// the artifact is byte-identical to a kernel carrying no wiring at all. The
// keys are emitted CONDITIONALLY for exactly this reason -- a key emitted
// always, even holding null, would move the artifact hash on every call.
//
// SPEC.md §25: a submitter id is plaintext by default; a caller may instead
// supply it as a sha256-salted@1 commitment to withhold the identifier while
// still binding the aggregation to it. Prices, weights and confidences are NOT
// private-input eligible -- they are the computation's subject matter, and
// hiding them would leave nothing to aggregate.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-560-oracle-price-aggregation';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'oracle_price_aggregation',
  mandate_type: 'oracle_price_aggregation',
  gpu: false,
};

const MODES = [
  'median_filtered_confidence_weighted_mean',
  'stake_weighted_median_frequency',
  'three_vote_confidence_median',
  'plain_median',
];

const SHA256_SALTED_SCHEME = 'sha256-salted@1';
const SHA256_COMMITMENT_RE = /^sha256:[0-9a-f]{64}$/;
const SHA256_HASH_RE = /^sha256:[0-9a-f]{64}$/;

const PRICE_DP = 10;
const PCT_DP = 6;

const NOT_PROVEN = [
  { item: 'Submission authenticity', detail: 'Every price, weight, confidence, timestamp and submitter id is caller-supplied and asserted. This kernel performs no oracle-network, price-feed or market-data lookups (zero-egress) and does not verify any submission against an external source.' },
  { item: 'Commit-reveal phase', detail: 'This kernel simulates the aggregation step only. The commit-reveal phase that precedes aggregation in most real oracle networks is not modelled, so nothing here shows whether a submission was validly committed before it was revealed.' },
  { item: 'Real-network publication', detail: 'The aggregate computed here is what the named mechanism yields on the supplied submissions. It is not a claim that any real oracle network did, or would, publish this number for this pair at this epoch.' },
  { item: 'Outlier-penalty enforcement', detail: 'The outlier penalty rate is computed from the stated formula as an informative readout. This kernel does not assert that any penalty was applied, by whom, or under whose rulebook.' },
];

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function nonEmpty(v) { const s = safeStr(v); return s.length > 0 ? s : null; }
function num(v) { return Number.isFinite(v) ? v : null; }
function r(x, dp) {
  if (!Number.isFinite(x)) return null;
  return Number(x.toFixed(dp));
}

// Median of a numeric array, ascending. Even count averages the middle pair.
function median(sorted) {
  const n = sorted.length;
  if (n === 0) return null;
  const mid = n >> 1;
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Linear-interpolated percentile on an ascending array (the standard
// "linear / R-7" convention). Pinned explicitly because two conventions
// disagree here and the disagreement would move the hash.
function percentile(sorted, p) {
  const n = sorted.length;
  if (n === 0) return null;
  if (n === 1) return sorted[0];
  const idx = (n - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// STAKE-WEIGHTED MEDIAN (frequency convention, pinned):
// a submitter with twice the weight appears twice as often in the sorted list.
// This is NOT an arithmetic mean pulled toward the heavier weight. Sort by
// price, accumulate weight, and take the price at which cumulative weight first
// reaches 50% of total; when 50% falls strictly between two adjacent
// submissions, interpolate linearly between them.
function stakeWeightedMedian(rows) {
  const usable = rows.filter((s) => s.price != null && s.weight_pct != null && s.weight_pct > 0);
  if (usable.length === 0) return null;
  const sorted = usable.slice().sort((a, b) => (a.price - b.price) || (a.idx - b.idx));
  const total = sorted.reduce((acc, s) => acc + s.weight_pct, 0);
  if (!(total > 0)) return null;
  const half = total / 2;
  let cum = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const prevCum = cum;
    cum += sorted[i].weight_pct;
    if (cum > half) return sorted[i].price;
    if (cum === half) {
      // 50% falls exactly on this submission's upper boundary: interpolate to the next.
      const next = sorted[i + 1];
      if (!next) return sorted[i].price;
      return (sorted[i].price + next.price) / 2;
    }
    void prevCum;
  }
  return sorted[sorted.length - 1].price;
}

// Outlier penalty rate, from the documented quadratic-deviation form:
//   rate = max(0, diffPct^2 - 225) * confidence * 0.001 / 1e4, capped at 0.5%.
// Informative readout only -- see NOT_PROVEN.
function outlierPenaltyRate(diffPct, confidence) {
  const c = Number.isFinite(confidence) ? confidence : 0;
  const raw = Math.max(0, diffPct * diffPct - 225) * c * 0.001 / 1e4;
  return r(Math.min(raw, 0.5), 8);
}

function normalizeSubmission(raw, i, rejected) {
  const s = raw && typeof raw === 'object' ? raw : {};

  const declaredScheme = nonEmpty(s.submitter_id_commitment_scheme);
  let id = nonEmpty(s.id);
  let id_is_commitment = false;
  if (id && declaredScheme !== null) {
    if (declaredScheme !== SHA256_SALTED_SCHEME) {
      rejected.push({ where: `submissions[${i}].submitter_id_commitment_scheme`, reason: `unknown commitment scheme -- "${SHA256_SALTED_SCHEME}" is the sole scheme accepted (SPEC.md §25.1); the declared id is excluded rather than trusted as opaque`, supplied: declaredScheme });
      id = null;
    } else if (!SHA256_COMMITMENT_RE.test(id)) {
      rejected.push({ where: `submissions[${i}].id`, reason: `declared commitment_scheme "${SHA256_SALTED_SCHEME}" but the value is not a well-formed sha256: commitment (^sha256:[0-9a-f]{64}$)`, supplied: id });
      id = null;
    } else {
      id_is_commitment = true;
    }
  }

  const price = num(s.price);
  if (price === null) rejected.push({ where: `submissions[${i}].price`, reason: 'absent or not a finite number', supplied: s.price === undefined ? null : s.price });
  else if (price <= 0) rejected.push({ where: `submissions[${i}].price`, reason: 'must be greater than zero', supplied: s.price });

  const weight_pct = num(s.weight_pct);
  const confidence = num(s.confidence);

  const entry = {
    id,
    price: price !== null && price > 0 ? price : null,
    weight_pct,
    confidence,
    timestamp: nonEmpty(s.timestamp),
    label: id_is_commitment ? 'private-commitment' : 'asserted',
    idx: i,
  };
  if (declaredScheme !== null) entry.submitter_id_commitment_scheme = declaredScheme;
  return entry;
}

/**
 * compute(pp) — deterministic oracle aggregation-step simulator.
 * pp: {
 *   mode: one of MODES,
 *   currency_pair: string,
 *   submissions: [{ id, price, weight_pct, confidence, timestamp,
 *                   submitter_id_commitment_scheme? }],
 *   outlier_threshold_pct?: number,   // default 3.0
 *   epoch?: number,
 *   stale_after_seconds?: number,     // default 30
 *   prev_print_hash?: string,         // §4 wiring -- OPTIONAL, see header
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const modeRaw = nonEmpty(pp.mode);
  const mode = modeRaw && MODES.indexOf(modeRaw) !== -1 ? modeRaw : null;
  if (!mode) {
    rejected_inputs.push({ where: 'mode', reason: modeRaw ? `not one of the supported aggregation mechanisms: ${MODES.join(', ')}` : `absent -- must name the aggregation mechanism explicitly, never assumed; one of: ${MODES.join(', ')}`, supplied: modeRaw });
  }

  const currency_pair = nonEmpty(pp.currency_pair);
  if (!currency_pair) rejected_inputs.push({ where: 'currency_pair', reason: 'absent -- the pair this aggregation prints is required', supplied: null });

  const outlier_threshold_pct = Number.isFinite(pp.outlier_threshold_pct) && pp.outlier_threshold_pct >= 0 ? pp.outlier_threshold_pct : 3.0;
  const stale_after_seconds = Number.isFinite(pp.stale_after_seconds) && pp.stale_after_seconds > 0 ? pp.stale_after_seconds : 30;
  const epoch = Number.isFinite(pp.epoch) ? pp.epoch : null;

  const submissionsRaw = Array.isArray(pp.submissions) ? pp.submissions : [];
  const submissions = submissionsRaw.map((s, i) => normalizeSubmission(s, i, rejected_inputs));
  const priced = submissions.filter((s) => s.price != null);

  // §4 lineage: read the optional field. Absent => the wiring contributes nothing.
  const prevPrintRaw = nonEmpty(pp.prev_print_hash);
  let prev_print_hash = null;
  if (prevPrintRaw !== null) {
    if (SHA256_HASH_RE.test(prevPrintRaw)) prev_print_hash = prevPrintRaw;
    else rejected_inputs.push({ where: 'prev_print_hash', reason: 'supplied but not a well-formed sha256: execution_hash (^sha256:[0-9a-f]{64}$); the prior print is not cited rather than cited wrongly', supplied: prevPrintRaw });
  }

  let structural_error = null;
  if (!mode) structural_error = 'mode is required.';
  else if (!currency_pair) structural_error = 'currency_pair is required.';
  else if (priced.length === 0) structural_error = 'submissions must contain at least one entry with a usable price.';
  else if (mode === 'stake_weighted_median_frequency' && priced.every((s) => s.weight_pct == null || !(s.weight_pct > 0))) {
    structural_error = 'stake_weighted_median_frequency requires at least one submission with a positive weight_pct.';
  } else if (mode === 'three_vote_confidence_median' && priced.every((s) => s.confidence == null)) {
    structural_error = 'three_vote_confidence_median requires at least one submission with a confidence.';
  }

  let aggregated_price = null;
  let aggregate_confidence = null;
  let outliers_flagged = [];
  let outlier_detail = [];
  let surviving_count = null;
  let fault_tolerance = null;

  if (!structural_error) {
    const prices = priced.map((s) => s.price).slice().sort((a, b) => a - b);

    if (mode === 'median_filtered_confidence_weighted_mean') {
      // Step 1: unweighted median over ALL submissions; flag deviations beyond the threshold.
      const med = median(prices);
      const survivors = [];
      priced.forEach((s) => {
        const diffPct = med > 0 ? Math.abs(s.price - med) / med * 100 : 0;
        if (diffPct > outlier_threshold_pct) {
          outliers_flagged.push(s.id);
          outlier_detail.push({
            id: s.id,
            deviation_pct: r(diffPct, PCT_DP),
            outlier_penalty_rate_pct: outlierPenaltyRate(diffPct, s.confidence ?? 0),
          });
        } else {
          survivors.push(s);
        }
      });
      // Step 2: confidence-weighted arithmetic mean of the survivors.
      const withConf = survivors.filter((s) => s.confidence != null && s.confidence > 0);
      if (withConf.length > 0) {
        const wsum = withConf.reduce((a, s) => a + s.confidence, 0);
        const psum = withConf.reduce((a, s) => a + s.price * s.confidence, 0);
        aggregated_price = r(psum / wsum, PRICE_DP);
        aggregate_confidence = r(wsum / withConf.length, PRICE_DP);
      } else if (survivors.length > 0) {
        // No usable confidences: fall back to the unweighted mean of survivors and say so.
        const psum = survivors.reduce((a, s) => a + s.price, 0);
        aggregated_price = r(psum / survivors.length, PRICE_DP);
        aggregate_confidence = null;
      }
      surviving_count = survivors.length;

    } else if (mode === 'stake_weighted_median_frequency') {
      aggregated_price = r(stakeWeightedMedian(priced), PRICE_DP);
      surviving_count = priced.length;

    } else if (mode === 'three_vote_confidence_median') {
      // Each publisher casts three votes: p, p+c, p-c. Aggregate = median of all votes.
      const votes = [];
      priced.forEach((s) => {
        const c = s.confidence != null ? s.confidence : 0;
        votes.push(s.price, s.price + c, s.price - c);
      });
      votes.sort((a, b) => a - b);
      const agg = median(votes);
      aggregated_price = r(agg, PRICE_DP);
      const p25 = percentile(votes, 0.25);
      const p75 = percentile(votes, 0.75);
      aggregate_confidence = r(Math.max(Math.abs(agg - p25), Math.abs(p75 - agg)), PRICE_DP);
      surviving_count = priced.length;

    } else if (mode === 'plain_median') {
      aggregated_price = r(median(prices), PRICE_DP);
      surviving_count = priced.length;
      // f-of-n readout: with n reports, f faults are tolerable where n >= 3f+1,
      // and 2f+1 signatures are required to publish.
      const n = priced.length;
      const f = Math.floor((n - 1) / 3);
      fault_tolerance = { report_count: n, tolerable_faults: f, signatures_required: 2 * f + 1 };
    }
  }

  const min_submitted = priced.length ? r(Math.min(...priced.map((s) => s.price)), PRICE_DP) : null;
  const max_submitted = priced.length ? r(Math.max(...priced.map((s) => s.price)), PRICE_DP) : null;
  const price_spread_pct = (min_submitted != null && min_submitted > 0 && max_submitted != null)
    ? r((max_submitted - min_submitted) / min_submitted * 100, PCT_DP)
    : null;

  // Staleness: relative to the NEWEST supplied timestamp, not to wall-clock
  // (a kernel that read the clock would not be reproducible).
  const stamps = submissions
    .map((s) => (s.timestamp ? Date.parse(s.timestamp) : NaN))
    .filter((t) => Number.isFinite(t));
  const newest = stamps.length ? Math.max(...stamps) : null;
  const stale_submissions = [];
  if (newest !== null) {
    submissions.forEach((s) => {
      if (!s.timestamp) return;
      const t = Date.parse(s.timestamp);
      if (!Number.isFinite(t)) return;
      if ((newest - t) / 1000 > stale_after_seconds) stale_submissions.push(s.id);
    });
  }

  const private_input_candidates = submissions
    .map((s, i) => (s.label === 'private-commitment'
      ? { pointer: `/input_parameters/submissions/${i}/id`, commitment: s.id, commitment_scheme: SHA256_SALTED_SCHEME }
      : null))
    .filter(Boolean);

  const compliance_flags = [];
  if (structural_error) {
    compliance_flags.push('ORACLE_AGGREGATION_STRUCTURAL_ERROR');
  } else {
    compliance_flags.push('ORACLE_AGGREGATION_COMPUTED');
    if (outliers_flagged.length > 0) compliance_flags.push('OUTLIER_DETECTED');
    if (priced.length < 15) compliance_flags.push('LOW_SUBMISSION_COUNT');
    if (price_spread_pct != null && price_spread_pct > 1) compliance_flags.push('HIGH_SPREAD');
    if (stale_submissions.length > 0) compliance_flags.push('STALE_SUBMISSION');
    if (prev_print_hash) compliance_flags.push('ORACLE_PRINT_CHAIN_REFERENCED');
  }
  if (private_input_candidates.length > 0) compliance_flags.push('ORACLE_SUBMITTER_ID_PRIVATE_INPUT');
  if (rejected_inputs.length > 0) compliance_flags.push('ORACLE_AGGREGATION_INPUTS_REJECTED');
  compliance_flags.push('ORACLE_AGGREGATION_INPUTS_SUPPLIED_NOT_VERIFIED');

  const output_payload = {
    currency_pair,
    epoch,
    structural_error,
    aggregated_price,
    aggregation_method: mode,
    aggregate_confidence,
    submission_count: submissions.length,
    priced_submission_count: priced.length,
    surviving_count,
    outlier_count: outliers_flagged.length,
    outliers_flagged,
    outlier_detail,
    outlier_threshold_pct: r(outlier_threshold_pct, PCT_DP),
    price_spread_pct,
    min_submitted,
    max_submitted,
    stale_submissions,
    fault_tolerance,
    rejected_inputs,
    not_proven: NOT_PROVEN,
    fence: 'Every submission -- price, weight, confidence, timestamp and submitter id -- is SUPPLIED, asserted, and digested into this receipt. This kernel simulates the aggregation step only: it performs no price-feed or oracle-network lookups (zero-egress by contract), does not model the commit-reveal phase that precedes aggregation, and makes no claim that any real network did or would publish this number.',
  };

  // §4 wiring, emitted CONDITIONALLY. Omitting prev_print_hash leaves these two
  // keys absent, so the artifact is byte-identical to a no-wiring kernel.
  if (prev_print_hash) {
    output_payload.prev_print_hash = prev_print_hash;
    output_payload.chain_position = 'chained';
  }

  return { output_payload, compliance_flags, private_input_candidates };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);

  // §4 lineage: an explicit caller-supplied parent always wins. Otherwise a
  // valid prev_print_hash cites the prior print of this same pair. chain.* is
  // OUTSIDE the §4 preimage, so this population never moves execution_hash.
  let ph = parent_hashes;
  let pt = parent_tool_ids;
  let cd = chain_depth;
  if (ph.length === 0 && output_payload.prev_print_hash) {
    ph = [output_payload.prev_print_hash];
    pt = [TOOL_ID];
    cd = chain_depth > 0 ? chain_depth : 1;
  }

  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes: ph, parent_tool_ids: pt, chain_depth: cd },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    compute_mode:       'server',
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
