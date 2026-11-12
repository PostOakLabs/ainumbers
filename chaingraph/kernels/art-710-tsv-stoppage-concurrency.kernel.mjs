import { executionHash } from './_hash.mjs';

// art-710-tsv-stoppage-concurrency — checks a tokenized-stock venue (TSV) against
// SEC TSV Exemption condition H (FR 2026-19388, 91 Fed. Reg. 60176, Sept. 22, 2026):
// "A TSV must stop trading in a Tokenized NMS Stock concurrently with any stoppage of
// trading in the underlying NMS stock on the primary listing exchange" and "Following
// any stoppage of trading in a Tokenized NMS Stock, a TSV must immediately notify its
// TSV Participants" — plus the TSV's own-halt duty: "if the TSV determines on its own
// accord to stop making available a Tokenized NMS Stock for trading, the TSV must
// immediately notify TSV Participants."
//
// The node is EVIDENCE ONLY. It replays caller-supplied trades, the TSV's own halt
// records and participant notices against the caller-declared listing-exchange
// stoppages, and reports: trades inside a stoppage interval beyond the declared
// concurrency tolerance; per-stoppage halt-record coverage; per-stoppage participant-
// notice presence. The order says "immediately" without a number, so notice latency is
// reported as a MEASURED VALUE in milliseconds and is never graded pass/fail.
//
// Boundary rule (declared in assumptions[] on every output): a stoppage interval is
// HALF-OPEN — start-inclusive, end-exclusive, [start_ts, end_ts). A trade at exactly
// end_ts is outside the stoppage. A trade within concurrency_tolerance_ms of a boundary
// (ts < start_ts + tolerance or ts >= end_ts - tolerance) sits inside the interval but
// inside the declared concurrency tolerance and is reported in per_stoppage counts
// without being flagged as a violation.
//
// KERNEL-CITATION-CLASS-1: the regulation lives in the node metadata
// (standards_basis, cited_clause_digest); this source carries behaviour only.
//
// Zero network: the node never reads a chain; it checks only what the caller supplies.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no
// network, no filesystem. No UTF-8 encoding is used, so no encoder is carried
// (GUEST-BUILTIN-GATE-1: TextEncoder/atob/btoa/URL are absent in the guest).

const TOOL_ID = 'art-710-tsv-stoppage-concurrency';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_tsv_stoppage_concurrency',
  mandate_type: 'compliance_control', gpu: false,
};

// Condition H valid stoppage kinds on the listing exchange (FR 2026-19388 p. 60176:
// "which includes a halt or a suspension"; the market-wide circuit breaker named in
// the same paragraph's examples).
export const STOPPAGE_KINDS = ['halt', 'suspension', 'mwcb'];

function deNull(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const c = { ...o };
  for (const k of Object.keys(c)) if (c[k] === null) c[k] = undefined;
  return c;
}

function refusal(code, detail) {
  return {
    output_payload: {
      error: code.toLowerCase(),
      detail,
      domain_errors: [{ code, text: detail }],
      violations: [],
      per_stoppage: [],
      concurrency_tolerance_ms: null,
      assumptions: [],
    },
    compliance_flags: code ? ['INPUT_REFUSED'] : [],
  };
}

function isInt(v) {
  return typeof v === 'number' && Number.isInteger(v);
}

// A well-formed millisecond timestamp: a non-negative safe integer.
function isTs(v) {
  return isInt(v) && v >= 0 && v <= 9007199254740991;
}

function isValidStoppage(s) {
  return s && typeof s === 'object' && !Array.isArray(s)
    && typeof s.symbol === 'string' && s.symbol.length > 0
    && isTs(s.start_ts)
    && (s.end_ts === null || isTs(s.end_ts))
    && (s.end_ts === null || s.end_ts >= s.start_ts)
    && STOPPAGE_KINDS.includes(s.kind);
}

function isValidTrade(t) {
  return t && typeof t === 'object' && !Array.isArray(t)
    && typeof t.symbol === 'string' && t.symbol.length > 0
    && isTs(t.ts)
    && typeof t.trade_id === 'string' && t.trade_id.length > 0;
}

function isValidHaltRecord(h) {
  return h && typeof h === 'object' && !Array.isArray(h)
    && typeof h.symbol === 'string' && h.symbol.length > 0
    && isTs(h.start_ts)
    && (h.end_ts === null || isTs(h.end_ts))
    && (h.end_ts === null || h.end_ts >= h.start_ts);
}

function isValidNotice(n) {
  return n && typeof n === 'object' && !Array.isArray(n)
    && typeof n.symbol === 'string' && n.symbol.length > 0
    && isTs(n.ts);
}

// Half-open interval membership: [start_ts, end_ts). Declared in assumptions[].
function inInterval(ts, startTs, endTs) {
  return ts >= startTs && (endTs === null || ts < endTs);
}

