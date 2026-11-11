import { executionHash } from './_hash.mjs';

const TOOL_ID = '787-corridor-cost-averages';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_corridor_cost_averages',
  mandate_type: 'compliance_control', gpu: false,
};

/**
 * compute(pp) — pure decision kernel.
 *
 * Computes one remittance corridor's cost THREE ways from declared provider
 * quotes and reports each against the SDG 10.c 3% and G20 no-corridor-above-5%
 * per-corridor targets.
 *
 * AVERAGING SOURCES (pinned; see research/REMIT-COST-AVERAGES-PIN-2026-10-29.md):
 *   simple    - simple average of all quoted total costs (UN SDG indicator
 *               10.c.1 metadata, section 4.c Method of computation).
 *   lowest_n  - average of the n cheapest quotes, default n=3: the SmaRT
 *               average, defined by the same SDG 10.c.1 metadata section 4.c
 *               as the simple average of the three cheapest (and transparent)
 *               services in a corridor. n other than 3 is an analyst extension
 *               of the same rule and is labelled as such in method_notes.
 *   weighted  - ANALYST CONVENTION (not defined by RPW or the SDG metadata):
 *               average total cost weighted by declared provider market share.
 *               Motivation: the RPW survey frame itself selects providers to
 *               cover a minimum aggregated market share of 80 percent. It is
 *               null with a reason code whenever shares are missing or do not
 *               sum to 100 within tolerance - never silently renormalised.
 *
 * COST COMPONENTS: total cost of a quote = transfer fee + FX margin, as a
 * percentage of the send amount (World Bank RPW methodology). Reference send
 * amounts are the RPW 200 and 500; the default here is 200.
 *
 * TARGETS: SDG target 10.c - below 3 percent by 2030 (UN SDG 10.c.1 metadata
 * section 0.b); FSB G20 cross-border payments targets (final report, 13 Oct
 * 2021) - no retail remittance corridor above 5 percent by 2030. A quote
 * quoting both components is treated as transparent (SmaRT eligibility).
 *
 * ARITHMETIC: integer basis points internally, half-up rounding, applied ONCE
 * per reported figure. total_cost_pct = bps / 100 (basis-point resolution).
 * An average of k integer-bps figures is sum/k rounded half-up to integer bps.
 *
 * REFUSALS: a malformed quote (missing/non-pseudonymous provider_code,
 * non-finite or negative fee or FX margin, share outside 0..100) refuses the
 * whole call - partial aggregation over an invalid quote set could misstate a
 * corridor's standing against the targets. Fewer than one quote refuses.
 * lowest_n below 1 or above 50 refuses. Quotes carry pseudonymous provider
 * codes only; no real provider names, no PII.
 *
 * @param {object} pp policy_parameters:
 *   corridor        {origin, destination} ISO 3166 alpha-2 (required)
 *   send_amount     positive number, default 200 (RPW reference amount)
 *   quotes          array of {provider_code, fee, fx_margin_pct, market_share_pct?}
 *   lowest_n        optional integer, default 3 (SmaRT rule)
 *   targets         optional {sdg_pct, corridor_pct} overrides in percent
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const flags = [];
  const SDG_PCT = 3;
  const CORRIDOR_PCT = 5;
  const SHARE_TOLERANCE = 0.5;
  const DEFAULT_LOWEST_N = 3;
  const MAX_LOWEST_N = 50;

  // FLAG-COMPUTED-LINT (FLAGS-COMPUTED-LINT-1): the refusal flag is emitted via a
  // ternary on the data-dependent `refused` marker at the compute return - never as
  // an unconditional literal push (unearned-green class).
  let refused = false;
  function refuse(reason, detail) {
    refused = true;
    return {
      output_payload: {
        verdict: 'refused',
        refused_because: reason,
        detail: detail || null,
        averages: null,
        evidence: { record_type: 'corridor_cost_averages', tool_id: TOOL_ID, tool_version: TOOL_VERSION, refused: true },
        manual_review_required: true,
      },
      compliance_flags: refused ? ['MALFORMED_INPUT_REFUSED'] : flags,
    };
  }

  // -- corridor: two ISO 3166 alpha-2 codes.
  const c = pp.corridor || {};
  const origin = typeof c.origin === 'string' ? c.origin.toUpperCase() : '';
  const destination = typeof c.destination === 'string' ? c.destination.toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(origin) || !/^[A-Z]{2}$/.test(destination)) {
    return refuse('corridor_origin_destination_must_be_iso_alpha2', JSON.stringify(c).slice(0, 80));
  }

  // -- send_amount: positive, finite; RPW reference default 200.
  const sendAmount = typeof pp.send_amount === 'number' && isFinite(pp.send_amount) && pp.send_amount > 0
    ? pp.send_amount : 200;

  // -- lowest_n: integer 1..50, default 3 (SmaRT).
  let lowestN = DEFAULT_LOWEST_N;
  if (pp.lowest_n !== undefined && pp.lowest_n !== null) {
    if (typeof pp.lowest_n !== 'number' || !isFinite(pp.lowest_n) || pp.lowest_n !== Math.floor(pp.lowest_n) || pp.lowest_n < 1 || pp.lowest_n > MAX_LOWEST_N) {
      return refuse('lowest_n_must_be_integer_1_to_50', String(pp.lowest_n));
    }
    lowestN = pp.lowest_n;
  }

  // -- targets: optional overrides, sane bounds.
  let sdgBps = SDG_PCT * 100;
  let corridorBps = CORRIDOR_PCT * 100;
  if (pp.targets !== undefined && pp.targets !== null) {
    const t = pp.targets;
    if (typeof t.sdg_pct === 'number' && isFinite(t.sdg_pct) && t.sdg_pct > 0 && t.sdg_pct <= 100) sdgBps = Math.round(t.sdg_pct * 100);
    if (typeof t.corridor_pct === 'number' && isFinite(t.corridor_pct) && t.corridor_pct > 0 && t.corridor_pct <= 100) corridorBps = Math.round(t.corridor_pct * 100);
  }

  // -- quotes: array of 1..200 declared provider quotes.
  const rawQuotes = pp.quotes;
  if (!Array.isArray(rawQuotes) || rawQuotes.length < 1) return refuse('quotes_must_be_nonempty_array', null);
  if (rawQuotes.length > 200) return refuse('quotes_exceed_bounded_200', String(rawQuotes.length));

  // Half-up rounding to integer basis points.
  function halfUp(x) { return Math.floor(x + 0.5); }

  const quotes = [];
  for (let i = 0; i < rawQuotes.length; i++) {
    const q = rawQuotes[i] || {};
    const code = typeof q.provider_code === 'string' ? q.provider_code : '';
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(code)) return refuse('provider_code_missing_or_not_pseudonymous', 'quotes[' + i + ']');
    if (typeof q.fee !== 'number' || !isFinite(q.fee) || q.fee < 0) return refuse('quote_fee_not_finite_nonnegative', 'quotes[' + i + ']');
    if (typeof q.fx_margin_pct !== 'number' || !isFinite(q.fx_margin_pct) || q.fx_margin_pct < 0) return refuse('quote_fx_margin_not_finite_nonnegative', 'quotes[' + i + ']');
    let share = null;
    if (q.market_share_pct !== undefined && q.market_share_pct !== null) {
      if (typeof q.market_share_pct !== 'number' || !isFinite(q.market_share_pct) || q.market_share_pct < 0 || q.market_share_pct > 100) {
        return refuse('market_share_outside_0_to_100', 'quotes[' + i + ']');
      }
      share = q.market_share_pct;
    }
    // Integer basis-point arithmetic, exactly one rounding per quote:
    // total_bps = (fee / send_amount) * 10000 + fx_margin_pct * 100, half-up.
    const totalBps = halfUp((q.fee / sendAmount) * 10000 + q.fx_margin_pct * 100);
    quotes.push({ provider_code: code, share: share, total_bps: totalBps });
  }

  function verdictFor(avgBps) {
    return {
      total_cost_pct: avgBps / 100,
      meets_sdg_3pct: avgBps <= sdgBps,
      meets_g20_corridor_5pct: avgBps <= corridorBps,
      quotes_used: null, // filled by caller
    };
  }

  // simple average: sum / k, half-up to integer bps (SDG 10.c.1 section 4.c).
  function meanBps(list) {
    let sum = 0;
    for (let i = 0; i < list.length; i++) sum += list[i].total_bps;
    return halfUp(sum / list.length);
  }

  const simpleBps = meanBps(quotes);
  const simple = verdictFor(simpleBps);
  simple.quotes_used = quotes.length;

  // weighted average: analyst convention. Needs EVERY quote to carry a share
  // and the shares to sum to 100 within tolerance. Never renormalised.
  let weighted = null;
  let weightedReason = null;
  const withShare = quotes.filter(function (q) { return q.share !== null; });
  const coveragePct = halfUp((withShare.length / quotes.length) * 100);
  if (withShare.length === quotes.length) {
    let shareSum = 0;
    for (let i = 0; i < quotes.length; i++) shareSum += quotes[i].share;
    if (Math.abs(shareSum - 100) <= SHARE_TOLERANCE) {
      let acc = 0;
      for (let i = 0; i < quotes.length; i++) acc += quotes[i].total_bps * (quotes[i].share / 100);
      const weightedBps = halfUp(acc);
      weighted = verdictFor(weightedBps);
      weighted.quotes_used = quotes.length;
    } else {
      weightedReason = 'WEIGHTED_SHARES_SUM_OUT_OF_TOLERANCE';
    }
  } else {
    weightedReason = 'WEIGHTED_SHARES_MISSING';
  }

  // lowest_n average: n cheapest quotes, default n=3 (SmaRT). All quotes in
  // this schema quote both fee and FX margin, so all are SmaRT-eligible
  // (transparent). Fewer than n quotes: use all of them, noted.
  const sorted = quotes.slice().sort(function (a, b) { return a.total_bps - b.total_bps; });
  const nUsed = Math.min(lowestN, sorted.length);
  const cheapest = sorted.slice(0, nUsed);
  const lowestBps = meanBps(cheapest);
  const lowestNIsSmaRT = lowestN === DEFAULT_LOWEST_N;
  const lowest = verdictFor(lowestBps);
  lowest.quotes_used = nUsed;

  // spread in percentage points between max and min of the three averages
  // (null components excluded; spread needs at least two).
  const present = [simpleBps, weighted ? Math.round(weighted.total_cost_pct * 100) : null, lowestBps].filter(function (v) { return v !== null; });
  let spreadPp = null;
  if (present.length >= 2) {
    let mn = present[0];
    let mx = present[0];
    for (let i = 1; i < present.length; i++) { if (present[i] < mn) mn = present[i]; if (present[i] > mx) mx = present[i]; }
    spreadPp = (mx - mn) / 100;
  }

  const methodNotes = [
    'simple: simple average of all quoted total costs - UN SDG indicator 10.c.1 metadata, section 4.c Method of computation.',
    lowestNIsSmaRT
      ? 'lowest_n: n=3 cheapest quotes - the SmaRT average, UN SDG indicator 10.c.1 metadata section 4.c (simple average of the three cheapest transparent services in a corridor).'
      : 'lowest_n: n=' + lowestN + ' cheapest quotes - analyst extension of the SmaRT rule (SDG 10.c.1 metadata section 4.c defines n=3); n other than 3 is not a pinned definition.',
    'weighted: ANALYST CONVENTION - no pinned primary text defines a market-share-weighted corridor average; motivated by the World Bank RPW survey frame, which samples providers to cover at least 80 percent of corridor market share. Null with a reason code when shares are missing or do not sum to 100 within +/-0.5.',
    'targets: SDG target 10.c - below 3 percent by 2030 (UN SDG 10.c.1 metadata section 0.b); FSB G20 cross-border payments final report 13 Oct 2021 - no retail remittance corridor above 5 percent by 2030.',
    'cost per quote = transfer fee + FX margin as percent of send amount (World Bank RPW methodology); reference send amounts 200 and 500, default 200.',
    'arithmetic: integer basis points, half-up rounding applied once per figure; total_cost_pct = basis points / 100.',
    'synthetic inputs only: quotes are declared pseudonymous provider codes; this node aggregates caller-declared quotes and holds no live data.',
  ];

  return {
    output_payload: {
      verdict: 'ok',
      corridor: origin + '-' + destination,
      send_amount: sendAmount,
      lowest_n: lowestN,
      quotes_count: quotes.length,
      averages: {
        simple: simple,
        weighted: weighted,
        lowest_n: lowest,
      },
      weighted_null_reason: weightedReason,
      spread_pp: spreadPp,
      weighting_coverage_pct: coveragePct,
      targets: { sdg_pct: sdgBps / 100, corridor_pct: corridorBps / 100 },
      method_notes: methodNotes,
      pii_note: 'ZERO PII: pseudonymous provider codes, fees, margins, shares and corridor codes only. No person, account or real provider identity enters this kernel.',
      adjacency_note: 'averages.simple.total_cost_pct (or the chosen average) can feed compare_corridor_cost (art-249) as the declared corridor cost for target comparison.',
    },
    compliance_flags: refused ? ['MALFORMED_INPUT_REFUSED'] : flags,
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
    chain: { parent_hashes: parent_hashes, parent_tool_ids: parent_tool_ids, chain_depth: chain_depth },
    policy_parameters: pp,
    output_payload: output_payload,
    compliance_flags: compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