// Within tolerance of a boundary: the concurrency tolerance widens the tolerated
// window around the interval edges. Distance from the leading edge under the declared
// tolerance (strictly), or distance from the trailing edge at or under it — the
// threshold stays unshifted on one side of each comparator (COMPARATOR-EPSILON-LINT-1:
// never `ts < start + tol`, the widening-strict shape that fires across the boundary).
function withinTolerance(ts, startTs, endTs, tol) {
  if (ts - startTs < tol) return true;
  if (endTs !== null && endTs - ts <= tol) return true;
  return false;
}

/**
 * compute(pp) — pure decision kernel. Zero network; checks only caller-supplied records.
 *
 * pp: {
 *   stoppages: [{ symbol, start_ts, end_ts|null, kind: "halt"|"suspension"|"mwcb" }]
 *              — caller-declared stoppages of trading in the underlying NMS stock on
 *              the listing exchange,
 *   tsv_trades: [{ symbol, ts, trade_id }],
 *   tsv_halt_records: [{ symbol, start_ts, end_ts }] — the TSV's own halt records,
 *   participant_notices: [{ symbol, ts }],
 *   concurrency_tolerance_ms: non-negative integer (default 0), echoed.
 * }
 */
export function compute(pp) {
  pp = deNull(pp || {});

  // ---- concurrency_tolerance_ms ----
  let tol = 0;
  if (pp.concurrency_tolerance_ms !== undefined) {
    if (!isInt(pp.concurrency_tolerance_ms) || pp.concurrency_tolerance_ms < 0) {
      return refusal('TOLERANCE_INVALID',
        'concurrency_tolerance_ms must be a non-negative integer number of milliseconds; got '
        + JSON.stringify(pp.concurrency_tolerance_ms ?? null) + '.');
    }
    tol = pp.concurrency_tolerance_ms;
  }

  // ---- stoppages ----
  if (!Array.isArray(pp.stoppages) || pp.stoppages.length === 0) {
    return refusal('STOPPAGES_INVALID',
      'stoppages must be a non-empty array of { symbol, start_ts, end_ts|null, kind } where kind is one of halt | suspension | mwcb; got '
      + JSON.stringify(pp.stoppages ?? null) + '.');
  }
  for (const s of pp.stoppages) {
    if (!isValidStoppage(s)) {
      return refusal('STOPPAGE_ENTRY_INVALID',
        'each stoppage must carry a non-empty symbol string, an integer start_ts >= 0, an end_ts that is null (open-ended) or an integer >= start_ts, and a kind of halt | suspension | mwcb; got '
        + JSON.stringify(s ?? null) + '.');
    }
  }

  // ---- tsv_trades ----
  if (!Array.isArray(pp.tsv_trades)) {
    return refusal('TRADES_INVALID',
      'tsv_trades must be an array of { symbol, ts, trade_id }; got '
      + JSON.stringify(pp.tsv_trades ?? null) + '.');
  }
  for (const t of pp.tsv_trades) {
    if (!isValidTrade(t)) {
      return refusal('TRADE_ENTRY_INVALID',
        'each trade must carry a non-empty symbol string, an integer ts >= 0, and a non-empty trade_id string; got '
        + JSON.stringify(t ?? null) + '.');
    }
  }
  const seenTradeIds = new Set();
  for (const t of pp.tsv_trades) {
    if (seenTradeIds.has(t.trade_id)) {
      return refusal('TRADE_ID_DUPLICATE', 'trade_id ' + JSON.stringify(t.trade_id) + ' appears more than once.');
    }
    seenTradeIds.add(t.trade_id);
  }

  // ---- tsv_halt_records ----
  if (!Array.isArray(pp.tsv_halt_records)) {
    return refusal('HALT_RECORDS_INVALID',
      'tsv_halt_records must be an array of { symbol, start_ts, end_ts|null }; got '
      + JSON.stringify(pp.tsv_halt_records ?? null) + '.');
  }
  for (const h of pp.tsv_halt_records) {
    if (!isValidHaltRecord(h)) {
      return refusal('HALT_RECORD_ENTRY_INVALID',
        'each halt record must carry a non-empty symbol string, an integer start_ts >= 0, and an end_ts that is null (open-ended) or an integer >= start_ts; got '
        + JSON.stringify(h ?? null) + '.');
    }
  }

  // ---- participant_notices ----
  if (!Array.isArray(pp.participant_notices)) {
    return refusal('NOTICES_INVALID',
      'participant_notices must be an array of { symbol, ts }; got '
      + JSON.stringify(pp.participant_notices ?? null) + '.');
  }
  for (const n of pp.participant_notices) {
    if (!isValidNotice(n)) {
      return refusal('NOTICE_ENTRY_INVALID',
        'each participant notice must carry a non-empty symbol string and an integer ts >= 0; got '
        + JSON.stringify(n ?? null) + '.');
    }
  }

  // ---- per-stoppage evaluation ----
  const violations = [];
  const perStoppage = pp.stoppages.map((s) => {
    // Trades inside the half-open interval, split into tolerated (within the declared
    // concurrency tolerance of a boundary) and flagged.
    const tradesDuring = pp.tsv_trades
      .filter((t) => t.symbol === s.symbol && inInterval(t.ts, s.start_ts, s.end_ts));
    const tolerated = tradesDuring.filter((t) => withinTolerance(t.ts, s.start_ts, s.end_ts, tol));
    const flagged = tradesDuring.filter((t) => !withinTolerance(t.ts, s.start_ts, s.end_ts, tol));
    for (const t of flagged) {
      violations.push({
        type: 'TRADE_DURING_STOPPAGE',
        symbol: s.symbol,
        kind: s.kind,
        stoppage_start_ts: s.start_ts,
        stoppage_end_ts: s.end_ts,
        trade_id: t.trade_id,
        trade_ts: t.ts,
      });
    }

    // Coverage: a TSV halt record for the symbol that spans the whole stoppage
    // interval. An open-ended stoppage needs an open-ended record.
    const covering = pp.tsv_halt_records.find((h) => h.symbol === s.symbol
      && h.start_ts <= s.start_ts
      && ((s.end_ts === null && h.end_ts === null)
        || (s.end_ts !== null && h.end_ts !== null && h.end_ts >= s.end_ts)));
    const covered = covering !== undefined;
    if (!covered) {
      violations.push({
        type: 'HALT_RECORD_NOT_COVERING',
        symbol: s.symbol,
        kind: s.kind,
        stoppage_start_ts: s.start_ts,
        stoppage_end_ts: s.end_ts,
      });
    }

    // Notice presence and measured latency. The order says "immediately" without a
    // number, so latency is a measured value in ms and is never graded pass/fail.
    const notice = pp.participant_notices
      .filter((n) => n.symbol === s.symbol && n.ts >= s.start_ts)
      .sort((a, b) => a.ts - b.ts)[0];
    const noticeLatencyMs = notice === undefined ? null : notice.ts - s.start_ts;
    if (notice === undefined) {
      violations.push({
        type: 'NO_PARTICIPANT_NOTICE',
        symbol: s.symbol,
        kind: s.kind,
        stoppage_start_ts: s.start_ts,
        stoppage_end_ts: s.end_ts,
      });
    }

    return {
      symbol: s.symbol,
      kind: s.kind,
      start_ts: s.start_ts,
      end_ts: s.end_ts,
      covered,
      covering_halt_record: covered
        ? { start_ts: covering.start_ts, end_ts: covering.end_ts }
        : null,
      trades_during: tradesDuring.length,
      trades_flagged: flagged.length,
      trades_within_tolerance: tolerated.length,
      notice_latency_ms: noticeLatencyMs,
    };
  });

  return {
    output_payload: {
      concurrency_tolerance_ms: tol,
      counts: {
        stoppages: perStoppage.length,
        trades: pp.tsv_trades.length,
        trades_during_stoppages: perStoppage.reduce((a, r) => a + r.trades_during, 0),
        trades_flagged: perStoppage.reduce((a, r) => a + r.trades_flagged, 0),
        halt_records: pp.tsv_halt_records.length,
        participant_notices: pp.participant_notices.length,
        uncovered_stoppages: perStoppage.filter((r) => !r.covered).length,
        stoppages_without_notice: perStoppage.filter((r) => r.notice_latency_ms === null).length,
        violations: violations.length,
      },
      violations,
      per_stoppage: perStoppage,
      assumptions: [
        'Condition H of the SEC TSV Exemption (FR 2026-19388, 91 Fed. Reg. 60176, Sept. 22, 2026): a TSV must stop trading in a Tokenized NMS Stock concurrently with any stoppage of trading in the underlying NMS stock on the primary listing exchange, which includes a halt or a suspension, and must immediately notify its TSV Participants of any stoppage.',
        'Stoppage intervals are HALF-OPEN: start-inclusive, end-exclusive, [start_ts, end_ts). A trade at exactly end_ts is outside the stoppage.',
        'concurrency_tolerance_ms (caller-declared, echoed) widens the tolerated window around the interval edges: a trade with ts < start_ts + tolerance or ts >= end_ts - tolerance sits inside the interval but inside the declared tolerance and is counted without being flagged.',
        'The order says "immediately" without a number: notice latency is reported as a measured value in milliseconds and is never graded pass/fail.',
        'Notice latency is measured from the stoppage start to the earliest participant notice for the symbol at or after that start; an open-ended stoppage (end_ts null) is covered only by an open-ended TSV halt record.',
        'Evidence only: this node states no opinion on whether any latency, gap or trade is lawful; it reports what the caller-supplied records show.',
        'Zero network: the node never reads a chain and checks only the caller-supplied stoppages, trades, halt records and notices.',
      ],
    },
    compliance_flags: [],
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
